/**
 * Atlas One Unified Content Sync
 * 
 * Syncs content from all public APIs into the Atlas One catalog:
 * - Games: FreeToGame, GamerPower
 * - Videos: IPTV channels, OMDB movies
 * - Ebooks: Gutendex, Google Books, Open Library
 * - Products: Free public catalogs
 */

import { db } from '../../../db';
import { marketplaceItems, games } from '@shared/schema';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { pullFreeToGame, pullGamerPower } from '../../gamedeck/gamesService';
import { importFromGoogleBooks, importFromOpenLibrary, importFromGutendex } from '../../gamedeck/ebookService';
import { searchOMDB, importFromOMDB, importFromOMDBByTitle, batchImportFromOMDB } from '../../gamedeck/mediaService';
import { 
  syncIPTVChannels, 
  syncPopularChannels, 
  syncNewsChannels, 
  syncSportsChannels, 
  syncKidsChannels 
} from './iptvService';
import { syncTMDbMovies, syncTMDbTVShows } from './tmdbService';
import { syncWatchmodeFreeMovies, syncWatchmodeFreeTVShows } from './watchmodeService';
import { syncInternetArchiveFilms } from './internetArchiveService';
import { syncTVMazeShows } from './tvmazeService';

interface SyncResult {
  source: string;
  kind: string;
  fetched: number;
  imported: number;
  errors: string[];
  duration: number;
}

interface FullSyncResult {
  startedAt: Date;
  completedAt: Date;
  totalDuration: number;
  results: SyncResult[];
  summary: {
    games: number;
    videos: number;
    ebooks: number;
    products: number;
    total: number;
  };
}

/**
 * Sync all games from FreeToGame and GamerPower
 */
export async function syncGames(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const f2gStart = Date.now();
  try {
    const f2gResult = await pullFreeToGame();
    results.push({
      source: 'freetogame',
      kind: 'game',
      fetched: f2gResult.fetched,
      imported: f2gResult.upserted,
      errors: f2gResult.errors,
      duration: Date.now() - f2gStart,
    });
  } catch (err: any) {
    results.push({
      source: 'freetogame',
      kind: 'game',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - f2gStart,
    });
  }

  const gpStart = Date.now();
  try {
    const gpResult = await pullGamerPower();
    results.push({
      source: 'gamerpower',
      kind: 'game',
      fetched: gpResult.fetched,
      imported: gpResult.upserted,
      errors: gpResult.errors,
      duration: Date.now() - gpStart,
    });
  } catch (err: any) {
    results.push({
      source: 'gamerpower',
      kind: 'game',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - gpStart,
    });
  }

  return results;
}

/**
 * Sync popular movies from OMDB
 */
