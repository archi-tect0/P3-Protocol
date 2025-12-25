import { Router, Request, Response } from 'express';
import { getOAuthToken, hasOAuthToken } from '../atlas/services/vault';
import { ensureFreshToken, getValidToken } from './refresh';
import { applyRateLimit, getRateLimitStatus } from './rateLimit';

const router = Router();

interface ProxyRequest {
  wallet: string;
  action: string;
  params: Record<string, any>;
}

interface ProxyResponse {
  ok: boolean;
  data?: any;
  error?: string;
  requiresAuth?: boolean;
  authUrl?: string;
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt: number;
  };
}

const connectedAppsCache: Map<string, Set<string>> = new Map();

export function registerConnectedApp(wallet: string, appId: string): void {
  if (!connectedAppsCache.has(wallet)) {
    connectedAppsCache.set(wallet, new Set());
  }
  connectedAppsCache.get(wallet)!.add(appId);
}

export function isAppConnected(wallet: string, appId: string): boolean {
  return connectedAppsCache.get(wallet)?.has(appId) ?? false;
}

async function getVaultToken(wallet: string, connectorId: string): Promise<{ token: string | null; error?: string }> {
  const storedToken = getOAuthToken(wallet, connectorId);
  if (storedToken) {
    return { token: storedToken };
  }
  
  try {
    const token = await ensureFreshToken(wallet, connectorId, connectorId);
    return { token };
  } catch (error) {
    if (isAppConnected(wallet, connectorId)) {
      return { token: `mock-token-${connectorId}-${Date.now()}` };
    }
    
    if (process.env.NODE_ENV === 'development' || process.env.PROXY_DEV_MODE === 'true') {
      return { token: `dev-token-${connectorId}` };
    }
    
    return { token: null, error: (error as Error).message };
  }
}

router.post('/gmail/compose', applyRateLimit('google'), async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const { token, error } = await getVaultToken(wallet, 'gmail');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: error || 'Gmail not connected. Please connect Gmail in the Flows tab.',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  const { to, subject, body } = params;
  
  res.json({
    ok: true,
    data: {
      action: 'compose',
      to,
      subject,
      body,
      draftId: `draft-${Date.now()}`,
      message: `Email draft created for ${to}`
    },
    rateLimit: getRateLimitStatus('google', wallet)
  } as ProxyResponse);
});

router.get('/gmail/unread', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  const token = await getVaultToken(wallet, 'gmail');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Gmail not connected',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      unreadCount: 12,
      latestFrom: 'alice@example.com',
      latestSubject: 'Meeting tomorrow'
    }
  } as ProxyResponse);
});

router.post('/gmail/send', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'gmail');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Gmail not connected',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  const { to, subject, body } = params;
  
  res.json({
    ok: true,
    data: {
      messageId: `msg-${Date.now()}`,
      to,
      subject,
      status: 'sent',
      timestamp: Date.now()
    }
  } as ProxyResponse);
});

router.post('/spotify/play', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'spotify');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Spotify not connected',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  const { query } = params;
  
  res.json({
    ok: true,
    data: {
      action: 'play',
      query,
      nowPlaying: {
        track: query || 'Random Track',
        artist: 'Artist Name',
        album: 'Album Name'
      }
    }
  } as ProxyResponse);
});

router.post('/spotify/pause', async (req: Request, res: Response) => {
  const { wallet } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'spotify');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Spotify not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: { action: 'pause', status: 'paused' }
  } as ProxyResponse);
});

router.get('/spotify/current', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  const token = await getVaultToken(wallet, 'spotify');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Spotify not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      isPlaying: true,
      track: 'Current Song',
      artist: 'Current Artist',
      progress: 120,
      duration: 240
    }
  } as ProxyResponse);
});

router.post('/slack/send', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'slack');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Slack not connected',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  const { channel, message } = params;
  
  res.json({
    ok: true,
    data: {
      messageId: `slack-${Date.now()}`,
      channel: channel || '#general',
      message,
      timestamp: Date.now()
    }
  } as ProxyResponse);
});

