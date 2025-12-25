import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Phone, Video, PhoneOff, PhoneIncoming, PhoneOutgoing, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ActiveCall {
  callId: string;
  type: 'voice' | 'video';
  initiator: string;
  targetWallet: string;
  status: 'pending' | 'ringing' | 'connected' | 'ended';
  createdAt: number;
  connectedAt?: number;
}

interface CallDisplay {
  id: string;
  type: 'voice' | 'video';
  peer: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  duration: string;
  timestamp: string;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return new Date(timestamp).toLocaleDateString();
}

function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  const mins = Math.floor(duration / 60000);
  const secs = Math.floor((duration % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function CallsMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const [callTarget, setCallTarget] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ ok: boolean; calls: ActiveCall[] }>({
    queryKey: ['/api/nexus/calls/active', wallet],
    enabled: !!wallet,
    refetchInterval: 5000,
  });

  const startCallMutation = useMutation({
    mutationFn: async ({ type, targetWallet }: { type: 'voice' | 'video'; targetWallet: string }) => {
      return apiRequest('/api/nexus/calls/start', {
        method: 'POST',
        body: JSON.stringify({ type, targetWallet })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/calls/active'] });
      setCallTarget('');
    }
  });

  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      return apiRequest('/api/nexus/calls/end', {
        method: 'POST',
        body: JSON.stringify({ callId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/calls/active'] });
    }
  });

  useEffect(() => {
    if (data?.ok) {
      pushReceipt({
        id: `receipt-calls-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: data.calls?.length ? 'atlas.render.calls' : 'atlas.render.calls.empty',
        endpoint: '/api/nexus/calls/active',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-calls-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.calls.error',
        endpoint: '/api/nexus/calls/active',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const calls: CallDisplay[] = (data?.calls || []).map(call => ({
    id: call.callId,
    type: call.type,
    peer: truncateAddress(call.initiator === wallet?.toLowerCase() ? call.targetWallet : call.initiator),
    direction: call.initiator === wallet?.toLowerCase() ? 'outgoing' : 'incoming',
    status: call.status,
    duration: call.connectedAt ? formatDuration(call.connectedAt) : '--:--',
    timestamp: formatTimeAgo(call.createdAt)
  }));

  const activeCalls = calls.filter(c => c.status !== 'ended');

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="calls-no-wallet">
        <Phone className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to make calls</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="calls-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="calls-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load calls</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-calls-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="calls-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80" data-testid="text-calls-title">Calls</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => refetch()}
          className="text-white/60 hover:text-white p-2"
          data-testid="button-calls-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10" data-testid="calls-new-call-panel">
        <div className="text-sm text-white/60 mb-3">Start a new call</div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter wallet address..."
            value={callTarget}
            onChange={(e) => setCallTarget(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 
                       text-white/90 text-sm placeholder:text-white/30
                       focus:outline-none focus:border-cyan-400/50"
            data-testid="input-call-target"
          />
          <MotionButton
            onClick={() => startCallMutation.mutate({ type: 'voice', targetWallet: callTarget })}
            disabled={!callTarget || startCallMutation.isPending}
            className="p-2 rounded-lg bg-green-400/20 border border-green-400/30 text-green-400
                       hover:bg-green-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-voice-call"
          >
            <Phone className="w-5 h-5" />
          </MotionButton>
          <MotionButton
            onClick={() => startCallMutation.mutate({ type: 'video', targetWallet: callTarget })}
            disabled={!callTarget || startCallMutation.isPending}
            className="p-2 rounded-lg bg-cyan-400/20 border border-cyan-400/30 text-cyan-400
                       hover:bg-cyan-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-video-call"
          >
            <Video className="w-5 h-5" />
          </MotionButton>
        </div>
      </div>

      {activeCalls.length > 0 && (
        <div className="mb-6" data-testid="calls-active-section">
          <div className="text-sm text-white/50 mb-3">Active Calls</div>
          <div className="space-y-2">
            {activeCalls.map(call => (
              <MotionDiv
                key={call.id}
                className="p-4 rounded-xl bg-green-400/10 border border-green-400/30"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                data-testid={`call-active-${call.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-400/20 flex items-center justify-center animate-pulse">
                      {call.type === 'video' ? (
                        <Video className="w-5 h-5 text-green-400" />
                      ) : (
                        <Phone className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-mono text-white/90" data-testid={`text-call-peer-${call.id}`}>{call.peer}</div>
                      <div className="text-xs text-green-400" data-testid={`text-call-status-${call.id}`}>{call.status} • {call.duration}</div>
                    </div>
                  </div>
                  <Button
                    onClick={() => endCallMutation.mutate(call.id)}
                    disabled={endCallMutation.isPending}
                    variant="ghost"
                    size="sm"
                    className="bg-red-400/20 text-red-400 hover:bg-red-400/30"
                    data-testid={`button-end-call-${call.id}`}
                  >
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                </div>
              </MotionDiv>
            ))}
          </div>
        </div>
      )}

      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="calls-empty">
          <Users className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No recent calls</p>
          <p className="text-white/40 text-sm">Enter a wallet address above to start a call</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="calls-history">
          <div className="text-sm text-white/50 mb-3">Recent Calls</div>
          {calls.filter(c => c.status === 'ended').map((call, index) => (
            <MotionDiv
              key={call.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              data-testid={`call-history-${call.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center
                    ${call.direction === 'incoming' ? 'bg-blue-400/20' : 'bg-purple-400/20'}`}>
                    {call.direction === 'incoming' ? (
                      <PhoneIncoming className="w-5 h-5 text-blue-400" />
                    ) : (
                      <PhoneOutgoing className="w-5 h-5 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-white/90" data-testid={`text-call-history-peer-${call.id}`}>{call.peer}</span>
                      {call.type === 'video' && <Video className="w-3 h-3 text-white/40" />}
                    </div>
                    <div className="text-xs text-white/50">
                      {call.direction === 'incoming' ? 'Incoming' : 'Outgoing'} • {call.duration}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-white/40" data-testid={`text-call-history-time-${call.id}`}>{call.timestamp}</div>
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
