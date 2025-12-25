import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Menu } from "lucide-react";
import OwlLogo from "./OwlLogo";
import ConnectButton from "./ConnectButton";
import { detectWalletBrowser } from "@/lib/sessionBridgeV2";

export default function EnhancedTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const phantomRef = useRef<HTMLButtonElement>(null);
  const [handoffTriggered, setHandoffTriggered] = useState(false);

  useEffect(() => {
    const context = detectWalletBrowser();
    if (context.isWalletBrowser && !handoffTriggered) {
      const walletAddress = localStorage.getItem('walletAddress');
      if (walletAddress) {
        setHandoffTriggered(true);
        setTimeout(() => {
          if (phantomRef.current) {
            console.log('[Topbar] Auto-triggering handoff phantom click');
            phantomRef.current.click();
          }
        }, 1500);
      }
    }
  }, [handoffTriggered]);

  const triggerHandoff = async () => {
    const context = detectWalletBrowser();
    if (!context.isWalletBrowser) return;
    
    const walletAddress = localStorage.getItem('walletAddress');
    if (!walletAddress) return;

    const baseUrl = window.location.origin;
    const returnPath = window.location.pathname.startsWith('/app') ? '/app' : '/launcher';
    
    try {
      const tokenResponse = await fetch('/api/pwa/create-install-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, appMode: returnPath === '/app' }),
        credentials: 'include'
      });
      
      if (tokenResponse.ok) {
        const { token } = await tokenResponse.json();
        const params = new URLSearchParams({ install_token: token, wallet_return: 'true' });
        const resumeUrl = `${baseUrl}${returnPath}?${params.toString()}`;
        
        window.dispatchEvent(new CustomEvent('p3:popout:fallback', { 
          detail: { url: resumeUrl, platform: context.platform } 
        }));
      }
    } catch (e) {
      console.error('[Topbar] Handoff error:', e);
    }
  };

  return (
    <header 
      className="h-14 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-4 flex items-center justify-between sticky top-0 z-50" 
      data-testid="header-topbar"
    >
      <button 
        ref={phantomRef}
        onClick={triggerHandoff}
        className="sr-only"
        aria-hidden="true"
        data-testid="button-handoff-phantom"
      />
      
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="md:hidden text-slate-600 dark:text-slate-400"
          data-testid="button-menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2">
          <OwlLogo className="w-8 h-8" />
          <span className="text-lg font-bold text-cyan-500">Nexus</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 uppercase tracking-wide">
            BETA
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          data-testid="button-theme-toggle"
        >
          {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>

        <ConnectButton />
      </div>
    </header>
  );
}
