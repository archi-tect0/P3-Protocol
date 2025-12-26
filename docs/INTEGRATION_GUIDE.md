# P3 Protocol Integration Guide

This guide explains how to adopt P3 Protocol components modularly into your existing applications.

## Design Philosophy

P3 Protocol is built as a **composable toolkit**, not a monolithic framework. Each component is designed to work independently, allowing you to:

- **Pick specific modules** - Use only what you need
- **Integrate incrementally** - Add components over time
- **Maintain compatibility** - Standard interfaces work with your existing stack

## Adoption Paths

### 1. Full Stack Deployment
Clone and deploy the complete P3 Protocol as your application foundation.

```bash
git clone https://github.com/archi-tect0/P3-Protocol.git
cd P3-Protocol
npm install
npm run dev
```

### 2. Component Import
Import individual modules into your existing TypeScript/JavaScript project.

```typescript
// Example: Use just the encryption utilities
import { generateKeyPair, encrypt, decrypt } from './lib/crypto';

// Example: Use the receipt anchoring
import { createReceipt, anchorToChain } from './lib/receipts';
```

### 3. Reference Implementation
Study the architecture documentation and build compatible systems in any language.

---

## Modular Components

### Cryptography Primitives
**Use case:** Add E2E encryption to any messaging or data storage system.

**Files to copy:**
```
client/src/lib/crypto.ts
client/src/lib/cryptoUtils.ts
server/services/encryptionService.ts
```

**Key exports:**
- `generateKeyPair()` - X25519 key generation
- `deriveSharedSecret()` - ECDH key agreement
- `encrypt() / decrypt()` - Symmetric encryption
- `signMessage() / verifySignature()` - Ethereum signatures

**Dependencies:** `tweetnacl`, `ethers`

**Documentation:** [CRYPTOGRAPHY_PRIMITIVES.md](./CRYPTOGRAPHY_PRIMITIVES.md)

---

### Session Bridge
**Use case:** Atomic wallet-to-browser handoff with cross-device session continuity.

**Files to copy:**
```
client/src/lib/sessionBridgeV2.ts
server/pwa-routes.ts
shared/schema.ts (installTokens table)
```

**Key exports:**
- `connectBridge()` - Connect wallet and establish session
- `disconnectBridge()` - End session and clear state
- `getSession()` - Retrieve current session state
- `restoreBridge()` - Restore session on page reload
- `triggerAtlasPopout()` - Handoff session to installed PWA
- `triggerBrowserPopout()` - Open browser for WalletConnect QR
- `signWithBridge()` - Sign messages with connected wallet
- `sendWithBridge()` - Send transactions through bridge

**Key patterns:**
- Install token generation with 15-minute expiry
- Cross-tab BroadcastChannel synchronization
- Biometric unlock after wallet link
- Zero-PII design (wallet address only)

**Dependencies:** `viem`, `@coinbase/wallet-sdk`, `@walletconnect/ethereum-provider`

**Storage requirements:** 5 methods (createInstallToken, getInstallToken, updateInstallTokenWallet, consumeInstallToken, cleanupExpiredInstallTokens)

**Documentation:** [SESSION_BRIDGE.md](./SESSION_BRIDGE.md)

---

### Real-Time Infrastructure
**Use case:** Add WebSocket pub/sub, SSE streaming, or WebRTC signaling.

**Files to copy:**
```
server/services/realtimeService.ts
client/src/lib/websocket.ts
client/src/hooks/useWebSocket.ts
```

**Key patterns:**
- Wallet-authenticated WebSocket connections
- Channel-based pub/sub messaging
- SSE for server-to-client streaming
- WebRTC signaling for P2P calls

**Dependencies:** `ws`, `socket.io` (optional)

**Documentation:** [REALTIME_INFRASTRUCTURE.md](./REALTIME_INFRASTRUCTURE.md)

---

### Cross-Chain Receipt Anchoring
**Use case:** Create immutable audit trails for any transaction or event.

**Files to copy:**
```
server/services/receiptService.ts
server/services/blockchainAnchor.ts
contracts/P3Receipt.sol
```

**Key exports:**
- `createReceipt()` - Generate receipt with SHA-256 hash
- `anchorReceipt()` - Submit to blockchain
- `verifyReceipt()` - Validate against on-chain data

