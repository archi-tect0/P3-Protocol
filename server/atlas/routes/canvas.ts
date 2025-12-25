import { Router, Request, Response } from 'express';
import { manifestRegistry, type CanvasDisplay, type Visibility } from '../core/registry';
import { sessionStore } from '../core/sessions';
import { visualizationStore, type AtlasVisualizationSettings, type VisualizationTheme, type AccessibilitySettings } from '../core/visualization';
import { runCanvasParity, getParityStats } from '../core/parity';
import { registerOpenAPI } from '../ingest/openapi';
import { registerGraphQL } from '../ingest/graphql';
import { registerJSONSchemaEndpoint, registerJSONSchemaFlow, registerBulkJSONSchema } from '../ingest/jsonschema';
import { runManifestEndpoint, runManifestFlow, type ExecutionOptions } from '../core/executor';
import { flowEventBus } from '../../flows/eventBus';
import { syncAllToCanvasRegistry, getSyncStatus } from '../services/metaAdapter';
import { MsgPackCodec } from '../../protocol/encoding/codecs';
import { gzip as zlibGzip } from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlibGzip);
const msgpackCodec = new MsgPackCodec();

const router = Router();

router.get('/settings/themes', (_req: Request, res: Response) => {
  const themes = visualizationStore.getThemeMetadata();
  res.json({ ok: true, themes, count: themes.length });
});

router.get('/settings/:wallet', async (req: Request, res: Response) => {
  const { wallet } = req.params;
  if (!wallet) {
    res.status(400).json({ ok: false, error: 'Wallet address required' });
    return;
  }
  try {
    const settings = await visualizationStore.getSettings(wallet);
    res.json({ ok: true, settings });
  } catch (error) {
    console.error('Failed to get settings:', error);
    res.status(500).json({ ok: false, error: 'Failed to get settings' });
  }
});

router.post('/settings', async (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  const body = req.body;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  if (!body?.wallet || body.wallet.toLowerCase() !== wallet.toLowerCase()) {
    res.status(403).json({ ok: false, error: 'Wallet mismatch' });
    return;
  }
  
  if (!body?.visualization?.theme) {
    res.status(400).json({ ok: false, error: 'visualization.theme required' });
    return;
  }
  
  try {
    const saved = await visualizationStore.saveSettings(body);
    res.json({ ok: true, settings: saved });
  } catch (error) {
    console.error('Failed to save settings:', error);
    res.status(500).json({ ok: false, error: 'Failed to save settings' });
  }
});

router.patch('/settings/visualization', async (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  const updates = req.body as Partial<AtlasVisualizationSettings>;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  try {
    const updated = await visualizationStore.updateVisualization(wallet, updates);
    res.json({ ok: true, settings: updated });
  } catch (error) {
    console.error('Failed to update visualization:', error);
    res.status(500).json({ ok: false, error: 'Failed to update visualization' });
  }
});

router.patch('/settings/accessibility', async (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  const updates = req.body as Partial<AccessibilitySettings>;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  try {
    const updated = await visualizationStore.updateAccessibility(wallet, updates);
    res.json({ ok: true, settings: updated });
  } catch (error) {
    console.error('Failed to update accessibility:', error);
    res.status(500).json({ ok: false, error: 'Failed to update accessibility' });
  }
});

router.post('/settings/theme', async (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  const { theme } = req.body as { theme: VisualizationTheme };
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  if (!theme) {
    res.status(400).json({ ok: false, error: 'theme required' });
    return;
  }
  
  const validThemes = visualizationStore.listThemes();
  if (!validThemes.includes(theme)) {
    res.status(400).json({ ok: false, error: `Invalid theme. Valid: ${validThemes.join(', ')}` });
    return;
  }
  
  try {
    const updated = await visualizationStore.setTheme(wallet, theme);
    res.json({ ok: true, settings: updated });
  } catch (error) {
    console.error('Failed to set theme:', error);
    res.status(500).json({ ok: false, error: 'Failed to set theme' });
  }
});

router.post('/settings/color', async (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  const { colorPrimary, colorAccent } = req.body as { colorPrimary: string; colorAccent?: string };
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  if (!colorPrimary) {
    res.status(400).json({ ok: false, error: 'colorPrimary required' });
    return;
  }
  
  try {
    const updated = await visualizationStore.setColor(wallet, colorPrimary, colorAccent);
    res.json({ ok: true, settings: updated });
  } catch (error) {
    console.error('Failed to set color:', error);
    res.status(500).json({ ok: false, error: 'Failed to set color' });
  }
});

