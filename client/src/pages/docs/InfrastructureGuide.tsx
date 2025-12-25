import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Database, Server, HardDrive, Cloud, Zap, Shield, Code } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function InfrastructureGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO
        title="Infrastructure & Integrations - P3 Protocol Docs"
        description="Redis caching, IPFS/Pinata storage, and infrastructure integrations for P3 Protocol."
      />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-white/20">
              <SiGithub className="w-4 h-4 mr-2" />
              View Source
            </Button>
          </a>
        </div>

        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
              <Server className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">Infrastructure & Integrations</h1>
              <p className="text-slate-400">Redis, IPFS/Pinata, and core platform services</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            P3 Protocol's infrastructure layer provides high-performance caching, decentralized storage,
            and real-time communication. These services are used across all platform components.
          </p>
        </div>

        <div className="space-y-8">
          {/* Redis Section */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-red-400" />
              Redis: Caching & Pub/Sub
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Redis provides session caching, real-time pub/sub for WebSocket fan-out, and rate limiting.
                The system supports both standalone and cluster modes with automatic failover.
              </p>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    8-Shard Pub/Sub
                  </h4>
                  <p className="text-sm text-slate-400">
                    WebSocket messages are distributed across 8 shards for horizontal scaling.
                    Room IDs are hashed to determine shard assignment.
                  </p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    Automatic Failover
                  </h4>
                  <p className="text-sm text-slate-400">
                    Exponential backoff retry strategy with max 10 attempts.
                    Cluster mode supports read replicas for scaling.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/redis/client.ts - Connection setup

import Redis, { Cluster } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const baseOptions = {
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
};

// Standalone mode
const client = new Redis(REDIS_URL, baseOptions);

// Cluster mode (when REDIS_CLUSTER_NODES is set)
const cluster = new Redis.Cluster(nodes, {
  clusterRetryStrategy: retryStrategy,
  scaleReads: 'slave', // Read from replicas
});`}</code></pre>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/redis/pubsub.ts - 8-Shard WebSocket fan-out

const NUM_SHARDS = parseInt(process.env.REDIS_SHARD_COUNT || '8', 10);

function hashRoomToShard(roomId: string): number {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    const char = roomId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
  }
  return Math.abs(hash) % NUM_SHARDS;
}

// Publish to sharded channel
export async function publish(roomId: string, payload: unknown): Promise<void> {
  const channel = \`\${REGION_PREFIX}:signal:shard:\${hashRoomToShard(roomId)}\`;
  await publisher.publish(channel, JSON.stringify({
    roomId,
    payload,
    timestamp: Date.now(),
  }));
}

// Subscribe to all shards
const channels = Array.from({ length: NUM_SHARDS }, (_, i) =>
  \`\${REGION_PREFIX}:signal:shard:\${i}\`
);
await subscriber.subscribe(...channels);`}</code></pre>
              </div>
            </div>
          </section>

          {/* IPFS/Pinata Section */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-cyan-400" />
              IPFS via Pinata: Decentralized Storage
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                IPFS provides content-addressed storage for files, media, and JSON data.
                Pinata handles pinning to ensure content availability. The service gracefully
                degrades when not configured.
              </p>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mt-4">
                <h4 className="font-semibold text-amber-400 mb-2">Environment Variables</h4>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li><code className="text-cyan-400">PINATA_JWT</code> - JWT token for Pinata API authentication</li>
                  <li><code className="text-cyan-400">PINATA_GATEWAY</code> - Custom gateway URL (optional)</li>
                </ul>
              </div>

              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/services/ipfs.ts - IPFSService

import { PinataSDK } from "pinata";

export interface IPFSUploadResult {
  success: boolean;
  cid?: string;           // Content ID (hash)
  gatewayUrl?: string;    // Public access URL
  error?: string;
}

export class IPFSService {
  private pinata: PinataSDK | null = null;

  constructor() {
    if (process.env.PINATA_JWT) {
      this.pinata = new PinataSDK({
        pinataJwt: process.env.PINATA_JWT,
      });
    }
  }

  // Upload a file (video, image, document)
  async uploadFile(
    file: Buffer,
    options?: { name?: string; metadata?: Record<string, any> }
  ): Promise<IPFSUploadResult> {
    const fileToUpload = new File([file], options?.name || "file");
    
    let builder = this.pinata!.upload.public.file(fileToUpload);
    if (options?.name) builder = builder.name(options.name);
    if (options?.metadata) builder = builder.keyvalues(options.metadata);
    
    const result = await builder;
    return {
      success: true,
      cid: result.cid,
      gatewayUrl: this.getGatewayUrl(result.cid),
    };
  }

  // Upload JSON data
  async uploadJSON(
    data: any,
    options?: { name?: string }
  ): Promise<IPFSUploadResult> {
    const result = await this.pinata!.upload.public.json(data);
    return {
      success: true,
      cid: result.cid,
      gatewayUrl: this.getGatewayUrl(result.cid),
    };
  }

  // Get gateway URL for a CID
  getGatewayUrl(cid: string): string {
    const gateway = process.env.PINATA_GATEWAY 
      || 'https://gateway.pinata.cloud/ipfs';
    return \`\${gateway}/\${cid}\`;
  }
}`}</code></pre>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Use Cases</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Message attachment storage</li>
                    <li>Media file hosting (video, audio)</li>
                    <li>JSON metadata anchoring</li>
                    <li>NFT asset storage</li>
                    <li>Document backup</li>
                  </ul>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Graceful Degradation</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Returns error result when unconfigured</li>
                    <li>Logs warnings for missing JWT</li>
                    <li>Never throws - always returns result object</li>
                    <li>Supports grouping for organization</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Usage Patterns */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-violet-400" />
              Integration Patterns
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="bg-slate-900 rounded-xl p-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Example: Using IPFS for message attachments

import { ipfsService } from '../services/ipfs';

async function uploadAttachment(file: Buffer, filename: string) {
  const result = await ipfsService.uploadFile(file, {
    name: filename,
    metadata: { 
      uploadedBy: walletAddress,
      timestamp: Date.now().toString()
    }
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  return {
    cid: result.cid,
    url: result.gatewayUrl,
  };
}

// Example: Using Redis for session caching

import { getRedis } from '../redis/client';

async function cacheSession(wallet: string, data: object) {
  const redis = getRedis();
  await redis.setex(
    \`session:\${wallet}\`,
    3600, // 1 hour TTL
    JSON.stringify(data)
  );
}

async function getSession(wallet: string) {
  const redis = getRedis();
  const data = await redis.get(\`session:\${wallet}\`);
  return data ? JSON.parse(data) : null;
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-emerald-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-red-400">server/redis/client.ts</code>
                <span className="text-xs text-slate-500">Redis connection</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-red-400">server/redis/pubsub.ts</code>
                <span className="text-xs text-slate-500">8-shard pub/sub</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">server/services/ipfs.ts</code>
                <span className="text-xs text-slate-500">IPFS/Pinata service</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">client/src/lib/ipfs.ts</code>
                <span className="text-xs text-slate-500">Client IPFS helpers</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/nexus">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Nexus Messaging
            </Button>
          </Link>
          <Link href="/docs/cross-chain">
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500">
              Next: Cross-Chain Settlement
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
