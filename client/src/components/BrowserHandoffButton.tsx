/**
 * Browser Handoff Button - Escape overlay for wallet browsers
 * 
 * iOS: Shows tap-to-share button (user gesture required for navigator.share)
 * Android: Auto-fires Chrome intent
 * Session bridge preserves wallet connection across browsers
 */

import { useState, useEffect } from 'react';
import { Loader2, Chrome, Smartphone, CheckCircle, Share2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PopoutController, type PopoutState } from '@/lib/popoutController';

export function BrowserHandoffButton() {
  const [state, setState] = useState<PopoutState>(PopoutController.getState());

  useEffect(() => {
    const unsubscribe = PopoutController.subscribe(setState);
    return unsubscribe;
  }, []);

  if (!state.isActive) return null;

  const Icon = state.platform === 'ios' ? Smartphone : Chrome;
  const browserName = state.targetBrowser;
  const isIos = state.platform === 'ios';
  const isWaitingTap = state.status === 'waiting_tap';

  const handleTap = () => {
    if (isIos) {
      PopoutController.triggerIosShare();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      data-testid="browser-handoff-overlay"
    >
      <div 
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 shadow-2xl border border-cyan-500/20 max-w-sm mx-4 animate-in zoom-in-95 duration-300"
        data-testid="browser-handoff-container"
      >
        <div className="flex flex-col items-center gap-6">
          {/* Icon with status indicator */}
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/40">
              {state.status === 'sharing' ? (
                <Share2 className="w-12 h-12 text-white" />
              ) : (
                <Icon className="w-12 h-12 text-white" />
              )}
            </div>
            
            {(state.status === 'opening' || state.status === 'sharing') && (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border-2 border-cyan-500">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              </div>
            )}
            
            {state.status === 'success' && (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          
          {/* Title */}
          <div className="text-center">
            <h2 className="text-white text-xl font-bold mb-2">
              {isWaitingTap ? `Open in ${browserName}` : 
               state.status === 'opening' ? `Opening ${browserName}...` :
               state.status === 'sharing' ? 'Select Safari' :
               state.status === 'fallback' ? 'Manual Step Needed' :
               state.status === 'success' ? 'Redirecting...' : 'Please Wait'}
            </h2>
            
            <p className="text-slate-400 text-sm">
              {state.message || 'Your session will be preserved'}
            </p>
          </div>
          
          {/* iOS: Tap to open button */}
          {isIos && isWaitingTap && (
            <Button
              onClick={handleTap}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl shadow-lg shadow-cyan-500/30"
              data-testid="button-open-safari"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Tap to Open in {browserName}
            </Button>
          )}
          
          {/* iOS fallback hint */}
          {state.status === 'fallback' && isIos && (
            <div className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white/5 border border-white/10 w-full">
              <Share2 className="w-8 h-8 text-cyan-400 flex-shrink-0" />
              <div className="text-left">
                <p className="text-white text-sm font-medium">Tap the share button</p>
                <p className="text-slate-400 text-xs">At the bottom of your screen, then "Open in Safari"</p>
              </div>
            </div>
          )}
          
          {/* Wallet info */}
          {state.wallet && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <span className="text-xl">{state.wallet.icon}</span>
              <span className="text-slate-400 text-sm">
                Detected: {state.wallet.name}
              </span>
            </div>
          )}
          
          {/* Session preserved notice */}
          <div className="flex items-center gap-2 text-slate-500 text-xs">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Session bridge active - wallet stays connected
          </div>
          
          {/* Skip button */}
          <button
            onClick={() => PopoutController.dismiss()}
            className="text-slate-500 text-xs hover:text-slate-400 transition-colors"
            data-testid="button-skip-handoff"
          >
            Continue in wallet browser →
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to trigger popout check on mount and when page regains focus
 * Re-arms the popout so returning users see the escape option
 * 
 * IMPORTANT: Only triggers AFTER FULL authentication is complete (has JWT token)
 * walletAddress alone is NOT enough - that's set before signature!
 * 
 * Flow: Connect wallet → walletAddress set → Sign message → token set → THEN popout
 * 
 * Route-aware: Only Hub (/launcher) should actively trigger popouts.
 * Other routes show the button if already active, but don't auto-trigger to prevent competition.
 */
export function useAutoPopout(options?: { isPrimaryRoute?: boolean }) {
  useEffect(() => {
    // Gate: ONLY trigger popout if FULL authentication is complete (has JWT token)
    // walletAddress is set BEFORE signing, so checking it causes premature redirect
    // The signature happens in the wallet browser, so we must wait for token
    const hasFullAuth = () => {
      const hasToken = !!localStorage.getItem('token');
      const hasWallet = !!localStorage.getItem('walletAddress');
      
      // Require BOTH - wallet connected AND signed (token obtained)
      // This gives wallet browser time to complete signature before redirect
      return hasToken && hasWallet;
    };
    
    // Check if signature is currently in progress (don't interrupt!)
    const isSigningInProgress = () => {
      return !!sessionStorage.getItem('p3.signing_in_progress');
    };
    
    // Only Hub is the primary route for auto-triggering popouts
    // Other routes can show the button if already active, but don't auto-trigger
    const isHubRoute = window.location.pathname.startsWith('/launcher');
    const shouldAutoTrigger = options?.isPrimaryRoute ?? isHubRoute;
    
    if (!shouldAutoTrigger) {
      // Non-primary routes just subscribe to state, don't trigger
      return;
    }
    
    // Initial check with LONGER delay - give signature time to propagate
    // 2 seconds allows wallet to request and receive signature confirmation
    const timer = setTimeout(() => {
      if (hasFullAuth() && !isSigningInProgress()) {
        console.log('[Popout] Full auth detected, triggering popout check');
        PopoutController.checkAndTrigger();
      } else {
        console.log('[Popout] Waiting for full auth or signing in progress');
      }
    }, 2000);
    
    // Re-check when page becomes visible (user returns from wallet home)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && shouldAutoTrigger) {
        // Longer delay on visibility change - wallet may still be processing
        setTimeout(() => {
          if (hasFullAuth() && !isSigningInProgress()) {
            PopoutController.checkAndTrigger();
          }
        }, 1500);
      }
    };
    
    // Re-check on focus (alternative trigger)
    const handleFocus = () => {
      if (shouldAutoTrigger) {
        setTimeout(() => {
          if (hasFullAuth() && !isSigningInProgress()) {
            PopoutController.checkAndTrigger();
          }
        }, 1500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [options?.isPrimaryRoute]);
}
