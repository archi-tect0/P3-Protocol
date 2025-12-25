import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { WalletLauncherMenu } from '@/components/WalletLauncherMenu';
import SEO, { pageSEO } from '@/components/SEO';
import type { BridgeSession } from '@/lib/sessionBridgeV2';
import { triggerAtlasPopout, detectWalletBrowser, authenticateWithPin, setupPin as setupPinApi, checkPinStatus } from '@/lib/sessionBridgeV2';
import { PinAuthDialog } from '@/components/PinAuthDialog';
import { BrowserHandoffButton, useAutoPopout } from '@/components/BrowserHandoffButton';
import { useSessionRestore } from '@/hooks/use-session-restore';
import { 
  detectWalletBrowser as detectWalletConfig, 
  getEscapeUrls, 
  detectPlatform,
  requiresIosShare,
  getTargetBrowserName 
} from '@/lib/walletPopoutMatrix';
import { 
  Wallet,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Globe,
  Lock,
  Unlock
} from 'lucide-react';
import AtlasPresence from '@/components/atlas/AtlasPresence';
import AtlasReceiptsBar from '@/components/atlas/AtlasReceiptsBar';
import AtlasSuggestionTray from '@/components/atlas/AtlasSuggestionTray';
import AtlasCanvas from '@/components/atlas/AtlasCanvas';
import AtlasTiles from '@/components/atlas/AtlasTiles';
import OnboardingFlow from '@/components/atlas/OnboardingFlow';
import { useAtlasStore } from '@/state/useAtlasStore';

function hapticFeedback(pattern: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[pattern]);
  }
}

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Debug panel for auth state visibility
interface AuthDebugInfo {
  step: string;
  hasWallet: boolean;
  hasToken: boolean;
  tokenValid: boolean;
  tokenExpiry: string;
  error: string;
  signMethod: string;
}

