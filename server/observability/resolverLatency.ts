import { Registry, Histogram, Counter, Gauge, Summary } from 'prom-client';
import { logger } from './logger';

const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5];
const PERCENTILES = [0.5, 0.9, 0.95, 0.99];

interface VerticalStats {
  samples: number[];
  lastUpdated: number;
}

interface PercentileResult {
  p50: number;
  p95: number;
  p99: number;
  sampleSize: number;
}

export class ResolverLatencyTracker {
  private registry: Registry;

  public resolverLatency: Histogram<string>;
  public resolverRequests: Counter<string>;
  public cacheHitRate: Gauge<string>;
  public cacheHits: Counter<string>;
  public cacheMisses: Counter<string>;
  public inFlightCoalesced: Counter<string>;
  public latencySummary: Summary<string>;
  public verticalPercentiles: Gauge<string>;

  private latencyWindow: number[] = [];
  private windowSize = 1000;
  private lastFlush = Date.now();
  private flushInterval = 60000;

  private verticalLatencies: Map<string, VerticalStats> = new Map();
  private maxVerticalSamples = 500;
  private verticalStatsMaxAge = 300000;

  constructor(registry?: Registry) {
    this.registry = registry || new Registry();

    this.resolverLatency = new Histogram({
      name: 'atlas_resolver_latency_seconds',
      help: 'Resolver resolution latency in seconds',
      labelNames: ['item_type', 'source', 'cache_status', 'readiness'],
      buckets: LATENCY_BUCKETS,
      registers: [this.registry],
    });

    this.resolverRequests = new Counter({
      name: 'atlas_resolver_requests_total',
      help: 'Total resolver requests',
      labelNames: ['item_type', 'source', 'cache_status', 'result'],
      registers: [this.registry],
    });

    this.cacheHitRate = new Gauge({
      name: 'atlas_resolver_cache_hit_rate',
      help: 'Cache hit rate (0-1)',
      labelNames: ['tier'],
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: 'atlas_resolver_cache_hits_total',
      help: 'Total cache hits',
      labelNames: ['tier'],
      registers: [this.registry],
    });

    this.cacheMisses = new Counter({
      name: 'atlas_resolver_cache_misses_total',
      help: 'Total cache misses',
      registers: [this.registry],
    });

    this.inFlightCoalesced = new Counter({
      name: 'atlas_resolver_coalesced_total',
      help: 'Total requests coalesced into existing in-flight resolutions',
      labelNames: ['item_type'],
      registers: [this.registry],
    });

    this.latencySummary = new Summary({
      name: 'atlas_resolver_latency_summary_seconds',
      help: 'Resolver latency summary with percentiles',
      labelNames: ['item_type'],
      percentiles: PERCENTILES,
      maxAgeSeconds: 300,
      ageBuckets: 5,
      registers: [this.registry],
    });

    this.verticalPercentiles = new Gauge({
      name: 'atlas_resolver_vertical_percentile_ms',
      help: 'Resolver latency percentiles per vertical in milliseconds',
      labelNames: ['item_type', 'percentile'],
      registers: [this.registry],
    });
  }

  recordResolution(params: {
    itemType: string;
    source: string;
    cacheStatus: 'edge_hit' | 'core_hit' | 'miss';
    readiness: string;
    result: 'success' | 'error' | 'timeout';
    latencyMs: number;
  }): void {
    const { itemType, source, cacheStatus, readiness, result, latencyMs } = params;
    const latencySeconds = latencyMs / 1000;

    this.resolverLatency.observe(
      { item_type: itemType, source, cache_status: cacheStatus, readiness },
      latencySeconds
    );

    this.resolverRequests.inc({
      item_type: itemType,
      source,
      cache_status: cacheStatus,
      result,
    });

    this.latencySummary.observe({ item_type: itemType }, latencySeconds);

    this.latencyWindow.push(latencyMs);
    if (this.latencyWindow.length > this.windowSize) {
      this.latencyWindow.shift();
    }

    this.recordVerticalLatency(itemType, latencyMs);
    this.maybeFlushStats();
  }

  private recordVerticalLatency(itemType: string, latencyMs: number): void {
    let stats = this.verticalLatencies.get(itemType);
    
    if (!stats) {
      stats = { samples: [], lastUpdated: Date.now() };
      this.verticalLatencies.set(itemType, stats);
    }
    
    stats.samples.push(latencyMs);
    stats.lastUpdated = Date.now();
    
    if (stats.samples.length > this.maxVerticalSamples) {
      stats.samples.shift();
    }
    
    const percentiles = this.calculatePercentilesFromSamples(stats.samples);
    this.verticalPercentiles.set({ item_type: itemType, percentile: 'p50' }, percentiles.p50);
    this.verticalPercentiles.set({ item_type: itemType, percentile: 'p95' }, percentiles.p95);
    this.verticalPercentiles.set({ item_type: itemType, percentile: 'p99' }, percentiles.p99);
  }

  private calculatePercentilesFromSamples(samples: number[]): PercentileResult {
    if (samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, sampleSize: 0 };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const len = sorted.length;

    const p50Index = Math.floor(len * 0.5);
    const p95Index = Math.floor(len * 0.95);
    const p99Index = Math.floor(len * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[Math.min(p95Index, len - 1)] || 0,
      p99: sorted[Math.min(p99Index, len - 1)] || 0,
      sampleSize: len,
    };
  }

  getVerticalPercentiles(itemType: string): PercentileResult {
    const stats = this.verticalLatencies.get(itemType);
    if (!stats) {
      return { p50: 0, p95: 0, p99: 0, sampleSize: 0 };
    }
    return this.calculatePercentilesFromSamples(stats.samples);
  }

