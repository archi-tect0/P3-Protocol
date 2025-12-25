import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import {
  Globe, Plus, ExternalLink, RefreshCw, Camera, FileText, LogOut,
  Loader2, AlertCircle, Trash2, Clock, ChevronRight, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type SessionStatus = 'active' | 'signedOut' | 'error';

interface WebSession {
  id: string;
  title: string | null;
  url: string;
  status: SessionStatus;
  tabIndex: number;
  snapshotPath: string | null;
  metaJson: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface SessionReceipt {
  id: string;
  action: string;
  timestamp: string;
}

interface SessionsResponse {
  sessions: WebSession[];
}

interface SiteProfile {
  id: string;
  domain: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  defaultActions: string[];
  selectorsJson: Record<string, string> | null;
  safe: boolean;
}

interface SessionDetailResponse {
  session: WebSession;
  profile: SiteProfile | null;
  receipts: SessionReceipt[];
}

interface WebCard {
  type: string;
  sessionId: string;
  title: string;
  url: string;
  status: SessionStatus;
  profile: {
    name: string;
    iconUrl: string | null;
    description: string | null;
    selectors: Record<string, string> | null;
  } | null;
  preview: { kind: string; value: string } | null;
  actions: Array<{ type: string; target?: string }>;
  receipts: SessionReceipt[];
}

const STATUS_COLORS: Record<SessionStatus, string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  signedOut: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  error: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  active: 'Active',
  signedOut: 'Signed Out',
  error: 'Error',
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export default function WebBrowserMode() {
  const wallet = useAtlasStore((s) => s.wallet);
  const pushReceipt = useAtlasStore((s) => s.pushReceipt);
  const { toast } = useToast();

  const [showNewSession, setShowNewSession] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedSession, setSelectedSession] = useState<WebSession | null>(null);

  const sessionsQuery = useQuery<SessionsResponse>({
    queryKey: ['/api/web-browser'],
    enabled: !!wallet,
  });

  const sessionDetailQuery = useQuery<SessionDetailResponse>({
    queryKey: [`/api/web-browser/${selectedSession?.id}`],
    enabled: !!wallet && !!selectedSession,
  });

  const previewQuery = useQuery<{ card: WebCard }>({
    queryKey: [`/api/web-browser/${selectedSession?.id}/preview`],
    enabled: !!wallet && !!selectedSession && selectedSession.status === 'active',
    refetchInterval: 10000,
  });

  const openSessionMutation = useMutation({
    mutationFn: async (url: string) => {
      const result = await apiRequest('/api/web-browser/open', {
        method: 'POST',
        body: JSON.stringify({ url, mode: 'preview' }),
      });
      return { ...result, requestedUrl: url };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/web-browser'] });
      if (data.session) {
        pushReceipt({
          id: data.session.id,
          hash: `0x${Date.now().toString(16)}`,
          scope: 'web-browser',
          endpoint: 'web.open',
          timestamp: Date.now(),
        });
        setSelectedSession(data.session);
      }
      setShowNewSession(false);
      setNewUrl('');
      toast({ title: 'Session saved', description: `${extractDomain(data.requestedUrl)} added to sessions` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
  
  const handleOpenUrl = (urlInput: string) => {
    const input = urlInput.trim();
    if (!input) return;
    
    let url: string;
    if (input.startsWith('http://') || input.startsWith('https://')) {
      url = input;
    } else if (input.includes('.') && !input.includes(' ')) {
      url = `https://${input}`;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
    
    window.open(url, '_blank');
    openSessionMutation.mutate(url);
  };

  const opMutation = useMutation({
    mutationFn: async (params: { sessionId: string; op: string; url?: string; capture?: { type: string } }) => {
      return apiRequest('/api/web-browser/ops', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      if (selectedSession) {
        queryClient.invalidateQueries({ queryKey: [`/api/web-browser/${selectedSession.id}`] });
        queryClient.invalidateQueries({ queryKey: [`/api/web-browser/${selectedSession.id}/preview`] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/web-browser'] });
    },
    onError: (err: any) => {
      toast({ title: 'Operation failed', description: err.message, variant: 'destructive' });
    },
  });

  const signoutMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest('/api/web-browser/signout', {
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/web-browser'] });
      if (selectedSession) {
        queryClient.invalidateQueries({ queryKey: [`/api/web-browser/${selectedSession.id}`] });
      }
      setSelectedSession(null);
      toast({ title: 'Signed out', description: 'Session signed out successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest(`/api/web-browser/${sessionId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/web-browser'] });
      setSelectedSession(null);
      toast({ title: 'Deleted', description: 'Session deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="webbrowser-no-wallet">
        <Globe className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-400">Connect your wallet to use Web Browser</p>
      </div>
    );
  }

  const sessions = sessionsQuery.data?.sessions || [];
  const card = previewQuery.data?.card;
  const receipts = sessionDetailQuery.data?.receipts || [];

  return (
    <div className="space-y-4" data-testid="webbrowser-mode">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Web Browser</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowNewSession(true)}
          data-testid="button-new-session"
        >
          <Plus className="w-4 h-4 mr-1" />
          Open Site
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {showNewSession && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
          >
            <Globe className="w-5 h-5 text-blue-400" />
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Enter URL or search query..."
              className="flex-1 bg-gray-700/50"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newUrl.trim()) {
                  handleOpenUrl(newUrl);
                }
              }}
              data-testid="input-new-url"
            />
            <Button
              size="sm"
              onClick={() => handleOpenUrl(newUrl)}
              disabled={!newUrl.trim() || openSessionMutation.isPending}
              data-testid="button-open-url"
            >
              {openSessionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowNewSession(false); setNewUrl(''); }}>
              Cancel
            </Button>
          </MotionDiv>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400">Sessions ({sessions.length})</h3>
          {sessionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : sessionsQuery.isError ? (
            <div className="flex items-center justify-center py-8 text-red-400">
              <AlertCircle className="w-5 h-5 mr-2" />
              Failed to load sessions
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400" data-testid="webbrowser-empty">
              <Globe className="w-12 h-12 mb-2 opacity-50" />
              <p>No sessions yet</p>
              <p className="text-sm">Open a website to get started</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sessions.map((session) => (
                <MotionDiv
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSession?.id === session.id
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50'
                  }`}
                  onClick={() => setSelectedSession(session)}
                  data-testid={`session-${session.id}`}
                >
                  <Globe className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white truncate">
                      {session.title || extractDomain(session.url)}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{session.url}</div>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[session.status]}`}>
                    {STATUS_LABELS[session.status]}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </MotionDiv>
              ))}
            </div>
          )}
        </div>

        {selectedSession && (
          <MotionDiv
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {card?.profile?.iconUrl ? (
                  <img 
                    src={card.profile.iconUrl} 
                    alt={card.profile.name} 
                    className="w-6 h-6 rounded flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Globe className="w-6 h-6 text-blue-400 flex-shrink-0" />
                )}
                <h3 className="font-semibold text-white truncate">
                  {card?.profile?.name || selectedSession.title || extractDomain(selectedSession.url)}
                </h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {card?.profile?.description && (
              <div className="text-sm text-gray-300">{card.profile.description}</div>
            )}

            <div className="text-sm text-gray-400 truncate">{selectedSession.url}</div>

            <div className={`inline-flex px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[selectedSession.status]}`}>
              {STATUS_LABELS[selectedSession.status]}
            </div>

            {card?.preview && (
              <div className="rounded-lg overflow-hidden border border-gray-600 bg-gray-900">
                {card.preview.kind === 'image' && (
                  <img src={card.preview.value} alt="Preview" className="w-full h-48 object-cover object-top" />
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => opMutation.mutate({ sessionId: selectedSession.id, op: 'refresh' })}
                disabled={selectedSession.status !== 'active' || opMutation.isPending}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => opMutation.mutate({ sessionId: selectedSession.id, op: 'capture', capture: { type: 'screenshot' } })}
                disabled={selectedSession.status !== 'active' || opMutation.isPending}
                data-testid="button-screenshot"
              >
                <Camera className="w-4 h-4 mr-1" />
                Screenshot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => opMutation.mutate({ sessionId: selectedSession.id, op: 'capture', capture: { type: 'pdf' } })}
                disabled={selectedSession.status !== 'active' || opMutation.isPending}
                data-testid="button-pdf"
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(selectedSession.url, '_blank')}
                data-testid="button-open-external"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                Open
              </Button>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-700">
              {selectedSession.status === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => signoutMutation.mutate(selectedSession.id)}
                  disabled={signoutMutation.isPending}
                  className="text-amber-400 hover:text-amber-300"
                  data-testid="button-signout"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Sign Out
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteMutation.mutate(selectedSession.id)}
                disabled={deleteMutation.isPending}
                className="text-red-400 hover:text-red-300"
                data-testid="button-delete-session"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>

            {receipts.length > 0 && (
              <div className="pt-2 border-t border-gray-700">
                <h4 className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Recent Activity
                </h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {receipts.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{r.action}</span>
                      <span className="text-gray-500">{formatTimeAgo(r.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </MotionDiv>
        )}
      </div>
    </div>
  );
}
