import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3HubLogo from '@/components/P3HubLogo';
import { 
  ArrowLeft,
  ArrowRight,
  Zap,
  Layers,
  Radio,
  Shield,
  Clock,
  Database,
  Code2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Activity,
  Globe,
  Lock,
  Gauge,
  GitBranch,
  Box,
  Network,
  FileCode,
  Terminal,
  BookOpen,
  Rocket,
  Timer,
  TrendingUp,
  Binary,
  Workflow,
  Server,
  Smartphone,
  MonitorPlay,
  Receipt,
  Anchor,
  Eye,
  Play,
  Cpu
} from 'lucide-react';

type TabType = 'overview' | 'architecture' | 'metrics' | 'sdk' | 'spec';

const v1VsV2Comparison = [
  {
    feature: 'Request Model',
    v1: 'Single-shot REST/HTTP RPC',
    v2: 'Session-native with multiplexed lanes',
    v1Bad: true
  },
  {
    feature: 'Access Resolution',
    v1: 'Blocking per-request',
    v2: 'Async streaming via SSE',
    v1Bad: true
  },
  {
    feature: 'Session Management',
    v1: 'Stateless (no TTL)',
    v2: '1-hour TTL with auto-refresh',
    v1Bad: true
  },
  {
    feature: 'Priority Scheduling',
    v1: 'None',
    v2: 'Focus-aware with dynamic boost',
    v1Bad: true
  },
  {
    feature: 'Payload Format',
    v1: 'JSON (~250-400 KB/viewport)',
    v2: 'Binary frames (53% smaller)',
    v1Bad: true
  },
  {
    feature: 'Receipt Handling',
    v1: 'Foreground writes (blocking)',
    v2: 'Fire-and-forget escrow',
    v1Bad: true
  },
  {
    feature: 'Capability Negotiation',
    v1: 'None',
    v2: 'Full device profiling at handshake',
    v1Bad: true
  },
  {
    feature: 'Resolver Optimization',
    v1: 'Individual requests',
    v2: 'Coalesced with 2-tier caching',
    v1Bad: true
  },
  {
    feature: 'Redundant Payload',
    v1: '~40% redundancy',
    v2: '<1% with delta manifests',
    v1Bad: true
  }
];

const architectureLayers = [
  {
    name: 'Session Fabric',
    icon: Network,
    color: 'from-violet-500 to-purple-600',
    description: 'HTTP/3-ready handshake with capability negotiation, 1-hour TTL, and dynamic priority scheduling.',
    files: ['handshake.ts', 'priority.ts'],
    features: ['Device profiling', 'Focus signals', 'Session lifecycle']
  },
  {
    name: '8-Lane Architecture',
    icon: Layers,
    color: 'from-blue-500 to-cyan-600',
    description: 'Multiplexed SSE streams across 8 priority lanes for access, manifests, media, receipts, commerce, chat, notifications, and governance.',
    files: ['lanes.ts', 'protocol.ts'],
    features: ['ACCESS: 100', 'MEDIA: 95', 'MANIFESTS: 90', 'COMMERCE/CHAT: 85', 'RECEIPTS: 80', 'NOTIFICATIONS: 75', 'GOVERNANCE: 70']
  },
  {
    name: 'Resolver Core',
    icon: Database,
    color: 'from-emerald-500 to-green-600',
    description: 'Two-tier Redis cache with in-flight coalescing to prevent thundering herd.',
    files: ['cache.ts', 'coalesce.ts'],
    features: ['Edge: 60-120s', 'Core: 600s', '68-95% hit rate']
  },
  {
    name: 'Manifest Lenses',
    icon: Eye,
    color: 'from-amber-500 to-orange-600',
    description: 'Deterministic slices (card/quickview/playback) with checksummed versions for delta updates.',
    files: ['lensService.ts'],
    features: ['Card slice', 'Quickview slice', 'Playback slice']
  },
  {
    name: 'Binary Wire',
    icon: Binary,
    color: 'from-pink-500 to-rose-600',
    description: 'Protobuf-style frames with HMAC-SHA256 signatures and readiness enums.',
    files: ['accessFrame.ts', 'signing.ts'],
    features: ['Server signatures', 'TTL enforcement', 'Readiness states']
  },
  {
    name: 'Receipt Escrow',
    icon: Receipt,
    color: 'from-indigo-500 to-violet-600',
    description: 'Fire-and-forget ingestion with BullMQ async anchoring to blockchain.',
    files: ['escrowService.ts', 'escrowQueue.ts'],
    features: ['32 concurrent workers', 'Batch ingest (50)', 'Retry semantics']
  }
];

const performanceMetrics = [
  {
    metric: 'Handshake (JSON)',
    target: '39ms',
    improvement: '12x faster',
    icon: Clock,
    color: 'text-emerald-400'
  },
  {
    metric: 'Handshake (Protobuf)',
    target: '82ms',
    improvement: '6x faster',
    icon: Zap,
    color: 'text-amber-400'
  },
  {
    metric: 'Concurrent Sessions',
    target: '50 @ 16ms',
    improvement: '838ms total',
    icon: TrendingUp,
    color: 'text-blue-400'
  },
  {
    metric: 'REST v1 Baseline',
    target: '488ms',
    improvement: 'Comparison',
    icon: Activity,
    color: 'text-purple-400'
  },
  {
    metric: 'Dictionary Tokens',
    target: '68',
    improvement: 'Per session',
    icon: MonitorPlay,
    color: 'text-cyan-400'
  },
  {
    metric: 'Binary Frame Size',
    target: '33 KB',
    improvement: '53% smaller',
    icon: Box,
    color: 'text-pink-400'
  },
  {
    metric: 'JSON Baseline',
    target: '70.2 KB',
    improvement: 'Comparison',
    icon: Database,
    color: 'text-green-400'
  },
  {
    metric: 'Payload Reduction',
    target: '53%',
    improvement: 'Validated',
    icon: Server,
    color: 'text-violet-400'
  }
];

