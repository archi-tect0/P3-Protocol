import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Library, Book, Film, Gamepad2, ShoppingBag, Clock, Play, Download, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface LibraryItem {
  id: string;
  itemId: string;
  kind: 'video' | 'game' | 'ebook' | 'product' | 'audio' | 'app';
  title: string;
  slug?: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  progress?: number;
  accessType: string;
  expiresAt?: string;
  addedAt: string;
  priceWei?: string;
  category?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

interface ContinueItem {
  id: string;
  itemId: string;
  kind: 'video' | 'ebook';
  title: string;
  thumbnail?: string;
  progress: number;
  lastActivity: string;
}

type FilterType = 'all' | 'videos' | 'games' | 'ebooks' | 'products';

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

function getKindIcon(kind: LibraryItem['kind'] | ContinueItem['kind']) {
  switch (kind) {
    case 'video': return <Film className="w-4 h-4" />;
    case 'game': return <Gamepad2 className="w-4 h-4" />;
    case 'ebook': return <Book className="w-4 h-4" />;
    case 'product': return <ShoppingBag className="w-4 h-4" />;
    case 'audio': return <Film className="w-4 h-4" />;
    case 'app': return <Library className="w-4 h-4" />;
    default: return <Library className="w-4 h-4" />;
  }
}

function getKindLabel(kind: LibraryItem['kind'] | ContinueItem['kind']) {
  switch (kind) {
    case 'video': return 'Video';
    case 'game': return 'Game';
    case 'ebook': return 'Ebook';
    case 'product': return 'Product';
    case 'audio': return 'Audio';
    case 'app': return 'App';
    default: return 'Item';
  }
}

function getContinueLabel(kind: ContinueItem['kind']) {
  switch (kind) {
    case 'video': return 'Continue Watching';
    case 'ebook': return 'Continue Reading';
    default: return 'Continue';
  }
}

export default function LibraryMode() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const { pushReceipt, wallet } = useAtlasStore();

  const { data: libraryData, isLoading: libraryLoading, error: libraryError, refetch: refetchLibrary } = useQuery<{ ok?: boolean; items?: LibraryItem[]; count?: number; wallet?: string }>({
    queryKey: ['/api/atlas-one/library', wallet],
    enabled: !!wallet,
    meta: { headers: { 'x-wallet-address': wallet || '' } }
  });

  const { data: continueData, isLoading: continueLoading, error: _continueError, refetch: refetchContinue } = useQuery<{ ok?: boolean; items?: ContinueItem[]; count?: number }>({
    queryKey: ['/api/atlas-one/library/continue', wallet],
    enabled: !!wallet,
    meta: { headers: { 'x-wallet-address': wallet || '' } }
  });

  const removeFromLibraryMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return apiRequest(`/api/atlas-one/library/${itemId}`, { 
        method: 'DELETE',
        headers: { 'x-wallet-address': wallet || '' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/atlas-one/library', wallet] });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas-one/library/continue', wallet] });
      pushReceipt({
        id: `receipt-library-remove-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.library.remove',
        endpoint: '/api/atlas/library',
        timestamp: Date.now()
      });
    },
  });

  useEffect(() => {
    if (libraryData?.items) {
      pushReceipt({
        id: `receipt-library-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: libraryData.items.length > 0 ? 'atlas.render.library' : 'atlas.render.library.empty',
        endpoint: '/api/atlas-one/library',
        timestamp: Date.now()
      });
    }
  }, [libraryData]);

  useEffect(() => {
    if (libraryError) {
      pushReceipt({
        id: `receipt-library-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.library.error',
        endpoint: '/api/atlas-one/library',
        timestamp: Date.now(),
        error: libraryError instanceof Error ? libraryError.message : 'Unknown error'
      });
    }
  }, [libraryError]);

  const items = libraryData?.items || [];
  const continueItems = continueData?.items || [];

  const filteredItems = items.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'videos') return item.kind === 'video';
    if (activeFilter === 'games') return item.kind === 'game';
    if (activeFilter === 'ebooks') return item.kind === 'ebook';
    if (activeFilter === 'products') return item.kind === 'product';
    return true;
  });

  const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <Library className="w-4 h-4" /> },
    { key: 'videos', label: 'Videos', icon: <Film className="w-4 h-4" /> },
    { key: 'games', label: 'Games', icon: <Gamepad2 className="w-4 h-4" /> },
    { key: 'ebooks', label: 'Ebooks', icon: <Book className="w-4 h-4" /> },
    { key: 'products', label: 'Products', icon: <ShoppingBag className="w-4 h-4" /> },
  ];

  const handleRefresh = () => {
    refetchLibrary();
    refetchContinue();
  };

  const handlePlay = (item: LibraryItem | ContinueItem) => {
    pushReceipt({
      id: `receipt-library-play-${Date.now()}`,
      hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
      scope: `atlas.library.play.${item.kind}.${item.itemId}`,
      endpoint: '/api/atlas-one/library',
      timestamp: Date.now()
    });

    const { setMode, setRenderPayload } = useAtlasStore.getState();
    const fullItem = item as LibraryItem;
    setRenderPayload({
      itemId: item.itemId,
      title: item.title,
      slug: fullItem.slug,
      description: fullItem.description,
      thumbnail: item.thumbnail,
      coverImage: fullItem.coverImage,
      sourceUrl: fullItem.sourceUrl,
      metadata: fullItem.metadata,
      kind: item.kind,
      progress: item.progress,
      autoPlay: true
    });
    
    switch (item.kind) {
      case 'video':
        setMode('media');
        break;
      case 'ebook':
        setMode('reader');
        break;
      case 'game':
        setMode('gamedeck');
        break;
      case 'audio':
        setMode('media');
        break;
      case 'app':
        setMode('one');
        break;
      case 'product':
        setMode('one');
        break;
      default:
        setMode('one');
    }
  };

  const handleRemove = (itemId: string) => {
    removeFromLibraryMutation.mutate(itemId);
  };

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="library-no-wallet">
        <Library className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view your library</p>
      </div>
    );
  }

  if (libraryLoading || continueLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="library-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (libraryError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="library-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load library</p>
        <Button 
          variant="outline" 
          onClick={handleRefresh}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-library-retry"
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
      data-testid="library-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white/80" data-testid="text-library-title">My Library</h2>
          <span className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60" data-testid="text-library-count">
            {items.length} items
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleRefresh}
          className="text-white/60 hover:text-white p-2"
          data-testid="button-library-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2" data-testid="library-filters">
        {filters.map(filter => (
          <Button
            key={filter.key}
            variant={activeFilter === filter.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveFilter(filter.key)}
            className={`flex items-center gap-2 whitespace-nowrap ${
              activeFilter === filter.key
                ? 'bg-cyan-400/20 border-cyan-400/40 text-cyan-400'
                : 'border-white/20 text-white/60 hover:bg-white/10'
            }`}
            data-testid={`button-filter-${filter.key}`}
          >
            {filter.icon}
            {filter.label}
          </Button>
        ))}
      </div>

      {continueItems.length > 0 && (
        <div className="mb-8" data-testid="library-continue-section">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-light text-white/80" data-testid="text-continue-title">Continue</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4" data-testid="library-continue-list">
            {continueItems.map((item, index) => (
              <MotionDiv
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className="flex-shrink-0 w-64"
                data-testid={`continue-item-${item.id}`}
              >
                <Card className="bg-white/5 border-white/10 overflow-hidden hover:border-cyan-400/30 transition-all cursor-pointer group">
                  <div className="relative aspect-video bg-gradient-to-br from-white/10 to-white/5">
                    {item.thumbnail ? (
                      <img 
                        src={item.thumbnail} 
                        alt={item.title}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {getKindIcon(item.kind)}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        onClick={() => handlePlay(item)}
                        className="p-3 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-400"
                        data-testid={`button-continue-play-${item.id}`}
                      >
                        <Play className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                      <div 
                        className="h-full bg-cyan-400" 
                        style={{ width: `${item.progress}%` }}
                        data-testid={`progress-bar-${item.id}`}
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-white/90 truncate" data-testid={`text-continue-title-${item.id}`}>{item.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-cyan-400">{getContinueLabel(item.kind)}</span>
                      <span className="text-xs text-white/40">{item.progress}%</span>
                    </div>
                  </div>
                </Card>
              </MotionDiv>
            ))}
          </div>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="library-empty">
          <Library className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">Your library is empty</p>
          <p className="text-white/40 text-sm">
            {activeFilter === 'all' 
              ? 'Purchase or rent content to see it here' 
              : `No ${activeFilter} in your library`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="library-grid">
          {filteredItems.map((item, index) => (
            <MotionDiv
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              data-testid={`library-item-${item.id}`}
            >
              <Card className="bg-white/5 border-white/10 overflow-hidden hover:border-cyan-400/30 transition-all group">
                <div className="relative aspect-[3/4] bg-gradient-to-br from-white/10 to-white/5">
                  {item.thumbnail ? (
                    <img 
                      src={item.thumbnail} 
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {getKindIcon(item.kind)}
                    </div>
                  )}
                  
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-xs text-white/70">
                    {getKindIcon(item.kind)}
                    <span>{getKindLabel(item.kind)}</span>
                  </div>

                  {item.accessType === 'rental' && item.expiresAt && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-xs text-amber-400">
                      Rental
                    </div>
                  )}

                  {item.progress !== undefined && item.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                      <div 
                        className="h-full bg-cyan-400" 
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <button
                      onClick={() => handlePlay(item)}
                      className="p-3 rounded-full bg-cyan-400/20 border border-cyan-400/40 text-cyan-400 hover:bg-cyan-400/30 transition-colors"
                      data-testid={`button-play-${item.id}`}
                    >
                      <Play className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-2 rounded-full bg-red-400/20 border border-red-400/40 text-red-400 hover:bg-red-400/30 transition-colors"
                        data-testid={`button-remove-${item.id}`}
                        disabled={removeFromLibraryMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {item.kind !== 'game' && (
                        <button
                          className="p-2 rounded-full bg-white/10 border border-white/20 text-white/60 hover:bg-white/20 transition-colors"
                          data-testid={`button-download-${item.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="p-3">
                  <p className="text-sm text-white/90 truncate" data-testid={`text-item-title-${item.id}`}>{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-white/50" data-testid={`text-item-added-${item.id}`}>
                      Added {formatTimeAgo(item.addedAt)}
                    </span>
                    {item.expiresAt && (
                      <span className="text-xs text-amber-400" data-testid={`text-item-expires-${item.id}`}>
                        Expires {formatTimeAgo(item.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
