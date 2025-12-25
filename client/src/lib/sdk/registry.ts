export interface EndpointMeta {
  app: string;
  version: string;
  fn: string;
  args: Record<string, string>;
  scopes: string[];
  description?: string;
}

export interface RouteMeta {
  app: string;
  href: string;
  title?: string;
}

export interface AppMeta {
  id: string;
  name: string;
  version: string;
  entry: string;
  permissions: string[];
  description?: string;
  icon?: string;
  category?: string;
}

export interface Registry {
  apps: Record<string, AppMeta>;
  endpoints: Record<string, EndpointMeta>;
  routes: Record<string, RouteMeta>;
  version: string;
  buildTime: number;
}

let cachedRegistry: Registry | null = null;

export async function loadRegistry(url = '/api/sdk/registry'): Promise<Registry> {
  if (cachedRegistry) return cachedRegistry;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load registry: ${res.status}`);
    cachedRegistry = await res.json();
    return cachedRegistry!;
  } catch (error) {
    console.warn('Registry fetch failed, using local fallback');
    return getLocalRegistry();
  }
}

export function clearRegistryCache(): void {
  cachedRegistry = null;
}

export function getLocalRegistry(): Registry {
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
      'calls.start': {
        app: 'app.calls',
        version: '1.0.0',
        fn: 'startCall',
        args: { type: 'string', anchor: 'boolean' },
        scopes: ['media', 'anchors'],
        description: 'Start a voice or video call',
      },
      'anchors.create': {
        app: 'app.nexus',
        version: '1.4.0',
        fn: 'createAnchor',
        args: { eventType: 'string', payload: 'object' },
        scopes: ['anchors'],
        description: 'Create a blockchain anchor',
      },
    },
    routes: {
      'nexus.inbox': { app: 'app.nexus', href: '/app/messages', title: 'Message Inbox' },
      'nexus.compose': { app: 'app.nexus', href: '/app/messages?compose=true', title: 'Compose Message' },
      'notes.editor': { app: 'app.notes', href: '/app/notes', title: 'Notes Editor' },
      'calls.video': { app: 'app.calls', href: '/app/calls', title: 'Video Call' },
      'hub.discover': { app: 'app.hub', href: '/launcher', title: 'App Launcher' },
    },
  };
}

export function filterEndpoints(registry: Registry, pattern: string): string[] {
  return Object.keys(registry.endpoints).filter(key => 
    key.toLowerCase().includes(pattern.toLowerCase())
  );
}

export function getEndpointsByApp(registry: Registry, appId: string): string[] {
  return Object.entries(registry.endpoints)
    .filter(([_, meta]) => meta.app === appId)
    .map(([key]) => key);
}

export function getRoutesByApp(registry: Registry, appId: string): string[] {
  return Object.entries(registry.routes)
    .filter(([_, meta]) => meta.app === appId)
    .map(([key]) => key);
}
