import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Gamepad2,
  Layers,
  Box,
  Anchor,
  Sparkles,
  Trophy,
  Terminal,
  Store,
  Cpu,
  Lock,
  ArrowRight,
  Rocket,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import SEO from "@/components/SEO";
import { WalletLauncherButton } from "@/components/WalletLauncherMenu";
import { BrowserHandoffButton, useAutoPopout } from "@/components/BrowserHandoffButton";
import { getSession, disconnectBridge, type BridgeSession } from "@/lib/sessionBridgeV2";
import { useSessionRestore } from "@/hooks/use-session-restore";

const features = [
  {
    icon: Layers,
    title: "Steam-Deck Style Fullscreen Catalog",
    description: "Browse and launch games in a beautiful fullscreen interface optimized for gaming sessions",
    gradient: "from-rose-500 to-orange-600",
  },
  {
    icon: Box,
    title: "CurseForge/Modrinth Mod Integration",
    description: "Pull mods from popular platforms, enable/disable per wallet, and manage your modding experience",
    gradient: "from-purple-500 to-indigo-600",
  },
  {
    icon: Anchor,
    title: "On-Chain Event Anchoring",
    description: "Anchor game events to the blockchain for just 0.00015 ETH per event. Provable, immutable records",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: Sparkles,
    title: "NFT Injection for In-Game Assets",
    description: "Inject NFTs into games as in-game assets. Verify ownership and unlock exclusive content",
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    icon: Trophy,
    title: "Wallet-Scoped Leaderboards & Tournaments",
    description: "Create anchored leaderboards and host tournaments with verifiable on-chain results",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: Terminal,
    title: "Developer SDK for Game Integration",
    description: "Comprehensive SDK for developers to integrate Game Deck features into their games",
    gradient: "from-slate-500 to-zinc-600",
  },
  {
    icon: Store,
    title: "Purchase/Marketplace with Receipts",
    description: "Buy games and mods with blockchain receipts. Verify ownership and track transactions",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Cpu,
    title: "Sandbox Creation with AI Agents",
    description: "Create game sandboxes with AI-powered agents. Test, iterate, and deploy with confidence",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Lock,
    title: "Private Endpoints for Developers",
    description: "Register private API endpoints with authentication. Secure your game backend integrations",
    gradient: "from-red-500 to-rose-600",
  },
];

export default function GameDeckPage() {
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
      console.log('[GameDeck] Session restored from install_token:', restoredWallet);
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
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden" data-testid="page-game-deck">
      <SEO
        title="Game Deck | P3 Protocol"
        description="Full-stack gaming substrate with catalog, mods, tournaments, and blockchain anchoring. Steam-deck style fullscreen gaming experience with Web3 integration."
      />

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <div className="text-lg font-bold bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity" data-testid="link-home">
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
                returnPath="/game-deck"
                variant="compact"
              />
            </div>
          </div>
        </div>
      </nav>
      
      <BrowserHandoffButton />

      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-900/30 via-slate-950 to-orange-900/20" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-rose-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl" />

        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <div className="w-24 h-24 flex items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/30 to-orange-500/30 border border-rose-500/40 shadow-2xl shadow-rose-500/20" data-testid="icon-gamedeck-hero">
                <Gamepad2 className="w-12 h-12 text-rose-400" />
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4" data-testid="text-hero-title">
              <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                Atlas Game Deck
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto" data-testid="text-hero-tagline">
              Full-stack gaming substrate with catalog, mods, tournaments, and blockchain anchoring
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/atlas?mode=gamedeck">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white shadow-lg shadow-rose-500/25"
                  data-testid="button-launch-gamedeck"
                >
                  <Rocket className="w-5 h-5 mr-2" />
                  Launch Game Deck
                </Button>
              </Link>
              <Link href="/sdk">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
                  data-testid="button-developer-sdk"
                >
                  <Terminal className="w-5 h-5 mr-2" />
                  Developer SDK
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6" data-testid="section-features">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 mb-4" data-testid="badge-features">
              Platform Features
            </span>
            <h2 className="text-3xl font-bold text-white mb-4" data-testid="text-features-title">
              Everything You Need for Web3 Gaming
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto" data-testid="text-features-description">
              A complete gaming substrate with blockchain integration, mod support, tournaments, and developer tools
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-features">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-white/5 border-white/10 hover:border-rose-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/10"
                data-testid={`card-feature-${index + 1}`}
              >
                <CardHeader>
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} bg-opacity-20 border border-white/10 mb-2`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-white text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-400">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-white/10" data-testid="section-developer-cta">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-rose-500/10 to-orange-500/10 border-rose-500/20">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-white mb-3" data-testid="text-developer-cta-title">
                    Build on Game Deck
                  </h3>
                  <p className="text-slate-400 mb-6" data-testid="text-developer-cta-description">
                    Integrate your game with the P3 Protocol Game Deck SDK. Access anchoring, leaderboards, 
                    tournaments, and more with just a few lines of code.
                  </p>
                  <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                    <Link href="/sdk">
                      <Button
                        className="bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white"
                        data-testid="button-view-sdk-docs"
                      >
                        View SDK Docs
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                    <Link href="/atlas?mode=gamedeck">
                      <Button
                        variant="outline"
                        className="border-white/20 text-white hover:bg-white/10"
                        data-testid="button-try-gamedeck"
                      >
                        Try Game Deck
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 flex items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30">
                    <Terminal className="w-16 h-16 text-rose-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-12 px-6 border-t border-white/10" data-testid="section-pricing">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-2xl font-bold text-white mb-4" data-testid="text-pricing-title">
            Transparent Pricing
          </h3>
          <div className="flex flex-wrap justify-center gap-8">
            <div className="flex flex-col items-center" data-testid="pricing-anchoring">
              <span className="text-3xl font-bold bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
                0.00015 ETH
              </span>
              <span className="text-slate-400 text-sm">per event anchored</span>
            </div>
            <div className="flex flex-col items-center" data-testid="pricing-catalog">
              <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                Free
              </span>
              <span className="text-slate-400 text-sm">catalog & mod browsing</span>
            </div>
            <div className="flex flex-col items-center" data-testid="pricing-sdk">
              <span className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Open Source
              </span>
              <span className="text-slate-400 text-sm">SDK & documentation</span>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-white/10">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="text-slate-500 text-sm" data-testid="text-footer">
            Game Deck is part of the P3 Protocol ecosystem
          </p>
        </div>
      </footer>
    </div>
  );
}