export async function syncVideos(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const popularMovies = [
    'The Matrix', 'Inception', 'The Dark Knight', 'Pulp Fiction', 'Fight Club',
    'The Godfather', 'Forrest Gump', 'The Shawshank Redemption', 'Interstellar', 
    'The Avengers', 'Avatar', 'Titanic', 'Jurassic Park', 'Star Wars', 'The Lion King',
    'Toy Story', 'Finding Nemo', 'The Incredibles', 'Spider-Man', 'Batman',
    'Iron Man', 'Captain America', 'Thor', 'Black Panther', 'Guardians of the Galaxy',
    'Lord of the Rings', 'Harry Potter', 'Pirates of the Caribbean', 'Transformers',
    'Fast and Furious', 'Mission Impossible', 'James Bond', 'John Wick', 'Mad Max',
    'Gladiator', 'Braveheart', 'Saving Private Ryan', 'Schindler\'s List', 'The Green Mile',
    'Goodfellas', 'Casino', 'Scarface', 'Heat', 'The Departed', 'No Country for Old Men',
    'There Will Be Blood', 'Django Unchained', 'Inglourious Basterds', 'Kill Bill',
  ];

  const popularSeries = [
    'Breaking Bad', 'Game of Thrones', 'The Wire', 'The Sopranos', 'Friends',
    'The Office', 'Stranger Things', 'The Crown', 'Peaky Blinders', 'Sherlock',
    'Black Mirror', 'Westworld', 'The Mandalorian', 'The Boys', 'Ozark',
    'Better Call Saul', 'Fargo', 'True Detective', 'Mindhunter', 'Dark',
  ];

  const omdbStart = Date.now();
  let importedCount = 0;
  const errors: string[] = [];

  // Import movies
  for (const title of popularMovies) {
    try {
      const result = await importFromOMDBByTitle(title, 'movie');
      if (result) {
        importedCount++;
      }
      await new Promise(r => setTimeout(r, 150));
    } catch (err: any) {
      errors.push(`${title}: ${err.message}`);
    }
  }

  // Import TV series
  for (const title of popularSeries) {
    try {
      const result = await importFromOMDBByTitle(title, 'series');
      if (result) {
        importedCount++;
      }
      await new Promise(r => setTimeout(r, 150));
    } catch (err: any) {
      errors.push(`${title}: ${err.message}`);
    }
  }

  results.push({
    source: 'omdb',
    kind: 'video',
    fetched: popularMovies.length + popularSeries.length,
    imported: importedCount,
    errors: errors.slice(0, 10),
    duration: Date.now() - omdbStart,
  });

  // Sync from TMDb (if API key configured)
  const tmdbStart = Date.now();
  try {
    const tmdbMovies = await syncTMDbMovies({ pages: 5, category: 'popular' });
    results.push({
      source: 'tmdb-movies',
      kind: 'video',
      fetched: tmdbMovies.fetched,
      imported: tmdbMovies.imported,
      errors: tmdbMovies.errors.slice(0, 5),
      duration: Date.now() - tmdbStart,
    });
  } catch (err: any) {
    results.push({
      source: 'tmdb-movies',
      kind: 'video',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - tmdbStart,
    });
  }

  const tmdbTVStart = Date.now();
  try {
    const tmdbTV = await syncTMDbTVShows({ pages: 3, category: 'popular' });
    results.push({
      source: 'tmdb-tv',
      kind: 'video',
      fetched: tmdbTV.fetched,
      imported: tmdbTV.imported,
      errors: tmdbTV.errors.slice(0, 5),
      duration: Date.now() - tmdbTVStart,
    });
  } catch (err: any) {
    results.push({
      source: 'tmdb-tv',
      kind: 'video',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - tmdbTVStart,
    });
  }

  // Sync from Watchmode AVOD (if API key configured)
  const watchmodeStart = Date.now();
  try {
    const watchmodeMovies = await syncWatchmodeFreeMovies({ limit: 100 });
    results.push({
      source: 'watchmode-avod',
      kind: 'video',
      fetched: watchmodeMovies.fetched,
      imported: watchmodeMovies.imported,
      errors: watchmodeMovies.errors.slice(0, 5),
      duration: Date.now() - watchmodeStart,
    });
  } catch (err: any) {
    results.push({
      source: 'watchmode-avod',
      kind: 'video',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - watchmodeStart,
    });
  }

  const watchmodeTVStart = Date.now();
  try {
    const watchmodeTV = await syncWatchmodeFreeTVShows({ limit: 100 });
    results.push({
      source: 'watchmode-tv',
      kind: 'video',
      fetched: watchmodeTV.fetched,
      imported: watchmodeTV.imported,
      errors: watchmodeTV.errors.slice(0, 5),
      duration: Date.now() - watchmodeTVStart,
    });
  } catch (err: any) {
    results.push({
      source: 'watchmode-tv',
      kind: 'video',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - watchmodeTVStart,
    });
  }

  // Sync from Internet Archive (no API key required - public domain)
  const archiveStart = Date.now();
  try {
    const archiveResult = await syncInternetArchiveFilms({ limit: 500 });
    results.push({
      source: 'internet-archive',
      kind: 'video',
      fetched: archiveResult.fetched,
      imported: archiveResult.imported,
      errors: archiveResult.errors.slice(0, 5),
      duration: Date.now() - archiveStart,
    });
  } catch (err: any) {
    results.push({
      source: 'internet-archive',
      kind: 'video',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - archiveStart,
    });
  }

  // Sync from TVMaze (no API key required)
  const tvmazeStart = Date.now();
  try {
    const tvmazeResult = await syncTVMazeShows({ pages: 20, minRating: 6 });
    results.push({
      source: 'tvmaze',
      kind: 'video',
      fetched: tvmazeResult.fetched,
      imported: tvmazeResult.imported,
      errors: tvmazeResult.errors.slice(0, 5),
      duration: Date.now() - tvmazeStart,
    });
  } catch (err: any) {
    results.push({
      source: 'tvmaze',
      kind: 'video',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - tvmazeStart,
    });
  }

  return results;
}

/**
 * Sync free live TV channels from IPTV-org
 * 
 * Imports channels from US, UK, CA, AU with working streams.
 * Categories: news, sports, entertainment, kids, movies, etc.
 */
