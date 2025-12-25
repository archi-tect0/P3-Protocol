import { useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('atlas_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function memoryFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { 
    ...options,
    headers: { 
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Memory fetch failed: ${response.status}`);
  return response.json();
}

export interface SessionMemoryState {
  wallet: string;
  pinned: string[];
  recentFlows: string[];
  lastQueries: string[];
  preferences: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface MemoryResponse {
  ok: boolean;
  session: SessionMemoryState;
  message?: string;
  ts: number;
}

interface PinnedResponse {
  ok: boolean;
  pinned: string[];
  count: number;
  ts: number;
}

interface FlowsResponse {
  ok: boolean;
  flows: string[];
  count: number;
  ts: number;
}

interface QueriesResponse {
  ok: boolean;
  queries: string[];
  count: number;
  ts: number;
}

interface MemoryStats {
  totalSessions: number;
  totalPins: number;
  totalFlows: number;
  totalQueries: number;
}

export function useSessionMemory() {
  return useQuery<MemoryResponse>({
    queryKey: ['/api/atlas/memory'],
    queryFn: () => memoryFetch('/api/atlas/memory'),
  });
}

export function usePinnedApps() {
  return useQuery<PinnedResponse>({
    queryKey: ['/api/atlas/memory/pinned'],
    queryFn: () => memoryFetch('/api/atlas/memory/pinned'),
  });
}

export function useRecentFlows(limit = 10) {
  return useQuery<FlowsResponse>({
    queryKey: ['/api/atlas/memory/flows', limit],
    queryFn: () => memoryFetch(`/api/atlas/memory/flows?limit=${limit}`),
  });
}

export function useRecentQueries(limit = 20) {
  return useQuery<QueriesResponse>({
    queryKey: ['/api/atlas/memory/queries', limit],
    queryFn: () => memoryFetch(`/api/atlas/memory/queries?limit=${limit}`),
  });
}

export function useMemoryStats() {
  return useQuery<{ ok: boolean; stats: MemoryStats; ts: number }>({
    queryKey: ['/api/atlas/memory/stats'],
    queryFn: () => memoryFetch('/api/atlas/memory/stats'),
  });
}

export function usePinApp() {
  return useMutation({
    mutationFn: async (appId: string) => {
      return memoryFetch<MemoryResponse>('/api/atlas/memory/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory/pinned'] });
    },
  });
}

export function useUnpinApp() {
  return useMutation({
    mutationFn: async (appId: string) => {
      return memoryFetch<MemoryResponse>(`/api/atlas/memory/pin/${appId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory/pinned'] });
    },
  });
}

export function useRecordFlow() {
  return useMutation({
    mutationFn: async (flowId: string) => {
      return memoryFetch<MemoryResponse>('/api/atlas/memory/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory/flows'] });
    },
  });
}

export function useRecordQuery() {
  return useMutation({
    mutationFn: async (query: string) => {
      return memoryFetch<MemoryResponse>('/api/atlas/memory/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory/queries'] });
    },
  });
}

export function useClearHistory() {
  return useMutation({
    mutationFn: async (type: 'flows' | 'queries' | 'all' = 'all') => {
      return memoryFetch<MemoryResponse>('/api/atlas/memory/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory/flows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory/queries'] });
    },
  });
}

export function useResetMemory() {
  return useMutation({
    mutationFn: async () => {
      return memoryFetch<MemoryResponse>('/api/atlas/memory/reset', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
    },
  });
}

export function useSetPreference() {
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return memoryFetch<MemoryResponse>('/api/atlas/memory/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/memory'] });
    },
  });
}

export function useMemoryActions() {
  const pinMutation = usePinApp();
  const unpinMutation = useUnpinApp();
  const recordFlowMutation = useRecordFlow();
  const recordQueryMutation = useRecordQuery();
  const clearHistoryMutation = useClearHistory();
  const resetMutation = useResetMemory();

  const pin = useCallback((appId: string) => {
    return pinMutation.mutateAsync(appId);
  }, [pinMutation]);

  const unpin = useCallback((appId: string) => {
    return unpinMutation.mutateAsync(appId);
  }, [unpinMutation]);

  const recordFlow = useCallback((flowId: string) => {
    return recordFlowMutation.mutateAsync(flowId);
  }, [recordFlowMutation]);

  const recordQuery = useCallback((query: string) => {
    return recordQueryMutation.mutateAsync(query);
  }, [recordQueryMutation]);

  const clearHistory = useCallback((type: 'flows' | 'queries' | 'all' = 'all') => {
    return clearHistoryMutation.mutateAsync(type);
  }, [clearHistoryMutation]);

  const resetMemory = useCallback(() => {
    return resetMutation.mutateAsync();
  }, [resetMutation]);

  return {
    pin,
    unpin,
    recordFlow,
    recordQuery,
    clearHistory,
    resetMemory,
    isLoading: 
      pinMutation.isPending || 
      unpinMutation.isPending || 
      recordFlowMutation.isPending ||
      recordQueryMutation.isPending ||
      clearHistoryMutation.isPending ||
      resetMutation.isPending,
  };
}