router.get('/settings/effective/:wallet', async (req: Request, res: Response) => {
  const { wallet } = req.params;
  const deviceId = req.query.device as string | undefined;
  
  if (!wallet) {
    res.status(400).json({ ok: false, error: 'Wallet address required' });
    return;
  }
  
  try {
    const effective = await visualizationStore.getEffectiveSettings(wallet, deviceId);
    res.json({ ok: true, visualization: effective, deviceId: deviceId || null });
  } catch (error) {
    console.error('Failed to get effective settings:', error);
    res.status(500).json({ ok: false, error: 'Failed to get effective settings' });
  }
});

interface HubMetadata {
  owner?: string;
  tags?: string[];
  description?: string;
  registeredAt: string;
  receiptsCount?: number;
}

interface HubDiscoveryEntry {
  key: string;
  name: string;
  type: 'endpoint' | 'flow';
  owner?: string;
  tags?: string[];
  visibility: Visibility;
  display: CanvasDisplay;
  source: string;
  receiptsCount?: number;
  registeredAt?: string;
}

const hubMetadataStore = new Map<string, HubMetadata>();

function getOrCreateHubMetadata(key: string): HubMetadata {
  if (!hubMetadataStore.has(key)) {
    hubMetadataStore.set(key, {
      registeredAt: new Date().toISOString(),
    });
  }
  return hubMetadataStore.get(key)!;
}

function updateHubMetadata(key: string, updates: Partial<HubMetadata>): HubMetadata {
  const existing = getOrCreateHubMetadata(key);
  const updated = { ...existing, ...updates };
  hubMetadataStore.set(key, updated);
  return updated;
}

