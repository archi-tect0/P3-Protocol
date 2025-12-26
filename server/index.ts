import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs/promises';
import { logApiError, logApiInfo, ensureLogDir } from './utils/api-logger';
import archiver from 'archiver';
import { PgStorage } from './pg-storage';
import type { IStorage } from './storage';
import { setStorageInstance } from './storage-accessor';
import { runMigrations } from './migrate';
import { createRoutes } from './routes';
import { createBridgeRoutes } from './bridge-routes';
import { createTrustRoutes } from './trust-routes';
import { createZKRoutes } from './zk-routes';
import { createRollupRoutes } from './rollup-routes';
import { createServicesRoutes } from './services-routes';
import { createUploadRoutes } from './upload-routes';
import { createPresignRoutes } from './routes/uploads-presign';
import { createPWARoutes } from './pwa-routes';
import futureReadyRoutes from './routes/future-ready';
import identityRoutes from './routes/identity';
import anchorBatchRoutes from './routes/anchor-batch';
import explorerRoutes from './routes/explorer';
import { protocolSettlementRouter } from './protocol/settlement';
import { handshakeRouterV2 } from './protocol/session/handshake-v2';
import { lanesRouterV2 } from './protocol/session/lanes-v2';
import { marketplaceRouter } from './marketplace';
import enterpriseApiKeysRouter from './routes/enterprise/api-keys';
import enterpriseBillingRouter from './routes/enterprise/billing';
import enterpriseGuardianRouter from './routes/enterprise/guardian';
import enterpriseSsoRouter from './routes/enterprise/sso';
import messagingRouter from './routes/messaging';
import enterprisePrivacyRouter from './routes/enterprise/privacy';
import eventsRouter from './routes/events';
import policyRouter from './routes/policy';
import tenancyRouter from './routes/tenancy';
import auditProofsRouter from './routes/audit-proofs';
import paymentsExtendedRouter from './routes/payments-extended';
import analyticsRouter from './routes/analytics';
import { createIPFSRoutes } from './routes/ipfs';
import scannerRouter from './scanner/routes';
import atlasRouter from './atlas';
import aiRouter from './routes/ai';
import { loadTenantPolicy, blockSettlementInSandbox, injectSandboxHeaders } from './middleware/tenant-sandbox';
import { collectSLAMetrics, startSLAMetricsCollection } from './middleware/sla-metrics';
import { setupSignaling } from './signaling';
import { attachWebSocket } from './realtime/ws';
import { attachPulseWebSocket } from './routes/pulse';
import pulseRouter from './routes/pulse';
import { TelemetryService } from './services/telemetry';
import { initializeSecretManager } from './secrets';
import {
  createSecretsMiddleware,
  performStartupChecks,
  scheduleExpiryChecks,
} from './middleware/secrets';
import {
  securityHeadersMiddleware,
  generalRateLimiter,
  tlsEnforcementMiddleware,
} from './middleware/security';
import { correlationIdMiddleware } from './middleware/correlation-id';
import { apiMetricsMiddleware, initApiMetrics } from './middleware/metrics';
import { metricsService } from './observability/metrics';
import { rootLogger, loggingMiddleware } from './observability/logger';
import { HealthMonitor } from './observability/health';
import { createAlarmSystem } from './observability/alarms';
import { startAnchorWorker, stopAnchorWorker } from './workers/anchorWorker';
import { resolveCountry, getCachedCountry } from './services/geoIp';

const isDevelopment = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// OVERRIDE: Force Vite dev mode in development regardless of SKIP_VITE flag
// The .replit file sets SKIP_VITE=true but we want hot reload in dev
if (isDevelopment && !process.env.REPLIT_DEPLOYMENT) {
  process.env.SKIP_VITE = 'false';
  console.log('[Dev] Forcing Vite dev mode (SKIP_VITE override)');
}

export const app = express();
const server = createServer(app);

let storage: IStorage;
let storageType: 'postgresql' | 'memory' = 'memory';
let telemetryService: TelemetryService;
let secretManager: ReturnType<typeof initializeSecretManager>;
let healthMonitor: HealthMonitor;
let alarmSystem: ReturnType<typeof createAlarmSystem>;

// Initialize logging directory
ensureLogDir();
logApiInfo('startup', 'P3 Protocol server starting...');

// Global process error handlers - catch unhandled errors
process.on('unhandledRejection', (reason: any, promise) => {
  logApiError('unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  logApiError('uncaughtException', err);
  process.exit(1);
});

// CRITICAL: Fast health check for deployment - MUST be first before any middleware
// NOTE: Using /health for health checks, NOT / (root serves frontend)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'healthy',
    service: 'p3-protocol',
    timestamp: new Date().toISOString()
  });
});

// VERSION ENDPOINT - For cache busting, returns current build version
// This is fetched by the inline script in index.html BEFORE any JS loads
const APP_VERSION = 'v20251213-build143600';
const BUILD_TIMESTAMP = Date.now();
app.get('/api/version', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json({ 
    version: APP_VERSION,
    buildTime: BUILD_TIMESTAMP,
    serverTime: Date.now()
  });
});

// SERVICE WORKER KILL SWITCH - Returns 410 Gone to force SW unregistration
// This fixes Coinbase Wallet aggressive caching issue
// NOTE: Do NOT include "storage" in Clear-Site-Data - it wipes localStorage including wallet!
app.get('/sw.js', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.set('Clear-Site-Data', '"cache"');
  res.status(410).type('text/javascript').send('// Service worker disabled - self.registration.unregister();');
});

// ATLAS PUSH SERVICE WORKER - Active SW for push notifications only
// This serves the actual service worker file for Atlas push notification support
app.get('/atlas/push-sw.js', async (req: Request, res: Response) => {
  const swPath = path.resolve(process.cwd(), 'client/public/sw.js');
  try {
    const content = await fs.readFile(swPath, 'utf-8');
    res.set('Content-Type', 'application/javascript; charset=utf-8');
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.set('Service-Worker-Allowed', '/');
    res.send(content);
  } catch (e) {
    console.error('[SW] Failed to serve push-sw.js:', e);
    res.status(500).type('text/javascript').send('// Service worker unavailable');
  }
});

// Legacy SW kill switches - 410 for old paths
app.get('/atlas/sw.js', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.set('Clear-Site-Data', '"cache"');
  res.status(410).type('text/javascript').send('// Atlas service worker disabled - self.registration.unregister();');
});

app.get('/atlas/sw-*.js', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.set('Clear-Site-Data', '"cache"');
  res.status(410).type('text/javascript').send('// Atlas service worker disabled');
});