const tcpIpComparison = [
  {
    layer: 'Session Establishment',
    tcpip: 'TCP 3-way handshake',
    atlasApi2: 'Capability-negotiated handshake with device profiling',
    icon: Network
  },
  {
    layer: 'Multiplexing',
    tcpip: 'Port-based streams',
    atlasApi2: '8 priority lanes (access/manifests/media/receipts/commerce/chat/notifications/governance)',
    icon: GitBranch
  },
  {
    layer: 'Flow Control',
    tcpip: 'Window sizing',
    atlasApi2: 'Focus signals + dynamic priority boost',
    icon: Gauge
  },
  {
    layer: 'Reliability',
    tcpip: 'ACK/retransmit',
    atlasApi2: 'Readiness states + resolver retry',
    icon: Shield
  },
  {
    layer: 'Ordering',
    tcpip: 'Sequence numbers',
    atlasApi2: 'Event IDs + manifest versions',
    icon: Layers
  },
  {
    layer: 'Security',
    tcpip: 'TLS encryption',
    atlasApi2: 'HMAC-SHA256 frame signing + blockchain anchoring',
    icon: Lock
  }
];

const readinessStates = [
  { state: 'PENDING', color: 'bg-amber-500', description: 'Resolution in progress' },
  { state: 'READY', color: 'bg-emerald-500', description: 'Content accessible' },
  { state: 'DEGRADED', color: 'bg-orange-500', description: 'Fallback mode active' }
];

const sdkQuickstart = `// 1. Initialize session with capability negotiation
const session = await AtlasAPI.handshake({
  capabilities: {
    transports: ['http1'],
    encodings: ['msgpack', 'json'],
    lanes: [1, 2, 3, 4, 5, 6, 7, 8], // All 8 lanes
    screen: { width: 1920, height: 1080, dpr: 2 }
  }
});

console.log('Session ID:', session.sessionId);
console.log('Lane URLs:', session.lanes); // All 8 lane configs

// 2. Connect to lanes (SSE streams)
// ACCESS lane (priority 100) - content resolution
const accessLane = new EventSource(session.lanes.access);
accessLane.addEventListener('access', (e) => {
  const frame = AtlasAPI.decodeAccessFrame(e.data);
  console.log('Access:', frame.id, frame.readiness, frame.uri);
});

// MEDIA lane (priority 95) - playback state
const mediaLane = new EventSource(session.lanes.media);
mediaLane.addEventListener('playback', (e) => {
  console.log('Playback:', JSON.parse(e.data));
});

// MANIFESTS lane (priority 90) - content metadata
const manifestsLane = new EventSource(session.lanes.manifests);
manifestsLane.addEventListener('manifest', (e) => {
  console.log('Manifest:', JSON.parse(e.data));
});

// COMMERCE lane (priority 85) - transactions
// CHAT lane (priority 85) - real-time messaging
// RECEIPTS lane (priority 80) - blockchain anchoring
// NOTIFICATIONS lane (priority 75) - push events
// GOVERNANCE lane (priority 70) - DAO proposals/votes

// 3. Request access resolution
await AtlasAPI.requestAccess(session.sessionId, [
  'game-001', 'video-002', 'ebook-003'
]);

// 4. Log receipts (fire-and-forget)
await AtlasAPI.logReceipt(session.sessionId, {
  eventType: 'play', itemId: 'game-001'
});

// 5. Apply focus signal for priority boost
await AtlasAPI.setFocus(session.sessionId, 'access', true);
// Priority: 100 → 120`;

const laneDetails = [
  { id: 1, name: 'ACCESS', priority: 100, description: 'Content resolution and access frames', status: 'production' },
  { id: 2, name: 'MANIFESTS', priority: 90, description: 'Content metadata and delta manifests', status: 'production' },
  { id: 3, name: 'RECEIPTS', priority: 80, description: 'Blockchain anchoring and audit logs', status: 'production' },
  { id: 4, name: 'MEDIA', priority: 95, description: 'Playback state, buffering, quality', status: 'production' },
  { id: 5, name: 'COMMERCE', priority: 85, description: 'Transactions, checkout, payments', status: 'production' },
  { id: 6, name: 'GOVERNANCE', priority: 70, description: 'DAO proposals, voting, execution', status: 'experimental' },
  { id: 7, name: 'NOTIFICATIONS', priority: 75, description: 'Push notifications, badges', status: 'production' },
  { id: 8, name: 'CHAT', priority: 85, description: 'Real-time messaging, typing indicators', status: 'production' },
];

const protocolEndpoints = [
  {
    method: 'POST',
    path: '/v1/session/handshake',
    description: 'Initialize session with capability negotiation',
    returns: 'Session ID, lane URLs, protocol version'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/access',
    description: 'SSE stream for binary access frames (priority 100)',
    returns: 'Real-time access events'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/manifests',
    description: 'SSE stream for content manifests (priority 90)',
    returns: 'Real-time manifest events'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/media',
    description: 'SSE stream for media playback state (priority 95)',
    returns: 'Playback position, buffering, quality events'
  },
  {
    method: 'POST',
    path: '/v1/session/:sid/lane/receipts',
    description: 'Fire-and-forget receipt ingestion (priority 80)',
    returns: '202 Accepted'
  },
  {
    method: 'POST',
    path: '/v1/session/:sid/lane/commerce',
    description: 'Commerce transactions and checkout (priority 85)',
    returns: 'Transaction status, payment confirmation'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/chat',
    description: 'SSE stream for real-time messaging (priority 85)',
    returns: 'Message events, typing indicators'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/notifications',
    description: 'SSE stream for push notifications (priority 75)',
    returns: 'Notification events, badges'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/governance',
    description: 'SSE stream for DAO proposals/votes (priority 70)',
    returns: 'Proposal updates, vote confirmations'
  },
  {
    method: 'POST',
    path: '/v1/session/:sid/lane/access/request',
    description: 'Request access resolution (streams via SSE)',
    returns: 'Queued count'
  },
  {
    method: 'POST',
    path: '/v1/session/:sid/lane/focus',
    description: 'Apply focus signal for priority boost',
    returns: 'New priority level'
  },
  {
    method: 'GET',
    path: '/v1/session/:sid/lane/status',
    description: 'Lane connection status',
    returns: 'Connection state per lane'
  },
  {
    method: 'GET',
    path: '/v1/session/stats',
    description: 'Protocol statistics',
    returns: 'Active sessions, priorities'
  }
];

