import { loadRegistry, Registry, EndpointMeta } from './registry';
import { ensureScopes, Session, PermissionError, getMissingScopes, grantScopes } from './permissions';

export type CallArgs = Record<string, unknown>;

export interface CallResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  endpoint: string;
  app: string;
  version: string;
  timestamp: number;
}

export interface LauncherOptions {
  registryUrl?: string;
  onScopeRequest?: (missing: string[]) => Promise<boolean>;
  onNavigate?: (href: string) => void;
}

export class Launcher {
  private session: Session;
  private options: LauncherOptions;
  private registry: Registry | null = null;

  constructor(session: Session, options: LauncherOptions = {}) {
    this.session = session;
    this.options = options;
  }

  async loadRegistryIfNeeded(): Promise<Registry> {
    if (!this.registry) {
      this.registry = await loadRegistry(this.options.registryUrl);
    }
    return this.registry;
  }

  async discover(pattern?: string): Promise<string[]> {
    const reg = await this.loadRegistryIfNeeded();
    const keys = Object.keys(reg.endpoints);
    return pattern 
      ? keys.filter(k => k.toLowerCase().includes(pattern.toLowerCase())) 
      : keys;
  }

  async discoverApps(): Promise<string[]> {
    const reg = await this.loadRegistryIfNeeded();
    return Object.keys(reg.apps);
  }

  async discoverRoutes(pattern?: string): Promise<string[]> {
    const reg = await this.loadRegistryIfNeeded();
    const keys = Object.keys(reg.routes);
    return pattern 
      ? keys.filter(k => k.toLowerCase().includes(pattern.toLowerCase())) 
      : keys;
  }

  async getEndpointMeta(endpointKey: string): Promise<EndpointMeta | null> {
    const reg = await this.loadRegistryIfNeeded();
    return reg.endpoints[endpointKey] || null;
  }

  async open(routeKey: string): Promise<void> {
    const reg = await this.loadRegistryIfNeeded();
    const route = reg.routes[routeKey];
    
    if (!route) {
      throw new Error(`Route not found: ${routeKey}`);
    }

    if (this.options.onNavigate) {
      this.options.onNavigate(route.href);
    } else {
      window.location.href = route.href;
    }
  }

  async call<T = unknown>(endpointKey: string, args: CallArgs = {}): Promise<CallResult<T>> {
    const reg = await this.loadRegistryIfNeeded();
    const ep = reg.endpoints[endpointKey];
    
    if (!ep) {
      return {
        success: false,
        error: `Endpoint not found: ${endpointKey}`,
        endpoint: endpointKey,
        app: 'unknown',
        version: 'unknown',
        timestamp: Date.now(),
      };
    }

    const missing = getMissingScopes(this.session, ep.scopes);
    if (missing.length > 0) {
      if (this.options.onScopeRequest) {
        const granted = await this.options.onScopeRequest(missing);
        if (!granted) {
          return {
            success: false,
            error: `Permission denied: ${missing.join(', ')}`,
            endpoint: endpointKey,
            app: ep.app,
            version: ep.version,
            timestamp: Date.now(),
          };
        }
        this.session = grantScopes(this.session, missing);
      } else {
        try {
          ensureScopes(this.session, ep.scopes);
        } catch (error) {
          if (error instanceof PermissionError) {
            return {
              success: false,
              error: error.message,
              endpoint: endpointKey,
              app: ep.app,
              version: ep.version,
              timestamp: Date.now(),
            };
          }
          throw error;
        }
      }
    }

    try {
      const result = await this.executeEndpoint<T>(ep, args, endpointKey);
      return {
        success: true,
        data: result,
        endpoint: endpointKey,
        app: ep.app,
        version: ep.version,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: endpointKey,
        app: ep.app,
        version: ep.version,
        timestamp: Date.now(),
      };
    }
  }

  private async executeEndpoint<T>(_ep: EndpointMeta, args: CallArgs, endpointKey: string): Promise<T> {
    const apiMap: Record<string, { method: string; path: string | ((a: CallArgs) => string); transform?: (args: CallArgs) => any }> = {
      'messages.compose': { 
        method: 'POST', 
        path: '/api/nexus/messages/send',
        transform: (a) => ({ recipient: a.to, encryptedContent: a.body, messageType: 'text' })
      },
      'messages.list': { method: 'GET', path: '/api/nexus/messages/list' },
      'messages.read': {
        method: 'PATCH',
        path: (a) => `/api/nexus/messages/thread/${a.threadId}/read`,
      },
      'notes.create': { 
        method: 'POST', 
        path: '/api/nexus/notes',
        transform: (a) => ({ title: a.title, encryptedBody: a.body, isPinned: a.starred })
      },
      'notes.list': { method: 'GET', path: '/api/nexus/notes' },
      'notes.update': { 
        method: 'PATCH', 
        path: (a) => `/api/nexus/notes/${a.id || ''}`,
        transform: (a) => ({ title: a.title, encryptedBody: a.body })
      },
      'notes.delete': { 
        method: 'DELETE', 
        path: (a) => `/api/nexus/notes/${a.id || ''}`,
      },
      'calls.start': { 
        method: 'POST', 
        path: '/api/nexus/calls/start',
        transform: (a) => ({ type: a.type, targetWallet: a.target })
      },
      'calls.end': { 
        method: 'POST', 
        path: '/api/nexus/calls/end',
        transform: (a) => ({ callId: a.callId })
      },
      'payments.send': {
        method: 'POST',
        path: '/api/sdk/payments/send',
        transform: (a) => ({ recipient: a.to, amount: a.amount, token: a.token || 'ETH', memo: a.memo })
      },
      'payments.history': { 
        method: 'GET', 
        path: (a) => `/api/sdk/payments/history?limit=${a.limit || 20}`,
      },
      'anchors.create': { 
        method: 'POST', 
        path: '/api/sdk/anchor',
        transform: (a) => ({ appId: 'app.nexus', event: a.eventType || 'custom_event', data: a.payload || {}, anchor: true })
      },
      'anchors.verify': {
        method: 'GET',
        path: (a) => `/api/sdk/anchor/verify?anchorId=${a.anchorId}`,
      },
      'identity.attest': {
        method: 'POST',
        path: '/api/sdk/identity/attest',
        transform: (a) => ({ claim: a.claim, proof: a.proof })
      },
    };

    const mapping = apiMap[endpointKey];
    if (!mapping) {
      throw new Error(`No API mapping for endpoint: ${endpointKey}`);
    }

    const body = mapping.transform ? mapping.transform(args) : args;
    const path = typeof mapping.path === 'function' ? mapping.path(args) : mapping.path;
    const options: RequestInit = {
      method: mapping.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Wallet-Address': this.session.wallet,
      },
    };

    if (mapping.method !== 'GET' && mapping.method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(path, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || error.error || `Endpoint call failed: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    if (response.status === 204 || contentLength === '0' || !contentType?.includes('application/json')) {
      return { ok: true } as T;
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return { ok: true } as T;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { ok: true, raw: text } as T;
    }
  }

  updateSession(session: Session): void {
    this.session = session;
  }

  getSession(): Session {
    return this.session;
  }

  clearCache(): void {
    this.registry = null;
  }
}

let globalLauncher: Launcher | null = null;

export function initLauncher(session: Session, options?: LauncherOptions): Launcher {
  globalLauncher = new Launcher(session, options);
  return globalLauncher;
}

export function getLauncher(): Launcher | null {
  return globalLauncher;
}
