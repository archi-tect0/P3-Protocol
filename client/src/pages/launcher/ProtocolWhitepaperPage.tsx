import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3Logo from '@/components/P3Logo';
import { 
  ArrowLeft, 
  Shield, 
  Lock, 
  Database,
  Layers,
  Code2,
  CheckCircle2,
  Target,
  Zap,
  Anchor,
  Blocks,
  Terminal,
  ArrowRightLeft,
  Vote,
  ShieldCheck,
  Network,
  GitBranch
} from 'lucide-react';

export default function ProtocolWhitepaperPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-transparent to-cyan-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <header className="mb-8">
          <Button
            data-testid="button-back-launcher"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/launcher')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </header>

        <section className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <P3Logo className="w-16 h-16" />
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-6">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300 font-medium">Developer Documentation</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            P3 Protocol Whitepaper
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Web3 Substrate Mesh Architecture
          </p>
          <p className="text-sm text-slate-500 mt-4">Version 2.0 · November 2025</p>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-transparent to-cyan-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                P3 Protocol represents the next evolution of decentralized infrastructure: 
                <strong className="text-white"> App → OS → Substrate Mesh</strong>. 
                Rather than a single application or operating system, P3 is a programmable mesh layer 
                that interconnects identity, sessions, governance, and commerce across the Web3 ecosystem.
              </p>
              <p className="text-slate-300 leading-relaxed">
                The mesh provides unified infrastructure for cryptographic primitives, blockchain anchoring, 
                and cross-chain settlement. Developers access advanced encryption, immutable proofs, 
                and governance tools through manifest-driven APIs — apps register their endpoints, the mesh 
                routes requests, and the security scanner validates everything. Connect once via Wallet SSO, 
                authenticated everywhere.
              </p>
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
                <h2 className="text-2xl font-bold text-white">Protocol Layers</h2>
              </div>
              
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Terminal className="w-5 h-5 text-emerald-400" />
                    </div>
                    <h3 className="text-white font-semibold">App Layer</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    User-facing applications built on protocol primitives. Nexus (communications), 
                    Hub (marketplace), and third-party apps access unified infrastructure.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Nexus</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Hub</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Third-Party Apps</span>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">Manifest Registry</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                      <Code2 className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-white font-semibold">SDK Layer</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    REST APIs exposing protocol primitives. Encryption, anchoring, session management, 
                    payments, and governance — all accessible via simple HTTP calls.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">P3.crypto</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">P3.anchor</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">P3.session</span>
                    <span className="px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-xs">P3.payments</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white font-semibold">Trust Layer</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">
                    Blockchain infrastructure for immutable proofs, governance, and cross-chain 
                    settlement. All actions can be cryptographically verified.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">AnchorRegistry</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">GovernorP3</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">TokenP3</span>
                    <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs">Settlement</span>
                  </div>
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
                  <Network className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Mesh Architecture</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                The P3 substrate mesh represents an evolution beyond traditional app and OS paradigms. 
                Where Web2 built monolithic applications and early Web3 created isolated dApps, 
                P3 provides a programmable interconnection layer that enables seamless 
                communication between apps, shared identity, and unified governance.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-3 mb-2">
                    <GitBranch className="w-5 h-5 text-violet-400" />
                    <h4 className="text-white font-medium">Evolution Path</h4>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-300">App</span>
                    <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                    <span className="px-3 py-1 rounded-full bg-slate-600 text-slate-200">OS</span>
                    <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium">Substrate Mesh</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-white font-medium mb-2">Manifest Registry</h4>
                    <p className="text-sm text-slate-400">
                      Apps declare callable endpoints, routes, and required scopes via manifests. 
                      The mesh validates, scans, and routes all inter-app communication.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-white font-medium mb-2">Session Bridge</h4>
                    <p className="text-sm text-slate-400">
                      Wallet SSO enables single sign-on across all mesh apps. Connect once, 
                      authenticated everywhere — no repeated wallet prompts.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-white font-medium mb-2">Security Scanner</h4>
                    <p className="text-sm text-slate-400">
                      All manifests pass through static analysis, risk scoring, and sandbox testing 
                      before approval. Malicious apps are quarantined automatically.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h4 className="text-white font-medium mb-2">Governance Mesh</h4>
                    <p className="text-sm text-slate-400">
                      DAO proposals, voting, and execution flow through the mesh with anchored receipts. 
                      Community-governed categories and moderation.
                    </p>
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
                  <Lock className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Cryptographic Primitives</h2>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Encryption</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• X25519 + XSalsa20-Poly1305 (TweetNaCl)</li>
                    <li>• AES-256-GCM (vault storage)</li>
                    <li>• Kyber-768 (roadmap)</li>
                    <li>• PBKDF2 120k iterations key derivation</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Hashing</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• SHA-256 content hashing</li>
                    <li>• BLAKE3 for speed</li>
                    <li>• Merkle tree proofs</li>
                    <li>• Deterministic digests</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Signatures</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Ed25519 signing</li>
                    <li>• Ethereum ECDSA</li>
                    <li>• EIP-712 typed data</li>
                    <li>• Multi-sig support</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Zero-Knowledge</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Proof generation</li>
                    <li>• Verification circuits</li>
                    <li>• Privacy preservation</li>
                    <li>• Selective disclosure</li>
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
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Anchor className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Anchoring System</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Every significant action generates a cryptographic proof that can be anchored 
                to the blockchain. This creates an immutable audit trail without exposing content.
              </p>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10 mb-6">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{`// Anchor any data to the blockchain
