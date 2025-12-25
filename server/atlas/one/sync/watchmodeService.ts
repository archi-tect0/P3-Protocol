/**
 * Watchmode Service - Streaming Availability API
 * 
 * Syncs free movies and TV shows from AVOD platforms via Watchmode.
 * Surfaces content from Tubi, Pluto TV, Plex, Crackle, and more.
 * 
 * API: https://api.watchmode.com
 * Docs: https://api.watchmode.com/docs
 */

import { db } from '../../../db';
import { marketplaceItems, ratings } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface WatchmodeTitle {
  id: number;
  title: string;
  year: number;
  imdb_id: string | null;
  tmdb_id: number | null;
  type: 'movie' | 'tv_series' | 'tv_movie' | 'short_film';
}

interface WatchmodeSource {
  source_id: number;
  name: string;
  type: 'sub' | 'rent' | 'buy' | 'free' | 'addon';
  region: string;
  ios_url: string | null;
  android_url: string | null;
  web_url: string | null;
  format: string;
  price: number | null;
}

interface WatchmodeTitleDetails {
  id: number;
  title: string;
  original_title: string;
  plot_overview: string;
  type: string;
  runtime_minutes: number;
  year: number;
  end_year: number | null;
  release_date: string;
  imdb_id: string;
  tmdb_id: number;
  tmdb_type: string;
  genres: number[];
  genre_names: string[];
  user_rating: number;
  critic_score: number;
  us_rating: string;
  poster: string;
  backdrop: string;
  original_language: string;
  similar_titles: number[];
  networks: number[];
  network_names: string[];
  trailer: string;
  trailer_thumbnail: string;
  sources: WatchmodeSource[];
}

