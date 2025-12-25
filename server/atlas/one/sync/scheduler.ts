/**
 * Background Catalog Sync Scheduler
 * 
 * Runs incremental syncs for all content sources in the background.
 * Respects rate limits and resumes from where it left off using cursors.
 * 
 * Content sources:
 * - IPTV: 38K+ free live TV channels
 * - Gutendex: 70K+ public domain ebooks
 * - FreeToGame/GamerPower: Free games
 * - OMDB: Movies/TV shows
 */

import { db } from '../../../db';
import { catalogSyncCursors, marketplaceItems } from '@shared/schema';
import { eq, and, sql, isNull, lt } from 'drizzle-orm';
import { syncIPTVChannels } from './iptvService';
import { importFromGutendex } from '../../gamedeck/ebookService';
import { syncOpenFoodFacts, syncGitHubReleases, syncItchioProducts } from './productService';

interface SyncSourceConfig {
  source: string;
  enabled: boolean;
  batchSize: number;
  delayMs: number;
  intervalMinutes: number;
}

const SYNC_SOURCES: SyncSourceConfig[] = [
  { source: 'iptv', enabled: true, batchSize: 500, delayMs: 0, intervalMinutes: 5 },
  { source: 'gutendex', enabled: true, batchSize: 20, delayMs: 2000, intervalMinutes: 10 },
];

let isRunning = false;
let schedulerInterval: NodeJS.Timeout | null = null;

async function getOrCreateCursor(source: string): Promise<{
  id: string;
  cursorValue: any;
  totalImported: number;
  isEnabled: boolean;
}> {
  const [existing] = await db
    .select()
    .from(catalogSyncCursors)
    .where(eq(catalogSyncCursors.source, source))
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      cursorValue: existing.cursorValue || {},
      totalImported: existing.totalImported || 0,
      isEnabled: existing.isEnabled ?? true,
    };
  }

  const [created] = await db
    .insert(catalogSyncCursors)
    .values({
      source,
      cursorKey: 'default',
      cursorValue: { page: 1, offset: 0 },
      totalImported: 0,
      isEnabled: true,
    })
    .returning();

  return {
    id: created.id,
    cursorValue: created.cursorValue || {},
    totalImported: 0,
    isEnabled: true,
  };
}

async function updateCursor(
  id: string,
  updates: {
    cursorValue?: any;
    totalImported?: number;
    lastSuccessAt?: Date;
    lastErrorAt?: Date;
    lastError?: string;
    retryCount?: number;
  }
) {
  await db
    .update(catalogSyncCursors)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(catalogSyncCursors.id, id));
}

async function syncIPTVBatch(): Promise<{ imported: number; complete: boolean }> {
  const cursor = await getOrCreateCursor('iptv');
  
  if (!cursor.isEnabled) {
    return { imported: 0, complete: true };
  }

  try {
    const result = await syncIPTVChannels({
      limit: 500,
      excludeNSFW: true,
    });

    await updateCursor(cursor.id, {
      totalImported: cursor.totalImported + result.imported,
      lastSuccessAt: new Date(),
      retryCount: 0,
    });

    console.log(`[Scheduler] IPTV: +${result.imported} channels (total: ${cursor.totalImported + result.imported})`);

    return {
      imported: result.imported,
      complete: result.imported === 0 && result.skipped > 0,
    };
  } catch (err: any) {
    await updateCursor(cursor.id, {
      lastErrorAt: new Date(),
      lastError: err.message,
      retryCount: (cursor.cursorValue?.retryCount || 0) + 1,
    });
    console.error(`[Scheduler] IPTV error: ${err.message}`);
    return { imported: 0, complete: false };
  }
}

async function syncGutendexBatch(): Promise<{ imported: number; complete: boolean }> {
  const cursor = await getOrCreateCursor('gutendex');
  
  if (!cursor.isEnabled) {
    return { imported: 0, complete: true };
  }

  const currentPage = cursor.cursorValue?.page || 1;

  try {
    const topics = ['fiction', 'history', 'science', 'philosophy', 'poetry', 'drama', 'adventure', 'romance', 'mystery', 'biography'];
    const topicIndex = Math.floor((currentPage - 1) / 10) % topics.length;
    const topic = topics[topicIndex];

    const result = await importFromGutendex({
      topic,
      limit: 20,
    });

    const newPage = currentPage + 1;

    await updateCursor(cursor.id, {
      cursorValue: { page: newPage, topic },
      totalImported: cursor.totalImported + result.count,
      lastSuccessAt: new Date(),
      retryCount: 0,
    });

    console.log(`[Scheduler] Gutendex: +${result.count} ebooks from "${topic}" (page ${currentPage}, total: ${cursor.totalImported + result.count})`);

    return {
      imported: result.count,
      complete: result.count === 0 && currentPage > 100,
    };
  } catch (err: any) {
    const isRateLimit = err.message?.includes('429');
    
    await updateCursor(cursor.id, {
      lastErrorAt: new Date(),
      lastError: err.message,
      retryCount: (cursor.cursorValue?.retryCount || 0) + 1,
      nextRetryAt: isRateLimit 
        ? new Date(Date.now() + 5 * 60 * 1000)
        : new Date(Date.now() + 60 * 1000),
    });
    
    console.error(`[Scheduler] Gutendex error: ${err.message}${isRateLimit ? ' (rate limited, waiting 5 min)' : ''}`);
    return { imported: 0, complete: false };
  }
}

