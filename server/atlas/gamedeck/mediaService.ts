/**
 * MediaService - Atlas Media (TV/Video) functionality
 * 
 * Handles video/TV rentals and purchases with:
 * - Rent/Purchase flows with anchored receipts
 * - Library management with playback position tracking
 * - External ratings (TMDB, IMDB, etc.)
 * - Media catalog helpers
 * 
 * Follows patterns from anchorService.ts and purchasesService.ts
 */

import { db } from '../../db';
import {
  marketplaceItems,
  mediaAccess,
  ratings,
  marketplaceReceiptsTable,
  type MarketplaceItem,
  type MediaAccess,
  type Rating,
  type MarketplaceReceiptV2,
} from '@shared/schema';
import { eq, and, or, desc, gt, isNull } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { FEE_WEI } from './anchorService';
import { searchItems, type SearchFilters, type SearchResult } from './catalogService';

/**
 * Rental duration in hours (48 hours)
 */
const RENTAL_DURATION_HOURS = 48;

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `media:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Compute rental expiry date (48 hours from now)
 */
function computeRentalExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + RENTAL_DURATION_HOURS);
  return expiry;
}

// =============================================================================
// RENT/PURCHASE FLOWS
// =============================================================================

/**
 * Rent media for 48 hours
 * 
 * Creates media_access entry with expiry, anchors receipt.
 * 
 * @param wallet - Wallet address
 * @param itemId - Marketplace item ID (video/tv type)
 * @returns Access record and receipt
 */
export async function rentMedia(
  wallet: string,
  itemId: string
): Promise<{
  access: MediaAccess;
  receipt: MarketplaceReceiptV2;
}> {
  const [item] = await db
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.id, itemId))
    .limit(1);

  if (!item) {
    throw new Error(`Media item not found: ${itemId}`);
  }

  if (item.itemType !== 'video') {
    throw new Error(`Item is not a video/tv type: ${itemId} (type: ${item.itemType})`);
  }

  const existing = await checkAccess(wallet, itemId);
  if (existing.hasAccess) {
    throw new Error(`Wallet already has access to media: ${itemId}`);
  }

  const expiresAt = computeRentalExpiry();
  const requestId = generateRequestId();
  const priceWei = item.priceWei || '0';

  const [access] = await db
    .insert(mediaAccess)
    .values({
      wallet,
      itemId,
      accessType: 'rental',
      priceWei,
      expiresAt,
      playbackPosition: 0,
      metadata: {
        title: item.title,
        rentalDurationHours: RENTAL_DURATION_HOURS,
      },
    })
    .returning();

  const [receipt] = await db
    .insert(marketplaceReceiptsTable)
    .values({
      wallet,
      kind: 'purchase.complete',
      refId: access.id,
      refType: 'media_access',
      anchorFeeWei: FEE_WEI,
      metaJson: {
        accessId: access.id,
        itemId,
        title: item.title,
        accessType: 'rental',
        priceWei,
        expiresAt: expiresAt.toISOString(),
        rentalDurationHours: RENTAL_DURATION_HOURS,
      },
      requestId,
    })
    .returning();

  await db
    .update(mediaAccess)
    .set({ receiptId: receipt.id })
    .where(eq(mediaAccess.id, access.id));

  return { access, receipt };
}

/**
 * Purchase media permanently
 * 
 * Creates media_access entry with no expiry.
 * 
 * @param wallet - Wallet address
 * @param itemId - Marketplace item ID (video/tv type)
 * @returns Access record and receipt
 */
export async function purchaseMedia(
  wallet: string,
  itemId: string
): Promise<{
  access: MediaAccess;
  receipt: MarketplaceReceiptV2;
}> {
  const [item] = await db
    .select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.id, itemId))
    .limit(1);

  if (!item) {
    throw new Error(`Media item not found: ${itemId}`);
  }

  if (item.itemType !== 'video') {
    throw new Error(`Item is not a video/tv type: ${itemId} (type: ${item.itemType})`);
  }

  const existing = await checkAccess(wallet, itemId);
  if (existing.hasAccess && existing.accessType === 'purchase') {
    throw new Error(`Wallet already owns media: ${itemId}`);
  }

  const requestId = generateRequestId();
  const priceWei = item.priceWei || '0';

  const [access] = await db
    .insert(mediaAccess)
    .values({
      wallet,
      itemId,
      accessType: 'purchase',
      priceWei,
      expiresAt: null,
      playbackPosition: 0,
      metadata: {
        title: item.title,
        purchaseType: 'permanent',
      },
    })
    .returning();

  const [receipt] = await db
    .insert(marketplaceReceiptsTable)
    .values({
      wallet,
      kind: 'purchase.complete',
      refId: access.id,
      refType: 'media_access',
      anchorFeeWei: FEE_WEI,
      metaJson: {
        accessId: access.id,
        itemId,
        title: item.title,
        accessType: 'purchase',
        priceWei,
        permanent: true,
      },
      requestId,
    })
    .returning();

  await db
    .update(mediaAccess)
    .set({ receiptId: receipt.id })
    .where(eq(mediaAccess.id, access.id));

  return { access, receipt };
}

/**
 * Check if wallet has valid access to media
 * 
 * @param wallet - Wallet address
 * @param itemId - Marketplace item ID
 * @returns Access status and details
 */
export async function checkAccess(
  wallet: string,
  itemId: string
): Promise<{
  hasAccess: boolean;
  accessType?: 'rental' | 'purchase';
  expiresAt?: Date | null;
  access?: MediaAccess;
}> {
  const now = new Date();

  const accessRecords = await db
    .select()
    .from(mediaAccess)
    .where(
      and(
        eq(mediaAccess.wallet, wallet),
        eq(mediaAccess.itemId, itemId)
      )
    )
    .orderBy(desc(mediaAccess.createdAt));

  for (const access of accessRecords) {
    if (access.accessType === 'purchase') {
      return {
        hasAccess: true,
        accessType: 'purchase',
        expiresAt: null,
        access,
      };
    }

    if (access.accessType === 'rental' && access.expiresAt) {
      if (access.expiresAt > now) {
        return {
          hasAccess: true,
          accessType: 'rental',
          expiresAt: access.expiresAt,
          access,
        };
      }
    }
  }

  return { hasAccess: false };
}

// =============================================================================
// LIBRARY MANAGEMENT
// =============================================================================

/**
 * Media library entry with item details
 */
export interface LibraryEntry {
  access: MediaAccess;
  item: MarketplaceItem;
  isExpired: boolean;
  hoursRemaining?: number;
}

/**
 * Get all owned/rented media for a wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of library entries with access status
 */
export async function getLibrary(wallet: string): Promise<LibraryEntry[]> {
  const now = new Date();

  const accessRecords = await db
    .select({
      access: mediaAccess,
      item: marketplaceItems,
    })
    .from(mediaAccess)
    .innerJoin(marketplaceItems, eq(mediaAccess.itemId, marketplaceItems.id))
    .where(eq(mediaAccess.wallet, wallet))
    .orderBy(desc(mediaAccess.updatedAt));

  const processedItems = new Map<string, LibraryEntry>();

  for (const { access, item } of accessRecords) {
    const existingEntry = processedItems.get(item.id);
    
    if (existingEntry && existingEntry.access.accessType === 'purchase') {
      continue;
    }

    let isExpired = false;
    let hoursRemaining: number | undefined;

    if (access.accessType === 'rental' && access.expiresAt) {
      isExpired = access.expiresAt <= now;
      if (!isExpired) {
        hoursRemaining = Math.ceil((access.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
      }
    }

    if (access.accessType === 'purchase' || !existingEntry || !existingEntry.isExpired) {
      processedItems.set(item.id, {
        access,
        item,
        isExpired,
        hoursRemaining,
      });
    }
  }

  return Array.from(processedItems.values()).filter(
    entry => entry.access.accessType === 'purchase' || !entry.isExpired
  );
}

/**
 * Save playback position for "continue watching"
 * 
 * @param wallet - Wallet address
 * @param itemId - Marketplace item ID
 * @param position - Playback position in seconds
 * @returns Updated access record or null
 */
export async function savePlaybackPosition(
  wallet: string,
  itemId: string,
  position: number
): Promise<MediaAccess | null> {
  const accessStatus = await checkAccess(wallet, itemId);
  
  if (!accessStatus.hasAccess || !accessStatus.access) {
    return null;
  }

  const [updated] = await db
    .update(mediaAccess)
    .set({
      playbackPosition: position,
      updatedAt: new Date(),
    })
    .where(eq(mediaAccess.id, accessStatus.access.id))
    .returning();

  return updated || null;
}

/**
 * Get playback position for "continue watching"
 * 
 * @param wallet - Wallet address
 * @param itemId - Marketplace item ID
 * @returns Playback position in seconds or null
 */
export async function getPlaybackPosition(
  wallet: string,
  itemId: string
): Promise<number | null> {
  const accessStatus = await checkAccess(wallet, itemId);
  
  if (!accessStatus.hasAccess || !accessStatus.access) {
    return null;
  }

  return accessStatus.access.playbackPosition || 0;
}

// =============================================================================
// RATINGS
// =============================================================================

/**
 * Get all ratings for a media item
 * 
 * @param itemId - Marketplace item ID
 * @returns Array of ratings from different sources
 */
export async function getRatings(itemId: string): Promise<Rating[]> {
  try {
    return await db
      .select()
      .from(ratings)
      .where(eq(ratings.itemId, itemId))
      .orderBy(desc(ratings.syncedAt));
  } catch (err) {
    console.error('Error getting ratings:', err);
    return [];
  }
}

/**
 * Add or update a rating for a media item
 * 
 * @param itemId - Marketplace item ID
 * @param source - Rating source (e.g., 'tmdb', 'imdb', 'rotten_tomatoes')
 * @param score - Rating score
 * @param consensus - Optional consensus text/summary
 * @param maxScore - Maximum possible score (default: 10)
 * @returns Created/updated rating or null
 */
export async function addRating(
  itemId: string,
  source: string,
  score: number,
  consensus?: string,
  maxScore: number = 10
): Promise<Rating | null> {
  try {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    if (!item) {
      throw new Error(`Media item not found: ${itemId}`);
    }

    const [existing] = await db
      .select()
      .from(ratings)
      .where(
        and(
          eq(ratings.itemId, itemId),
          eq(ratings.source, source)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(ratings)
        .set({
          score: score.toString(),
          maxScore: maxScore.toString(),
          consensus: consensus || existing.consensus,
          syncedAt: new Date(),
        })
        .where(eq(ratings.id, existing.id))
        .returning();

      return updated || null;
    }

    const [rating] = await db
      .insert(ratings)
      .values({
        itemId,
        source,
        score: score.toString(),
        maxScore: maxScore.toString(),
        consensus: consensus || null,
      })
      .returning();

    return rating || null;
  } catch (err) {
    console.error('Error adding rating:', err);
    return null;
  }
}

/**
 * OMDB API response type
 */
interface OMDBResponse {
  Response: string;
  Error?: string;
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Poster?: string;
  Ratings?: Array<{ Source: string; Value: string }>;
  Metascore?: string;
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Type?: string;
  DVD?: string;
  BoxOffice?: string;
  Production?: string;
  Website?: string;
}

/**
 * Sync rating from OMDB (Open Movie Database - free API)
 * 
 * Uses OMDB API for movie/TV ratings (IMDB, Rotten Tomatoes, Metacritic).
 * OMDB provides free tier with 1000 requests/day.
 * 
 * @param itemId - Marketplace item ID
 * @param imdbId - IMDB ID (e.g., "tt1234567")
 * @returns Synced rating or null
 */
export async function syncOMDBRating(
  itemId: string,
  imdbId: string
): Promise<Rating | null> {
  try {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    if (!item) {
      throw new Error(`Media item not found: ${itemId}`);
    }

    const omdbApiKey = process.env.OMDB_API_KEY;
    if (!omdbApiKey) {
      console.log('OMDB_API_KEY not configured, using user reviews for ratings');
      return null;
    }

    const response = await fetch(
      `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${omdbApiKey}`
    );

    if (!response.ok) {
      throw new Error(`OMDB API error: ${response.status}`);
    }

    const data = await response.json() as OMDBResponse;

    if (data.Response === 'False') {
      console.log(`OMDB: Movie not found for ${imdbId}`);
      return null;
    }

    const imdbRating = parseFloat(data.imdbRating || '') || null;
    const imdbVotes = parseInt(data.imdbVotes?.replace(/,/g, '') || '0');

    const [existing] = await db
      .select()
      .from(ratings)
      .where(
        and(
          eq(ratings.itemId, itemId),
          eq(ratings.source, 'imdb')
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(ratings)
        .set({
          externalId: imdbId,
          score: imdbRating?.toString() || null,
          maxScore: '10',
          voteCount: imdbVotes,
          consensus: data.Plot || null,
          syncedAt: new Date(),
          metadata: {
            title: data.Title,
            year: data.Year,
            rated: data.Rated,
            runtime: data.Runtime,
            genre: data.Genre,
            director: data.Director,
            actors: data.Actors,
            rottenTomatoes: data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value,
            metacritic: data.Metascore,
            boxOffice: data.BoxOffice,
            poster: data.Poster,
          },
        })
        .where(eq(ratings.id, existing.id))
        .returning();

      return updated || null;
    }

    const [rating] = await db
      .insert(ratings)
      .values({
        itemId,
        source: 'imdb',
        externalId: imdbId,
        score: imdbRating?.toString() || null,
        maxScore: '10',
        voteCount: imdbVotes,
        consensus: data.Plot || null,
        metadata: {
          title: data.Title,
          year: data.Year,
          rated: data.Rated,
          runtime: data.Runtime,
          genre: data.Genre,
          director: data.Director,
          actors: data.Actors,
          rottenTomatoes: data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value,
          metacritic: data.Metascore,
          boxOffice: data.BoxOffice,
          poster: data.Poster,
        },
      })
      .returning();

    return rating || null;
  } catch (err) {
    console.error('Error syncing OMDB rating:', err);
    return null;
  }
}

/**
 * Search OMDB by title (for importing new media)
 * 
 * @param title - Movie/TV show title to search
 * @param type - 'movie' | 'series' | 'episode'
 * @param year - Optional year filter
 * @returns OMDB search results
 */
export async function searchOMDB(
  title: string,
  type?: 'movie' | 'series' | 'episode',
  year?: string
): Promise<OMDBResponse | null> {
  try {
    const omdbApiKey = process.env.OMDB_API_KEY;
    if (!omdbApiKey) {
      console.log('OMDB_API_KEY not configured');
      return null;
    }

    let url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbApiKey}`;
    if (type) url += `&type=${type}`;
    if (year) url += `&y=${year}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OMDB API error: ${response.status}`);
    }

    const data = await response.json() as OMDBResponse;
    if (data.Response === 'False') {
      return null;
    }

    return data;
  } catch (err) {
    console.error('Error searching OMDB:', err);
    return null;
  }
}

