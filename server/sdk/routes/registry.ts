import { Router, Request, Response } from 'express';

const router = Router();

interface EndpointMeta {
  app: string;
  version: string;
  fn: string;
  args: Record<string, string>;
  scopes: string[];
  description?: string;
}

interface RouteMeta {
  app: string;
  href: string;
  title?: string;
}

interface AppMeta {
  id: string;
  name: string;
  version: string;
  entry: string;
  permissions: string[];
  description?: string;
  category?: string;
}

interface Registry {
  apps: Record<string, AppMeta>;
  endpoints: Record<string, EndpointMeta>;
  routes: Record<string, RouteMeta>;
  version: string;
  buildTime: number;
}

function buildRegistry(): Registry {
  return {
    version: '1.0.0',
    buildTime: Date.now(),
    apps: {
      'app.nexus': {
        id: 'app.nexus',
        name: 'Nexus',
        version: '1.4.0',
        entry: '/app',
        permissions: ['wallet', 'messages', 'anchors', 'storage'],
        description: 'Encrypted messaging and calls',
        category: 'communication',
      },
      'app.hub': {
        id: 'app.hub',
        name: 'Hub',
        version: '1.0.0',
        entry: '/launcher',
        permissions: ['wallet', 'storage'],
        description: 'App launcher and dashboard',
        category: 'system',
      },
      'app.notes': {
        id: 'app.notes',
        name: 'Notes',
        version: '1.0.0',
        entry: '/app/notes',
        permissions: ['storage', 'anchors'],
        description: 'Encrypted note-taking',
        category: 'productivity',
      },
      'app.calls': {
        id: 'app.calls',
        name: 'Calls',
        version: '1.0.0',
        entry: '/app/calls',
        permissions: ['wallet', 'media', 'anchors'],
        description: 'Voice and video calls',
        category: 'communication',
      },
      'app.payments': {
        id: 'app.payments',
        name: 'Payments',
        version: '1.0.0',
        entry: '/app/payments',
        permissions: ['wallet', 'payments', 'anchors'],
        description: 'Send and receive payments',
        category: 'payments',
      },
    },
    endpoints: {
      'messages.compose': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'composeMessage',
        args: { to: 'string', body: 'string', attachments: 'string[]' },
        scopes: ['messages'],
        description: 'Compose and send an encrypted message',
      },
      'messages.list': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'listMessages',
        args: { limit: 'number', offset: 'number' },
        scopes: ['messages'],
        description: 'List message threads',
      },
      'messages.read': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'markAsRead',
        args: { threadId: 'string' },
        scopes: ['messages'],
        description: 'Mark a thread as read',
      },
      'notes.create': {
        app: 'app.notes',
        version: '1.0.0',
        fn: 'createNote',
        args: { title: 'string', body: 'string', starred: 'boolean' },
        scopes: ['storage'],
        description: 'Create a new encrypted note',
      },
      'notes.list': {
        app: 'app.notes',
        version: '1.0.0',
        fn: 'listNotes',
        args: { filter: 'string' },
        scopes: ['storage'],
        description: 'List all notes',
      },
      'notes.update': {
        app: 'app.notes',
        version: '1.0.0',
        fn: 'updateNote',
        args: { id: 'string', title: 'string', body: 'string' },
        scopes: ['storage'],
        description: 'Update an existing note',
      },
      'notes.delete': {
        app: 'app.notes',
        version: '1.0.0',
        fn: 'deleteNote',
        args: { id: 'string' },
        scopes: ['storage'],
        description: 'Delete a note',
      },
      'calls.start': {
        app: 'app.calls',
        version: '1.0.0',
        fn: 'startCall',
        args: { type: 'string', target: 'string', anchor: 'boolean' },
        scopes: ['media', 'anchors'],
        description: 'Start a voice or video call',
      },
      'calls.end': {
        app: 'app.calls',
        version: '1.0.0',
        fn: 'endCall',
        args: { callId: 'string' },
        scopes: ['media'],
        description: 'End an active call',
      },
      'payments.send': {
        app: 'app.payments',
        version: '1.0.0',
        fn: 'sendPayment',
        args: { to: 'string', amount: 'string', token: 'string', memo: 'string' },
        scopes: ['wallet', 'payments'],
        description: 'Send a payment',
      },
      'payments.history': {
        app: 'app.payments',
        version: '1.0.0',
        fn: 'getPaymentHistory',
        args: { limit: 'number' },
        scopes: ['payments'],
        description: 'Get payment history',
      },
      'anchors.create': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'createAnchor',
        args: { eventType: 'string', payload: 'object' },
        scopes: ['anchors'],
        description: 'Create a blockchain anchor',
      },
      'anchors.verify': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'verifyAnchor',
        args: { anchorId: 'string' },
        scopes: ['anchors'],
        description: 'Verify an existing anchor',
      },
      'identity.attest': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'createAttestation',
        args: { claim: 'string', proof: 'object' },
        scopes: ['wallet', 'anchors'],
        description: 'Create an identity attestation',
      },
    },
    routes: {
      'nexus.inbox': { app: 'app.nexus', href: '/app/messages', title: 'Message Inbox' },
      'nexus.compose': { app: 'app.nexus', href: '/app/messages?compose=true', title: 'Compose Message' },
      'nexus.settings': { app: 'app.nexus', href: '/app/settings', title: 'Settings' },
      'notes.editor': { app: 'app.notes', href: '/app/notes', title: 'Notes Editor' },
      'calls.video': { app: 'app.calls', href: '/app/calls', title: 'Video Call' },
      'calls.voice': { app: 'app.calls', href: '/app/voice', title: 'Voice Call' },
      'payments.send': { app: 'app.payments', href: '/app/payments', title: 'Send Payment' },
      'payments.history': { app: 'app.payments', href: '/app/payments/history', title: 'Payment History' },
      'hub.discover': { app: 'app.hub', href: '/launcher', title: 'App Launcher' },
      'hub.settings': { app: 'app.hub', href: '/launcher/settings', title: 'Hub Settings' },
    },
  };
}

