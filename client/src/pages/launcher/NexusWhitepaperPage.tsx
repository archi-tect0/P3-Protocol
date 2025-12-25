import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import OwlLogo from '@/components/OwlLogo';
import { 
  ArrowLeft, 
  Shield, 
  Lock, 
  MessageSquare,
  Phone,
  Video,
  Key,
  Globe,
  CheckCircle2,
  Target,
  Zap,
  Server,
  EyeOff,
  Wallet,
  FileText,
  Layers,
  ShieldCheck
} from 'lucide-react';

export default function NexusWhitepaperPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-transparent to-blue-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none" />
      
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
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg ring-2 ring-cyan-500/30">
            <OwlLogo className="w-full h-full" />
          </div>
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 mb-6">
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-cyan-300 font-medium">Communications Platform</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Nexus Whitepaper
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Privacy-Preserving Communications Infrastructure
          </p>
          <p className="text-sm text-slate-500 mt-4">Version 1.0 · November 2025</p>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 via-transparent to-blue-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Nexus is P3 Protocol's communications layer — a zero-knowledge, 
                end-to-end encrypted platform for messaging, voice, and video. While Nexus remains 
                a standalone Web3 app, its full capabilities now materialize inside Atlas as 7 Canvas 
                Modes (Inbox, Messages, Calls, Directory, Payments, Receipts, Notes). Built on wallet-based 
                identity with no personal data collection, Nexus provides comprehensive security 
                while maintaining full auditability through blockchain-anchored proofs.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Core Security Model</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold">End-to-End Encryption</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    All messages encrypted using X25519 key exchange with XChaCha20-Poly1305 
                    authenticated encryption. Keys never leave the device.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Key className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-white font-semibold">Kyber Hybrid Mode</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Post-quantum resistance via Kyber-768 key encapsulation combined with 
                    classical X25519. Future-proof against quantum attacks.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-semibold">Wallet-Based Identity</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    No usernames, emails, or phone numbers. Identity is your wallet address. 
                    Zero personal data collection by design.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <EyeOff className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold">Zero-Knowledge Design</h3>
                  </div>
                  <p className="text-sm text-slate-400">
                    Server cannot read message content. Metadata is minimized. 
                    No analytics, no tracking, no data monetization.
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
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Communication Channels</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageSquare className="w-6 h-6 text-cyan-400" />
                    <h3 className="text-white font-semibold text-lg">Encrypted Messaging</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Real-time encrypted chat with support for text, files, and media. Messages 
                    are encrypted before leaving the device and can only be decrypted by intended recipients.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">E2EE</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">File Sharing</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">Read Receipts</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">Typing Indicators</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Phone className="w-6 h-6 text-emerald-400" />
                    <h3 className="text-white font-semibold text-lg">Voice Calls</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    WebRTC-based voice calls with SRTP encryption. Peer-to-peer when possible, 
                    TURN relay when required. Call metadata is anchored for verification.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">WebRTC</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">SRTP</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">P2P Priority</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Call Anchoring</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <Video className="w-6 h-6 text-purple-400" />
                    <h3 className="text-white font-semibold text-lg">Video Conferencing</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Encrypted video calls with adaptive bitrate streaming. Screen sharing, 
                    multi-participant support, and meeting proof generation for compliance.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">Adaptive Bitrate</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">Screen Share</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">Meeting Proofs</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">Multi-Party</span>
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
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Encrypted Notes</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Private note-taking with client-side encryption. Notes are stored locally 
                in IndexedDB and can be optionally anchored to blockchain for timestamped proof.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <Server className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Local-First</h4>
                  <p className="text-xs text-slate-500">IndexedDB storage, works offline</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <Lock className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">E2E Encrypted</h4>
                  <p className="text-xs text-slate-500">Only you can read your notes</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <Shield className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Anchorable</h4>
                  <p className="text-xs text-slate-500">Optional blockchain timestamp</p>
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
                  <Wallet className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Integrated Payments</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Send and receive payments directly within conversations. All transactions 
                are anchored on-chain with cryptographic proofs.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <Zap className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Instant Transfers</h4>
                  <p className="text-xs text-slate-500">ERC-20 tokens via Base network</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <FileText className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Payment Requests</h4>
                  <p className="text-xs text-slate-500">Request payments with memo</p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <ShieldCheck className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-white font-medium mb-1">Anchored Receipts</h4>
                  <p className="text-xs text-slate-500">Immutable transaction proofs</p>
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
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Proof of Communication</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Every communication can generate a cryptographic proof anchored to the blockchain. 
                Prove that a message was sent, a call occurred, or a payment was made — without 
                revealing the content.
              </p>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{`// Anchor a communication proof
const proof = await nexus.anchor({
  type: "message_sent",
  participants: [senderWallet, recipientWallet],
  timestamp: Date.now(),
  contentHash: sha256(encryptedMessage),
  metadata: { channel: "direct" }
});

// Verify later
const verified = await nexus.verify(proof.receiptId);
// { valid: true, anchoredAt: 1700000000, txHash: "0x..." }`}
                </pre>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Server className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Architecture</h2>
              </div>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10 mb-6">
                <pre className="text-xs text-emerald-400/80 font-mono overflow-x-auto whitespace-pre">
{`┌─────────────────────────────────────────────────────────────┐
│                      NEXUS ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   CLIENT A   │────▶│   SIGNALING  │◀────│   CLIENT B   │
  │              │     │    SERVER    │     │              │
  │ • Key Gen    │     │              │     │ • Key Gen    │
  │ • Encrypt    │     │ • WebSocket  │     │ • Decrypt    │
  │ • Sign       │     │ • ICE/STUN   │     │ • Verify     │
  └──────────────┘     └──────────────┘     └──────────────┘
         │                    │                    │
         │              ┌─────▼─────┐              │
         │              │   TURN    │              │
         │              │  SERVERS  │              │
         │              └───────────┘              │
         │                                         │
         └────────────── P2P / RELAY ──────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  ANCHOR SERVICE   │
                    │                   │
                    │ • Proof hashing   │
                    │ • IPFS storage    │
                    │ • Chain anchoring │
                    └───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   BASE NETWORK    │
                    │   (Immutable)     │
                    └───────────────────┘`}
                </pre>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-transparent to-purple-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Atlas Integration</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Control Nexus with voice through Atlas. Say "send a message to Alice" or 
                "call Bob" to orchestrate encrypted communications hands-free.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Voice Commands</h4>
                  <p className="text-xs text-slate-400">
                    "Send encrypted message to 0x...", "Start a call with alice.eth", 
                    "Show my payment history"
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Compound Flows</h4>
                  <p className="text-xs text-slate-400">
                    "Message Alice and play some music" — Atlas chains Nexus messaging 
                    with Spotify in a single flow.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Canvas Launcher</h4>
                  <p className="text-xs text-slate-400">
                    Nexus appears in your Atlas launcher with pinned contacts, recent 
                    messages, and quick actions.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Wallet-Anchored Session</h4>
                  <p className="text-xs text-slate-400">
                    Atlas and Nexus share the same wallet session. Connect once, 
                    access everywhere.
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
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Progressive Web App</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Nexus is a PWA with offline capabilities, push notifications, and local-first 
                data storage. Install once, use everywhere — desktop, mobile, tablet.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">IndexedDB Storage</h4>
                  <p className="text-xs text-slate-400">
                    Messages and notes stored locally. Works offline with background sync.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Service Worker</h4>
                  <p className="text-xs text-slate-400">
                    Caching, offline support, and push notification handling.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Push Notifications</h4>
                  <p className="text-xs text-slate-400">
                    Web Push API for message alerts and call notifications.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Install to Home Screen</h4>
                  <p className="text-xs text-slate-400">
                    Native app-like experience without app store requirements.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-cyan-600/20 to-blue-600/20 backdrop-blur-xl border-cyan-500/20">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Privacy Guarantees</h2>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">No email or phone required</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">No message content on server</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">No analytics or tracking</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">No data monetization</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Post-quantum encryption option</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Verifiable without content exposure</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="text-center pb-12">
          <Button
            data-testid="button-launch-nexus"
            onClick={() => setLocation('/app')}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-8 py-6 text-lg"
          >
            Launch Nexus
          </Button>
        </section>
      </div>
    </div>
  );
}