router.get('/renderables', async (req: Request, res: Response) => {
  const renderables = manifestRegistry.getCanvasRenderables();
  const data = {
    ok: true,
    count: renderables.length,
    renderables,
  };
  
  const acceptHeader = req.headers['accept'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  try {
    if (acceptHeader.includes('application/msgpack') || acceptHeader.includes('application/x-msgpack')) {
      const encoded = msgpackCodec.encode(data);
      
      if (acceptEncoding.includes('gzip')) {
        const compressed = await gzip(Buffer.from(encoded));
        res.setHeader('Content-Type', 'application/msgpack');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('X-Atlas-Encoding', 'msgpack+gzip');
        res.send(compressed);
      } else {
        res.setHeader('Content-Type', 'application/msgpack');
        res.setHeader('X-Atlas-Encoding', 'msgpack');
        res.send(Buffer.from(encoded));
      }
    } else if (acceptEncoding.includes('gzip')) {
      const jsonBuffer = Buffer.from(JSON.stringify(data));
      const compressed = await gzip(jsonBuffer);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('X-Atlas-Encoding', 'json+gzip');
      res.send(compressed);
    } else {
      res.json(data);
    }
  } catch (error) {
    res.json(data);
  }
});

router.post('/sync', async (_req: Request, res: Response) => {
  try {
    const result = await syncAllToCanvasRegistry();
    res.json({
      ok: true,
      synced: result.synced,
      errors: result.errors,
      message: `Synced ${result.synced} Meta-Adapter endpoints to Canvas registry`,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  }
});

router.get('/sync/status', (_req: Request, res: Response) => {
  const status = getSyncStatus();
  res.json({
    ok: true,
    ...status,
  });
});

router.get('/endpoints', (_req: Request, res: Response) => {
  const endpoints = manifestRegistry.listEndpoints();
  res.json({
    ok: true,
    count: endpoints.length,
    endpoints: endpoints.map(ep => ({
      key: ep['devkit.key'],
      name: ep.name,
      method: ep.method,
      url: ep.url,
      visibility: ep['security.visibility'],
      display: ep['canvas.display'],
      source: ep.source,
      hasParams: Boolean(ep.params && Object.keys(ep.params).length > 0),
    })),
  });
});

router.get('/flows', (_req: Request, res: Response) => {
  const flows = manifestRegistry.listFlows();
  res.json({
    ok: true,
    count: flows.length,
    flows: flows.map(f => ({
      key: f['devkit.key'],
      name: f.name,
      description: f.description,
      stepCount: f.steps.length,
      steps: f.steps.map(s => ({ id: s.id, name: s.name })),
      visibility: f['security.visibility'],
      display: f['canvas.display'],
      source: f.source,
    })),
  });
});

router.get('/parity', async (_req: Request, res: Response) => {
  try {
    const report = await runCanvasParity();
    const stats = getParityStats();
    res.json({ ok: report.ok, report, stats });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/ingest/openapi', async (req: Request, res: Response) => {
  try {
    const { spec, overrides } = req.body;
    if (!spec) {
      res.status(400).json({ ok: false, error: 'spec required (JSON string or object)' });
      return;
    }
    const result = await registerOpenAPI(typeof spec === 'string' ? spec : JSON.stringify(spec), overrides);
    res.json({ ok: result.errors.length === 0, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/ingest/graphql', async (req: Request, res: Response) => {
  try {
    const { endpoint, headers } = req.body;
    if (!endpoint) {
      res.status(400).json({ ok: false, error: 'endpoint required' });
      return;
    }
    const result = await registerGraphQL(endpoint, headers);
    res.json({ ok: result.errors.length === 0, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/ingest/jsonschema', async (req: Request, res: Response) => {
  try {
    const { key, url, method, returns, visibility, title, subtitle, tags, phrases, actions } = req.body;
    if (!key || !url || !returns) {
      res.status(400).json({ ok: false, error: 'key, url, and returns required' });
      return;
    }
    const result = await registerJSONSchemaEndpoint({
      key,
      url,
      method: method || 'GET',
      returns,
      visibility,
      title,
      subtitle,
      tags,
      phrases,
      actions,
    });
    res.json({ ok: result.valid, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/ingest/jsonschema/flow', async (req: Request, res: Response) => {
  try {
    const { key, name, description, steps, visibility, tags } = req.body;
    if (!key || !name || !steps?.length) {
      res.status(400).json({ ok: false, error: 'key, name, and steps required' });
      return;
    }
    const result = await registerJSONSchemaFlow({ key, name, description, steps, visibility, tags });
    res.json({ ok: result.valid, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/ingest/jsonschema/bulk', async (req: Request, res: Response) => {
  try {
    const { specs } = req.body;
    if (!specs?.length) {
      res.status(400).json({ ok: false, error: 'specs array required' });
      return;
    }
    const result = await registerBulkJSONSchema(specs);
    res.json({ ok: result.errors.length === 0, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

type ManifestType = 'openapi' | 'graphql' | 'flow' | 'endpoint';

interface UnifiedRegisterResponse {
  ok: boolean;
  manifestId?: string;
  type: ManifestType;
  display?: import('../core/registry').CanvasDisplay;
  errors: string[];
}

function detectManifestType(payload: Record<string, unknown>): ManifestType {
  if (payload.openapi || payload.swagger || payload.paths) {
    return 'openapi';
  }
  
  if (payload.spec) {
    let specObj: Record<string, unknown> | null = null;
    if (typeof payload.spec === 'string') {
      try {
        specObj = JSON.parse(payload.spec);
      } catch {
        specObj = null;
      }
    } else if (typeof payload.spec === 'object' && payload.spec !== null) {
      specObj = payload.spec as Record<string, unknown>;
    }
    
    if (specObj && (specObj.openapi || specObj.swagger || specObj.paths)) {
      return 'openapi';
    }
  }
  
  if (payload.graphqlEndpoint || payload.introspection) {
    return 'graphql';
  }
  if (Array.isArray(payload.steps) && payload.steps.length > 0) {
    return 'flow';
  }
  return 'endpoint';
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ 
        ok: false, 
        type: 'endpoint',
        errors: ['Request body required'] 
      } as UnifiedRegisterResponse);
      return;
    }

    const manifestType = detectManifestType(payload);
    const canvasOverride = payload.canvas as Partial<import('../core/registry').CanvasDisplay> | undefined;
    let response: UnifiedRegisterResponse;

    switch (manifestType) {
      case 'openapi': {
        const spec = payload.openapi || payload.swagger || payload.paths 
          ? payload 
          : payload.spec;
        
        if (!spec) {
          response = { ok: false, type: 'openapi', errors: ['OpenAPI spec required'] };
          break;
        }

        const overrides: Record<string, Partial<import('../core/registry').CanvasDisplay>> = {};
        if (canvasOverride) {
          overrides['*'] = canvasOverride;
        }
        if (payload.overrides) {
          Object.assign(overrides, payload.overrides);
        }

        const result = await registerOpenAPI(
          typeof spec === 'string' ? spec : JSON.stringify(spec),
          Object.keys(overrides).length > 0 ? overrides : undefined
        );

        response = {
          ok: result.errors.length === 0,
          manifestId: result.keys[0],
          type: 'openapi',
          display: result.keys[0] ? manifestRegistry.getEndpoint(result.keys[0])?.['canvas.display'] : undefined,
          errors: result.errors,
        };
        break;
      }

      case 'graphql': {
        const endpoint = payload.graphqlEndpoint || payload.endpoint;
        const headers = payload.headers as Record<string, string> | undefined;

        if (!endpoint) {
          response = { ok: false, type: 'graphql', errors: ['graphqlEndpoint required'] };
          break;
        }

        const result = await registerGraphQL(endpoint, headers);

        const firstKey = result.queries[0] || result.mutations[0];
        response = {
          ok: result.errors.length === 0,
          manifestId: firstKey,
          type: 'graphql',
          display: firstKey ? (manifestRegistry.getEndpoint(firstKey) || manifestRegistry.getFlow(firstKey))?.['canvas.display'] : undefined,
          errors: result.errors,
        };
        break;
      }

      case 'flow': {
        const { key, name, description, steps, visibility, tags } = payload;

        if (!key || !name) {
          response = { 
            ok: false, 
            type: 'flow', 
            errors: ['key and name required for flow registration'] 
          };
          break;
        }

        const result = await registerJSONSchemaFlow({ 
          key, 
          name, 
          description, 
          steps, 
          visibility, 
          tags 
        });

        const registeredFlow = manifestRegistry.getFlow(key);
        let display = registeredFlow?.['canvas.display'];
        
        if (display && canvasOverride) {
          display = { ...display, ...canvasOverride };
          if (registeredFlow) {
            registeredFlow['canvas.display'] = display;
          }
        }

        response = {
          ok: result.valid,
          manifestId: result.key,
          type: 'flow',
          display,
          errors: result.errors,
        };
        break;
      }

      case 'endpoint':
      default: {
        const { key, url, method, returns, visibility, title, subtitle, tags, phrases, actions } = payload;

        if (!key || !url) {
          response = { 
            ok: false, 
            type: 'endpoint', 
            errors: ['key and url required for endpoint registration'] 
          };
          break;
        }

        const result = await registerJSONSchemaEndpoint({
          key,
          url,
          method: method || 'GET',
          returns: returns || { type: 'object' },
          visibility,
          title: canvasOverride?.title || title,
          subtitle: canvasOverride?.subtitle || subtitle,
          tags,
          phrases,
          actions: canvasOverride?.actions || actions,
        });

        const registeredEndpoint = manifestRegistry.getEndpoint(key);
        let display = registeredEndpoint?.['canvas.display'];
        
        if (display && canvasOverride) {
          display = { ...display, ...canvasOverride };
          if (registeredEndpoint) {
            registeredEndpoint['canvas.display'] = display;
          }
        }

        response = {
          ok: result.valid,
          manifestId: result.key,
          type: 'endpoint',
          display,
          errors: result.errors,
        };
        break;
      }
    }

    const statusCode = response.ok ? 200 : 400;
    res.status(statusCode).json(response);
  } catch (e) {
    res.status(500).json({ 
      ok: false, 
      type: 'endpoint',
      errors: [(e as Error).message] 
    } as UnifiedRegisterResponse);
  }
});

router.post('/execute/endpoint', async (req: Request, res: Response) => {
  try {
    const { key, params, debug } = req.body;
    const wallet = req.headers['x-wallet-address'] as string | undefined;
    
    if (!key) {
      res.status(400).json({ ok: false, error: 'key required' });
      return;
    }
    
    const options: ExecutionOptions = {};
    if (typeof debug === 'boolean') {
      options.debug = debug;
    }
    
    const result = await runManifestEndpoint(key, wallet, params, options);
    res.json({ ok: result.status === 'success', ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.post('/execute/flow', async (req: Request, res: Response) => {
  try {
    const { key, params, debug } = req.body;
    const wallet = req.headers['x-wallet-address'] as string | undefined;
    
    if (!key) {
      res.status(400).json({ ok: false, error: 'key required' });
      return;
    }
    
    const options: ExecutionOptions = {};
    if (typeof debug === 'boolean') {
      options.debug = debug;
    }
    
    const result = await runManifestFlow(key, wallet, params, options);
    res.json({ ok: result.status === 'success', ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

router.get('/stream/:flowId', (req: Request, res: Response) => {
  const { flowId } = req.params;
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const listener = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  flowEventBus.subscribe(flowId, listener, true);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    flowEventBus.unsubscribe(flowId, listener);
  });
});

router.get('/stream', (req: Request, res: Response) => {
  const flowId = req.query.flow as string;
  
  if (!flowId) {
    res.status(400).json({ ok: false, error: 'flow query param required' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const listener = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  flowEventBus.subscribe(flowId, listener, true);

  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    flowEventBus.unsubscribe(flowId, listener);
  });
});

router.get('/events/:flowId', (req: Request, res: Response) => {
  const { flowId } = req.params;
  const events = flowEventBus.getBufferedEvents(flowId);
  res.json({ ok: true, flowId, events, count: events.length });
});

router.get('/manifest/:key', (req: Request, res: Response) => {
  const key = decodeURIComponent(req.params.key);
  const endpoint = manifestRegistry.getEndpoint(key);
  const flow = manifestRegistry.getFlow(key);
  
  if (endpoint) {
    res.json({ ok: true, type: 'endpoint', manifest: endpoint });
  } else if (flow) {
    res.json({ ok: true, type: 'flow', manifest: flow });
  } else {
    res.status(404).json({ ok: false, error: 'Manifest not found' });
  }
});

router.get('/active-flows', (_req: Request, res: Response) => {
  const activeFlowIds = flowEventBus.getActiveFlowIds();
  const bufferedFlowIds = flowEventBus.getBufferedFlowIds();
  
  res.json({
    ok: true,
    active: activeFlowIds,
    buffered: bufferedFlowIds,
    totalActive: activeFlowIds.length,
    totalBuffered: bufferedFlowIds.length,
  });
});

router.get('/discover', (_req: Request, res: Response) => {
  const endpoints = manifestRegistry.listEndpoints();
  const flows = manifestRegistry.listFlows();
  
  const sources = { openapi: 0, graphql: 0, jsonschema: 0, atlas: 0 };
  
  const entries: HubDiscoveryEntry[] = [];
  
  for (const ep of endpoints) {
    const meta = hubMetadataStore.get(ep['devkit.key']);
    const source = ep.source || 'atlas';
    if (source in sources) {
      sources[source as keyof typeof sources]++;
    }
    
    entries.push({
      key: ep['devkit.key'],
      name: ep.name,
      type: 'endpoint',
      owner: meta?.owner,
      tags: meta?.tags || ep['telemetry.tags'],
      visibility: ep['security.visibility'],
      display: ep['canvas.display'],
      source: source,
      receiptsCount: meta?.receiptsCount,
      registeredAt: meta?.registeredAt,
    });
  }
  
  for (const f of flows) {
    const meta = hubMetadataStore.get(f['devkit.key']);
    const source = f.source || 'atlas';
    if (source in sources) {
      sources[source as keyof typeof sources]++;
    }
    
    entries.push({
      key: f['devkit.key'],
      name: f.name,
      type: 'flow',
      owner: meta?.owner,
      tags: meta?.tags || f['telemetry.tags'],
      visibility: f['security.visibility'],
      display: f['canvas.display'],
      source: source,
      receiptsCount: meta?.receiptsCount,
      registeredAt: meta?.registeredAt,
    });
  }

  res.json({
    ok: true,
    count: entries.length,
    entries,
    sources,
  });
});

router.post('/discover/publish', (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  const { key, tags, description } = req.body;
  
  if (!key) {
    res.status(400).json({ ok: false, error: 'key required' });
    return;
  }
  
  const endpoint = manifestRegistry.getEndpoint(key);
  const flow = manifestRegistry.getFlow(key);
  
  if (!endpoint && !flow) {
    res.status(404).json({ ok: false, error: 'Manifest not found. Register it first via /register' });
    return;
  }
  
  const metadata = updateHubMetadata(key, {
    owner: wallet,
    tags: tags,
    description: description,
    registeredAt: hubMetadataStore.get(key)?.registeredAt || new Date().toISOString(),
  });
  
  const manifest = endpoint || flow;
  const type = endpoint ? 'endpoint' : 'flow';
  
  const entry: HubDiscoveryEntry = {
    key,
    name: manifest!.name,
    type: type as 'endpoint' | 'flow',
    owner: metadata.owner,
    tags: metadata.tags,
    visibility: manifest!['security.visibility'],
    display: manifest!['canvas.display'],
    source: manifest!.source || 'atlas',
    receiptsCount: metadata.receiptsCount,
    registeredAt: metadata.registeredAt,
  };
  
  res.json({
    ok: true,
    published: true,
    entry,
  });
});

router.get('/discover/search', (req: Request, res: Response) => {
  const { type, tag, visibility, owner } = req.query;
  
  const endpoints = manifestRegistry.listEndpoints();
  const flows = manifestRegistry.listFlows();
  
  let entries: HubDiscoveryEntry[] = [];
  
  for (const ep of endpoints) {
    const meta = hubMetadataStore.get(ep['devkit.key']);
    entries.push({
      key: ep['devkit.key'],
      name: ep.name,
      type: 'endpoint',
      owner: meta?.owner,
      tags: meta?.tags || ep['telemetry.tags'],
      visibility: ep['security.visibility'],
      display: ep['canvas.display'],
      source: ep.source || 'atlas',
      receiptsCount: meta?.receiptsCount,
      registeredAt: meta?.registeredAt,
    });
  }
  
  for (const f of flows) {
    const meta = hubMetadataStore.get(f['devkit.key']);
    entries.push({
      key: f['devkit.key'],
      name: f.name,
      type: 'flow',
      owner: meta?.owner,
      tags: meta?.tags || f['telemetry.tags'],
      visibility: f['security.visibility'],
      display: f['canvas.display'],
      source: f.source || 'atlas',
      receiptsCount: meta?.receiptsCount,
      registeredAt: meta?.registeredAt,
    });
  }
  
  if (type && (type === 'endpoint' || type === 'flow')) {
    entries = entries.filter(e => e.type === type);
  }
  
  if (tag) {
    const searchTags = (tag as string).split(',').map(t => t.trim().toLowerCase());
    entries = entries.filter(e => {
      if (!e.tags || e.tags.length === 0) return false;
      const entryTags = e.tags.map(t => t.toLowerCase());
      return searchTags.some(st => entryTags.includes(st));
    });
  }
  
  if (visibility && (visibility === 'public' || visibility === 'wallet-gated' || visibility === 'admin-only')) {
    entries = entries.filter(e => e.visibility === visibility);
  }
  
  if (owner) {
    const ownerSearch = (owner as string).toLowerCase();
    entries = entries.filter(e => e.owner?.toLowerCase() === ownerSearch);
  }
  
  res.json({
    ok: true,
    count: entries.length,
    entries,
    filters: {
      type: type || null,
      tag: tag || null,
      visibility: visibility || null,
      owner: owner || null,
    },
  });
});

router.get('/session', (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  const session = sessionStore.getSession(wallet);
  res.json({ ok: true, session });
});

router.post('/session/pin', (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  const { key, type } = req.body;
  
  if (!key || !type) {
    res.status(400).json({ ok: false, error: 'key and type required' });
    return;
  }
  
  if (type !== 'flow' && type !== 'endpoint') {
    res.status(400).json({ ok: false, error: 'type must be flow or endpoint' });
    return;
  }
  
  let session;
  if (type === 'flow') {
    session = sessionStore.pinFlow(wallet, key);
  } else {
    session = sessionStore.pinEndpoint(wallet, key);
  }
  
  res.json({ ok: true, session });
});

router.delete('/session/pin', (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  const { key, type } = req.body;
  
  if (!key || !type) {
    res.status(400).json({ ok: false, error: 'key and type required' });
    return;
  }
  
  if (type !== 'flow' && type !== 'endpoint') {
    res.status(400).json({ ok: false, error: 'type must be flow or endpoint' });
    return;
  }
  
  let session;
  if (type === 'flow') {
    session = sessionStore.unpinFlow(wallet, key);
  } else {
    session = sessionStore.unpinEndpoint(wallet, key);
  }
  
  res.json({ ok: true, session });
});

router.post('/session/preferences', (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  const { debugMode, theme, layout } = req.body;
  
  let session = sessionStore.getSession(wallet);
  
  if (typeof debugMode === 'boolean') {
    session = sessionStore.setPreference(wallet, 'debugMode', debugMode);
  }
  
  if (theme === 'light' || theme === 'dark') {
    session = sessionStore.setPreference(wallet, 'theme', theme);
  }
  
  if (layout === 'grid' || layout === 'list') {
    session = sessionStore.setPreference(wallet, 'layout', layout);
  }
  
  res.json({ ok: true, session });
});

router.get('/session/history', (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'x-wallet-address header required' });
    return;
  }
  
  const session = sessionStore.getSession(wallet);
  res.json({ 
    ok: true, 
    history: session.flowHistory,
    count: session.flowHistory.length,
  });
});

export default router;
