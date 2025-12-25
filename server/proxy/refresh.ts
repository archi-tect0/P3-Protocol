import { getCredential, saveCredential, TokenBundle } from '../atlas/services/vault';
import { PROVIDERS, getProviderConfig } from './providers';
import { getCached, setCached, invalidateCached } from './cache';

export async function ensureFreshToken(
  walletAddr: string,
  provider: string,
  scope: string
): Promise<string> {
  const cfg = getProviderConfig(provider);
  if (!cfg) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  let bundle = getCached(walletAddr, provider, scope);
  
  if (!bundle) {
    bundle = await getCredential(walletAddr, provider, scope);
    if (bundle) {
      setCached(walletAddr, provider, scope, bundle);
    }
  }
  
  if (!bundle) {
    throw new Error(`No credential for ${provider}/${scope}. Please connect the app first.`);
  }

  const now = Date.now();
  
  if (bundle.expiresAt && bundle.expiresAt - 60000 > now) {
    return bundle.accessToken;
  }

  if (bundle.refreshToken) {
    try {
      const newBundle = await refreshToken(cfg, bundle, provider);
      await saveCredential(walletAddr, provider, scope, newBundle, 'oauth');
      setCached(walletAddr, provider, scope, newBundle);
      return newBundle.accessToken;
    } catch (error) {
      console.error(`[TokenRefresh] Failed to refresh ${provider} token:`, error);
      invalidateCached(walletAddr, provider, scope);
      throw new Error(`Failed to refresh ${provider} token. Please reconnect the app.`);
    }
  }

  invalidateCached(walletAddr, provider, scope);
  throw new Error(`Expired token for ${provider}/${scope} and no refresh token available. Please reconnect the app.`);
}

async function refreshToken(
  cfg: typeof PROVIDERS[string],
  bundle: TokenBundle,
  provider: string
): Promise<TokenBundle> {
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', bundle.refreshToken!);
  params.set('client_id', cfg.clientId);
  params.set('client_secret', cfg.clientSecret);

  if (cfg.extraParams) {
    for (const [key, value] of Object.entries(cfg.extraParams)) {
      params.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (provider === 'spotify') {
    const credentials = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  }

  if (provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  const res = await fetch(cfg.tokenEndpoint, {
    method: 'POST',
    headers,
    body: params.toString(),
  });

  const json = await res.json() as Record<string, unknown>;
  
  if (!res.ok || !json.access_token) {
    throw new Error(`Token refresh failed: ${JSON.stringify(json)}`);
  }

  const now = Date.now();
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : undefined;
  
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) || bundle.refreshToken,
    expiresAt: expiresIn ? now + expiresIn * 1000 : undefined,
  };
}

export async function getValidToken(
  walletAddr: string,
  provider: string,
  scope: string
): Promise<{ token: string | null; needsRefresh: boolean; needsReauth: boolean }> {
  try {
    const bundle = await getCredential(walletAddr, 'oauth', scope);
    
    if (!bundle) {
      return { token: null, needsRefresh: false, needsReauth: true };
    }

    const now = Date.now();
    
    if (!bundle.expiresAt || bundle.expiresAt - 60000 > now) {
      return { token: bundle.accessToken, needsRefresh: false, needsReauth: false };
    }

    if (bundle.refreshToken) {
      return { token: bundle.accessToken, needsRefresh: true, needsReauth: false };
    }

    return { token: null, needsRefresh: false, needsReauth: true };
  } catch (error) {
    console.error('[TokenRefresh] Error checking token:', error);
    return { token: null, needsRefresh: false, needsReauth: true };
  }
}

export async function isTokenValid(
  walletAddr: string,
  provider: string,
  scope: string
): Promise<boolean> {
  const { token, needsReauth } = await getValidToken(walletAddr, provider, scope);
  return token !== null && !needsReauth;
}
