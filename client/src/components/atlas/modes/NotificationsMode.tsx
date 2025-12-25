import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Bell, BellRing, Check, Trash2, RefreshCw, AlertCircle, 
  Filter, Bot, CreditCard, Shield, AppWindow, Settings,
  CheckCheck, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type NotificationType = 'system' | 'ai' | 'payment' | 'security' | 'app';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  iconUrl: string | null;
  source: string;
  readAt: string | null;
  createdAt: string;
  meta?: Record<string, any>;
}

interface NotificationsResponse {
  notifications: Notification[];
  count: number;
  receipt: { status: string };
}

const TYPE_CONFIG: Record<NotificationType, { label: string; icon: any; color: string; bgColor: string }> = {
  system: { 
    label: 'System', 
    icon: Settings, 
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/20'
  },
  ai: { 
    label: 'AI', 
    icon: Bot, 
    color: 'text-green-400',
    bgColor: 'bg-green-400/20'
  },
  payment: { 
    label: 'Payment', 
    icon: CreditCard, 
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/20'
  },
  security: { 
    label: 'Security', 
    icon: Shield, 
    color: 'text-red-400',
    bgColor: 'bg-red-400/20'
  },
  app: { 
    label: 'App', 
    icon: AppWindow, 
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/20'
  },
};

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<NotificationType | null>(null);

  const { data, isLoading, error, refetch } = useQuery<NotificationsResponse>({
    queryKey: ['/api/notifications', wallet, selectedType],
    enabled: !!wallet,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/notifications/${id}/read`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'Marked as read' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to mark as read', description: err.message, variant: 'destructive' });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const unreadNotifications = data?.notifications?.filter(n => !n.readAt) || [];
      await Promise.all(unreadNotifications.map(n => 
        apiRequest(`/api/notifications/${n.id}/read`, { method: 'POST' })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'All notifications marked as read' });
      pushReceipt({
        id: `receipt-notifications-read-all-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.notifications.read-all',
        endpoint: '/api/notifications',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to mark all as read', description: err.message, variant: 'destructive' });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/notifications/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({ title: 'Notification deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (data?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-notifications-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.notifications',
        endpoint: '/api/notifications',
        timestamp: Date.now()
      });
    }
  }, [data]);

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="notifications-no-wallet">
        <Bell className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view notifications</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="notifications-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="notifications-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load notifications</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-notifications-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const notifications = data?.notifications || [];
  const unreadCount = notifications.filter(n => !n.readAt).length;

  const filteredNotifications = selectedType 
    ? notifications.filter(n => n.type === selectedType)
    : notifications;

  const groupedByType = notifications.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {} as Record<NotificationType, number>);

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="notifications-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-400/20 relative">
            <BellRing className="w-5 h-5 text-amber-400" />
            {unreadCount > 0 && (
              <span 
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium"
                data-testid="badge-unread-count"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-notifications-title">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-400/20 text-cyan-400" data-testid="text-unread-count">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="text-white/60 hover:text-white text-xs"
              data-testid="button-mark-all-read"
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="w-3 h-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-notifications-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          variant={selectedType === null ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedType(null)}
          className={selectedType === null ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/60'}
          data-testid="button-filter-all"
        >
          <Filter className="w-3 h-3 mr-1.5" />
          All ({notifications.length})
        </Button>
        {Object.entries(TYPE_CONFIG).map(([type, config]) => {
          const count = groupedByType[type as NotificationType] || 0;
          const Icon = config.icon;
          return (
            <Button
              key={type}
              variant={selectedType === type ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType(type as NotificationType)}
              className={selectedType === type 
                ? `${config.bgColor} ${config.color}` 
                : 'text-white/60 hover:text-white'}
              data-testid={`button-filter-${type}`}
            >
              <Icon className="w-3 h-3 mr-1.5" />
              {config.label} ({count})
            </Button>
          );
        })}
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="notifications-empty">
          <Bell className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No notifications</p>
          <p className="text-white/40 text-sm">
            {selectedType ? `No ${TYPE_CONFIG[selectedType].label.toLowerCase()} notifications` : 'You\'re all caught up!'}
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="notifications-list">
          <AnimatePresence>
            {filteredNotifications.map((notification, index) => {
              const config = TYPE_CONFIG[notification.type];
              const Icon = config.icon;
              
              return (
                <MotionDiv
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={`p-4 rounded-xl border transition-all group
                    ${notification.readAt 
                      ? 'bg-white/3 border-white/5 hover:border-white/15' 
                      : 'bg-white/8 border-white/15 hover:border-white/25'
                    }`}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span 
                            className={`text-sm font-medium ${notification.readAt ? 'text-white/60' : 'text-white/90'}`}
                            data-testid={`text-notification-title-${notification.id}`}
                          >
                            {notification.title}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[10px] rounded ${config.bgColor} ${config.color}`}>
                            {config.label}
                          </span>
                          {notification.source && (
                            <span className="text-[10px] text-white/40">
                              via {notification.source}
                            </span>
                          )}
                        </div>
                        <p 
                          className={`text-sm line-clamp-2 ${notification.readAt ? 'text-white/40' : 'text-white/60'}`}
                          data-testid={`text-notification-body-${notification.id}`}
                        >
                          {notification.body || 'No details'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-xs text-white/40 whitespace-nowrap" data-testid={`text-notification-time-${notification.id}`}>
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.readAt && (
                          <button
                            onClick={() => markAsRead.mutate(notification.id)}
                            disabled={markAsRead.isPending}
                            className="p-1 hover:bg-white/10 rounded"
                            data-testid={`button-mark-read-${notification.id}`}
                          >
                            <Check className="w-3 h-3 text-white/40 hover:text-green-400" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification.mutate(notification.id)}
                          disabled={deleteNotification.isPending}
                          className="p-1 hover:bg-red-400/20 rounded"
                          data-testid={`button-delete-notification-${notification.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-white/40 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                </MotionDiv>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </MotionDiv>
  );
}
