/**
 * P3 Session Bridge - Mobile Wallet Connection Handler
 * 
 * Handles deep link flows for mobile wallet connections:
 * 1. Generate session request with callback URL
 * 2. Open wallet via deep link
 * 3. Parse return URL when wallet redirects back
 * 4. Store session and trigger app update
 */

const SESSION_KEY = 'p3.wallet.session';
const PENDING_KEY = 'p3.wallet.pending';

export interface WalletSession {
  address: string;
  chainId: number;
  connected: boolean;
  provider: 'metamask' | 'coinbase' | 'walletconnect';
  timestamp: number;
}

export interface PendingConnection {
  nonce: string;
  provider: 'metamask' | 'coinbase';
  returnUrl: string;
  timestamp: number;
}

/**
 * Generate a random nonce for session verification
 */
function generateNonce(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Get the current app URL for callbacks
 */
function getCallbackUrl(): string {
  const base = window.location.origin;
  const path = '/app'; // Return to app after wallet connection
  return `${base}${path}`;
}

/**
 * Build MetaMask deep link for mobile
 * MetaMask opens the dApp in its built-in browser
 */
export function buildMetaMaskDeepLink(): string {
  const host = window.location.host;
  const path = window.location.pathname;
  // MetaMask deep link format: opens dApp in MetaMask browser
  return `https://metamask.app.link/dapp/${host}${path}`;
}

/**
 * Build Coinbase/Base Wallet deep link for mobile
 * Uses Universal Links with callback
 */
export function buildCoinbaseDeepLink(): string {
  const callbackUrl = getCallbackUrl();
  // Coinbase wallet deep link with callback
  return `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Build intent URL for Android (opens in external browser after wallet)
 */
export function buildIntentUrl(walletPackage: string): string {
  const callbackUrl = getCallbackUrl();
  return `intent://${window.location.host}${window.location.pathname}#Intent;scheme=https;package=${walletPackage};S.browser_fallback_url=${encodeURIComponent(callbackUrl)};end`;
}

/**
 * Start a wallet connection flow for mobile
 */
export function startMobileConnection(provider: 'metamask' | 'coinbase'): void {
  const nonce = generateNonce();
  const returnUrl = getCallbackUrl();
  
  // Store pending connection info
  const pending: PendingConnection = {
    nonce,
    provider,
    returnUrl,
    timestamp: Date.now()
  };
  
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch (e) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  }
  
  // Build and open deep link
  let deepLink: string;
  
  if (provider === 'metamask') {
    deepLink = buildMetaMaskDeepLink();
  } else {
    deepLink = buildCoinbaseDeepLink();
  }
  
  // Open the wallet
  window.location.href = deepLink;
}

/**
 * Check if we're returning from a wallet connection
 * Call this on app load
 */
export function checkWalletReturn(): boolean {
  // Check for pending connection
  let pending: PendingConnection | null = null;
  
  try {
    const stored = sessionStorage.getItem(PENDING_KEY) || localStorage.getItem(PENDING_KEY);
    if (stored) {
      pending = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse pending connection:', e);
  }
  
  if (!pending) return false;
  
  // Check if pending is still valid (within 5 minutes)
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() - pending.timestamp > fiveMinutes) {
    clearPendingConnection();
    return false;
  }
  
  return true;
}

/**
 * Clear pending connection state
 */
export function clearPendingConnection(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch (e) {
    console.error('Failed to clear pending connection:', e);
  }
}

/**
 * Complete the connection after returning from wallet
 * This should be called when the user returns and ethereum is available
 */
export async function completeConnection(): Promise<WalletSession | null> {
  // Check if ethereum is now available (we're in wallet browser or returned)
  if (typeof window.ethereum === 'undefined') {
    return null;
  }
  
  try {
    // Request accounts
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
    
    if (!accounts || accounts.length === 0) {
      return null;
    }
    
    // Get chain ID
    let chainId = 1;
    try {
      const chainHex = await window.ethereum.request({ method: 'eth_chainId' });
      chainId = parseInt(chainHex, 16);
    } catch (e) {
      console.warn('Failed to get chain ID:', e);
    }
    
    // Determine provider
    let provider: 'metamask' | 'coinbase' | 'walletconnect' = 'metamask';
    if (window.ethereum.isCoinbaseWallet) {
      provider = 'coinbase';
    } else if (window.ethereum.isWalletConnect) {
      provider = 'walletconnect';
    }
    
    const session: WalletSession = {
      address: accounts[0],
      chainId,
      connected: true,
      provider,
      timestamp: Date.now()
    };
    
    // Store session
    saveSession(session);
    
    // Clear pending
    clearPendingConnection();
    
    return session;
  } catch (error) {
    console.error('Failed to complete connection:', error);
    return null;
  }
}

/**
 * Save session to storage
 */
export function saveSession(session: WalletSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Also store address separately for backwards compatibility
    localStorage.setItem('walletAddress', session.address);
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

/**
 * Get current session
 */
export function getSession(): WalletSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Fallback to old storage format
    const address = localStorage.getItem('walletAddress');
    if (address) {
      return {
        address,
        chainId: 8453, // Base mainnet
        connected: true,
        provider: 'metamask',
        timestamp: Date.now()
      };
    }
  } catch (e) {
    console.error('Failed to get session:', e);
  }
  
  return null;
}

/**
 * Clear session (disconnect)
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('walletAddress');
  } catch (e) {
    console.error('Failed to clear session:', e);
  }
}

/**
 * Check if user is connected
 */
export function isConnected(): boolean {
  const session = getSession();
  return session !== null && session.connected;
}

/**
 * Detect if we're running inside a wallet's in-app browser
 */
export function isWalletBrowser(): boolean {
  if (typeof window.ethereum === 'undefined') return false;
  
  // MetaMask mobile browser
  if (window.ethereum.isMetaMask) return true;
  
  // Coinbase Wallet browser
  if (window.ethereum.isCoinbaseWallet) return true;
  
  // Trust Wallet browser
  if ((window.ethereum as any).isTrust) return true;
  
  return false;
}

/**
 * Detect if on mobile device
 */
export function isMobile(): boolean {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Open external browser from wallet browser (for return to Chrome/Safari)
 * This creates a link the user can tap to open in their default browser
 */
export function getExternalBrowserUrl(): string {
  return window.location.href;
}
