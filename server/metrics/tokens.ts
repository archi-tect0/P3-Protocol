interface TokenRecord {
  ts: number;
  provider: string;
  tokens: number;
  flow?: string;
  model?: string;
}

const WINDOW_MS = 5 * 60_000;
const records: TokenRecord[] = [];

export function recordTokens(
  provider: string, 
  tokens: number, 
  flow?: string,
  model?: string
): void {
  records.push({ ts: Date.now(), provider, tokens, flow, model });
  
  const cutoff = Date.now() - WINDOW_MS;
  while (records.length && records[0].ts < cutoff) {
    records.shift();
  }
}

interface AggregatedEntry {
  name: string;
  tokens: number;
}

interface TokenWindowResult {
  total: number;
  byProvider: AggregatedEntry[];
  byFlow: AggregatedEntry[];
  byModel: AggregatedEntry[];
}

export function getTokenWindow(provider?: string): TokenWindowResult {
  const cutoff = Date.now() - WINDOW_MS;
  const filtered = records.filter(r => 
    r.ts >= cutoff && (!provider || r.provider === provider)
  );
  
  const total = filtered.reduce((s, r) => s + r.tokens, 0);
  
  return {
    total,
    byProvider: aggregateBy(filtered, 'provider'),
    byFlow: aggregateBy(filtered, 'flow'),
    byModel: aggregateBy(filtered, 'model'),
  };
}

function aggregateBy(rs: TokenRecord[], field: 'provider' | 'flow' | 'model'): AggregatedEntry[] {
  const m = new Map<string, number>();
  for (const r of rs) {
    const key = r[field] || 'unknown';
    m.set(key, (m.get(key) || 0) + r.tokens);
  }
  return Array.from(m.entries()).map(([name, tokens]) => ({ name, tokens }));
}

export function getRecentRecords(limit: number = 50): TokenRecord[] {
  return records.slice(-limit);
}

export function getUsageStats(): {
  windowMs: number;
  recordCount: number;
  oldestRecord: number | null;
  newestRecord: number | null;
} {
  return {
    windowMs: WINDOW_MS,
    recordCount: records.length,
    oldestRecord: records[0]?.ts ?? null,
    newestRecord: records[records.length - 1]?.ts ?? null,
  };
}
