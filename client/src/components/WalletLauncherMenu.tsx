import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Wallet, ExternalLink, Smartphone, Monitor, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { connectBridge, type BridgeSession } from "@/lib/sessionBridgeV2";
import { diag } from "@/lib/diag";

declare global {
  interface Window {
    ethereum?: any;
    __P3_HTML_VERSION?: string;
  }
}

type WalletOption = {
  id: string;
  name: string;
  icon: string;
  color: string;
  deepLink: {
    ios: string;
    android: string;
  };
  universalLink?: string;
  detectProvider?: (eth: any) => boolean;
};

const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    color: "from-orange-500 to-amber-600",
    deepLink: {
      ios: "metamask://",
      android: "metamask://",
    },
    universalLink: "https://metamask.app.link/dapp/",
    detectProvider: (eth) => eth?.isMetaMask && !eth?.isCoinbaseWallet,
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    icon: "🔵",
    color: "from-blue-500 to-blue-600",
    deepLink: {
      ios: "cbwallet://",
      android: "cbwallet://",
    },
    universalLink: "https://go.cb-w.com/dapp?cb_url=",
    detectProvider: (eth) => eth?.isCoinbaseWallet || eth?.isCoinbaseBrowser,
  },
  {
    id: "trust",
    name: "Trust Wallet",
    icon: "🛡️",
    color: "from-sky-400 to-blue-500",
    deepLink: {
      ios: "trust://",
      android: "trust://",
    },
    universalLink: "https://link.trustwallet.com/open_url?coin_id=60&url=",
    detectProvider: (eth) => eth?.isTrust || eth?.isTrustWallet,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    icon: "🌈",
    color: "from-violet-500 via-pink-500 to-orange-400",
    deepLink: {
      ios: "rainbow://",
      android: "rainbow://",
    },
    universalLink: "https://rnbwapp.com/",
    detectProvider: (eth) => eth?.isRainbow,
  },
];

function detectPlatform(): "ios" | "android" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function detectInstalledWallet(): WalletOption | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  const eth = window.ethereum as any;
  return WALLET_OPTIONS.find((w) => w.detectProvider?.(eth)) || null;
}

async function generateInstallToken(walletId?: string): Promise<string | null> {
  try {
    const response = await fetch('/api/pwa/create-pending-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    
    if (response.ok) {
      const { token } = await response.json();
      diag('WalletLauncher', 'Generated pending install token', { tokenLength: token?.length, walletId });
      // CRITICAL: Store both token AND wallet_id for Chrome resume recovery
      sessionStorage.setItem('p3.pending_install_token', token);
      if (walletId) {
        sessionStorage.setItem('p3.pending_wallet_id', walletId);
      }
      return token;
    } else {
      diag('WalletLauncher', 'Token generation failed', { status: response.status });
    }
  } catch (err: any) {
    diag('WalletLauncher', 'Token generation error', { error: err?.message });
  }
  return null;
}

async function buildDeepLink(wallet: WalletOption, returnPath: string, token?: string | null): Promise<string> {
  if (typeof window === "undefined") return "";
  
  const baseHost = window.location.host;
  const cleanPath = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
  
  const params = new URLSearchParams();
  params.set('wallet_return', 'true');
  params.set('wallet_id', wallet.id);
  if (token) {
    params.set('pending_token', token);
  }
  
  const fullPath = `${cleanPath}?${params.toString()}`;
  const fullUrl = `https://${baseHost}${fullPath}`;
  
  diag('WalletLauncher', 'Building deep link', { 
    wallet: wallet.id, 
    returnPath, 
    hasToken: !!token,
    fullUrl: fullUrl.slice(0, 80)
  });
  
  let deepLink: string;
  switch (wallet.id) {
    case "metamask":
      deepLink = `https://metamask.app.link/dapp/${baseHost}${fullPath}`;
      break;
    case "coinbase":
      // Coinbase Wallet deep link - use cbwallet:// scheme for direct browser open
      // Format: cbwallet://dapp?url=<encoded_url>
      const cbEncoded = encodeURIComponent(fullUrl);
      // Try native scheme first (works better on mobile)
      deepLink = `cbwallet://dapp?url=${cbEncoded}`;
      console.log('[WalletLauncher] Coinbase deep link:', deepLink.slice(0, 100));
      break;
    case "trust":
      deepLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(fullUrl)}`;
      break;
    case "rainbow":
      deepLink = `https://rnbwapp.com/browser?url=${encodeURIComponent(fullUrl)}`;
      break;
    default:
      deepLink = wallet.deepLink.ios || "";
  }
  
  diag('WalletLauncher', 'Deep link built', { 
    wallet: wallet.id, 
    deepLinkLength: deepLink.length 
  });
  
  return deepLink;
}

