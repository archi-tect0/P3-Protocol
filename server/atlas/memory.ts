import express, { Request, Response, NextFunction } from 'express';
import {
  getSessionMemory,
  addPinned,
  removePinned,
  isPinned,
  getPinnedApps,
  recordFlow,
  getRecentFlows,
  recordQuery,
  getRecentQueries,
  setPreference,
  getPreference,
  clearHistory,
  clearAllPins,
  resetSession,
  getMemoryStats,
} from './services/sessionMemory';

export const memoryRouter = express.Router();

function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  const atlasUser = (req as any).atlasUser;

  if (!atlasUser || !atlasUser.wallet) {
    res.status(401).json({
      ok: false,
      error: 'Memory endpoints require wallet authentication. Provide a valid Bearer token.',
      'data-testid': 'memory-auth-error',
    });
    return;
  }

  next();
}

memoryRouter.use(requireWalletAuth);

memoryRouter.get('/', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const session = getSessionMemory(wallet);

    res.json({
      ok: true,
      session,
      ts: Date.now(),
      'data-testid': 'memory-session-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get session memory',
    });
  }
});

memoryRouter.get('/pinned', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const pinned = getPinnedApps(wallet);

    res.json({
      ok: true,
      pinned,
      count: pinned.length,
      ts: Date.now(),
      'data-testid': 'memory-pinned-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get pinned apps',
    });
  }
});

memoryRouter.post('/pin', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { appId } = req.body;

    if (!appId) {
      return res.status(400).json({
        ok: false,
        error: 'appId is required',
      });
    }

    const session = addPinned(wallet, appId);

    res.json({
      ok: true,
      session,
      message: `Pinned ${appId}`,
      ts: Date.now(),
      'data-testid': 'memory-pin-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to pin app',
    });
  }
});

memoryRouter.delete('/pin/:appId', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { appId } = req.params;

    const session = removePinned(wallet, appId);

    res.json({
      ok: true,
      session,
      message: `Unpinned ${appId}`,
      ts: Date.now(),
      'data-testid': 'memory-unpin-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to unpin app',
    });
  }
});

memoryRouter.get('/pin/:appId', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { appId } = req.params;

    const pinned = isPinned(wallet, appId);

    res.json({
      ok: true,
      appId,
      pinned,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to check pin status',
    });
  }
});

memoryRouter.get('/flows', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const limit = parseInt(req.query.limit as string) || 10;
    const flows = getRecentFlows(wallet, limit);

    res.json({
      ok: true,
      flows,
      count: flows.length,
      ts: Date.now(),
      'data-testid': 'memory-flows-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get recent flows',
    });
  }
});

memoryRouter.post('/flows', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { flowId } = req.body;

    if (!flowId) {
      return res.status(400).json({
        ok: false,
        error: 'flowId is required',
      });
    }

    const session = recordFlow(wallet, flowId);

    res.json({
      ok: true,
      session,
      message: `Recorded flow ${flowId}`,
      ts: Date.now(),
      'data-testid': 'memory-flow-record-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to record flow',
    });
  }
});

memoryRouter.get('/queries', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const limit = parseInt(req.query.limit as string) || 20;
    const queries = getRecentQueries(wallet, limit);

    res.json({
      ok: true,
      queries,
      count: queries.length,
      ts: Date.now(),
      'data-testid': 'memory-queries-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get recent queries',
    });
  }
});

memoryRouter.post('/queries', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: 'query is required',
      });
    }

    const session = recordQuery(wallet, query);

    res.json({
      ok: true,
      session,
      message: 'Query recorded',
      ts: Date.now(),
      'data-testid': 'memory-query-record-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to record query',
    });
  }
});

memoryRouter.get('/preferences/:key', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { key } = req.params;

    const value = getPreference(wallet, key);

    res.json({
      ok: true,
      key,
      value,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get preference',
    });
  }
});

memoryRouter.post('/preferences', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({
        ok: false,
        error: 'key is required',
      });
    }

    const session = setPreference(wallet, key, value);

    res.json({
      ok: true,
      session,
      message: `Preference ${key} set`,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to set preference',
    });
  }
});

memoryRouter.post('/clear', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;
    const type = (req.body?.type || 'all') as 'flows' | 'queries' | 'all';

    const session = clearHistory(wallet, type);

    res.json({
      ok: true,
      session,
      message: `Cleared ${type} history`,
      ts: Date.now(),
      'data-testid': 'memory-clear-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to clear history',
    });
  }
});

memoryRouter.post('/clear/pins', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;

    const session = clearAllPins(wallet);

    res.json({
      ok: true,
      session,
      message: 'Cleared all pinned apps',
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to clear pins',
    });
  }
});

memoryRouter.post('/reset', (req, res) => {
  try {
    const wallet = (req as any).atlasUser.wallet;

    const session = resetSession(wallet);

    res.json({
      ok: true,
      session,
      message: 'Session memory reset',
      ts: Date.now(),
      'data-testid': 'memory-reset-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to reset session',
    });
  }
});

memoryRouter.get('/stats', (req, res) => {
  try {
    const stats = getMemoryStats();

    res.json({
      ok: true,
      stats,
      ts: Date.now(),
      'data-testid': 'memory-stats-response',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Failed to get memory stats',
    });
  }
});

memoryRouter.get('/help', (req, res) => {
  res.json({
    ok: true,
    help: `Atlas Session Memory - Remember your preferences and history

Endpoints:
- GET  /api/atlas/memory - Get your full session memory
- GET  /api/atlas/memory/pinned - Get pinned apps
- POST /api/atlas/memory/pin - Pin an app { appId }
- DELETE /api/atlas/memory/pin/:appId - Unpin an app
- GET  /api/atlas/memory/flows - Get recent flows
- POST /api/atlas/memory/flows - Record a flow { flowId }
- GET  /api/atlas/memory/queries - Get recent queries
- POST /api/atlas/memory/queries - Record a query { query }
- POST /api/atlas/memory/clear - Clear history { type: 'flows'|'queries'|'all' }
- POST /api/atlas/memory/reset - Reset entire session

Voice commands:
- "pin Slack" - Pin the Slack app
- "unpin Spotify" - Unpin the Spotify app
- "show my pinned apps" - List pinned apps
- "what did I run last" - Show recent flows
- "clear my history" - Clear all history`,
    commands: [
      'GET /api/atlas/memory - Full session state',
      'GET /api/atlas/memory/pinned - Pinned apps list',
      'POST /api/atlas/memory/pin - Pin app { appId }',
      'DELETE /api/atlas/memory/pin/:appId - Unpin app',
      'GET /api/atlas/memory/flows - Recent flows',
      'POST /api/atlas/memory/flows - Record flow { flowId }',
      'GET /api/atlas/memory/queries - Recent queries',
      'POST /api/atlas/memory/queries - Record query { query }',
      'POST /api/atlas/memory/clear - Clear history',
      'POST /api/atlas/memory/reset - Reset session',
      'GET /api/atlas/memory/stats - Memory stats',
    ],
  });
});
