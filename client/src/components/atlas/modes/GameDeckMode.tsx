import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Gamepad2, Search, RefreshCw, Plus, ExternalLink, Heart, Star,
  Loader2, AlertCircle, Upload, BarChart3, Coins, Image,
  GripVertical, X, Package, Users, UserPlus, Check, XCircle,
  Clock, Send, ToggleLeft, ToggleRight, Download, Box, Edit, 
  ShoppingCart, Receipt, DollarSign, Globe, FileCode
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Game {
  id: string;
  title: string;
  genre: string | null;
  platform: string | null;
  url: string | null;
  thumbnail: string | null;
  source: string;
  developer: string | null;
  description: string | null;
  tags: string[] | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface GameFavorite {
  id: string;
  wallet: string;
  gameId: string;
  position: number;
  createdAt: string;
  game?: Game;
}

interface GameNft {
  id: string;
  wallet: string;
  chain: string;
  contract: string;
  tokenId: string;
  name: string | null;
  description: string | null;
  image: string | null;
  attributes: any[] | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface LedgerEntry {
  id: string;
  wallet: string;
  action: string;
  feeWei: string;
  chain: string;
  createdAt: string;
}

interface Mod {
  id: string;
  gameId: string;
  name: string;
  slug: string;
  source: 'curseforge' | 'modrinth' | 'developer';
  version: string | null;
  description: string | null;
  thumbnail: string | null;
  installCount: number;
  enabled: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface Invite {
  id: string;
  fromWallet: string;
  toWallet: string;
  status: 'pending' | 'accepted' | 'declined';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

interface GamesResponse {
  games: Game[];
  pagination: { limit: number; offset: number; count: number };
}

interface NftsResponse {
  wallet: string;
  nfts: GameNft[];
  count: number;
}

interface LedgerResponse {
  wallet: string;
  entries: LedgerEntry[];
  count: number;
}

interface ModsResponse {
  mods: Mod[];
  count: number;
}

interface InvitesResponse {
  pending: Invite[];
  sent: Invite[];
}

interface SyncResult {
  source: string;
  fetched: number;
  upserted: number;
  errors: string[];
}

interface ModSyncResult {
  source: string;
  gameId: string;
  fetched: number;
  upserted: number;
  errors: string[];
}

interface SandboxGame {
  id: string;
  wallet: string;
  title: string;
  description: string | null;
  genre: string | null;
  platform: string | null;
  thumbnail: string | null;
  status: 'draft' | 'published';
  version: string;
  price: string | null;
  endpoints: string[] | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface Purchase {
  id: string;
  wallet: string;
  gameId: string;
  price: string;
  txHash: string | null;
  status: 'pending' | 'completed' | 'failed';
  receiptId: string | null;
  createdAt: string;
  game?: Game;
}

interface SandboxGamesResponse {
  games: SandboxGame[];
  count: number;
}

interface PurchasesResponse {
  purchases: Purchase[];
  count: number;
}

type MainTab = 'discover' | 'library' | 'creator';
type DiscoverSubTab = 'catalog' | 'mods';
type LibrarySubTab = 'favorites' | 'purchases' | 'assets';
type CreatorSubTab = 'sandbox' | 'developer' | 'social';

const GENRES = ['Action', 'Adventure', 'MMORPG', 'Shooter', 'Strategy', 'Sports', 'Racing', 'Card', 'MOBA', 'Battle Royale', 'Fighting', 'Fantasy'];
const PLATFORMS = ['PC (Windows)', 'Web Browser', 'All Platforms'];

export default function GameDeckMode() {
  const { wallet, pushReceipt } = useAtlasStore();
  const { toast } = useToast();

  const [mainTab, setMainTab] = useState<MainTab>('discover');
  const [discoverSubTab, setDiscoverSubTab] = useState<DiscoverSubTab>('catalog');
  const [librarySubTab, setLibrarySubTab] = useState<LibrarySubTab>('favorites');
  const [creatorSubTab, setCreatorSubTab] = useState<CreatorSubTab>('sandbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [inviteWallet, setInviteWallet] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  const [submitForm, setSubmitForm] = useState({
    title: '',
    genre: '',
    platform: '',
    url: '',
    thumbnail: '',
    developer: '',
    description: '',
  });

  const [showCreateSandboxForm, setShowCreateSandboxForm] = useState(false);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState<{ game: Game; price: string } | null>(null);
  const [selectedSandboxGame, setSelectedSandboxGame] = useState<SandboxGame | null>(null);
  const [showBuildUpload, setShowBuildUpload] = useState(false);
  const [buildVersion, setBuildVersion] = useState('');
  const [buildChangelog, setBuildChangelog] = useState('');

  const [sandboxForm, setSandboxForm] = useState({
    title: '',
    description: '',
    genre: '',
    platform: '',
    thumbnail: '',
    price: '',
  });

  const gamesQuery = useQuery<GamesResponse>({
    queryKey: ['/api/gamedeck/games', searchQuery, genreFilter, platformFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (genreFilter && genreFilter !== 'all') params.append('genre', genreFilter);
      if (platformFilter && platformFilter !== 'all') params.append('platform', platformFilter);
      params.append('limit', '50');
      const res = await fetch(`/api/gamedeck/games?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch games');
      return res.json();
    },
  });

  const modsQuery = useQuery<ModsResponse>({
    queryKey: ['/api/gamedeck/mods', selectedGameId],
    queryFn: async () => {
      if (!selectedGameId) return { mods: [], count: 0 };
      const res = await fetch(`/api/gamedeck/mods/${selectedGameId}`);
      if (!res.ok) throw new Error('Failed to fetch mods');
      return res.json();
    },
    enabled: mainTab === 'discover' && discoverSubTab === 'mods' && !!selectedGameId,
  });

  const invitesQuery = useQuery<InvitesResponse>({
    queryKey: ['/api/gamedeck/invites', wallet],
    queryFn: async () => {
      if (!wallet) return { pending: [], sent: [] };
      const res = await fetch('/api/gamedeck/invites', {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) throw new Error('Failed to fetch invites');
      return res.json();
    },
    enabled: mainTab === 'creator' && creatorSubTab === 'social' && !!wallet,
  });

  const nftsQuery = useQuery<NftsResponse>({
    queryKey: ['/api/gamedeck/nfts'],
    enabled: !!wallet && mainTab === 'library' && librarySubTab === 'assets',
  });

  const ledgerQuery = useQuery<LedgerResponse>({
    queryKey: ['/api/gamedeck/ledger', wallet],
    queryFn: async () => {
      if (!wallet) throw new Error('No wallet');
      const res = await fetch(`/api/gamedeck/ledger/${wallet}`);
      if (!res.ok) throw new Error('Failed to fetch ledger');
      return res.json();
    },
    enabled: !!wallet && mainTab === 'creator' && creatorSubTab === 'developer',
  });

  const favoritesQuery = useQuery<{ favorites: GameFavorite[] }>({
    queryKey: ['/api/gamedeck/favorites', wallet],
    queryFn: async () => {
      if (!wallet) return { favorites: [] };
      const res = await fetch(`/api/gamedeck/favorites?wallet=${wallet}`, {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) return { favorites: [] };
      return res.json();
    },
    enabled: !!wallet,
  });

  const sandboxGamesQuery = useQuery<SandboxGamesResponse>({
    queryKey: ['/api/gamedeck/sandbox/games', wallet],
    queryFn: async () => {
      if (!wallet) return { games: [], count: 0 };
      const res = await fetch('/api/gamedeck/sandbox/games', {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) throw new Error('Failed to fetch sandbox games');
      return res.json();
    },
    enabled: mainTab === 'creator' && creatorSubTab === 'sandbox' && !!wallet,
  });

  const purchasesQuery = useQuery<PurchasesResponse>({
    queryKey: ['/api/gamedeck/purchases', wallet],
    queryFn: async () => {
      if (!wallet) return { purchases: [], count: 0 };
      const res = await fetch('/api/gamedeck/purchases', {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) throw new Error('Failed to fetch purchases');
      return res.json();
    },
    enabled: !!wallet,
  });

  const syncMutation = useMutation({
    mutationFn: async (source: 'freetogame' | 'gamerpower') => {
      return apiRequest('/api/gamedeck/games/pull', {
        method: 'POST',
        body: JSON.stringify({ source }),
      }) as Promise<SyncResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/games'] });
      pushReceipt({
        id: `gamedeck-sync-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: `sync.${data.source}`,
        timestamp: Date.now(),
        data: { fetched: data.fetched, upserted: data.upserted },
      });
      toast({
        title: 'Sync Complete',
        description: `Synced ${data.upserted} games from ${data.source}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Sync Failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const syncModsMutation = useMutation({
    mutationFn: async ({ source, gameId }: { source: 'curseforge' | 'modrinth'; gameId: string }) => {
      return apiRequest('/api/gamedeck/mods/sync', {
        method: 'POST',
        body: JSON.stringify({ source, gameId }),
      }) as Promise<ModSyncResult>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/mods', data.gameId] });
      pushReceipt({
        id: `gamedeck-modsync-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: `mods.sync.${data.source}`,
        timestamp: Date.now(),
        data: { fetched: data.fetched, upserted: data.upserted },
      });
      toast({
        title: 'Mods Synced',
        description: `Synced ${data.upserted} mods from ${data.source === 'curseforge' ? 'CurseForge' : 'Modrinth'}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Mod Sync Failed',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const enableModMutation = useMutation({
    mutationFn: async (modId: string) => {
      return apiRequest(`/api/gamedeck/mods/enable/${modId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/mods', selectedGameId] });
      toast({ title: 'Mod Enabled' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to enable mod', description: err.message, variant: 'destructive' });
    },
  });

  const disableModMutation = useMutation({
    mutationFn: async (modId: string) => {
      return apiRequest(`/api/gamedeck/mods/disable/${modId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/mods', selectedGameId] });
      toast({ title: 'Mod Disabled' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to disable mod', description: err.message, variant: 'destructive' });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async ({ toWallet, message }: { toWallet: string; message?: string }) => {
      return apiRequest('/api/gamedeck/invite', {
        method: 'POST',
        body: JSON.stringify({ toWallet, message }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/invites', wallet] });
      pushReceipt({
        id: `gamedeck-invite-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'invite.send',
        timestamp: Date.now(),
        data: { toWallet: inviteWallet },
      });
      toast({ title: 'Invite Sent' });
      setInviteWallet('');
      setInviteMessage('');
    },
    onError: (err: any) => {
      toast({ title: 'Failed to send invite', description: err.message, variant: 'destructive' });
    },
  });

  const respondInviteMutation = useMutation({
    mutationFn: async ({ inviteId, response }: { inviteId: string; response: 'accept' | 'decline' }) => {
      return apiRequest(`/api/gamedeck/invite/${inviteId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/invites', wallet] });
      toast({ title: variables.response === 'accept' ? 'Invite Accepted' : 'Invite Declined' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to respond', description: err.message, variant: 'destructive' });
    },
  });

  const favoriteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      return apiRequest('/api/gamedeck/games/favorite', {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      });
    },
    onSuccess: (_, gameId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/favorites'] });
      pushReceipt({
        id: `gamedeck-fav-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'game.favorite',
        timestamp: Date.now(),
        data: { gameId },
      });
      toast({ title: 'Added to Favorites' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to add favorite', description: err.message, variant: 'destructive' });
    },
  });

  const submitGameMutation = useMutation({
    mutationFn: async (data: typeof submitForm) => {
      return apiRequest('/api/gamedeck/submit', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/games'] });
      pushReceipt({
        id: `gamedeck-submit-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'game.submit',
        timestamp: Date.now(),
        data: { gameId: data.game?.id },
      });
      toast({ title: 'Game Submitted', description: 'Your game is now in the catalog' });
      setShowSubmitForm(false);
      setSubmitForm({ title: '', genre: '', platform: '', url: '', thumbnail: '', developer: '', description: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Submit Failed', description: err.message, variant: 'destructive' });
    },
  });

  const createGameMutation = useMutation({
    mutationFn: async (data: typeof sandboxForm) => {
      return apiRequest('/api/gamedeck/sandbox/create', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/sandbox/games', wallet] });
      pushReceipt({
        id: `gamedeck-sandbox-create-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'sandbox.create',
        timestamp: Date.now(),
        data: { gameId: data.game?.id },
      });
      toast({ title: 'Game Created', description: 'Your sandbox game has been created' });
      setShowCreateSandboxForm(false);
      setSandboxForm({ title: '', description: '', genre: '', platform: '', thumbnail: '', price: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Create Failed', description: err.message, variant: 'destructive' });
    },
  });

  const uploadBuildMutation = useMutation({
    mutationFn: async ({ gameId, version, changelog }: { gameId: string; version: string; changelog?: string }) => {
      return apiRequest('/api/gamedeck/sandbox/build/upload', {
        method: 'POST',
        body: JSON.stringify({ gameId, version, changelog }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/sandbox/games', wallet] });
      pushReceipt({
        id: `gamedeck-build-upload-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'sandbox.build.upload',
        timestamp: Date.now(),
        data: { gameId: variables.gameId, version: variables.version },
      });
      toast({ title: 'Build Uploaded', description: `Version ${variables.version} uploaded successfully` });
      setShowBuildUpload(false);
      setBuildVersion('');
      setBuildChangelog('');
    },
    onError: (err: any) => {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
    },
  });

  const publishBuildMutation = useMutation({
    mutationFn: async ({ gameId, version }: { gameId: string; version?: string }) => {
      return apiRequest('/api/gamedeck/sandbox/build/publish', {
        method: 'POST',
        body: JSON.stringify({ gameId, version }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/sandbox/games', wallet] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/games'] });
      pushReceipt({
        id: `gamedeck-build-publish-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'sandbox.build.publish',
        timestamp: Date.now(),
        data: { gameId: variables.gameId },
      });
      toast({ title: 'Game Published', description: 'Your game is now live in the catalog' });
    },
    onError: (err: any) => {
      toast({ title: 'Publish Failed', description: err.message, variant: 'destructive' });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ gameId, price }: { gameId: string; price: string }) => {
      return apiRequest('/api/gamedeck/purchase', {
        method: 'POST',
        body: JSON.stringify({ gameId, price }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/purchases', wallet] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/favorites', wallet] });
      pushReceipt({
        id: `gamedeck-purchase-${Date.now()}`,
        hash: data.txHash || `0x${Date.now().toString(16)}`,
        scope: 'gamedeck',
        endpoint: 'game.purchase',
        timestamp: Date.now(),
        data: { gameId: variables.gameId, price: variables.price, receiptId: data.receiptId },
      });
      toast({ title: 'Purchase Complete', description: 'Game added to your library' });
      setShowPurchaseConfirm(null);
    },
    onError: (err: any) => {
      toast({ title: 'Purchase Failed', description: err.message, variant: 'destructive' });
    },
  });

  const games = gamesQuery.data?.games || [];
  const favorites = favoritesQuery.data?.favorites || [];
  const nfts = nftsQuery.data?.nfts || [];
  const ledger = ledgerQuery.data?.entries || [];
  const mods = modsQuery.data?.mods || [];
  const pendingInvites = invitesQuery.data?.pending || [];
  const sentInvites = invitesQuery.data?.sent || [];
  const sandboxGames = sandboxGamesQuery.data?.games || [];
  const purchases = purchasesQuery.data?.purchases || [];

  const purchasedGameIds = useMemo(() => {
    return new Set(purchases.filter(p => p.status === 'completed').map(p => p.gameId));
  }, [purchases]);

  const developerGames = useMemo(() => {
    return games.filter(g => g.source === 'developer' && g.developer);
  }, [games]);

  const totalAnchorSpend = useMemo(() => {
    return ledger.reduce((sum, entry) => sum + BigInt(entry.feeWei || '0'), BigInt(0));
  }, [ledger]);

  const favoriteGameIds = useMemo(() => {
    return new Set(favorites.map(f => f.gameId));
  }, [favorites]);

  const selectedGame = useMemo(() => {
    return games.find(g => g.id === selectedGameId);
  }, [games, selectedGameId]);

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col overflow-hidden"
      data-testid="gamedeck-mode"
    >
      <div className="flex-none px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Gamepad2 className="w-7 h-7 text-purple-400" />
            <h2 className="text-xl font-bold text-white">GameDeck</h2>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant={mainTab === 'discover' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMainTab('discover')}
              className={mainTab === 'discover' ? 'bg-purple-600 hover:bg-purple-700' : 'text-white/70'}
              data-testid="button-tab-discover"
            >
              <Search className="w-4 h-4 mr-1.5" />
              Discover
            </Button>
            <Button
              variant={mainTab === 'library' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMainTab('library')}
              className={mainTab === 'library' ? 'bg-purple-600 hover:bg-purple-700' : 'text-white/70'}
              data-testid="button-tab-library"
            >
              <Star className="w-4 h-4 mr-1.5" />
              Library
            </Button>
            <Button
              variant={mainTab === 'creator' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMainTab('creator')}
              className={mainTab === 'creator' ? 'bg-purple-600 hover:bg-purple-700' : 'text-white/70'}
              data-testid="button-tab-creator"
            >
              <Box className="w-4 h-4 mr-1.5" />
              Creator
            </Button>
          </div>
        </div>
        
        {mainTab === 'discover' && (
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant={discoverSubTab === 'catalog' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDiscoverSubTab('catalog')}
              className={discoverSubTab === 'catalog' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-catalog"
            >
              <Gamepad2 className="w-3 h-3 mr-1" />
              Catalog
            </Button>
            <Button
              variant={discoverSubTab === 'mods' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setDiscoverSubTab('mods')}
              className={discoverSubTab === 'mods' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-mods"
            >
              <Package className="w-3 h-3 mr-1" />
              Mods
            </Button>
          </div>
        )}
        
        {mainTab === 'library' && (
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant={librarySubTab === 'favorites' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLibrarySubTab('favorites')}
              className={librarySubTab === 'favorites' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-favorites"
            >
              <Heart className="w-3 h-3 mr-1" />
              Favorites
            </Button>
            <Button
              variant={librarySubTab === 'purchases' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLibrarySubTab('purchases')}
              className={librarySubTab === 'purchases' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-purchases"
            >
              <ShoppingCart className="w-3 h-3 mr-1" />
              Purchases
            </Button>
            <Button
              variant={librarySubTab === 'assets' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setLibrarySubTab('assets')}
              className={librarySubTab === 'assets' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-assets"
            >
              <Image className="w-3 h-3 mr-1" />
              Assets
            </Button>
          </div>
        )}
        
        {mainTab === 'creator' && (
          <div className="flex items-center gap-2 mb-3">
            <Button
              variant={creatorSubTab === 'sandbox' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCreatorSubTab('sandbox')}
              className={creatorSubTab === 'sandbox' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-sandbox"
            >
              <Box className="w-3 h-3 mr-1" />
              Sandbox
            </Button>
            <Button
              variant={creatorSubTab === 'developer' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCreatorSubTab('developer')}
              className={creatorSubTab === 'developer' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-developer"
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Analytics
            </Button>
            <Button
              variant={creatorSubTab === 'social' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCreatorSubTab('social')}
              className={creatorSubTab === 'social' ? 'bg-white/20' : 'text-white/50'}
              data-testid="button-subtab-social"
            >
              <Users className="w-3 h-3 mr-1" />
              Social
            </Button>
          </div>
        )}

        {mainTab === 'discover' && discoverSubTab === 'catalog' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games..."
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                data-testid="input-search-games"
              />
            </div>

            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white" data-testid="select-genre">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {GENRES.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white" data-testid="select-platform">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {PLATFORMS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate('freetogame')}
                disabled={syncMutation.isPending}
                className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20"
                data-testid="button-sync-freetogame"
              >
                {syncMutation.isPending && syncMutation.variables === 'freetogame' ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Sync FreeToGame
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => syncMutation.mutate('gamerpower')}
                disabled={syncMutation.isPending}
                className="border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                data-testid="button-sync-gamerpower"
              >
                {syncMutation.isPending && syncMutation.variables === 'gamerpower' ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                )}
                Sync GamerPower
              </Button>

              {wallet && (
                <Button
                  size="sm"
                  onClick={() => setShowSubmitForm(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                  data-testid="button-submit-game"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Submit Game
                </Button>
              )}
            </div>
          </div>
        )}

        {mainTab === 'discover' && discoverSubTab === 'mods' && (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedGameId || ''} onValueChange={(val) => setSelectedGameId(val || null)}>
              <SelectTrigger className="w-64 bg-white/10 border-white/20 text-white" data-testid="select-game-for-mods">
                <SelectValue placeholder="Select a game..." />
              </SelectTrigger>
              <SelectContent>
                {games.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedGameId && (
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncModsMutation.mutate({ source: 'curseforge', gameId: selectedGameId })}
                  disabled={syncModsMutation.isPending}
                  className="border-orange-500/50 text-orange-300 hover:bg-orange-500/20"
                  data-testid="button-sync-curseforge"
                >
                  {syncModsMutation.isPending && syncModsMutation.variables?.source === 'curseforge' ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                  )}
                  Sync CurseForge
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncModsMutation.mutate({ source: 'modrinth', gameId: selectedGameId })}
                  disabled={syncModsMutation.isPending}
                  className="border-green-500/50 text-green-300 hover:bg-green-500/20"
                  data-testid="button-sync-modrinth"
                >
                  {syncModsMutation.isPending && syncModsMutation.variables?.source === 'modrinth' ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                  )}
                  Sync Modrinth
                </Button>
              </div>
            )}
          </div>
        )}

        {mainTab === 'creator' && creatorSubTab === 'sandbox' && wallet && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Box className="w-5 h-5 text-purple-400" />
              <span className="text-white/70 text-sm">Manage your games, builds, and endpoints</span>
            </div>
            <div className="ml-auto">
              <Button
                size="sm"
                onClick={() => setShowCreateSandboxForm(true)}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-create-sandbox-game"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create Game
              </Button>
            </div>
          </div>
        )}

        {mainTab === 'library' && librarySubTab === 'purchases' && wallet && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-400" />
              <span className="text-white/70 text-sm">Your purchased games and receipts</span>
            </div>
            <span className="ml-auto text-sm text-white/50">
              {purchases.filter(p => p.status === 'completed').length} games owned
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          {mainTab === 'discover' && discoverSubTab === 'catalog' && (
            <MotionDiv
              key="catalog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {gamesQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : gamesQuery.isError ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                  <p className="text-white/60">Failed to load games</p>
                  <Button variant="ghost" onClick={() => gamesQuery.refetch()} className="mt-4">
                    Retry
                  </Button>
                </div>
              ) : games.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Gamepad2 className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">No games found</p>
                  <p className="text-white/40 text-sm">Try syncing from FreeToGame or GamerPower</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {games.map((game, index) => (
                    <GameTile
                      key={game.id}
                      game={game}
                      index={index}
                      isFavorite={favoriteGameIds.has(game.id)}
                      onFavorite={() => favoriteMutation.mutate(game.id)}
                      wallet={wallet}
                      isOwned={purchasedGameIds.has(game.id)}
                      onBuy={() => setShowPurchaseConfirm({ game, price: game.metadata?.price || '0' })}
                    />
                  ))}
                </div>
              )}
            </MotionDiv>
          )}

          {mainTab === 'library' && librarySubTab === 'favorites' && (
            <MotionDiv
              key="favorites"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {!wallet ? (
                <NoWalletState message="Connect wallet to view favorites" />
              ) : favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Star className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">No favorites yet</p>
                  <p className="text-white/40 text-sm">Add games to your favorites from the catalog</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold text-white">Pinned Games</h3>
                    <span className="text-sm text-white/50">({favorites.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {favorites.map((fav, index) => (
                      <FavoriteTile
                        key={fav.id}
                        favorite={fav}
                        index={index}
                        games={games}
                        isOwned={purchasedGameIds.has(fav.gameId)}
                        purchaseReceipt={purchases.find(p => p.gameId === fav.gameId && p.status === 'completed') || null}
                      />
                    ))}
                  </div>
                </div>
              )}
            </MotionDiv>
          )}

          {mainTab === 'discover' && discoverSubTab === 'mods' && (
            <MotionDiv
              key="mods"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {!selectedGameId ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">Select a game to view mods</p>
                  <p className="text-white/40 text-sm">Choose a game from the dropdown above</p>
                </div>
              ) : modsQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : mods.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">No mods found for {selectedGame?.title}</p>
                  <p className="text-white/40 text-sm">Try syncing from CurseForge or Modrinth</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Mods for {selectedGame?.title}</h3>
                    <span className="text-sm text-white/50">({mods.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {mods.map((mod, index) => (
                      <ModTile
                        key={mod.id}
                        mod={mod}
                        index={index}
                        onEnable={() => enableModMutation.mutate(mod.id)}
                        onDisable={() => disableModMutation.mutate(mod.id)}
                        isToggling={enableModMutation.isPending || disableModMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              )}
            </MotionDiv>
          )}

          {mainTab === 'creator' && creatorSubTab === 'social' && (
            <MotionDiv
              key="social"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!wallet ? (
                <NoWalletState message="Connect wallet to access social features" />
              ) : (
                <>
                  <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        Invite Player
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <Input
                            value={inviteWallet}
                            onChange={(e) => setInviteWallet(e.target.value)}
                            placeholder="Enter wallet address (0x...)"
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                            data-testid="input-invite-wallet"
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            value={inviteMessage}
                            onChange={(e) => setInviteMessage(e.target.value)}
                            placeholder="Optional message..."
                            className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                            data-testid="input-invite-message"
                          />
                        </div>
                        <Button
                          onClick={() => sendInviteMutation.mutate({ toWallet: inviteWallet, message: inviteMessage || undefined })}
                          disabled={!inviteWallet || sendInviteMutation.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="button-send-invite"
                        >
                          {sendInviteMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4 mr-1.5" />
                          )}
                          Send Invite
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Clock className="w-5 h-5 text-yellow-400" />
                          Pending Invites
                          {pendingInvites.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs">
                              {pendingInvites.length}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {invitesQuery.isLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                          </div>
                        ) : pendingInvites.length === 0 ? (
                          <div className="text-center py-8 text-white/40">
                            <p>No pending invites</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-64 overflow-auto">
                            {pendingInvites.map((invite) => (
                              <div
                                key={invite.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                                data-testid={`invite-pending-${invite.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-mono truncate">
                                    {invite.fromWallet.slice(0, 8)}...{invite.fromWallet.slice(-6)}
                                  </p>
                                  {invite.message && (
                                    <p className="text-white/50 text-xs truncate mt-1">{invite.message}</p>
                                  )}
                                  <p className="text-white/30 text-xs mt-1">
                                    {new Date(invite.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 ml-3">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => respondInviteMutation.mutate({ inviteId: invite.id, response: 'accept' })}
                                    disabled={respondInviteMutation.isPending}
                                    className="text-green-400 hover:text-green-300 hover:bg-green-500/20"
                                    data-testid={`button-accept-${invite.id}`}
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => respondInviteMutation.mutate({ inviteId: invite.id, response: 'decline' })}
                                    disabled={respondInviteMutation.isPending}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                    data-testid={`button-decline-${invite.id}`}
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Send className="w-5 h-5 text-blue-400" />
                          Sent Invites
                          {sentInvites.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs">
                              {sentInvites.length}
                            </span>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {invitesQuery.isLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                          </div>
                        ) : sentInvites.length === 0 ? (
                          <div className="text-center py-8 text-white/40">
                            <p>No sent invites</p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-64 overflow-auto">
                            {sentInvites.map((invite) => (
                              <div
                                key={invite.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                                data-testid={`invite-sent-${invite.id}`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-mono truncate">
                                    {invite.toWallet.slice(0, 8)}...{invite.toWallet.slice(-6)}
                                  </p>
                                  {invite.message && (
                                    <p className="text-white/50 text-xs truncate mt-1">{invite.message}</p>
                                  )}
                                  <p className="text-white/30 text-xs mt-1">
                                    {new Date(invite.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="ml-3">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    invite.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                    invite.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                                    'bg-red-500/20 text-red-300'
                                  }`} data-testid={`status-invite-${invite.id}`}>
                                    {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </MotionDiv>
          )}

          {mainTab === 'creator' && creatorSubTab === 'developer' && (
            <MotionDiv
              key="developer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!wallet ? (
                <NoWalletState message="Connect wallet to access developer dashboard" />
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-white/60">Submitted Games</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-white" data-testid="stat-submitted-games">
                          {developerGames.length}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-white/60">Total Favorites</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-white" data-testid="stat-total-favorites">
                          {favorites.length}
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-white/60 flex items-center gap-1.5">
                          <Coins className="w-4 h-4" />
                          Anchor Spend (Wei)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-white truncate" data-testid="stat-anchor-spend">
                          {totalAnchorSpend.toString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Gamepad2 className="w-5 h-5" />
                        Your Submitted Games
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {developerGames.length === 0 ? (
                        <div className="text-center py-8 text-white/40">
                          <p>No games submitted yet</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setMainTab('discover');
                              setDiscoverSubTab('catalog');
                              setShowSubmitForm(true);
                            }}
                            data-testid="button-submit-first-game"
                          >
                            <Plus className="w-4 h-4 mr-1.5" />
                            Submit Your First Game
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {developerGames.map((game) => (
                            <div
                              key={game.id}
                              className="p-3 rounded-lg bg-white/5 border border-white/10"
                              data-testid={`dev-game-${game.id}`}
                            >
                              <div className="flex items-start gap-3">
                                {game.thumbnail ? (
                                  <img
                                    src={game.thumbnail}
                                    alt={game.title}
                                    className="w-16 h-16 rounded object-cover"
                                  />
                                ) : (
                                  <div className="w-16 h-16 rounded bg-white/10 flex items-center justify-center">
                                    <Gamepad2 className="w-6 h-6 text-white/30" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-white truncate">{game.title}</h4>
                                  <p className="text-xs text-white/50">{game.genre || 'No genre'}</p>
                                  <p className="text-xs text-white/40">{game.platform || 'No platform'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {ledger.length > 0 && (
                    <Card className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Coins className="w-5 h-5" />
                          Anchor Ledger
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 max-h-64 overflow-auto">
                          {ledger.slice(0, 20).map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between p-2 rounded bg-white/5 text-sm"
                              data-testid={`ledger-entry-${entry.id}`}
                            >
                              <span className="text-white/60">{entry.action}</span>
                              <span className="text-white/40">{entry.chain}</span>
                              <span className="text-cyan-300 font-mono">{entry.feeWei} wei</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </MotionDiv>
          )}

          {mainTab === 'library' && librarySubTab === 'assets' && (
            <MotionDiv
              key="assets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {!wallet ? (
                <NoWalletState message="Connect wallet to view your NFT assets" />
              ) : nftsQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : nfts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Image className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">No NFT assets found</p>
                  <p className="text-white/40 text-sm">Your game NFTs will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Image className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">My Assets</h3>
                    <span className="text-sm text-white/50">({nfts.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {nfts.map((nft, index) => (
                      <NftTile key={nft.id} nft={nft} index={index} />
                    ))}
                  </div>
                </div>
              )}
            </MotionDiv>
          )}

          {mainTab === 'creator' && creatorSubTab === 'sandbox' && (
            <MotionDiv
              key="sandbox"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!wallet ? (
                <NoWalletState message="Connect wallet to access sandbox" />
              ) : sandboxGamesQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : sandboxGames.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Box className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">No sandbox games yet</p>
                  <p className="text-white/40 text-sm mb-4">Create your first game to get started</p>
                  <Button
                    size="sm"
                    onClick={() => setShowCreateSandboxForm(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-create-first-sandbox-game"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create Game
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Box className="w-5 h-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Your Sandbox Games</h3>
                    <span className="text-sm text-white/50">({sandboxGames.length})</span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {sandboxGames.map((game) => (
                      <Card
                        key={game.id}
                        className={`bg-white/5 border-white/10 ${selectedSandboxGame?.id === game.id ? 'ring-2 ring-purple-500' : ''}`}
                        data-testid={`sandbox-game-${game.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {game.thumbnail ? (
                              <img
                                src={game.thumbnail}
                                alt={game.title}
                                className="w-20 h-20 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-lg bg-white/10 flex items-center justify-center">
                                <Gamepad2 className="w-8 h-8 text-white/30" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-white truncate" data-testid={`sandbox-title-${game.id}`}>{game.title}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                      game.status === 'published' 
                                        ? 'bg-green-500/20 text-green-300' 
                                        : 'bg-yellow-500/20 text-yellow-300'
                                    }`} data-testid={`sandbox-status-${game.id}`}>
                                      {game.status === 'published' ? 'Published' : 'Draft'}
                                    </span>
                                    <span className="text-xs text-white/50" data-testid={`sandbox-version-${game.id}`}>v{game.version}</span>
                                  </div>
                                </div>
                              </div>
                              {game.description && (
                                <p className="text-xs text-white/50 mt-2 line-clamp-2">{game.description}</p>
                              )}
                              {game.price && (
                                <p className="text-sm text-green-400 mt-1 flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  {game.price}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/10">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSandboxGame(game);
                                setShowBuildUpload(true);
                              }}
                              className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20"
                              data-testid={`button-upload-build-${game.id}`}
                            >
                              <Upload className="w-4 h-4 mr-1.5" />
                              Upload Build
                            </Button>
                            
                            {game.status === 'draft' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => publishBuildMutation.mutate({ gameId: game.id })}
                                disabled={publishBuildMutation.isPending}
                                className="border-green-500/50 text-green-300 hover:bg-green-500/20"
                                data-testid={`button-publish-${game.id}`}
                              >
                                {publishBuildMutation.isPending && publishBuildMutation.variables?.gameId === game.id ? (
                                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                ) : (
                                  <Globe className="w-4 h-4 mr-1.5" />
                                )}
                                Publish
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSandboxGame(game)}
                              className="text-white/60 hover:text-white"
                              data-testid={`button-update-${game.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1.5" />
                              Update
                            </Button>
                          </div>

                          {game.endpoints && game.endpoints.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                              <div className="flex items-center gap-2 mb-2">
                                <FileCode className="w-4 h-4 text-white/50" />
                                <span className="text-xs text-white/50">Endpoints</span>
                              </div>
                              <div className="space-y-1">
                                {game.endpoints.slice(0, 3).map((endpoint, idx) => (
                                  <div 
                                    key={idx} 
                                    className="text-xs font-mono text-cyan-400/80 bg-white/5 rounded px-2 py-1"
                                    data-testid={`endpoint-${game.id}-${idx}`}
                                  >
                                    {endpoint}
                                  </div>
                                ))}
                                {game.endpoints.length > 3 && (
                                  <span className="text-xs text-white/40">+{game.endpoints.length - 3} more</span>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </MotionDiv>
          )}

          {mainTab === 'library' && librarySubTab === 'purchases' && (
            <MotionDiv
              key="purchases"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!wallet ? (
                <NoWalletState message="Connect wallet to view your purchases" />
              ) : purchasesQuery.isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ShoppingCart className="w-16 h-16 text-white/20 mb-4" />
                  <p className="text-white/60 mb-2">No purchases yet</p>
                  <p className="text-white/40 text-sm mb-4">Browse the catalog to find games to purchase</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setMainTab('discover'); setDiscoverSubTab('catalog'); }}
                    className="border-purple-500/50 text-purple-300"
                    data-testid="button-browse-catalog"
                  >
                    <Gamepad2 className="w-4 h-4 mr-1.5" />
                    Browse Catalog
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Receipt className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Purchase History</h3>
                    <span className="text-sm text-white/50">({purchases.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {purchases.map((purchase) => {
                      const game = purchase.game || games.find(g => g.id === purchase.gameId);
                      return (
                        <Card
                          key={purchase.id}
                          className="bg-white/5 border-white/10"
                          data-testid={`purchase-${purchase.id}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {game?.thumbnail ? (
                                <img
                                  src={game.thumbnail}
                                  alt={game.title}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-white/10 flex items-center justify-center">
                                  <Gamepad2 className="w-6 h-6 text-white/30" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-white truncate" data-testid={`purchase-title-${purchase.id}`}>
                                  {game?.title || 'Unknown Game'}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    purchase.status === 'completed' 
                                      ? 'bg-green-500/20 text-green-300' 
                                      : purchase.status === 'pending'
                                        ? 'bg-yellow-500/20 text-yellow-300'
                                        : 'bg-red-500/20 text-red-300'
                                  }`} data-testid={`purchase-status-${purchase.id}`}>
                                    {purchase.status.charAt(0).toUpperCase() + purchase.status.slice(1)}
                                  </span>
                                </div>
                                <p className="text-sm text-green-400 mt-1 flex items-center gap-1" data-testid={`purchase-price-${purchase.id}`}>
                                  <DollarSign className="w-3 h-3" />
                                  {purchase.price}
                                </p>
                                <p className="text-xs text-white/40 mt-1">
                                  {new Date(purchase.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            
                            {purchase.txHash && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <div className="flex items-center gap-2">
                                  <Receipt className="w-4 h-4 text-white/40" />
                                  <span className="text-xs text-white/50">Transaction:</span>
                                </div>
                                <p className="text-xs font-mono text-cyan-400/80 truncate mt-1" data-testid={`purchase-tx-${purchase.id}`}>
                                  {purchase.txHash}
                                </p>
                              </div>
                            )}

                            {purchase.status === 'completed' && game?.url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(game.url!, '_blank')}
                                className="w-full mt-3 border-purple-500/50 text-purple-300"
                                data-testid={`button-play-${purchase.id}`}
                              >
                                <ExternalLink className="w-4 h-4 mr-1.5" />
                                Play Game
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSubmitForm && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSubmitForm(false)}
          >
            <MotionDiv
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-gray-900 rounded-xl border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-submit-game"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Submit Game
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubmitForm(false)}
                  data-testid="button-close-submit"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Title *</label>
                  <Input
                    value={submitForm.title}
                    onChange={(e) => setSubmitForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Game title"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-submit-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Genre</label>
                    <Input
                      value={submitForm.genre}
                      onChange={(e) => setSubmitForm(f => ({ ...f, genre: e.target.value }))}
                      placeholder="e.g., Action"
                      className="bg-white/10 border-white/20 text-white"
                      data-testid="input-submit-genre"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Platform</label>
                    <Input
                      value={submitForm.platform}
                      onChange={(e) => setSubmitForm(f => ({ ...f, platform: e.target.value }))}
                      placeholder="e.g., PC"
                      className="bg-white/10 border-white/20 text-white"
                      data-testid="input-submit-platform"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Developer *</label>
                  <Input
                    value={submitForm.developer}
                    onChange={(e) => setSubmitForm(f => ({ ...f, developer: e.target.value }))}
                    placeholder="Developer or studio name"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-submit-developer"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Game URL</label>
                  <Input
                    value={submitForm.url}
                    onChange={(e) => setSubmitForm(f => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-submit-url"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Thumbnail URL</label>
                  <Input
                    value={submitForm.thumbnail}
                    onChange={(e) => setSubmitForm(f => ({ ...f, thumbnail: e.target.value }))}
                    placeholder="https://..."
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-submit-thumbnail"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Description</label>
                  <textarea
                    value={submitForm.description}
                    onChange={(e) => setSubmitForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/40 resize-none"
                    data-testid="input-submit-description"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="ghost" onClick={() => setShowSubmitForm(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => submitGameMutation.mutate(submitForm)}
                    disabled={!submitForm.title || !submitForm.developer || submitGameMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-confirm-submit"
                  >
                    {submitGameMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1.5" />
                    )}
                    Submit Game
                  </Button>
                </div>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}

        {showCreateSandboxForm && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateSandboxForm(false)}
          >
            <MotionDiv
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-gray-900 rounded-xl border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-create-sandbox-game"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Box className="w-5 h-5" />
                  Create Sandbox Game
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateSandboxForm(false)}
                  data-testid="button-close-create-sandbox"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Title *</label>
                  <Input
                    value={sandboxForm.title}
                    onChange={(e) => setSandboxForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Game title"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-sandbox-title"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Description</label>
                  <Input
                    value={sandboxForm.description}
                    onChange={(e) => setSandboxForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Brief description"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-sandbox-description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Genre</label>
                    <Input
                      value={sandboxForm.genre}
                      onChange={(e) => setSandboxForm(f => ({ ...f, genre: e.target.value }))}
                      placeholder="e.g., Action"
                      className="bg-white/10 border-white/20 text-white"
                      data-testid="input-sandbox-genre"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-white/60 mb-1.5 block">Platform</label>
                    <Input
                      value={sandboxForm.platform}
                      onChange={(e) => setSandboxForm(f => ({ ...f, platform: e.target.value }))}
                      placeholder="e.g., PC"
                      className="bg-white/10 border-white/20 text-white"
                      data-testid="input-sandbox-platform"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Thumbnail URL</label>
                  <Input
                    value={sandboxForm.thumbnail}
                    onChange={(e) => setSandboxForm(f => ({ ...f, thumbnail: e.target.value }))}
                    placeholder="https://..."
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-sandbox-thumbnail"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Price (optional)</label>
                  <Input
                    value={sandboxForm.price}
                    onChange={(e) => setSandboxForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="e.g., 0.01 ETH"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-sandbox-price"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowCreateSandboxForm(false)}
                    data-testid="button-cancel-create-sandbox"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createGameMutation.mutate(sandboxForm)}
                    disabled={!sandboxForm.title || createGameMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700"
                    data-testid="button-confirm-create-sandbox"
                  >
                    {createGameMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-1.5" />
                    )}
                    Create Game
                  </Button>
                </div>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}

        {showBuildUpload && selectedSandboxGame && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBuildUpload(false)}
          >
            <MotionDiv
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-gray-900 rounded-xl border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-upload-build"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Build
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowBuildUpload(false)}
                  data-testid="button-close-upload-build"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="mb-4 p-3 bg-white/5 rounded-lg">
                <p className="text-sm text-white/60">Uploading for:</p>
                <p className="text-white font-medium">{selectedSandboxGame.title}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Version *</label>
                  <Input
                    value={buildVersion}
                    onChange={(e) => setBuildVersion(e.target.value)}
                    placeholder="e.g., 1.0.0"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-build-version"
                  />
                </div>

                <div>
                  <label className="text-sm text-white/60 mb-1.5 block">Changelog (optional)</label>
                  <Input
                    value={buildChangelog}
                    onChange={(e) => setBuildChangelog(e.target.value)}
                    placeholder="What's new in this version?"
                    className="bg-white/10 border-white/20 text-white"
                    data-testid="input-build-changelog"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowBuildUpload(false)}
                    data-testid="button-cancel-upload-build"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => uploadBuildMutation.mutate({
                      gameId: selectedSandboxGame.id,
                      version: buildVersion,
                      changelog: buildChangelog || undefined,
                    })}
                    disabled={!buildVersion || uploadBuildMutation.isPending}
                    className="bg-cyan-600 hover:bg-cyan-700"
                    data-testid="button-confirm-upload-build"
                  >
                    {uploadBuildMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1.5" />
                    )}
                    Upload Build
                  </Button>
                </div>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}

        {showPurchaseConfirm && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPurchaseConfirm(null)}
          >
            <MotionDiv
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-gray-900 rounded-xl border border-white/10 p-6"
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-purchase-confirm"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Confirm Purchase
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPurchaseConfirm(null)}
                  data-testid="button-close-purchase"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-start gap-4 mb-6">
                {showPurchaseConfirm.game.thumbnail ? (
                  <img
                    src={showPurchaseConfirm.game.thumbnail}
                    alt={showPurchaseConfirm.game.title}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-white/10 flex items-center justify-center">
                    <Gamepad2 className="w-8 h-8 text-white/30" />
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-semibold text-white" data-testid="purchase-confirm-title">
                    {showPurchaseConfirm.game.title}
                  </h4>
                  {showPurchaseConfirm.game.genre && (
                    <p className="text-sm text-white/50">{showPurchaseConfirm.game.genre}</p>
                  )}
                  <p className="text-xl font-bold text-green-400 mt-2 flex items-center gap-1" data-testid="purchase-confirm-price">
                    <DollarSign className="w-5 h-5" />
                    {showPurchaseConfirm.game.metadata?.price || 'Free'}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-6">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-200">
                    <p className="font-medium">Blockchain Transaction</p>
                    <p className="text-yellow-200/70 mt-1">This purchase will be recorded on-chain and cannot be reversed.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowPurchaseConfirm(null)}
                  data-testid="button-cancel-purchase"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => purchaseMutation.mutate({
                    gameId: showPurchaseConfirm.game.id,
                    price: showPurchaseConfirm.game.metadata?.price || '0',
                  })}
                  disabled={purchaseMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-confirm-purchase"
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : (
                    <ShoppingCart className="w-4 h-4 mr-1.5" />
                  )}
                  Complete Purchase
                </Button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}

interface GameTileProps {
  game: Game;
  index: number;
  isFavorite: boolean;
  onFavorite: () => void;
  wallet: string | null;
  isOwned?: boolean;
  onBuy?: () => void;
}

function GameTile({ game, index, isFavorite, onFavorite, wallet, isOwned, onBuy }: GameTileProps) {
  const hasPrice = game.metadata?.price;
  
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-purple-500/50 transition-all duration-300"
      data-testid={`game-tile-${game.id}`}
    >
      {game.thumbnail ? (
        <img
          src={game.thumbnail}
          alt={game.title}
          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-blue-900/50">
          <Gamepad2 className="w-12 h-12 text-white/30" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">{game.title}</h3>
        <div className="flex items-center gap-2 text-xs text-white/60">
          {game.genre && <span className="truncate">{game.genre}</span>}
          {game.genre && game.platform && <span>·</span>}
          {game.platform && <span className="truncate">{game.platform}</span>}
        </div>
        
        {hasPrice && wallet && (
          <div className="mt-2">
            {isOwned ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 text-xs font-medium rounded" data-testid={`owned-badge-${game.id}`}>
                <Check className="w-3 h-3" />
                Owned
              </span>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBuy?.();
                }}
                className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded transition-colors"
                data-testid={`button-buy-${game.id}`}
              >
                <ShoppingCart className="w-3 h-3" />
                Buy {game.metadata?.price}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {game.url && (
          <button
            onClick={() => window.open(game.url!, '_blank')}
            className="p-2 rounded-lg bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors"
            data-testid={`button-open-${game.id}`}
          >
            <ExternalLink className="w-4 h-4 text-white" />
          </button>
        )}
        {wallet && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite();
            }}
            className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
              isFavorite ? 'bg-yellow-500/60 hover:bg-yellow-500/80' : 'bg-black/60 hover:bg-black/80'
            }`}
            data-testid={`button-favorite-${game.id}`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'text-yellow-200 fill-yellow-200' : 'text-white'}`} />
          </button>
        )}
      </div>

      {game.source && (
        <div className="absolute top-2 left-2">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            game.source === 'developer' ? 'bg-purple-500/60 text-purple-100' :
            game.source === 'freetogame' ? 'bg-cyan-500/60 text-cyan-100' :
            'bg-orange-500/60 text-orange-100'
          }`}>
            {game.source === 'developer' ? 'DEV' : game.source === 'freetogame' ? 'F2G' : 'GP'}
          </span>
        </div>
      )}
    </MotionDiv>
  );
}

interface ModTileProps {
  mod: Mod;
  index: number;
  onEnable: () => void;
  onDisable: () => void;
  isToggling: boolean;
}

function ModTile({ mod, index, onEnable, onDisable, isToggling }: ModTileProps) {
  const sourceColors = {
    curseforge: 'bg-orange-500/60 text-orange-100',
    modrinth: 'bg-green-500/60 text-green-100',
    developer: 'bg-purple-500/60 text-purple-100',
  };

  const sourceLabels = {
    curseforge: 'CF',
    modrinth: 'MR',
    developer: 'DEV',
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      className={`group relative rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border transition-all duration-300 ${
        mod.enabled ? 'border-green-500/50' : 'border-white/10 hover:border-purple-500/50'
      }`}
      data-testid={`mod-tile-${mod.id}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {mod.thumbnail ? (
              <img
                src={mod.thumbnail}
                alt={mod.name}
                className="w-12 h-12 rounded-lg object-cover mb-2"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-2">
                <Package className="w-6 h-6 text-white/30" />
              </div>
            )}
            <h3 className="text-sm font-semibold text-white line-clamp-1" data-testid={`mod-name-${mod.id}`}>
              {mod.name}
            </h3>
          </div>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${sourceColors[mod.source]}`} data-testid={`mod-source-${mod.id}`}>
            {sourceLabels[mod.source]}
          </span>
        </div>

        {mod.description && (
          <p className="text-xs text-white/50 line-clamp-2 mb-3">{mod.description}</p>
        )}

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-white/40">
            {mod.version && (
              <span className="flex items-center gap-1" data-testid={`mod-version-${mod.id}`}>
                v{mod.version}
              </span>
            )}
            <span className="flex items-center gap-1" data-testid={`mod-installs-${mod.id}`}>
              <Download className="w-3 h-3" />
              {mod.installCount.toLocaleString()}
            </span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={mod.enabled ? onDisable : onEnable}
            disabled={isToggling}
            className={`h-7 px-2 ${
              mod.enabled 
                ? 'text-green-400 hover:text-green-300 hover:bg-green-500/20' 
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            data-testid={`button-toggle-mod-${mod.id}`}
          >
            {isToggling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mod.enabled ? (
              <ToggleRight className="w-5 h-5" />
            ) : (
              <ToggleLeft className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </MotionDiv>
  );
}

interface FavoriteTileProps {
  favorite: GameFavorite;
  index: number;
  games: Game[];
  isOwned?: boolean;
  purchaseReceipt?: Purchase | null;
}

function FavoriteTile({ favorite, index, games, isOwned, purchaseReceipt }: FavoriteTileProps) {
  const game = games.find(g => g.id === favorite.gameId) || favorite.game;

  if (!game) {
    return (
      <MotionDiv
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
        className="aspect-[3/4] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
        data-testid={`favorite-tile-${favorite.id}`}
      >
        <Gamepad2 className="w-8 h-8 text-white/20" />
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={`group relative aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border transition-all duration-300 cursor-grab active:cursor-grabbing ${
        isOwned ? 'border-green-500/30 hover:border-green-500/60' : 'border-yellow-500/30 hover:border-yellow-500/60'
      }`}
      data-testid={`favorite-tile-${favorite.id}`}
    >
      <div className="absolute top-2 left-2 z-10">
        <GripVertical className="w-4 h-4 text-white/40" />
      </div>

      {game.thumbnail ? (
        <img
          src={game.thumbnail}
          alt={game.title}
          className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-blue-900/50">
          <Gamepad2 className="w-12 h-12 text-white/30" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

      <div className="absolute top-2 right-2 flex gap-1">
        {isOwned && (
          <span className="p-1.5 rounded-full bg-green-500/60" data-testid={`owned-fav-badge-${favorite.id}`}>
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
        <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="text-sm font-semibold text-white line-clamp-2 mb-1">{game.title}</h3>
        <div className="flex items-center gap-2 text-xs text-white/60">
          {game.genre && <span className="truncate">{game.genre}</span>}
        </div>
        {isOwned && purchaseReceipt && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-400" data-testid={`receipt-info-${favorite.id}`}>
            <Receipt className="w-3 h-3" />
            <span>Purchased {new Date(purchaseReceipt.createdAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </MotionDiv>
  );
}

interface NftTileProps {
  nft: GameNft;
  index: number;
}

function NftTile({ nft, index }: NftTileProps) {
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.05, 0.5) }}
      className="group relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border border-white/10 hover:border-purple-500/50 transition-all duration-300"
      data-testid={`nft-tile-${nft.id}`}
    >
      {nft.image ? (
        <img
          src={nft.image}
          alt={nft.name || 'NFT'}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-blue-900/50">
          <Image className="w-12 h-12 text-white/30" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="text-sm font-semibold text-white truncate">{nft.name || `Token #${nft.tokenId}`}</h3>
        <div className="text-xs text-white/50 truncate">{nft.chain}</div>
      </div>

      {nft.attributes && Array.isArray(nft.attributes) && nft.attributes.length > 0 && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg p-2 text-xs space-y-1 max-w-[150px]">
            {nft.attributes.slice(0, 3).map((attr: any, i: number) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-white/60 truncate">{attr.trait_type || attr.key}</span>
                <span className="text-white font-medium truncate">{attr.value}</span>
              </div>
            ))}
            {nft.attributes.length > 3 && (
              <div className="text-white/40">+{nft.attributes.length - 3} more</div>
            )}
          </div>
        </div>
      )}
    </MotionDiv>
  );
}

function NoWalletState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="gamedeck-no-wallet">
      <Gamepad2 className="w-16 h-16 text-white/20 mb-4" />
      <p className="text-white/60">{message}</p>
    </div>
  );
}
