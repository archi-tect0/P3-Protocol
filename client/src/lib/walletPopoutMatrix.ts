/**
 * Wallet Popout Matrix - Detection and escape intents for top 15 wallet browsers
 * 
 * IMPORTANT: On iOS, the primary escape mechanism is navigator.share() 
 * which is handled in the PopoutController. The iOS URLs here are secondary
 * fallbacks, mostly universal links that may trigger the system browser.
 * 
 * On Android, Chrome intents are reliable for escaping to Chrome.
 */

export type Platform = 'android' | 'ios' | 'desktop';

export interface WalletConfig {
  id: string;
  name: string;
  icon: string;
  detectProvider?: (eth: any) => boolean;
  detectUserAgent?: (ua: string) => boolean;
  escapeIntent: {
    android: (url: string) => string[];
    ios: (url: string) => string[];
  };
  iosShareRequired?: boolean; // Indicates that iOS escape requires share sheet
}

/**
 * Android escape strategies - these actually work
 */

function chromeIntent(url: string): string {
  const cleanUrl = url.replace(/^https?:\/\//, '');
  return `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
}

function chromeScheme(url: string): string {
  return `googlechrome://navigate?url=${encodeURIComponent(url)}`;
}

function standardAndroidEscape(url: string): string[] {
  return [chromeIntent(url), chromeScheme(url)];
}

/**
 * iOS escape fallbacks - tried after share is cancelled
 * These attempt to open the URL in Safari via universal links or schemes
 */
function iosUniversalLinkFallback(url: string): string[] {
  // Try a few approaches that sometimes work on iOS:
  // 1. Direct URL (some wallets may honor it)
  // 2. Google redirect (sometimes escapes to Safari)
  const encoded = encodeURIComponent(url);
  return [
    url,  // Direct URL - some wallets open external links in Safari
    `https://www.google.com/url?q=${encoded}`,  // Google redirect sometimes triggers Safari
  ];
}

/**
 * Top 15 Wallet Browser Configurations
 */
export const WALLET_POPOUT_MATRIX: WalletConfig[] = [
  // 1. MetaMask
  {
    id: 'metamask',
    name: 'MetaMask',
    icon: '🦊',
    detectProvider: (eth) => eth?.isMetaMask && !eth?.isCoinbaseWallet && !eth?.isPhantom,
    detectUserAgent: (ua) => /metamask/i.test(ua),
    escapeIntent: {
      android: standardAndroidEscape,
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 2. Coinbase Wallet / Base - Has working universal link
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    icon: '🔵',
    detectProvider: (eth) => eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser,
    detectUserAgent: (ua) => /coinbase|CBMobileWeb/i.test(ua),
    escapeIntent: {
      android: (url) => {
        const encoded = encodeURIComponent(url);
        return [
          chromeIntent(url),
          `https://go.cb-w.com/dapp?cb_url=${encoded}&link_url=${encoded}`,
          chromeScheme(url),
        ];
      },
      ios: (url) => {
        // Coinbase universal link may trigger external browser
        const encoded = encodeURIComponent(url);
        return [
          `https://go.cb-w.com/dapp?cb_url=${encoded}&link_url=${encoded}`,
        ];
      },
    },
  },
  
  // 3. Trust Wallet - WebView blocks ALL Chrome escape mechanisms; rely on share sheet only
  {
    id: 'trust',
    name: 'Trust Wallet',
    icon: '🛡️',
    detectProvider: (eth) => eth?.isTrust || eth?.isTrustWallet,
    detectUserAgent: (ua) => /trust/i.test(ua),
    escapeIntent: {
      android: (_url) => {
        // Trust Wallet WebView blocks Chrome intents and googlechrome:// scheme
        // Return empty array - AtlasShell handles Trust via share sheet or clipboard
        return [];
      },
      ios: (url) => [
        // Trust universal link - opens in Safari
        `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
      ],
    },
    iosShareRequired: true,
  },
  
  // 4. Rainbow
  {
    id: 'rainbow',
    name: 'Rainbow',
    icon: '🌈',
    detectProvider: (eth) => eth?.isRainbow,
    detectUserAgent: (ua) => /rainbow/i.test(ua),
    escapeIntent: {
      android: standardAndroidEscape,
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 5. Phantom - Has universal link for browser handoff
  {
    id: 'phantom',
    name: 'Phantom',
    icon: '👻',
    detectProvider: (eth) => eth?.isPhantom,
    detectUserAgent: (ua) => /phantom/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        `https://phantom.app/ul/browse?url=${encodeURIComponent(url)}`,
        chromeScheme(url),
      ],
      ios: (url) => [
        // Phantom universal link
        `https://phantom.app/ul/browse?url=${encodeURIComponent(url)}`,
      ],
    },
  },
  
  // 6. Zerion
  {
    id: 'zerion',
    name: 'Zerion',
    icon: '⚡',
    detectProvider: (eth) => eth?.isZerion,
    detectUserAgent: (ua) => /zerion/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 7. Uniswap Wallet
  {
    id: 'uniswap',
    name: 'Uniswap Wallet',
    icon: '🦄',
    detectProvider: (eth) => eth?.isUniswapWallet,
    detectUserAgent: (ua) => /uniswap/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 8. 1inch Wallet
  {
    id: '1inch',
    name: '1inch Wallet',
    icon: '🔴',
    detectProvider: (eth) => eth?.isOneInchWallet || eth?.is1inch,
    detectUserAgent: (ua) => /1inch/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 9. Ledger Live
  {
    id: 'ledger',
    name: 'Ledger Live',
    icon: '🔒',
    detectProvider: (eth) => eth?.isLedgerConnect,
    detectUserAgent: (ua) => /ledger/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 10. Exodus
  {
    id: 'exodus',
    name: 'Exodus',
    icon: '🚀',
    detectProvider: (eth) => eth?.isExodus,
    detectUserAgent: (ua) => /exodus/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 11. Argent
  {
    id: 'argent',
    name: 'Argent',
    icon: '🔶',
    detectProvider: (eth) => eth?.isArgent,
    detectUserAgent: (ua) => /argent/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 12. OKX Wallet
  {
    id: 'okx',
    name: 'OKX Wallet',
    icon: '⚫',
    detectProvider: (eth) => eth?.isOkxWallet || eth?.isOKExWallet,
    detectUserAgent: (ua) => /okx|okex/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 13. Crypto.com DeFi Wallet
  {
    id: 'cryptocom',
    name: 'Crypto.com',
    icon: '💎',
    detectProvider: (eth) => eth?.isCryptocom || eth?.isDeficonnectProvider,
    detectUserAgent: (ua) => /crypto\.com|deficonnect/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 14. SafePal
  {
    id: 'safepal',
    name: 'SafePal',
    icon: '🔐',
    detectProvider: (eth) => eth?.isSafePal,
    detectUserAgent: (ua) => /safepal/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
  
  // 15. imToken
  {
    id: 'imtoken',
    name: 'imToken',
    icon: '📱',
    detectProvider: (eth) => eth?.isImToken,
    detectUserAgent: (ua) => /imtoken/i.test(ua),
    escapeIntent: {
      android: (url) => [
        chromeIntent(url),
        chromeScheme(url),
      ],
      ios: iosUniversalLinkFallback,
    },
    iosShareRequired: true,
  },
];

/**
 * Detect current platform
 */
export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Detect if we're inside a wallet browser
 */
export function detectWalletBrowser(): WalletConfig | null {
  if (typeof window === 'undefined') return null;
  
  const eth = (window as any).ethereum;
  const ua = navigator.userAgent;
  
  if (eth) {
    const detected = WALLET_POPOUT_MATRIX.find(w => w.detectProvider?.(eth));
    if (detected) {
      console.log('[PopoutMatrix] Detected wallet via provider:', detected.id);
      return detected;
    }
  }
  
  const uaDetected = WALLET_POPOUT_MATRIX.find(w => w.detectUserAgent?.(ua));
  if (uaDetected) {
    console.log('[PopoutMatrix] Detected wallet via UA:', uaDetected.id);
    return uaDetected;
  }
  
  const isInAppBrowser = /wv|webview|fbav|fban|instagram|twitter|line\//i.test(ua);
  if (isInAppBrowser) {
    console.log('[PopoutMatrix] Detected generic in-app browser');
    return {
      id: 'generic',
      name: 'In-App Browser',
      icon: '🌐',
      escapeIntent: {
        android: standardAndroidEscape,
        ios: iosUniversalLinkFallback,
      },
      iosShareRequired: true,
    };
  }
  
  return null;
}

/**
 * Check if we need to show the popout UI
 */
export function shouldShowPopout(): boolean {
  return detectWalletBrowser() !== null;
}

/**
 * Get the escape URLs for the current wallet and platform
 */
export function getEscapeUrls(targetUrl: string): string[] | null {
  const wallet = detectWalletBrowser();
  const platform = detectPlatform();
  
  if (!wallet || platform === 'desktop') return null;
  
  const escape = wallet.escapeIntent[platform];
  if (!escape) return null;
  
  return escape(targetUrl);
}

/**
 * Check if iOS share is required for the current wallet
 */
export function requiresIosShare(): boolean {
  const wallet = detectWalletBrowser();
  const platform = detectPlatform();
  return platform === 'ios' && (wallet?.iosShareRequired ?? true);
}

/**
 * Get browser name for display
 */
export function getTargetBrowserName(): string {
  const platform = detectPlatform();
  return platform === 'ios' ? 'Safari' : 'Chrome';
}
