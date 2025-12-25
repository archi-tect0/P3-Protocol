import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Coins, Plus, RefreshCw, AlertCircle, TrendingUp, TrendingDown,
  Trash2, Star, X, Loader2, BarChart3, Wallet, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WatchlistToken {
  id: number;
  contractAddress: string;
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
  price: number;
  priceFormatted: string;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
  addedAt: string;
}

interface TrendingToken {
  id: string;
  name: string;
  symbol: string;
  logo: string | null;
  marketCapRank: number;
  score: number;
}

interface ChartDataPoint {
  timestamp: number;
  price: number;
}

interface WatchlistResponse {
  tokens: WatchlistToken[];
  count: number;
  receipt: { status: string };
}

interface TrendingResponse {
  trending: TrendingToken[];
  count: number;
  receipt: { status: string };
}

interface WalletToken {
  contractAddress: string;
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  logo: string | null;
  balance: string;
  balanceFormatted: string;
  price: number;
  value: number;
  change24h: number;
  pnl24h: number;
}

interface WalletBalancesResponse {
  tokens: WalletToken[];
  count: number;
  portfolio: {
    totalValue: number;
    totalPnl24h: number;
    totalChange24h: number;
  };
  receipt: { status: string };
}

interface ChartResponse {
  data: ChartDataPoint[];
  count: number;
  receipt: { status: string };
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

function formatMarketCap(cap?: number): string {
  if (!cap) return 'N/A';
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  if (cap >= 1e3) return `$${(cap / 1e3).toFixed(2)}K`;
  return `$${cap.toFixed(2)}`;
}

function MiniChart({ data }: { data: ChartDataPoint[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="w-16 h-8 flex items-center justify-center text-white/30">
        <BarChart3 className="w-4 h-4" />
      </div>
    );
  }

  const prices = data.map(d => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 64;
    const y = 32 - ((d.price - min) / range) * 28;
    return `${x},${y}`;
  }).join(' ');

  const isPositive = data[data.length - 1].price >= data[0].price;

