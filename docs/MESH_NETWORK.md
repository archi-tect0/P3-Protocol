# P3 Protocol Mesh Network Architecture

The P3 Protocol implements a decentralized mesh network for streaming, messaging, and cross-chain receipt bridging. This document covers the core components: MeshClient, Node Relay, Bridge Service, and Session Bridge.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           P3 MESH NETWORK                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Client    │◄──►│   Relay     │◄──►│   Bridge    │◄──►│  L2 Chains  │  │
│  │   Node      │    │   Server    │    │   Service   │    │             │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                              │
│        ▼                  ▼                  ▼                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  Chunk      │    │  Manifest   │    │  Receipt    │                     │
│  │  Store      │    │  Registry   │    │  Anchoring  │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. MeshClient (Transport Layer)

**Location:** `client/src/lib/meshClient.ts`

The MeshClient is the decentralized streaming transport layer that handles manifest announcements, chunk dissemination, and event subscriptions.

### Core Functions

```typescript
import { MeshClient, generateCID } from '@/lib/meshClient';

// Initialize with session
const mesh = new MeshClient(session);

// Announce a stream manifest
await mesh.announceManifest({
  streamId: 'stream-123',
  title: 'My Stream',
  chunks: [],
  createdAt: Date.now()
});

// Disseminate video chunks
const chunkData = new ArrayBuffer(1024);
const { cid } = await mesh.disseminateChunk(
  { streamId: 'stream-123', index: 0, timestamp: Date.now() },
  chunkData
);

// Fetch chunks (with local cache fallback)
const data = await mesh.fetchChunk(cid);

// Subscribe to manifest updates
mesh.onManifest((manifest) => {
  console.log('New manifest:', manifest.streamId);
});

// Subscribe to events (comments, reactions)
mesh.onEvent((event) => {
  console.log('Event:', event.type, event.data);
});

// Start polling for updates
mesh.startPolling();

// Cleanup
mesh.stopPolling();
```

### Features

| Feature | Description |
|---------|-------------|
| **Chunk Store** | Local LRU cache (100 chunks) for offline fallback |
| **CID Generation** | SHA-256 content addressing |
| **Polling** | 5-second interval for manifest/event updates |
| **Session Auth** | Bearer token authentication |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/atlas/streaming/v2/nodestream/manifest` | POST | Announce stream manifest |
| `/api/atlas/streaming/v2/nodestream/chunk` | POST | Disseminate chunk |
| `/api/atlas/streaming/v2/nodestream/chunk/:cid` | GET | Fetch chunk by CID |
| `/api/atlas/streaming/v2/nodestream/manifests` | GET | List active manifests |
| `/api/atlas/streaming/v2/nodestream/events` | GET | Poll for events |

---

## 2. Bridge Relay Service (Cross-Chain)

**Location:** `packages/bridge/relay/service.ts`

The Bridge Relay Service enables cross-chain receipt bridging from Base to other L2 networks.

### Supported Chains

| Chain | Adapter | Required Confirmations |
|-------|---------|----------------------|
| Polygon | `BaseToPolygonAdapter` | 20 |
| Arbitrum | `BaseToArbitrumAdapter` | 12 |
| Optimism | `BaseToOptimismAdapter` | 10 |

### Usage

```typescript
import { BridgeRelayService } from '@/packages/bridge/relay/service';

const relay = new BridgeRelayService();

// Relay a receipt to another chain
const result = await relay.relayReceipt(
  docHash,           // Content hash
  'polygon',         // Target chain
  receiptData,       // Receipt payload
  0                  // Attempt number
);

if (result.success) {
  console.log('Relayed:', result.txHash);
}

// Check confirmations
const { confirmations, required } = await relay.checkConfirmations(
  'polygon',
  result.txHash
);
```

### Retry Logic

The service implements exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 1 second delay
- Attempt 3: 5 seconds delay
- Attempt 4: 15 seconds delay (max)

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bridge/relay` | POST | Initiate cross-chain relay |
| `/api/bridge/status/:docHash` | GET | Check relay status |
| `/api/bridge/jobs` | GET | List all bridge jobs |

---

## 3. Bridge Adapters

**Location:** `packages/bridge/adapters/`

Each adapter implements the `BridgeAdapter` interface:

