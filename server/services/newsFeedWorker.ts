import { db } from '../db';
import { newsSources, newsArticles, type NewsSource, type InsertNewsArticle } from '@shared/schema';
import { eq, and, lte, or, isNull, asc, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { rootLogger } from '../observability/logger';
import { sendNewsNotification } from './pushNotifications';

const logger = rootLogger.child({ module: 'newsFeedWorker' });

const BASE_POLL_INTERVAL_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const MAX_ERROR_COUNT = 10;

interface FeedItem {
  title: string;
  description?: string;
  link: string;
  imageUrl?: string;
  pubDate?: Date;
}

interface ParsedFeed {
  items: FeedItem[];
  etag?: string;
  lastModified?: string;
}

function computeContentHash(title: string, url: string): string {
  return createHash('sha256')
    .update(`${title}|${url}`)
    .digest('hex')
    .substring(0, 32);
}

function calculateBackoff(errorCount: number): number {
  const backoff = BASE_POLL_INTERVAL_MS * Math.pow(2, Math.min(errorCount, 6));
  return Math.min(backoff, MAX_BACKOFF_MS);
}

function extractImageFromContent(content: string): string | null {
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  const mediaMatch = content.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];
  return null;
}

async function parseRSSFeed(xml: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    const link = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim() || '';
    const description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim();
    const pubDateStr = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    
    let imageUrl = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1];
    if (!imageUrl) {
      imageUrl = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
    }
    if (!imageUrl) {
      imageUrl = itemXml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]+type=["']image/i)?.[1];
    }
    if (!imageUrl && description) {
      imageUrl = extractImageFromContent(description) || undefined;
    }
    
    if (title && link) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        description: description?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 500),
        link: link.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        imageUrl,
        pubDate: pubDateStr ? new Date(pubDateStr) : undefined,
      });
    }
  }
  
  return items;
}

async function parseAtomFeed(xml: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];
    const title = entryXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    
    const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]*(?:rel=["']alternate["'])?/i) ||
                      entryXml.match(/<link[^>]+href=["']([^"']+)["']/i);
    const link = linkMatch?.[1]?.trim() || '';
    
    const summary = entryXml.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i)?.[1]?.trim();
    const content = entryXml.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1]?.trim();
    const description = summary || content;
    
    const updatedStr = entryXml.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1]?.trim();
    const publishedStr = entryXml.match(/<published>([\s\S]*?)<\/published>/i)?.[1]?.trim();
    
    let imageUrl = entryXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1];
    if (!imageUrl && description) {
      imageUrl = extractImageFromContent(description) || undefined;
    }
    
    if (title && link) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        description: description?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim().substring(0, 500),
        link: link.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        imageUrl,
        pubDate: publishedStr ? new Date(publishedStr) : (updatedStr ? new Date(updatedStr) : undefined),
      });
    }
  }
  
  return items;
}

