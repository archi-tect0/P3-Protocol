import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket, Grid3X3, Shield, CreditCard, Palette, Users, BarChart3, Code, Gamepad2, Globe, Anchor, Smartphone, Lock } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function P3HubGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO
        title="P3 Hub - Launcher OS Documentation | P3 Protocol"
        description="Comprehensive guide to P3 Hub: 50+ wallet-anchored apps, personalized layouts, PWA support, and blockchain-verified activity."
      />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-white/20" data-testid="button-view-source">
              <SiGithub className="w-4 h-4 mr-2" />
              View Source
            </Button>
          </a>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
              <Rocket className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">P3 Hub</h1>
              <p className="text-slate-400">The Launcher OS with 50+ Wallet-Anchored Apps</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            P3 Hub is the flagship launcher interface providing access to 50+ native applications,
            each with wallet-linked sessions and blockchain-anchored activity. Personalize your 
            layout with favorites, folders, dock customization, and cross-device sync.
          </p>
        </div>

        <div className="space-y-8">
          {/* Overview */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-violet-400" />
              Overview
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Access P3 Hub at <code className="text-cyan-400">/launcher</code>. Connect your wallet 
                to unlock personalized features including installed apps, layout preferences, and 
                anchor history.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-violet-400">50+</div>
                  <div className="text-sm text-slate-400">Native Apps</div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-400">10</div>
                  <div className="text-sm text-slate-400">Categories</div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400">100+</div>
                  <div className="text-sm text-slate-400">Anchor Events</div>
                </div>
              </div>
            </div>
          </section>

          {/* App Categories */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Application Catalog
            </h2>
            <div className="space-y-4">
              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <h4 className="font-semibold text-white">Communication</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Atlas', 'Messages', 'Video', 'Voice', 'Contact Us'].map(app => (
                    <span key={app} className="px-2 py-1 bg-violet-500/10 border border-violet-500/20 rounded text-xs text-violet-300">{app}</span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-semibold text-white">Security & Identity</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Identity Vault', 'Key Rotation', 'Presence', 'Badges', 'Session', 'Policy', 'Proof Read', 'Photos'].map(app => (
                    <span key={app} className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs text-emerald-300">{app}</span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="w-4 h-4 text-green-400" />
                  <h4 className="font-semibold text-white">Payments & Commerce</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Invoice', 'Marketplace', 'Rewards', 'Quota', 'Payments', 'Crypto Tracker'].map(app => (
                    <span key={app} className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-xs text-green-300">{app}</span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-pink-400" />
                  <h4 className="font-semibold text-white">Creative</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Sketchpad', 'Whiteboard', 'Loop', 'Music Jam', 'Meme Mint', 'Video Feed', 'Story', 'Writer'].map(app => (
                    <span key={app} className="px-2 py-1 bg-pink-500/10 border border-pink-500/20 rounded text-xs text-pink-300">{app}</span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <h4 className="font-semibold text-white">Social & Governance</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Vote', 'Micro DAO', 'Trivia', 'Link', 'Reminder', 'Notes'].map(app => (
                    <span key={app} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">{app}</span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gamepad2 className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-semibold text-white">Games</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Asteroid', 'Breakout', 'Maze', 'Coin', 'Reaction', 'Racer', 'Tower', 'Gravity Grid'].map(app => (
                    <span key={app} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-xs text-cyan-300">{app}</span>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <h4 className="font-semibold text-white">Analytics & Developer</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Analytics', 'Receipts', 'Calc', 'Mod Panel', 'Xbox Gaming'].map(app => (
                    <span key={app} className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300">{app}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Anchor Events */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Anchor className="w-5 h-5 text-emerald-400" />
              Blockchain Anchoring
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Every app action is anchored to the blockchain via the anchor events system. 
                Each tile defines its own anchor events that create an immutable audit trail.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// client/src/pages/launcher/appRegistry.tsx

export const anchorEventsMap: Record<string, string[]> = {
  'identity-vault': ['identity_created', 'identity_verified', 'identity_updated'],
  'key-rotation': ['key_rotated', 'key_generated', 'key_revoked'],
  'invoice': ['invoice_created', 'payment_received', 'invoice_settled'],
  'game-gravity-grid': ['game_start', 'game_over', 'lines_cleared', 'high_score'],
  'encrypted-gallery': ['image_uploaded', 'image_anchored', 'gallery_unlocked'],
  // ... 100+ anchor events across all apps
};

// Each app tile emits anchor events
export interface AppDefinition {
  id: string;
  name: string;
  icon: ReactNode;
  gradient: string;
  category: 'communication' | 'security' | 'payments' | 'creative' | 
            'social' | 'governance' | 'analytics' | 'developer' | 'games';
  component: ComponentType<EmbedHandler>;
  anchorEvents?: string[];
  gatedRole?: 'moderator';
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Personalization */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-pink-400" />
              Personalization & Layout
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                P3 Hub supports per-wallet customization including favorites, folders, dock apps,
                backgrounds, and password protection.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Hooks for hub personalization

import { useHubLayout } from '@/hooks/use-hub-layout';
import { useHubPreferences } from '@/hooks/use-hub-preferences';

function LauncherPage() {
  const { layout, toggleFavorite, isFavorite, createFolder, 
          addToFolder, removeFromFolder } = useHubLayout(walletAddress);
  
  const { preferences, updateDockApp, deleteDockApp, 
          updateBackground, updateDockStyle, toggleDock,
          setPassword, clearPassword } = useHubPreferences(walletAddress);
  
  // Toggle favorite
  const handleFavorite = (appId: string) => {
    toggleFavorite(appId);
  };
  
  // Create folder with apps
  const handleCreateFolder = (name: string, apps: string[]) => {
    createFolder(name, apps);
  };
  
  // Customize dock
  const handleDockUpdate = (position: number, appId: string) => {
    updateDockApp(position, appId);
  };
}`}</code></pre>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Layout Features</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Favorite apps (starred)</li>
                    <li>Custom folders</li>
                    <li>Drag-and-drop organization</li>
                    <li>Category filtering</li>
                    <li>Installed-only view</li>
                  </ul>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Preference Features</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Custom dock apps</li>
                    <li>Background themes</li>
                    <li>Dock style (show/hide)</li>
                    <li>Password protection</li>
                    <li>Cross-device sync</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* PWA & Cross-Device */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-400" />
              PWA & Cross-Device
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                P3 Hub is a Progressive Web App with install prompts, standalone mode, 
                and browser handoff for seamless cross-device experiences.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// PWA and session management

import { usePWA } from '@/hooks/use-pwa';
import { useSessionRestore } from '@/hooks/use-session-restore';
import { BrowserHandoffButton, useAutoPopout } from '@/components/BrowserHandoffButton';

function LauncherPage() {
  const { isInstallable, isStandalone, promptInstall } = usePWA('launcher');
  const { isRestoring, restoredWallet } = useSessionRestore();
  
  useAutoPopout({ isPrimaryRoute: true }); // Hub triggers popout
  
  // Restore session from bridge
  useEffect(() => {
    if (checkWalletReturn()) {
      const resumed = await resumeSession();
      if (resumed) setSession(resumed);
    }
  }, []);
  
  return (
    <>
      {isInstallable && (
        <Button onClick={promptInstall}>Install P3 Hub</Button>
      )}
      <BrowserHandoffButton />
    </>
  );
}`}</code></pre>
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
                <code className="text-sm text-violet-400">client/src/pages/launcher/LauncherPage.tsx</code>
                <span className="text-xs text-slate-500">Main Hub UI</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">client/src/pages/launcher/appRegistry.tsx</code>
                <span className="text-xs text-slate-500">App definitions & anchors</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-emerald-400">client/src/hooks/use-hub-layout.ts</code>
                <span className="text-xs text-slate-500">Layout management</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-pink-400">client/src/hooks/use-hub-preferences.ts</code>
                <span className="text-xs text-slate-500">Preferences & dock</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">client/src/components/games/</code>
                <span className="text-xs text-slate-500">Game tiles</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/cross-chain">
            <Button variant="outline" className="border-white/20" data-testid="button-prev-cross-chain">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Cross-Chain
            </Button>
          </Link>
          <Link href="/docs/canvas-modes">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-600" data-testid="button-next-canvas-modes">
              Next: Canvas Modes
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
