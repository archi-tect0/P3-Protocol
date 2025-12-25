import { cn } from '@/lib/utils';
import { Clock, Music, MessageSquare, ChevronRight, Loader2 } from 'lucide-react';

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

interface LauncherViewProps {
  data: LauncherData | null;
  isLoading?: boolean;
  onAppClick?: (appId: string) => void;
  onFlowClick?: (flowId: string) => void;
}

export function LauncherView({ data, isLoading, onAppClick, onFlowClick }: LauncherViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="launcher-loading">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-400">Loading launcher...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-slate-500" data-testid="launcher-empty">
        No launcher data available
      </div>
    );
  }

  return (
    <div className="launcher-canvas space-y-6 p-4" data-testid="launcher-view">
      <section data-testid="launcher-pinned-section">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📌</span> Pinned Apps
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {data.pinned.map((app) => (
            <button
              key={app.id}
              onClick={() => onAppClick?.(app.id)}
              className={cn(
                'flex flex-col items-center p-3 rounded-xl transition-all',
                'hover:scale-105 hover:shadow-lg active:scale-95',
                'bg-gradient-to-br', app.gradient
              )}
              data-testid={`launcher-app-${app.id}`}
            >
              <span className="text-2xl mb-1">{app.icon}</span>
              <span className="text-xs text-white font-medium truncate w-full text-center">
                {app.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section data-testid="launcher-recent-section">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Recent Flows
        </h2>
        {data.recent.length === 0 ? (
          <p className="text-slate-500 text-sm">No recent flows</p>
        ) : (
          <div className="space-y-2">
            {data.recent.map((flow) => (
              <button
                key={flow.flowId}
                onClick={() => onFlowClick?.(flow.flowId)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                data-testid={`launcher-flow-${flow.flowId}`}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    flow.status === 'success' && 'bg-green-500',
                    flow.status === 'failed' && 'bg-red-500',
                    flow.status === 'partial' && 'bg-yellow-500'
                  )} />
                  <span className="text-sm text-white">{flow.name}</span>
                  <span className="text-xs text-slate-500">{flow.stepCount} steps</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {formatTimeAgo(flow.completedAt)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section data-testid="launcher-status-section">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <span className="text-xl">📊</span> Live Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50" data-testid="launcher-status-slack">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-sm text-white">Slack</p>
              <p className="text-xs text-slate-400">
                {data.status.slack?.unread ?? 0} unread messages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50" data-testid="launcher-status-spotify">
            <Music className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-white">Spotify</p>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">
                {data.status.spotify?.playing 
                  ? `${data.status.spotify.track} - ${data.status.spotify.artist}`
                  : 'Not playing'
                }
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default LauncherView;
