import { Request, Response, NextFunction } from 'express';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { slaMetrics, insertSlaMetricSchema, SlaMetric } from '@shared/schema';

interface AuthenticatedRequest extends Request {
  wallet?: string;
  tenantId?: string;
  apiKey?: {
    tenantId: string;
    keyId: string;
    walletOwner: string;
    tier?: number;
    quotaMonthly: number;
  };
}

interface LatencyMetric {
  endpoint: string;
  latencies: number[];
  errors: number;
  success: number;
}

const metricsBuffer: Map<string, Map<string, LatencyMetric>> = new Map();
const FLUSH_INTERVAL_MS = 60000;
const PERIOD_DURATION_MS = 300000;

export function collectSLAMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const tenantId = req.apiKey?.tenantId || req.tenantId || 'global';
  const endpoint = normalizeEndpoint(req.path);
  
  const originalEnd = res.end;
  
  res.end = ((...args: any[]) => {
    const latency = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    
    recordMetric(tenantId, endpoint, latency, isError);
    
    return (originalEnd as any).apply(res, args);
  }) as typeof res.end;
  
  next();
}

function normalizeEndpoint(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/0x[0-9a-fA-F]{40}/g, '/:address')
    .replace(/\/\d+/g, '/:n')
    .split('?')[0];
}

function recordMetric(tenantId: string, endpoint: string, latency: number, isError: boolean): void {
  if (!metricsBuffer.has(tenantId)) {
    metricsBuffer.set(tenantId, new Map());
  }
  
  const tenantMetrics = metricsBuffer.get(tenantId)!;
  
  if (!tenantMetrics.has(endpoint)) {
    tenantMetrics.set(endpoint, {
      endpoint,
      latencies: [],
      errors: 0,
      success: 0,
    });
  }
  
  const metric = tenantMetrics.get(endpoint)!;
  metric.latencies.push(latency);
  
  if (isError) {
    metric.errors++;
  } else {
    metric.success++;
  }
}

function calculatePercentile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function flushMetricsToDB(): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - PERIOD_DURATION_MS);
  
  for (const [tenantId, tenantMetrics] of metricsBuffer) {
    for (const [endpoint, metric] of tenantMetrics) {
      if (metric.latencies.length === 0 && metric.errors === 0 && metric.success === 0) {
        continue;
      }
      
      const sorted = [...metric.latencies].sort((a, b) => a - b);
      const p50 = calculatePercentile(sorted, 50);
      const p95 = calculatePercentile(sorted, 95);
      const total = metric.errors + metric.success;
      const uptime = total > 0 ? ((metric.success / total) * 100).toFixed(2) : '100.00';
      
      try {
        await db.insert(slaMetrics).values({
          tenantId,
          endpoint,
          latencyMsP50: Math.round(p50),
          latencyMsP95: Math.round(p95),
          uptimePct: uptime,
          periodStart,
          periodEnd: now,
        });
      } catch (error) {
        console.error('Error flushing SLA metrics:', error);
      }
      
      metric.latencies = [];
      metric.errors = 0;
      metric.success = 0;
    }
  }
}

export function startSLAMetricsCollection(): void {
  setInterval(flushMetricsToDB, FLUSH_INTERVAL_MS);
  console.log('✓ SLA metrics collection started');
}

export async function getSLAMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  endpoints: Record<string, { p50: number; p95: number; uptime: string }>;
  overall: { avgP50: number; avgP95: number; avgUptime: string };
}> {
  const metrics = await db.select()
    .from(slaMetrics)
    .where(
      and(
        eq(slaMetrics.tenantId, tenantId),
        gte(slaMetrics.periodStart, startDate),
        lte(slaMetrics.periodEnd, endDate)
      )
    );
  
  const byEndpoint: Record<string, { p50s: number[]; p95s: number[]; uptimes: number[] }> = {};
  
  for (const m of metrics) {
    if (!byEndpoint[m.endpoint]) {
      byEndpoint[m.endpoint] = { p50s: [], p95s: [], uptimes: [] };
    }
    byEndpoint[m.endpoint].p50s.push(m.latencyMsP50);
    byEndpoint[m.endpoint].p95s.push(m.latencyMsP95);
    byEndpoint[m.endpoint].uptimes.push(parseFloat(m.uptimePct));
  }
  
  const endpoints: Record<string, { p50: number; p95: number; uptime: string }> = {};
  let totalP50 = 0, totalP95 = 0, totalUptime = 0, count = 0;
  
  for (const [endpoint, data] of Object.entries(byEndpoint)) {
    const avgP50 = data.p50s.reduce((a, b) => a + b, 0) / data.p50s.length;
    const avgP95 = data.p95s.reduce((a, b) => a + b, 0) / data.p95s.length;
    const avgUptime = data.uptimes.reduce((a, b) => a + b, 0) / data.uptimes.length;
    
    endpoints[endpoint] = {
      p50: Math.round(avgP50),
      p95: Math.round(avgP95),
      uptime: avgUptime.toFixed(2) + '%',
    };
    
    totalP50 += avgP50;
    totalP95 += avgP95;
    totalUptime += avgUptime;
    count++;
  }
  
  return {
    endpoints,
    overall: {
      avgP50: count > 0 ? Math.round(totalP50 / count) : 0,
      avgP95: count > 0 ? Math.round(totalP95 / count) : 0,
      avgUptime: count > 0 ? (totalUptime / count).toFixed(2) + '%' : '100.00%',
    },
  };
}

export async function getSLASummary(tenantId: string): Promise<{
  last24h: { p50: number; p95: number; uptime: string };
  last7d: { p50: number; p95: number; uptime: string };
  last30d: { p50: number; p95: number; uptime: string };
}> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const [last24h, last7d, last30d] = await Promise.all([
    getSLAMetrics(tenantId, oneDayAgo, now),
    getSLAMetrics(tenantId, sevenDaysAgo, now),
    getSLAMetrics(tenantId, thirtyDaysAgo, now),
  ]);
  
  return {
    last24h: { 
      p50: last24h.overall.avgP50, 
      p95: last24h.overall.avgP95, 
      uptime: last24h.overall.avgUptime 
    },
    last7d: { 
      p50: last7d.overall.avgP50, 
      p95: last7d.overall.avgP95, 
      uptime: last7d.overall.avgUptime 
    },
    last30d: { 
      p50: last30d.overall.avgP50, 
      p95: last30d.overall.avgP95, 
      uptime: last30d.overall.avgUptime 
    },
  };
}
