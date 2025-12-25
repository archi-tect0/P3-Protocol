/**
 * Atlas One Sessions - Wallet-anchored session management
 * 
 * Manages user sessions across all Atlas One experiences:
 * - Wallet-scoped preferences
 * - Cross-experience history
 * - Progress synchronization
 * - Favorites and collections
 */

export {
  getWalletFavorites,
  favoriteGame,
  unfavoriteGame,
} from '../../gamedeck/gamesService';

import { db } from '../../../db';
import { gameFavorites, mediaAccess, readingProgress } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { ExperienceKind } from '../types';

export interface SessionStats {
  wallet: string;
  totalGames: number;
  totalMedia: number;
  totalBooks: number;
  totalFavorites: number;
  lastActivity?: Date;
}

/**
 * Get session statistics for a wallet
 */
export async function getSessionStats(wallet: string): Promise<SessionStats> {
  const [favorites, media, books] = await Promise.all([
    db.select().from(gameFavorites).where(eq(gameFavorites.wallet, wallet)),
    db.select().from(mediaAccess).where(eq(mediaAccess.wallet, wallet)),
    db.select().from(readingProgress).where(eq(readingProgress.wallet, wallet)),
  ]);

  const allDates = [
    ...favorites.map(f => f.createdAt),
    ...media.map(m => m.updatedAt),
    ...books.map(b => b.lastReadAt),
  ].sort((a, b) => b.getTime() - a.getTime());

  return {
    wallet,
    totalGames: favorites.length,
    totalMedia: media.length,
    totalBooks: books.length,
    totalFavorites: favorites.length,
    lastActivity: allDates[0] || undefined,
  };
}

export interface RecentActivity {
  type: ExperienceKind;
  itemId: string;
  action: 'played' | 'watched' | 'read' | 'purchased' | 'favorited';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Get recent activity for a wallet
 */
export async function getRecentActivity(
  wallet: string,
  limit: number = 20
): Promise<RecentActivity[]> {
  const [favorites, media, books] = await Promise.all([
    db.select()
      .from(gameFavorites)
      .where(eq(gameFavorites.wallet, wallet))
      .orderBy(desc(gameFavorites.createdAt))
      .limit(limit),
    db.select()
      .from(mediaAccess)
      .where(eq(mediaAccess.wallet, wallet))
      .orderBy(desc(mediaAccess.updatedAt))
      .limit(limit),
    db.select()
      .from(readingProgress)
      .where(eq(readingProgress.wallet, wallet))
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(limit),
  ]);

  const activities: RecentActivity[] = [];

  for (const fav of favorites) {
    activities.push({
      type: 'game',
      itemId: fav.gameId,
      action: 'favorited',
      timestamp: fav.createdAt,
    });
  }

  for (const m of media) {
    activities.push({
      type: 'video',
      itemId: m.itemId,
      action: m.accessType === 'rental' ? 'watched' : 'purchased',
      timestamp: m.updatedAt,
      metadata: { playbackPosition: m.playbackPosition },
    });
  }

  for (const b of books) {
    activities.push({
      type: 'ebook',
      itemId: b.itemId,
      action: 'read',
      timestamp: b.lastReadAt,
      metadata: { percentComplete: b.percentComplete, currentPage: b.currentPage },
    });
  }

  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return activities.slice(0, limit);
}
