import * as crypto from 'crypto';
import { db } from '../../db';
import { newsArticles, newsSources } from '@shared/schema';
import { eq, desc, ilike, or, and } from 'drizzle-orm';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  topic?: string;
}

interface CacheEntry {
  data: NewsArticle[];
  expiresAt: number;
}

interface GuardianArticle {
  id: string;
  webTitle: string;
  webUrl: string;
  webPublicationDate: string;
  fields?: {
    headline?: string;
    trailText?: string;
    thumbnail?: string;
  };
}

interface GuardianResponse {
  response: {
    status: string;
    results: GuardianArticle[];
  };
}

interface GNewsArticle {
  title: string;
  description: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

interface GNewsResponse {
  articles: GNewsArticle[];
}

interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

interface NewsAPIResponse {
  status: string;
  articles: NewsAPIArticle[];
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 1000;

let lastFetchTimestamp = 0;
let pollingInterval: ReturnType<typeof setInterval> | null = null;

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_RESET_MS = 5 * 60 * 1000;

function getCircuitBreaker(source: string): CircuitBreakerState {
  if (!circuitBreakers.has(source)) {
    circuitBreakers.set(source, { failures: 0, lastFailure: 0, isOpen: false });
  }
  return circuitBreakers.get(source)!;
}

function recordFailure(source: string): void {
  const breaker = getCircuitBreaker(source);
  breaker.failures++;
  breaker.lastFailure = Date.now();
  if (breaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    breaker.isOpen = true;
    console.warn(`Circuit breaker opened for ${source} after ${breaker.failures} failures`);
  }
}

function recordSuccess(source: string): void {
  const breaker = getCircuitBreaker(source);
  breaker.failures = 0;
  breaker.isOpen = false;
}

function isCircuitOpen(source: string): boolean {
  const breaker = getCircuitBreaker(source);
  if (!breaker.isOpen) return false;
  
  if (Date.now() - breaker.lastFailure > CIRCUIT_BREAKER_RESET_MS) {
    breaker.isOpen = false;
    breaker.failures = 0;
    console.info(`Circuit breaker reset for ${source}`);
    return false;
  }
  return true;
}

function getCached(key: string): NewsArticle[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NewsArticle[]): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function generateId(title: string, source: string): string {
  return crypto.createHash('sha256').update(`${title}|${source}`).digest('hex').slice(0, 16);
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const unique: NewsArticle[] = [];
  
  for (const article of articles) {
    const normalized = normalizeTitle(article.title);
    if (!seen.has(normalized) && article.title.trim().length > 0) {
      seen.add(normalized);
      unique.push(article);
    }
  }
  
  return unique;
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

async function fetchFromGuardian(topic: string, pageSize: number = 30): Promise<NewsArticle[]> {
  const SOURCE_NAME = 'guardian';
  
  const apiKey = process.env.GUARDIAN_API_KEY || process.env.GUARDIAN_KEY;
  if (!apiKey) {
    return [];
  }
  
  if (isCircuitOpen(SOURCE_NAME)) {
    console.debug('Guardian circuit breaker is open, skipping request');
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      'api-key': apiKey,
      'q': topic,
      'show-fields': 'headline,trailText,thumbnail',
      'page-size': String(pageSize),
      'order-by': 'newest'
    });
    
    const url = `https://content.guardianapis.com/search?${params.toString()}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.warn(`Guardian API returned ${response.status}`);
      recordFailure(SOURCE_NAME);
      return [];
    }
    
    const data: GuardianResponse = await response.json();
    
    if (data.response?.status !== 'ok' || !data.response?.results) {
      recordFailure(SOURCE_NAME);
      return [];
    }
    
    recordSuccess(SOURCE_NAME);
    
    return data.response.results.map((article): NewsArticle => ({
      id: generateId(article.webTitle, 'The Guardian'),
      title: article.fields?.headline || article.webTitle,
      description: article.fields?.trailText || '',
      source: 'The Guardian',
      url: article.webUrl,
      imageUrl: article.fields?.thumbnail,
      publishedAt: article.webPublicationDate,
      topic
    }));
  } catch (error) {
    console.warn('Guardian API error:', error instanceof Error ? error.message : error);
    recordFailure(SOURCE_NAME);
    return [];
  }
}

async function fetchFromGNews(topic: string, maxResults: number = 20): Promise<NewsArticle[]> {
  const SOURCE_NAME = 'gnews';
  
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    return [];
  }
  
  if (isCircuitOpen(SOURCE_NAME)) {
    console.debug('GNews circuit breaker is open, skipping request');
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      'token': apiKey,
      'q': topic,
      'lang': 'en',
      'max': String(maxResults)
    });
    
    const url = `https://gnews.io/api/v4/search?${params.toString()}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.warn(`GNews API returned ${response.status}`);
      recordFailure(SOURCE_NAME);
      return [];
    }
    
