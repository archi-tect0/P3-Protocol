import type { ApiCatalogEntry, ApiEndpointDef } from './types';
import { getAllApis, getApi, searchApis, getApisByCategory, getNoAuthApis } from './catalogStore';
import { manifestRegistry, type CanvasDisplay, type CanvasField, type ManifestEndpoint } from '../../core/registry';

export interface AutoRegisteredEndpoint {
  key: string;
  apiName: string;
  app: string;
  fn: string;
  description: string;
  scopes: string[];
  args: Record<string, { type: string; required: boolean; description?: string }>;
  baseUrl: string;
  path: string;
  method: string;
  auth: string;
  category: string;
  samplePhrases: string[];
  status: 'live' | 'stub';
}

function generateEndpointKey(apiName: string, endpointName: string): string {
  const normalizedApi = apiName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const normalizedEndpoint = endpointName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `public.${normalizedApi}.${normalizedEndpoint}`;
}

function generateSamplePhrases(api: ApiCatalogEntry, endpoint: ApiEndpointDef): string[] {
  const phrases: string[] = [];
  const name = api.name.toLowerCase();
  const category = api.category.toLowerCase();
  
  if (category === 'weather') {
    phrases.push(`what's the weather`, `check weather`, `get weather forecast`);
  } else if (category === 'entertainment' || category === 'jokes') {
    phrases.push(`tell me a joke`, `random joke`, `make me laugh`);
  } else if (category === 'cryptocurrency' || category === 'crypto') {
    phrases.push(`bitcoin price`, `crypto prices`, `check ${name}`);
  } else if (category === 'animals') {
    phrases.push(`show me a ${name.replace(/[^a-z]/g, '')}`, `random ${name}`);
  } else if (category === 'food & drink') {
    phrases.push(`random recipe`, `get a ${name.replace(/[^a-z]/g, '')} recipe`);
  } else if (category === 'games') {
    phrases.push(`play ${name}`, `${name} trivia`);
  } else if (category === 'science') {
    phrases.push(`${name} fact`, `science from ${name}`);
  } else if (category === 'calendar' || category === 'holidays') {
    phrases.push(`next holiday`, `public holidays`, `when is next holiday`);
  }
  
  phrases.push(`call ${name}`, `use ${name} api`, `${endpoint.name} from ${name}`);
  
  return phrases.slice(0, 5);
}

function apiToEndpoints(api: ApiCatalogEntry): AutoRegisteredEndpoint[] {
  return api.endpoints.map(ep => ({
    key: generateEndpointKey(api.name, ep.name),
    apiName: api.name,
    app: 'public.api',
    fn: ep.name,
    description: ep.description || `${api.name} ${ep.name}`,
    scopes: ['public'],
    args: ep.params ? Object.fromEntries(
      Object.entries(ep.params).map(([k, v]) => [k, {
        type: v.type,
        required: v.required ?? false,
        description: v.description,
      }])
    ) : {},
    baseUrl: api.baseUrl,
    path: ep.path,
    method: ep.method,
    auth: api.auth,
    category: api.category,
    samplePhrases: generateSamplePhrases(api, ep),
    status: 'live' as const,
  }));
}

export function getAllAutoEndpoints(): AutoRegisteredEndpoint[] {
  const apis = getAllApis();
  return apis.flatMap(apiToEndpoints);
}

export function getAutoEndpoint(key: string): AutoRegisteredEndpoint | null {
  const endpoints = getAllAutoEndpoints();
  return endpoints.find(e => e.key === key) || null;
}

export function searchAutoEndpoints(query: string): AutoRegisteredEndpoint[] {
  const q = query.toLowerCase();
  const endpoints = getAllAutoEndpoints();
  
  return endpoints.filter(e =>
    e.key.toLowerCase().includes(q) ||
    e.apiName.toLowerCase().includes(q) ||
    e.description.toLowerCase().includes(q) ||
    e.category.toLowerCase().includes(q) ||
    e.samplePhrases.some(p => p.toLowerCase().includes(q))
  );
}

export function getAutoEndpointsByCategory(category: string): AutoRegisteredEndpoint[] {
  const apis = getApisByCategory(category);
  return apis.flatMap(apiToEndpoints);
}

export function getNoAuthEndpoints(): AutoRegisteredEndpoint[] {
  const apis = getNoAuthApis();
  return apis.flatMap(apiToEndpoints);
}

