import { createBaseAccountSDK } from '@base-org/account';
import { diag } from './diag';

let baseProvider: any = null;

export interface CoinbaseAuthResult {
  address: string;
  message: string;
  signature: string;
}

// Cache for detected Coinbase wallet
let coinbaseDetectedCache: boolean | null = null;

export function isCoinbaseSmartWallet(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Return cached result if available
  if (coinbaseDetectedCache !== null) return coinbaseDetectedCache;
  
  const eth = window.ethereum as any;
  const cbExt = (window as any).coinbaseWalletExtension;
  
  // Check Coinbase Wallet Extension (most reliable for Base Smart Wallet)
  if (cbExt?.platform === 'smart' || cbExt?.isCoinbaseWallet) {
    coinbaseDetectedCache = true;
    return true;
  }
  
  // Check ethereum provider flags
  if (eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser) {
    coinbaseDetectedCache = true;
    return true;
  }
  
  // Check providerMap for multi-wallet scenarios
  if (eth?.providerMap?.has?.('CoinbaseWallet') || eth?.providerMap?.has?.('smartWallet')) {
    coinbaseDetectedCache = true;
    return true;
  }
  
  // Check for Base wallet specific provider properties
  if (eth?.isBase || eth?.isSmartWallet) {
    coinbaseDetectedCache = true;
    return true;
  }
  
  return false;
}

/**
 * Async detection that waits for wallet provider injection
 * Use this in entry points before deciding PIN vs SIWE
 */
export async function detectCoinbaseWalletAsync(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  // Already detected
  if (coinbaseDetectedCache === true) return true;
  
  // Check immediately
  if (isCoinbaseSmartWallet()) return true;
  
  // Wait up to 2 seconds for provider injection
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 100));
    
    const eth = window.ethereum as any;
    const cbExt = (window as any).coinbaseWalletExtension;
    
    if (cbExt?.platform === 'smart' || cbExt?.isCoinbaseWallet) {
      coinbaseDetectedCache = true;
      console.log('[CoinbaseAuth] Detected via coinbaseWalletExtension after', (i+1)*100, 'ms');
      return true;
    }
    
    if (eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser) {
      coinbaseDetectedCache = true;
      console.log('[CoinbaseAuth] Detected via window.ethereum after', (i+1)*100, 'ms');
      return true;
    }
    
    if (eth?.providerMap?.has?.('CoinbaseWallet')) {
      coinbaseDetectedCache = true;
      console.log('[CoinbaseAuth] Detected via providerMap after', (i+1)*100, 'ms');
      return true;
    }
  }
  
  return false;
}

// Reserved for future Base SDK provider integration
const _getBaseProvider = async () => {
  if (baseProvider) return baseProvider;
  const sdk = createBaseAccountSDK({ appName: 'P3 Protocol' });
  baseProvider = sdk.getProvider();
  return baseProvider;
};
void _getBaseProvider; // Kept for future Base SDK integration

export async function coinbaseSignInWithEthereum(nonce: string): Promise<CoinbaseAuthResult | null> {
  diag('CoinbaseAuth', 'Starting signInWithEthereum', { nonceLen: nonce?.length });
  
  try {
    // CRITICAL: In wallet browsers, window.ethereum may inject asynchronously
    // Wait up to 5 seconds for it to appear
    let eth = window.ethereum as any;
    if (!eth) {
      diag('CoinbaseAuth', 'No ethereum yet - waiting for injection', {});
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        eth = window.ethereum as any;
        if (eth) {
          diag('CoinbaseAuth', 'Ethereum injected after wait', { ms: (i + 1) * 100 });
          break;
        }
      }
    }
    
    if (!eth) {
      diag('CoinbaseAuth', 'No window.ethereum after 5s wait', {});
      console.error('[CoinbaseAuth] No window.ethereum available');
      return null;
    }
    
    diag('CoinbaseAuth', 'Has ethereum provider', { 
      isCoinbaseWallet: eth?.isCoinbaseWallet,
      isCoinbaseBrowser: eth?.isCoinbaseBrowser 
    });
    
    // Get current accounts - may need to request if not connected
    let accounts = await eth.request({ method: 'eth_accounts' });
    
    // If no accounts, try requesting connection first
    if (!accounts || accounts.length === 0) {
      diag('CoinbaseAuth', 'No accounts - requesting connection', {});
      try {
        accounts = await eth.request({ method: 'eth_requestAccounts' });
      } catch (connErr: any) {
        diag('CoinbaseAuth', 'Connection request failed', { error: connErr?.message?.slice(0, 50) });
      }
    }
    if (!accounts || accounts.length === 0) {
      console.error('[CoinbaseAuth] No accounts connected');
      return null;
    }
    
    const address = accounts[0];
    diag('CoinbaseAuth', 'Using existing connection', { address: address?.slice(0, 10) });
    
    // Try wallet_sendCalls with SIWE capability first (EIP-5792)
    try {
      const chainId = await eth.request({ method: 'eth_chainId' });
      diag('CoinbaseAuth', 'Trying wallet_getCapabilities', { chainId });
      
      const capabilities = await eth.request({
        method: 'wallet_getCapabilities',
        params: [address],
      });
      
      diag('CoinbaseAuth', 'Got capabilities', { 
        hasCapabilities: !!capabilities,
        keys: capabilities ? Object.keys(capabilities) : []
      });
    } catch (capError: any) {
      diag('CoinbaseAuth', 'wallet_getCapabilities not supported', { error: capError?.message?.slice(0, 50) });
    }
    
    // Fall back to standard personal_sign with SIWE-formatted message
    const domain = window.location.host;
    const uri = window.location.origin;
    const issuedAt = new Date().toISOString();
    const chainId = await eth.request({ method: 'eth_chainId' });
    const chainIdDecimal = parseInt(chainId, 16);
    
    // EIP-4361 SIWE message format
    const siweMessage = `${domain} wants you to sign in with your Ethereum account:
${address}

Sign in to P3 Protocol

URI: ${uri}
Version: 1
Chain ID: ${chainIdDecimal}
Nonce: ${nonce}
Issued At: ${issuedAt}`;

    diag('CoinbaseAuth', 'Requesting personal_sign with SIWE message', { 
      messageLen: siweMessage.length,
      address: address?.slice(0, 10)
    });
    
    const signature = await eth.request({
      method: 'personal_sign',
      params: [siweMessage, address],
    });
    
    if (!signature) {
      console.error('[CoinbaseAuth] No signature returned');
      return null;
    }
    
    diag('CoinbaseAuth', 'personal_sign success', { 
      signatureLen: signature?.length,
      sigPrefix: signature?.slice(0, 20)
    });
    
    return {
      address,
      message: siweMessage,
      signature,
    };
  } catch (error: any) {
    console.error('[CoinbaseAuth] Error:', error);
    diag('CoinbaseAuth', 'Error', { 
      code: error?.code, 
      message: error?.message?.slice(0, 100) 
    });
    
    if (error?.code === 4001 || error?.message?.includes('User rejected')) {
      return null;
    }
    
    throw error;
  }
}

