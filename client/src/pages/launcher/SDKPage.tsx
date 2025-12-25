import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3HubLogo from '@/components/P3HubLogo';
import { P3 } from '@/lib/sdk';
import { getSession } from '@/lib/sessionBridgeV2';
import { anchorSDKDownload, SDK_CONTRACTS, type SDKDownloadAnchor } from '@/lib/sdk/testnetAnchor';
import { BrowserHandoffButton, useAutoPopout } from '@/components/BrowserHandoffButton';
import { 
  ArrowLeft,
  ArrowRight,
  Wallet, 
  Send, 
  Lock, 
  Anchor,
  FileJson,
  Cog,
  Link2,
  Grid3X3,
  Code2,
  ChevronRight,
  Rocket,
  Terminal,
  Shield,
  Zap,
  Check,
  X as XIcon,
  Eye,
  Vote,
  Download,
  Ticket,
  Activity,
  Cloud,
  Database,
  Key,
  Building2,
  Building,
  Atom,
  BookOpen,
  Music,
  Video,
  Palette,
  Store,
  Play,
  Receipt,
  DollarSign,
  FileSearch,
  Globe,
  CreditCard,
  Gavel,
  Layers,
  ArrowRightLeft,
  CircleDollarSign,
  Timer,
  HardDrive,
  Loader2,
  ExternalLink,
  Gamepad2
} from 'lucide-react';

const gettingStartedSteps = [
  {
    step: 1,
    icon: Link2,
    title: 'Connect to Session Bridge',
    description: 'Initialize the P3 SDK and establish a secure connection to the session bridge for wallet authentication.'
  },
  {
    step: 2,
    icon: Code2,
    title: 'Access Protocol Primitives',
    description: 'Use P3 SDK methods to interact with wallet sessions, payments, encrypted messaging, and proof anchoring.'
  },
  {
    step: 3,
    icon: Anchor,
    title: 'Anchor Proofs to Blockchain',
    description: 'Every action generates cryptographic receipts that can be anchored on-chain for verifiable transparency.'
  }
];

const protocolPrimitives = [
  {
    method: 'P3.wallet()',
    description: 'Get connected wallet session',
    icon: Wallet,
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400',
    code: `const session = await P3.wallet();
console.log(session.address);
// 0x742d35Cc6634C0532925a3b844Bc9e7595f...`
  },
  {
    method: 'P3.payNative(recipient, amount)',
    description: 'Send tokens with receipt',
    icon: Send,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    code: `const receipt = await P3.payNative(
  "0x742d35Cc6634C0532925a3b844Bc9e...",
  "0.1" // ETH amount
);
console.log(receipt.txHash);`
  },
  {
    method: 'P3.msgEncrypted(type, data)',
    description: 'E2E encrypted messages',
    icon: Lock,
    color: 'from-cyan-500 to-teal-600',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
    code: `const msg = await P3.msgEncrypted("dm", {
  to: "0x742d35Cc6634...",
  content: "Hello, Protocol 3!"
});
// Message encrypted with recipient's public key`
  },
  {
    method: 'P3.proofs.publish(payload)',
    description: 'Anchor proof to blockchain',
    icon: Anchor,
    color: 'from-emerald-500 to-green-600',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    code: `const anchor = await P3.proofs.publish({
  type: "action",
  data: { event: "user_verified" },
  timestamp: Date.now()
});
console.log(anchor.cid, anchor.txHash);`
  }
];

const threeFileRule = [
  {
    file: 'manifest.json',
    icon: FileJson,
    description: 'Identity + governance metadata',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400'
  },
  {
    file: 'service-worker.js',
    icon: Cog,
    description: 'Caching, offline, installability',
    color: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400'
  },
  {
    file: 'protocol-anchor.js',
    icon: Link2,
    description: 'Wallet/session bridge integration',
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400'
  }
];

const manifestSchema = `{
  "name": "My P3 App",
  "protocol": {
    "bridge": true,
    "permissions": ["wallet", "messaging"]
  },
  "governance": {
    "dao": true,
    "compliance": "enterprise"
  }
}`;

const competitiveFeatures = [
  { 
    feature: 'Wallet-Aware SDK', 
    p3: true, 
    others: 'partial',
    p3Detail: 'Native wallet/session context in every call',
    othersDetail: 'Varies — most offer wallet adapters',
    icon: Wallet
  },
  { 
    feature: 'Anchored Receipts', 
    p3: true, 
    others: false,
    p3Detail: 'Optional per-call anchoring, Explorer feeds',
    othersDetail: 'Rare — few offer verifiable receipts',
    icon: Anchor
  },
  { 
    feature: 'Session Bridging', 
    p3: true, 
    others: false,
    p3Detail: 'Persistent across apps, devices, and surfaces',
    othersDetail: 'Most rely on local/session storage',
    icon: Link2
  },
  { 
    feature: 'Encryption Stack', 
    p3: true, 
    others: false,
    p3Detail: 'Hybrid Kyber + NaCl, server-locked',
    othersDetail: 'Basic EIP-1271 or MPC, no hybrid stack',
    icon: Lock
  },
  { 
    feature: 'DAO Governance', 
    p3: true, 
    others: false,
    p3Detail: 'Vote, role, receipts baked into SDK',
    othersDetail: 'Usually separate or not offered',
    icon: Vote
  },
  { 
    feature: 'Installable Apps', 
    p3: true, 
    others: false,
    p3Detail: 'Dual-PWA, Hub drawer, manifest validator',
    othersDetail: 'No launcher or install surface',
    icon: Download
  },
  { 
    feature: 'Ticket Gate Access', 
    p3: true, 
    others: false,
    p3Detail: 'Anchored access + dev monetization',
    othersDetail: 'No protocol-native gating or fee logic',
    icon: Ticket
  },
  { 
    feature: 'Explorer Integration', 
    p3: true, 
    others: false,
    p3Detail: 'Real-time feed of anchored events',
    othersDetail: 'Most lack unified activity visibility',
    icon: Activity
  },
  { 
    feature: 'Protocol Launcher', 
    p3: true, 
    others: false,
    p3Detail: 'Hub + Nexus + Enterprise + DAO',
    othersDetail: 'No OS-level ecosystem surface',
    icon: Grid3X3
  },
];

const securityHighlights = [
  {
    title: 'Hybrid Post-Quantum Encryption',
    description: 'Kyber-768 + X25519 hybrid key exchange with XChaCha20-Poly1305 symmetric encryption. Future-proof against quantum attacks.',
    icon: Shield,
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400'
  },
  {
    title: 'Server-Locked Cryptography',
    description: 'All encryption keys are derived and locked server-side. No key material ever touches the browser. Zero client-side key exposure.',
    icon: Lock,
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400'
  },
  {
    title: 'Anchored Audit Trail',
    description: 'Every sensitive operation generates a cryptographic receipt anchored on-chain. Immutable proof of who did what, when.',
    icon: Anchor,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400'
  },
  {
    title: 'Zero-PII Architecture',
    description: 'No emails, no passwords, no personal data. Wallet addresses are the only identity. Privacy by design, not by policy.',
    icon: Eye,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400'
  },
];

const encryptionComparison = [
  {
    provider: 'AWS Encryption SDK',
    icon: Cloud,
    delivery: 'Client-side library tied to AWS KMS',
    devExperience: 'Requires setup of KMS keys, IAM policies, infra lock-in',
    limitations: 'Complex, AWS-only',
    p3Advantage: 'Infra-agnostic, one call, no lock-in'
  },
  {
    provider: 'IBM / Guardium',
    icon: Building2,
    delivery: 'Enterprise encryption, quantum-safe modules',
    devExperience: 'Heavy enterprise integration, compliance focus',
    limitations: 'Expensive, complex onboarding',
    p3Advantage: 'Quantum-resilient primitives, no enterprise overhead'
  },
  {
    provider: 'Microsoft Azure',
    icon: Cloud,
    delivery: 'Encryption tied to Azure services (BitLocker, Key Vault)',
    devExperience: 'Works well inside Azure ecosystem',
    limitations: 'Limited portability',
    p3Advantage: 'Portable — any app, any surface, optional anchoring'
  },
  {
    provider: 'Thales / Entrust',
    icon: Key,
    delivery: 'Hardware security modules, PKI SDKs',
    devExperience: 'Strong compliance, hardware-bound',
    limitations: 'Specialized, not developer-friendly',
    p3Advantage: 'Developer-first: one call, no hardware dependency'
  },
  {
    provider: 'CipherStash',
    icon: Database,
    delivery: 'SDK for searchable encryption',
    devExperience: 'Focused on database queries',
    limitations: 'Narrow scope',
    p3Advantage: 'Covers messaging, media, governance, payments'
  },
  {
    provider: 'Quantropi',
    icon: Atom,
    delivery: 'Quantum-secure encryption platform',
    devExperience: 'Early-stage, specialized',
    limitations: 'Limited adoption, narrow use cases',
    p3Advantage: 'Hybrid crypto in a full OS stack, not just crypto'
  },
];

const cryptoApiEndpoints = [
  {
    name: 'Encrypt',
    method: 'POST',
    endpoint: '/api/sdk/crypto/encrypt',
    description: 'Hybrid Kyber + NaCl encryption',
    request: `{
  "text": "Your secret message",
  "recipientPubKey": "base64_public_key"
}`,
    response: `{
  "cipher": "base64_encrypted_data",
  "nonce": "base64_nonce"
}`
  },
  {
    name: 'Decrypt',
    method: 'POST',
    endpoint: '/api/sdk/crypto/decrypt',
    description: 'Decrypt received messages',
    request: `{
  "cipher": "base64_encrypted_data",
  "senderPubKey": "base64_sender_public_key"
}`,
    response: `{
  "text": "Your secret message"
}`
  },
  {
    name: 'Sign',
    method: 'POST',
    endpoint: '/api/sdk/crypto/sign',
    description: 'Ed25519 digital signatures',
    request: `{
  "message": "Data to sign"
}`,
    response: `{
  "signature": "base64_signature",
  "publicKey": "base64_public_key"
}`
  },
  {
    name: 'Verify',
    method: 'POST',
    endpoint: '/api/sdk/crypto/verify',
    description: 'Verify signatures',
    request: `{
  "message": "Signed data",
  "signature": "base64_signature",
  "pubKey": "base64_public_key"
}`,
    response: `{
  "ok": true
}`
  },
  {
    name: 'Get Public Key',
    method: 'GET',
    endpoint: '/api/sdk/crypto/pubkey',
    description: 'Get your wallet public key',
    request: 'Authorization: Bearer <session_token>',
    response: `{
  "publicKey": "base64_public_key"
}`
  },
  {
    name: 'Derive Shared Key',
    method: 'POST',
    endpoint: '/api/sdk/crypto/derive',
    description: 'ECDH shared secret derivation',
    request: `{
  "theirPubKey": "base64_their_public_key"
}`,
    response: `{
  "sharedKey": "base64_shared_secret"
}`
  }
];

const anchorApiEndpoints = [
  {
    name: 'Anchor Proof',
    method: 'POST',
    endpoint: '/api/sdk/anchor',
    description: 'Anchor data hash to blockchain',
    request: `{
  "type": "message" | "payment" | "action",
  "hash": "sha256_hash_of_data",
  "metadata": { ... }
}`,
    response: `{
  "receiptId": "unique_receipt_id",
  "txHash": "0x...",
  "timestamp": 1700000000
}`
  },
  {
    name: 'Batch Anchor',
    method: 'POST',
    endpoint: '/api/sdk/anchor/batch',
    description: 'Anchor multiple proofs efficiently',
    request: `{
  "items": [
    { "type": "action", "hash": "...", "metadata": {} }
  ]
}`,
    response: `{
  "receipts": [...],
  "batchId": "batch_id"
}`
  },
  {
    name: 'Check Status',
    method: 'GET',
    endpoint: '/api/sdk/anchor/status/:receiptId',
    description: 'Verify anchor status on-chain',
    request: 'GET /api/sdk/anchor/status/abc123',
    response: `{
  "confirmed": true,
  "blockNumber": 12345678,
  "txHash": "0x..."
}`
  }
];

const sessionApiEndpoints = [
  {
    name: 'Resume Session',
    method: 'POST',
    endpoint: '/api/sdk/session/resume',
    description: 'Resume wallet session with signature',
    request: `{
  "wallet": "0x...",
  "signature": "signed_challenge",
  "challenge": "random_challenge"
}`,
    response: `{
  "token": "jwt_session_token",
  "expiresAt": 1700000000
}`
  },
  {
    name: 'Session Info',
    method: 'GET',
    endpoint: '/api/sdk/session/info',
    description: 'Get current session details',
    request: 'Authorization: Bearer <token>',
    response: `{
  "wallet": "0x...",
  "roles": ["user"],
  "expiresAt": 1700000000
}`
  }
];

