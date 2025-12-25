/**
 * useReceiptQueue Hook - React wrapper for receipt queue management
 * 
 * Provides React hooks for:
 * - Queue receipts with debouncing (500ms default)
 * - Fire-and-forget pattern with retry
 * - Exponential backoff on failure
 * - Wallet address and signer integration
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pushReceipts,
  setReceiptWallet,
  getReceiptQueueLength,
  clearReceiptQueue,
  forceFlushReceipts,
  type Receipt,
} from '@/lib/receiptQueue';

export type { Receipt };

export interface ReceiptQueueState {
  queueLength: number;
  isFlushing: boolean;
  lastFlushTime: number | null;
  failedCount: number;
}

export interface UseReceiptQueueOptions {
  walletAddress?: string | null;
  signer?: ((message: string) => Promise<string>) | null;
  debounceMs?: number;
  autoFlushOnUnmount?: boolean;
}

export function useReceiptQueue(options: UseReceiptQueueOptions = {}) {
  const { 
    walletAddress, 
    signer, 
    debounceMs = 500,
    autoFlushOnUnmount = true,
  } = options;

  const [state, setState] = useState<ReceiptQueueState>({
    queueLength: 0,
    isFlushing: false,
    lastFlushTime: null,
    failedCount: 0,
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReceiptsRef = useRef<Receipt[]>([]);

  useEffect(() => {
    if (walletAddress !== undefined) {
      setReceiptWallet(walletAddress, signer || undefined);
    }
  }, [walletAddress, signer]);

  const updateQueueLength = useCallback(() => {
    setState(prev => ({
      ...prev,
      queueLength: getReceiptQueueLength() + pendingReceiptsRef.current.length,
    }));
  }, []);

  const queueReceipt = useCallback((receipt: Receipt) => {
    pendingReceiptsRef.current.push({
      ...receipt,
      timestamp: receipt.timestamp || Date.now(),
    });

    updateQueueLength();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const receipts = pendingReceiptsRef.current.splice(0);
      if (receipts.length > 0) {
        pushReceipts(receipts);
        updateQueueLength();
      }
    }, debounceMs);
  }, [debounceMs, updateQueueLength]);

  const queueManyReceipts = useCallback((receipts: Receipt[]) => {
    for (const receipt of receipts) {
      queueReceipt(receipt);
    }
  }, [queueReceipt]);

  const flushNow = useCallback(async () => {
    setState(prev => ({ ...prev, isFlushing: true }));

    const pending = pendingReceiptsRef.current.splice(0);
    if (pending.length > 0) {
      pushReceipts(pending);
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    try {
      await forceFlushReceipts();
      setState(prev => ({
        ...prev,
        isFlushing: false,
        lastFlushTime: Date.now(),
        queueLength: getReceiptQueueLength(),
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isFlushing: false,
        failedCount: prev.failedCount + 1,
        queueLength: getReceiptQueueLength(),
      }));
    }
  }, []);

  const clear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingReceiptsRef.current = [];
    clearReceiptQueue();
    updateQueueLength();
  }, [updateQueueLength]);

  const logView = useCallback((
    itemId: string,
    itemType: string,
    metadata?: Record<string, unknown>
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'view',
      metadata,
    });
  }, [queueReceipt]);

  const logPlay = useCallback((
    itemId: string,
    itemType: string,
    accessMode: string,
    accessFormat: string,
    accessUri?: string
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'play',
      accessMode,
      accessFormat,
      accessUri,
    });
  }, [queueReceipt]);

  const logProgress = useCallback((
    itemId: string,
    itemType: string,
    position: number,
    durationMs: number
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'progress',
      position,
      durationMs,
    });
  }, [queueReceipt]);

  const logComplete = useCallback((
    itemId: string,
    itemType: string,
    durationMs: number
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'complete',
      durationMs,
    });
  }, [queueReceipt]);

  const logStream = useCallback((
    itemId: string,
    itemType: string,
    accessMode: string,
    accessFormat: string,
    accessUri?: string
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'stream',
      accessMode,
      accessFormat,
      accessUri,
    });
  }, [queueReceipt]);

  const logDownload = useCallback((
    itemId: string,
    itemType: string,
    accessFormat: string,
    accessUri?: string
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'download',
      accessMode: 'file',
      accessFormat,
      accessUri,
    });
  }, [queueReceipt]);

  const logLaunch = useCallback((
    itemId: string,
    itemType: string,
    accessUri?: string
  ) => {
    queueReceipt({
      itemId,
      itemType,
      action: 'launch',
      accessUri,
    });
  }, [queueReceipt]);

  useEffect(() => {
    return () => {
      if (autoFlushOnUnmount) {
        const pending = pendingReceiptsRef.current.splice(0);
        if (pending.length > 0) {
          pushReceipts(pending);
        }
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      }
    };
  }, [autoFlushOnUnmount]);

  return {
    queueReceipt,
    queueManyReceipts,
    flushNow,
    clear,
    logView,
    logPlay,
    logProgress,
    logComplete,
    logStream,
    logDownload,
    logLaunch,
    ...state,
  };
}

export interface UseReceiptTrackerOptions {
  itemId: string;
  itemType: string;
  walletAddress?: string | null;
  autoLogView?: boolean;
}

export function useReceiptTracker(options: UseReceiptTrackerOptions) {
  const { itemId, itemType, walletAddress, autoLogView = true } = options;
  
  const queue = useReceiptQueue({ walletAddress });
  const hasLoggedViewRef = useRef(false);
  const playStartTimeRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(0);

  useEffect(() => {
    if (autoLogView && !hasLoggedViewRef.current) {
      queue.logView(itemId, itemType);
      hasLoggedViewRef.current = true;
    }
  }, [autoLogView, itemId, itemType, queue]);

  const startPlayback = useCallback((
    accessMode: string,
    accessFormat: string,
    accessUri?: string
  ) => {
    playStartTimeRef.current = Date.now();
    lastProgressRef.current = 0;
    queue.logPlay(itemId, itemType, accessMode, accessFormat, accessUri);
  }, [itemId, itemType, queue]);

  const updateProgress = useCallback((position: number) => {
    const durationMs = playStartTimeRef.current 
      ? Date.now() - playStartTimeRef.current 
      : 0;
    
    if (position - lastProgressRef.current >= 10 || position < lastProgressRef.current) {
      queue.logProgress(itemId, itemType, position, durationMs);
      lastProgressRef.current = position;
    }
  }, [itemId, itemType, queue]);

  const endPlayback = useCallback(() => {
    const durationMs = playStartTimeRef.current 
      ? Date.now() - playStartTimeRef.current 
      : 0;
    
    queue.logComplete(itemId, itemType, durationMs);
    playStartTimeRef.current = null;
    lastProgressRef.current = 0;
  }, [itemId, itemType, queue]);

  return {
    startPlayback,
    updateProgress,
    endPlayback,
    logView: () => queue.logView(itemId, itemType),
    logStream: (accessMode: string, accessFormat: string, accessUri?: string) => 
      queue.logStream(itemId, itemType, accessMode, accessFormat, accessUri),
    logDownload: (accessFormat: string, accessUri?: string) => 
      queue.logDownload(itemId, itemType, accessFormat, accessUri),
    logLaunch: (accessUri?: string) => 
      queue.logLaunch(itemId, itemType, accessUri),
    flushNow: queue.flushNow,
  };
}

export function useReceiptQueueStatus() {
  const [queueLength, setQueueLength] = useState(getReceiptQueueLength);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueLength(getReceiptQueueLength());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    queueLength,
    isEmpty: queueLength === 0,
    hasPending: queueLength > 0,
  };
}
