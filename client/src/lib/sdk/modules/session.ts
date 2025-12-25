/**
 * P3 SDK Session Module - Wallet-Based SSO
 * 
 * Single Sign-On for the P3 Protocol ecosystem.
 * Connect once with any wallet, authenticated everywhere.
 * 
 * Usage:
 * ```typescript
 * import { P3 } from '@p3/sdk';
 * 
 * // Check existing session
 * const session = await P3.SSO.get();
 * if (session.authenticated) {
 *   console.log(`Authenticated as ${session.wallet}`);
 * }
 * 
 * // Validate session for your app
 * const valid = await P3.SSO.validate({ appId: 'my-app' });
 * 
 * // Get session token for API calls
 * const token = await P3.SSO.token();
 * ```
 */

import { sdkReq } from './core';

export type SessionInfo = {
  sessionId: string;
  wallet: string;
  roles: string[];
  expiresAt?: number;
};

export type RevokeResult = {
  ok: boolean;
};

export type SSOSession = {
  authenticated: boolean;
  wallet: string | null;
  chainId: number | null;
  sessionId: string | null;
  roles: string[];
  expiresAt: number | null;
  method: 'extension' | 'walletconnect' | 'deeplink' | null;
};

export type SSOValidation = {
  valid: boolean;
  wallet: string | null;
  appId: string;
  scopes: string[];
  expiresAt: number | null;
};

export type SSOToken = {
  token: string;
  expiresAt: number;
  wallet: string;
};

export type SSOChallenge = {
  nonce: string;
  message: string;
  expiresAt: number;
};

const SESSION_KEY = 'p3.bridge.session';

/**
 * Get current session from local storage (client-side check)
 */
export function getLocal(): SSOSession {
  try {
    if (typeof window === 'undefined') {
      return { authenticated: false, wallet: null, chainId: null, sessionId: null, roles: [], expiresAt: null, method: null };
    }
    
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      return { authenticated: false, wallet: null, chainId: null, sessionId: null, roles: [], expiresAt: null, method: null };
    }
    
    const session = JSON.parse(stored);
    return {
      authenticated: true,
      wallet: session.address || null,
      chainId: session.chainId || null,
      sessionId: session.sessionId || null,
      roles: session.roles || ['user'],
      expiresAt: session.expiresAt || null,
      method: session.method || null,
    };
  } catch {
    return { authenticated: false, wallet: null, chainId: null, sessionId: null, roles: [], expiresAt: null, method: null };
  }
}

/**
 * Get current session (server-verified)
 */
export async function get(): Promise<SSOSession> {
  const local = getLocal();
  if (!local.authenticated) {
    return local;
  }
  
  try {
    const info = await sdkReq<SessionInfo>('/api/sdk/session/info', {
      method: 'GET',
    });
    
    return {
      authenticated: true,
      wallet: info.wallet,
      chainId: local.chainId,
      sessionId: info.sessionId,
      roles: info.roles,
      expiresAt: info.expiresAt || null,
      method: local.method,
    };
  } catch {
    return local;
  }
}

/**
 * Resume existing session or create new one
 */
export async function resume(): Promise<SessionInfo> {
  return sdkReq<SessionInfo>('/api/sdk/session/resume', {
    method: 'POST',
  });
}

/**
 * Revoke session(s)
 */
export async function revoke(sessionId?: string): Promise<RevokeResult> {
  return sdkReq<RevokeResult>('/api/sdk/session/revoke', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/**
 * Refresh session and get new token
 */
export async function refresh(): Promise<SessionInfo> {
  return sdkReq<SessionInfo>('/api/sdk/session/refresh', {
    method: 'POST',
  });
}

/**
 * Get session info
 */
export async function info(): Promise<SessionInfo> {
  return sdkReq<SessionInfo>('/api/sdk/session/info', {
    method: 'GET',
  });
}

/**
 * Validate session for a specific app (SSO validation)
 */
export async function validate(opts: { appId: string; scopes?: string[] }): Promise<SSOValidation> {
  return sdkReq<SSOValidation>('/api/sdk/sso/validate', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

/**
 * Get a signed token for API authentication
 */
export async function token(): Promise<SSOToken> {
  return sdkReq<SSOToken>('/api/sdk/sso/token', {
    method: 'POST',
  });
}

/**
 * Request a challenge for wallet signature verification
 */
export async function challenge(wallet: string): Promise<SSOChallenge> {
  return sdkReq<SSOChallenge>('/api/sdk/sso/challenge', {
    method: 'POST',
    body: JSON.stringify({ wallet }),
  });
}

/**
 * Verify a signed challenge (completes SSO flow)
 */
export async function verify(opts: { 
  wallet: string; 
  nonce: string; 
  signature: string;
  appId?: string;
}): Promise<SSOSession & { token: string }> {
  return sdkReq<SSOSession & { token: string }>('/api/sdk/sso/verify', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

/**
 * Check if wallet is connected (quick client-side check)
 */
export function isConnected(): boolean {
  return getLocal().authenticated;
}

/**
 * Get connected wallet address
 */
export function address(): string | null {
  return getLocal().wallet;
}
