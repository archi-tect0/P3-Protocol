import { getRedisClient } from '../../../redis/client';
import { logger } from '../../../observability/logger';
import type { AccessManifest } from '@shared/schema';
import type { AccessContext, AccessResolverResult } from './index';

const REGION_PREFIX = process.env.REGION_PREFIX || 'us-east-1';

const EDGE_TTL_MIN_MS = 60 * 1000;
const EDGE_TTL_MAX_MS = 120 * 1000;
const CORE_TTL_MS = 600 * 1000;
const CORE_TTL_SECONDS = 600;
const STALE_WHILE_REVALIDATE_WINDOW_MS = 30 * 1000;

export enum ReadinessState {
  PENDING = 'PENDING',
  READY = 'READY',
  DEGRADED = 'DEGRADED',
}

export type CacheTier = 'edge' | 'core';

export interface CacheEntry {
  access: AccessManifest | null;
  error?: string;
  timestamp: number;
  state: ReadinessState;
  validatedAt?: number;
  ttlMs: number;
  tier: CacheTier;
}

export interface CachedResolverResult extends AccessResolverResult {
  readiness: ReadinessState;
  fromCache: boolean;
  latencyMs: number;
  ttlMs: number;
}

interface InMemoryCacheEntry {
  data: CacheEntry;
  expiresAt: number;
}

const inMemoryEdgeCache = new Map<string, InMemoryCacheEntry>();
const MAX_EDGE_CACHE_SIZE = 10000;
const EDGE_CACHE_CLEANUP_THRESHOLD = 0.9;

type PendingResolution = Promise<CachedResolverResult>;
const inFlightMap = new Map<string, PendingResolution>();

export function generateCacheKey(itemType: string, itemId: string): string {
  const normalizedId = itemId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return `access:${itemType}:${normalizedId}`;
}

function generateFullCacheKey(ctx: AccessContext): string {
  const { itemType, source, providerId, url } = ctx;
  const identifier = providerId || url || '';
  const normalizedId = identifier.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return `${REGION_PREFIX}:atlas:access:${itemType}:${source}:${normalizedId}`;
}

function generateEdgeCacheKey(ctx: AccessContext): string {
  return `${generateFullCacheKey(ctx)}:edge`;
}

function generateCoreCacheKey(ctx: AccessContext): string {
  return `${generateFullCacheKey(ctx)}:core`;
}

function getRandomEdgeTTLMs(): number {
  return EDGE_TTL_MIN_MS + Math.floor(Math.random() * (EDGE_TTL_MAX_MS - EDGE_TTL_MIN_MS + 1));
}

function getRandomEdgeTTLSeconds(): number {
  return Math.floor(getRandomEdgeTTLMs() / 1000);
}

function getRandomEdgeTTL(): number {
  return getRandomEdgeTTLSeconds();
}

function cleanupInMemoryCache(): void {
  const now = Date.now();
  const entries = Array.from(inMemoryEdgeCache.entries());
  
  const validEntries = entries.filter(([, entry]) => entry.expiresAt > now);
  
  if (validEntries.length >= MAX_EDGE_CACHE_SIZE * EDGE_CACHE_CLEANUP_THRESHOLD) {
    validEntries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = Math.floor(validEntries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      inMemoryEdgeCache.delete(validEntries[i][0]);
    }
  }
  
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) {
      inMemoryEdgeCache.delete(key);
    }
  }
}