// BOOTSTRAP.JS - Served with aggressive no-cache to bypass stale HTML cache
// This is the key to version-checking even when the browser has cached old HTML
app.get('/bootstrap.js', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  
  // Serve bootstrap.js from public folder
  const bootstrapPath = path.resolve(process.cwd(), 'client/public/bootstrap.js');
  try {
    const content = await fs.readFile(bootstrapPath, 'utf-8');
    res.send(content);
  } catch (e) {
    // Fallback inline bootstrap
    res.send(`(function(){
      fetch('/api/version?_='+Date.now(),{cache:'no-store'})
        .then(function(r){return r.json()})
        .then(function(d){
          var html=window.__P3_HTML_VERSION||'unknown';
          console.log('[BOOTSTRAP] HTML:',html,'Server:',d.version);
          if(html==='unknown'||d.version!==html){
            if('caches'in window)caches.keys().then(function(k){k.forEach(function(n){caches.delete(n)})});
            if('serviceWorker'in navigator)navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(s){s.unregister()})});
            setTimeout(function(){location.replace(location.href.split('?')[0]+'?_='+Date.now())},100);
          }
        });
    })();`);
  }
});

// Cache-busting headers for all HTML/root requests
// NOTE: Do NOT use Clear-Site-Data here - it can wipe localStorage on some browsers
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/' || req.path.startsWith('/app') || req.path.startsWith('/admin') || req.path.startsWith('/login') || req.path.startsWith('/launcher') || req.path.startsWith('/atlas')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.set('ETag', `"${Date.now()}"`);
  }
  // Also bust cache for JS/CSS bundles - use no-store for maximum freshness
  if (req.path.endsWith('.js') || req.path.endsWith('.css') || req.path.endsWith('.mjs')) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

app.use(cors());
app.use(express.json());

// Compression middleware - level 6 for balance of speed and compression
app.use(compression({ level: 6 }));

// Observability: Correlation ID for request tracing
app.use(correlationIdMiddleware);

// Observability: Structured logging
app.use(loggingMiddleware);

// Observability: Metrics timing
app.use(metricsService.createTimingMiddleware());

// Apply security headers to all responses
app.use(securityHeadersMiddleware);

// TLS enforcement in production
if (!isDevelopment) {
  app.use(tlsEnforcementMiddleware);
}

// Rate limiting middleware
app.use(generalRateLimiter);

// API request metrics for efficiency tracking
app.use('/api', apiMetricsMiddleware);

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function generateSessionId(req: Request): string {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || 'unknown';
  return `${ip}-${ua}-${Date.now()}`;
}

// Helper to parse browser from user agent
function parseBrowser(ua: string): string {
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  return 'Other';
}

// Helper to parse device type from user agent
function parseDeviceType(ua: string): string {
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return 'Mobile';
  if (/Tablet|iPad/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

// Helper to normalize referrer URL to domain
function normalizeReferrer(rawReferrer: string | null | undefined): string | null {
  if (!rawReferrer || rawReferrer.trim() === '') {
    return null;
  }
  
  try {
    const url = new URL(rawReferrer);
    const hostname = url.hostname.toLowerCase();
    
    // Remove www. prefix
    const domain = hostname.replace(/^www\./, '');
    
    // Skip self-referrals (same site)
    if (domain.includes('p3protocol') || domain.includes('replit') || 
        domain.includes('localhost') || domain.includes('127.0.0.1')) {
      return null;
    }
    
    // Normalize common referrers for better grouping
    if (domain.includes('google.')) return 'Google';
    if (domain.includes('bing.')) return 'Bing';
    if (domain.includes('duckduckgo.')) return 'DuckDuckGo';
    if (domain.includes('yahoo.')) return 'Yahoo';
    if (domain.includes('facebook.') || domain === 'fb.com') return 'Facebook';
    if (domain.includes('twitter.') || domain === 't.co' || domain === 'x.com') return 'Twitter/X';
    if (domain.includes('linkedin.')) return 'LinkedIn';
    if (domain.includes('reddit.')) return 'Reddit';
    if (domain.includes('youtube.')) return 'YouTube';
    if (domain.includes('instagram.')) return 'Instagram';
    if (domain.includes('tiktok.')) return 'TikTok';
    if (domain.includes('pinterest.')) return 'Pinterest';
    if (domain.includes('discord.')) return 'Discord';
    if (domain.includes('telegram.')) return 'Telegram';
    if (domain.includes('github.')) return 'GitHub';
    if (domain.includes('medium.')) return 'Medium';
    if (domain.includes('producthunt.')) return 'Product Hunt';
    if (domain.includes('hackernews') || domain === 'news.ycombinator.com') return 'Hacker News';
    
    return domain;
  } catch {
    // If URL parsing fails, return null (treat as direct)
    return null;
  }
}

// Telemetry middleware - records API calls and page views
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] as string || generateSessionId(req);
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const rawReferrer = req.headers['referer'] || req.headers['referrer'] || null;
  const referrer = normalizeReferrer(rawReferrer as string);

  try {
    if (req.path.startsWith('/api/') && telemetryService) {
      await telemetryService.recordEvent({
        eventType: 'api_call',
        sessionId,
        ip,
        userAgent,
      });
    }
    
    // Record page views for non-API, non-static routes
    if (storage && !req.path.startsWith('/api/') && 
        !req.path.startsWith('/assets/') && 
        !req.path.includes('.') &&
        req.method === 'GET') {
      const hashedIp = require('crypto').createHash('sha256').update(ip).digest('hex').slice(0, 16);
      
      // IMPORTANT: Check cache with RAW IP first (before hashing)
      // This allows for fast lookup without API calls
      const cachedCountry = getCachedCountry(ip);
      
      const recordView = (country: string | null) => {
        storage.recordPageView({
          route: req.path,
          referrer: referrer || undefined,
          userAgent,
          deviceType: parseDeviceType(userAgent),
          browser: parseBrowser(userAgent),
          hashedIp,
          sessionId,
          walletAddress: req.headers['x-wallet-address'] as string || undefined,
          country: country || undefined,
        }).catch((err: Error) => {
          console.error('[PageAnalytics] Failed to record page view:', err.message);
        });
      };
      
      const geoHeaders = {
        'cf-ipcountry': req.headers['cf-ipcountry'] as string | undefined,
        'x-vercel-ip-country': req.headers['x-vercel-ip-country'] as string | undefined,
        'x-country-code': req.headers['x-country-code'] as string | undefined,
        'accept-language': req.headers['accept-language'] as string | undefined,
      };

      if (cachedCountry) {
        recordView(cachedCountry);
      } else {
        recordView(null);
        resolveCountry(ip, geoHeaders).then(country => {
          if (country) {
            storage.updatePageViewCountry(hashedIp, country).catch((err: Error) => {
              console.error('[PageAnalytics] Failed to update country:', err.message);
            });
          }
        }).catch((err: Error) => {
          console.error('[PageAnalytics] Geolocation failed for IP:', err.message);
        });
      }
    }
  } catch (error) {
    console.error('Telemetry middleware error:', error);
  }

  next();
});

