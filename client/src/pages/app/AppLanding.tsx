import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2, Shield } from "lucide-react";
import { useSessionRestore } from "@/hooks/use-session-restore";
import { 
  restoreBridge, 
  getSession,
  detectWalletBrowser,
  authenticateWallet,
  signWithBridge,
  triggerBrowserPopout,
  type BridgeSession 
} from "@/lib/sessionBridgeV2";
import { WalletLauncherMenu } from "@/components/WalletLauncherMenu";
import { BrowserHandoffButton, useAutoPopout } from "@/components/BrowserHandoffButton";

const logToServer = async (event: string, data?: any) => {
  try {
    await fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data, timestamp: Date.now() }),
    });
  } catch (e) { /* silent */ }
};

// SECURITY: Clear admin credentials when entering wallet context
// This prevents wallet users from inheriting stale admin sessions
function clearAdminCredentials() {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('adminUser');
  localStorage.removeItem('adminEmail');
}

export default function AppLanding() {
  const [, setLocation] = useLocation();
  const [connecting] = useState(false);
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  
  const { isRestoring, restoredWallet } = useSessionRestore();
  const walletContext = detectWalletBrowser();
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  useAutoPopout(); // Subscribe to popout state, Hub is primary trigger
  
  // SECURITY: Clear admin credentials immediately on mount
  useEffect(() => {
    clearAdminCredentials();
    logToServer('page_load', { platform: walletContext.platform, isWalletBrowser: walletContext.isWalletBrowser, browserName: walletContext.browserName, isMobile, ua: navigator.userAgent });
  }, []);
  
  useEffect(() => {
    const handleRestoredWallet = async () => {
      if (restoredWallet) {
        localStorage.setItem('walletAddress', restoredWallet);
        
        const token = localStorage.getItem('token');
        if (!token) {
          const signMessage = async (msg: string) => signWithBridge(msg);
          await authenticateWallet(restoredWallet, signMessage);
        }
        
        setLocation('/app');
      }
    };
    handleRestoredWallet();
  }, [restoredWallet, setLocation]);
  
  useEffect(() => {
    const checkSession = async () => {
      // CRITICAL: If already on /app/*, NEVER redirect - prevents loop
      if (window.location.pathname.startsWith('/app')) {
        return;
      }
      
      const existing = getSession();
      if (existing && existing.address) {
        setSession(existing);
        localStorage.setItem('walletAddress', existing.address);
        
        const token = localStorage.getItem('token');
        if (!token) {
          const signMessage = async (msg: string) => signWithBridge(msg);
          await authenticateWallet(existing.address, signMessage);
        }
        
        if (!window.location.pathname.startsWith('/app')) {
          setLocation('/app/messages');
        }
        return;
      }
      
      const restored = await restoreBridge();
      if (restored && restored.address) {
        setSession(restored);
        localStorage.setItem('walletAddress', restored.address);
        
        const token = localStorage.getItem('token');
        if (!token) {
          const signMessage = async (msg: string) => signWithBridge(msg);
          await authenticateWallet(restored.address, signMessage);
        }
        
        if (!window.location.pathname.startsWith('/app')) {
          setLocation('/app/messages');
        }
      }
    };
    
    if (!isRestoring) checkSession();
  }, [setLocation, isRestoring]);
  
  const handleMenuConnect = async (bridgeSession: BridgeSession) => {
    setSession(bridgeSession);
    localStorage.setItem('walletAddress', bridgeSession.address);
    
    const signMessage = async (msg: string) => signWithBridge(msg);
    const authenticated = await authenticateWallet(bridgeSession.address, signMessage);
    
    if (authenticated) {
      logToServer('wallet_authenticated', { address: bridgeSession.address });
      
      if (walletContext.isWalletBrowser) {
        await triggerBrowserPopout();
        return;
      }
    } else {
      logToServer('wallet_auth_failed', { address: bridgeSession.address });
    }
    
    setLocation('/app/messages');
  };

  if (isRestoring) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Restoring session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-4">
      {/* Top left logo */}
      <div className="absolute top-4 left-4 z-20">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
          <Shield className="w-6 h-6 text-white" />
        </div>
      </div>

      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">P3 Protocol</h1>
            <p className="text-slate-400">Connect your wallet for encrypted messaging, payments, and DAO governance</p>
          </div>

        {!session && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-400" />
              Connect Wallet
            </h2>
            
            <Button
              onClick={() => setMenuOpen(true)}
              disabled={connecting}
              className="w-full h-14 text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              data-testid="button-connect-wallet"
            >
              {connecting ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Wallet className="w-5 h-5 mr-2" />
              )}
              {connecting ? 'Connecting...' : 'Choose Wallet'}
            </Button>
            
            {walletContext.isWalletBrowser && (
              <p className="text-xs text-green-400 text-center">✓ {walletContext.browserName} detected</p>
            )}
            
            <p className="text-xs text-slate-500 text-center">
              MetaMask, Coinbase, Trust, Rainbow & 100+ more
            </p>
          </div>
        )}
        
        <WalletLauncherMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onConnect={handleMenuConnect}
          returnPath="/app"
        />

        <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-400 text-lg">🔐</span>
            </div>
            <div>
              <p className="text-sm font-medium text-purple-300">Secure Connection</p>
              <p className="text-xs text-slate-400 mt-1">Private keys never leave your wallet. E2E encrypted.</p>
            </div>
          </div>
        </div>
        </div>
      </div>
      <BrowserHandoffButton />
    </div>
  );
}