interface SyncResult {
  fetched: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const WATCHMODE_API_BASE = 'https://api.watchmode.com/v1';

const FREE_SOURCE_IDS = {
  TUBI: 203,
  PLUTO: 57,
  PLEX: 538,
  CRACKLE: 41,
  VUDU_FREE: 332,
  PEACOCK_FREE: 387,
  FREEVEE: 613,
  YOUTUBE_FREE: 344,
};

function getApiKey(): string | null {
  return process.env.WATCHMODE_API_KEY || null;
}

async function fetchFromWatchmode<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('WATCHMODE_API_KEY not configured');
  }

  const url = new URL(`${WATCHMODE_API_BASE}${endpoint}`);
  url.searchParams.set('apiKey', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Watchmode API error: ${response.status}`);
  }

  return response.json();
}

export async function syncWatchmodeFreeMovies(options: {
  sourceIds?: number[];
  limit?: number;
} = {}): Promise<SyncResult> {
  const { 
    sourceIds = [FREE_SOURCE_IDS.TUBI, FREE_SOURCE_IDS.PLUTO, FREE_SOURCE_IDS.PLEX],
    limit = 250 
  } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    result.errors.push('WATCHMODE_API_KEY not configured - skipping Watchmode sync');
    return result;
  }

  try {
    console.log(`Fetching free movies from Watchmode (sources: ${sourceIds.join(',')})...`);

    const data = await fetchFromWatchmode<{ titles: WatchmodeTitle[]; total_results: number }>(
      '/list-titles/',
      {
        source_ids: sourceIds.join(','),
        types: 'movie',
        limit: limit.toString(),
      }
    );

    result.fetched = data.titles.length;
    console.log(`Found ${data.titles.length} free movies`);

    for (const title of data.titles) {
      try {
        const slug = `watchmode-movie-${title.id}`;

        const [existing] = await db
          .select()
          .from(marketplaceItems)
          .where(eq(marketplaceItems.slug, slug))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        let details: WatchmodeTitleDetails | null = null;
        try {
          details = await fetchFromWatchmode<WatchmodeTitleDetails>(`/title/${title.id}/details/`);
          await new Promise(r => setTimeout(r, 200));
        } catch {
          // Continue without details if rate limited
        }

        const now = new Date();

        const [item] = await db
          .insert(marketplaceItems)
          .values({
            itemType: 'video',
            title: title.title,
            slug,
            description: details?.plot_overview || `Free movie from ${title.year}`,
            thumbnail: details?.poster || null,
            creatorWallet: 'system',
            category: 'movie',
            priceWei: '0',
            currency: 'ETH',
            status: 'published',
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
            tags: details?.genre_names?.slice(0, 5) || ['Free'],
            metadata: {
              watchmodeId: title.id,
              imdbId: title.imdb_id,
              tmdbId: title.tmdb_id,
              externalSource: 'watchmode',
              year: title.year,
              runtime: details?.runtime_minutes,
              rating: details?.us_rating,
              trailer: details?.trailer,
              backdropUrl: details?.backdrop,
              freeStreaming: true,
              mediaType: 'movie',
            },
          })
          .returning();

        if (item && details?.user_rating) {
          await db.insert(ratings).values({
            itemId: item.id,
            source: 'watchmode',
            externalId: title.id.toString(),
            score: details.user_rating.toFixed(1),
            maxScore: '10',
            voteCount: null,
            metadata: {
              criticScore: details.critic_score,
            },
          });
        }

        result.imported++;
      } catch (err: any) {
        result.errors.push(`${title.title}: ${err.message}`);
      }
    }

    console.log(`Watchmode movies sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('Watchmode movies sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncWatchmodeFreeTVShows(options: {
  sourceIds?: number[];
  limit?: number;
} = {}): Promise<SyncResult> {
  const { 
    sourceIds = [FREE_SOURCE_IDS.TUBI, FREE_SOURCE_IDS.PLUTO, FREE_SOURCE_IDS.PLEX],
    limit = 250 
  } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    result.errors.push('WATCHMODE_API_KEY not configured - skipping Watchmode TV sync');
    return result;
  }

  try {
    console.log(`Fetching free TV shows from Watchmode (sources: ${sourceIds.join(',')})...`);

    const data = await fetchFromWatchmode<{ titles: WatchmodeTitle[]; total_results: number }>(
      '/list-titles/',
      {
        source_ids: sourceIds.join(','),
        types: 'tv_series',
        limit: limit.toString(),
      }
    );

    result.fetched = data.titles.length;
    console.log(`Found ${data.titles.length} free TV shows`);

    for (const title of data.titles) {
      try {
        const slug = `watchmode-tv-${title.id}`;

        const [existing] = await db
          .select()
          .from(marketplaceItems)
          .where(eq(marketplaceItems.slug, slug))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        let details: WatchmodeTitleDetails | null = null;
        try {
          details = await fetchFromWatchmode<WatchmodeTitleDetails>(`/title/${title.id}/details/`);
          await new Promise(r => setTimeout(r, 200));
        } catch {
          // Continue without details
        }

        const now = new Date();

        const [item] = await db
          .insert(marketplaceItems)
          .values({
            itemType: 'video',
            title: title.title,
            slug,
            description: details?.plot_overview || `Free TV show from ${title.year}`,
            thumbnail: details?.poster || null,
            creatorWallet: 'system',
            category: 'tv',
            priceWei: '0',
            currency: 'ETH',
            status: 'published',
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
            tags: details?.genre_names?.slice(0, 5) || ['Free'],
            metadata: {
              watchmodeId: title.id,
              imdbId: title.imdb_id,
              tmdbId: title.tmdb_id,
              externalSource: 'watchmode',
              year: title.year,
              endYear: details?.end_year,
              networks: details?.network_names,
              rating: details?.us_rating,
              trailer: details?.trailer,
              backdropUrl: details?.backdrop,
              freeStreaming: true,
              mediaType: 'tv',
            },
          })
          .returning();

        if (item && details?.user_rating) {
          await db.insert(ratings).values({
            itemId: item.id,
            source: 'watchmode',
            externalId: title.id.toString(),
            score: details.user_rating.toFixed(1),
            maxScore: '10',
            voteCount: null,
            metadata: {
              criticScore: details.critic_score,
            },
          });
        }

        result.imported++;
      } catch (err: any) {
        result.errors.push(`${title.title}: ${err.message}`);
      }
    }

    console.log(`Watchmode TV sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('Watchmode TV sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncTubiContent(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const movies = await syncWatchmodeFreeMovies({
    sourceIds: [FREE_SOURCE_IDS.TUBI],
    limit: 200,
  });
  results.push(movies);

  const tv = await syncWatchmodeFreeTVShows({
    sourceIds: [FREE_SOURCE_IDS.TUBI],
    limit: 200,
  });
  results.push(tv);

  return results;
}

export async function syncPlutoContent(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const movies = await syncWatchmodeFreeMovies({
    sourceIds: [FREE_SOURCE_IDS.PLUTO],
    limit: 200,
  });
  results.push(movies);

  const tv = await syncWatchmodeFreeTVShows({
    sourceIds: [FREE_SOURCE_IDS.PLUTO],
    limit: 200,
  });
  results.push(tv);

  return results;
}

export async function syncAllAVOD(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const allFreeSourceIds = Object.values(FREE_SOURCE_IDS);

  const movies = await syncWatchmodeFreeMovies({
    sourceIds: allFreeSourceIds,
    limit: 500,
  });
  results.push(movies);

  const tv = await syncWatchmodeFreeTVShows({
    sourceIds: allFreeSourceIds,
    limit: 500,
  });
  results.push(tv);

  return results;
}

export { FREE_SOURCE_IDS };
