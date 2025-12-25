import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Package, Search, RefreshCw, Star,
  Loader2, Gamepad2, Film, BookOpen,
  Box, ShoppingBag, Music, Play, Clock,
  Settings, FileText, Info, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '../ProductCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AtlasOneItem {
  id: string;
  kind: 'game' | 'video' | 'ebook' | 'app' | 'product' | 'audio';
  title: string;
  slug: string;
  description?: string;
  thumbnail?: string;
  coverImage?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  priceWei?: string;
  currency: string;
  status: 'draft' | 'published' | 'archived' | 'suspended';
  featured: boolean;
  rating?: number;
  downloads: number;
  purchases: number;
  creatorWallet: string;
  createdAt: string;
  updatedAt: string;
}

interface CatalogResponse {
  items: AtlasOneItem[];
  count: number;
  filters: Record<string, any>;
}

interface VersionResponse {
  name: string;
  version: string;
  substrate: string;
  kinds: string[];
  features: string[];
}

const EXPERIENCE_TABS = [
  { value: 'all', label: 'All', icon: Package },
  { value: 'game', label: 'Games', icon: Gamepad2 },
  { value: 'video', label: 'Media', icon: Film },
  { value: 'ebook', label: 'Books', icon: BookOpen },
  { value: 'app', label: 'Apps', icon: Box },
  { value: 'product', label: 'Products', icon: ShoppingBag },
  { value: 'audio', label: 'Audio', icon: Music },
];

