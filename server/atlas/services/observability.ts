export interface UsageEvent {
  endpoint: string;
  wallet: string;
  status: 'ok' | 'error' | 'held_for_review';
  duration: number;
  ts: number;
  error?: string;
}

export interface MetricsSummary {
  totalCalls: number;
  totalErrors: number;
  avgDuration: number;
  byEndpoint: Record<string, {
    calls: number;
    errors: number;
    avgDuration: number;
  }>;
  byWallet: Record<string, number>;
  byStatus: Record<string, number>;
}

const usageEvents: UsageEvent[] = [];
const MAX_EVENTS = 10000;

export function recordUsage(event: UsageEvent): void {
  usageEvents.push(event);
  
  if (usageEvents.length > MAX_EVENTS) {
    usageEvents.shift();
  }
}

export function getMetrics(range: { start: number; end: number }): MetricsSummary {
  const filtered = usageEvents.filter(e => e.ts >= range.start && e.ts <= range.end);
  
  const summary: MetricsSummary = {
    totalCalls: filtered.length,
    totalErrors: 0,
    avgDuration: 0,
    byEndpoint: {},
    byWallet: {},
    byStatus: {},
  };
  
  if (filtered.length === 0) {
    return summary;
  }
  
  let totalDuration = 0;
  
  for (const event of filtered) {
    totalDuration += event.duration;
    
    if (event.status === 'error') {
      summary.totalErrors++;
    }
    
    if (!summary.byEndpoint[event.endpoint]) {
      summary.byEndpoint[event.endpoint] = { calls: 0, errors: 0, avgDuration: 0 };
    }
    summary.byEndpoint[event.endpoint].calls++;
    if (event.status === 'error') {
      summary.byEndpoint[event.endpoint].errors++;
    }
    summary.byEndpoint[event.endpoint].avgDuration += event.duration;
    
    summary.byWallet[event.wallet] = (summary.byWallet[event.wallet] || 0) + 1;
    
    summary.byStatus[event.status] = (summary.byStatus[event.status] || 0) + 1;
  }
  
  summary.avgDuration = totalDuration / filtered.length;
  
  for (const endpoint of Object.keys(summary.byEndpoint)) {
    const ep = summary.byEndpoint[endpoint];
    ep.avgDuration = ep.avgDuration / ep.calls;
  }
  
  return summary;
}

export function getRecentEvents(limit: number = 100): UsageEvent[] {
  return usageEvents.slice(-limit);
}

export function getEventsByWallet(wallet: string, limit: number = 100): UsageEvent[] {
  return usageEvents
    .filter(e => e.wallet === wallet)
    .slice(-limit);
}

export function getErrorEvents(limit: number = 100): UsageEvent[] {
  return usageEvents
    .filter(e => e.status === 'error')
    .slice(-limit);
}

export function clearEvents(): void {
  usageEvents.length = 0;
}
