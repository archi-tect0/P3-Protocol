import crypto from 'crypto';

export interface WikiEntry {
  id: string;
  title: string;
  extract: string;
  url: string;
  imageUrl?: string;
  lastModified?: string;
}

interface CacheEntry {
  data: WikiEntry[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCached(key: string): WikiEntry[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: WikiEntry[]): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function generateId(title: string): string {
  return crypto.createHash('sha256').update(title).digest('hex').slice(0, 16);
}

interface WikipediaSearchResult {
  query?: {
    search?: Array<{
      pageid: number;
      title: string;
      snippet: string;
    }>;
    pages?: Record<string, {
      pageid: number;
      title: string;
      extract?: string;
      thumbnail?: {
        source: string;
      };
      touched?: string;
    }>;
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

export async function searchWikipedia(term: string): Promise<WikiEntry[]> {
  const cacheKey = `wiki:${term.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=5&format=json&origin=*`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: { 'User-Agent': 'AtlasProtocol/1.0' }
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Wikipedia API error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json() as WikipediaSearchResult;
    const searchResults = searchData.query?.search || [];

    if (searchResults.length === 0) {
      return [];
    }

    const pageIds = searchResults.map(r => r.pageid).join('|');
    const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=extracts|pageimages|info&exintro=true&explaintext=true&piprop=thumbnail&pithumbsize=400&format=json&origin=*`;
    
    const detailResponse = await fetch(detailUrl, {
      headers: { 'User-Agent': 'AtlasProtocol/1.0' }
    });

    if (!detailResponse.ok) {
      const fallbackResults: WikiEntry[] = searchResults.map(r => ({
        id: generateId(r.title),
        title: r.title,
        extract: stripHtml(r.snippet),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`
      }));
      setCache(cacheKey, fallbackResults);
      return fallbackResults;
    }

    const detailData = await detailResponse.json() as WikipediaSearchResult;
    const pages = detailData.query?.pages || {};

    const results: WikiEntry[] = searchResults.map(r => {
      const page = pages[r.pageid.toString()];
      return {
        id: generateId(r.title),
        title: r.title,
        extract: page?.extract || stripHtml(r.snippet),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
        imageUrl: page?.thumbnail?.source,
        lastModified: page?.touched
      };
    });

    setCache(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Wikipedia search error:', error);
    return [];
  }
}

export async function getWikipediaArticle(title: string): Promise<WikiEntry | null> {
  const cacheKey = `wiki-article:${title.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached && cached.length > 0) return cached[0];

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts|pageimages|info&exintro=true&explaintext=true&piprop=thumbnail&pithumbsize=800&format=json&origin=*`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AtlasProtocol/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json() as WikipediaSearchResult;
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];

    if (!page || page.pageid === -1) {
      return null;
    }

    const result: WikiEntry = {
      id: generateId(page.title),
      title: page.title,
      extract: page.extract || 'No summary available.',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      imageUrl: page.thumbnail?.source,
      lastModified: page.touched
    };

    setCache(cacheKey, [result]);
    return result;
  } catch (error) {
    console.error('Wikipedia article error:', error);
    return null;
  }
}

export function clearWikipediaCache(): void {
  cache.clear();
}