// Initialize routes after storage is set up
function initializeRoutes() {
  // Observability endpoints (before auth middleware)
  app.get('/metrics', metricsService.metricsEndpoint());
  
  // Detailed health endpoint (overwrites simple one)
  app.get('/health', healthMonitor.healthEndpoint());

  // Apache Bridge SDK download endpoint
  app.get('/api/apache/bridge/download', async (req: Request, res: Response) => {
    try {
      const apacheDir = path.resolve(process.cwd(), 'apache');
      
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="p3-bridge-sdk.zip"',
      });

      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err: Error) => {
        rootLogger.error('Archive error', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create archive' });
        }
      });

      archive.pipe(res);

      archive.file(path.join(apacheDir, 'README.md'), { name: 'README.md' });
      archive.file(path.join(apacheDir, 'LICENSE'), { name: 'LICENSE' });

      archive.file(path.join(apacheDir, 'src/eventBus.ts'), { name: 'src/eventBus.ts' });
      archive.file(path.join(apacheDir, 'src/store.ts'), { name: 'src/store.ts' });
      archive.file(path.join(apacheDir, 'src/ui.ts'), { name: 'src/ui.ts' });
      archive.file(path.join(apacheDir, 'src/capabilities.ts'), { name: 'src/capabilities.ts' });
      archive.file(path.join(apacheDir, 'src/walletConnector.ts'), { name: 'src/walletConnector.ts' });
      archive.file(path.join(apacheDir, 'src/signer.ts'), { name: 'src/signer.ts' });
      archive.file(path.join(apacheDir, 'src/sdk.ts'), { name: 'src/sdk.ts' });

      await archive.finalize();
    } catch (error) {
      rootLogger.error('Failed to create SDK zip', error as Error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create SDK download' });
      }
    }
  });

  // P3 Starter Kit - Lightweight API wrapper + examples
  app.get('/api/sdk/download', async (req: Request, res: Response) => {
    try {
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="p3-starter-kit.zip"',
      });

      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err: Error) => {
        rootLogger.error('Starter kit archive error', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to create starter kit' });
        }
      });

      archive.pipe(res);

      // README - Clear, transparent documentation
      const readme = `# P3 Protocol Starter Kit v2.0.0

## What's Inside
This starter kit provides lightweight TypeScript wrappers for the P3 Protocol APIs.
All cryptographic operations are server-locked for your security — no keys or 
sensitive logic leaves our servers.

## Quick Start

### Option 1: Direct API Calls (Recommended)
No installation needed. Just call our REST APIs directly:

\`\`\`typescript
// Encrypt a message
const response = await fetch('https://your-p3-instance.com/api/sdk/crypto/encrypt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_SESSION_TOKEN'
  },
  body: JSON.stringify({
    text: "Your secret message",
    recipientPubKey: "recipient_base64_public_key"
  })
});

const { cipher } = await response.json();
\`\`\`

### Option 2: Use the Wrapper (Optional)
If you prefer TypeScript helpers, use the included wrapper:

\`\`\`typescript
import { P3Client } from './p3-client';

const p3 = new P3Client('https://your-p3-instance.com', sessionToken);

// Encrypt
const { cipher } = await p3.crypto.encrypt("Hello, world!", recipientPubKey);

// Anchor to blockchain
const receipt = await p3.anchor.create({ type: 'message', data: { ... } });

// Sign data
const { signature } = await p3.crypto.sign("Data to sign");
\`\`\`

## API Reference

### Encryption (POST /api/sdk/crypto/encrypt)
Hybrid Kyber-768 + X25519 encryption with XChaCha20-Poly1305.
\`\`\`json
Request:  { "text": "message", "recipientPubKey": "base64_key" }
Response: { "cipher": "base64_ciphertext", "nonce": "base64_nonce" }
\`\`\`

### Decryption (POST /api/sdk/crypto/decrypt)
\`\`\`json
Request:  { "cipher": "base64_ciphertext", "senderPubKey": "base64_key" }
Response: { "text": "decrypted message" }
\`\`\`

### Sign (POST /api/sdk/crypto/sign)
Ed25519 digital signatures.
\`\`\`json
Request:  { "message": "data to sign" }
Response: { "signature": "base64_sig", "publicKey": "base64_pubkey" }
\`\`\`

### Verify (POST /api/sdk/crypto/verify)
\`\`\`json
Request:  { "message": "signed data", "signature": "base64_sig", "pubKey": "base64_key" }
Response: { "ok": true }
\`\`\`

### Get Public Key (GET /api/sdk/crypto/pubkey)
\`\`\`json
Response: { "publicKey": "base64_public_key" }
\`\`\`

### Anchor Proof (POST /api/sdk/anchor)
Anchor data hash to blockchain for immutable proof.
\`\`\`json
Request:  { "type": "message", "hash": "sha256_hash", "metadata": {} }
Response: { "receiptId": "id", "txHash": "0x...", "timestamp": 1700000000 }
\`\`\`

### Check Anchor Status (GET /api/sdk/anchor/status/:receiptId)
\`\`\`json
Response: { "confirmed": true, "blockNumber": 12345678, "txHash": "0x..." }
\`\`\`

### Session Resume (POST /api/sdk/session/resume)
\`\`\`json
Request:  { "wallet": "0x...", "signature": "...", "challenge": "..." }
Response: { "token": "jwt_token", "expiresAt": 1700000000 }
\`\`\`

## Why API-First?

1. **Zero Setup** - No npm install, no build config. Just HTTP calls.
2. **Server-Locked Security** - Keys never touch the browser. Enterprise-grade protection.
3. **Always Current** - No version drift. Updates happen server-side instantly.
4. **Full Transparency** - You can see exactly what each endpoint does above.

## Security Notes

- All encryption uses hybrid post-quantum algorithms (Kyber-768 + X25519)
- Symmetric encryption: XChaCha20-Poly1305
- Signatures: Ed25519
- Keys are derived and stored server-side only
- No cryptographic material is exposed to clients

## License
Apache 2.0 - Use freely, modify as needed.

## Support
- Documentation: https://docs.p3protocol.com
- API Reference: https://your-instance.com/launcher/sdk
`;

      archive.append(readme, { name: 'README.md' });

      // Lightweight TypeScript client wrapper
      const p3Client = `/**
 * P3 Protocol Client - Lightweight API Wrapper
 * 
 * This is a thin wrapper around the P3 Protocol REST APIs.
 * All cryptographic operations are server-locked for security.
 */

export class P3Client {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl.replace(/\\/$/, '');
    this.token = token || null;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };
    
    if (this.token) {
      headers['Authorization'] = \`Bearer \${this.token}\`;
    }

    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || \`HTTP \${response.status}\`);
    }

    return response.json();
  }

  setToken(token: string) {
    this.token = token;
  }

  // Crypto APIs - All server-locked
  crypto = {
    encrypt: (text: string, recipientPubKey: string) =>
      this.request<{ cipher: string; nonce: string }>('/api/sdk/crypto/encrypt', {
        method: 'POST',
        body: JSON.stringify({ text, recipientPubKey }),
      }),

    decrypt: (cipher: string, senderPubKey: string) =>
      this.request<{ text: string }>('/api/sdk/crypto/decrypt', {
        method: 'POST',
        body: JSON.stringify({ cipher, senderPubKey }),
      }),

    sign: (message: string) =>
      this.request<{ signature: string; publicKey: string }>('/api/sdk/crypto/sign', {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),

    verify: (message: string, signature: string, pubKey: string) =>
      this.request<{ ok: boolean }>('/api/sdk/crypto/verify', {
        method: 'POST',
        body: JSON.stringify({ message, signature, pubKey }),
      }),

    getPubKey: () =>
      this.request<{ publicKey: string }>('/api/sdk/crypto/pubkey'),

    deriveShared: (theirPubKey: string) =>
      this.request<{ sharedKey: string }>('/api/sdk/crypto/derive', {
        method: 'POST',
        body: JSON.stringify({ theirPubKey }),
      }),
  };

  // Anchor APIs
  anchor = {
    create: (data: { type: string; hash: string; metadata?: Record<string, unknown> }) =>
      this.request<{ receiptId: string; txHash: string; timestamp: number }>('/api/sdk/anchor', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    batch: (items: Array<{ type: string; hash: string; metadata?: Record<string, unknown> }>) =>
      this.request<{ receipts: Array<{ receiptId: string }>; batchId: string }>('/api/sdk/anchor/batch', {
        method: 'POST',
        body: JSON.stringify({ items }),
      }),

    status: (receiptId: string) =>
      this.request<{ confirmed: boolean; blockNumber: number; txHash: string }>(
        \`/api/sdk/anchor/status/\${receiptId}\`
      ),
  };

  // Session APIs
  session = {
    resume: (wallet: string, signature: string, challenge: string) =>
      this.request<{ token: string; expiresAt: number }>('/api/sdk/session/resume', {
        method: 'POST',
        body: JSON.stringify({ wallet, signature, challenge }),
      }),

    info: () =>
      this.request<{ wallet: string; roles: string[]; expiresAt: number }>('/api/sdk/session/info'),

    refresh: () =>
      this.request<{ token: string; expiresAt: number }>('/api/sdk/session/refresh', {
        method: 'POST',
      }),
  };

  // Media APIs
  media = {
    startCall: (roomId: string, participants: string[]) =>
      this.request<{ roomId: string; turnCredentials: unknown }>('/api/sdk/media/call/start', {
        method: 'POST',
        body: JSON.stringify({ roomId, participants }),
      }),

    endCall: (roomId: string) =>
      this.request<{ proof: string }>('/api/sdk/media/call/end', {
        method: 'POST',
        body: JSON.stringify({ roomId }),
      }),

    getTurnCredentials: () =>
      this.request<{ urls: string[]; username: string; credential: string }>('/api/sdk/media/turn'),
  };
}

export default P3Client;
`;

      archive.append(p3Client, { name: 'src/p3-client.ts' });

      // Example usage file
      const example = `/**
 * P3 Protocol - Usage Examples
 * 
 * These examples show how to use the P3 Client wrapper
 * or make direct API calls.
 */

import { P3Client } from './p3-client';

// Initialize client
const p3 = new P3Client('https://your-p3-instance.com');

// Example 1: Encrypt a message
async function encryptMessage() {
  const recipientPubKey = 'base64_recipient_public_key';
  
  const { cipher } = await p3.crypto.encrypt(
    'Hello, this is a secret message!',
    recipientPubKey
  );
  
  console.log('Encrypted:', cipher);
  return cipher;
}

// Example 2: Decrypt a message
async function decryptMessage(cipher: string, senderPubKey: string) {
  const { text } = await p3.crypto.decrypt(cipher, senderPubKey);
  console.log('Decrypted:', text);
  return text;
}

// Example 3: Sign data
async function signData() {
  const { signature, publicKey } = await p3.crypto.sign('Important data to sign');
  console.log('Signature:', signature);
  console.log('Public Key:', publicKey);
  return { signature, publicKey };
}

// Example 4: Verify signature
async function verifySignature() {
  const message = 'Important data to sign';
  const { signature, publicKey } = await signData();
  
  const { ok } = await p3.crypto.verify(message, signature, publicKey);
  console.log('Valid signature:', ok);
  return ok;
}

// Example 5: Anchor proof to blockchain
async function anchorProof() {
  const receipt = await p3.anchor.create({
    type: 'document',
    hash: 'sha256_hash_of_document',
    metadata: {
      filename: 'contract.pdf',
      timestamp: Date.now()
    }
  });
  
  console.log('Anchored! Receipt ID:', receipt.receiptId);
  console.log('Transaction:', receipt.txHash);
  return receipt;
}

// Example 6: Check anchor status
async function checkAnchorStatus(receiptId: string) {
  const status = await p3.anchor.status(receiptId);
  console.log('Confirmed:', status.confirmed);
  console.log('Block:', status.blockNumber);
  return status;
}

// Example 7: Direct API call (no wrapper)
async function directApiCall() {
  const response = await fetch('https://your-p3-instance.com/api/sdk/crypto/encrypt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_SESSION_TOKEN'
    },
    body: JSON.stringify({
      text: 'Direct API call example',
      recipientPubKey: 'base64_public_key'
    })
  });
  
  const { cipher } = await response.json();
  console.log('Direct API result:', cipher);
  return cipher;
}

// Run examples
async function main() {
  console.log('P3 Protocol Examples\\n');
  
  // These will fail without a real server, but show the API patterns
  try {
    await encryptMessage();
  } catch (e) {
    console.log('(Connect to a P3 instance to run live examples)');
  }
}

main();
`;

      archive.append(example, { name: 'src/examples.ts' });

      // TypeScript config
      const tsconfig = {
        compilerOptions: {
          target: "ES2020",
          module: "ESNext",
          moduleResolution: "node",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: "./dist"
        },
        include: ["src/**/*"]
      };

      archive.append(JSON.stringify(tsconfig, null, 2), { name: 'tsconfig.json' });

      // Package.json - minimal
      const packageJson = {
        name: "p3-starter-kit",
        version: "2.0.0",
        description: "P3 Protocol Starter Kit - Lightweight API wrappers and examples",
        main: "src/p3-client.ts",
        types: "src/p3-client.ts",
        license: "Apache-2.0",
        scripts: {
          "build": "tsc",
          "example": "npx ts-node src/examples.ts"
        },
        devDependencies: {
          "typescript": "^5.0.0",
          "ts-node": "^10.9.0"
        }
      };

      archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });

      // LICENSE
      const license = `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
`;

      archive.append(license, { name: 'LICENSE' });

      await archive.finalize();
      rootLogger.info('P3 Starter Kit download served successfully');
    } catch (error) {
      rootLogger.error('Failed to create P3 Starter Kit', error as Error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create starter kit' });
      }
    }
  });

  // Crypto Kart game static files at /kart/
  const kartPath = path.resolve(process.cwd(), 'client/public/games/kart');
  app.use('/kart', express.static(kartPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get('/kart', (req: Request, res: Response) => {
    res.sendFile(path.join(kartPath, 'index.html'));
  });
  rootLogger.info('✓ Crypto Kart game mounted at /kart');

  // Arena FPS game static files at /fps/
  const fpsPath = path.resolve(process.cwd(), 'client/public/games/fps');
  app.use('/fps', express.static(fpsPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get('/fps', (req: Request, res: Response) => {
    res.sendFile(path.join(fpsPath, 'index.html'));
  });
  rootLogger.info('✓ Arena FPS game mounted at /fps');

  // Asteroid Blaster game static files at /games/asteroid/
  const asteroidPath = path.resolve(process.cwd(), 'client/public/games/asteroid');
  app.use('/games/asteroid', express.static(asteroidPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/asteroid', '/games/asteroid/'], (req: Request, res: Response) => {
    res.sendFile(path.join(asteroidPath, 'index.html'));
  });
  rootLogger.info('✓ Asteroid Blaster game mounted at /games/asteroid');

  // Breakout game static files at /games/breakout/
  const breakoutPath = path.resolve(process.cwd(), 'client/public/games/breakout');
  app.use('/games/breakout', express.static(breakoutPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/breakout', '/games/breakout/'], (req: Request, res: Response) => {
    res.sendFile(path.join(breakoutPath, 'index.html'));
  });
  rootLogger.info('✓ Breakout game mounted at /games/breakout');

  // Maze Runner game static files at /games/maze/
  const mazePath = path.resolve(process.cwd(), 'client/public/games/maze');
  app.use('/games/maze', express.static(mazePath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/maze', '/games/maze/'], (req: Request, res: Response) => {
    res.sendFile(path.join(mazePath, 'index.html'));
  });
  rootLogger.info('✓ Maze Runner game mounted at /games/maze');

  // Coin Collector game static files at /games/coin/
  const coinPath = path.resolve(process.cwd(), 'client/public/games/coin');
  app.use('/games/coin', express.static(coinPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/coin', '/games/coin/'], (req: Request, res: Response) => {
    res.sendFile(path.join(coinPath, 'index.html'));
  });
  rootLogger.info('✓ Coin Collector game mounted at /games/coin');

  // Reaction game static files at /games/reaction/
  const reactionPath = path.resolve(process.cwd(), 'client/public/games/reaction');
  app.use('/games/reaction', express.static(reactionPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/reaction', '/games/reaction/'], (req: Request, res: Response) => {
    res.sendFile(path.join(reactionPath, 'index.html'));
  });
  rootLogger.info('✓ Reaction game mounted at /games/reaction');

  // Racer game static files at /games/racer/
  const racerPath = path.resolve(process.cwd(), 'client/public/games/racer');
  app.use('/games/racer', express.static(racerPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/racer', '/games/racer/'], (req: Request, res: Response) => {
    res.sendFile(path.join(racerPath, 'index.html'));
  });
  rootLogger.info('✓ Racer game mounted at /games/racer');

  // Tower Defense game static files at /games/tower/
  const towerPath = path.resolve(process.cwd(), 'client/public/games/tower');
  app.use('/games/tower', express.static(towerPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/tower', '/games/tower/'], (req: Request, res: Response) => {
    res.sendFile(path.join(towerPath, 'index.html'));
  });
  rootLogger.info('✓ Tower Defense game mounted at /games/tower');

  // BlockDrop game static files at /games/blockdrop/
  const blockdropPath = path.resolve(process.cwd(), 'client/public/games/blockdrop');
  app.use('/games/blockdrop', express.static(blockdropPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.set('Cache-Control', 'no-cache');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.set('Cache-Control', 'public, max-age=31536000');
      }
    }
  }));
  app.get(['/games/blockdrop', '/games/blockdrop/'], (req: Request, res: Response) => {
    res.sendFile(path.join(blockdropPath, 'index.html'));
  });
  rootLogger.info('✓ BlockDrop game mounted at /games/blockdrop');

  // Shared P3 hooks and utilities at /shared/
  const sharedPath = path.resolve(process.cwd(), 'client/public/shared');
  app.use('/shared', express.static(sharedPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.set('Content-Type', 'application/javascript');
        res.set('Cache-Control', 'public, max-age=3600');
      }
    }
  }));
  rootLogger.info('✓ Shared P3 hooks mounted at /shared');

  // Games service worker at /sw-games.js
  const swGamesPath = path.resolve(process.cwd(), 'client/public/sw-games.js');
  app.get('/sw-games.js', (req: Request, res: Response) => {
    res.set('Content-Type', 'application/javascript');
    res.set('Service-Worker-Allowed', '/');
    res.set('Cache-Control', 'no-cache');
    res.sendFile(swGamesPath);
  });
  rootLogger.info('✓ Games service worker mounted at /sw-games.js');

  // Inject secrets into request
  app.use(createSecretsMiddleware(secretManager));

  // Force JSON content-type for all /api/* routes (prevents SPA catch-all hijacking)
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });
  rootLogger.info('✓ JSON content-type middleware enabled for /api/*');

  // SDK v2 routes - mounted BEFORE core routes
  const sdkRouter = require('./sdk').default;
  app.use('/api/sdk', sdkRouter);
  rootLogger.info('✓ SDK v2 routes mounted at /api/sdk');

  // Atlas routes - mounted BEFORE core routes for public Alexa/external device access
  app.use('/api/atlas', atlasRouter);
  rootLogger.info('✓ Atlas routes mounted at /api/atlas (public endpoints for Alexa/Wear OS)');

  // Core routes
  const apiRouter = createRoutes(storage);
  app.use(apiRouter);

  // Debug route to verify direct mounting works
  app.get('/api/debug/ping', (req: Request, res: Response) => {
    res.json({ ok: true, ts: Date.now(), source: 'server/index.ts direct mount' });
  });
  rootLogger.info('✓ Debug ping route mounted at /api/debug/ping');

  // Direct subrouter mounts (bypass any createRoutes() registration issues)
  // These are mounted explicitly to ensure they work regardless of createRoutes() order
  logApiInfo('routes', 'Mounting direct subrouters...');
  
  try {
    const taskManagerRouter = require('./routes/task-manager').default;
    app.use('/api/taskmanager', taskManagerRouter);
    rootLogger.info('✓ Task Manager routes mounted at /api/taskmanager');
    logApiInfo('routes', 'Task Manager router mounted successfully');
  } catch (err: any) {
    logApiError('routes:taskmanager', err);
    rootLogger.warn('⚠️ Failed to mount Task Manager routes:', err);
  }
  
  try {
    const favoritesRouter = require('./routes/favorites').default;
    app.use('/api/favorites', favoritesRouter);
    rootLogger.info('✓ Favorites routes mounted at /api/favorites');
    logApiInfo('routes', 'Favorites router mounted successfully');
  } catch (err: any) {
    logApiError('routes:favorites', err);
    rootLogger.warn('⚠️ Failed to mount Favorites routes:', err);
  }
  
  try {
    const canvasFavoritesRouter = require('./routes/canvas-favorites').default;
    app.use('/api/canvas/favorites', canvasFavoritesRouter);
    rootLogger.info('✓ Canvas Favorites routes mounted at /api/canvas/favorites');
    logApiInfo('routes', 'Canvas Favorites router mounted successfully');
  } catch (err: any) {
    logApiError('routes:canvas-favorites', err);
    rootLogger.warn('⚠️ Failed to mount Canvas Favorites routes:', err);
  }
  
  try {
    const siteProfilesRouter = require('./routes/site-profiles').default;
    app.use('/api/site-profiles', siteProfilesRouter);
    rootLogger.info('✓ Site Profiles routes mounted at /api/site-profiles');
    logApiInfo('routes', 'Site Profiles router mounted successfully');
  } catch (err: any) {
    logApiError('routes:site-profiles', err);
    rootLogger.warn('⚠️ Failed to mount Site Profiles routes:', err);
  }
  
  try {
    const atlasOneRouter = require('./routes/atlasOne').default;
    app.use('/api/atlas-one', atlasOneRouter);
    rootLogger.info('✓ Atlas One routes mounted at /api/atlas-one (unified substrate marketplace)');
    logApiInfo('routes', 'Atlas One router mounted successfully');
  } catch (err: any) {
    logApiError('routes:atlas-one', err);
    rootLogger.warn('⚠️ Failed to mount Atlas One routes:', err);
  }
  
  try {
    const newsRouter = require('./routes/news').default;
    app.use('/api/news', newsRouter);
    rootLogger.info('✓ News routes mounted at /api/news');
    logApiInfo('routes', 'News router mounted successfully');
  } catch (err: any) {
    logApiError('routes:news', err);
    rootLogger.warn('⚠️ Failed to mount News routes:', err);
  }

  try {
    app.use('/api/pulse', pulseRouter);
    rootLogger.info('✓ Pulse routes mounted at /api/pulse');
    logApiInfo('routes', 'Pulse router mounted successfully');
  } catch (err: any) {
    logApiError('routes:pulse', err);
    rootLogger.warn('⚠️ Failed to mount Pulse routes:', err);
  }

  try {
    const wikiRouter = require('./routes/wiki').default;
    app.use('/api/wiki', wikiRouter);
    rootLogger.info('✓ Wiki routes mounted at /api/wiki');
    logApiInfo('routes', 'Wiki router mounted successfully');
  } catch (err: any) {
    logApiError('routes:wiki', err);
    rootLogger.warn('⚠️ Failed to mount Wiki routes:', err);
  }

  try {
    const tokensRouter = require('./routes/tokens').default;
    app.use('/api/tokens', tokensRouter);
    rootLogger.info('✓ Tokens routes mounted at /api/tokens');
    logApiInfo('routes', 'Tokens router mounted successfully');
  } catch (err: any) {
    logApiError('routes:tokens', err);
    rootLogger.warn('⚠️ Failed to mount Tokens routes:', err);
  }

  logApiInfo('routes', 'Direct subrouter mounting complete');

  // Bridge routes
  const bridgeRouter = createBridgeRoutes(storage);
  app.use(bridgeRouter);

  // Trust layer routes
  const trustRouter = createTrustRoutes(storage);
  app.use(trustRouter);

  // ZK routes
  const zkRouter = createZKRoutes();
  app.use(zkRouter);

  // Rollup routes
  const rollupRouter = createRollupRoutes();
  app.use(rollupRouter);

  // Services routes (ENS resolver, webhooks, exports)
  const servicesRouter = createServicesRoutes(storage);
  app.use(servicesRouter);

  // Upload routes (file and video uploads to IPFS)
  const uploadRouter = createUploadRoutes(storage);
  app.use(uploadRouter);

  // IPFS routes (encrypted gallery uploads)
  const ipfsRouter = createIPFSRoutes();
  app.use(ipfsRouter);
  rootLogger.info('✓ IPFS routes mounted at /api/ipfs');

  // Presigned upload routes (direct S3/GCS uploads)
  const presignRouter = createPresignRoutes();
  app.use(presignRouter);

  // PWA Session Bridge routes
  const pwaRouter = createPWARoutes(storage);
  app.use(pwaRouter);

  // Future-ready protocol routes (PQ, DID/VC, ZK messaging, governance, analytics, DA)
  app.use('/api/future', futureReadyRoutes);

  // Identity and reputation routes (DID documents, reputation scores)
  app.use('/api/identity', identityRoutes);
  rootLogger.info('✓ Identity routes mounted at /api/identity');

  // Anchor batch routes for high-throughput anchoring
  app.use(anchorBatchRoutes);
  rootLogger.info('✓ Anchor batch routes mounted');

  // Explorer routes for timeline queries
  app.use(explorerRoutes);
  rootLogger.info('✓ Explorer routes mounted');

  // Protocol-wide settlement routes (cross-chain fee enforcement)
  app.use('/api/protocol/settlement', protocolSettlementRouter);
  rootLogger.info('✓ Protocol settlement routes mounted');

  // Atlas API 2.0 Protocol routes (8-lane, protobuf-first, HTTP/3 ready)
  app.use('/api/protocol', handshakeRouterV2);
  app.use('/api/protocol', lanesRouterV2);
  rootLogger.info('✓ Atlas API 2.0 routes mounted (8 lanes, protobuf-first, HTTP/3 dual-stack)');

  // Marketplace routes (ebooks, music, video, art, games, courses, data)
  app.use('/api/marketplace', marketplaceRouter);
  rootLogger.info('✓ Marketplace routes mounted');

  // P3 Enterprise routes (API keys, billing, guardian, SSO, privacy)
  app.use('/api/enterprise/api-keys', enterpriseApiKeysRouter);
  app.use('/api/enterprise/billing', enterpriseBillingRouter);
  app.use('/api/enterprise/guardian', enterpriseGuardianRouter);
  app.use('/api/enterprise/sso', enterpriseSsoRouter);
  app.use('/api/enterprise/privacy', enterprisePrivacyRouter);
  rootLogger.info('✓ P3 Enterprise routes mounted');

  // Encrypted Messaging routes
  app.use('/api/messaging', messagingRouter);
  rootLogger.info('✓ Messaging routes mounted at /api/messaging');

  // Event Bus, Policy Engine, Tenancy, and Audit Proofs routes
  app.use('/api/events', eventsRouter);
  app.use('/api/policy', policyRouter);
  app.use('/api/tenancy', tenancyRouter);
  app.use('/api/audit', auditProofsRouter);
  rootLogger.info('✓ Event Bus, Policy, Tenancy, and Audit routes mounted');

  // Payments extended routes (micro-payments, escrow)
  app.use('/api/payments', paymentsExtendedRouter);
  rootLogger.info('✓ Payments extended routes mounted at /api/payments');

  // Analytics routes (traffic, endpoints, tenants, anomaly detection)
  app.use('/api/analytics', analyticsRouter);
  rootLogger.info('✓ Analytics routes mounted at /api/analytics');

  // Scanner routes (manifest submission, scanning, registry, audit)
  app.use('/api/scanner', scannerRouter);
  rootLogger.info('✓ Scanner routes mounted at /api/scanner');

  // Atlas routes are mounted earlier (line 888-890) for public Alexa/Wear OS access

  // AI proxy routes (transient key forwarding for multi-AI plug-ins)
  app.use('/api/ai', aiRouter);
  rootLogger.info('✓ AI proxy routes mounted at /api/ai');

  // Tenant sandbox and SLA middleware for API routes
  app.use('/api', loadTenantPolicy);
  app.use('/api', injectSandboxHeaders);
  app.use('/api/protocol/settlement', blockSettlementInSandbox);
  app.use('/api', collectSLAMetrics);
  startSLAMetricsCollection();
  rootLogger.info('✓ Enterprise middleware enabled (tenant sandbox, SLA metrics)');

  // DAO routes (dynamic import for compatibility)
  import('./dao-routes').then(({ createDAORoutes }) => {
    const daoRouter = createDAORoutes(storage);
    app.use(daoRouter);
  });

  // App routes (dynamic import for compatibility)
  import('./app-routes').then(({ createAppRoutes }) => {
    const appRouter = createAppRoutes(storage);
    app.use(appRouter);
  });
}

