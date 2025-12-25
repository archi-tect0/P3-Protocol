/**
 * Background Sync - Process pending anchor queue when online
 * Integrates with Service Worker for offline-first anchoring
 */

import { 
  drainQueue, 
  enqueueAnchor, 
  listQueue,
  type QueueItem 
} from './nexusStore';
import { notify, requestBackgroundSync, setupServiceWorkerMessageHandler } from './notify';

let isProcessing = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let listenersRegistered = false;
let onlineHandler: (() => void) | null = null;
let visibilityHandler: (() => void) | null = null;

export async function processAnchorItem(item: QueueItem): Promise<boolean> {
  const { type, payload } = item;
  
  try {
    if (type === 'anchor') {
      const anchorType = payload.type;
      const data = payload.data;
      
      switch (anchorType) {
        case 'message': {
          const res = await fetch('/api/anchor/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.ok;
        }
        
        case 'note': {
          const res = await fetch('/api/anchor/note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.ok;
        }
        
        case 'payment': {
          const res = await fetch('/api/anchor/payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.ok;
        }
        
        case 'call': {
          const res = await fetch('/api/anchor/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          return res.ok;
        }
        
        default:
          console.warn('[BackgroundSync] Unknown anchor type:', anchorType);
          return false;
      }
    } else if (type === 'ipfs') {
      const res = await fetch('/api/ipfs/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return res.ok;
    }
    
    console.warn('[BackgroundSync] Unknown queue item type:', type);
    return false;
  } catch (error) {
    console.error('[BackgroundSync] Processing failed:', error);
    return false;
  }
}

export async function processQueue(): Promise<number> {
  if (isProcessing) {
    console.log('[BackgroundSync] Already processing, skipping');
    return 0;
  }
  
  if (!navigator.onLine) {
    console.log('[BackgroundSync] Offline, skipping');
    return 0;
  }
  
  isProcessing = true;
  
  try {
    const processed = await drainQueue(processAnchorItem);
    
    if (processed > 0) {
      console.log(`[BackgroundSync] Processed ${processed} anchor(s)`);
      notify.success(`${processed} anchor${processed !== 1 ? 's' : ''} confirmed`);
    }
    
    return processed;
  } catch (error) {
    console.error('[BackgroundSync] Queue processing failed:', error);
    return 0;
  } finally {
    isProcessing = false;
  }
}

export async function getQueueStatus(): Promise<{
  pending: number;
  failed: number;
  total: number;
}> {
  const pending = await listQueue('pending');
  const failed = await listQueue('failed');
  
  return {
    pending: pending.length,
    failed: failed.length,
    total: pending.length + failed.length,
  };
}

export function startBackgroundSync(intervalMs: number = 30000): void {
  if (syncInterval) {
    console.log('[BackgroundSync] Already running');
    return;
  }
  
  console.log('[BackgroundSync] Starting with interval:', intervalMs);
  
  processQueue();
  
  syncInterval = setInterval(() => {
    processQueue();
  }, intervalMs);
  
  if (!listenersRegistered) {
    onlineHandler = () => {
      console.log('[BackgroundSync] Back online, processing queue');
      notify.info('Back online');
      processQueue();
    };
    
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        processQueue();
      }
    };
    
    window.addEventListener('online', onlineHandler);
    document.addEventListener('visibilitychange', visibilityHandler);
    
    setupServiceWorkerMessageHandler({
      onDrainQueue: async () => { await processQueue(); },
      onSync: async (tag) => {
        if (tag === 'nexus-anchor-sync') {
          await processQueue();
        }
      },
    });
    
    listenersRegistered = true;
  }
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  if (listenersRegistered) {
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler);
      onlineHandler = null;
    }
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
      visibilityHandler = null;
    }
    listenersRegistered = false;
  }
  
  console.log('[BackgroundSync] Stopped');
}

export async function queueMessageAnchor(data: {
  messageId: string;
  contentHash: string;
  recipientHash: string;
}): Promise<string> {
  const id = await enqueueAnchor({
    type: 'message',
    data,
    queuedAt: Date.now(),
  });
  
  await requestBackgroundSync('nexus-anchor-sync');
  processQueue();
  
  return id;
}

export async function queueNoteAnchor(data: {
  noteId: string;
  contentHash: string;
}): Promise<string> {
  const id = await enqueueAnchor({
    type: 'note',
    data,
    queuedAt: Date.now(),
  });
  
  await requestBackgroundSync('nexus-anchor-sync');
  processQueue();
  
  return id;
}

export async function queuePaymentAnchor(data: {
  txHash: string;
  amount: string;
  recipient: string;
}): Promise<string> {
  const id = await enqueueAnchor({
    type: 'payment',
    data,
    queuedAt: Date.now(),
  });
  
  await requestBackgroundSync('nexus-anchor-sync');
  processQueue();
  
  return id;
}

export async function queueCallAnchor(data: {
  callId: string;
  participants: string[];
  duration: number;
  proofHash: string;
}): Promise<string> {
  const id = await enqueueAnchor({
    type: 'call',
    data,
    queuedAt: Date.now(),
  });
  
  await requestBackgroundSync('nexus-anchor-sync');
  processQueue();
  
  return id;
}
