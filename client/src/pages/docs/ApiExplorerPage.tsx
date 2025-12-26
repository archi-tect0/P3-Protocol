import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Play, Copy, Check, ChevronRight, ChevronDown,
  Globe, Lock, Wallet, Send, Anchor, MessageSquare, Radio,
  Database, Key, Shield, Zap, Terminal, Code2, ExternalLink
} from 'lucide-react';
import SEO from '@/components/SEO';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  category: string;
  auth: 'none' | 'session' | 'admin';
  params?: { name: string; type: string; required: boolean; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string }[];
  response: string;
  example?: string;
}

const apiEndpoints: ApiEndpoint[] = [
  {
    method: 'POST',
    path: '/api/atlas/session/start',
    description: 'Initialize a new session with wallet signature',
    category: 'Session Bridge',
    auth: 'none',
    body: [
      { name: 'address', type: 'string', required: true, description: 'Wallet address (0x...)' },
      { name: 'signature', type: 'string', required: true, description: 'Signed challenge message' },
      { name: 'challenge', type: 'string', required: true, description: 'Original challenge string' }
    ],
    response: '{ "ok": true, "session": { "token": "...", "address": "0x...", "expiresAt": 1234567890 } }',
    example: `fetch('/api/atlas/session/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f...',
    signature: '0x...',
    challenge: 'Sign to connect to P3 Protocol: abc123'
  })
})`
  },
  {
    method: 'GET',
    path: '/api/atlas/session',
    description: 'Get current session details',
    category: 'Session Bridge',
    auth: 'session',
    response: '{ "ok": true, "session": { "address": "0x...", "connected": true } }'
  },
  {
    method: 'POST',
    path: '/api/atlas/session/refresh',
    description: 'Refresh session token before expiry',
    category: 'Session Bridge',
    auth: 'session',
    response: '{ "ok": true, "session": { "token": "...", "expiresAt": 1234567890 } }'
  },
  {
    method: 'POST',
    path: '/api/atlas/session/end',
    description: 'End session and invalidate token',
    category: 'Session Bridge',
    auth: 'session',
    response: '{ "ok": true }'
  },
  {
    method: 'POST',
    path: '/api/messages',
    description: 'Send encrypted message to recipient',
    category: 'Nexus Messaging',
    auth: 'session',
    body: [
      { name: 'to', type: 'string', required: true, description: 'Recipient wallet address' },
      { name: 'content', type: 'string', required: true, description: 'Message content (encrypted client-side)' },
      { name: 'nonce', type: 'string', required: true, description: 'Encryption nonce' }
    ],
    response: '{ "ok": true, "message": { "id": "...", "timestamp": 1234567890 } }',
    example: `const encrypted = await P3.msgEncrypted('dm', {
  to: '0x742d35Cc6634...',
  content: 'Hello, Protocol 3!'
});`
  },
  {
    method: 'GET',
    path: '/api/messages/:address',
    description: 'Get message history with address',
    category: 'Nexus Messaging',
    auth: 'session',
    params: [
      { name: 'address', type: 'string', required: true, description: 'Peer wallet address' }
    ],
    response: '{ "ok": true, "messages": [...] }'
  },
  {
    method: 'POST',
    path: '/api/receipts',
    description: 'Anchor a cryptographic receipt on-chain',
    category: 'Blockchain Anchoring',
    auth: 'session',
    body: [
      { name: 'type', type: 'string', required: true, description: 'Receipt type (payment, message, action)' },
      { name: 'payload', type: 'object', required: true, description: 'Data to anchor' },
      { name: 'hash', type: 'string', required: true, description: 'SHA-256 hash of payload' }
    ],
    response: '{ "ok": true, "receipt": { "id": "...", "txHash": "0x...", "blockNumber": 12345 } }',
    example: `const receipt = await P3.proofs.publish({
  type: 'payment',
  amount: '0.1',
  recipient: '0x742d35Cc6634...'
});`
  },
  {
    method: 'GET',
    path: '/api/receipts/:id',
    description: 'Get receipt details and verification status',
    category: 'Blockchain Anchoring',
    auth: 'none',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Receipt ID' }
    ],
    response: '{ "ok": true, "receipt": { "verified": true, "txHash": "0x...", "payload": {...} } }'
  },
  {
    method: 'POST',
    path: '/api/atlas/intent',
    description: 'Parse natural language intent into structured action',
    category: 'Atlas API',
    auth: 'session',
    body: [
      { name: 'text', type: 'string', required: true, description: 'Natural language query' }
    ],
    response: '{ "ok": true, "intent": { "action": "send", "params": {...} } }',
    example: `const intent = await fetch('/api/atlas/intent', {
  method: 'POST',
  body: JSON.stringify({ text: 'Send 0.1 ETH to alice.eth' })
});`
  },
  {
    method: 'POST',
    path: '/api/atlas/flow',
    description: 'Execute multi-step flow pipeline',
    category: 'Atlas API',
    auth: 'session',
    body: [
      { name: 'steps', type: 'array', required: true, description: 'Array of flow steps' },
      { name: 'parallel', type: 'boolean', required: false, description: 'Execute in parallel' }
    ],
    response: '{ "ok": true, "results": [...], "completed": true }'
  },
  {
    method: 'GET',
    path: '/api/atlas/endpoints',
    description: 'List all registered API endpoints',
    category: 'Atlas API',
    auth: 'none',
    response: '{ "ok": true, "endpoints": [...] }'
  },
  {
    method: 'GET',
    path: '/api/atlas/metrics',
    description: 'Get real-time platform metrics',
    category: 'Observability',
    auth: 'admin',
    response: '{ "ok": true, "metrics": { "activeUsers": 42, "messagesPerSec": 100 } }'
  },
  {
    method: 'GET',
    path: '/api/atlas/health',
    description: 'Health check endpoint',
    category: 'Observability',
    auth: 'none',
    response: '{ "ok": true, "status": "healthy", "uptime": 123456 }'
  }
];