export function describeAutoEndpoint(key: string): string | null {
  const endpoint = getAutoEndpoint(key);
  if (!endpoint) return null;
  
  return `
**${endpoint.apiName}** - ${endpoint.fn}
${endpoint.description}

- **Endpoint:** \`${endpoint.method} ${endpoint.baseUrl}${endpoint.path}\`
- **Auth:** ${endpoint.auth === 'none' ? 'No authentication required' : endpoint.auth}
- **Category:** ${endpoint.category}
- **Example phrases:** ${endpoint.samplePhrases.slice(0, 3).map(p => `"${p}"`).join(', ')}
`.trim();
}

export function getAutoEndpointStats() {
  const endpoints = getAllAutoEndpoints();
  const byCategory: Record<string, number> = {};
  const byAuth: Record<string, number> = {};
  
  for (const ep of endpoints) {
    byCategory[ep.category] = (byCategory[ep.category] || 0) + 1;
    byAuth[ep.auth] = (byAuth[ep.auth] || 0) + 1;
  }
  
  return {
    totalEndpoints: endpoints.length,
    totalApis: getAllApis().length,
    byCategory,
    byAuth,
    liveEndpoints: endpoints.filter(e => e.status === 'live').length,
  };
}

export function generateDevKitManifest(api: ApiCatalogEntry) {
  return {
    name: api.name,
    description: api.description,
    auth: api.auth,
    category: api.category,
    baseUrl: api.baseUrl,
    endpoints: api.endpoints.map(ep => ({
      key: generateEndpointKey(api.name, ep.name),
      path: ep.path,
      method: ep.method,
      description: ep.description,
    })),
    source: api.source,
    qualityScore: api.qualityScore,
  };
}

export function getAllDevKitManifests() {
  return getAllApis().map(generateDevKitManifest);
}

function generateCanvasDisplay(endpoint: AutoRegisteredEndpoint): CanvasDisplay {
  const category = endpoint.category.toLowerCase();
  
  const categoryFieldMap: Record<string, CanvasField[]> = {
    'weather': [
      { key: 'temperature', label: 'Temperature', format: 'number' },
      { key: 'humidity', label: 'Humidity', format: 'percentage' },
      { key: 'conditions', label: 'Conditions', format: 'text' },
      { key: 'windSpeed', label: 'Wind Speed', format: 'number' },
    ],
    'cryptocurrency': [
      { key: 'price', label: 'Price', format: 'currency' },
      { key: 'change24h', label: '24h Change', format: 'percentage' },
      { key: 'volume', label: 'Volume', format: 'currency' },
      { key: 'marketCap', label: 'Market Cap', format: 'currency' },
    ],
    'finance': [
      { key: 'value', label: 'Value', format: 'currency' },
      { key: 'change', label: 'Change', format: 'percentage' },
      { key: 'volume', label: 'Volume', format: 'number' },
    ],
    'entertainment': [
      { key: 'setup', label: 'Setup', format: 'text' },
      { key: 'delivery', label: 'Punchline', format: 'text' },
      { key: 'category', label: 'Category', format: 'text' },
    ],
    'animals': [
      { key: 'message', label: 'Image URL', format: 'text' },
      { key: 'breed', label: 'Breed', format: 'text' },
    ],
    'science': [
      { key: 'text', label: 'Fact', format: 'text' },
      { key: 'number', label: 'Number', format: 'number' },
      { key: 'type', label: 'Type', format: 'text' },
    ],
    'calendar': [
      { key: 'name', label: 'Holiday', format: 'text' },
      { key: 'date', label: 'Date', format: 'date' },
      { key: 'countryCode', label: 'Country', format: 'text' },
    ],
    'food & drink': [
      { key: 'strMeal', label: 'Meal', format: 'text' },
      { key: 'strCategory', label: 'Category', format: 'text' },
      { key: 'strArea', label: 'Cuisine', format: 'text' },
    ],
    'games': [
      { key: 'question', label: 'Question', format: 'text' },
      { key: 'answer', label: 'Answer', format: 'text' },
      { key: 'difficulty', label: 'Difficulty', format: 'text' },
    ],
    'geocoding': [
      { key: 'lat', label: 'Latitude', format: 'number' },
      { key: 'lon', label: 'Longitude', format: 'number' },
      { key: 'display_name', label: 'Location', format: 'text' },
    ],
    'books': [
      { key: 'title', label: 'Title', format: 'text' },
      { key: 'author', label: 'Author', format: 'text' },
      { key: 'year', label: 'Year', format: 'number' },
    ],
    'news': [
      { key: 'title', label: 'Headline', format: 'text' },
      { key: 'source', label: 'Source', format: 'text' },
      { key: 'publishedAt', label: 'Published', format: 'date' },
    ],
    'open data': [
      { key: 'name', label: 'Name', format: 'text' },
      { key: 'value', label: 'Value', format: 'text' },
      { key: 'description', label: 'Description', format: 'text' },
    ],
    'art & design': [
      { key: 'title', label: 'Title', format: 'text' },
      { key: 'artist', label: 'Artist', format: 'text' },
      { key: 'imageUrl', label: 'Image', format: 'text' },
    ],
    'security': [
      { key: 'status', label: 'Status', format: 'text' },
      { key: 'risk', label: 'Risk Level', format: 'text' },
      { key: 'details', label: 'Details', format: 'text' },
    ],
    'environment': [
      { key: 'aqi', label: 'Air Quality Index', format: 'number' },
      { key: 'pm25', label: 'PM2.5', format: 'number' },
      { key: 'location', label: 'Location', format: 'text' },
    ],
    'web3': [
      { key: 'balance', label: 'Balance', format: 'number' },
      { key: 'symbol', label: 'Token', format: 'text' },
      { key: 'usdValue', label: 'USD Value', format: 'currency' },
    ],
    'development': [
      { key: 'url', label: 'URL', format: 'text' },
      { key: 'status', label: 'Status', format: 'text' },
      { key: 'response', label: 'Response', format: 'text' },
    ],
  };

  const tableCategories = ['cryptocurrency', 'news', 'books', 'calendar', 'open data'];
  const isTable = tableCategories.includes(category);
  
  const fields = categoryFieldMap[category] || [
    { key: 'data', label: 'Result', format: 'text' as const },
  ];

  return {
    type: isTable ? 'table' : 'card',
    title: endpoint.apiName,
    subtitle: endpoint.description,
    fields,
    actions: [{ label: 'Refresh' }],
  };
}