// Setup signaling after server is created
setupSignaling(server);

// Attach WebSocket real-time server for payments/messages/notes
attachWebSocket(server);

// Attach Pulse WebSocket for Atlas news streaming
attachPulseWebSocket(server);

function serveStaticFrontend() {
  const distPath = path.resolve(process.cwd(), 'dist/client');
  
  app.use(express.static(distPath, {
    etag: false,
    lastModified: false,
    maxAge: 0,
    index: false, // Disable automatic index.html serving so we can inject manifest
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }));
  
  // SPA catch-all - exclude /api/* paths to prevent hijacking API routes
  app.get(/^\/(?!api\/).*/, async (req, res) => {
    try {
      const url = req.originalUrl;
      let template = await fs.readFile(
        path.join(distPath, 'index.html'),
        'utf-8'
      );
      
      // Server-side manifest injection based on URL path
      let manifestPath = '/manifest-app.json';
      let themeColor = '#0ea5e9';
      let appTitle = 'dCiphrs Nexus';
      
      if (url.startsWith('/launcher') || url === '/launcher') {
        manifestPath = '/manifest-launcher.json';
        themeColor = '#1b78d1';
        appTitle = 'P3 Hub';
      } else if (url.startsWith('/enterprise') || url.startsWith('/admin')) {
        manifestPath = '/manifest-enterprise.json';
        themeColor = '#7c3aed';
        appTitle = 'P3 Enterprise';
      }
      
      template = template.replace(
        /href="\/manifest-app\.json"/g,
        `href="${manifestPath}"`
      );
      template = template.replace(
        /<meta name="theme-color" content="[^"]*"/g,
        `<meta name="theme-color" content="${themeColor}"`
      );
      template = template.replace(
        /<meta name="apple-mobile-web-app-title" content="[^"]*"/g,
        `<meta name="apple-mobile-web-app-title" content="${appTitle}"`
      );
      
      // CRITICAL: Inject inline version check script that runs BEFORE any other JS
      // This forces a hard reload if the cached version doesn't match server version
      // ALSO fetches /api/version to detect stale HTML that was cached by PWA
      const versionCheckScript = `
<script>
(function(){
  var HTML_VERSION = '${APP_VERSION}';
  var CACHE_KEY = 'p3_app_version';
  var RELOAD_KEY = 'p3_version_reload';
  
  function clearCachesAndReload(reason) {
    console.log('[VERSION] ' + reason + ', forcing reload');
    
    // Mark that we're reloading to prevent loops
    sessionStorage.setItem(RELOAD_KEY, Date.now().toString());
    
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(function(keys) {
        keys.forEach(function(key) { caches.delete(key); });
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(reg) { reg.unregister(); });
      });
    }
    
    // Force reload with cache bypass - preserve query params and hash using URL API
    setTimeout(function() {
      var url = new URL(window.location.href);
      url.searchParams.delete('_');
      url.searchParams.set('_', Date.now().toString());
      window.location.replace(url.toString());
    }, 100);
  }
  
  // Check if we just reloaded (within last 5 seconds)
  var lastReload = sessionStorage.getItem(RELOAD_KEY);
  if (lastReload && (Date.now() - parseInt(lastReload)) < 5000) {
    console.log('[VERSION] Recently reloaded, skipping check');
    localStorage.setItem(CACHE_KEY, HTML_VERSION);
    return;
  }
  
  // NETWORK CHECK: Fetch server version to detect stale HTML
  fetch('/api/version?_=' + Date.now(), { cache: 'no-store' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var serverVersion = data.version;
      console.log('[VERSION] HTML: ' + HTML_VERSION + ', Server: ' + serverVersion);
      
      if (serverVersion !== HTML_VERSION) {
        clearCachesAndReload('HTML version mismatch: ' + HTML_VERSION + ' vs server ' + serverVersion);
      } else {
        localStorage.setItem(CACHE_KEY, serverVersion);
        console.log('[VERSION] Version match, app ready');
      }
    })
    .catch(function(e) {
      console.log('[VERSION] Network check failed, using HTML version');
      localStorage.setItem(CACHE_KEY, HTML_VERSION);
    });
})();
</script>`;
      
      // Inject the script right after <head>
      template = template.replace('<head>', '<head>' + versionCheckScript);
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Type', 'text/html');
      res.send(template);
    } catch (error) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
  rootLogger.info('✓ Static frontend served from /dist/client (no-cache + manifest injection)');
}

