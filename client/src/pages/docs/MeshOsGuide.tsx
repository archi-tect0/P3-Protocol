import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Network, Radio, Database, Shield, Wifi, HardDrive, Users, Activity, Globe, Zap, Layers } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function MeshOsGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Mesh OS & Node Mode Implementation Guide | P3 Protocol"
        description="Learn how to implement decentralized node relay networks, content caching, bandwidth reduction, and peer-to-peer mesh architecture."
      />
      
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <a href="https://github.com/p3-protocol/p3-protocol/blob/main/client/src/components/atlas/modes/NodeMode.tsx" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-white/20">
                <SiGithub className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Mesh OS & Node Mode</h1>
              <p className="text-slate-400">Decentralized Content Relay & Peer Caching</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            Node Mode transforms P3 clients into mesh network participants. Each node can relay content, cache streams, and reduce bandwidth load on origin servers. This creates a resilient, decentralized content delivery network anchored by wallet identity.
          </p>
        </div>

        <div className="space-y-8">
          {/* Architecture Overview */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" />
              Mesh Architecture
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The mesh OS operates on three task types: <strong>validation</strong> (verify content integrity), <strong>relay</strong> (forward streams to peers), and <strong>cache</strong> (store content locally for faster delivery).
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <Shield className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white mb-1">Validation</h4>
                  <p className="text-xs text-slate-400">Verify content hashes and signatures</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <Radio className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white mb-1">Relay</h4>
                  <p className="text-xs text-slate-400">Forward streams to nearby peers</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 text-center">
                  <Database className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <h4 className="font-semibold text-white mb-1">Cache</h4>
                  <p className="text-xs text-slate-400">Store content for local delivery</p>
                </div>
              </div>
            </div>
          </section>

          {/* Node Task Types */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Node Task Interface
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Each node processes tasks with tracked status and metadata. From <code>client/src/components/atlas/modes/NodeMode.tsx</code>:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`interface NodeTask {
  id: string;
  type: 'validation' | 'relay' | 'cache';
  description: string;
  timestamp: number;
  status: 'completed' | 'pending' | 'failed';
  details?: {
    headline?: string;   // Content title
    source?: string;     // Origin server
    bytes?: number;      // Data size
    peers?: number;      // Connected peers
    hash?: string;       // Content hash
  };
}

interface MeshActivity {
  id: string;
  type: 'tv' | 'radio' | 'cache' | 'relay' | 'analytics';
  message: string;
  timestamp: number;
  status: 'active' | 'completed';
}

interface NodeMetrics {
  tasksCompleted: {
    validation: number;
    relay: number;
    cache: number;
  };
  bandwidthSaved: number;      // Bytes saved for origin
  peersConnected: number;       // Active peer connections
  contributionLevel: number;    // 0-100 contribution score
  bandwidthReduction: number;   // % reduction achieved
  activeStreams: number;        // Currently relaying
  contentServedToday: number;   // Bytes served
  uptimePercent: number;        // Node availability
  connectedUsers: number;       // Users served
  channelsCached: number;       // Cached channels
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Cross-Chain Bridge Relay */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              Cross-Chain Bridge Relay
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The bridge relay service enables receipts anchored on Base to be relayed to other chains (Polygon, Arbitrum, Optimism). From <code>server/bridge-routes.ts</code>:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import { BridgeRelayService } from '../packages/bridge/relay/service';
import { BridgeMonitor } from '../packages/bridge/monitor/index';

const relayReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  targetChains: z.array(z.enum(['polygon', 'arbitrum', 'optimism'])),
  metadata: z.record(z.any()).optional(),
});

// POST /api/bridge/relay - Relay receipt to target chains
router.post('/api/bridge/relay', authenticateJWT, requireRole('admin'), async (req, res) => {
  const data = relayReceiptSchema.parse(req.body);
  const receipt = await storage.getReceipt(data.receiptId);
  const docHash = receipt.contentHash;

  const jobs = await Promise.all(
    data.targetChains.map(async (targetChain) => {
      const job = await storage.createBridgeJob({
        receiptId: receipt.id,
        docHash,
        sourceChain: 'base',
        targetChain,
        status: 'pending',
        confirmations: 0,
        requiredConfirmations: getRequiredConfirmations(targetChain),
        attempts: 0,
        maxAttempts: 3,
        metadata: data.metadata || null,
      });

      // Status update callback for relay progress
      const updateJob = async (status: string, txHash?: string, error?: string) => {
        await storage.updateBridgeJob(job.id, {
          status: status as any,
          txHash: txHash || null,
          lastError: error || null,
          attempts: job.attempts + 1,
        });
      };

      // Async relay with retry and confirmation monitoring
      relayService.retryRelay({
        id: job.id,
        docHash,
        targetChain,
        receiptData: {
          type: receipt.type,
          subjectId: receipt.subjectId,
          contentHash: receipt.contentHash,
          proofBlob: receipt.proofBlob,
          immutableSeq: receipt.immutableSeq,  // Sequence for ordering
        },
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
      }, updateJob).then((result) => {
        if (result.success && result.txHash) {
          monitor.startPolling(docHash, targetChain, result.txHash, 
            async (confirmations, status) => {
              await storage.updateBridgeJob(job.id, {
                confirmations,
                status: status as any,
                confirmedAt: status === 'confirmed' ? new Date() : null,
              });
            });
        }
      });

      return job;
    })
  );
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* Bridge Status Monitoring */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-violet-400" />
              Bridge Status & Confirmation Polling
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The BridgeMonitor polls for transaction confirmations across target chains:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// GET /api/bridge/status/:docHash - Get cross-chain status
router.get('/api/bridge/status/:docHash', async (req, res) => {
  const { docHash } = req.params;
  const jobs = await storage.getBridgeJobsByDocHash(docHash);
  
  const status = await monitor.getCrossChainStatus(docHash, jobs);
  
  res.json(status);
  // Returns:
  // {
  //   docHash: "0x...",
  //   chains: {
  //     polygon: { status: "confirmed", txHash: "0x...", confirmations: 15 },
  //     arbitrum: { status: "pending", confirmations: 3 },
  //     optimism: { status: "failed", error: "Gas estimation failed" }
  //   }
  // }
});

// Unified receipt status with cross-chain info
router.get('/api/receipts/:hash', async (req, res) => {
  const receipt = await storage.getReceiptByHash(req.params.hash);
  const bridgeJobs = await storage.getBridgeJobsByDocHash(receipt.contentHash);
  
  const crossChainStatus = bridgeJobs.length > 0
    ? await monitor.getCrossChainStatus(receipt.contentHash, bridgeJobs)
    : null;

  res.json({ receipt, crossChainStatus });
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* Content Mesh Activities */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-amber-400" />
              Content Mesh Activity Types
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Nodes participate in various mesh activities tracked in real-time:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`const MESH_ACTIVITY_EMOJIS = {
  tv: '📺',        // TV stream relaying
  radio: '📻',     // Radio stream caching
  cache: '💾',     // Local content storage
  relay: '🌐',     // Peer-to-peer forwarding
  analytics: '📊', // Metrics reporting
};

// Example mesh activity log:
// 📺 Relaying CNN stream to 12 peers (2.3 MB/s)
// 📻 Cached KEXP radio (Seattle) - 156 MB
// 🌐 Forwarded Gutenberg ebook to 3 nodes
// 📊 Reported bandwidth metrics to coordinator

// Contribution scoring
function calculateContribution(metrics: NodeMetrics): number {
  const taskScore = metrics.tasksCompleted.validation * 1 
    + metrics.tasksCompleted.relay * 2 
    + metrics.tasksCompleted.cache * 1.5;
  const uptimeScore = metrics.uptimePercent;
  const bandwidthScore = metrics.bandwidthSaved / 1e9; // GB saved
  
  return Math.min(100, (taskScore * 0.4) + (uptimeScore * 0.3) + (bandwidthScore * 0.3));
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* NodeStream P2P Video */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-pink-400" />
              NodeStream: P2P Video Sharing
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                NodeStream enables wallet-anchored video creation and distribution. From <code>client/src/components/atlas/modes/NodeStreamMode.tsx</code>:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import type { DID } from '@shared/nodestream-types';

type NodeStreamView = 'feed' | 'recorder' | 'player' | 'bookmarks' | 'profile';

export default function NodeStreamMode() {
  const { pushReceipt } = useAtlasStore();
  const [view, setView] = useState<NodeStreamView>('feed');
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);

  const handlePlay = useCallback((streamId: string) => {
    setCurrentStreamId(streamId);
    setView('player');
    
    // Create auditable receipt for stream play
    pushReceipt({
      id: \`receipt-nodestream-play-\${Date.now()}\`,
      hash: \`0x\${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}\`,
      scope: 'atlas.render.nodestream.play',
      endpoint: \`/api/atlas/streaming/v2/nodestream/streams/\${streamId}\`,
      timestamp: Date.now()
    });
  }, [pushReceipt]);

  const handlePublished = useCallback(() => {
    setView('feed');
    pushReceipt({
      id: \`receipt-nodestream-publish-\${Date.now()}\`,
      hash: \`0x\${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}\`,
      scope: 'atlas.render.nodestream.publish',
      endpoint: '/api/atlas/streaming/v2/nodestream/streams',
      timestamp: Date.now()
    });
  }, [pushReceipt]);
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Key Implementation Files
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="grid gap-3">
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">client/src/components/atlas/modes/NodeMode.tsx</code>
                  <p className="text-xs text-slate-400 mt-1">Node Mode UI with task feed, metrics, and contribution tracking</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">client/src/components/atlas/modes/NodeStreamMode.tsx</code>
                  <p className="text-xs text-slate-400 mt-1">P2P video streaming with wallet-anchored creators</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/bridge-routes.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Cross-chain bridge relay API endpoints</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">packages/bridge/relay/service.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Bridge relay service with retry logic</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">packages/bridge/monitor/index.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Cross-chain confirmation polling and status</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-sm text-slate-500 text-center">
            P3 Protocol - Created by Jasyn Allois - Apache 2.0 License
          </p>
        </div>
      </div>
    </div>
  );
}
