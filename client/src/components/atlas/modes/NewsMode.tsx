import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAtlasStore } from '@/state/useAtlasStore';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Newspaper, 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  Loader2,
  X,
  Zap,
  Globe,
  Cpu,
  Building2,
  Shield,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Layers,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

type ViewMode = 'grid' | 'flip';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  topic?: string;
}

interface NewsPageResponse {
  ok: boolean;
  articles: NewsArticle[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  nextPage: number | null;
}

type LaneType = 'all' | 'breaking' | 'tech' | 'business' | 'world';

interface Lane {
  id: LaneType;
  label: string;
  icon: typeof Newspaper;
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  keywords: string[];
}

const LANES: Lane[] = [
  { id: 'all', label: 'Top Stories', icon: Newspaper, color: 'cyan', bgClass: 'bg-cyan-500/20', textClass: 'text-cyan-400', borderClass: 'border-cyan-500/50', keywords: [] },
  { id: 'breaking', label: 'Breaking', icon: Zap, color: 'red', bgClass: 'bg-red-500/20', textClass: 'text-red-400', borderClass: 'border-red-500/50', keywords: ['breaking', 'urgent', 'alert', 'just in', 'developing'] },
  { id: 'tech', label: 'Tech', icon: Cpu, color: 'purple', bgClass: 'bg-purple-500/20', textClass: 'text-purple-400', borderClass: 'border-purple-500/50', keywords: ['tech', 'ai', 'software', 'startup', 'digital', 'crypto', 'blockchain', 'computer', 'app'] },
  { id: 'business', label: 'Business', icon: Building2, color: 'emerald', bgClass: 'bg-emerald-500/20', textClass: 'text-emerald-400', borderClass: 'border-emerald-500/50', keywords: ['business', 'market', 'economy', 'stock', 'finance', 'investment', 'trade', 'company'] },
  { id: 'world', label: 'World', icon: Globe, color: 'blue', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400', borderClass: 'border-blue-500/50', keywords: ['world', 'international', 'global', 'nation', 'country', 'politics', 'government'] },
];

const TRUSTED_SOURCES: Record<string, number> = {
  'reuters': 95,
  'associated press': 94,
  'ap news': 94,
  'bbc': 92,
  'the guardian': 88,
  'the new york times': 87,
  'washington post': 86,
  'financial times': 90,
  'bloomberg': 89,
  'cnbc': 82,
  'techcrunch': 80,
  'wired': 78,
  'ars technica': 85,
  'the verge': 76,
  'atlas news': 75,
  'cnn': 80,
  'nbc': 79,
  'abc news': 78,
};

function getTrustScore(source: string): number {
  const normalizedSource = source.toLowerCase();
  for (const [key, score] of Object.entries(TRUSTED_SOURCES)) {
    if (normalizedSource.includes(key)) return score;
  }
  return 65 + Math.floor(Math.random() * 15);
}

function getSentiment(title: string): 'positive' | 'neutral' | 'negative' {
  const lowerTitle = title.toLowerCase();
  const positiveWords = ['success', 'growth', 'gain', 'rise', 'up', 'record', 'breakthrough', 'win', 'boost', 'surge', 'rally'];
  const negativeWords = ['crash', 'fall', 'drop', 'crisis', 'war', 'attack', 'fail', 'loss', 'down', 'threat', 'collapse', 'plunge'];
  
  const hasPositive = positiveWords.some(w => lowerTitle.includes(w));
  const hasNegative = negativeWords.some(w => lowerTitle.includes(w));
  
  if (hasPositive && !hasNegative) return 'positive';
  if (hasNegative && !hasPositive) return 'negative';
  return 'neutral';
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function SkeletonTile() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden animate-pulse min-w-[280px] max-w-[320px] flex-shrink-0">
      <div className="h-36 bg-gradient-to-br from-white/10 to-white/5" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-white/10 rounded-full" />
          <div className="h-5 w-14 bg-white/10 rounded-full" />
        </div>
        <div className="h-4 bg-white/10 rounded w-full" />
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
        <div className="flex justify-between items-center pt-2">
          <div className="h-3 w-16 bg-white/10 rounded" />
          <div className="h-3 w-12 bg-white/10 rounded" />
        </div>
      </div>
    </div>
  );
}

function TrustBadge({ source, score }: { source: string; score: number }) {
  const getScoreColor = () => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 70) return 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10';
    return 'text-orange-400 border-orange-500/40 bg-orange-500/10';
  };

  const getScoreIcon = () => {
    if (score >= 85) return <CheckCircle2 className="w-3 h-3" />;
    if (score >= 70) return <Shield className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${getScoreColor()}`} data-testid="trust-badge">
      {getScoreIcon()}
      <span className="text-[10px] font-medium truncate max-w-[90px]">{source}</span>
      <span className="text-[9px] opacity-70 font-mono">{score}</span>
    </div>
  );
}

function SentimentDot({ sentiment }: { sentiment: 'positive' | 'neutral' | 'negative' }) {
  const colors = {
    positive: 'bg-emerald-500 shadow-emerald-500/50',
    neutral: 'bg-gray-400 shadow-gray-400/50',
    negative: 'bg-red-500 shadow-red-500/50',
  };
  
  return (
    <div 
      className={`w-2.5 h-2.5 rounded-full ${colors[sentiment]} shadow-lg`} 
      title={`${sentiment} sentiment`}
      data-testid="sentiment-dot"
    />
  );
}

function LiveTile({ article, onPrefetch }: { article: NewsArticle; onPrefetch?: () => void }) {
  const trustScore = getTrustScore(article.source);
  const sentiment = getSentiment(article.title);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 hover:border-white/20 transition-all group cursor-pointer min-w-[280px] max-w-[320px] flex-shrink-0"
      onMouseEnter={onPrefetch}
      data-testid={`live-tile-${article.id}`}
    >
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block">
        {article.imageUrl && !imageError ? (
          <div className="relative h-36 overflow-hidden bg-white/5">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />
            )}
            <img 
              src={article.imageUrl} 
              alt={article.title}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <TrustBadge source={article.source} score={trustScore} />
              <SentimentDot sentiment={sentiment} />
            </div>
          </div>
        ) : (
          <div className="h-16 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-between px-4">
            <TrustBadge source={article.source} score={trustScore} />
            <SentimentDot sentiment={sentiment} />
          </div>
        )}
        <div className="p-4">
          {article.topic && (
            <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400 bg-purple-500/10 mb-2">
              {article.topic}
            </Badge>
          )}
          <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 group-hover:text-cyan-300 transition-colors" data-testid={`text-news-title-${article.id}`}>
            {article.title}
          </h3>
          <p className="text-xs text-white/50 mb-3 line-clamp-2" data-testid={`text-news-desc-${article.id}`}>
            {article.description}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(article.publishedAt)}
            </div>
            <div className="flex items-center gap-1 text-xs text-cyan-400 group-hover:text-cyan-300 transition-colors">
              Read <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </div>
      </a>
    </MotionDiv>
  );
}

function FilterBar({ 
  activeLane, 
  onLaneChange, 
  searchQuery,
  onSearchChange,
  onSearch,
  onClear
}: { 
  activeLane: LaneType;
  onLaneChange: (lane: LaneType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3" data-testid="filter-bar">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {LANES.map((lane) => {
          const Icon = lane.icon;
          const isActive = activeLane === lane.id;
          return (
            <Button
              key={lane.id}
              variant="outline"
              size="sm"
              onClick={() => onLaneChange(lane.id)}
              className={`flex items-center gap-2 whitespace-nowrap transition-all ${
                isActive 
                  ? `${lane.bgClass} ${lane.borderClass} ${lane.textClass}` 
                  : 'border-white/20 text-white/60 hover:text-white hover:border-white/40 bg-transparent'
              }`}
              data-testid={`filter-lane-${lane.id}`}
            >
              <Icon className="w-4 h-4" />
              {lane.label}
            </Button>
          );
        })}
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search news topics..."
            className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-cyan-500/50"
            data-testid="input-search"
          />
          {searchQuery && (
            <button
              onClick={onClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              data-testid="button-clear-search"
            >
              <X className="w-3 h-3 text-white/60" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewsLane({ 
  lane, 
  articles, 
  isLoading,
  onPrefetch
}: { 
  lane: Lane;
  articles: NewsArticle[];
  isLoading: boolean;
  onPrefetch: (url: string) => void;
}) {
  const Icon = lane.icon;

  const filteredArticles = useMemo(() => {
    if (lane.id === 'all') return articles;
    
    return articles.filter(article => {
      const searchText = `${article.title} ${article.description} ${article.topic || ''}`.toLowerCase();
      return lane.keywords.some(keyword => searchText.includes(keyword));
    });
  }, [articles, lane]);

  if (!isLoading && filteredArticles.length === 0 && lane.id !== 'all') {
    return null;
  }

  return (
    <div className="space-y-3" data-testid={`news-lane-${lane.id}`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${lane.bgClass} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${lane.textClass}`} />
        </div>
        <h3 className="text-sm font-semibold text-white">{lane.label}</h3>
        <Badge variant="outline" className="text-[10px] border-white/20 text-white/50">
          {isLoading ? '...' : filteredArticles.length}
        </Badge>
        {lane.id === 'breaking' && filteredArticles.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-400 font-medium uppercase">Live</span>
          </div>
        )}
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {isLoading ? (
            <>
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
              <SkeletonTile />
            </>
          ) : filteredArticles.length > 0 ? (
            filteredArticles.slice(0, 12).map((article) => (
              <LiveTile 
                key={article.id} 
                article={article} 
                onPrefetch={() => onPrefetch(article.url)}
              />
            ))
          ) : (
            <div className="flex items-center justify-center w-full py-8 text-white/40 min-w-[280px]">
              <span className="text-sm">No {lane.label.toLowerCase()} stories</span>
            </div>
          )}
        </div>
        <ScrollBar orientation="horizontal" className="bg-white/5" />
      </ScrollArea>
    </div>
  );
}

