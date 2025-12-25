import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3HubLogo from '@/components/P3HubLogo';
import { 
  ArrowLeft, 
  Shield, 
  Lock, 
  Layers,
  Code2,
  Rocket,
  Wallet,
  Fingerprint,
  Globe,
  Target,
  Receipt,
  Zap,
  Network,
  Package,
  Grid3X3,
  LayoutGrid,
  Terminal,
  FileJson,
  Cpu,
  Box,
  Puzzle,
  Users,
  Anchor
} from 'lucide-react';

export default function WhitepaperPage() {
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
          <P3HubLogo className="w-20 text-white" />
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-6">
            <Network className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">Substrate Mesh Layer</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            P3 Hub Whitepaper
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            The Programmable Mesh Layer for Web3 Apps
          </p>
          <p className="text-sm text-slate-500 mt-4">Version 2.0 · November 2025</p>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-indigo-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                P3 Hub embodies the next evolution of decentralized infrastructure: 
                <strong className="text-white"> App → OS → Substrate Mesh</strong>. 
                Rather than just an app launcher, Hub is a programmable mesh layer that 
                interconnects apps, routes identity, and orchestrates governance across Web3.
              </p>
              <p className="text-slate-300 leading-relaxed">
                Developers register applications via manifests declaring endpoints, routes, and scopes. 
                The mesh validates all manifests through security scanning, routes inter-app calls, and 
                provides unified Wallet SSO. The only protocol fee is ~$0.57 per anchor receipt. 
                Everything else — pricing, revenue, business logic — belongs to the developer.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">What is P3 Hub?</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Think of Hub as the mesh interconnection layer. It provides:
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-semibold">App Discovery</h3>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Users browse categorized apps — security, payments, creative, social, governance, 
                    analytics, developer tools, and games. One-tap install to add apps to their launcher.
                  </p>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <FileJson className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-white font-semibold">Manifest Registration</h3>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Developers define apps via manifest — name, icon, category, routes, and anchor 
                    events. Register once, appear in the Hub automatically.
                  </p>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold">Session Bridge</h3>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Single WalletConnect session shared across all Hub apps. Connect once, use everywhere. 
                    No repeated wallet prompts or session fragmentation.
                  </p>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Anchor className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-white font-semibold">Anchor Infrastructure</h3>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Every app action can anchor to blockchain. Hub provides the infrastructure — 
                    developers define which events get receipts.
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
                  <Terminal className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Developer Integration</h2>
              </div>
              
              <div className="space-y-6">
                <div className="p-5 rounded-xl bg-gradient-to-r from-cyan-500/10 via-transparent to-transparent border border-cyan-500/20">
                  <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                    <Box className="w-5 h-5 text-cyan-400" />
                    App Manifest Structure
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Apps register by defining a manifest with their capabilities and anchor events:
                  </p>
                  <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm font-mono text-slate-300">
{`{
  id: 'my-app',
  name: 'My App',
  icon: <IconComponent />,
  gradient: 'from-blue-500 to-cyan-600',
  category: 'payments',
  component: MyAppTile,
  anchorEvents: [
    'payment_sent',
    'payment_received',
    'invoice_created'
  ]
}`}
                    </pre>
                  </div>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-r from-violet-500/10 via-transparent to-transparent border border-violet-500/20">
                  <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                    <Grid3X3 className="w-5 h-5 text-violet-400" />
                    Dynamic Categories
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Categories are community-governed and expand as developers build. Apps enter a 
                    moderation queue where moderators assign or create categories before approval:
                  </p>
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                        <span className="text-violet-400">1</span>
                      </div>
                      <span className="text-slate-400">Developer submits app manifest to registry</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                        <span className="text-violet-400">2</span>
                      </div>
                      <span className="text-slate-400">App enters mod queue for category assignment and review</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                        <span className="text-violet-400">3</span>
                      </div>
                      <span className="text-slate-400">Moderator assigns existing category or creates new one</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                        <span className="text-violet-400">4</span>
                      </div>
                      <span className="text-slate-400">Approved app appears in Hub under assigned category</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Current categories include Security, Payments, Creative, Social, Governance, 
                    Analytics, Developer, and Games — but new categories emerge as the ecosystem grows.
                  </p>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent border border-emerald-500/20">
                  <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-400" />
                    Anchor Events
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Define which actions in your app create blockchain receipts. Each anchor costs 
                    ~$0.57 (~0.00015 ETH) and creates an immutable record on Base:
                  </p>
                  <div className="bg-black/40 rounded-lg p-4 overflow-x-auto">
                    <pre className="text-sm font-mono text-slate-300">
{`// SDK call to anchor an event
await sdk.anchor.create({
  type: 'payment_sent',
  data: { 
    amount: '10.00',
    recipient: '0x...',
    txHash: '0x...'
  }
});
// Returns anchor receipt with on-chain proof`}
                    </pre>
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
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <Network className="w-5 h-5 text-pink-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Architecture</h2>
              </div>
              
              <div className="space-y-6">
                <div className="p-5 rounded-xl bg-gradient-to-r from-pink-500/10 via-transparent to-transparent border border-pink-500/20">
                  <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-pink-400" />
                    App Lifecycle
                  </h3>
                  <div className="bg-black/40 rounded-lg p-4 mb-4 overflow-x-auto">
                    <div className="flex items-center gap-3 text-sm font-mono min-w-max">
                      <div className="px-3 py-2 rounded bg-pink-500/20 border border-pink-500/30">
                        <span className="text-pink-300">Register Manifest</span>
                      </div>
                      <span className="text-slate-500">→</span>
                      <div className="px-3 py-2 rounded bg-purple-500/20 border border-purple-500/30">
                        <span className="text-purple-300">Hub Discovery</span>
                      </div>
                      <span className="text-slate-500">→</span>
                      <div className="px-3 py-2 rounded bg-blue-500/20 border border-blue-500/30">
                        <span className="text-blue-300">User Install</span>
                      </div>
                      <span className="text-slate-500">→</span>
                      <div className="px-3 py-2 rounded bg-emerald-500/20 border border-emerald-500/30">
                        <span className="text-emerald-300">Anchor Events</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Developers register their app manifest. Hub surfaces it for discovery. Users 
                    install with one tap. App actions trigger anchor events to blockchain.
                  </p>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-r from-orange-500/10 via-transparent to-transparent border border-orange-500/20">
                  <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-orange-400" />
                    Session Bridge
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    Single WalletConnect session orchestrated across the entire Hub ecosystem. 
                    Apps access the shared session — no repeated connection prompts.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
                      <Wallet className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                      <span className="text-xs text-slate-400">Connect Once</span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
                      <Layers className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                      <span className="text-xs text-slate-400">Use Everywhere</span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-white/5 border border-white/5">
                      <Lock className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                      <span className="text-xs text-slate-400">Secure Handoff</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-r from-blue-500/10 via-transparent to-transparent border border-blue-500/20">
                  <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                    <Anchor className="w-5 h-5 text-blue-400" />
                    Blockchain Anchoring
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">
                    All anchor receipts are recorded on Base Mainnet. Each receipt contains a 
                    cryptographic hash of the event data, creating an immutable audit trail.
                  </p>
                  <div className="p-4 rounded-lg bg-black/30 border border-white/5">
                    <p className="text-xs text-slate-500 mb-2">Anchor Registry Contract (Base)</p>
                    <code className="text-sm text-blue-400 break-all font-mono">
                      0x2539823790424051Eb03eBea1EA9bc40A475A34D
                    </code>
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
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Puzzle className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Example Apps</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Hub ships with example apps demonstrating what's possible on-chain. These are 
                reference implementations — developers can fork, extend, or build entirely new apps:
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-5 rounded-xl bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-violet-400" />
                    </div>
                    <h3 className="text-white font-semibold text-lg">Identity Vault</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">
                    Wallet-based identity with anchored verification proofs.
                  </p>
                  <div className="text-xs text-slate-500">
                    Anchor events: identity_created, identity_verified
                  </div>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-amber-400" />
                    </div>
                    <h3 className="text-white font-semibold text-lg">Invoice</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">
                    Create and track invoices with payment receipts on-chain.
                  </p>
                  <div className="text-xs text-slate-500">
                    Anchor events: invoice_created, payment_received
                  </div>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-pink-500/10 to-transparent border border-pink-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                      <Fingerprint className="w-5 h-5 text-pink-400" />
                    </div>
                    <h3 className="text-white font-semibold text-lg">Presence</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">
                    Check-in/check-out with cryptographic timestamps.
                  </p>
                  <div className="text-xs text-slate-500">
                    Anchor events: check_in, check_out, presence_verified
                  </div>
                </div>
                
                <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold text-lg">Micro DAO</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">
                    Lightweight governance with anchored proposals and votes.
                  </p>
                  <div className="text-xs text-slate-500">
                    Anchor events: proposal_created, vote_cast, result_finalized
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">40+ apps included:</strong> Security tools, payment widgets, 
                  creative apps, social features, governance modules, analytics dashboards, developer 
                  utilities, and games — all with anchor event definitions ready to fork.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Fee Structure</h2>
              </div>
              
              <div className="grid gap-6 sm:grid-cols-2 mb-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-emerald-500/15 to-transparent border border-emerald-500/25">
                  <h3 className="text-emerald-300 font-semibold mb-3">Anchor Fee</h3>
                  <div className="text-4xl font-bold text-white mb-2">~$0.57</div>
                  <p className="text-slate-400 text-sm">
                    Per blockchain receipt (~0.00015 ETH). This is the only protocol fee. Covers 
                    on-chain storage, IPFS pinning, and indexing costs.
                  </p>
                </div>
                
                <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/15 to-transparent border border-purple-500/25">
                  <h3 className="text-purple-300 font-semibold mb-3">Developer Revenue</h3>
                  <div className="text-4xl font-bold text-white mb-2">100%</div>
                  <p className="text-slate-400 text-sm">
                    Your app, your revenue. P3 takes no cut from transactions, subscriptions, or 
                    in-app purchases. You set prices, you keep earnings.
                  </p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">No hidden fees:</strong> No listing fees, no discovery fees, 
                  no transaction cuts, no revenue splits. The ~$0.57 anchor fee is the complete 
                  protocol cost. Standard network gas applies for on-chain transactions.
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
                  <Shield className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Enterprise APIs</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Every developer on P3 Hub gets access to professional APIs — features that 
                normally cost millions to build. The "TRON moment" for decentralized applications.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">API Key Management</h4>
                  <p className="text-sm text-slate-400">
                    Scoped API keys with expiration, revocation, and audit logging for your apps.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">GDPR/Privacy Compliance</h4>
                  <p className="text-sm text-slate-400">
                    Built-in data export, deletion requests, and privacy controls for your users.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Guardian Controls</h4>
                  <p className="text-sm text-slate-400">
                    Circuit breakers and timelocks for high-value operations and emergency pauses.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">SSO Integration</h4>
                  <p className="text-sm text-slate-400">
                    Connect once via P3 SSO — your app gets authenticated wallet sessions automatically.
                  </p>
                </div>
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
                Atlas is the voice-first operating system that brings Hub apps to life. Say "show me my launcher" 
                to access your apps, or "check my portfolio" to query Web3 balances across Ethereum and Solana.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Voice-First Interface</h4>
                  <p className="text-sm text-slate-400">
                    Natural language commands trigger Hub app endpoints. Atlas parses intent 
                    and routes to the right app automatically.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Meta-Adapter: 50+ APIs</h4>
                  <p className="text-sm text-slate-400">
                    Auto-ingests public APIs: Weather, Jokes, Crypto, NASA, Pokemon, 
                    and more. New APIs added automatically.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Web3 Native</h4>
                  <p className="text-sm text-slate-400">
                    Moralis, Alchemy, Helius providers for wallet balances, tokens, 
                    NFTs, gas prices, and transaction history.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">LLM Extensibility</h4>
                  <p className="text-sm text-slate-400">
                    Atlas as substrate, LLM as semantic layer. GPT, Claude, or Gemini 
                    interpret intent while Atlas executes flows.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-4">
                <h4 className="text-violet-300 font-medium mb-2">Substrate + Semantic Architecture</h4>
                <p className="text-sm text-slate-400 mb-3">
                  Atlas handles execution: flows, APIs, Web3 endpoints, memory. The LLM handles interpretation 
                  and narration. Together they form an operationally intelligent assistant.
                </p>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                  <span className="px-2 py-1 rounded bg-white/5">User Intent</span>
                  <span>→</span>
                  <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300">LLM Parse</span>
                  <span>→</span>
                  <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-300">Atlas Execute</span>
                  <span>→</span>
                  <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300">LLM Narrate</span>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-slate-300 text-sm">
                  <strong className="text-white">Security:</strong> LLM never holds API keys or executes calls directly. 
                  Atlas injects credentials server-side. PBKDF2 + AES-GCM vault with per-wallet isolation.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Programmable Launcher</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Hub is a programmable substrate with manifest-driven API registry. Apps declare callable 
                endpoints, routes, and permissions — enabling programmatic inter-app communication.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Registry Discovery</h4>
                  <p className="text-sm text-slate-400">
                    /api/sdk/registry — Full registry with apps, endpoints, routes. Filter by app, 
                    scope, or search query for dynamic discovery.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Endpoint Invocation</h4>
                  <p className="text-sm text-slate-400">
                    /api/sdk/launcher/call/:key — Execute registered endpoints with automatic 
                    scope verification and permission checks.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Manifest Scanner</h4>
                  <p className="text-sm text-slate-400">
                    Automatic security scanning with risk scoring (1-10), sandbox testing, 
                    and governance integration for flagged manifests.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Scope Permissions</h4>
                  <p className="text-sm text-slate-400">
                    wallet, messages, notes, calls, payments, anchors, identity — Granular 
                    permission model for secure inter-app communication.
                  </p>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-sm text-slate-300">
                  <span className="text-cyan-400 font-semibold">SDK Integration:</span> Use 
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">launcher.discover()</code> to find endpoints and 
                  <code className="mx-1 px-1.5 py-0.5 rounded bg-white/10 text-xs font-mono">launcher.call()</code> to invoke them programmatically.
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
                  <Users className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Moderator Panel</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Wallet-gated governance panel at /mod/ for community moderation. Token holders 
                can review apps, manage reports, and participate in platform governance.
              </p>
              
              <div className="grid gap-3 sm:grid-cols-5">
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Reports</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Reviews</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Apps</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Widgets</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Users</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Rocket className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Getting Started</h2>
              </div>
              
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500 via-indigo-500 to-cyan-500" />
                
                <div className="space-y-6">
                  <div className="relative pl-10">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-xs text-white font-bold">1</span>
                    </div>
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                      <h3 className="text-white font-semibold mb-2">Define Your Manifest</h3>
                      <p className="text-slate-400 text-sm">
                        Create your app definition with id, name, icon, category, and component. 
                        Specify which actions create anchor events.
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative pl-10">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                      <span className="text-xs text-white font-bold">2</span>
                    </div>
                    <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                      <h3 className="text-white font-semibold mb-2">Build Your Tile</h3>
                      <p className="text-slate-400 text-sm">
                        Create a React component for your app tile. Use the P3 SDK for wallet 
                        integration, anchoring, and session management.
                      </p>
                    </div>
                  </div>
                  
                  <div className="relative pl-10">
                    <div className="absolute left-0 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center">
                      <span className="text-xs text-white font-bold">3</span>
                    </div>
                    <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                      <h3 className="text-white font-semibold mb-2">Register & Launch</h3>
                      <p className="text-slate-400 text-sm">
                        Add your app to the registry. Once registered, it appears in Hub discovery. 
                        Users install and your anchor events start recording.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="text-center pb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-xl border-purple-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />
            <div className="relative p-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Build on P3 Hub
              </h2>
              <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                Your app, your revenue. The only fee is ~$0.57 per anchor receipt. 
                Enterprise APIs included. Start building with the P3 SDK.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  data-testid="button-explore-hub"
                  onClick={() => setLocation('/launcher')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 px-6"
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Explore Hub
                </Button>
                <Button
                  data-testid="button-view-sdk"
                  variant="outline"
                  onClick={() => setLocation('/launcher/sdk')}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <Code2 className="w-4 h-4 mr-2" />
                  Developer SDK
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