**Dependencies:** `ethers`, `bullmq` (for async anchoring)

**Documentation:** [CROSS_CHAIN_RECEIPTS.md](./CROSS_CHAIN_RECEIPTS.md)

---

### Node Relay / Mesh Networking
**Use case:** Build distributed content delivery or P2P data sync.

**Files to copy:**
```
server/services/meshService.ts
client/src/lib/meshClient.ts
```

**Key patterns:**
- Content-addressed chunk storage
- Peer discovery and connection
- Chunk dissemination protocols
- Node health monitoring

**Documentation:** [MESH_NETWORK.md](./MESH_NETWORK.md)

---

### Atlas Canvas UI
**Use case:** Build a unified multi-mode application interface.

**Files to copy:**
```
client/src/components/atlas/AtlasCanvas.tsx
client/src/state/useAtlasStore.ts
client/src/lib/motion.ts
```

**Key patterns:**
- Mode-based rendering with lazy loading
- Dissolve transitions between modes
- Persistent sidebar navigation
- Deep linking support

**Documentation:** [ATLAS_CANVAS_STACK.md](./ATLAS_CANVAS_STACK.md)

---

### SDK & App Manifests
**Use case:** Build a plugin/extension system for your platform.

**Files to copy:**
```
client/src/lib/externalAppsRegistry.ts
shared/schema.ts (AppManifest types)
```

**Key patterns:**
- App manifest schema with capabilities
- Permission model for external apps
- Widget rendering system

**Documentation:** [SDK_AND_MANIFESTS.md](./SDK_AND_MANIFESTS.md)

---

## Integration Examples

### Example 1: Add E2E Encryption to Chat App

```typescript
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

// Generate keys for each user
const keyPair = nacl.box.keyPair();

// Encrypt message
function encryptMessage(message: string, recipientPubKey: Uint8Array, senderSecretKey: Uint8Array) {
  const nonce = nacl.randomBytes(24);
  const messageBytes = new TextEncoder().encode(message);
  const encrypted = nacl.box(messageBytes, nonce, recipientPubKey, senderSecretKey);
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce)
  };
}

// Decrypt message
function decryptMessage(ciphertext: string, nonce: string, senderPubKey: Uint8Array, recipientSecretKey: Uint8Array) {
  const decrypted = nacl.box.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    senderPubKey,
    recipientSecretKey
  );
  return new TextDecoder().decode(decrypted!);
}
```

### Example 2: Add Receipt Anchoring to Payment System

```typescript
import { createHash } from 'crypto';
import { ethers } from 'ethers';

interface Receipt {
  id: string;
  type: string;
  amount: string;
  from: string;
  to: string;
  timestamp: number;
}

// Create receipt hash
function createReceiptHash(receipt: Receipt): string {
  const payload = JSON.stringify(receipt);
  return createHash('sha256').update(payload).digest('hex');
}

// Anchor to blockchain (simplified)
async function anchorReceipt(receiptHash: string, contract: ethers.Contract) {
  const tx = await contract.anchor(receiptHash);
  await tx.wait();
  return tx.hash;
}
```

### Example 3: Add WebSocket Pub/Sub

```typescript
// Server
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
const channels = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'subscribe') {
      if (!channels.has(msg.channel)) {
        channels.set(msg.channel, new Set());
      }
      channels.get(msg.channel)!.add(ws);
    }
    
    if (msg.type === 'publish') {
      const subscribers = channels.get(msg.channel);
      subscribers?.forEach(client => {
        client.send(JSON.stringify({ channel: msg.channel, data: msg.data }));
      });
    }
  });
});
```

---

## API Compatibility

P3 Protocol uses standard interfaces for maximum compatibility:

| Component | Standard | Interop |
|-----------|----------|---------|
| Encryption | NaCl/libsodium | Any NaCl implementation |
| Signatures | EIP-191 / EIP-712 | Any Ethereum wallet |
| WebSocket | RFC 6455 | Any WS client |
| REST API | OpenAPI 3.0 | Any HTTP client |
| Blockchain | EVM / Solidity | Base, Ethereum, Polygon, etc. |

---

## License

Apache License 2.0 - You can use these components commercially with attribution.

See [LICENSE](../LICENSE) for full terms.