export default function AtlasShell() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [authDebug, setAuthDebug] = useState<AuthDebugInfo>({ 
    step: 'init', hasWallet: false, hasToken: false, tokenValid: false, tokenExpiry: '', error: '', signMethod: '' 
  });
  const [showDebug, setShowDebug] = useState(false); // Debug panel disabled
  
  // PIN Authentication Dialog State
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinAddress, setPinAddress] = useState('');
  const [pinHasPin, setPinHasPin] = useState(false);
  const [pinIsLocked, setPinIsLocked] = useState(false);
  const [pinLockoutRemaining, setPinLockoutRemaining] = useState(0);
  
  const { setWallet, setRole, setRenderables, mode, setMode, loadVisualization, loadOnboardingState } = useAtlasStore();
  
  useAutoPopout({ isPrimaryRoute: true }); // Atlas is a primary entry point
  
  const { restoredWallet } = useSessionRestore();
  
  useEffect(() => {
    if (restoredWallet && !session) {
      console.log('[AtlasShell] Session restored from install_token:', restoredWallet);
      checkSession();
    }
  }, [restoredWallet]);

  useEffect(() => {
    setAuthDebug(prev => ({ ...prev, step: 'useEffect init' }));
    checkSession();
    registerServiceWorker();
  }, []);

  // CRITICAL: Resume WalletConnect session when tab becomes visible
  // This handles the case where user approved in wallet app and returns to Chrome
  useEffect(() => {
    let resumeInProgress = false;
    
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (session) return; // Already have session, no need to resume
      if (resumeInProgress) return; // Prevent re-entrancy
      
      resumeInProgress = true;
      console.log('[AtlasShell] Tab became visible - checking for WalletConnect session');
      
      try {
        const { resumeSession } = await import('@/lib/sessionBridgeV2');
        const bridgeSession = await resumeSession();
        
        if (bridgeSession?.address) {
          console.log('[AtlasShell] WalletConnect session found on visibility:', bridgeSession.address.slice(0, 10));
          // Feed into the existing handleWalletConnect pipeline
          handleWalletConnect(bridgeSession);
        } else {
          console.log('[AtlasShell] No WalletConnect session to resume');
        }
      } catch (err) {
        console.error('[AtlasShell] Session resume error:', err);
      } finally {
        resumeInProgress = false;
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [session]);

  useEffect(() => {
    if (session?.wallet) {
      fetchCanvasRenderables();
      fetchVisualizationSettings();
    }
  }, [session?.wallet]);

  // Handle PWA shortcut query params (?mode=xxx or ?app=xxx)
  useEffect(() => {
    if (loading) return;
    
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const appParam = params.get('app');
    
    if (modeParam) {
      console.log('[AtlasShell] PWA shortcut mode:', modeParam);
      const { dissolveInto } = useAtlasStore.getState();
      dissolveInto(modeParam as any);
      // Clean URL
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('mode');
      window.history.replaceState({}, '', cleanUrl.toString());
    } else if (appParam) {
      console.log('[AtlasShell] PWA shortcut app:', appParam);
      const { openExternalApp } = useAtlasStore.getState();
      const appManifests: Record<string, { name: string; url: string; gradient: string }> = {
        'dehub': { name: 'DeHub', url: 'https://dehub.io', gradient: 'from-violet-500 to-purple-600' },
      };
      const app = appManifests[appParam];
      if (app) {
        openExternalApp({ id: appParam, name: app.name, url: app.url, icon: '🌐', gradient: app.gradient });
      }
      // Clean URL
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('app');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, [loading]);

  async function fetchCanvasRenderables() {
    try {
      const response = await fetch('/api/atlas/canvas/renderables');
      const data = await response.json();
      if (data.ok && data.renderables) {
        setRenderables(data.renderables);
      }
    } catch (err) {
      console.error('Failed to fetch Canvas renderables:', err);
    }
  }
  
  async function fetchVisualizationSettings() {
    if (!session?.wallet) return;
    try {
      const response = await fetch(`/api/atlas/canvas/settings/${session.wallet}`);
      const data = await response.json();
      if (data.ok && data.settings?.visualization) {
        loadVisualization(data.settings.visualization);
      }
    } catch (err) {
      console.error('Failed to fetch visualization settings:', err);
    }
  }

  // PIN Authentication Handlers
  const showPinDialog = async (address: string) => {
    console.log('[AtlasShell] Showing PIN dialog for:', address.slice(0, 10));
    const status = await checkPinStatus(address);
    setPinAddress(address);
    setPinHasPin(status.hasPin);
    setPinIsLocked(status.isLocked);
    setPinLockoutRemaining(status.lockoutRemaining);
    setPinDialogOpen(true);
    setLoading(false);
  };

  const handlePinSetup = async (pin: string): Promise<{ success: boolean; error?: string }> => {
    console.log('[AtlasShell] Setting up PIN for:', pinAddress.slice(0, 10));
    const result = await setupPinApi(pinAddress, pin);
    if (result.success) {
      setPinHasPin(true);
      toast({ title: 'PIN Set', description: 'Your PIN has been set up successfully' });
      const verifyResult = await authenticateWithPin(pinAddress, pin);
      if (verifyResult.success) {
        await completePinAuth(pinAddress);
      }
    }
    return result;
  };

  const handlePinVerify = async (pin: string): Promise<{ success: boolean; error?: string; attemptsRemaining?: number }> => {
    console.log('[AtlasShell] Verifying PIN for:', pinAddress.slice(0, 10));
    
    // Use centralized authenticateWithPin from sessionBridgeV2 (includes telemetry + token storage)
    const result = await authenticateWithPin(pinAddress, pin);
    
    if (result.success) {
      await completePinAuth(pinAddress);
      return { success: true };
    }
    
    return { 
      success: false, 
      error: result.error || 'Invalid PIN',
      attemptsRemaining: result.attemptsRemaining
    };
  };

  const completePinAuth = async (address: string) => {
    console.log('[AtlasShell] PIN auth complete, setting session:', address.slice(0, 10));
    
    // Reset dialog state for clean subsequent sessions
    setPinDialogOpen(false);
    setPinAddress('');
    setPinHasPin(false);
    setPinIsLocked(false);
    setPinLockoutRemaining(0);
    
    const grants = ['wallet', 'messages', 'registry'];
    const roles: string[] = ['user'];
    
    const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
    const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
    
    if (adminWallets.includes(address.toLowerCase())) {
      roles.push('admin');
      grants.push('admin');
    }
    if (modWallets.includes(address.toLowerCase())) {
      roles.push('moderator');
      grants.push('moderator');
    }
    
    setSession({
      wallet: address,
      grants,
      roles,
      expiresAt: Date.now() + 3600000,
    });
    
    toast({ title: 'Connected', description: `Welcome, ${truncateAddress(address)}` });
    
    const walletContext = detectWalletBrowser();
    const alreadyPopped = sessionStorage.getItem('p3.atlas.popoutTriggered') === 'done';
    
    if (walletContext.isWalletBrowser && !alreadyPopped) {
      console.log('[AtlasShell] Triggering popout after PIN auth');
      sessionStorage.setItem('p3.atlas.popoutTriggered', 'done');
      await triggerAtlasPopout(address);
    }
  };
  
  useEffect(() => {
    if (session?.wallet) {
      setWallet(session.wallet);
      if (session.roles.includes('admin')) {
        setRole('admin');
      } else if (session.roles.includes('moderator')) {
        setRole('moderator');
      } else if (session.roles.includes('developer')) {
        setRole('developer');
      }
    } else {
      setWallet(null);
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('atlas.greeted:')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, [session, setWallet, setRole]);

  useEffect(() => {
    async function checkOnboardingStatus() {
      if (!session?.wallet) return;
      
      try {
        const response = await fetch(`/api/atlas/settings?wallet=${session.wallet}`);
        const data = await response.json();
        
        if (data.ok && data.settings) {
          if (data.settings.onboardingCompleted) {
            localStorage.setItem(`atlas.onboarding.${session.wallet}`, JSON.stringify({
              completedAt: data.settings.onboardingCompletedAt || new Date().toISOString(),
              path: data.settings.onboardingPath,
            }));
            const completedAt = data.settings.onboardingCompletedAt 
              ? new Date(data.settings.onboardingCompletedAt).getTime() 
              : Date.now();
            loadOnboardingState(true, data.settings.onboardingPath, completedAt);
          } else {
            localStorage.removeItem(`atlas.onboarding.${session.wallet}`);
            loadOnboardingState(false, null, null);
            setShowOnboarding(true);
          }
        } else {
          localStorage.removeItem(`atlas.onboarding.${session.wallet}`);
          loadOnboardingState(false, null, null);
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error('Failed to check onboarding status:', err);
        const localOnboarding = localStorage.getItem(`atlas.onboarding.${session.wallet}`);
        if (localOnboarding) {
          try {
            const parsed = JSON.parse(localOnboarding);
            const completedAt = parsed.completedAt ? new Date(parsed.completedAt).getTime() : Date.now();
            loadOnboardingState(true, parsed.path || null, completedAt);
          } catch (parseErr) {
            loadOnboardingState(false, null, null);
            setShowOnboarding(true);
          }
        } else {
          loadOnboardingState(false, null, null);
          setShowOnboarding(true);
        }
      }
    }
    
    if (session?.wallet) {
      checkOnboardingStatus();
      
      const greetingKey = `atlas.greeted:${session.wallet}`;
      const hasGreeted = sessionStorage.getItem(greetingKey);
      if (!hasGreeted) {
        sessionStorage.setItem(greetingKey, 'true');
        
        if ('mediaDevices' in navigator && 'permissions' in navigator) {
          navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
            if (result.state === 'prompt') {
              setTimeout(() => {
                toast({
                  title: 'Enable voice input?',
                  description: 'Grant microphone access to use voice commands with Atlas.',
                });
              }, 2000);
            }
          }).catch(() => {});
        }
      }
    }
  }, [session?.wallet, toast, loadOnboardingState]);

  useEffect(() => {
    const checkVaultStatus = () => {
      const vaultStatus = sessionStorage.getItem('atlas.vault.unlocked');
      setVaultUnlocked(vaultStatus === 'true');
    };
    checkVaultStatus();
    const handleVaultChange = (e: CustomEvent) => {
      setVaultUnlocked(!!e.detail?.unlocked);
    };
    window.addEventListener('atlas:vault:changed' as any, handleVaultChange);
    window.addEventListener('storage', checkVaultStatus);
    return () => {
      window.removeEventListener('atlas:vault:changed' as any, handleVaultChange);
      window.removeEventListener('storage', checkVaultStatus);
    };
  }, []);

  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          if (reg.scope.includes('/atlas')) {
            await reg.unregister();
            console.log('[AtlasShell] Unregistered stale service worker:', reg.scope);
          }
        }
        if ('caches' in window) {
          const names = await caches.keys();
          for (const name of names) {
            if (name.includes('atlas')) {
              await caches.delete(name);
              console.log('[AtlasShell] Cleared cache:', name);
            }
          }
        }
      } catch (err) {
        console.warn('Atlas SW cleanup failed:', err);
      }
    }
  }

  async function checkSession() {
    setLoading(true);
    try {
      // CRITICAL FIX: Check for existing bridge session FIRST (like Hub/Nexus do)
      // This allows users who are already signed in to enter without re-auth
      const { getSession } = await import('@/lib/sessionBridgeV2');
      const existingSession = getSession();
      
      if (existingSession?.address && existingSession?.connected) {
        console.log('[AtlasShell] Found existing bridge session:', existingSession.address.slice(0, 10));
        
        const address = existingSession.address;
        const grants = ['wallet', 'messages', 'registry'];
        const roles: string[] = ['user'];
        
        const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
        const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
        
        if (adminWallets.includes(address.toLowerCase())) {
          roles.push('admin');
          grants.push('admin');
        }
        if (modWallets.includes(address.toLowerCase())) {
          roles.push('moderator');
          grants.push('moderator');
        }
        
        setSession({
          wallet: address,
          grants,
          roles,
          expiresAt: Date.now() + 3600000,
        });
        
        setWallet(address);
        setRole(roles.includes('admin') ? 'admin' : roles.includes('moderator') ? 'moderator' : 'user');
        setLoading(false);
        return; // Session restored from bridge - no further auth needed
      }
      
      const params = new URLSearchParams(window.location.search);
      let walletReturn = params.get('wallet_return');
      let pendingToken = params.get('pending_token');
      let walletId = params.get('wallet_id');
      const installToken = params.get('install_token');
      
      // CRITICAL: If URL params are missing, check sessionStorage for persisted token
      // This handles Chrome resuming with pristine URL after wallet deep link returns
      const storedPendingToken = sessionStorage.getItem('p3.pending_install_token');
      const storedWalletId = sessionStorage.getItem('p3.pending_wallet_id');
      
      if (!pendingToken && storedPendingToken) {
        pendingToken = storedPendingToken;
        walletId = storedWalletId;
        walletReturn = 'true'; // Implied by having stored pending token
        console.log('[AtlasShell] Recovered pending token from sessionStorage');
      }
      
      // Log to console AND diag for easier debugging
      console.log('[AtlasShell] checkSession start', { 
        walletReturn, 
        hasPendingToken: !!pendingToken,
        hasInstallToken: !!installToken,
        walletId,
        hasEthereum: !!window.ethereum,
        fromStorage: !params.get('pending_token') && !!storedPendingToken,
        url: window.location.href.slice(0, 100)
      });
      
      import('@/lib/diag').then(({ diag }) => {
        diag('AtlasShell', 'checkSession start', { 
          walletReturn, 
          hasPendingToken: !!pendingToken,
          hasInstallToken: !!installToken,
          walletId,
          hasEthereum: !!window.ethereum,
          fromStorage: !params.get('pending_token') && !!storedPendingToken
        });
      });
      
      // CRITICAL: Handle install_token FIRST before any other flow
      // This is the session bridge from wallet browser -> Chrome/Safari
      // It does NOT require ethereum provider - just consumes token and restores session
      if (installToken) {
        console.log('[AtlasShell] Install token detected - consuming for session bridge');
        import('@/lib/diag').then(({ diag }) => {
          diag('AtlasShell', 'Install token detected', { tokenPrefix: installToken.slice(0, 8) });
        });
        
        try {
          const consumeRes = await fetch('/api/pwa/consume-install-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: installToken }),
            credentials: 'include'
          });
          
          if (consumeRes.ok) {
            const data = await consumeRes.json();
            console.log('[AtlasShell] Install token consumed successfully:', data);
            
            if (data.walletAddress) {
              // Clean URL AFTER successful consumption
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('wallet_return');
              cleanUrl.searchParams.delete('pending_token');
              cleanUrl.searchParams.delete('wallet_id');
              cleanUrl.searchParams.delete('install_token');
              cleanUrl.searchParams.delete('wc');
              window.history.replaceState({}, '', cleanUrl.toString());
              
              // Store wallet address AND tokens (critical for Chrome persistence)
              localStorage.setItem('walletAddress', data.walletAddress);
              if (data.token) {
                localStorage.setItem('token', data.token); // JWT for API auth
                console.log('[AtlasShell] Stored JWT token from install_token consumption');
              }
              if (data.atlasSessionToken) {
                localStorage.setItem('atlas_session_token', data.atlasSessionToken); // Atlas session for NodeMode
                console.log('[AtlasShell] Stored atlas session token from install_token consumption');
              } else if (data.token) {
                // Fallback: use JWT if no separate atlas token
                localStorage.setItem('atlas_session_token', data.token);
              }
              
              // Set session from consumed token
              const grants = ['wallet', 'messages', 'registry'];
              const roles: string[] = ['user'];
              
              const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
              const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
              
              if (adminWallets.includes(data.walletAddress.toLowerCase())) {
                roles.push('admin');
                grants.push('admin');
              }
              if (modWallets.includes(data.walletAddress.toLowerCase())) {
                roles.push('moderator');
                grants.push('moderator');
              }
              
              setSession({
                wallet: data.walletAddress,
                grants,
                roles,
                expiresAt: Date.now() + 3600000,
              });
              
              toast({ title: 'Session Restored', description: `Welcome back, ${truncateAddress(data.walletAddress)}` });
              
              setAuthDebug(prev => ({ 
                ...prev, 
                step: 'token bridge ok', 
                hasWallet: true, 
                hasToken: !!data.token,
                tokenValid: true 
              }));
              
              import('@/lib/diag').then(({ diag }) => {
                diag('AtlasShell', 'Session restored from install token', { wallet: data.walletAddress.slice(0, 10), hasToken: !!data.token });
              });
              
              setLoading(false);
              return; // Exit here - session is restored
            }
          } else {
            const errData = await consumeRes.json().catch(() => ({}));
            console.error('[AtlasShell] Install token consumption failed:', errData);
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'Install token consumption failed', { error: errData.error });
            });
          }
        } catch (err) {
          console.error('[AtlasShell] Install token network error:', err);
        }
        
        // Token consumption failed - clean up URL and continue to normal flow
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('install_token');
        cleanUrl.searchParams.delete('wallet_return');
        window.history.replaceState({}, '', cleanUrl.toString());
      }
      
      // Clean up URL params for other flows (not install_token - handled above)
      if (walletReturn || pendingToken) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('wallet_return');
        cleanUrl.searchParams.delete('pending_token');
        cleanUrl.searchParams.delete('wallet_id');
        cleanUrl.searchParams.delete('wc');
        window.history.replaceState({}, '', cleanUrl.toString());
      }
      
      // If returning from wallet app, wait for ethereum provider if not ready
      if (walletReturn && !installToken) {
        console.log('[AtlasShell] Wallet return detected, checking ethereum provider');
        
        // Wait up to 3 seconds for ethereum provider to be injected
        let ethereum = window.ethereum;
        if (!ethereum) {
          console.log('[AtlasShell] No ethereum provider, waiting...');
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            if (window.ethereum) {
              ethereum = window.ethereum;
              console.log('[AtlasShell] Ethereum provider found after', (i + 1) * 100, 'ms');
              break;
            }
          }
        }
        
        // If no ethereum but we have pending_token, try to consume it
        // This handles cases where SIWE completed but popout failed, or token was already bound
        if (!ethereum && pendingToken) {
          console.log('[AtlasShell] No ethereum but have pending_token - attempting consumption');
          import('@/lib/diag').then(({ diag }) => {
            diag('AtlasShell', 'No ethereum with pending_token - trying consume', { tokenPrefix: pendingToken.slice(0, 8) });
          });
          
          try {
            const consumeRes = await fetch('/api/pwa/consume-install-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: pendingToken }),
              credentials: 'include'
            });
            
            // 200 = fully consumed, 202 = pending (SIWE not done yet)
            if (consumeRes.ok && consumeRes.status === 200) {
              const data = await consumeRes.json();
              console.log('[AtlasShell] Pending token consumed:', data);
              
              if (data.walletAddress && data.walletAddress !== 'pending') {
                // Clean URL
                const cleanUrl = new URL(window.location.href);
                cleanUrl.searchParams.delete('wallet_return');
                cleanUrl.searchParams.delete('pending_token');
                cleanUrl.searchParams.delete('wallet_id');
                window.history.replaceState({}, '', cleanUrl.toString());
                
                // Store wallet address and tokens
                localStorage.setItem('walletAddress', data.walletAddress);
                if (data.token) {
                  localStorage.setItem('token', data.token);
                }
                if (data.atlasSessionToken) {
                  localStorage.setItem('atlas_session_token', data.atlasSessionToken);
                }
                
                // Set session
                setSession({
                  wallet: data.walletAddress,
                  grants: ['wallet', 'messages', 'registry'],
                  roles: ['user'],
                  expiresAt: Date.now() + 3600000,
                });
                
                toast({ title: 'Connected', description: `Welcome, ${truncateAddress(data.walletAddress)}` });
                setLoading(false);
                return;
              }
            } else {
              const errData = await consumeRes.json().catch(() => ({}));
              console.log('[AtlasShell] Pending token consume result:', consumeRes.status, errData.error);
              
              // 202 = pending (SIWE not complete), other errors logged
              if (consumeRes.status === 202 || errData.error === 'TOKEN_NOT_BOUND') {
                import('@/lib/diag').then(({ diag }) => {
                  diag('AtlasShell', 'Token pending - needs wallet signature');
                });
              }
            }
          } catch (err) {
            console.error('[AtlasShell] Pending token consume error:', err);
          }
          
          // Clean URL and fall through to show connect wallet with message
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete('wallet_return');
          cleanUrl.searchParams.delete('pending_token');
          cleanUrl.searchParams.delete('wallet_id');
          window.history.replaceState({}, '', cleanUrl.toString());
          
          // Show message with recovery option - user can tap Connect Wallet again
          toast({ 
            title: 'Connection Incomplete', 
            description: 'Tap Connect Wallet and sign in your wallet app',
          });
          setLoading(false);
          return;
        }
        
        if (!ethereum) {
          console.log('[AtlasShell] No ethereum provider after 3s, cannot connect');
          toast({ 
            title: 'Wallet Not Ready', 
            description: 'Please try connecting again',
            variant: 'destructive'
          });
          setLoading(false);
          return;
        }
      }
      
      // If returning from wallet app, auto-trigger connection and signature
      if (walletReturn && window.ethereum) {
        console.log('[AtlasShell] Wallet return with ethereum - triggering connect', { walletId });
        import('@/lib/diag').then(({ diag }) => {
          diag('AtlasShell', 'Wallet return detected - auto-triggering connect', { walletId });
        });
        
        // Helper to cleanup ALL pending token storage hints (prevents replay from any source)
        const clearAllTokenHints = () => {
          // Session storage hints
          sessionStorage.removeItem('p3.pending_install_token');
          sessionStorage.removeItem('p3.pending_wallet_id');
          sessionStorage.removeItem('p3.install_token');
          sessionStorage.removeItem('p3.bridge.pendingToken');
          
          // Local storage hints  
          localStorage.removeItem('p3.pending_install_token');
          localStorage.removeItem('p3.pending_wallet_id');
          localStorage.removeItem('p3.install_token');
          localStorage.removeItem('p3.bridge.pendingToken');
        };
        
        // Helper to complete pending token atomically (bind + consume in one call)
        // Returns true only if token was successfully consumed (single-use enforced)
        const completePendingToken = async (token: string | null, wallet: string): Promise<boolean> => {
          if (!token) {
            clearAllTokenHints();
            return true; // No token to consume, proceed
          }
          
          try {
            const res = await fetch('/api/pwa/complete-pending-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, walletAddress: wallet }),
              credentials: 'include'
            });
            
            if (res.ok) {
              clearAllTokenHints(); // Only clear after confirmed consumption
              import('@/lib/diag').then(({ diag }) => {
                diag('AtlasShell', 'Completed pending token', { tokenPrefix: token.slice(0, 8) });
              });
              return true;
            } else {
              const err = await res.json().catch(() => ({}));
              import('@/lib/diag').then(({ diag }) => {
                diag('AtlasShell', 'Token completion failed', { status: res.status, error: err.error });
              });
              // Attempt cleanup via consume endpoint as fallback
              await cleanupPendingToken(token);
              return false;
            }
          } catch (e) {
            console.error('Failed to complete pending token:', e);
            // Network error - attempt cleanup and fail
            await cleanupPendingToken(token);
            return false;
          }
        };
        
        // Helper to cleanup pending token on failure (just consume without binding)
        // Only clears storage hints AFTER confirmed server consumption
        const cleanupPendingToken = async (token: string | null) => {
          if (!token) {
            clearAllTokenHints(); // No token, safe to clear
            return;
          }
          
          try {
            const res = await fetch('/api/pwa/consume-install-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
              credentials: 'include'
            });
            
            if (res.ok) {
              clearAllTokenHints(); // Only clear after confirmed consumption
              import('@/lib/diag').then(({ diag }) => {
                diag('AtlasShell', 'Cleanup consumed pending token');
              });
            } else {
              // Server rejected consumption - leave hints intact for retry/debugging
              import('@/lib/diag').then(({ diag }) => {
                diag('AtlasShell', 'Cleanup consumption failed - hints preserved', { status: res.status });
              });
            }
          } catch (e) {
            // Network error - leave hints intact for retry
            console.error('Failed to consume pending token:', e);
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'Cleanup network error - hints preserved');
            });
          }
        };
        
        try {
          // Request accounts from injected provider
          console.log('[AtlasShell] Calling eth_requestAccounts...');
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          console.log('[AtlasShell] eth_requestAccounts result:', accounts?.length, 'accounts');
          
          if (accounts && accounts.length > 0) {
            const address = accounts[0];
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'Got account from wallet', { address: address.slice(0, 10) });
            });
            
            // Store the wallet address
            localStorage.setItem('walletAddress', address);
            
            // Note: Pending token binding is now done atomically after SIWE via completePendingToken
            
            // Check if this is Coinbase wallet - use PIN auth instead of SIWE
            // Use async detection that waits for provider injection
            const { detectCoinbaseWalletAsync } = await import('@/lib/coinbaseAuth');
            const isCoinbaseWallet = await detectCoinbaseWalletAsync();
            
            if (isCoinbaseWallet) {
              import('@/lib/diag').then(({ diag }) => {
                diag('AtlasShell', 'Coinbase wallet detected - using PIN auth');
              });
              
              await showPinDialog(address);
              return; // PIN dialog will handle session setup
            }
            
            // Standard SIWE authentication for non-Coinbase wallets
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'Triggering SIWE authentication');
            });
            
            const { authenticateWallet, signWithBridge, triggerAtlasPopout } = await import('@/lib/sessionBridgeV2');
            const authSuccess = await authenticateWallet(address, signWithBridge);
            
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'SIWE auth result', { success: authSuccess });
            });
            
            if (authSuccess) {
              // Atomically bind + consume the pending token now that auth succeeded
              const tokenConsumed = await completePendingToken(pendingToken, address);
              
              if (!tokenConsumed && pendingToken) {
                // Token consumption failed - abort session to prevent replay attack
                toast({ 
                  title: 'Session Error', 
                  description: 'Please try connecting again',
                  variant: 'destructive'
                });
                setLoading(false);
                return;
              }
              
              // Set session
              const grants = ['wallet', 'messages', 'registry'];
              const roles: string[] = ['user'];
              
              const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
              const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
              
              if (adminWallets.includes(address.toLowerCase())) {
                roles.push('admin');
                grants.push('admin');
              }
              if (modWallets.includes(address.toLowerCase())) {
                roles.push('moderator');
                grants.push('moderator');
              }
              
              setSession({
                wallet: address,
                grants,
                roles,
                expiresAt: Date.now() + 3600000,
              });
              
              toast({ title: 'Connected', description: `Wallet ${truncateAddress(address)} authenticated` });
              
              // Trigger popout to Chrome/Safari after successful auth
              // BUT ONLY if this is the first auth - NOT on return from popout
              // Check: walletReturn = post-popout return, sessionStorage flag = already triggered
              const alreadyPopped = sessionStorage.getItem('p3.atlas.popoutTriggered') === 'done';
              
              if (walletReturn || alreadyPopped) {
                // We're returning FROM popout or already triggered - don't loop!
                console.log('[AtlasShell] Skipping popout - already returned/triggered:', { walletReturn, alreadyPopped });
                sessionStorage.removeItem('p3.atlas.popoutTriggered'); // Clear for next session
              } else {
                // First auth in wallet browser - trigger popout
                console.log('[AtlasShell] Triggering popout with address:', address.slice(0, 10));
                sessionStorage.setItem('p3.atlas.popoutTriggered', 'done');
                await triggerAtlasPopout(address);
              }
              
              setLoading(false);
              return;
            } else {
              // SIWE failed or was cancelled - cleanup token and exit
              // Don't fall through to auto-SIWE which would double-prompt
              await cleanupPendingToken(pendingToken);
              toast({ 
                title: 'Signature Required', 
                description: 'Please sign the message to connect',
                variant: 'destructive'
              });
              // Clear wallet address so we don't auto-retry SIWE
              localStorage.removeItem('walletAddress');
              setLoading(false);
              return;  // EXIT - don't fall through to auto-SIWE
            }
          } else {
            // No accounts returned - cleanup and exit
            await cleanupPendingToken(pendingToken);
            setLoading(false);
            return;
          }
        } catch (err: any) {
          import('@/lib/diag').then(({ diag }) => {
            diag('AtlasShell', 'Wallet return connect error', { error: err?.message });
          });
          console.error('Wallet return connect failed:', err);
          
          // Cleanup pending token on error - consume to prevent replay
          await cleanupPendingToken(pendingToken);
          
          // Clear wallet address so we don't auto-retry
          localStorage.removeItem('walletAddress');
          
          // User-friendly error message
          if (err?.code === 4001) {
            toast({ 
              title: 'Connection Cancelled', 
              description: 'You declined the connection request',
            });
          } else {
            toast({ 
              title: 'Connection Failed', 
              description: 'Please try connecting again',
              variant: 'destructive'
            });
          }
          setLoading(false);
          return;  // EXIT - don't fall through
        }
      }
      
      // Standard session check from localStorage - requires valid JWT token
      const bridgeSession = localStorage.getItem('p3.bridge.session');
      const walletAddress = localStorage.getItem('walletAddress');
      const jwtToken = localStorage.getItem('token');
      
      console.log('[AtlasShell] checkSession - localStorage state:', {
        hasBridgeSession: !!bridgeSession,
        hasWalletAddress: !!walletAddress,
        walletAddress: walletAddress?.slice(0, 10),
        hasToken: !!jwtToken,
        tokenLength: jwtToken?.length,
        tokenStart: jwtToken?.slice(0, 30)
      });
      
      setAuthDebug(prev => ({ 
        ...prev, 
        step: 'checking', 
        hasWallet: !!walletAddress || !!bridgeSession,
        hasToken: !!jwtToken 
      }));
      
      // Helper: Decode base64url (handles Coinbase/mobile wallet tokens correctly)
      function decodeBase64Url(str: string): string {
        // Replace URL-safe chars with standard base64 chars
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        // Remove any existing padding first, then add correct padding
        base64 = base64.replace(/=+$/, '');
        const pad = base64.length % 4;
        if (pad === 2) base64 += '==';
        else if (pad === 3) base64 += '=';
        return atob(base64);
      }
      
      // Validate JWT token exists and is not expired
      let hasValidToken = false;
      if (jwtToken) {
        try {
          const parts = jwtToken.split('.');
          console.log('[AtlasShell] JWT parts:', { count: parts.length, part1Len: parts[1]?.length });
          
          if (parts.length === 3) {
            const decoded = decodeBase64Url(parts[1]);
            console.log('[AtlasShell] JWT decoded payload:', decoded.slice(0, 100));
            const payload = JSON.parse(decoded);
            const expiry = payload.exp ? payload.exp * 1000 : 0;
            hasValidToken = expiry > Date.now();
            const expiresIn = Math.round((expiry - Date.now()) / 1000);
            console.log('[AtlasShell] JWT validation:', { 
              hasValidToken, 
              expiry: new Date(expiry).toISOString(),
              now: new Date().toISOString(),
              expiresIn: expiresIn + 's'
            });
            
            setAuthDebug(prev => ({ 
              ...prev, 
              tokenValid: hasValidToken, 
              tokenExpiry: hasValidToken ? `${expiresIn}s` : 'EXPIRED',
              step: hasValidToken ? 'valid' : 'expired'
            }));
            
            if (!hasValidToken) {
              console.log('[AtlasShell] JWT token expired, clearing');
              localStorage.removeItem('token');
              localStorage.removeItem('atlas_session_token');
            }
          } else {
            console.log('[AtlasShell] Invalid JWT format (not 3 parts)');
            setAuthDebug(prev => ({ ...prev, error: 'bad format', step: 'error' }));
            localStorage.removeItem('token');
          }
        } catch (e: any) {
          console.log('[AtlasShell] JWT decode error:', e?.message, e);
          setAuthDebug(prev => ({ ...prev, error: e?.message || 'decode fail', step: 'error' }));
          // Don't clear token on decode error - might be a different format
        }
      } else {
        console.log('[AtlasShell] No JWT token found in localStorage');
        setAuthDebug(prev => ({ ...prev, step: 'no token' }));
      }
      
      if ((bridgeSession || walletAddress) && hasValidToken) {
        let address = walletAddress;
        if (!address && bridgeSession) {
          try {
            const parsed = JSON.parse(bridgeSession);
            address = parsed.address;
          } catch (e) {}
        }
        
        if (address) {
          console.log('[AtlasShell] Restoring session with valid JWT for:', address.slice(0, 10));
          const grants = ['wallet', 'messages', 'registry'];
          const roles: string[] = ['user'];
          
          const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
          const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
          
          if (adminWallets.includes(address.toLowerCase())) {
            roles.push('admin');
            grants.push('admin');
          }
          if (modWallets.includes(address.toLowerCase())) {
            roles.push('moderator');
            grants.push('moderator');
          }
          
          setSession({
            wallet: address,
            grants,
            roles,
            expiresAt: Date.now() + 3600000,
          });
        }
      } else if (walletAddress && !hasValidToken) {
        // Wallet exists but no JWT - check if we can auto-sign
        const walletContext = detectWalletBrowser();
        let hasEthereum = typeof window.ethereum !== 'undefined';
        
        // Check if we came from wallet via URL params - strong signal we're in wallet browser
        const urlParams = new URLSearchParams(window.location.search);
        const hasWalletReturn = urlParams.has('wallet_return') || urlParams.has('pending_token');
        const likelyWalletBrowser = walletContext.isWalletBrowser || hasWalletReturn;
        
        console.log('[AtlasShell] Wallet context check:', {
          isWalletBrowser: walletContext.isWalletBrowser,
          hasWalletReturn,
          likelyWalletBrowser,
          hasEthereum
        });
        
        // CRITICAL: In wallet browsers, window.ethereum may inject asynchronously
        // Wait up to 3 seconds for it to appear before giving up
        // Also wait if we have wallet_return/pending_token - detectWalletBrowser may fail before injection
        if (likelyWalletBrowser && !hasEthereum) {
          console.log('[AtlasShell] Wallet browser likely but no provider yet - waiting...');
          setAuthDebug(prev => ({ ...prev, step: 'waiting for wallet' }));
          
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            if (typeof window.ethereum !== 'undefined') {
              hasEthereum = true;
              console.log('[AtlasShell] Provider injected after', (i + 1) * 100, 'ms');
              break;
            }
          }
          
          if (!hasEthereum) {
            console.log('[AtlasShell] Provider never injected - clearing stale wallet');
            setAuthDebug(prev => ({ ...prev, step: 'no provider', hasWallet: false }));
            localStorage.removeItem('walletAddress');
            return;
          }
        }
        
        if (likelyWalletBrowser || hasEthereum) {
          // CRITICAL: Verify the current provider's address matches localStorage
          // This prevents "sign cancelled" when stale wallet data exists from a different wallet
          let currentAddress = walletAddress;
          
          // Wait for accounts to be available (wallet may still be connecting)
          let accounts: string[] = [];
          for (let i = 0; i < 30; i++) {
            try {
              accounts = await window.ethereum!.request({ method: 'eth_accounts' });
              if (accounts && accounts.length > 0) break;
            } catch (e) {}
            
            if (i === 0) {
              console.log('[AtlasShell] No accounts yet - waiting for wallet to connect...');
              setAuthDebug(prev => ({ ...prev, step: 'waiting for accounts' }));
            }
            await new Promise(r => setTimeout(r, 100));
          }
          
          if (accounts && accounts.length > 0) {
            const providerAddress = accounts[0].toLowerCase();
            if (providerAddress !== walletAddress.toLowerCase()) {
              console.log('[AtlasShell] Provider address mismatch - clearing stale data', {
                stored: walletAddress.slice(0, 10),
                provider: providerAddress.slice(0, 10)
              });
              // Clear stale data and use fresh address
              localStorage.removeItem('walletAddress');
              localStorage.removeItem('p3.bridge.session');
              localStorage.removeItem('token');
              currentAddress = accounts[0];
              localStorage.setItem('walletAddress', currentAddress);
            }
          } else {
            // No accounts after waiting - can't auto-sign, let user click Connect
            console.log('[AtlasShell] No accounts after waiting - skipping auto-SIWE');
            setAuthDebug(prev => ({ ...prev, step: 'no accounts', hasWallet: false }));
            localStorage.removeItem('walletAddress'); // Clear stale address
            return;
          }
          
          // We have a wallet provider - check for Coinbase first
          console.log('[AtlasShell] Wallet found, provider available');
          setAuthDebug(prev => ({ ...prev, step: 'auto-sign', hasWallet: true }));
          
          // Check if this is Coinbase wallet - use PIN auth
          // Use async detection that waits for provider injection
          const { detectCoinbaseWalletAsync: detectCB2 } = await import('@/lib/coinbaseAuth');
          const isCoinbaseWallet2 = await detectCB2();
          
          if (isCoinbaseWallet2) {
            console.log('[AtlasShell] Coinbase wallet detected - using PIN auth');
            toast({ title: 'Wallet Found', description: 'Please enter your PIN to authenticate' });
            await showPinDialog(currentAddress);
            return;
          }
          
          // Standard SIWE for non-Coinbase
          console.log('[AtlasShell] Auto-triggering SIWE signature');
          try {
            toast({ title: 'Authenticating...', description: 'Please sign to continue' });
            const { authenticateWallet, signWithBridge, triggerAtlasPopout: popout } = await import('@/lib/sessionBridgeV2');
            
            setAuthDebug(prev => ({ ...prev, step: 'signing...' }));
            const authSuccess = await authenticateWallet(currentAddress, signWithBridge);
            
            if (authSuccess) {
              console.log('[AtlasShell] Auto-SIWE successful');
              setAuthDebug(prev => ({ ...prev, step: 'signed ok', hasToken: true, tokenValid: true }));
              
              // Set session after successful auth
              const grants = ['wallet', 'messages', 'registry'];
              const roles: string[] = ['user'];
              
              const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
              const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
              
              if (adminWallets.includes(currentAddress.toLowerCase())) {
                roles.push('admin');
                grants.push('admin');
              }
              if (modWallets.includes(currentAddress.toLowerCase())) {
                roles.push('moderator');
                grants.push('moderator');
              }
              
              setSession({
                wallet: currentAddress,
                grants,
                roles,
                expiresAt: Date.now() + 3600000,
              });
              
              toast({ title: 'Authenticated', description: `Welcome, ${truncateAddress(currentAddress)}` });
              
              // Trigger popout if in wallet browser
              if (likelyWalletBrowser) {
                console.log('[Atlas] Triggering popout after auto-SIWE');
                await popout(currentAddress);
              }
            } else {
              console.log('[AtlasShell] Auto-SIWE cancelled or failed');
              setAuthDebug(prev => ({ ...prev, step: 'sign cancelled', error: 'user declined' }));
            }
          } catch (err: any) {
            console.error('[AtlasShell] Auto-SIWE error:', err);
            setAuthDebug(prev => ({ ...prev, step: 'sign error', error: err?.message || 'unknown' }));
          }
        } else {
          // No wallet provider (e.g., Chrome without extension) - show connect button
          console.log('[AtlasShell] Wallet in localStorage but no provider - clearing stale wallet');
          setAuthDebug(prev => ({ ...prev, step: 'no provider', hasWallet: false }));
          // Clear stale wallet address since we can't use it without a provider
          localStorage.removeItem('walletAddress');
        }
      }
    } catch (err) {
      console.error('Session check failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleWalletConnect(bridgeSession: BridgeSession) {
    const logShell = (step: string, data?: any) => {
      const timestamp = new Date().toISOString().slice(11, 23);
      console.log(`%c[AtlasShell ${timestamp}] ${step}`, 'color: #00bfff; font-weight: bold', data || '');
    };
    
    logShell('handleWalletConnect CALLED', { address: bridgeSession?.address?.slice(0, 10) });
    hapticFeedback('medium');
    if (bridgeSession?.address) {
      localStorage.setItem('walletAddress', bridgeSession.address);
      localStorage.setItem('p3.bridge.session', JSON.stringify(bridgeSession));
      logShell('Stored wallet to localStorage', { address: bridgeSession.address.slice(0, 10) });
      
      // Helper: Decode base64url properly
      function decodeBase64Url(str: string): string {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        base64 = base64.replace(/=+$/, '');
        const pad = base64.length % 4;
        if (pad === 2) base64 += '==';
        else if (pad === 3) base64 += '=';
        return atob(base64);
      }
      
      // Check if we already have a valid JWT - if so, just restore session
      const existingToken = localStorage.getItem('token');
      let hasValidJwt = false;
      if (existingToken) {
        try {
          const parts = existingToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(decodeBase64Url(parts[1]));
            hasValidJwt = payload.exp ? payload.exp * 1000 > Date.now() : false;
          }
        } catch (e) {
          hasValidJwt = false;
        }
      }
      
      logShell('Checking for existing JWT', { hasExisting: !!existingToken, hasValidJwt });
      setAuthDebug(prev => ({ ...prev, step: 'wallet connected', hasWallet: true }));
      
      if (hasValidJwt) {
        // Valid JWT exists - just restore session
        logShell('Has valid JWT - restoring session', {});
        setAuthDebug(prev => ({ ...prev, step: 'has jwt', hasToken: true }));
        checkSession();
        toast({ title: 'Connected', description: `Wallet ${truncateAddress(bridgeSession.address)} connected` });
      } else {
        // No valid JWT - trigger authentication
        logShell('No valid JWT - need authentication', {});
        setAuthDebug(prev => ({ ...prev, step: 'need sign' }));
        
        // Check if this is Coinbase wallet - use PIN auth
        // Use async detection that waits for provider injection
        const { detectCoinbaseWalletAsync: detectCB3 } = await import('@/lib/coinbaseAuth');
        const isCoinbaseWallet = await detectCB3();
        
        if (isCoinbaseWallet) {
          logShell('Coinbase wallet detected - using PIN auth', {});
          toast({ title: 'Wallet Connected', description: 'Please enter your PIN to authenticate' });
          await showPinDialog(bridgeSession.address);
          return;
        }
        
        toast({ title: 'Wallet Connected', description: 'Please sign to authenticate...' });
        
        try {
          logShell('Calling authenticateWallet...', {});
          setAuthDebug(prev => ({ ...prev, step: 'signing...' }));
          const { authenticateWallet, signWithBridge, triggerAtlasPopout: popout } = await import('@/lib/sessionBridgeV2');
          const authSuccess = await authenticateWallet(bridgeSession.address, signWithBridge);
          
          logShell('authenticateWallet returned', { authSuccess });
          
          if (authSuccess) {
            logShell('AUTH SUCCESS - setting session', { address: bridgeSession.address.slice(0, 10) });
            setAuthDebug(prev => ({ ...prev, step: 'signed ok', hasToken: true }));
            
            // Set session after successful auth
            const grants = ['wallet', 'messages', 'registry'];
            const roles: string[] = ['user'];
            
            const adminWallets = (import.meta.env.VITE_ADMIN_WALLETS || '').toLowerCase().split(',');
            const modWallets = (import.meta.env.VITE_MOD_WALLETS || '').toLowerCase().split(',');
            
            if (adminWallets.includes(bridgeSession.address.toLowerCase())) {
              roles.push('admin');
              grants.push('admin');
            }
            if (modWallets.includes(bridgeSession.address.toLowerCase())) {
              roles.push('moderator');
              grants.push('moderator');
            }
            
            logShell('Calling setSession NOW', { wallet: bridgeSession.address.slice(0, 10), grants, roles });
            setSession({
              wallet: bridgeSession.address,
              grants,
              roles,
              expiresAt: Date.now() + 3600000,
            });
            logShell('setSession COMPLETE - UI should update!', {});
            
            toast({ title: 'Authenticated', description: `Welcome, ${truncateAddress(bridgeSession.address)}` });
            
            // Trigger popout if in wallet browser - but guard against loops
            const walletContext = detectWalletBrowser();
            const alreadyPopped = sessionStorage.getItem('p3.atlas.popoutTriggered') === 'done';
            const returnParam = new URLSearchParams(window.location.search).get('wallet_return');
            
            if (walletContext.isWalletBrowser && !alreadyPopped && !returnParam) {
              console.log('[Atlas] Triggering popout after SIWE auth');
              sessionStorage.setItem('p3.atlas.popoutTriggered', 'done');
              await popout(bridgeSession.address);
            } else if (alreadyPopped || returnParam) {
              console.log('[Atlas] Skipping popout - already triggered or returning');
              sessionStorage.removeItem('p3.atlas.popoutTriggered');
            }
          } else {
            // SIWE was cancelled or failed
            setAuthDebug(prev => ({ ...prev, step: 'sign cancelled', error: 'user declined' }));
            toast({ 
              title: 'Signature Required', 
              description: 'Please sign to complete authentication',
              variant: 'destructive'
            });
          }
        } catch (err: any) {
          console.error('[AtlasShell] SIWE auth error:', err);
          setAuthDebug(prev => ({ ...prev, step: 'sign error', error: err?.message || 'unknown' }));
          if (err?.code === 4001) {
            toast({ title: 'Cancelled', description: 'Signature request was declined' });
          } else {
            toast({ title: 'Auth Failed', description: 'Please try again', variant: 'destructive' });
          }
        }
      }
      
      // Trigger popout if in wallet browser with valid JWT - but guard against loops
      const walletContext2 = detectWalletBrowser();
      const alreadyPopped2 = sessionStorage.getItem('p3.atlas.popoutTriggered') === 'done';
      const returnParam2 = new URLSearchParams(window.location.search).get('wallet_return');
      
      if (walletContext2.isWalletBrowser && hasValidJwt && !alreadyPopped2 && !returnParam2) {
        console.log('[Atlas] Wallet connected in browser, triggering popout with address:', bridgeSession.address.slice(0, 10));
        sessionStorage.setItem('p3.atlas.popoutTriggered', 'done');
        await triggerAtlasPopout(bridgeSession.address);
      } else if (alreadyPopped2 || returnParam2) {
        console.log('[Atlas] Skipping final popout - already triggered or returning');
        sessionStorage.removeItem('p3.atlas.popoutTriggered');
      }
    }
  }

  function openWalletMenu() {
    hapticFeedback('light');
    setWalletMenuOpen(true);
  }

  async function openInNewWindow() {
    const walletConfig = detectWalletConfig();
    const platform = detectPlatform();
    const walletAddress = session?.wallet || localStorage.getItem('walletAddress');
    
    import('@/lib/diag').then(({ diag }) => {
      diag('AtlasShell', 'openInNewWindow clicked', { 
        screenWidth: window.screen.width, 
        screenHeight: window.screen.height,
        sessionWallet: walletAddress?.slice(0, 10),
        walletDetected: walletConfig?.id || 'none',
        platform
      });
    });
    hapticFeedback('medium');
    
    // If we're in a wallet browser WebView, generate token and use escape intents
    if (walletConfig && platform !== 'desktop') {
      import('@/lib/diag').then(({ diag }) => {
        diag('AtlasShell', 'Wallet browser detected - generating session token', { 
          wallet: walletConfig.id, 
          platform,
          hasWalletAddress: !!walletAddress
        });
      });
      
      // Generate transfer token if we have a wallet address
      let targetUrl = `${window.location.origin}/atlas`;
      
      if (walletAddress) {
        try {
          const tokenResponse = await fetch('/api/pwa/create-install-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, appMode: false }),
            credentials: 'include'
          });
          
          if (tokenResponse.ok) {
            const { token } = await tokenResponse.json();
            const params = new URLSearchParams();
            params.set('install_token', token);
            params.set('wallet_return', 'true');
            targetUrl = `${window.location.origin}/atlas?${params.toString()}`;
            
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'Session token generated', { tokenLength: token?.length });
            });
          } else {
            import('@/lib/diag').then(({ diag }) => {
              diag('AtlasShell', 'Token generation failed', { status: tokenResponse.status });
            });
          }
        } catch (err: any) {
          import('@/lib/diag').then(({ diag }) => {
            diag('AtlasShell', 'Token generation error', { error: err?.message });
          });
        }
      }
      
      // On iOS, try share sheet first if required
      if (platform === 'ios' && requiresIosShare() && navigator.share) {
        navigator.share({
          title: 'P3 Atlas',
          text: 'Open Atlas in Safari for the best experience',
          url: targetUrl
        }).then(() => {
          import('@/lib/diag').then(({ diag }) => {
            diag('AtlasShell', 'iOS share sheet completed');
          });
        }).catch((err) => {
          import('@/lib/diag').then(({ diag }) => {
            diag('AtlasShell', 'iOS share cancelled, trying escape URLs', { error: err?.message });
          });
          tryEscapeUrls(targetUrl);
        });
        return;
      }
      
      // Try escape URLs for Android or iOS without share
      tryEscapeUrls(targetUrl);
      return;
    }
    
    // Desktop or non-wallet browser - use standard popup
    const width = 420;
    const height = 700;
    const left = window.screen.width - width - 20;
    const top = 100;
    
    import('@/lib/diag').then(({ diag }) => {
      diag('AtlasShell', 'Opening popup (desktop mode)', { width, height, left, top });
    });
    
    const popup = window.open(
      '/atlas',
      'P3Atlas',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    setTimeout(() => {
      if (popup && !popup.closed && popup.location) {
        import('@/lib/diag').then(({ diag }) => {
          diag('AtlasShell', 'Popup verified open');
        });
      } else {
        import('@/lib/diag').then(({ diag }) => {
          diag('AtlasShell', 'Popup failed verification - offering fallback');
        });
        copyUrlFallback(`${window.location.origin}/atlas`);
      }
    }, 500);
  }
  
  function tryEscapeUrls(targetUrl: string) {
    const platform = detectPlatform();
    const walletConfig = detectWalletConfig();
    
    // For Trust Wallet on Android, Chrome intents are blocked - use share sheet or clipboard only
    if (platform === 'android' && walletConfig?.id === 'trust') {
      if (navigator.share) {
        import('@/lib/diag').then(({ diag }) => {
          diag('AtlasShell', 'Trust Wallet Android - trying share sheet', {});
        });
        
        navigator.share({
          title: 'P3 Atlas',
          text: 'Open in Chrome for the best experience',
          url: targetUrl
        }).then(() => {
          import('@/lib/diag').then(({ diag }) => {
            diag('AtlasShell', 'Trust share sheet completed');
          });
        }).catch(() => {
          // Share cancelled - go directly to clipboard (Chrome schemes blocked in Trust)
          copyUrlFallback(targetUrl);
        });
      } else {
        // No share API - go directly to clipboard
        import('@/lib/diag').then(({ diag }) => {
          diag('AtlasShell', 'Trust Wallet Android - no share API, using clipboard', {});
        });
        copyUrlFallback(targetUrl);
      }
      return;
    }
    
    // For other Android wallets, use Chrome intent (non-destructive)
    if (platform === 'android') {
      const urlObj = new URL(targetUrl);
      const intentUrl = `intent://${urlObj.host}${urlObj.pathname}${urlObj.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(targetUrl)};end`;
      
      import('@/lib/diag').then(({ diag }) => {
        diag('AtlasShell', 'Launching Chrome intent (iframe)', { intentUrl: intentUrl.slice(0, 100) });
      });
      
      // Use iframe-only approach - NEVER mutate window.location
      // This ensures the wallet browser keeps the authenticated session if intent fails
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = intentUrl;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch (e) {}
      }, 500);
      
      // Copy fallback after 2s (without breaking current page)
      setTimeout(() => {
        copyUrlFallback(targetUrl);
      }, 2000);
      return;
    }
    
    // iOS fallback - try window.open then copy (non-destructive)
    const escapeUrls = getEscapeUrls(targetUrl);
    if (escapeUrls && escapeUrls.length > 0) {
      import('@/lib/diag').then(({ diag }) => {
        diag('AtlasShell', 'Trying iOS escape URLs (window.open)', { count: escapeUrls.length });
      });
      
      // Use window.open instead of window.location.href - less destructive
      const newWindow = window.open(escapeUrls[0], '_blank');
      
      // If popup was blocked or failed, show copy fallback
      if (!newWindow || newWindow.closed) {
        copyUrlFallback(targetUrl);
      } else {
        setTimeout(() => {
          copyUrlFallback(targetUrl);
        }, 2000);
      }
    } else {
      copyUrlFallback(targetUrl);
    }
  }
  
  function copyUrlFallback(targetUrl: string) {
    const browserName = getTargetBrowserName();
    
    navigator.clipboard.writeText(targetUrl).then(() => {
      import('@/lib/diag').then(({ diag }) => {
        diag('AtlasShell', 'URL copied to clipboard (with token)');
      });
      toast({ 
        title: 'Link copied!', 
        description: `Paste in ${browserName} - your session will transfer`,
      });
    }).catch(() => {
      import('@/lib/diag').then(({ diag }) => {
        diag('AtlasShell', 'Clipboard copy failed');
      });
      toast({ 
        title: 'Open in browser', 
        description: `Visit the copied link in ${browserName}`,
      });
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm text-slate-400">Loading Atlas...</p>
        </div>
        <BrowserHandoffButton />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">P3 Atlas</h1>
          <p className="text-slate-400 mb-4">
            Connect your wallet to navigate the substrate mesh
          </p>
          <Button
            data-testid="button-connect-wallet"
            onClick={openWalletMenu}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Connect Wallet
          </Button>
          
          <WalletLauncherMenu
            open={walletMenuOpen}
            onOpenChange={setWalletMenuOpen}
            onConnect={handleWalletConnect}
            returnPath="/atlas"
          />
          <Button
            data-testid="button-back-home"
            variant="ghost"
            onClick={() => setLocation('/launcher')}
            className="w-full mt-3 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hub
          </Button>
        </div>
        
        {/* Debug Panel - shows auth state */}
        {showDebug && (
          <div 
            className="fixed bottom-4 left-4 right-4 bg-black/90 border border-yellow-500/50 rounded-lg p-3 text-xs font-mono z-50"
            onClick={() => setShowDebug(false)}
          >
            <div className="text-yellow-400 font-bold mb-1">Auth Debug (tap to hide)</div>
            <div className="grid grid-cols-2 gap-1 text-white">
              <span className="text-slate-400">Step:</span>
              <span className={authDebug.step === 'valid' ? 'text-green-400' : authDebug.step === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                {authDebug.step}
              </span>
              <span className="text-slate-400">Wallet:</span>
              <span className={authDebug.hasWallet ? 'text-green-400' : 'text-red-400'}>
                {authDebug.hasWallet ? 'YES' : 'NO'}
              </span>
              <span className="text-slate-400">Token:</span>
              <span className={authDebug.hasToken ? 'text-green-400' : 'text-red-400'}>
                {authDebug.hasToken ? 'YES' : 'NO'}
              </span>
              <span className="text-slate-400">Valid:</span>
              <span className={authDebug.tokenValid ? 'text-green-400' : 'text-red-400'}>
                {authDebug.tokenValid ? 'YES' : 'NO'}
              </span>
              <span className="text-slate-400">Expiry:</span>
              <span>{authDebug.tokenExpiry || '-'}</span>
              <span className="text-slate-400">SignMethod:</span>
              <span className="text-cyan-400">{localStorage.getItem('p3.debug.signMethod') || '-'}</span>
              <span className="text-slate-400">SignResult:</span>
              <span className={localStorage.getItem('p3.debug.signResult')?.startsWith('error') ? 'text-red-400' : 'text-cyan-400'}>
                {localStorage.getItem('p3.debug.signResult') || '-'}
              </span>
              <span className="text-slate-400">AuthStep:</span>
              <span className={localStorage.getItem('p3.auth_debug_step') === 'complete' ? 'text-green-400' : 'text-yellow-400'}>
                {localStorage.getItem('p3.auth_debug_step') || '-'}
              </span>
              {(authDebug.error || localStorage.getItem('p3.auth_debug_error')) && (
                <>
                  <span className="text-slate-400">Error:</span>
                  <span className="text-red-400">{authDebug.error || localStorage.getItem('p3.auth_debug_error')}</span>
                </>
              )}
            </div>
          </div>
        )}
        
        <BrowserHandoffButton />
        <style>{`
          .glass-panel {
            background: rgba(30, 30, 30, 0.8);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#141414] flex flex-col overflow-hidden">
      <SEO {...pageSEO.atlas} />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
      
      <header className="relative z-10 glass-header px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/launcher')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Atlas</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            data-testid="badge-wallet"
            className="bg-purple-500/20 text-purple-300 border-purple-500/30"
          >
            <Wallet className="w-3 h-3 mr-1" />
            {truncateAddress(session.wallet)}
          </Badge>
          <Badge 
            data-testid="badge-vault"
            className={vaultUnlocked 
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 cursor-pointer" 
              : "bg-slate-500/20 text-slate-300 border-slate-500/30 cursor-pointer"
            }
            onClick={() => setMode('settings')}
            title={vaultUnlocked ? "Vault unlocked" : "Vault locked - tap to unlock in settings"}
          >
            {vaultUnlocked ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
            {vaultUnlocked ? 'Vault' : 'Locked'}
          </Badge>
          {session.roles.includes('admin') && (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              Admin
            </Badge>
          )}
          {session.roles.includes('moderator') && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Mod
            </Badge>
          )}
          <Button
            data-testid="button-popout"
            variant="ghost"
            size="icon"
            onClick={openInNewWindow}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="relative z-10 flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col h-full overflow-hidden">
          <AtlasPresence />
          <AtlasCanvas />
          <AtlasTiles />
          <AtlasReceiptsBar />
          {mode === 'idle' && <AtlasSuggestionTray />}
        </div>
      </main>

      <BrowserHandoffButton />

      {showOnboarding && session && (
        <OnboardingFlow
          wallet={session.wallet}
          onComplete={() => {
            setShowOnboarding(false);
            toast({
              title: 'Welcome to Atlas',
              description: 'Your personalized experience is ready.',
            });
          }}
          onSkip={() => {
            setShowOnboarding(false);
            toast({
              title: 'Onboarding skipped',
              description: 'You can replay onboarding anytime from Settings.',
            });
          }}
        />
      )}

      <PinAuthDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        address={pinAddress}
        hasPin={pinHasPin}
        isLocked={pinIsLocked}
        lockoutRemaining={pinLockoutRemaining}
        onSetupPin={handlePinSetup}
        onVerifyPin={handlePinVerify}
      />

      <style>{`
        .glass-header {
          background: rgba(20, 20, 20, 0.8);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .glass-nav {
          background: rgba(20, 20, 20, 0.9);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .glass-panel {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}