  getAllVerticalPercentiles(): Map<string, PercentileResult> {
    const result = new Map<string, PercentileResult>();
    
    for (const [itemType, stats] of this.verticalLatencies.entries()) {
      if (Date.now() - stats.lastUpdated < this.verticalStatsMaxAge) {
        result.set(itemType, this.calculatePercentilesFromSamples(stats.samples));
      }
    }
    
    return result;
  }

  cleanupStaleVerticalStats(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [itemType, stats] of this.verticalLatencies.entries()) {
      if (now - stats.lastUpdated > this.verticalStatsMaxAge) {
        this.verticalLatencies.delete(itemType);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  recordCacheHit(tier: 'edge' | 'core'): void {
    this.cacheHits.inc({ tier });
    this.updateHitRate();
  }

  recordCacheMiss(): void {
    this.cacheMisses.inc();
    this.updateHitRate();
  }

  recordCoalescing(itemType: string): void {
    this.inFlightCoalesced.inc({ item_type: itemType });
  }

  private async updateHitRate(): Promise<void> {
    try {
      const edgeHits = await this.cacheHits.get().then(m => {
        const labels = m.values.find(v => v.labels.tier === 'edge');
        return labels?.value || 0;
      });
      const coreHits = await this.cacheHits.get().then(m => {
        const labels = m.values.find(v => v.labels.tier === 'core');
        return labels?.value || 0;
      });
      const misses = await this.cacheMisses.get().then(m => m.values[0]?.value || 0);

      const totalEdge = edgeHits + misses;
      const totalCore = coreHits + misses;
      const totalAll = edgeHits + coreHits + misses;

      if (totalEdge > 0) {
        this.cacheHitRate.set({ tier: 'edge' }, edgeHits / totalEdge);
      }
      if (totalCore > 0) {
        this.cacheHitRate.set({ tier: 'core' }, coreHits / totalCore);
      }
      if (totalAll > 0) {
        this.cacheHitRate.set({ tier: 'all' }, (edgeHits + coreHits) / totalAll);
      }
    } catch {
    }
  }

  private maybeFlushStats(): void {
    const now = Date.now();
    if (now - this.lastFlush < this.flushInterval) {
      return;
    }

    this.lastFlush = now;
    const percentiles = this.calculatePercentiles();

    logger.info('[ResolverLatency] Periodic stats flush', {
      p50: percentiles.p50,
      p95: percentiles.p95,
      p99: percentiles.p99,
      sampleSize: this.latencyWindow.length,
    });
  }

  calculatePercentiles(): { p50: number; p95: number; p99: number } {
    if (this.latencyWindow.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.latencyWindow].sort((a, b) => a - b);
    const len = sorted.length;

    const p50Index = Math.floor(len * 0.5);
    const p95Index = Math.floor(len * 0.95);
    const p99Index = Math.floor(len * 0.99);

    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[Math.min(p95Index, len - 1)] || 0,
      p99: sorted[Math.min(p99Index, len - 1)] || 0,
    };
  }

  getStats(): {
    percentiles: { p50: number; p95: number; p99: number };
    sampleSize: number;
    windowDuration: number;
  } {
    return {
      percentiles: this.calculatePercentiles(),
      sampleSize: this.latencyWindow.length,
      windowDuration: this.flushInterval,
    };
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  reset(): void {
    this.latencyWindow = [];
    this.lastFlush = Date.now();
  }
}

export const resolverLatencyTracker = new ResolverLatencyTracker();

export function trackResolution(params: {
  itemType: string;
  source: string;
  cacheStatus: 'edge_hit' | 'core_hit' | 'miss';
  readiness: string;
  result: 'success' | 'error' | 'timeout';
  latencyMs: number;
}): void {
  resolverLatencyTracker.recordResolution(params);
}

export function trackCacheHit(tier: 'edge' | 'core'): void {
  resolverLatencyTracker.recordCacheHit(tier);
}

export function trackCacheMiss(): void {
  resolverLatencyTracker.recordCacheMiss();
}

export function trackCoalescing(itemType: string): void {
  resolverLatencyTracker.recordCoalescing(itemType);
}

export function getLatencyPercentiles(): { p50: number; p95: number; p99: number } {
  return resolverLatencyTracker.calculatePercentiles();
}

export function getResolverStats(): ReturnType<ResolverLatencyTracker['getStats']> {
  return resolverLatencyTracker.getStats();
}

export function getVerticalPercentiles(itemType: string): PercentileResult {
  return resolverLatencyTracker.getVerticalPercentiles(itemType);
}

export function getAllVerticalPercentiles(): Map<string, PercentileResult> {
  return resolverLatencyTracker.getAllVerticalPercentiles();
}

export function getResolverMetrics(): Promise<string> {
  return resolverLatencyTracker.getMetrics();
}

export function cleanupStaleStats(): number {
  return resolverLatencyTracker.cleanupStaleVerticalStats();
}

export interface CoalescingEfficiency {
  totalRequests: number;
  coalescedRequests: number;
  efficiencyRatio: number;
}

let coalescingStats = {
  totalRequests: 0,
  coalescedRequests: 0,
};

export function recordTotalRequest(): void {
  coalescingStats.totalRequests++;
}

export function recordCoalescedRequest(): void {
  coalescingStats.coalescedRequests++;
}

export function getCoalescingEfficiency(): CoalescingEfficiency {
  const total = coalescingStats.totalRequests;
  const coalesced = coalescingStats.coalescedRequests;
  return {
    totalRequests: total,
    coalescedRequests: coalesced,
    efficiencyRatio: total > 0 ? coalesced / total : 0,
  };
}

export function resetCoalescingStats(): void {
  coalescingStats = {
    totalRequests: 0,
    coalescedRequests: 0,
  };
}

export type { PercentileResult };

export default resolverLatencyTracker;