const enterpriseApiEndpoints = [
  {
    category: 'Authentication & Identity',
    icon: Key,
    color: 'text-purple-400',
    endpoints: [
      { name: 'Login', method: 'POST', endpoint: '/api/auth/login', description: 'Issue JWT session token', params: 'wallet, signature, challenge', response: '{ token, expiresAt }' },
      { name: 'Logout', method: 'POST', endpoint: '/api/auth/logout', description: 'Terminate active session', params: 'Authorization header', response: '{ success }' },
      { name: 'Refresh Token', method: 'POST', endpoint: '/api/auth/refresh', description: 'Extend session without re-auth', params: 'refreshToken', response: '{ token, expiresAt }' },
      { name: 'Introspect', method: 'GET', endpoint: '/api/auth/introspect', description: 'Validate token state and claims', params: 'Authorization header', response: '{ valid, wallet, roles, exp }' },
      { name: 'User Profile', method: 'GET', endpoint: '/api/users/:id', description: 'Fetch or update user profile', params: 'id', response: '{ wallet, displayName, avatar, roles }' },
      { name: 'Roles', method: 'GET', endpoint: '/api/roles', description: 'List available roles', params: 'tenantId', response: '{ roles: Role[] }' }
    ]
  },
  {
    category: 'Data & Storage',
    icon: Database,
    color: 'text-blue-400',
    endpoints: [
      { name: 'Upload File', method: 'POST', endpoint: '/api/files/upload', description: 'Binary/file ingestion to IPFS', params: 'file (multipart), encrypt', response: '{ cid, size, mimeType }' },
      { name: 'Download File', method: 'GET', endpoint: '/api/files/download/:id', description: 'Retrieve file by CID', params: 'id, decryptToken', response: 'Binary stream' },
      { name: 'File Metadata', method: 'GET', endpoint: '/api/files/metadata/:id', description: 'Query/update file metadata', params: 'id', response: '{ cid, name, size, uploadedAt }' },
      { name: 'Query Datasets', method: 'POST', endpoint: '/api/datasets/query', description: 'Structured query endpoint', params: 'collection, filter, limit', response: '{ items, total, cursor }' },
      { name: 'Dataset CRUD', method: 'GET/POST/PUT/DELETE', endpoint: '/api/datasets/:id', description: 'Dataset lifecycle operations', params: 'id, data', response: '{ dataset }' }
    ]
  },
  {
    category: 'Messaging & Collaboration',
    icon: Send,
    color: 'text-cyan-400',
    endpoints: [
      { name: 'Send Message', method: 'POST', endpoint: '/api/messages/send', description: 'Direct or channel message', params: 'to, content, encrypt, anchor', response: '{ messageId, timestamp, receiptId }' },
      { name: 'Get Message', method: 'GET', endpoint: '/api/messages/:id', description: 'Retrieve message by ID', params: 'id', response: '{ message, sender, timestamp }' },
      { name: 'List Channels', method: 'GET', endpoint: '/api/channels', description: 'List/create channels', params: 'page, limit', response: '{ channels: Channel[] }' },
      { name: 'Channel Members', method: 'GET', endpoint: '/api/channels/:id/members', description: 'Membership management', params: 'id', response: '{ members: Member[] }' },
      { name: 'Notifications', method: 'GET', endpoint: '/api/notifications', description: 'Push/pull notifications', params: 'since, limit', response: '{ notifications: Notification[] }' }
    ]
  },
  {
    category: 'Payments & Transactions',
    icon: DollarSign,
    color: 'text-amber-400',
    endpoints: [
      { name: 'Initiate Payment', method: 'POST', endpoint: '/api/payments/initiate', description: 'Start transaction', params: 'to, amount, currency, memo', response: '{ paymentId, status }' },
      { name: 'Payment Status', method: 'GET', endpoint: '/api/payments/:id/status', description: 'Check transaction state', params: 'id', response: '{ status, txHash, confirmedAt }' },
      { name: 'Refund', method: 'POST', endpoint: '/api/payments/refund', description: 'Reverse transaction', params: 'paymentId, reason', response: '{ refundId, status }' },
      { name: 'Wallet Balance', method: 'GET', endpoint: '/api/wallets/:id', description: 'Wallet balance and history', params: 'id', response: '{ balance, history: Tx[] }' },
      { name: 'Invoice', method: 'GET', endpoint: '/api/invoices/:id', description: 'Invoice lifecycle', params: 'id', response: '{ invoice, items, total, status }' }
    ]
  },
  {
    category: 'Governance',
    icon: Gavel,
    color: 'text-rose-400',
    endpoints: [
      { name: 'List Policies', method: 'GET', endpoint: '/api/policies', description: 'List/create governance policies', params: 'tenantId, type', response: '{ policies: Policy[] }' },
      { name: 'Policy Details', method: 'GET', endpoint: '/api/policies/:id', description: 'Get policy configuration', params: 'id', response: '{ policy, rules, actions }' },
      { name: 'Audit Logs', method: 'GET', endpoint: '/api/audit/logs', description: 'Compliance/audit trail', params: 'from, to, type, wallet', response: '{ logs: AuditEntry[] }' }
    ]
  },
  {
    category: 'Health & Status',
    icon: Activity,
    color: 'text-emerald-400',
    endpoints: [
      { name: 'Health Check', method: 'GET', endpoint: '/api/health', description: 'System health check', params: 'none', response: '{ status, uptime }' },
      { name: 'Service Status', method: 'GET', endpoint: '/api/status', description: 'Service availability', params: 'none', response: '{ services: ServiceStatus[] }' }
    ]
  },
  {
    category: 'Enterprise: API Keys',
    icon: Key,
    color: 'text-indigo-400',
    endpoints: [
      { name: 'Create API Key', method: 'POST', endpoint: '/api/enterprise/api-keys/create', description: 'Generate scoped API key for your app', params: 'name, scopes[], expiresAt', response: '{ keyId, secret, scopes }' },
      { name: 'List API Keys', method: 'GET', endpoint: '/api/enterprise/api-keys/list', description: 'List your API keys', params: 'page, limit', response: '{ keys: ApiKey[] }' },
      { name: 'Revoke API Key', method: 'POST', endpoint: '/api/enterprise/api-keys/revoke', description: 'Revoke an API key', params: 'keyId', response: '{ revoked, revokedAt }' }
    ]
  },
  {
    category: 'Enterprise: Privacy & GDPR',
    icon: Shield,
    color: 'text-teal-400',
    endpoints: [
      { name: 'Privacy Requests', method: 'GET', endpoint: '/api/enterprise/privacy', description: 'List GDPR/CCPA requests for your app', params: 'status, type', response: '{ requests: PrivacyRequest[] }' },
      { name: 'Process Request', method: 'POST', endpoint: '/api/enterprise/privacy/:id/process', description: 'Execute data deletion/export', params: 'id, action', response: '{ processed, exportUrl }' },
      { name: 'Export User Data', method: 'GET', endpoint: '/api/enterprise/privacy/export', description: 'GDPR data export', params: 'wallet, format', response: '{ downloadUrl }' }
    ]
  },
  {
    category: 'Enterprise: Billing & Tiers',
    icon: CreditCard,
    color: 'text-amber-400',
    endpoints: [
      { name: 'List Tiers', method: 'GET', endpoint: '/api/enterprise/billing/tiers', description: 'Available subscription tiers', params: 'none', response: '{ tiers: Tier[] }' },
      { name: 'Current Usage', method: 'GET', endpoint: '/api/enterprise/billing/usage', description: 'Your current usage stats', params: 'period', response: '{ anchors, messages, storage }' }
    ]
  },
  {
    category: 'Enterprise: Guardian Controls',
    icon: Shield,
    color: 'text-rose-400',
    endpoints: [
      { name: 'Circuit Breaker', method: 'POST', endpoint: '/api/enterprise/guardian/circuit', description: 'Emergency pause transactions', params: 'action: pause|resume', response: '{ status, txHash }' },
      { name: 'Timelock', method: 'POST', endpoint: '/api/enterprise/guardian/timelock', description: 'Delayed execution for high-value ops', params: 'action, delay, params', response: '{ timelockId, executeAt }' }
    ]
  },
  {
    category: 'Enterprise: SSO Integration',
    icon: Key,
    color: 'text-purple-400',
    endpoints: [
      { name: 'SSO Config', method: 'GET', endpoint: '/api/enterprise/sso/config', description: 'Get your SSO configuration', params: 'none', response: '{ provider, clientId, domain }' },
      { name: 'Update SSO', method: 'PUT', endpoint: '/api/enterprise/sso/config', description: 'Configure SAML/OIDC provider', params: 'provider, clientId, secret, domain', response: '{ updated, provider }' }
    ]
  }
];

const launcherApiEndpoints = [
  {
    category: 'Registry Discovery',
    icon: Grid3X3,
    color: 'text-emerald-400',
    endpoints: [
      { name: 'Full Registry', method: 'GET', endpoint: '/api/sdk/registry', description: 'Get complete registry with apps, endpoints, routes', params: 'none', response: '{ apps, endpoints, routes, version, buildTime }' },
      { name: 'List Apps', method: 'GET', endpoint: '/api/sdk/registry/apps', description: 'List all registered apps', params: 'none', response: '{ apps[] }' },
      { name: 'App Details', method: 'GET', endpoint: '/api/sdk/registry/apps/:appId', description: 'Get app with its endpoints and routes', params: 'appId', response: '{ app, endpoints[], routes[] }' },
      { name: 'Filter Endpoints', method: 'GET', endpoint: '/api/sdk/registry/endpoints', description: 'Filter endpoints by app, scope, or search', params: 'app?, scope?, search?', response: '{ endpoints[] }' },
      { name: 'Filter Routes', method: 'GET', endpoint: '/api/sdk/registry/routes', description: 'Filter routes by app', params: 'app?', response: '{ routes[] }' },
      { name: 'Registry Version', method: 'GET', endpoint: '/api/sdk/registry/version', description: 'Get registry metadata', params: 'none', response: '{ version, buildTime, appCount, endpointCount, routeCount }' }
    ]
  },
  {
    category: 'Registered Endpoints (Examples)',
    icon: Zap,
    color: 'text-purple-400',
    endpoints: [
      { name: 'messages.compose', method: 'ENDPOINT', endpoint: 'Invoke via SDK launcher.call()', description: 'Send encrypted message', params: '{ to, body }', response: '{ messageId }' },
      { name: 'messages.list', method: 'ENDPOINT', endpoint: 'Invoke via SDK launcher.call()', description: 'List messages for wallet', params: 'none', response: '{ messages[] }' },
      { name: 'notes.create', method: 'ENDPOINT', endpoint: 'Invoke via SDK launcher.call()', description: 'Create encrypted note', params: '{ title, content }', response: '{ noteId }' },
      { name: 'calls.start', method: 'ENDPOINT', endpoint: 'Invoke via SDK launcher.call()', description: 'Initiate voice/video call', params: '{ to, video }', response: '{ callId, roomId }' },
      { name: 'payments.send', method: 'ENDPOINT', endpoint: 'Invoke via SDK launcher.call()', description: 'Send native token payment', params: '{ to, amount }', response: '{ txHash }' },
      { name: 'anchors.create', method: 'ENDPOINT', endpoint: 'Invoke via SDK launcher.call()', description: 'Anchor proof to blockchain', params: '{ type, hash }', response: '{ receiptId }' }
    ]
  },
  {
    category: 'Manifest Scanner',
    icon: FileSearch,
    color: 'text-amber-400',
    endpoints: [
      { name: 'Submit Manifest', method: 'POST', endpoint: '/api/scanner/manifests/submit', description: 'Submit app manifest for scanning', params: '{ manifest }', response: '{ ok, ticketId, status }' },
      { name: 'Scan Status', method: 'GET', endpoint: '/api/scanner/scan/:ticketId', description: 'Get scan result by ticket', params: 'ticketId', response: '{ ok, result }' },
      { name: 'All Scans', method: 'GET', endpoint: '/api/scanner/scans', description: 'List all scan results (moderation)', params: 'decision?, limit?, offset?', response: '{ ok, results[], total }' },
      { name: 'Approved Registry', method: 'GET', endpoint: '/api/scanner/registry', description: 'Get approved-only registry', params: 'none', response: '{ ok, registry }' },
      { name: 'Approved Manifests', method: 'GET', endpoint: '/api/scanner/approved', description: 'List approved manifests', params: 'none', response: '{ ok, manifests[], count }' },
      { name: 'Audit Log', method: 'GET', endpoint: '/api/scanner/audit', description: 'Get scanner audit trail', params: 'manifestId?, action?, format?', response: '{ ok, entries[], count }' },
      { name: 'Scanner Metrics', method: 'GET', endpoint: '/api/scanner/metrics', description: 'Get scanner statistics', params: 'none', response: '{ ok, metrics }' }
    ]
  }
];