function FlipViewCard({ 
  article, 
  direction 
}: { 
  article: NewsArticle; 
  direction: 'up' | 'down';
}) {
  const trustScore = getTrustScore(article.source);
  const sentiment = getSentiment(article.title);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <MotionDiv
      key={article.id}
      initial={{ 
        opacity: 0, 
        y: direction === 'up' ? 100 : -100,
        scale: 0.9 
      }}
      animate={{ 
        opacity: 1, 
        y: 0,
        scale: 1 
      }}
      exit={{ 
        opacity: 0, 
        y: direction === 'up' ? -100 : 100,
        scale: 0.9 
      }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      className="absolute inset-0 flex flex-col bg-gradient-to-b from-black/60 to-black/90 rounded-2xl overflow-hidden"
      data-testid={`flip-card-${article.id}`}
    >
      {article.imageUrl && !imageError ? (
        <div className="relative flex-1 min-h-[200px]">
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />
          )}
          <img 
            src={article.imageUrl} 
            alt={article.title}
            className={`w-full h-full object-cover ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
      ) : (
        <div className="flex-1 min-h-[200px] bg-gradient-to-br from-cyan-900/30 to-purple-900/30" />
      )}
      
      <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <TrustBadge source={article.source} score={trustScore} />
          <div className="flex items-center gap-2">
            <SentimentDot sentiment={sentiment} />
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(article.publishedAt)}
            </div>
          </div>
        </div>
        
        {article.topic && (
          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400 bg-purple-500/10">
            {article.topic}
          </Badge>
        )}
        
        <h2 className="text-xl font-bold text-white leading-tight" data-testid={`flip-title-${article.id}`}>
          {article.title}
        </h2>
        
        <p className="text-sm text-white/70 line-clamp-3" data-testid={`flip-desc-${article.id}`}>
          {article.description}
        </p>
        
        <a 
          href={article.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 rounded-lg text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          data-testid={`flip-read-${article.id}`}
        >
          Read Full Article
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </MotionDiv>
  );
}

function FlipView({ 
  articles, 
  isLoading,
  onLoadMore,
  hasMore,
  isFetchingMore
}: { 
  articles: NewsArticle[];
  isLoading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  isFetchingMore: boolean;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  const currentArticle = articles[currentIndex];
  const canGoNext = currentIndex < articles.length - 1;
  const canGoPrev = currentIndex > 0;

  useEffect(() => {
    if (currentIndex >= articles.length - 3 && hasMore && !isFetchingMore) {
      onLoadMore();
    }
  }, [currentIndex, articles.length, hasMore, isFetchingMore, onLoadMore]);

  const goNext = useCallback(() => {
    if (canGoNext) {
      setDirection('up');
      setCurrentIndex(prev => prev + 1);
    }
  }, [canGoNext]);

  const goPrev = useCallback(() => {
    if (canGoPrev) {
      setDirection('down');
      setCurrentIndex(prev => prev - 1);
    }
  }, [canGoPrev]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaY = touchStartY.current - touchEndY.current;
    const threshold = 50;
    
    if (deltaY > threshold) {
      goNext();
    } else if (deltaY < -threshold) {
      goPrev();
    }
  }, [goNext, goPrev]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const threshold = 30;
    if (e.deltaY > threshold) {
      goNext();
    } else if (e.deltaY < -threshold) {
      goPrev();
    }
  }, [goNext, goPrev]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'k') {
        goPrev();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        goNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="flip-loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-white/60 text-sm">Loading stories...</p>
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="flip-empty">
        <div className="flex flex-col items-center gap-4">
          <Newspaper className="w-12 h-12 text-white/30" />
          <p className="text-white/60 text-sm">No stories available</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="h-full flex flex-col relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      data-testid="flip-view"
    >
      <div className="flex-1 relative overflow-hidden rounded-2xl border border-white/10">
        <AnimatePresence mode="wait" initial={false}>
          {currentArticle && (
            <FlipViewCard 
              key={currentArticle.id}
              article={currentArticle} 
              direction={direction}
            />
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex items-center justify-between mt-4 px-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="border-white/20 hover:border-white/40 disabled:opacity-30"
            data-testid="flip-prev"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={!canGoNext && !hasMore}
            className="border-white/20 hover:border-white/40 disabled:opacity-30"
            data-testid="flip-next"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/50">
            {currentIndex + 1} / {articles.length}
            {hasMore && '+'}
          </span>
          {isFetchingMore && (
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          )}
        </div>
        
        <div className="flex items-center gap-1 text-xs text-white/40">
          <span>Swipe or use</span>
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">↑</kbd>
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[10px]">↓</kbd>
        </div>
      </div>
    </div>
  );
}

function ViewModeToggle({ 
  mode, 
  onChange 
}: { 
  mode: ViewMode; 
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg border border-white/10" data-testid="view-mode-toggle">
      <button
        onClick={() => onChange('grid')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === 'grid' 
            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' 
            : 'text-white/50 hover:text-white/70'
        }`}
        data-testid="view-mode-grid"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Grid
      </button>
      <button
        onClick={() => onChange('flip')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === 'flip' 
            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' 
            : 'text-white/50 hover:text-white/70'
        }`}
        data-testid="view-mode-flip"
      >
        <Layers className="w-3.5 h-3.5" />
        Flip
      </button>
    </div>
  );
}

export default function NewsMode() {
  const { pushReceipt, renderPayload } = useAtlasStore();
  useQueryClient(); // Kept for potential future cache invalidation
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeLane, setActiveLane] = useState<LaneType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renderPayload?.topic) {
      setSearchQuery(renderPayload.topic);
      setActiveSearch(renderPayload.topic);
    }
  }, [renderPayload]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim() !== activeSearch) {
        setActiveSearch(searchQuery.trim());
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeSearch]);

  const newsQuery = useInfiniteQuery<NewsPageResponse>({
    queryKey: activeSearch 
      ? ['/api/news/search', activeSearch] 
      : ['/api/news/top'],
    queryFn: async ({ pageParam = 1 }) => {
      const baseUrl = activeSearch 
        ? `/api/news/search?topic=${encodeURIComponent(activeSearch)}&page=${pageParam}`
        : `/api/news/top?page=${pageParam}`;
      const res = await fetch(baseUrl);
      if (!res.ok) throw new Error('Failed to fetch news');
      return res.json();
    },
    getNextPageParam: (lastPage, allPages) => lastPage.hasMore ? allPages.length + 1 : undefined,
    initialPageParam: 1,
    staleTime: 60000,
    gcTime: 300000,
  });

  const handleLoadMore = useCallback(() => {
    if (newsQuery.hasNextPage && !newsQuery.isFetchingNextPage) {
      newsQuery.fetchNextPage();
    }
  }, [newsQuery]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleLoadMore]);

  useEffect(() => {
    if (newsQuery.data?.pages?.[0]?.ok) {
      pushReceipt({
        id: `receipt-news-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: activeSearch ? 'atlas.news.search' : 'atlas.news.top',
        endpoint: activeSearch ? '/api/news/search' : '/api/news/top',
        timestamp: Date.now()
      });
    }
  }, [newsQuery.data?.pages?.length]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveSearch(searchQuery.trim());
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setActiveSearch('');
  };

  const handlePrefetch = useCallback((url: string) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }, []);

  const isLoading = newsQuery.isLoading;
  const isError = newsQuery.isError;
  const rawError = newsQuery.error;
  const errorMessage = rawError instanceof Error ? rawError.message : String(rawError || '');
  const articles = newsQuery.data?.pages?.flatMap(page => page.articles) || [];

  const activeLaneConfig = LANES.find(l => l.id === activeLane) || LANES[0];

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
      data-testid="news-mode"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center relative">
            <Newspaper className="w-5 h-5 text-cyan-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Atlas News
              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                LIVE
              </Badge>
            </h2>
            <p className="text-xs text-white/50">
              {activeSearch ? `Results for "${activeSearch}"` : 'Real-time global coverage'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle mode={viewMode} onChange={setViewMode} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => newsQuery.refetch()}
            className="border-white/20 hover:border-cyan-500/50"
            disabled={isLoading || newsQuery.isFetchingNextPage}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading || newsQuery.isFetchingNextPage ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <>
          <FilterBar
            activeLane={activeLane}
            onLaneChange={setActiveLane}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearch={handleSearch}
            onClear={handleClear}
          />

          <div className="flex-1 overflow-auto mt-4 space-y-6">
            {isError ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="news-error">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Newspaper className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-white/60 text-center">
                  Failed to load content. {errorMessage || 'Please try again.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => newsQuery.refetch()}
                  className="border-white/20"
                  data-testid="button-retry"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : activeLane === 'all' ? (
              <div className="space-y-6">
                {LANES.map((lane) => (
                  <NewsLane
                    key={lane.id}
                    lane={lane}
                    articles={articles}
                    isLoading={isLoading}
                    onPrefetch={handlePrefetch}
                  />
                ))}
                
                <div 
                  ref={loadMoreRef} 
                  className="flex justify-center py-6"
                  data-testid="news-load-more-trigger"
                >
                  {newsQuery.isFetchingNextPage ? (
                    <div className="flex items-center gap-2 text-white/60">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      <span className="text-sm">Loading more articles...</span>
                    </div>
                  ) : newsQuery.hasNextPage ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => newsQuery.fetchNextPage()}
                      className="border-white/20 text-white/60 hover:text-white"
                      data-testid="button-load-more"
                    >
                      Load more
                    </Button>
                  ) : articles.length > 12 ? (
                    <p className="text-white/40 text-sm">All articles loaded</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <NewsLane
                  lane={activeLaneConfig}
                  articles={articles}
                  isLoading={isLoading}
                  onPrefetch={handlePrefetch}
                />
                
                {!isLoading && articles.filter(a => {
                  const searchText = `${a.title} ${a.description} ${a.topic || ''}`.toLowerCase();
                  return activeLaneConfig.keywords.some(keyword => searchText.includes(keyword));
                }).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-white/40">
                    <activeLaneConfig.icon className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm">No {activeLaneConfig.label.toLowerCase()} stories found</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setActiveLane('all')}
                      className="mt-2 text-cyan-400"
                      data-testid="button-view-all"
                    >
                      View all stories
                    </Button>
                  </div>
                )}
                
                <div 
                  ref={loadMoreRef} 
                  className="flex justify-center py-6"
                  data-testid="news-load-more-trigger"
                >
                  {newsQuery.isFetchingNextPage && (
                    <div className="flex items-center gap-2 text-white/60">
                      <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      <span className="text-sm">Loading more articles...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 mt-4">
          <FlipView
            articles={articles}
            isLoading={isLoading}
            onLoadMore={handleLoadMore}
            hasMore={!!newsQuery.hasNextPage}
            isFetchingMore={newsQuery.isFetchingNextPage}
          />
        </div>
      )}
    </MotionDiv>
  );
}