  return (
    <svg width="64" height="32" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TokenCard({ 
  token, 
  onRemove, 
  isRemoving,
  chartData 
}: { 
  token: WatchlistToken; 
  onRemove: () => void; 
  isRemoving: boolean;
  chartData?: ChartDataPoint[];
}) {
  const isPositive = token.change24h >= 0;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 rounded-xl bg-white/5 border border-white/10 
                 hover:border-white/20 transition-all group"
      data-testid={`token-card-${token.contractAddress}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {token.logo ? (
            <img 
              src={token.logo} 
              alt={token.symbol} 
              className="w-10 h-10 rounded-full bg-white/10"
              data-testid={`token-logo-${token.contractAddress}`}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/20 flex items-center justify-center">
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-base font-medium text-white/90 truncate" data-testid={`token-name-${token.contractAddress}`}>
              {token.name}
            </h3>
            <p className="text-sm text-white/50" data-testid={`token-symbol-${token.contractAddress}`}>
              {token.symbol}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={isRemoving}
          className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 p-2 transition-opacity"
          data-testid={`button-remove-token-${token.contractAddress}`}
        >
          {isRemoving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xl font-semibold text-white" data-testid={`token-price-${token.contractAddress}`}>
            {formatPrice(token.price)}
          </p>
          <div 
            className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}
            data-testid={`token-change-${token.contractAddress}`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{isPositive ? '+' : ''}{token.change24h.toFixed(2)}%</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {chartData && <MiniChart data={chartData} />}
          <p className="text-xs text-white/40" data-testid={`token-mcap-${token.contractAddress}`}>
            MCap: {formatMarketCap(token.marketCap)}
          </p>
        </div>
      </div>
    </MotionDiv>
  );
}

function AddTokenForm({ 
  onSubmit, 
  isPending,
  onCancel
}: { 
  onSubmit: (address: string, chainId: string) => void; 
  isPending: boolean;
  onCancel: () => void;
}) {
  const [contractAddress, setContractAddress] = useState('');
  const [chainId, setChainId] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contractAddress.trim()) {
      onSubmit(contractAddress.trim(), chainId);
    }
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-6 p-4 rounded-xl bg-white/5 border border-cyan-400/30"
      data-testid="add-token-form"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-white/60 mb-2 block">Contract Address</label>
          <Input
            placeholder="0x..."
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
            data-testid="input-contract-address"
            disabled={isPending}
          />
        </div>
        
        <div>
          <label className="text-sm text-white/60 mb-2 block">Chain</label>
          <select
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white"
            data-testid="select-chain-id"
            disabled={isPending}
          >
            <option value="1">Ethereum Mainnet</option>
            <option value="137">Polygon</option>
            <option value="56">BNB Chain</option>
            <option value="42161">Arbitrum</option>
            <option value="10">Optimism</option>
            <option value="8453">Base</option>
          </select>
        </div>

        <div className="flex gap-2">
          <MotionButton
            type="submit"
            disabled={isPending || !contractAddress.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                       bg-cyan-400/20 border border-cyan-400/30 text-cyan-400
                       hover:bg-cyan-400/30 disabled:opacity-50 transition-all"
            whileHover={{ scale: isPending ? 1 : 1.02 }}
            whileTap={{ scale: isPending ? 1 : 0.98 }}
            data-testid="button-submit-token"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Adding...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Token</span>
              </>
            )}
          </MotionButton>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-white/60 hover:text-white"
            data-testid="button-cancel-add-token"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </MotionDiv>
  );
}

function TrendingSection({ trending }: { trending: TrendingToken[] }) {
  if (!trending || trending.length === 0) return null;

  return (
    <div className="mb-6" data-testid="trending-section">
      <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Trending
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {trending.slice(0, 5).map((token) => (
          <MotionDiv
            key={token.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 px-3 py-2 rounded-lg bg-white/5 border border-white/10 
                       hover:border-amber-400/30 cursor-pointer transition-all flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            data-testid={`trending-token-${token.id}`}
          >
            {token.logo ? (
              <img src={token.logo} alt={token.symbol} className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center">
                <Star className="w-3 h-3 text-amber-400" />
              </div>
            )}
            <span className="text-sm text-white/80">{token.symbol}</span>
            {token.marketCapRank && (
              <span className="text-xs text-white/40">#{token.marketCapRank}</span>
            )}
          </MotionDiv>
        ))}
      </div>
    </div>
  );
}

function WalletHoldingCard({ token }: { token: WalletToken }) {
  const isPositive = token.change24h >= 0;
  const pnlPositive = token.pnl24h >= 0;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-400/30 transition-all"
      data-testid={`holding-card-${token.contractAddress}`}
    >
      <div className="flex items-center gap-3 mb-3">
        {token.logo ? (
          <img 
            src={token.logo} 
            alt={token.symbol} 
            className="w-10 h-10 rounded-full bg-white/10"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 flex items-center justify-center">
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-medium text-white/90 truncate">{token.name}</h3>
          <p className="text-sm text-white/50">{token.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-white" data-testid={`holding-value-${token.contractAddress}`}>
            ${token.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div 
            className={`flex items-center justify-end gap-1 text-sm ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}
            data-testid={`holding-pnl-${token.contractAddress}`}
          >
            {pnlPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{pnlPositive ? '+' : ''}{token.pnl24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="text-white/50">
          <span data-testid={`holding-balance-${token.contractAddress}`}>{parseFloat(token.balanceFormatted).toLocaleString('en-US', { maximumFractionDigits: 6 })}</span>
          <span className="ml-1">{token.symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40">{formatPrice(token.price)}</span>
          <span className={`${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{token.change24h.toFixed(2)}%
          </span>
        </div>
      </div>
    </MotionDiv>
  );
}

function PortfolioSummary({ 
  portfolio, 
  tokenCount 
}: { 
  portfolio: WalletBalancesResponse['portfolio']; 
  tokenCount: number;
}) {
  const isPositive = portfolio.totalChange24h >= 0;
  const pnlPositive = portfolio.totalPnl24h >= 0;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-400/20"
      data-testid="portfolio-summary"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-400/20">
            <Wallet className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-white/60">Portfolio Value</h3>
            <p className="text-2xl font-bold text-white" data-testid="text-portfolio-value">
              ${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/60">24h P&L</p>
          <div 
            className={`flex items-center justify-end gap-1 text-lg font-semibold ${pnlPositive ? 'text-green-400' : 'text-red-400'}`}
            data-testid="text-portfolio-pnl"
          >
            {pnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{pnlPositive ? '+' : ''}${Math.abs(portfolio.totalPnl24h).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="text-sm">({isPositive ? '+' : ''}{portfolio.totalChange24h.toFixed(2)}%)</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-white/40">
        <span>{tokenCount} token{tokenCount !== 1 ? 's' : ''} held</span>
        <span>Updated just now</span>
      </div>
    </MotionDiv>
  );
}

function WalletHoldingsSection({ 
  wallet
}: { 
  wallet: string; 
  onRefresh?: () => void;
}) {
  const [selectedChain, setSelectedChain] = useState('8453');
  
  const { data, isLoading, error, refetch } = useQuery<WalletBalancesResponse>({
    queryKey: ['/api/tokens/balances', wallet, selectedChain],
    queryFn: async () => {
      const res = await fetch(`/api/tokens/balances/${wallet}?chainId=${selectedChain}`);
      if (!res.ok) throw new Error('Failed to fetch balances');
      return res.json();
    },
    enabled: !!wallet,
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white/80 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Wallet Holdings
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <MotionDiv
            className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <span className="ml-3 text-white/50">Loading balances...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-white/5 border border-amber-400/30">
        <div className="flex items-center gap-2 text-amber-400">
          <AlertCircle className="w-5 h-5" />
          <span>Could not load wallet balances</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => refetch()}
          className="mt-2 text-white/60"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const holdings = data.tokens || [];

  return (
    <div className="mb-8" data-testid="wallet-holdings-section">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white/80 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          Wallet Holdings
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value)}
            className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white text-sm"
            data-testid="select-holdings-chain"
          >
            <option value="8453">Base</option>
            <option value="1">Ethereum</option>
            <option value="137">Polygon</option>
            <option value="42161">Arbitrum</option>
            <option value="10">Optimism</option>
          </select>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-refresh-holdings"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {data.portfolio && data.portfolio.totalValue > 0 && (
        <PortfolioSummary portfolio={data.portfolio} tokenCount={holdings.length} />
      )}

      {holdings.length === 0 ? (
        <div className="p-6 rounded-xl bg-white/5 border border-white/10 text-center">
          <DollarSign className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50">No tokens found on this chain</p>
          <p className="text-white/30 text-sm mt-1">Try switching networks above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="holdings-list">
          {holdings.map((token) => (
            <WalletHoldingCard key={`${token.chainId}-${token.contractAddress}`} token={token} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TokensMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingToken, setRemovingToken] = useState<string | null>(null);
  const [chartCache, setChartCache] = useState<Record<string, ChartDataPoint[]>>({});

  const { data: watchlistData, isLoading, error, refetch } = useQuery<WatchlistResponse>({
    queryKey: ['/api/tokens/watchlist', wallet],
    enabled: !!wallet,
  });

  const { data: trendingData, isLoading: loadingTrending } = useQuery<TrendingResponse>({
    queryKey: ['/api/tokens/trending'],
  });

  const addToken = useMutation({
    mutationFn: async ({ contractAddress, chainId }: { contractAddress: string; chainId: string }) => {
      return apiRequest('/api/tokens/watchlist', {
        method: 'POST',
        body: JSON.stringify({ contractAddress, chainId }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tokens/watchlist'] });
      setShowAddForm(false);
      toast({ title: 'Token added', description: `${data.token?.name || 'Token'} added to watchlist` });
      pushReceipt({
        id: `receipt-tokens-add-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.tokens.add',
        endpoint: '/api/tokens/watchlist',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add token', description: err.message, variant: 'destructive' });
      pushReceipt({
        id: `receipt-tokens-add-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.tokens.add.error',
        endpoint: '/api/tokens/watchlist',
        timestamp: Date.now(),
        error: err.message
      });
    },
  });

  const removeToken = useMutation({
    mutationFn: async (contractAddress: string) => {
      setRemovingToken(contractAddress);
      return apiRequest(`/api/tokens/watchlist/${contractAddress}`, { method: 'DELETE' });
    },
    onSuccess: (_, contractAddress) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tokens/watchlist'] });
      setRemovingToken(null);
      toast({ title: 'Token removed from watchlist' });
      pushReceipt({
        id: `receipt-tokens-remove-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.tokens.remove',
        endpoint: `/api/tokens/watchlist/${contractAddress}`,
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      setRemovingToken(null);
      toast({ title: 'Failed to remove token', description: err.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (watchlistData?.receipt?.status === 'success' && watchlistData.tokens?.length > 0) {
      pushReceipt({
        id: `receipt-tokens-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.tokens',
        endpoint: '/api/tokens/watchlist',
        timestamp: Date.now()
      });
    } else if (watchlistData?.receipt?.status === 'empty' || (watchlistData?.tokens && watchlistData.tokens.length === 0)) {
      pushReceipt({
        id: `receipt-tokens-empty-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.tokens.empty',
        endpoint: '/api/tokens/watchlist',
        timestamp: Date.now()
      });
    }
  }, [watchlistData]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-tokens-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.tokens.error',
        endpoint: '/api/tokens/watchlist',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  useEffect(() => {
    const fetchCharts = async () => {
      if (!watchlistData?.tokens) return;
      
      const newCache: Record<string, ChartDataPoint[]> = {};
      
      await Promise.all(
        watchlistData.tokens.map(async (token) => {
          if (chartCache[token.contractAddress]) {
            newCache[token.contractAddress] = chartCache[token.contractAddress];
            return;
          }
          
          try {
            const res = await fetch(`/api/tokens/chart/${token.contractAddress}?chainId=${token.chainId}&days=7`);
            if (res.ok) {
              const data: ChartResponse = await res.json();
              if (data.data && data.data.length > 0) {
                newCache[token.contractAddress] = data.data;
              }
            }
          } catch (e) {
          }
        })
      );
      
      setChartCache(prev => ({ ...prev, ...newCache }));
    };

    fetchCharts();
  }, [watchlistData?.tokens]);

  const tokens = watchlistData?.tokens || [];
  const trending = trendingData?.trending || [];

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="tokens-no-wallet">
        <Coins className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to track tokens</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="tokens-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="tokens-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load token watchlist</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-tokens-retry"
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
      data-testid="tokens-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-400/20">
            <Coins className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-tokens-title">Token Watchlist</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-tokens-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          {!showAddForm && (
            <MotionButton
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg
                         bg-cyan-400/10 border border-cyan-400/30 text-cyan-400
                         hover:bg-cyan-400/20 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid="button-add-token"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Token</span>
            </MotionButton>
          )}
        </div>
      </div>

      {showAddForm && (
        <AddTokenForm
          onSubmit={(address, chainId) => addToken.mutate({ contractAddress: address, chainId })}
          isPending={addToken.isPending}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      <WalletHoldingsSection wallet={wallet} onRefresh={() => refetch()} />

      {!loadingTrending && trending.length > 0 && (
        <TrendingSection trending={trending} />
      )}

      <div className="mt-8 pt-4 border-t border-white/10">
        <h3 className="text-lg font-medium text-white/80 mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          Watchlist
        </h3>
      </div>

      {tokens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="tokens-empty">
          <Coins className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No tokens in watchlist</p>
          <p className="text-white/40 text-sm mb-4">Add tokens by contract address to track their prices</p>
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              variant="outline"
              className="border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
              data-testid="button-add-first-token"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Token
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="tokens-list">
          {tokens.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              onRemove={() => removeToken.mutate(token.contractAddress)}
              isRemoving={removingToken === token.contractAddress}
              chartData={chartCache[token.contractAddress]}
            />
          ))}
        </div>
      )}

      {tokens.length > 0 && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-white/30 text-center" data-testid="text-tokens-count">
            Tracking {tokens.length} token{tokens.length !== 1 ? 's' : ''} • Prices update every minute
          </p>
        </div>
      )}
    </MotionDiv>
  );
}