const anchor = await P3.anchor.create({
  type: "document_signed",
  data: {
    documentHash: sha256(document),
    signers: [wallet1, wallet2],
    timestamp: Date.now()
  }
});

// Returns immutable proof
{
  receiptId: "anchor:1700000000:abc123",
  cid: "Qm...",           // IPFS content ID
  txHash: "0x...",        // Base network TX
  blockNumber: 12345678,
  verified: true
}`}
                </pre>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <Database className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-400">IPFS Storage</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <Blocks className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-400">Chain Anchoring</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <ShieldCheck className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <span className="text-xs text-slate-400">Proof Verification</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Cross-Chain Settlement</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Users on any chain can access P3 Protocol by settling fees to the Base treasury. 
                LayerZero and Wormhole bridges enable universal access.
              </p>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10">
                <pre className="text-xs text-emerald-400/80 font-mono overflow-x-auto whitespace-pre">
{`┌─────────────────────────────────────────────────────────┐
│              CROSS-CHAIN SETTLEMENT                      │
└─────────────────────────────────────────────────────────┘

  SOURCE CHAINS              BRIDGES              TREASURY
  ┌───────────┐                                           
  │ Ethereum  │──┐       ┌────────────┐     ┌───────────┐
  │ Polygon   │──┼──────▶│ LayerZero  │────▶│   BASE    │
  │ Arbitrum  │──┘       └────────────┘     │ TREASURY  │
  │ Optimism  │                             │           │
  └───────────┘          ┌────────────┐     │  • USDC   │
  ┌───────────┐          │  Wormhole  │────▶│  • Fees   │
  │  Solana   │─────────▶│            │     │  • Split  │
  └───────────┘          └────────────┘     └───────────┘`}
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
                  <Vote className="w-5 h-5 text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Governance</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Protocol governance via on-chain voting. Token holders can propose and vote 
                on protocol upgrades, fee changes, and treasury allocations.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">GovernorP3 Contract</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Proposal creation</li>
                    <li>• Token-weighted voting</li>
                    <li>• Timelock execution</li>
                    <li>• Quorum requirements</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">TokenP3</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• ERC-20 compatible</li>
                    <li>• Vote delegation</li>
                    <li>• Snapshot voting power</li>
                    <li>• Transfer restrictions</li>
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
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-indigo-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">P3 SSO (Single Sign-On)</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Wallet-based Single Sign-On for third-party app integration. Connect once 
                via P3, authenticated everywhere. No OAuth complexity — just wallet signatures.
              </p>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10 mb-6">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{`// Check existing session
const session = await P3.SSO.get();

// Third-party auth flow
const challenge = await P3.SSO.challenge(walletAddress);
const signature = await wallet.signMessage(challenge.message);
const result = await P3.SSO.verify({ 
  wallet, 
  nonce: challenge.nonce, 
  signature 
});
// result.token for authenticated API calls`}
                </pre>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Challenge → Sign → Verify</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">JWT Token Response</span>
                </div>
                <div className="p-3 rounded-lg bg-white/5 text-center">
                  <span className="text-xs text-slate-400">Zero PII Required</span>
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
                <h2 className="text-2xl font-bold text-white">Atlas — Substrate Layer</h2>
              </div>
              
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-6">
                <p className="text-sm text-violet-300 font-medium mb-2">Core Philosophy: Substrate, Not Chatbot</p>
                <p className="text-sm text-slate-400">
                  Atlas is not a chatbot. It's an execution substrate. LLMs parse intent and narrate outcomes.
                  Atlas runs the flows, enforces governance, and anchors identity. The separation is clean:
                  semantic interpretation vs deterministic execution. No hallucination risk because Atlas only runs real endpoints.
                </p>
              </div>
              
              <p className="text-slate-400 mb-6">
                Atlas is infrastructure that treats identity, execution, and visibility as the same problem.
                Wallet anchors identity (<code className="text-violet-400">atlas.User</code>). Flows anchor execution.
                Canvas anchors visibility. Receipts anchor proof. The orchestration loop: User Intent → LLM Parse → Atlas Execute → LLM Narrate.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">3-Tier Intent Matching</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Regex patterns for direct matching</li>
                    <li>• Keyword mappings for action verbs</li>
                    <li>• Semantic fallback for natural language</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Multi-AI Provider Support</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• OpenAI GPT-4 & GPT-4o</li>
                    <li>• Anthropic Claude 3 Opus/Sonnet</li>
                    <li>• Google Gemini Pro</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Wallet-Anchored Vault</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• PBKDF2 key derivation (120k iterations)</li>
                    <li>• AES-GCM credential encryption</li>
                    <li>• TTL cache layer (45s) for performance</li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">OAuth Connector Catalog</h4>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>• 100+ mainstream app integrations</li>
                    <li>• Spotify, Slack, Gmail, Discord, GitHub</li>
                    <li>• Auto token refresh & rate limiting</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10 mb-6">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{`// Atlas natural language execution
