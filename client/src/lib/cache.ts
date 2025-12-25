interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class CacheStore<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;

  constructor(ttlMinutes: number) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  size(): number {
    const now = Date.now();
    let validCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        validCount++;
      } else {
        this.cache.delete(key);
      }
    }
    
    return validCount;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export interface ENSResolution {
  address: string;
  name: string;
  avatar?: string;
}

export interface BasenameResolution {
  address: string;
  basename: string;
  avatar?: string;
}

export interface AvatarData {
  url: string;
  contentType?: string;
}

export interface ReceiptStatus {
  status: 'pending' | 'confirmed' | 'failed';
  confirmations?: number;
  blockNumber?: number;
  timestamp?: number;
}

export const ensCache = new CacheStore<ENSResolution>(15);
export const basenameCache = new CacheStore<BasenameResolution>(15);
export const avatarCache = new CacheStore<AvatarData>(30);
export const receiptStatusCache = new CacheStore<ReceiptStatus>(5);

export async function getCachedENS(
  address: string,
  fetcher: () => Promise<ENSResolution>
): Promise<ENSResolution> {
  const normalizedAddress = address.toLowerCase();
  const cached = ensCache.get(normalizedAddress);
  
  if (cached) {
    return cached;
  }

  const result = await fetcher();
  ensCache.set(normalizedAddress, result);
  return result;
}

export async function getCachedBasename(
  address: string,
  fetcher: () => Promise<BasenameResolution>
): Promise<BasenameResolution> {
  const normalizedAddress = address.toLowerCase();
  const cached = basenameCache.get(normalizedAddress);
  
  if (cached) {
    return cached;
  }

  const result = await fetcher();
  basenameCache.set(normalizedAddress, result);
  return result;
}

export async function getCachedAvatar(
  identifier: string,
  fetcher: () => Promise<AvatarData>
): Promise<AvatarData> {
  const cached = avatarCache.get(identifier);
  
  if (cached) {
    return cached;
  }

  const result = await fetcher();
  avatarCache.set(identifier, result);
  return result;
}

export async function getCachedReceiptStatus(
  receiptId: string,
  fetcher: () => Promise<ReceiptStatus>
): Promise<ReceiptStatus> {
  const cached = receiptStatusCache.get(receiptId);
  
  if (cached) {
    return cached;
  }

  const result = await fetcher();
  receiptStatusCache.set(receiptId, result);
  return result;
}

export function invalidateENSCache(address: string): void {
  ensCache.delete(address.toLowerCase());
}

export function invalidateBasenameCache(address: string): void {
  basenameCache.delete(address.toLowerCase());
}

export function invalidateAvatarCache(identifier: string): void {
  avatarCache.delete(identifier);
}

export function invalidateReceiptStatusCache(receiptId: string): void {
  receiptStatusCache.delete(receiptId);
}

export function clearAllCaches(): void {
  ensCache.clear();
  basenameCache.clear();
  avatarCache.clear();
  receiptStatusCache.clear();
}

setInterval(() => {
  ensCache.cleanup();
  basenameCache.cleanup();
  avatarCache.cleanup();
  receiptStatusCache.cleanup();
}, 5 * 60 * 1000);