function autoEndpointToManifest(endpoint: AutoRegisteredEndpoint): ManifestEndpoint {
  const fullUrl = `${endpoint.baseUrl}${endpoint.path}`;
  
  return {
    'devkit.key': endpoint.key,
    name: endpoint.apiName,
    method: endpoint.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: fullUrl,
    params: Object.entries(endpoint.args).reduce((acc, [key, paramInfo]) => {
      acc[key] = { 
        type: paramInfo.type, 
        required: paramInfo.required,
        description: paramInfo.description,
      };
      return acc;
    }, {} as Record<string, { type: string; required: boolean; description?: string }>),
    'security.visibility': 'public',
    'canvas.display': generateCanvasDisplay(endpoint),
    'telemetry.tags': [endpoint.category, endpoint.apiName, 'public-api'],
    'semantics.phrases': endpoint.samplePhrases,
    source: 'atlas',
  };
}

export async function syncAllToCanvasRegistry(): Promise<{ synced: number; errors: string[] }> {
  const endpoints = getAllAutoEndpoints();
  const errors: string[] = [];
  let synced = 0;

  for (const ep of endpoints) {
    try {
      const manifest = autoEndpointToManifest(ep);
      const result = await manifestRegistry.registerEndpoint(manifest);
      if (result.valid) {
        synced++;
      } else {
        errors.push(`${ep.key}: ${result.errors.map(e => e.message).join(', ')}`);
      }
    } catch (e) {
      errors.push(`${ep.key}: ${(e as Error).message}`);
    }
  }

  console.log(`[RegistrySynchronizer] Synced ${synced}/${endpoints.length} endpoints to Canvas Registry`);
  return { synced, errors };
}

export function getSyncStatus(): { total: number; registered: number; pending: number } {
  const allEndpoints = getAllAutoEndpoints();
  const registeredKeys = new Set(manifestRegistry.listEndpoints().map(e => e['devkit.key']));
  
  const registered = allEndpoints.filter(e => registeredKeys.has(e.key)).length;
  
  return {
    total: allEndpoints.length,
    registered,
    pending: allEndpoints.length - registered,
  };
}
