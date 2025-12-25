import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAdmin } from '@/context/AdminContext';
import { canvasBus, type Receipt as BusReceipt } from '@/lib/canvasBus';
import {
  HardDrive,
  Monitor,
  Heart,
  Play,
  RefreshCw,
  LogOut,
  Clock,
  Activity,
  Layers,
  ChevronRight,
  ExternalLink,
  User,
  Bot,
  Cog,
  Workflow,
  Radio,
  Server,
  Plus,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Zap,
  StopCircle,
} from 'lucide-react';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-y-auto ${className || ''}`}>
      {children}
    </div>
  );
}

interface TaskManagerStats {
  cpu: { user: number; system: number };
  memory: { heapUsed: number; heapTotal: number; rss: number };
  uptime: number;
  activeSessions: number;
  favoritesCount: number;
  receiptsCount: number;
}

interface Receipt {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  meta: Record<string, any>;
  sessionId?: string;
}

interface Favorite {
  id: string;
  targetId: string;
  targetType: string;
  section: string;
  position: number;
  displayName: string;
  displayIcon: string | null;
  target?: any;
}

interface Session {
  id: string;
  title: string;
  url: string;
  status: string;
  snapshotPath?: string;
  createdAt: string;
  updatedAt: string;
}

interface TaskManagerData {
  stats: TaskManagerStats;
  activeSessions: Session[];
  favorites: Favorite[];
  receipts: Receipt[];
}

interface OrchestrationFlow {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  walletScopeId: string;
  linkedArtifactIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface HealthStatus {
  endpoint: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
  error?: string;
}

interface TaskManagerCardProps {
  onSessionSelect?: (sessionId: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getActorIcon(actor: string) {
  if (actor === 'user') return <User className="w-3 h-3" />;
  if (actor.startsWith('agent:')) return <Bot className="w-3 h-3" />;
  return <Cog className="w-3 h-3" />;
}

function getActionColor(action: string): string {
  if (action.startsWith('web.')) return 'bg-blue-500/10 text-blue-500';
  if (action.startsWith('favorites.')) return 'bg-purple-500/10 text-purple-500';
  if (action.startsWith('taskmanager.')) return 'bg-orange-500/10 text-orange-500';
  if (action.startsWith('receipt.')) return 'bg-green-500/10 text-green-500';
  return 'bg-gray-500/10 text-gray-500';
}

function getFlowStatusColor(status: OrchestrationFlow['status']): string {
  switch (status) {
    case 'pending': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    case 'running': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
    case 'cancelled': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

function getFlowStatusIcon(status: OrchestrationFlow['status']) {
  switch (status) {
    case 'pending': return <Clock className="w-3 h-3" />;
    case 'running': return <Loader2 className="w-3 h-3 animate-spin" />;
    case 'completed': return <CheckCircle className="w-3 h-3" />;
    case 'failed': return <XCircle className="w-3 h-3" />;
    case 'cancelled': return <StopCircle className="w-3 h-3" />;
    default: return <AlertCircle className="w-3 h-3" />;
  }
}

export function TaskManagerCard({ onSessionSelect }: TaskManagerCardProps) {
  const { toast } = useToast();
  const { walletAddress } = useAdmin();
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [busReceipts, setBusReceipts] = useState<BusReceipt[]>([]);

  const sessionId = typeof window !== 'undefined' ? 
    sessionStorage.getItem('atlas_session_id') || `session_${Date.now()}` : 
    `session_${Date.now()}`;

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('atlas_session_id')) {
      sessionStorage.setItem('atlas_session_id', sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    setBusReceipts(canvasBus.getRecent(20));
    
    const unsubscribe = canvasBus.subscribe((event) => {
      setBusReceipts(prev => [event.receipt, ...prev].slice(0, 20));
    });
    
    return () => unsubscribe();
  }, []);

  const { data, isLoading, refetch } = useQuery<TaskManagerData>({
    queryKey: ['/api/taskmanager'],
    refetchInterval: 10000,
  });

  const scope = walletAddress ? {
    walletAddress,
    sessionId,
    profileId: undefined
  } : null;

  const { data: flowsData, isLoading: flowsLoading, refetch: refetchFlows } = useQuery<{ ok: boolean; flows: OrchestrationFlow[] }>({
    queryKey: ['/api/orchestration/flows/list', walletAddress],
    queryFn: async () => {
      if (!scope) return { ok: false, flows: [] };
      const res = await apiRequest('/api/orchestration/flows/list', {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
      return res as { ok: boolean; flows: OrchestrationFlow[] };
    },
    enabled: !!walletAddress,
    refetchInterval: 15000,
  });

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthStatus[]>({
    queryKey: ['/api/health/routes'],
    queryFn: async () => {
      const endpoints = [
        '/api/health',
        '/api/orchestration/adapters',
        '/api/taskmanager',
      ];
      
      const results: HealthStatus[] = [];
      
      for (const endpoint of endpoints) {
        const start = Date.now();
        try {
          const res = await fetch(endpoint, { method: 'GET' });
          const latency = Date.now() - start;
          results.push({
            endpoint,
            status: res.ok ? 'healthy' : 'unhealthy',
            latency,
            error: res.ok ? undefined : `Status ${res.status}`,
          });
        } catch (err) {
          results.push({
            endpoint,
            status: 'unhealthy',
            latency: Date.now() - start,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
      
      return results;
    },
    refetchInterval: 30000,
  });

  const replayMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      return apiRequest('/api/taskmanager/receipts/replay', {
        method: 'POST',
        body: JSON.stringify({ receiptId }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Receipt replayed', description: 'Action has been re-executed' });
      queryClient.invalidateQueries({ queryKey: ['/api/taskmanager'] });
    },
    onError: (err: any) => {
      toast({ title: 'Replay failed', description: err.message, variant: 'destructive' });
    },
  });

  const sessionOpMutation = useMutation({
    mutationFn: async ({ sessionId, op }: { sessionId: string; op: string }) => {
      return apiRequest('/api/taskmanager/sessions/op', {
        method: 'POST',
        body: JSON.stringify({ sessionId, op }),
      });
    },
    onSuccess: (_, variables) => {
      toast({ title: `Session ${variables.op}`, description: 'Operation completed' });
      queryClient.invalidateQueries({ queryKey: ['/api/taskmanager'] });
      queryClient.invalidateQueries({ queryKey: ['/api/web-browser/sessions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Operation failed', description: err.message, variant: 'destructive' });
    },
  });

  const createFlowMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!scope) throw new Error('Wallet not connected');
      return apiRequest('/api/orchestration/flows', {
        method: 'POST',
        body: JSON.stringify({ scope, name }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Flow created', description: 'New orchestration flow has been created' });
      setShowCreateFlowModal(false);
      setNewFlowName('');
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/flows/list'] });
    },
    onError: (err: any) => {
      toast({ title: 'Create flow failed', description: err.message, variant: 'destructive' });
    },
  });

  const executeFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      if (!scope) throw new Error('Wallet not connected');
      return apiRequest(`/api/orchestration/flows/${flowId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Flow executed', description: 'Orchestration flow has been executed' });
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/flows/list'] });
    },
    onError: (err: any) => {
      toast({ title: 'Execute flow failed', description: err.message, variant: 'destructive' });
    },
  });

  const cancelFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      if (!scope) throw new Error('Wallet not connected');
      return apiRequest(`/api/orchestration/flows/${flowId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Flow cancelled', description: 'Orchestration flow has been cancelled' });
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/flows/list'] });
    },
    onError: (err: any) => {
      toast({ title: 'Cancel flow failed', description: err.message, variant: 'destructive' });
    },
  });

  if (isLoading || !data) {
    return (
      <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="taskmanager-loading">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { stats, activeSessions, receipts } = data;
  const flows = flowsData?.flows || [];

  return (
    <>
      <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="taskmanager-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-lg font-semibold text-white">Task Manager</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                refetch();
                refetchFlows();
                refetchHealth();
              }}
              className="text-white/60 hover:text-white"
              data-testid="taskmanager-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3" data-testid="stat-sessions">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                <Monitor className="w-3 h-3" />
                <span>Sessions</span>
              </div>
              <div className="text-xl font-bold text-cyan-400">{stats.activeSessions}</div>
            </div>

            <div className="bg-white/5 rounded-lg p-3" data-testid="stat-favorites">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                <Heart className="w-3 h-3" />
                <span>Favorites</span>
              </div>
              <div className="text-xl font-bold text-purple-400">{stats.favoritesCount}</div>
            </div>

            <div className="bg-white/5 rounded-lg p-3" data-testid="stat-memory">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                <HardDrive className="w-3 h-3" />
                <span>Memory</span>
              </div>
              <div className="text-xl font-bold text-green-400">
                {formatBytes(stats.memory.heapUsed)}
              </div>
            </div>

            <div className="bg-white/5 rounded-lg p-3" data-testid="stat-uptime">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
                <Clock className="w-3 h-3" />
                <span>Uptime</span>
              </div>
              <div className="text-xl font-bold text-yellow-400">{formatUptime(stats.uptime)}</div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full bg-white/5 border border-white/10 grid grid-cols-6">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white/10">
                <Layers className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="orchestration" className="data-[state=active]:bg-white/10">
                <Workflow className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Flows</span>
              </TabsTrigger>
              <TabsTrigger value="stream" className="data-[state=active]:bg-white/10">
                <Radio className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Stream</span>
              </TabsTrigger>
              <TabsTrigger value="health" className="data-[state=active]:bg-white/10">
                <Server className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Health</span>
              </TabsTrigger>
              <TabsTrigger value="sessions" className="data-[state=active]:bg-white/10">
                <Monitor className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Sessions</span>
              </TabsTrigger>
              <TabsTrigger value="receipts" className="data-[state=active]:bg-white/10">
                <Activity className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Receipts</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              {flows.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/80 mb-2">Active Flows</h4>
                  <div className="space-y-2">
                    {flows.filter(f => f.status === 'running' || f.status === 'pending').slice(0, 3).map((flow) => (
                      <div
                        key={flow.id}
                        className="flex items-center justify-between bg-white/5 rounded-lg p-2"
                        data-testid={`flow-overview-${flow.id}`}
                      >
                        <div className="flex items-center gap-2">
                          {getFlowStatusIcon(flow.status)}
                          <span className="text-sm text-white truncate max-w-[200px]">{flow.name}</span>
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${getFlowStatusColor(flow.status)}`}>
                          {flow.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSessions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/80 mb-2">Active Sessions</h4>
                  <div className="space-y-2">
                    {activeSessions.slice(0, 3).map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between bg-white/5 rounded-lg p-2 cursor-pointer hover:bg-white/10 transition"
                        onClick={() => onSessionSelect?.(session.id)}
                        data-testid={`session-overview-${session.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-sm text-white truncate max-w-[200px]">{session.title}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/40" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {receipts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/80 mb-2">Recent Activity</h4>
                  <div className="space-y-1">
                    {receipts.slice(0, 5).map((receipt) => (
                      <div
                        key={receipt.id}
                        className="flex items-center gap-2 text-xs text-white/60"
                        data-testid={`receipt-overview-${receipt.id}`}
                      >
                        {getActorIcon(receipt.actor)}
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getActionColor(receipt.action)}`}>
                          {receipt.action}
                        </Badge>
                        <span className="text-white/40 ml-auto">
                          {new Date(receipt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="orchestration" className="mt-4" data-testid="orchestration-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/80">Orchestration Flows</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateFlowModal(true)}
                  disabled={!walletAddress}
                  className="h-7 px-2 text-xs"
                  data-testid="create-flow-button"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Flow
                </Button>
              </div>
              
              <ScrollArea className="h-[300px]">
                {!walletAddress ? (
                  <div className="text-center text-white/40 py-8" data-testid="no-wallet">
                    Connect wallet to manage flows
                  </div>
                ) : flowsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                  </div>
                ) : flows.length === 0 ? (
                  <div className="text-center text-white/40 py-8" data-testid="no-flows">
                    No orchestration flows
                  </div>
                ) : (
                  <div className="space-y-2">
                    {flows.map((flow) => (
                      <div
                        key={flow.id}
                        className="bg-white/5 rounded-lg p-3"
                        data-testid={`flow-item-${flow.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {getFlowStatusIcon(flow.status)}
                              <span className="text-sm font-medium text-white truncate">{flow.name}</span>
                            </div>
                            <p className="text-xs text-white/40 mt-1">
                              Updated {new Date(flow.updatedAt).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="outline" className={`text-[10px] ml-2 ${getFlowStatusColor(flow.status)}`}>
                            {flow.status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          {(flow.status === 'pending' || flow.status === 'failed') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => executeFlowMutation.mutate(flow.id)}
                              disabled={executeFlowMutation.isPending}
                              className="h-7 px-2 text-xs text-green-400 hover:text-green-300"
                              data-testid={`execute-flow-${flow.id}`}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Run
                            </Button>
                          )}
                          {(flow.status === 'pending' || flow.status === 'running') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => cancelFlowMutation.mutate(flow.id)}
                              disabled={cancelFlowMutation.isPending}
                              className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                              data-testid={`cancel-flow-${flow.id}`}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="stream" className="mt-4" data-testid="receipt-stream-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/80">Receipt Stream</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-white/40">Live</span>
                </div>
              </div>
              
              <ScrollArea className="h-[300px]">
                {busReceipts.length === 0 ? (
                  <div className="text-center text-white/40 py-8" data-testid="no-stream-receipts">
                    No receipts in stream
                  </div>
                ) : (
                  <div className="space-y-2">
                    {busReceipts.map((receipt, index) => (
                      <div
                        key={`${receipt.id}-${index}`}
                        className="bg-white/5 rounded-lg p-3"
                        data-testid={`stream-receipt-${receipt.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-400" />
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400">
                              {receipt.op}
                            </Badge>
                          </div>
                          <span className="text-xs text-white/40">
                            {new Date(receipt.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-white/60">
                          <span className="text-white/40">Artifact:</span> {receipt.artifactId.slice(0, 8)}...
                        </div>
                        {receipt.actor && (
                          <div className="text-xs text-white/40 mt-1">
                            <span>Actor:</span> {receipt.actor.walletAddress?.slice(0, 10)}...
                          </div>
                        )}
                        {receipt.error && (
                          <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded p-2">
                            {receipt.error.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="health" className="mt-4" data-testid="route-health-section">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-white/80">Route Health</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetchHealth()}
                  className="h-7 px-2 text-xs text-white/60 hover:text-white"
                  data-testid="refresh-health"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
              
              <ScrollArea className="h-[300px]">
                {healthLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                  </div>
                ) : !healthData || healthData.length === 0 ? (
                  <div className="text-center text-white/40 py-8" data-testid="no-health-data">
                    No health data available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {healthData.map((endpoint) => (
                      <div
                        key={endpoint.endpoint}
                        className="bg-white/5 rounded-lg p-3"
                        data-testid={`health-endpoint-${endpoint.endpoint.replace(/\//g, '-')}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {endpoint.status === 'healthy' ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : endpoint.status === 'unhealthy' ? (
                              <XCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-yellow-500" />
                            )}
                            <span className="text-sm text-white font-mono">{endpoint.endpoint}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {endpoint.latency && (
                              <span className="text-xs text-white/40">{endpoint.latency}ms</span>
                            )}
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] ${
                                endpoint.status === 'healthy' 
                                  ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}
                            >
                              {endpoint.status}
                            </Badge>
                          </div>
                        </div>
                        {endpoint.error && (
                          <p className="text-xs text-red-400 mt-2">{endpoint.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sessions" className="mt-4">
              <ScrollArea className="h-[300px]">
                {activeSessions.length === 0 ? (
                  <div className="text-center text-white/40 py-8" data-testid="no-sessions">
                    No active sessions
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="bg-white/5 rounded-lg p-3"
                        data-testid={`session-${session.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${session.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                              <span className="text-sm font-medium text-white truncate">{session.title}</span>
                            </div>
                            <p className="text-xs text-white/40 truncate mt-1">{session.url}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] ml-2">{session.status}</Badge>
                        </div>

                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sessionOpMutation.mutate({ sessionId: session.id, op: 'refresh' })}
                            disabled={sessionOpMutation.isPending}
                            className="h-7 px-2 text-xs"
                            data-testid={`session-refresh-${session.id}`}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Refresh
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSessionSelect?.(session.id)}
                            className="h-7 px-2 text-xs"
                            data-testid={`session-resume-${session.id}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Open
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sessionOpMutation.mutate({ sessionId: session.id, op: 'signout' })}
                            disabled={sessionOpMutation.isPending}
                            className="h-7 px-2 text-xs text-red-400 hover:text-red-300"
                            data-testid={`session-signout-${session.id}`}
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Sign out
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="receipts" className="mt-4">
              <ScrollArea className="h-[300px]">
                {receipts.length === 0 ? (
                  <div className="text-center text-white/40 py-8" data-testid="no-receipts">
                    No recent activity
                  </div>
                ) : (
                  <div className="space-y-2">
                    {receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="bg-white/5 rounded-lg p-3"
                        data-testid={`receipt-${receipt.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {getActorIcon(receipt.actor)}
                            <Badge variant="outline" className={`text-xs ${getActionColor(receipt.action)}`}>
                              {receipt.action}
                            </Badge>
                          </div>
                          <span className="text-xs text-white/40">
                            {new Date(receipt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {receipt.meta && Object.keys(receipt.meta).length > 0 && (
                          <div className="mt-2 text-xs text-white/40 font-mono bg-black/20 rounded p-2 overflow-x-auto">
                            {JSON.stringify(receipt.meta, null, 2).slice(0, 200)}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => replayMutation.mutate(receipt.id)}
                          disabled={replayMutation.isPending}
                          className="mt-2 h-6 px-2 text-xs"
                          data-testid={`replay-${receipt.id}`}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Replay
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showCreateFlowModal} onOpenChange={setShowCreateFlowModal}>
        <DialogContent className="bg-slate-900 border-white/10" data-testid="create-flow-modal">
          <DialogHeader>
            <DialogTitle className="text-white">Create Orchestration Flow</DialogTitle>
            <DialogDescription className="text-white/60">
              Create a new flow to orchestrate operations across artifacts.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="flow-name" className="text-white/80">Flow Name</Label>
              <Input
                id="flow-name"
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                placeholder="Enter flow name..."
                className="bg-white/5 border-white/10 text-white"
                data-testid="flow-name-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateFlowModal(false);
                setNewFlowName('');
              }}
              className="border-white/10 text-white/60 hover:text-white"
              data-testid="cancel-create-flow"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createFlowMutation.mutate(newFlowName)}
              disabled={!newFlowName.trim() || createFlowMutation.isPending}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
              data-testid="submit-create-flow"
            >
              {createFlowMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Flow
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TaskManagerCard;