const launcherSdkCode = `import { Launcher, createSession } from '@p3/sdk';

// Create session with initial scopes
const session = createSession('0x...wallet', ['wallet']);

// Initialize launcher with scope request handler
const launcher = new Launcher(session, {
  onScopeRequest: async (missing) => {
    // Prompt user to grant scopes
    return confirm(\`Grant \${missing.join(', ')} scopes?\`);
  }
});

// Discover endpoints matching a query
const endpoints = await launcher.discover('messages');

// Call an endpoint (scopes checked automatically)
const result = await launcher.call('messages.compose', {
  to: '0x...',
  body: 'Hello from the Launcher SDK!'
});

// Navigate to a registered route
await launcher.open('nexus.inbox');`;

const fiveLineDemo = `// Production SDK usage - real API calls
import { P3 } from '@p3-protocol/sdk';

// Initialize with your session
await P3.init();

// Encrypt (calls /api/sdk/crypto/encrypt)
const { cipher } = await P3.SDK.crypto.encrypt("Hello", recipientPubKey);

// Anchor proof (calls /api/sdk/anchor)
const receipt = await P3.proofs.publish("message", { cipher });`;

const anchoredDemo = `// Full encrypted + anchored message flow
const wallet = await P3.wallet();
const pubkey = await P3.SDK.crypto.getPubKey();

// 1. Encrypt message
const { cipher } = await P3.SDK.crypto.encrypt(
  "Confidential: Q4 projections attached",
  recipientPubKey
);

// 2. Anchor for compliance audit trail
const anchor = await P3.proofs.publish("encrypted_message", {
  cipherHash: cipher.slice(0, 64),
  sender: wallet.address
});

// anchor.receiptId is your immutable proof`;

const marketplaceSDKs = [
  {
    name: 'P3EbookSDK',
    description: 'Encrypted ebook marketplace with lending and purchase',
    icon: BookOpen,
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    features: ['Encrypted content delivery', 'Time-limited lending', 'DRM-free purchases', 'Author royalty splits'],
    code: `import { P3Marketplace } from '@p3-protocol/sdk';

const marketplace = new P3Marketplace();

// Browse ebook catalog
const catalog = await marketplace.ebook.getCatalog();

// Purchase an ebook
const { licenseId, decryptToken } = await marketplace.ebook.checkout(assetId);

// Download encrypted content
const { signedUrl } = await marketplace.ebook.download(licenseId, decryptToken);`
  },
  {
    name: 'P3MusicSDK',
    description: 'Streaming music with batch anchors and HLS',
    icon: Music,
    color: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
    features: ['HLS adaptive streaming', 'Batch anchor receipts', 'Artist revenue splits', 'Playlist support'],
    code: `import { P3Marketplace } from '@p3-protocol/sdk';

const marketplace = new P3Marketplace();

// Get trending tracks
const trending = await marketplace.music.getTrending();

// Stream a track (generates anchored receipt)
const { licenseId, decryptToken } = await marketplace.music.stream(assetId);

// Get HLS manifest for playback
const manifest = await marketplace.music.getStreamManifest(assetId, licenseId, decryptToken);`
  },
  {
    name: 'P3VideoSDK',
    description: 'Video rentals and purchases with HLS streaming',
    icon: Video,
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    features: ['Adaptive bitrate HLS', 'Rental periods', 'Purchase to own', 'Creator monetization'],
    code: `import { P3Marketplace } from '@p3-protocol/sdk';

const marketplace = new P3Marketplace();

// Search videos
const results = await marketplace.video.search("documentary");

// Rent a video (48-hour access)
const { licenseId, expiresAt } = await marketplace.video.rent(assetId, 48);

// Or purchase permanently
const purchase = await marketplace.video.purchase(assetId);`
  },
  {
    name: 'P3ArtSDK',
    description: 'Digital art with editions and provenance tracking',
    icon: Palette,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    features: ['Limited editions', 'Provenance chain', 'High-res downloads', 'Collector profiles'],
    code: `import { P3Marketplace } from '@p3-protocol/sdk';

const marketplace = new P3Marketplace();

// Browse gallery
const gallery = await marketplace.art.getCatalog();

// Check edition availability
const edition = await marketplace.art.getEditionStatus(assetId);

// Purchase (mints edition number)
const { licenseId, editionNumber } = await marketplace.art.purchase(assetId);

// Verify provenance chain
const provenance = await marketplace.art.getProvenance(assetId);`
  }
];

const atlasOneApiEndpoints = [
  {
    category: 'Game Development',
    icon: Gamepad2,
    color: 'text-emerald-400',
    endpoints: [
      { name: 'Game Catalog', method: 'GET', endpoint: '/api/atlas-one/catalog?kind=game', description: 'Browse free-to-play games', params: 'genre, platform, search, limit', response: '{ items: Game[], total }' },
      { name: 'Game Details', method: 'GET', endpoint: '/api/atlas-one/catalog/:itemId', description: 'Get game metadata and links', params: 'itemId', response: '{ item: Game }' },
      { name: 'Leaderboards', method: 'GET', endpoint: '/api/gamedeck/leaderboard/:gameId', description: 'Get game leaderboard', params: 'gameId, period, limit', response: '{ entries: Score[] }' },
      { name: 'Submit Score', method: 'POST', endpoint: '/api/gamedeck/leaderboard/submit', description: 'Submit anchored score', params: 'gameId, score, metadata', response: '{ entryId, rank, anchored }' },
      { name: 'Tournaments', method: 'GET', endpoint: '/api/gamedeck/tournaments', description: 'List active tournaments', params: 'gameId, status', response: '{ tournaments: Tournament[] }' },
      { name: 'Mods Catalog', method: 'GET', endpoint: '/api/gamedeck/mods', description: 'Browse game mods', params: 'gameId, source, search', response: '{ mods: Mod[] }' },
    ]
  },
  {
    category: 'Shopping & Commerce',
    icon: Store,
    color: 'text-amber-400',
    endpoints: [
      { name: 'Product Catalog', method: 'GET', endpoint: '/api/atlas-one/products', description: 'Browse products with dual-mode', params: 'category, search, limit', response: '{ products: Product[] }' },
      { name: 'Dual-Mode Card', method: 'GET', endpoint: '/api/atlas-one/products/:productId/card', description: 'Get product with purchase options', params: 'productId', response: '{ product, purchaseModes, ctaOptions }' },
      { name: 'Anchored Purchase', method: 'POST', endpoint: '/api/atlas-one/products/purchase/anchored', description: 'Buy with wallet receipt', params: 'productId, priceWei', response: '{ receiptId, txHash, mode: "anchored" }' },
      { name: 'Browser Purchase', method: 'POST', endpoint: '/api/atlas-one/products/purchase/browser', description: 'Log merchant checkout', params: 'productId, merchantUrl, priceFiat', response: '{ logId, mode: "browser" }' },
      { name: 'Ingest Product', method: 'POST', endpoint: '/api/atlas-one/products/ingest', description: 'Add product from external API', params: 'ProductManifest', response: '{ itemId, slug }' },
      { name: 'Purchase History', method: 'GET', endpoint: '/api/atlas-one/products/purchases/browser', description: 'Get browser purchase logs', params: 'limit', response: '{ purchases: BrowserPurchase[] }' },
    ]
  },
  {
    category: 'Entertainment & Media',
    icon: Video,
    color: 'text-rose-400',
    endpoints: [
      { name: 'Video Catalog', method: 'GET', endpoint: '/api/atlas-one/catalog?kind=video', description: 'Browse movies, TV, live streams', params: 'category, search, limit', response: '{ items: Video[], total }' },
      { name: 'Ebook Catalog', method: 'GET', endpoint: '/api/atlas-one/catalog?kind=ebook', description: 'Browse public domain ebooks', params: 'author, subject, search', response: '{ items: Ebook[], total }' },
      { name: 'Rent Media', method: 'POST', endpoint: '/api/atlas-one/commerce/rent', description: '48hr media rental', params: 'itemId, hours', response: '{ rentalId, expiresAt, accessToken }' },
      { name: 'Purchase Media', method: 'POST', endpoint: '/api/atlas-one/commerce/purchase', description: 'Buy permanent access', params: 'itemId, priceWei', response: '{ purchaseId, accessToken }' },
      { name: 'User Library', method: 'GET', endpoint: '/api/atlas-one/library', description: 'Get owned/rented items', params: 'kind, limit', response: '{ items: LibraryItem[] }' },
      { name: 'Continue Watching', method: 'GET', endpoint: '/api/atlas-one/library/continue', description: 'Items with saved progress', params: 'limit', response: '{ items: ContinueItem[] }' },
    ]
  },
  {
    category: 'Content Sync (Admin)',
    icon: Database,
    color: 'text-indigo-400',
    endpoints: [
      { name: 'Full Sync', method: 'POST', endpoint: '/api/atlas-one/sync/full', description: 'Sync all content sources', params: 'none', response: '{ results: SyncResult[], summary }' },
      { name: 'Sync Games', method: 'POST', endpoint: '/api/atlas-one/sync/games', description: 'Sync FreeToGame + GamerPower', params: 'none', response: '{ results, total }' },
      { name: 'Sync Videos', method: 'POST', endpoint: '/api/atlas-one/sync/videos', description: 'Sync OMDB + TMDB + Archive', params: 'none', response: '{ results, total }' },
      { name: 'Sync Live TV', method: 'POST', endpoint: '/api/atlas-one/sync/livetv', description: 'Sync IPTV channels', params: 'none', response: '{ results, total }' },
      { name: 'Sync Internet Archive', method: 'POST', endpoint: '/api/atlas-one/sync/internetarchive', description: 'Sync public domain films', params: 'none', response: '{ fetched, imported, errors }' },
      { name: 'Sync TVMaze', method: 'POST', endpoint: '/api/atlas-one/sync/tvmaze', description: 'Sync TV show metadata', params: 'none', response: '{ fetched, imported, errors }' },
    ]
  }
];

const marketplaceApiEndpoints = [
  {
    category: 'Catalog',
    icon: Store,
    color: 'text-blue-400',
    endpoints: [
      {
        name: 'Get Catalog',
        method: 'GET',
        endpoint: '/api/marketplace/catalog',
        description: 'Browse all available assets',
        params: 'type, page, limit, category',
        response: `{ items: Asset[], total, page }`
      },
      {
        name: 'Search Assets',
        method: 'GET',
        endpoint: '/api/marketplace/catalog/search',
        description: 'Search by title, author, tags',
        params: 'q, type, limit',
        response: `{ items: Asset[], total }`
      },
      {
        name: 'Get Asset',
        method: 'GET',
        endpoint: '/api/marketplace/catalog/:assetId',
        description: 'Get single asset details',
        params: 'assetId',
        response: `{ asset: Asset }`
      }
    ]
  },
  {
    category: 'Gate (Licensing)',
    icon: Ticket,
    color: 'text-purple-400',
    endpoints: [
      {
        name: 'Checkout (Purchase)',
        method: 'POST',
        endpoint: '/api/marketplace/gate/checkout',
        description: 'Purchase permanent license',
        params: 'assetId, appId, anchor',
        response: `{ licenseId, decryptToken, receiptDigest }`
      },
      {
        name: 'Stream Access',
        method: 'POST',
        endpoint: '/api/marketplace/gate/stream',
        description: 'Get streaming license',
        params: 'assetId, appId, anchor',
        response: `{ licenseId, decryptToken, expiresAt }`
      },
      {
        name: 'Borrow (Rental)',
        method: 'POST',
        endpoint: '/api/marketplace/gate/borrow',
        description: 'Time-limited access',
        params: 'assetId, appId, days, anchor',
        response: `{ licenseId, expiresAt, decryptToken }`
      }
    ]
  },
  {
    category: 'Content Delivery',
    icon: Play,
    color: 'text-emerald-400',
    endpoints: [
      {
        name: 'Download',
        method: 'GET',
        endpoint: '/api/marketplace/content/download',
        description: 'Get signed download URL',
        params: 'licenseId (+ Bearer token)',
        response: `{ signedUrl, expiresAt }`
      },
      {
        name: 'Stream Manifest',
        method: 'GET',
        endpoint: '/api/marketplace/content/stream/manifest',
        description: 'Get HLS manifest for playback',
        params: 'assetId, licenseId (+ Bearer token)',
        response: `{ manifestUrl, segments[], quality }`
      },
      {
        name: 'Stream Segment',
        method: 'GET',
        endpoint: '/api/marketplace/content/stream/segment',
        description: 'Get signed segment URL',
        params: 'assetId, licenseId, segmentId',
        response: `{ signedUrl }`
      }
    ]
  },
  {
    category: 'Explorer (Receipts)',
    icon: Receipt,
    color: 'text-cyan-400',
    endpoints: [
      {
        name: 'Receipt Feed',
        method: 'GET',
        endpoint: '/api/marketplace/explorer/feed',
        description: 'Get transaction history',
        params: 'assetId, authorWallet, buyerWallet, page',
        response: `{ items: Receipt[], total }`
      },
      {
        name: 'Asset Provenance',
        method: 'GET',
        endpoint: '/api/marketplace/explorer/asset/:assetId',
        description: 'Full ownership chain',
        params: 'assetId',
        response: `{ provenance: Receipt[] }`
      },
      {
        name: 'Verify Receipt',
        method: 'POST',
        endpoint: '/api/marketplace/explorer/verify',
        description: 'Verify anchored receipt',
        params: 'digest',
        response: `{ valid, found, receipt }`
      }
    ]
  },
  {
    category: 'Treasury',
    icon: DollarSign,
    color: 'text-amber-400',
    endpoints: [
      {
        name: 'Initialize Treasury',
        method: 'POST',
        endpoint: '/api/marketplace/treasury/init',
        description: 'Set up creator earnings',
        params: 'payoutWallet, sponsorPolicy, splitDefault',
        response: `{ authorId, treasuryConfig }`
      },
      {
        name: 'Get Statement',
        method: 'GET',
        endpoint: '/api/marketplace/treasury/statement',
        description: 'Earnings and payouts',
        params: '(Bearer token)',
        response: `{ totalEarned, pending, settlements[] }`
      }
    ]
  }
];

