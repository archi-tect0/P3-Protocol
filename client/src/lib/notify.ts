/**
 * Nexus Notifications System
 * In-app toasts and PWA push registration/handlers
 */

export type ToastLevel = 'info' | 'success' | 'warn' | 'error';

export type Toast = {
  id: string;
  text: string;
  level: ToastLevel;
  ts: number;
  duration?: number;
};

type ToastCallback = (t: Toast) => void;

class NotifyService {
  private listeners: Set<ToastCallback> = new Set();
  private toasts: Toast[] = [];
  
  subscribe(callback: ToastCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  private emit(toast: Toast) {
    this.toasts.push(toast);
    this.listeners.forEach(cb => cb(toast));
    
    if (this.toasts.length > 50) {
      this.toasts = this.toasts.slice(-50);
    }
  }
  
  toast(text: string, level: ToastLevel = 'info', duration: number = 4000) {
    const t: Toast = {
      id: crypto.randomUUID(),
      text,
      level,
      ts: Date.now(),
      duration,
    };
    this.emit(t);
    return t.id;
  }
  
  info(text: string, duration?: number) {
    return this.toast(text, 'info', duration);
  }
  
  success(text: string, duration?: number) {
    return this.toast(text, 'success', duration);
  }
  
  warn(text: string, duration?: number) {
    return this.toast(text, 'warn', duration);
  }
  
  error(text: string, duration?: number) {
    return this.toast(text, 'error', duration);
  }
  
  getRecent(count: number = 10): Toast[] {
    return this.toasts.slice(-count);
  }
}

export const notify = new NotifyService();

export function toast(text: string, level: ToastLevel = 'info') {
  return notify.toast(text, level);
}

export function onToast(cb: ToastCallback) {
  return notify.subscribe(cb);
}

// ==================== PWA PUSH ====================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function registerPush(vapidPublicKey?: string): Promise<PushSubscription | null> {
  if (!await isPushSupported()) {
    console.log('[Push] Not supported in this browser');
    return null;
  }
  
  const permission = await getPushPermission();
  if (permission !== 'granted') {
    const granted = await requestPushPermission();
    if (!granted) {
      notify.warn('Notifications permission denied');
      return null;
    }
  }
  
  try {
    const reg = await navigator.serviceWorker.ready;
    
    const key = vapidPublicKey || 
      (window as any).CFG?.vapidPublicKey || 
      import.meta.env.VITE_VAPID_PUBLIC_KEY;
    
    if (!key) {
      console.warn('[Push] No VAPID public key configured');
      return null;
    }
    
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });
    
    // Send subscription to server
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON())
      });
    } catch (e) {
      console.warn('[Push] Failed to sync subscription with server:', e);
    }
    
    notify.success('Notifications enabled');
    return sub;
  } catch (error) {
    console.error('[Push] Registration failed:', error);
    notify.error('Failed to enable notifications');
    return null;
  }
}

export async function unregisterPush(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    
    if (sub) {
      await sub.unsubscribe();
      
      try {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON())
        });
      } catch (e) {
        console.warn('[Push] Failed to sync unsubscribe with server:', e);
      }
      
      notify.info('Notifications disabled');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Push] Unregistration failed:', error);
    return false;
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!await isPushSupported()) return null;
  
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

// ==================== LOCAL NOTIFICATIONS ====================

export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    icon: '/apps/nexus/assets/icons/icon-192.png',
    badge: '/apps/nexus/assets/icons/icon-192.png',
    ...options
  });
}

// ==================== SERVICE WORKER MESSAGE HANDLING ====================

export function setupServiceWorkerMessageHandler(handlers: {
  onDrainQueue?: () => Promise<void>;
  onSync?: (tag: string) => Promise<void>;
}) {
  if (!('serviceWorker' in navigator)) return;
  
  navigator.serviceWorker.addEventListener('message', async (event: MessageEvent) => {
    const { type, tag } = event.data || {};
    
    switch (type) {
      case 'DRAIN_QUEUE':
        if (handlers.onDrainQueue) {
          await handlers.onDrainQueue();
        }
        break;
        
      case 'SYNC':
        if (handlers.onSync && tag) {
          await handlers.onSync(tag);
        }
        break;
    }
  });
}

export async function requestBackgroundSync(tag: string = 'nexus-anchor-sync'): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  
  try {
    const reg = await navigator.serviceWorker.ready;
    
    if ('sync' in reg) {
      await (reg as any).sync.register(tag);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Sync] Failed to request background sync:', error);
    return false;
  }
}
