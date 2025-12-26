import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Sun, Moon, Lock, Anchor, Layers, 
  MessageSquare, Shield, Globe,
  CheckCircle, Radio, Network, Zap, Server, Link2, Rocket
} from "lucide-react";
import { SiGithub, SiTelegram } from "react-icons/si";
import { useTheme } from "@/lib/theme";
import P3Logo from "@/components/P3Logo";
import SEO, { pageSEO } from "@/components/SEO";
import { disconnectBridge, getSession, type BridgeSession } from "@/lib/sessionBridgeV2";
import { WalletLauncherButton } from "@/components/WalletLauncherMenu";
import { BrowserHandoffButton, useAutoPopout } from "@/components/BrowserHandoffButton";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [session, setSession] = useState<BridgeSession | null>(null);
  
  useAutoPopout({ isPrimaryRoute: true });

  useEffect(() => {
    const existingSession = getSession();
    if (existingSession?.connected) {
      setSession(existingSession);
    }
  }, []);

  const handleConnect = (newSession: BridgeSession) => {
    setSession(newSession);
    localStorage.setItem('walletAddress', newSession.address);
  };

  const handleDisconnect = async () => {
    await disconnectBridge();
    setSession(null);
    localStorage.removeItem('walletAddress');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      <SEO {...pageSEO.landing} />
      
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-white">P3 Protocol</div>
              <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-xs text-emerald-400 font-mono">Apache 2.0</span>
            </div>
            
            <div className="flex items-center gap-3">
              <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                  <SiGithub className="w-5 h-5" />
                </Button>
              </a>
              <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="button-theme-toggle" className="text-slate-400 hover:text-white">
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
              <WalletLauncherButton session={session} onConnect={handleConnect} onDisconnect={handleDisconnect} returnPath="/" variant="compact" />
            </div>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-16 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-950 to-cyan-900/10" />
        
        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <P3Logo className="w-24 h-24" />
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              P3 Protocol
            </h1>
            
            <p className="text-xl text-slate-300 mb-3">
              Open Source Web3 Mesh Operating System
            </p>
            
            <p className="text-lg text-cyan-400 font-medium mb-3">
              Stop building apps that live on servers. Start launching networks that live everywhere.
            </p>
            
            <p className="text-slate-400 mb-8 max-w-2xl mx-auto">
              Production-ready infrastructure for the decentralized web. Grab what you need: 
              encrypted messaging, self-healing streams, blockchain receipts, or the entire mesh OS.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-200" data-testid="button-github">
                  <SiGithub className="w-5 h-5 mr-2" />
                  View on GitHub
                </Button>
              </a>
              <Link href="/atlas">
                <Button size="lg" variant="outline" className="border-slate-300 dark:border-white/20 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10" data-testid="button-demo">
                  <Globe className="w-5 h-5 mr-2" />
                  Live Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-3xl">
          <div className="prose prose-invert prose-lg mx-auto">
            <p className="text-slate-300 leading-relaxed mb-6">
              P3 Protocol is open-source infrastructure for an era that hasn't arrived yet. We're giving you the protocol, the encryption, and the network. What you build on top of it is up to you.
            </p>
            
            <p className="text-slate-300 leading-relaxed mb-6">
              Most decentralized networks require specialized browsers, cryptography expertise, or expensive hardware. P3 requires a click. The mesh logic integrates directly into the stack—a user becomes a contributing node just by visiting a URL. No installation. No configuration. Just participation.
            </p>
            
            <p className="text-slate-300 leading-relaxed mb-6">
              This is the first protocol that prioritizes the packet, not the provider. True net neutrality, hard-coded into the mesh. Multiplexed P2P routing with end-to-end encryption means the network is mathematically incapable of discriminating between a video stream and a private message. Both receive equal treatment.
            </p>
            
            <p className="text-slate-300 leading-relaxed mb-6">
              The architecture inverts the traditional CDN model. Instead of corporations spending billions to prevent buffering, P3 makes every viewer part of the solution. Users become micro-distributors. The network gets stronger and faster as more people join. No central bottlenecks. No "Server Busy" errors. Self-healing by design.
            </p>
            
            <p className="text-slate-300 leading-relaxed mb-6">
              P3 isn't a finished product—it's the factory. A production-ready template where developers can plug in any service (streaming, messaging, finance, identity) without rebuilding the underlying security or networking. Grab individual components: the encryption stack, the real-time transport, the receipt anchoring, the mesh relay. Or deploy the entire operating system.
            </p>
            
            <p className="text-slate-400 leading-relaxed italic">
              Build in five minutes what used to take five years. The definitive template for a neutral, decentralized future.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2 text-white">What's Included</h2>
            <p className="text-slate-500">Full-stack implementation you can run, modify, and deploy</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <Link href="/atlas">
              <div className="bg-white/5 rounded-xl border border-white/10 p-5 cursor-pointer hover:border-violet-400/50 transition-all h-full">
                <Globe className="w-8 h-8 text-violet-400 mb-3" />
                <h3 className="font-bold text-white mb-2">Atlas Canvas</h3>
                <p className="text-sm text-slate-400 mb-3">
                  Unified interface with 40+ modes. TV, radio, ebooks, games, weather, AI chat - all from open sources.
                </p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> IPTV stream aggregation</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Project Gutenberg sync</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Free game catalog</li>
                </ul>
                <div className="mt-3 text-xs text-violet-400 font-medium">Open Atlas →</div>
              </div>
            </Link>

            <Link href="/app">
              <div className="bg-white/5 rounded-xl border border-white/10 p-5 cursor-pointer hover:border-cyan-400/50 transition-all h-full">
                <MessageSquare className="w-8 h-8 text-cyan-400 mb-3" />
                <h3 className="font-bold text-white mb-2">Nexus Messaging</h3>
                <p className="text-sm text-slate-400 mb-3">
                  End-to-end encrypted messaging with wallet identity. WebRTC voice/video calls.
                </p>
                <ul className="text-xs text-slate-500 space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> TweetNaCl encryption</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Kyber-ready architecture</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Zero PII design</li>
                </ul>
                <div className="mt-3 text-xs text-cyan-400 font-medium">Open Nexus →</div>
              </div>
            </Link>

            <Link href="/docs/atlas-api">
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-xl border border-amber-500/30 p-5 cursor-pointer hover:border-amber-400/50 transition-all h-full">
                <Network className="w-8 h-8 text-amber-400 mb-3" />
                <h3 className="font-bold text-white mb-2">Atlas API v2 Protocol</h3>
                <p className="text-sm text-slate-300 mb-3">
                  8-lane multiplexed transport with dictionary compression.
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-amber-400" /> MessagePack binary encoding</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-amber-400" /> Priority-scheduled streaming</li>
                </ul>
                <div className="mt-3 text-xs text-amber-400 font-medium">Read the guide →</div>
              </div>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/docs/mesh-os">
              <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-xl border border-emerald-500/30 p-5 cursor-pointer hover:border-emerald-400/50 transition-all">
                <Server className="w-8 h-8 text-emerald-400 mb-3" />
                <h3 className="font-bold text-white mb-2">Node Network</h3>
                <p className="text-sm text-slate-300 mb-3">
                  Decentralized mesh with cross-chain bridging. Run your own node, relay content, bridge receipts.
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> MeshClient transport layer</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Bridge to Polygon/Arbitrum/Optimism</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-400" /> Content-addressed chunk storage</li>
                </ul>
                <div className="mt-3 text-xs text-emerald-400 font-medium">Explore mesh architecture →</div>
              </div>
            </Link>

            <Link href="/launcher">
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-xl border border-purple-500/30 p-5 cursor-pointer hover:border-purple-400/50 transition-all">
                <Rocket className="w-8 h-8 text-purple-400 mb-3" />
                <h3 className="font-bold text-white mb-2">P3 Hub</h3>
                <p className="text-sm text-slate-300 mb-3">
                  50+ wallet-anchored apps in one launcher. Session bridge syncs across tabs and devices.
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-purple-400" /> Wallet-gated app launcher</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-purple-400" /> Cross-tab session sync</li>
                  <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-purple-400" /> Blockchain-anchored proofs</li>
                </ul>
                <div className="mt-3 text-xs text-purple-400 font-medium">Launch the Hub →</div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-2 text-white">Implementation Guides</h2>
            <p className="text-slate-500">Step-by-step documentation with code examples</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/docs/session-bridge">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer group h-full">
                <Lock className="w-6 h-6 text-emerald-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-emerald-400">Session Bridge</h3>
                <p className="text-xs text-slate-500">WalletConnect, signing mutex, browser handoff</p>
              </div>
            </Link>

            <Link href="/docs/encryption">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-violet-500/30 transition-all cursor-pointer group h-full">
                <Shield className="w-6 h-6 text-violet-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-violet-400">Encryption Stack</h3>
                <p className="text-xs text-slate-500">TweetNaCl, Kyber architecture, key management</p>
              </div>
            </Link>

            <Link href="/docs/atlas-api">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-amber-500/30 transition-all cursor-pointer group h-full">
                <Network className="w-6 h-6 text-amber-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-amber-400">Atlas API v2</h3>
                <p className="text-xs text-slate-500">8-lane protocol, dictionary, handshake</p>
              </div>
            </Link>

            <Link href="/docs/nexus">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-cyan-500/30 transition-all cursor-pointer group h-full">
                <MessageSquare className="w-6 h-6 text-cyan-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-cyan-400">Nexus Messaging</h3>
                <p className="text-xs text-slate-500">E2E encryption, WebRTC, inbox sync</p>
              </div>
            </Link>

            <Link href="/docs/canvas-modes">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer group h-full">
                <Layers className="w-6 h-6 text-indigo-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-indigo-400">Canvas Modes</h3>
                <p className="text-xs text-slate-500">40+ modes, content sync, shared store</p>
              </div>
            </Link>

            <Link href="/docs/blockchain">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-emerald-500/30 transition-all cursor-pointer group h-full">
                <Anchor className="w-6 h-6 text-emerald-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-emerald-400">Blockchain Anchoring</h3>
                <p className="text-xs text-slate-500">Smart contracts, BullMQ queue, receipts</p>
              </div>
            </Link>

            <Link href="/docs/mesh-os">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer group h-full">
                <Radio className="w-6 h-6 text-purple-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-purple-400">Mesh OS & Node Mode</h3>
                <p className="text-xs text-slate-500">Relay, caching, cross-chain bridge</p>
              </div>
            </Link>

            <Link href="/docs/api-bridge">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-orange-500/30 transition-all cursor-pointer group h-full">
                <Zap className="w-6 h-6 text-orange-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-orange-400">API Bridge</h3>
                <p className="text-xs text-slate-500">OAuth vault, rate limits, credential isolation</p>
              </div>
            </Link>

            <Link href="/docs/infrastructure">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-teal-500/30 transition-all cursor-pointer group h-full">
                <Server className="w-6 h-6 text-teal-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-teal-400">Infrastructure</h3>
                <p className="text-xs text-slate-500">Redis pub/sub, IPFS/Pinata, storage</p>
              </div>
            </Link>

            <Link href="/docs/cross-chain">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-pink-500/30 transition-all cursor-pointer group h-full">
                <Link2 className="w-6 h-6 text-pink-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-pink-400">Cross-Chain</h3>
                <p className="text-xs text-slate-500">LayerZero, Wormhole, multi-chain settlement</p>
              </div>
            </Link>

            <Link href="/docs/p3-hub">
              <div className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 hover:border-violet-500/30 transition-all cursor-pointer group h-full">
                <Rocket className="w-6 h-6 text-violet-400 mb-2" />
                <h3 className="font-semibold text-white text-sm mb-1 group-hover:text-violet-400">P3 Hub</h3>
                <p className="text-xs text-slate-500">Launcher OS with 50+ wallet-anchored apps</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2 text-white">Quick Start</h2>
            <p className="text-slate-500">Get running locally</p>
          </div>

          <div className="bg-slate-900 rounded-xl border border-white/10 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="text-xs text-slate-500 ml-2 font-mono">terminal</span>
            </div>
            <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
              <code>{`git clone https://github.com/archi-tect0/P3-Protocol.git
cd P3-Protocol
npm install
cp .env.example .env
npm run db:push
npm run dev`}</code>
            </pre>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4 text-center">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-lg font-bold text-emerald-400">PostgreSQL</div>
              <p className="text-xs text-slate-500">Required</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-lg font-bold text-cyan-400">Redis</div>
              <p className="text-xs text-slate-500">Optional</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-lg font-bold text-violet-400">Node 20+</div>
              <p className="text-xs text-slate-500">Required</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2 text-white">Technology Stack</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-mono text-sm text-emerald-400 mb-2">Frontend</h4>
              <p className="text-xs text-slate-400">React, Vite, TypeScript, TanStack Query, Tailwind, shadcn/ui</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-mono text-sm text-cyan-400 mb-2">Backend</h4>
              <p className="text-xs text-slate-400">Node.js, Express, PostgreSQL (Drizzle), Redis, BullMQ, Socket.io</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-mono text-sm text-violet-400 mb-2">Blockchain</h4>
              <p className="text-xs text-slate-400">Ethers.js v6, Hardhat, Base Network, wagmi, viem, WalletConnect</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-mono text-sm text-amber-400 mb-2">Cryptography</h4>
              <p className="text-xs text-slate-400">TweetNaCl (Curve25519, XSalsa20-Poly1305), Kyber-ready architecture</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2 text-white">Project Structure</h2>
          </div>

          <div className="bg-slate-900 rounded-xl border border-white/10 p-5">
            <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
              <code>{`P3-Protocol/
├── client/                 # React frontend
│   ├── src/components/     # UI components
│   ├── src/pages/          # Route pages
│   └── src/lib/            # Core utilities (crypto, session)
├── server/                 # Express backend
│   ├── atlas/              # Atlas API v2
│   ├── routes.ts           # API endpoints
│   └── storage.ts          # Database interface
├── packages/               # Modular components
│   ├── zk/                 # Zero-knowledge circuits
│   ├── protocol/           # Wire format schemas
│   └── bridge/             # Cross-chain adapters
├── rust/pqcrypto/          # Post-quantum crypto (WASM)
├── contracts/              # Solidity contracts
├── shared/schema.ts        # Drizzle schema
└── docs/                   # Documentation`}</code>
            </pre>
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">P3 Protocol</span>
              <span className="text-xs text-slate-600">Apache 2.0</span>
            </div>
            
            <div className="flex items-center gap-6">
              <a href="https://github.com/archi-tect0/P3-Protocol" className="text-sm text-slate-400 hover:text-white flex items-center gap-2" data-testid="link-github-footer">
                <SiGithub className="w-4 h-4" /> GitHub
              </a>
              <a href="https://t.me/P3Atlas" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white flex items-center gap-2" data-testid="link-telegram-footer">
                <SiTelegram className="w-4 h-4" /> Telegram
              </a>
              <Link href="/docs/session-bridge" className="text-sm text-slate-400 hover:text-white">
                Documentation
              </Link>
              <Link href="/atlas" className="text-sm text-slate-400 hover:text-white">
                Demo
              </Link>
            </div>
          </div>
        </div>
      </footer>
      
      <BrowserHandoffButton />
    </div>
  );
}
