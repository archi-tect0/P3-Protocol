/**
 * GamesService - External API absorption and local catalog management
 * 
 * Absorbs free games from external APIs:
 * - FreeToGame: https://www.freetogame.com/api/games
 * - GamerPower: https://www.gamerpower.com/api/giveaways
 * 
 * Provides local search and favorites management.
 */

import { db } from '../../db';
import {
  games,
  gameFavorites,
  gameDeckReceipts,
  type Game,
  type GameFavorite,
  type InsertGame,
} from '@shared/schema';
import { eq, and, or, ilike, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

// External API response types

interface FreeToGameItem {
  id: number;
  title: string;
  thumbnail: string;
  short_description: string;
  game_url: string;
  genre: string;
  platform: string;
  publisher: string;
  developer: string;
  release_date: string;
  freetogame_profile_url: string;
}

interface GamerPowerItem {
  id: number;
  title: string;
  worth: string;
  thumbnail: string;
  image: string;
  description: string;
  instructions: string;
  open_giveaway_url: string;
  published_date: string;
  type: string;
  platforms: string;
  end_date: string;
  users: number;
  status: string;
  gamerpower_url: string;
}

// Filter types

export interface FreeToGameFilters {
  genre?: string;
  platform?: string;
  search?: string;
}

export interface GamerPowerFilters {
  platform?: string;
  type?: string;
  search?: string;
}

export interface SearchFilters {
  genre?: string;
  platform?: string;
  source?: 'developer' | 'freetogame' | 'gamerpower' | 'itch';
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `games:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Normalize FreeToGame API response to InsertGame format
 */
function normalizeFreeToGame(item: FreeToGameItem): InsertGame {
  return {
    id: `f2g:${item.id}`,
    title: item.title,
    genre: item.genre,
    platform: item.platform,
    url: item.game_url,
    thumbnail: item.thumbnail,
    source: 'freetogame',
    developer: item.developer,
    description: item.short_description,
    releaseDate: item.release_date,
    tags: item.genre ? [item.genre.toLowerCase()] : [],
    metadata: {
      publisher: item.publisher,
      profileUrl: item.freetogame_profile_url,
    },
  };
}

/**
 * Normalize GamerPower API response to InsertGame format
 */
function normalizeGamerPower(item: GamerPowerItem): InsertGame {
  return {
    id: `gp:${item.id}`,
    title: item.title,
    genre: item.type,
    platform: item.platforms,
    url: item.open_giveaway_url,
    thumbnail: item.thumbnail,
    source: 'gamerpower',
    developer: null,
    description: item.description,
    releaseDate: item.published_date,
    tags: item.type ? [item.type.toLowerCase()] : [],
    metadata: {
      worth: item.worth,
      image: item.image,
      instructions: item.instructions,
      endDate: item.end_date,
      users: item.users,
      status: item.status,
      gamerPowerUrl: item.gamerpower_url,
    },
  };
}

/**
 * Pull games from FreeToGame API
 * 
 * Fetches free-to-play games catalog and upserts into local database.
 * Supports filtering by genre, platform, and search term.
 * 
 * @param filters - Optional filters for genre, platform, search
 * @returns Object with counts and any errors
 */
export async function pullFreeToGame(filters?: FreeToGameFilters): Promise<{
  fetched: number;
  upserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let fetchedItems: FreeToGameItem[] = [];

  try {
    let url = 'https://www.freetogame.com/api/games';
    const params = new URLSearchParams();

    if (filters?.platform) {
      params.append('platform', filters.platform);
    }
    if (filters?.genre) {
      params.append('category', filters.genre);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'P3-GameDeck/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`FreeToGame API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('FreeToGame API returned invalid data format');
    }

    fetchedItems = data as FreeToGameItem[];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      fetchedItems = fetchedItems.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.short_description.toLowerCase().includes(searchLower)
      );
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching FreeToGame';
    errors.push(errorMsg);
    return { fetched: 0, upserted: 0, errors };
  }

  let upsertedCount = 0;

  for (const item of fetchedItems) {
    try {
      const normalized = normalizeFreeToGame(item);
      
      await db
        .insert(games)
        .values(normalized)
        .onConflictDoUpdate({
          target: games.id,
          set: {
            title: normalized.title,
            genre: normalized.genre,
            platform: normalized.platform,
            url: normalized.url,
            thumbnail: normalized.thumbnail,
            developer: normalized.developer,
            description: normalized.description,
            releaseDate: normalized.releaseDate,
            tags: normalized.tags,
            metadata: normalized.metadata,
            updatedAt: new Date(),
          },
        });

      upsertedCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error upserting game';
      errors.push(`Failed to upsert f2g:${item.id}: ${errorMsg}`);
    }
  }

  return {
    fetched: fetchedItems.length,
    upserted: upsertedCount,
    errors,
  };
}

/**
 * Pull giveaways from GamerPower API
 * 
 * Fetches gaming giveaways and upserts into local database.
 * Supports filtering by platform, type, and search term.
 * 
 * @param filters - Optional filters for platform, type, search
 * @returns Object with counts and any errors
 */