/**
 * Import media from OMDB by title search
 * 
 * Searches OMDB by title, gets IMDB ID, then creates marketplace item with ratings.
 * This is the preferred method when you have a movie/TV title rather than IMDB ID.
 * 
 * @param title - Movie or TV show title
 * @param type - 'movie' | 'series' (optional)
 * @returns Created marketplace item or null
 */
export async function importFromOMDBByTitle(
  title: string,
  type?: 'movie' | 'series'
): Promise<MarketplaceItem | null> {
  try {
    const omdbApiKey = process.env.OMDB_API_KEY;
    if (!omdbApiKey) {
      console.log('OMDB_API_KEY not configured');
      return null;
    }

    // First search by title to get IMDB ID
    let url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=${omdbApiKey}&plot=full`;
    if (type) url += `&type=${type}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OMDB API error: ${response.status}`);
    }

    const data = await response.json() as OMDBResponse;
    if (data.Response === 'False' || !data.imdbID) {
      console.log(`OMDB: No results for title "${title}"`);
      return null;
    }

    // Check if already exists
    const slug = data.imdbID.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const targetSlug = `media-${slug}`;

    const [existingBySlug] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.slug, targetSlug))
      .limit(1);

    if (existingBySlug) {
      return existingBySlug;
    }

    // Parse rating data
    const genres = data.Genre?.split(', ') || [];
    const imdbRating = parseFloat(data.imdbRating || '') || null;
    const imdbVotes = parseInt(data.imdbVotes?.replace(/,/g, '') || '0');
    const now = new Date();

    // Create marketplace item
    const [item] = await db
      .insert(marketplaceItems)
      .values({
        itemType: 'video',
        title: data.Title || 'Untitled',
        slug: targetSlug,
        description: data.Plot || '',
        thumbnail: data.Poster !== 'N/A' ? data.Poster : null,
        creatorWallet: 'system',
        category: data.Type === 'series' ? 'tv' : 'movie',
        priceWei: '0',
        currency: 'ETH',
        status: 'published',
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
        tags: genres,
        metadata: {
          imdbId: data.imdbID,
          externalSource: 'omdb',
          year: data.Year,
          rated: data.Rated,
          runtime: data.Runtime,
          director: data.Director,
          writer: data.Writer,
          actors: data.Actors,
          language: data.Language,
          country: data.Country,
          awards: data.Awards,
          boxOffice: data.BoxOffice,
          mediaType: data.Type,
        },
      })
      .returning();

    if (!item) {
      return null;
    }

    // Add rating if available
    if (imdbRating) {
      const ratingMetadata = {
        rottenTomatoes: data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value || null,
        metacritic: data.Metascore || null,
      };

      await db.insert(ratings).values({
        itemId: item.id,
        source: 'imdb',
        externalId: data.imdbID,
        score: imdbRating.toString(),
        maxScore: '10',
        voteCount: imdbVotes,
        consensus: data.Plot || null,
        metadata: ratingMetadata,
      });
    }

    return item;
  } catch (err: any) {
    console.error('Media import by title error:', err.message);
    throw err;
  }
}

/**
 * Import media from OMDB and create marketplace item
 * 
 * Fetches movie/TV data from OMDB and creates a marketplace item with ratings.
 * Caches all data locally to minimize API calls.
 * 
 * @param imdbId - IMDB ID (e.g., "tt0111161")
 * @param priceWei - Price in wei for purchase
 * @param rentalPriceWei - Price in wei for rental
 * @returns Created marketplace item or null
 */
export async function importFromOMDB(
  imdbId: string,
  priceWei: string = '0',
  rentalPriceWei?: string
): Promise<MarketplaceItem | null> {
  try {
    const omdbApiKey = process.env.OMDB_API_KEY;
    if (!omdbApiKey) {
      return null;
    }

    const slug = imdbId.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const targetSlug = `media-${slug}`;

    const [existingBySlug] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.slug, targetSlug))
      .limit(1);

    if (existingBySlug) {
      return existingBySlug;
    }

    const [existingRating] = await db
      .select()
      .from(ratings)
      .where(eq(ratings.externalId, imdbId))
      .limit(1);

    if (existingRating?.itemId) {
      const [existingItem] = await db
        .select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.id, existingRating.itemId))
        .limit(1);
      if (existingItem) {
        return existingItem;
      }
    }

    const response = await fetch(
      `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${omdbApiKey}&plot=full`
    );

    if (!response.ok) {
      throw new Error(`External API error: ${response.status}`);
    }

    const data = await response.json() as OMDBResponse;
    if (data.Response === 'False') {
      return null;
    }

    const genres = data.Genre?.split(', ') || [];
    const imdbRating = parseFloat(data.imdbRating || '') || null;
    const imdbVotes = parseInt(data.imdbVotes?.replace(/,/g, '') || '0');
    const now = new Date();

    const [item] = await db
      .insert(marketplaceItems)
      .values({
        itemType: 'video',
        title: data.Title || 'Untitled',
        slug: targetSlug,
        description: data.Plot || '',
        thumbnail: data.Poster !== 'N/A' ? data.Poster : null,
        creatorWallet: 'system',
        category: data.Type === 'series' ? 'tv' : 'movie',
        priceWei,
        currency: 'ETH',
        status: 'published',
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
        tags: genres,
        metadata: {
          imdbId,
          externalSource: 'omdb',
          year: data.Year,
          rated: data.Rated,
          runtime: data.Runtime,
          director: data.Director,
          writer: data.Writer,
          actors: data.Actors,
          language: data.Language,
          country: data.Country,
          awards: data.Awards,
          boxOffice: data.BoxOffice,
          rentalPriceWei,
          mediaType: data.Type,
        },
      })
      .returning();

    if (!item) {
      return null;
    }

    if (imdbRating) {
      await db.insert(ratings).values({
        itemId: item.id,
        source: 'imdb',
        externalId: imdbId,
        score: imdbRating.toString(),
        maxScore: '10',
        voteCount: imdbVotes,
        consensus: data.Plot || null,
        metadata: {
          rottenTomatoes: data.Ratings?.find((r) => r.Source === 'Rotten Tomatoes')?.Value,
          metacritic: data.Metascore,
        },
      });
    }

    return item;
  } catch (err: any) {
    console.error('Media import error:', err.message);
    throw err;
  }
}

/**
 * Batch import popular movies from OMDB
 * 
 * Imports a list of popular movies by IMDB ID.
 * Uses delay between requests to respect rate limits.
 * 
 * @param imdbIds - Array of IMDB IDs to import
 * @param delayMs - Delay between API calls (default 500ms)
 * @returns Import results
 */
export async function batchImportFromOMDB(
  imdbIds: string[],
  delayMs: number = 500
): Promise<{ imported: number; skipped: number; failed: number }> {
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const imdbId of imdbIds) {
    try {
      const existingRating = await db
        .select()
        .from(ratings)
        .where(eq(ratings.externalId, imdbId))
        .limit(1);

      if (existingRating.length > 0) {
        skipped++;
        continue;
      }

      const result = await importFromOMDB(imdbId);
      if (result) {
        imported++;
      } else {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (err) {
      console.error(`Failed to import ${imdbId}:`, err);
      failed++;
    }
  }

  console.log(`Batch import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);
  return { imported, skipped, failed };
}