export async function coinbasePersonalSign(message: string, address: string): Promise<string | null> {
  diag('CoinbaseAuth', 'Fallback to personal_sign', { messageLen: message?.length });
  
  try {
    if (typeof window.ethereum === 'undefined') {
      console.error('[CoinbaseAuth] No window.ethereum');
      return null;
    }
    
    const signature = await window.ethereum.request({
      method: 'personal_sign',
      params: [message, address],
    });
    
    diag('CoinbaseAuth', 'personal_sign result', { sigLen: signature?.length });
    return signature;
  } catch (error: any) {
    console.error('[CoinbaseAuth] personal_sign error:', error);
    if (error?.code === 4001) return null;
    throw error;
  }
}

// ============================================================================
// PIN Authentication (Production-ready SIWE fallback)
// ============================================================================

export interface PinStatus {
  hasPin: boolean;
  isLocked: boolean;
  lockoutRemaining: number;
  failedAttempts: number;
}

export interface PinAuthResult {
  success: boolean;
  user?: { id: string; address: string; role: string };
  token?: string;
  authMethod?: string;
  error?: string;
  attemptsRemaining?: number;
}

export async function checkPinStatus(address: string): Promise<PinStatus> {
  diag('CoinbaseAuth', 'Checking PIN status', { address: address?.slice(0, 10) });
  
  try {
    const response = await fetch(`/api/auth/pin/status?address=${encodeURIComponent(address)}`);
    const data = await response.json();
    
    return {
      hasPin: data.hasPin || false,
      isLocked: data.isLocked || false,
      lockoutRemaining: data.lockoutRemaining || 0,
      failedAttempts: data.failedAttempts || 0,
    };
  } catch (error: any) {
    diag('CoinbaseAuth', 'PIN status check failed', { error: error?.message });
    return { hasPin: false, isLocked: false, lockoutRemaining: 0, failedAttempts: 0 };
  }
}

export async function setupPin(address: string, pin: string): Promise<{ success: boolean; error?: string }> {
  diag('CoinbaseAuth', 'Setting up PIN', { address: address?.slice(0, 10) });
  
  try {
    const response = await fetch('/api/auth/pin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, pin }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to set PIN' };
    }
    
    return { success: true };
  } catch (error: any) {
    diag('CoinbaseAuth', 'PIN setup failed', { error: error?.message });
    return { success: false, error: error?.message || 'Network error' };
  }
}

export async function verifyPin(address: string, pin: string): Promise<PinAuthResult> {
  diag('CoinbaseAuth', 'Verifying PIN', { address: address?.slice(0, 10) });
  
  try {
    const response = await fetch('/api/auth/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, pin }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Verification failed',
        attemptsRemaining: data.attemptsRemaining,
      };
    }
    
    return {
      success: true,
      user: data.user,
      token: data.token,
      authMethod: data.authMethod,
    };
  } catch (error: any) {
    diag('CoinbaseAuth', 'PIN verify failed', { error: error?.message });
    return { success: false, error: error?.message || 'Network error' };
  }
}

export async function getConnectedAddress(): Promise<string | null> {
  try {
    let eth = window.ethereum as any;
    if (!eth) {
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        eth = window.ethereum as any;
        if (eth) break;
      }
    }
    
    if (!eth) return null;
    
    let accounts = await eth.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0) {
      try {
        accounts = await eth.request({ method: 'eth_requestAccounts' });
      } catch {
        return null;
      }
    }
    
    return accounts?.[0] || null;
  } catch {
    return null;
  }
}