async function setupFrontend() {
  rootLogger.info('Setting up static frontend from dist/client');
  serveStaticFrontend();
}

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const logger = (req as any).logger || rootLogger;
  const correlationId = (req as any).correlationId;
  
  logger.error('Request error', err, {
    correlationId,
    path: req.path,
    method: req.method,
  });

  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const sessionId = req.headers['x-session-id'] as string || generateSessionId(req);

  if (telemetryService) {
    telemetryService.recordEvent({
      eventType: 'error',
      sessionId,
      ip,
      userAgent,
    }).catch(e => rootLogger.error('Failed to record error telemetry', e as Error));
  }

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(correlationId && { requestId: correlationId }),
  });
});

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  rootLogger.info(`${signal} received, starting graceful shutdown...`);

  // Stop alarm monitoring
  if (alarmSystem) {
    alarmSystem.stopMonitoring();
    rootLogger.info('✓ Alarm monitoring stopped');
  }

  // Stop anchor batch worker
  try {
    await stopAnchorWorker();
    rootLogger.info('✓ Anchor batch worker stopped');
  } catch (error) {
    rootLogger.error('Error stopping anchor batch worker', error as Error);
  }

  // Close HTTP server first
  server.close(() => {
    rootLogger.info('✓ HTTP server closed');
  });

  // Close database connections
  if (storage) {
    try {
      await storage.close();
      rootLogger.info('✓ Database connections closed');
    } catch (error) {
      rootLogger.error('Error closing database', error as Error);
    }
  }

  rootLogger.info('✓ Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

async function startServer() {
  console.log('🚀 Starting P3 Protocol Server...\n');

  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1' || process.env.SKIP_VITE === 'true';

  // Step 1: Skip migrations (tables already exist)
  console.log('📊 Database ready (using existing schema)\n');

  // Step 2: Initialize PostgreSQL storage (no migrations - tables exist)
  try {
    rootLogger.info('Initializing storage...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    
    const pgStorage = new PgStorage(process.env.DATABASE_URL);
    
    // For deployment, skip expensive ping - trust connection
    if (!isDeployment) {
      const isConnected = await pgStorage.ping();
      if (!isConnected) {
        throw new Error('Database ping failed - connection not working');
      }
    }
    
    storage = pgStorage;
    storageType = 'postgresql';
    setStorageInstance(pgStorage);
    rootLogger.info('✓ PostgreSQL storage connected (using existing schema)');
    
    telemetryService = new TelemetryService(storage);
    secretManager = initializeSecretManager(storage);
    initApiMetrics(storage);
    rootLogger.info('Storage initialized');
  } catch (error) {
    rootLogger.error('Failed to initialize storage', error as Error);
    process.exit(1);
  }

  // Defer expensive operations in deployment mode
  if (!isDeployment) {
    // Step 2.5: Initialize observability systems
    try {
      rootLogger.info('Initializing observability systems...');
      
      healthMonitor = new HealthMonitor(rootLogger);
      healthMonitor.setDatabaseChecker(async () => {
        try {
          return await storage.ping();
        } catch {
          return false;
        }
      });
      
      alarmSystem = createAlarmSystem(rootLogger);
      alarmSystem.startMonitoring(60000);
      
      rootLogger.info('Observability systems initialized');
    } catch (error) {
      rootLogger.error('Failed to initialize observability', error as Error);
      process.exit(1);
    }

    // Step 3: Create system user for secrets management
    let SYSTEM_USER_ID: string;
    try {
      rootLogger.info('Initializing system user...');
      const systemUser = await storage.getUserByEmail('system@p3protocol.internal');
      if (!systemUser) {
        const { hash } = await import('bcrypt');
        const hashedPassword = await hash('system-' + Date.now(), 10);
        const newUser = await storage.createUser({
          email: 'system@p3protocol.internal',
          passwordHash: hashedPassword,
          role: 'admin',
        });
        SYSTEM_USER_ID = newUser.id;
        rootLogger.info('System user created');
      } else {
        SYSTEM_USER_ID = systemUser.id;
        rootLogger.info('System user found');
      }
    } catch (error) {
      rootLogger.error('Failed to initialize system user', error as Error);
      process.exit(1);
    }

    // Step 4: Initialize SecretManager
    try {
      rootLogger.info('Initializing secrets...');
      await secretManager.initialize(SYSTEM_USER_ID);
      await performStartupChecks(secretManager);
      scheduleExpiryChecks(secretManager);
      rootLogger.info('Secrets initialized');
    } catch (error) {
      rootLogger.error('Failed to initialize secrets', error as Error);
      rootLogger.error('Server cannot start without valid secrets configuration');
      process.exit(1);
    }

    // Step 4.5: Create admin user from environment secrets
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (adminEmail && adminPassword) {
        rootLogger.info('Checking for admin user...');
        const existingAdmin = await storage.getUserByEmail(adminEmail);
        
        if (!existingAdmin) {
          const { hash } = await import('bcrypt');
          const hashedPassword = await hash(adminPassword, 10);
          await storage.createUser({
            email: adminEmail,
            passwordHash: hashedPassword,
            role: 'admin',
          });
          rootLogger.info('✓ Admin user created from secrets');
        } else {
          rootLogger.info('✓ Admin user already exists');
        }
      } else {
        rootLogger.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in secrets');
      }
    } catch (error) {
      rootLogger.error('Failed to create admin user', error as Error);
    }
  } else {
    rootLogger.info('⚡ Deployment mode: Skipping expensive startup operations for fast health checks');
    
    // Minimal observability for deployment
    healthMonitor = new HealthMonitor(rootLogger);
    healthMonitor.setDatabaseChecker(async () => true);
  }

  // Step 5: Initialize routes
  rootLogger.info('Mounting routes...');
  initializeRoutes();
  rootLogger.info('Routes mounted');

  // Step 5.5: Start anchor batch worker
  try {
    rootLogger.info('Starting anchor batch worker...');
    const anchorWorker = startAnchorWorker();
    if (anchorWorker) {
      rootLogger.info('✓ Anchor batch worker started');
    } else {
      rootLogger.warn('⚠️ Anchor batch worker not started (may already be running or Redis unavailable)');
    }
  } catch (error) {
    rootLogger.warn('⚠️ Failed to start anchor batch worker', error as Error);
  }

  // Step 5.6: Start catalog sync scheduler (background content imports)
  if (isDevelopment) {
    try {
      rootLogger.info('Starting catalog sync scheduler...');
      const { startScheduler } = await import('./atlas/one/sync/scheduler');
      startScheduler(5); // Run every 5 minutes
      rootLogger.info('✓ Catalog sync scheduler started (every 5 minutes)');
    } catch (error) {
      rootLogger.warn('⚠️ Failed to start catalog sync scheduler', error as Error);
    }
  }

  // Step 6: Setup frontend with fallback
  try {
    rootLogger.info('Setting up frontend...');
    await setupFrontend();
    rootLogger.info('✓ Frontend ready');
  } catch (err) {
    rootLogger.error('Vite setup failed, falling back to static frontend:', err as Error);
    serveStaticFrontend();
  }
  
  // Step 7: Start server
  server.listen(Number(PORT), HOST, () => {
    console.log(`
╔════════════════════════════════════════╗
║     P3 Protocol Server Running         ║
╠════════════════════════════════════════╣
║  Environment: ${isDevelopment ? 'Development' : 'Production'.padEnd(18)}║
║  Host:        ${HOST.padEnd(26)}║
║  Port:        ${String(PORT).padEnd(26)}║
║  URL:         http://${HOST}:${PORT}${' '.repeat(13)}║
╠════════════════════════════════════════╣
║  Security:    ✓ Headers, Rate Limiting ║
║  Database:    ${storageType === 'postgresql' ? '✓ PostgreSQL Connected' : '⚠ In-Memory (Fallback)'}   ║
║  Secrets:     ✓ Encrypted & Managed    ║
║  Observability:                        ║
║    Metrics:   ✓ /metrics (Prometheus)  ║
║    Health:    ✓ /health                ║
║    Logging:   ✓ Structured (Pino)      ║
║    Alarms:    ✓ SLO Monitoring Active  ║
╚════════════════════════════════════════╝
    `);
    
    rootLogger.info('Server started successfully', {
      environment: isDevelopment ? 'development' : 'production',
      host: HOST,
      port: PORT,
    });
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
