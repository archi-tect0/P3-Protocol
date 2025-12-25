import { AnchorsDigest, AnchorsDigestSchema, DEFAULT_CONFIG } from "./types";

let anchorsDigest: AnchorsDigest | null = null;
let anchorsSignature: string | null = null;

// Batching queue and timer
let anchorQueue: any[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY = 400;
const PERSIST_KEY = 'p3:anchor:pending';
const MAX_RETRIES = 3;
let retryCount = 0;

// Restore persisted events on load
function restorePersistedEvents(): void {
  try {
    const persisted = localStorage.getItem(PERSIST_KEY);
    if (persisted) {
      const events = JSON.parse(persisted);
      if (Array.isArray(events) && events.length > 0) {
        anchorQueue = [...events, ...anchorQueue];
        localStorage.removeItem(PERSIST_KEY);
        console.log('[P3 SDK] Restored', events.length, 'persisted anchor events');
      }
    }
  } catch {
    // Ignore parsing errors
  }
}

// Persist events to localStorage for crash recovery
function persistEvents(): void {
  if (anchorQueue.length === 0) return;
  try {
    localStorage.setItem(PERSIST_KEY, JSON.stringify(anchorQueue));
  } catch {
    // Storage quota exceeded or unavailable
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  restorePersistedEvents();
  window.addEventListener('beforeunload', persistEvents);
}

// Load anchors digest with signature verification
export function loadAnchorsDigest(payload: AnchorsDigest, signature: string): void {
  AnchorsDigestSchema.parse(payload);
  anchorsDigest = payload;
  anchorsSignature = signature;
}

// Get current anchors digest
export function getAnchors(): AnchorsDigest {
  if (!anchorsDigest) {
    // Return default dev anchors if not loaded
    return {
      contract: DEFAULT_CONFIG.contract,
      chainId: DEFAULT_CONFIG.chainId,
      treasury: DEFAULT_CONFIG.treasury,
      codehash: "0xDEV",
      validUntil: Date.now() + 24 * 60 * 60 * 1000
    };
  }
  return anchorsDigest;
}

// Get anchors signature
export function getAnchorsSignature(): string {
  if (!anchorsSignature) return "0xDEV_SIGNATURE";
  return anchorsSignature;
}

// Check if anchors are loaded
export function isAnchorsLoaded(): boolean {
  return anchorsDigest !== null;
}

// Clear anchors (for testing/reset)
export function clearAnchors(): void {
  anchorsDigest = null;
  anchorsSignature = null;
}

// Fetch anchors from server
export async function fetchAnchorsFromServer(): Promise<AnchorsDigest> {
  try {
    const response = await fetch('/api/anchors/digest');
    if (!response.ok) throw new Error('Failed to fetch anchors');
    const data = await response.json();
    loadAnchorsDigest(data.digest, data.signature);
    return data.digest;
  } catch {
    console.warn('[P3 SDK] Using dev anchors');
    return getAnchors();
  }
}

// Flush batched anchors to server
export async function flush(): Promise<void> {
  if (anchorQueue.length === 0) return;
  
  const batch = [...anchorQueue];
  anchorQueue = [];
  flushTimer = null;
  
  try {
    const response = await fetch('/api/anchor/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    });
    
    if (!response.ok) {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        anchorQueue = [...batch, ...anchorQueue];
        console.warn('[P3 SDK] Anchor batch failed, re-queued (retry', retryCount, '/', MAX_RETRIES, ')');
        setTimeout(() => flush(), 1000 * retryCount);
      } else {
        console.error('[P3 SDK] Anchor batch failed after max retries, persisting to storage');
        anchorQueue = [...batch, ...anchorQueue];
        persistEvents();
        retryCount = 0;
      }
    } else {
      retryCount = 0;
      localStorage.removeItem(PERSIST_KEY);
    }
  } catch {
    retryCount++;
    if (retryCount < MAX_RETRIES) {
      anchorQueue = [...batch, ...anchorQueue];
      console.warn('[P3 SDK] Anchor batch error, re-queued (retry', retryCount, '/', MAX_RETRIES, ')');
      setTimeout(() => flush(), 1000 * retryCount);
    } else {
      console.error('[P3 SDK] Anchor batch failed after max retries, persisting to storage');
      anchorQueue = [...batch, ...anchorQueue];
      persistEvents();
      retryCount = 0;
    }
  }
}

// Add anchor event to queue with batching
export function anchor(event: any): void {
  anchorQueue.push(event);
  
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flush();
    }, FLUSH_DELAY);
  }
}