```typescript
interface BridgeAdapter {
  relayReceipt(docHash: string, receiptData: any): Promise<{ txHash: string }>;
  getConfirmations(txHash: string): Promise<number>;
  getRequiredConfirmations(): number;
}
```

### Adapter Files

| File | Description |
|------|-------------|
| `base-polygon.ts` | Base → Polygon PoS bridge |
| `base-arbitrum.ts` | Base → Arbitrum One bridge |
| `base-optimism.ts` | Base → Optimism bridge |

### Configuration

Each adapter requires RPC endpoints in `.env`:

```env
# RPC Endpoints
BASE_RPC_URL=https://mainnet.base.org
POLYGON_RPC_URL=https://polygon-rpc.com
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io

# Bridge Private Key (for signing relay transactions)
BRIDGE_PRIVATE_KEY=your-bridge-wallet-private-key
```

---

## 4. Mesh Session Bridge (Cross-Tab Sync)

**Location:** `client/src/lib/meshSessionBridge.ts`

Synchronizes mesh state across browser tabs using BroadcastChannel API.

### State Structure

```typescript
interface MeshSessionState {
  wallet: string | null;      // Connected wallet address
  vaultUnlocked: boolean;     // Vault unlock status
  activeApps: string[];       // Currently active apps
  connectedProxies: string[]; // Connected proxy nodes
  lastActivity: number;       // Last activity timestamp
}
```

### Usage

```typescript
import meshSessionBridge from '@/lib/meshSessionBridge';

// Get current state
const state = meshSessionBridge.getState();

// Update wallet
meshSessionBridge.setWallet('0x123...');

// Update vault status
meshSessionBridge.setVaultUnlocked(true);

// Register/unregister apps
meshSessionBridge.registerApp('inbox');
meshSessionBridge.unregisterApp('inbox');

// Subscribe to state changes
const unsubscribe = meshSessionBridge.subscribe((state) => {
  console.log('State updated:', state);
});

// Cleanup
unsubscribe();
```

### Features

| Feature | Description |
|---------|-------------|
| **BroadcastChannel** | Real-time sync across tabs |
| **localStorage** | Persistent state across sessions |
| **sessionStorage** | Vault unlock status (cleared on close) |
| **Event Listeners** | Responds to wallet/vault changes |

---

## 5. Node Streaming Architecture

The mesh network is designed for decentralized live streaming:

### Flow Diagram

```
Broadcaster                    Relay Server                    Viewers
    │                              │                              │
    │  1. Create Manifest          │                              │
    │─────────────────────────────►│                              │
    │                              │                              │
    │  2. Disseminate Chunks       │                              │
    │─────────────────────────────►│  3. Store & Index            │
    │         (continuous)         │─────────────────────────►    │
    │                              │                              │
    │                              │  4. Poll Manifests           │
    │                              │◄─────────────────────────────│
    │                              │                              │
    │                              │  5. Fetch Chunks             │
    │                              │◄─────────────────────────────│
    │                              │                              │
    │                              │  6. Return Chunk Data        │
    │                              │─────────────────────────────►│
```

### Content Addressing

All content uses SHA-256 CIDs (Content Identifiers):

```typescript
// Generate CID from data
export async function generateCID(data: ArrayBuffer): Promise<CID> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

---

## 6. Setting Up Your Own Node

### Prerequisites

1. PostgreSQL database
2. Redis (for pub/sub)
3. Node.js 18+

### Steps

1. Clone and install:
   ```bash
   git clone https://github.com/archi-tect0/P3-Protocol.git
   cd P3-Protocol
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. Push database schema:
   ```bash
   npx drizzle-kit push
   ```

4. Start the node:
   ```bash
   npm run dev
   ```

5. Your node is now part of the mesh network and can:
   - Relay stream manifests and chunks
   - Bridge receipts to other chains
   - Sync session state across clients

---

## 7. Security Considerations

### Signing

All data transmissions are signed with session credentials:

