export interface ApiCatalogEntry {
  name: string;
  description: string;
  auth: 'none' | 'apiKey' | 'oauth' | 'custom';
  https: boolean;
  cors: boolean | 'unknown';
  category: string;
  baseUrl: string;
  link?: string;
  endpoints: ApiEndpointDef[];
  source: string;
  qualityScore: number;
  lastChecked: number;
  healthStatus: 'healthy' | 'degraded' | 'offline' | 'unknown';
}

export interface ApiEndpointDef {
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  params?: Record<string, { type: string; required?: boolean; description?: string }>;
  sampleResponse?: any;
}

export interface ApiSource {
  id: string;
  name: string;
  url: string;
  format: 'json' | 'markdown' | 'html';
  parser: (data: string) => Promise<RawApiEntry[]>;
  fetchInterval: number;
  lastFetch: number;
  status: 'active' | 'error' | 'disabled';
  errorMessage?: string;
}

export interface RawApiEntry {
  API: string;
  Description: string;
  Auth: string;
  HTTPS: boolean;
  Cors: string;
  Category: string;
  Link: string;
}

export interface AutoFlow {
  id: string;
  name: string;
  description: string;
  steps: AutoFlowStep[];
  categories: string[];
  createdAt: number;
  source: 'auto' | 'manual';
}

export interface AutoFlowStep {
  id: string;
  endpointKey: string;
  description: string;
  optional?: boolean;
  params?: Record<string, any>;
}

export interface IngestResult {
  source: string;
  success: boolean;
  apisIngested: number;
  apisSkipped: number;
  errors: string[];
  duration: number;
}

export interface CatalogStats {
  totalApis: number;
  totalEndpoints: number;
  byCategory: Record<string, number>;
  byAuth: Record<string, number>;
  bySource: Record<string, number>;
  healthyApis: number;
  lastFullIngest: number;
  autoFlowsGenerated: number;
}

export interface HealthCheckResult {
  apiName: string;
  baseUrl: string;
  status: 'healthy' | 'degraded' | 'offline';
  responseTime: number;
  statusCode?: number;
  error?: string;
  checkedAt: number;
}

export const QUALITY_THRESHOLDS = {
  MIN_SCORE: 0.4,
  HTTPS_REQUIRED: true,
  AUTH_NONE_PREFERRED: true,
  CORS_REQUIRED: false,
} as const;

export const CATEGORIES = {
  WEATHER: 'Weather',
  JOKES: 'Entertainment',
  CRYPTO: 'Cryptocurrency',
  FINANCE: 'Finance',
  TRANSPORT: 'Transportation',
  HOLIDAYS: 'Calendar',
  ANIMALS: 'Animals',
  NEWS: 'News',
  MUSIC: 'Music',
  SCIENCE: 'Science',
  FOOD: 'Food & Drink',
  SPORTS: 'Sports',
  GOVERNMENT: 'Government',
  GAMES: 'Games',
  GEOCODING: 'Geocoding',
  OPEN_DATA: 'Open Data',
  HEALTH: 'Health',
  BOOKS: 'Books',
  ART: 'Art & Design',
  MACHINE_LEARNING: 'Machine Learning',
  OTHER: 'Other',
} as const;

export type CategoryType = typeof CATEGORIES[keyof typeof CATEGORIES];
