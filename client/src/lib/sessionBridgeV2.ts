/**
 * P3 Session Bridge V2 - WalletConnect with EthereumProvider
 * 
 * Uses @walletconnect/ethereum-provider for better compatibility
 * with mobile wallets including Base Wallet, MetaMask, Coinbase
 */

import { EthereumProvider } from '@walletconnect/ethereum-provider';
import { 
  checkPinStatus, 
  setupPin, 
  verifyPin, 
  getConnectedAddress,
  type PinStatus, 
  type PinAuthResult 
} from './coinbaseAuth';

export { checkPinStatus, setupPin, verifyPin, getConnectedAddress };
export type { PinStatus, PinAuthResult };

const PROJECT_ID = 'ac72ac034b5300e89a221c600aadf935';
const SESSION_KEY = 'p3.bridge.session';
const RESUME_STATE_KEY = 'p3.bridge.resume';
const DIAG_SESSION_KEY = 'p3.diag.sessionId';

export interface ResumeState {
  isResuming: boolean;
  uri?: string;
}

let resumeState: ResumeState = { isResuming: false };

// SIGNING MUTEX: Prevents race condition where multiple paths trigger signature simultaneously
// This is a module-level lock that ensures only ONE signature request is active at a time
let signingMutex: Promise<any> | null = null;
let signingAttemptId = 0;

function acquireSigningLock(caller: string): { canProceed: boolean; attemptId: number } {
  const attemptId = ++signingAttemptId;
  const timestamp = new Date().toISOString().slice(11, 23);
  
  if (signingMutex !== null) {
    console.log(`%c[MUTEX ${timestamp}] BLOCKED: ${caller} (attempt #${attemptId}) - signing already in progress`, 'color: #ff0000; font-weight: bold');
    return { canProceed: false, attemptId };
  }
  
  console.log(`%c[MUTEX ${timestamp}] ACQUIRED: ${caller} (attempt #${attemptId})`, 'color: #00ff00; font-weight: bold');
  return { canProceed: true, attemptId };
}

function setSigningMutex(promise: Promise<any>): void {
  signingMutex = promise;
}

function releaseSigningLock(attemptId: number): void {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`%c[MUTEX ${timestamp}] RELEASED: (attempt #${attemptId})`, 'color: #00ff00; font-weight: bold');
  signingMutex = null;
}

// Diagnostics session ID - persistent across page reloads
function getDiagSessionId(): string {
  let id = localStorage.getItem(DIAG_SESSION_KEY);
  if (!id) {
    id = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DIAG_SESSION_KEY, id);
  }
  return id;
}

// Push diagnostics to server for wallet browser debugging
// Uses sendBeacon as primary (more reliable in mobile/wallet browsers) with fetch fallback
function pushDiag(step: string, data?: any) {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`[DIAG ${timestamp}] ${step}`, data);
  
  const payload = JSON.stringify({
    level: 'info',
    tag: step,
    message: step,
    sessionId: getDiagSessionId(),
    data: { ...data, ts: Date.now() }
  });
  
  // Try sendBeacon first (works better in mobile/wallet browsers, especially on page unload/navigation)
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/diag', blob);
      if (sent) return; // Success
    }
  } catch (e) {
    // sendBeacon failed, try fetch
  }
  
  // Fallback to fetch
  try {
    fetch('/api/diag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload
    }).catch(() => {}); // Fire and forget
  } catch (e) {
    // Ignore fetch errors
  }
}

// Export for components to use
export { pushDiag, getDiagSessionId };

// Debug logging - always log to console for visibility
const debugLog = async (event: string, data?: any) => {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`%c[Bridge ${timestamp}] ${event}`, 'color: #00ff88; font-weight: bold', data || '');
  // Also push to server diagnostics (console only)
  await pushDiag(`bridge_${event}`, data);
};

export interface BridgeSession {
  address: string;
  chainId: number;
  method: 'walletconnect' | 'extension' | 'deeplink';
  connected: boolean;
  topic?: string;
  peerName?: string;
  timestamp: number;
}

let provider: InstanceType<typeof EthereumProvider> | null = null;
let initPromise: Promise<InstanceType<typeof EthereumProvider>> | null = null;

/**
 * Detect wallet browser and platform
 * Checks both user agent AND injected provider flags
 */
export function detectWalletBrowser(): {
  isWalletBrowser: boolean;
  browserName: string;
  platform: 'ios' | 'android' | 'desktop';
} {
  if (typeof window === 'undefined') {
    return { isWalletBrowser: false, browserName: 'unknown', platform: 'desktop' };
  }

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  // Check injected provider flags FIRST (more reliable than UA)
  const eth = window.ethereum as any;
  if (eth) {
    // Base Wallet / Coinbase Wallet / Smart Wallet detection
    if (eth.isCoinbaseWallet || eth.isCoinbaseBrowser || eth.isSmartWallet || eth.isCoinbaseSmartWallet) {
      return { isWalletBrowser: true, browserName: 'Coinbase/Base', platform };
    }
    // Check providers array for multi-wallet scenarios (EIP-6963)
    if (eth.providers?.some((p: any) => p.isCoinbaseWallet || p.isCoinbaseBrowser || p.isSmartWallet)) {
      return { isWalletBrowser: true, browserName: 'Coinbase/Base', platform };
    }
    // MetaMask detection
    if (eth.isMetaMask && !eth.isCoinbaseWallet) {
      return { isWalletBrowser: true, browserName: 'MetaMask', platform };
    }
    // Trust Wallet detection
    if (eth.isTrust || eth.isTrustWallet) {
      return { isWalletBrowser: true, browserName: 'Trust Wallet', platform };
    }
    // Rainbow detection
    if (eth.isRainbow) {
      return { isWalletBrowser: true, browserName: 'Rainbow', platform };
    }
  }

  // Fallback to user agent patterns
  const walletPatterns: Record<string, RegExp> = {
    'MetaMask': /metamask/i,
    'Coinbase': /coinbase|cbwallet|basewallet|smartwallet/i,
    'Trust Wallet': /trust/i,
    'Rainbow': /rainbow/i,
  };

  for (const [name, pattern] of Object.entries(walletPatterns)) {
    if (pattern.test(ua)) {
      return { isWalletBrowser: true, browserName: name, platform };
    }
  }

  return { isWalletBrowser: false, browserName: 'unknown', platform };
}

