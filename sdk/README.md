# P3 Protocol SDK

**Privacy-Preserving Proof-of-Communication Protocol**

TypeScript SDK for blockchain-anchored receipts with zero-knowledge privacy.

## Overview

The P3 Protocol SDK provides developer tools for creating verifiable proofs of communication, meetings, and transactions while maintaining content privacy through end-to-end encryption.

## Installation

```bash
npm install @dciphrs/sdk
```

## Quick Start

```typescript
import { TrustLayerSDK } from '@dciphrs/sdk/trust'
import { connect, WALLETS } from '@dciphrs/sdk'

// Initialize P3 Protocol
const p3 = new TrustLayerSDK('https://your-api.com')

// Connect wallet
const wallet = await connect({ walletId: 'metamask' })

// Create blockchain anchor
const anchor = await p3.anchors.createAnchor({
  walletAddress: wallet.address,
  anchorType: 'document',
  payload: { hash: 'sha256...' },
  anchorOnChain: true,
  network: 'base'
})

console.log('Anchor TX:', anchor.txHash)
```

## Modules

### 🔒 Trust Layer (`/trust`)

Complete governance and compliance infrastructure.

```typescript
import { TrustLayerSDK } from '@dciphrs/sdk/trust'

const p3 = new TrustLayerSDK()

// Trust Anchors - Blockchain proofs
await p3.anchors.createAnchor({...})
await p3.anchors.verifyAnchor(anchorId)

// Meeting Proofs - Call attestation
await p3.meetings.recordMeeting({...})
await p3.meetings.verifyMeeting(meetingId)

// Consent Management - GDPR compliance
await p3.consents.recordConsent({...})
await p3.consents.revokeConsent(consentId)

// Smart Rules - Automated policy
await p3.rules.createRule({...})
await p3.rules.evaluateRule(ruleId, context)

// Plugins - Webhook extensibility
await p3.plugins.registerPlugin({...})

// Bundles - Batch verification
await p3.bundles.createBundle([anchor1, anchor2])

// External Apps - Cross-app anchoring
await p3.externalApps.anchorToExternal({...})
```

### 💼 Wallet Connector (`/walletConnector`)

Multi-wallet support with privacy-safe telemetry.

```typescript
import { 
  connect, 
  disconnect, 
  WALLETS,
  useInstallVerification,
  createSiweMessage 
} from '@dciphrs/sdk'

// Connect to wallet
const result = await connect({ 
  walletId: 'metamask',
  chainId: 8453 // Base Mainnet
})

// Install verification (React hook)
useInstallVerification({
  onLaunchDetected: () => console.log('Wallet opened'),
  onTimeout: () => console.log('Not installed'),
  timeoutMs: 5000
})

// SIWE authentication
const message = createSiweMessage({
  address: wallet.address,
  chainId: 8453,
  domain: 'example.com',
  uri: 'https://example.com',
  nonce: crypto.randomUUID()
})

const signature = await wallet.signMessage(message)
```

### 📊 Telemetry (`/telemetry`)

Privacy-focused analytics (no PII, salted fingerprints).

```typescript
import { logEvent, getTelemetryData } from '@dciphrs/sdk/telemetry'

// Client-side tracking
logEvent('user_action', { action: 'message_sent' })

// Get metrics snapshot
const metrics = getTelemetryData()
// { message_sent: 42, wallet_connected: 5 }

// Server-side (Prometheus format)
import { formatPrometheusMetrics } from '@dciphrs/sdk/telemetry/server'

app.get('/metrics', (req, res) => {
  res.type('text/plain').send(formatPrometheusMetrics())
})
```

### 🧾 Receipts (`/receipts`)

Blockchain receipt verification.

```typescript
import { verifyReceipt } from '@dciphrs/sdk/receipts'

const isValid = await verifyReceipt({
  txHash: '0xabc123...',
  network: 'base',
  expectedHash: 'sha256...'
})
```

### 📎 Attachments (`/attachments`)

File hash verification.

```typescript
import { hashFile, verifyHash } from '@dciphrs/sdk/attachments'

const hash = await hashFile(fileBlob)
const valid = verifyHash(fileBlob, expectedHash)
```

## Features

### Trust Anchors
- Blockchain-anchored proofs (Base Mainnet, 0.00015 ETH)
- Off-chain anchoring (database only)
- Multi-network support
- Batch verification

### Meeting Proofs
- Voice/video call attestation
- Participant verification
- Duration tracking
- Blockchain anchoring

### Consent Management
- GDPR-compliant tracking
- Granular permissions
- Revocation support
- Audit trails

### Smart Rules
- Conditional anchoring
- Automated policy enforcement
- Custom rule logic
- Webhook triggers

### Privacy
- No PII collection
- Salted fingerprints
- User-agent based device detection
- 1-minute rolling windows

## Networks

- **Base Mainnet** (chainId: 8453) - Primary network
- **Base Sepolia** (chainId: 84532) - Testnet

## Protocol Fees

- **Blockchain anchoring**: 0.00015 ETH per anchor
- **Off-chain storage**: Free
- **API usage**: Free (rate limits apply)

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  TrustAnchor,
  MeetingProof,
  ConsentRecord,
  SmartRule,
  WalletMeta,
  ConnectResult
} from '@dciphrs/sdk'
```

## React Hooks

```typescript
import { useInstallVerification } from '@dciphrs/sdk'

function MyComponent() {
  useInstallVerification({
    onLaunchDetected: () => handleWalletLaunch(),
    onTimeout: () => showInstallPrompt()
  })
}
```

## Use Cases

- **Healthcare**: HIPAA-compliant communications
- **Legal**: Provable attorney-client privilege
- **Finance**: Auditable transaction discussions
- **Enterprise**: Compliance-ready internal comms
- **DAOs**: Governance decision records

## Examples

### Complete Integration

```typescript
import { TrustLayerSDK, connect } from '@dciphrs/sdk'

async function sendSecureMessage() {
  // 1. Connect wallet
  const wallet = await connect({ walletId: 'metamask' })
  
  // 2. Initialize P3 Protocol
  const p3 = new TrustLayerSDK('https://api.example.com')
  
  // 3. Encrypt message (your implementation)
  const encrypted = await encryptMessage(message, recipientPublicKey)
  
  // 4. Create blockchain anchor
  const anchor = await p3.anchors.createAnchor({
    walletAddress: wallet.address,
    anchorType: 'message',
    payload: { 
      messageHash: sha256(encrypted),
      recipientAddress: recipient
    },
    anchorOnChain: true,
    network: 'base'
  })
  
  // 5. Store message with receipt
  await storeMessage({
    encrypted,
    txHash: anchor.txHash,
    timestamp: anchor.timestamp
  })
}
```

## License

Apache-2.0

## Support

- Issues: GitHub Issues
- Docs: [Full Documentation](../docs/)
- Discord: [Community](https://discord.gg/dciphrs)

---

**Build privacy-first applications with verifiable proofs.**
