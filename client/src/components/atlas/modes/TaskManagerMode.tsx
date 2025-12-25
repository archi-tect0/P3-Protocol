import { MotionDiv } from '@/lib/motion';
import { useAtlasStore, type RunningApp, type RunningAppState } from '@/state/useAtlasStore';
import { TaskManagerCard } from '@/components/atlas/cards/TaskManagerCard';
import { 
  X, Focus, Tv, Radio, BookOpen, Globe, Gamepad2, 
  FileText, Calculator, Camera, MessageSquare, Play,
  Pause, Layers, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const MODE_ICONS: Record<string, typeof Tv> = {
  tv: Tv,
  radio: Radio,
  reader: BookOpen,
  webBrowser: Globe,
  gamedeck: Gamepad2,
  writer: FileText,
  calc: Calculator,
  camera: Camera,
  messages: MessageSquare,
};

function getIconComponent(iconName: string) {
  const IconMap: Record<string, typeof Tv> = {
    Tv, Radio, BookOpen, Globe, Gamepad2, FileText, Calculator, Camera, MessageSquare,
  };
  return IconMap[iconName] || Layers;
}

function getStateColor(state: RunningAppState): string {
  switch (state) {
    case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'playing': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'paused': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'background': return 'bg-white/10 text-white/60 border-white/20';
    default: return 'bg-white/10 text-white/60 border-white/20';
  }
}

function getStateIcon(state: RunningAppState) {
  switch (state) {
    case 'playing': return <Play className="w-3 h-3" />;
    case 'paused': return <Pause className="w-3 h-3" />;
    case 'active': return <Loader2 className="w-3 h-3 animate-spin" />;
    default: return null;
  }
}

function formatDuration(startedAt: number): string {
  const diff = Date.now() - startedAt;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function RunningAppTile({ app, onFocus, onClose }: { 
  app: RunningApp; 
  onFocus: () => void; 
  onClose: () => void;
}) {
  const IconComponent = MODE_ICONS[app.mode] || getIconComponent(app.icon);
  const isActive = app.state === 'active' || app.state === 'playing';
  
  return (
    <MotionDiv
      className={`relative bg-white/5 backdrop-blur-sm rounded-xl p-4 border ${
        isActive ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10'
      } hover:bg-white/10 transition-all group`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      data-testid={`running-app-tile-${app.id}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          isActive ? 'bg-cyan-500/20' : 'bg-white/10'
        }`}>
          <IconComponent className={`w-6 h-6 ${isActive ? 'text-cyan-400' : 'text-white/60'}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate">{app.name}</h3>
          {app.metadata?.subtitle && (
            <p className="text-xs text-white/50 truncate mt-0.5">{app.metadata.subtitle}</p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={`text-[10px] ${getStateColor(app.state)}`}>
              {getStateIcon(app.state)}
              <span className="ml-1">{app.state}</span>
            </Badge>
            <span className="text-[10px] text-white/40">{formatDuration(app.startedAt)}</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-cyan-500/20"
            onClick={onFocus}
            data-testid={`button-focus-app-${app.id}`}
          >
            <Focus className="w-3.5 h-3.5 text-cyan-400" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-red-500/20"
            onClick={onClose}
            data-testid={`button-close-app-${app.id}`}
          >
            <X className="w-3.5 h-3.5 text-red-400" />
          </Button>
        </div>
      </div>
      
      {app.metadata?.progress !== undefined && (
        <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
            style={{ width: `${app.metadata.progress}%` }}
          />
        </div>
      )}
    </MotionDiv>
  );
}

export default function TaskManagerMode() {
  const { runningApps, focusApp, removeRunningApp, setMode } = useAtlasStore();
  
  const handleFocusApp = (app: RunningApp) => {
    focusApp(app.id);
  };
  
  const handleCloseApp = (app: RunningApp) => {
    removeRunningApp(app.id);
  };
  
  const handleSessionSelect = (_sessionId: string) => {
    setMode('webBrowser');
  };
  
  const activeApps = runningApps.filter(a => a.state === 'active' || a.state === 'playing');
  const backgroundApps = runningApps.filter(a => a.state === 'background' || a.state === 'paused');
  
  return (
    <MotionDiv
      className="flex flex-col gap-6 p-4 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="taskmanager-mode"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Manager</h1>
          <p className="text-white/60 text-sm mt-1">
            {runningApps.length} app{runningApps.length !== 1 ? 's' : ''} running
          </p>
        </div>
      </div>
      
      {runningApps.length > 0 && (
        <div className="space-y-4">
          {activeApps.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Active Apps
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeApps.map((app) => (
                  <RunningAppTile
                    key={app.id}
                    app={app}
                    onFocus={() => handleFocusApp(app)}
                    onClose={() => handleCloseApp(app)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {backgroundApps.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-white/60 mb-3">Background Apps</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {backgroundApps.map((app) => (
                  <RunningAppTile
                    key={app.id}
                    app={app}
                    onFocus={() => handleFocusApp(app)}
                    onClose={() => handleCloseApp(app)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {runningApps.length === 0 && (
        <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10">
          <Layers className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white/60 mb-2">No Running Apps</h3>
          <p className="text-sm text-white/40">
            Open TV, Radio, Reader, or other apps to see them here
          </p>
        </div>
      )}
      
      <TaskManagerCard onSessionSelect={handleSessionSelect} />
    </MotionDiv>
  );
}