/**
 * Initialize EthereumProvider with QR modal
 */
async function initProvider(): Promise<InstanceType<typeof EthereumProvider>> {
  if (provider) {
    await debugLog('init_provider_cached', { hasSession: !!provider.session });
    return provider;
  }
  if (initPromise) {
    await debugLog('init_provider_pending', {});
    return initPromise;
  }

  await debugLog('init_provider_start', { projectId: PROJECT_ID });

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://p3protocol.io';
  
  initPromise = EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [8453], // Base mainnet
    optionalChains: [84532, 1], // Base Sepolia, Ethereum mainnet
    showQrModal: true,
    methods: [
      'eth_sendTransaction',
      'eth_signTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4',
    ],
    events: ['chainChanged', 'accountsChanged', 'disconnect'],
    metadata: {
      name: 'P3 Protocol',
      description: 'Privacy-Preserving Proof of Communication',
      url: origin,
      icons: [`${origin}/icons/owl-192.svg`],
      redirect: {
        native: 'p3protocol://wc',
        universal: `${origin}/atlas?wallet_return=true`
      }
    },
    qrModalOptions: {
      themeMode: 'dark',
    },
  });

  provider = await initPromise;
  initPromise = null;

  // Set up event listeners
  // NOTE: These handlers should NOT aggressively clear walletAddress
  // Transient disconnects happen often in wallet browsers
  provider.on('accountsChanged', (accounts: string[]) => {
    console.log('[Bridge] Accounts changed:', accounts);
    if (accounts.length > 0) {
      const session = getSession();
      if (session) {
        saveSession({ ...session, address: accounts[0] });
      }
      // Also explicitly set walletAddress
      localStorage.setItem('walletAddress', accounts[0]);
      window.dispatchEvent(new CustomEvent('p3:wallet:changed', { detail: { address: accounts[0] } }));
    } else {
      // Empty accounts is often transient (unlock, chain switch) - don't fully disconnect
      // Just mark as not connected, but KEEP walletAddress for session restoration
      console.log('[Bridge] Accounts empty - marking disconnected but keeping wallet address');
      const session = getSession();
      if (session) {
        saveSession({ ...session, connected: false });
      }
      window.dispatchEvent(new CustomEvent('p3:wallet:changed', { detail: { address: null } }));
    }
  });

  provider.on('chainChanged', (chainId: string) => {
    const numChainId = parseInt(chainId, 16);
    console.log('[Bridge] Chain changed:', numChainId);
    const session = getSession();
    if (session) {
      saveSession({ ...session, chainId: numChainId });
    }
    window.dispatchEvent(new CustomEvent('p3:chain:changed', { detail: { chainId: numChainId } }));
  });

  provider.on('disconnect', () => {
    // NOTE: Don't clear walletAddress on disconnect - it's often transient in wallet browsers
    // User must explicitly call disconnectBridge() to fully clear wallet state
    console.log('[Bridge] WalletConnect transport disconnected - keeping session for reconnect');
    const session = getSession();
    if (session) {
      saveSession({ ...session, connected: false });
    }
    window.dispatchEvent(new CustomEvent('p3:wallet:transport:disconnected'));
  });

  provider.on('display_uri', (_uri: string) => {
    console.log('[Bridge] WalletConnect URI generated');
    // The modal handles this automatically
  });

  return provider;
}

/**
 * Trigger popout specifically for Atlas after wallet authentication
 * Call this after wallet connection and authentication is complete
 * @param explicitWalletAddress - Pass wallet address explicitly (required in isolated wallet webviews where localStorage is empty)
 */
export async function triggerAtlasPopout(explicitWalletAddress?: string): Promise<void> {
  const context = detectWalletBrowser();
  
  if (!context.isWalletBrowser) {
    console.log('[Bridge] Not in wallet browser, skipping Atlas popout');
    return;
  }
  
  // Use explicit address first (for wallet browser isolation), then try localStorage
  const walletAddress = explicitWalletAddress || localStorage.getItem('walletAddress');
  if (!walletAddress) {
    console.log('[Bridge] No wallet address for Atlas popout (neither explicit nor in localStorage)');
    return;
  }
  
  console.log('[Bridge] Triggering Atlas popout for', context.browserName, 'wallet:', walletAddress.slice(0, 10));
  
  const baseUrl = window.location.origin;
  
  try {
    const tokenResponse = await fetch('/api/pwa/create-install-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress,
        appMode: false
      }),
      credentials: 'include'
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to generate transfer token');
    }
    
    const { token } = await tokenResponse.json();
    
    const params = new URLSearchParams();
    params.set('install_token', token);
    params.set('wallet_return', 'true');
    
    const atlasUrl = `${baseUrl}/atlas?${params.toString()}`;
    console.log('[Bridge] Atlas popout URL ready:', { platform: context.platform });

    if (context.platform === 'android') {
      console.log('[Bridge] Android: Launching Chrome intent for Atlas (non-destructive)');
      
      const intentUrl = `intent://${window.location.host}/atlas?${params.toString()}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(atlasUrl)};end`;
      
      // Use iframe-only approach - NEVER mutate window.location
      // This ensures the wallet browser keeps the authenticated session if intent fails
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (e) {}
      }, 500);
      
      // Emit fallback event for UI to show "Open in Chrome" button
      // Do NOT use window.location.href - it breaks the session in wallet browsers
      setTimeout(() => {
        console.log('[Bridge] Android: Intent sent, emitting fallback for manual action');
        window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
          detail: { url: atlasUrl, platform: 'android', target: 'atlas' } 
        }));
      }, 2000);
      
    } else if (context.platform === 'ios') {
      console.log('[Bridge] iOS: Attempting Safari redirect for Atlas');
      
      const newWindow = window.open(atlasUrl, '_blank');
      
      if (!newWindow || newWindow.closed) {
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Open Atlas in Safari',
              text: 'Tap Safari to continue',
              url: atlasUrl
            });
          } catch (shareError: any) {
            console.log('[Bridge] iOS share cancelled:', shareError.message);
          }
        }
        
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
            detail: { url: atlasUrl, platform: 'ios', target: 'atlas' } 
          }));
        }, 1000);
      }
    }
    
  } catch (error: any) {
    console.error('[Bridge] Atlas popout error:', error);
    // Clear popout flag on error so user can retry
    sessionStorage.removeItem('p3.atlas.popoutTriggered');
    const fallbackUrl = `${baseUrl}/atlas?wallet_return=true`;
    window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
      detail: { url: fallbackUrl, platform: context.platform, target: 'atlas', error: error.message } 
    }));
  }
}

