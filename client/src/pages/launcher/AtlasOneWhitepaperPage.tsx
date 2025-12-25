import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Package,
  Gamepad2,
  Film,
  BookOpen,
  ShoppingBag,
  Music,
  Tv,
  CheckCircle2,
  Target,
  Zap,
  Layers,
  Store,
  Wallet,
  Receipt,
  Clock,
  Globe,
  Shield,
  ExternalLink,
  Play,
  Star
} from 'lucide-react';

export default function AtlasOneWhitepaperPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <Button
            data-testid="button-back-launcher"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/launcher')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-500/30 flex items-center justify-center">
            <Package className="w-6 h-6 text-purple-400" />
          </div>
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 mb-6">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">Unified Substrate</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Atlas One
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Unified Entertainment & Commerce Substrate
          </p>
          <p className="text-sm text-slate-500 mt-4">Version 1.0 · December 2025</p>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-indigo-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">What is Atlas One?</h2>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                Atlas One consolidates games, live TV, movies, TV shows, ebooks, apps, products, and audio 
                into a single unified "mesh OS surface." It provides wallet-scoped catalogs, favorites, 
                sessions, purchases/rentals, and reviews — all with blockchain-anchored receipts.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Commerce operates in <strong className="text-purple-300">dual-mode</strong>: anchored flow 
                (Gate + receipts at 0.00015 ETH) OR browser-mode merchant checkout. Atlas One acts as a 
                gate protocol managing manifests, receipts, and access tokens while external APIs provide content.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Package className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Experience Kinds</h2>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Gamepad2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Games</span>
                    <p className="text-xs text-slate-400">Free-to-play catalog</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Film className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Video</span>
                    <p className="text-xs text-slate-400">Movies & TV shows</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Ebooks</span>
                    <p className="text-xs text-slate-400">Public domain books</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Products</span>
                    <p className="text-xs text-slate-400">Dual-mode shopping</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-pink-500/10 border border-pink-500/20">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                    <Music className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Audio</span>
                    <p className="text-xs text-slate-400">Music & podcasts</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Tv className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-white font-medium">Live TV</span>
                    <p className="text-xs text-slate-400">IPTV channels</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Store className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Dual-Mode Commerce</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-semibold">Anchored Mode</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Purchase through Gate with wallet receipt, ownership tracking, and blockchain anchoring.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      Immutable receipt on Base Network
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      Wallet-scoped ownership
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-purple-400" />
                      0.00015 ETH anchoring fee
                    </li>
                  </ul>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <ExternalLink className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold">Browser Mode</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Open merchant checkout inline (like a normal browser), optionally log receipt for anchoring.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                      Direct merchant checkout
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                      Optional receipt logging
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-300">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                      Supports any merchant
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Key Features</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Unified Catalog</h3>
                    <p className="text-sm text-slate-400">
                      Single API surface for all content types. Search, filter, and browse games, videos, 
                      ebooks, products, and audio from one endpoint.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Wallet-Scoped Library</h3>
                    <p className="text-sm text-slate-400">
                      Your purchases, rentals, and favorites tied to your wallet address. 
                      Access your library from any device with "Continue" items tracking progress.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Time-Limited Access</h3>
                    <p className="text-sm text-slate-400">
                      Flexible viewing options where licensing permits. 
                      Access periods vary by content type and provider.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Blockchain Receipts</h3>
                    <p className="text-sm text-slate-400">
                      Every purchase generates a cryptographic receipt anchored on Base Network. 
                      Immutable proof of ownership with Merkle-batched anchoring.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Play className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium mb-1">Voice Commands</h3>
                    <p className="text-sm text-slate-400">
                      "Atlas watch [title]", "Atlas rent [movie]", "Atlas read [book]", 
                      "Atlas launch [game]" — natural language control over your content.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl border-amber-500/20">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Content Handling & Compliance</h2>
              </div>
              
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mb-0">
                <p className="text-sm text-slate-300 leading-relaxed">
                  <span className="text-amber-400 font-medium">Atlas One indexes catalog metadata and external provider endpoints.</span> Streams, 
                  downloads, and files are delivered directly from partner infrastructures. Atlas One neither stores 
                  nor redistributes media payloads. Purchase receipts record access rights without relocating content.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Content Sources</h2>
              </div>
              
              <p className="text-slate-400 mb-6">
                Atlas One aggregates content from verified public APIs. Live catalog 
                refreshed continuously with authentic content from trusted sources.
              </p>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Gamepad2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-white">Games</span>
                  </div>
                  <p className="text-xs text-slate-500">FreeToGame, GamerPower APIs</p>
                </div>
                
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Film className="w-4 h-4 text-rose-400" />
                    <span className="text-sm font-medium text-white">Movies & TV</span>
                  </div>
                  <p className="text-xs text-slate-500">OMDB, TVMaze, Internet Archive</p>
                </div>
                
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <Tv className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm font-medium text-white">Live TV</span>
                  </div>
                  <p className="text-xs text-slate-500">IPTV-org (10,000+ channels)</p>
                </div>
                
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-white">Ebooks</span>
                  </div>
                  <p className="text-xs text-slate-500">Gutendex (Project Gutenberg)</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500/10 via-[#1a1a1a]/80 to-indigo-500/10 border-purple-500/20">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">PWA & Standalone</h2>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                Atlas One is designed to stand on its own legs. Install it as a Progressive Web App (PWA) 
                on any device — Android, iOS, or desktop. After signing in with your wallet, you can pop 
                out to a browser for full-screen experience or stay in the app.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  Installable PWA
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  Browser Handoff
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  Wallet Authentication
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs">
                  Offline Support
                </span>
              </div>
            </div>
          </Card>
        </section>

        <footer className="text-center text-sm text-slate-500 pb-8">
          <p>Atlas One · Part of P3 Protocol Mesh Architecture</p>
          <p className="mt-2">
            <button 
              onClick={() => setLocation('/launcher')}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              Return to Hub
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}
