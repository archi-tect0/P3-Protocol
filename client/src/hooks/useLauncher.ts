import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface PinnedApp {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  category: string;
}

interface RecentFlow {
  flowId: string;
  name: string;
  status: 'success' | 'failed' | 'partial';
  completedAt: number;
  stepCount: number;
}

interface LiveStatus {
  slack?: {
    unread: number;
    channels: Array<{ id: string; name: string; unread: number }>;
  };
  spotify?: {
    playing: boolean;
    track?: string;
    artist?: string;
  };
}

interface LauncherData {
  pinned: PinnedApp[];
  recent: RecentFlow[];
  status: LiveStatus;
}

interface LauncherResponse {
  ok: boolean;
  flowId: string;
  correlationId: string;
  data: LauncherData;
  errors?: string[];
}

export function useLauncher(wallet: string | null) {
  const query = useQuery<LauncherResponse>({
    queryKey: ['/api/atlas/flows/launcher', wallet],
    enabled: !!wallet,
  });

  const addPinnedApp = useMutation({
    mutationFn: async (app: PinnedApp) => {
      return apiRequest('/api/atlas/flows/launcher/pinned/add', {
        method: 'POST',
        body: JSON.stringify({ wallet, app }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/flows/launcher', wallet] });
    },
  });

  const removePinnedApp = useMutation({
    mutationFn: async (appId: string) => {
      return apiRequest(`/api/atlas/flows/launcher/pinned/${appId}?wallet=${wallet}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/flows/launcher', wallet] });
    },
  });

  const setPinnedApps = useMutation({
    mutationFn: async (apps: PinnedApp[]) => {
      return apiRequest('/api/atlas/flows/launcher/pinned', {
        method: 'POST',
        body: JSON.stringify({ wallet, apps }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/flows/launcher', wallet] });
    },
  });

  return {
    data: query.data?.data || null,
    flowId: query.data?.flowId,
    correlationId: query.data?.correlationId,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addPinnedApp,
    removePinnedApp,
    setPinnedApps,
  };
}

export default useLauncher;
