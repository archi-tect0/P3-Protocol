import type { TokenBundle } from '../atlas/services/vault';

interface CacheEntry {
  bundle: TokenBundle;
  expiresAt: number;
}

const CACHE_TTL_MS = 45_000;
const cache = new Map<string, CacheEntry>();

function key(wallet: string, provider: string, scope: string): string {
  return `${wallet.toLowerCase()}|${provider}|${scope}`;
}

export function getCached(wallet: string, provider: string, scope: string): TokenBundle | null {
  const k = key(wallet, provider, scope);
  const entry = cache.get(k);
  if (!entry || entry.expiresAt < Date.now()) {
    if (entry) cache.delete(k);
    return null;
  }
  return entry.bundle;
}

export function setCached(wallet: string, provider: string, scope: string, bundle: TokenBundle): void {
  const k = key(wallet, provider, scope);
  cache.set(k, { 
    bundle, 
    expiresAt: Date.now() + CACHE_TTL_MS 
  });
}

export function invalidateCached(wallet: string, provider: string, scope: string): void {
  cache.delete(key(wallet, provider, scope));
}

export function invalidateAllForWallet(wallet: string): void {
  const prefix = `${wallet.toLowerCase()}|`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefix)) {
      cache.delete(k);
    }
  }
}

export function getCacheStats(): { size: number; entries: Array<{ key: string; expiresIn: number }> } {
  const now = Date.now();
  const entries: Array<{ key: string; expiresIn: number }> = [];
  
  for (const [k, entry] of cache.entries()) {
    entries.push({ key: k, expiresIn: Math.max(0, entry.expiresAt - now) });
  }
  
  return { size: cache.size, entries };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, entry] of cache.entries()) {
    if (entry.expiresAt < now) {
      cache.delete(k);
    }
  }
}, 60_000);
