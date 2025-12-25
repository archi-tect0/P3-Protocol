import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('atlas_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function devkitFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error(`DevKit fetch failed: ${response.status}`);
  return response.json();
}

interface DevKitEndpoint {
  key: string;
  app: string;
  fn: string;
  description?: string;
  scopes: string[];
  args: Record<string, string>;
  samplePhrases?: string[];
  status: 'live' | 'storage' | 'oauth' | 'stub';
}

interface DevKitFlow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  requiredScopes: string[];
}

interface DevKitApp {
  id: string;
  name: string;
  version: string;
  endpointCount: number;
  permissions: string[];
}

interface DevKitStats {
  totalEndpoints: number;
  liveEndpoints: number;
  totalApps: number;
  totalFlows: number;
}

interface DevKitQueryResult {
  ok: boolean;
  type: 'endpoints' | 'flows' | 'apps' | 'search' | 'describe' | 'help';
  data: DevKitEndpoint[] | DevKitFlow[] | DevKitApp[] | DevKitEndpoint | string;
  count?: number;
  suggestions?: string[];
  ts?: number;
}

export function useDevKitEndpoints() {
  return useQuery<{ ok: boolean; endpoints: DevKitEndpoint[]; count: number }>({
    queryKey: ['/api/atlas/devkit/endpoints'],
    queryFn: () => devkitFetch('/api/atlas/devkit/endpoints'),
  });
}

export function useDevKitApps() {
  return useQuery<{ ok: boolean; apps: DevKitApp[]; count: number }>({
    queryKey: ['/api/atlas/devkit/apps'],
    queryFn: () => devkitFetch('/api/atlas/devkit/apps'),
  });
}

export function useDevKitFlows() {
  return useQuery<{ ok: boolean; flows: DevKitFlow[]; count: number }>({
    queryKey: ['/api/atlas/devkit/flows'],
    queryFn: () => devkitFetch('/api/atlas/devkit/flows'),
  });
}

export function useDevKitStats() {
  return useQuery<{ ok: boolean; stats: DevKitStats }>({
    queryKey: ['/api/atlas/devkit/stats'],
    queryFn: () => devkitFetch('/api/atlas/devkit/stats'),
  });
}

export function useDevKitHelp() {
  return useQuery<{ ok: boolean; help: string; commands: string[] }>({
    queryKey: ['/api/atlas/devkit/help'],
    queryFn: () => devkitFetch('/api/atlas/devkit/help'),
  });
}

export function useDevKitSearch(query: string) {
  return useQuery<{ ok: boolean; endpoints: DevKitEndpoint[]; count: number }>({
    queryKey: ['/api/atlas/devkit/search', query],
    queryFn: () => devkitFetch(`/api/atlas/devkit/search?q=${encodeURIComponent(query)}`),
    enabled: query.length > 0,
  });
}

export function useDevKitQuery() {
  const [result, setResult] = useState<DevKitQueryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const query = useCallback(async (queryText: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/atlas/devkit/query', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ query: queryText }),
      });
      const data = await response.json();
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/devkit'] });
      return data;
    } catch (error) {
      const errorResult: DevKitQueryResult = {
        ok: false,
        type: 'help',
        data: 'Query failed. Try "atlas devkit help" for available commands.',
      };
      setResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  return { query, result, isLoading, reset };
}

export function useDevKitEndpoint(key: string) {
  return useQuery<{ ok: boolean; endpoint: DevKitEndpoint }>({
    queryKey: ['/api/atlas/devkit/endpoints', key],
    queryFn: () => devkitFetch(`/api/atlas/devkit/endpoints/${key.replace(/\./g, '-')}`),
    enabled: !!key,
  });
}

export function useAskAtlasAboutDevKit() {
  const mutation = useMutation({
    mutationFn: async ({ wallet, message }: { wallet: string; message: string }) => {
      const response = await fetch('/api/atlas/ask', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ wallet, message: `atlas devkit ${message}` }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/devkit'] });
    },
  });

  return {
    ask: mutation.mutate,
    askAsync: mutation.mutateAsync,
    result: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}
