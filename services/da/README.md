# Modular DA & Settlement Module

Cost-optimized data availability routing across multiple DA layers with Ethereum settlement.

## Overview

This module provides:
- **Multi-DA Routing**: Automatic selection of cheapest DA layer
- **Settlement Adapters**: Post data commitments to Ethereum
- **Merkle Proofs**: Batch multiple blobs with cryptographic verification
- **Pluggable Architecture**: Easy to add new DA providers

## DA Adapter Comparison

| Provider | Cost/KB | Latency | Finality | Data Retention | Status |
|----------|---------|---------|----------|----------------|--------|
| **Celestia** | ~1 unit | ~15s | Probabilistic | 30 days+ | Implemented |
| **Ethereum Calldata** | ~68 gas/byte | ~12s | Absolute | Permanent | Planned |
| **Avail** | ~0.5 units | ~20s | Probabilistic | 30 days+ | Planned |
| **EigenDA** | ~0.3 units | ~10s | Ethereum-secured | Variable | Planned |

## Usage

### Basic DA Publishing

```typescript
import { routeBatch, CelestiaAdapter } from "./services/da";
import { EthereumAdapter } from "./services/da/adapters/ethereum";

const data = new Uint8Array([1, 2, 3, 4]);
const daAdapters = [CelestiaAdapter];
const settlement = EthereumAdapter;

const result = await routeBatch(data, daAdapters, settlement);
console.log(result);
// { handle: "celestia:1699...:4", tx: "0xabc...", adapter: "Celestia" }
```

### Merkle Root Calculation

```typescript
import { calculateMerkleRoot } from "./services/da";

const blobs = [
  new Uint8Array([1, 2]),
  new Uint8Array([3, 4]),
  new Uint8Array([5, 6])
];

const root = calculateMerkleRoot(blobs);
console.log(root); // "0x..."
```

### Cost Estimation

```typescript
const estimates = await Promise.all(
  daAdapters.map(async (adapter) => ({
    name: adapter.name,
    cost: await adapter.costEstimate(1024 * 100) // 100 KB
  }))
);

console.log(estimates);
// [{ name: "Celestia", cost: 100 }, ...]
```

## Architecture

```
┌─────────────────┐
│  Application    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  routeBatch()   │────▶│ Cost Ranking │
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│  Chosen Adapter │────▶│ publishBlob()│
└────────┬────────┘     └──────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────┐
│ Settlement Layer│────▶│ submitBatch()│
└─────────────────┘     └──────────────┘
```

## Environment Variables

```bash
ENABLE_MODULAR_DA=true  # Enable/disable multi-DA routing
```

## Adding New DA Adapters

Implement the `DAAdapter` interface:

```typescript
import { DAAdapter } from "../index";

export const MyDAAdapter: DAAdapter = {
  name: "MyDA",
  async publishBlob(data: Uint8Array): Promise<string> {
    // Publish to your DA layer
    return "handle:...";
  },
  async verifyAvailability(handle: string): Promise<boolean> {
    // Check if data is available
    return true;
  },
  async costEstimate(bytes: number): Promise<number> {
    // Return cost in standard units
    return bytes / 1024;
  }
};
```

## Settlement Adapters

Implement the `SettlementAdapter` interface:

```typescript
import { SettlementAdapter } from "../index";

export class MySettlement implements SettlementAdapter {
  chain = "MyChain";
  
  async submitBatch(daHandle: string, merkleRoot: string): Promise<string> {
    // Submit commitment to your settlement layer
    return "tx:...";
  },
  
  async finalize(txHash: string): Promise<boolean> {
    // Check if transaction is finalized
    return true;
  }
}
```

## Security Considerations

- **Data Withholding**: Celestia/Avail use fraud proofs; monitor network health
- **Merkle Proofs**: Always verify inclusion proofs before trusting data
- **Settlement Finality**: Wait for sufficient confirmations on Ethereum
- **Key Management**: Store settlement keys securely (HSM recommended)

## Future Enhancements

- [ ] Avail adapter implementation
- [ ] EigenDA adapter implementation
- [ ] Ethereum calldata adapter
- [ ] DAS (Data Availability Sampling) integration
- [ ] Multi-settlement support (Arbitrum, Optimism, Polygon)
- [ ] Automatic failover between DA providers
- [ ] Cost prediction ML model
- [ ] Real-time DA health monitoring