/**
 * Pop out to Chrome/Safari after wallet approval (Primary Innovation 5)
 * 
 * IMPORTANT: Call this AFTER authenticateWallet() succeeds, not before!
 * This prevents the redirect loop where Chrome opens → needs signature → opens wallet → loop
 * 
 * Features:
 * 1. Generates secure transfer token via server API
 * 2. Android: Auto-launches Chrome via intent URL with session intact
 * 3. iOS: Uses Web Share API for one-tap Safari sharing
 * 4. Preserves wallet session through localStorage
 * 5. Completes transition in <2 seconds
 * 6. Falls back to manual option if auto-redirect fails
 */
export async function triggerBrowserPopout(wcUri?: string): Promise<void> {
  const context = detectWalletBrowser();
  
  if (!context.isWalletBrowser) return;
  
  const walletAddress = localStorage.getItem('walletAddress');
  if (!walletAddress) {
    console.log('[Bridge] No wallet address for popout');
    return;
  }
  
  const baseUrl = window.location.origin;
  const currentPath = window.location.pathname;
  const returnPath = currentPath.startsWith('/atlas') ? '/atlas' :
                     currentPath.startsWith('/app') ? '/app' : 
                     currentPath.startsWith('/mod') ? '/mod/' : '/launcher';
  
  try {
    // Generate secure transfer token via server API
    console.log('[Bridge] Generating transfer token...');
    const tokenResponse = await fetch('/api/pwa/create-install-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        walletAddress,
        appMode: currentPath.startsWith('/app')
      }),
      credentials: 'include'
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to generate transfer token');
    }
    
    const { token } = await tokenResponse.json();
    
    // Build URL with secure token
    const params = new URLSearchParams();
    params.set('install_token', token);
    params.set('wallet_return', 'true');
    if (wcUri) {
      params.set('wc', encodeURIComponent(wcUri));
    }
    
    const resumeUrl = `${baseUrl}${returnPath}?${params.toString()}`;
    console.log('[Bridge] Auto pop-out with token:', { platform: context.platform, returnPath });

    if (context.platform === 'android') {
      // Android: Use iframe-only approach - NEVER mutate window.location
      // This ensures the wallet browser keeps the authenticated session if intent fails
      const intentUrl = `intent://${window.location.host}${returnPath}?${params.toString()}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(resumeUrl)};end`;
      
      console.log('[Bridge] Android: Launching Chrome intent (non-destructive)...');
      
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (e) {}
      }, 500);
      
      // Emit fallback event for UI to show manual button - do NOT use window.location
      setTimeout(() => {
        console.log('[Bridge] Android: Intent sent, emitting fallback for manual action');
        window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
          detail: { url: resumeUrl, platform: 'android' } 
        }));
      }, 2000);
      
    } else if (context.platform === 'ios') {
      // iOS: Try multiple approaches
      console.log('[Bridge] iOS redirect attempt...');
      
      // Try opening in new window first
      const newWindow = window.open(resumeUrl, '_blank');
      
      if (!newWindow || newWindow.closed) {
        // Method 3: Web Share API for one-tap sharing
        if (navigator.share) {
          try {
            console.log('[Bridge] iOS Web Share API...');
            await navigator.share({
              title: 'Open in Safari',
              text: 'Tap "Safari" to continue',
              url: resumeUrl
            });
            console.log('[Bridge] iOS share completed');
          } catch (shareError: any) {
            // User cancelled or share failed
            console.log('[Bridge] iOS share cancelled:', shareError.message);
          }
        }
        
        // Always show fallback button on iOS for manual option
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
            detail: { url: resumeUrl, platform: 'ios' } 
          }));
        }, 1000);
      }
    }
    
  } catch (error: any) {
    console.error('[Bridge] Auto popout error:', error);
    // Fall back to simple redirect without token
    const fallbackUrl = `${baseUrl}${returnPath}?wallet_return=true`;
    window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
      detail: { url: fallbackUrl, platform: context.platform, error: error.message } 
    }));
  }
}

/**
 * Navigate between PWAs while preserving session
 */
export function navigateToPWA(target: 'app' | 'launcher'): void {
  const session = getSession();
  if (session) {
    saveSession({ ...session, timestamp: Date.now() });
  }
  window.location.href = target === 'app' ? '/app' : '/launcher';
}

/**
 * Connect via WalletConnect - shows QR modal or deep links
 */
