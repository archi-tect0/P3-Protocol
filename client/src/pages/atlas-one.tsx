import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Layers,
  Gamepad2,
  Film,
  BookOpen,
  Box,
  ShoppingBag,
  Music,
  Tv,
  Receipt,
  Store,
  Anchor,
  ArrowRight,
  Rocket,
  Sun,
  Moon,
  Clock,
  Shield,
  Wallet,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import SEO from "@/components/SEO";
import { WalletLauncherButton } from "@/components/WalletLauncherMenu";
import { BrowserHandoffButton, useAutoPopout } from "@/components/BrowserHandoffButton";
import { getSession, disconnectBridge, type BridgeSession } from "@/lib/sessionBridgeV2";
import { useSessionRestore } from "@/hooks/use-session-restore";

const features = [
  {
    icon: Gamepad2,
    title: "500+ Free Games",
    description: "Browser-based and native games with mod support, leaderboards, and achievement tracking",
    gradient: "from-rose-500 to-orange-600",
  },
  {
    icon: Tv,
    title: "600+ Live TV Channels",
    description: "IPTV streams from around the world with EPG guides and favorites management",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    icon: Film,
    title: "Movies & TV Shows",
    description: "Stream video content with 48-hour rentals and blockchain purchase receipts",
    gradient: "from-purple-500 to-violet-600",
  },
  {
    icon: BookOpen,
    title: "Digital Library",
    description: "Ebooks and audiobooks with reading progress sync and wallet-anchored purchases",
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    icon: Music,
    title: "Audio Streaming",
    description: "Music and podcasts with creator splits and provenance tracking",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Box,
    title: "Apps Marketplace",
    description: "Curated applications with verified developers and blockchain receipts",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: ShoppingBag,
    title: "Product Commerce",
    description: "Physical and digital products with dual-mode shopping (anchored or browser checkout)",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: Receipt,
    title: "Blockchain Receipts",
    description: "Every purchase anchored on-chain. Provable ownership, immutable records",
    gradient: "from-slate-500 to-zinc-600",
  },
  {
    icon: Clock,
    title: "48-Hour Rentals",
    description: "Rent content with time-locked access and automatic expiration handling",
    gradient: "from-orange-500 to-red-600",
  },
];

const contentTypes = [
  { icon: Gamepad2, label: "Games", count: "500+" },
  { icon: Tv, label: "TV Channels", count: "600+" },
  { icon: Film, label: "Movies", count: "1000+" },
  { icon: BookOpen, label: "Ebooks", count: "2000+" },
  { icon: Music, label: "Audio", count: "500+" },
  { icon: Box, label: "Apps", count: "100+" },
];

export default function AtlasOneLandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [session, setSession] = useState<BridgeSession | null>(null);
  
  useAutoPopout({ isPrimaryRoute: true });
  const { restoredWallet } = useSessionRestore();

  useEffect(() => {
    const existingSession = getSession();
    if (existingSession?.connected) {
      setSession(existingSession);
    }
  }, []);
  
  useEffect(() => {
    if (restoredWallet && !session) {
      console.log('[AtlasOne] Session restored from install_token:', restoredWallet);
      const existingSession = getSession();
      if (existingSession?.connected) {
        setSession(existingSession);
      }
    }
  }, [restoredWallet]);

  const handleConnect = (newSession: BridgeSession) => {
    setSession(newSession);
    localStorage.setItem('walletAddress', newSession.address);
  };

  const handleDisconnect = async () => {
    await disconnectBridge();
    setSession(null);
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('token');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden" data-testid="page-atlas-one">
      <SEO
        title="Atlas One | P3 Protocol"
        description="Unified entertainment substrate with games, live TV, movies, ebooks, music, and products. Dual-mode shopping with blockchain receipts and 48-hour rentals."
      />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity" data-testid="link-home">
                ← P3 Protocol
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                data-testid="button-theme-toggle"
                className="text-slate-400 hover:text-white"
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </Button>
              
              <WalletLauncherButton
                session={session}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                returnPath="/atlas-one"
                variant="compact"
              />
            </div>
          </div>
        </div>
      </nav>
      
      <BrowserHandoffButton />

      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/30 via-slate-950 to-blue-900/20" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />

        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 flex items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-500/40 shadow-2xl shadow-cyan-500/20" data-testid="icon-atlasone-hero">
                <Layers className="w-12 h-12 text-cyan-400" />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-hero-title">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Atlas One
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-4 max-w-2xl mx-auto" data-testid="text-hero-tagline">
              Unified Entertainment Substrate
            </p>
            
            <p className="text-base text-slate-500 mb-8 max-w-xl mx-auto">
              Games, Live TV, Movies, Ebooks, Music, Apps, and Products — all in one place with blockchain receipts and wallet-anchored purchases.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/atlas">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/25"
                  data-testid="button-launch-atlasone"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Atlas One
                </Button>
              </Link>
              <Link href="/launcher/atlas-one-whitepaper">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                  data-testid="button-read-whitepaper"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Read Whitepaper
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-6 border-y border-white/5 bg-slate-900/50">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {contentTypes.map((type) => (
              <div key={type.label} className="text-center">
                <div className="w-12 h-12 mx-auto mb-2 flex items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <type.icon className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-lg font-bold text-white">{type.count}</div>
                <div className="text-xs text-slate-500">{type.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6" data-testid="section-features">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-sm text-cyan-400 mb-4" data-testid="badge-features">
              Platform Features
            </span>
            <h2 className="text-3xl font-bold text-white mb-4" data-testid="text-features-title">
              Everything Entertainment, One Substrate
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto" data-testid="text-features-description">
              A unified entertainment platform with blockchain integration, wallet-anchored purchases, and dual-mode commerce
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/30 transition-all duration-300 group"
                data-testid={`card-feature-${index}`}
              >
                <CardContent className="p-6">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-gradient-to-br from-cyan-900/20 via-slate-950 to-blue-900/20">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Dual-Mode Shopping</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Choose how you want to purchase: anchored mode with blockchain receipts or browser mode for traditional checkout
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-900/50 border-cyan-500/30 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Anchor className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Anchored Mode</h3>
                  <p className="text-sm text-slate-400">Blockchain receipt</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  Immutable proof of purchase
                </li>
                <li className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-cyan-400" />
                  Wallet-anchored ownership
                </li>
                <li className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-cyan-400" />
                  Exportable receipts
                </li>
              </ul>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-500/20 flex items-center justify-center">
                  <Store className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Browser Mode</h3>
                  <p className="text-sm text-slate-400">Merchant checkout</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-slate-400">
                <li className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  Direct merchant redirect
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  Traditional payment methods
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-slate-500" />
                  No wallet required
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Explore?</h2>
          <p className="text-slate-400 mb-8">
            Access thousands of entertainment options with wallet-anchored purchases and blockchain receipts
          </p>
          <Link href="/atlas">
            <Button
              size="lg"
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/25"
              data-testid="button-cta-launch"
            >
              <Rocket className="w-5 h-5 mr-2" />
              Launch Atlas One
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-4xl text-center text-sm text-slate-500">
          <p>Atlas One is part of the P3 Protocol ecosystem</p>
        </div>
      </footer>
    </div>
  );
}
