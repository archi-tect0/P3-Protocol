import { Router, Request, Response } from 'express';
import { flowEventBus } from './eventBus';
import { getActiveTrace, getRecentTraces, getActiveFlowCount } from './tracing';
import { playMusicAndCheckSlack, notifyAndPlay, parallelAppCheck } from './compound';
import { showLauncher, getPinnedApps, setPinnedApps, addPinnedApp, removePinnedApp, type PinnedApp } from './launcher';

const router = Router();

router.post('/play-and-check', async (req: Request, res: Response) => {
  try {
    const { wallet, uris } = req.body;
    if (!wallet) {
      res.status(400).json({ error: 'wallet required' });
      return;
    }
    const result = await playMusicAndCheckSlack(wallet, uris);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/notify-and-play', async (req: Request, res: Response) => {
  try {
    const { wallet, channel, message, uris } = req.body;
    if (!wallet || !channel || !message) {
      res.status(400).json({ error: 'wallet, channel, and message required' });
      return;
    }
    const result = await notifyAndPlay(wallet, channel, message, uris);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/parallel-check', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;
    if (!wallet) {
      res.status(400).json({ error: 'wallet required' });
      return;
    }
    const result = await parallelAppCheck(wallet);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.get('/stream', (req: Request, res: Response) => {
  const flowId = req.query.flow as string;

  if (!flowId) {
    res.status(400).json({ error: 'flow query parameter required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send({ type: 'connected', flowId, timestamp: Date.now() });

  flowEventBus.subscribe(flowId, send);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    flowEventBus.unsubscribe(flowId, send);
  });
});

router.get('/active', (_req: Request, res: Response) => {
  res.json({
    activeFlows: flowEventBus.getActiveFlowIds(),
    count: getActiveFlowCount(),
  });
});

router.get('/trace/:flowId', (req: Request, res: Response) => {
  const { flowId } = req.params;
  const trace = getActiveTrace(flowId);

  if (!trace) {
    res.status(404).json({ error: 'Flow not found' });
    return;
  }

  res.json(trace);
});

router.get('/recent', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  res.json(getRecentTraces(Math.min(limit, 100)));
});

router.get('/launcher', async (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string || req.headers['x-wallet-address'] as string;
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required' });
      return;
    }
    const result = await showLauncher(wallet);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.get('/launcher/pinned', (req: Request, res: Response) => {
  const wallet = req.query.wallet as string || req.headers['x-wallet-address'] as string;
  if (!wallet) {
    res.status(400).json({ ok: false, error: 'wallet required' });
    return;
  }
  res.json({ ok: true, pinned: getPinnedApps(wallet) });
});

router.post('/launcher/pinned', (req: Request, res: Response) => {
  try {
    const wallet = req.body.wallet || req.headers['x-wallet-address'] as string;
    const { apps } = req.body as { apps: PinnedApp[] };
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required' });
      return;
    }
    if (!apps || !Array.isArray(apps)) {
      res.status(400).json({ ok: false, error: 'apps array required' });
      return;
    }
    setPinnedApps(wallet, apps);
    res.json({ ok: true, pinned: getPinnedApps(wallet) });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/launcher/pinned/add', (req: Request, res: Response) => {
  try {
    const wallet = req.body.wallet || req.headers['x-wallet-address'] as string;
    const { app } = req.body as { app: PinnedApp };
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required' });
      return;
    }
    if (!app || !app.id) {
      res.status(400).json({ ok: false, error: 'app with id required' });
      return;
    }
    addPinnedApp(wallet, app);
    res.json({ ok: true, pinned: getPinnedApps(wallet) });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.delete('/launcher/pinned/:appId', (req: Request, res: Response) => {
  try {
    const wallet = req.query.wallet as string || req.headers['x-wallet-address'] as string;
    const { appId } = req.params;
    if (!wallet) {
      res.status(400).json({ ok: false, error: 'wallet required' });
      return;
    }
    removePinnedApp(wallet, appId);
    res.json({ ok: true, pinned: getPinnedApps(wallet) });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

export default router;
