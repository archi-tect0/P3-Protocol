import { useQuery } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { ArrowUpRight, ArrowDownLeft, Shield, Plus, RefreshCw, AlertCircle, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

interface PaymentRecord {
  id: string;
  type: string;
  amount: string;
  asset?: string;
  token?: string;
  tokenSymbol?: string;
  fromWallet?: string;
  toWallet?: string;
  fromAddress?: string;
  toAddress?: string;
  status: string;
  txHash?: string;
  createdAt?: string;
  timestamp?: string;
}

interface Payment {
  id: string;
  type: 'sent' | 'received';
  amount: string;
  token: string;
  counterparty: string;
  anchored: boolean;
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

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function PaymentsMode() {
  const { pushReceipt, wallet } = useAtlasStore();

  const { data, isLoading, error, refetch } = useQuery<{ ok?: boolean; payments?: PaymentRecord[]; history?: PaymentRecord[] }>({
    queryKey: ['/api/payments/history', wallet],
    queryFn: async () => {
      const res = await fetch(`/api/payments/history?address=${wallet}`, {
        credentials: 'include',
        headers: {
          'x-wallet-address': wallet || '',
        },
      });
      if (!res.ok) {
        if (res.status === 404) return { payments: [], history: [] };
        throw new Error('Failed to load payments');
      }
      return res.json();
    },
    enabled: !!wallet,
  });

  useEffect(() => {
    if (data && (data.payments || data.history)) {
      pushReceipt({
        id: `receipt-payments-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.payments',
        endpoint: '/api/payments',
        timestamp: Date.now()
      });
    } else if (data && !data.payments && !data.history) {
      pushReceipt({
        id: `receipt-payments-empty-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.payments.empty',
        endpoint: '/api/payments',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-payments-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.payments.error',
        endpoint: '/api/payments',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const paymentRecords = data?.payments || data?.history || [];
  
  const payments: Payment[] = paymentRecords.map(p => {
    const toAddr = p.toWallet || p.toAddress || '';
    const fromAddr = p.fromWallet || p.fromAddress || '';
    const isReceived = wallet ? toAddr.toLowerCase() === wallet.toLowerCase() : false;
    return {
      id: p.id,
      type: isReceived ? 'received' : 'sent',
      amount: p.amount || '0',
      token: p.asset || p.tokenSymbol || p.token || 'ETH',
      counterparty: truncateAddress(isReceived ? fromAddr : toAddr),
      anchored: p.status === 'anchored' || p.status === 'confirmed' || !!p.txHash,
      timestamp: formatTimeAgo(p.createdAt || p.timestamp || '')
    };
  });

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="payments-no-wallet">
        <Wallet className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view payments</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="payments-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="payments-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load payments</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-payments-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const totalReceived = payments
    .filter(p => p.type === 'received' && (p.token === 'USDC' || p.token === 'USD'))
    .reduce((sum, p) => sum + parseFloat(p.amount.replace(',', '')), 0);

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="payments-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80" data-testid="text-payments-title">Payments</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-payments-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <MotionButton
            className="flex items-center gap-2 px-3 py-2 rounded-lg
                       bg-cyan-400/10 border border-cyan-400/30 text-cyan-400
                       hover:bg-cyan-400/20 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid="button-send-payment"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Send Payment</span>
          </MotionButton>
        </div>
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-br from-cyan-400/10 to-purple-400/10 border border-white/10 mb-6"
        data-testid="payments-total-card"
      >
        <div className="text-sm text-white/50 mb-1">Total Received (USDC)</div>
        <div className="text-3xl font-light text-white/90" data-testid="text-payments-total">${totalReceived.toLocaleString()}</div>
      </MotionDiv>
      
      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="payments-empty">
          <Wallet className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No payment history</p>
          <p className="text-white/40 text-sm">Your transactions will appear here once you send or receive payments</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="payments-list">
          {payments.map((payment, index) => (
            <MotionDiv
              key={payment.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              data-testid={`payment-item-${payment.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center
                    ${payment.type === 'received' ? 'bg-green-400/20' : 'bg-orange-400/20'}`}>
                    {payment.type === 'received' ? (
                      <ArrowDownLeft className="w-5 h-5 text-green-400" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-orange-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-medium
                        ${payment.type === 'received' ? 'text-green-400' : 'text-orange-400'}`}
                        data-testid={`text-payment-amount-${payment.id}`}>
                        {payment.type === 'received' ? '+' : '-'}{payment.amount} {payment.token}
                      </span>
                      {payment.anchored && (
                        <Shield className="w-3 h-3 text-cyan-400" />
                      )}
                    </div>
                    <div className="text-xs text-white/50 font-mono" data-testid={`text-payment-counterparty-${payment.id}`}>
                      {payment.type === 'received' ? 'From: ' : 'To: '}{payment.counterparty}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-white/40" data-testid={`text-payment-time-${payment.id}`}>
                  {payment.timestamp}
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
