import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAtlasStore } from '@/state/useAtlasStore';
import type { AtlasVisualizationSettings, VisualizationTheme } from '@/components/atlas/faces/types';

interface AtlasUserSettings {
  wallet: string;
  visualization: AtlasVisualizationSettings;
  accessibility?: {
    reduceMotion: boolean;
    highContrast: boolean;
    colorSafe: boolean;
  };
  privacy?: {
    shareThemeAcrossDevices: boolean;
  };
  updatedAt: string;
}

interface ThemeMetadata {
  theme: VisualizationTheme;
  label: string;
  description: string;
}

export function useAtlasThemes() {
  return useQuery<{ themes: ThemeMetadata[]; count: number }>({
    queryKey: ['/api/atlas/canvas/settings/themes'],
  });
}

export function useAtlasSettings(wallet: string | undefined) {
  const { loadVisualization } = useAtlasStore();
  
  const query = useQuery<{ ok: boolean; settings: AtlasUserSettings }>({
    queryKey: [`/api/atlas/canvas/settings/${wallet}`],
    enabled: Boolean(wallet),
  });
  
  useEffect(() => {
    if (query.data?.ok && query.data?.settings?.visualization) {
      loadVisualization(query.data.settings.visualization);
    }
  }, [query.data, loadVisualization]);
  
  return query;
}

export function useUpdateVisualization(wallet: string | undefined) {
  const { updateVisualization } = useAtlasStore();
  
  return useMutation({
    mutationFn: async (updates: Partial<AtlasVisualizationSettings>) => {
      updateVisualization(updates);
      return apiRequest('/api/atlas/canvas/settings/visualization', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(wallet ? { 'x-wallet-address': wallet } : {}),
        },
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      if (wallet) {
        queryClient.invalidateQueries({ queryKey: [`/api/atlas/canvas/settings/${wallet}`] });
      }
    },
  });
}

export function useSetTheme(wallet: string | undefined) {
  const { updateVisualization } = useAtlasStore();
  
  return useMutation({
    mutationFn: async (theme: VisualizationTheme) => {
      updateVisualization({ theme });
      return apiRequest('/api/atlas/canvas/settings/theme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(wallet ? { 'x-wallet-address': wallet } : {}),
        },
        body: JSON.stringify({ theme }),
      });
    },
    onSuccess: () => {
      if (wallet) {
        queryClient.invalidateQueries({ queryKey: [`/api/atlas/canvas/settings/${wallet}`] });
      }
    },
  });
}

export function useSetColor(wallet: string | undefined) {
  const { updateVisualization } = useAtlasStore();
  
  return useMutation({
    mutationFn: async ({ colorPrimary, colorAccent }: { colorPrimary: string; colorAccent?: string }) => {
      updateVisualization({ colorPrimary, colorAccent });
      return apiRequest('/api/atlas/canvas/settings/color', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(wallet ? { 'x-wallet-address': wallet } : {}),
        },
        body: JSON.stringify({ colorPrimary, colorAccent }),
      });
    },
    onSuccess: () => {
      if (wallet) {
        queryClient.invalidateQueries({ queryKey: [`/api/atlas/canvas/settings/${wallet}`] });
      }
    },
  });
}

export function useUpdateAccessibility(wallet: string | undefined) {
  return useMutation({
    mutationFn: async (updates: { reduceMotion?: boolean; highContrast?: boolean; colorSafe?: boolean }) => {
      return apiRequest('/api/atlas/canvas/settings/accessibility', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(wallet ? { 'x-wallet-address': wallet } : {}),
        },
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      if (wallet) {
        queryClient.invalidateQueries({ queryKey: [`/api/atlas/canvas/settings/${wallet}`] });
      }
    },
  });
}

export function useSaveSettings(wallet: string | undefined) {
  return useMutation({
    mutationFn: async (settings: AtlasUserSettings) => {
      return apiRequest('/api/atlas/canvas/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(wallet ? { 'x-wallet-address': wallet } : {}),
        },
        body: JSON.stringify(settings),
      });
    },
    onSuccess: () => {
      if (wallet) {
        queryClient.invalidateQueries({ queryKey: [`/api/atlas/canvas/settings/${wallet}`] });
      }
    },
  });
}
