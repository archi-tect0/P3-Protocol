import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Video,
  Search,
  TrendingUp,
  Filter,
  User,
  DollarSign,
  Loader2,
  ChevronRight,
  Sparkles,
  Play,
  Eye,
  Film,
  Clapperboard,
} from 'lucide-react';
import { type Asset, type CatalogResponse } from '@/lib/sdk/marketplace';
import { useLongPress } from '@/hooks/use-long-press';
import { MarketplaceContextSheet } from '@/components/MarketplaceContextSheet';

const categories = [
  { value: 'all', label: 'All Categories' },
  { value: 'action', label: 'Action' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'drama', label: 'Drama' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'horror', label: 'Horror' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'animation', label: 'Animation' },
  { value: 'tutorial', label: 'Tutorial' },
];

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

function VideoCard({ 
  video, 
  onClick,
  onLongPress 
}: { 
  video: Asset; 
  onClick: () => void;
  onLongPress: (asset: Asset) => void;
}) {
  const { handlers, isLongPressing } = useLongPress({
    onLongPress: () => onLongPress(video),
    onClick,
  });

  return (
    <Card
      data-testid={`card-video-${video.id}`}
      className={`group relative overflow-hidden bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-rose-500/30 transition-all duration-300 cursor-pointer touch-manipulation ${isLongPressing ? 'scale-[0.98] ring-2 ring-rose-500/50' : ''}`}
      {...handlers}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-rose-600/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="relative p-4">
        <div className="aspect-video rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 mb-4 flex items-center justify-center overflow-hidden relative group">
          {video.coverUrl ? (
            <img
              src={video.coverUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Film className="w-12 h-12 text-rose-400" />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-rose-500 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform">
              <Play className="w-6 h-6 text-white fill-white ml-1" />
            </div>
          </div>
          {video.filesize && (
            <div className="absolute bottom-2 right-2 bg-black/70 rounded px-1.5 py-0.5 text-xs text-white font-medium">
              {Math.floor((video.filesize || 0) / 60000)}:{String(Math.floor(((video.filesize || 0) % 60000) / 1000)).padStart(2, '0')}
            </div>
          )}
        </div>
        <h3 className="font-semibold text-white mb-1 line-clamp-2 group-hover:text-rose-300 transition-colors">
          {video.title}
        </h3>
        <p className="text-sm text-slate-400 mb-2 truncate flex items-center gap-1">
          <User className="w-3 h-3" />
          {video.authorWallet.slice(0, 6)}...{video.authorWallet.slice(-4)}
        </p>
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="bg-green-500/20 text-green-300 border-0"
          >
            <DollarSign className="w-3 h-3 mr-0.5" />
            {video.priceUsd}
          </Badge>
          {video.totalStreams > 0 && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {video.totalStreams.toLocaleString()}
            </span>
          )}
        </div>
        {video.tags && video.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {video.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs border-white/10 text-slate-400"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeaturedSection({ 
  items,
  onLongPress 
}: { 
  items: Asset[];
  onLongPress: (asset: Asset) => void;
}) {
  const [, setLocation] = useLocation();

  if (items.length === 0) return null;

  return (
    <section data-testid="section-featured" className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Featured Videos</h2>
          <p className="text-sm text-slate-400">Editor's picks this week</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.slice(0, 4).map((video) => (
          <VideoCard
            key={video.id}
            video={video}
            onClick={() => setLocation(`/marketplace/video/${video.id}`)}
            onLongPress={onLongPress}
          />
        ))}
      </div>
    </section>
  );
}

function CategoriesSection() {
  const [, setLocation] = useLocation();

  const categoryCards = [
    { id: 'action', name: 'Action', icon: '🎬', color: 'from-red-500/20 to-orange-500/20' },
    { id: 'comedy', name: 'Comedy', icon: '😂', color: 'from-yellow-500/20 to-amber-500/20' },
    { id: 'drama', name: 'Drama', icon: '🎭', color: 'from-purple-500/20 to-pink-500/20' },
    { id: 'documentary', name: 'Documentary', icon: '📹', color: 'from-blue-500/20 to-cyan-500/20' },
    { id: 'tutorial', name: 'Tutorial', icon: '📚', color: 'from-green-500/20 to-teal-500/20' },
    { id: 'animation', name: 'Animation', icon: '✨', color: 'from-pink-500/20 to-rose-500/20' },
  ];

  return (
    <section data-testid="section-categories" className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
          <Clapperboard className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Browse Categories</h2>
          <p className="text-sm text-slate-400">Find videos by genre</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {categoryCards.map((cat) => (
          <Card
            key={cat.id}
            data-testid={`card-category-${cat.id}`}
            className="group cursor-pointer bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-rose-500/30 transition-all duration-300 touch-manipulation min-h-[100px]"
            onClick={() => setLocation(`/marketplace/video?category=${cat.id}`)}
          >
            <CardContent className="p-4 text-center">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-2xl`}>
                {cat.icon}
              </div>
              <p className="font-medium text-white group-hover:text-rose-300 transition-colors">
                {cat.name}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(8)].map((_, i) => (
        <Card
          key={i}
          className="bg-card/80 dark:bg-slate-900/80 border-border/5 overflow-hidden animate-pulse"
        >
          <CardContent className="p-4">
            <div className="aspect-video rounded-lg bg-slate-700/50 mb-4" />
            <div className="h-4 bg-slate-700/50 rounded mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-2/3 mb-2" />
            <div className="h-5 bg-slate-700/50 rounded w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function VideoHome() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [contextAsset, setContextAsset] = useState<Asset | null>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);

  const { data: featuredData } = useQuery<{ items: Asset[] }>({
    queryKey: ['/api/marketplace/catalog/featured', { type: 'video' }],
    staleTime: 5 * 60 * 1000,
  });

  const { data: catalogData, isLoading } = useQuery<CatalogResponse>({
    queryKey: ['/api/marketplace/catalog', { page, genre: category !== 'all' ? category : undefined, type: 'video' }],
    staleTime: 2 * 60 * 1000,
  });

  const { data: searchData, isLoading: isSearching } = useQuery<CatalogResponse>({
    queryKey: ['/api/marketplace/catalog/search', { q: searchQuery, type: 'video' }],
    enabled: searchQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  const displayItems = useMemo(() => {
    if (searchQuery.length >= 2 && searchData) {
      return searchData.items;
    }
    return catalogData?.items || [];
  }, [searchQuery, searchData, catalogData]);

  const filteredItems = useMemo(() => {
    let items = [...displayItems];

    if (category !== 'all') {
      items = items.filter((item) => item.category === category || item.tags?.includes(category));
    }

    switch (sortBy) {
      case 'trending':
        items.sort((a, b) => b.totalStreams - a.totalStreams);
        break;
      case 'price-low':
        items.sort((a, b) => parseFloat(a.priceUsd) - parseFloat(b.priceUsd));
        break;
      case 'price-high':
        items.sort((a, b) => parseFloat(b.priceUsd) - parseFloat(a.priceUsd));
        break;
      default:
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return items;
  }, [displayItems, category, sortBy]);

  const handleLongPress = useCallback((asset: Asset) => {
    setContextAsset(asset);
    setIsContextOpen(true);
  }, []);

  const handleContextClose = useCallback(() => {
    setIsContextOpen(false);
    setContextAsset(null);
  }, []);

  const handleNavigate = useCallback((assetId: string) => {
    setLocation(`/marketplace/video/${assetId}`);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background dark:bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-900/15 via-transparent to-orange-900/15 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-rose-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-6">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-4">
            <Button
              data-testid="button-back"
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white hover:bg-white/10 min-w-[44px] min-h-[44px]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Video Marketplace</h1>
                <p className="text-xs text-slate-400">
                  Protocol-native video streaming
                </p>
              </div>
            </div>
          </div>
          <Button
            data-testid="button-creator-studio"
            variant="outline"
            onClick={() => setLocation('/marketplace/video/studio')}
            className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 w-full sm:w-auto min-h-[44px]"
          >
            <Clapperboard className="w-4 h-4 mr-2" />
            Creator Studio
          </Button>
        </header>

        <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              data-testid="input-search"
              type="text"
              placeholder="Search videos, creators, or genres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/80 dark:bg-slate-900/80 border-border/10 text-foreground placeholder:text-muted-foreground focus:border-rose-500/50 min-h-[44px]"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rose-400 animate-spin" />
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                data-testid="select-category"
                className="w-full sm:w-[160px] bg-card/80 dark:bg-slate-900/80 border-border/10 text-foreground min-h-[44px]"
              >
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card dark:bg-slate-900 border-border/10">
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger
                data-testid="select-sort"
                className="w-full sm:w-[160px] bg-card/80 dark:bg-slate-900/80 border-border/10 text-foreground min-h-[44px]"
              >
                <TrendingUp className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card dark:bg-slate-900 border-border/10">
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!searchQuery && featuredData && featuredData.items.length > 0 && (
          <FeaturedSection items={featuredData.items} onLongPress={handleLongPress} />
        )}

        {!searchQuery && <CategoriesSection />}

        <section data-testid="section-all-videos">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center">
                <Film className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {searchQuery ? 'Search Results' : 'All Videos'}
                </h2>
                <p className="text-sm text-slate-400">
                  {filteredItems.length} video{filteredItems.length !== 1 && 's'}{' '}
                  {searchQuery && `for "${searchQuery}"`}
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredItems.length === 0 ? (
            <Card className="bg-card/60 dark:bg-slate-900/60 border-border/5 p-8 sm:p-12 text-center">
              <Video className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No videos found
              </h3>
              <p className="text-slate-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Check back later for new releases'}
              </p>
              {searchQuery && (
                <Button
                  data-testid="button-clear-search"
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                  className="border-white/10 text-white hover:bg-white/5 min-h-[44px]"
                >
                  Clear Search
                </Button>
              )}
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredItems.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    onClick={() => setLocation(`/marketplace/video/${video.id}`)}
                    onLongPress={handleLongPress}
                  />
                ))}
              </div>

              {catalogData && catalogData.hasMore && !searchQuery && (
                <div className="flex justify-center mt-8">
                  <Button
                    data-testid="button-load-more"
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10 min-h-[44px]"
                  >
                    Load More
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <MarketplaceContextSheet
        isOpen={isContextOpen}
        onClose={handleContextClose}
        asset={contextAsset}
        assetType="video"
        onNavigate={handleNavigate}
      />
    </div>
  );
}
