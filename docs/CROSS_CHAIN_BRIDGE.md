# Cross-Chain Bridge

This document describes the cross-chain bridge infrastructure for P3 Protocol, enabling receipt relay across multiple L2 networks.

## Overview

The Cross-Chain Bridge enables receipt anchoring across multiple blockchain networks from Base as the source chain. Supported target chains: Polygon, Arbitrum, and Optimism.

## Directory Structure

```
packages/bridge/
├── adapters/
│   ├── base-polygon.ts     # Base → Polygon adapter
│   ├── base-arbitrum.ts    # Base → Arbitrum adapter
│   └── base-optimism.ts    # Base → Optimism adapter
├── relay/
│   └── service.ts          # Relay orchestration service
└── monitor/
    └── index.ts            # Bridge monitoring (placeholder)
```

## BridgeAdapter Interface

Every chain adapter implements this interface:

```typescript
interface BridgeAdapter {
  relayReceipt(docHash: string, receiptData: any): Promise<{ txHash: string }>;
  getConfirmations(txHash: string): Promise<number>;
  getRequiredConfirmations(): number;
}
```

## Adapters

### BaseToPolygonAdapter

```typescript
import { BaseToPolygonAdapter } from './packages/bridge/adapters/base-polygon';

const adapter = new BaseToPolygonAdapter();
const result = await adapter.relayReceipt(docHash, receiptData);
const confirmations = await adapter.getConfirmations(result.txHash);
const required = adapter.getRequiredConfirmations(); // 128
```

### BaseToArbitrumAdapter

```typescript
import { BaseToArbitrumAdapter } from './packages/bridge/adapters/base-arbitrum';

const adapter = new BaseToArbitrumAdapter();
const result = await adapter.relayReceipt(docHash, receiptData);
const required = adapter.getRequiredConfirmations(); // 20
```

### BaseToOptimismAdapter

```typescript
import { BaseToOptimismAdapter } from './packages/bridge/adapters/base-optimism';

const adapter = new BaseToOptimismAdapter();
const result = await adapter.relayReceipt(docHash, receiptData);
const required = adapter.getRequiredConfirmations(); // 50
```

## Relay Service

The `BridgeRelayService` orchestrates relay operations:

```typescript
import { BridgeRelayService } from './packages/bridge/relay/service';

const relayService = new BridgeRelayService();

// Relay a receipt to a target chain
const result = await relayService.relayReceipt(
  docHash,           // SHA-256 hash of document
  'polygon',         // Target chain: 'polygon' | 'arbitrum' | 'optimism'
  receiptData        // Receipt payload
);

if (result.success) {
  console.log('Relayed:', result.txHash);
}
```

### Retry Logic

The relay service includes retry with configurable delays:

```typescript
// Retry delays: 1s, 5s, 15s
private retryDelays = [1000, 5000, 15000];
```

### RelayJob Interface

```typescript
interface RelayJob {
  id: string;
  docHash: string;
  targetChain: 'polygon' | 'arbitrum' | 'optimism';
  receiptData: any;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'relaying' | 'confirmed' | 'failed';
}
```

## Supported Chains

| Chain | Adapter | Required Confirmations | Default RPC |
|-------|---------|----------------------|-------------|
| Polygon | `BaseToPolygonAdapter` | 128 | polygon-rpc.com |
| Arbitrum | `BaseToArbitrumAdapter` | 20 | arb1.arbitrum.io/rpc |
| Optimism | `BaseToOptimismAdapter` | 50 | mainnet.optimism.io |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BRIDGE_PRIVATE_KEY` | Yes | Private key for relay transactions (shared across chains) |
| `POLYGON_RPC_URL` | No | Polygon RPC endpoint |
| `ARBITRUM_RPC_URL` | No | Arbitrum RPC endpoint |
| `OPTIMISM_RPC_URL` | No | Optimism RPC endpoint |
| `BASE_POLYGON_BRIDGE_ADDRESS` | No | Bridge contract on Polygon |
| `BASE_ARBITRUM_BRIDGE_ADDRESS` | No | Bridge contract on Arbitrum |
| `BASE_OPTIMISM_BRIDGE_ADDRESS` | No | Bridge contract on Optimism |

## Bridge Contract Interface

Each chain has a deployed bridge contract:

```solidity
interface IP3Bridge {
    function relayReceipt(bytes32 docHash, bytes calldata receiptData) external returns (bytes32);
    event ReceiptRelayed(bytes32 indexed docHash, bytes32 indexed txHash, uint256 timestamp);
}
```

## External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `ethers` | ^6.x | Ethereum interaction |

## Integration Example

```typescript
import { BridgeRelayService } from './packages/bridge/relay/service';
import { createHash } from 'crypto';

const bridge = new BridgeRelayService();

// Create document hash
const docHash = '0x' + createHash('sha256').update(JSON.stringify(receiptPayload)).digest('hex');

// Relay to single chain
const result = await bridge.relayReceipt(docHash, 'polygon', receiptPayload);

// Check confirmations
const { confirmations, required } = await bridge.checkConfirmations(
  'polygon',
  result.txHash
);
```

## Modular Extraction

The bridge package can be extracted as `@p3/bridge`:

### Files to Copy

```
packages/bridge/adapters/base-polygon.ts
packages/bridge/adapters/base-arbitrum.ts
packages/bridge/adapters/base-optimism.ts
packages/bridge/relay/service.ts
```

### Extraction Checklist

- [ ] Create `package.json` with `@p3/bridge` scope
- [ ] Export all adapters and relay service
- [ ] Add unit tests
- [ ] Publish to npm

## License

Apache License 2.0
