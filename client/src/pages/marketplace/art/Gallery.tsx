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
  Palette,
  Search,
  TrendingUp,
  Filter,
  User,
  DollarSign,
  Loader2,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Layers,
  Crown,
  Star,
} from 'lucide-react';
import { type Asset, type CatalogResponse } from '@/lib/sdk/marketplace';
import { useLongPress } from '@/hooks/use-long-press';
import { MarketplaceContextSheet } from '@/components/MarketplaceContextSheet';

const mediums = [
  { value: 'all', label: 'All Mediums' },
  { value: 'digital', label: 'Digital' },
  { value: 'photography', label: 'Photography' },
  { value: '3d', label: '3D' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'generative', label: 'Generative' },
];

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'editions', label: 'Most Editions' },
];

function EditionBadge({ total, sold }: { total?: number; sold?: number }) {
  if (!total || total <= 0) return null;
  const remaining = total - (sold || 0);
  const isLimited = remaining <= 10;
  const isSoldOut = remaining <= 0;

  return (
    <Badge
      data-testid="badge-edition"
      variant="secondary"
      className={`text-xs ${
        isSoldOut
          ? 'bg-slate-500/20 text-slate-400'
          : isLimited
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
          : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
      }`}
    >
      <Layers className="w-3 h-3 mr-1" />
      {isSoldOut ? 'Sold Out' : `${remaining} of ${total} left`}
    </Badge>
  );
}

