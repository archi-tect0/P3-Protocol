import express, { Request, Response } from 'express';
import {
  initializeMetaAdapter,
  refreshMetaAdapter,
  getMetaAdapterStatus,
  isMetaAdapterReady,
  getAllApis,
  searchApis,
  getApisByCategory,
  getAllAutoEndpoints,
  searchAutoEndpoints,
  getAutoEndpoint,
  describeAutoEndpoint,
  listAutoFlows,
  getAutoFlow,
  describeFlow,
  executeAutoEndpoint,
  executeAutoFlow,
  executeParallelFlow,
  quickDemo,
  getExecutableEndpoints,
  getExecutableFlows,
  getStats,
  getFlowStats,
  executeWeb3Endpoint,
  getWeb3EndpointsList,
  getWeb3Stats,
  web3Demo,
  getWeb3FlowTemplates,
  getWeb3Flow,
} from './services/metaAdapter';

export const metaAdapterRouter = express.Router();

metaAdapterRouter.get('/status', (req: Request, res: Response) => {
  const status = getMetaAdapterStatus();
  res.json({
    ok: true,
    ...status,
    'data-testid': 'meta-adapter-status',
  });
});

metaAdapterRouter.get('/help', (req: Request, res: Response) => {
  res.json({
    ok: true,
    help: `Atlas Meta-Adapter - Auto-integrated Public APIs

This system auto-ingests 50+ free public APIs and exposes them through Atlas.

Endpoints:
- GET  /api/atlas/meta/status - Meta-adapter status and stats
- GET  /api/atlas/meta/apis - List all auto-integrated APIs
- GET  /api/atlas/meta/apis/search?q=weather - Search APIs
- GET  /api/atlas/meta/apis/category/:category - APIs by category
- GET  /api/atlas/meta/endpoints - List all auto-registered endpoints
- GET  /api/atlas/meta/endpoints/:key - Get endpoint details
- GET  /api/atlas/meta/flows - List auto-generated flows
- GET  /api/atlas/meta/flows/:id - Get flow details
- POST /api/atlas/meta/execute - Execute an endpoint { key, params? }
- POST /api/atlas/meta/flow - Execute a flow { flowId, params?, parallel? }
- POST /api/atlas/meta/refresh - Refresh from external sources
- GET  /api/atlas/meta/demo - Quick demo of API calls

Categories: Weather, Entertainment, Cryptocurrency, Animals, Science, Games, Food & Drink, Calendar, Books, Geocoding, Open Data

Example flows:
- weather-and-joke: Weather + random joke
- crypto-and-news: Crypto prices + holidays
- fun-facts: Dog pic + cat fact + quote
- morning-brief: Weather + holiday + quote`,
    categories: [
      'Weather', 'Entertainment', 'Cryptocurrency', 'Animals', 'Science',
      'Games', 'Food & Drink', 'Calendar', 'Books', 'Geocoding', 'Open Data'
    ],
    'data-testid': 'meta-adapter-help',
  });
});

metaAdapterRouter.post('/init', async (req: Request, res: Response) => {
  try {
    const result = await initializeMetaAdapter();
    res.json({
      ok: result.success,
      ...result,
      'data-testid': 'meta-adapter-init',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Init failed',
    });
  }
});

metaAdapterRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const result = await refreshMetaAdapter();
    res.json({
      ok: result.success,
      ...result,
      'data-testid': 'meta-adapter-refresh',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Refresh failed',
    });
  }
});

metaAdapterRouter.get('/apis', (req: Request, res: Response) => {
  const apis = getAllApis();
  res.json({
    ok: true,
    apis: apis.map(a => ({
      name: a.name,
      description: a.description,
      category: a.category,
      auth: a.auth,
      baseUrl: a.baseUrl,
      endpoints: a.endpoints.length,
      qualityScore: a.qualityScore,
    })),
    count: apis.length,
    'data-testid': 'meta-adapter-apis',
  });
});

metaAdapterRouter.get('/apis/search', (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const apis = searchApis(query);
  res.json({
    ok: true,
    query,
    apis: apis.map(a => ({
      name: a.name,
      description: a.description,
      category: a.category,
      auth: a.auth,
    })),
    count: apis.length,
    'data-testid': 'meta-adapter-search',
  });
});

metaAdapterRouter.get('/apis/category/:category', (req: Request, res: Response) => {
  const { category } = req.params;
  const apis = getApisByCategory(category);
  res.json({
    ok: true,
    category,
    apis: apis.map(a => ({
      name: a.name,
      description: a.description,
      auth: a.auth,
    })),
    count: apis.length,
    'data-testid': 'meta-adapter-category',
  });
});

metaAdapterRouter.get('/endpoints', (req: Request, res: Response) => {
  const endpoints = getAllAutoEndpoints();
  res.json({
    ok: true,
    endpoints: endpoints.map(e => ({
      key: e.key,
      apiName: e.apiName,
      endpoint: e.fn,
      description: e.description,
      category: e.category,
      auth: e.auth,
    })),
    count: endpoints.length,
    'data-testid': 'meta-adapter-endpoints',
  });
});

metaAdapterRouter.get('/endpoints/search', (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const endpoints = searchAutoEndpoints(query);
  res.json({
    ok: true,
    query,
    endpoints: endpoints.map(e => ({
      key: e.key,
      apiName: e.apiName,
      description: e.description,
      category: e.category,
    })),
    count: endpoints.length,
    'data-testid': 'meta-adapter-endpoint-search',
  });
});

