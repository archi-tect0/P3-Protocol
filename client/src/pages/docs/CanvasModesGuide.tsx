import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Tv, Code, Layers, Settings } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function CanvasModesGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Atlas Canvas Modes Implementation Guide | P3 Protocol"
        description="Learn how to implement Atlas Canvas modes for TV, Radio, Ebooks, Games, and more with automatic content aggregation from open sources."
      />
      
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <a href="https://github.com/p3-protocol/p3-protocol/tree/main/server/atlas/one" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-white/20">
                <SiGithub className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Atlas Canvas Modes</h1>
              <p className="text-slate-400">Unified UI Substrate with 42+ Modes</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            Atlas Canvas is a unified UI framework that renders different "modes" based on content type. Each mode has its own data source, display logic, and interaction patterns—but shares a common shell, navigation, and session state.
          </p>
        </div>

        <div className="space-y-8">
          {/* Available Modes */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-violet-400" />
              42+ Available Modes
            </h2>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-emerald-400 mb-2">Communication</h4>
                <div className="flex flex-wrap gap-2">
                  {['inbox', 'messages', 'calls', 'directory', 'notifications'].map(mode => (
                    <span key={mode} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-300">{mode}</span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-cyan-400 mb-2">Media & Entertainment</h4>
                <div className="flex flex-wrap gap-2">
                  {['tv', 'radio', 'reader', 'gallery', 'gamedeck', 'media', 'cctv', 'nodestream'].map(mode => (
                    <span key={mode} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-cyan-300">{mode}</span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-violet-400 mb-2">Finance & Blockchain</h4>
                <div className="flex flex-wrap gap-2">
                  {['payments', 'tokens', 'receipts', 'governance'].map(mode => (
                    <span key={mode} className="px-2 py-1 bg-violet-500/10 border border-violet-500/20 rounded text-xs text-violet-300">{mode}</span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-amber-400 mb-2">Productivity</h4>
                <div className="flex flex-wrap gap-2">
                  {['notes', 'writer', 'calc', 'math', 'clipboard', 'taskManager', 'fileHub'].map(mode => (
                    <span key={mode} className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">{mode}</span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-pink-400 mb-2">AI & Information</h4>
                <div className="flex flex-wrap gap-2">
                  {['ai', 'chat', 'weather', 'news', 'wikipedia', 'pulse'].map(mode => (
                    <span key={mode} className="px-2 py-1 bg-pink-500/10 border border-pink-500/20 rounded text-xs text-pink-300">{mode}</span>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-2">System & Developer</h4>
                <div className="flex flex-wrap gap-2">
                  {['hub', 'feed', 'metrics', 'registry', 'identity', 'system', 'settings', 'sandbox', 'orchestration', 'capability', 'node', 'launcher', 'externalApp', 'webBrowser', 'camera', 'one', 'library', 'idle'].map(mode => (
                    <span key={mode} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">{mode}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Mode Architecture */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Mode Architecture
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Each mode is a self-contained component that receives the shared Atlas store context. The shell handles navigation, session state, and layout—modes only focus on their content:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// client/src/components/atlas/AtlasCanvas.tsx

interface AtlasMode {
  id: string;
  name: string;
  icon: React.ComponentType;
  component: React.ComponentType<AtlasModeProps>;
  requiresAuth?: boolean;
  dataSource?: string;
}

interface AtlasModeProps {
  store: AtlasStore;
  session: BridgeSession | null;
  onNavigate: (mode: string) => void;
}

const MODES: AtlasMode[] = [
  { id: 'tv', name: 'Live TV', icon: Tv, component: TVMode, dataSource: 'iptv' },
  { id: 'radio', name: 'Radio', icon: Radio, component: RadioMode, dataSource: 'radio' },
  { id: 'ebooks', name: 'Ebooks', icon: BookOpen, component: EbooksMode, dataSource: 'gutenberg' },
  { id: 'games', name: 'Games', icon: Gamepad2, component: GamesMode, dataSource: 'freetogame' },
  { id: 'inbox', name: 'Inbox', icon: Mail, component: InboxMode, requiresAuth: true },
  { id: 'weather', name: 'Weather', icon: Cloud, component: WeatherMode },
  { id: 'ai', name: 'AI Chat', icon: Bot, component: AIChatMode },
];

function AtlasCanvas() {
  const [currentMode, setCurrentMode] = useState('tv');
  const { store } = useAtlasStore();
  const { session } = useSession();
  
  const mode = MODES.find(m => m.id === currentMode);
  
  // Auth gate for protected modes
  if (mode?.requiresAuth && !session) {
    return <ConnectWalletPrompt onConnect={() => {}} />;
  }
  
  const ModeComponent = mode?.component || TVMode;
  
  return (
    <AtlasShell currentMode={currentMode} onModeChange={setCurrentMode}>
      <ModeComponent 
        store={store}
        session={session}
        onNavigate={setCurrentMode}
      />
    </AtlasShell>
  );
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Content Aggregation */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Tv className="w-5 h-5 text-red-400" />
              Automatic Content Aggregation
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Atlas automatically crawls and syncs content from free, open sources. Background workers respect rate limits and normalize data into a unified catalog:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/atlas/one/sync/scheduler.ts

interface SyncSource {
  id: string;
  name: string;
  type: 'iptv' | 'radio' | 'ebooks' | 'games';
  endpoint: string;
  rateLimit: { requests: number; perSeconds: number };
  transform: (raw: any) => CatalogItem[];
}

const SOURCES: SyncSource[] = [
  {
    id: 'iptv-org',
    name: 'IPTV-org',
    type: 'iptv',
    endpoint: 'https://iptv-org.github.io/api/streams.json',
    rateLimit: { requests: 1, perSeconds: 60 },
    transform: (streams) => streams.map(s => ({
      id: \`iptv_\${s.channel}\`,
      kind: 'video',
      title: s.channel,
      streamUrl: s.url,
      metadata: { country: s.country, language: s.language }
    }))
  },
  {
    id: 'gutendex',
    name: 'Project Gutenberg',
    type: 'ebooks',
    endpoint: 'https://gutendex.com/books/',
    rateLimit: { requests: 10, perSeconds: 60 },
    transform: (books) => books.results.map(b => ({
      id: \`gutenberg_\${b.id}\`,
      kind: 'ebook',
      title: b.title,
      authors: b.authors.map(a => a.name),
      downloadUrl: b.formats['text/html'] || b.formats['text/plain'],
      coverUrl: b.formats['image/jpeg']
    }))
  },
  {
    id: 'freetogame',
    name: 'FreeToGame',
    type: 'games',
    endpoint: 'https://www.freetogame.com/api/games',
    rateLimit: { requests: 5, perSeconds: 60 },
    transform: (games) => games.map(g => ({
      id: \`ftg_\${g.id}\`,
      kind: 'game',
      title: g.title,
      description: g.short_description,
      thumbnailUrl: g.thumbnail,
      gameUrl: g.game_url,
      genre: g.genre,
      platform: g.platform
    }))
  }
];

// Background sync worker (runs every 6 hours)
async function syncAllSources(): Promise<void> {
  for (const source of SOURCES) {
    await rateLimiter.acquire(source.id, source.rateLimit);
    
    try {
      const response = await fetch(source.endpoint);
      const raw = await response.json();
      const items = source.transform(raw);
      
      // Upsert to catalog
      for (const item of items) {
        await db.insert(catalogItems)
          .values(item)
          .onConflictDoUpdate({
            target: catalogItems.id,
            set: { ...item, syncedAt: Date.now() }
          });
      }
      
      console.log(\`Synced \${items.length} items from \${source.name}\`);
    } catch (error) {
      console.error(\`Failed to sync \${source.name}:\`, error);
    }
  }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* TV Mode Example */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Tv className="w-5 h-5 text-red-400" />
              Example: TV Mode Implementation
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// client/src/components/atlas/modes/TVMode.tsx

function TVMode({ store, session }: AtlasModeProps) {
  const { data: channels, isLoading } = useQuery({
    queryKey: ['/api/atlas/catalog', { kind: 'video', type: 'live' }],
  });
  
  const [selectedChannel, setSelectedChannel] = useState<CatalogItem | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // Load user favorites from session
  useEffect(() => {
    if (session?.address) {
      const stored = localStorage.getItem(\`tv_favorites_\${session.address}\`);
      if (stored) setFavorites(JSON.parse(stored));
    }
  }, [session]);
  
  if (isLoading) return <ChannelGridSkeleton />;
  
  return (
    <div className="grid grid-cols-12 gap-4 h-full">
      {/* Channel List */}
      <div className="col-span-3 bg-slate-900/50 rounded-xl p-4 overflow-y-auto">
        <h3 className="font-semibold mb-3">Channels</h3>
        <div className="space-y-2">
          {channels?.map(channel => (
            <button
              key={channel.id}
              onClick={() => setSelectedChannel(channel)}
              className={\`w-full text-left p-2 rounded-lg transition \${
                selectedChannel?.id === channel.id 
                  ? 'bg-violet-500/20 border border-violet-500/50'
                  : 'hover:bg-white/5'
              }\`}
            >
              <div className="flex items-center gap-2">
                <img src={channel.thumbnailUrl} className="w-8 h-8 rounded" />
                <span className="text-sm truncate">{channel.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Video Player */}
      <div className="col-span-9">
        {selectedChannel ? (
          <VideoPlayer
            src={selectedChannel.streamUrl}
            title={selectedChannel.title}
            onFavorite={() => toggleFavorite(selectedChannel.id)}
            isFavorite={favorites.includes(selectedChannel.id)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-500">
            Select a channel to start watching
          </div>
        )}
      </div>
    </div>
  );
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Shared State */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              Shared Atlas Store
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                All modes share a common Zustand store for cross-mode state like onboarding, suggestions, and receipts:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// client/src/stores/atlasStore.ts
import { create } from 'zustand';

interface AtlasStore {
  // Onboarding state
  onboardingComplete: boolean;
  setOnboardingComplete: (complete: boolean) => void;
  
  // Suggestion tray
  suggestions: Suggestion[];
  addSuggestion: (s: Suggestion) => void;
  dismissSuggestion: (id: string) => void;
  
  // Receipt bar (blockchain anchored receipts)
  receipts: Receipt[];
  addReceipt: (r: Receipt) => void;
  
  // Current mode & navigation history
  currentMode: string;
  history: string[];
  navigate: (mode: string) => void;
  goBack: () => void;
  
  // User preferences (persisted per wallet)
  preferences: UserPreferences;
  updatePreferences: (p: Partial<UserPreferences>) => void;
}

export const useAtlasStore = create<AtlasStore>((set, get) => ({
  onboardingComplete: false,
  setOnboardingComplete: (complete) => set({ onboardingComplete: complete }),
  
  suggestions: [],
  addSuggestion: (s) => set(state => ({ 
    suggestions: [...state.suggestions, s] 
  })),
  dismissSuggestion: (id) => set(state => ({
    suggestions: state.suggestions.filter(s => s.id !== id)
  })),
  
  receipts: [],
  addReceipt: (r) => set(state => ({ receipts: [r, ...state.receipts] })),
  
  currentMode: 'tv',
  history: [],
  navigate: (mode) => set(state => ({
    currentMode: mode,
    history: [...state.history, state.currentMode]
  })),
  goBack: () => {
    const history = get().history;
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({ currentMode: prev, history: history.slice(0, -1) });
  },
  
  preferences: { theme: 'dark', autoplay: true },
  updatePreferences: (p) => set(state => ({
    preferences: { ...state.preferences, ...p }
  })),
}));`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-violet-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-violet-400">client/src/pages/atlas/AtlasShell.tsx</code>
                <span className="text-xs text-slate-500">Main canvas shell</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">server/atlas/one/catalog/</code>
                <span className="text-xs text-slate-500">Unified catalog service</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-emerald-400">server/atlas/one/sync/</code>
                <span className="text-xs text-slate-500">Content sync workers</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">client/src/stores/atlasStore.ts</code>
                <span className="text-xs text-slate-500">Shared state store</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/nexus">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Nexus Messaging
            </Button>
          </Link>
          <Link href="/docs/blockchain">
            <Button className="bg-gradient-to-r from-violet-500 to-indigo-500">
              Next: Blockchain Anchoring
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
