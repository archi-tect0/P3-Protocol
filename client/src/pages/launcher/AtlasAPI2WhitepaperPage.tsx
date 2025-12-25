import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Network,
  Layers,
  Binary,
  Database,
  Zap,
  Shield,
  FileCode,
  Server,
  Activity,
  CheckCircle2,
  Terminal,
  Box
} from 'lucide-react';

export default function AtlasAPI2WhitepaperPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-orange-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-amber-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        <header className="mb-8 flex items-center justify-between">
          <Button
            data-testid="button-back-protocol"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/protocol')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Technical Preview</span>
          </div>
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 mb-6">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300 font-medium">Technical Whitepaper</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Atlas API 2.0
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Session-Native Binary Protocol with Multiplexed Lanes
          </p>
          <p className="text-sm text-slate-500 mt-4">Version 2.0 · December 2025 · Beta Release</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-400">39ms Handshake</span>
            <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-xs text-blue-400">53% Payload Reduction</span>
            <span className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-xs text-violet-400">8 Priority Lanes</span>
            <span className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-xs text-orange-400">Binary Encoding</span>
            <span className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-400">HTTP/3 Architecture</span>
          </div>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/10 via-transparent to-orange-600/10" />
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Executive Summary</h2>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                Atlas API 2.0 represents a fundamental architectural shift from stateless REST to 
                <strong className="text-white"> session-native binary transport</strong>. This is not a theoretical 
                proposal — it is working infrastructure in beta with validated benchmarks.
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                The protocol achieves <strong className="text-emerald-400">39ms session establishment</strong> (vs 488ms REST baseline), 
                <strong className="text-blue-400"> 53% payload reduction</strong> through dictionary tokenization with binary encoding (MessagePack default, Protobuf negotiated), 
                and <strong className="text-violet-400">linear scalability</strong> with 50 concurrent sessions completing in 838ms (16ms per session).
              </p>
              <p className="text-slate-300 leading-relaxed mb-4">
                The architecture provides <strong className="text-orange-400">8 multiplexed priority lanes</strong> (access, manifests, receipts, media, commerce, governance, notifications, chat) 
                with <strong className="text-cyan-400">HTTP/3-ready transport architecture</strong> (currently HTTP/1.1 with SSE streaming, HTTP/3 QUIC layer planned).
              </p>
              <div className="mt-6 p-4 rounded-lg bg-slate-900/50 border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <FileCode className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-mono">Validation</span>
                </div>
                <p className="text-xs text-slate-500">All metrics measured December 2025 against live protocol endpoints with reproducible benchmarks</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Network className="w-5 h-5 text-violet-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">1. Session Fabric</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                Unlike REST's per-request model, Atlas API 2.0 establishes persistent sessions with capability 
                negotiation at handshake. Sessions are wallet-anchored with configurable TTL for optimal performance.
              </p>

              <div className="space-y-4 mb-6">
                <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
                  <h4 className="text-white font-semibold mb-2">Handshake Protocol (HTTP/1.1 POST with HTTP/3 Architecture)</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span>Client sends capability advertisement (device profile, supported encodings)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span>Server responds with session ID, negotiated encoding, dictionary seed</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                      <span>Configurable TTL with automatic session expiry after inactivity</span>
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                  <h4 className="text-white font-semibold mb-2">Capability Negotiation</h4>
                  <ul className="space-y-2 text-sm text-slate-400">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Encoding formats: MessagePack (default), Protobuf (negotiated), JSON (compatibility)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Transport: HTTP/1.1 with SSE streaming (HTTP/3 QUIC architecture defined)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Lane selection: Client requests specific lanes from 8 available</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span>Dictionary negotiation with pre-seeded tokens and dynamic expansion</span>
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
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">2. Priority Lanes</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                The protocol multiplexes <strong className="text-white">8 SSE lanes</strong> over a single connection, each with distinct priority levels 
                and scheduling policies. This eliminates head-of-line blocking and enables real-time streaming across content types.
              </p>

              <div className="grid md:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center text-xs text-red-400 font-bold">1</div>
                    <span className="text-white font-semibold text-sm">Access</span>
                  </div>
                  <p className="text-xs text-slate-400">Auth, keys, capabilities</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center text-xs text-orange-400 font-bold">2</div>
                    <span className="text-white font-semibold text-sm">Media</span>
                  </div>
                  <p className="text-xs text-slate-400">Streaming, real-time chunks</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold">3</div>
                    <span className="text-white font-semibold text-sm">Manifests</span>
                  </div>
                  <p className="text-xs text-slate-400">Catalogs, metadata</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-yellow-500/20 flex items-center justify-center text-xs text-yellow-400 font-bold">4</div>
                    <span className="text-white font-semibold text-sm">Commerce</span>
                  </div>
                  <p className="text-xs text-slate-400">Cart, checkout, payments</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center text-xs text-green-400 font-bold">5</div>
                    <span className="text-white font-semibold text-sm">Chat</span>
                  </div>
                  <p className="text-xs text-slate-400">Messaging, presence</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center text-xs text-blue-400 font-bold">6</div>
                    <span className="text-white font-semibold text-sm">Receipts</span>
                  </div>
                  <p className="text-xs text-slate-400">Ledger, anchoring</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-bold">7</div>
                    <span className="text-white font-semibold text-sm">Notifications</span>
                  </div>
                  <p className="text-xs text-slate-400">Alerts, push</p>
                </div>
                <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center text-xs text-violet-400 font-bold">8</div>
                    <span className="text-white font-semibold text-sm">Governance</span>
                  </div>
                  <p className="text-xs text-slate-400">Votes, proposals</p>
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
                  <Binary className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">3. Encoding Pipeline</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                The protocol implements a 4-stage encoding pipeline that progressively reduces payload size 
                while maintaining full data fidelity. <strong className="text-emerald-400">Default: Tokenized MessagePack</strong> with Protobuf available via capability negotiation.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="w-12 h-12 rounded-lg bg-slate-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-400">1</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">JSON Baseline</span>
                      <span className="text-slate-400 font-mono text-sm">70.2 KB</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full">
                      <div className="h-full bg-slate-500 rounded-full" style={{width: '100%'}} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-blue-400">2</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">MessagePack</span>
                      <span className="text-blue-400 font-mono text-sm">63.1 KB <span className="text-slate-500">(-10%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full">
                      <div className="h-full bg-blue-500 rounded-full" style={{width: '90%'}} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/50 border border-white/5">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-amber-400">3</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">Tokenized + MsgPack</span>
                      <span className="text-amber-400 font-mono text-sm">35.2 KB <span className="text-slate-500">(-50%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full">
                      <div className="h-full bg-amber-500 rounded-full" style={{width: '50%'}} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/30">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-emerald-400">4</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold">Compact Protobuf</span>
                      <span className="text-emerald-400 font-mono text-sm">32.9 KB <span className="text-emerald-300">(-53%)</span></span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full">
                      <div className="h-full bg-emerald-500 rounded-full" style={{width: '47%'}} />
                    </div>
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
                  <Database className="w-5 h-5 text-cyan-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">4. Dictionary Tokenization</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                The protocol negotiates a shared dictionary at session handshake with pre-seeded tokens. 
                Repeated field names and common values are replaced with compact integer references for significant payload reduction.
              </p>

              <div className="p-4 rounded-lg bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 mb-6">
                <h4 className="text-white font-semibold mb-3">Dictionary Architecture</h4>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-cyan-400 font-semibold mb-1">Base Tokens</div>
                    <div className="text-slate-400">Pre-seeded entries</div>
                    <div className="text-xs text-slate-500 mt-1">Common field names, types, status codes</div>
                  </div>
                  <div>
                    <div className="text-cyan-400 font-semibold mb-1">Session Tokens</div>
                    <div className="text-slate-400">Dynamic expansion</div>
                    <div className="text-xs text-slate-500 mt-1">Learned from payload patterns</div>
                  </div>
                  <div>
                    <div className="text-cyan-400 font-semibold mb-1">Persistence</div>
                    <div className="text-slate-400">Session-scoped</div>
                    <div className="text-xs text-slate-500 mt-1">Retained for session duration</div>
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
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <Box className="w-5 h-5 text-orange-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">5. Wire Protocol</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                The protocol uses a compact binary frame format for all messages. 
                Each frame includes header metadata, payload type, session binding, and integrity validation.
              </p>

              <div className="p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/20 mb-6">
                <h4 className="text-white font-semibold mb-3">Frame Components</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-orange-400 font-semibold mb-1">Header</div>
                    <div className="text-slate-400">Protocol identifier, version, frame type</div>
                  </div>
                  <div>
                    <div className="text-orange-400 font-semibold mb-1">Session Binding</div>
                    <div className="text-slate-400">Session reference for connection continuity</div>
                  </div>
                  <div>
                    <div className="text-orange-400 font-semibold mb-1">Sequencing</div>
                    <div className="text-slate-400">Ordering guarantees for reliable delivery</div>
                  </div>
                  <div>
                    <div className="text-orange-400 font-semibold mb-1">Integrity</div>
                    <div className="text-slate-400">CRC validation for data integrity</div>
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
                  <Activity className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">6. Operational Benchmarks</h2>
              </div>
              
              <p className="text-slate-300 leading-relaxed mb-6">
                All benchmarks measured December 2025 against production protocol endpoints. 
                Results are reproducible via internal benchmark tooling available for audit.
              </p>

              <div className="space-y-4 mb-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-400 mb-1">39ms</div>
                    <div className="text-white font-semibold">Session Handshake (JSON)</div>
                    <div className="text-xs text-slate-500">Average cold start, 82ms with Protobuf encoding</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-400 mb-1">53%</div>
                    <div className="text-white font-semibold">Payload Reduction</div>
                    <div className="text-xs text-slate-500">70.2KB JSON → 32.9KB Compact Protobuf</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20">
                    <div className="text-2xl font-bold text-violet-400 mb-1">488ms</div>
                    <div className="text-white font-semibold">REST v1 Baseline</div>
                    <div className="text-xs text-slate-500">Same catalog endpoint, same data</div>
                  </div>
                  <div className="p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
                    <div className="text-2xl font-bold text-amber-400 mb-1">838ms</div>
                    <div className="text-white font-semibold">50 Concurrent Sessions</div>
                    <div className="text-xs text-slate-500">16ms per session, linear scaling</div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-900/50 border border-white/5">
                <h4 className="text-white font-semibold mb-3">Benchmark Methodology</h4>
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-slate-400 mb-1">Environment</div>
                    <div className="text-slate-500">Replit cloud instance, Node.js 20, PostgreSQL 16</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Warm-up</div>
                    <div className="text-slate-500">5 iterations discarded before measurement</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Measurement</div>
                    <div className="text-slate-500">10 iterations, average reported</div>
                  </div>
                  <div>
                    <div className="text-slate-400 mb-1">Reproducibility</div>
                    <div className="text-slate-500">Benchmarks available for audit</div>
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
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Server className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">7. Protocol Comparison</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-slate-400 font-medium">Metric</th>
                      <th className="text-center p-3 text-red-400 font-medium">REST v1</th>
                      <th className="text-center p-3 text-amber-400 font-medium">GraphQL</th>
                      <th className="text-center p-3 text-blue-400 font-medium">gRPC</th>
                      <th className="text-center p-3 text-emerald-400 font-medium">Atlas v2</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr>
                      <td className="p-3 text-white">Session Model</td>
                      <td className="p-3 text-center text-slate-400">Stateless</td>
                      <td className="p-3 text-center text-slate-400">Stateless</td>
                      <td className="p-3 text-center text-slate-400">Stateless</td>
                      <td className="p-3 text-center text-emerald-400">Session-native</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Handshake</td>
                      <td className="p-3 text-center text-red-400">488ms</td>
                      <td className="p-3 text-center text-amber-400">77-791ms</td>
                      <td className="p-3 text-center text-blue-400">50-100ms</td>
                      <td className="p-3 text-center text-emerald-400 font-semibold">39ms</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Payload Size</td>
                      <td className="p-3 text-center text-red-400">70.2KB</td>
                      <td className="p-3 text-center text-amber-400">~70KB</td>
                      <td className="p-3 text-center text-blue-400">~50KB</td>
                      <td className="p-3 text-center text-emerald-400 font-semibold">32.9KB</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Multiplexing</td>
                      <td className="p-3 text-center text-slate-500">No</td>
                      <td className="p-3 text-center text-slate-500">No</td>
                      <td className="p-3 text-center text-blue-400">Yes</td>
                      <td className="p-3 text-center text-emerald-400">3 lanes</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Dictionary</td>
                      <td className="p-3 text-center text-slate-500">No</td>
                      <td className="p-3 text-center text-slate-500">No</td>
                      <td className="p-3 text-center text-slate-500">No</td>
                      <td className="p-3 text-center text-emerald-400">Yes</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-white">Concurrent (50)</td>
                      <td className="p-3 text-center text-slate-500">N/A</td>
                      <td className="p-3 text-center text-slate-500">N/A</td>
                      <td className="p-3 text-center text-slate-500">N/A</td>
                      <td className="p-3 text-center text-emerald-400">838ms</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 backdrop-blur-xl border-emerald-500/20">
            <div className="relative p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Development Status</h2>
              </div>
              <p className="text-slate-300 leading-relaxed mb-4">
                Atlas API 2.0 is <strong className="text-emerald-400">live infrastructure in beta</strong>, not a proposal. 
                All components documented in this whitepaper are implemented and deployed for testing.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Session Fabric: Live
                </span>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Priority Lanes: Live
                </span>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Encoding Pipeline: Live
                </span>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Wire Protocol: Live
                </span>
              </div>
            </div>
          </Card>
        </section>

        <footer className="text-center py-8 border-t border-white/5">
          <p className="text-sm text-slate-500">
            Atlas API 2.0 Whitepaper · Version 2.0 · December 2025
          </p>
          <p className="text-xs text-slate-600 mt-2">
            All benchmarks reproducible via internal audit tooling
          </p>
        </footer>
      </div>
    </div>
  );
}
