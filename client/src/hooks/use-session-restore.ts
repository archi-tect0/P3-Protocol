import { useEffect, useState } from 'react';
import { consumeInstallToken } from '@/lib/sessionBridgeV2';

/**
 * Hook to restore wallet session on page load (Primary Innovation 5)
 * 
 * Handles:
 * - install_token parameter from browser handoff
 * - wallet_return parameter for session continuity
 * - from_wallet_browser for legacy support
 */
export function useSessionRestore() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoredWallet, setRestoredWallet] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      const params = new URLSearchParams(window.location.search);
      const installToken = params.get('install_token');
      const walletReturn = params.get('wallet_return');
      const fromWalletBrowser = params.get('from_wallet_browser');

      // Check if we need to restore session
      if (installToken || walletReturn === 'true' || fromWalletBrowser === 'true') {
        setIsRestoring(true);
        
        try {
          // Use the session bridge's token consumption
          const result = await consumeInstallToken();
          
          if (result.success && result.walletAddress) {
            console.log('[SessionRestore] Session restored:', result.walletAddress);
            setRestoredWallet(result.walletAddress);
            
            // Dispatch event for other components
            window.dispatchEvent(new CustomEvent('p3:session:restored', {
              detail: { walletAddress: result.walletAddress }
            }));
          } else if (!installToken) {
            // No token but wallet_return - check localStorage
            const existingWallet = localStorage.getItem('walletAddress');
            if (existingWallet) {
              console.log('[SessionRestore] Using existing wallet:', existingWallet);
              setRestoredWallet(existingWallet);
              
              // Clean URL
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('wallet_return');
              cleanUrl.searchParams.delete('from_wallet_browser');
              cleanUrl.searchParams.delete('wc');
              window.history.replaceState({}, '', cleanUrl.toString());
            }
          }
        } catch (error) {
          console.error('[SessionRestore] Error:', error);
        } finally {
          setIsRestoring(false);
        }
      } else {
        // No URL params - check for existing wallet in localStorage
        const existingWallet = localStorage.getItem('walletAddress');
        if (existingWallet) {
          setRestoredWallet(existingWallet);
        }
      }
    };

    restoreSession();
  }, []);

  return { isRestoring, restoredWallet };
}
