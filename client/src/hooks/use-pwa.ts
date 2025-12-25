import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PWAType = 'app' | 'launcher' | 'enterprise' | 'atlas';

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  pwaType: PWAType;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export function usePWA(type: PWAType = 'app') {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isStandalone: window.matchMedia('(display-mode: standalone)').matches,
    pwaType: type,
  });

  useEffect(() => {
    const manifests: Record<PWAType, string> = {
      'app': '/manifest-app.json',
      'launcher': '/manifest-launcher.json',
      'enterprise': '/manifest-enterprise.json',
      'atlas': '/atlas/manifest.json'
    };
    const themeColors: Record<PWAType, string> = {
      'app': '#0ea5e9',
      'launcher': '#1b78d1',
      'enterprise': '#7c3aed',
      'atlas': '#8b5cf6'
    };
    const manifest = manifests[type];
    const themeColor = themeColors[type];
    
    // Remove existing manifest link and create fresh one to bust Chrome's cache
    const existingLink = document.querySelector('link[rel="manifest"]');
    if (existingLink) {
      existingLink.remove();
    }
    
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.id = `pwa-manifest-${type}`;
    // Add cache-busting query param to force Chrome to re-read manifest
    manifestLink.href = `${manifest}?v=${Date.now()}`;
    document.head.appendChild(manifestLink);
    
    const themeMetaTag = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (themeMetaTag) {
      themeMetaTag.content = themeColor;
    }
    
    console.log(`[PWA] Set manifest: ${manifest}?v=..., theme: ${themeColor}`);
  }, [type]);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setState(prev => ({ ...prev, isInstallable: true }));
      console.log('[PWA] Install prompt available');
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      setState(prev => ({ ...prev, isInstalled: true, isInstallable: false }));
      console.log('[PWA] App installed');
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, isStandalone: e.matches }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    if (navigator.getInstalledRelatedApps) {
      navigator.getInstalledRelatedApps().then(apps => {
        if (apps.length > 0) {
          setState(prev => ({ ...prev, isInstalled: true }));
        }
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      console.log('[PWA] User choice:', choice.outcome);
      
      if (choice.outcome === 'accepted') {
        deferredPrompt = null;
        setState(prev => ({ ...prev, isInstallable: false }));
        return true;
      }
    } catch (error) {
      console.error('[PWA] Install error:', error);
    }
    
    return false;
  }, []);

  return { ...state, promptInstall };
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        // Force SW update with version param
        const registration = await navigator.serviceWorker.register('/sw.js?v=20251205-2', {
          updateViaCache: 'none'
        });
        console.log('[SW] Registered:', registration.scope);
        
        // Force immediate update check
        registration.update();
      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    });
  }
}

declare global {
  interface Navigator {
    getInstalledRelatedApps?(): Promise<Array<{ platform: string; url: string }>>;
  }
}