async function syncProductsBatch(): Promise<{ imported: number; complete: boolean }> {
  const cursor = await getOrCreateCursor('products');
  
  if (!cursor.isEnabled) {
    return { imported: 0, complete: true };
  }

  const currentPage = cursor.cursorValue?.page || 1;
  const sources = ['openfoodfacts', 'github', 'itchio'];
  const sourceIndex = (currentPage - 1) % sources.length;
  const source = sources[sourceIndex];

  try {
    let result = { imported: 0, skipped: 0, errors: [] as string[] };

    if (source === 'openfoodfacts') {
      const categories = ['beverages', 'snacks', 'cereals', 'dairy', 'fruits', 'vegetables'];
      const catIndex = Math.floor((currentPage - 1) / 3) % categories.length;
      result = await syncOpenFoodFacts({ category: categories[catIndex], pageSize: 20 });
    } else if (source === 'github') {
      result = await syncGitHubReleases({ limit: 5 });
    } else if (source === 'itchio') {
      result = await syncItchioProducts({ page: Math.ceil(currentPage / 3) });
    }

    await updateCursor(cursor.id, {
      cursorValue: { page: currentPage + 1, source },
      totalImported: cursor.totalImported + result.imported,
      lastSuccessAt: new Date(),
      retryCount: 0,
    });

    console.log(`[Scheduler] Products (${source}): +${result.imported} (total: ${cursor.totalImported + result.imported})`);

    return { imported: result.imported, complete: false };
  } catch (err: any) {
    await updateCursor(cursor.id, {
      lastErrorAt: new Date(),
      lastError: err.message,
      retryCount: (cursor.cursorValue?.retryCount || 0) + 1,
    });
    console.error(`[Scheduler] Products error: ${err.message}`);
    return { imported: 0, complete: false };
  }
}

async function runSyncCycle() {
  if (isRunning) {
    console.log('[Scheduler] Sync already in progress, skipping...');
    return;
  }

  isRunning = true;
  console.log('[Scheduler] Starting sync cycle...');

  try {
    const iptvResult = await syncIPTVBatch();
    
    await new Promise(r => setTimeout(r, 2000));
    
    const gutendexCursor = await getOrCreateCursor('gutendex');
    const canRunGutendex = !gutendexCursor.cursorValue?.nextRetryAt || 
      new Date(gutendexCursor.cursorValue.nextRetryAt) < new Date();
    
    if (canRunGutendex) {
      await syncGutendexBatch();
    } else {
      console.log('[Scheduler] Gutendex: waiting for rate limit cooldown...');
    }

    await new Promise(r => setTimeout(r, 2000));
    
    await syncProductsBatch();

    const [stats] = await db
      .select({
        iptv: sql<number>`COUNT(*) FILTER (WHERE category = 'live-tv')`,
        ebooks: sql<number>`COUNT(*) FILTER (WHERE item_type = 'ebook')`,
        videos: sql<number>`COUNT(*) FILTER (WHERE item_type = 'video')`,
        products: sql<number>`COUNT(*) FILTER (WHERE item_type = 'product')`,
      })
      .from(marketplaceItems);

    console.log(`[Scheduler] Catalog: ${stats.iptv} TV, ${stats.ebooks} ebooks, ${stats.videos} videos, ${stats.products} products`);

  } catch (err: any) {
    console.error(`[Scheduler] Sync cycle error: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

export function startScheduler(intervalMinutes: number = 3) {
  if (schedulerInterval) {
    console.log('[Scheduler] Already running');
    return;
  }

  console.log(`[Scheduler] Starting background sync (every ${intervalMinutes} minutes)`);
  
  setTimeout(runSyncCycle, 5000);
  
  schedulerInterval = setInterval(runSyncCycle, intervalMinutes * 60 * 1000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Stopped');
  }
}

export async function getSchedulerStatus() {
  const cursors = await db.select().from(catalogSyncCursors);
  
  return {
    isRunning,
    sources: cursors.map(c => ({
      source: c.source,
      enabled: c.isEnabled,
      totalImported: c.totalImported,
      lastSuccessAt: c.lastSuccessAt,
      lastError: c.lastError,
      lastErrorAt: c.lastErrorAt,
      cursorValue: c.cursorValue,
    })),
  };
}

export async function toggleSource(source: string, enabled: boolean) {
  await db
    .update(catalogSyncCursors)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(eq(catalogSyncCursors.source, source));
}

export async function triggerSync(source: string) {
  if (source === 'iptv') {
    return syncIPTVBatch();
  } else if (source === 'gutendex') {
    return syncGutendexBatch();
  } else if (source === 'products') {
    return syncProductsBatch();
  }
  throw new Error(`Unknown source: ${source}`);
}

export { syncOpenFoodFacts, syncGitHubReleases, syncItchioProducts, removeDemoProducts } from './productService';