    const data: GNewsResponse = await response.json();
    
    if (!data.articles) {
      recordFailure(SOURCE_NAME);
      return [];
    }
    
    recordSuccess(SOURCE_NAME);
    
    return data.articles.map((article): NewsArticle => ({
      id: generateId(article.title, article.source?.name || 'GNews'),
      title: article.title,
      description: article.description || '',
      source: article.source?.name || 'GNews',
      url: article.url,
      imageUrl: article.image,
      publishedAt: article.publishedAt,
      topic
    }));
  } catch (error) {
    console.warn('GNews API error:', error instanceof Error ? error.message : error);
    recordFailure(SOURCE_NAME);
    return [];
  }
}

async function fetchFromNewsAPI(topic: string, pageSize: number = 20): Promise<NewsArticle[]> {
  const SOURCE_NAME = 'newsapi';
  
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return [];
  }
  
  if (isCircuitOpen(SOURCE_NAME)) {
    console.debug('NewsAPI circuit breaker is open, skipping request');
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      'apiKey': apiKey,
      'q': topic,
      'sortBy': 'publishedAt',
      'pageSize': String(pageSize),
      'language': 'en'
    });
    
    const url = `https://newsapi.org/v2/everything?${params.toString()}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      console.warn(`NewsAPI returned ${response.status}`);
      recordFailure(SOURCE_NAME);
      return [];
    }
    
    const data: NewsAPIResponse = await response.json();
    
    if (data.status !== 'ok' || !data.articles) {
      recordFailure(SOURCE_NAME);
      return [];
    }
    
    recordSuccess(SOURCE_NAME);
    
    return data.articles
      .filter(article => article.title && article.title !== '[Removed]')
      .map((article): NewsArticle => ({
        id: generateId(article.title, article.source?.name || 'NewsAPI'),
        title: article.title,
        description: article.description || '',
        source: article.source?.name || 'NewsAPI',
        url: article.url,
        imageUrl: article.urlToImage,
        publishedAt: article.publishedAt,
        topic
      }));
  } catch (error) {
    console.warn('NewsAPI error:', error instanceof Error ? error.message : error);
    recordFailure(SOURCE_NAME);
    return [];
  }
}

async function fetchFromRSSDatabase(topic?: string, limit: number = 50): Promise<NewsArticle[]> {
  try {
    const query = db.select({
      id: newsArticles.id,
      title: newsArticles.title,
      description: newsArticles.description,
      url: newsArticles.url,
      imageUrl: newsArticles.imageUrl,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
      sourceName: newsSources.name,
    })
      .from(newsArticles)
      .innerJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .where(eq(newsSources.enabled, true))
      .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
      .limit(limit);

    let results;
    if (topic && topic.trim()) {
      const searchTerm = `%${topic.trim()}%`;
      results = await db.select({
        id: newsArticles.id,
        title: newsArticles.title,
        description: newsArticles.description,
        url: newsArticles.url,
        imageUrl: newsArticles.imageUrl,
        publishedAt: newsArticles.publishedAt,
        createdAt: newsArticles.createdAt,
        sourceName: newsSources.name,
      })
        .from(newsArticles)
        .innerJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
        .where(and(
          eq(newsSources.enabled, true),
          or(
            ilike(newsArticles.title, searchTerm),
            ilike(newsArticles.description, searchTerm)
          )
        ))
        .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
        .limit(limit);
    } else {
      results = await query;
    }

    return results.map((row): NewsArticle => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      source: row.sourceName,
      url: row.url,
      imageUrl: row.imageUrl || undefined,
      publishedAt: row.publishedAt?.toISOString() || row.createdAt?.toISOString() || new Date().toISOString(),
      topic: topic || undefined
    }));
  } catch (error) {
    console.warn('RSS database fetch error:', error instanceof Error ? error.message : error);
    return [];
  }
}

async function fetchFromAllSources(topic: string): Promise<NewsArticle[]> {
  const results = await Promise.allSettled([
    fetchFromRSSDatabase(topic, 50),
    fetchFromGuardian(topic, 30),
    fetchFromGNews(topic, 20),
    fetchFromNewsAPI(topic, 20)
  ]);
  
  const allArticles: NewsArticle[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allArticles.push(...result.value);
    }
  }
  
  const deduplicated = deduplicateArticles(allArticles);
  
  deduplicated.sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  
  lastFetchTimestamp = Date.now();
  
  return deduplicated;
}

async function fetchTopStoriesFromAllSources(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled([
    fetchFromRSSDatabase(undefined, 60),
    fetchFromGuardian('news', 30),
    fetchFromGNews('breaking news', 20),
    fetchFromNewsAPI('world', 20)
  ]);
  
  const allArticles: NewsArticle[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allArticles.push(...result.value);
    }
  }
  
  const deduplicated = deduplicateArticles(allArticles);
  
  deduplicated.sort((a, b) => 
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  
  lastFetchTimestamp = Date.now();
  
  return deduplicated;
}

export async function searchNews(topic: string): Promise<NewsArticle[]> {
  const cacheKey = `search:${topic.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const normalizedTopic = topic.toLowerCase().trim();
    
    const results = await fetchFromAllSources(normalizedTopic);
    
    if (results.length > 0) {
      setCache(cacheKey, results);
      return results;
    }
    
    const fallback: NewsArticle[] = [{
      id: generateId(`${topic} News Update`, 'Atlas News'),
      title: `Latest ${topic.charAt(0).toUpperCase() + topic.slice(1)} News`,
      description: `Stay updated with the latest developments and breaking news about ${topic}. Check back for more updates.`,
      source: 'Atlas News',
      url: `https://news.google.com/search?q=${encodeURIComponent(topic)}`,
      publishedAt: new Date().toISOString(),
      topic: normalizedTopic
    }];
    
    return fallback;
  } catch (error) {
    console.error('News search error:', error);
    return [];
  }
}

export async function getTopStories(): Promise<NewsArticle[]> {
  const cacheKey = 'top_stories';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const results = await fetchTopStoriesFromAllSources();
    
    if (results.length > 0) {
      setCache(cacheKey, results);
      return results;
    }
    
    return [{
      id: generateId('Top Stories', 'Atlas News'),
      title: 'Top Stories',
      description: 'Check back for the latest top stories from around the world.',
      source: 'Atlas News',
      url: 'https://news.google.com',
      publishedAt: new Date().toISOString()
    }];
  } catch (error) {
    console.error('Top stories error:', error);
    return [];
  }
}

export function clearNewsCache(): void {
  cache.clear();
}

export function getLastFetchTimestamp(): number {
  return lastFetchTimestamp;
}

export function startPolling(
  callback: (articles: NewsArticle[]) => void,
  intervalMs: number = 120000
): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  const poll = async () => {
    try {
      clearNewsCache();
      const articles = await getTopStories();
      callback(articles);
    } catch (error) {
      console.error('Polling error:', error);
    }
  };
  
  poll();
  pollingInterval = setInterval(poll, intervalMs);
}

export function stopPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
