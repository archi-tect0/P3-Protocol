import { Router, Request, Response } from 'express';
import { db } from '../db';
import { newsSources, newsArticles, userNewsPrefs, type NewsSource, type NewsArticle } from '@shared/schema';
import { eq, and, desc, inArray, sql, ilike, or } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';
import { broadcastNewsUpdate, getPulseMetrics } from '../atlas/services/pulseService';
import { refreshFeedNow, seedDefaultSources, startNewsFeedWorker } from '../services/newsFeedWorker';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();
const logger = rootLogger.child({ module: 'news' });

const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: 'Too many refresh requests, please wait' },
  standardHeaders: true,
  legacyHeaders: false,
});

const preferencesSchema = z.object({
  walletAddress: z.string().min(10),
  preferences: z.array(z.object({
    sourceId: z.string().uuid(),
    enabled: z.boolean(),
  })),
});

startNewsFeedWorker();
seedDefaultSources().catch(err => logger.error('Failed to seed news sources', { error: err }));

router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const region = req.query.region as string | undefined;
    const sourceId = req.query.sourceId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    
    const offset = (page - 1) * pageSize;
    
    let sourceIds: string[] | undefined;
    
    if (category || region || sourceId) {
      const conditions = [];
      if (sourceId) {
        conditions.push(eq(newsSources.id, sourceId));
      } else {
        conditions.push(eq(newsSources.enabled, true));
        if (category) conditions.push(eq(newsSources.category, category as any));
        if (region) conditions.push(eq(newsSources.region, region as any));
      }
      
      const sources = await db.select({ id: newsSources.id })
        .from(newsSources)
        .where(and(...conditions));
      
      sourceIds = sources.map(s => s.id);
      if (sourceIds.length === 0) {
        return res.json({ ok: true, articles: [], page, pageSize, total: 0, hasMore: false });
      }
    }
    
    let query = db.select({
      id: newsArticles.id,
      title: newsArticles.title,
      description: newsArticles.description,
      url: newsArticles.url,
      imageUrl: newsArticles.imageUrl,
      publishedAt: newsArticles.publishedAt,
      createdAt: newsArticles.createdAt,
      sourceName: newsSources.name,
      sourceCategory: newsSources.category,
      sourceRegion: newsSources.region,
    })
      .from(newsArticles)
      .innerJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.createdAt))
      .limit(pageSize + 1)
      .offset(offset);
    
    const conditions = [];
    if (sourceIds) {
      conditions.push(inArray(newsArticles.sourceId, sourceIds));
    }
    if (search) {
      conditions.push(or(
        ilike(newsArticles.title, `%${search}%`),
        ilike(newsArticles.description, `%${search}%`)
      ));
    }
    
    const articles = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    
    const hasMore = articles.length > pageSize;
    const resultArticles = hasMore ? articles.slice(0, pageSize) : articles;
    
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(newsArticles)
      .innerJoin(newsSources, eq(newsArticles.sourceId, newsSources.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const total = countResult[0]?.count || 0;
    
    logger.info('News articles fetched', { category, region, page, count: resultArticles.length });
    
    res.json({
      ok: true,
      articles: resultArticles,
      page,
      pageSize,
      total,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    });
  } catch (error) {
    logger.error('News fetch error', { error });
    res.status(500).json({ ok: false, error: 'Failed to fetch news' });
  }
});

router.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await db.select({
      id: newsSources.id,
      name: newsSources.name,
      url: newsSources.url,
      feedType: newsSources.feedType,
      category: newsSources.category,
      region: newsSources.region,
      enabled: newsSources.enabled,
      lastFetch: newsSources.lastFetch,
      errorCount: newsSources.errorCount,
    })
      .from(newsSources)
      .orderBy(newsSources.category, newsSources.name);
    
    const categories = [...new Set(sources.map(s => s.category))];
    const regions = [...new Set(sources.map(s => s.region))];
    
    res.json({
      ok: true,
      sources,
      categories,
      regions,
    });
  } catch (error) {
    logger.error('Sources fetch error', { error });
    res.status(500).json({ ok: false, error: 'Failed to fetch sources' });
  }
});

