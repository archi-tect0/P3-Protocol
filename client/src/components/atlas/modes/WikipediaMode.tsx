import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAtlasStore } from '@/state/useAtlasStore';
import { MotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  BookOpen,
  Globe,
  Loader2,
  Shuffle,
  X
} from 'lucide-react';

interface WikiEntry {
  id: string;
  title: string;
  extract: string;
  url: string;
  imageUrl?: string;
  lastModified?: string;
}

interface WikiFeedEntry {
  id: string;
  title: string;
  extract: string;
  url: string;
  imageUrl?: string;
}

interface WikiFeedResponse {
  ok: boolean;
  entries: WikiFeedEntry[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextPage: number | null;
}

type ViewMode = 'search' | 'feed';

function WikiCard({ entry }: { entry: WikiEntry }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all"
      data-testid={`wiki-card-${entry.id}`}
    >
      <div className="flex">
        {entry.imageUrl && (
          <div className="w-32 h-32 flex-shrink-0">
            <img 
              src={entry.imageUrl} 
              alt={entry.title}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
        <div className="p-4 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
              Wikipedia
            </Badge>
          </div>
          <h3 className="text-sm font-medium text-white mb-2" data-testid={`text-wiki-title-${entry.id}`}>
            {entry.title}
          </h3>
          <p className="text-xs text-white/60 mb-3 line-clamp-3" data-testid={`text-wiki-extract-${entry.id}`}>
            {entry.extract}
          </p>
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            data-testid={`link-wiki-${entry.id}`}
          >
            Read on Wikipedia <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </MotionDiv>
  );
}

function WikiFeedCard({ entry }: { entry: WikiFeedEntry }) {
  const truncatedExtract = entry.extract.length > 150 
    ? entry.extract.slice(0, 150) + '...' 
    : entry.extract;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-all group"
      data-testid={`wiki-feed-card-${entry.id}`}
    >
      <div className="relative h-40 overflow-hidden">
        {entry.imageUrl ? (
          <img 
            src={entry.imageUrl} 
            alt={entry.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { 
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className={`w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 items-center justify-center ${entry.imageUrl ? 'hidden' : 'flex'}`}
        >
          <BookOpen className="w-12 h-12 text-purple-400/50" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">
            Wikipedia
          </Badge>
          <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400">
            Random
          </Badge>
        </div>
        <h3 className="text-sm font-medium text-white mb-2 line-clamp-2" data-testid={`text-wiki-title-${entry.id}`}>
          {entry.title}
        </h3>
        <p className="text-xs text-white/60 mb-3 line-clamp-3" data-testid={`text-wiki-extract-${entry.id}`}>
          {truncatedExtract}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
          onClick={() => window.open(entry.url, '_blank', 'noopener,noreferrer')}
          data-testid={`button-read-wiki-${entry.id}`}
        >
          <ExternalLink className="w-3 h-3 mr-2" />
          Read on Wikipedia
        </Button>
      </div>
    </MotionDiv>
  );
}

export default function WikipediaMode() {
  const { pushReceipt, renderPayload } = useAtlasStore();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renderPayload?.topic) {
      setSearchQuery(renderPayload.topic);
      setActiveSearch(renderPayload.topic);
      setViewMode('search');
    }
    if (renderPayload?.mode === 'search') {
      setViewMode('search');
    }
    if (renderPayload?.mode === 'feed') {
      setViewMode('feed');
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

  const wikiQuery = useQuery<{ ok: boolean; results: WikiEntry[] }>({
    queryKey: [`/api/wiki/search?term=${encodeURIComponent(activeSearch)}`],
    enabled: viewMode === 'search' && activeSearch.length > 0,
  });

  const wikiFeedQuery = useInfiniteQuery<WikiFeedResponse>({
    queryKey: ['/api/wiki/random'],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(`/api/wiki/random?page=${pageParam}&pageSize=10`);
      if (!res.ok) throw new Error('Failed to fetch wiki feed');
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled: viewMode === 'feed',
  });

  const handleLoadMore = useCallback(() => {
    if (viewMode === 'feed' && wikiFeedQuery.hasNextPage && !wikiFeedQuery.isFetchingNextPage) {
      wikiFeedQuery.fetchNextPage();
    }
  }, [viewMode, wikiFeedQuery]);

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
    if (wikiQuery.data?.ok) {
      pushReceipt({
        id: `receipt-wiki-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.wikipedia.search',
        endpoint: '/api/wiki/search',
        timestamp: Date.now()
      });
    }
  }, [wikiQuery.data]);

  useEffect(() => {
    if (wikiFeedQuery.data?.pages?.[0]?.ok) {
      pushReceipt({
        id: `receipt-wiki-feed-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.wikipedia.random',
        endpoint: '/api/wiki/random',
        timestamp: Date.now()
      });
    }
  }, [wikiFeedQuery.data?.pages?.length]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setActiveSearch(searchQuery.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleShuffle = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/wiki/random'] });
  };

  const isLoading = viewMode === 'search' ? wikiQuery.isLoading : wikiFeedQuery.isLoading;
  const isError = viewMode === 'search' ? wikiQuery.isError : wikiFeedQuery.isError;
  const rawError = viewMode === 'search' ? wikiQuery.error : wikiFeedQuery.error;
  const errorMessage = rawError instanceof Error ? rawError.message : String(rawError || '');
  const wikiResults = wikiQuery.data?.results || [];
  const wikiFeedEntries = wikiFeedQuery.data?.pages?.flatMap(page => page.entries) || [];

  const getHeaderIcon = () => {
    return viewMode === 'search' 
      ? <Globe className="w-5 h-5 text-blue-400" />
      : <Shuffle className="w-5 h-5 text-purple-400" />;
  };

  const getHeaderTitle = () => {
    return viewMode === 'search' ? 'Wikipedia Search' : 'Wiki Feed';
  };

  const getHeaderSubtitle = () => {
    return viewMode === 'search'
      ? (activeSearch ? `Searching "${activeSearch}"` : 'Search Wikipedia')
      : 'Random articles from Wikipedia';
  };

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col"
      data-testid="wikipedia-mode"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
            {getHeaderIcon()}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {getHeaderTitle()}
            </h2>
            <p className="text-xs text-white/50">
              {getHeaderSubtitle()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('search')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'search' ? 'bg-blue-500/20 text-blue-300' : 'text-white/50 hover:text-white'
              }`}
              data-testid="tab-wiki-search"
            >
              <Globe className="w-3 h-3" />
              Search
            </button>
            <button
              onClick={() => setViewMode('feed')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'feed' ? 'bg-purple-500/20 text-purple-300' : 'text-white/50 hover:text-white'
              }`}
              data-testid="tab-wiki-feed"
            >
              <Shuffle className="w-3 h-3" />
              Random Feed
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {viewMode === 'search' && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Wikipedia..."
              className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              data-testid="input-wiki-search"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveSearch('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                data-testid="button-clear-search"
              >
                <X className="w-3 h-3 text-white/60" />
              </button>
            )}
          </div>
        )}
        {viewMode === 'feed' && (
          <Button
            onClick={handleShuffle}
            className="bg-gradient-to-r from-purple-500 to-blue-500 text-white"
            data-testid="button-shuffle"
          >
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => {
            if (viewMode === 'search') {
              wikiQuery.refetch();
            } else {
              wikiFeedQuery.refetch();
            }
          }}
          className="border-white/20"
          data-testid="button-refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading || wikiFeedQuery.isFetchingNextPage ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center" data-testid="wiki-loading">
            <MotionDiv
              className="w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : isError ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="wiki-error">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-white/60 text-center">
              Failed to load content. {errorMessage || 'Please try again.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (viewMode === 'search') wikiQuery.refetch();
                else wikiFeedQuery.refetch();
              }}
              className="border-white/20"
              data-testid="button-retry"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        ) : viewMode === 'search' ? (
          wikiResults.length > 0 ? (
            <div className="space-y-4">
              {wikiResults.map((entry) => (
                <WikiCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : activeSearch ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="wiki-empty">
              <BookOpen className="w-12 h-12 text-white/20" />
              <p className="text-white/60 text-center">
                No Wikipedia articles found for "{activeSearch}"
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="wiki-prompt">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Search className="w-8 h-8 text-blue-400/60" />
              </div>
              <p className="text-white/60 text-center">
                Enter a search term to find Wikipedia articles
              </p>
            </div>
          )
        ) : (
          wikiFeedEntries.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wikiFeedEntries.map((entry) => (
                  <WikiFeedCard key={entry.id} entry={entry} />
                ))}
              </div>
              
              <div 
                ref={loadMoreRef} 
                className="flex justify-center py-6"
                data-testid="wiki-load-more-trigger"
              >
                {wikiFeedQuery.isFetchingNextPage ? (
                  <div className="flex items-center gap-2 text-white/60">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <span className="text-sm">Loading more articles...</span>
                  </div>
                ) : wikiFeedQuery.hasNextPage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => wikiFeedQuery.fetchNextPage()}
                    className="border-white/20 text-white/60 hover:text-white"
                    data-testid="button-load-more"
                  >
                    Load more
                  </Button>
                ) : wikiFeedEntries.length > 12 ? (
                  <p className="text-white/40 text-sm">All articles loaded</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="wiki-feed-empty">
              <Shuffle className="w-12 h-12 text-white/20" />
              <p className="text-white/60 text-center">
                No random articles available
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShuffle}
                className="border-white/20"
                data-testid="button-shuffle-retry"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )
        )}
      </div>
    </MotionDiv>
  );
}
