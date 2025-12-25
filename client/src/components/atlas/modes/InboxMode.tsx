import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Bell, Check, Trash2, RefreshCw, AlertCircle, Inbox, MessageSquare, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface InboxItem {
  id: string;
  type: string;
  title: string;
  body: string;
  status: 'unread' | 'read';
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
  metadata?: Record<string, any>;
}

interface InboxDisplay {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  priority: string;
  timestamp: string;
  icon: any;
}

function formatTimeAgo(dateStr: string | number): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function getIconForType(type: string) {
  switch (type) {
    case 'message': return MessageSquare;
    case 'payment': return CreditCard;
    case 'note': return FileText;
    default: return Bell;
  }
}

export default function InboxMode() {
  const { pushReceipt, wallet } = useAtlasStore();

  const { data, isLoading, error, refetch } = useQuery<{ ok: boolean; items: InboxItem[]; unreadCount: number }>({
    queryKey: ['/api/nexus/inbox', wallet],
    enabled: !!wallet,
  });

  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest('/api/nexus/inbox/mark', {
        method: 'POST',
        body: JSON.stringify({ ids })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/inbox'] });
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/nexus/inbox/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/inbox'] });
    }
  });

  useEffect(() => {
    if (data?.ok) {
      pushReceipt({
        id: `receipt-inbox-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: data.items?.length ? 'atlas.render.inbox' : 'atlas.render.inbox.empty',
        endpoint: '/api/nexus/inbox',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-inbox-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.inbox.error',
        endpoint: '/api/nexus/inbox',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const items: InboxDisplay[] = (data?.items || []).map(item => ({
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    read: item.status === 'read',
    priority: item.priority,
    timestamp: formatTimeAgo(item.createdAt),
    icon: getIconForType(item.type)
  }));

  const unreadCount = items.filter(i => !i.read).length;

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="inbox-no-wallet">
        <Inbox className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view inbox</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="inbox-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="inbox-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load inbox</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-inbox-retry"
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
      data-testid="inbox-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white/80" data-testid="text-inbox-title">Inbox</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-400/20 text-cyan-400" data-testid="text-inbox-unread">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                const unreadIds = items.filter(i => !i.read).map(i => i.id);
                markReadMutation.mutate(unreadIds);
              }}
              disabled={markReadMutation.isPending}
              className="text-white/60 hover:text-white text-xs"
              data-testid="button-mark-all-read"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-inbox-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="inbox-empty">
          <Inbox className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">Your inbox is empty</p>
          <p className="text-white/40 text-sm">Notifications will appear here</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="inbox-list">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <MotionDiv
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 rounded-xl border transition-all cursor-pointer group
                  ${item.read 
                    ? 'bg-white/3 border-white/5 hover:border-white/15' 
                    : 'bg-white/8 border-cyan-400/20 hover:border-cyan-400/40'
                  }`}
                data-testid={`inbox-item-${item.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${item.read ? 'bg-white/10' : 'bg-cyan-400/20'}`}>
                      <Icon className={`w-4 h-4 ${item.read ? 'text-white/40' : 'text-cyan-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${item.read ? 'text-white/60' : 'text-white/90'}`} data-testid={`text-inbox-title-${item.id}`}>
                          {item.title}
                        </span>
                        {item.priority === 'high' && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-red-400/20 text-red-400">High</span>
                        )}
                      </div>
                      <p className={`text-sm line-clamp-2 ${item.read ? 'text-white/40' : 'text-white/60'}`} data-testid={`text-inbox-body-${item.id}`}>
                        {item.body}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40 whitespace-nowrap" data-testid={`text-inbox-time-${item.id}`}>{item.timestamp}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!item.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markReadMutation.mutate([item.id]);
                          }}
                          className="p-1 hover:bg-white/10 rounded"
                          data-testid={`button-mark-read-${item.id}`}
                        >
                          <Check className="w-3 h-3 text-white/40" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItemMutation.mutate(item.id);
                        }}
                        className="p-1 hover:bg-red-400/20 rounded"
                        data-testid={`button-delete-inbox-${item.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </MotionDiv>
            );
          })}
        </div>
      )}
    </MotionDiv>
  );
}