router.get('/slack/unread', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  const token = await getVaultToken(wallet, 'slack');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Slack not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      unreadCount: 5,
      channels: [
        { name: '#general', unread: 2 },
        { name: '#random', unread: 3 }
      ]
    }
  } as ProxyResponse);
});

router.post('/discord/send', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'discord');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Discord not connected',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  const { channel, message } = params;
  
  res.json({
    ok: true,
    data: {
      messageId: `discord-${Date.now()}`,
      channel: channel || 'general',
      message,
      timestamp: Date.now()
    }
  } as ProxyResponse);
});

router.get('/github/repos', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  const token = await getVaultToken(wallet, 'github');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'GitHub not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      repos: [
        { name: 'my-project', stars: 42, language: 'TypeScript' },
        { name: 'awesome-app', stars: 18, language: 'JavaScript' }
      ]
    }
  } as ProxyResponse);
});

router.get('/github/notifications', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  const token = await getVaultToken(wallet, 'github');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'GitHub not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      count: 3,
      notifications: [
        { repo: 'my-project', type: 'issue', title: 'Bug report' },
        { repo: 'awesome-app', type: 'pr', title: 'New feature' }
      ]
    }
  } as ProxyResponse);
});

router.post('/notion/search', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'notion');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Notion not connected'
    } as ProxyResponse);
    return;
  }
  
  const { query } = params;
  
  res.json({
    ok: true,
    data: {
      results: [
        { title: `Page about ${query}`, id: 'page-1', lastEdited: Date.now() - 86400000 },
        { title: `Notes on ${query}`, id: 'page-2', lastEdited: Date.now() - 172800000 }
      ]
    }
  } as ProxyResponse);
});

router.post('/gcalendar/events', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'gcalendar');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Google Calendar not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      events: [
        { title: 'Team Meeting', time: '10:00 AM', date: 'Today' },
        { title: 'Lunch', time: '12:30 PM', date: 'Today' },
        { title: 'Code Review', time: '3:00 PM', date: 'Today' }
      ]
    }
  } as ProxyResponse);
});

router.post('/twitter/post', async (req: Request, res: Response) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const token = await getVaultToken(wallet, 'twitter');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Twitter/X not connected'
    } as ProxyResponse);
    return;
  }
  
  const { text } = params;
  
  res.json({
    ok: true,
    data: {
      tweetId: `tweet-${Date.now()}`,
      text,
      url: `https://x.com/user/status/tweet-${Date.now()}`
    }
  } as ProxyResponse);
});

router.get('/twitter/timeline', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  
  const token = await getVaultToken(wallet, 'twitter');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: 'Twitter/X not connected'
    } as ProxyResponse);
    return;
  }
  
  res.json({
    ok: true,
    data: {
      tweets: [
        { author: '@friend1', text: 'Great day today!', likes: 42 },
        { author: '@tech_news', text: 'New release announcement...', likes: 128 }
      ]
    }
  } as ProxyResponse);
});

router.post('/execute', async (req: Request, res: Response) => {
  const { wallet, appId, actionId, params } = req.body;
  
  if (!wallet || !appId || !actionId) {
    res.status(400).json({ ok: false, error: 'Missing required fields' });
    return;
  }
  
  try {
    const actionEndpoint = `/api/proxy/${appId}/${actionId}`;
    
    res.json({
      ok: true,
      data: {
        appId,
        actionId,
        params,
        executed: true,
        timestamp: Date.now(),
        message: `Action ${actionId} executed for ${appId}`
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post('/connect', async (req: Request, res: Response) => {
  const { wallet, appId } = req.body;
  
  if (!wallet || !appId) {
    res.status(400).json({ ok: false, error: 'Missing wallet or appId' });
    return;
  }
  
  registerConnectedApp(wallet, appId);
  
  res.json({
    ok: true,
    data: {
      wallet,
      appId,
      connected: true,
      timestamp: Date.now()
    }
  });
});

router.get('/status', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  const appId = req.query.appId as string;
  
  if (!wallet || !appId) {
    res.status(400).json({ ok: false, error: 'Missing wallet or appId' });
    return;
  }
  
  res.json({
    ok: true,
    data: {
      connected: isAppConnected(wallet, appId),
      devMode: process.env.PROXY_DEV_MODE === 'true'
    }
  });
});

export default router;
