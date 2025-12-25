/**
 * DiscoveryService - Game discovery, trending metrics, and governance
 * 
 * Provides:
 * - Trending game computation from events, favorites, anchors
 * - Featured/curated game queries
 * - Governance metric aggregation from anchor fees
 */

import { db } from '../../db';
import {
  games,
  gameEvents,
  gameFavorites,
  anchorLedger,
  discoveryRollups,
  governanceAccounts,
  type Game,
  type DiscoveryRollup,
  type GovernanceAccount,
} from '@shared/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

/**
 * Compute trending games for a given period
 * 
 * Aggregates:
 * - Game events (session.start, highscore, achievement)
 * - Favorites added
 * - Anchor activity (games with anchored events)
 * 
 * Updates discovery_rollups with metricType="trending"
 */
export async function computeTrending(
  period: 'daily' | 'weekly'
): Promise<{
  rollups: DiscoveryRollup[];
  computedAt: Date;
}> {
  const now = new Date();
  const cutoff = new Date();
  
  if (period === 'daily') {
    cutoff.setHours(cutoff.getHours() - 24);
  } else {
    cutoff.setDate(cutoff.getDate() - 7);
  }

  const eventCounts = await db
    .select({
      gameId: gameEvents.gameId,
      count: sql<number>`count(*)::int`,
    })
    .from(gameEvents)
    .where(gte(gameEvents.occurredAt, cutoff))
    .groupBy(gameEvents.gameId);

  const favoriteCounts = await db
    .select({
      gameId: gameFavorites.gameId,
      count: sql<number>`count(*)::int`,
    })
    .from(gameFavorites)
    .where(gte(gameFavorites.createdAt, cutoff))
    .groupBy(gameFavorites.gameId);

  const anchorCounts = await db
    .select({
      gameId: anchorLedger.gameId,
      count: sql<number>`count(*)::int`,
    })
    .from(anchorLedger)
    .where(gte(anchorLedger.createdAt, cutoff))
    .groupBy(anchorLedger.gameId);

  const scoreMap = new Map<string, number>();

  for (const { gameId, count } of eventCounts) {
    const current = scoreMap.get(gameId) || 0;
    scoreMap.set(gameId, current + count * 1);
  }

  for (const { gameId, count } of favoriteCounts) {
    const current = scoreMap.get(gameId) || 0;
    scoreMap.set(gameId, current + count * 3);
  }

  for (const { gameId, count } of anchorCounts) {
    const current = scoreMap.get(gameId) || 0;
    scoreMap.set(gameId, current + count * 2);
  }

  await db
    .delete(discoveryRollups)
    .where(
      and(
        eq(discoveryRollups.metricType, 'trending'),
        eq(discoveryRollups.period, period)
      )
    );

  const rollupValues: Array<{
    gameId: string;
    metricType: string;
    period: string;
    value: number;
  }> = [];

  for (const [gameId, value] of scoreMap) {
    rollupValues.push({
      gameId,
      metricType: 'trending',
      period,
      value,
    });
  }

  if (rollupValues.length === 0) {
    return { rollups: [], computedAt: now };
  }

  const rollups = await db
    .insert(discoveryRollups)
    .values(rollupValues)
    .returning();

  return { rollups, computedAt: now };
}

/**
 * Get trending games for a period
 * 
 * Queries discovery_rollups ordered by value descending
 * Joins with games table to return full game info with metrics
 */
export async function getTrending(
  period: 'daily' | 'weekly',
  limit: number = 10
): Promise<Array<Game & { trendingScore: number }>> {
  const rollups = await db
    .select()
    .from(discoveryRollups)
    .where(
      and(
        eq(discoveryRollups.metricType, 'trending'),
        eq(discoveryRollups.period, period)
      )
    )
    .orderBy(desc(discoveryRollups.value))
    .limit(limit);

  if (rollups.length === 0) {
    return [];
  }

  const gameIds = rollups.map(r => r.gameId);
  const scoreMap = new Map<string, number>();
  for (const r of rollups) {
    scoreMap.set(r.gameId, r.value);
  }

  const gameResults = await db
    .select()
    .from(games)
    .where(sql`${games.id} = ANY(${gameIds})`);

  const sortedGames = gameResults
    .map(game => ({
      ...game,
      trendingScore: scoreMap.get(game.id) || 0,
    }))
    .sort((a, b) => b.trendingScore - a.trendingScore);

  return sortedGames;
}

/**
 * Get featured/curated games
 * 
 * Returns games with:
 * - High rating (>= 4.0)
 * - Or marked as featured in metadata
 * 
 * Sorted by rating descending
 */
export async function getFeatured(
  limit: number = 10
): Promise<Game[]> {
  const featuredGames = await db
    .select()
    .from(games)
    .where(
      sql`(${games.rating} >= 4.0 OR (${games.metadata}->>'featured')::boolean = true)`
    )
    .orderBy(desc(games.rating))
    .limit(limit);

  return featuredGames;
}

/**
 * Compute and update governance metrics for a wallet
 * 
 * Aggregates:
 * - Total fees paid from anchor_ledger
 * - Count of violations (placeholder, would come from external service)
 * 
 * Creates or updates governance_accounts record
 */
export async function computeGovernance(
  wallet: string
): Promise<GovernanceAccount> {
  if (!wallet) {
    throw new Error('Wallet address is required');
  }

  const [feeResult] = await db
    .select({
      totalFees: sql<string>`COALESCE(SUM(${anchorLedger.feeWei}::numeric), 0)::text`,
    })
    .from(anchorLedger)
    .where(eq(anchorLedger.wallet, wallet));

  const totalFeesPaid = feeResult?.totalFees || '0';

  const [existingAccount] = await db
    .select()
    .from(governanceAccounts)
    .where(eq(governanceAccounts.wallet, wallet))
    .limit(1);

  const now = new Date();

  if (existingAccount) {
    const [updated] = await db
      .update(governanceAccounts)
      .set({
        totalFeesPaid,
        updatedAt: now,
      })
      .where(eq(governanceAccounts.wallet, wallet))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(governanceAccounts)
    .values({
      wallet,
      totalFeesPaid,
      rateLimit: 1000,
      violations: 0,
      status: 'active',
    })
    .returning();

  return created;
}