metaAdapterRouter.get('/endpoints/:key', (req: Request, res: Response) => {
  const key = req.params.key.replace(/-/g, '.');
  const endpoint = getAutoEndpoint(key);
  
  if (!endpoint) {
    return res.status(404).json({
      ok: false,
      error: `Endpoint not found: ${key}`,
    });
  }

  res.json({
    ok: true,
    endpoint,
    description: describeAutoEndpoint(key),
    'data-testid': 'meta-adapter-endpoint-detail',
  });
});

metaAdapterRouter.get('/flows', (req: Request, res: Response) => {
  const flows = listAutoFlows();
  res.json({
    ok: true,
    flows: flows.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      steps: f.steps.length,
      categories: f.categories,
    })),
    count: flows.length,
    stats: getFlowStats(),
    'data-testid': 'meta-adapter-flows',
  });
});

metaAdapterRouter.get('/flows/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const flow = getAutoFlow(id);
  
  if (!flow) {
    return res.status(404).json({
      ok: false,
      error: `Flow not found: ${id}`,
    });
  }

  res.json({
    ok: true,
    flow,
    description: describeFlow(id),
    'data-testid': 'meta-adapter-flow-detail',
  });
});

metaAdapterRouter.post('/execute', async (req: Request, res: Response) => {
  const { key, params = {} } = req.body;
  
  if (!key) {
    return res.status(400).json({
      ok: false,
      error: 'Endpoint key is required',
    });
  }

  try {
    const result = await executeAutoEndpoint(key, params);
    res.json({
      ok: result.success,
      ...result,
      'data-testid': 'meta-adapter-execute',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    });
  }
});

metaAdapterRouter.post('/flow', async (req: Request, res: Response) => {
  const { flowId, params = {}, parallel = false } = req.body;
  
  if (!flowId) {
    return res.status(400).json({
      ok: false,
      error: 'Flow ID is required',
    });
  }

  try {
    const result = parallel
      ? await executeParallelFlow(flowId, params)
      : await executeAutoFlow(flowId, params);
    
    res.json({
      ok: result.success,
      ...result,
      'data-testid': 'meta-adapter-flow-execute',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Flow execution failed',
    });
  }
});

metaAdapterRouter.get('/demo', async (req: Request, res: Response) => {
  try {
    const result = await quickDemo();
    res.json({
      ok: result.success,
      ...result,
      'data-testid': 'meta-adapter-demo',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Demo failed',
    });
  }
});

metaAdapterRouter.get('/executable', (req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoints: getExecutableEndpoints(),
    flows: getExecutableFlows(),
    'data-testid': 'meta-adapter-executable',
  });
});

// Web3 Routes
metaAdapterRouter.get('/web3/status', (req: Request, res: Response) => {
  res.json({
    ok: true,
    ...getWeb3Stats(),
    endpoints: getWeb3EndpointsList(),
    flows: getWeb3FlowTemplates().map(f => ({
      id: f.id,
      name: f.name,
      description: f.description,
      steps: f.steps.length,
    })),
    'data-testid': 'web3-status',
  });
});

metaAdapterRouter.get('/web3/endpoints', (req: Request, res: Response) => {
  res.json({
    ok: true,
    endpoints: getWeb3EndpointsList(),
    count: getWeb3EndpointsList().length,
    'data-testid': 'web3-endpoints',
  });
});

metaAdapterRouter.get('/web3/flows', (req: Request, res: Response) => {
  res.json({
    ok: true,
    flows: getWeb3FlowTemplates(),
    count: getWeb3FlowTemplates().length,
    'data-testid': 'web3-flows',
  });
});

metaAdapterRouter.get('/web3/flows/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const flow = getWeb3Flow(id);
  
  if (!flow) {
    return res.status(404).json({
      ok: false,
      error: `Web3 flow not found: ${id}`,
    });
  }

  res.json({
    ok: true,
    flow,
    'data-testid': 'web3-flow-detail',
  });
});

metaAdapterRouter.post('/web3/execute', async (req: Request, res: Response) => {
  const { key, params = {} } = req.body;
  
  if (!key) {
    return res.status(400).json({
      ok: false,
      error: 'Endpoint key is required',
    });
  }

  try {
    const result = await executeWeb3Endpoint(key, params);
    res.json({
      ok: result.success,
      ...result,
      'data-testid': 'web3-execute',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Web3 execution failed',
    });
  }
});

metaAdapterRouter.post('/web3/flow', async (req: Request, res: Response) => {
  const { flowId, address, chain = 'eth' } = req.body;
  
  if (!flowId) {
    return res.status(400).json({
      ok: false,
      error: 'Flow ID is required',
    });
  }

  if (!address) {
    return res.status(400).json({
      ok: false,
      error: 'Wallet address is required',
    });
  }

  const flow = getWeb3Flow(flowId);
  if (!flow) {
    return res.status(404).json({
      ok: false,
      error: `Web3 flow not found: ${flowId}`,
    });
  }

  try {
    const results = [];
    for (const step of flow.steps) {
      const result = await executeWeb3Endpoint(step.key, { address, chain });
      results.push({
        step: step.name,
        ...result,
      });
      
      if (!result.success && !step.optional) {
        break;
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      ok: successCount > 0,
      flowId,
      flowName: flow.name,
      steps: results,
      success: successCount === results.length,
      message: `Executed ${successCount}/${results.length} steps`,
      'data-testid': 'web3-flow-execute',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Web3 flow execution failed',
    });
  }
});

metaAdapterRouter.get('/web3/demo', async (req: Request, res: Response) => {
  const address = (req.query.address as string) || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik's address for demo
  
  try {
    const result = await web3Demo(address);
    res.json({
      ok: result.success,
      address,
      ...result,
      'data-testid': 'web3-demo',
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Web3 demo failed',
    });
  }
});