// =============================================================================
// MEDIA CATALOG HELPERS
// =============================================================================

/**
 * Search video/TV items with filters
 * 
 * Wraps catalogService.searchItems with video type filter.
 * 
 * @param filters - Optional search filters
 * @returns Search results
 */
export async function getVideoItems(filters?: Omit<SearchFilters, 'type'>): Promise<SearchResult> {
  return searchItems({
    ...filters,
    type: 'video',
    status: filters?.status || 'published',
  });
}

/**
 * Get featured video/TV media
 * 
 * @param limit - Maximum number of items to return
 * @returns Featured media items
 */
export async function getFeaturedMedia(limit: number = 20): Promise<MarketplaceItem[]> {
  try {
    const items = await db
      .select()
      .from(marketplaceItems)
      .where(
        and(
          eq(marketplaceItems.itemType, 'video'),
          eq(marketplaceItems.featured, true),
          eq(marketplaceItems.status, 'published')
        )
      )
      .limit(limit)
      .orderBy(desc(marketplaceItems.updatedAt));

    return items;
  } catch (err) {
    console.error('Error getting featured media:', err);
    return [];
  }
}

/**
 * Get "continue watching" list for a wallet
 * 
 * Returns items with saved playback position > 0.
 * 
 * @param wallet - Wallet address
 * @param limit - Maximum number of items
 * @returns Items with playback progress
 */
