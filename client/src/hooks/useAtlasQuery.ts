/**
 * Atlas Query Hooks - React Query patterns for Atlas API 2.0
 * 
 * Features:
 * - Delta manifest requests when version is known
 * - Viewport-based prefetching integration
 * - Real-time manifest subscription
 * - Optimistic updates with session-based cache
 */

import { useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useCallback, useRef, useMemo } from 'react';
import { usePrefetchWindow, type PrefetchItem } from './usePrefetchWindow';
import { subscribeManifests, type ManifestUpdate, isSessionActive } from '@/lib/session';
import { queryClient } from '@/lib/queryClient';

// Manifest version cache for delta requests
const manifestVersions = new Map<string, number>();

export interface CatalogItem {
  id: string;
  title: string;
  itemType: string;
  version?: number;
  [key: string]: unknown;
}

export interface CatalogResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  nextCursor?: string;
}

export interface UseAtlasCatalogOptions {
  category?: string;
  itemType?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  enablePrefetch?: boolean;
  enableDelta?: boolean;
  enableRealtime?: boolean;
}

/**
 * Hook for fetching catalog items with delta support
 */
export function useAtlasCatalog(options: UseAtlasCatalogOptions = {}) {
  const {
    category,
    itemType,
    search,
    page = 1,
    pageSize = 20,
    enablePrefetch = true,
    enableDelta = true,
    enableRealtime = true,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = useMemo(() => {
    const key = ['/api/atlas/catalog'];
    const params: Record<string, string | number> = {};
    
    if (category) params.category = category;
    if (itemType) params.itemType = itemType;
    if (search) params.search = search;
    if (page) params.page = page;
    if (pageSize) params.pageSize = pageSize;
    
    return [...key, params];
  }, [category, itemType, search, page, pageSize]);

  const query = useQuery<CatalogResponse>({
    queryKey,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    meta: {
      enableDelta,
    },
  });

  useEffect(() => {
    if (!enableRealtime || !isSessionActive()) return;

    const unsubscribe = subscribeManifests((update: ManifestUpdate) => {
      queryClient.setQueryData<CatalogResponse>(queryKey, (old) => {
        if (!old) return old;

        const itemIndex = old.items.findIndex((item) => item.id === update.itemId);
        if (itemIndex < 0) return old;

        const newItems = [...old.items];
        
        if (update.full) {
          newItems[itemIndex] = { ...newItems[itemIndex], ...update.full, version: update.version };
        } else if (update.delta) {
          newItems[itemIndex] = { ...newItems[itemIndex], ...update.delta, version: update.version };
        }

        manifestVersions.set(update.itemId, update.version);

        return { ...old, items: newItems };
      });
    });

    return unsubscribe;
  }, [queryKey, enableRealtime, queryClient]);

  const prefetchItems = useMemo<PrefetchItem[]>(() => {
    if (!query.data?.items || !enablePrefetch) return [];

    return query.data.items.map((item) => ({
      id: item.id,
      queryKey: ['/api/atlas/items', item.id],
    }));
  }, [query.data?.items, enablePrefetch]);

  const prefetch = usePrefetchWindow(prefetchItems, {
    prefetchAhead: 8,
    batchSize: 4,
  });

  return {
    ...query,
    prefetch,
    manifestVersions,
  };
}

/**
 * Hook for fetching a single item with delta support
 */
export function useAtlasItem<T extends CatalogItem = CatalogItem>(
  itemId: string | null,
  options: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'> & { enableDelta?: boolean } = {}
) {
  const { enableDelta = true, ...queryOptions } = options;
  const queryClient = useQueryClient();

  const currentVersion = itemId ? manifestVersions.get(itemId) : undefined;

  const queryKey = useMemo(() => {
    const key = ['/api/atlas/items', itemId];
    if (enableDelta && currentVersion) {
      return [...key, { version: currentVersion }];
    }
    return key;
  }, [itemId, enableDelta, currentVersion]);

  const query = useQuery<T>({
    queryKey,
    enabled: !!itemId,
    staleTime: 1000 * 60 * 5,
    ...queryOptions,
  });

  useEffect(() => {
    if (!itemId || !isSessionActive()) return;

    const unsubscribe = subscribeManifests((update: ManifestUpdate) => {
      if (update.itemId !== itemId) return;

      queryClient.setQueryData<T>(queryKey, (old) => {
        if (!old) return old;

        if (update.full) {
          return { ...old, ...update.full, version: update.version } as T;
        } else if (update.delta) {
          return { ...old, ...update.delta, version: update.version } as T;
        }

        return old;
      });

      manifestVersions.set(update.itemId, update.version);
    });

    return unsubscribe;
  }, [itemId, queryKey, queryClient]);

  return query;
}

/**
 * Hook for prefetching items based on viewport predictions
 */
export function useViewportPrefetch(
  items: CatalogItem[],
  options: { prefetchAhead?: number; batchSize?: number } = {}
) {
  const prefetchItems = useMemo<PrefetchItem[]>(() => {
    return items.map((item) => ({
      id: item.id,
      queryKey: ['/api/atlas/items', item.id],
      queryFn: async () => {
        const response = await fetch(`/api/atlas/items/${item.id}`);
        if (!response.ok) throw new Error('Failed to fetch item');
        return response.json();
      },
    }));
  }, [items]);

  return usePrefetchWindow(prefetchItems, {
    prefetchAhead: options.prefetchAhead ?? 8,
    batchSize: options.batchSize ?? 4,
    debounceMs: 150,
  });
}

/**
 * Hook for subscribing to real-time manifest updates
 */
export function useManifestSubscription(
  itemIds: string[],
  onUpdate?: (update: ManifestUpdate) => void
) {
  const itemIdSet = useMemo(() => new Set(itemIds), [itemIds]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSessionActive() || itemIdSet.size === 0) return;

    const unsubscribe = subscribeManifests((update: ManifestUpdate) => {
      if (!itemIdSet.has(update.itemId)) return;

      manifestVersions.set(update.itemId, update.version);

      queryClient.setQueryData(
        ['/api/atlas/items', update.itemId],
        (old: CatalogItem | undefined) => {
          if (!old) return old;

          if (update.full) {
            return { ...old, ...update.full, version: update.version };
          } else if (update.delta) {
            return { ...old, ...update.delta, version: update.version };
          }

          return old;
        }
      );

      onUpdate?.(update);
    });

    return unsubscribe;
  }, [itemIdSet, queryClient, onUpdate]);
}