let cachedRegistry: Registry | null = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

router.get('/', (req: Request, res: Response) => {
  const now = Date.now();
  
  if (!cachedRegistry || now - cacheTime > CACHE_TTL) {
    cachedRegistry = buildRegistry();
    cacheTime = now;
  }
  
  res.json(cachedRegistry);
});

router.get('/apps', (req: Request, res: Response) => {
  const registry = buildRegistry();
  res.json({ apps: Object.values(registry.apps) });
});

router.get('/apps/:appId', (req: Request, res: Response) => {
  const { appId } = req.params;
  const registry = buildRegistry();
  const app = registry.apps[appId];
  
  if (!app) {
    res.status(404).json({ error: 'App not found' });
    return;
  }
  
  const endpoints = Object.entries(registry.endpoints)
    .filter(([_, meta]) => meta.app === appId)
    .map(([key, meta]) => ({ key, ...meta }));
  
  const routes = Object.entries(registry.routes)
    .filter(([_, meta]) => meta.app === appId)
    .map(([key, meta]) => ({ key, ...meta }));
  
  res.json({ app, endpoints, routes });
});

router.get('/endpoints', (req: Request, res: Response) => {
  const { app, scope, search } = req.query;
  const registry = buildRegistry();
  
  let endpoints = Object.entries(registry.endpoints);
  
  if (app) {
    endpoints = endpoints.filter(([_, meta]) => meta.app === app);
  }
  
  if (scope) {
    endpoints = endpoints.filter(([_, meta]) => meta.scopes.includes(scope as string));
  }
  
  if (search) {
    const searchLower = (search as string).toLowerCase();
    endpoints = endpoints.filter(([key]) => key.toLowerCase().includes(searchLower));
  }
  
  res.json({
    endpoints: endpoints.map(([key, meta]) => ({ key, ...meta })),
  });
});

router.get('/routes', (req: Request, res: Response) => {
  const { app } = req.query;
  const registry = buildRegistry();
  
  let routes = Object.entries(registry.routes);
  
  if (app) {
    routes = routes.filter(([_, meta]) => meta.app === app);
  }
  
  res.json({
    routes: routes.map(([key, meta]) => ({ key, ...meta })),
  });
});

router.get('/version', (req: Request, res: Response) => {
  const registry = buildRegistry();
  res.json({
    version: registry.version,
    buildTime: registry.buildTime,
    appCount: Object.keys(registry.apps).length,
    endpointCount: Object.keys(registry.endpoints).length,
    routeCount: Object.keys(registry.routes).length,
  });
});

export default router;
