import express, { Request, Response, NextFunction } from 'express';
import { 
  listAllEndpoints,
  listAllApps,
  listAllFlows,
  getFlow,
  describeEndpoint,
  searchDevKit,
  getEndpointsByAppId,
  getEndpointsByScopeFilter,
  getDevKitHelp,
  processDevKitQuery,
  getQuickStats
} from './services/devkitRegistry';
import type { Scope } from './types';

export const devkitRouter = express.Router();

function requireWalletAuth(req: Request, res: Response, next: NextFunction) {
  const atlasUser = (req as any).atlasUser;
  
  if (!atlasUser || !atlasUser.wallet) {
    res.status(401).json({
      ok: false,
      error: 'DevKit endpoints require wallet authentication. Provide a valid Bearer token.',
      'data-testid': 'devkit-auth-error',
    });
    return;
  }
  
  next();
}

devkitRouter.use(requireWalletAuth);

devkitRouter.get('/endpoints', (req, res) => {
  try {
    const scope = req.query.scope as Scope | undefined;
    const app = req.query.app as string | undefined;
    
    let endpoints;
    if (scope) {
      endpoints = getEndpointsByScopeFilter(scope);
    } else if (app) {
      endpoints = getEndpointsByAppId(app);
    } else {
      endpoints = listAllEndpoints();
    }
    
    res.json({ 
      ok: true, 
      endpoints,
      count: endpoints.length,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to list endpoints' 
    });
  }
});

devkitRouter.get('/apps', (req, res) => {
  try {
    const apps = listAllApps();
    res.json({ 
      ok: true, 
      apps,
      count: apps.length,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to list apps' 
    });
  }
});

devkitRouter.get('/flows', (req, res) => {
  try {
    const flows = listAllFlows();
    res.json({ 
      ok: true, 
      flows,
      count: flows.length,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to list flows' 
    });
  }
});

devkitRouter.get('/flows/:id', (req, res) => {
  try {
    const flow = getFlow(req.params.id);
    if (!flow) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Flow not found',
        available: listAllFlows().map(f => f.id),
      });
    }
    res.json({ ok: true, flow });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get flow' 
    });
  }
});

devkitRouter.get('/endpoints/:key', (req, res) => {
  try {
    const key = req.params.key.replace(/-/g, '.');
    const endpoint = describeEndpoint(key);
    if (!endpoint) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Endpoint not found',
        suggestions: listAllEndpoints()
          .filter(e => e.key.includes(key.split('.')[0]))
          .slice(0, 5)
          .map(e => e.key),
      });
    }
    res.json({ ok: true, endpoint });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get endpoint' 
    });
  }
});

devkitRouter.get('/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Query parameter "q" is required' 
      });
    }
    
    const endpoints = await searchDevKit(query);
    res.json({ 
      ok: true, 
      query,
      endpoints,
      count: endpoints.length,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Search failed' 
    });
  }
});

devkitRouter.get('/help', (req, res) => {
  res.json({ 
    ok: true, 
    help: getDevKitHelp(),
    commands: [
      'GET /api/atlas/devkit/endpoints - List all endpoints',
      'GET /api/atlas/devkit/endpoints?scope=<scope> - Filter by scope',
      'GET /api/atlas/devkit/endpoints?app=<appId> - Filter by app',
      'GET /api/atlas/devkit/endpoints/:key - Describe endpoint',
      'GET /api/atlas/devkit/apps - List all apps',
      'GET /api/atlas/devkit/flows - List compound flows',
      'GET /api/atlas/devkit/flows/:id - Get flow details',
      'GET /api/atlas/devkit/search?q=<query> - Search endpoints',
      'POST /api/atlas/devkit/query - Natural language query',
      'GET /api/atlas/devkit/stats - Quick stats',
    ],
    scopes: ['wallet', 'messages', 'storage', 'payments', 'anchors', 'dao', 'proxy', 'admin'],
  });
});

devkitRouter.post('/query', (req, res) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Query is required in request body' 
      });
    }
    
    const result = processDevKitQuery(query);
    res.json({
      ...result,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Query processing failed' 
    });
  }
});

devkitRouter.get('/stats', (req, res) => {
  try {
    const stats = getQuickStats();
    res.json({ 
      ok: true, 
      stats,
      ts: Date.now(),
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get stats' 
    });
  }
});
