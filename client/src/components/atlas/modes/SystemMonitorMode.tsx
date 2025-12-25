import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Activity, Database, Clock, RefreshCw, AlertCircle,
  Play, Square, CheckCircle, XCircle, Loader2, AlertTriangle,
  Cpu, HardDrive, Zap, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type TaskStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled';

interface SystemHealth {
  database: {
    status: 'healthy' | 'degraded' | 'down';
    latencyMs: number;
    connections: number;
    maxConnections: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  version: string;
}

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  metadata?: Record<string, any>;
}

interface HealthResponse {
  health: SystemHealth;
  receipt: { status: string };
}

interface TasksResponse {
  tasks: Task[];
  count: number;
  receipt: { status: string };
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: any; color: string; bgColor: string }> = {
  queued: { 
    label: 'Queued', 
    icon: Clock, 
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/20'
  },
  running: { 
    label: 'Running', 
    icon: Play, 
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/20'
  },
  done: { 
    label: 'Done', 
    icon: CheckCircle, 
    color: 'text-green-400',
    bgColor: 'bg-green-400/20'
  },
  error: { 
    label: 'Error', 
    icon: XCircle, 
    color: 'text-red-400',
    bgColor: 'bg-red-400/20'
  },
  cancelled: { 
    label: 'Cancelled', 
    icon: Ban, 
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/20'
  },
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function SystemMonitorMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | null>(null);

  const { data: healthData, isLoading: loadingHealth, error: healthError, refetch: refetchHealth } = useQuery<HealthResponse>({
    queryKey: ['/api/system/health'],
    refetchInterval: 30000,
  });

  const { data: tasksData, isLoading: loadingTasks, error: tasksError, refetch: refetchTasks } = useQuery<TasksResponse>({
    queryKey: ['/api/system/tasks', wallet],
    enabled: !!wallet,
    refetchInterval: 10000,
  });

  const cancelTask = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest(`/api/system/tasks/${taskId}/cancel`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/system/tasks'] });
      toast({ title: 'Task cancelled' });
      pushReceipt({
        id: `receipt-task-cancel-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.system.task.cancel',
        endpoint: '/api/system/tasks',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to cancel task', description: err.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (healthData?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-system-health-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.system',
        endpoint: '/api/system/health',
        timestamp: Date.now()
      });
    }
  }, [healthData]);

  const refetchAll = () => {
    refetchHealth();
    if (wallet) refetchTasks();
  };

  const isLoading = loadingHealth || loadingTasks;
  const hasError = healthError || tasksError;

  if (isLoading && !healthData && !tasksData) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="system-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (hasError && !healthData && !tasksData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="system-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load system status</p>
        <Button 
          variant="outline" 
          onClick={refetchAll}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-system-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const health = healthData?.health;
  const tasks = tasksData?.tasks || [];
  
  const filteredTasks = selectedStatus 
    ? tasks.filter(t => t.status === selectedStatus)
    : tasks;

  const runningCount = tasks.filter(t => t.status === 'running').length;
  const queuedCount = tasks.filter(t => t.status === 'queued').length;

  const groupedByStatus = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<TaskStatus, number>);

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="system-monitor-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-400/20 to-emerald-400/20">
            <Activity className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-system-title">
            System Monitor
          </h2>
          {runningCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-400/20 text-blue-400 flex items-center gap-1" data-testid="badge-running-count">
              <Loader2 className="w-3 h-3 animate-spin" />
              {runningCount} running
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={refetchAll}
          className="text-white/60 hover:text-white p-2"
          data-testid="button-system-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {health && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" data-testid="card-health-overview">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="card-database-health">
            <div className="flex items-center gap-2 mb-2">
              <Database className={`w-4 h-4 ${
                health.database.status === 'healthy' ? 'text-green-400' :
                health.database.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
              }`} />
              <span className="text-xs text-white/50">Database</span>
            </div>
            <div className="flex items-center gap-2">
              <span 
                className={`text-sm font-medium ${
                  health.database.status === 'healthy' ? 'text-green-400' :
                  health.database.status === 'degraded' ? 'text-amber-400' : 'text-red-400'
                }`}
                data-testid="text-database-status"
              >
                {health.database.status.charAt(0).toUpperCase() + health.database.status.slice(1)}
              </span>
            </div>
            <span className="text-xs text-white/40" data-testid="text-database-latency">
              {health.database.latencyMs}ms latency
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="card-memory-health">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-white/50">Memory</span>
            </div>
            <div className="text-sm font-medium text-white/80" data-testid="text-memory-usage">
              {health.memory.percentage.toFixed(1)}%
            </div>
            <span className="text-xs text-white/40" data-testid="text-memory-details">
              {formatBytes(health.memory.used)} / {formatBytes(health.memory.total)}
            </span>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  health.memory.percentage > 90 ? 'bg-red-400' :
                  health.memory.percentage > 70 ? 'bg-amber-400' : 'bg-green-400'
                }`}
                style={{ width: `${health.memory.percentage}%` }}
                data-testid="progress-memory"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="card-uptime">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-white/50">Uptime</span>
            </div>
            <div className="text-sm font-medium text-white/80" data-testid="text-uptime">
              {formatUptime(health.uptime)}
            </div>
            <span className="text-xs text-white/40" data-testid="text-version">
              v{health.version}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10" data-testid="card-connections">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-white/50">Connections</span>
            </div>
            <div className="text-sm font-medium text-white/80" data-testid="text-connections">
              {health.database.connections}
            </div>
            <span className="text-xs text-white/40" data-testid="text-connections-max">
              of {health.database.maxConnections} max
            </span>
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
          <HardDrive className="w-4 h-4" />
          Tasks
          {queuedCount > 0 && (
            <span className="text-xs text-white/40">({queuedCount} queued)</span>
          )}
        </h3>

        {!wallet ? (
          <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center" data-testid="tasks-no-wallet">
            <p className="text-white/50 text-sm">Connect wallet to view tasks</p>
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              <Button
                variant={selectedStatus === null ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedStatus(null)}
                className={selectedStatus === null ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/60'}
                data-testid="button-filter-all"
              >
                All ({tasks.length})
              </Button>
              {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                const count = groupedByStatus[status as TaskStatus] || 0;
                if (count === 0) return null;
                const Icon = config.icon;
                return (
                  <Button
                    key={status}
                    variant={selectedStatus === status ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedStatus(status as TaskStatus)}
                    className={selectedStatus === status 
                      ? `${config.bgColor} ${config.color}` 
                      : 'text-white/60 hover:text-white'}
                    data-testid={`button-filter-${status}`}
                  >
                    <Icon className="w-3 h-3 mr-1.5" />
                    {config.label} ({count})
                  </Button>
                );
              })}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="tasks-empty">
                <Activity className="w-12 h-12 text-white/20 mb-4" />
                <p className="text-white/60 mb-1">No tasks</p>
                <p className="text-white/40 text-sm">
                  {selectedStatus ? `No ${STATUS_CONFIG[selectedStatus].label.toLowerCase()} tasks` : 'All caught up!'}
                </p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="tasks-list">
                <AnimatePresence>
                  {filteredTasks.map((task, index) => {
                    const config = STATUS_CONFIG[task.status];
                    const Icon = config.icon;
                    const canCancel = task.status === 'queued' || task.status === 'running';
                    
                    return (
                      <MotionDiv
                        key={task.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, height: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                        data-testid={`task-item-${task.id}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                              {task.status === 'running' ? (
                                <Loader2 className={`w-4 h-4 ${config.color} animate-spin`} />
                              ) : (
                                <Icon className={`w-4 h-4 ${config.color}`} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-sm font-medium text-white/90" data-testid={`text-task-name-${task.id}`}>
                                  {task.name}
                                </span>
                                <span className={`px-1.5 py-0.5 text-[10px] rounded ${config.bgColor} ${config.color}`} data-testid={`badge-task-status-${task.id}`}>
                                  {config.label}
                                </span>
                              </div>
                              {task.status === 'running' && task.progress > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <MotionDiv
                                      className="h-full bg-blue-400 rounded-full"
                                      initial={{ width: 0 }}
                                      animate={{ width: `${task.progress}%` }}
                                      transition={{ duration: 0.3 }}
                                      data-testid={`progress-task-${task.id}`}
                                    />
                                  </div>
                                  <span className="text-xs text-white/50">{task.progress}%</span>
                                </div>
                              )}
                              {task.error && (
                                <p className="text-xs text-red-400 mt-1 flex items-center gap-1" data-testid={`text-task-error-${task.id}`}>
                                  <AlertTriangle className="w-3 h-3" />
                                  {task.error}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                                {task.startedAt && (
                                  <span data-testid={`text-task-started-${task.id}`}>
                                    Started: {formatTimeAgo(task.startedAt)}
                                  </span>
                                )}
                                {task.completedAt && (
                                  <span data-testid={`text-task-completed-${task.id}`}>
                                    Completed: {formatTimeAgo(task.completedAt)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelTask.mutate(task.id)}
                              disabled={cancelTask.isPending}
                              className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 hover:bg-red-400/20 p-1.5"
                              data-testid={`button-cancel-task-${task.id}`}
                            >
                              {cancelTask.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </MotionDiv>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </MotionDiv>
  );
}