interface WalletLauncherMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (session: BridgeSession) => void;
  returnPath?: string;
}

export function WalletLauncherMenu({
  open,
  onOpenChange,
  onConnect,
  returnPath = "/",
}: WalletLauncherMenuProps) {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [platform] = useState(detectPlatform);
  const [installedWallet, setInstalledWallet] = useState<WalletOption | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initial check
    setInstalledWallet(detectInstalledWallet());
    
    // Wallet providers like Coinbase inject window.ethereum asynchronously
    // Poll for up to 2 seconds when dialog opens to detect late injection
    if (open && !window.ethereum) {
      let attempts = 0;
      const maxAttempts = 20;
      const interval = setInterval(() => {
        attempts++;
        const detected = detectInstalledWallet();
        if (detected) {
          setInstalledWallet(detected);
          diag('WalletLauncher', 'Late provider detected', { wallet: detected.id, attempts });
          clearInterval(interval);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [open]);

  const handleWalletClick = async (wallet: WalletOption) => {
    setConnecting(wallet.id);
    
    // Re-check provider at click time - it may have appeared since dialog opened
    const eth = window.ethereum as any;
    const hasSpecificProvider = wallet.detectProvider?.(eth);
    const hasAnyProvider = !!eth && (eth.isCoinbaseWallet || eth.isMetaMask || eth.isTrust || eth.isRainbow || eth.request);
    const hasInjectedProvider = hasSpecificProvider || (hasAnyProvider && platform !== 'desktop');
    
    diag('WalletLauncher', 'Wallet click', { 
      wallet: wallet.id, 
      platform, 
      hasEthereum: !!window.ethereum,
      hasSpecificProvider,
      hasAnyProvider,
      hasInjectedProvider
    });

    try {
      // Simple approach: Use connectBridge() for all wallets with injected provider
      // connectBridge handles Coinbase, MetaMask, etc. via eth_requestAccounts
      // PIN/popout logic is handled by the caller (AtlasShell) in onConnect
      if (hasInjectedProvider) {
        diag('WalletLauncher', 'Injected provider found - connecting via bridge', { 
          wallet: wallet.id,
          platform
        });
        
        const session = await connectBridge();
        diag('WalletLauncher', 'Bridge connect result', { 
          success: !!session, 
          address: session?.address?.slice(0, 10) 
        });
        
        if (session) {
          onConnect(session);
          onOpenChange(false);
          toast({
            title: "Wallet Connected",
            description: `Connected via ${wallet.name}`,
          });
        }
      } else if (platform === "desktop") {
        // Desktop without matching provider
        toast({
          title: `${wallet.name} Not Detected`,
          description: `Please install ${wallet.name} browser extension`,
          variant: "destructive",
        });
      } else {
        // Mobile without injected provider - redirect via deep link
        diag('WalletLauncher', 'Mobile flow - generating token before deep link', { 
          wallet: wallet.id 
        });
        
        const token = await generateInstallToken(wallet.id);
        const deepLinkUrl = await buildDeepLink(wallet, returnPath, token);
        
        diag('WalletLauncher', 'Deep link ready - redirecting', { 
          wallet: wallet.id,
          hasToken: !!token,
          urlLength: deepLinkUrl.length
        });
        
        if (deepLinkUrl) {
          window.location.href = deepLinkUrl;
        }
      }
    } catch (error: any) {
      diag('WalletLauncher', 'Wallet connection error', { 
        wallet: wallet.id, 
        error: error?.message 
      });
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection Failed",
        description: "Please try again or use another wallet",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleWalletConnect = async () => {
    const logWC = (step: string, data?: any) => {
      const timestamp = new Date().toISOString().slice(11, 23);
      console.log(`%c[WalletLauncherMenu ${timestamp}] ${step}`, 'color: #ffaa00; font-weight: bold', data || '');
    };
    
    logWC('handleWalletConnect CALLED - opening WalletConnect modal');
    setConnecting("walletconnect");
    try {
      logWC('Calling connectBridge()...');
      const session = await connectBridge();
      logWC('connectBridge() returned', { hasSession: !!session, address: session?.address?.slice(0, 10) });
      
      if (session) {
        logWC('SUCCESS - calling onConnect callback', { address: session.address.slice(0, 10) });
        onConnect(session);
        onOpenChange(false);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${session.address.slice(0, 6)}...${session.address.slice(-4)}`,
        });
      } else {
        logWC('No session returned - user may have cancelled');
      }
    } catch (error: any) {
      logWC('ERROR in connectBridge', { message: error?.message, code: error?.code });
      console.error("WalletConnect error:", error);
      toast({
        title: "Connection Failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      logWC('handleWalletConnect COMPLETE');
      setConnecting(null);
    }
  };

  const isMobile = platform !== "desktop";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400">
            {isMobile
              ? "Choose a wallet app to connect"
              : "Connect with your preferred wallet"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {installedWallet && (
            <div className="mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 px-1">
                {isMobile ? "Connected Wallet" : "Detected Wallet"}
              </p>
              <Button
                variant="outline"
                className={`w-full h-14 justify-between border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-white`}
                onClick={() => handleWalletClick(installedWallet)}
                disabled={connecting !== null}
                data-testid={`button-wallet-${installedWallet.id}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{installedWallet.icon}</span>
                  <span className="font-medium">{installedWallet.name}</span>
                  <span className="text-xs bg-emerald-500/30 px-2 py-0.5 rounded-full text-emerald-300">
                    {isMobile ? "Ready" : "Installed"}
                  </span>
                </div>
                {connecting === installedWallet.id ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                )}
              </Button>
            </div>
          )}

          <p className="text-xs text-slate-500 uppercase tracking-wider px-1">
            {installedWallet ? "Other Wallets" : (isMobile ? "Open in Wallet App" : "All Wallets")}
          </p>

          {WALLET_OPTIONS.filter(
            (w) => !installedWallet || w.id !== installedWallet.id
          ).map((wallet) => (
            <Button
              key={wallet.id}
              variant="outline"
              className={`w-full h-14 justify-between border-slate-700 hover:border-slate-600 bg-slate-800/50 hover:bg-slate-800 text-white`}
              onClick={() => handleWalletClick(wallet)}
              disabled={connecting !== null}
              data-testid={`button-wallet-${wallet.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="font-medium">{wallet.name}</span>
              </div>
              {connecting === wallet.id ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isMobile ? (
                <ExternalLink className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-5 w-5 text-slate-400" />
              )}
            </Button>
          ))}

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-900 px-2 text-slate-500">or</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-14 justify-between border-slate-700 hover:border-purple-500/50 bg-gradient-to-r from-purple-900/20 to-indigo-900/20 hover:from-purple-900/30 hover:to-indigo-900/30 text-white"
            onClick={handleWalletConnect}
            disabled={connecting !== null}
            data-testid="button-wallet-walletconnect"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <span className="font-medium block">WalletConnect</span>
                <span className="text-xs text-slate-400">
                  {isMobile ? "Scan QR code" : "Connect any wallet via QR"}
                </span>
              </div>
            </div>
            {connecting === "walletconnect" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-400" />
            )}
          </Button>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-700/50">
          {isMobile ? (
            <Smartphone className="h-4 w-4 text-slate-500" />
          ) : (
            <Monitor className="h-4 w-4 text-slate-500" />
          )}
          <span className="text-xs text-slate-500">
            {isMobile ? "Mobile" : "Desktop"} • Secure Connection
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface WalletLauncherButtonProps {
  session: BridgeSession | null;
  onConnect: (session: BridgeSession) => void;
  onDisconnect: () => void;
  isConnecting?: boolean;
  className?: string;
  returnPath?: string;
  variant?: "default" | "compact" | "icon";
}

export function WalletLauncherButton({
  session,
  onConnect,
  onDisconnect: _onDisconnect,
  isConnecting = false,
  className = "",
  returnPath = "/",
  variant = "default",
}: WalletLauncherButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // When connected, show nothing in topbar - session indicator is in hamburger sidebar
  if (session) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setMenuOpen(true)}
        disabled={isConnecting}
        className={`bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white ${className}`}
        data-testid="button-connect-wallet"
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Wallet className="w-4 h-4 mr-2" />
        )}
        {variant === "compact" ? "Connect" : "Connect Wallet"}
      </Button>

      <WalletLauncherMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onConnect={onConnect}
        returnPath={returnPath}
      />
    </>
  );
}

export default WalletLauncherMenu;
