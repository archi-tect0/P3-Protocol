import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, 
  RefreshCw, 
  Trash2, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Loader2 
} from 'lucide-react';
import {
  fetchTokenPrice,
  loadTrackedTokens,
  saveTrackedTokens,
  truncateAddress,
  SUPPORTED_CHAINS,
  type TrackedToken,
  type TokenPrice,
} from '@/lib/cryptoApi';

const REFRESH_INTERVAL = 5 * 60 * 1000;

export default function CryptoTrackerTile() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TrackedToken[]>([]);
  const [prices, setPrices] = useState<Map<string, TokenPrice>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const address = localStorage.getItem('p3:wallet:address');
    if (address) {
      setWalletAddress(address);
      const loaded = loadTrackedTokens(address);
      setTokens(loaded);
    }

    const handleWalletChange = (e: CustomEvent<{ address: string }>) => {
      const newAddr = e.detail.address;
      setWalletAddress(newAddr);
      const loaded = loadTrackedTokens(newAddr);
      setTokens(loaded);
      setPrices(new Map());
    };

    window.addEventListener('p3:wallet:changed', handleWalletChange as EventListener);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('p3:wallet:changed', handleWalletChange as EventListener);
    };
  }, []);

  const refreshPrices = useCallback(async () => {
    if (tokens.length === 0 || !isMountedRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const pricePromises = tokens.map(token => 
        fetchTokenPrice(token.address, token.chain)
      );
      
      const results = await Promise.all(pricePromises);
      
      if (!isMountedRef.current) return;
      
      const newPrices = new Map<string, TokenPrice>();
      results.forEach(price => {
        const key = `${price.chain}:${price.address.toLowerCase()}`;
        newPrices.set(key, price);
      });
      
      setPrices(newPrices);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Error fetching prices:', err);
      setError('Failed to fetch some prices');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [tokens]);

  useEffect(() => {
    if (tokens.length > 0) {
      refreshPrices();
    }
  }, [tokens.length]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
      
      if (!document.hidden && tokens.length > 0) {
        refreshPrices();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tokens.length, refreshPrices]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (tokens.length > 0) {
      intervalRef.current = setInterval(() => {
        if (isVisibleRef.current && !document.hidden && isMountedRef.current) {
          refreshPrices();
        }
      }, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tokens.length, refreshPrices]);

  const addToken = () => {
    if (!newAddress.trim()) {
      setError('Please enter a contract address');
      return;
    }

    const normalizedAddress = newAddress.trim().toLowerCase();
    const exists = tokens.some(
      t => t.address.toLowerCase() === normalizedAddress && t.chain === selectedChain
    );

    if (exists) {
      setError('Token already tracked');
      return;
    }

    const newToken: TrackedToken = {
      address: newAddress.trim(),
      chain: selectedChain,
      addedAt: Date.now(),
    };

    const updated = [...tokens, newToken];
    setTokens(updated);
    
    if (walletAddress) {
      saveTrackedTokens(walletAddress, updated);
    }

    setNewAddress('');
    setError(null);
    
    fetchTokenPrice(newToken.address, newToken.chain).then(price => {
      setPrices(prev => {
        const newMap = new Map(prev);
        const key = `${price.chain}:${price.address.toLowerCase()}`;
        newMap.set(key, price);
        return newMap;
      });
    });
  };

  const removeToken = (address: string, chain: string) => {
    const updated = tokens.filter(
      t => !(t.address.toLowerCase() === address.toLowerCase() && t.chain === chain)
    );
    setTokens(updated);
    
    if (walletAddress) {
      saveTrackedTokens(walletAddress, updated);
    }

    const key = `${chain}:${address.toLowerCase()}`;
    setPrices(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  };

  const getPrice = (address: string, chain: string): TokenPrice | undefined => {
    const key = `${chain}:${address.toLowerCase()}`;
    return prices.get(key);
  };

  const formatPrice = (price: number | null): string => {
    if (price === null) return '-';
    if (price < 0.01) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number | null | undefined): { text: string; color: string; icon: typeof TrendingUp | typeof TrendingDown | null } => {
    if (change === null || change === undefined) {
      return { text: '-', color: 'text-slate-500', icon: null };
    }
    if (change >= 0) {
      return { 
        text: `+${change.toFixed(2)}%`, 
        color: 'text-emerald-400', 
        icon: TrendingUp 
      };
    }
    return { 
      text: `${change.toFixed(2)}%`, 
      color: 'text-red-400', 
      icon: TrendingDown 
    };
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            data-testid="input-token-address"
            placeholder="Contract address (0x...)"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
            className="flex-1 bg-black/20 border-white/10 text-white placeholder:text-slate-500"
          />
          <Select value={selectedChain} onValueChange={setSelectedChain}>
            <SelectTrigger 
              className="w-full sm:w-[140px] bg-black/20 border-white/10 text-white"
              data-testid="select-chain"
            >
              <SelectValue placeholder="Chain" />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a1a] border-white/10">
              {SUPPORTED_CHAINS.map(chain => (
                <SelectItem 
                  key={chain.id} 
                  value={chain.id}
                  className="text-white hover:bg-white/10"
                >
                  {chain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            data-testid="button-add-token"
            onClick={addToken}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
        
        {error && (
          <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white">Tracked Tokens</h3>
          <Button
            data-testid="button-refresh-prices"
            variant="ghost"
            size="sm"
            onClick={refreshPrices}
            disabled={isLoading || tokens.length === 0}
            className="text-slate-400 hover:text-white h-8"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {tokens.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-800/50 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm text-slate-400">No tokens tracked yet</p>
            <p className="text-xs text-slate-500 mt-1">Add a contract address above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-xs">Contract</TableHead>
                  <TableHead className="text-slate-400 text-xs">Chain</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">Price</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">24h</TableHead>
                  <TableHead className="text-slate-400 text-xs">Source</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const price = getPrice(token.address, token.chain);
                  const change = formatChange(price?.priceChange24h);
                  const ChangeIcon = change.icon;
                  
                  return (
                    <TableRow 
                      key={`${token.chain}:${token.address}`}
                      className="border-white/5 hover:bg-white/5 transition-colors"
                      data-testid={`row-token-${token.address.slice(0, 8)}`}
                    >
                      <TableCell className="text-white font-mono text-xs">
                        {truncateAddress(token.address)}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 capitalize">
                          {token.chain}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {isLoading && !price ? (
                          <Loader2 className="w-3 h-3 animate-spin text-slate-400 ml-auto" />
                        ) : (
                          <span className="text-white font-medium text-sm">
                            {formatPrice(price?.usdPrice ?? null)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`flex items-center justify-end gap-1 text-xs ${change.color}`}>
                          {ChangeIcon && <ChangeIcon className="w-3 h-3" />}
                          {change.text}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          price?.source === 'moralis' 
                            ? 'bg-emerald-500/20 text-emerald-400' 
                            : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {price?.source || 'pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          data-testid={`button-remove-${token.address.slice(0, 8)}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => removeToken(token.address, token.chain)}
                          className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {tokens.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span>Auto-refresh: every 5 min (when visible)</span>
            {prices.size > 0 && (
              <span>
                Last update: {new Date(Math.max(...Array.from(prices.values()).map(p => p.lastUpdated))).toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
