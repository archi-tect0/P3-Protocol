import { useQuery } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { LauncherView } from '@/components/canvas/LauncherView';
import { Rocket, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LauncherApiResponse {
  ok: boolean;
  launcher: {
    pinned: Array<{
      id: string;
      name: string;
      icon: string;
      gradient: string;
      category: string;
    }>;
    recent: Array<{
      flowId: string;
      name: string;
      status: 'success' | 'failed' | 'partial';
      completedAt: number;
      stepCount: number;
    }>;
    status: {
      slack?: {
        unread: number;
        channels: Array<{ id: string; name: string; unread: number }>;
      };
      spotify?: {
        playing: boolean;
        track?: string;
        artist?: string;
      };
    };
  };
}

const canvasModeMap: Record<string, string> = {
  messaging: 'messages',
  notes: 'notes',
  payments: 'payments',
  identity: 'identity',
  dao: 'governance',
  atlas: 'hub',
  gamedeck: 'gamedeck',
  tv: 'tv',
  news: 'news',
  reader: 'reader',
  gallery: 'gallery',
  library: 'library',
  one: 'one',
};

export default function LauncherMode() {
  const { wallet, setMode } = useAtlasStore();
  
  const { data, isLoading, error, refetch } = useQuery<LauncherApiResponse>({
    queryKey: ['/api/atlas/launcher'],
    enabled: !!wallet,
    refetchInterval: 30000,
  });

  const handleAppClick = (appId: string) => {
    const canvasMode = canvasModeMap[appId];
    if (canvasMode) {
      setMode(canvasMode as any);
    }
  };

  const handleFlowClick = (flowId: string) => {
    console.log('[LauncherMode] Flow clicked:', flowId);
  };

  if (!wallet) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full p-8"
        data-testid="launcher-mode-no-wallet"
      >
        <Rocket className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-slate-400 text-center max-w-md">
          Connect your wallet to access your personalized launcher with pinned apps and live status.
        </p>
      </MotionDiv>
    );
  }

  if (error) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full p-8"
        data-testid="launcher-mode-error"
      >
        <Rocket className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Failed to Load Launcher</h2>
        <p className="text-slate-400 text-center max-w-md mb-4">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <Button onClick={() => refetch()} variant="outline" data-testid="button-launcher-retry">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </MotionDiv>
    );
  }

  const launcherData = data?.launcher ? {
    pinned: data.launcher.pinned,
    recent: data.launcher.recent,
    status: data.launcher.status,
  } : null;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full overflow-y-auto"
      data-testid="launcher-mode"
    >
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Rocket className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">P3 Hub Launcher</h1>
            <p className="text-sm text-slate-400">Your apps, flows, and live status</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-launcher-refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <LauncherView
        data={launcherData}
        isLoading={isLoading}
        onAppClick={handleAppClick}
        onFlowClick={handleFlowClick}
      />
    </MotionDiv>
  );
}