const manifestRegistryCode = `// Discover available marketplaces
const manifests = await fetch('/api/marketplace/manifest').then(r => r.json());

// Each manifest contains:
// - id: unique marketplace identifier
// - name: display name
// - types: supported asset types (ebook, music, video, art)
// - endpoints: available API routes
// - version: API version

// Get specific marketplace manifest
const ebookMarket = await fetch('/api/marketplace/manifest/ebook-market').then(r => r.json());
console.log(ebookMarket);
// { id: "ebook-market", name: "P3 Ebook Store", types: ["ebook"], ... }`;

const fullMarketplaceExample = `import { P3Marketplace } from '@p3-protocol/sdk';

// Initialize marketplace SDK
const marketplace = new P3Marketplace({
  baseUrl: 'https://your-p3-instance.com',
  token: sessionToken, // optional, for authenticated calls
});

// ===== EBOOK WORKFLOW =====
// 1. Browse catalog
const ebooks = await marketplace.ebook.getCatalog({ category: 'fiction' });

// 2. Purchase ebook
const { licenseId, decryptToken, receiptDigest } = await marketplace.ebook.checkout(
  ebooks.items[0].id,
  true // anchor receipt on-chain
);

// 3. Download for offline reading
const { signedUrl } = await marketplace.ebook.download(licenseId, decryptToken);

// ===== MUSIC STREAMING =====
// 1. Stream track (auto-generates usage receipt)
const stream = await marketplace.music.stream(trackId);

// 2. Get HLS manifest for player
const manifest = await marketplace.music.getStreamManifest(
  trackId, 
  stream.licenseId, 
  stream.decryptToken
);
// Use manifest.manifestUrl with HLS.js or native player

// ===== VIDEO RENTAL =====
// 1. Rent for 48 hours
const rental = await marketplace.video.rent(movieId, 48);
console.log(\`Access expires: \${new Date(rental.expiresAt)}\`);

// ===== ART COLLECTION =====
// 1. Check edition availability
const editions = await marketplace.art.getEditionStatus(artworkId);
console.log(\`\${editions.available} of \${editions.total} editions remaining\`);

// 2. Purchase limited edition
const { editionNumber } = await marketplace.art.purchase(artworkId);
console.log(\`You own edition #\${editionNumber}\`);

// 3. View full provenance chain
const provenance = await marketplace.art.getProvenance(artworkId);`;

const crossChainSettlementEndpoints = [
  {
    name: 'Settle Action',
    method: 'POST',
    endpoint: '/api/protocol/settlement/settle',
    description: 'Process cross-chain fee settlement for any protocol action',
    request: `{
  "actionId": "call:abc123",
  "actionType": "call",
  "walletAddress": "0x...",
  "settleMode": "RELAY_LZ",
  "originChain": "polygon",
  "quantity": 15
}`,
    response: `{
  "success": true,
  "settlementId": "settle:1700...",
  "feeUsd": 0.15,
  "txHashBase": "lz:call:109:...",
  "relayStatus": "pending",
  "anchorDigest": "abc123..."
}`
  },
  {
    name: 'Get Fee',
    method: 'GET',
    endpoint: '/api/protocol/settlement/fee/:actionType',
    description: 'Get fee details for a specific action type',
    request: 'GET /api/protocol/settlement/fee/call?quantity=10',
    response: `{
  "actionType": "call",
  "baseFeeUsd": 0.01,
  "unit": "per_minute",
  "calculatedFeeUsd": 0.10,
  "isSettlementRequired": true
}`
  },
  {
    name: 'List All Fees',
    method: 'GET',
    endpoint: '/api/protocol/settlement/fees',
    description: 'Get complete fee schedule for all action types',
    request: 'GET /api/protocol/settlement/fees',
    response: `{
  "fees": [
    { "actionType": "call", "baseFeeUsd": 0.01, ... },
    { "actionType": "anchor", "baseFeeUsd": 0.57, ... }
  ]
}`
  },
  {
    name: 'Check Required',
    method: 'GET',
    endpoint: '/api/protocol/settlement/required/:actionType',
    description: 'Check if settlement is required for an action',
    request: 'GET /api/protocol/settlement/required/governance',
    response: `{
  "actionType": "governance",
  "required": false,
  "reason": "Governance votes are free"
}`
  },
  {
    name: 'Settlement Status',
    method: 'GET',
    endpoint: '/api/protocol/settlement/status/:settlementId',
    description: 'Check status of a pending settlement',
    request: 'GET /api/protocol/settlement/status/settle:1700...',
    response: `{
  "settlementId": "settle:1700...",
  "status": "confirmed",
  "txHashBase": "0x...",
  "confirmedAt": 1700000000
}`
  },
  {
    name: 'Supported Chains',
    method: 'GET',
    endpoint: '/api/protocol/settlement/chains',
    description: 'List all supported origin chains',
    request: 'GET /api/protocol/settlement/chains',
    response: `{
  "chains": [
    { "id": "base", "name": "Base", "relayModes": ["BASE_USDC", "BASE_DIRECT"] },
    { "id": "polygon", "name": "Polygon", "relayModes": ["RELAY_LZ", "RELAY_WH"] }
  ]
}`
  },
  {
    name: 'Estimate Settlement',
    method: 'POST',
    endpoint: '/api/protocol/settlement/estimate',
    description: 'Estimate fees and gas for a settlement',
    request: `{
  "actionType": "anchor",
  "settleMode": "RELAY_WH",
  "originChain": "solana"
}`,
    response: `{
  "feeUsd": 0.57,
  "estimatedGas": 0.0015,
  "estimatedTime": "~20 minutes"
}`
  },
  {
    name: 'List Actions',
    method: 'GET',
    endpoint: '/api/protocol/settlement/actions',
    description: 'List all supported protocol actions',
    request: 'GET /api/protocol/settlement/actions',
    response: `{
  "actions": ["call", "message", "anchor", "governance", "marketplace", "storage"]
}`
  }
];

const settlementModes = [
  {
    mode: 'BASE_USDC',
    name: 'Direct USDC on Base',
    description: 'Pay fees directly in USDC on Base network. Fastest settlement with instant confirmation.',
    icon: CircleDollarSign,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    estimatedTime: 'Instant',
    gasEstimate: '~$0.01'
  },
  {
    mode: 'BASE_DIRECT',
    name: 'Native ETH on Base',
    description: 'Pay fees in native ETH on Base. Automatically converts to USDC for treasury.',
    icon: Wallet,
    color: 'from-purple-500 to-violet-600',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    estimatedTime: 'Instant',
    gasEstimate: '~$0.01'
  },
  {
    mode: 'RELAY_LZ',
    name: 'LayerZero Cross-Chain',
    description: 'Relay fees from any LayerZero-supported chain (Ethereum, Polygon, Arbitrum, etc.) to Base.',
    icon: Layers,
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    estimatedTime: '~15 minutes',
    gasEstimate: '~$0.001 + source gas'
  },
  {
    mode: 'RELAY_WH',
    name: 'Wormhole Cross-Chain',
    description: 'Relay fees via Wormhole bridge. Supports Solana and other non-EVM chains.',
    icon: Globe,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    estimatedTime: '~20 minutes',
    gasEstimate: '~$0.0015 + source gas'
  }
];

const feeSchedule = [
  { actionType: 'anchor', fee: '$0.57', unit: 'per anchor', description: 'P3 Protocol fee for blockchain anchoring', icon: Anchor, isFree: false, isProtocolFee: true },
  { actionType: 'call', fee: 'Dev-set', unit: 'per minute', description: 'Example: Video/voice call fees (you set)', icon: Video, isFree: false, isProtocolFee: false },
  { actionType: 'message', fee: 'Dev-set', unit: 'per message', description: 'Example: Encrypted message fees (you set)', icon: Send, isFree: true, isProtocolFee: false },
  { actionType: 'governance', fee: 'Free', unit: 'per vote', description: 'DAO governance votes', icon: Vote, isFree: true, isProtocolFee: false },
  { actionType: 'marketplace', fee: 'Dev-set', unit: 'per transaction', description: 'Example: Marketplace fee (you set)', icon: Store, isFree: false, isProtocolFee: false },
  { actionType: 'storage', fee: 'Dev-set', unit: 'per MB', description: 'Example: IPFS storage fee (you set)', icon: HardDrive, isFree: false, isProtocolFee: false }
];

const crossChainCodeExamples = {
  settleVideoCall: `// Settle a video call fee from Polygon
import { P3Settlement } from '@p3-protocol/sdk';

const settlement = new P3Settlement();

// 15-minute video call from Polygon
const result = await settlement.settle({
  actionId: "call:session-abc123",
  actionType: "call",
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f...",
  settleMode: "RELAY_LZ",     // LayerZero relay from Polygon
  originChain: "polygon",
  quantity: 15,               // 15 minutes
  metadata: {
    sessionId: "video-session-123",
    participants: 2
  }
});

console.log("Settlement ID:", result.settlementId);
console.log("Fee:", result.feeUsd, "USD");
console.log("Relay Status:", result.relayStatus);  // "pending" until confirmed on Base`,

  anchorWithSettlement: `// Anchor an event with cross-chain settlement from Solana
import { P3Settlement, P3Anchor } from '@p3-protocol/sdk';

const settlement = new P3Settlement();
const anchor = new P3Anchor();

// First, settle the anchoring fee via Wormhole
const fee = await settlement.settle({
  actionId: "anchor:event-" + Date.now(),
  actionType: "anchor",
  walletAddress: "0x...",
  settleMode: "RELAY_WH",     // Wormhole bridge from Solana
  originChain: "solana"
});

// Wait for settlement confirmation
if (fee.success) {
  // Now anchor the proof
  const proof = await anchor.publish({
    type: "event",
    data: {
      eventType: "conference_registration",
      attendee: "0x...",
      ticketId: "TKT-2024-001"
    },
    settlementId: fee.settlementId  // Link to fee settlement
  });
  
  console.log("Anchor CID:", proof.cid);
  console.log("TX Hash:", proof.txHash);
}`,

  checkFee: `// Check fee for any action type
import { P3Settlement } from '@p3-protocol/sdk';

const settlement = new P3Settlement();

// Get fee details for a 30-minute call
const callFee = await settlement.getFee("call", 30);
console.log("30-min call fee:", callFee.calculatedFeeUsd, "USD");
// Output: "30-min call fee: 0.30 USD"

// Check if settlement is required
const govRequired = await settlement.isRequired("governance");
console.log("Governance requires settlement:", govRequired);
// Output: "Governance requires settlement: false"

// Estimate cross-chain settlement
const estimate = await settlement.estimate({
  actionType: "anchor",
  settleMode: "RELAY_LZ",
  originChain: "arbitrum"
});
console.log("Estimated gas:", estimate.estimatedGas, "ETH");
console.log("Estimated time:", estimate.estimatedTime);`
};

