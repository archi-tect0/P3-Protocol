import type { ApiCatalogEntry, IngestResult, ApiSource } from './types';
import { fetchGitHubPublicApis, getBuiltinPublicApis, getDefaultSources } from './sourceConnectors';
import { normalizeRawEntry, deduplicateEntries, filterByQuality } from './normalizer';
import { storeApi, storeSource, updateSourceStatus, setLastFullIngest, getAllApis, getStats } from './catalogStore';

let isIngesting = false;
let lastIngestResult: IngestResult | null = null;

export async function ingestFromSource(source: ApiSource): Promise<IngestResult> {
  const startTime = Date.now();
  const result: IngestResult = {
    source: source.id,
    success: false,
    apisIngested: 0,
    apisSkipped: 0,
    errors: [],
    duration: 0,
  };

  try {
    let rawEntries;
    
    if (source.url.startsWith('builtin://')) {
      rawEntries = getBuiltinPublicApis();
    } else {
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'Atlas-MetaAdapter/1.0' },
      });
      
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }
      
      const data = await response.text();
      rawEntries = await source.parser(data);
    }

    const normalized = rawEntries
      .map(entry => normalizeRawEntry(entry, source.id))
      .filter((e): e is ApiCatalogEntry => e !== null);

    const deduplicated = deduplicateEntries(normalized);
    const filtered = filterByQuality(deduplicated);

    for (const entry of filtered) {
      storeApi(entry);
      result.apisIngested++;
    }

    result.apisSkipped = rawEntries.length - result.apisIngested;
    result.success = true;
    updateSourceStatus(source.id, 'active');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(message);
    updateSourceStatus(source.id, 'error', message);
  }

  result.duration = Date.now() - startTime;
  return result;
}

export async function ingestAllSources(): Promise<IngestResult[]> {
  if (isIngesting) {
    return [{ source: 'all', success: false, apisIngested: 0, apisSkipped: 0, errors: ['Ingestion already in progress'], duration: 0 }];
  }

  isIngesting = true;
  const results: IngestResult[] = [];

  try {
    const sources = getDefaultSources();
    
    for (const source of sources) {
      storeSource(source);
    }

    const ingestPromises = sources.map(source => ingestFromSource(source));
    const settled = await Promise.allSettled(ingestPromises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          source: 'unknown',
          success: false,
          apisIngested: 0,
          apisSkipped: 0,
          errors: [result.reason?.message || 'Promise rejected'],
          duration: 0,
        });
      }
    }

    setLastFullIngest(Date.now());
  } finally {
    isIngesting = false;
  }

  return results;
}

export async function quickIngest(): Promise<{ success: boolean; count: number; message: string }> {
  const builtinApis = getBuiltinPublicApis();
  let count = 0;

  for (const raw of builtinApis) {
    const entry = normalizeRawEntry(raw, 'builtin-curated');
    if (entry) {
      storeApi(entry);
      count++;
    }
  }

  setLastFullIngest(Date.now());

  return {
    success: true,
    count,
    message: `Ingested ${count} curated public APIs`,
  };
}

export async function ingestFromGitHub(): Promise<IngestResult> {
  const startTime = Date.now();
  const result: IngestResult = {
    source: 'github-public-apis',
    success: false,
    apisIngested: 0,
    apisSkipped: 0,
    errors: [],
    duration: 0,
  };

  try {
    const rawEntries = await fetchGitHubPublicApis();
    
    const normalized = rawEntries
      .map(entry => normalizeRawEntry(entry, 'github-public-apis'))
      .filter((e): e is ApiCatalogEntry => e !== null);

    const deduplicated = deduplicateEntries(normalized);
    const filtered = filterByQuality(deduplicated);

    for (const entry of filtered) {
      storeApi(entry);
      result.apisIngested++;
    }

    result.apisSkipped = rawEntries.length - result.apisIngested;
    result.success = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(message);
  }

  result.duration = Date.now() - startTime;
  lastIngestResult = result;
  return result;
}

export function getLastIngestResult(): IngestResult | null {
  return lastIngestResult;
}

export function isIngestionInProgress(): boolean {
  return isIngesting;
}

export function getIngestStats() {
  const stats = getStats();
  return {
    ...stats,
    isIngesting,
    lastResult: lastIngestResult,
  };
}
