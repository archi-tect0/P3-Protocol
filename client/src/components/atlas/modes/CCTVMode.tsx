import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Video, WifiOff, RefreshCw, MapPin, Activity, Eye, EyeOff, Maximize2, X, AlertTriangle, Grid3X3, LayoutList, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface StreamTile {
  id: string;
  name: string;
  location: string;
  endpoint: string;
  proxyEndpoint: string;
  type: 'mjpeg' | 'jpeg' | 'hls' | 'embed';
  embedProvider?: 'twitch' | 'youtube' | 'steam';
  status: 'live' | 'offline' | 'unknown';
  metrics: {
    latency: number;
    uptime: number;
    frameRate: number;
    lastCheck: number;
  };
  category: 'traffic' | 'weather' | 'public' | 'nature' | 'industrial' | 'gaming';
}

interface StreamsResponse {
  success: boolean;
  count: number;
  streams: StreamTile[];
}

type ViewMode = 'grid' | 'feed';

const subscriptionTokens = new Map<string, string>();
const activeSubscriptions = new Set<string>();

function generateSubscriptionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function useSubscriptionGuard(streamId: string, isVisible: boolean) {
  const tokenRef = useRef<string | null>(null);
  const isSubscribed = useRef(false);

  useEffect(() => {
    if (isVisible && !isSubscribed.current) {
      if (activeSubscriptions.has(streamId)) {
        return;
      }
      const token = generateSubscriptionToken();
      tokenRef.current = token;
      subscriptionTokens.set(streamId, token);
      activeSubscriptions.add(streamId);
      isSubscribed.current = true;
    }

    return () => {
      if (isSubscribed.current && tokenRef.current) {
        const currentToken = subscriptionTokens.get(streamId);
        if (currentToken === tokenRef.current) {
          subscriptionTokens.delete(streamId);
          activeSubscriptions.delete(streamId);
        }
        isSubscribed.current = false;
        tokenRef.current = null;
      }
    };
  }, [streamId, isVisible]);

  return {
    isActive: isSubscribed.current,
    token: tokenRef.current
  };
}

function useVisibilityCleanup(onHidden: () => void, onVisible: () => void) {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onHidden();
      } else {
        onVisible();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onHidden, onVisible]);
}

