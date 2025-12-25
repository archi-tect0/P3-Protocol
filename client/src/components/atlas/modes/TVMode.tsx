import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Tv, Search, Play, RefreshCw, AlertCircle, 
  Heart, Loader2, X, Radio, Zap, Clock, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Channel {
  id: string;
  name: string;
  category: string;
  region: string;
  logo: string | null;
  streamUrl: string | null;
  provider: string;
}

interface EPGProgram {
  title: string;
  start: string;
  stop: string;
  description?: string;
  category?: string;
}

interface EPGData {
  hasEPG: boolean;
  nowPlaying: EPGProgram | null;
  upNext: EPGProgram | null;
}

interface ChannelsResponse {
  channels: Channel[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
  offset: number;
  limit: number;
  receipt: { status: string };
}

interface FavoritesResponse {
  favorites: Channel[];
  count: number;
  receipt: { status: string };
}

interface BatchEPGResponse {
  epg: Record<string, EPGData>;
  count: number;
  receipt: { status: string };
}

const ROW_HEIGHT = 90;
const OVERSCAN = 5;

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTimeRemaining(stopTime: string): string {
  const now = new Date();
  const stop = new Date(stopTime);
  const diffMs = stop.getTime() - now.getTime();
  if (diffMs <= 0) return 'Ending...';
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m left`;
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hrs}h ${mins}m left`;
}

function EPGInfo({ epg }: { epg: EPGData | undefined }) {
  if (!epg || !epg.hasEPG) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5 mt-1" data-testid="epg-info">
      {epg.nowPlaying && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-medium">
            <Radio className="w-2.5 h-2.5" />
            NOW
          </span>
          <span className="text-white/70 truncate max-w-[180px]" title={epg.nowPlaying.title}>
            {epg.nowPlaying.title}
          </span>
          <span className="text-white/40 flex-shrink-0">
            • {getTimeRemaining(epg.nowPlaying.stop)}
          </span>
        </div>
      )}
      {epg.upNext && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">
            <Clock className="w-2.5 h-2.5" />
            NEXT
          </span>
          <span className="text-white/50 truncate max-w-[180px]" title={epg.upNext.title}>
            {epg.upNext.title}
          </span>
          <span className="text-white/30 flex-shrink-0">
            • {formatTime(epg.upNext.start)}
          </span>
        </div>
      )}
    </div>
  );
}