export async function connectBridge(): Promise<BridgeSession | null> {
  const context = detectWalletBrowser();
  
  window.dispatchEvent(new CustomEvent('p3:connect_attempt', { 
    detail: { 
      platform: context.platform, 
      browserName: context.browserName,
      timestamp: Date.now() 
    } 
  }));
  
  // CRITICAL: Wait for Coinbase Smart Wallet provider injection (async)
  const { detectCoinbaseWalletAsync } = await import('./coinbaseAuth');
  const isCoinbaseSmartWallet = await detectCoinbaseWalletAsync();
  
  const cbExt = (window as any).coinbaseWalletExtension;
  const eth = window.ethereum as any;
  
  await debugLog('connect_start', { 
    platform: context.platform, 
    isWalletBrowser: context.isWalletBrowser, 
    browserName: context.browserName,
    isCoinbaseSmartWallet,
    hasCbExt: !!cbExt,
    cbExtPlatform: cbExt?.platform,
    hasEthereum: !!eth,
    ethereumInfo: eth ? {
      isMetaMask: eth?.isMetaMask,
      isCoinbaseWallet: eth?.isCoinbaseWallet,
      isWalletConnect: eth?.isWalletConnect,
    } : null
  });
  
  try {
    // COINBASE SMART WALLET: Build provider from coinbaseWalletExtension if needed
    if (isCoinbaseSmartWallet) {
      await debugLog('coinbase_smart_wallet_detected', { 
        hasCbExt: !!cbExt,
        hasMakeWeb3Provider: !!cbExt?.makeWeb3Provider,
        hasEthRequest: !!eth?.request
      });
      
      // Get the correct provider - either via makeWeb3Provider or direct window.ethereum
      let provider = eth;
      if (cbExt?.makeWeb3Provider && !eth?.request) {
        await debugLog('building_provider_from_cbext', {});
        provider = cbExt.makeWeb3Provider();
      }
      
      if (provider?.request) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        await debugLog('coinbase_accounts', { accounts });
        
        if (accounts && accounts.length > 0) {
          const chainHex = await provider.request({ method: 'eth_chainId' });
          const chainId = parseInt(chainHex, 16);
          
          const session: BridgeSession = {
            address: accounts[0],
            chainId,
            method: 'extension',
            connected: true,
            peerName: 'Coinbase Smart Wallet',
            timestamp: Date.now(),
          };
          
          saveSession(session);
          localStorage.setItem('walletAddress', accounts[0]);
          
          await debugLog('coinbase_connect_success', { address: session.address, chainId });
          
          window.dispatchEvent(new CustomEvent('p3:connect_approved', { 
            detail: { 
              address: session.address, 
              chainId, 
              method: 'extension',
              peerName: 'Coinbase Smart Wallet',
              timestamp: Date.now() 
            } 
          }));
          
          return session;
        }
      } else {
        await debugLog('coinbase_no_provider_request', { hasCbExt: !!cbExt, hasEth: !!eth });
      }
    }
    
    // OTHER WALLETS: Check for injected wallet provider (MetaMask, Trust, Rainbow, etc.)
    const hasInjectedWallet = eth && (eth.isCoinbaseWallet || eth.isMetaMask || eth.isTrust || eth.isRainbow || eth.request);
    
    // If in wallet browser OR has injected wallet provider, connect directly
    if ((context.isWalletBrowser || hasInjectedWallet) && eth?.request) {
      await debugLog('direct_connect_attempt', { 
        browserName: context.browserName,
        hasInjectedWallet,
        isCoinbaseWallet: eth?.isCoinbaseWallet,
        isMetaMask: eth?.isMetaMask
      });
      
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      await debugLog('direct_connect_accounts', { accounts });
      
      if (accounts && accounts.length > 0) {
        const chainHex = await eth.request({ method: 'eth_chainId' });
        const chainId = parseInt(chainHex, 16);
        
        const session: BridgeSession = {
          address: accounts[0],
          chainId,
          method: 'extension',
          connected: true,
          timestamp: Date.now(),
        };
        
        saveSession(session);
        localStorage.setItem('walletAddress', accounts[0]);
        
        await debugLog('direct_connect_success', { address: session.address, chainId });
        
        window.dispatchEvent(new CustomEvent('p3:connect_approved', { 
          detail: { 
            address: session.address, 
            chainId, 
            method: 'extension',
            timestamp: Date.now() 
          } 
        }));
        
        // NOTE: Don't auto-popout here - let authentication complete first
        // The caller (AppLanding) will trigger popout AFTER authenticateWallet succeeds
        
        return session;
      }
    }
    
    // Use WalletConnect with QR modal
    await debugLog('walletconnect_start', { projectId: PROJECT_ID });
    
    const wcProvider = await initProvider();
    await debugLog('provider_initialized', { 
      hasSession: !!wcProvider.session,
      chainId: wcProvider.chainId 
    });
    
    // Enable the provider - this shows the QR modal
    await debugLog('calling_enable', {});
    await wcProvider.enable();
    await debugLog('enable_complete', { accounts: wcProvider.accounts, chainId: wcProvider.chainId });
    
    const accounts = wcProvider.accounts;
    const chainId = wcProvider.chainId;
    
    if (!accounts || accounts.length === 0) {
      await debugLog('no_accounts_returned', {});
      return null;
    }
    
    const session: BridgeSession = {
      address: accounts[0],
      chainId: chainId || 8453,
      method: 'walletconnect',
      connected: true,
      topic: wcProvider.session?.topic,
      peerName: wcProvider.session?.peer?.metadata?.name,
      timestamp: Date.now(),
    };
    
    saveSession(session);
    localStorage.setItem('walletAddress', session.address);
    localStorage.setItem('connectionMethod', 'walletconnect');
    
    await debugLog('walletconnect_success', { address: session.address, peerName: session.peerName });
    
    window.dispatchEvent(new CustomEvent('p3:connect_approved', { 
      detail: { 
        address: session.address, 
        chainId: session.chainId, 
        method: 'walletconnect',
        peerName: session.peerName,
        timestamp: Date.now() 
      } 
    }));
    
    // NOTE: Don't auto-popout here - let authentication complete first
    // The caller (AppLanding) will trigger popout AFTER authenticateWallet succeeds
    
    return session;
    
  } catch (error: any) {
    await debugLog('connect_error', { 
      code: error.code, 
      message: error.message,
      name: error.name,
      stack: error.stack?.slice(0, 500)
    });
    
    if (error.code === 4001 || error.message?.includes('User rejected')) {
      return null;
    }
    throw error;
  }
}

/**
 * Restore existing session
 */
export async function restoreBridge(): Promise<BridgeSession | null> {
  const stored = getSession();
  if (!stored) return null;

  try {
    if (stored.method === 'walletconnect') {
      const wcProvider = await initProvider();
      
      // Check if session still exists
      if (wcProvider.session) {
        const accounts = wcProvider.accounts;
        if (accounts && accounts.length > 0) {
          const session: BridgeSession = {
            ...stored,
            address: accounts[0],
            chainId: wcProvider.chainId || stored.chainId,
            connected: true,
            topic: wcProvider.session.topic,
          };
          
          saveSession(session);
          localStorage.setItem('walletAddress', session.address);
          console.log('[Bridge] Session restored:', session.address);
          return session;
        }
      }
    } else if (stored.method === 'extension') {
      if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          const session: BridgeSession = {
            ...stored,
            address: accounts[0],
            connected: true,
          };
          
          saveSession(session);
          return session;
        }
      }
    }
    
    // Session invalid
    clearSession();
    return null;
  } catch (error) {
    console.error('[Bridge] Restore error:', error);
    clearSession();
    return null;
  }
}

/**
 * Resume session when returning from wallet app
 */
export async function resumeSession(): Promise<BridgeSession | null> {
  console.log('[Bridge] Resuming session...');
  return await restoreBridge();
}

