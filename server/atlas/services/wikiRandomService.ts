export interface WikiFeedEntry {
  id: string;
  title: string;
  extract: string;
  url: string;
  imageUrl?: string;
}

export interface WikiRandomResponse {
  ok: boolean;
  entries: WikiFeedEntry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextPage: number | null;
}

interface WikiRandomArticle {
  id: number;
  ns: number;
  title: string;
}

interface WikiRandomApiResponse {
  query?: {
    random?: WikiRandomArticle[];
  };
}

interface WikiSummaryResponse {
  pageid?: number;
  title?: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  thumbnail?: {
    source?: string;
  };
  originalimage?: {
    source?: string;
  };
}

const recentlyReturnedIds = new Set<string>();
const MAX_RECENT_IDS = 500;

function trackRecentId(id: string): void {
  recentlyReturnedIds.add(id);
  if (recentlyReturnedIds.size > MAX_RECENT_IDS) {
    const firstId = recentlyReturnedIds.values().next().value;
    if (firstId) {
      recentlyReturnedIds.delete(firstId);
    }
  }
}

function isRecentlyReturned(id: string): boolean {
  return recentlyReturnedIds.has(id);
}

async function fetchWithTimeout(url: string, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchRandomArticleIds(count: number): Promise<WikiRandomArticle[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=${count}&format=json`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.warn(`Wikipedia random API returned ${response.status}`);
      return [];
    }
    
    const data = await response.json() as WikiRandomApiResponse;
    return data.query?.random || [];
  } catch (error) {
    console.warn('Wikipedia random API error:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function fetchArticleSummary(title: string): Promise<WikiFeedEntry | null> {
  try {
    const encodedTitle = encodeURIComponent(title);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.warn(`Wikipedia summary API returned ${response.status} for "${title}"`);
      return null;
    }
    
    const data = await response.json() as WikiSummaryResponse;
    
    if (!data.pageid || !data.title || !data.extract) {
      return null;
    }
    
    const id = String(data.pageid);
    
    if (isRecentlyReturned(id)) {
      return null;
    }
    
    return {
      id,
      title: data.title,
      extract: data.extract,
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodedTitle}`,
      imageUrl: data.thumbnail?.source || data.originalimage?.source
    };
  } catch (error) {
    console.warn(`Wikipedia summary fetch error for "${title}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getRandomWikiArticles(page: number, pageSize: number): Promise<WikiRandomResponse> {
  try {
    const fetchCount = Math.min(pageSize * 2, 20);
    const randomArticles = await fetchRandomArticleIds(fetchCount);
    
    if (randomArticles.length === 0) {
      return {
        ok: false,
        entries: [],
        page,
        pageSize,
        hasMore: true,
        nextPage: page + 1
      };
    }
    
    const summaryPromises = randomArticles.map(article => fetchArticleSummary(article.title));
    const results = await Promise.allSettled(summaryPromises);
    
    const entries: WikiFeedEntry[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        entries.push(result.value);
        trackRecentId(result.value.id);
        
        if (entries.length >= pageSize) {
          break;
        }
      }
    }
    
    return {
      ok: true,
      entries,
      page,
      pageSize,
      hasMore: true,
      nextPage: page + 1
    };
  } catch (error) {
    console.error('getRandomWikiArticles error:', error);
    return {
      ok: false,
      entries: [],
      page,
      pageSize,
      hasMore: true,
      nextPage: page + 1
    };
  }
}

export function clearRecentIds(): void {
  recentlyReturnedIds.clear();
}