export async function syncLiveTV(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  // Sync popular channels from English-speaking countries
  const popularStart = Date.now();
  try {
    const popularResult = await syncPopularChannels();
    results.push({
      source: 'iptv-popular',
      kind: 'live-tv',
      fetched: popularResult.fetched,
      imported: popularResult.imported,
      errors: popularResult.errors.slice(0, 5),
      duration: Date.now() - popularStart,
    });
  } catch (err: any) {
    results.push({
      source: 'iptv-popular',
      kind: 'live-tv',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - popularStart,
    });
  }

  // Sync news channels
  const newsStart = Date.now();
  try {
    const newsResult = await syncNewsChannels();
    results.push({
      source: 'iptv-news',
      kind: 'live-tv',
      fetched: newsResult.fetched,
      imported: newsResult.imported,
      errors: newsResult.errors.slice(0, 5),
      duration: Date.now() - newsStart,
    });
  } catch (err: any) {
    results.push({
      source: 'iptv-news',
      kind: 'live-tv',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - newsStart,
    });
  }

  // Sync sports channels
  const sportsStart = Date.now();
  try {
    const sportsResult = await syncSportsChannels();
    results.push({
      source: 'iptv-sports',
      kind: 'live-tv',
      fetched: sportsResult.fetched,
      imported: sportsResult.imported,
      errors: sportsResult.errors.slice(0, 5),
      duration: Date.now() - sportsStart,
    });
  } catch (err: any) {
    results.push({
      source: 'iptv-sports',
      kind: 'live-tv',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - sportsStart,
    });
  }

  // Sync kids channels
  const kidsStart = Date.now();
  try {
    const kidsResult = await syncKidsChannels();
    results.push({
      source: 'iptv-kids',
      kind: 'live-tv',
      fetched: kidsResult.fetched,
      imported: kidsResult.imported,
      errors: kidsResult.errors.slice(0, 5),
      duration: Date.now() - kidsStart,
    });
  } catch (err: any) {
    results.push({
      source: 'iptv-kids',
      kind: 'live-tv',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - kidsStart,
    });
  }

  return results;
}

/**
 * Sync free ebooks from Gutendex, Google Books, and Open Library
 */
export async function syncEbooks(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  const gutendexStart = Date.now();
  try {
    const gutResult = await importFromGutendex({ limit: 100 });
    results.push({
      source: 'gutendex',
      kind: 'ebook',
      fetched: gutResult.count,
      imported: gutResult.items.length,
      errors: [],
      duration: Date.now() - gutendexStart,
    });
  } catch (err: any) {
    results.push({
      source: 'gutendex',
      kind: 'ebook',
      fetched: 0,
      imported: 0,
      errors: [err.message],
      duration: Date.now() - gutendexStart,
    });
  }

  const subjects = ['Fiction', 'Science Fiction', 'Mystery', 'Romance', 'History', 'Biography', 'Philosophy'];
  
  for (const subject of subjects) {
    const olStart = Date.now();
    try {
      const olResult = await importFromOpenLibrary({ subject, limit: 20 });
      results.push({
        source: 'openlibrary',
        kind: 'ebook',
        fetched: olResult.count,
        imported: olResult.items.length,
        errors: [],
        duration: Date.now() - olStart,
      });
    } catch (err: any) {
      results.push({
        source: 'openlibrary',
        kind: 'ebook',
        fetched: 0,
        imported: 0,
        errors: [err.message],
        duration: Date.now() - olStart,
      });
    }
    
    await new Promise(r => setTimeout(r, 200));
  }

  const searches = ['programming', 'business', 'science', 'art', 'cooking'];
  
  for (const query of searches) {
    const gbStart = Date.now();
    try {
      const gbResult = await importFromGoogleBooks(query, 20);
      results.push({
        source: 'googlebooks',
        kind: 'ebook',
        fetched: gbResult.count,
        imported: gbResult.items.length,
        errors: [],
        duration: Date.now() - gbStart,
      });
    } catch (err: any) {
      results.push({
        source: 'googlebooks',
        kind: 'ebook',
        fetched: 0,
        imported: 0,
        errors: [err.message],
        duration: Date.now() - gbStart,
      });
    }
    
    await new Promise(r => setTimeout(r, 200));
  }

  return results;
}

/**
 * Sync free products from public catalogs
 */