function StreamTileCard({ 
  stream, 
  isVisible, 
  onExpand,
  fullScreen = false
}: { 
  stream: StreamTile; 
  isVisible: boolean;
  onExpand: (stream: StreamTile) => void;
  fullScreen?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useSubscriptionGuard(stream.id, isVisible);

  useEffect(() => {
    if (!isVisible) {
      setLoaded(false);
      setError(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && stream.type === 'jpeg' && !isPaused) {
      abortControllerRef.current = new AbortController();
      // Increased from 5s to 20s to reduce server load (was causing 432 req/min with many tiles)
      intervalRef.current = setInterval(() => {
        setRefreshKey(k => k + 1);
      }, 20000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
      };
    }
  }, [isVisible, stream.type, isPaused]);

  useVisibilityCleanup(
    useCallback(() => {
      setIsPaused(true);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, []),
    useCallback(() => {
      setIsPaused(false);
      setRefreshKey(k => k + 1);
    }, [])
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const categoryColors: Record<string, string> = {
    traffic: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    weather: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    public: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    nature: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    industrial: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    gaming: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30'
  };

  const getEmbedUrl = (stream: StreamTile): string => {
    const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    switch (stream.embedProvider) {
      case 'twitch':
        return `https://player.twitch.tv/?channel=${stream.endpoint}&parent=${parentDomain}&muted=true`;
      case 'youtube':
        return `https://www.youtube.com/embed/${stream.endpoint}?autoplay=1&mute=1&controls=0&modestbranding=1`;
      case 'steam':
        return `https://steam.tv/embed/${stream.endpoint}`;
      default:
        return '';
    }
  };

  const streamUrl = stream.type === 'jpeg' 
    ? `${stream.proxyEndpoint}?t=${refreshKey}`
    : stream.proxyEndpoint;

  return (
    <div 
      className={`relative ${fullScreen ? 'w-full h-full' : 'aspect-square'} bg-slate-900/80 rounded-lg overflow-hidden border border-slate-700/50 group`}
      data-testid={`cctv-tile-${stream.id}`}
    >
      {isVisible && !isPaused ? (
        <>
          {!loaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                <span className="text-xs text-slate-400">Connecting via API v2...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="flex flex-col items-center gap-2 text-center p-4">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
                <span className="text-xs text-slate-400">Stream unavailable</span>
                <span className="text-[10px] text-slate-500">Endpoint may be offline</span>
              </div>
            </div>
          )}
          <div 
            className={`absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 ${loaded ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          />
          {stream.type === 'embed' ? (
            <iframe
              src={getEmbedUrl(stream)}
              title={stream.name}
              className={`w-full h-full border-0 ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          ) : (
            <img
              ref={imgRef}
              src={streamUrl}
              alt={stream.name}
              className={`w-full h-full object-cover ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
            />
          )}
          {showOverlay && loaded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
          )}
          {showOverlay && loaded && (
            <>
              <div className="absolute top-2 left-2 right-2 flex items-start justify-between">
                <Badge className={`text-[10px] ${categoryColors[stream.category]}`}>
                  {stream.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] text-white/80 font-medium">LIVE</span>
                </div>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 ${fullScreen ? 'p-4' : 'p-2'} space-y-1`}>
                <div className="flex items-center gap-1 text-white">
                  <Video className="w-3 h-3" />
                  <span className={`${fullScreen ? 'text-base' : 'text-xs'} font-medium truncate`}>{stream.name}</span>
                </div>
                <div className="flex items-center gap-1 text-white/60">
                  <MapPin className="w-2.5 h-2.5" />
                  <span className={`${fullScreen ? 'text-sm' : 'text-[10px]'} truncate`}>{stream.location}</span>
                </div>
                <div className={`flex items-center gap-2 ${fullScreen ? 'text-xs' : 'text-[9px]'} text-white/50`}>
                  <span className="flex items-center gap-0.5">
                    <Activity className="w-2.5 h-2.5" />
                    {stream.type === 'embed' ? stream.embedProvider : 'API v2 Bridge'}
                  </span>
                </div>
              </div>
            </>
          )}
          {!fullScreen && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6 bg-black/50 hover:bg-black/70"
                onClick={() => setShowOverlay(!showOverlay)}
              >
                {showOverlay ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="w-6 h-6 bg-black/50 hover:bg-black/70"
                onClick={() => onExpand(stream)}
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <Video className="w-8 h-8 text-slate-600" />
        </div>
      )}
    </div>
  );
}

function ExpandedView({ stream, onClose }: { stream: StreamTile; onClose: () => void }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (stream.type === 'jpeg' && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRefreshKey(k => k + 1);
      }, 3000);
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [stream.type, isPaused]);

  useVisibilityCleanup(
    useCallback(() => {
      setIsPaused(true);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, []),
    useCallback(() => {
      setIsPaused(false);
      setRefreshKey(k => k + 1);
    }, [])
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const streamUrl = stream.type === 'jpeg' 
    ? `${stream.proxyEndpoint}?t=${refreshKey}`
    : stream.proxyEndpoint;

  const getEmbedUrl = (): string => {
    const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    switch (stream.embedProvider) {
      case 'twitch':
        return `https://player.twitch.tv/?channel=${stream.endpoint}&parent=${parentDomain}&muted=false`;
      case 'youtube':
        return `https://www.youtube.com/embed/${stream.endpoint}?autoplay=1&mute=0`;
      case 'steam':
        return `https://steam.tv/embed/${stream.endpoint}`;
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {stream.type === 'embed' ? (
          <iframe
            src={getEmbedUrl()}
            title={stream.name}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <img
            src={streamUrl}
            alt={stream.name}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute top-4 left-4 right-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">{stream.name}</h3>
            <p className="text-sm text-white/60 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {stream.location}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="bg-black/50 hover:bg-black/70"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-white font-medium">
              {stream.type === 'embed' ? `LIVE via ${stream.embedProvider}` : 'LIVE via API v2'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              {stream.type === 'embed' ? `${stream.embedProvider} embed` : 'Proxied via API v2'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedView({ 
  streams, 
  onExpand 
}: { 
  streams: StreamTile[]; 
  onExpand: (stream: StreamTile) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  const currentStream = streams[currentIndex];
  const nextStream = streams[currentIndex + 1];

  const goToNext = useCallback(() => {
    if (currentIndex < streams.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(i => i + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, streams.length, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setCurrentIndex(i => i - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  }, [currentIndex, isTransitioning]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(deltaY) > 50) {
      if (deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
  };

  if (!currentStream) {
    return (
      <div className="flex items-center justify-center h-full">
        <WifiOff className="w-12 h-12 text-slate-600" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div 
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: `translateY(0)` }}
      >
        <StreamTileCard
          stream={currentStream}
          isVisible={true}
          onExpand={onExpand}
          fullScreen={true}
        />
      </div>
      
      {nextStream && (
        <div className="absolute inset-x-0 top-full h-full opacity-0 pointer-events-none">
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <Video className="w-12 h-12 text-slate-700" />
          </div>
        </div>
      )}

      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
        <Button
          size="icon"
          variant="ghost"
          className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm"
          onClick={goToPrev}
          disabled={currentIndex === 0}
        >
          <ChevronUp className="w-5 h-5" />
        </Button>
        <div className="text-center text-xs text-white/60 py-1">
          {currentIndex + 1}/{streams.length}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm"
          onClick={goToNext}
          disabled={currentIndex === streams.length - 1}
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      </div>

      <div className="absolute bottom-4 left-4 right-16 z-10">
        <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] mb-2">
          API v2 Feed • Swipe to navigate
        </Badge>
      </div>
    </div>
  );
}

function GridView({ 
  streams, 
  onExpand,
  filter
}: { 
  streams: StreamTile[]; 
  onExpand: (stream: StreamTile) => void;
  filter: string;
}) {
  const [visibleStreams, setVisibleStreams] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const filteredStreams = filter === 'all' 
    ? streams 
    : streams.filter(s => s.category === filter);

  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const streamId = entry.target.getAttribute('data-stream-id');
          if (streamId) {
            setVisibleStreams((prev) => {
              const next = new Set(prev);
              if (entry.isIntersecting) {
                next.add(streamId);
              } else {
                next.delete(streamId);
              }
              return next;
            });
          }
        });
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    tileRefs.current.forEach((element) => {
      observerRef.current?.observe(element);
    });
  }, []);

  useEffect(() => {
    setupObserver();
    return () => {
      observerRef.current?.disconnect();
    };
  }, [setupObserver]);

  useEffect(() => {
    return () => {
      setVisibleStreams(new Set());
      tileRefs.current.clear();
    };
  }, []);

  const registerTile = useCallback((id: string, element: HTMLDivElement | null) => {
    if (element) {
      tileRefs.current.set(id, element);
      observerRef.current?.observe(element);
    } else {
      const existing = tileRefs.current.get(id);
      if (existing) {
        observerRef.current?.unobserve(existing);
        tileRefs.current.delete(id);
      }
    }
  }, []);

  return (
    <div className="p-3">
      <div className="grid grid-cols-3 gap-2">
        {filteredStreams.map((stream) => (
          <div
            key={stream.id}
            ref={(el) => registerTile(stream.id, el)}
            data-stream-id={stream.id}
          >
            <StreamTileCard
              stream={stream}
              isVisible={visibleStreams.has(stream.id)}
              onExpand={onExpand}
            />
          </div>
        ))}
      </div>
      {filteredStreams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <WifiOff className="w-12 h-12 text-slate-600 mb-3" />
          <p className="text-slate-400">No streams in this category</p>
        </div>
      )}
      <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
        <p className="text-xs text-slate-500 text-center">
          Streams distributed via Atlas API v2 backbone • Lazy loading enabled
        </p>
      </div>
    </div>
  );
}

export default function CCTVMode() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [expandedStream, setExpandedStream] = useState<StreamTile | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<StreamsResponse>({
    queryKey: ['/api/atlas/cctv/streams'],
    refetchInterval: isPaused ? false : 30000,
    enabled: !isPaused
  });

  useVisibilityCleanup(
    useCallback(() => {
      setIsPaused(true);
    }, []),
    useCallback(() => {
      setIsPaused(false);
      queryClient.invalidateQueries({ queryKey: ['/api/atlas/cctv/streams'] });
    }, [queryClient])
  );

  useEffect(() => {
    return () => {
      // Clear local tracking
      subscriptionTokens.clear();
      activeSubscriptions.clear();
      
      // Notify server to immediately release connections (prevents user count spikes)
      fetch('/api/atlas/cctv/cleanup', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true // Ensure request completes even during navigation
      }).catch(() => {});
    };
  }, []);

  const streams = data?.streams || [];
  const categories = ['all', ...new Set(streams.map(s => s.category))];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-slate-400">Loading streams via API v2...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-950">
        <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
        <p className="text-slate-400">Failed to load streams</p>
        <p className="text-xs text-slate-500 mt-1">API v2 bridge unavailable</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="flex-shrink-0 p-3 border-b border-slate-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">CCTV</h2>
            <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">
              API v2 Bridge
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-400 mr-2">
              {streams.length} streams
            </div>
            <Button
              size="icon"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              className={`w-8 h-8 ${viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'}`}
              onClick={() => setViewMode('grid')}
              data-testid="cctv-view-grid"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === 'feed' ? 'default' : 'ghost'}
              className={`w-8 h-8 ${viewMode === 'feed' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'}`}
              onClick={() => setViewMode('feed')}
              data-testid="cctv-view-feed"
            >
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {viewMode === 'grid' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={filter === cat ? 'default' : 'ghost'}
                className={`text-xs capitalize ${
                  filter === cat 
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setFilter(cat)}
                data-testid={`cctv-filter-${cat}`}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {viewMode === 'grid' ? (
          <GridView 
            streams={streams} 
            onExpand={setExpandedStream}
            filter={filter}
          />
        ) : (
          <FeedView 
            streams={streams} 
            onExpand={setExpandedStream}
          />
        )}
      </div>

      {expandedStream && (
        <ExpandedView stream={expandedStream} onClose={() => setExpandedStream(null)} />
      )}
    </div>
  );
}
