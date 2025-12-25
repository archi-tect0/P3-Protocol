import { useQuery } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Shield, FileCheck, ExternalLink, Copy, RefreshCw, AlertCircle, Receipt, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ReceiptRecord {
  id: string;
  type: 'message' | 'meeting' | 'money';
  subjectId: string;
  contentHash: string;
  createdAt: string;
  immutableSeq?: number;
  anchorTxHash?: string;
  anchorStatus?: 'pending' | 'anchored' | 'failed';
}

interface ReceiptDisplay {
  id: string;
  type: string;
  typeLabel: string;
  hash: string;
  shortHash: string;
  anchored: boolean;
  anchorStatus: string;
  txHash?: string;
  timestamp: string;
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

function truncateHash(hash: string): string {
  if (!hash || hash.length < 16) return hash || 'Unknown';
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

const TYPE_LABELS: Record<string, string> = {
  message: 'Message',
  meeting: 'Meeting',
  money: 'Payment'
};

const TYPE_COLORS: Record<string, string> = {
  message: 'text-blue-400 bg-blue-400/20',
  meeting: 'text-purple-400 bg-purple-400/20',
  money: 'text-green-400 bg-green-400/20'
};

export default function ReceiptsMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery<{ ok: boolean; receipts: ReceiptRecord[]; total: number }>({
    queryKey: ['/api/nexus/receipts', wallet, filter],
    enabled: !!wallet,
  });

  useEffect(() => {
    if (data?.ok) {
      pushReceipt({
        id: `receipt-explorer-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: data.receipts?.length ? 'atlas.render.receipts' : 'atlas.render.receipts.empty',
        endpoint: '/api/nexus/receipts',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-explorer-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.receipts.error',
        endpoint: '/api/nexus/receipts',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const receipts: ReceiptDisplay[] = (data?.receipts || []).map(r => ({
    id: r.id,
    type: r.type,
    typeLabel: TYPE_LABELS[r.type] || r.type,
    hash: r.contentHash,
    shortHash: truncateHash(r.contentHash),
    anchored: r.anchorStatus === 'anchored' || !!r.anchorTxHash,
    anchorStatus: r.anchorStatus || (r.anchorTxHash ? 'anchored' : 'pending'),
    txHash: r.anchorTxHash,
    timestamp: formatTimeAgo(r.createdAt)
  }));

  const filteredReceipts = filter === 'all' 
    ? receipts 
    : receipts.filter(r => r.type === filter);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: "Copied",
      description: "Hash copied to clipboard"
    });
  };

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="receipts-no-wallet">
        <Receipt className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view receipts</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="receipts-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="receipts-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load receipts</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-receipts-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const anchoredCount = receipts.filter(r => r.anchored).length;

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="receipts-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white/80" data-testid="text-receipts-title">Blockchain Explorer</h2>
          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-400/20 text-cyan-400" data-testid="text-receipts-anchored-count">
            {anchoredCount} anchored
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => refetch()}
          className="text-white/60 hover:text-white p-2"
          data-testid="button-receipts-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="receipts-filters">
        {['all', 'message', 'meeting', 'money'].map(type => (
          <MotionButton
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-2 rounded-lg text-sm transition-all whitespace-nowrap
              ${filter === type 
                ? 'bg-cyan-400/20 border border-cyan-400/50 text-cyan-400' 
                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80'}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid={`button-filter-${type}`}
          >
            {type === 'all' ? 'All' : TYPE_LABELS[type]}
          </MotionButton>
        ))}
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="receipts-empty">
          <Receipt className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No receipts found</p>
          <p className="text-white/40 text-sm">Cryptographic proofs will appear here as you use the platform</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="receipts-list">
          {filteredReceipts.map((receipt, index) => (
            <MotionDiv
              key={receipt.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              data-testid={`receipt-item-${receipt.id}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${TYPE_COLORS[receipt.type] || 'bg-white/10'}`}>
                    {receipt.type === 'message' && <FileCheck className="w-5 h-5" />}
                    {receipt.type === 'meeting' && <Clock className="w-5 h-5" />}
                    {receipt.type === 'money' && <Shield className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[receipt.type] || 'bg-white/10 text-white/60'}`} data-testid={`text-receipt-type-${receipt.id}`}>
                        {receipt.typeLabel}
                      </span>
                      {receipt.anchored ? (
                        <span className="flex items-center gap-1 text-xs text-green-400" data-testid={`status-receipt-anchored-${receipt.id}`}>
                          <CheckCircle className="w-3 h-3" />
                          Anchored
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-amber-400" data-testid={`status-receipt-pending-${receipt.id}`}>
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-white/70" data-testid={`text-receipt-hash-${receipt.id}`}>{receipt.shortHash}</code>
                      <button 
                        onClick={() => copyHash(receipt.hash)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        data-testid={`button-copy-hash-${receipt.id}`}
                      >
                        <Copy className="w-3 h-3 text-white/40" />
                      </button>
                    </div>
                    {receipt.txHash && (
                      <a 
                        href={`https://basescan.org/tx/${receipt.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:underline mt-1"
                        data-testid={`link-receipt-basescan-${receipt.id}`}
                      >
                        View on BaseScan
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-xs text-white/40 whitespace-nowrap" data-testid={`text-receipt-time-${receipt.id}`}>
                  {receipt.timestamp}
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