export async function getContinueWatching(
  wallet: string,
  limit: number = 10
): Promise<LibraryEntry[]> {
  const library = await getLibrary(wallet);
  
  return library
    .filter(entry => (entry.access.playbackPosition || 0) > 0)
    .sort((a, b) => {
      const aTime = a.access.updatedAt?.getTime() || 0;
      const bTime = b.access.updatedAt?.getTime() || 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

/**
 * Get recently added video/TV items
 * 
 * @param limit - Maximum number of items
 * @returns Recently added media items
 */
export async function getRecentlyAdded(limit: number = 20): Promise<MarketplaceItem[]> {
  try {
    const items = await db
      .select()
      .from(marketplaceItems)
      .where(
        and(
          eq(marketplaceItems.itemType, 'video'),
          eq(marketplaceItems.status, 'published')
        )
      )
      .limit(limit)
      .orderBy(desc(marketplaceItems.publishedAt));

    return items;
  } catch (err) {
    console.error('Error getting recently added media:', err);
    return [];
  }
}

/**
 * Get popular video/TV items by purchase count
 * 
 * @param limit - Maximum number of items
 * @returns Popular media items
 */
export async function getPopularMedia(limit: number = 20): Promise<MarketplaceItem[]> {
  try {
    const items = await db
      .select()
      .from(marketplaceItems)
      .where(
        and(
          eq(marketplaceItems.itemType, 'video'),
          eq(marketplaceItems.status, 'published')
        )
      )
      .limit(limit)
      .orderBy(desc(marketplaceItems.purchases));

    return items;
  } catch (err) {
    console.error('Error getting popular media:', err);
    return [];
  }
}
