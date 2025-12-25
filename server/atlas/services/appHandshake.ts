import { loadRegistry, getEndpointsForApp } from './registryAdapter';
import type { Scope } from '../types';

export interface HandshakePayload {
  appId: string;
  name: string;
  version: string;
  supportedEndpoints: string[];
  requestedScopes: Scope[];
  events: Array<{ key: string; description?: string }>;
  adapter?: string;
}

export interface AppBindRequest {
  appId: string;
  wallet: string;
  requestedScopes: Scope[];
  callbackUrl?: string;
}

export interface AppBindResponse {
  ok: boolean;
  sessionToken?: string;
  grantedScopes?: Scope[];
  expiresAt?: number;
  error?: string;
}

const APP_EVENTS: Record<string, Array<{ key: string; description?: string }>> = {
  'messages.app': [
    { key: 'messages.received', description: 'New message received' },
    { key: 'messages.read', description: 'Message marked as read' },
  ],
  'notes.app': [
    { key: 'notes.created', description: 'New note created' },
    { key: 'notes.updated', description: 'Note updated' },
  ],
  'gallery.app': [
    { key: 'gallery.uploaded', description: 'Photo uploaded' },
    { key: 'gallery.deleted', description: 'Photo deleted' },
  ],
  'market.app': [
    { key: 'marketplace.sale', description: 'Item sold' },
    { key: 'marketplace.listed', description: 'New listing created' },
  ],
  'metrics.app': [
    { key: 'metrics.updated', description: 'Metrics refreshed' },
    { key: 'metrics.threshold', description: 'Threshold triggered' },
  ],
  'logs.app': [
    { key: 'logs.error', description: 'Error logged' },
    { key: 'logs.warning', description: 'Warning logged' },
  ],
  'payments.app': [
    { key: 'payments.sent', description: 'Payment sent' },
    { key: 'payments.received', description: 'Payment received' },
  ],
  'dao.app': [
    { key: 'dao.proposal', description: 'New proposal created' },
    { key: 'dao.vote', description: 'Vote cast' },
  ],
};

export function handshakeForApp(appId: string): HandshakePayload | null {
  const registry = loadRegistry();
  const app = registry.apps[appId];
  
  if (!app) return null;

  const endpoints = getEndpointsForApp(appId);
  const supportedEndpoints = endpoints.map(ep => ep.key);

  return {
    appId,
    name: app.name || appId,
    version: app.version || '1.0.0',
    supportedEndpoints,
    requestedScopes: (app.permissions || []) as Scope[],
    events: APP_EVENTS[appId] || [],
    adapter: app.adapter,
  };
}

export function getAllAppHandshakes(): HandshakePayload[] {
  const registry = loadRegistry();
  const handshakes: HandshakePayload[] = [];
  
  for (const appId of Object.keys(registry.apps)) {
    const handshake = handshakeForApp(appId);
    if (handshake) {
      handshakes.push(handshake);
    }
  }
  
  return handshakes;
}

export function validateBindRequest(request: AppBindRequest): { valid: boolean; error?: string } {
  if (!request.appId) {
    return { valid: false, error: 'appId is required' };
  }
  
  if (!request.wallet || !/^0x[a-fA-F0-9]{40}$/.test(request.wallet)) {
    return { valid: false, error: 'Valid wallet address is required' };
  }
  
  const registry = loadRegistry();
  if (!registry.apps[request.appId]) {
    return { valid: false, error: 'App not found in registry' };
  }
  
  return { valid: true };
}

export function getAppCapabilities(appId: string): {
  endpoints: string[];
  scopes: Scope[];
  events: string[];
} {
  const handshake = handshakeForApp(appId);
  
  if (!handshake) {
    return { endpoints: [], scopes: [], events: [] };
  }
  
  return {
    endpoints: handshake.supportedEndpoints,
    scopes: handshake.requestedScopes,
    events: handshake.events.map(e => e.key),
  };
}