router.get('/preferences/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    
    const prefs = await db.select({
      sourceId: userNewsPrefs.sourceId,
      enabled: userNewsPrefs.enabled,
      sourceName: newsSources.name,
      sourceCategory: newsSources.category,
    })
      .from(userNewsPrefs)
      .innerJoin(newsSources, eq(userNewsPrefs.sourceId, newsSources.id))
      .where(eq(userNewsPrefs.walletAddress, walletAddress.toLowerCase()));
    
    res.json({ ok: true, preferences: prefs });
  } catch (error) {
    logger.error('Preferences fetch error', { error });
    res.status(500).json({ ok: false, error: 'Failed to fetch preferences' });
  }
});

router.post('/preferences', async (req: Request, res: Response) => {
  try {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'Invalid request body', details: parsed.error.errors });
    }
    
    const { walletAddress, preferences } = parsed.data;
    const wallet = walletAddress.toLowerCase();
    
    for (const pref of preferences) {
      const existing = await db.select({ id: userNewsPrefs.id })
        .from(userNewsPrefs)
        .where(and(
          eq(userNewsPrefs.walletAddress, wallet),
          eq(userNewsPrefs.sourceId, pref.sourceId)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(userNewsPrefs)
          .set({ enabled: pref.enabled })
          .where(eq(userNewsPrefs.id, existing[0].id));
      } else {
        await db.insert(userNewsPrefs).values({
          walletAddress: wallet,
          sourceId: pref.sourceId,
          enabled: pref.enabled,
        });
      }
    }
    
    logger.info('Preferences updated', { walletAddress: wallet, count: preferences.length });
    res.json({ ok: true, updated: preferences.length });
  } catch (error) {
    logger.error('Preferences update error', { error });
    res.status(500).json({ ok: false, error: 'Failed to update preferences' });
  }
});

router.post('/refresh', refreshRateLimiter, async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.body;
    const result = await refreshFeedNow(sourceId);
    
    logger.info('Feed refresh triggered', result);
    res.json({ ok: true, ...result });
  } catch (error) {
    logger.error('Refresh error', { error });
    res.status(500).json({ ok: false, error: 'Failed to refresh feeds' });
  }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
    const topic = (req.query.topic as string) || (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    
    if (!topic.trim()) {
      return res.status(400).json({ ok: false, error: 'Topic parameter required' });
    }
    
    const { searchNews } = await import('../atlas/services/newsService');
    const allArticles = await searchNews(topic);
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const articles = allArticles.slice(startIndex, endIndex);
    const hasMore = endIndex < allArticles.length;
    
    if (page === 1 && articles.length > 0) {
      broadcastNewsUpdate({
        articles,
        source: 'search',
        fetchTimestamp: Date.now(),
        topic,
      });
    }
    
    logger.info('News search completed', { topic, page, resultCount: articles.length, total: allArticles.length });
    res.json({ 
      ok: true, 
      articles,
      page,
      pageSize,
      total: allArticles.length,
      hasMore,
      nextPage: hasMore ? page + 1 : null
    });
  } catch (error) {
    logger.error('News search error', { error });
    res.status(500).json({ ok: false, error: 'News search failed' });
  }
});

router.get('/top', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 12;
    
    const { getTopStories } = await import('../atlas/services/newsService');
    const allArticles = await getTopStories();
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const articles = allArticles.slice(startIndex, endIndex);
    const hasMore = endIndex < allArticles.length;
    
    if (page === 1 && articles.length > 0) {
      broadcastNewsUpdate({
        articles,
        source: 'top-stories',
        fetchTimestamp: Date.now(),
      });
    }
    
    logger.info('Top stories fetched', { page, pageSize, resultCount: articles.length, total: allArticles.length });
    res.json({ 
      ok: true, 
      articles, 
      page, 
      pageSize, 
      total: allArticles.length,
      hasMore,
      nextPage: hasMore ? page + 1 : null
    });
  } catch (error) {
    logger.error('Top stories error', { error });
    res.status(500).json({ ok: false, error: 'Failed to fetch top stories' });
  }
});

router.get('/pulse/metrics', (_req: Request, res: Response) => {
  const metrics = getPulseMetrics();
  res.json({ ok: true, metrics });
});

export default router;