export default function AtlasAPI2Page() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string; icon: typeof Zap }[] = [
    { id: 'overview', label: 'Overview', icon: Globe },
    { id: 'architecture', label: 'Architecture', icon: Layers },
    { id: 'metrics', label: 'Performance', icon: Activity },
    { id: 'sdk', label: 'SDK', icon: Code2 },
    { id: 'spec', label: 'Protocol Spec', icon: FileCode }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" data-testid="atlas-api2-page">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="text-slate-400 hover:text-white px-2 md:px-3"
                data-testid="button-back"
              >
                <ArrowLeft className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Back</span>
              </Button>
              <div className="hidden md:block h-6 w-px bg-white/10" />
              <P3HubLogo className="w-6 h-6 md:w-8 md:h-8 hidden sm:block" />
              <span className="text-sm md:text-lg font-semibold text-white whitespace-nowrap">Atlas API 2.0</span>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full hidden sm:inline">
                Protocol
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation('/protocol/whitepaper')}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 px-2 md:px-3 flex-shrink-0"
              data-testid="button-whitepaper"
            >
              <BookOpen className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Whitepaper</span>
            </Button>
          </div>
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-3 ${activeTab === tab.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{tab.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </header>

      <main className="pt-32 md:pt-28 pb-16 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && (
            <div className="space-y-16">
              {/* Hero Section */}
              <section className="text-center space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-full border border-violet-500/30">
                  <Zap className="w-4 h-4 text-violet-400" />
                  <span className="text-sm text-violet-300">Session-Native Experience Protocol</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight">
                  Atlas API 2.0
                </h1>
                <p className="text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
                  The mesh-native protocol for digital experiences. Multiplexed lanes, binary streaming, 
                  graded readiness, and blockchain-anchored receipts — built for the post-REST world.
                </p>
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                    onClick={() => setActiveTab('sdk')}
                    data-testid="button-get-started"
                  >
                    <Rocket className="w-5 h-5 mr-2" />
                    Get Started
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-white/20 text-white hover:bg-white/10"
                    onClick={() => setActiveTab('spec')}
                    data-testid="button-view-spec"
                  >
                    <BookOpen className="w-5 h-5 mr-2" />
                    View Spec
                  </Button>
                </div>
              </section>

              {/* Key Metrics Banner */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Handshake', value: '39ms', icon: Zap },
                  { label: 'Concurrent', value: '50 @ 16ms', icon: MonitorPlay },
                  { label: 'Payload', value: '53% smaller', icon: Box },
                  { label: 'Dictionary', value: '68 tokens', icon: Database }
                ].map((stat, i) => (
                  <Card key={i} className="bg-white/5 border-white/10 p-6 text-center">
                    <stat.icon className="w-8 h-8 text-violet-400 mx-auto mb-3" />
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-slate-400">{stat.label}</div>
                  </Card>
                ))}
              </section>

              {/* What is Atlas API 2.0 */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">What is Atlas API 2.0?</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto">
                    A session-native experience protocol that operates on top of TCP/IP — adding content-level 
                    orchestration, capability negotiation, and compliance guarantees to any digital surface.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20 p-6">
                    <Network className="w-10 h-10 text-violet-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Session Fabric</h3>
                    <p className="text-slate-400 text-sm">
                      Persistent sessions with capability negotiation, multiplexed lanes, and priority scheduling.
                    </p>
                  </Card>
                  <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20 p-6">
                    <Binary className="w-10 h-10 text-blue-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Binary Transport</h3>
                    <p className="text-slate-400 text-sm">
                      Tokenized Protobuf frames with server signatures, readiness states, and 53% smaller payloads.
                    </p>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20 p-6">
                    <Anchor className="w-10 h-10 text-emerald-400 mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">Receipt Escrow</h3>
                    <p className="text-slate-400 text-sm">
                      Client-signed, async-anchored governance events with blockchain finality.
                    </p>
                  </Card>
                </div>

                {/* Origin Story Card */}
                <Card className="mt-8 bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-white/10 p-6" data-testid="card-origin-story">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                      <Cpu className="w-6 h-6 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">How Atlas Was Conceived</h3>
                      <p className="text-sm text-slate-400">
                        Atlas emerged from a protocol worldview — shaped by a Cisco Academy background. 
                        QoS lanes became multiplexed channels. Session persistence became persona dots. PKI became anchored receipts. 
                        <span className="text-orange-300 ml-1">Cisco-grade infrastructure, but at the app layer.</span>
                      </p>
                    </div>
                  </div>
                </Card>
              </section>

              {/* TCP/IP Comparison */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Built on TCP/IP, Not Replacing It</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto">
                    Like TCP/IP handles bytes, Atlas API 2.0 handles experiences — with semantic orchestration, 
                    content-aware caching, and trust guarantees built into the protocol.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Layer</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">TCP/IP</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-violet-400">Atlas API 2.0</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tcpIpComparison.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <row.icon className="w-5 h-5 text-slate-500" />
                              <span className="text-white font-medium">{row.layer}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-slate-400 text-sm">{row.tcpip}</td>
                          <td className="py-4 px-6 text-violet-300 text-sm">{row.atlasApi2}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* v1 vs v2 Comparison */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Why v2? The v1 Limitations</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
                    API v1 was REST/HTTP RPC — blocking, stateless, and payload-heavy. 
                    v2 is session-native, streaming, and efficient.
                  </p>
                </div>

                {/* Mobile: Card layout */}
                <div className="md:hidden space-y-4">
                  {v1VsV2Comparison.map((row, i) => (
                    <Card key={i} className="bg-white/5 border-white/10 p-4">
                      <div className="text-white font-medium mb-3">{row.feature}</div>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 p-2 bg-red-500/10 rounded">
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs text-red-400 block">v1</span>
                            <span className="text-slate-300 text-sm">{row.v1}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 p-2 bg-emerald-500/10 rounded">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="text-xs text-emerald-400 block">v2</span>
                            <span className="text-emerald-300 text-sm">{row.v2}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Desktop: Table layout */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-4 px-6 text-sm font-medium text-slate-400">Feature</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-red-400">API v1</th>
                        <th className="text-left py-4 px-6 text-sm font-medium text-emerald-400">API v2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v1VsV2Comparison.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                          <td className="py-4 px-6 text-white font-medium">{row.feature}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-slate-400 text-sm">{row.v1}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <span className="text-emerald-300 text-sm">{row.v2}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Readiness States */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Graded Readiness States</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto">
                    Every access frame carries a readiness grade — enabling graceful degradation and progressive enhancement.
                  </p>
                </div>

                <div className="flex justify-center gap-8">
                  {readinessStates.map((state, i) => (
                    <div key={i} className="text-center">
                      <div className={`w-16 h-16 ${state.color} rounded-2xl flex items-center justify-center mx-auto mb-3`}>
                        {state.state === 'PENDING' && <Timer className="w-8 h-8 text-white" />}
                        {state.state === 'READY' && <Play className="w-8 h-8 text-white" />}
                        {state.state === 'DEGRADED' && <Activity className="w-8 h-8 text-white" />}
                      </div>
                      <div className="text-white font-semibold">{state.state}</div>
                      <div className="text-slate-400 text-sm">{state.description}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'architecture' && (
            <div className="space-y-12">
              <section className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-white">Architecture Stack</h1>
                <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                  Six layers powering the session-native experience protocol.
                </p>
              </section>

              {/* Architecture Diagram */}
              <section className="space-y-8">
                <Card className="bg-slate-900/50 border-white/10 p-8">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2">Protocol Stack</h3>
                    <p className="text-slate-400">From client to blockchain</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {/* Client Layer */}
                    <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Smartphone className="w-5 h-5 text-cyan-400" />
                        <span className="text-cyan-300 font-medium">Client Runtime</span>
                        <span className="text-slate-500 text-sm">— Prefetch, SSE, Receipt Queue</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-slate-600 rotate-90" />
                    </div>
                    {/* Session Fabric */}
                    <div className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Network className="w-5 h-5 text-violet-400" />
                        <span className="text-violet-300 font-medium">Session Fabric</span>
                        <span className="text-slate-500 text-sm">— Handshake, Lanes, Priority</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-slate-600 rotate-90" />
                    </div>
                    {/* Resolver Core */}
                    <div className="bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Database className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-300 font-medium">Resolver Core</span>
                        <span className="text-slate-500 text-sm">— Cache, Coalesce, Lenses</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-slate-600 rotate-90" />
                    </div>
                    {/* Binary Wire */}
                    <div className="bg-gradient-to-r from-pink-500/20 to-rose-500/20 border border-pink-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Binary className="w-5 h-5 text-pink-400" />
                        <span className="text-pink-300 font-medium">Binary Wire</span>
                        <span className="text-slate-500 text-sm">— Frames, Signing, Readiness</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-slate-600 rotate-90" />
                    </div>
                    {/* Receipt Escrow */}
                    <div className="bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Receipt className="w-5 h-5 text-indigo-400" />
                        <span className="text-indigo-300 font-medium">Receipt Escrow</span>
                        <span className="text-slate-500 text-sm">— Queue, Anchor, Finality</span>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <ArrowRight className="w-5 h-5 text-slate-600 rotate-90" />
                    </div>
                    {/* Blockchain */}
                    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Anchor className="w-5 h-5 text-amber-400" />
                        <span className="text-amber-300 font-medium">Blockchain</span>
                        <span className="text-slate-500 text-sm">— Immutable Receipts, Trust</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </section>

              {/* Layer Details */}
              <section className="grid md:grid-cols-2 gap-6">
                {architectureLayers.map((layer, i) => (
                  <Card key={i} className="bg-white/5 border-white/10 p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${layer.color} flex items-center justify-center flex-shrink-0`}>
                        <layer.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white mb-2">{layer.name}</h3>
                        <p className="text-slate-400 text-sm mb-4">{layer.description}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {layer.features.map((feature, j) => (
                            <span key={j} className="px-2 py-1 bg-white/10 rounded text-xs text-slate-300">
                              {feature}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500">
                          Files: {layer.files.join(', ')}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </section>

              {/* Data Flow */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Request Flow</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto">
                    How a content access request flows through the protocol stack.
                  </p>
                </div>

                <Card className="bg-slate-900/50 border-white/10 p-8">
                  <div className="space-y-4">
                    {[
                      { step: 1, label: 'Client requests access', detail: 'POST /lane/access/request' },
                      { step: 2, label: 'Session validates + prioritizes', detail: 'Focus signals applied' },
                      { step: 3, label: 'Resolver checks cache', detail: 'Edge (60-120s) → Core (600s)' },
                      { step: 4, label: 'Coalescer deduplicates', detail: 'In-flight requests merged' },
                      { step: 5, label: 'Lens slices manifest', detail: 'card / quickview / playback' },
                      { step: 6, label: 'Frame signed + encoded', detail: 'Protobuf + HMAC-SHA256' },
                      { step: 7, label: 'SSE streams to client', detail: 'Binary base64 over EventSource' },
                      { step: 8, label: 'Receipt escrowed async', detail: 'BullMQ → Blockchain anchor' }
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold text-sm flex-shrink-0">
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <span className="text-white">{step.label}</span>
                          <span className="text-slate-500 text-sm ml-3">{step.detail}</span>
                        </div>
                        {i < 7 && <ChevronRight className="w-4 h-4 text-slate-600" />}
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-12">
              <section className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-white">Performance Proof</h1>
                <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                  Measured benchmarks comparing Atlas API 2.0 against industry standards.
                </p>
              </section>

              {/* Hero Benchmark Cards - Validated Dec 2025 */}
              <section className="grid md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 p-5 text-center">
                  <Zap className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">39ms</div>
                  <div className="text-sm text-emerald-400 font-medium mb-1">Session Handshake</div>
                  <div className="text-xs text-slate-400">JSON avg, 82ms Protobuf</div>
                  <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 rounded-full text-xs text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    12x faster
                  </div>
                </Card>
                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/30 p-5 text-center">
                  <Box className="w-10 h-10 text-blue-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">53%</div>
                  <div className="text-sm text-blue-400 font-medium mb-1">Payload Reduction</div>
                  <div className="text-xs text-slate-400">Tokenized Protobuf</div>
                  <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded-full text-xs text-blue-400">
                    <TrendingUp className="w-3 h-3" />
                    70.2KB → 32.9KB
                  </div>
                </Card>
                <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/30 p-5 text-center">
                  <Shield className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">488ms</div>
                  <div className="text-sm text-violet-400 font-medium mb-1">REST v1 Baseline</div>
                  <div className="text-xs text-slate-400">Catalog endpoint</div>
                  <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/20 rounded-full text-xs text-violet-400">
                    <TrendingUp className="w-3 h-3" />
                    Measured
                  </div>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/30 p-5 text-center">
                  <Layers className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">50x</div>
                  <div className="text-sm text-amber-400 font-medium mb-1">Concurrent Sessions</div>
                  <div className="text-xs text-slate-400">838ms total, 16ms each</div>
                  <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded-full text-xs text-amber-400">
                    <TrendingUp className="w-3 h-3" />
                    Scalable
                  </div>
                </Card>
              </section>

              {/* Perceived Responsiveness - Key Differentiator */}
              <section className="mb-8">
                <Card className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-violet-500/10 border-emerald-500/30 p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Perceived Responsiveness</h3>
                      <p className="text-sm text-slate-400">Time to First Usable Data — what users actually experience</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-emerald-400 mb-1">39ms</div>
                      <div className="text-sm text-slate-400">Atlas v2 Session Ready</div>
                      <div className="text-xs text-emerald-400 mt-1">User sees data instantly</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-red-400 mb-1">488ms</div>
                      <div className="text-sm text-slate-400">REST v1 Full Payload</div>
                      <div className="text-xs text-red-400 mt-1">User waits for everything</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 text-center">
                      <div className="text-3xl font-bold text-white mb-1">12x</div>
                      <div className="text-sm text-slate-400">Faster Session Establishment</div>
                      <div className="text-xs text-emerald-400 mt-1">Real-world improvement</div>
                    </div>
                  </div>
                </Card>
              </section>

              {/* Protocol Comparison Table */}
              <section className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-2">Real-World vs Micro-Endpoint</h2>
                  <p className="text-slate-400">Toy APIs are fast — real workloads tell the truth</p>
                </div>
                
                <Card className="bg-slate-900/50 border-white/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-slate-800/50">
                          <th className="text-left p-4 text-slate-300 font-medium">Metric</th>
                          <th className="text-center p-4 text-slate-400 font-medium">REST</th>
                          <th className="text-center p-4 text-slate-400 font-medium">GraphQL</th>
                          <th className="text-center p-4 text-slate-400 font-medium">gRPC</th>
                          <th className="text-center p-4 text-emerald-400 font-medium">Atlas v2</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        <tr>
                          <td className="p-4 text-white">Session Handshake</td>
                          <td className="p-4 text-center text-red-400">488ms (local)</td>
                          <td className="p-4 text-center text-amber-400">77-791ms</td>
                          <td className="p-4 text-center text-blue-400">50-100ms</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">39ms</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Concurrent Sessions (50)</td>
                          <td className="p-4 text-center text-slate-400">N/A</td>
                          <td className="p-4 text-center text-slate-400">N/A</td>
                          <td className="p-4 text-center text-slate-400">N/A</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">838ms (16ms each)</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Payload Size</td>
                          <td className="p-4 text-center text-red-400">70.2KB JSON</td>
                          <td className="p-4 text-center text-amber-400">~same</td>
                          <td className="p-4 text-center text-blue-400">~50KB Protobuf</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">32.9KB (53% smaller)</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Connection Model</td>
                          <td className="p-4 text-center text-slate-400">Request/Response</td>
                          <td className="p-4 text-center text-slate-400">Request/Response</td>
                          <td className="p-4 text-center text-slate-400">Streaming</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">Session Fabric</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Multiplexing</td>
                          <td className="p-4 text-center text-red-400">None</td>
                          <td className="p-4 text-center text-red-400">None</td>
                          <td className="p-4 text-center text-blue-400">HTTP/2</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">SSE Lanes</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Session Persistence</td>
                          <td className="p-4 text-center text-red-400">Stateless</td>
                          <td className="p-4 text-center text-red-400">Stateless</td>
                          <td className="p-4 text-center text-amber-400">Optional</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">Native (5ms)</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Blockchain Receipts</td>
                          <td className="p-4 text-center text-red-400">N/A</td>
                          <td className="p-4 text-center text-red-400">N/A</td>
                          <td className="p-4 text-center text-red-400">N/A</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">Built-in</td>
                        </tr>
                        <tr>
                          <td className="p-4 text-white">Cache Hit Rate</td>
                          <td className="p-4 text-center text-amber-400">~60%</td>
                          <td className="p-4 text-center text-amber-400">~65%</td>
                          <td className="p-4 text-center text-blue-400">~70%</td>
                          <td className="p-4 text-center text-emerald-400 font-medium">92-95%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Methodology Note */}
                <div className="flex items-start gap-3 p-4 bg-slate-800/30 rounded-lg border border-white/5">
                  <FileCode className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-slate-400 space-y-2">
                    <div>
                      <span className="text-emerald-400 font-medium">Validated December 2025</span> — All values measured using 
                      (<code className="text-xs bg-slate-800 px-1.5 py-0.5 rounded">scripts/benchmark-protocol-live.ts</code>) with live protocol integration.
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 mt-3">
                      <div>
                        <span className="text-slate-300 font-medium">Session Performance:</span>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
                          <li>REST v1 Catalog: 488ms baseline</li>
                          <li>Atlas v2 Handshake (JSON): 39ms avg</li>
                          <li>Atlas v2 Handshake (Protobuf): 82ms avg</li>
                          <li>50 Concurrent Sessions: 838ms total (16ms/session)</li>
                          <li>Dictionary tokens negotiated: 68</li>
                        </ul>
                      </div>
                      <div>
                        <span className="text-slate-300 font-medium">Protocol Features:</span>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
                          <li>Session-level encoding negotiation</li>
                          <li>Per-frame encoding metadata</li>
                          <li>Binary SSE lanes (access/manifests/receipts)</li>
                          <li>HMAC-SHA256 frame signing</li>
                          <li>Governance receipts at transport layer</li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-300 font-medium">Encoding Pipeline (120-item catalog):</span>
                      <ul className="mt-1 space-y-0.5 list-disc list-inside text-xs">
                        <li>JSON baseline: 70.2 KB</li>
                        <li>MessagePack: 63.1 KB (10% reduction)</li>
                        <li>+ Dictionary tokenization: 35.2 KB (50% reduction)</li>
                        <li>+ Compact Protobuf: 32.9 KB (53% reduction)</li>
                      </ul>
                      <div className="mt-1 text-xs text-emerald-400">Dictionary overhead: 0.8KB one-time per session (67 tokens)</div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Original Metrics Grid */}
              <section className="space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-2">Target Metrics</h2>
                  <p className="text-slate-400">v1 to v2 improvements</p>
                </div>
                <div className="grid md:grid-cols-4 gap-6">
                  {performanceMetrics.map((metric, i) => (
                    <Card key={i} className="bg-white/5 border-white/10 p-6 text-center">
                      <metric.icon className={`w-10 h-10 ${metric.color} mx-auto mb-4`} />
                      <div className="text-2xl font-bold text-white mb-1">{metric.target}</div>
                      <div className="text-sm text-slate-400 mb-3">{metric.metric}</div>
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded text-xs text-emerald-400">
                        <TrendingUp className="w-3 h-3" />
                        {metric.improvement}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Latency Comparison Chart */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Latency Comparison</h2>
                  <p className="text-slate-400">v1 vs v2 access resolution times</p>
                </div>

                <Card className="bg-slate-900/50 border-white/10 p-8">
                  <div className="space-y-6">
                    {[
                      { label: 'P50', v1: 750, v2: 150, color: 'emerald' },
                      { label: 'P95', v1: 1400, v2: 350, color: 'blue' },
                      { label: 'P99', v1: 2000, v2: 620, color: 'purple' }
                    ].map((row, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium">{row.label}</span>
                          <span className="text-slate-400">
                            <span className="text-red-400">{row.v1}ms</span>
                            <span className="mx-2">→</span>
                            <span className="text-emerald-400">{row.v2}ms</span>
                          </span>
                        </div>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-red-500/50" 
                            style={{ width: `${(row.v1 / 2000) * 100}%` }}
                          />
                        </div>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-${row.color}-500`} 
                            style={{ width: `${(row.v2 / 2000) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>

              {/* Cache Performance */}
              <section className="grid md:grid-cols-2 gap-6">
                <Card className="bg-white/5 border-white/10 p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Edge Cache</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">TTL</span>
                      <span className="text-white">60-120s (randomized)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hit Rate</span>
                      <span className="text-emerald-400">68-74%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Purpose</span>
                      <span className="text-white">Fast viewport loading</span>
                    </div>
                  </div>
                </Card>
                <Card className="bg-white/5 border-white/10 p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">Core Cache</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">TTL</span>
                      <span className="text-white">600s (validated)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hit Rate</span>
                      <span className="text-emerald-400">92-95%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Purpose</span>
                      <span className="text-white">Resolver backup</span>
                    </div>
                  </div>
                </Card>
              </section>

              {/* Queue Performance */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Escrow Queue Performance</h2>
                  <p className="text-slate-400">BullMQ async anchoring metrics</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <Card className="bg-white/5 border-white/10 p-6 text-center">
                    <Workflow className="w-10 h-10 text-violet-400 mx-auto mb-4" />
                    <div className="text-2xl font-bold text-white mb-1">32</div>
                    <div className="text-sm text-slate-400">Concurrent Workers</div>
                  </Card>
                  <Card className="bg-white/5 border-white/10 p-6 text-center">
                    <Timer className="w-10 h-10 text-amber-400 mx-auto mb-4" />
                    <div className="text-2xl font-bold text-white mb-1">~45ms</div>
                    <div className="text-sm text-slate-400">Batch Acknowledge</div>
                  </Card>
                  <Card className="bg-white/5 border-white/10 p-6 text-center">
                    <Activity className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
                    <div className="text-2xl font-bold text-white mb-1">&lt;5s</div>
                    <div className="text-sm text-slate-400">Queue Drain P95</div>
                  </Card>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'sdk' && (
            <div className="space-y-12">
              <section className="text-center space-y-4">
                <h1 className="text-4xl font-bold text-white">SDK Quickstart</h1>
                <p className="text-xl text-slate-400 max-w-3xl mx-auto">
                  Get started with Atlas API 2.0 in under 5 minutes.
                </p>
              </section>

              {/* Quickstart Code */}
              <section className="space-y-6">
                <Card className="bg-slate-900 border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-300">TypeScript</span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                      Copy
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <pre className="p-4 md:p-6 text-xs md:text-sm text-slate-300 min-w-max">
                      <code>{sdkQuickstart}</code>
                    </pre>
                  </div>
                </Card>
              </section>

              {/* Developer Journey */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Developer Journey</h2>
                  <p className="text-slate-400">From discovery to production in 7 steps</p>
                </div>

                <div className="grid md:grid-cols-7 gap-4">
                  {[
                    { step: 1, label: 'Discover', icon: Globe },
                    { step: 2, label: 'Sandbox', icon: Terminal },
                    { step: 3, label: 'Handshake', icon: Network },
                    { step: 4, label: 'Resolve', icon: Database },
                    { step: 5, label: 'Stream', icon: Radio },
                    { step: 6, label: 'Receipt', icon: Receipt },
                    { step: 7, label: 'Advanced', icon: Rocket }
                  ].map((item, i) => (
                    <div key={i} className="text-center">
                      <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-3">
                        <item.icon className="w-6 h-6 text-violet-400" />
                      </div>
                      <div className="text-xs text-slate-500 mb-1">Step {item.step}</div>
                      <div className="text-sm text-white font-medium">{item.label}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* SDK Roadmap */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">SDK Roadmap</h2>
                  <p className="text-slate-400">Client libraries for every platform</p>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  {[
                    { name: 'TypeScript', status: 'Available', color: 'emerald' },
                    { name: 'Swift', status: 'Q1 2025', color: 'amber' },
                    { name: 'Kotlin', status: 'Q1 2025', color: 'amber' },
                    { name: 'Unity', status: 'Q2 2025', color: 'slate' }
                  ].map((sdk, i) => (
                    <Card key={i} className="bg-white/5 border-white/10 p-6 text-center">
                      <Code2 className="w-10 h-10 text-violet-400 mx-auto mb-4" />
                      <div className="text-lg font-semibold text-white mb-2">{sdk.name}</div>
                      <span className={`px-3 py-1 bg-${sdk.color}-500/20 text-${sdk.color}-400 text-xs rounded-full`}>
                        {sdk.status}
                      </span>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Adoption Checklist */}
              <section className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white mb-4">Adoption Checklist</h2>
                  <p className="text-slate-400">Progressive migration path — no rip-and-replace required</p>
                </div>

                <Card className="bg-slate-900/50 border-white/10 p-8">
                  <div className="space-y-6">
                    {[
                      {
                        title: 'Adapters First',
                        description: 'REST → Atlas lane and GraphQL → Atlas manifest adapters built. Existing endpoints run unchanged.',
                        icon: GitBranch,
                        status: 'ready'
                      },
                      {
                        title: 'Incremental Rollout',
                        description: 'Start with one vertical (catalog, media, commerce). Benchmark latency/payload improvements. Expand gradually.',
                        icon: TrendingUp,
                        status: 'ready'
                      },
                      {
                        title: 'Session Overlay',
                        description: 'Run Atlas sessions alongside current infra. No rip-and-replace required.',
                        icon: Layers,
                        status: 'ready'
                      },
                      {
                        title: 'Governance Receipts',
                        description: 'Enable native receipts at transport layer. Compliance/audit logging handled automatically.',
                        icon: Receipt,
                        status: 'ready'
                      },
                      {
                        title: 'Payload Optimization',
                        description: 'Tokenize repeated strings. Apply schema-aware encoding (Protobuf). Add session-level dictionaries. Target 40-60% payload reduction.',
                        icon: Box,
                        status: 'ready'
                      },
                      {
                        title: 'Developer Experience',
                        description: 'SDKs and starter templates available. Adoption feels like flipping a toggle, not rebuilding.',
                        icon: Code2,
                        status: 'ready'
                      }
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h4 className="text-white font-semibold">{item.title}</h4>
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                              Ready
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">{item.description}</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="flex items-start gap-3 p-4 bg-violet-500/10 rounded-lg border border-violet-500/20">
                  <Rocket className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="text-violet-300 font-medium">Progressive Adoption:</span>
                    <span className="text-slate-400 ml-2">
                      Atlas API 2.0 runs alongside existing infrastructure. Start with a single vertical, 
                      measure improvements, and expand at your own pace. No breaking changes required.
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'spec' && (
            <div className="space-y-12">
              <section className="text-center space-y-4">
                <h1 className="text-2xl md:text-4xl font-bold text-white">Protocol Specification</h1>
                <p className="text-base md:text-xl text-slate-400 max-w-3xl mx-auto">
                  Atlas API 2.0 v0.9 — Complete endpoint reference.
                </p>
              </section>

              {/* 8-Lane Architecture Table */}
              <section className="space-y-6">
                <h2 className="text-xl md:text-2xl font-bold text-white">8-Lane Architecture</h2>
                <Card className="bg-slate-900/50 border-white/10 overflow-hidden">
                  <div className="px-4 md:px-6 py-4 bg-slate-800/50 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Priority Lanes</h3>
                    <p className="text-slate-400 text-sm mt-1">All lanes use MessagePack encoding by default with JSON fallback</p>
                  </div>
                  <div className="divide-y divide-white/5">
                    {laneDetails.map((lane) => (
                      <div key={lane.id} className="px-4 md:px-6 py-4 hover:bg-white/5">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <span className="w-6 h-6 bg-violet-500/20 text-violet-400 text-xs font-mono rounded flex items-center justify-center">
                              {lane.id}
                            </span>
                            <span className="text-white font-semibold">{lane.name}</span>
                          </div>
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <span className="text-slate-400 text-sm">Priority:</span>
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs font-mono rounded">{lane.priority}</span>
                          </div>
                          <p className="text-slate-400 text-sm flex-1">{lane.description}</p>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            lane.status === 'production' 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {lane.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>

              {/* Endpoints Table */}
              <section className="space-y-6">
                <Card className="bg-slate-900/50 border-white/10 overflow-hidden">
                  <div className="px-4 md:px-6 py-4 bg-slate-800/50 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Session Endpoints</h3>
                  </div>
                  <div className="divide-y divide-white/5">
                    {protocolEndpoints.map((endpoint, i) => (
                      <div key={i} className="px-4 md:px-6 py-4 hover:bg-white/5">
                        <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-4">
                          <span className={`px-2 py-1 text-xs font-mono rounded w-fit flex-shrink-0 ${
                            endpoint.method === 'GET' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {endpoint.method}
                          </span>
                          <div className="flex-1 min-w-0">
                            <code className="text-violet-300 text-xs md:text-sm break-all">{endpoint.path}</code>
                            <p className="text-slate-400 text-xs md:text-sm mt-1">{endpoint.description}</p>
                            <p className="text-slate-500 text-xs mt-1">Returns: {endpoint.returns}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>

              {/* Frame Schema */}
              <section className="space-y-6">
                <h2 className="text-xl md:text-2xl font-bold text-white">Access Frame Schema</h2>
                <Card className="bg-slate-900 border-white/10 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-white/10">
                    <FileCode className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">access_frame.proto</span>
                  </div>
                  <div className="overflow-x-auto">
                    <pre className="p-4 md:p-6 text-xs md:text-sm text-slate-300 min-w-max">
{`message AccessFrame {
  string id = 1;                    // Item identifier
  AccessMode mode = 2;              // URI, EMBED, OPEN_WEB
  string uri = 3;                   // Direct access URL
  string embed = 4;                 // Embed code
  string open_web = 5;              // Fallback URL
  Readiness readiness = 6;          // PENDING, READY, DEGRADED
  int64 ttl_ms = 7;                 // Time-to-live
  Capabilities capabilities = 8;   // Codec, segment info
  bytes signature = 9;              // HMAC-SHA256
  int64 timestamp_ms = 10;          // Server time
}

enum AccessMode {
  UNKNOWN = 0;
  URI = 1;
  EMBED = 2;
  OPEN_WEB = 3;
}

enum Readiness {
  UNKNOWN = 0;
  PENDING = 1;
  READY = 2;
  DEGRADED = 3;
}`}
                    </pre>
                  </div>
                </Card>
              </section>

              {/* Handshake Schema */}
              <section className="space-y-6">
                <h2 className="text-xl md:text-2xl font-bold text-white">Handshake Request</h2>
                <Card className="bg-slate-900 border-white/10 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-white/10">
                    <FileCode className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">handshake.json</span>
                  </div>
                  <div className="overflow-x-auto">
                    <pre className="p-4 md:p-6 text-xs md:text-sm text-slate-300 min-w-max">
{`{
  "capabilities": {
    "hls": true,
    "dash": true,
    "epub": true,
    "pdf": true,
    "iframe": true,
    "webrtc": true,
    "drm": {
      "widevine": true,
      "fairplay": false,
      "playready": false
    },
    "codecs": {
      "h264": true,
      "h265": true,
      "vp9": true,
      "av1": false
    },
    "screen": {
      "width": 1920,
      "height": 1080,
      "dpr": 2
    }
  },
  "wallet": "0x...",        // Optional
  "resumeSessionId": "..."  // Optional
}`}
                    </pre>
                  </div>
                </Card>
              </section>

              {/* SSE Event Format */}
              <section className="space-y-6">
                <h2 className="text-xl md:text-2xl font-bold text-white">SSE Event Format</h2>
                <Card className="bg-slate-900 border-white/10 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/50 border-b border-white/10">
                    <Radio className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-300">Access Lane Events</span>
                  </div>
                  <div className="overflow-x-auto">
                    <pre className="p-4 md:p-6 text-xs md:text-sm text-slate-300 min-w-max">
{`event: connected
id: 1
data: {"sessionId":"...","laneType":"access","priority":100}

event: access
id: game-001
data: <base64-encoded-protobuf-frame>

event: access
id: video-002
data: <base64-encoded-protobuf-frame>`}
                    </pre>
                  </div>
                </Card>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Licensing Footer */}
      <footer className="py-8 text-center border-t border-white/5">
        <p className="text-xs text-slate-500">
          Atlas API 2.0 Protocol © 2025 P3 Protocol · Licensing terms pending
        </p>
      </footer>
    </div>
  );
}