function ArtworkCard({ 
  artwork, 
  onClick,
  onLongPress 
}: { 
  artwork: Asset; 
  onClick: () => void;
  onLongPress: (asset: Asset) => void;
}) {
  const { handlers, isLongPressing } = useLongPress({
    onLongPress: () => onLongPress(artwork),
    onClick,
  });

  return (
    <Card
      data-testid={`card-artwork-${artwork.id}`}
      className={`group relative overflow-hidden bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-purple-500/30 transition-all duration-300 cursor-pointer touch-manipulation ${isLongPressing ? 'scale-[0.98] ring-2 ring-purple-500/50' : ''}`}
      {...handlers}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="relative p-4">
        <div className="aspect-square rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-4 flex items-center justify-center overflow-hidden relative group">
          {artwork.coverUrl ? (
            <img
              src={artwork.coverUrl}
              alt={artwork.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <Palette className="w-12 h-12 text-purple-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <EditionBadge total={artwork.editionTotal} sold={artwork.editionSold} />
          </div>
        </div>
        <h3 className="font-semibold text-white mb-1 line-clamp-1 group-hover:text-purple-300 transition-colors">
          {artwork.title}
        </h3>
        <p className="text-sm text-slate-400 mb-2 truncate flex items-center gap-1">
          <User className="w-3 h-3" />
          {artwork.authorWallet.slice(0, 6)}...{artwork.authorWallet.slice(-4)}
        </p>
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="bg-green-500/20 text-green-300 border-0"
          >
            <DollarSign className="w-3 h-3 mr-0.5" />
            {artwork.priceUsd}
          </Badge>
          {artwork.totalDownloads > 0 && (
            <span className="text-xs text-slate-500">
              {artwork.totalDownloads} collected
            </span>
          )}
        </div>
        {artwork.tags && artwork.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {artwork.tags.slice(0, 2).map((tag) => (
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

  const featured = items[0];
  const rest = items.slice(1, 4);

  const featuredHandlers = useLongPress({
    onLongPress: () => onLongPress(featured),
    onClick: () => setLocation(`/marketplace/art/${featured.id}`),
  });

  return (
    <section data-testid="section-featured" className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Curated Spotlight</h2>
          <p className="text-sm text-slate-400">Handpicked by our curators</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        <Card
          data-testid={`card-featured-main-${featured.id}`}
          className={`group relative overflow-hidden bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-purple-500/30 transition-all duration-300 cursor-pointer touch-manipulation ${featuredHandlers.isLongPressing ? 'scale-[0.99] ring-2 ring-purple-500/50' : ''}`}
          {...featuredHandlers.handlers}
        >
          <div className="aspect-[4/3] relative overflow-hidden">
            {featured.coverUrl ? (
              <img
                src={featured.coverUrl}
                alt={featured.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Palette className="w-24 h-24 text-purple-400" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
              <Badge className="bg-amber-500/80 text-white border-0 mb-3">
                <Crown className="w-3 h-3 mr-1" />
                Featured
              </Badge>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">{featured.title}</h3>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-slate-300 flex items-center gap-2 text-sm">
                  <User className="w-4 h-4" />
                  {featured.authorWallet.slice(0, 8)}...{featured.authorWallet.slice(-6)}
                </p>
                <Badge className="bg-green-500/80 text-white border-0 text-base sm:text-lg px-3">
                  ${featured.priceUsd}
                </Badge>
              </div>
              {featured.editionTotal && (
                <div className="mt-3">
                  <EditionBadge total={featured.editionTotal} sold={featured.editionSold} />
                </div>
              )}
            </div>
          </div>
        </Card>
        <div className="grid gap-3 sm:gap-4">
          {rest.map((artwork) => {
            const itemHandlers = useLongPress({
              onLongPress: () => onLongPress(artwork),
              onClick: () => setLocation(`/marketplace/art/${artwork.id}`),
            });

            return (
              <Card
                key={artwork.id}
                data-testid={`card-featured-${artwork.id}`}
                className={`group relative overflow-hidden bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-purple-500/30 transition-all duration-300 cursor-pointer touch-manipulation ${itemHandlers.isLongPressing ? 'scale-[0.98] ring-2 ring-purple-500/50' : ''}`}
                {...itemHandlers.handlers}
              >
                <CardContent className="p-4 flex gap-4">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex-shrink-0 overflow-hidden">
                    {artwork.coverUrl ? (
                      <img
                        src={artwork.coverUrl}
                        alt={artwork.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Palette className="w-8 h-8 text-purple-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                      {artwork.title}
                    </h3>
                    <p className="text-sm text-slate-400 truncate">
                      {artwork.authorWallet.slice(0, 6)}...{artwork.authorWallet.slice(-4)}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge className="bg-green-500/20 text-green-300 border-0">
                        ${artwork.priceUsd}
                      </Badge>
                      <EditionBadge total={artwork.editionTotal} sold={artwork.editionSold} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ArtistSpotlight({ artists }: { artists: { wallet: string; count: number; earnings: number }[] }) {
  const [, setLocation] = useLocation();

  if (artists.length === 0) return null;

  return (
    <section data-testid="section-artists" className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
          <Star className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Top Creators</h2>
          <p className="text-sm text-slate-400">Most collected artists this week</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {artists.slice(0, 6).map((artist, i) => (
          <Card
            key={artist.wallet}
            data-testid={`card-artist-${i}`}
            className="group cursor-pointer bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-pink-500/30 transition-all duration-300 touch-manipulation min-h-[120px]"
            onClick={() => setLocation(`/marketplace/art?artist=${artist.wallet}`)}
          >
            <CardContent className="p-4 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg sm:text-xl">
                {artist.wallet.slice(2, 4).toUpperCase()}
              </div>
              <p className="font-medium text-white group-hover:text-pink-300 transition-colors truncate text-sm">
                {artist.wallet.slice(0, 6)}...{artist.wallet.slice(-4)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {artist.count} artwork{artist.count !== 1 && 's'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function MediumsSection() {
  const [, setLocation] = useLocation();

  const mediumCards = [
    { id: 'digital', name: 'Digital', icon: '🎨', color: 'from-purple-500/20 to-violet-500/20' },
    { id: 'photography', name: 'Photography', icon: '📸', color: 'from-blue-500/20 to-cyan-500/20' },
    { id: '3d', name: '3D Art', icon: '🎭', color: 'from-pink-500/20 to-rose-500/20' },
    { id: 'illustration', name: 'Illustration', icon: '✏️', color: 'from-amber-500/20 to-orange-500/20' },
    { id: 'generative', name: 'Generative', icon: '🔮', color: 'from-green-500/20 to-teal-500/20' },
  ];

  return (
    <section data-testid="section-mediums" className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Browse by Medium</h2>
          <p className="text-sm text-slate-400">Explore different art styles</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        {mediumCards.map((medium) => (
          <Card
            key={medium.id}
            data-testid={`card-medium-${medium.id}`}
            className="group cursor-pointer bg-card/80 dark:bg-slate-900/80 backdrop-blur-xl border-border/5 hover:border-purple-500/30 transition-all duration-300 touch-manipulation min-h-[100px]"
            onClick={() => setLocation(`/marketplace/art?medium=${medium.id}`)}
          >
            <CardContent className="p-4 text-center">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${medium.color} flex items-center justify-center text-2xl`}>
                {medium.icon}
              </div>
              <p className="font-medium text-white group-hover:text-purple-300 transition-colors">
                {medium.name}
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
    <div data-testid="loading-skeleton" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(10)].map((_, i) => (
        <Card
          key={i}
          className="bg-card/80 dark:bg-slate-900/80 border-border/5 overflow-hidden animate-pulse"
        >
          <CardContent className="p-4">
            <div className="aspect-square rounded-lg bg-slate-700/50 mb-4" />
            <div className="h-4 bg-slate-700/50 rounded mb-2" />
            <div className="h-3 bg-slate-700/50 rounded w-2/3 mb-2" />
            <div className="h-5 bg-slate-700/50 rounded w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Gallery() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [medium, setMedium] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [contextAsset, setContextAsset] = useState<Asset | null>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);

  const { data: featuredData } = useQuery<{ items: Asset[] }>({
    queryKey: ['/api/marketplace/catalog/featured', { type: 'art' }],
    staleTime: 5 * 60 * 1000,
  });

  const { data: catalogData, isLoading } = useQuery<CatalogResponse>({
    queryKey: ['/api/marketplace/catalog', { page, medium: medium !== 'all' ? medium : undefined, type: 'art' }],
    staleTime: 2 * 60 * 1000,
  });

  const { data: searchData, isLoading: isSearching } = useQuery<CatalogResponse>({
    queryKey: ['/api/marketplace/catalog/search', { q: searchQuery, type: 'art' }],
    enabled: searchQuery.length >= 2,
    staleTime: 30 * 1000,
  });

  const topArtists = useMemo(() => {
    const items = catalogData?.items || [];
    const artistMap = new Map<string, { count: number; earnings: number }>();
    items.forEach((item) => {
      const existing = artistMap.get(item.authorWallet) || { count: 0, earnings: 0 };
      artistMap.set(item.authorWallet, {
        count: existing.count + 1,
        earnings: existing.earnings + parseFloat(item.priceUsd),
      });
    });
    return Array.from(artistMap.entries())
      .map(([wallet, data]) => ({ wallet, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [catalogData]);

  const displayItems = useMemo(() => {
    if (searchQuery.length >= 2 && searchData) {
      return searchData.items;
    }
    return catalogData?.items || [];
  }, [searchQuery, searchData, catalogData]);

  const filteredItems = useMemo(() => {
    let items = [...displayItems];

    if (medium !== 'all') {
      items = items.filter((item) => item.category === medium || item.tags?.includes(medium));
    }

    switch (sortBy) {
      case 'trending':
        items.sort((a, b) => b.totalDownloads - a.totalDownloads);
        break;
      case 'price-low':
        items.sort((a, b) => parseFloat(a.priceUsd) - parseFloat(b.priceUsd));
        break;
      case 'price-high':
        items.sort((a, b) => parseFloat(b.priceUsd) - parseFloat(a.priceUsd));
        break;
      case 'editions':
        items.sort((a, b) => (b.editionTotal || 0) - (a.editionTotal || 0));
        break;
      default:
        items.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return items;
  }, [displayItems, medium, sortBy]);

  const handleLongPress = useCallback((asset: Asset) => {
    setContextAsset(asset);
    setIsContextOpen(true);
  }, []);

  const handleContextClose = useCallback(() => {
    setIsContextOpen(false);
    setContextAsset(null);
  }, []);

  const handleNavigate = useCallback((assetId: string) => {
    setLocation(`/marketplace/art/${assetId}`);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background dark:bg-slate-950">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-pink-900/15 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />

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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Art Marketplace</h1>
                <p className="text-xs text-slate-400">
                  Collect digital art with provenance
                </p>
              </div>
            </div>
          </div>
          <Button
            data-testid="button-artist-studio"
            variant="outline"
            onClick={() => setLocation('/marketplace/art/studio')}
            className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 w-full sm:w-auto min-h-[44px]"
          >
            <Palette className="w-4 h-4 mr-2" />
            Artist Studio
          </Button>
        </header>

        <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              data-testid="input-search"
              type="text"
              placeholder="Search artworks, artists, or styles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card/80 dark:bg-slate-900/80 border-border/10 text-foreground placeholder:text-muted-foreground focus:border-purple-500/50 min-h-[44px]"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 animate-spin" />
            )}
          </div>
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Select value={medium} onValueChange={setMedium}>
              <SelectTrigger
                data-testid="select-medium"
                className="w-full sm:w-[160px] bg-card/80 dark:bg-slate-900/80 border-border/10 text-foreground min-h-[44px]"
              >
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card dark:bg-slate-900 border-border/10">
                {mediums.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
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

        {!searchQuery && topArtists.length > 0 && (
          <ArtistSpotlight artists={topArtists} />
        )}

        {!searchQuery && <MediumsSection />}

        <section data-testid="section-all-artworks">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {searchQuery ? 'Search Results' : 'All Artworks'}
                </h2>
                <p className="text-sm text-slate-400">
                  {filteredItems.length} artwork{filteredItems.length !== 1 && 's'}{' '}
                  {searchQuery && `for "${searchQuery}"`}
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredItems.length === 0 ? (
            <Card className="bg-card/60 dark:bg-slate-900/60 border-border/5 p-8 sm:p-12 text-center">
              <Palette className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                No artworks found
              </h3>
              <p className="text-slate-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Check back later for new creations'}
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
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredItems.map((artwork) => (
                  <ArtworkCard
                    key={artwork.id}
                    artwork={artwork}
                    onClick={() => setLocation(`/marketplace/art/${artwork.id}`)}
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
                    className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 min-h-[44px]"
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
        assetType="art"
        onNavigate={handleNavigate}
      />
    </div>
  );
}