const settlementFlowDiagram = `
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CROSS-CHAIN SETTLEMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐        ┌──────────────┐        ┌──────────────────────┐
  │ SOURCE CHAIN │   ──▶  │   P3 API     │   ──▶  │ SETTLEMENT SERVICE   │
  │              │        │              │        │                      │
  │  • Polygon   │        │  /settle     │        │  • Fee calculation   │
  │  • Arbitrum  │        │  /estimate   │        │  • Mode selection    │
  │  • Solana    │        │  /status     │        │  • Relay dispatch    │
  │  • Ethereum  │        │              │        │                      │
  └──────────────┘        └──────────────┘        └──────────────────────┘
         │                                                   │
         │                                                   ▼
         │                                        ┌──────────────────────┐
         │                                        │    RELAY BRIDGE      │
         │                                        │                      │
         │                                        │  • LayerZero (LZ)    │
         │                                        │  • Wormhole (WH)     │
         │                                        │  • Direct (Base)     │
         │                                        └──────────────────────┘
         │                                                   │
         ▼                                                   ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │                         BASE NETWORK                                  │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │   ┌──────────────────┐              ┌──────────────────┐            │
  │   │  BASE TREASURY   │     ──▶      │  ANCHOR RECEIPT  │            │
  │   │                  │              │                  │            │
  │   │  • USDC deposit  │              │  • Settlement ID │            │
  │   │  • Fee tracking  │              │  • Action proof  │            │
  │   │  • Payout splits │              │  • TX hash       │            │
  │   └──────────────────┘              └──────────────────┘            │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ SETTLEMENT MODES                                                        │
  ├─────────────────────────────────────────────────────────────────────────┤
  │ BASE_USDC   │ Direct USDC on Base          │ Instant    │ ~$0.01       │
  │ BASE_DIRECT │ Native ETH on Base           │ Instant    │ ~$0.01       │
  │ RELAY_LZ    │ LayerZero (EVM chains)       │ ~15 min    │ ~$0.001+     │
  │ RELAY_WH    │ Wormhole (Solana + EVM)      │ ~20 min    │ ~$0.0015+    │
  └─────────────────────────────────────────────────────────────────────────┘
`;