export function AtlasOneMode() {
  const { wallet } = useAtlasStore();
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const { data: versionData } = useQuery<VersionResponse>({
    queryKey: ['/api/atlas-one/version'],
  });

  const { data: catalogData, isLoading: isCatalogLoading, refetch: refetchCatalog } = useQuery<CatalogResponse>({
    queryKey: ['/api/atlas-one/catalog', activeTab, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.set('kind', activeTab);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '50');
      
      const res = await fetch(`/api/atlas-one/catalog?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch catalog');
      return res.json();
    },
  });

  const { data: continueData } = useQuery({
    queryKey: ['/api/atlas-one/library/continue', wallet],
    enabled: !!wallet,
    queryFn: async () => {
      if (!wallet) return { items: [], count: 0 };
      const res = await fetch('/api/atlas-one/library/continue', {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) return { items: [], count: 0 };
      return res.json();
    },
  });

  const handleSearch = () => {
    refetchCatalog();
  };

  const getKindIcon = (kind: string) => {
    const tab = EXPERIENCE_TABS.find(t => t.value === kind);
    return tab ? tab.icon : Package;
  };

  const formatPrice = (priceWei?: string) => {
    if (!priceWei || priceWei === '0') return 'Free';
    const ethValue = parseFloat(priceWei) / 1e18;
    return `${ethValue.toFixed(4)} ETH`;
  };

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full overflow-hidden flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
      data-testid="atlas-one-mode"
    >
      <div className="flex-shrink-0 p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="atlas-one-title">
                Atlas One
              </h1>
              <p className="text-xs text-slate-400">
                Unified Substrate Marketplace
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {versionData && (
              <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                v{versionData.version}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchCatalog()}
              className="text-slate-400 hover:text-white"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="text-slate-400 hover:text-white"
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search games, movies, books, apps..."
              className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-search"
            />
          </div>
          <Button
            onClick={handleSearch}
            className="bg-violet-600 hover:bg-violet-700"
            data-testid="button-search"
          >
            Search
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {wallet && continueData?.items?.length > 0 && (
          <section data-testid="section-continue">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-300">Continue</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {continueData.items.slice(0, 5).map((item: any) => (
                <Card
                  key={item.access.id}
                  className="flex-shrink-0 w-48 bg-slate-800/50 border-slate-700 hover:border-violet-500/50 transition-colors cursor-pointer"
                  data-testid={`card-continue-${item.access.id}`}
                >
                  <CardContent className="p-3">
                    <div className="aspect-video bg-slate-700 rounded-md mb-2 overflow-hidden">
                      {item.item.thumbnail ? (
                        <img
                          src={item.item.thumbnail}
                          alt={item.item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {(() => {
                            const Icon = getKindIcon(item.access.kind);
                            return <Icon className="w-8 h-8 text-slate-500" />;
                          })()}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {item.item.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-violet-500"
                          style={{ width: `${item.access.progress || 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {Math.round(item.access.progress || 0)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-slate-800/50 border border-slate-700 h-auto p-1 flex flex-wrap gap-1">
            {EXPERIENCE_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-1.5 text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white"
                data-testid={`tab-${tab.value}`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4">
            <AnimatePresence mode="wait">
              {isCatalogLoading ? (
                <MotionDiv
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-12"
                >
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </MotionDiv>
              ) : catalogData?.items?.length === 0 ? (
                <MotionDiv
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                  data-testid="empty-state"
                >
                  <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-slate-400">
                    No items found
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {searchQuery
                      ? `No results for "${searchQuery}"`
                      : 'The catalog is empty. Start by syncing content.'}
                  </p>
                </MotionDiv>
              ) : (
                <MotionDiv
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                >
                  {catalogData?.items?.map((item) => {
                    const KindIcon = getKindIcon(item.kind);
                    
                    if (item.kind === 'product') {
                      const metadata = (item as any).metadata || {};
                      return (
                        <ProductCard
                          key={item.id}
                          product={{
                            id: item.id,
                            source: metadata.source || 'atlas',
                            title: item.title,
                            description: item.description,
                            thumbnail: item.thumbnail,
                            priceWei: item.priceWei,
                            priceFiat: metadata.priceFiat,
                            merchantUrl: metadata.merchantUrl || '',
                            merchantName: metadata.merchantName,
                            category: item.category,
                            tags: item.tags,
                            inStock: metadata.inStock,
                          }}
                        />
                      );
                    }
                    
                    return (
                      <Card
                        key={item.id}
                        className="bg-slate-800/50 border-slate-700 hover:border-violet-500/50 transition-all cursor-pointer group"
                        data-testid={`card-item-${item.id}`}
                      >
                        <CardContent className="p-0">
                          <div className="aspect-video bg-slate-700 relative overflow-hidden">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <KindIcon className="w-12 h-12 text-slate-500" />
                              </div>
                            )}
                            
                            <div className="absolute top-2 right-2 flex gap-1">
                              {item.featured && (
                                <Badge className="bg-amber-500/80 text-xs">
                                  <Star className="w-3 h-3 mr-1" />
                                  Featured
                                </Badge>
                              )}
                            </div>
                            
                            <div className="absolute bottom-2 left-2">
                              <Badge variant="secondary" className="text-xs bg-black/50">
                                <KindIcon className="w-3 h-3 mr-1" />
                                {item.kind}
                              </Badge>
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                              <Button size="sm" className="bg-violet-600 hover:bg-violet-700">
                                <Play className="w-4 h-4 mr-1" />
                                Open
                              </Button>
                            </div>
                          </div>
                          
                          <div className="p-3">
                            <h3 className="font-medium text-white truncate">
                              {item.title}
                            </h3>
                            <p className="text-xs text-slate-400 truncate mt-0.5">
                              {item.category}
                              {item.subcategory && ` / ${item.subcategory}`}
                            </p>
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold text-violet-400">
                                {formatPrice(item.priceWei)}
                              </span>
                              {item.rating && (
                                <div className="flex items-center gap-1 text-amber-400">
                                  <Star className="w-3 h-3 fill-current" />
                                  <span className="text-xs">{item.rating.toFixed(1)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </MotionDiv>
              )}
            </AnimatePresence>
          </div>
        </Tabs>

        <section className="mt-8 pt-6 border-t border-slate-700/50" data-testid="section-info">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">About Atlas One</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {EXPERIENCE_TABS.slice(1).map((tab) => (
              <Card
                key={tab.value}
                className="bg-slate-800/30 border-slate-700/50 hover:border-violet-500/30 transition-colors cursor-pointer"
                data-testid={`info-${tab.value}`}
              >
                <CardContent className="p-3 text-center">
                  <tab.icon className="w-6 h-6 text-violet-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-slate-300">{tab.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {versionData && (
            <div className="mt-4 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
              <p className="text-xs text-slate-500">
                <strong className="text-slate-400">Substrate:</strong> {versionData.substrate} | {' '}
                <strong className="text-slate-400">Features:</strong> {versionData.features.join(', ')}
              </p>
            </div>
          )}
        </section>
      </div>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-400" />
              Atlas One Settings
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            <a
              href="/launcher/atlas-one-whitepaper"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
              data-testid="link-whitepaper"
            >
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Whitepaper</p>
                <p className="text-xs text-slate-400">Learn about Atlas One architecture</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </a>
            
            <a
              href="/launcher/atlas-one-whitepaper"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
              data-testid="link-about"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Info className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">About Atlas One</p>
                <p className="text-xs text-slate-400">Unified entertainment substrate</p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500" />
            </a>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Version</p>
                <p className="text-xs text-slate-400">
                  {versionData?.version || '1.0.0'} · {versionData?.substrate || 'Atlas One'}
                </p>
              </div>
            </div>
            
            {wallet && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Connected Wallet</p>
                  <p className="text-xs text-slate-400 font-mono">
                    {wallet.slice(0, 6)}...{wallet.slice(-4)}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">
              Part of P3 Protocol Mesh Architecture
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </MotionDiv>
  );
}

export default AtlasOneMode;