/**
 * Consume install token on arrival in Chrome/Safari (Primary Innovation 5)
 * This restores the wallet session after browser handoff
 */
export async function consumeInstallToken(): Promise<{ success: boolean; walletAddress?: string }> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('install_token');
  const walletReturn = params.get('wallet_return');
  
  if (!token && !walletReturn) {
    return { success: false };
  }
  
  // If we already have a wallet address from localStorage, we're good
  const existingWallet = localStorage.getItem('walletAddress');
  if (existingWallet && walletReturn) {
    console.log('[Bridge] Wallet return - session already exists:', existingWallet);
    // Clean up URL
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('install_token');
    cleanUrl.searchParams.delete('wallet_return');
    cleanUrl.searchParams.delete('wc');
    window.history.replaceState({}, '', cleanUrl.toString());
    return { success: true, walletAddress: existingWallet };
  }
  
  if (!token) {
    return { success: false };
  }
  
  try {
    console.log('[Bridge] Consuming install token...');
    const response = await fetch('/api/pwa/consume-install-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.log('[Bridge] Token consumption failed:', error);
      return { success: false };
    }
    
    const data = await response.json();
    
    if (data.success && data.walletAddress) {
      // Restore wallet address AND auth token to localStorage
      localStorage.setItem('walletAddress', data.walletAddress);
      
      // CRITICAL: Store the auth token returned by server to prevent re-auth loop
      if (data.token) {
        localStorage.setItem('atlas_session_token', data.token);
        console.log('[Bridge] Session + auth token restored from install token:', data.walletAddress);
      } else {
        console.log('[Bridge] Session restored from token (no auth token):', data.walletAddress);
      }
      
      // Clean up URL parameters
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('install_token');
      cleanUrl.searchParams.delete('wallet_return');
      cleanUrl.searchParams.delete('wc');
      window.history.replaceState({}, '', cleanUrl.toString());
      
      // Dispatch event for UI updates
      window.dispatchEvent(new CustomEvent('p3:session:restored', { 
        detail: { walletAddress: data.walletAddress, fromToken: true } 
      }));
      
      return { success: true, walletAddress: data.walletAddress };
    }
    
    return { success: false };
    
  } catch (error: any) {
    console.error('[Bridge] Token consumption error:', error);
    return { success: false };
  }
}

/**
 * Disconnect and clear session
 */
export async function disconnectBridge(): Promise<void> {
  const session = getSession();
  
  try {
    if (provider) {
      await provider.disconnect();
    }
  } catch (error) {
    console.error('[Bridge] Disconnect error:', error);
  }
  
  clearSession();
  localStorage.removeItem('walletAddress');
  localStorage.removeItem('connectionMethod');
  provider = null;
  
  window.dispatchEvent(new CustomEvent('p3:session_revoked', { 
    detail: { 
      address: session?.address,
      method: session?.method,
      timestamp: Date.now() 
    } 
  }));
  window.dispatchEvent(new CustomEvent('p3:wallet:disconnected'));
}

/**
 * Sign message with connected wallet
 */
export async function signWithBridge(message: string): Promise<string | null> {
  const session = getSession();
  const diagInfo = { 
    hasSession: !!session, 
    method: session?.method, 
    address: session?.address?.slice(0, 10),
    hasProvider: !!provider,
    hasEthereum: typeof window.ethereum !== 'undefined'
  };
  console.log('[signWithBridge] Session:', diagInfo);
  await pushDiag('sign_start', diagInfo);
  
  if (!session?.address) {
    await pushDiag('sign_no_session', { error: 'No wallet connected' });
    throw new Error('No wallet connected');
  }

  try {
    if (session.method === 'walletconnect' && provider) {
      console.log('[signWithBridge] Using WalletConnect provider');
      localStorage.setItem('p3.debug.signMethod', 'walletconnect');
      await pushDiag('sign_using_wc', {});
      const sig = await provider.request({
        method: 'personal_sign',
        params: [message, session.address],
      }) as string;
      console.log('[signWithBridge] WC signature:', sig?.slice(0, 20));
      localStorage.setItem('p3.debug.signResult', sig ? 'ok' : 'null');
      await pushDiag('sign_wc_result', { hasSignature: !!sig, sigLen: sig?.length });
      return sig;
    } else if (typeof window.ethereum !== 'undefined') {
      console.log('[signWithBridge] Using window.ethereum');
      localStorage.setItem('p3.debug.signMethod', 'ethereum');
      await pushDiag('sign_using_ethereum', { 
        isCoinbase: !!(window.ethereum as any)?.isCoinbaseWallet,
        isMetaMask: !!(window.ethereum as any)?.isMetaMask 
      });
      const sig = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, session.address],
      });
      console.log('[signWithBridge] Ethereum signature:', sig?.slice(0, 20));
      localStorage.setItem('p3.debug.signResult', sig ? 'ok' : 'null');
      await pushDiag('sign_ethereum_result', { hasSignature: !!sig, sigLen: sig?.length });
      return sig;
    } else {
      console.log('[signWithBridge] No provider available!');
      localStorage.setItem('p3.debug.signMethod', 'none');
      localStorage.setItem('p3.debug.signResult', 'no-provider');
      await pushDiag('sign_no_provider', {});
    }
  } catch (error: any) {
    console.log('[signWithBridge] Error:', error?.code, error?.message);
    localStorage.setItem('p3.debug.signResult', `error:${error?.code || error?.message}`);
    await pushDiag('sign_error', { code: error?.code, message: error?.message?.slice(0, 100) });
    if (error.code === 4001) return null;
    throw error;
  }
  
  console.log('[signWithBridge] Falling through to null');
  localStorage.setItem('p3.debug.signResult', 'fallthrough');
  await pushDiag('sign_fallthrough', {});
  return null;
}

/**
 * Send transaction with connected wallet
 */
export async function sendWithBridge(tx: {
  to: string;
  value?: string;
  data?: string;
}): Promise<string | null> {
  const session = getSession();
  if (!session?.address) throw new Error('No wallet connected');

  const txParams = {
    from: session.address,
    to: tx.to,
    value: tx.value || '0x0',
    data: tx.data || '0x',
  };

  try {
    if (session.method === 'walletconnect' && provider) {
      return await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      }) as string;
    } else if (typeof window.ethereum !== 'undefined') {
      return await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });
    }
  } catch (error: any) {
    if (error.code === 4001) return null;
    throw error;
  }
  
  return null;
}