function ChannelRow({ 
  channel, 
  index,
  isFavorite, 
  onPlay, 
  onToggleFavorite,
  isPlaying,
  showWallet,
  epg
}: { 
  channel: Channel;
  index: number;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
  isPlaying: boolean;
  showWallet: boolean;
  epg?: EPGData;
}) {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite();
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPlay();
  };

  return (
    <MotionDiv
      className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${isPlaying ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400' : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      data-testid={`row-channel-${channel.id}`}
    >
      <div 
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={onPlay}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onPlay()}
      >
        <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          {channel.logo ? (
            <img 
              src={channel.logo} 
              alt={channel.name}
              className="w-full h-full object-contain p-1"
              loading="lazy"
              onError={(e) => { 
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-6 h-6 text-purple-400/60"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="15" x="2" y="7" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg></div>';
              }}
            />
          ) : (
            <Tv className="w-6 h-6 text-purple-400/60" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white/90 truncate text-sm">{channel.name}</h3>
            {isPlaying && (
              <span className="flex items-center gap-1 text-xs text-cyan-400">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </span>
            )}
            {epg?.hasEPG && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">
                <Calendar className="w-2.5 h-2.5 mr-0.5" />
                EPG
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300">
              {channel.category}
            </span>
            {channel.region && (
              <span className="text-xs text-white/40">{channel.region}</span>
            )}
          </div>
          <EPGInfo epg={epg} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
          onClick={handlePlayClick}
          data-testid={`button-play-${channel.id}`}
        >
          <Play className="w-4 h-4 fill-current" />
        </Button>

        {showWallet && (
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 rounded-full transition-colors ${
              isFavorite 
                ? 'bg-pink-500/20 text-pink-400' 
                : 'bg-white/5 text-white/40 hover:text-pink-400 hover:bg-pink-500/10'
            }`}
            onClick={handleFavoriteClick}
            data-testid={`button-favorite-${channel.id}`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </Button>
        )}
      </div>
    </MotionDiv>
  );
}

const LOAD_MORE_THRESHOLD = 5;

function VirtualizedChannelList({
  channels,
  favoriteIds,
  playingChannelId,
  onPlay,
  onToggleFavorite,
  showWallet,
  onLoadMore,
  hasMore,
  isFetchingMore,
  epgData,
}: {
  channels: Channel[];
  favoriteIds: Set<string>;
  playingChannelId: string | null;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channelId: string, isFavorite: boolean) => void;
  showWallet: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  epgData?: Record<string, EPGData>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => setContainerHeight(container.clientHeight);
    updateHeight();

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const { startIndex, visibleChannels, offsetY, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + OVERSCAN * 2;
    const end = Math.min(channels.length, start + visibleCount);
    
    return {
      startIndex: start,
      endIndex: end,
      visibleChannels: channels.slice(start, end),
      offsetY: start * ROW_HEIGHT,
    };
  }, [scrollTop, containerHeight, channels]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    if (!hasMore || isFetchingMore || !onLoadMore) return;
    const nearBottom = channels.length - endIndex <= LOAD_MORE_THRESHOLD;
    if (nearBottom) {
      onLoadMore();
    }
  }, [endIndex, channels.length, hasMore, isFetchingMore, onLoadMore]);

  const totalHeight = channels.length * ROW_HEIGHT;

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      onScroll={handleScroll}
      data-testid="tv-channel-list"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleChannels.map((channel, idx) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              index={startIndex + idx}
              isFavorite={favoriteIds.has(channel.id)}
              onPlay={() => onPlay(channel)}
              onToggleFavorite={() => onToggleFavorite(channel.id, favoriteIds.has(channel.id))}
              isPlaying={playingChannelId === channel.id}
              showWallet={showWallet}
              epg={epgData?.[channel.id]}
            />
          ))}
        </div>
      </div>
      {isFetchingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        </div>
      )}
    </div>
  );
}

export default function TVMode() {
  const { pushReceipt, wallet, addRunningApp } = useAtlasStore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavorites, setShowFavorites] = useState(false);
  const [playingChannelId, setPlayingChannelId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const runningAppIdRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const PAGE_SIZE = 100;
  
  const {
    data: channelsData,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<ChannelsResponse>({
    queryKey: ['/api/tv/channels'],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/tv/channels?limit=${PAGE_SIZE}&offset=${pageParam}`);
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
    initialPageParam: 0,
    enabled: !showFavorites && !debouncedSearch && selectedCategory === 'all',
  });

  const { data: searchData, isLoading: searching } = useQuery<ChannelsResponse>({
    queryKey: ['/api/tv/channels/search', debouncedSearch, selectedCategory === 'all' ? null : selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);
      const res = await fetch(`/api/tv/channels/search?${params}`);
      return res.json();
    },
    enabled: debouncedSearch.length > 0 || (selectedCategory !== 'all' && selectedCategory !== null),
  });

  const { data: favoritesData, isLoading: loadingFavorites } = useQuery<FavoritesResponse>({
    queryKey: ['/api/tv/favorites', wallet],
    enabled: !!wallet && showFavorites,
  });

  const { data: categoriesData } = useQuery<{ categories: string[] }>({
    queryKey: ['/api/tv/channels/categories'],
  });

  const visibleChannelIds = useMemo(() => {
    if (!channelsData?.pages) return [];
    const ids: string[] = [];
    for (const page of channelsData.pages) {
      for (const ch of page.channels) {
        ids.push(ch.id);
        if (ids.length >= 20) break;
      }
      if (ids.length >= 20) break;
    }
    return ids;
  }, [channelsData?.pages]);

  const { data: epgBatchData } = useQuery<BatchEPGResponse>({
    queryKey: ['/api/tv/epg/batch', visibleChannelIds.slice(0, 20).join(',')],
    queryFn: async () => {
      if (visibleChannelIds.length === 0) return { epg: {}, count: 0, receipt: { status: 'empty' } };
      const res = await fetch('/api/tv/epg/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: visibleChannelIds.slice(0, 20) }),
      });
      return res.json();
    },
    enabled: visibleChannelIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const epgData = useMemo(() => {
    return epgBatchData?.epg || {};
  }, [epgBatchData]);

  const addFavorite = useMutation({
    mutationFn: async (channelId: string) => {
      return apiRequest('/api/tv/favorites', {
        method: 'POST',
        body: JSON.stringify({ channelId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tv/favorites'] });
      toast({ title: 'Added to favorites' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add favorite', description: err.message, variant: 'destructive' });
    },
  });

  const removeFavorite = useMutation({
    mutationFn: async (channelId: string) => {
      return apiRequest(`/api/tv/favorites/${channelId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tv/favorites'] });
      toast({ title: 'Removed from favorites' });
    },
  });

  const handlePlayChannel = async (channel: Channel) => {
    setPlayingChannelId(channel.id);
    
    addRunningApp({
      mode: 'tv',
      name: channel.name,
      icon: 'Tv',
      state: 'playing',
      metadata: {
        title: channel.name,
        subtitle: `${channel.category} • ${channel.region || 'Live'}`,
      },
      supportsPip: true,
    });
    
    const apps = useAtlasStore.getState().runningApps;
    const myApp = apps.find(a => a.mode === 'tv');
    if (myApp) runningAppIdRef.current = myApp.id;
    
    try {
      const data = await apiRequest('/api/tv/play', {
        method: 'POST',
        body: JSON.stringify({ channelId: channel.id }),
      });
      
      if (data.streamUrl) {
        window.open(data.streamUrl, '_blank', 'noopener,noreferrer');
        toast({ 
          title: `Now playing: ${channel.name}`,
          description: 'Stream opened in new tab'
        });
      } else {
        toast({ title: 'No stream available', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Playback failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setTimeout(() => setPlayingChannelId(null), 2000);
    }
  };

  const handleToggleFavorite = (channelId: string, isFavorite: boolean) => {
    if (isFavorite) {
      removeFavorite.mutate(channelId);
    } else {
      addFavorite.mutate(channelId);
    }
  };

  useEffect(() => {
    if (channelsData?.pages?.[0]?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-tv-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.tv',
        endpoint: '/api/tv/channels',
        timestamp: Date.now()
      });
    }
  }, [channelsData?.pages]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-tv-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.tv.error',
        endpoint: '/api/tv/channels',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const allChannels = useMemo(() => {
    if (!channelsData?.pages) return [];
    const channels: Channel[] = [];
    const seen = new Set<string>();
    for (const page of channelsData.pages) {
      for (const ch of page.channels) {
        if (!seen.has(ch.id)) {
          seen.add(ch.id);
          channels.push(ch);
        }
      }
    }
    return channels;
  }, [channelsData?.pages]);

  const totalChannels = channelsData?.pages?.[0]?.total || 0;

  const displayChannels = useMemo(() => {
    if (debouncedSearch || (selectedCategory && selectedCategory !== 'all')) {
      return searchData?.channels || [];
    }
    if (showFavorites) {
      return favoritesData?.favorites || [];
    }
    return allChannels;
  }, [debouncedSearch, selectedCategory, searchData, showFavorites, favoritesData, allChannels]);

  const isLoadingChannels = isLoading || searching || loadingFavorites;
  const favoriteIds = useMemo(() => new Set(favoritesData?.favorites?.map(f => f.id) || []), [favoritesData]);

  if (isLoadingChannels && !displayChannels?.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4" data-testid="tv-loading">
        <MotionDiv
          className="w-12 h-12 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-white/40 text-sm">Loading channels...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="tv-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load channels</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-tv-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full flex flex-col relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-testid="tv-mode"
    >
      <div className="flex-shrink-0 p-4 border-b border-white/10 bg-gradient-to-b from-slate-900/50 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
              <Tv className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-white" data-testid="text-tv-title">
                {showFavorites ? 'My Channels' : 'TV Guide'}
              </h2>
              <p className="text-xs text-white/40">
                {totalChannels.toLocaleString()} channels available
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wallet && (
              <Button 
                variant={showFavorites ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowFavorites(!showFavorites)}
                className={showFavorites ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "text-white/60 hover:text-white"}
                data-testid="button-toggle-favorites"
              >
                <Heart className={`w-4 h-4 mr-1.5 ${showFavorites ? 'fill-current' : ''}`} />
                Favorites
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => refetch()}
              className="text-white/60 hover:text-white"
              data-testid="button-tv-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              ref={searchInputRef}
              placeholder="Search 10,895 channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              data-testid="input-tv-search"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger 
              className="w-[180px] bg-white/5 border-white/10 text-white focus:ring-cyan-500/20"
              data-testid="select-category"
            >
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-white/10">
              <SelectItem value="all" className="text-white hover:bg-white/10">
                All Categories
              </SelectItem>
              {categoriesData?.categories?.map((cat) => (
                <SelectItem 
                  key={cat} 
                  value={cat}
                  className="text-white hover:bg-white/10"
                >
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(searching || debouncedSearch) && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 flex items-center gap-2 text-sm text-white/60"
          >
            {searching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Found {displayChannels.length} channels</span>
              </>
            )}
          </MotionDiv>
        )}
      </div>

      <div className="px-4 py-2 flex items-center gap-4 text-xs text-white/40 border-b border-white/5 bg-slate-900/30">
        <span className="w-12"></span>
        <span className="flex-1">Channel</span>
        <span className="w-24 text-right">Actions</span>
      </div>

      {(!displayChannels || displayChannels.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center" data-testid="tv-empty">
          <Tv className="w-16 h-16 text-white/10 mb-4" />
          <p className="text-white/60 mb-2">
            {showFavorites ? 'No favorite channels yet' : 'No channels found'}
          </p>
          <p className="text-white/40 text-sm max-w-xs">
            {showFavorites 
              ? 'Click the heart icon on any channel to add it to your favorites' 
              : 'Try adjusting your search or category filter'}
          </p>
        </div>
      ) : (
        <VirtualizedChannelList
          channels={displayChannels}
          favoriteIds={favoriteIds}
          playingChannelId={playingChannelId}
          onPlay={handlePlayChannel}
          onToggleFavorite={handleToggleFavorite}
          showWallet={!!wallet}
          onLoadMore={() => fetchNextPage()}
          hasMore={hasNextPage && !showFavorites && !debouncedSearch && selectedCategory === 'all'}
          isFetchingMore={isFetchingNextPage}
          epgData={epgData}
        />
      )}

    </MotionDiv>
  );
}
