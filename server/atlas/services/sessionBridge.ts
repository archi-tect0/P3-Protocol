import type { Session, Scope } from '../types';
import { atlasConfig } from '../config';
import { getEndpointsForApp, loadRegistry } from './registryAdapter';
import crypto from 'crypto';

const sessions = new Map<string, Session>();
const tokenToWallet = new Map<string, string>();

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function startSession(
  wallet: string,
  roles: ('admin' | 'moderator' | 'user')[] = ['user']
): Session {
  const normalizedWallet = wallet.toLowerCase();
  
  // Revoke any existing session token for this wallet
  const existingSession = sessions.get(normalizedWallet);
  if (existingSession?.token) {
    tokenToWallet.delete(existingSession.token);
  }
  
  const token = generateSessionToken();
  
  const session: Session = {
    wallet: normalizedWallet,
    token,
    roles,
    grants: [...atlasConfig.autoConsentScopes],
    connectedApps: [],
    capabilityMap: {},
    expiresAt: Date.now() + atlasConfig.sessionTTL,
  };
  
  sessions.set(normalizedWallet, session);
  tokenToWallet.set(token, normalizedWallet);
  
  const registry = loadRegistry();
  for (const [appId, app] of Object.entries(registry.apps)) {
    const appScopes = app.permissions as Scope[];
    if (appScopes.every(scope => session.grants.includes(scope))) {
      session.connectedApps.push(appId);
      const endpoints = getEndpointsForApp(appId)
        .filter(({ meta }) => meta.scopes.every(scope => session.grants.includes(scope)));
      session.capabilityMap[appId] = endpoints.map(ep => ep.key);
    }
  }
  
  return session;
}

export function connectApps(
  wallet: string,
  appIds: string[],
  consentScopes: Scope[] = []
): Session {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  
  if (!session) {
    throw new Error('No active session for wallet');
  }
  
  const registry = loadRegistry();
  
  const grantSet = new Set<Scope>(session.grants);
  for (const scope of consentScopes) {
    if (atlasConfig.consentScopes.includes(scope)) {
      grantSet.add(scope);
    }
  }
  session.grants = [...grantSet];
  
  const connectedSet = new Set(session.connectedApps);
  
  for (const appId of appIds) {
    if (!registry.apps[appId]) continue;
    
    connectedSet.add(appId);
    
    const endpoints = getEndpointsForApp(appId)
      .filter(({ meta }) => 
        meta.scopes.every(scope => grantSet.has(scope))
      );
    
    session.capabilityMap[appId] = endpoints.map(ep => ep.key);
  }
  
  session.connectedApps = [...connectedSet];
  
  return session;
}

export function disconnectApps(wallet: string, appIds: string[]): Session {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  
  if (!session) {
    throw new Error('No active session for wallet');
  }
  
  for (const appId of appIds) {
    session.connectedApps = session.connectedApps.filter(id => id !== appId);
    delete session.capabilityMap[appId];
  }
  
  return session;
}

export function getSession(wallet: string): Session | null {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  
  if (!session) return null;
  
  if (Date.now() > session.expiresAt) {
    tokenToWallet.delete(session.token);
    sessions.delete(normalizedWallet);
    return null;
  }
  
  return session;
}

export function validateSessionToken(token: string, wallet: string): boolean {
  if (!token || !wallet) return false;
  
  const normalizedWallet = wallet.toLowerCase();
  const tokenWallet = tokenToWallet.get(token);
  
  if (tokenWallet !== normalizedWallet) {
    return false;
  }
  
  const session = sessions.get(normalizedWallet);
  if (!session || session.token !== token) {
    return false;
  }
  
  if (Date.now() > session.expiresAt) {
    tokenToWallet.delete(token);
    sessions.delete(normalizedWallet);
    return false;
  }
  
  return true;
}

export function refreshSession(wallet: string): Session | null {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  
  if (!session) return null;
  
  session.expiresAt = Date.now() + atlasConfig.sessionTTL;
  return session;
}

export function endSession(wallet: string): boolean {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  if (session?.token) {
    tokenToWallet.delete(session.token);
  }
  return sessions.delete(normalizedWallet);
}

export function canCallEndpoint(session: Session, endpointKey: string): boolean {
  return Object.values(session.capabilityMap).some(
    endpoints => endpoints.includes(endpointKey)
  );
}

export function getAvailableEndpoints(session: Session): string[] {
  const endpoints: string[] = [];
  for (const appEndpoints of Object.values(session.capabilityMap)) {
    endpoints.push(...appEndpoints);
  }
  return [...new Set(endpoints)];
}

export function grantScopes(wallet: string, scopes: Scope[]): Session {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  
  if (!session) {
    throw new Error('No active session for wallet');
  }
  
  const grantSet = new Set<Scope>(session.grants);
  for (const scope of scopes) {
    if (atlasConfig.consentScopes.includes(scope)) {
      grantSet.add(scope);
    }
  }
  session.grants = [...grantSet];
  
  for (const appId of session.connectedApps) {
    const endpoints = getEndpointsForApp(appId)
      .filter(({ meta }) => 
        meta.scopes.every(scope => grantSet.has(scope))
      );
    session.capabilityMap[appId] = endpoints.map(ep => ep.key);
  }
  
  return session;
}

export function revokeScopes(wallet: string, scopes: Scope[]): Session {
  const normalizedWallet = wallet.toLowerCase();
  const session = sessions.get(normalizedWallet);
  
  if (!session) {
    throw new Error('No active session for wallet');
  }
  
  const revokeSet = new Set(scopes);
  session.grants = session.grants.filter(g => !revokeSet.has(g));
  
  const grantSet = new Set<Scope>(session.grants);
  for (const appId of session.connectedApps) {
    const endpoints = getEndpointsForApp(appId)
      .filter(({ meta }) => 
        meta.scopes.every(scope => grantSet.has(scope))
      );
    session.capabilityMap[appId] = endpoints.map(ep => ep.key);
  }
  
  return session;
}

export interface SanitizedSession {
  wallet: string;
  roles: ('admin' | 'moderator' | 'user' | 'developer')[];
  grants: Scope[];
  connectedApps: string[];
  capabilityMap: Record<string, string[]>;
  expiresAt: number;
}

export function sanitizeSession(session: Session): SanitizedSession {
  const { token, ...sanitized } = session;
  return sanitized;
}
