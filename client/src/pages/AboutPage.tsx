import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, Shield, Lock, Anchor, Smartphone, Globe, 
  FileText, Download, Code, MessageSquare, CheckCircle, Layers, 
  Gamepad2, BookOpen, Music, Video, Palette, Store, Ticket, Receipt, 
  Coins, Network, Play, Image, ShoppingBag, Sparkles, Link2, ChevronRight,
  AlertTriangle, Database, Fingerprint, Scale, DollarSign,
  Wallet, EyeOff, ShieldCheck, Blocks, Zap, Phone, CheckCircle2, XCircle,
  Tv, Radio, PhoneCall, HardDrive, Activity, Send
} from "lucide-react";
import P3Logo from "@/components/P3Logo";
import OwlLogo from "@/components/OwlLogo";

interface PWAInstallItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  manifest: string;
}

const pwaApps: PWAInstallItem[] = [
  {
    id: 'nexus',
    name: 'Nexus',
    description: 'P3 Protocol client',
    icon: <OwlLogo className="w-6 h-6" />,
    gradient: 'from-cyan-500 to-blue-600',
    manifest: '/manifest-app.json'
  },
  {
    id: 'hub',
    name: 'P3 Hub',
    description: 'Protocol ecosystem marketplace',
    icon: <Globe className="w-6 h-6 text-white" />,
    gradient: 'from-blue-500 to-indigo-700',
    manifest: '/manifest-launcher.json'
  }
];

