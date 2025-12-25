import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAtlasStore } from '@/state/useAtlasStore';
import { MotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, GitBranch, Play, Square, RefreshCw } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-auto ${className || ''}`}>{children}</div>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  running: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-green-500/20 text-green-300 border-green-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  cancelled: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

export default function OrchestrationMode() {
  const { wallet } = useAtlasStore();
  const { toast } = useToast();
  const [newFlowName, setNewFlowName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const sessionId = typeof window !== 'undefined' 
    ? sessionStorage.getItem('atlas_session_id') || `session-${Date.now()}`
    : `session-${Date.now()}`;

  const { data: flowsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/orchestration/flows', wallet],
    queryFn: async () => {
      if (!wallet) return { flows: [] };
      const res = await fetch('/api/orchestration/flows/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet,
          sessionId
        })
      });
      return res.json();
    },
    enabled: !!wallet
  });

  const { data: adaptersData } = useQuery<{ ok: boolean; adapters: any[] }>({
    queryKey: ['/api/orchestration/adapters'],
  });

  const createFlowMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest('/api/orchestration/flows', {
        method: 'POST',
        body: JSON.stringify({
          walletAddress: wallet,
          sessionId,
          name: name || 'Untitled Flow'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/flows'] });
      setNewFlowName('');
      setShowCreateForm(false);
      toast({ title: 'Flow created', description: 'Your new orchestration flow is ready.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create flow', variant: 'destructive' });
    }
  });

  const executeFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest(`/api/orchestration/flows/${flowId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ walletAddress: wallet, sessionId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/flows'] });
      toast({ title: 'Flow executing', description: 'The orchestration flow is now running.' });
    }
  });

  const cancelFlowMutation = useMutation({
    mutationFn: async (flowId: string) => {
      return apiRequest(`/api/orchestration/flows/${flowId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ walletAddress: wallet, sessionId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orchestration/flows'] });
      toast({ title: 'Flow cancelled', description: 'The orchestration flow has been cancelled.' });
    }
  });

  if (!wallet) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-white/60"
        data-testid="orchestration-mode-no-wallet"
      >
        <GitBranch className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">Connect your wallet to use Orchestration Flows</p>
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
      data-testid="orchestration-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitBranch className="w-6 h-6" />
          Orchestration Flows
        </h2>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="orchestration-refresh-button"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button 
            onClick={() => setShowCreateForm(!showCreateForm)}
            data-testid="orchestration-new-flow-button"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Flow
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <div className="flex gap-2 mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
          <Input
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            placeholder="Flow name..."
            className="flex-1 bg-white/10 border-white/20"
            data-testid="orchestration-new-flow-input"
          />
          <Button 
            onClick={() => createFlowMutation.mutate(newFlowName)}
            disabled={createFlowMutation.isPending}
            data-testid="orchestration-create-flow-button"
          >
            Create
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-white/80 mb-3">Your Flows</h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-white/5 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : flowsData?.flows?.length > 0 ? (
              <div className="space-y-3">
                {flowsData.flows.map((flow: any) => (
                  <div
                    key={flow.id}
                    className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                    data-testid={`orchestration-flow-item-${flow.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">{flow.name}</h4>
                        <p className="text-sm text-white/50 mt-1">
                          Created {new Date(flow.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[flow.status] || statusColors.pending}>
                          {flow.status}
                        </Badge>
                        {(flow.status === 'pending' || flow.status === 'failed') && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => executeFlowMutation.mutate(flow.id)}
                            disabled={executeFlowMutation.isPending}
                            data-testid={`orchestration-execute-flow-${flow.id}`}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        {(flow.status === 'pending' || flow.status === 'running') && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => cancelFlowMutation.mutate(flow.id)}
                            disabled={cancelFlowMutation.isPending}
                            data-testid={`orchestration-cancel-flow-${flow.id}`}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-white/40">
                <GitBranch className="w-10 h-10 mb-3 opacity-40" />
                <p>No flows yet</p>
                <p className="text-sm mt-1">Create your first orchestration flow</p>
              </div>
            )}
          </ScrollArea>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white/80 mb-3">Available Adapters</h3>
          <ScrollArea className="h-[calc(100%-2rem)]">
            {(adaptersData?.adapters?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {adaptersData?.adapters?.map((adapter: any) => (
                  <div
                    key={adapter.id}
                    className="p-3 bg-white/5 rounded-lg border border-white/10"
                    data-testid={`orchestration-adapter-${adapter.adapterId}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white">{adapter.name}</span>
                      <Badge variant="outline" className="text-xs">
                        v{adapter.version}
                      </Badge>
                    </div>
                    {adapter.description && (
                      <p className="text-xs text-white/50 mt-1">{adapter.description}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-white/40">
                <p className="text-sm">No adapters registered</p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </MotionDiv>
  );
}