/**
 * Authenticate Coinbase Smart Wallet using SIWE (Sign-In with Ethereum)
 * Uses the Base Account SDK for proper ERC-6492 signature support
 * @reserved for future SIWE flow integration
 */
const _authenticateWithSIWE = async (
  address: string, 
  logAuth: (step: string, data?: any) => void
): Promise<boolean> => {
  // BEACON: Fire immediately on function entry (before ANY other code)
  // This uses sendBeacon which is reliable even in mobile wallet browsers
  pushDiag('SIWE_ENTRY', { address: address.slice(0, 10), entryTime: Date.now() });
  
  // MUTEX CHECK: Prevent duplicate signature requests
  const { canProceed, attemptId } = acquireSigningLock('authenticateWithSIWE');
  if (!canProceed) {
    logAuth('SIWE: BLOCKED by mutex - signing already in progress', {});
    await pushDiag('siwe_blocked_by_mutex', { attemptId });
    return false;
  }
  
  try {
    logAuth('SIWE: Getting challenge nonce', { address: address.slice(0, 10), attemptId });
    await pushDiag('siwe_auth_start', { address: address.slice(0, 10), attemptId });
    
    // Step 1: Get challenge nonce from server
    const challengeRes = await fetch('/api/auth/wallet-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    
    if (!challengeRes.ok) {
      logAuth('SIWE: Challenge request failed', { status: challengeRes.status, attemptId });
      releaseSigningLock(attemptId);
      return false;
    }
    
    const { nonce } = await challengeRes.json();
    logAuth('SIWE: Got nonce', { nonceLen: nonce?.length });
    
    // Step 2: Use Base Account SDK for SIWE flow
    sessionStorage.setItem('p3.signing_in_progress', 'true');
    logAuth('SIWE: Requesting wallet signature...', { attemptId });
    
    let siweResult: { address: string; message: string; signature: string } | null = null;
    
    // Create the signature promise and set the mutex
    const signaturePromise = (async () => {
      try {
        // Dynamic import to avoid bundling issues
        const { coinbaseSignInWithEthereum } = await import('./coinbaseAuth');
        return await coinbaseSignInWithEthereum(nonce);
      } catch (sdkError: any) {
        logAuth('SIWE: SDK error, falling back to personal_sign', { error: sdkError?.message?.slice(0, 80) });
        
        // Fallback: Try standard personal_sign with our message format
        if (typeof (window as any).ethereum !== 'undefined') {
          const message = `Sign this message to authenticate with P3 Protocol.\n\nNonce: ${nonce}\nAddress: ${address}`;
          const signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, address],
          });
          
          if (signature) {
            return { address, message, signature };
          }
        }
        return null;
      }
    })();
    
    setSigningMutex(signaturePromise);
    siweResult = await signaturePromise;
    
    sessionStorage.removeItem('p3.signing_in_progress');
    
    if (!siweResult) {
      logAuth('SIWE: User cancelled or no signature', { attemptId });
      await pushDiag('siwe_auth_cancelled', { attemptId });
      releaseSigningLock(attemptId);
      return false;
    }
    
    logAuth('SIWE: Got signature', { 
      sigLen: siweResult.signature?.length,
      messageLen: siweResult.message?.length 
    });
    await pushDiag('siwe_got_signature', { sigLen: siweResult.signature?.length });
    
    // Step 3: Verify with server using SIWE endpoint
    // Try SIWE endpoint first, fall back to standard wallet-verify
    let verifyRes = await fetch('/api/auth/siwe-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: siweResult.address,
        message: siweResult.message, 
        signature: siweResult.signature 
      }),
    });
    
    // If SIWE verify failed, try standard wallet-verify with our nonce
    if (!verifyRes.ok && siweResult.message.includes('Nonce:')) {
      logAuth('SIWE: SIWE-verify failed, trying wallet-verify', { status: verifyRes.status });
      verifyRes = await fetch('/api/auth/wallet-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: siweResult.address,
          signature: siweResult.signature,
          nonce
        }),
      });
    }
    
    if (!verifyRes.ok) {
      const errorText = await verifyRes.text().catch(() => 'unknown');
      logAuth('SIWE: Verification failed', { status: verifyRes.status, error: errorText.slice(0, 100), attemptId });
      await pushDiag('siwe_verify_failed', { status: verifyRes.status, attemptId });
      releaseSigningLock(attemptId);
      return false;
    }
    
    const { token, user } = await verifyRes.json();
    logAuth('SIWE: Got JWT token', { hasToken: !!token });
    
    // Store JWT token
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    await new Promise(r => setTimeout(r, 500));
    
    logAuth('SIWE: AUTH COMPLETE', { address: address.slice(0, 10), attemptId });
    await pushDiag('siwe_auth_complete', { success: true, attemptId });
    releaseSigningLock(attemptId);
    return true;
    
  } catch (error: any) {
    sessionStorage.removeItem('p3.signing_in_progress');
    logAuth('SIWE: Error', { error: error?.message?.slice(0, 100), attemptId });
    await pushDiag('siwe_auth_error', { error: error?.message?.slice(0, 100), attemptId });
    releaseSigningLock(attemptId);
    return false;
  } finally {
    // Always release the mutex in case of any unhandled exit
    releaseSigningLock(attemptId);
  }
};
void _authenticateWithSIWE; // Reserved for future SIWE flow

export interface PinAuthVerifyResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
}

/**
 * Complete PIN-based authentication and store tokens
 * Returns success status plus attemptsRemaining on failure for UI feedback
 */
