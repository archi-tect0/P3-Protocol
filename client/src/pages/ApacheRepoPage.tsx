import { useState } from 'react';
import { Link } from 'wouter';
import { File, Folder, Download, Home, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const repoStructure = {
  name: 'p3-bridge',
  description: 'A unified wallet connection layer for modular crypto apps',
  license: 'Apache 2.0',
  stars: 0,
  forks: 0,
  files: [
    {
      name: 'README.md',
      type: 'file',
      description: 'Project documentation',
      size: '4.2 KB',
      badge: 'docs'
    },
    {
      name: 'LICENSE',
      type: 'file',
      description: 'Apache License 2.0',
      size: '11 KB',
      badge: 'license'
    },
    {
      name: 'src',
      type: 'folder',
      files: [
        {
          name: 'eventBus.ts',
          description: 'Event emitter for wallet events',
          size: '0.3 KB',
          badge: 'core'
        },
        {
          name: 'store.ts',
          description: 'Session persistence layer',
          size: '0.4 KB',
          badge: 'core'
        },
        {
          name: 'ui.ts',
          description: 'Consent modal interface',
          size: '0.2 KB',
          badge: 'ui'
        },
        {
          name: 'capabilities.ts',
          description: 'Permission grant manager',
          size: '0.5 KB',
          badge: 'security'
        },
        {
          name: 'walletConnector.ts',
          description: 'Wallet connection logic',
          size: '1.2 KB',
          badge: 'core'
        },
        {
          name: 'signer.ts',
          description: 'Signing operations',
          size: '0.6 KB',
          badge: 'crypto'
        },
        {
          name: 'sdk.ts',
          description: 'Main SDK export',
          size: '2.1 KB',
          badge: 'api'
        }
      ]
    }
  ]
};

function FileIcon({ type }: { type: string }) {
  if (type === 'folder') return <Folder className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-slate-500" />;
}

function BadgeBg({ badge }: { badge: string }) {
  const colors = {
    docs: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    license: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    core: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
    ui: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200',
    security: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
    crypto: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
    api: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200',
  };
  return colors[badge as keyof typeof colors] || colors.core;
}

function FileItem({ item, path }: { item: any; path: string }) {
  const [expanded, setExpanded] = useState(false);
  const isFolder = item.type === 'folder';
  void (path ? `${path}/${item.name}` : item.name);

  return (
    <div key={item.name} className="border-b border-slate-200 dark:border-slate-700 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
        {isFolder && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
          >
            <ChevronRight
              className={`w-4 h-4 transition ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        {!isFolder && <div className="w-5" />}
        <FileIcon type={item.type} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100">
            {item.name}
          </div>
          {item.description && (
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {item.description}
            </div>
          )}
        </div>
        {item.badge && (
          <span className={`text-xs font-semibold px-2 py-1 rounded ${BadgeBg({ badge: item.badge })}`}>
            {item.badge}
          </span>
        )}
        {item.size && (
          <div className="text-xs text-slate-500 dark:text-slate-400 ml-2">
            {item.size}
          </div>
        )}
      </div>
      {isFolder && expanded && item.files && (
        <div className="bg-slate-50 dark:bg-slate-900/50 pl-6">
          {item.files.map((file: any) => (
            <div key={file.name} className="border-b border-slate-200 dark:border-slate-700 last:border-0">
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <div className="w-5" />
                <FileIcon type="file" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-slate-900 dark:text-slate-100">
                    {file.name}
                  </div>
                  {file.description && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      {file.description}
                    </div>
                  )}
                </div>
                {file.badge && (
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${BadgeBg({ badge: file.badge })}`}>
                    {file.badge}
                  </span>
                )}
                {file.size && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                    {file.size}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApacheRepoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">P3</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  p3-bridge
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  dciphrs/p3-bridge • Public • Apache 2.0
                </p>
              </div>
            </div>
            <Link href="/">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
                data-testid="button-back-home"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">P3 Home</span>
              </Button>
            </Link>
          </div>
          <p className="text-slate-700 dark:text-slate-300">
            {repoStructure.description}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
          {/* Repo Stats Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 sticky top-32">
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {repoStructure.stars}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Stars</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {repoStructure.forks}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">Forks</div>
                </div>
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                    License
                  </div>
                  <span className="inline-block bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 text-xs font-semibold px-3 py-1 rounded">
                    {repoStructure.license}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Files Browser */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-mono">main</span>
                  <span>•</span>
                  <span>8 files</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="/api/apache/bridge/download"
                    download="p3-bridge-sdk.zip"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                </div>
              </div>

              {/* File List */}
              <div>
                {repoStructure.files.map((item) => (
                  <FileItem key={item.name} item={item} path="" />
                ))}
              </div>
            </div>

            {/* Full Documentation */}
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm mt-6">
              <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-3 bg-slate-50 dark:bg-slate-900/50">
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                  README.md - Full Documentation
                </h2>
              </div>
              <div className="prose dark:prose-invert max-w-none p-6">
                <h1 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">P3 Protocol Bridge</h1>
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  A unified wallet connection layer for modular crypto apps.<br/>
                  <strong>Connect once, cache securely, and let every module inherit the session.</strong><br/>
                  No private key imports. No duplicate WalletConnect flows.
                </p>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Features</h2>
                <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
                  <li>🔑 <strong>Single Wallet Handshake</strong> — WalletConnect v2 or injected provider, one connection for all modules</li>
                  <li>🔒 <strong>Secure Session Caching</strong> — Encrypted localStorage with automatic cleanup on disconnect</li>
                  <li>🧩 <strong>Simple SDK</strong> — getSession(), signMessage(), sendTransaction() across all modules</li>
                  <li>🛡️ <strong>Capability-Based Permissions</strong> — Optional biometric gating and time-limited access grants</li>
                  <li>🚫 <strong>Zero Private Key Exposure</strong> — Keys never leave wallet, modules only receive signatures</li>
                  <li>🌐 <strong>Cross-Module Isolation</strong> — Each module gets sandboxed capability tokens</li>
                </ul>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Installation</h2>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`npm install @p3protocol/bridge
# or
yarn add @p3protocol/bridge`}</code>
                </pre>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Quick Start</h2>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`import { 
  connectWallet, 
  getSession, 
  sendTransaction,
  onWalletEvent 
} from '@p3protocol/bridge';

async function run() {
  // Connect wallet (prompts user once)
  const session = await connectWallet({ provider: 'walletconnect' });
  console.log('Connected:', session.address);

  // Send transaction from any module
  const { txId, status } = await sendTransaction('module.purchase', {
    to: '0x...',
    value: '1000000000000000000',
  });
  console.log('Transaction:', txId, status);

  // Listen for wallet events
  onWalletEvent('accountChanged', (newSession) => {
    console.log('Account changed to:', newSession.address);
  });
}

run().catch(console.error);`}</code>
                </pre>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">API Reference</h2>
                
                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">connectWallet(opts?)</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-2">Initiates wallet connection. Prompts user once; subsequent calls return cached session.</p>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                  <code>{`type Session = {
  connected: boolean;
  address?: string;
  chainId?: number;
  provider: 'walletconnect' | 'injected';
};`}</code>
                </pre>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">getSession()</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Returns current cached session without prompting.</p>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">disconnectWallet()</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Clears session and revokes all capability grants.</p>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">requestCapability(moduleId, cap, reason?)</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-2">Requests permission for a module to perform an action.</p>
                <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 mb-4">
                  <li><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">moduleId</code>: Unique identifier for the requesting module</li>
                  <li><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">cap</code>: Capability name (e.g., sign_eip712, send_transaction)</li>
                  <li><code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">reason</code>: Optional user-facing reason string</li>
                </ul>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">signMessage(moduleId, msg)</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Signs a raw message. Requires sign_message capability.</p>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">signTypedData(moduleId, eip712)</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Signs EIP-712 structured data. Requires sign_eip712 capability.</p>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">sendTransaction(moduleId, tx)</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">Sends a transaction. Requires send_transaction capability.</p>

                <h3 className="text-lg font-semibold mt-6 mb-2 text-purple-600 dark:text-purple-400">onWalletEvent(event, handler)</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-2">Subscribes to wallet events. Returns unsubscribe function.</p>
                <p className="text-slate-600 dark:text-slate-400">Events: connected, disconnected, accountChanged, chainChanged</p>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Module Integration Example</h2>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{`// In your module
import { getSession, requestCapability, signMessage } from '@p3protocol/bridge';

export async function authenticateModule() {
  const session = await getSession();
  if (!session.connected) throw new Error('Wallet not connected');

  // Request capability once
  const granted = await requestCapability(
    'my.module.v1',
    'sign_message',
    'Authenticate your wallet address'
  );
  if (!granted) throw new Error('User denied capability');

  // Sign a challenge
  const msg = new TextEncoder().encode('Verify me');
  const signature = await signMessage('my.module.v1', msg);
  
  return { address: session.address, signature };
}`}</code>
                </pre>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Architecture</h2>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm font-mono">
{`┌─────────────────────────────────────┐
│      Browser / App Container        │
├─────────────────────────────────────┤
│         P3 Bridge SDK               │
│  ┌──────────────────────────────┐  │
│  │  Wallet Connector            │  │
│  │  (WalletConnect v2/Injected) │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Session Store               │  │
│  │  (encrypted localStorage)    │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Capability Manager          │  │
│  │  (time-limited grants)       │  │
│  └──────────────────────────────┘  │
├─────────────────────────────────────┤
│     Module 1    │    Module 2       │
│  (e.g., DAO)    │  (e.g., Swaps)    │
└─────────────────────────────────────┘`}
                </pre>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">Security Considerations</h2>
                <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400">
                  <li><strong>No Private Keys in Modules</strong> — Only signatures are passed; private keys remain in wallet</li>
                  <li><strong>Capability Expiration</strong> — Grants auto-expire (default: 1 minute). Request fresh grants for sensitive ops</li>
                  <li><strong>localStorage Security</strong> — Session tokens stored in p3.session.v1. Clear on logout</li>
                  <li><strong>User Consent</strong> — Every capability requires explicit user approval via modal</li>
                  <li><strong>Wallet Signature Verification</strong> — All module operations signed by wallet; tamper-proof</li>
                </ol>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">File Structure</h2>
                <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg overflow-x-auto text-sm font-mono">
{`/src
  ├── eventBus.ts          # Event emitter for wallet events
  ├── store.ts             # Session persistence (localStorage)
  ├── ui.ts                # Consent modal (replaceable)
  ├── capabilities.ts      # Capability grant manager
  ├── walletConnector.ts   # Wallet connection logic
  ├── signer.ts            # Signing operations
  └── sdk.ts               # Main SDK export`}
                </pre>

                <h2 className="text-xl font-bold mt-8 mb-4 text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700 pb-2">License</h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Released under the <strong>Apache License 2.0</strong>.<br/>
                  Copyright © 2025 dciphrs.io<br/>
                  Maintained by archi-tect0
                </p>

                              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