export default function SDKPage() {
  const [, setLocation] = useLocation();
  const [accessState, setAccessState] = useState<'checking' | 'granted' | 'needs_anchor' | 'anchoring'>('checking');
  const [anchorResult, setAnchorResult] = useState<SDKDownloadAnchor | null>(null);
  const [anchorError, setAnchorError] = useState<string | null>(null);
  
  useAutoPopout({ isPrimaryRoute: true }); // SDK is a primary entry point

  useEffect(() => {
    const checkAccess = async () => {
      const session = getSession();
      if (!session?.connected || !session?.address) {
        setAccessState('needs_anchor');
        return;
      }
      
      // Check if already anchored (localStorage)
      const anchorKey = `sdk_anchor_${session.address.toLowerCase()}`;
      const existingAnchor = localStorage.getItem(anchorKey);
      if (existingAnchor) {
        try {
          const parsed = JSON.parse(existingAnchor);
          if (parsed.success && parsed.timestamp > Date.now() - 30 * 24 * 60 * 60 * 1000) { // 30 days
            setAnchorResult(parsed);
            setAccessState('granted');
            return;
          }
        } catch {}
      }
      
      // Also check legacy ticket for backwards compatibility
      try {
        const ticketInfo = await P3.ticket.check(session.address, ['sdk:read', 'sdk:download']);
        if (ticketInfo.hasAccess) {
          setAccessState('granted');
          return;
        }
      } catch {}
      
      setAccessState('needs_anchor');
    };

    checkAccess();
  }, []);

  const handleAnchorAccess = async () => {
    setAccessState('anchoring');
    setAnchorError(null);
    
    try {
      const result = await anchorSDKDownload('2.0.0');
      
      if (result.success) {
        setAnchorResult(result);
        // Save to localStorage
        if (result.wallet) {
          localStorage.setItem(`sdk_anchor_${result.wallet}`, JSON.stringify(result));
        }
        setAccessState('granted');
      } else {
        setAnchorError(result.error || 'Anchor failed');
        setAccessState('needs_anchor');
      }
    } catch (error: any) {
      setAnchorError(error.message || 'Unexpected error');
      setAccessState('needs_anchor');
    }
  };

  if (accessState === 'checking') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Checking SDK access...</p>
        </div>
      </div>
    );
  }

  if (accessState === 'anchoring') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
        <Card className="relative z-10 max-w-md w-full bg-slate-900/80 border-slate-700/50 backdrop-blur-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Anchoring Checkpoint...</h1>
          <p className="text-slate-400 mb-4">
            Creating your access checkpoint on Base Sepolia testnet.
          </p>
          <p className="text-xs text-slate-500">
            This unlocks full SDK documentation and API access.
          </p>
        </Card>
      </div>
    );
  }

  if (accessState === 'needs_anchor') {
    const session = getSession();
    const hasWallet = session?.connected && session?.address;
    
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
        <Card className="relative z-10 max-w-md w-full bg-slate-900/80 border-slate-700/50 backdrop-blur-xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Anchor className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Developer Kit</h1>
          <p className="text-slate-400 mb-6">
            {hasWallet 
              ? 'Anchor a checkpoint on Base Sepolia to unlock the SDK.'
              : 'Connect your wallet first, then return here to anchor.'
            }
          </p>
          
          {anchorError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              <p className="font-medium mb-1">{anchorError}</p>
              <p className="text-xs text-red-400/80 mt-2">
                Tip: If using a wallet app browser, try opening in Chrome/Safari instead.
              </p>
            </div>
          )}
          
          {hasWallet ? (
            <Button
              onClick={handleAnchorAccess}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white"
              data-testid="button-anchor-sdk-access"
            >
              <Anchor className="w-4 h-4 mr-2" />
              Anchor Checkpoint
            </Button>
          ) : (
            <Button
              onClick={() => setLocation('/launcher')}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
              data-testid="button-connect-wallet-first"
            >
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet in Hub
            </Button>
          )}
          
          <p className="text-xs text-slate-500 mt-4">
            {hasWallet 
              ? 'Your wallet will switch to Base Sepolia testnet.'
              : 'Connect your wallet in the Hub, then return here to anchor.'
            }
          </p>
          
          <Button
            variant="ghost"
            onClick={() => setLocation('/launcher')}
            className="w-full mt-3 text-slate-400 hover:text-white"
            data-testid="button-back-to-hub"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hub
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-1">
            <Button
              data-testid="button-back-launcher"
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white hover:bg-white/10"
              title="Back to Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button
              data-testid="button-home"
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <Globe className="w-4 h-4 mr-1.5" />
              Home
            </Button>
          </div>
          <P3HubLogo className="w-20 text-white" />
          <div className="ml-auto flex items-center gap-2">
            {anchorResult?.txHash && (
              <a
                href={`${SDK_CONTRACTS.testnet.explorer}/tx/${anchorResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-700/50 border border-slate-600/30 text-xs text-slate-400 hover:text-white transition-colors"
                data-testid="link-anchor-receipt"
              >
                <Anchor className="w-3 h-3" />
                <span className="hidden sm:inline">Receipt</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">Developer Access</span>
            </div>
          </div>
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-6">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">Substrate Mesh APIs</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            P3 Protocol SDK
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-3">
            Build on the Web3 substrate mesh — interconnect apps, share identity, anchor trust.
          </p>
          <p className="text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Advanced encryption, manifest-driven routing, and programmable governance. 
            From isolated dApps to a unified mesh ecosystem. App → OS → Mesh.
          </p>
          
          {/* Quick Start Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <a
              href="/api/sdk/download"
              download="p3-protocol-sdk.zip"
              data-testid="button-download-starter"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Download Starter Kit
            </a>
            <a
              href="#api-reference"
              data-testid="button-view-apis"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-medium transition-all border border-white/10"
            >
              <Code2 className="w-4 h-4" />
              View API Reference
            </a>
            <a
              href="#marketplace-sdk"
              data-testid="button-view-marketplace-sdk"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              <Store className="w-4 h-4" />
              Marketplace SDKs
            </a>
            <a
              href="#cross-chain-settlement"
              data-testid="button-view-cross-chain"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Cross-Chain Settlement
            </a>
            <a
              href="#enterprise-api"
              data-testid="button-view-platform-api"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              <Building className="w-4 h-4" />
              Platform APIs
            </a>
            <a
              href="#programmable-launcher"
              data-testid="button-view-launcher-api"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white px-6 py-3 rounded-lg font-medium transition-all"
            >
              <Grid3X3 className="w-4 h-4" />
              Programmable Launcher
            </a>
          </div>
        </section>

        {/* Why API-First - Transparency Section */}
        <section className="mb-16">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/90 to-[#1a1a1a]/70 backdrop-blur-xl border-emerald-500/20">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 via-transparent to-cyan-600/5" />
            <div className="relative p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Why API-First?</h2>
                  <p className="text-sm text-slate-400">A deliberate design choice for your benefit</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Zero Setup
                  </div>
                  <p className="text-sm text-slate-400">
                    No npm install, no build config, no dependency hell. Just call the API and you're live.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-cyan-400 font-semibold mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Server-Side Security
                  </div>
                  <p className="text-sm text-slate-400">
                    Encryption keys never touch the browser. Your users' data is protected by secure server-locked cryptography.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                  <div className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Always Current
                  </div>
                  <p className="text-sm text-slate-400">
                    No version drift. When we upgrade encryption or add features, you get them instantly — no library updates needed.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-slate-300 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">Our philosophy:</span> We built this to make professional-grade security accessible to every developer. 
                  The starter kit gives you TypeScript wrappers and examples. The APIs give you quantum-resilient encryption in one call. 
                  No hidden complexity, no vendor lock-in — just primitives that work.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Getting Started</h2>
            <p className="text-slate-400">Three steps to integrate with Protocol 3</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {gettingStartedSteps.map((item) => {
              const IconComponent = item.icon;
              return (
                <Card 
                  key={item.step}
                  data-testid={`card-getting-started-${item.step}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5 p-6"
                >
                  <div className="absolute top-4 right-4 text-4xl font-bold text-white/5">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                    <IconComponent className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Protocol Primitives</h2>
            <p className="text-slate-400">Core SDK methods for building on P3</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {protocolPrimitives.map((primitive) => {
              const IconComponent = primitive.icon;
              return (
                <Card 
                  key={primitive.method}
                  data-testid={`card-primitive-${primitive.method.replace(/[().,\s]/g, '-')}`}
                  className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${primitive.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-10 h-10 rounded-xl ${primitive.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-5 h-5 ${primitive.textColor}`} />
                      </div>
                      <div>
                        <h3 className="text-base font-mono font-semibold text-white">{primitive.method}</h3>
                        <p className="text-sm text-slate-400">{primitive.description}</p>
                      </div>
                    </div>
                    <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                      <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                        <code>{primitive.code}</code>
                      </pre>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Security Stack Section */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Advanced Security</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Security Stack</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              The security primitives that make developers say "this is what we've been waiting for"
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {securityHighlights.map((item) => {
              const IconComponent = item.icon;
              return (
                <Card 
                  key={item.title}
                  data-testid={`card-security-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-emerald-500/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-6 h-6 ${item.textColor}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Build Your Own Signal Demo */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 mb-4">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-medium">One-Call Simplicity</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Build Your Own Signal in 5 Lines</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              No KMS setup. No infra lock-in. Just quantum-resilient encryption as a service.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 via-transparent to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Basic Encryption</span>
                    <p className="text-xs text-slate-500">Hybrid Kyber + NaCl</p>
                  </div>
                </div>
                <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    <code>{fiveLineDemo}</code>
                  </pre>
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Anchor className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Anchored + Auditable</span>
                    <p className="text-xs text-slate-500">Enterprise compliance ready</p>
                  </div>
                </div>
                <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    <code>{anchoredDemo}</code>
                  </pre>
                </div>
              </div>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-cyan-400 mb-1">5</div>
              <div className="text-xs text-slate-400">Lines of code</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">0</div>
              <div className="text-xs text-slate-400">Keys to manage</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">$0</div>
              <div className="text-xs text-slate-400">Infra overhead</div>
            </div>
          </div>
        </section>

        {/* Plug & Play API Reference */}
        <section id="api-reference" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Production API</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Plug & Play API Reference</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Copy, paste, call. Server-locked encryption through simple REST endpoints. 
              No setup required — just HTTP.
            </p>
          </div>

          {/* Crypto APIs */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              Encryption API
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {cryptoApiEndpoints.map((api) => (
                <Card 
                  key={api.endpoint}
                  data-testid={`api-${api.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-cyan-500/30 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          api.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {api.method}
                        </span>
                        <span className="font-semibold text-white text-sm">{api.name}</span>
                      </div>
                    </div>
                    <code className="block text-xs text-cyan-400 font-mono mb-2 bg-[#0d0d0d] px-2 py-1 rounded">
                      {api.endpoint}
                    </code>
                    <p className="text-xs text-slate-500 mb-3">{api.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500 mb-1">Request</div>
                        <pre className="bg-[#0d0d0d] p-2 rounded text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {api.request}
                        </pre>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Response</div>
                        <pre className="bg-[#0d0d0d] p-2 rounded text-emerald-400/80 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {api.response}
                        </pre>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Anchor APIs */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Anchor className="w-5 h-5 text-purple-400" />
              Anchoring API
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {anchorApiEndpoints.map((api) => (
                <Card 
                  key={api.endpoint}
                  data-testid={`api-anchor-${api.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        api.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {api.method}
                      </span>
                      <span className="font-semibold text-white text-sm">{api.name}</span>
                    </div>
                    <code className="block text-xs text-purple-400 font-mono mb-2 bg-[#0d0d0d] px-2 py-1 rounded">
                      {api.endpoint}
                    </code>
                    <p className="text-xs text-slate-500 mb-3">{api.description}</p>
                    <div className="text-xs">
                      <div className="text-slate-500 mb-1">Response</div>
                      <pre className="bg-[#0d0d0d] p-2 rounded text-emerald-400/80 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                        {api.response}
                      </pre>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Session APIs */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              Session API
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {sessionApiEndpoints.map((api) => (
                <Card 
                  key={api.endpoint}
                  data-testid={`api-session-${api.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-amber-500/30 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        api.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {api.method}
                      </span>
                      <span className="font-semibold text-white text-sm">{api.name}</span>
                    </div>
                    <code className="block text-xs text-amber-400 font-mono mb-2 bg-[#0d0d0d] px-2 py-1 rounded">
                      {api.endpoint}
                    </code>
                    <p className="text-xs text-slate-500 mb-3">{api.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500 mb-1">Request</div>
                        <pre className="bg-[#0d0d0d] p-2 rounded text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {api.request}
                        </pre>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Response</div>
                        <pre className="bg-[#0d0d0d] p-2 rounded text-emerald-400/80 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {api.response}
                        </pre>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* API Note */}
          <Card className="relative overflow-hidden bg-gradient-to-r from-emerald-600/10 via-[#1a1a1a]/80 to-cyan-600/10 border-emerald-500/20">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Server-Locked Security</h4>
                  <p className="text-sm text-slate-400">
                    All cryptographic operations execute server-side. No keys, no algorithms, no attack surface 
                    exposed to the client. This isn't a library you download — it's enterprise encryption as a service.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Cross-Chain Settlement API Section */}
        <section id="cross-chain-settlement" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-4">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium">Cross-Chain Settlement</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Cross-Chain Settlement API</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Users on any chain (Polygon, Arbitrum, Solana, etc.) can access P3 Protocol by settling fees to the Base treasury. 
              Supports LayerZero and Wormhole relays for seamless cross-chain payments.
            </p>
          </div>

          {/* Settlement Modes */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Settlement Modes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settlementModes.map((mode) => {
                const IconComponent = mode.icon;
                return (
                  <Card 
                    key={mode.mode}
                    data-testid={`card-settlement-mode-${mode.mode.toLowerCase()}`}
                    className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-amber-500/30 transition-all duration-300"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                    <div className="relative p-5">
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-xl ${mode.bgColor} flex items-center justify-center flex-shrink-0`}>
                          <IconComponent className={`w-5 h-5 ${mode.textColor}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <code className={`text-sm font-mono font-bold ${mode.textColor}`}>{mode.mode}</code>
                          </div>
                          <h4 className="text-white font-medium mb-1">{mode.name}</h4>
                          <p className="text-xs text-slate-400 mb-3">{mode.description}</p>
                          <div className="flex gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <Timer className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400">{mode.estimatedTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CircleDollarSign className="w-3 h-3 text-slate-500" />
                              <span className="text-slate-400">{mode.gasEstimate}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Fee Schedule Table */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Fee Schedule
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              P3 Protocol only charges the <span className="text-cyan-400 font-semibold">anchor fee</span>. 
              All other fees are examples you can implement in your own app.
            </p>
            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-6 text-slate-300 font-semibold">Action Type</th>
                      <th className="text-left py-4 px-6 text-slate-300 font-semibold">Fee</th>
                      <th className="text-left py-4 px-6 text-slate-300 font-semibold">Unit</th>
                      <th className="text-left py-4 px-6 text-slate-300 font-semibold hidden md:table-cell">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeSchedule.map((item, index) => {
                      const IconComponent = item.icon;
                      const isProtocol = (item as any).isProtocolFee;
                      return (
                        <tr 
                          key={item.actionType}
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === feeSchedule.length - 1 ? 'border-b-0' : ''} ${isProtocol ? 'bg-cyan-500/10' : ''}`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <IconComponent className={`w-4 h-4 ${isProtocol ? 'text-cyan-400' : 'text-slate-400'}`} />
                              <code className={`font-mono ${isProtocol ? 'text-cyan-400' : 'text-amber-400'}`}>{item.actionType}</code>
                              {isProtocol && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-medium">P3 FEE</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`font-semibold ${item.isFree ? 'text-emerald-400' : isProtocol ? 'text-cyan-400' : 'text-slate-400'}`}>
                              {item.fee}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-400">{item.unit}</td>
                          <td className="py-4 px-6 text-slate-500 text-xs hidden md:table-cell">{item.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Protocol Settlement Endpoints */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-cyan-400" />
              Protocol Settlement Endpoints
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {crossChainSettlementEndpoints.map((api) => (
                <Card 
                  key={api.endpoint}
                  data-testid={`api-settlement-${api.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-amber-500/30 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        api.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {api.method}
                      </span>
                      <span className="font-semibold text-white text-sm">{api.name}</span>
                    </div>
                    <code className="block text-xs text-amber-400 font-mono mb-2 bg-[#0d0d0d] px-2 py-1 rounded break-all">
                      {api.endpoint}
                    </code>
                    <p className="text-xs text-slate-500 mb-3">{api.description}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-500 mb-1">Request</div>
                        <pre className="bg-[#0d0d0d] p-2 rounded text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {api.request}
                        </pre>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Response</div>
                        <pre className="bg-[#0d0d0d] p-2 rounded text-emerald-400/80 font-mono overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {api.response}
                        </pre>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Code Examples */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-purple-400" />
              Code Examples
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 via-transparent to-transparent" />
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Video className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-white">Settle Video Call from Polygon</span>
                      <p className="text-xs text-slate-500">LayerZero cross-chain relay</p>
                    </div>
                  </div>
                  <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                    <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                      <code>{crossChainCodeExamples.settleVideoCall}</code>
                    </pre>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-transparent" />
                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Anchor className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-white">Anchor Event from Solana</span>
                      <p className="text-xs text-slate-500">Wormhole bridge settlement</p>
                    </div>
                  </div>
                  <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                    <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                      <code>{crossChainCodeExamples.anchorWithSettlement}</code>
                    </pre>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 mt-6">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-transparent to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <CircleDollarSign className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Check Fee for Action Type</span>
                    <p className="text-xs text-slate-500">Get fees, check requirements, estimate settlement</p>
                  </div>
                </div>
                <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    <code>{crossChainCodeExamples.checkFee}</code>
                  </pre>
                </div>
              </div>
            </Card>
          </div>

          {/* Settlement Flow Diagram */}
          <div className="mb-10">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ArrowRight className="w-5 h-5 text-cyan-400" />
              Settlement Flow Diagram
            </h3>
            <Card className="relative overflow-hidden bg-[#0d0d0d] backdrop-blur-xl border-white/5">
              <div className="p-6">
                <pre className="text-xs text-emerald-400/80 font-mono overflow-x-auto whitespace-pre">
                  <code>{settlementFlowDiagram}</code>
                </pre>
              </div>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">9+</div>
              <div className="text-xs text-slate-400">Supported Chains</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">4</div>
              <div className="text-xs text-slate-400">Settlement Modes</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">~15m</div>
              <div className="text-xs text-slate-400">Avg Relay Time</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-cyan-400 mb-1">$0.001</div>
              <div className="text-xs text-slate-400">Min Gas Cost</div>
            </div>
          </div>

          {/* Cross-Chain Note */}
          <Card className="relative overflow-hidden bg-gradient-to-r from-amber-600/10 via-[#1a1a1a]/80 to-emerald-600/10 border-amber-500/20 mt-8">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Universal Protocol Access</h4>
                  <p className="text-sm text-slate-400">
                    Cross-chain settlement enables users on Polygon, Arbitrum, Solana, and other chains to access 
                    P3 Protocol features. Fees are OPTIONAL but enable cross-chain access. All settlements are 
                    anchored on-chain for full transparency and auditability.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Programmable Launcher API Section */}
        <section id="programmable-launcher" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 mb-4">
              <Grid3X3 className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-medium">Programmable Substrate</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Programmable Launcher API</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              The launcher is a programmable substrate with manifest-driven API registry. Apps declare 
              callable endpoints, routes, and permissions for programmatic inter-app communication.
            </p>
          </div>

          <div className="space-y-8">
            {launcherApiEndpoints.map((category) => {
              const IconComponent = category.icon;
              return (
                <div key={category.category}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <IconComponent className={`w-5 h-5 ${category.color}`} />
                    {category.category}
                  </h3>
                  <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                    <div className="relative overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs">Endpoint</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs">Method</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs hidden md:table-cell">Description</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs hidden lg:table-cell">Response</th>
                          </tr>
                        </thead>
                        <tbody>
                          {category.endpoints.map((endpoint, index) => (
                            <tr 
                              key={endpoint.endpoint}
                              className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === category.endpoints.length - 1 ? 'border-b-0' : ''}`}
                            >
                              <td className="py-3 px-4">
                                <code className="text-cyan-400 font-mono text-xs">{endpoint.endpoint}</code>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                  endpoint.method === 'ENDPOINT' ? 'bg-purple-500/20 text-purple-400' :
                                  endpoint.method.includes('POST') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {endpoint.method === 'ENDPOINT' ? 'SDK' : endpoint.method}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 text-xs hidden md:table-cell">{endpoint.description}</td>
                              <td className="py-3 px-4 hidden lg:table-cell">
                                <code className="text-xs text-slate-500 font-mono">{endpoint.response}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Launcher SDK Code Example */}
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 mt-8">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/10 via-transparent to-emerald-600/10" />
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Code2 className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <span className="font-semibold text-white">Launcher SDK Usage</span>
                  <p className="text-xs text-slate-500">Discover, call, and navigate programmatically</p>
                </div>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  <code>{launcherSdkCode}</code>
                </pre>
              </div>
            </div>
          </Card>

          {/* Architecture Diagram */}
          <Card className="relative overflow-hidden bg-[#0d0d0d] backdrop-blur-xl border-white/5 mt-8">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Scanner Architecture
              </h3>
              <pre className="text-xs text-emerald-400/80 font-mono overflow-x-auto whitespace-pre">
{`┌─────────────────────────────────────────────────────────────────────┐
│                    MANIFEST SCANNER PIPELINE                          │
└─────────────────────────────────────────────────────────────────────┘

  SUBMISSION              ANALYSIS                 DECISION              PUBLISH
  ┌──────────┐     ┌─────────────────┐      ┌──────────────┐      ┌──────────┐
  │ manifest │────▶│  Static Check   │─────▶│  Risk Score  │─────▶│ Registry │
  │  .json   │     │  • Schema       │      │  (1-10)      │      │ Builder  │
  └──────────┘     │  • Signature    │      │              │      └──────────┘
                   │  • Scopes       │      │  ┌─────────┐ │             │
                   └─────────────────┘      │  │ ≤3 AUTO │ │             ▼
                           │                │  │ APPROVE │ │      ┌──────────┐
                           ▼                │  └─────────┘ │      │  Audit   │
                   ┌─────────────────┐      │              │      │   Log    │
                   │   Heuristics    │──────│  ┌─────────┐ │      └──────────┘
                   │  • Anomalies    │      │  │ 4-6 REV │ │
                   │  • Spoof Risk   │      │  │   IEW   │────▶ Moderation Panel
                   │  • Patterns     │      │  └─────────┘ │
                   └─────────────────┘      │              │
                           │                │  ┌─────────┐ │
                           ▼                │  │ ≥7 SUSP │ │
                   ┌─────────────────┐      │  │   END   │ │
                   │   Sandbox Test  │      │  └─────────┘ │
                   │  • VM Isolation │      └──────────────┘
                   │  • No Network   │
                   └─────────────────┘`}
              </pre>
            </div>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-cyan-400 mb-1">5</div>
              <div className="text-xs text-slate-400">Registered Apps</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">14</div>
              <div className="text-xs text-slate-400">Endpoints</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">10</div>
              <div className="text-xs text-slate-400">Routes</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">7</div>
              <div className="text-xs text-slate-400">Scopes</div>
            </div>
          </div>
        </section>

        {/* API Pattern Examples Section */}
        <section id="enterprise-api" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 mb-4">
              <Building className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-indigo-300 font-medium">Build Your Own</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">API Pattern Examples</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Example API patterns you can implement in YOUR app. These are templates showing common 
              endpoints developers build on top of P3's core SDK. <span className="text-amber-400">You implement these — P3 only provides the anchor/crypto/SSO core.</span>
            </p>
          </div>

          <div className="space-y-8">
            {enterpriseApiEndpoints.map((category) => {
              const IconComponent = category.icon;
              return (
                <div key={category.category}>
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <IconComponent className={`w-5 h-5 ${category.color}`} />
                    {category.category}
                  </h3>
                  <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                    <div className="relative overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs">Endpoint</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs">Method</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs hidden md:table-cell">Description</th>
                            <th className="text-left py-3 px-4 text-slate-300 font-semibold text-xs hidden lg:table-cell">Response</th>
                          </tr>
                        </thead>
                        <tbody>
                          {category.endpoints.map((endpoint, index) => (
                            <tr 
                              key={endpoint.endpoint}
                              className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === category.endpoints.length - 1 ? 'border-b-0' : ''}`}
                            >
                              <td className="py-3 px-4">
                                <code className="text-cyan-400 font-mono text-xs">{endpoint.endpoint}</code>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                  endpoint.method.includes('POST') ? 'bg-emerald-500/20 text-emerald-400' : 
                                  endpoint.method.includes('PUT') || endpoint.method.includes('DELETE') ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-blue-500/20 text-blue-400'
                                }`}>
                                  {endpoint.method}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 text-xs hidden md:table-cell">{endpoint.description}</td>
                              <td className="py-3 px-4 hidden lg:table-cell">
                                <code className="text-xs text-slate-500 font-mono">{endpoint.response}</code>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-indigo-400 mb-1">8</div>
              <div className="text-xs text-slate-400">API Domains</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">45+</div>
              <div className="text-xs text-slate-400">Endpoints</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-cyan-400 mb-1">JWT</div>
              <div className="text-xs text-slate-400">Auth Standard</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">REST</div>
              <div className="text-xs text-slate-400">API Style</div>
            </div>
          </div>

          <Card className="relative overflow-hidden bg-gradient-to-r from-indigo-600/10 via-[#1a1a1a]/80 to-purple-600/10 border-indigo-500/20 mt-8">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Terminal className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">SDK or Direct REST</h4>
                  <p className="text-sm text-slate-400">
                    All endpoints are accessible via the P3 SDK or direct REST calls with JWT authentication.
                    The SDK provides typed wrappers, automatic retry, and session management. Direct REST is available
                    for custom integrations or non-JavaScript environments.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Atlas Developer Use Cases Section */}
        <section id="atlas-developer" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 mb-4">
              <Globe className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Atlas + Developer Freedom</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Build Custom Experiences</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Atlas is a neutral orchestrator — it doesn't dictate language models or interaction styles. 
              Developers can program their own "dialects" and Atlas surfaces them naturally.
            </p>
            <Button
              data-testid="button-try-atlas"
              onClick={() => setLocation('/atlas')}
              className="mt-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
            >
              <Globe className="w-4 h-4 mr-2" />
              Try Atlas Now
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileJson className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Manifest-Driven</h4>
                  <p className="text-sm text-slate-400">Every app declares endpoints, scopes, and adapter. Atlas just calls — it doesn't care how your adapter implements logic.</p>
                </div>
              </div>
              <pre className="bg-black/40 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                <code className="text-slate-300">{`"endpoints": {
  "messages.poeticSend": {
    "app": "messages.app",
    "fn": "poeticSend",
    "args": { "recipient": "string", "text": "string" },
    "scopes": ["messages"],
    "description": "Send messages in poetic language"
  }
}`}</code>
              </pre>
            </Card>

            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Transport-Agnostic Executor</h4>
                  <p className="text-sm text-slate-400">Whether your adapter is REST, JSON-RPC, or a custom LLM service, Atlas just passes <code className="text-cyan-400">{'{fn, args}'}</code>.</p>
                </div>
              </div>
              <pre className="bg-black/40 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                <code className="text-slate-300">{`// Your adapter receives:
{
  "method": "poeticSend",
  "params": {
    "recipient": "alice.eth",
    "text": "Hello there!"
  }
}
// Transform with YOUR LLM → return response`}</code>
              </pre>
            </Card>
          </div>

          <Card className="relative overflow-hidden bg-gradient-to-r from-purple-600/10 via-[#1a1a1a]/80 to-cyan-600/10 border-purple-500/20">
            <div className="p-6">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-purple-400" />
                Developer Use Cases
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-purple-400 font-semibold text-sm mb-2">Custom Language Models</div>
                  <p className="text-xs text-slate-400">Wire your own LLM into your adapter. Atlas sees another endpoint — users get your custom style.</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-cyan-400 font-semibold text-sm mb-2">Branded Interactions</div>
                  <p className="text-xs text-slate-400">"Send a poetic message" → <code className="text-cyan-300">messages.poeticSend</code>. Your brand, Atlas orchestrates.</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-emerald-400 font-semibold text-sm mb-2">Multi-Modal Adapters</div>
                  <p className="text-xs text-slate-400">Voice → text → action. Image recognition → metadata. Your adapter transforms, Atlas routes.</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-amber-400 font-semibold text-sm mb-2">Workflow Automation</div>
                  <p className="text-xs text-slate-400">Chain multiple endpoints into flows. Atlas handles consent, review gates, and receipts.</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-rose-400 font-semibold text-sm mb-2">Enterprise Compliance</div>
                  <p className="text-xs text-slate-400">Add review gates for sensitive ops. Atlas holds for approval, your adapter executes when cleared.</p>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="text-indigo-400 font-semibold text-sm mb-2">Cross-App Orchestration</div>
                  <p className="text-xs text-slate-400">User says "pay and notify" → payments.send + messages.compose. Session consent, atomic execution.</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="mt-8 text-center">
            <p className="text-slate-400 text-sm mb-4">
              Atlas is already designed as a <span className="text-purple-400 font-medium">neutral orchestrator</span>: 
              it routes to whatever developers manifest. No extra scaffolding needed.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300">Future-proofed for developer-defined language models</span>
            </div>
          </div>
        </section>

        {/* Marketplace SDK Section */}
        <section id="marketplace-sdk" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
              <Store className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Marketplace Verticals</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Marketplace SDKs</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Four specialized SDKs for digital content marketplaces — ebooks, music, video, and art. 
              Each with encrypted delivery, anchored receipts, and creator monetization built-in.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {marketplaceSDKs.map((sdk) => {
              const IconComponent = sdk.icon;
              return (
                <Card 
                  key={sdk.name}
                  data-testid={`card-marketplace-sdk-${sdk.name.toLowerCase()}`}
                  className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${sdk.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl ${sdk.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <IconComponent className={`w-6 h-6 ${sdk.textColor}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-mono font-semibold text-white">{sdk.name}</h3>
                        <p className="text-sm text-slate-400">{sdk.description}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {sdk.features.map((feature) => (
                        <span 
                          key={feature}
                          className={`px-2 py-1 rounded-full text-xs ${sdk.bgColor} ${sdk.textColor}`}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                    <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                      <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                        <code>{sdk.code}</code>
                      </pre>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">4</div>
              <div className="text-xs text-slate-400">Marketplace Verticals</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">15+</div>
              <div className="text-xs text-slate-400">API Endpoints</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">100%</div>
              <div className="text-xs text-slate-400">Receipt Anchoring</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">HLS</div>
              <div className="text-xs text-slate-400">Adaptive Streaming</div>
            </div>
          </div>
        </section>

        {/* Atlas One API Section */}
        <section id="atlas-one-api" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/30 mb-4">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Atlas One Substrate</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Atlas One API</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Unified API for game development, shopping with dual-mode commerce, and entertainment streaming. 
              Build apps that integrate games, products, videos, and ebooks with wallet-anchored receipts.
            </p>
          </div>

          {atlasOneApiEndpoints.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <div key={category.category} className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CategoryIcon className={`w-5 h-5 ${category.color}`} />
                  {category.category}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {category.endpoints.map((api) => (
                    <Card 
                      key={api.endpoint}
                      data-testid={`api-atlasone-${api.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all"
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            api.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {api.method}
                          </span>
                          <span className="font-semibold text-white text-sm">{api.name}</span>
                        </div>
                        <code className="block text-xs text-purple-400 font-mono mb-2 bg-[#0d0d0d] px-2 py-1 rounded break-all">
                          {api.endpoint}
                        </code>
                        <p className="text-xs text-slate-500 mb-3">{api.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-slate-500 mb-1">Params</div>
                            <pre className="bg-[#0d0d0d] p-2 rounded text-slate-400 font-mono text-[10px]">
                              {api.params}
                            </pre>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Response</div>
                            <pre className="bg-[#0d0d0d] p-2 rounded text-emerald-400/80 font-mono text-[10px]">
                              {api.response}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Atlas One Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-emerald-400 mb-1">6</div>
              <div className="text-xs text-slate-400">Content Types</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">24+</div>
              <div className="text-xs text-slate-400">API Endpoints</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-amber-400 mb-1">2</div>
              <div className="text-xs text-slate-400">Purchase Modes</div>
            </div>
            <div className="bg-[#1a1a1a]/60 rounded-xl p-4 border border-white/5 text-center">
              <div className="text-2xl font-bold text-rose-400 mb-1">8+</div>
              <div className="text-xs text-slate-400">Content Sources</div>
            </div>
          </div>

          <Card className="relative overflow-hidden bg-gradient-to-r from-purple-600/10 via-[#1a1a1a]/80 to-indigo-600/10 border-purple-500/20 mt-8">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Unified Substrate Architecture</h4>
                  <p className="text-sm text-slate-400">
                    Atlas One consolidates games, videos, ebooks, apps, products, and audio into a single API surface.
                    All content types share the same catalog, library, commerce, and review systems. Dual-mode shopping
                    supports both wallet-anchored purchases (with blockchain receipts) and browser-mode merchant checkout.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Marketplace API Endpoints */}
        <section id="marketplace-api" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/30 mb-4">
              <FileSearch className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-medium">API Reference</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Marketplace API Endpoints</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Complete REST API for asset discovery, licensing, content delivery, receipts, and earnings.
            </p>
          </div>

          {marketplaceApiEndpoints.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <div key={category.category} className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CategoryIcon className={`w-5 h-5 ${category.color}`} />
                  {category.category}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {category.endpoints.map((api) => (
                    <Card 
                      key={api.endpoint}
                      data-testid={`api-marketplace-${api.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all"
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                            api.method === 'POST' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {api.method}
                          </span>
                          <span className="font-semibold text-white text-sm">{api.name}</span>
                        </div>
                        <code className="block text-xs text-purple-400 font-mono mb-2 bg-[#0d0d0d] px-2 py-1 rounded break-all">
                          {api.endpoint}
                        </code>
                        <p className="text-xs text-slate-500 mb-3">{api.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <div className="text-slate-500 mb-1">Params</div>
                            <pre className="bg-[#0d0d0d] p-2 rounded text-slate-400 font-mono text-[10px]">
                              {api.params}
                            </pre>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Response</div>
                            <pre className="bg-[#0d0d0d] p-2 rounded text-emerald-400/80 font-mono text-[10px]">
                              {api.response}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Manifest Registry Section */}
        <section id="manifest-registry" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 mb-4">
              <FileJson className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium">Discovery</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Manifest Registry</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Launchers discover available marketplaces via the manifest registry. 
              Each manifest describes capabilities, endpoints, and supported asset types.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 via-transparent to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <FileJson className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Manifest Discovery</span>
                    <p className="text-xs text-slate-500">GET /api/marketplace/manifest</p>
                  </div>
                </div>
                <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    <code>{manifestRegistryCode}</code>
                  </pre>
                </div>
              </div>
            </Card>

            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 via-transparent to-transparent" />
              <div className="relative p-6">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Store className="w-5 h-5 text-purple-400" />
                  Manifest Structure
                </h4>
                <div className="space-y-3">
                  {[
                    { field: 'id', desc: 'Unique marketplace identifier', example: '"ebook-market"' },
                    { field: 'name', desc: 'Display name for UI', example: '"P3 Ebook Store"' },
                    { field: 'types', desc: 'Supported asset types', example: '["ebook", "audiobook"]' },
                    { field: 'endpoints', desc: 'Available API routes', example: '{ catalog: "/api/...", gate: "/api/..." }' },
                    { field: 'version', desc: 'API version', example: '"1.0.0"' },
                  ].map((item) => (
                    <div key={item.field} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
                      <code className="text-purple-400 font-mono text-sm font-semibold">{item.field}</code>
                      <div className="flex-1">
                        <p className="text-slate-400 text-xs">{item.desc}</p>
                        <code className="text-[10px] text-slate-500">{item.example}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Full Marketplace Example */}
        <section id="marketplace-example" className="mb-16 scroll-mt-8">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-300 font-medium">Full Example</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Complete Marketplace Integration</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A comprehensive example showing all four marketplace verticals in action.
            </p>
          </div>

          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 via-transparent to-purple-600/5" />
            <div className="relative p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">Multi-Vertical Integration</span>
                    <p className="text-xs text-slate-500">Ebook, Music, Video, and Art in one codebase</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-400">Ebook</span>
                  <span className="px-2 py-1 rounded-full text-xs bg-pink-500/20 text-pink-400">Music</span>
                  <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">Video</span>
                  <span className="px-2 py-1 rounded-full text-xs bg-amber-500/20 text-amber-400">Art</span>
                </div>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-4 border border-white/5">
                <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  <code>{fullMarketplaceExample}</code>
                </pre>
              </div>
            </div>
          </Card>

          {/* Key Integration Points */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden bg-gradient-to-br from-blue-600/10 to-transparent border-blue-500/20 p-5">
              <Lock className="w-5 h-5 text-blue-400 mb-3" />
              <h4 className="text-white font-semibold mb-2">Encrypted Delivery</h4>
              <p className="text-sm text-slate-400">All content is encrypted at rest. Decrypt tokens are short-lived and license-bound.</p>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/10 to-transparent border-purple-500/20 p-5">
              <Anchor className="w-5 h-5 text-purple-400 mb-3" />
              <h4 className="text-white font-semibold mb-2">Anchored Receipts</h4>
              <p className="text-sm text-slate-400">Every transaction generates a cryptographic receipt that can be anchored on-chain.</p>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-600/10 to-transparent border-emerald-500/20 p-5">
              <DollarSign className="w-5 h-5 text-emerald-400 mb-3" />
              <h4 className="text-white font-semibold mb-2">Creator Payments</h4>
              <p className="text-sm text-slate-400">Treasury APIs handle earnings splits, settlements, and payout automation.</p>
            </Card>
          </div>
        </section>

        {/* Encryption SDK Comparison */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/30 mb-4">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-amber-300 font-medium">Competitive Analysis</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">P3 vs Enterprise Encryption SDKs</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Your one-call encryption puts you in the same tier as AWS, IBM, and Microsoft — 
              but with a developer-first, protocol-native approach they don't have.
            </p>
          </div>

          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-600/5 via-transparent to-cyan-600/5" />
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">Provider</th>
                    <th className="text-left py-4 px-6 text-slate-400 font-semibold hidden md:table-cell">How Delivered</th>
                    <th className="text-left py-4 px-6 text-red-400/80 font-semibold">Limitations</th>
                    <th className="text-left py-4 px-6 text-emerald-400 font-semibold">P3 Advantage</th>
                  </tr>
                </thead>
                <tbody>
                  {encryptionComparison.map((row, index) => {
                    const IconComponent = row.icon;
                    return (
                      <tr 
                        key={row.provider} 
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === encryptionComparison.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-4 h-4 text-slate-500" />
                            <span className="text-white font-medium">{row.provider}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-400 text-xs hidden md:table-cell">{row.delivery}</td>
                        <td className="py-4 px-6 text-red-400/70 text-xs">{row.limitations}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <span className="text-emerald-400 text-xs">{row.p3Advantage}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Strategic Position Cards */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden bg-gradient-to-br from-cyan-600/10 to-transparent border-cyan-500/20 p-5">
              <Terminal className="w-5 h-5 text-cyan-400 mb-3" />
              <h4 className="text-white font-semibold mb-2">For Developers</h4>
              <p className="text-sm text-slate-400">"Build your own Signal, Slack, or Zoom in 5 lines of code."</p>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/10 to-transparent border-purple-500/20 p-5">
              <Building2 className="w-5 h-5 text-purple-400 mb-3" />
              <h4 className="text-white font-semibold mb-2">For Enterprises</h4>
              <p className="text-sm text-slate-400">"Get audit-ready, quantum-resilient encryption without hiring a cryptography team."</p>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-amber-600/10 to-transparent border-amber-500/20 p-5">
              <Zap className="w-5 h-5 text-amber-400 mb-3" />
              <h4 className="text-white font-semibold mb-2">For Investors</h4>
              <p className="text-sm text-slate-400">"AWS-level primitives in a protocol-native OS no one else has built."</p>
            </Card>
          </div>
        </section>

        {/* Why P3 Wins Section */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300 font-medium">Competitive Advantage</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Why P3 Wins</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Others offer fragments. P3 unifies them into a defensible protocol-native OS.
            </p>
          </div>
          
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 via-transparent to-emerald-600/5" />
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-6 text-slate-300 font-semibold">Feature</th>
                    <th className="text-center py-4 px-6 text-purple-400 font-semibold">P3 Protocol</th>
                    <th className="text-center py-4 px-6 text-slate-400 font-semibold">Others</th>
                  </tr>
                </thead>
                <tbody>
                  {competitiveFeatures.map((row, index) => {
                    const IconComponent = row.icon;
                    return (
                      <tr 
                        key={row.feature} 
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === competitiveFeatures.length - 1 ? 'border-b-0' : ''}`}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <IconComponent className="w-4 h-4 text-slate-400" />
                            <span className="text-white font-medium">{row.feature}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col items-center gap-1">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20">
                              <Check className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-xs text-slate-400 text-center max-w-[150px]">{row.p3Detail}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col items-center gap-1">
                            {row.others === 'partial' ? (
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20">
                                <span className="text-amber-400 text-xs font-bold">~</span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500/20">
                                <XIcon className="w-4 h-4 text-red-400" />
                              </div>
                            )}
                            <span className="text-xs text-slate-500 text-center max-w-[150px]">{row.othersDetail}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Key Differentiators */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/10 to-transparent border-purple-500/20 p-5">
              <h4 className="text-white font-semibold mb-2">Not Just a Wallet SDK</h4>
              <p className="text-sm text-slate-400">It's a substrate mesh layer with full ecosystem interconnection.</p>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-600/10 to-transparent border-indigo-500/20 p-5">
              <h4 className="text-white font-semibold mb-2">Not Just a Launcher</h4>
              <p className="text-sm text-slate-400">It's governance-aware, session-bridged, and encrypted by default.</p>
            </Card>
            <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-600/10 to-transparent border-emerald-500/20 p-5">
              <h4 className="text-white font-semibold mb-2">Not Just Anchored</h4>
              <p className="text-sm text-slate-400">Optional anchoring with Explorer visibility and dev monetization hooks.</p>
            </Card>
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">The 3-File Rule</h2>
            <p className="text-slate-400">Every P3 app needs just three files to be protocol-compliant</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {threeFileRule.map((file) => {
              const IconComponent = file.icon;
              return (
                <Card 
                  key={file.file}
                  data-testid={`card-file-${file.file.replace(/\./g, '-')}`}
                  className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${file.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative p-6 text-center">
                    <div className={`w-14 h-14 rounded-2xl ${file.bgColor} flex items-center justify-center mx-auto mb-4`}>
                      <IconComponent className={`w-7 h-7 ${file.textColor}`} />
                    </div>
                    <h3 className="text-lg font-mono font-semibold text-white mb-2">{file.file}</h3>
                    <p className="text-sm text-slate-400">{file.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Manifest Schema</h2>
            <p className="text-slate-400">Define your app's protocol configuration</p>
          </div>
          
          <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-transparent to-purple-600/5" />
            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileJson className="w-5 h-5 text-blue-400" />
                </div>
                <span className="font-mono text-white">manifest.json</span>
              </div>
              <div className="bg-[#0d0d0d] rounded-lg p-5 border border-white/5">
                <pre className="text-sm text-slate-300 font-mono overflow-x-auto">
                  <code>{manifestSchema}</code>
                </pre>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-purple-400 font-medium">name</span>
                  <p className="text-slate-400 mt-1">Your app's display name</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-cyan-400 font-medium">protocol</span>
                  <p className="text-slate-400 mt-1">Bridge & permission settings</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <span className="text-amber-400 font-medium">governance</span>
                  <p className="text-slate-400 mt-1">DAO & compliance config</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-16">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 via-transparent to-purple-600/10" />
            <div className="relative p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <Grid3X3 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">Auto-Population</h2>
                  <p className="text-slate-400 leading-relaxed">
                    When your app follows the 3-file rule and includes a valid manifest, it automatically 
                    mounts as a tile in the P3 Hub grid. The Hub discovers protocol-compliant apps and 
                    displays them based on their declared permissions and governance settings. No manual 
                    listing required — just deploy and your app appears in the ecosystem.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {/* Smart Contract Addresses */}
        <section className="mb-16" id="contracts">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-500/30 mb-4">
              <Layers className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">On-Chain Infrastructure</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Smart Contracts</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              P3 Protocol is deployed on Base network. Use testnet for development, mainnet for production.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Testnet */}
            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-emerald-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Anchor className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{SDK_CONTRACTS.testnet.name}</h3>
                    <span className="text-xs text-emerald-400">Chain ID: {SDK_CONTRACTS.testnet.chainId}</span>
                  </div>
                  <div className="ml-auto px-2 py-1 rounded bg-emerald-500/20 text-xs text-emerald-300">FREE</div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-xs text-slate-500 block mb-1">AnchorRegistry</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-slate-300 font-mono flex-1 truncate">
                        {SDK_CONTRACTS.testnet.anchorRegistry}
                      </code>
                      <a
                        href={`${SDK_CONTRACTS.testnet.explorer}/address/${SDK_CONTRACTS.testnet.anchorRegistry}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300"
                        data-testid="link-testnet-contract"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-xs text-slate-500 block mb-1">RPC Endpoint</span>
                    <code className="text-xs text-slate-400 font-mono">{SDK_CONTRACTS.testnet.rpc}</code>
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 mt-4">
                  Use testnet for development and SDK access anchoring. Gas is free.
                </p>
              </div>
            </Card>
            
            {/* Mainnet */}
            <Card className="relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-purple-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent" />
              <div className="relative p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Anchor className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{SDK_CONTRACTS.mainnet.name}</h3>
                    <span className="text-xs text-purple-400">Chain ID: {SDK_CONTRACTS.mainnet.chainId}</span>
                  </div>
                  <div className="ml-auto px-2 py-1 rounded bg-purple-500/20 text-xs text-purple-300">PRODUCTION</div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-xs text-slate-500 block mb-1">AnchorRegistry</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-slate-300 font-mono flex-1 truncate">
                        {SDK_CONTRACTS.mainnet.anchorRegistry}
                      </code>
                      <a
                        href={`${SDK_CONTRACTS.mainnet.explorer}/address/${SDK_CONTRACTS.mainnet.anchorRegistry}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300"
                        data-testid="link-mainnet-contract"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-xs text-slate-500 block mb-1">RPC Endpoint</span>
                    <code className="text-xs text-slate-400 font-mono">{SDK_CONTRACTS.mainnet.rpc}</code>
                  </div>
                </div>
                
                <p className="text-xs text-slate-500 mt-4">
                  Use mainnet for production anchoring. Standard Base gas fees apply.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="text-center pb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-xl border-purple-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />
            <div className="relative p-8 sm:p-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Ready to Build?
              </h2>
              <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                Start building protocol-native applications with the P3 SDK. 
                Join the ecosystem and create verifiable, trustless experiences.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/api/sdk/download"
                  download="p3-protocol-sdk.zip"
                  data-testid="button-download-sdk"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 px-8 py-4 text-lg rounded-md font-medium transition-all"
                >
                  <Download className="w-5 h-5" />
                  Download SDK
                </a>
                <Button
                  data-testid="button-explore-hub"
                  onClick={() => setLocation('/launcher')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 px-8 py-6 text-lg"
                >
                  Explore the Hub
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </div>
      
      <BrowserHandoffButton />
    </div>
  );
}