export async function authenticateWithPin(address: string, pin: string): Promise<PinAuthVerifyResult> {
  const logAuth = (step: string, data?: any) => {
    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`%c[PIN-AUTH ${timestamp}] ${step}`, 'color: #00ff88; font-weight: bold', data || '');
  };

  try {
    logAuth('Starting PIN auth', { address: address.slice(0, 10) });
    await pushDiag('pin_auth_start', { address: address.slice(0, 10) });

    const result = await verifyPin(address, pin);
    
    if (!result.success) {
      logAuth('PIN verification failed', { error: result.error, remaining: result.attemptsRemaining });
      await pushDiag('pin_auth_failed', { error: result.error, attemptsRemaining: result.attemptsRemaining });
      return {
        success: false,
        error: result.error,
        attemptsRemaining: result.attemptsRemaining !== undefined 
          ? Math.max(0, result.attemptsRemaining) 
          : undefined
      };
    }

    // Store JWT token and wallet address (mirroring SIWE success path)
    if (result.token) {
      localStorage.setItem('token', result.token);
    }
    if (result.user) {
      localStorage.setItem('user', JSON.stringify(result.user));
    }
    // Persist wallet address for session resume and popout flows
    localStorage.setItem('walletAddress', address);

    logAuth('PIN auth complete', { address: address.slice(0, 10) });
    await pushDiag('pin_auth_complete', { success: true });
    return { success: true };
  } catch (error: any) {
    logAuth('PIN auth error', { error: error?.message });
    await pushDiag('pin_auth_error', { error: error?.message });
    return { success: false, error: error?.message || 'Network error' };
  }
}

/**
 * Check if we need PIN auth for Coinbase wallet
 * Returns { needsPin: true, hasPin: boolean } if PIN flow should be used
 */
export async function checkNeedsPinAuth(address: string): Promise<{ needsPin: boolean; hasPin: boolean; isLocked: boolean; lockoutRemaining: number }> {
  const eth = (window as any).ethereum;
  const isCoinbaseWallet = eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser;
  
  if (!isCoinbaseWallet) {
    return { needsPin: false, hasPin: false, isLocked: false, lockoutRemaining: 0 };
  }

  const status = await checkPinStatus(address);
  return {
    needsPin: true,
    hasPin: status.hasPin,
    isLocked: status.isLocked,
    lockoutRemaining: status.lockoutRemaining,
  };
}

/**
 * Authenticate wallet with backend to get JWT token
 * 
 * For Coinbase wallets: Uses PIN authentication (SIWE fallback)
 * For other wallets: Uses standard signature flow
 * 
 * IMPORTANT: Sets a signing flag to prevent browser popout during signature
 * The popout controller checks this flag and waits until signing completes
 */
export async function authenticateWallet(address: string, signMessage: (msg: string) => Promise<string | null>): Promise<boolean> {
  // BEACON: Entry point - fire immediately
  const eth = (window as any).ethereum;
  const isCoinbaseWallet = eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser;
  pushDiag('AUTH_WALLET_ENTRY', { 
    address: address.slice(0, 10), 
    isCoinbaseWallet,
    hasEthereum: !!eth,
    entryTime: Date.now() 
  });
  
  const logAuth = (step: string, data?: any) => {
    const timestamp = new Date().toISOString().slice(11, 23);
    console.log(`%c[AUTH ${timestamp}] ${step}`, 'color: #ff6b6b; font-weight: bold', data || '');
  };
  
  try {
    // Check if this is a Coinbase Smart Wallet - PIN auth is primary for production
    if (isCoinbaseWallet) {
      pushDiag('COINBASE_DETECTED', { address: address.slice(0, 10), needsPinAuth: true });
      logAuth('Detected Coinbase Wallet - PIN auth required', { address: address.slice(0, 10) });
      
      // Return false to signal UI should show PIN dialog
      // The UI will call authenticateWithPin directly after getting the PIN
      return false;
    }
    
    // Standard flow for other wallets
    logAuth('STEP 1: Getting challenge nonce', { address: address.slice(0, 10) });
    localStorage.setItem('p3.auth_debug_step', 'getting_nonce');
    await pushDiag('auth_start', { address: address.slice(0, 10) });
    
    // Step 1: Get challenge nonce from server
    const challengeRes = await fetch('/api/auth/wallet-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    
    if (!challengeRes.ok) {
      logAuth('STEP 1 FAILED: Challenge request failed', { status: challengeRes.status });
      localStorage.setItem('p3.auth_debug_step', 'nonce_failed');
      localStorage.setItem('p3.auth_debug_error', `challenge_${challengeRes.status}`);
      await pushDiag('auth_nonce_failed', { status: challengeRes.status });
      return false;
    }
    
    const { nonce } = await challengeRes.json();
    logAuth('STEP 1 OK: Got challenge nonce', { noncePrefix: nonce?.slice(0, 16) });
    localStorage.setItem('p3.auth_debug_step', 'got_nonce');
    await pushDiag('auth_got_nonce', { nonceLen: nonce?.length });
    
    // Step 2: Sign the challenge with wallet
    // SET FLAG: Prevent popout during signature request
    sessionStorage.setItem('p3.signing_in_progress', 'true');
    logAuth('STEP 2: Requesting wallet signature...', { address: address.slice(0, 10) });
    localStorage.setItem('p3.auth_debug_step', 'requesting_sig');
    await pushDiag('auth_requesting_sig', { messageLen: 100 });
    
    const message = `Sign this message to authenticate with P3 Protocol.\n\nNonce: ${nonce}\nAddress: ${address}`;
    const signature = await signMessage(message);
    
    // CLEAR FLAG: Signature complete (success or cancel)
    sessionStorage.removeItem('p3.signing_in_progress');
    logAuth('STEP 2 RESULT: Signature received', { hasSignature: !!signature, sigLen: signature?.length });
    await pushDiag('auth_sig_result', { hasSignature: !!signature, sigLen: signature?.length });
    
    if (!signature) {
      logAuth('STEP 2 FAILED: User cancelled or no signature', {});
      localStorage.setItem('p3.auth_debug_step', 'sig_cancelled');
      localStorage.setItem('p3.auth_debug_error', 'no_signature');
      await pushDiag('auth_sig_cancelled', {});
      return false;
    }
    
    localStorage.setItem('p3.auth_debug_step', 'got_signature');
    logAuth('STEP 3: Verifying signature with server...', { sigLen: signature.length });
    await pushDiag('auth_verifying', { sigLen: signature.length });
    
    // Step 3: Verify signature and get JWT token
    const verifyRes = await fetch('/api/auth/wallet-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, signature, nonce }),
    });
    
    logAuth('STEP 3: Server response', { status: verifyRes.status, ok: verifyRes.ok });
    
    if (!verifyRes.ok) {
      const errorText = await verifyRes.text().catch(() => 'unknown');
      logAuth('STEP 3 FAILED: Verification rejected', { status: verifyRes.status, error: errorText.slice(0, 50) });
      localStorage.setItem('p3.auth_debug_step', 'verify_failed');
      localStorage.setItem('p3.auth_debug_error', `verify_${verifyRes.status}`);
      await pushDiag('auth_verify_failed', { status: verifyRes.status, error: errorText.slice(0, 100) });
      return false;
    }
    
    const { token, user } = await verifyRes.json();
    logAuth('STEP 3 OK: Got JWT token', { hasToken: !!token, tokenLen: token?.length, userId: user?.id });
    localStorage.setItem('p3.auth_debug_step', 'got_token');
    await pushDiag('auth_got_token', { tokenLen: token?.length });
    
    // Store JWT token
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    
    // Verify it was stored
    const storedToken = localStorage.getItem('token');
    logAuth('STEP 4: Token stored to localStorage', { storedLen: storedToken?.length });
    localStorage.setItem('p3.auth_debug_step', 'token_stored');
    
    // Small delay to let token propagate before popout triggers
    await new Promise(r => setTimeout(r, 500));
    
    logAuth('AUTH COMPLETE: Success!', { address: address.slice(0, 10) });
    localStorage.setItem('p3.auth_debug_step', 'complete');
    await pushDiag('auth_complete', { success: true });
    return true;
    
  } catch (error: any) {
    // ALWAYS clear flag on error
    sessionStorage.removeItem('p3.signing_in_progress');
    console.error('[Auth] Error:', error);
    localStorage.setItem('p3.auth_debug_step', 'error');
    localStorage.setItem('p3.auth_debug_error', error?.message || 'unknown');
    await pushDiag('auth_error', { error: error?.message?.slice(0, 100), code: error?.code });
    return false;
  }
}