const result = await atlas.execute("play some jazz and let the team know");

// 3-tier matching resolves to compound flow:
// 1. spotify.play({ genre: "jazz" })
// 2. slack.send({ channel: "team", message: "Playing jazz..." })

// Real-time SSE streaming for flow updates
const stream = atlas.subscribe(result.flowId);
stream.on('step_update', (step) => console.log(step));`}
                </pre>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Canvas Auto-Materialization</h4>
                  <p className="text-xs text-slate-400">
                    No frontend code per integration. Register an endpoint with canvas.display metadata 
                    and UI cards materialize automatically. Developers describe what something is, 
                    Canvas figures out how to show it.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Receipts as First-Class</h4>
                  <p className="text-xs text-slate-400">
                    Every action emits a receipt: LLM calls (atlas_llm), card materializations (atlas_materialize). 
                    Wallet-anchored and blockchain-anchorable. Auditability is default.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">13 Face Themes</h4>
                  <p className="text-xs text-slate-400">
                    Identity made visible. Line, Globe, Constellation, Liquid Tile — faces react to 
                    voice and listening state. Your face, bound to your wallet.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Unified Canvas</h4>
                  <p className="text-xs text-slate-400">
                    Atlas Canvas replaces fragmented apps with unified substrate modes. 7 Nexus 
                    capabilities rendered as Canvas Modes. Service Worker v2 for offline-first.
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
                  <Layers className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Programmable Launcher</h2>
              </div>
              <p className="text-slate-400 mb-6">
                The Hub is a programmable substrate with manifest-driven API registry. Apps declare 
                callable endpoints, routes, and permissions for programmatic inter-app communication.
              </p>
              
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/10 mb-6">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{`// Discover and call app endpoints programmatically
import { Launcher, createSession } from '@p3/sdk';

const launcher = new Launcher(session, {
  onScopeRequest: async (missing) => confirm(\`Grant scopes?\`)
});

// Discover endpoints matching a query
const endpoints = await launcher.discover('messages');

// Call endpoint (scopes auto-checked)
const result = await launcher.call('messages.compose', {
  to: '0x...', body: 'Hello!'
});`}
                </pre>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Manifest Scanner</h4>
                  <p className="text-xs text-slate-400">
                    Automatic security scanning with risk scoring (1-10 scale), 
                    sandbox testing, and governance integration for flagged manifests.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Registry API</h4>
                  <p className="text-xs text-slate-400">
                    /api/sdk/registry — Full registry with apps, endpoints, routes. 
                    Filter by app, scope, or search for discovery.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Endpoint Invocation</h4>
                  <p className="text-xs text-slate-400">
                    /api/sdk/launcher/call/:key — Execute registered endpoints 
                    with automatic scope verification.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Scope Permissions</h4>
                  <p className="text-xs text-slate-400">
                    wallet, messages, notes, calls, payments, anchors, identity — 
                    Granular permission model for secure inter-app communication.
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
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-rose-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Enterprise APIs</h2>
              </div>
              <p className="text-slate-400 mb-6">
                Every developer on P3 Protocol gets robust infrastructure — features 
                that typically cost millions to build. Protocol-level access at no additional cost.
              </p>
              
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">API Key Management</h4>
                  <p className="text-xs text-slate-400">
                    /api/enterprise/api-keys — Scoped keys with expiration and revocation.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Privacy & GDPR</h4>
                  <p className="text-xs text-slate-400">
                    /api/enterprise/privacy — Data export, deletion, compliance controls.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Guardian Controls</h4>
                  <p className="text-xs text-slate-400">
                    /api/enterprise/guardian — Circuit breakers, timelocks, emergency pauses.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <h4 className="text-white font-medium mb-2">Billing & Tiers</h4>
                  <p className="text-xs text-slate-400">
                    /api/enterprise/billing — Usage tracking, subscription management.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 backdrop-blur-xl border-emerald-500/20">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Developer Experience</h2>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Simple REST APIs</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">No blockchain expertise needed</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">P3 SSO for instant auth</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Enterprise APIs included</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Cross-chain by default</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">Full audit trail</span>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="text-center pb-12">
          <Button
            data-testid="button-view-sdk"
            onClick={() => setLocation('/launcher/sdk')}
            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white px-8 py-6 text-lg"
          >
            View SDK Documentation
          </Button>
        </section>
      </div>
    </div>
  );
}
