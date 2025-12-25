/**
 * Internet Archive Service - Public Domain Films
 * 
 * Syncs free public domain movies and documentaries from Internet Archive.
 * No API key required - fully free and open.
 * 
 * API: https://archive.org/advancedsearch.php
 * Docs: https://archive.org/developers/
 */

import { db } from '../../../db';
import { marketplaceItems, ratings } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface ArchiveItem {
  identifier: string;
  title: string;
  description: string;
  mediatype: string;
  creator?: string;
  date?: string;
  year?: string;
  publicdate?: string;
  downloads?: number;
  avg_rating?: number;
  num_reviews?: number;
  collection?: string[];
  subject?: string[];
}

interface ArchiveResponse {
  response: {
    numFound: number;
    start: number;
    docs: ArchiveItem[];
  };
}

interface SyncResult {
  fetched: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const ARCHIVE_API_BASE = 'https://archive.org/advancedsearch.php';

const MOVIE_COLLECTIONS = [
  'feature_films',
  'classic_movies',
  'film_noir',
  'scifi',
  'horror_movies',
  'comedy_films',
  'silent_films',
  'classic_tv',
  'documentary_films',
];

function getStreamUrl(identifier: string): string {
  return `https://archive.org/embed/${identifier}`;
}

function getThumbnail(identifier: string): string {
  return `https://archive.org/services/img/${identifier}`;
}

function getDetailsUrl(identifier: string): string {
  return `https://archive.org/details/${identifier}`;
}

async function fetchArchiveItems(options: {
  collection?: string;
  query?: string;
  rows?: number;
  page?: number;
}): Promise<ArchiveResponse> {
  const { collection, query, rows = 100, page = 1 } = options;

  const params = new URLSearchParams({
    q: query || `collection:(${collection || 'feature_films'}) AND mediatype:movies`,
    fl: 'identifier,title,description,mediatype,creator,date,year,publicdate,downloads,avg_rating,num_reviews,collection,subject',
    sort: 'downloads desc',
    output: 'json',
    rows: rows.toString(),
    page: page.toString(),
  });

  const response = await fetch(`${ARCHIVE_API_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Archive API error: ${response.status}`);
  }

  return response.json();
}

export async function syncInternetArchiveFilms(options: {
  collections?: string[];
  limit?: number;
} = {}): Promise<SyncResult> {
  const { collections = MOVIE_COLLECTIONS, limit = 500 } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log(`Fetching films from Internet Archive (${collections.length} collections)...`);

    const itemsPerCollection = Math.ceil(limit / collections.length);

    for (const collection of collections) {
      try {
        const data = await fetchArchiveItems({
          collection,
          rows: itemsPerCollection,
          page: 1,
        });

        result.fetched += data.response.docs.length;

        for (const item of data.response.docs) {
          if (!item.identifier || !item.title) continue;

          try {
            const slug = `archive-${item.identifier.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;

            const [existing] = await db
              .select()
              .from(marketplaceItems)
              .where(eq(marketplaceItems.slug, slug))
              .limit(1);

            if (existing) {
              result.skipped++;
              continue;
            }

            const tags: string[] = ['public-domain', 'free'];
            if (item.subject) {
              const subjects = Array.isArray(item.subject) ? item.subject : [item.subject];
              tags.push(...subjects.slice(0, 3).map(s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')));
            }

            const year = item.year || item.date?.split('-')[0] || null;
            const now = new Date();

            const [dbItem] = await db
              .insert(marketplaceItems)
              .values({
                itemType: 'video',
                title: item.title,
                slug,
                description: item.description || `Public domain film from Internet Archive`,
                thumbnail: getThumbnail(item.identifier),
                creatorWallet: 'system',
                category: 'movie',
                priceWei: '0',
                currency: 'ETH',
                status: 'published',
                publishedAt: now,
                createdAt: now,
                updatedAt: now,
                tags: tags.slice(0, 5),
                metadata: {
                  archiveId: item.identifier,
                  externalSource: 'internet-archive',
                  streamUrl: getStreamUrl(item.identifier),
                  detailsUrl: getDetailsUrl(item.identifier),
                  creator: item.creator,
                  year,
                  collection: Array.isArray(item.collection) ? item.collection[0] : item.collection,
                  downloads: item.downloads,
                  publicDomain: true,
                  mediaType: 'movie',
                },
              })
              .returning();

            if (dbItem && item.avg_rating) {
              await db.insert(ratings).values({
                itemId: dbItem.id,
                source: 'internet-archive',
                externalId: item.identifier,
                score: item.avg_rating.toFixed(1),
                maxScore: '5',
                voteCount: item.num_reviews || null,
                metadata: {
                  downloads: item.downloads,
                },
              });
            }

            result.imported++;
          } catch (err: any) {
            result.errors.push(`${item.title}: ${err.message}`);
          }
        }

        await new Promise(r => setTimeout(r, 200));
      } catch (err: any) {
        result.errors.push(`Collection ${collection}: ${err.message}`);
      }
    }

    console.log(`Internet Archive sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('Internet Archive sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

export async function syncPublicDomainDocumentaries(): Promise<SyncResult> {
  return syncInternetArchiveFilms({
    collections: ['documentary_films', 'opensource_movies'],
    limit: 200,
  });
}

export async function syncClassicMovies(): Promise<SyncResult> {
  return syncInternetArchiveFilms({
    collections: ['feature_films', 'classic_movies', 'film_noir'],
    limit: 300,
  });
}