// Session persistence - ALWAYS mirror address to walletAddress
function saveSession(session: BridgeSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    // Always mirror address to walletAddress for AppShell guard
    if (session.address) {
      localStorage.setItem('walletAddress', session.address);
    }
  } catch (e) {
    console.error('[Bridge] Save error:', e);
  }
}

export function getSession(): BridgeSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored);
    
    // Fallback to legacy format
    const address = localStorage.getItem('walletAddress');
    if (address) {
      return {
        address,
        chainId: 8453,
        method: 'extension',
        connected: true,
        timestamp: Date.now(),
      };
    }
  } catch (e) {
    console.error('[Bridge] Get session error:', e);
  }
  return null;
}

function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(RESUME_STATE_KEY);
    
    // Clear JWT and session tokens - required for full logout
    localStorage.removeItem('token');
    localStorage.removeItem('atlas_session_token');
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('wc@') || 
        key.startsWith('walletconnect') ||
        key.startsWith('WALLETCONNECT') ||
        key.includes('walletconnect') ||
        key.startsWith('p3.bridge')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('[Bridge] Cleared session, JWT, and WalletConnect data');
  } catch (e) {
    console.error('[Bridge] Clear error:', e);
  }
}

export function isConnected(): boolean {
  const session = getSession();
  return session !== null && session.connected;
}

export function getSharedSession(): BridgeSession | null {
  return getSession();
}

export function isSessionValid(): boolean {
  const session = getSession();
  if (!session) return false;
  
  const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
  return Date.now() - session.timestamp < expiryTime;
}

export function checkWalletReturn(): boolean {
  if (typeof window === 'undefined') return false;
  
  const params = new URLSearchParams(window.location.search);
  return params.get('wallet_return') === 'true';
}

/**
 * Get current resume state for UI components
 */
export function getResumeState(): ResumeState {
  return resumeState;
}

/**
 * Check and handle WalletConnect URI resumption via ?wc= query parameter
 * Should be called on app initialization to handle returning from wallet
 */
export async function checkResumeFromWalletConnect(): Promise<BridgeSession | null> {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const wcUri = params.get('wc');
  const walletReturn = params.get('wallet_return');
  
  if (!wcUri && !walletReturn) {
    resumeState = { isResuming: false };
    return null;
  }
  
  console.log('[Bridge] Detected wallet return, checking for session...');
  
  resumeState = { 
    isResuming: true, 
    uri: wcUri ? decodeURIComponent(wcUri) : undefined 
  };
  
  window.dispatchEvent(new CustomEvent('p3:resume_state_changed', { 
    detail: { 
      isResuming: true, 
      message: 'Finalizing secure session...',
      timestamp: Date.now() 
    } 
  }));
  
  try {
    const session = await restoreBridge();
    
    if (session) {
      console.log('[Bridge] Session restored from WalletConnect return:', session.address);
      
      window.dispatchEvent(new CustomEvent('p3:connect_approved', { 
        detail: { 
          address: session.address, 
          chainId: session.chainId, 
          method: session.method,
          fromResume: true,
          timestamp: Date.now() 
        } 
      }));
    } else {
      const storedSession = getSession();
      if (storedSession) {
        console.log('[Bridge] Using stored session:', storedSession.address);
        
        window.dispatchEvent(new CustomEvent('p3:connect_approved', { 
          detail: { 
            address: storedSession.address, 
            chainId: storedSession.chainId, 
            method: storedSession.method,
            fromResume: true,
            timestamp: Date.now() 
          } 
        }));
        
        cleanupResumeUrl();
        resumeState = { isResuming: false };
        return storedSession;
      }
    }
    
    cleanupResumeUrl();
    resumeState = { isResuming: false };
    
    window.dispatchEvent(new CustomEvent('p3:resume_state_changed', { 
      detail: { 
        isResuming: false, 
        success: !!session,
        timestamp: Date.now() 
      } 
    }));
    
    return session;
    
  } catch (error) {
    console.error('[Bridge] Resume from WalletConnect failed:', error);
    
    cleanupResumeUrl();
    resumeState = { isResuming: false };
    
    window.dispatchEvent(new CustomEvent('p3:resume_state_changed', { 
      detail: { 
        isResuming: false, 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now() 
      } 
    }));
    
    return null;
  }
}

/**
 * Clean up URL parameters after processing wallet return
 */
function cleanupResumeUrl(): void {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  url.searchParams.delete('wc');
  url.searchParams.delete('wallet_return');
  
  const newUrl = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '');
  window.history.replaceState({}, '', newUrl);
  
  console.log('[Bridge] Cleaned up URL parameters');
}
