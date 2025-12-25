import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import SEO, { pageSEO } from '@/components/SEO';
import { 
  ArrowLeft, 
  Shield, 
  Lock, 
  MessageSquare,
  Mic,
  Globe,
  CheckCircle2,
  Target,
  Zap,
  Server,
  Key,
  Wallet,
  FileText,
  Layers,
  Network,
  Terminal,
  Code,
  Cpu,
  Database,
  Sparkles
} from 'lucide-react';

export default function AtlasWhitepaperPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <SEO {...pageSEO.atlasWhitepaper} />
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />
      
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center">
            <Globe className="w-6 h-6 text-violet-400" />
          </div>
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/20 border border-violet-500/30 mb-6">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-violet-300 font-medium">Orchestration Substrate</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Atlas Whitepaper
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Voice-First Web3 Mesh Operating System
          </p>
          <p className="text-sm text-slate-500 mt-4">Version 2.0 · December 2025</p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <span className="px-3 py-1.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-xs text-violet-300">900+ Commits</span>
            <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-300">390K+ LOC</span>
            <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-300">30+ Canvas Modes</span>
          </div>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-transparent to-purple-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Atlas is the central nervous system of P3 Protocol — an OS layer that unifies apps, 
                APIs, and Web3 flows into a single deterministic execution substrate. Unlike chatbots 
                or API gateways, Atlas executes real endpoints across Web2, Web3, and voice from a 
                single source of truth. Manifests define what apps can do; Atlas materializes the UI 
                and orchestrates the flows.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Core Capabilities</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Network className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-white font-semibold">Multi-Path Integration</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Accepts OpenAPI, GraphQL, JSON Schema, and Atlas-native manifests through 
                    unified /register endpoint with auto-detection.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-semibold">Canvas Auto-Materialization</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Manifests define canvas.display properties that automatically generate UI 
                    (cards, pipelines, tables) without frontend code.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-white font-semibold">3-Tier Intent Matching</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Regex patterns → Keyword mappings → Semantic fallback routes 55+ natural 
                    language patterns to live endpoints.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Database className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold">Session Memory</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Wallet-anchored session persistence stores preferences, interaction history, 
                    and active personas across sessions.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Canvas Modes (Nexus-Powered)</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Atlas Canvas renders Nexus capabilities as native substrate modes. Each mode connects 
                to live API endpoints with automatic wallet header injection and receipt instrumentation.
              </p>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-cyan-400 text-sm font-bold">In</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">InboxMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/nexus/inbox</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 text-sm font-bold">Mg</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">MessagesMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/nexus/messaging</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 text-sm font-bold">Ca</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">CallsMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/nexus/calls</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="text-purple-400 text-sm font-bold">Di</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">DirectoryMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/nexus/directory</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-400 text-sm font-bold">Py</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">PaymentsMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/payments</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400 text-sm font-bold">Rc</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">ReceiptsMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/nexus/receipts</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                    <span className="text-violet-400 text-sm font-bold">Nt</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">NotesMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/nexus/notes</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <span className="text-rose-400 text-sm font-bold">TV</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">TVMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/atlas-one/catalog</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-indigo-400 text-sm font-bold">Tk</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">TokensMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/web3/tokens</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                    <span className="text-sky-400 text-sm font-bold">Wx</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">WeatherMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/weather</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
                    <span className="text-pink-400 text-sm font-bold">AI</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">AIChatMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/chat</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-indigo-500/30 flex items-center justify-center">
                    <span className="text-purple-300 text-sm font-bold">A1</span>
                  </div>
                  <div>
                    <span className="text-white text-sm font-medium">AtlasOneMode</span>
                    <span className="text-slate-500 text-xs ml-2">/api/atlas-one/*</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 text-center">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300">
                  30+ Canvas Modes — unified substrate surface
                </span>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-transparent to-cyan-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Network className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Node Mode — Distributed Client</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Node Mode transforms any device into an always-on mesh participant. WebSocket-authoritative 
                connection with exponential backoff ensures persistent connectivity to the P3 network.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Always-On Connection</h4>
                  <p className="text-xs text-slate-400">
                    Persistent WebSocket with automatic reconnection. Your device becomes a mesh node, 
                    contributing to network health and earning participation rewards.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Mobile-First Architecture</h4>
                  <p className="text-xs text-slate-400">
                    Optimized for mobile devices with battery-conscious polling intervals and 
                    efficient data transfer using MessagePack compression.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Real-Time Mesh Metrics</h4>
                  <p className="text-xs text-slate-400">
                    Live dashboard showing connected peers, mesh health score, data throughput, 
                    and your node's contribution to the network.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Wallet-Anchored Identity</h4>
                  <p className="text-xs text-slate-400">
                    One-time WalletConnect signature creates persistent JWT session. No repeated 
                    authentication required across sessions.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-pink-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">P3 Hub Launcher</h2>
              </div>
              <p className="text-slate-400 mb-6">
                A visually stunning app launcher integrated within Atlas Canvas. Voice-activated 
                with live metrics and direct mode access.
              </p>
              
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Voice Activation</h4>
                  <p className="text-xs text-slate-400">
                    Say "show launcher" or "open hub" to instantly access all 30+ Canvas modes. 
                    Natural language routing finds the right mode automatically.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Live Metrics Dashboard</h4>
                  <p className="text-xs text-slate-400">
                    Real-time codebase stats, mesh health, connected peers, and system status 
                    displayed directly in the launcher interface.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Mode Categories</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">Communication</span>
                    <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">Finance</span>
                    <span className="px-2 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs">Media</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Productivity</span>
                    <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">Web3</span>
                    <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">Entertainment</span>
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
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Voice-First Interface</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Mic className="w-6 h-6 text-cyan-400" />
                    <h3 className="text-white font-semibold text-lg">Natural Language Commands</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Speak naturally to control apps, execute flows, and query data. Atlas interprets 
                    intent and routes to the appropriate endpoint automatically.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">"Check my balance"</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">"Send message to Alice"</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">"Play some music"</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Zap className="w-6 h-6 text-amber-400" />
                    <h3 className="text-white font-semibold text-lg">Compound Flows</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Chain multiple actions in a single command. "Message Alice and schedule a call 
                    for tomorrow" executes Nexus messaging and calendar in sequence.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">Sequential Execution</span>
                    <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">Parallel Execution</span>
                    <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs">Rollback Support</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Globe className="w-6 h-6 text-violet-400" />
                    <h3 className="text-white font-semibold text-lg">13 Visual Themes</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Voice-reactive visualization with customizable face themes. From minimal dots 
                    to liquid orbs, each theme responds to speech amplitude.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">Line</span>
                    <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">Globe</span>
                    <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">Wave Orb</span>
                    <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">Particles</span>
                    <span className="px-2 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs">+ 9 more</span>
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
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Code className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Multi-AI Integration</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Atlas operates as substrate layer while external LLMs provide semantic intelligence. 
                User Intent → LLM Parse → Atlas Execute → LLM Narrate.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-emerald-400">C</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">Claude</h4>
                  <p className="text-xs text-slate-500">Anthropic's Claude for reasoning</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-blue-400">G</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">GPT</h4>
                  <p className="text-xs text-slate-500">OpenAI GPT for general tasks</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-purple-400">G</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">Gemini</h4>
                  <p className="text-xs text-slate-500">Google Gemini for multimodal</p>
                </div>
              </div>
              
              <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm text-amber-300">
                  <strong>Security Boundary:</strong> LLMs receive structured JSON schemas only, never 
                  API keys or raw execution access. All credentials are server-side injected.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Security Architecture</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Lock className="w-5 h-5 text-rose-400" />
                    <h3 className="text-white font-semibold">AES-256-GCM Vault</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Credential storage with PBKDF2 key derivation. OAuth tokens encrypted at rest 
                    with wallet-derived master key.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Wallet className="w-5 h-5 text-amber-400" />
                    <h3 className="text-white font-semibold">Wallet-Anchored Sessions</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    All sessions bound to wallet address. Signature verification required for 
                    sensitive operations.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <Key className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-white font-semibold">Credential Isolation</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    LLMs never hold API keys. All execution flows through Atlas with server-side 
                    credential injection.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-white font-semibold">Zero-PII Design</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    All identifiers are wallet addresses. No personal data collection, no email/password 
                    accounts. Privacy by design.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Manifest-Driven Registry</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Apps declare their capabilities through manifests. Atlas reads the manifest and 
                knows what you can do — no custom integration code required.
              </p>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{`// Register an endpoint via manifest
{
  "devkit.key": "my-app.sales",
  "name": "Sales Report",
  "method": "GET",
  "url": "https://api.myapp.com/sales",
  "semantics.phrases": [
    "show my sales",
    "revenue today"
  ],
  "chat.enabled": true,
  "canvas.display": {
    "type": "card",
    "title": "Sales Report",
    "fields": [
      { "label": "Total", "key": "total", "format": "currency" }
    ]
  }
}`}
                </pre>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Server className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Architecture</h2>
              </div>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10 mb-6">
                <pre className="text-xs text-violet-400/80 font-mono overflow-x-auto whitespace-pre">
{`┌─────────────────────────────────────────────────────────────┐
│                      ATLAS ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │                     USER INTERFACE                        │
  │  Voice Input ─▶ STT ─▶ Intent Parser ─▶ Canvas UI        │
  └──────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  INTENT ROUTER    │
                    │                   │
                    │ • Regex Patterns  │
                    │ • Keyword Match   │
                    │ • Semantic ML     │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │  REGISTRY   │     │   VAULT     │     │  OAUTH      │
  │             │     │             │     │  MANAGER    │
  │ • Manifests │     │ • AES-GCM   │     │ • Tokens    │
  │ • Endpoints │     │ • PBKDF2    │     │ • Refresh   │
  │ • Intents   │     │ • Secrets   │     │ • Scopes    │
  └─────────────┘     └─────────────┘     └─────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  FLOW EXECUTOR    │
                    │                   │
                    │ • Sequential      │
                    │ • Parallel        │
                    │ • SSE Streaming   │
                    └─────────┬─────────┘
                              │
         ┌────────────────────┴────────────────────┐
         ▼                                         ▼
  ┌─────────────┐                         ┌─────────────┐
  │  WEB2 APIs  │                         │  WEB3 APIs  │
  │             │                         │             │
  │ • OAuth     │                         │ • Wallets   │
  │ • REST      │                         │ • Contracts │
  │ • GraphQL   │                         │ • Anchoring │
  └─────────────┘                         └─────────────┘`}
                </pre>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Network className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">100+ OAuth Connectors</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Pre-built connectors for popular services. Connect once, control from voice.
              </p>
              
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                {['Spotify', 'Gmail', 'Slack', 'Discord', 'GitHub', 'Linear', 'Notion', 'Stripe'].map((app) => (
                  <div key={app} className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
                    <span className="text-sm text-slate-300">{app}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4 text-center">+ 90 more connectors available</p>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-transparent to-violet-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">P3 Protocol Integration</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Atlas is the orchestration layer of P3 Protocol. It coordinates with Hub for app 
                discovery, Nexus for communications, and the SDK for developer access.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Hub Integration</h4>
                  <p className="text-xs text-slate-400">
                    Browse and launch apps from the Hub directly through voice. "Open the music player" 
                    or "Show me DeFi apps".
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Nexus Integration</h4>
                  <p className="text-xs text-slate-400">
                    Control encrypted messaging and calls through Atlas. "Message Alice" or "Start 
                    a video call with Bob".
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Wallet Anchoring</h4>
                  <p className="text-xs text-slate-400">
                    Every significant action can be anchored on-chain. "Anchor this transaction" 
                    creates immutable proof.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Developer SDK</h4>
                  <p className="text-xs text-slate-400">
                    Register your own endpoints via manifest. Users can voice-control your app 
                    through Atlas automatically.
                  </p>
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
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Why Atlas?</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-slate-400">
                  Traditional OSes are "platforms apps run on." Atlas is "a substrate apps are 
                  materialized through."
                </p>
                <p className="text-slate-400">
                  The distinction is subtle but huge:
                </p>
                <ul className="space-y-2 text-slate-400">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                    <span>Apps don't need to learn Atlas APIs</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                    <span>Apps don't need to be rewritten</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                    <span>Apps keep their own language/framework choices</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 shrink-0" />
                    <span>Atlas just needs the manifest to know what you can do</span>
                  </li>
                </ul>
                <p className="text-lg font-medium text-violet-300 mt-6">
                  The OS bends to the apps, not the other way around.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <footer className="text-center py-8 border-t border-white/10">
          <p className="text-sm text-slate-500">
            © 2025 P3 Protocol. All rights reserved.
          </p>
          <p className="text-xs text-slate-600 mt-2">
            Atlas Whitepaper v2.0 · December 2025
          </p>
        </footer>
      </div>
    </div>
  );
}