async function fetchFeed(source: NewsSource): Promise<ParsedFeed | null> {
  const headers: Record<string, string> = {
    'User-Agent': 'P3-NewsBot/1.0 (+https://p3protocol.xyz)',
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
  };
  
  if (source.etag) {
    headers['If-None-Match'] = source.etag;
  }
  if (source.lastModified) {
    headers['If-Modified-Since'] = source.lastModified;
  }
  
  const response = await fetch(source.url, { headers, signal: AbortSignal.timeout(15000) });
  
  if (response.status === 304) {
    logger.debug('Feed not modified', { source: source.name });
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const xml = await response.text();
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');
  
  const items = isAtom ? await parseAtomFeed(xml) : await parseRSSFeed(xml);
  
  return {
    items,
    etag: response.headers.get('etag') || undefined,
    lastModified: response.headers.get('last-modified') || undefined,
  };
}

async function processFeed(source: NewsSource): Promise<number> {
  try {
    const feed = await fetchFeed(source);
    
    if (!feed) {
      await db.update(newsSources)
        .set({ lastFetch: new Date(), errorCount: 0, updatedAt: new Date() })
        .where(eq(newsSources.id, source.id));
      return 0;
    }
    
    let insertedCount = 0;
    let firstNewArticle: FeedItem | null = null;
    
    for (const item of feed.items) {
      const contentHash = computeContentHash(item.title, item.link);
      
      const existing = await db.select({ id: newsArticles.id })
        .from(newsArticles)
        .where(eq(newsArticles.contentHash, contentHash))
        .limit(1);
      
      if (existing.length === 0) {
        const article: InsertNewsArticle = {
          sourceId: source.id,
          title: item.title,
          description: item.description,
          url: item.link,
          imageUrl: item.imageUrl,
          publishedAt: item.pubDate,
          contentHash,
        };
        
        await db.insert(newsArticles).values(article);
        insertedCount++;
        
        if (!firstNewArticle) {
          firstNewArticle = item;
        }
      }
    }

    if (firstNewArticle && insertedCount > 0) {
      sendNewsNotification(
        firstNewArticle.title,
        source.name,
        firstNewArticle.link
      ).catch(err => {
        logger.warn('Failed to send news push notification', { error: err.message });
      });
    }
    
    await db.update(newsSources)
      .set({
        lastFetch: new Date(),
        etag: feed.etag,
        lastModified: feed.lastModified,
        errorCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(newsSources.id, source.id));
    
    logger.info('Feed processed', { source: source.name, inserted: insertedCount, total: feed.items.length });
    return insertedCount;
  } catch (error) {
    const newErrorCount = (source.errorCount || 0) + 1;
    
    await db.update(newsSources)
      .set({
        errorCount: newErrorCount,
        updatedAt: new Date(),
      })
      .where(eq(newsSources.id, source.id));
    
    logger.warn('Feed fetch failed', { 
      source: source.name, 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCount: newErrorCount,
    });
    
    return 0;
  }
}

async function getSourcesDueForFetch(): Promise<NewsSource[]> {
  const now = new Date();
  
  return await db.select()
    .from(newsSources)
    .where(
      and(
        eq(newsSources.enabled, true),
        lte(newsSources.errorCount, MAX_ERROR_COUNT),
        or(
          isNull(newsSources.lastFetch),
          sql`${newsSources.lastFetch} < NOW() - INTERVAL '1 minute' * POWER(2, LEAST(${newsSources.errorCount}, 6)) * 5`
        )
      )
    )
    .orderBy(asc(newsSources.lastFetch))
    .limit(5);
}

let workerRunning = false;
let workerInterval: ReturnType<typeof setInterval> | null = null;

async function pollFeeds(): Promise<void> {
  if (workerRunning) return;
  
  workerRunning = true;
  try {
    const sources = await getSourcesDueForFetch();
    
    for (const source of sources) {
      await processFeed(source);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    logger.error('Feed worker error', { error: error instanceof Error ? error.message : 'Unknown error' });
  } finally {
    workerRunning = false;
  }
}

export function startNewsFeedWorker(): void {
  if (workerInterval) return;
  
  logger.info('Starting news feed worker');
  pollFeeds();
  workerInterval = setInterval(pollFeeds, 60 * 1000);
}

export function stopNewsFeedWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    logger.info('Stopped news feed worker');
  }
}

export async function refreshFeedNow(sourceId?: string): Promise<{ refreshed: number; inserted: number }> {
  let sources: NewsSource[];
  
  if (sourceId) {
    sources = await db.select()
      .from(newsSources)
      .where(and(eq(newsSources.id, sourceId), eq(newsSources.enabled, true)));
  } else {
    sources = await db.select()
      .from(newsSources)
      .where(eq(newsSources.enabled, true))
      .limit(10);
  }
  
  let totalInserted = 0;
  for (const source of sources) {
    totalInserted += await processFeed(source);
  }
  
  return { refreshed: sources.length, inserted: totalInserted };
}

export async function seedDefaultSources(): Promise<void> {
  const defaultSources = [
    // === WORLD NEWS ===
    { name: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', feedType: 'rss' as const, category: 'world' as const, region: 'global' as const },
    { name: 'BBC UK', url: 'https://feeds.bbci.co.uk/news/uk/rss.xml', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'Reuters World', url: 'https://www.reutersagency.com/feed/?best-topics=world&post_type=best', feedType: 'rss' as const, category: 'world' as const, region: 'global' as const },
    { name: 'AP News', url: 'https://apnews.com/index.rss', feedType: 'rss' as const, category: 'world' as const, region: 'global' as const },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', feedType: 'rss' as const, category: 'world' as const, region: 'middle_east' as const },
    { name: 'The Guardian World', url: 'https://www.theguardian.com/world/rss', feedType: 'rss' as const, category: 'world' as const, region: 'global' as const },
    { name: 'The Guardian UK', url: 'https://www.theguardian.com/uk-news/rss', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'The Guardian US', url: 'https://www.theguardian.com/us-news/rss', feedType: 'rss' as const, category: 'world' as const, region: 'us' as const },
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', feedType: 'rss' as const, category: 'world' as const, region: 'us' as const },
    { name: 'NPR World', url: 'https://feeds.npr.org/1004/rss.xml', feedType: 'rss' as const, category: 'world' as const, region: 'global' as const },
    { name: 'ABC News', url: 'https://abcnews.go.com/abcnews/topstories', feedType: 'rss' as const, category: 'world' as const, region: 'us' as const },
    { name: 'CBS News', url: 'https://www.cbsnews.com/latest/rss/main', feedType: 'rss' as const, category: 'world' as const, region: 'us' as const },
    { name: 'NBC News', url: 'https://feeds.nbcnews.com/nbcnews/public/news', feedType: 'rss' as const, category: 'world' as const, region: 'us' as const },
    { name: 'France 24', url: 'https://www.france24.com/en/rss', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'DW News', url: 'https://rss.dw.com/rdf/rss-en-all', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'The Independent', url: 'https://www.independent.co.uk/news/world/rss', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'The Telegraph', url: 'https://www.telegraph.co.uk/rss.xml', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'Euronews', url: 'https://www.euronews.com/rss?format=mrss&level=vertical&name=news', feedType: 'rss' as const, category: 'world' as const, region: 'eu' as const },
    { name: 'The Japan Times', url: 'https://www.japantimes.co.jp/feed/', feedType: 'rss' as const, category: 'world' as const, region: 'asia' as const },
    { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', feedType: 'rss' as const, category: 'world' as const, region: 'asia' as const },
    { name: 'ABC Australia', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', feedType: 'rss' as const, category: 'world' as const, region: 'global' as const },
    { name: 'Times of India', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', feedType: 'rss' as const, category: 'world' as const, region: 'asia' as const },
    
    // === POLITICS ===
    { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml', feedType: 'rss' as const, category: 'politics' as const, region: 'us' as const },
    { name: 'The Hill', url: 'https://thehill.com/feed/', feedType: 'rss' as const, category: 'politics' as const, region: 'us' as const },
    { name: 'NPR Politics', url: 'https://feeds.npr.org/1014/rss.xml', feedType: 'rss' as const, category: 'politics' as const, region: 'us' as const },
    { name: 'Guardian Politics', url: 'https://www.theguardian.com/politics/rss', feedType: 'rss' as const, category: 'politics' as const, region: 'eu' as const },
    { name: 'BBC Politics', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', feedType: 'rss' as const, category: 'politics' as const, region: 'eu' as const },
    
    // === TECH ===
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', feedType: 'rss' as const, category: 'tech' as const, region: 'us' as const },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', feedType: 'atom' as const, category: 'tech' as const, region: 'us' as const },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'CNET', url: 'https://www.cnet.com/rss/news/', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'The Register', url: 'https://www.theregister.com/headlines.atom', feedType: 'atom' as const, category: 'tech' as const, region: 'eu' as const },
    { name: 'Gizmodo', url: 'https://gizmodo.com/rss', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: '9to5Mac', url: 'https://9to5mac.com/feed/', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'Android Central', url: 'https://www.androidcentral.com/feed', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'TechRadar', url: 'https://www.techradar.com/rss', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    { name: 'Mashable', url: 'https://mashable.com/feeds/rss/all', feedType: 'rss' as const, category: 'tech' as const, region: 'global' as const },
    
    // === CRYPTO / WEB3 ===
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', feedType: 'rss' as const, category: 'crypto' as const, region: 'global' as const },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss', feedType: 'rss' as const, category: 'crypto' as const, region: 'global' as const },
    { name: 'The Block', url: 'https://www.theblock.co/rss.xml', feedType: 'rss' as const, category: 'crypto' as const, region: 'global' as const },
    { name: 'Decrypt', url: 'https://decrypt.co/feed', feedType: 'rss' as const, category: 'crypto' as const, region: 'global' as const },
    { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed', feedType: 'rss' as const, category: 'crypto' as const, region: 'global' as const },
    
    // === FINANCE / BUSINESS ===
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', feedType: 'rss' as const, category: 'finance' as const, region: 'us' as const },
    { name: 'CNBC Markets', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', feedType: 'rss' as const, category: 'finance' as const, region: 'us' as const },
    { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss', feedType: 'rss' as const, category: 'finance' as const, region: 'global' as const },
    { name: 'Financial Times', url: 'https://www.ft.com/world?format=rss', feedType: 'rss' as const, category: 'finance' as const, region: 'eu' as const },
    { name: 'Wall Street Journal', url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', feedType: 'rss' as const, category: 'finance' as const, region: 'us' as const },
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/rss/topstories', feedType: 'rss' as const, category: 'finance' as const, region: 'us' as const },
    { name: 'Forbes', url: 'https://www.forbes.com/real-time/feed2/', feedType: 'rss' as const, category: 'finance' as const, region: 'global' as const },
    { name: 'Business Insider', url: 'https://www.businessinsider.com/rss', feedType: 'rss' as const, category: 'finance' as const, region: 'global' as const },
    { name: 'The Economist', url: 'https://www.economist.com/business/rss.xml', feedType: 'rss' as const, category: 'finance' as const, region: 'global' as const },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex', feedType: 'rss' as const, category: 'finance' as const, region: 'global' as const },
    { name: 'Investopedia', url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline', feedType: 'rss' as const, category: 'finance' as const, region: 'global' as const },
    
    // === SCIENCE ===
    { name: 'Nature News', url: 'https://www.nature.com/nature.rss', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'Science Daily', url: 'https://www.sciencedaily.com/rss/all.xml', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'Phys.org', url: 'https://phys.org/rss-feed/', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'Scientific American', url: 'http://rss.sciam.com/ScientificAmerican-Global', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'New Scientist', url: 'https://www.newscientist.com/feed/home/', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'Space.com', url: 'https://www.space.com/feeds/all', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'NASA News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'Live Science', url: 'https://www.livescience.com/feeds/all', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    { name: 'Smithsonian', url: 'https://www.smithsonianmag.com/rss/latest_articles/', feedType: 'rss' as const, category: 'science' as const, region: 'global' as const },
    
    // === SPORTS ===
    { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', feedType: 'rss' as const, category: 'sports' as const, region: 'global' as const },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', feedType: 'rss' as const, category: 'sports' as const, region: 'global' as const },
    { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040', feedType: 'rss' as const, category: 'sports' as const, region: 'eu' as const },
    { name: 'The Athletic', url: 'https://theathletic.com/feed/', feedType: 'rss' as const, category: 'sports' as const, region: 'global' as const },
    { name: 'Bleacher Report', url: 'https://bleacherreport.com/articles/feed', feedType: 'rss' as const, category: 'sports' as const, region: 'us' as const },
    
    // === ENTERTAINMENT ===
    { name: 'Variety', url: 'https://variety.com/feed/', feedType: 'rss' as const, category: 'entertainment' as const, region: 'global' as const },
    { name: 'Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', feedType: 'rss' as const, category: 'entertainment' as const, region: 'global' as const },
    { name: 'Deadline', url: 'https://deadline.com/feed/', feedType: 'rss' as const, category: 'entertainment' as const, region: 'global' as const },
    { name: 'Entertainment Weekly', url: 'https://ew.com/feed/', feedType: 'rss' as const, category: 'entertainment' as const, region: 'us' as const },
    { name: 'Pitchfork', url: 'https://pitchfork.com/feed/feed-news/rss', feedType: 'rss' as const, category: 'entertainment' as const, region: 'global' as const },
    { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/', feedType: 'rss' as const, category: 'entertainment' as const, region: 'global' as const },
    
    // === GAMING ===
    { name: 'IGN', url: 'https://feeds.feedburner.com/ign/all', feedType: 'rss' as const, category: 'gaming' as const, region: 'global' as const },
    { name: 'Kotaku', url: 'https://kotaku.com/rss', feedType: 'rss' as const, category: 'gaming' as const, region: 'global' as const },
    { name: 'PC Gamer', url: 'https://www.pcgamer.com/rss/', feedType: 'rss' as const, category: 'gaming' as const, region: 'global' as const },
    { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml', feedType: 'atom' as const, category: 'gaming' as const, region: 'global' as const },
    { name: 'GameSpot', url: 'https://www.gamespot.com/feeds/mashup/', feedType: 'rss' as const, category: 'gaming' as const, region: 'global' as const },
    
    // === HEALTH ===
    { name: 'Medical News Today', url: 'https://www.medicalnewstoday.com/rss', feedType: 'rss' as const, category: 'health' as const, region: 'global' as const },
    { name: 'Healthline', url: 'https://www.healthline.com/rss/health-news', feedType: 'rss' as const, category: 'health' as const, region: 'global' as const },
    { name: 'WebMD', url: 'https://rssfeeds.webmd.com/rss/rss.aspx?RSSSource=RSS_PUBLIC', feedType: 'rss' as const, category: 'health' as const, region: 'global' as const },
    { name: 'STAT News', url: 'https://www.statnews.com/feed/', feedType: 'rss' as const, category: 'health' as const, region: 'global' as const },
  ];
  
  for (const source of defaultSources) {
    try {
      const existing = await db.select({ id: newsSources.id })
        .from(newsSources)
        .where(eq(newsSources.url, source.url))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(newsSources).values(source);
        logger.info('Seeded news source', { name: source.name });
      }
    } catch (error) {
      logger.warn('Failed to seed source', { name: source.name, error });
    }
  }
}