export async function syncProducts(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  const start = Date.now();
  
  const freeProducts = [
    {
      id: 'free-product-1',
      source: 'demo',
      title: 'Open Source Software Bundle',
      description: 'Collection of popular open source tools and applications',
      thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
      merchantUrl: 'https://opensource.org/',
      merchantName: 'Open Source Initiative',
      category: 'Software',
      tags: ['free', 'open-source', 'software'],
      inStock: true,
      priceFiat: { amount: 0, currency: 'USD' },
    },
    {
      id: 'free-product-2',
      source: 'demo',
      title: 'Creative Commons Media Kit',
      description: 'Free images, videos, and audio under Creative Commons license',
      thumbnail: 'https://images.unsplash.com/photo-1493711662062-fa541f7f2f60?w=400',
      merchantUrl: 'https://creativecommons.org/',
      merchantName: 'Creative Commons',
      category: 'Media',
      tags: ['free', 'creative-commons', 'media'],
      inStock: true,
      priceFiat: { amount: 0, currency: 'USD' },
    },
    {
      id: 'free-product-3',
      source: 'demo',
      title: 'Khan Academy Courses',
      description: 'Free online courses in math, science, and humanities',
      thumbnail: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400',
      merchantUrl: 'https://www.khanacademy.org/',
      merchantName: 'Khan Academy',
      category: 'Education',
      tags: ['free', 'education', 'courses'],
      inStock: true,
      priceFiat: { amount: 0, currency: 'USD' },
    },
  ];

  let imported = 0;
  for (const product of freeProducts) {
    try {
      const slug = `${product.source}-${product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}`;
      
      const [existing] = await db.select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.slug, slug))
        .limit(1);

      if (!existing) {
        await db.insert(marketplaceItems).values({
          id: uuidv4(),
          slug,
          title: product.title,
          description: product.description,
          itemType: 'product',
          category: product.category,
          subcategory: null,
          thumbnail: product.thumbnail,
          coverImage: product.thumbnail,
          priceWei: '0',
          currency: 'USD',
          tags: product.tags,
          status: 'published',
          featured: false,
          creatorWallet: 'atlas-one-system',
          metadata: {
            source: product.source,
            merchantUrl: product.merchantUrl,
            merchantName: product.merchantName,
            priceFiat: product.priceFiat,
            inStock: product.inStock,
            purchaseModes: ['browser'],
          },
        });
        imported++;
      }
    } catch (err: any) {
      console.error(`Failed to import product ${product.title}:`, err);
    }
  }

  results.push({
    source: 'demo',
    kind: 'product',
    fetched: freeProducts.length,
    imported,
    errors: [],
    duration: Date.now() - start,
  });

  return results;
}

/**
 * Run full sync of all content types
 */
export async function runFullSync(): Promise<FullSyncResult> {
  const startedAt = new Date();
  const allResults: SyncResult[] = [];

  console.log('[Atlas One Sync] Starting full content sync...');

  console.log('[Atlas One Sync] Syncing games...');
  const gameResults = await syncGames();
  allResults.push(...gameResults);

  console.log('[Atlas One Sync] Syncing videos...');
  const videoResults = await syncVideos();
  allResults.push(...videoResults);

  console.log('[Atlas One Sync] Syncing ebooks...');
  const ebookResults = await syncEbooks();
  allResults.push(...ebookResults);

  console.log('[Atlas One Sync] Syncing products...');
  const productResults = await syncProducts();
  allResults.push(...productResults);

  const completedAt = new Date();

  const summary = {
    games: allResults.filter(r => r.kind === 'game').reduce((sum, r) => sum + r.imported, 0),
    videos: allResults.filter(r => r.kind === 'video').reduce((sum, r) => sum + r.imported, 0),
    ebooks: allResults.filter(r => r.kind === 'ebook').reduce((sum, r) => sum + r.imported, 0),
    products: allResults.filter(r => r.kind === 'product').reduce((sum, r) => sum + r.imported, 0),
    total: allResults.reduce((sum, r) => sum + r.imported, 0),
  };

  console.log('[Atlas One Sync] Sync complete!', summary);

  return {
    startedAt,
    completedAt,
    totalDuration: completedAt.getTime() - startedAt.getTime(),
    results: allResults,
    summary,
  };
}

/**
 * Get current catalog counts
 */
export async function getCatalogCounts(): Promise<{
  games: number;
  videos: number;
  ebooks: number;
  apps: number;
  products: number;
  audio: number;
  total: number;
}> {
  const [gameCount] = await db.select({ count: sql<number>`count(*)` }).from(games);
  
  const itemCounts = await db.select({
    itemType: marketplaceItems.itemType,
    count: sql<number>`count(*)`,
  })
    .from(marketplaceItems)
    .groupBy(marketplaceItems.itemType);

  const counts: Record<string, number> = {
    game: Number(gameCount?.count || 0),
  };

  for (const row of itemCounts) {
    counts[row.itemType] = Number(row.count);
  }

  return {
    games: counts['game'] || 0,
    videos: (counts['video'] || 0) + (counts['movie'] || 0) + (counts['series'] || 0),
    ebooks: counts['ebook'] || 0,
    apps: counts['app'] || 0,
    products: counts['product'] || 0,
    audio: counts['audio'] || 0,
    total: Object.values(counts).reduce((sum, c) => sum + c, 0),
  };
}
