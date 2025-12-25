/**
 * Receipt Queue - Debounced fire-and-forget receipt posting for Atlas API 2.0
 * 
 * Features:
 * - Queue receipts with debouncing
 * - Fire-and-forget posting to receipts lane
 * - Client-side signing using wallet (if connected)
 * - Retry logic for failed posts
 */

import { getSessionId } from './session';

export interface Receipt {
  itemId: string;
  itemType: string;
  action: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  accessMode?: string;
  accessFormat?: string;
  accessUri?: string;
  durationMs?: number;
  position?: number;
  source?: string;
  providerId?: string;
}

export interface SignedReceipt extends Receipt {
  sessionId: string;
  walletAddress?: string;
  signature?: string;
  nonce?: string;
}

interface QueueConfig {
  debounceMs?: number;
  maxBatchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  flushOnUnload?: boolean;
  signReceipts?: boolean;
}

interface PendingReceipt {
  receipt: Receipt;
  retries: number;
  addedAt: number;
}

const DEFAULT_CONFIG: Required<QueueConfig> = {
  debounceMs: 500,
  maxBatchSize: 20,
  maxRetries: 3,
  retryDelayMs: 2000,
  flushOnUnload: true,
  signReceipts: true,
};

type SignerFn = (message: string) => Promise<string>;

class ReceiptQueue {
  private queue: PendingReceipt[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<QueueConfig>;
  private walletAddress: string | null = null;
  private signer: SignerFn | null = null;
  private isFlushing: boolean = false;
  private retryQueue: PendingReceipt[] = [];
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: QueueConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupUnloadHandler();
  }

  setWallet(address: string | null, signer?: SignerFn): void {
    this.walletAddress = address;
    this.signer = signer || null;
  }

  push(receipt: Receipt): void {
    const pending: PendingReceipt = {
      receipt: {
        ...receipt,
        timestamp: receipt.timestamp || Date.now(),
      },
      retries: 0,
      addedAt: Date.now(),
    };

    this.queue.push(pending);

    if (this.queue.length >= this.config.maxBatchSize) {
      this.flushNow();
    } else {
      this.scheduleFlush();
    }
  }

