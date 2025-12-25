import type { ApiCatalogEntry, AutoFlow, CatalogStats, ApiSource } from './types';

const apiCatalog = new Map<string, ApiCatalogEntry>();
const autoFlows = new Map<string, AutoFlow>();
const sources = new Map<string, ApiSource>();
let lastFullIngest = 0;

function normalizeApiId(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function storeApi(entry: ApiCatalogEntry): string {
  const id = normalizeApiId(entry.name);
  const existing = apiCatalog.get(id);
  
  if (!existing || entry.lastChecked > existing.lastChecked) {
    apiCatalog.set(id, { ...entry });
  }
  
  return id;
}

export function getApi(id: string): ApiCatalogEntry | null {
  return apiCatalog.get(id) || null;
}

export function getAllApis(): ApiCatalogEntry[] {
  return Array.from(apiCatalog.values());
}

export function getApisByCategory(category: string): ApiCatalogEntry[] {
  return getAllApis().filter(a => 
    a.category.toLowerCase() === category.toLowerCase()
  );
}

export function getApisBySource(source: string): ApiCatalogEntry[] {
  return getAllApis().filter(a => a.source === source);
}

export function getHealthyApis(): ApiCatalogEntry[] {
  return getAllApis().filter(a => a.healthStatus === 'healthy');
}

export function getNoAuthApis(): ApiCatalogEntry[] {
  return getAllApis().filter(a => a.auth === 'none');
}

export function searchApis(query: string): ApiCatalogEntry[] {
  const q = query.toLowerCase();
  return getAllApis().filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    a.category.toLowerCase().includes(q)
  );
}

export function removeApi(id: string): boolean {
  return apiCatalog.delete(id);
}

export function clearCatalog(): void {
  apiCatalog.clear();
}

export function storeFlow(flow: AutoFlow): void {
  autoFlows.set(flow.id, { ...flow });
}

export function getFlow(id: string): AutoFlow | null {
  return autoFlows.get(id) || null;
}

export function getAllFlows(): AutoFlow[] {
  return Array.from(autoFlows.values());
}

export function getFlowsByCategory(category: string): AutoFlow[] {
  return getAllFlows().filter(f => 
    f.categories.some(c => c.toLowerCase() === category.toLowerCase())
  );
}

export function clearFlows(): void {
  autoFlows.clear();
}

export function storeSource(source: ApiSource): void {
  sources.set(source.id, { ...source });
}

export function getSource(id: string): ApiSource | null {
  return sources.get(id) || null;
}

export function getAllSources(): ApiSource[] {
  return Array.from(sources.values());
}

export function updateSourceStatus(id: string, status: ApiSource['status'], error?: string): void {
  const source = sources.get(id);
  if (source) {
    source.status = status;
    source.errorMessage = error;
    source.lastFetch = Date.now();
  }
}

export function setLastFullIngest(timestamp: number): void {
  lastFullIngest = timestamp;
}

export function getStats(): CatalogStats {
  const apis = getAllApis();
  const byCategory: Record<string, number> = {};
  const byAuth: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let totalEndpoints = 0;
  let healthyCount = 0;

  for (const api of apis) {
    byCategory[api.category] = (byCategory[api.category] || 0) + 1;
    byAuth[api.auth] = (byAuth[api.auth] || 0) + 1;
    bySource[api.source] = (bySource[api.source] || 0) + 1;
    totalEndpoints += api.endpoints.length;
    if (api.healthStatus === 'healthy') healthyCount++;
  }

  return {
    totalApis: apis.length,
    totalEndpoints,
    byCategory,
    byAuth,
    bySource,
    healthyApis: healthyCount,
    lastFullIngest,
    autoFlowsGenerated: autoFlows.size,
  };
}

export function exportCatalog(): { apis: ApiCatalogEntry[]; flows: AutoFlow[]; stats: CatalogStats } {
  return {
    apis: getAllApis(),
    flows: getAllFlows(),
    stats: getStats(),
  };
}
