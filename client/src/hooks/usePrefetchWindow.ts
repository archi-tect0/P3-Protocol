/**
 * Prefetch Window Hook - Viewport-based prefetching for Atlas API 2.0
 * 
 * Tracks visible viewport items using IntersectionObserver and prefetches
 * 6-12 items ahead of scroll position. Batches prefetch requests for efficiency.
 * 
 * Features:
 * - Rolling window of 6-12 items ahead of scroll
 * - Request manifests/access for prefetch window
 * - Intersection Observer for visibility detection
 * - Batch prefetch requests for efficiency
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { queryClient } from '@/lib/queryClient';

export interface PrefetchConfig {
  prefetchAhead?: number;
  prefetchBehind?: number;
  minWindow?: number;
  maxWindow?: number;
  batchSize?: number;
  debounceMs?: number;
  threshold?: number;
  rootMargin?: string;
  prefetchManifests?: boolean;
  prefetchAccess?: boolean;
  accessEndpoint?: string;
  manifestEndpoint?: string;
}

export interface PrefetchItem {
  id: string;
  queryKey: string[];
  queryFn?: () => Promise<unknown>;
  itemType?: string;
}

interface VisibilityState {
  visible: Set<string>;
  firstVisible: number;
  lastVisible: number;
  rollingWindowStart: number;
  rollingWindowEnd: number;
}

interface PrefetchStats {
  manifestsPrefetched: number;
  accessPrefetched: number;
  totalPrefetched: number;
  failedPrefetches: number;
}

const DEFAULT_CONFIG: Required<PrefetchConfig> = {
  prefetchAhead: 8,
  prefetchBehind: 2,
  minWindow: 6,
  maxWindow: 12,
  batchSize: 4,
  debounceMs: 150,
  threshold: 0.1,
  rootMargin: '200px 0px',
  prefetchManifests: true,
  prefetchAccess: true,
  accessEndpoint: '/api/atlas-one/access',
  manifestEndpoint: '/api/atlas-one/catalog',
};

export function usePrefetchWindow(
  items: PrefetchItem[],
  config: PrefetchConfig = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const observerRef = useRef<IntersectionObserver | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchQueueRef = useRef<Set<string>>(new Set());
  const prefetchedRef = useRef<Set<string>>(new Set());
  const manifestsPrefetchedRef = useRef<Set<string>>(new Set());
  const accessPrefetchedRef = useRef<Set<string>>(new Set());
  
  const [visibilityState, setVisibilityState] = useState<VisibilityState>({
    visible: new Set(),
    firstVisible: -1,
    lastVisible: -1,
    rollingWindowStart: -1,
    rollingWindowEnd: -1,
  });
  
  const [stats, setStats] = useState<PrefetchStats>({
    manifestsPrefetched: 0,
    accessPrefetched: 0,
    totalPrefetched: 0,
    failedPrefetches: 0,
  });

  const prefetchManifests = useCallback(async (itemIds: string[]) => {
    if (!mergedConfig.prefetchManifests || itemIds.length === 0) return;
    
    const unprefetched = itemIds.filter(id => !manifestsPrefetchedRef.current.has(id));
    if (unprefetched.length === 0) return;
    
    try {
      const response = await fetch(`${mergedConfig.manifestEndpoint}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: unprefetched }),
      });
      
      if (response.ok) {
        const data = await response.json();
        for (const id of unprefetched) {
          manifestsPrefetchedRef.current.add(id);
        }
        
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            queryClient.setQueryData(
              [mergedConfig.manifestEndpoint, item.id],
              item
            );
          }
        }
        
        setStats(prev => ({
          ...prev,
          manifestsPrefetched: prev.manifestsPrefetched + unprefetched.length,
          totalPrefetched: prev.totalPrefetched + unprefetched.length,
        }));
      }
    } catch (err) {
      console.warn('[PrefetchWindow] Manifest batch prefetch failed:', err);
      setStats(prev => ({
        ...prev,
        failedPrefetches: prev.failedPrefetches + 1,
      }));
    }
  }, [mergedConfig.prefetchManifests, mergedConfig.manifestEndpoint]);

  const prefetchAccess = useCallback(async (itemIds: string[]) => {
    if (!mergedConfig.prefetchAccess || itemIds.length === 0) return;
    
    const unprefetched = itemIds.filter(id => !accessPrefetchedRef.current.has(id));
    if (unprefetched.length === 0) return;
    
    try {
      const response = await fetch(`${mergedConfig.accessEndpoint}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: unprefetched }),
      });
      
      if (response.ok) {
        const data = await response.json();
        for (const id of unprefetched) {
          accessPrefetchedRef.current.add(id);
        }
        
        if (Array.isArray(data.results)) {
          for (const result of data.results) {
            queryClient.setQueryData(
              [mergedConfig.accessEndpoint, result.itemId],
              result
            );
          }
        }
        
        setStats(prev => ({
          ...prev,
          accessPrefetched: prev.accessPrefetched + unprefetched.length,
          totalPrefetched: prev.totalPrefetched + unprefetched.length,
        }));
      }
    } catch (err) {
      console.warn('[PrefetchWindow] Access batch prefetch failed:', err);
      setStats(prev => ({
        ...prev,
        failedPrefetches: prev.failedPrefetches + 1,
      }));
    }
  }, [mergedConfig.prefetchAccess, mergedConfig.accessEndpoint]);

  const batchPrefetch = useCallback(async () => {
    const queue = Array.from(prefetchQueueRef.current);
    prefetchQueueRef.current.clear();
    
    if (queue.length === 0) return;

    const batches: string[][] = [];
    for (let i = 0; i < queue.length; i += mergedConfig.batchSize) {
      batches.push(queue.slice(i, i + mergedConfig.batchSize));
    }

    for (const batch of batches) {
      await Promise.all([
        prefetchManifests(batch),
        prefetchAccess(batch),
        
        ...batch.map(async (itemId) => {
          const item = items.find((i) => i.id === itemId);
          if (!item || prefetchedRef.current.has(itemId)) return;

          try {
            prefetchedRef.current.add(itemId);
            
            if (item.queryFn) {
              await queryClient.prefetchQuery({
                queryKey: item.queryKey,
                queryFn: item.queryFn,
                staleTime: 1000 * 60 * 5,
              });
            } else {
              await queryClient.prefetchQuery({
                queryKey: item.queryKey,
                staleTime: 1000 * 60 * 5,
              });
            }
          } catch (err) {
            prefetchedRef.current.delete(itemId);
            console.warn(`[PrefetchWindow] Failed to prefetch ${itemId}:`, err);
            setStats(prev => ({
              ...prev,
              failedPrefetches: prev.failedPrefetches + 1,
            }));
          }
        }),
      ]);
    }
  }, [items, mergedConfig.batchSize, prefetchManifests, prefetchAccess]);

  const schedulePrefetch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      batchPrefetch();
    }, mergedConfig.debounceMs);
  }, [batchPrefetch, mergedConfig.debounceMs]);

  const calculateRollingWindow = useCallback((
    firstVisible: number,
    lastVisible: number
  ): { start: number; end: number } => {
    if (firstVisible < 0 || lastVisible < 0) {
      return { start: -1, end: -1 };
    }
    
    const windowStart = Math.max(0, firstVisible - mergedConfig.prefetchBehind);
    const windowEnd = Math.min(
      items.length - 1,
      lastVisible + mergedConfig.prefetchAhead
    );
    
    const windowSize = windowEnd - windowStart + 1;
    
    if (windowSize < mergedConfig.minWindow) {
      const needed = mergedConfig.minWindow - windowSize;
      const expandEnd = Math.min(items.length - 1, windowEnd + needed);
      return { start: windowStart, end: expandEnd };
    }
    
    if (windowSize > mergedConfig.maxWindow) {
      const excess = windowSize - mergedConfig.maxWindow;
      const shrinkStart = Math.min(windowStart + excess, firstVisible);
      return { start: shrinkStart, end: windowEnd };
    }
    
    return { start: windowStart, end: windowEnd };
  }, [items.length, mergedConfig.prefetchAhead, mergedConfig.prefetchBehind, mergedConfig.minWindow, mergedConfig.maxWindow]);

  const updatePrefetchQueue = useCallback((state: VisibilityState) => {
    if (state.lastVisible < 0) return;

    const { start: windowStart, end: windowEnd } = calculateRollingWindow(
      state.firstVisible,
      state.lastVisible
    );
    
    setVisibilityState(prev => ({
      ...prev,
      rollingWindowStart: windowStart,
      rollingWindowEnd: windowEnd,
    }));

    for (let i = windowStart; i <= windowEnd; i++) {
      const item = items[i];
      if (item && !prefetchedRef.current.has(item.id)) {
        prefetchQueueRef.current.add(item.id);
      }
    }

    if (prefetchQueueRef.current.size > 0) {
      schedulePrefetch();
    }
  }, [items, calculateRollingWindow, schedulePrefetch]);

  const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
    setVisibilityState((prev) => {
      const newVisible = new Set(prev.visible);
      
      for (const entry of entries) {
        const id = entry.target.getAttribute('data-prefetch-id');
        if (!id) continue;
        
        if (entry.isIntersecting) {
          newVisible.add(id);
        } else {
          newVisible.delete(id);
        }
      }

      let firstVisible = -1;
      let lastVisible = -1;
      
      for (let i = 0; i < items.length; i++) {
        if (newVisible.has(items[i].id)) {
          if (firstVisible < 0) firstVisible = i;
          lastVisible = i;
        }
      }

      const newState: VisibilityState = {
        visible: newVisible,
        firstVisible,
        lastVisible,
        rollingWindowStart: prev.rollingWindowStart,
        rollingWindowEnd: prev.rollingWindowEnd,
      };
      updatePrefetchQueue(newState);
      
      return newState;
    });
  }, [items, updatePrefetchQueue]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(handleIntersection, {
      threshold: mergedConfig.threshold,
      rootMargin: mergedConfig.rootMargin,
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [handleIntersection, mergedConfig.threshold, mergedConfig.rootMargin]);

  const registerItem = useCallback((id: string, element: HTMLElement | null) => {
    if (!observerRef.current) return;

    const existingEl = itemRefs.current.get(id);
    if (existingEl) {
      observerRef.current.unobserve(existingEl);
      itemRefs.current.delete(id);
    }

    if (element) {
      element.setAttribute('data-prefetch-id', id);
      itemRefs.current.set(id, element);
      observerRef.current.observe(element);
    }
  }, []);

  const unregisterItem = useCallback((id: string) => {
    if (!observerRef.current) return;
    
    const element = itemRefs.current.get(id);
    if (element) {
      observerRef.current.unobserve(element);
      itemRefs.current.delete(id);
    }
  }, []);

  const prefetchNow = useCallback((itemIds: string[]) => {
    for (const id of itemIds) {
      if (!prefetchedRef.current.has(id)) {
        prefetchQueueRef.current.add(id);
      }
    }
    batchPrefetch();
  }, [batchPrefetch]);

  const clearPrefetchCache = useCallback((itemIds?: string[]) => {
    if (itemIds) {
      for (const id of itemIds) {
        prefetchedRef.current.delete(id);
      }
    } else {
      prefetchedRef.current.clear();
    }
  }, []);

  const getVisibleItems = useCallback(() => {
    return Array.from(visibilityState.visible);
  }, [visibilityState.visible]);

  const isVisible = useCallback((id: string) => {
    return visibilityState.visible.has(id);
  }, [visibilityState.visible]);

  const getRollingWindow = useCallback(() => {
    return {
      start: visibilityState.rollingWindowStart,
      end: visibilityState.rollingWindowEnd,
      items: items.slice(
        Math.max(0, visibilityState.rollingWindowStart),
        visibilityState.rollingWindowEnd + 1
      ),
    };
  }, [visibilityState.rollingWindowStart, visibilityState.rollingWindowEnd, items]);

  const isInRollingWindow = useCallback((id: string) => {
    const idx = items.findIndex(item => item.id === id);
    return (
      idx >= visibilityState.rollingWindowStart &&
      idx <= visibilityState.rollingWindowEnd
    );
  }, [items, visibilityState.rollingWindowStart, visibilityState.rollingWindowEnd]);

  const clearManifestCache = useCallback((itemIds?: string[]) => {
    if (itemIds) {
      for (const id of itemIds) {
        manifestsPrefetchedRef.current.delete(id);
      }
    } else {
      manifestsPrefetchedRef.current.clear();
    }
  }, []);

  const clearAccessCache = useCallback((itemIds?: string[]) => {
    if (itemIds) {
      for (const id of itemIds) {
        accessPrefetchedRef.current.delete(id);
      }
    } else {
      accessPrefetchedRef.current.clear();
    }
  }, []);

  return {
    registerItem,
    unregisterItem,
    prefetchNow,
    clearPrefetchCache,
    clearManifestCache,
    clearAccessCache,
    getVisibleItems,
    isVisible,
    isInRollingWindow,
    getRollingWindow,
    visibilityState,
    stats,
    prefetchedCount: prefetchedRef.current.size,
    manifestsPrefetchedCount: manifestsPrefetchedRef.current.size,
    accessPrefetchedCount: accessPrefetchedRef.current.size,
  };
}

export function usePrefetchRef(
  registerItem: (id: string, element: HTMLElement | null) => void,
  id: string
) {
  const callbackRef = useCallback(
    (element: HTMLElement | null) => {
      registerItem(id, element);
    },
    [registerItem, id]
  );

  return callbackRef;
}

export interface ViewportPrediction {
  direction: 'up' | 'down' | 'idle';
  velocity: number;
  predictedIndex: number;
}

export function useViewportPrediction(
  visibilityState: VisibilityState,
  totalItems: number
): ViewportPrediction {
  const lastStateRef = useRef<VisibilityState>(visibilityState);
  const [prediction, setPrediction] = useState<ViewportPrediction>({
    direction: 'idle',
    velocity: 0,
    predictedIndex: -1,
  });

  useEffect(() => {
    const prev = lastStateRef.current;
    const curr = visibilityState;
    
    if (prev.lastVisible >= 0 && curr.lastVisible >= 0) {
      const delta = curr.lastVisible - prev.lastVisible;
      const direction = delta > 0 ? 'down' : delta < 0 ? 'up' : 'idle';
      const velocity = Math.abs(delta);
      
      const predictedIndex = direction === 'down'
        ? Math.min(totalItems - 1, curr.lastVisible + velocity * 2)
        : Math.max(0, curr.firstVisible - velocity * 2);

      setPrediction({ direction, velocity, predictedIndex });
    }
    
    lastStateRef.current = curr;
  }, [visibilityState, totalItems]);

  return prediction;
}

export interface ScrollVelocity {
  pixelsPerSecond: number;
  direction: 'up' | 'down' | 'idle';
  isScrolling: boolean;
  lastScrollY: number;
  lastScrollTime: number;
}

export function useScrollVelocity(
  containerRef?: { current: HTMLElement | null }
): ScrollVelocity {
  const [velocity, setVelocity] = useState<ScrollVelocity>({
    pixelsPerSecond: 0,
    direction: 'idle',
    isScrolling: false,
    lastScrollY: 0,
    lastScrollTime: Date.now(),
  });

  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const velocityHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const container = containerRef?.current || window;
    
    const handleScroll = () => {
      const now = Date.now();
      const currentY = containerRef?.current 
        ? containerRef.current.scrollTop 
        : window.scrollY;
      
      setVelocity(prev => {
        const timeDelta = now - prev.lastScrollTime;
        const scrollDelta = currentY - prev.lastScrollY;
        
        if (timeDelta > 0 && timeDelta < 1000) {
          const instantVelocity = Math.abs(scrollDelta) / (timeDelta / 1000);
          velocityHistoryRef.current.push(instantVelocity);
          if (velocityHistoryRef.current.length > 5) {
            velocityHistoryRef.current.shift();
          }
          
          const avgVelocity = velocityHistoryRef.current.reduce((a, b) => a + b, 0) 
            / velocityHistoryRef.current.length;
          
          return {
            pixelsPerSecond: avgVelocity,
            direction: scrollDelta > 0 ? 'down' : scrollDelta < 0 ? 'up' : 'idle',
            isScrolling: true,
            lastScrollY: currentY,
            lastScrollTime: now,
          };
        }
        
        return {
          ...prev,
          lastScrollY: currentY,
          lastScrollTime: now,
          isScrolling: true,
        };
      });

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        setVelocity(prev => ({
          ...prev,
          isScrolling: false,
          direction: 'idle',
          pixelsPerSecond: 0,
        }));
        velocityHistoryRef.current = [];
      }, 150);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [containerRef]);

  return velocity;
}

export interface CancelablePrefetchConfig extends PrefetchConfig {
  cancelOnScrollPast?: boolean;
  cancelVelocityThreshold?: number;
}

interface PrefetchRequest {
  id: string;
  abortController: AbortController;
  status: 'pending' | 'completed' | 'cancelled';
}

export function useCancelablePrefetchWindow(
  items: PrefetchItem[],
  config: CancelablePrefetchConfig = {}
) {
  const mergedConfig = { 
    ...config,
    cancelOnScrollPast: config.cancelOnScrollPast ?? true,
    cancelVelocityThreshold: config.cancelVelocityThreshold ?? 1000,
  };
  
  const basePrefetch = usePrefetchWindow(items, config);
  const pendingRequestsRef = useRef<Map<string, PrefetchRequest>>(new Map());
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const scrollVelocity = useScrollVelocity();

  const cancelPrefetch = useCallback((itemId: string) => {
    const request = pendingRequestsRef.current.get(itemId);
    if (request && request.status === 'pending') {
      request.abortController.abort();
      request.status = 'cancelled';
      cancelledIdsRef.current.add(itemId);
      console.log(`[PrefetchWindow] Cancelled prefetch for ${itemId}`);
    }
  }, []);

  const cancelScrolledPastItems = useCallback(() => {
    if (!mergedConfig.cancelOnScrollPast) return;
    
    const { rollingWindowStart } = basePrefetch.visibilityState;
    if (rollingWindowStart < 0) return;
    
    for (let i = 0; i < rollingWindowStart; i++) {
      const item = items[i];
      if (item) {
        cancelPrefetch(item.id);
      }
    }
  }, [items, basePrefetch.visibilityState, cancelPrefetch, mergedConfig.cancelOnScrollPast]);

  useEffect(() => {
    if (scrollVelocity.pixelsPerSecond > mergedConfig.cancelVelocityThreshold) {
      cancelScrolledPastItems();
    }
  }, [scrollVelocity.pixelsPerSecond, mergedConfig.cancelVelocityThreshold, cancelScrolledPastItems]);

  const prefetchWithCancel = useCallback(async (
    itemId: string,
    fetchFn: () => Promise<unknown>
  ): Promise<unknown> => {
    if (cancelledIdsRef.current.has(itemId)) {
      return Promise.resolve(null);
    }

    const controller = new AbortController();
    const request: PrefetchRequest = {
      id: itemId,
      abortController: controller,
      status: 'pending',
    };
    
    pendingRequestsRef.current.set(itemId, request);

    try {
      const result = await Promise.race([
        fetchFn(),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
      ]);
      
      request.status = 'completed';
      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        request.status = 'cancelled';
        return null;
      }
      throw err;
    } finally {
      pendingRequestsRef.current.delete(itemId);
    }
  }, []);

  const getCancelledCount = useCallback(() => {
    return cancelledIdsRef.current.size;
  }, []);

  const getPendingCount = useCallback(() => {
    let count = 0;
    for (const request of pendingRequestsRef.current.values()) {
      if (request.status === 'pending') count++;
    }
    return count;
  }, []);

  const clearCancelledCache = useCallback(() => {
    cancelledIdsRef.current.clear();
  }, []);

  return {
    ...basePrefetch,
    scrollVelocity,
    cancelPrefetch,
    cancelScrolledPastItems,
    prefetchWithCancel,
    getCancelledCount,
    getPendingCount,
    clearCancelledCache,
  };
}