  pushMany(receipts: Receipt[]): void {
    for (const receipt of receipts) {
      this.push(receipt);
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flushNow();
    }, this.config.debounceMs);
  }

  private async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0 || this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    const batch = this.queue.splice(0, this.config.maxBatchSize);

    try {
      const signedReceipts = await this.signBatch(batch);
      await this.postReceipts(signedReceipts);
    } catch (err) {
      console.warn('[ReceiptQueue] Flush failed, queueing for retry:', err);
      this.scheduleRetry(batch);
    } finally {
      this.isFlushing = false;

      if (this.queue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  private async signBatch(batch: PendingReceipt[]): Promise<SignedReceipt[]> {
    const sessionId = getSessionId() || 'anonymous';
    const signedReceipts: SignedReceipt[] = [];

    for (const pending of batch) {
      const signed: SignedReceipt = {
        ...pending.receipt,
        sessionId,
        walletAddress: this.walletAddress || undefined,
      };

      if (this.config.signReceipts && this.walletAddress && this.signer) {
        try {
          const nonce = this.generateNonce();
          const message = this.createSignatureMessage(signed, nonce);
          const signature = await this.signer(message);
          signed.nonce = nonce;
          signed.signature = signature;
        } catch (err) {
          console.warn('[ReceiptQueue] Failed to sign receipt:', err);
        }
      }

      signedReceipts.push(signed);
    }

    return signedReceipts;
  }

  private generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  private createSignatureMessage(receipt: SignedReceipt, nonce: string): string {
    const payload = {
      itemId: receipt.itemId,
      itemType: receipt.itemType,
      action: receipt.action,
      timestamp: receipt.timestamp,
      sessionId: receipt.sessionId,
      nonce,
    };
    return JSON.stringify(payload);
  }

  private async postReceipts(receipts: SignedReceipt[]): Promise<void> {
    const sessionId = getSessionId();
    
    const response = await fetch('/api/atlas/receipts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'x-session-id': sessionId } : {}),
        ...(this.walletAddress ? { 'x-wallet-address': this.walletAddress } : {}),
      },
      body: JSON.stringify({ receipts }),
    });

    if (!response.ok) {
      throw new Error(`Receipt post failed: ${response.status}`);
    }
  }

  private scheduleRetry(batch: PendingReceipt[]): void {
    for (const pending of batch) {
      if (pending.retries < this.config.maxRetries) {
        pending.retries++;
        this.retryQueue.push(pending);
      } else {
        console.error('[ReceiptQueue] Max retries exceeded, dropping receipt:', pending.receipt.itemId);
      }
    }

    if (this.retryQueue.length > 0 && !this.retryTimer) {
      this.retryTimer = setTimeout(() => {
        this.processRetryQueue();
      }, this.config.retryDelayMs);
    }
  }

  private async processRetryQueue(): Promise<void> {
    this.retryTimer = null;

    if (this.retryQueue.length === 0) {
      return;
    }

    const batch = this.retryQueue.splice(0, this.config.maxBatchSize);

    try {
      const signedReceipts = await this.signBatch(batch);
      await this.postReceipts(signedReceipts);
    } catch (err) {
      console.warn('[ReceiptQueue] Retry failed:', err);
      this.scheduleRetry(batch);
    }

    if (this.retryQueue.length > 0) {
      this.retryTimer = setTimeout(() => {
        this.processRetryQueue();
      }, this.config.retryDelayMs * 2);
    }
  }

  private setupUnloadHandler(): void {
    if (typeof window === 'undefined') return;

    if (this.config.flushOnUnload) {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushBeforeUnload();
        }
      });

      window.addEventListener('pagehide', () => {
        this.flushBeforeUnload();
      });
    }
  }

  private flushBeforeUnload(): void {
    if (this.queue.length === 0) return;

    const sessionId = getSessionId() || 'anonymous';
    const receipts = this.queue.map((p) => ({
      ...p.receipt,
      sessionId,
      walletAddress: this.walletAddress || undefined,
    }));

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ receipts })], {
        type: 'application/json',
      });
      
      try {
        navigator.sendBeacon('/api/atlas/receipts', blob);
        this.queue = [];
      } catch {
        // sendBeacon failed, data will be lost
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length + this.retryQueue.length;
  }

  clear(): void {
    this.queue = [];
    this.retryQueue = [];
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async forceFlush(): Promise<void> {
    await this.flushNow();
    
    while (this.retryQueue.length > 0) {
      await this.processRetryQueue();
    }
  }
}

export const receiptQueue = new ReceiptQueue();

export function pushReceipt(receipt: Receipt): void {
  receiptQueue.push(receipt);
}

export function pushReceipts(receipts: Receipt[]): void {
  receiptQueue.pushMany(receipts);
}

export function setReceiptWallet(address: string | null, signer?: SignerFn): void {
  receiptQueue.setWallet(address, signer);
}

export function getReceiptQueueLength(): number {
  return receiptQueue.getQueueLength();
}

export function clearReceiptQueue(): void {
  receiptQueue.clear();
}

export function forceFlushReceipts(): Promise<void> {
  return receiptQueue.forceFlush();
}

export function logViewReceipt(
  itemId: string,
  itemType: string,
  metadata?: Record<string, unknown>
): void {
  pushReceipt({
    itemId,
    itemType,
    action: 'view',
    metadata,
  });
}

export function logPlayReceipt(
  itemId: string,
  itemType: string,
  accessMode: string,
  accessFormat: string,
  accessUri?: string
): void {
  pushReceipt({
    itemId,
    itemType,
    action: 'play',
    accessMode,
    accessFormat,
    accessUri,
  });
}

export function logProgressReceipt(
  itemId: string,
  itemType: string,
  position: number,
  durationMs: number
): void {
  pushReceipt({
    itemId,
    itemType,
    action: 'progress',
    position,
    durationMs,
  });
}

export function logCompleteReceipt(
  itemId: string,
  itemType: string,
  durationMs: number
): void {
  pushReceipt({
    itemId,
    itemType,
    action: 'complete',
    durationMs,
  });
}
