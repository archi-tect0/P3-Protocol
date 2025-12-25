import { useEffect, useState } from 'react';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Play, Heart, Share2, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeedItem {
  id: string;
  title: string;
  thumbnail?: string;
  source?: string;
  url?: string;
  pubDate?: string;
}

export default function FeedMode() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushReceipt } = useAtlasStore();

  async function fetchFeed() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/atlas/meta/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointKey: 'public.coingecko.markets',
          params: { vs_currency: 'usd', per_page: 12 }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        pushReceipt({
          id: `receipt-feed-error-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.render.feed.error',
          endpoint: '/api/atlas/meta/execute',
          timestamp: Date.now(),
          error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`
        });
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.result)) {
        const feedItems: FeedItem[] = data.result.map((coin: any) => ({
          id: `crypto-${coin.id}`,
          title: `${coin.name} (${coin.symbol?.toUpperCase() || '???'}): $${coin.current_price?.toLocaleString() || 'N/A'}`,
          thumbnail: coin.image,
          source: 'CoinGecko',
          url: `https://www.coingecko.com/en/coins/${coin.id}`,
          pubDate: new Date().toISOString()
        }));
        setItems(feedItems);
        
        pushReceipt({
          id: `receipt-feed-${Date.now()}`,
          hash: data.receiptHash || `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.render.feed',
          endpoint: '/api/atlas/meta/execute',
          timestamp: Date.now()
        });
      } else {
        pushReceipt({
          id: `receipt-feed-empty-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.render.feed.empty',
          endpoint: '/api/atlas/meta/execute',
          timestamp: Date.now(),
          error: data.error || 'No results returned'
        });
        setError(data.error || 'No feed data available from API.');
      }
    } catch (err) {
      console.error('Feed fetch failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      pushReceipt({
        id: `receipt-feed-fail-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.feed.fail',
        endpoint: '/api/atlas/meta/execute',
        timestamp: Date.now(),
        error: errorMsg
      });
      setError(`Failed to load feed: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFeed();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">{error}</p>
        <Button 
          variant="outline" 
          onClick={fetchFeed}
          className="border-white/20 text-white/80 hover:bg-white/10"
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
      data-testid="feed-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80">Feed</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={fetchFeed}
          className="text-white/60 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, index) => (
          <MotionDiv
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="group relative aspect-video rounded-xl bg-gradient-to-br from-white/10 to-white/5 
                       border border-white/10 overflow-hidden cursor-pointer
                       hover:border-cyan-400/30 transition-all duration-300"
            data-testid={`feed-item-${item.id}`}
            onClick={() => item.url && window.open(item.url, '_blank')}
          >
            {item.thumbnail ? (
              <img 
                src={item.thumbnail} 
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <MotionDiv
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center
                             group-hover:bg-cyan-400/20 transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                >
                  <Play className="w-5 h-5 text-white/60 group-hover:text-cyan-400 ml-1" />
                </MotionDiv>
              </div>
            )}
            
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-sm text-white/90 font-medium line-clamp-2">{item.title}</p>
              {item.source && (
                <p className="text-xs text-white/50 mt-1">{item.source}</p>
              )}
            </div>
            
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors">
                <Heart className="w-3.5 h-3.5 text-white/70" />
              </button>
              <button className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors">
                <Share2 className="w-3.5 h-3.5 text-white/70" />
              </button>
            </div>
          </MotionDiv>
        ))}
      </div>
      
      {items.length === 0 && !error && (
        <div className="text-center py-12 text-white/40">
          <p>No feed items available</p>
          <p className="text-sm mt-2">Connect news or crypto APIs to see content here</p>
        </div>
      )}
    </MotionDiv>
  );
}