const categories = [...new Set(apiEndpoints.map(e => e.category))];

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const authBadges: Record<string, { label: string; color: string }> = {
  none: { label: 'Public', color: 'bg-slate-500/20 text-slate-400' },
  session: { label: 'Session', color: 'bg-violet-500/20 text-violet-400' },
  admin: { label: 'Admin', color: 'bg-amber-500/20 text-amber-400' }
};

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTry = async () => {
    setLoading(true);
    try {
      if (endpoint.method === 'GET' && endpoint.auth === 'none') {
        const res = await fetch(endpoint.path.replace(':id', 'test').replace(':address', '0x0'));
        const data = await res.json();
        setResponse(JSON.stringify(data, null, 2));
      } else {
        setResponse('// Requires authentication or POST body\n// Use the code example to test');
      }
    } catch (err) {
      setResponse(`// Error: ${err}`);
    }
    setLoading(false);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden" data-testid={`endpoint-${endpoint.path.replace(/[/:]/g, '-')}`}>
      <div 
        className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${methodColors[endpoint.method]}`}>
            {endpoint.method}
          </span>
          <code className="text-sm text-slate-200 font-mono flex-1">{endpoint.path}</code>
          <span className={`px-2 py-0.5 rounded text-xs ${authBadges[endpoint.auth].color}`}>
            {authBadges[endpoint.auth].label}
          </span>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
        <p className="text-sm text-slate-400 mt-2">{endpoint.description}</p>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/50 p-4 space-y-4">
          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Path Parameters</h4>
              <div className="space-y-2">
                {endpoint.params.map(p => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-violet-400 font-mono">{p.name}</code>
                    <span className="text-slate-500">({p.type})</span>
                    {p.required && <span className="text-red-400 text-xs">required</span>}
                    <span className="text-slate-400">- {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.body && endpoint.body.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Request Body</h4>
              <div className="space-y-2">
                {endpoint.body.map(p => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-cyan-400 font-mono">{p.name}</code>
                    <span className="text-slate-500">({p.type})</span>
                    {p.required && <span className="text-red-400 text-xs">required</span>}
                    <span className="text-slate-400">- {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Response</h4>
            <pre className="bg-slate-900 rounded p-3 text-xs text-slate-300 font-mono overflow-x-auto">
              {endpoint.response}
            </pre>
          </div>

          {endpoint.example && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase">Example</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(endpoint.example!)}
                  className="h-6 px-2 text-slate-400 hover:text-white"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <pre className="bg-slate-900 rounded p-3 text-xs text-emerald-400 font-mono overflow-x-auto">
                {endpoint.example}
              </pre>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTry}
              disabled={loading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              data-testid={`try-${endpoint.path.replace(/[/:]/g, '-')}`}
            >
              <Play className="w-3 h-3 mr-1" />
              {loading ? 'Testing...' : 'Try it'}
            </Button>
          </div>

          {response && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Live Response</h4>
              <pre className="bg-slate-900 rounded p-3 text-xs text-amber-400 font-mono overflow-x-auto max-h-48">
                {response}
              </pre>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ApiExplorerPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredEndpoints = apiEndpoints.filter(e => {
    const matchesSearch = search === '' || 
      e.path.toLowerCase().includes(search.toLowerCase()) ||
      e.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || e.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="API Explorer - P3 Protocol"
        description="Interactive API documentation for P3 Protocol. Test endpoints, view examples, and integrate with the mesh OS."
      />

      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <span className="text-slate-600">|</span>
              <h1 className="text-lg font-bold">API Explorer</h1>
              <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-xs text-emerald-400 font-mono">Interactive</span>
            </div>
            <div className="flex items-center gap-2">
              <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  <ExternalLink className="w-4 h-4 mr-1" />
                  GitHub
                </Button>
              </a>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">P3 Protocol API Reference</h2>
          <p className="text-slate-400">
            Explore and test all available endpoints. Public endpoints can be tested directly.
            Session-protected endpoints require wallet authentication.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search endpoints..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              data-testid="input-search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('all')}
              className={activeCategory === 'all' ? 'bg-violet-600 hover:bg-violet-700' : 'border-slate-600 text-slate-300'}
              data-testid="filter-all"
            >
              All
            </Button>
            {categories.map(cat => (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className={activeCategory === cat ? 'bg-violet-600 hover:bg-violet-700' : 'border-slate-600 text-slate-300'}
                data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {cat}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>{filteredEndpoints.length} endpoints</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" /> Session = wallet auth required
            </span>
          </div>
          
          {filteredEndpoints.map((endpoint, i) => (
            <EndpointCard key={i} endpoint={endpoint} />
          ))}
        </div>

        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border-violet-500/30 p-6">
          <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-violet-400" />
            Quick Integration
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Install the SDK for typed access to all endpoints:
          </p>
          <pre className="bg-slate-900 rounded p-4 text-sm font-mono overflow-x-auto">
            <span className="text-slate-500"># Clone and integrate</span>
            {'\n'}
            <span className="text-emerald-400">git clone</span> <span className="text-slate-300">https://github.com/archi-tect0/P3-Protocol.git</span>
            {'\n'}
            <span className="text-emerald-400">cd</span> <span className="text-slate-300">P3-Protocol && npm install</span>
            {'\n\n'}
            <span className="text-slate-500"># Or copy the SDK directly</span>
            {'\n'}
            <span className="text-emerald-400">cp -r</span> <span className="text-slate-300">packages/sdk ./your-project/</span>
          </pre>
          <div className="mt-4 flex gap-3">
            <Link href="/launcher/sdk">
              <Button variant="outline" size="sm" className="border-violet-500/50 text-violet-400 hover:bg-violet-500/10">
                View SDK Docs
              </Button>
            </Link>
            <Link href="/docs/atlas-api">
              <Button variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                Atlas API Guide
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
