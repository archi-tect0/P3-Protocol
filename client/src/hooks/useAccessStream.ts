/**
 * useAccessStream - Access lane subscription hook for Atlas API 2.0
 * 
 * Features:
 * - Subscribe to access SSE lane
 * - Parse binary frames from EventSource
 * - Update React Query cache when access resolves
 * - Handle upgrade events from DEGRADED to READY
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  subscribeLane,
  isSessionActive,
  parseBinaryAccessFrame,
  type AccessUpdate,
  type LaneFrame,
} from '@/lib/session';

export interface AccessStreamState {
  isConnected: boolean;
  pendingItems: Set<string>;
  readyItems: Set<string>;
  degradedItems: Set<string>;
  lastUpdate: number;
}

export interface AccessStreamCallbacks {
  onAccessReady?: (update: AccessUpdate) => void;
  onAccessDegraded?: (update: AccessUpdate) => void;
  onAccessPending?: (update: AccessUpdate) => void;
  onUpgradeAvailable?: (itemId: string, newAccess: AccessUpdate) => void;
  onError?: (error: Error) => void;
}

export interface UseAccessStreamOptions {
  enabled?: boolean;
  autoUpdateCache?: boolean;
  cacheKeyPrefix?: string;
  callbacks?: AccessStreamCallbacks;
}

export function useAccessStream(options: UseAccessStreamOptions = {}) {
  const {
    enabled = true,
    autoUpdateCache = true,
    cacheKeyPrefix = '/api/atlas-one/access',
    callbacks,
  } = options;

  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const itemStateRef = useRef<Map<string, AccessUpdate>>(new Map());
  
  const [state, setState] = useState<AccessStreamState>({
    isConnected: false,
    pendingItems: new Set(),
    readyItems: new Set(),
    degradedItems: new Set(),
    lastUpdate: 0,
  });

  const updateItemState = useCallback((update: AccessUpdate) => {
    itemStateRef.current.set(update.itemId, update);

    setState(prev => {
      const newPending = new Set(prev.pendingItems);
      const newReady = new Set(prev.readyItems);
      const newDegraded = new Set(prev.degradedItems);
      
      newPending.delete(update.itemId);
      newReady.delete(update.itemId);
      newDegraded.delete(update.itemId);
      
      switch (update.readiness) {
        case 'PENDING':
          newPending.add(update.itemId);
          break;
        case 'READY':
          newReady.add(update.itemId);
          break;
        case 'DEGRADED':
          newDegraded.add(update.itemId);
          break;
      }
      
      return {
        ...prev,
        pendingItems: newPending,
        readyItems: newReady,
        degradedItems: newDegraded,
        lastUpdate: Date.now(),
      };
    });
  }, []);

  const updateQueryCache = useCallback((update: AccessUpdate) => {
    if (!autoUpdateCache) return;

    const queryKey = [cacheKeyPrefix, update.itemId];
    
    const cacheData = {
      itemId: update.itemId,
      readiness: update.readiness,
      access: update.access,
      fallback: update.fallback,
      upgradeEta: update.upgradeEta,
      updatedAt: Date.now(),
    };
    
    queryClient.setQueryData(queryKey, cacheData);
    
    const gradedQueryKey = [cacheKeyPrefix, update.itemId, 'graded'];
    queryClient.setQueryData(gradedQueryKey, cacheData);
    
    if (update.readiness === 'READY') {
      queryClient.invalidateQueries({
        queryKey: ['/api/atlas-one/catalog'],
        exact: false,
      });
    }
  }, [autoUpdateCache, cacheKeyPrefix, queryClient]);

  const handleAccessUpdate = useCallback((update: AccessUpdate) => {
    const previousState = itemStateRef.current.get(update.itemId);
    
    updateItemState(update);
    updateQueryCache(update);
    
    switch (update.readiness) {
      case 'PENDING':
        callbacks?.onAccessPending?.(update);
        break;
        
      case 'READY':
        callbacks?.onAccessReady?.(update);
        
        if (previousState?.readiness === 'DEGRADED') {
          callbacks?.onUpgradeAvailable?.(update.itemId, update);
        }
        break;
        
      case 'DEGRADED':
        callbacks?.onAccessDegraded?.(update);
        break;
    }
  }, [updateItemState, updateQueryCache, callbacks]);

  const handleBinaryFrame = useCallback((frame: LaneFrame) => {
    if (!frame.binary) return;
    
    const update = parseBinaryAccessFrame(frame.binary);
    if (update) {
      handleAccessUpdate(update);
    }
  }, [handleAccessUpdate]);

  const handleLaneFrame = useCallback((frame: LaneFrame) => {
    if (frame.type === 'access') {
      if (frame.binary) {
        handleBinaryFrame(frame);
      } else if (frame.data) {
        handleAccessUpdate(frame.data as AccessUpdate);
      }
    } else if (frame.type === 'error') {
      callbacks?.onError?.(new Error(String(frame.data)));
    }
  }, [handleAccessUpdate, handleBinaryFrame, callbacks]);

  useEffect(() => {
    if (!enabled || !isSessionActive()) {
      return;
    }

    setState(prev => ({ ...prev, isConnected: true }));

    unsubscribeRef.current = subscribeLane('access', handleLaneFrame);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      setState(prev => ({ ...prev, isConnected: false }));
    };
  }, [enabled, handleLaneFrame]);

  const getItemState = useCallback((itemId: string): AccessUpdate | undefined => {
    return itemStateRef.current.get(itemId);
  }, []);

  const isItemReady = useCallback((itemId: string): boolean => {
    return state.readyItems.has(itemId);
  }, [state.readyItems]);

  const isItemPending = useCallback((itemId: string): boolean => {
    return state.pendingItems.has(itemId);
  }, [state.pendingItems]);

  const isItemDegraded = useCallback((itemId: string): boolean => {
    return state.degradedItems.has(itemId);
  }, [state.degradedItems]);

  const requestAccess = useCallback(async (itemId: string): Promise<AccessUpdate | null> => {
    try {
      const response = await fetch(`/api/atlas-one/access/${itemId}/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Access request failed: ${response.status}`);
      }
      
      const data = await response.json();
      handleAccessUpdate(data);
      return data;
    } catch (err) {
      callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [handleAccessUpdate, callbacks]);

  const prefetchAccess = useCallback(async (itemIds: string[]): Promise<void> => {
    const unresolved = itemIds.filter(id => !itemStateRef.current.has(id));
    
    if (unresolved.length === 0) return;
    
    try {
      const response = await fetch('/api/atlas-one/access/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemIds: unresolved }),
      });
      
      if (!response.ok) {
        throw new Error(`Batch access request failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (Array.isArray(data.results)) {
        for (const update of data.results) {
          handleAccessUpdate(update);
        }
      }
    } catch (err) {
      console.warn('[useAccessStream] Batch prefetch failed:', err);
    }
  }, [handleAccessUpdate]);

  const clearItemState = useCallback((itemId: string) => {
    itemStateRef.current.delete(itemId);
    
    setState(prev => {
      const newPending = new Set(prev.pendingItems);
      const newReady = new Set(prev.readyItems);
      const newDegraded = new Set(prev.degradedItems);
      
      newPending.delete(itemId);
      newReady.delete(itemId);
      newDegraded.delete(itemId);
      
      return {
        ...prev,
        pendingItems: newPending,
        readyItems: newReady,
        degradedItems: newDegraded,
      };
    });
    
    queryClient.removeQueries({
      queryKey: [cacheKeyPrefix, itemId],
      exact: true,
    });
  }, [cacheKeyPrefix, queryClient]);

  const clearAllState = useCallback(() => {
    itemStateRef.current.clear();
    
    setState({
      isConnected: state.isConnected,
      pendingItems: new Set(),
      readyItems: new Set(),
      degradedItems: new Set(),
      lastUpdate: Date.now(),
    });
  }, [state.isConnected]);

  return {
    state,
    getItemState,
    isItemReady,
    isItemPending,
    isItemDegraded,
    requestAccess,
    prefetchAccess,
    clearItemState,
    clearAllState,
    itemCount: itemStateRef.current.size,
    pendingCount: state.pendingItems.size,
    readyCount: state.readyItems.size,
    degradedCount: state.degradedItems.size,
  };
}

export function useAccessItem(
  itemId: string | undefined,
  options: UseAccessStreamOptions = {}
) {
  const stream = useAccessStream(options);
  
  const [accessUpdate, setAccessUpdate] = useState<AccessUpdate | undefined>(
    itemId ? stream.getItemState(itemId) : undefined
  );

  useEffect(() => {
    if (!itemId) {
      setAccessUpdate(undefined);
      return;
    }
    
    const cached = stream.getItemState(itemId);
    if (cached) {
      setAccessUpdate(cached);
    }
  }, [itemId, stream]);

  useEffect(() => {
    if (!itemId) return;
    
    const intervalId = setInterval(() => {
      const current = stream.getItemState(itemId);
      if (current && current !== accessUpdate) {
        setAccessUpdate(current);
      }
    }, 100);
    
    return () => clearInterval(intervalId);
  }, [itemId, stream, accessUpdate]);

  return {
    accessUpdate,
    isReady: itemId ? stream.isItemReady(itemId) : false,
    isPending: itemId ? stream.isItemPending(itemId) : false,
    isDegraded: itemId ? stream.isItemDegraded(itemId) : false,
    requestAccess: itemId ? () => stream.requestAccess(itemId) : undefined,
    clearState: itemId ? () => stream.clearItemState(itemId) : undefined,
  };
}

export type { AccessUpdate } from '@/lib/session';