```typescript
export async function signData(data: string, session: Session): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data + session.did + session.token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Private Keys

Bridge operations require a dedicated wallet:
- Use a separate wallet for bridge transactions
- Never use your main wallet's private key
- Fund with minimal ETH for gas

### Relay Trust

Currently uses Atlas v2 relay as trusted backend. Future versions will implement:
- WebRTC peer-to-peer mesh
- DHT-based node discovery
- Proof-of-relay incentives

---

## 8. Global Relay Network

The Global Relay Network enables cross-app mesh connectivity. If 1000 different apps adopt P3 Protocol, their nodes can discover and relay through each other.

### Foundation Lanes

Foundation lanes are universal and immutable across all P3 implementations:

| Lane | Purpose | Description |
|------|---------|-------------|
| 0 | Handshake | Control and capability negotiation |
| 1 | Identity | Wallet signatures and attestation |
| 2 | Keepalive | Heartbeat and connection health |
| 3 | Telemetry | Relay metrics and diagnostics |

Custom lanes (10+) can be reprogrammed per-app, but foundation lanes always work universally.

### Node Manifest

Nodes advertise their capabilities to the global registry:

```typescript
interface NodeManifest {
  nodeId: string;
  wallet: string;
  signature: string;
  foundationLaneVersion: string;
  customLanes: string[];
  capabilities: string[];
  endpoint: string;
  timestamp: number;
}
```

### Enabling Global Relay

**Via Settings UI:**
1. Connect your wallet (required for signature verification)
2. Navigate to Atlas Settings → Node Mode
3. Enable "Node Mode" (local mesh)
4. Toggle "Global Relay" to join the global network
5. Sign the registration message when prompted by your wallet

**Via Code:**

```typescript
import { setGlobalRelayEnabled, isGlobalRelayEnabled, getMeshClient } from '@/lib/meshClient';

// Enable global relay
const success = await setGlobalRelayEnabled(true);

// Check status
const isEnabled = isGlobalRelayEnabled();

// Discover global peers
const meshClient = getMeshClient();
const peers = await meshClient?.discoverGlobalPeers();

// Send via global relay (foundation lanes only)
await meshClient?.relayViaGlobal(targetNodeId, 0, { type: 'ping' });
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mesh/global/register` | POST | Register node with global network |
| `/api/mesh/global/unregister` | POST | Leave global network |
| `/api/mesh/global/peers` | GET | Discover available peers |
| `/api/mesh/global/relay` | POST | Send message via global relay |
| `/api/mesh/global/messages` | GET | Receive queued messages |
| `/api/mesh/global/stats` | GET | Network statistics |
| `/api/mesh/global/health` | GET | Health check |

### Security Considerations

1. **Foundation Lane Isolation**: Global relay only supports lanes 0-3. Custom app lanes cannot be relayed globally.

2. **Wallet Attestation**: ECDSA signature verification ensures nodes prove wallet ownership.
   - Nodes sign a canonical message: `p3-global-relay:{nodeId}:{wallet}:{timestamp}`
   - Server recovers the signer address using `ethers.verifyMessage()` and compares to claimed wallet
   - Timestamps must be within 5 minutes to prevent replay attacks

3. **Payload Limits**: Relay messages are capped at 64KB to prevent memory exhaustion attacks.

4. **Sender Validation**: Only registered nodes can relay messages through the global network.

5. **Rate Limiting**: Relay messages are rate-limited per-node to prevent abuse.

6. **Stale Node Cleanup**: Nodes that don't heartbeat within 5 minutes are removed.

### Cross-App Relay Example

App A (messaging app) and App B (video app) both use P3 Protocol:

```
App A Node                Global Registry                App B Node
    │                            │                            │
    │  1. Register(manifest)     │                            │
    │───────────────────────────►│                            │
    │                            │                            │
    │                            │  2. Register(manifest)     │
    │                            │◄───────────────────────────│
    │                            │                            │
    │  3. DiscoverPeers()        │                            │
    │───────────────────────────►│                            │
    │  [App B Node visible]      │                            │
    │◄───────────────────────────│                            │
    │                            │                            │
    │  4. Relay(lane:0, keepalive)                            │
    │────────────────────────────────────────────────────────►│
    │                            │                            │
```

Even though App A uses lanes 10-15 for chat and App B uses lanes 10-15 for video, they can still relay foundation lane messages through each other.

---

## Related Documentation

- [ENV_SETUP.md](./ENV_SETUP.md) - Environment configuration
- [API.md](./API.md) - API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