function getFromInMemoryEdge(key: string): CacheEntry | null {
  const entry = inMemoryEdgeCache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    inMemoryEdgeCache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setInMemoryEdge(key: string, data: CacheEntry, ttlMs: number): void {
  if (inMemoryEdgeCache.size >= MAX_EDGE_CACHE_SIZE) {
    cleanupInMemoryCache();
  }
  
  inMemoryEdgeCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

function removeFromInMemoryEdge(key: string): void {
  inMemoryEdgeCache.delete(key);
}

export function getCached(itemType: string, itemId: string): CacheEntry | null {
  const key = generateCacheKey(itemType, itemId);
  return getFromInMemoryEdge(key);
}

export async function setCache(
  itemType: string,
  itemId: string,
  manifest: AccessManifest | null,
  tier: CacheTier,
  error?: string
): Promise<void> {
  const key = generateCacheKey(itemType, itemId);
  const ttlMs = tier === 'edge' ? getRandomEdgeTTLMs() : CORE_TTL_MS;
  
  const entry: CacheEntry = {
    access: manifest,
    error,
    timestamp: Date.now(),
    state: manifest ? ReadinessState.READY : ReadinessState.DEGRADED,
    validatedAt: Date.now(),
    ttlMs,
    tier,
  };
  
  if (tier === 'edge' || tier === 'core') {
    setInMemoryEdge(key, entry, ttlMs);
  }
}

export async function invalidate(itemType: string, itemId: string): Promise<void> {
  const key = generateCacheKey(itemType, itemId);
  removeFromInMemoryEdge(key);
}

export function getEdgeCacheSize(): number {
  return inMemoryEdgeCache.size;
}

export function clearEdgeCache(): void {
  inMemoryEdgeCache.clear();
}

export async function getCachedAccess(ctx: AccessContext): Promise<CacheEntry | null> {
  const inMemoryKey = generateCacheKey(ctx.itemType, ctx.providerId || ctx.url || '');
  const inMemoryEntry = getFromInMemoryEdge(inMemoryKey);
  if (inMemoryEntry) {
    return {
      ...inMemoryEntry,
      state: ReadinessState.READY,
      tier: 'edge',
    };
  }

  const redis = getRedisClient();
  const edgeKey = generateEdgeCacheKey(ctx);
  const coreKey = generateCoreCacheKey(ctx);

  try {
    const [edgeData, coreData] = await Promise.all([
      redis.get(edgeKey),
      redis.get(coreKey),
    ]);

    if (edgeData) {
      const entry = JSON.parse(edgeData) as CacheEntry;
      entry.state = ReadinessState.READY;
      entry.tier = 'edge';
      entry.ttlMs = entry.ttlMs || getRandomEdgeTTLMs();
      
      setInMemoryEdge(inMemoryKey, entry, entry.ttlMs);
      return entry;
    }

    if (coreData) {
      const entry = JSON.parse(coreData) as CacheEntry;
      const age = Date.now() - entry.timestamp;
      const isStale = age > (CORE_TTL_MS - STALE_WHILE_REVALIDATE_WINDOW_MS);

      entry.tier = 'core';
      entry.ttlMs = Math.max(0, CORE_TTL_MS - age);
      
      if (isStale) {
        entry.state = ReadinessState.DEGRADED;
      } else {
        entry.state = ReadinessState.READY;
      }
      return entry;
    }

    return null;
  } catch (err) {
    logger.error('[ResolverCache] Get cache error', err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

export async function setCachedAccess(ctx: AccessContext, result: AccessResolverResult): Promise<void> {
  const redis = getRedisClient();
  const edgeKey = generateEdgeCacheKey(ctx);
  const coreKey = generateCoreCacheKey(ctx);
  const inMemoryKey = generateCacheKey(ctx.itemType, ctx.providerId || ctx.url || '');

  const edgeTtlMs = getRandomEdgeTTLMs();
  const edgeTtlSeconds = Math.floor(edgeTtlMs / 1000);

  const edgeEntry: CacheEntry = {
    access: result.access,
    error: result.error,
    timestamp: Date.now(),
    state: ReadinessState.READY,
    validatedAt: Date.now(),
    ttlMs: edgeTtlMs,
    tier: 'edge',
  };

  const coreEntry: CacheEntry = {
    access: result.access,
    error: result.error,
    timestamp: Date.now(),
    state: ReadinessState.READY,
    validatedAt: Date.now(),
    ttlMs: CORE_TTL_MS,
    tier: 'core',
  };

  setInMemoryEdge(inMemoryKey, edgeEntry, edgeTtlMs);

  try {
    await Promise.all([
      redis.set(edgeKey, JSON.stringify(edgeEntry), 'EX', edgeTtlSeconds),
      redis.set(coreKey, JSON.stringify(coreEntry), 'EX', CORE_TTL_SECONDS),
    ]);
  } catch (err) {
    logger.error('[ResolverCache] Set cache error', err instanceof Error ? err : new Error(String(err)));
  }
}

export async function invalidateCachedAccess(ctx: AccessContext): Promise<void> {
  const redis = getRedisClient();
  const edgeKey = generateEdgeCacheKey(ctx);
  const coreKey = generateCoreCacheKey(ctx);
  const inMemoryKey = generateCacheKey(ctx.itemType, ctx.providerId || ctx.url || '');

  removeFromInMemoryEdge(inMemoryKey);

  try {
    await redis.del(edgeKey, coreKey);
  } catch (err) {
    logger.error('[ResolverCache] Invalidate cache error', err instanceof Error ? err : new Error(String(err)));
  }
}

export function getInFlightKey(ctx: AccessContext): string {
  return generateFullCacheKey(ctx);
}

export function getInFlightResolution(key: string): PendingResolution | undefined {
  return inFlightMap.get(key);
}

export function setInFlightResolution(key: string, promise: PendingResolution): void {
  inFlightMap.set(key, promise);
}

export function clearInFlightResolution(key: string): void {
  inFlightMap.delete(key);
}

export async function warmEdgeCache(ctx: AccessContext): Promise<void> {
  const redis = getRedisClient();
  const edgeKey = generateEdgeCacheKey(ctx);
  const coreKey = generateCoreCacheKey(ctx);

  try {
    const coreData = await redis.get(coreKey);
    if (coreData) {
      await redis.set(edgeKey, coreData, 'EX', getRandomEdgeTTL());
    }
  } catch (err) {
    logger.error('[ResolverCache] Warm edge cache error', err instanceof Error ? err : new Error(String(err)));
  }
}

export async function refreshCoreCache(
  ctx: AccessContext,
  resolver: () => Promise<AccessResolverResult>
): Promise<CachedResolverResult> {
  const key = getInFlightKey(ctx);

  const existingResolution = getInFlightResolution(key);
  if (existingResolution) {
    return existingResolution;
  }

  const resolutionPromise = (async (): Promise<CachedResolverResult> => {
    const start = Date.now();
    try {
      const result = await resolver();
      const latencyMs = Date.now() - start;

      if (result.access) {
        await setCachedAccess(ctx, result);
      }

      return {
        ...result,
        readiness: result.access ? ReadinessState.READY : ReadinessState.DEGRADED,
        fromCache: false,
        latencyMs,
        ttlMs: result.access ? getRandomEdgeTTLMs() : 0,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        access: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        readiness: ReadinessState.DEGRADED,
        fromCache: false,
        latencyMs,
        ttlMs: 0,
      };
    } finally {
      clearInFlightResolution(key);
    }
  })();

  setInFlightResolution(key, resolutionPromise);
  return resolutionPromise;
}

export async function resolveWithCoalescing(
  ctx: AccessContext,
  resolver: () => AccessResolverResult,
  budgetMs: number = 200
): Promise<CachedResolverResult> {
  const start = Date.now();
  const key = getInFlightKey(ctx);

  const existingResolution = getInFlightResolution(key);
  if (existingResolution) {
    return existingResolution;
  }

  const cached = await getCachedAccess(ctx);
  if (cached) {
    const latencyMs = Date.now() - start;
    
    if (cached.state === ReadinessState.DEGRADED) {
      refreshCoreCache(ctx, async () => resolver()).catch(() => {});
    }

    return {
      access: cached.access,
      error: cached.error,
      readiness: cached.state,
      fromCache: true,
      latencyMs,
      ttlMs: cached.ttlMs || 0,
    };
  }

  const resolutionPromise = (async (): Promise<CachedResolverResult> => {
    const resolutionStart = Date.now();

    const budgetTimeout = new Promise<CachedResolverResult>((resolve) => {
      setTimeout(() => {
        resolve({
          access: null,
          error: 'Resolution timeout - use openWeb fallback',
          readiness: ReadinessState.PENDING,
          fromCache: false,
          latencyMs: budgetMs,
          ttlMs: 0,
        });
      }, budgetMs);
    });

    const actualResolution = (async (): Promise<CachedResolverResult> => {
      try {
        const result = resolver();
        const latencyMs = Date.now() - resolutionStart;

        if (result.access) {
          await setCachedAccess(ctx, result);
        }

        return {
          ...result,
          readiness: result.access ? ReadinessState.READY : ReadinessState.DEGRADED,
          fromCache: false,
          latencyMs,
          ttlMs: result.access ? getRandomEdgeTTLMs() : 0,
        };
      } catch (err) {
        const latencyMs = Date.now() - resolutionStart;
        return {
          access: null,
          error: err instanceof Error ? err.message : 'Unknown error',
          readiness: ReadinessState.DEGRADED,
          fromCache: false,
          latencyMs,
          ttlMs: 0,
        };
      }
    })();

    const raceResult = await Promise.race([actualResolution, budgetTimeout]);

    if (raceResult.readiness === ReadinessState.PENDING) {
      actualResolution.then(async (fullResult) => {
        if (fullResult.access) {
          await setCachedAccess(ctx, fullResult);
        }
        clearInFlightResolution(key);
      }).catch(() => {
        clearInFlightResolution(key);
      });
    } else {
      clearInFlightResolution(key);
    }

    return raceResult;
  })();

  setInFlightResolution(key, resolutionPromise);
  return resolutionPromise;
}

export interface CacheStats {
  edgeHits: number;
  coreHits: number;
  misses: number;
  inFlightCoalesced: number;
}

const stats: CacheStats = {
  edgeHits: 0,
  coreHits: 0,
  misses: 0,
  inFlightCoalesced: 0,
};

export function recordCacheHit(tier: 'edge' | 'core'): void {
  if (tier === 'edge') {
    stats.edgeHits++;
  } else {
    stats.coreHits++;
  }
}

export function recordCacheMiss(): void {
  stats.misses++;
}

export function recordCoalescedRequest(): void {
  stats.inFlightCoalesced++;
}

export function getCacheStats(): CacheStats {
  return { ...stats };
}

export function getCacheHitRatio(): number {
  const total = stats.edgeHits + stats.coreHits + stats.misses;
  if (total === 0) return 0;
  return (stats.edgeHits + stats.coreHits) / total;
}

export function resetCacheStats(): void {
  stats.edgeHits = 0;
  stats.coreHits = 0;
  stats.misses = 0;
  stats.inFlightCoalesced = 0;
}
