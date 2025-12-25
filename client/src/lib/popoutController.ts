/**
 * Popout Controller - Browser escape from wallet in-app browsers
 * 
 * iOS Flow: Show overlay -> User taps button -> navigator.share() -> Safari
 * Android Flow: Auto-fire Chrome intent -> Chrome opens
 * 
 * Re-arms on each page focus so users always see the escape option
 */

import { 
  detectWalletBrowser, 
  detectPlatform, 
  getEscapeUrls, 
  getTargetBrowserName,
  type Platform,
  type WalletConfig 
} from './walletPopoutMatrix';

export interface PopoutState {
  isActive: boolean;
  wallet: WalletConfig | null;
  platform: Platform;
  targetBrowser: string;
  status: 'detecting' | 'waiting_tap' | 'opening' | 'sharing' | 'fallback' | 'success' | 'dismissed';
  message?: string;
}

type PopoutEventCallback = (state: PopoutState) => void;

class PopoutControllerClass {
  private listeners: Set<PopoutEventCallback> = new Set();
  private state: PopoutState = {
    isActive: false,
    wallet: null,
    platform: 'desktop',
    targetBrowser: 'Chrome',
    status: 'detecting',
  };
  private sessionEscapeCount = 0;
  private maxEscapeAttempts = 3; // Allow multiple attempts per session

  subscribe(callback: PopoutEventCallback): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  private emit() {
    this.listeners.forEach(cb => cb(this.state));
  }

  private setState(updates: Partial<PopoutState>) {
    this.state = { ...this.state, ...updates };
    this.emit();
  }

  /**
   * Check if we're in a wallet browser and show the escape UI
   * Can be called multiple times - re-arms on dismiss
   */
  async checkAndTrigger(): Promise<boolean> {
    // Allow multiple attempts per session (e.g., if user dismisses and comes back)
    if (this.sessionEscapeCount >= this.maxEscapeAttempts) {
      console.log('[PopoutController] Max escape attempts reached this session');
      return false;
    }
    
    // Don't show if already active
    if (this.state.isActive) return false;
    
    const wallet = detectWalletBrowser();
    const platform = detectPlatform();
    
    if (!wallet || platform === 'desktop') {
      console.log('[PopoutController] Not in wallet browser, skipping');
      return false;
    }
    
    this.sessionEscapeCount++;
    const targetBrowser = getTargetBrowserName();
    
    console.log('[PopoutController] Wallet browser detected:', wallet.name, '| Attempt:', this.sessionEscapeCount);
    console.log('[PopoutController] Platform:', platform);
    
    if (platform === 'ios') {
      // iOS: Show overlay and wait for user tap (share requires gesture)
      this.setState({
        isActive: true,
        wallet,
        platform,
        targetBrowser,
        status: 'waiting_tap',
        message: `For the best experience, open in ${targetBrowser}`,
      });
    } else {
      // Android: Auto-fire Chrome intent
      this.setState({
        isActive: true,
        wallet,
        platform,
        targetBrowser,
        status: 'opening',
        message: `Opening in ${targetBrowser}...`,
      });
      await this.triggerAndroidEscape(window.location.href);
    }
    
    return true;
  }

  /**
   * Called when user taps the iOS escape button (provides user gesture)
   */
  async triggerIosShare(): Promise<void> {
    if (this.state.platform !== 'ios') return;
    
    const url = window.location.href;
    
    this.setState({ 
      status: 'sharing',
      message: 'Select "Open in Safari"',
    });
    
    if (!navigator.share) {
      console.log('[PopoutController] iOS: navigator.share not available');
      await this.tryIosFallbacks(url);
      return;
    }
    
    try {
      console.log('[PopoutController] iOS: Triggering navigator.share');
      await navigator.share({
        title: 'P3 Protocol',
        text: 'Open in Safari for the best experience',
        url: url,
      });
      
      this.setState({ 
        status: 'success',
        message: 'Opening in Safari...',
      });
      setTimeout(() => this.dismiss(), 2000);
      
    } catch (e: any) {
      console.log('[PopoutController] Share cancelled:', e.message);
      await this.tryIosFallbacks(url);
    }
  }

  /**
   * Try iOS fallback methods when share is cancelled
   */
  private async tryIosFallbacks(url: string): Promise<void> {
    // Try wallet-specific universal links
    const escapeUrls = getEscapeUrls(url);
    if (escapeUrls && escapeUrls.length > 0) {
      for (const escapeUrl of escapeUrls) {
        console.log('[PopoutController] Trying iOS fallback:', escapeUrl);
        window.location.href = escapeUrl;
        await new Promise(r => setTimeout(r, 800));
      }
    }
    
    // If still visible, show manual instructions
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        this.setState({ 
          status: 'fallback',
          message: 'Tap the share button (↑) at the bottom and select "Open in Safari"',
        });
      }
    }, 1000);
  }

  private async triggerAndroidEscape(url: string): Promise<void> {
    const escapeUrls = getEscapeUrls(url);
    
    if (!escapeUrls || escapeUrls.length === 0) {
      console.log('[PopoutController] No escape URLs for Android');
      this.dismiss();
      return;
    }
    
    console.log('[PopoutController] Android: Firing intents:', escapeUrls);
    
    for (let i = 0; i < escapeUrls.length; i++) {
      setTimeout(() => {
        console.log(`[PopoutController] Trying intent ${i + 1}:`, escapeUrls[i]);
        window.location.href = escapeUrls[i];
      }, i * 750);
    }
    
    const totalDelay = escapeUrls.length * 750 + 2000;
    setTimeout(() => {
      if (document.visibilityState === 'visible') {
        this.setState({ 
          status: 'fallback',
          message: 'Open Chrome and navigate to p3protocol.com',
        });
      }
    }, totalDelay);
  }

  /**
   * Dismiss and allow re-triggering later
   */
  dismiss() {
    this.setState({ 
      isActive: false, 
      status: 'dismissed' 
    });
    // Note: sessionEscapeCount stays - prevents infinite loops
    // But allows up to maxEscapeAttempts per session
  }

  /**
   * Reset everything (for testing or new session)
   */
  reset() {
    this.sessionEscapeCount = 0;
    this.setState({
      isActive: false,
      wallet: null,
      platform: 'desktop',
      targetBrowser: 'Chrome',
      status: 'detecting',
    });
  }

  getState(): PopoutState {
    return this.state;
  }
}

export const PopoutController = new PopoutControllerClass();

export function usePopoutController() {
  const [state, setState] = useState<PopoutState>(PopoutController.getState());
  
  useEffect(() => {
    return PopoutController.subscribe(setState);
  }, []);
  
  return {
    state,
    dismiss: () => PopoutController.dismiss(),
    checkAndTrigger: () => PopoutController.checkAndTrigger(),
    triggerIosShare: () => PopoutController.triggerIosShare(),
  };
}

import { useState, useEffect } from 'react';
