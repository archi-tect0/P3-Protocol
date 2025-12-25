export interface Session {
  wallet: string;
  granted: string[];
  chainId?: number;
  connected: boolean;
}

export const AVAILABLE_SCOPES = [
  'wallet',
  'messages',
  'storage',
  'anchors',
  'media',
  'payments',
  'contacts',
  'notifications',
] as const;

export type Scope = typeof AVAILABLE_SCOPES[number];

export class PermissionError extends Error {
  public missingScopes: string[];
  
  constructor(missingScopes: string[]) {
    super(`Missing required scopes: ${missingScopes.join(', ')}`);
    this.name = 'PermissionError';
    this.missingScopes = missingScopes;
  }
}

export function ensureScopes(session: Session, needed: string[]): void {
  const missing = needed.filter(scope => !session.granted.includes(scope));
  if (missing.length > 0) {
    throw new PermissionError(missing);
  }
}

export function hasScope(session: Session, scope: string): boolean {
  return session.granted.includes(scope);
}

export function hasAllScopes(session: Session, scopes: string[]): boolean {
  return scopes.every(scope => session.granted.includes(scope));
}

export function getMissingScopes(session: Session, needed: string[]): string[] {
  return needed.filter(scope => !session.granted.includes(scope));
}

export function grantScopes(session: Session, scopes: string[]): Session {
  const newGranted = [...new Set([...session.granted, ...scopes])];
  const updated = { ...session, granted: newGranted };
  persistSession(updated);
  return updated;
}

export function revokeScopes(session: Session, scopes: string[]): Session {
  const newGranted = session.granted.filter(s => !scopes.includes(s));
  return { ...session, granted: newGranted };
}

export function createSession(wallet: string, initialScopes: string[] = ['wallet']): Session {
  return {
    wallet,
    granted: initialScopes,
    connected: true,
  };
}

const STORAGE_KEY = 'p3.session.scopes';

export function persistSession(session: Session): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      wallet: session.wallet,
      granted: session.granted,
      chainId: session.chainId,
    }));
  } catch (error) {
    console.warn('Failed to persist session scopes');
  }
}

export function loadPersistedSession(): Partial<Session> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearPersistedSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
