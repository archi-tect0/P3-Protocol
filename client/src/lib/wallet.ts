/**
 * Wallet Configuration Interface
 */
export interface WalletConfig {
  id: string;
  name: string;
  installedCheck: () => boolean;
  deepLinkTemplate: string;
  qrTemplate: string;
}

/**
 * Wallet Registry - Configuration for supported crypto wallets
 */
export const walletRegistry: Record<string, WalletConfig> = {
  metamask: {
    id: "metamask",
    name: "MetaMask",
    installedCheck: () => {
      return typeof window !== "undefined" && 
             typeof (window as any).ethereum !== "undefined" && 
             (window as any).ethereum.isMetaMask === true;
    },
    deepLinkTemplate: "metamask://{{action}}?payload={{payload}}",
    qrTemplate: "https://metamask.app.link/{{action}}?payload={{payload}}",
  },
  
  phantom: {
    id: "phantom",
    name: "Phantom",
    installedCheck: () => {
      return typeof window !== "undefined" && 
             typeof (window as any).phantom !== "undefined" && 
             typeof (window as any).phantom.solana !== "undefined";
    },
    deepLinkTemplate: "phantom://{{action}}?payload={{payload}}",
    qrTemplate: "https://phantom.app/ul/{{action}}?payload={{payload}}",
  },
  
  coinbase: {
    id: "coinbase",
    name: "Coinbase Wallet",
    installedCheck: () => {
      return typeof window !== "undefined" && 
             typeof (window as any).ethereum !== "undefined" && 
             (window as any).ethereum.isCoinbaseWallet === true;
    },
    deepLinkTemplate: "cbwallet://{{action}}?payload={{payload}}",
    qrTemplate: "https://go.cb-w.com/{{action}}?payload={{payload}}",
  },
};

/**
 * Check if a specific wallet is installed
 * 
 * @param walletId - The wallet identifier (e.g., "metamask", "phantom", "coinbase")
 * @returns true if the wallet extension/app is detected in the browser
 */
export function isWalletInstalled(walletId: string): boolean {
  const wallet = walletRegistry[walletId];
  if (!wallet) {
    console.warn(`Wallet "${walletId}" not found in registry`);
    return false;
  }
  
  return wallet.installedCheck();
}

/**
 * Build a URL from a template by replacing placeholders
 * 
 * @param template - URL template with {{placeholder}} variables
 * @param params - Object with key-value pairs to substitute
 * @returns Constructed URL with substituted values
 */
function buildUrlFromTemplate(template: string, params: Record<string, string>): string {
  let url = template;
  
  for (const [key, value] of Object.entries(params)) {
    const placeholder = `{{${key}}}`;
    url = url.replace(new RegExp(placeholder, 'g'), encodeURIComponent(value));
  }
  
  return url;
}

/**
 * Open a wallet for a specific action
 * 
 * This function will:
 * 1. Check if the wallet is installed
 * 2. If installed, use the deep link to open the wallet app
 * 3. If not installed, return QR code URL for mobile fallback
 * 
 * @param walletId - The wallet identifier
 * @param action - The action to perform (e.g., "sign", "connect", "send")
 * @param payload - The payload data for the action
 * @returns Object with success status and optional QR URL
 */
export function openWallet(
  walletId: string,
  action: string,
  payload: string
): { success: boolean; qrUrl?: string; error?: string } {
  const wallet = walletRegistry[walletId];
  
  if (!wallet) {
    return {
      success: false,
      error: `Wallet "${walletId}" not found in registry`,
    };
  }
  
  const params = { action, payload };
  
  // Check if wallet is installed
  if (wallet.installedCheck()) {
    // Wallet is installed - use deep link
    const deepLink = buildUrlFromTemplate(wallet.deepLinkTemplate, params);
    
    try {
      // Try to open the deep link
      window.location.href = deepLink;
      return { success: true };
    } catch (error) {
      console.error(`Failed to open ${wallet.name}:`, error);
      return {
        success: false,
        error: `Failed to open ${wallet.name}`,
      };
    }
  } else {
    // Wallet not installed - return QR code URL for mobile fallback
    const qrUrl = buildUrlFromTemplate(wallet.qrTemplate, params);
    
    return {
      success: false,
      qrUrl,
      error: `${wallet.name} is not installed. Scan QR code to continue on mobile.`,
    };
  }
}

/**
 * Get all available wallets
 */
export function getAvailableWallets(): WalletConfig[] {
  return Object.values(walletRegistry);
}

/**
 * Get installed wallets
 */
export function getInstalledWallets(): WalletConfig[] {
  return Object.values(walletRegistry).filter(wallet => wallet.installedCheck());
}
