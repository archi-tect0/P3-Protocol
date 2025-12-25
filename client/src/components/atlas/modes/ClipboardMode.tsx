import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, MotionButton, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Clipboard, Copy, Trash2, Pin, PinOff, RefreshCw, AlertCircle,
  Filter, FileText, Link, Code, Bot, FileJson, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type ClipboardKind = 'text' | 'url' | 'json' | 'code' | 'ai_output';

interface ClipboardItem {
  id: string;
  kind: ClipboardKind;
  content: string;
  preview: string | null;
  isPinned: boolean | null;
  sourceApp: string | null;
  createdAt: string;
}

interface ClipboardResponse {
  items: ClipboardItem[];
  count: number;
  receipt: { status: string };
}

const KIND_CONFIG: Record<ClipboardKind, { label: string; icon: any; color: string; bgColor: string }> = {
  text: { 
    label: 'Text', 
    icon: FileText, 
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/20'
  },
  url: { 
    label: 'URL', 
    icon: Link, 
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/20'
  },
  json: { 
    label: 'JSON', 
    icon: FileJson, 
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/20'
  },
  code: { 
    label: 'Code', 
    icon: Code, 
    color: 'text-green-400',
    bgColor: 'bg-green-400/20'
  },
  ai_output: { 
    label: 'AI Output', 
    icon: Bot, 
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/20'
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

export default function ClipboardMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [selectedKind, setSelectedKind] = useState<ClipboardKind | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ClipboardResponse>({
    queryKey: ['/api/clipboard', wallet, selectedKind],
    enabled: !!wallet,
  });

  const copyToClipboard = useMutation({
    mutationFn: async (item: ClipboardItem) => {
      await navigator.clipboard.writeText(item.content);
      return item;
    },
    onSuccess: (item) => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({ title: 'Copied to clipboard' });
      pushReceipt({
        id: `receipt-clipboard-copy-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.clipboard.copy',
        endpoint: '/api/clipboard',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to copy', description: err.message, variant: 'destructive' });
    },
  });

  const togglePin = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/clipboard/${id}/pin`, {
        method: 'PATCH',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clipboard'] });
      toast({ title: 'Pin status updated' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update pin', description: err.message, variant: 'destructive' });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/clipboard/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clipboard'] });
      toast({ title: 'Item deleted' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (data?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-clipboard-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.clipboard',
        endpoint: '/api/clipboard',
        timestamp: Date.now()
      });
    }
  }, [data]);

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="clipboard-no-wallet">
        <Clipboard className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view clipboard</p>
      </div>
    );
  }

  if (isLoading && !data) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="clipboard-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="clipboard-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load clipboard</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-clipboard-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const items = data?.items || [];

  const filteredItems = selectedKind 
    ? items.filter(item => item.kind === selectedKind)
    : items;

  const pinnedItems = filteredItems.filter(item => item.isPinned);
  const unpinnedItems = filteredItems.filter(item => !item.isPinned);

  const groupedByKind = items.reduce((acc, item) => {
    acc[item.kind] = (acc[item.kind] || 0) + 1;
    return acc;
  }, {} as Record<ClipboardKind, number>);

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="clipboard-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400/20 to-blue-400/20">
            <Clipboard className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-clipboard-title">
            Clipboard Manager
          </h2>
          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60" data-testid="text-clipboard-count">
            {items.length} items
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => refetch()}
          className="text-white/60 hover:text-white p-2"
          data-testid="button-clipboard-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <Button
          variant={selectedKind === null ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedKind(null)}
          className={selectedKind === null ? 'bg-cyan-500/20 text-cyan-400' : 'text-white/60'}
          data-testid="button-filter-all"
        >
          <Filter className="w-3 h-3 mr-1.5" />
          All ({items.length})
        </Button>
        {Object.entries(KIND_CONFIG).map(([kind, config]) => {
          const count = groupedByKind[kind as ClipboardKind] || 0;
          if (count === 0) return null;
          const Icon = config.icon;
          return (
            <Button
              key={kind}
              variant={selectedKind === kind ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSelectedKind(kind as ClipboardKind)}
              className={selectedKind === kind 
                ? `${config.bgColor} ${config.color}` 
                : 'text-white/60 hover:text-white'}
              data-testid={`button-filter-${kind}`}
            >
              <Icon className="w-3 h-3 mr-1.5" />
              {config.label} ({count})
            </Button>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="clipboard-empty">
          <Clipboard className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">Clipboard is empty</p>
          <p className="text-white/40 text-sm">
            {selectedKind 
              ? `No ${KIND_CONFIG[selectedKind].label.toLowerCase()} items` 
              : 'Copy items to see them here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4" data-testid="clipboard-list">
          {pinnedItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pin className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-white/50 uppercase tracking-wider">Pinned</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {pinnedItems.map((item) => (
                    <ClipboardCard
                      key={item.id}
                      item={item}
                      copied={copiedId === item.id}
                      onCopy={() => copyToClipboard.mutate(item)}
                      onTogglePin={() => togglePin.mutate(item.id)}
                      onDelete={() => deleteItem.mutate(item.id)}
                      isPinning={togglePin.isPending}
                      isDeleting={deleteItem.isPending}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {unpinnedItems.length > 0 && (
            <div>
              {pinnedItems.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-white/50 uppercase tracking-wider">Recent</span>
                </div>
              )}
              <div className="space-y-2">
                <AnimatePresence>
                  {unpinnedItems.map((item) => (
                    <ClipboardCard
                      key={item.id}
                      item={item}
                      copied={copiedId === item.id}
                      onCopy={() => copyToClipboard.mutate(item)}
                      onTogglePin={() => togglePin.mutate(item.id)}
                      onDelete={() => deleteItem.mutate(item.id)}
                      isPinning={togglePin.isPending}
                      isDeleting={deleteItem.isPending}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}
    </MotionDiv>
  );
}

function ClipboardCard({
  item,
  copied,
  onCopy,
  onTogglePin,
  onDelete,
  isPinning,
  isDeleting,
}: {
  item: ClipboardItem;
  copied: boolean;
  onCopy: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  isPinning: boolean;
  isDeleting: boolean;
}) {
  const config = KIND_CONFIG[item.kind];
  const Icon = config.icon;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      className={`p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group
        ${item.isPinned ? 'border-l-2 border-l-amber-400' : ''}`}
      data-testid={`clipboard-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 text-[10px] rounded ${config.bgColor} ${config.color}`}>
                {config.label}
              </span>
              <span className="text-xs text-white/40" data-testid={`text-clipboard-time-${item.id}`}>
                {formatTimeAgo(item.createdAt)}
              </span>
            </div>
            <p 
              className="text-sm text-white/70 font-mono line-clamp-3 break-all"
              data-testid={`text-clipboard-preview-${item.id}`}
            >
              {item.preview}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <MotionButton
            onClick={onCopy}
            className={`p-1.5 rounded-lg transition-colors ${
              copied 
                ? 'bg-green-400/20 text-green-400' 
                : 'hover:bg-white/10 text-white/40 hover:text-white'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid={`button-copy-${item.id}`}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </MotionButton>
          <button
            onClick={onTogglePin}
            disabled={isPinning}
            className="p-1.5 hover:bg-amber-400/20 rounded-lg text-white/40 hover:text-amber-400 transition-colors"
            data-testid={`button-pin-${item.id}`}
          >
            {isPinning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : item.isPinned ? (
              <PinOff className="w-4 h-4" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-1.5 hover:bg-red-400/20 rounded-lg text-white/40 hover:text-red-400 transition-colors"
            data-testid={`button-delete-${item.id}`}
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </MotionDiv>
  );
}
