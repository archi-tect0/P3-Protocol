type PendingResolution<T> = {
  promise: Promise<T>;
  startedAt: number;
  subscriberCount: number;
};

const inFlightMap = new Map<string, PendingResolution<any>>();

const CLEANUP_DELAY_MS = 100;
const MAX_INFLIGHT_AGE_MS = 30000;

export function generateCoalesceKey(itemType: string, itemId: string): string {
  return `coalesce:${itemType}:${itemId}`;
}

export async function coalesce<T>(
  key: string,
  resolver: () => Promise<T>
): Promise<{ result: T; coalesced: boolean }> {
  const existing = inFlightMap.get(key);
  
  if (existing) {
    existing.subscriberCount++;
    try {
      const result = await existing.promise;
      return { result, coalesced: true };
    } finally {
      existing.subscriberCount--;
    }
  }

  const resolution: PendingResolution<T> = {
    promise: resolver(),
    startedAt: Date.now(),
    subscriberCount: 1,
  };

  inFlightMap.set(key, resolution);

  try {
    const result = await resolution.promise;
    return { result, coalesced: false };
  } finally {
    setTimeout(() => {
      const current = inFlightMap.get(key);
      if (current === resolution && current.subscriberCount <= 0) {
        inFlightMap.delete(key);
      }
    }, CLEANUP_DELAY_MS);
    
    resolution.subscriberCount--;
  }
}

export function hasInFlight(key: string): boolean {
  return inFlightMap.has(key);
}

export function getInFlightCount(): number {
  return inFlightMap.size;
}

export function getInFlightSubscribers(key: string): number {
  const existing = inFlightMap.get(key);
  return existing?.subscriberCount || 0;
}

export function clearInFlight(key: string): void {
  inFlightMap.delete(key);
}

export function clearAllInFlight(): void {
  inFlightMap.clear();
}

export function cleanupStaleInFlight(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, resolution] of inFlightMap.entries()) {
    if (now - resolution.startedAt > MAX_INFLIGHT_AGE_MS) {
      inFlightMap.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

let cleanupIntervalId: NodeJS.Timeout | null = null;

export function startCleanupInterval(intervalMs: number = 60000): void {
  if (cleanupIntervalId) return;
  
  cleanupIntervalId = setInterval(() => {
    cleanupStaleInFlight();
  }, intervalMs);
}

export function stopCleanupInterval(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

export interface CoalesceStats {
  inFlightCount: number;
  totalSubscribers: number;
  oldestRequestAgeMs: number;
}

export function getCoalesceStats(): CoalesceStats {
  const now = Date.now();
  let totalSubscribers = 0;
  let oldestAge = 0;
  
  for (const resolution of inFlightMap.values()) {
    totalSubscribers += resolution.subscriberCount;
    const age = now - resolution.startedAt;
    if (age > oldestAge) {
      oldestAge = age;
    }
  }
  
  return {
    inFlightCount: inFlightMap.size,
    totalSubscribers,
    oldestRequestAgeMs: oldestAge,
  };
}