function PWAInstallCard({ app, onInstall }: { app: PWAInstallItem; onInstall: (app: PWAInstallItem) => void }) {
  const [installing, setInstalling] = useState(false);
  
  const handleInstall = async () => {
    setInstalling(true);
    onInstall(app);
    setTimeout(() => setInstalling(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${app.gradient} flex items-center justify-center`}>
          {app.icon}
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white text-sm">{app.name}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">{app.description}</p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={handleInstall}
        disabled={installing}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs"
        data-testid={`button-install-${app.id}`}
      >
        {installing ? (
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Ready
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" />
            Install
          </span>
        )}
      </Button>
    </div>
  );
}

export default function AboutPage() {
  const handlePWAInstall = (app: PWAInstallItem) => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (link) {
      link.href = app.manifest;
    }
    
    const routes: Record<string, string> = {
      'nexus': '/app',
      'hub': '/launcher'
    };
    
    window.location.href = routes[app.id] || '/';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      <nav className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <Button variant="ghost" className="flex items-center gap-2" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold">P3</div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                PROTOCOL
              </span>
            </div>
            <div className="w-20" />
          </div>
        </div>
      </nav>

      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white py-16 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-sm font-medium mb-6">
            <AlertTriangle className="w-4 h-4" />
            Open Beta — Features may change or have bugs
          </div>
          <P3Logo className="w-32 mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About P3 Protocol</h1>
          <p className="text-lg text-white/80">
            Your all-in-one platform for entertainment, communication, and secure digital transactions
          </p>
        </div>
      </section>

      {/* Protocol OS Section - Featured */}
      <section className="py-12 px-6 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <span className="inline-block px-4 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-semibold mb-4">
              A NEW CATEGORY
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Protocol Operating System
            </h2>
          </div>
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed mb-6">
              P3 is built as a <strong>Protocol Operating System</strong> — a new category in digital infrastructure. 
              Unlike traditional app stores, P3 provides a shared surface where applications, payments, governance, 
              and verifiable proofs all work together seamlessly.
            </p>
            <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed mb-6">
              Every action — from a vote to a payment — produces a verifiable proof. This foundation enables 
              frictionless adoption where every interaction carries credibility and trust.
            </p>
            <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed">
              Our mission is to build an operating surface that is secure, resilient, and future-proof — 
              reshaping trust, commerce, and collaboration at scale.
            </p>
          </div>
        </div>
      </section>

      {/* What You Can Do - Capabilities Section */}
      <section className="py-12 px-6 bg-gradient-to-r from-cyan-50 via-blue-50 to-cyan-50 dark:from-cyan-950/30 dark:via-blue-950/30 dark:to-cyan-950/30 border-b border-cyan-100 dark:border-cyan-900/50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <span className="inline-block px-4 py-1 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-sm font-semibold mb-4">
              WHAT YOU CAN DO
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Your Entertainment & Communication Hub
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Everything you need for entertainment, communication, and verified digital activity — all in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-cyan-200 dark:border-cyan-800">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Watch Live TV</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Access 10,000+ live TV channels from around the world. Sports, news, entertainment, and more — all streaming directly to your device.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-pink-200 dark:border-pink-800">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4">
                <Radio className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Listen to Radio</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Tune into 100+ radio stations across all genres. Music, talk shows, podcasts, and live broadcasts — wherever you are.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-emerald-200 dark:border-emerald-800">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
                <PhoneCall className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Voice & Video Calls</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Make crystal-clear voice and video calls with end-to-end encryption. Connect with friends, family, or colleagues securely.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-purple-200 dark:border-purple-800">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-4">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Store & Verify Content</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Store your important content with blockchain-verified receipts. Prove ownership and authenticity for any file or transaction.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-amber-200 dark:border-amber-800">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Track Activity</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Monitor your digital activity with verifiable timestamps. Keep a complete, tamper-proof record of your interactions.
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-indigo-200 dark:border-indigo-800">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-4">
                <Send className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Secure Messaging</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Send private messages that only you and your recipient can read. No third parties, no data mining, complete privacy.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Shield className="w-8 h-8 text-indigo-600" />
              What is P3 Protocol?
            </h2>
            <p className="text-slate-700 dark:text-slate-300 mb-6">
              P3 Protocol (Privacy-Preserving Proof-of-Communication) is a next-generation 
              trust infrastructure that enables <strong>cryptographic verification without 
              content disclosure</strong>. It creates immutable, blockchain-anchored proof 
              that communications, meetings, and transactions occurred—while keeping the 
              actual content fully encrypted and private.
            </p>
            <p className="text-slate-700 dark:text-slate-300 mb-8">
              Unlike traditional communication platforms that either expose your data or 
              provide no verifiability, P3 Protocol bridges the gap: you get the privacy 
              of end-to-end encryption with the trust of blockchain verification.
            </p>

            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Lock className="w-8 h-8 text-purple-600" />
              Why P3 Protocol is Needed
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-white">The Privacy Paradox</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Current systems force a choice: full privacy (no proof) or full disclosure (no privacy). 
                  P3 Protocol eliminates this tradeoff with zero-knowledge anchoring.
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-white">Trust Without Intermediaries</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Blockchain anchoring removes the need to trust centralized servers. 
                  Proof exists on-chain, independently verifiable by anyone.
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-white">Compliance Without Exposure</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Meet regulatory requirements for audit trails without exposing 
                  sensitive communications. Prove existence without revealing content.
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3 text-slate-900 dark:text-white">Wallet-Based Identity</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Zero PII collection. Your identity is your wallet address—no emails, 
                  phone numbers, or personal data required to participate.
                </p>
              </div>
            </div>

            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Anchor className="w-8 h-8 text-cyan-600" />
              What P3 Protocol Solves
            </h2>
            <ul className="space-y-3 text-slate-700 dark:text-slate-300 mb-8">
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Dispute Resolution:</strong> Prove that a meeting, agreement, or transaction occurred</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Consent Verification:</strong> Cryptographic proof of opt-in before sensitive communications</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Audit Trails:</strong> Immutable records for legal, healthcare, and financial compliance</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>Whistleblower Protection:</strong> Secure channels with plausible deniability and proof of disclosure</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-green-500 mt-1">✓</span>
                <span><strong>DAO Governance:</strong> On-chain proposals, voting, and execution with full transparency</span>
              </li>
            </ul>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            <h2 className="text-3xl font-bold mb-8 text-center">The P3 Ecosystem</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-xl">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">P3 Hub</h3>
                <p className="text-sm text-white/80 mb-4">
                  27+ demo apps across Security, Payments, Creative, Social, Governance, 
                  and Analytics categories—plus 8 blockchain-anchored WebGL games.
                </p>
                <ul className="text-xs text-white/70 space-y-1">
                  <li className="flex items-center gap-1">
                    <Gamepad2 className="w-3 h-3" /> 8 WebGL games with on-chain scores
                  </li>
                  <li>• Security & Payments mini-apps</li>
                  <li>• Creative & Social experiences</li>
                  <li>• Governance & Analytics tools</li>
                  <li>• Shared session across all apps</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-6 text-white shadow-xl">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Nexus</h3>
                <p className="text-sm text-white/80 mb-4">
                  Your private communication hub with encrypted messaging, 
                  crystal-clear calls, and built-in payments.
                </p>
                <ul className="text-xs text-white/70 space-y-1">
                  <li>• Private messaging only you can read</li>
                  <li>• HD voice & video calls</li>
                  <li>• Send money instantly</li>
                  <li>• Verifiable receipts for everything</li>
                  <li>• Community voting & proposals</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-violet-600 to-purple-800 rounded-xl p-6 text-white shadow-xl">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Atlas Platform</h3>
                <p className="text-sm text-white/80 mb-4">
                  The backbone that makes everything work seamlessly together.
                </p>
                <ul className="text-xs text-white/70 space-y-1">
                  <li>• Lightning-fast performance</li>
                  <li>• Voice and text support</li>
                  <li>• Always-on reliability</li>
                  <li>• One account for all apps</li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-6 text-white shadow-xl">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                  <Code className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Developer Kit</h3>
                <p className="text-sm text-white/80 mb-4">
                  Build on P3 with our tools. Create your own apps 
                  that integrate with the P3 ecosystem.
                </p>
                <ul className="text-xs text-white/70 space-y-1">
                  <li>• Developer tools</li>
                  <li>• Single sign-on support</li>
                  <li>• Full documentation</li>
                  <li>• Easy integration</li>
                </ul>
              </div>
            </div>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Layers className="w-8 h-8 text-cyan-600" />
              How It Works
            </h2>
            <div className="grid md:grid-cols-2 gap-4 mb-12">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-indigo-500" />
                  Private & Secure
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Military-grade encryption protects all your communications. Only you and your intended recipients can see your messages.
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-blue-500" />
                  Verifiable Receipts
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Every transaction creates a permanent, tamper-proof receipt on the blockchain. Prove what happened, when it happened.
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500" />
                  Your Data, Your Control
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Content is stored securely and distributed globally. You maintain ownership and control of your files.
                </p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-500" />
                  Crystal-Clear Calls
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Direct peer-to-peer voice and video calls with encrypted audio and video. No middleman listening in.
                </p>
              </div>
            </div>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            {/* P3 Multi-Vertical Marketplace Section */}
            <section id="marketplace" className="scroll-mt-20">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Store className="w-8 h-8 text-rose-600" />
                P3 Multi-Vertical Marketplace
              </h2>
              
              <div className="bg-gradient-to-br from-rose-500/10 via-purple-500/10 to-indigo-500/10 dark:from-rose-900/30 dark:via-purple-900/30 dark:to-indigo-900/30 rounded-xl p-8 border border-rose-500/20 mb-8">
                <p className="text-slate-700 dark:text-slate-300 text-lg leading-relaxed mb-6">
                  The P3 Marketplace is a <strong>multi-vertical digital commerce platform</strong> where every transaction 
                  is anchored and provable on-chain. Whether you're selling ebooks, streaming music, distributing videos, 
                  or minting digital art—all payments settle through the P3 Treasury with automatic royalty splits.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 flex items-start gap-3">
                    <Anchor className="w-5 h-5 text-cyan-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Permanent Proof of Purchase</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Every purchase, play, and view is recorded permanently—you always have proof of what you own.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 flex items-start gap-3">
                    <Coins className="w-5 h-5 text-amber-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Creators Get Paid Fairly</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Royalties are split automatically—artists, authors, and creators always get their fair share.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Secure Content Access</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Content is protected and only accessible to verified buyers—no piracy, no hassle.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 flex items-start gap-3">
                    <Network className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Low-Cost Payments</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Pay with crypto from any wallet—transactions are fast and fees are minimal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Individual Marketplace Verticals */}
              <h3 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Marketplace Verticals</h3>
              
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Ebooks Vertical */}
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-xl">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Ebooks</h4>
                  <p className="text-sm text-white/85 mb-4">
                    Buy digital books and keep them forever. Lend to friends, and authors 
                    get paid fairly for every sale.
                  </p>
                  <ul className="text-xs text-white/70 space-y-1">
                    <li className="flex items-center gap-2">
                      <Lock className="w-3 h-3" /> Secure, protected content
                    </li>
                    <li className="flex items-center gap-2">
                      <Receipt className="w-3 h-3" /> Proof of ownership forever
                    </li>
                    <li className="flex items-center gap-2">
                      <Link2 className="w-3 h-3" /> Lend books to friends
                    </li>
                    <li className="flex items-center gap-2">
                      <Coins className="w-3 h-3" /> Fair author royalties
                    </li>
                  </ul>
                  <Link href="/marketplace/ebook">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="mt-4 bg-white/20 hover:bg-white/30 text-white border-0"
                      data-testid="button-marketplace-ebook"
                    >
                      Browse Ebooks <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                {/* Music Vertical */}
                <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl p-6 text-white shadow-xl">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                    <Music className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Music</h4>
                  <p className="text-sm text-white/85 mb-4">
                    Stream unlimited music with fair royalties going directly to artists. 
                    Support your favorite creators with every play.
                  </p>
                  <ul className="text-xs text-white/70 space-y-1">
                    <li className="flex items-center gap-2">
                      <Play className="w-3 h-3" /> High-quality streaming
                    </li>
                    <li className="flex items-center gap-2">
                      <Receipt className="w-3 h-3" /> Proof of every play
                    </li>
                    <li className="flex items-center gap-2">
                      <Coins className="w-3 h-3" /> Fair artist royalties
                    </li>
                    <li className="flex items-center gap-2">
                      <Sparkles className="w-3 h-3" /> Exclusive releases & drops
                    </li>
                  </ul>
                  <Link href="/marketplace/music">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="mt-4 bg-white/20 hover:bg-white/30 text-white border-0"
                      data-testid="button-marketplace-music"
                    >
                      Browse Music <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                {/* Video Vertical */}
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-6 text-white shadow-xl">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                    <Video className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Video</h4>
                  <p className="text-sm text-white/85 mb-4">
                    Rent or buy movies, shows, and exclusive content. Keep a permanent 
                    record of everything you've watched.
                  </p>
                  <ul className="text-xs text-white/70 space-y-1">
                    <li className="flex items-center gap-2">
                      <Play className="w-3 h-3" /> Smooth HD streaming
                    </li>
                    <li className="flex items-center gap-2">
                      <ShoppingBag className="w-3 h-3" /> Rent or buy options
                    </li>
                    <li className="flex items-center gap-2">
                      <Receipt className="w-3 h-3" /> Proof of ownership
                    </li>
                    <li className="flex items-center gap-2">
                      <Ticket className="w-3 h-3" /> Exclusive premieres
                    </li>
                  </ul>
                  <Link href="/marketplace/video">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="mt-4 bg-white/20 hover:bg-white/30 text-white border-0"
                      data-testid="button-marketplace-video"
                    >
                      Browse Videos <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>

                {/* Art/NFT Vertical */}
                <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl p-6 text-white shadow-xl">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                    <Palette className="w-6 h-6" />
                  </div>
                  <h4 className="text-xl font-bold mb-2">Art / NFT</h4>
                  <p className="text-sm text-white/85 mb-4">
                    Limited editions with provenance tracking. Collector verification ensures 
                    authenticity and ownership history on-chain.
                  </p>
                  <ul className="text-xs text-white/70 space-y-1">
                    <li className="flex items-center gap-2">
                      <Image className="w-3 h-3" /> Limited editions & 1/1s
                    </li>
                    <li className="flex items-center gap-2">
                      <Anchor className="w-3 h-3" /> Provenance tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3" /> Collector verification
                    </li>
                    <li className="flex items-center gap-2">
                      <Coins className="w-3 h-3" /> Secondary sale royalties
                    </li>
                  </ul>
                  <Link href="/marketplace/art">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="mt-4 bg-white/20 hover:bg-white/30 text-white border-0"
                      data-testid="button-marketplace-art"
                    >
                      Browse Art <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Key Marketplace Features */}
              <h3 className="text-2xl font-bold mb-6 text-slate-900 dark:text-white">Key Marketplace Features</h3>
              
              <div className="grid md:grid-cols-4 gap-4 mb-8">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                    <Ticket className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Ticket Gates</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Wallet-based access control. Verify ownership before unlocking content.
                  </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Anchor Receipts</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Blockchain proof of every transaction—purchases, plays, and views.
                  </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Treasury Splits</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Automatic royalty distribution to creators, platforms, and sponsors.
                  </p>
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                    <Network className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Any Wallet Works</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Pay with your existing crypto wallet—no special tokens required.
                  </p>
                </div>
              </div>
            </section>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            <div className="bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 rounded-2xl p-8 mb-12 shadow-2xl">
              <h2 className="text-3xl font-bold mb-4 flex items-center gap-3 text-white">
                <Download className="w-8 h-8" />
                Install P3 Apps
              </h2>
              <p className="text-white/90 mb-6">
                Install any of the P3 Protocol apps directly to your device for instant, native-like access:
              </p>
              <div className="space-y-3">
                {pwaApps.map(app => (
                  <PWAInstallCard key={app.id} app={app} onInstall={handlePWAInstall} />
                ))}
              </div>
            </div>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Code className="w-8 h-8 text-emerald-600" />
              P3 SDK
            </h2>
            <div className="bg-gradient-to-br from-emerald-900/20 to-teal-900/20 dark:from-emerald-900/40 dark:to-teal-900/40 rounded-xl p-8 border border-emerald-500/30 mb-12">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wide">
                  Coming Soon
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Build on P3 Protocol
              </h3>
              <p className="text-slate-700 dark:text-slate-300 mb-6">
                The P3 SDK will enable developers to add secure messaging, payments, 
                and verifiable receipts to their own applications. Build mini-apps 
                for the P3 Hub and reach our growing user community.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">One-Click Sign-In</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Users sign in once and stay logged in across all P3 apps automatically.
                  </p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Built-In Receipts</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Add verifiable proof to any action in your app with just a few lines of code.
                  </p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Instant Distribution</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Publish to P3 Hub and reach users across the P3 ecosystem.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-500 italic">
                SDK documentation and developer portal launching Q1 2026. 
                Register interest at dev@dciphrs.io
              </p>
            </div>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            {/* Protocol OS Whitepaper Section */}
            <section id="whitepaper" className="scroll-mt-20">
              <div className="text-center mb-10">
                <span className="inline-block px-4 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-900/50 dark:to-cyan-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-semibold mb-4">
                  PROTOCOL WHITEPAPER
                </span>
                <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                  P3 Protocol: Technical Specification
                </h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                  A comprehensive overview of the privacy-preserving proof-of-communication protocol
                </p>
              </div>

              {/* Executive Summary */}
              <div className="relative mb-10 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-teal-500/20 dark:from-emerald-500/10 dark:via-cyan-500/5 dark:to-teal-500/10" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="relative p-8 border border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Executive Summary</h3>
                      <p className="text-sm text-emerald-600 dark:text-emerald-400">Privacy-Preserving Proof-of-Communication</p>
                    </div>
                  </div>
                  <div className="space-y-4 text-slate-700 dark:text-slate-300">
                    <p className="text-lg leading-relaxed">
                      <strong className="text-emerald-600 dark:text-emerald-400">P3 Protocol</strong> is a next-generation trust infrastructure 
                      that enables <em>cryptographic verification without content disclosure</em>. The protocol creates immutable, 
                      blockchain-anchored proof that communications, meetings, and transactions occurred—while keeping the actual 
                      content fully encrypted and private.
                    </p>
                    <p className="leading-relaxed">
                      Unlike traditional platforms that force you to choose between privacy and proof, P3 Protocol gives you both. 
                      Your messages stay private while every transaction creates a permanent, verifiable receipt—built on modern 
                      web standards with blockchain integration.
                    </p>
                    <div className="grid md:grid-cols-3 gap-4 mt-6">
                      <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">Zero</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Personal Info Needed</div>
                      </div>
                      <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">Pennies</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Per Transaction</div>
                      </div>
                      <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-4 text-center">
                        <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">5+</div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">Crypto Networks</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* How We Keep You Safe */}
              <div className="relative mb-10 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-indigo-500/20 dark:from-cyan-500/10 dark:via-blue-500/5 dark:to-indigo-500/10" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="relative p-8 border border-cyan-500/30 dark:border-cyan-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                      <Layers className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">How We Keep You Safe</h3>
                      <p className="text-sm text-cyan-600 dark:text-cyan-400">Built-in protections for everything you do</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">Private Conversations</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Military-grade encryption protects your messages. Future-proof security that stands the test of time.
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Anchor className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">Verified Records</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Every transaction is recorded permanently on the blockchain. Tamper-proof proof you can trust.
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Fingerprint className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">Your Reputation</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Build a verified identity with achievements and badges that prove your trustworthiness.
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">Safe Payments</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Payments held safely until work is complete. Built-in dispute resolution if anything goes wrong.
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">Works Everywhere</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Use your preferred cryptocurrency. All payments settle quickly and with low fees.
                      </p>
                    </div>
                    <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl p-5 border border-white/50 dark:border-slate-700/50">
                      <div className="flex items-center gap-2 mb-3">
                        <Database className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        <h4 className="font-semibold text-slate-900 dark:text-white">Secure Storage</h4>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Your files are encrypted and stored across a distributed network. Always available, always private.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Architecture */}
              <div className="relative mb-10 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 via-emerald-500/10 to-green-500/20 dark:from-teal-500/10 dark:via-emerald-500/5 dark:to-green-500/10" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="relative p-8 border border-teal-500/30 dark:border-teal-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                      <Blocks className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Protocol Architecture</h3>
                      <p className="text-sm text-teal-600 dark:text-teal-400">Three-Layer Design</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-blue-500 to-transparent hidden md:block" />
                      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-xl relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                          <Globe className="w-5 h-5" />
                        </div>
                        <h4 className="text-xl font-bold mb-2">App Marketplace</h4>
                        <p className="text-sm text-white/80 mb-4">
                          Discover and use 40+ apps across 8 categories.
                        </p>
                        <ul className="text-xs text-white/70 space-y-1">
                          <li>• Find and install apps</li>
                          <li>• Seamless app switching</li>
                          <li>• One login for everything</li>
                          <li>• Usage insights</li>
                        </ul>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-cyan-500 to-transparent hidden md:block" />
                      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl p-6 text-white shadow-xl relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <h4 className="text-xl font-bold mb-2">Core Features</h4>
                        <p className="text-sm text-white/80 mb-4">
                          Your main hub for messaging, calls, and payments.
                        </p>
                        <ul className="text-xs text-white/70 space-y-1">
                          <li>• Private messaging</li>
                          <li>• Voice & video calls</li>
                          <li>• Send & receive payments</li>
                          <li>• Community voting</li>
                        </ul>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="bg-gradient-to-br from-purple-600 to-violet-800 rounded-xl p-6 text-white shadow-xl relative z-10">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                          <Code className="w-5 h-5" />
                        </div>
                        <h4 className="text-xl font-bold mb-2">Developer Layer</h4>
                        <p className="text-sm text-white/80 mb-4">
                          Build on P3 with our developer tools.
                        </p>
                        <ul className="text-xs text-white/70 space-y-1">
                          <li>• Developer toolkit</li>
                          <li>• Single sign-on</li>
                          <li>• Documentation</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security & Privacy */}
              <div className="relative mb-10 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-violet-500/10 to-indigo-500/20 dark:from-purple-500/10 dark:via-violet-500/5 dark:to-indigo-500/10" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="relative p-8 border border-purple-500/30 dark:border-purple-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Your Privacy, Protected</h3>
                      <p className="text-sm text-purple-600 dark:text-purple-400">Built for security from the ground up</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                          <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Encrypted Before It Leaves</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Your messages are encrypted on your device before being sent. 
                            Even we can't read what you share.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                          <EyeOff className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">No Personal Info Required</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            No emails, phone numbers, or personal data needed. Your wallet is your identity — 
                            no data to breach.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Wallet className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">You Control Access</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Sign in with your wallet — no passwords to remember or reset. 
                            Your keys, your control.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-6">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-4">What This Means for You</h4>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">Messages stay private forever</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">Future-proof security</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">We can't see your content</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">Verifiable proof of every transaction</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">Privacy-compliant by design</span>
                        </li>
                        <li className="flex items-center gap-3 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">No third-party data sharing</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Simple Pricing */}
              <div className="relative mb-10 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 via-emerald-500/10 to-teal-500/20 dark:from-green-500/10 dark:via-emerald-500/5 dark:to-teal-500/10" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="relative p-8 border border-green-500/30 dark:border-green-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Simple, Transparent Pricing</h3>
                      <p className="text-sm text-green-600 dark:text-green-400">Pay only for what you use</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-6 mb-6">
                    <p className="text-lg text-slate-700 dark:text-slate-300 mb-4">
                      P3 uses a simple pay-as-you-go model. Small fees for verified transactions, 
                      paid directly in ETH. No subscriptions, no hidden costs.
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-white/30 dark:bg-slate-800/30 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        No Special Token Needed
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Pay with ETH you already have. No need to buy or hold a special cryptocurrency.
                      </p>
                    </div>
                    <div className="bg-white/30 dark:bg-slate-800/30 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <Anchor className="w-4 h-4 text-cyan-500" />
                        Low-Cost Transactions
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Built on efficient infrastructure that keeps costs minimal for everyday use.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="relative mb-10 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-500/20 via-zinc-500/10 to-slate-500/20 dark:from-slate-500/10 dark:via-zinc-500/5 dark:to-slate-500/10" />
                <div className="absolute inset-0 backdrop-blur-xl" />
                <div className="relative p-8 border border-slate-500/30 dark:border-slate-500/20 rounded-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-600 to-zinc-700 flex items-center justify-center">
                      <Scale className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Protocol Comparison</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">P3 vs Traditional Messaging</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full" data-testid="table-protocol-comparison">
                      <thead>
                        <tr className="border-b border-slate-300 dark:border-slate-700">
                          <th className="text-left py-4 px-4 font-semibold text-slate-900 dark:text-white">Feature</th>
                          <th className="text-center py-4 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
                                <Anchor className="w-5 h-5 text-white" />
                              </div>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">P3 Protocol</span>
                            </div>
                          </th>
                          <th className="text-center py-4 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-white" />
                              </div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">Signal</span>
                            </div>
                          </th>
                          <th className="text-center py-4 px-4">
                            <div className="flex flex-col items-center gap-1">
                              <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-white" />
                              </div>
                              <span className="font-semibold text-sky-600 dark:text-sky-400">Telegram</span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Encryption Level</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <ShieldCheck className="w-4 h-4" />
                              Protocol
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm">
                              App
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm">
                              App (opt-in)
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Proof of Communication</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <Anchor className="w-4 h-4" />
                              Blockchain
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              None
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              None
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Identity System</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <Wallet className="w-4 h-4" />
                              Wallet
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm">
                              <Phone className="w-4 h-4" />
                              Phone
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm">
                              <Phone className="w-4 h-4" />
                              Phone
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">PII Required</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <EyeOff className="w-4 h-4" />
                              None
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm">
                              Phone #
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm">
                              Phone #
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Developer SDK</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Yes
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              No
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm">
                              Limited
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Open Source</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Yes
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              Yes
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              No
                            </span>
                          </td>
                        </tr>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Future-Proof Security</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <Zap className="w-4 h-4" />
                              Yes
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              No
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              No
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-4 px-4 text-slate-700 dark:text-slate-300 font-medium">Marketplace / Payments</td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                              <Coins className="w-4 h-4" />
                              Native
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm">
                              <XCircle className="w-4 h-4" />
                              No
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm">
                              Limited
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 text-center italic">
                    Comparison based on publicly available documentation as of November 2025.
                  </p>
                </div>
              </div>
            </section>

            <hr className="my-12 border-slate-300 dark:border-slate-700" />

            {/* Contact & Community */}
            <div className="bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-900/30 dark:via-indigo-900/30 dark:to-purple-900/30 rounded-xl p-8 border border-blue-500/20 mb-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Get in Touch</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  Have questions? Want to learn more? Join our community or reach out directly.
                </p>
                <a 
                  href="https://t.me/P3Atlas" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                  data-testid="link-telegram"
                >
                  <MessageSquare className="w-5 h-5" />
                  Join us on Telegram
                </a>
                <p className="text-sm text-slate-500 dark:text-slate-500 mt-4">
                  t.me/P3Atlas
                </p>
              </div>
            </div>

            {/* Beta Disclaimer */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">Open Beta Notice</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    P3 Protocol is currently in <strong>open beta</strong>. Features described on this page are under active development 
                    and may not work as expected. We make no guarantees about uptime, stability, or feature completeness. 
                    Use at your own risk. By using P3 Protocol, you acknowledge that bugs, breaking changes, and service 
                    interruptions may occur without notice.
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Link href="/">
                <Button 
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-3"
                  data-testid="button-back-home"
                >
                  Return to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
