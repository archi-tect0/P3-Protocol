import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'

const APP_VERSION = 'v20251205-token-bridge-2';
console.log(`P3 Protocol - App starting... ${APP_VERSION}`);
document.title = `P3 Protocol ${APP_VERSION}`;

// Skip nuclear cache bust in standalone/PWA mode to prevent black screen on first load
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     (navigator as any).standalone === true ||
                     window.location.search.includes('standalone=1');

if (!isStandalone) {
  // NUCLEAR CACHE BUST - Only run in browser mode, not PWA
  (async function nuclearCacheBust() {
    console.log('[NUCLEAR] Starting complete cache purge (browser mode)...');
    
    // 1. Unregister ALL service workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`[NUCLEAR] Found ${registrations.length} service workers`);
        for (const reg of registrations) {
          const success = await reg.unregister();
          console.log('[NUCLEAR] Unregistered SW:', reg.scope, success ? '✓' : '✗');
        }
      } catch (e) {
        console.error('[NUCLEAR] SW unregister error:', e);
      }
    }
    
    // 2. Delete ALL caches
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        console.log(`[NUCLEAR] Found ${keys.length} caches`);
        for (const key of keys) {
          const success = await caches.delete(key);
          console.log('[NUCLEAR] Deleted cache:', key, success ? '✓' : '✗');
        }
      } catch (e) {
        console.error('[NUCLEAR] Cache delete error:', e);
      }
    }
    
    // 3. Clear localStorage items that might cache old state (except wallet session)
    try {
      const keysToPreserve = ['walletAddress', 'p3.bridge.session', 'p3.keypair'];
      const preserved: Record<string, string | null> = {};
      keysToPreserve.forEach(k => { preserved[k] = localStorage.getItem(k); });
      
      // Clear specific cache keys
      const cacheKeys = ['p3.sdk.cache', 'p3.anchor.batch', 'p3.rpc.cache'];
      cacheKeys.forEach(k => {
        if (localStorage.getItem(k)) {
          localStorage.removeItem(k);
          console.log('[NUCLEAR] Cleared localStorage:', k);
        }
      });
      
      // Restore preserved keys
      keysToPreserve.forEach(k => {
        if (preserved[k]) {
          localStorage.setItem(k, preserved[k]!);
        }
      });
    } catch (e) {
      console.error('[NUCLEAR] localStorage clear error:', e);
    }
    
    // 4. Clear sessionStorage
    try {
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(k => {
        if (k.startsWith('p3.') || k.startsWith('sdk.')) {
          sessionStorage.removeItem(k);
          console.log('[NUCLEAR] Cleared sessionStorage:', k);
        }
      });
    } catch (e) {
      console.error('[NUCLEAR] sessionStorage clear error:', e);
    }
    
    console.log('[NUCLEAR] Cache purge complete. Version:', APP_VERSION);
  })();
} else {
  console.log('[PWA] Running in standalone mode, skipping cache purge');
}

// Register Atlas push service worker for notifications (always, but after potential purge)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/atlas/push-sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      console.log('[PushSW] Registered successfully:', registration.scope);
      
      // Listen for SW updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PushSW] New version available');
            }
          });
        }
      });
    } catch (e) {
      console.warn('[PushSW] Registration failed:', e);
    }
  });
}

// CRITICAL: Sync walletAddress from session BEFORE React mounts
// This guarantees the address is available for all components
(() => {
  const walletAddress = localStorage.getItem('walletAddress');
  const bridgeSession = localStorage.getItem('p3.bridge.session');
  
  if (!walletAddress && bridgeSession) {
    try {
      const session = JSON.parse(bridgeSession);
      if (session?.address) {
        localStorage.setItem('walletAddress', session.address);
      }
    } catch (e) {
      // Silent fail for session parsing
    }
  }
})();

// Service workers disabled - no caching

// SECURITY: Clear stale admin tokens on non-admin paths
// Defense in depth against cached redirects
if (!window.location.pathname.startsWith('/admin') && !window.location.pathname.startsWith('/login')) {
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken) {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminRole');
    localStorage.removeItem('adminEmail');
  }
}

// Update document title with version for visual confirmation
document.title = `Nexus - P3 Protocol (${APP_VERSION})`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
