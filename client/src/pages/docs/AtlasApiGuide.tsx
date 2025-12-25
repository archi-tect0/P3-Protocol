import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Network, Zap, Code } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function AtlasApiGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Atlas API v2 Protocol Guide | P3 Protocol"
        description="Learn to implement the Atlas API v2 8-lane multiplexed protocol with dictionary compression, session handshake, and priority-scheduled SSE streaming."
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
            <a href="https://github.com/archi-tect0/P3-Protocol/tree/main/server/protocol" target="_blank" rel="noopener noreferrer">
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Atlas API v2 Protocol</h1>
              <p className="text-slate-400">8-Lane Multiplexed Transport with Dictionary Compression</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            Atlas API v2 is a session-native transport layer that fundamentally changes how data moves between client and server. 
            One handshake negotiates everything. One dictionary compresses everything. Eight lanes carry everything.
          </p>
        </div>

        <div className="space-y-8">
          {/* Core Concept */}
          <section className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-2xl border border-amber-500/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              The Core Innovation
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Traditional APIs repeat the same strings in every request and response: field names, category values, provider identifiers. 
                Atlas v2 replaces these with integers via a session-negotiated dictionary. Combined with MessagePack binary encoding and 
                8 parallel SSE lanes with priority scheduling, payloads shrink by 50-70% while enabling real-time streaming.
              </p>
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="bg-black/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400">25-35%</div>
                  <div className="text-xs text-slate-400">Dictionary compression (on top of MessagePack)</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400">1 Handshake</div>
                  <div className="text-xs text-slate-400">Negotiates encoding, transport, dictionary</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-400">8 Lanes</div>
                  <div className="text-xs text-slate-400">Parallel SSE with priority scheduling</div>
                </div>
              </div>
            </div>
          </section>

          {/* Step 1: Handshake */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 text-sm font-bold">1</span>
              Session Handshake
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 mb-4">
                Client and server negotiate capabilities once at session start. The handshake determines encoding format, 
                transport protocol, active lanes, and seeds the dictionary with client-specific tokens.
              </p>
              <div className="bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-2">// server/protocol/session/handshake-v2.ts</div>
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Client sends handshake request
POST /api/v2/handshake
Content-Type: application/json

{
  "transports": ["http3", "http1"],     // Preferred transports
  "encodings": ["protobuf", "msgpack", "json"],  // Supported encodings
  "lanes": [1, 2, 3, 4, 5, 6, 7, 8],     // Which lanes to subscribe
  "dictionaryTokens": ["netflix", "spotify", "rental"],  // Client-specific tokens
  "deviceInfo": {
    "platform": "web",
    "version": "1.0.0"
  }
}

// Server responds with negotiated session
{
  "sessionId": "sess_abc123",
  "expiresAt": 1703376000000,
  "transport": "http1",           // Negotiated transport
  "encoding": "msgpack",          // Negotiated encoding
  "lanes": {
    "access": "/api/v2/lanes/1/sse",
    "manifests": "/api/v2/lanes/2/sse",
    "receipts": "/api/v2/lanes/3/sse",
    "media": "/api/v2/lanes/4/sse",
    "commerce": "/api/v2/lanes/5/sse",
    "governance": "/api/v2/lanes/6/sse",
    "notifications": "/api/v2/lanes/7/sse",
    "chat": "/api/v2/lanes/8/sse"
  },
  "dictionary": {
    "version": 1,
    "entries": {
      "video": 1, "ebook": 2, "game": 3, "audio": 4,
      "subscription": 5, "rental": 6, "purchase": 7,
      "netflix": 8, "spotify": 9, "thumbnail": 10,
      "description": 11, "category": 12, "provider": 13
      // ... 50+ pre-seeded common tokens
    }
  }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Step 2: Dictionary */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 text-sm font-bold">2</span>
              Dictionary Tokenization
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 mb-4">
                The dictionary maps common strings to integers. Negotiated once at handshake, reused across all payloads for the 
                entire session. A 12KB manifest can reference 1.2MB of content when detokenized.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mb-4">
                <div className="text-xs text-slate-500 mb-2">// server/protocol/encoding/dictionary.ts</div>
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`export interface TokenDictionary {
  version: number;
  tokens: Map<string, number>;    // string -> integer
  reverse: Map<number, string>;   // integer -> string
  nextId: number;
}

// Pre-populated with common values
const COMMON_CATEGORIES = [
  'game', 'video', 'ebook', 'audio', 'product', 'document', 'app', 
  'live_tv', 'movie', 'series', 'podcast', 'music', 'gallery'
];

const COMMON_PROVIDERS = [
  'steam', 'epic', 'gog', 'netflix', 'prime', 'disney', 'spotify',
  'kindle', 'audible', 'apple', 'youtube', 'twitch'
];

const COMMON_FIELDS = [
  'id', 'title', 'description', 'category', 'contentType', 'provider',
  'price', 'currency', 'rating', 'thumbnail', 'url', 'metadata'
];

export function createBaseDictionary(): TokenDictionary {
  const tokens = new Map<string, number>();
  const reverse = new Map<number, string>();
  let nextId = 1;
  
  const allCommon = [...COMMON_CATEGORIES, ...COMMON_PROVIDERS, ...COMMON_FIELDS];
  
  for (const value of allCommon) {
    tokens.set(value, nextId);
    reverse.set(nextId, value);
    nextId++;
  }
  
  return { version: 1, tokens, reverse, nextId };
}`}</code></pre>
              </div>
              <div className="bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-2">// How tokenization works</div>
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Before tokenization (JSON):
{
  "category": "video",
  "provider": "netflix",
  "contentType": "subscription",
  "title": "Stranger Things",
  "thumbnail": "https://..."
}

// After tokenization (sent over wire):
{
  "$12": 1,      // category -> video
  "$13": 8,      // provider -> netflix  
  "$14": 5,      // contentType -> subscription
  "$15": "Stranger Things",  // unique string, not tokenized
  "$10": "https://..."       // thumbnail url, not tokenized
}

// Keys prefixed with $ indicate tokenized field names
// Integer values indicate tokenized string values
// Result: 25-35% smaller on top of MessagePack binary encoding`}</code></pre>
              </div>
            </div>
          </section>

          {/* Step 3: 8 Lanes */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 text-sm font-bold">3</span>
              8-Lane Multiplexed Streaming
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 mb-4">
                Each lane is a dedicated SSE stream with its own priority. High-priority lanes get bandwidth first.
                All lanes share the session dictionary and encoding. No lane blocks another.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mb-4">
                <div className="text-xs text-slate-500 mb-2">// server/protocol/session/protocol.ts</div>
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`export enum LaneId {
  ACCESS = 1,         // Priority 100 - Auth, capabilities, decryption keys
  MANIFESTS = 2,      // Priority 90  - Content metadata, catalog items
  RECEIPTS = 3,       // Priority 80  - Audit trail, blockchain anchors
  MEDIA = 4,          // Priority 95  - Streaming chunks, real-time data
  COMMERCE = 5,       // Priority 85  - Cart, checkout, payments
  GOVERNANCE = 6,     // Priority 70  - Votes, proposals, policies
  NOTIFICATIONS = 7,  // Priority 75  - Push alerts, system messages
  CHAT = 8,           // Priority 85  - Real-time messaging, presence
}

export const LaneRegistry: Record<LaneId, LaneSpec> = {
  [LaneId.ACCESS]: {
    id: LaneId.ACCESS,
    name: 'access',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 100,  // Highest - auth must never wait
  },
  [LaneId.MEDIA]: {
    id: LaneId.MEDIA,
    name: 'media',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 95,   // Near-highest - streaming can't stutter
  },
  // ... other lanes
};`}</code></pre>
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">ACCESS</span>
                    <span className="text-xs text-slate-500">P100</span>
                  </div>
                  <p className="text-xs text-slate-400">Auth, capabilities, decryption keys</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">MEDIA</span>
                    <span className="text-xs text-slate-500">P95</span>
                  </div>
                  <p className="text-xs text-slate-400">Streaming chunks, real-time</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">MANIFESTS</span>
                    <span className="text-xs text-slate-500">P90</span>
                  </div>
                  <p className="text-xs text-slate-400">Content metadata, URLs</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">COMMERCE</span>
                    <span className="text-xs text-slate-500">P85</span>
                  </div>
                  <p className="text-xs text-slate-400">Cart, checkout, payments</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">CHAT</span>
                    <span className="text-xs text-slate-500">P85</span>
                  </div>
                  <p className="text-xs text-slate-400">Messaging, presence</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">RECEIPTS</span>
                    <span className="text-xs text-slate-500">P80</span>
                  </div>
                  <p className="text-xs text-slate-400">Audit trail, anchors</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">NOTIFICATIONS</span>
                    <span className="text-xs text-slate-500">P75</span>
                  </div>
                  <p className="text-xs text-slate-400">Push alerts, system</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-amber-400 font-bold text-sm">GOVERNANCE</span>
                    <span className="text-xs text-slate-500">P70</span>
                  </div>
                  <p className="text-xs text-slate-400">Votes, proposals</p>
                </div>
              </div>
            </div>
          </section>

          {/* Step 4: Client Integration */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 text-sm font-bold">4</span>
              Client Integration
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 mb-4">
                Connecting to Atlas v2 from a client. Handshake first, then subscribe to lanes.
              </p>
              <div className="bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-2">// client/src/lib/atlasV2Client.ts</div>
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import { decode } from '@msgpack/msgpack';

interface AtlasSession {
  sessionId: string;
  dictionary: TokenDictionary;
  lanes: Record<string, string>;
}

class AtlasV2Client {
  private session: AtlasSession | null = null;
  private laneConnections = new Map<string, EventSource>();

  async connect(walletAddress: string): Promise<void> {
    // Step 1: Handshake
    const response = await fetch('/api/v2/handshake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transports: ['http1'],
        encodings: ['msgpack', 'json'],
        lanes: [1, 2, 3, 4, 5, 6, 7, 8],
        dictionaryTokens: ['myapp', 'custom'],
        walletAddress
      })
    });
    
    this.session = await response.json();
    
    // Step 2: Subscribe to lanes
    this.subscribeLane('access');
    this.subscribeLane('manifests');
    this.subscribeLane('notifications');
  }

  private subscribeLane(laneName: string): void {
    if (!this.session) throw new Error('Not connected');
    
    const url = this.session.lanes[laneName];
    const es = new EventSource(url);
    
    es.onmessage = (event) => {
      // Decode MessagePack + detokenize
      const raw = decode(base64ToUint8Array(event.data));
      const payload = this.detokenize(raw);
      this.handleLaneMessage(laneName, payload);
    };
    
    this.laneConnections.set(laneName, es);
  }

  private detokenize(obj: unknown): unknown {
    if (!this.session) return obj;
    const dict = this.session.dictionary;
    
    if (typeof obj === 'number' && obj < 256) {
      return dict.reverse.get(obj) || obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.detokenize(item));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        let newKey = key;
        if (key.startsWith('$')) {
          const tokenId = parseInt(key.slice(1), 10);
          newKey = dict.reverse.get(tokenId) || key;
        }
        result[newKey] = this.detokenize(value);
      }
      return result;
    }
    return obj;
  }

  private handleLaneMessage(lane: string, payload: unknown): void {
    console.log(\`[\${lane}]\`, payload);
    // Dispatch to appropriate handler
  }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Step 5: Priority Scheduler */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center text-amber-400 text-sm font-bold">5</span>
              Focus-Aware Priority Scheduler
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 mb-4">
                The server tracks which lane the client is "focused" on (e.g., watching video = MEDIA lane focus).
                Focused lanes get priority even if their base priority is lower.
              </p>
              <div className="bg-slate-900 rounded-xl p-4">
                <div className="text-xs text-slate-500 mb-2">// server/protocol/session/priority.ts</div>
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`interface QueuedMessage {
  lane: LaneId;
  payload: Uint8Array;
  timestamp: number;
}

export class PriorityScheduler {
  private queues = new Map<LaneId, QueuedMessage[]>();
  private focusedLane: LaneId | null = null;
  
  setFocus(lane: LaneId): void {
    this.focusedLane = lane;
  }

  enqueue(lane: LaneId, payload: Uint8Array): void {
    const queue = this.queues.get(lane) || [];
    queue.push({ lane, payload, timestamp: Date.now() });
    this.queues.set(lane, queue);
  }

  // Get next message respecting priorities
  dequeue(): QueuedMessage | null {
    // Focused lane always wins if it has messages
    if (this.focusedLane) {
      const focusQueue = this.queues.get(this.focusedLane);
      if (focusQueue?.length) {
        return focusQueue.shift()!;
      }
    }
    
    // Otherwise, use base priority
    const sortedLanes = Array.from(this.queues.entries())
      .filter(([_, queue]) => queue.length > 0)
      .sort(([a], [b]) => {
        return LaneRegistry[b].priority - LaneRegistry[a].priority;
      });
    
    if (sortedLanes.length === 0) return null;
    
    const [lane, queue] = sortedLanes[0];
    return queue.shift()!;
  }
}

// Client tells server what it's focused on
// POST /api/v2/focus
// { "sessionId": "sess_abc", "lane": "media" }`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-amber-400" />
              Key Implementation Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/protocol/session/protocol.ts</code>
                <span className="text-xs text-slate-500">Lane definitions, encoding types</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/protocol/session/handshake-v2.ts</code>
                <span className="text-xs text-slate-500">Session negotiation</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/protocol/encoding/dictionary.ts</code>
                <span className="text-xs text-slate-500">Token dictionary management</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/protocol/encoding/codecs.ts</code>
                <span className="text-xs text-slate-500">MessagePack/Protobuf codecs</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/protocol/session/priority.ts</code>
                <span className="text-xs text-slate-500">Focus-aware scheduler</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/protocol/wire.ts</code>
                <span className="text-xs text-slate-500">Binary frame encoding</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/encryption">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Encryption
            </Button>
          </Link>
          <Link href="/docs/nexus">
            <Button className="bg-gradient-to-r from-amber-500 to-orange-500">
              Next: Nexus Messaging
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
