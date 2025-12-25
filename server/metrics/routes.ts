import { Router, Request, Response } from 'express';
import { getTokenWindow, getRecentRecords, getUsageStats } from './tokens';
import { getCacheStats } from '../proxy/cache';
import { getRateLimitStatus, getProviderLimits } from '../proxy/rateLimit';

const router = Router();

router.get('/tokens', (req: Request, res: Response) => {
  const provider = req.query.provider as string | undefined;
  res.json(getTokenWindow(provider));
});

router.get('/tokens/recent', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(getRecentRecords(Math.min(limit, 200)));
});

router.get('/tokens/stats', (_req: Request, res: Response) => {
  res.json(getUsageStats());
});

router.get('/cache', (_req: Request, res: Response) => {
  res.json(getCacheStats());
});

router.get('/ratelimit/:provider', (req: Request, res: Response) => {
  const { provider } = req.params;
  const wallet = req.query.wallet as string | undefined;
  
  res.json({
    status: getRateLimitStatus(provider, wallet),
    limits: getProviderLimits(provider),
  });
});

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    cache: getCacheStats(),
    tokens: getUsageStats(),
  });
});

export default router;
