import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Trash2,
  Loader2,
  Mail,
  MailOpen,
  RefreshCw,
  Filter
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { SDK } from '@/lib/sdk';

export default function InboxPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data: inboxData, isLoading, refetch } = useQuery({
    queryKey: ['/api/nexus/inbox'],
    queryFn: () => SDK.inbox.getNotifications(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => SDK.inbox.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/inbox'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SDK.inbox.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/inbox'] });
      toast({ title: 'Notification deleted' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to delete' });
    },
  });

  const notifications = inboxData?.notifications || [];
  const unreadCount = inboxData?.unreadCount || 0;

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <Mail className="w-5 h-5" />;
      case 'system':
        return <Bell className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'from-blue-500 to-indigo-600';
      case 'alert':
        return 'from-red-500 to-pink-600';
      case 'success':
        return 'from-green-500 to-emerald-600';
      default:
        return 'from-purple-500 to-indigo-600';
    }
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-indigo-900/10 pointer-events-none" />

      <div className="relative z-10 p-4 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              data-testid="button-back-hub"
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Inbox</h1>
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="button-refresh-inbox"
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              data-testid="button-filter-inbox"
              variant={filter === 'unread' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(filter === 'all' ? 'unread' : 'all')}
              className="text-slate-400 hover:text-white"
            >
              <Filter className="w-4 h-4 mr-1" />
              {filter === 'unread' ? 'Unread' : 'All'}
            </Button>
          </div>
        </div>

        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <BellOff className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications'}
              </h3>
              <p className="text-sm text-slate-500">
                {filter === 'unread'
                  ? 'All caught up! You have no unread notifications.'
                  : 'You will receive notifications here when there is activity.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  data-testid={`notification-${notification.id}`}
                  className={`p-4 flex items-start gap-4 transition-colors ${
                    !notification.read ? 'bg-blue-500/5' : ''
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${getNotificationColor(
                      notification.type
                    )} flex items-center justify-center flex-shrink-0`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-white">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mt-1">{notification.body}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-slate-500">
                            {new Date(notification.createdAt).toLocaleString()}
                          </span>
                          {notification.topic && (
                            <Badge variant="outline" className="text-xs border-white/10 text-slate-400">
                              {notification.topic}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <Button
                            data-testid={`button-mark-read-${notification.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => markReadMutation.mutate(notification.id)}
                            disabled={markReadMutation.isPending}
                            className="text-slate-400 hover:text-green-400 h-8 w-8 p-0"
                          >
                            {markReadMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          data-testid={`button-delete-${notification.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(notification.id)}
                          disabled={deleteMutation.isPending}
                          className="text-slate-400 hover:text-red-400 h-8 w-8 p-0"
                        >
                          {deleteMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {notifications.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </span>
            {unreadCount > 0 && (
              <span className="flex items-center gap-1">
                <MailOpen className="w-3 h-3" />
                {unreadCount} unread
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