export async function pullGamerPower(filters?: GamerPowerFilters): Promise<{
  fetched: number;
  upserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let fetchedItems: GamerPowerItem[] = [];

  try {
    let url = 'https://www.gamerpower.com/api/giveaways';
    const params = new URLSearchParams();

    if (filters?.platform) {
      params.append('platform', filters.platform);
    }
    if (filters?.type) {
      params.append('type', filters.type);
    }

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'P3-GameDeck/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`GamerPower API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      if (data && typeof data === 'object' && 'status' in data) {
        return { fetched: 0, upserted: 0, errors: [] };
      }
      throw new Error('GamerPower API returned invalid data format');
    }

    fetchedItems = data as GamerPowerItem[];

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      fetchedItems = fetchedItems.filter(item =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
      );
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching GamerPower';
    errors.push(errorMsg);
    return { fetched: 0, upserted: 0, errors };
  }

  let upsertedCount = 0;

  for (const item of fetchedItems) {
    try {
      const normalized = normalizeGamerPower(item);
      
      await db
        .insert(games)
        .values(normalized)
        .onConflictDoUpdate({
          target: games.id,
          set: {
            title: normalized.title,
            genre: normalized.genre,
            platform: normalized.platform,
            url: normalized.url,
            thumbnail: normalized.thumbnail,
            description: normalized.description,
            releaseDate: normalized.releaseDate,
            tags: normalized.tags,
            metadata: normalized.metadata,
            updatedAt: new Date(),
          },
        });

      upsertedCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error upserting giveaway';
      errors.push(`Failed to upsert gp:${item.id}: ${errorMsg}`);
    }
  }

  return {
    fetched: fetchedItems.length,
    upserted: upsertedCount,
    errors,
  };
}

/**
 * Search local games catalog
 * 
 * Searches the local games database with optional filters.
 * Supports filtering by genre, platform, source, and text search.
 * 
 * @param filters - Optional search filters
 * @returns Array of matching games
 */
export async function searchGames(filters?: SearchFilters): Promise<Game[]> {
  const conditions = [];

  if (filters?.genre) {
    conditions.push(ilike(games.genre, `%${filters.genre}%`));
  }

  if (filters?.platform) {
    conditions.push(ilike(games.platform, `%${filters.platform}%`));
  }

  if (filters?.source) {
    conditions.push(eq(games.source, filters.source));
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(games.title, `%${filters.search}%`),
        ilike(games.description, `%${filters.search}%`)
      )
    );
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  try {
    const query = db
      .select()
      .from(games)
      .limit(limit)
      .offset(offset)
      .orderBy(games.title);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }

    return await query;
  } catch (err) {
    console.error('Error searching games:', err);
    return [];
  }
}

/**
 * Add a game to wallet favorites
 * 
 * Creates a favorite entry linking a wallet to a game.
 * Optionally creates an audit receipt.
 * 
 * @param wallet - Wallet address
 * @param gameId - Game ID (e.g., "f2g:123" or "gp:456")
 * @param position - Optional display position (default: 0)
 * @returns The created favorite entry or null on error
 */
export async function favoriteGame(
  wallet: string,
  gameId: string,
  position: number = 0
): Promise<GameFavorite | null> {
  try {
    const [existingGame] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!existingGame) {
      throw new Error(`Game not found: ${gameId}`);
    }

    const [existing] = await db
      .select()
      .from(gameFavorites)
      .where(
        and(
          eq(gameFavorites.wallet, wallet),
          eq(gameFavorites.gameId, gameId)
        )
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const [favorite] = await db
      .insert(gameFavorites)
      .values({
        wallet,
        gameId,
        position,
      })
      .returning();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'gamesService',
      action: 'favorite.add',
      metaJson: {
        gameId,
        position,
        gameTitle: existingGame.title,
      },
      requestId,
    });

    return favorite;
  } catch (err) {
    console.error('Error adding favorite:', err);
    return null;
  }
}

/**
 * Remove a game from wallet favorites
 * 
 * @param wallet - Wallet address
 * @param gameId - Game ID
 * @returns True if removed, false otherwise
 */
export async function unfavoriteGame(
  wallet: string,
  gameId: string
): Promise<boolean> {
  try {
    const result = await db
      .delete(gameFavorites)
      .where(
        and(
          eq(gameFavorites.wallet, wallet),
          eq(gameFavorites.gameId, gameId)
        )
      )
      .returning();

    if (result.length > 0) {
      const requestId = generateRequestId();
      await db.insert(gameDeckReceipts).values({
        wallet,
        actor: 'gamesService',
        action: 'favorite.remove',
        metaJson: { gameId },
        requestId,
      });
      return true;
    }

    return false;
  } catch (err) {
    console.error('Error removing favorite:', err);
    return false;
  }
}

/**
 * Get all favorites for a wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of favorite entries with game details
 */
export async function getWalletFavorites(wallet: string): Promise<Array<GameFavorite & { game: Game }>> {
  try {
    const favorites = await db
      .select()
      .from(gameFavorites)
      .where(eq(gameFavorites.wallet, wallet))
      .orderBy(gameFavorites.position);

    const result: Array<GameFavorite & { game: Game }> = [];

    for (const fav of favorites) {
      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, fav.gameId))
        .limit(1);

      if (game) {
        result.push({ ...fav, game });
      }
    }

    return result;
  } catch (err) {
    console.error('Error getting favorites:', err);
    return [];
  }
}

/**
 * Get a single game by ID
 * 
 * @param gameId - Game ID
 * @returns Game or null if not found
 */
export async function getGame(gameId: string): Promise<Game | null> {
  try {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    return game || null;
  } catch (err) {
    console.error('Error getting game:', err);
    return null;
  }
}

/**
 * Get games by source
 * 
 * @param source - Source to filter by
 * @param limit - Max results (default: 100)
 * @returns Array of games from the specified source
 */
export async function getGamesBySource(
  source: 'developer' | 'freetogame' | 'gamerpower' | 'itch',
  limit: number = 100
): Promise<Game[]> {
  try {
    return await db
      .select()
      .from(games)
      .where(eq(games.source, source))
      .limit(limit)
      .orderBy(games.updatedAt);
  } catch (err) {
    console.error('Error getting games by source:', err);
    return [];
  }
}
