import { Router, Request, Response } from 'express';
import { rootLogger } from '../observability/logger';

const router = Router();
const logger = rootLogger.child({ module: 'wiki' });

router.get('/search', async (req: Request, res: Response) => {
  try {
    const term = (req.query.term as string) || (req.query.q as string) || '';
    if (!term.trim()) {
      return res.status(400).json({ ok: false, error: 'Search term required' });
    }
    
    const { searchWikipedia } = await import('../atlas/services/wikipediaService');
    const results = await searchWikipedia(term);
    
    logger.info('Wikipedia search completed', { term, resultCount: results.length });
    res.json({ ok: true, results });
  } catch (error) {
    logger.error(`Wikipedia search error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ ok: false, error: 'Wikipedia search failed' });
  }
});

router.get('/article', async (req: Request, res: Response) => {
  try {
    const title = (req.query.title as string) || '';
    if (!title.trim()) {
      return res.status(400).json({ ok: false, error: 'Title parameter required' });
    }
    
    const { getWikipediaArticle } = await import('../atlas/services/wikipediaService');
    const article = await getWikipediaArticle(title);
    
    if (!article) {
      return res.status(404).json({ ok: false, error: 'Article not found' });
    }
    
    logger.info('Wikipedia article fetched', { title });
    res.json({ ok: true, article });
  } catch (error) {
    logger.error(`Wikipedia article error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ ok: false, error: 'Failed to fetch article' });
  }
});

router.get('/random', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    
    const { getRandomWikiArticles } = await import('../atlas/services/wikiRandomService');
    const result = await getRandomWikiArticles(page, pageSize);
    
    logger.info('Wikipedia random articles fetched', { page, pageSize, resultCount: result.entries.length });
    res.json(result);
  } catch (error) {
    logger.error(`Wikipedia random articles error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ ok: false, error: 'Failed to fetch random Wikipedia articles' });
  }
});

export default router;
