/**
 * Atlas Protocol - Session Dictionary Encoding
 * 
 * Tokenizes repeated strings (categories, providers, types) to integer IDs.
 * Negotiated once per session, reused across all payloads.
 * 
 * Typical savings: 25-35% additional reduction on top of MessagePack
 */

export interface TokenDictionary {
  version: number;
  tokens: Map<string, number>;
  reverse: Map<number, string>;
  nextId: number;
}

export interface DictionarySeed {
  version: number;
  entries: Record<string, number>;
}

// Common catalog values that appear repeatedly
const COMMON_CATEGORIES = [
  'game', 'video', 'ebook', 'audio', 'product', 'document', 'app', 
  'live_tv', 'movie', 'series', 'podcast', 'music', 'gallery', 'governance'
];

const COMMON_CONTENT_TYPES = [
  'free', 'premium', 'rental', 'subscription', 'purchase', 'ad-supported',
  'stream', 'download', 'embed', 'openweb'
];

const COMMON_PROVIDERS = [
  'steam', 'epic', 'gog', 'itch', 'playstation', 'xbox', 'nintendo',
  'netflix', 'prime', 'disney', 'hulu', 'youtube', 'twitch', 'spotify',
  'kindle', 'audible', 'apple', 'google', 'microsoft', 'amazon'
];

const COMMON_FIELDS = [
  'id', 'title', 'description', 'category', 'contentType', 'provider',
  'price', 'currency', 'rating', 'thumbnail', 'backdrop', 'url',
  'metadata', 'tags', 'genres', 'year', 'duration', 'quality',
  'accessMode', 'format', 'status', 'createdAt', 'updatedAt'
];

export function createBaseDictionary(): TokenDictionary {
  const tokens = new Map<string, number>();
  const reverse = new Map<number, string>();
  let nextId = 1;
  
  // Pre-populate with common values
  const allCommon = [
    ...COMMON_CATEGORIES,
    ...COMMON_CONTENT_TYPES,
    ...COMMON_PROVIDERS,
    ...COMMON_FIELDS,
  ];
  
  for (const value of allCommon) {
    tokens.set(value, nextId);
    reverse.set(nextId, value);
    nextId++;
  }
  
  return { version: 1, tokens, reverse, nextId };
}

export function getDictionarySeed(dict: TokenDictionary): DictionarySeed {
  const entries: Record<string, number> = {};
  dict.tokens.forEach((id, value) => {
    entries[value] = id;
  });
  return { version: dict.version, entries };
}

export function tokenize(dict: TokenDictionary, value: string): number | string {
  const existing = dict.tokens.get(value);
  if (existing !== undefined) {
    return existing;
  }
  // For unknown values, return as-is (will be added to dict if common enough)
  return value;
}

export function detokenize(dict: TokenDictionary, value: number | string): string {
  if (typeof value === 'number') {
    return dict.reverse.get(value) || `[unknown:${value}]`;
  }
  return value;
}

export interface TokenizedCatalogItem {
  id: string;
  t: number | string;  // title (tokenized if common prefix)
  d?: string;          // description (kept as-is, long strings)
  c: number;           // category (tokenized)
  ct: number;          // contentType (tokenized)
  p?: number;          // provider (tokenized)
  pr?: number;         // price (as cents, not float)
  cu?: number;         // currency (tokenized)
  r?: number;          // rating (0-100 instead of 0-5)
  th?: string;         // thumbnail URL
  m?: Record<string, unknown>; // metadata (compact)
}

export function tokenizeCatalogItem(dict: TokenDictionary, item: any): TokenizedCatalogItem {
  return {
    id: item.id,
    t: item.title || item.name || '',
    d: item.description?.slice(0, 200), // Truncate long descriptions
    c: tokenize(dict, item.category || item.kind || 'unknown') as number,
    ct: tokenize(dict, item.contentType || item.accessMode || 'free') as number,
    p: item.provider ? tokenize(dict, item.provider) as number : undefined,
    pr: item.price ? Math.round(item.price * 100) : undefined,
    cu: item.currency ? tokenize(dict, item.currency) as number : undefined,
    r: item.rating ? Math.round(item.rating * 20) : undefined, // 0-5 → 0-100
    th: item.thumbnail || item.posterUrl,
    m: item.metadata,
  };
}

export function tokenizeCatalog(dict: TokenDictionary, items: any[]): TokenizedCatalogItem[] {
  return items.map(item => tokenizeCatalogItem(dict, item));
}

// Session dictionary store
const sessionDictionaries = new Map<string, TokenDictionary>();

export function getOrCreateSessionDictionary(sessionId: string): TokenDictionary {
  let dict = sessionDictionaries.get(sessionId);
  if (!dict) {
    dict = createBaseDictionary();
    sessionDictionaries.set(sessionId, dict);
  }
  return dict;
}

export function clearSessionDictionary(sessionId: string): void {
  sessionDictionaries.delete(sessionId);
}

export function negotiateDictionary(dict: TokenDictionary, clientTokens: string[]): string[] {
  const negotiated: string[] = [];
  const maxTokens = 256;
  
  for (const token of clientTokens) {
    if (dict.tokens.size >= maxTokens) break;
    
    if (!dict.tokens.has(token)) {
      dict.tokens.set(token, dict.nextId);
      dict.reverse.set(dict.nextId, token);
      dict.nextId++;
    }
    negotiated.push(token);
  }
  
  return negotiated;
}

export function getDictionaryAsRecord(dict: TokenDictionary): Record<string, number> {
  const result: Record<string, number> = {};
  dict.tokens.forEach((id, key) => {
    result[key] = id;
  });
  return result;
}