/**
 * Prefetch items programmatically
 */
export function prefetchItems(itemIds: string[]): void {
  for (const itemId of itemIds) {
    const version = manifestVersions.get(itemId);
    const queryKey = version
      ? ['/api/atlas/items', itemId, { version }]
      : ['/api/atlas/items', itemId];

    queryClient.prefetchQuery({
      queryKey,
      staleTime: 1000 * 60 * 5,
    });
  }
}

/**
 * Invalidate and refetch items
 */
export function invalidateItems(itemIds: string[]): Promise<void> {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== '/api/atlas/items') return false;
      return itemIds.includes(key[1] as string);
    },
  });
}

/**
 * Get cached version for an item
 */
export function getCachedVersion(itemId: string): number | undefined {
  return manifestVersions.get(itemId);
}

/**
 * Set cached version for an item
 */
export function setCachedVersion(itemId: string, version: number): void {
  manifestVersions.set(itemId, version);
}

/**
 * Clear all cached versions
 */
export function clearVersionCache(): void {
  manifestVersions.clear();
}

/**
 * Create delta query params
 */
export function createDeltaParams(itemId: string): Record<string, string | number> {
  const version = manifestVersions.get(itemId);
  return version ? { version, delta: 1 } : {};
}

/**
 * Hook for infinite scrolling with prefetch
 */
export function useInfiniteAtlasCatalog(options: UseAtlasCatalogOptions = {}) {
  const {
    category,
    itemType,
    search,
    pageSize = 20,
    enablePrefetch = true,
  } = options;

  const pagesRef = useRef<CatalogResponse[]>([]);

  const loadMore = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (itemType) params.set('itemType', itemType);
    if (search) params.set('search', search);
    params.set('pageSize', pageSize.toString());
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`/api/atlas/catalog?${params}`);
    if (!response.ok) throw new Error('Failed to fetch catalog');

    const data: CatalogResponse = await response.json();
    pagesRef.current = [...pagesRef.current, data];

    if (enablePrefetch && data.items.length > 0) {
      const prefetchIds = data.items.slice(-4).map((item) => item.id);
      prefetchItems(prefetchIds);
    }

    return data;
  }, [category, itemType, search, pageSize, enablePrefetch]);

  const reset = useCallback(() => {
    pagesRef.current = [];
  }, []);

  const allItems = useMemo(() => {
    return pagesRef.current.flatMap((page) => page.items);
  }, [pagesRef.current.length]);

  return {
    loadMore,
    reset,
    allItems,
    pages: pagesRef.current,
    hasMore: pagesRef.current.length === 0 || !!pagesRef.current[pagesRef.current.length - 1]?.nextCursor,
  };
}
