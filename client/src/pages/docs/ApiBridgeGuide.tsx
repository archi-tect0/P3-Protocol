import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap, Network, Shield, Key, Layers, Globe, RefreshCw, Lock, Database } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function ApiBridgeGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="API-to-Atlas API v2 Bridge Implementation Guide | P3 Protocol"
        description="Learn how to implement the session-native API bridge that converts web traffic to Atlas API v2 format with OAuth vault, rate limiting, and credential isolation."
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
            <a href="https://github.com/p3-protocol/p3-protocol/blob/main/server/proxy/index.ts" target="_blank" rel="noopener noreferrer">
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
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">API-to-Atlas v2 Bridge</h1>
              <p className="text-slate-400">Session-Native Request Conversion Layer</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            The API bridge converts web traffic into Atlas API v2 session-native format. It handles OAuth token management, rate limiting, credential isolation, and provides a unified proxy interface for external services while keeping secrets server-side.
          </p>
        </div>

        <div className="space-y-8">
          {/* Architecture Overview */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Bridge Architecture
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The bridge sits between client requests and external APIs, ensuring credentials never reach the frontend:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Client/Atlas   │────▶│  API Bridge      │────▶│  External API   │
│  (No Secrets)   │     │  (Injects Creds) │     │  (Gmail, etc)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                        ┌──────┴──────┐
                        │  Vault      │
                        │  (Secrets)  │
                        └─────────────┘

Flow:
1. Client sends wallet address + action + params
2. Bridge looks up OAuth token from vault
3. Bridge injects credentials, calls external API
4. Bridge returns data with rate limit info
5. Client never sees actual tokens`}</code></pre>
              </div>
            </div>
          </section>

          {/* Proxy Request/Response */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              Proxy Interface
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                From <code>server/proxy/index.ts</code>, the unified request/response format:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`interface ProxyRequest {
  wallet: string;           // Wallet address (identity)
  action: string;           // What to do (e.g., 'compose', 'send')
  params: Record<string, any>; // Action-specific parameters
}

interface ProxyResponse {
  ok: boolean;              // Success flag
  data?: any;               // Response data
  error?: string;           // Error message if failed
  requiresAuth?: boolean;   // True if OAuth needed
  authUrl?: string;         // Where to connect the app
  rateLimit?: {
    remaining: number;      // Calls left in window
    limit: number;          // Total allowed
    resetAt: number;        // When limit resets
  };
}

// Example: Gmail compose
// Request:  { wallet: "0x...", action: "compose", params: { to, subject, body } }
// Response: { ok: true, data: { draftId: "...", message: "Draft created" } }`}</code></pre>
              </div>
            </div>
          </section>

          {/* OAuth Vault Token Management */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-violet-400" />
              OAuth Vault Token Management
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Tokens are stored in a server-side vault keyed by wallet + connector:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import { getOAuthToken, hasOAuthToken } from '../atlas/services/vault';
import { ensureFreshToken, getValidToken } from './refresh';

async function getVaultToken(
  wallet: string, 
  connectorId: string
): Promise<{ token: string | null; error?: string }> {
  // Try stored token first
  const storedToken = getOAuthToken(wallet, connectorId);
  if (storedToken) {
    return { token: storedToken };
  }
  
  // Attempt refresh if we have refresh token
  try {
    const token = await ensureFreshToken(wallet, connectorId, connectorId);
    return { token };
  } catch (error) {
    // Check if app is connected (user authorized but token expired)
    if (isAppConnected(wallet, connectorId)) {
      return { token: \`mock-token-\${connectorId}-\${Date.now()}\` };
    }
    
    // Dev mode fallback
    if (process.env.NODE_ENV === 'development' || 
        process.env.PROXY_DEV_MODE === 'true') {
      return { token: \`dev-token-\${connectorId}\` };
    }
    
    return { token: null, error: (error as Error).message };
  }
}

// Track connected apps per wallet
const connectedAppsCache: Map<string, Set<string>> = new Map();

export function registerConnectedApp(wallet: string, appId: string): void {
  if (!connectedAppsCache.has(wallet)) {
    connectedAppsCache.set(wallet, new Set());
  }
  connectedAppsCache.get(wallet)!.add(appId);
}

export function isAppConnected(wallet: string, appId: string): boolean {
  return connectedAppsCache.get(wallet)?.has(appId) ?? false;
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Rate Limiting */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-400" />
              Rate Limiting
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Each connector has its own rate limit pool to prevent abuse:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import { applyRateLimit, getRateLimitStatus } from './rateLimit';

// Apply rate limiting middleware
router.post('/gmail/compose', applyRateLimit('google'), async (req, res) => {
  const { wallet, params } = req.body as ProxyRequest;
  
  const { token, error } = await getVaultToken(wallet, 'gmail');
  if (!token) {
    res.json({
      ok: false,
      requiresAuth: true,
      error: error || 'Gmail not connected. Please connect Gmail in the Flows tab.',
      authUrl: '/app?tab=flows'
    } as ProxyResponse);
    return;
  }
  
  const { to, subject, body } = params;
  
  // Call external API with server-side credentials
  // const result = await gmailApi.createDraft(token, { to, subject, body });
  
  res.json({
    ok: true,
    data: {
      action: 'compose',
      to,
      subject,
      body,
      draftId: \`draft-\${Date.now()}\`,
      message: \`Email draft created for \${to}\`
    },
    rateLimit: getRateLimitStatus('google', wallet)  // Include limit info
  } as ProxyResponse);
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* Atlas Session Bridge Integration */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-pink-400" />
              Atlas Session Bridge Integration
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The Atlas routes integrate session management with the proxy layer. From <code>server/atlas/routes.ts</code>:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import { 
  startSession as bridgeStartSession, 
  connectApps, 
  getSession as bridgeGetSession,
  refreshSession,
  endSession,
  getAvailableEndpoints,
  sanitizeSession,
  validateSessionToken
} from './services/sessionBridge';

// Session-native endpoints
router.use('/devkit', optionalAtlasAuth, devkitRouter);
router.use('/memory', optionalAtlasAuth, memoryRouter);
router.use('/voice', optionalAtlasAuth, voiceRouter);
router.use('/launcher', optionalAtlasAuth, launcherRouter);
router.use('/meta', metaAdapterRouter);
router.use('/canvas', canvasRouter);
router.use('/streaming', streamingRouter);

// Vault integration for developer keys
import { 
  setVaultSecret, 
  getVaultSecret, 
  deleteVaultSecret, 
  hasVaultSecret, 
  listVaultSecrets,
  setDeveloperKey,
  getDeveloperKey,
  getConfiguredProviders,
  getConnectedOAuthApps,
  validateProviderKey
} from './services/vault';

// Intent-to-flow mapping with session context
import { composeFlow, composeFlowWithAI, validateFlowAgainstSession } from './services/flowComposer';`}</code></pre>
              </div>
            </div>
          </section>

          {/* External App Handshake */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              External App Handshake
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                When connecting external apps, the bridge performs a handshake to verify OAuth tokens:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import { handshakeForApp, getAllAppHandshakes } from './services/appHandshake';

// Handshake flow:
// 1. User initiates OAuth for Gmail/Calendar/etc
// 2. OAuth callback stores tokens in vault
// 3. handshakeForApp verifies token validity
// 4. registerConnectedApp marks app as available
// 5. Future proxy calls use stored credentials

// Session includes connected apps
interface Session {
  wallet: string;
  token: string;
  roles: string[];
  connectedApps: string[];  // ['gmail', 'calendar', 'slack']
  createdAt: number;
  expiresAt: number;
}

// Validate session has app access before proxy call
async function validateAppAccess(
  session: Session, 
  appId: string
): Promise<boolean> {
  if (!session.connectedApps.includes(appId)) {
    return false;
  }
  const token = await getVaultToken(session.wallet, appId);
  return token.token !== null;
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Credential Isolation */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-400" />
              Credential Isolation Principle
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The bridge enforces strict credential isolation - API keys and OAuth tokens never reach client code:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// ❌ NEVER DO THIS - Client-side API call
// const response = await fetch('https://api.gmail.com/v1/drafts', {
//   headers: { 'Authorization': \`Bearer \${oauthToken}\` }  // Token exposed!
// });

// ✅ CORRECT - Server-side proxy
// Client code:
const response = await fetch('/api/proxy/gmail/compose', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: session.wallet,
    action: 'compose',
    params: { to: 'alice@example.com', subject: 'Hello', body: '...' }
  })
});

// Server handles token injection:
// 1. Validates wallet matches session
// 2. Retrieves OAuth token from vault
// 3. Makes Gmail API call with token
// 4. Returns result without exposing token

// Benefits:
// - No secrets in browser devtools
// - Token refresh handled server-side
// - Centralized rate limiting
// - Audit trail of all API calls
// - Easy token rotation without client updates`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-yellow-400" />
              Key Implementation Files
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="grid gap-3">
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/proxy/index.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Main proxy router with Gmail, Calendar, Slack connectors</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/proxy/rateLimit.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Per-connector rate limiting with sliding window</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/proxy/refresh.ts</code>
                  <p className="text-xs text-slate-400 mt-1">OAuth token refresh logic</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/atlas/services/vault.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Secure credential storage and retrieval</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/atlas/services/sessionBridge.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Session management for API v2</p>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-emerald-400 text-sm">server/atlas/routes.ts</code>
                  <p className="text-xs text-slate-400 mt-1">Atlas API v2 route orchestration</p>
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
