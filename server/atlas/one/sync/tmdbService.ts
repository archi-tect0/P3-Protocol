/**
 * TMDb Service - The Movie Database Integration
 * 
 * Syncs movies and TV shows from TMDb's extensive catalog.
 * Provides access to tens of thousands of titles with metadata, posters, ratings.
 * 
 * API: https://api.themoviedb.org/3
 * Docs: https://developer.themoviedb.org
 */

import { db } from '../../../db';
import { marketplaceItems, ratings } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  genre_ids: number[];
}

interface TMDbTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
}

interface TMDbResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface SyncResult {
  fetched: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

function getApiKey(): string | null {
  return process.env.TMDB_API_KEY || null;
}

function getPosterUrl(path: string | null, size: string = 'w500'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

function getBackdropUrl(path: string | null, size: string = 'w1280'): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

function mapGenres(genreIds: number[]): string[] {
  return genreIds.map(id => GENRE_MAP[id] || 'Other').filter(Boolean);
}

async function fetchFromTMDb<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const url = new URL(`${TMDB_API_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.status}`);
  }

  return response.json();
}

export async function syncTMDbMovies(options: {
  pages?: number;
  category?: 'popular' | 'top_rated' | 'now_playing' | 'upcoming';
} = {}): Promise<SyncResult> {
  const { pages = 5, category = 'popular' } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    result.errors.push('TMDB_API_KEY not configured - skipping TMDb sync');
    return result;
  }

  try {
    console.log(`Fetching TMDb ${category} movies (${pages} pages)...`);

    for (let page = 1; page <= pages; page++) {
      try {
        const data = await fetchFromTMDb<TMDbResponse<TMDbMovie>>(`/movie/${category}`, {
          page: page.toString(),
          language: 'en-US',
        });

        result.fetched += data.results.length;

        for (const movie of data.results) {
          if (movie.adult) continue;

          try {
            const slug = `tmdb-movie-${movie.id}`;

            const [existing] = await db
              .select()
              .from(marketplaceItems)
              .where(eq(marketplaceItems.slug, slug))
              .limit(1);

            if (existing) {
              result.skipped++;
              continue;
            }

            const genres = mapGenres(movie.genre_ids);
            const now = new Date();

            const [item] = await db
              .insert(marketplaceItems)
              .values({
                itemType: 'video',
                title: movie.title,
                slug,
                description: movie.overview || '',
                thumbnail: getPosterUrl(movie.poster_path),
                creatorWallet: 'system',
                category: 'movie',
                priceWei: '0',
                currency: 'ETH',
                status: 'published',
                publishedAt: now,
                createdAt: now,
                updatedAt: now,
                tags: genres.slice(0, 5),
                metadata: {
                  tmdbId: movie.id,
                  externalSource: 'tmdb',
                  originalTitle: movie.original_title,
                  releaseDate: movie.release_date,
                  popularity: movie.popularity,
                  backdropUrl: getBackdropUrl(movie.backdrop_path),
                  mediaType: 'movie',
                },
              })
              .returning();

            if (item && movie.vote_average > 0) {
              await db.insert(ratings).values({
                itemId: item.id,
                source: 'tmdb',
                externalId: movie.id.toString(),
                score: movie.vote_average.toFixed(1),
                maxScore: '10',
                voteCount: movie.vote_count,
                metadata: {
                  popularity: movie.popularity,
                },
              });
            }

            result.imported++;
          } catch (err: any) {
            result.errors.push(`${movie.title}: ${err.message}`);
          }
        }

        await new Promise(r => setTimeout(r, 250));
      } catch (err: any) {
        result.errors.push(`Page ${page}: ${err.message}`);
      }
    }

    console.log(`TMDb movies sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('TMDb movies sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncTMDbTVShows(options: {
  pages?: number;
  category?: 'popular' | 'top_rated' | 'on_the_air' | 'airing_today';
} = {}): Promise<SyncResult> {
  const { pages = 5, category = 'popular' } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    result.errors.push('TMDB_API_KEY not configured - skipping TMDb TV sync');
    return result;
  }

  try {
    console.log(`Fetching TMDb ${category} TV shows (${pages} pages)...`);

    for (let page = 1; page <= pages; page++) {
      try {
        const data = await fetchFromTMDb<TMDbResponse<TMDbTVShow>>(`/tv/${category}`, {
          page: page.toString(),
          language: 'en-US',
        });

        result.fetched += data.results.length;

        for (const show of data.results) {
          try {
            const slug = `tmdb-tv-${show.id}`;

            const [existing] = await db
              .select()
              .from(marketplaceItems)
              .where(eq(marketplaceItems.slug, slug))
              .limit(1);

            if (existing) {
              result.skipped++;
              continue;
            }

            const genres = mapGenres(show.genre_ids);
            const now = new Date();

            const [item] = await db
              .insert(marketplaceItems)
              .values({
                itemType: 'video',
                title: show.name,
                slug,
                description: show.overview || '',
                thumbnail: getPosterUrl(show.poster_path),
                creatorWallet: 'system',
                category: 'tv',
                priceWei: '0',
                currency: 'ETH',
                status: 'published',
                publishedAt: now,
                createdAt: now,
                updatedAt: now,
                tags: genres.slice(0, 5),
                metadata: {
                  tmdbId: show.id,
                  externalSource: 'tmdb',
                  originalTitle: show.original_name,
                  firstAirDate: show.first_air_date,
                  popularity: show.popularity,
                  backdropUrl: getBackdropUrl(show.backdrop_path),
                  mediaType: 'tv',
                },
              })
              .returning();

            if (item && show.vote_average > 0) {
              await db.insert(ratings).values({
                itemId: item.id,
                source: 'tmdb',
                externalId: show.id.toString(),
                score: show.vote_average.toFixed(1),
                maxScore: '10',
                voteCount: show.vote_count,
                metadata: {
                  popularity: show.popularity,
                },
              });
            }

            result.imported++;
          } catch (err: any) {
            result.errors.push(`${show.name}: ${err.message}`);
          }
        }

        await new Promise(r => setTimeout(r, 250));
      } catch (err: any) {
        result.errors.push(`Page ${page}: ${err.message}`);
      }
    }

    console.log(`TMDb TV sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('TMDb TV sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncTMDbDiscover(options: {
  type?: 'movie' | 'tv';
  pages?: number;
  genres?: number[];
  minRating?: number;
  year?: number;
} = {}): Promise<SyncResult> {
  const { type = 'movie', pages = 3, genres, minRating = 6, year } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  const apiKey = getApiKey();
  if (!apiKey) {
    result.errors.push('TMDB_API_KEY not configured');
    return result;
  }

  try {
    console.log(`Discovering TMDb ${type}s...`);

    for (let page = 1; page <= pages; page++) {
      const params: Record<string, string> = {
        page: page.toString(),
        language: 'en-US',
        sort_by: 'popularity.desc',
        'vote_average.gte': minRating.toString(),
        'vote_count.gte': '100',
      };

      if (genres && genres.length > 0) {
        params.with_genres = genres.join(',');
      }

      if (year) {
        if (type === 'movie') {
          params.primary_release_year = year.toString();
        } else {
          params.first_air_date_year = year.toString();
        }
      }

      const data = await fetchFromTMDb<TMDbResponse<TMDbMovie | TMDbTVShow>>(
        `/discover/${type}`,
        params
      );

      result.fetched += data.results.length;

      for (const item of data.results) {
        try {
          const isMovie = 'title' in item;
          const title = isMovie ? (item as TMDbMovie).title : (item as TMDbTVShow).name;
          const slug = `tmdb-${type}-${item.id}`;

          const [existing] = await db
            .select()
            .from(marketplaceItems)
            .where(eq(marketplaceItems.slug, slug))
            .limit(1);

          if (existing) {
            result.skipped++;
            continue;
          }

          const genres = mapGenres(item.genre_ids);
          const now = new Date();

          const [dbItem] = await db
            .insert(marketplaceItems)
            .values({
              itemType: 'video',
              title,
              slug,
              description: item.overview || '',
              thumbnail: getPosterUrl(item.poster_path),
              creatorWallet: 'system',
              category: type === 'movie' ? 'movie' : 'tv',
              priceWei: '0',
              currency: 'ETH',
              status: 'published',
              publishedAt: now,
              createdAt: now,
              updatedAt: now,
              tags: genres.slice(0, 5),
              metadata: {
                tmdbId: item.id,
                externalSource: 'tmdb',
                popularity: item.popularity,
                backdropUrl: getBackdropUrl(item.backdrop_path),
                mediaType: type,
              },
            })
            .returning();

          if (dbItem && item.vote_average > 0) {
            await db.insert(ratings).values({
              itemId: dbItem.id,
              source: 'tmdb',
              externalId: item.id.toString(),
              score: item.vote_average.toFixed(1),
              maxScore: '10',
              voteCount: item.vote_count,
              metadata: {},
            });
          }

          result.imported++;
        } catch (err: any) {
          result.errors.push(`Item ${item.id}: ${err.message}`);
        }
      }

      await new Promise(r => setTimeout(r, 250));
    }

    console.log(`TMDb discover sync complete: ${result.imported} imported`);
    return result;

  } catch (err: any) {
    console.error('TMDb discover error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncAllTMDb(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const popularMovies = await syncTMDbMovies({ pages: 10, category: 'popular' });
  results.push(popularMovies);

  const topRatedMovies = await syncTMDbMovies({ pages: 5, category: 'top_rated' });
  results.push(topRatedMovies);

  const popularTV = await syncTMDbTVShows({ pages: 10, category: 'popular' });
  results.push(popularTV);

  const topRatedTV = await syncTMDbTVShows({ pages: 5, category: 'top_rated' });
  results.push(topRatedTV);

  return results;
}
