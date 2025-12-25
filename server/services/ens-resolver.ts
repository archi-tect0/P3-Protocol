import { createPublicClient, http, normalize } from 'viem';
import { mainnet, base } from 'viem/chains';

/**
 * Cache entry with TTL
 */
interface CacheEntry<T> {
  value: T;
  expiry: number;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  address: string;
  ensName: string | null;
  basename: string | null;
  avatarUrl: string | null;
  timestamp: number;
}

/**
 * ENSResolverService - Resolve addresses to ENS names and Basenames
 * 
 * Features:
 * - Resolve Ethereum addresses to ENS names (mainnet)
 * - Resolve addresses to Basenames (Base L2)
 * - In-memory cache with 15-minute TTL
 * - Batch resolution support
 * - Avatar URL fetching from ENS records
 */
export class ENSResolverService {
  private cache: Map<string, CacheEntry<ResolutionResult>>;
  private readonly cacheTTL: number = 15 * 60 * 1000; // 15 minutes
  private mainnetClient;
  private baseClient;

  constructor() {
    this.cache = new Map();

    // Initialize Viem clients for mainnet and Base
    this.mainnetClient = createPublicClient({
      chain: mainnet,
      transport: http(),
    });

    this.baseClient = createPublicClient({
      chain: base,
      transport: http(),
    });
  }

  /**
   * Resolve a single address to ENS name and Basename
   * 
   * @param address - Ethereum address to resolve
   * @returns Promise<ResolutionResult> - Resolution result with ENS name, Basename, and avatar
   */
  async resolve(address: string): Promise<ResolutionResult> {
    // Normalize address to lowercase
    const normalizedAddress = address.toLowerCase();

    // Check cache first
    const cached = this.getFromCache(normalizedAddress);
    if (cached) {
      return cached;
    }

    // Resolve ENS name (mainnet)
    let ensName: string | null = null;
    try {
      ensName = await this.mainnetClient.getEnsName({
        address: normalizedAddress as `0x${string}`,
      });
    } catch (error) {
      console.error(`Failed to resolve ENS for ${address}:`, error);
    }

    // Resolve Basename (Base L2)
    let basename: string | null = null;
    try {
      basename = await this.baseClient.getEnsName({
        address: normalizedAddress as `0x${string}`,
      });
    } catch (error) {
      console.error(`Failed to resolve Basename for ${address}:`, error);
    }

    // Fetch avatar URL if ENS name exists
    let avatarUrl: string | null = null;
    if (ensName) {
      try {
        avatarUrl = await this.mainnetClient.getEnsAvatar({
          name: normalize(ensName),
        });
      } catch (error) {
        console.error(`Failed to fetch ENS avatar for ${ensName}:`, error);
      }
    }

    // Create result
    const result: ResolutionResult = {
      address: normalizedAddress,
      ensName,
      basename,
      avatarUrl,
      timestamp: Date.now(),
    };

    // Store in cache
    this.setInCache(normalizedAddress, result);

    return result;
  }

  /**
   * Resolve multiple addresses in batch
   * 
   * @param addresses - Array of Ethereum addresses to resolve
   * @returns Promise<ResolutionResult[]> - Array of resolution results
   * 
   * Optimizations:
   * - Checks cache for each address first
   * - Resolves uncached addresses in parallel
   */
  async resolveBatch(addresses: string[]): Promise<ResolutionResult[]> {
    const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
    const results: ResolutionResult[] = [];
    const toResolve: string[] = [];

    // Check cache for each address
    for (const address of normalizedAddresses) {
      const cached = this.getFromCache(address);
      if (cached) {
        results.push(cached);
      } else {
        toResolve.push(address);
      }
    }

    // Resolve uncached addresses in parallel
    if (toResolve.length > 0) {
      const resolvePromises = toResolve.map(address => this.resolve(address));
      const resolved = await Promise.all(resolvePromises);
      results.push(...resolved);
    }

    // Sort results to match original order
    const resultMap = new Map(results.map(r => [r.address, r]));
    return normalizedAddresses.map(addr => resultMap.get(addr)!).filter(Boolean);
  }

  /**
   * Get entry from cache if not expired
   * 
   * @param address - Normalized address
   * @returns ResolutionResult | null - Cached result or null if expired/not found
   */
  private getFromCache(address: string): ResolutionResult | null {
    const entry = this.cache.get(address);
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(address);
      return null;
    }

    return entry.value;
  }

  /**
   * Store entry in cache with TTL
   * 
   * @param address - Normalized address
   * @param result - Resolution result to cache
   */
  private setInCache(address: string, result: ResolutionResult): void {
    const entry: CacheEntry<ResolutionResult> = {
      value: result,
      expiry: Date.now() + this.cacheTTL,
    };

    this.cache.set(address, entry);
  }

  /**
   * Clear expired entries from cache
   * Call this periodically to prevent memory leaks
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [address, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(address);
      }
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Object with cache size and hit rate info
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
