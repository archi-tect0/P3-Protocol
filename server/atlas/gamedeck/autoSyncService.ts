/**
 * AutoSyncService - Automatic game catalog synchronization
 * 
 * Keeps the Game Deck catalog fresh by periodically pulling
 * from external APIs (FreeToGame, GamerPower).
 * 
 * Default sync interval: 6 hours
 */

import { pullFreeToGame, pullGamerPower } from './gamesService';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const INITIAL_DELAY_MS = 60 * 1000; // 1 minute after startup

let syncTimer: NodeJS.Timeout | null = null;
let lastSyncTime: Date | null = null;
let syncInProgress = false;

interface SyncResult {
  source: string;
  fetched: number;
  upserted: number;
  errors: string[];
}

interface AutoSyncStatus {
  enabled: boolean;
  lastSync: string | null;
  nextSync: string | null;
  syncInProgress: boolean;
  intervalHours: number;
}

/**
 * Perform a full catalog sync from all sources
 */
async function performSync(): Promise<SyncResult[]> {
  if (syncInProgress) {
    console.log('[AutoSync] Sync already in progress, skipping');
    return [];
  }

  syncInProgress = true;
  const results: SyncResult[] = [];

  try {
    console.log('[AutoSync] Starting catalog sync...');

    // Sync FreeToGame
    try {
      const f2gResult = await pullFreeToGame({});
      results.push({
        source: 'freetogame',
        fetched: f2gResult.fetched,
        upserted: f2gResult.upserted,
        errors: f2gResult.errors,
      });
      console.log(`[AutoSync] FreeToGame: ${f2gResult.upserted} games synced`);
    } catch (err: any) {
      console.error(`[AutoSync] FreeToGame sync failed: ${err.message}`);
      results.push({
        source: 'freetogame',
        fetched: 0,
        upserted: 0,
        errors: [err.message],
      });
    }

    // Sync GamerPower
    try {
      const gpResult = await pullGamerPower({});
      results.push({
        source: 'gamerpower',
        fetched: gpResult.fetched,
        upserted: gpResult.upserted,
        errors: gpResult.errors,
      });
      console.log(`[AutoSync] GamerPower: ${gpResult.upserted} games synced`);
    } catch (err: any) {
      console.error(`[AutoSync] GamerPower sync failed: ${err.message}`);
      results.push({
        source: 'gamerpower',
        fetched: 0,
        upserted: 0,
        errors: [err.message],
      });
    }

    lastSyncTime = new Date();
    console.log(`[AutoSync] Catalog sync complete at ${lastSyncTime.toISOString()}`);

  } finally {
    syncInProgress = false;
  }

  return results;
}

/**
 * Start the auto-sync scheduler
 */
export function startAutoSync(): void {
  if (syncTimer) {
    console.log('[AutoSync] Already running');
    return;
  }

  console.log(`[AutoSync] Starting auto-sync scheduler (interval: ${SYNC_INTERVAL_MS / 1000 / 60 / 60} hours)`);

  // Initial sync after a short delay
  setTimeout(async () => {
    console.log('[AutoSync] Running initial sync...');
    await performSync();
  }, INITIAL_DELAY_MS);

  // Set up recurring sync
  syncTimer = setInterval(async () => {
    await performSync();
  }, SYNC_INTERVAL_MS);

  console.log('[AutoSync] Scheduler started');
}

/**
 * Stop the auto-sync scheduler
 */
export function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[AutoSync] Scheduler stopped');
  }
}

/**
 * Trigger an immediate sync (manual trigger)
 */
export async function triggerSync(): Promise<SyncResult[]> {
  console.log('[AutoSync] Manual sync triggered');
  return performSync();
}

/**
 * Get current auto-sync status
 */
export function getAutoSyncStatus(): AutoSyncStatus {
  const nextSync = lastSyncTime
    ? new Date(lastSyncTime.getTime() + SYNC_INTERVAL_MS).toISOString()
    : new Date(Date.now() + INITIAL_DELAY_MS).toISOString();

  return {
    enabled: syncTimer !== null,
    lastSync: lastSyncTime?.toISOString() || null,
    nextSync,
    syncInProgress,
    intervalHours: SYNC_INTERVAL_MS / 1000 / 60 / 60,
  };
}
