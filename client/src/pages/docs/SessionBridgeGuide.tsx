import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Smartphone, Globe, Key, Shield, Zap, Code, AlertTriangle } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function SessionBridgeGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Session Bridge Implementation Guide | P3 Protocol"
        description="Learn how to implement wallet-anchored persistent sessions with WalletConnect, signing mutex, PIN unlock, and cross-device handoff."
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
            <a href="https://github.com/p3-protocol/p3-protocol/blob/main/client/src/lib/sessionBridgeV2.ts" target="_blank" rel="noopener noreferrer">
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Session Bridge</h1>
              <p className="text-slate-400">Wallet-Anchored Persistent Sessions</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            The Session Bridge provides persistent wallet-anchored sessions across page reloads, devices, and browser contexts.
            It handles WalletConnect integration, signing mutex to prevent race conditions, PIN unlock flows, and secure browser handoff for mobile wallets.
          </p>
        </div>

        <div className="space-y-8">
          {/* Architecture Overview */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-400" />
              Architecture Overview
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Session Bridge uses WalletConnect's EthereumProvider for broad wallet compatibility. The core innovation is a <strong>signing mutex</strong> that prevents multiple signature requests from firing simultaneously—a common issue in mobile wallet browsers where race conditions can cause failed transactions.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Core session structure
interface BridgeSession {
  address: string;        // Wallet address (0x...)
  chainId: number;        // Network ID (8453 for Base)
  method: 'walletconnect' | 'extension' | 'deeplink';
  connected: boolean;     // Live connection status
  topic?: string;         // WalletConnect session topic
  peerName?: string;      // Connected wallet name
  timestamp: number;      // Session creation time
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Signing Mutex */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Signing Mutex (Race Condition Prevention)
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Mobile wallet browsers often trigger multiple connection paths simultaneously. Without protection, this causes duplicate signature popups or failed transactions. The signing mutex ensures only ONE signature request is active at a time:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Module-level lock - prevents race conditions
let signingMutex: Promise<any> | null = null;
let signingAttemptId = 0;

function acquireSigningLock(caller: string): { canProceed: boolean; attemptId: number } {
  const attemptId = ++signingAttemptId;
  
  if (signingMutex !== null) {
    console.log(\`[MUTEX] BLOCKED: \${caller} - signing already in progress\`);
    return { canProceed: false, attemptId };
  }
  
  console.log(\`[MUTEX] ACQUIRED: \${caller} (attempt #\${attemptId})\`);
  return { canProceed: true, attemptId };
}

function releaseSigningLock(attemptId: number): void {
  console.log(\`[MUTEX] RELEASED: (attempt #\${attemptId})\`);
  signingMutex = null;
}

// Usage in connection flow
async function connectBridge(): Promise<BridgeSession | null> {
  const { canProceed, attemptId } = acquireSigningLock('connectBridge');
  if (!canProceed) return null; // Another connection in progress
  
  try {
    setSigningMutex(actualConnectionPromise);
    const result = await actualConnectionPromise;
    return result;
  } finally {
    releaseSigningLock(attemptId);
  }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Wallet Browser Detection */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              Wallet Browser Detection
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Different wallet browsers (MetaMask, Coinbase, Base, Trust) have different capabilities and quirks. Detection happens in two phases: checking injected provider flags first (more reliable), then falling back to user agent patterns:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`function detectWalletBrowser(): {
  isWalletBrowser: boolean;
  browserName: string;
  platform: 'ios' | 'android' | 'desktop';
} {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  // Check injected provider flags FIRST (more reliable than UA)
  const eth = window.ethereum as any;
  if (eth) {
    // Base Wallet / Coinbase Wallet / Smart Wallet
    if (eth.isCoinbaseWallet || eth.isCoinbaseBrowser || eth.isSmartWallet) {
      return { isWalletBrowser: true, browserName: 'Coinbase/Base', platform };
    }
    // MetaMask
    if (eth.isMetaMask && !eth.isCoinbaseWallet) {
      return { isWalletBrowser: true, browserName: 'MetaMask', platform };
    }
    // Trust Wallet
    if (eth.isTrust || eth.isTrustWallet) {
      return { isWalletBrowser: true, browserName: 'Trust Wallet', platform };
    }
  }
  
  return { isWalletBrowser: false, browserName: 'unknown', platform };
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Browser Handoff */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              Browser Handoff (Wallet → Chrome/Safari)
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                After authentication in a wallet browser, users often want to continue in a full browser. The handoff creates a secure one-time token, then launches Chrome (Android) or Safari (iOS) with the session intact:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`async function triggerBrowserPopout(): Promise<void> {
  const context = detectWalletBrowser();
  if (!context.isWalletBrowser) return;
  
  const walletAddress = localStorage.getItem('walletAddress');
  if (!walletAddress) return;

  // 1. Generate secure transfer token via server
  const tokenResponse = await fetch('/api/pwa/create-install-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, appMode: false }),
    credentials: 'include'
  });
  const { token } = await tokenResponse.json();
  
  // 2. Build handoff URL
  const params = new URLSearchParams();
  params.set('install_token', token);
  params.set('wallet_return', 'true');
  const handoffUrl = \`\${baseUrl}/atlas?\${params.toString()}\`;

  // 3. Platform-specific launch
  if (context.platform === 'android') {
    // Android Chrome intent - opens Chrome without breaking wallet session
    const intentUrl = \`intent://\${host}/atlas?\${params}#Intent;scheme=https;package=com.android.chrome;end\`;
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = intentUrl;
    document.body.appendChild(iframe);
  } else if (context.platform === 'ios') {
    // iOS - try window.open, fallback to Web Share API
    const newWindow = window.open(handoffUrl, '_blank');
    if (!newWindow && navigator.share) {
      await navigator.share({ title: 'Open in Safari', url: handoffUrl });
    }
  }
}`}</code></pre>
              </div>
              <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-amber-300">Important: Never mutate window.location</h4>
                    <p className="text-sm text-slate-400 mt-1">
                      On Android, using <code>window.location.href</code> for the intent URL destroys the wallet browser session. Always use an iframe to trigger the intent while keeping the authenticated session alive as a fallback.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Diagnostics */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-pink-400" />
              Diagnostics & Debugging
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Mobile wallet browsers are notoriously difficult to debug. Session Bridge includes a diagnostics system that pushes logs to the server using <code>sendBeacon</code> (more reliable than fetch for mobile):
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`function pushDiag(step: string, data?: any) {
  const payload = JSON.stringify({
    level: 'info',
    tag: step,
    sessionId: getDiagSessionId(), // Persistent across reloads
    data: { ...data, ts: Date.now() }
  });
  
  // sendBeacon works better in mobile/wallet browsers
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/diag', blob);
  }
}

// Usage throughout connection flow
pushDiag('bridge_connect_start', { method: 'walletconnect' });
pushDiag('bridge_accounts_received', { count: accounts.length });
pushDiag('bridge_session_saved', { address: session.address });`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-emerald-400">client/src/lib/sessionBridgeV2.ts</code>
                <span className="text-xs text-slate-500">Core bridge implementation (~1600 lines)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">client/src/lib/coinbaseAuth.ts</code>
                <span className="text-xs text-slate-500">PIN unlock & Coinbase-specific flows</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-violet-400">client/src/components/WalletLauncherMenu.tsx</code>
                <span className="text-xs text-slate-500">UI component for wallet connection</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/routes.ts</code>
                <span className="text-xs text-slate-500">Challenge/verify endpoints, install token API</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <Link href="/docs/encryption">
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500">
              Next: Encryption Stack
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
