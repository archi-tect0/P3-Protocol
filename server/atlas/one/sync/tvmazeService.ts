/**
 * TVMaze Service - TV Show Metadata
 * 
 * Syncs TV show metadata from TVMaze's free API.
 * No API key required - rate limited to 20 requests/10 seconds.
 * 
 * API: https://api.tvmaze.com
 * Docs: https://www.tvmaze.com/api
 */

import { db } from '../../../db';
import { marketplaceItems, ratings } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface TVMazeShow {
  id: number;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  runtime: number | null;
  averageRuntime: number | null;
  premiered: string | null;
  ended: string | null;
  officialSite: string | null;
  schedule: {
    time: string;
    days: string[];
  };
  rating: {
    average: number | null;
  };
  weight: number;
  network: {
    id: number;
    name: string;
    country: {
      name: string;
      code: string;
    };
  } | null;
  webChannel: {
    id: number;
    name: string;
  } | null;
  image: {
    medium: string;
    original: string;
  } | null;
  summary: string | null;
}

interface SyncResult {
  fetched: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const TVMAZE_API_BASE = 'https://api.tvmaze.com';

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

async function fetchShowsPage(page: number): Promise<TVMazeShow[]> {
  const response = await fetch(`${TVMAZE_API_BASE}/shows?page=${page}`);
  if (response.status === 404) {
    return []; // No more pages
  }
  if (!response.ok) {
    throw new Error(`TVMaze API error: ${response.status}`);
  }
  return response.json();
}

async function fetchSchedule(country: string = 'US', date?: string): Promise<any[]> {
  const dateStr = date || new Date().toISOString().split('T')[0];
  const response = await fetch(`${TVMAZE_API_BASE}/schedule?country=${country}&date=${dateStr}`);
  if (!response.ok) {
    throw new Error(`TVMaze schedule error: ${response.status}`);
  }
  return response.json();
}

export async function syncTVMazeShows(options: {
  pages?: number;
  minRating?: number;
} = {}): Promise<SyncResult> {
  const { pages = 10, minRating = 6 } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log(`Fetching TV shows from TVMaze (${pages} pages)...`);

    for (let page = 0; page < pages; page++) {
      try {
        const shows = await fetchShowsPage(page);
        if (shows.length === 0) break;

        result.fetched += shows.length;

        for (const show of shows) {
          if (show.rating?.average && show.rating.average < minRating) continue;
          if (!show.name) continue;

          try {
            const slug = `tvmaze-${show.id}-${show.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;

            const [existing] = await db
              .select()
              .from(marketplaceItems)
              .where(eq(marketplaceItems.slug, slug))
              .limit(1);

            if (existing) {
              result.skipped++;
              continue;
            }

            const tags: string[] = ['tv-show'];
            if (show.genres) {
              tags.push(...show.genres.slice(0, 3).map(g => g.toLowerCase()));
            }
            if (show.status === 'Running') {
              tags.push('ongoing');
            }

            const network = show.network?.name || show.webChannel?.name || null;
            const now = new Date();

            const [dbItem] = await db
              .insert(marketplaceItems)
              .values({
                itemType: 'video',
                title: show.name,
                slug,
                description: stripHtml(show.summary) || `${show.type} series`,
                thumbnail: show.image?.medium || show.image?.original || null,
                creatorWallet: 'system',
                category: 'tv',
                priceWei: '0',
                currency: 'ETH',
                status: 'published',
                publishedAt: now,
                createdAt: now,
                updatedAt: now,
                tags: tags.slice(0, 5),
                metadata: {
                  tvmazeId: show.id,
                  externalSource: 'tvmaze',
                  showType: show.type,
                  language: show.language,
                  premiered: show.premiered,
                  ended: show.ended,
                  showStatus: show.status,
                  network,
                  officialSite: show.officialSite,
                  schedule: show.schedule,
                  runtime: show.runtime || show.averageRuntime,
                  mediaType: 'tv',
                },
              })
              .returning();

            if (dbItem && show.rating?.average) {
              await db.insert(ratings).values({
                itemId: dbItem.id,
                source: 'tvmaze',
                externalId: show.id.toString(),
                score: show.rating.average.toFixed(1),
                maxScore: '10',
                voteCount: null,
                metadata: {
                  weight: show.weight,
                },
              });
            }

            result.imported++;
          } catch (err: any) {
            result.errors.push(`${show.name}: ${err.message}`);
          }
        }

        // Rate limit: 20 requests per 10 seconds
        await new Promise(r => setTimeout(r, 500));
      } catch (err: any) {
        result.errors.push(`Page ${page}: ${err.message}`);
      }
    }

    console.log(`TVMaze sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('TVMaze sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncPopularTVShows(): Promise<SyncResult> {
  return syncTVMazeShows({ pages: 20, minRating: 7 });
}

export async function syncAllTVShows(): Promise<SyncResult> {
  return syncTVMazeShows({ pages: 50, minRating: 5 });
}
