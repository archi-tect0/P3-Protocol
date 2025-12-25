# P3 Protocol - L3 Rollup Infrastructure

High-throughput event processing infrastructure for the P3 Protocol, providing Layer 3 rollup capabilities with data availability, checkpointing, and cross-chain bridging.

## Architecture

The rollup infrastructure consists of several key components:

### 1. Sequencer (`sequencer/index.ts`)
- Orders and batches application events
- Generates Merkle roots for event batches
- Posts batches to AnchorRegistry on L2
- Configurable batch interval (default: 30s)
- Maximum batch size limit (default: 1000 events)

### 2. State Manager (`state/manager.ts`)
- RocksDB-based state tracking
- Event indexing by ID
- Consent root caching with versioning
- Rule evaluation result caching
- Batch checkpoint storage

### 3. Data Availability Adapter (`da/adapter.ts`)
- Writes batch data to L2 calldata
- Optional blob storage support for large batches
- Automatic compression and encoding
- Batch data retrieval and verification

### 4. Checkpoint Service (`checkpoint/service.ts`)
- Periodic L1 checkpointing (default: hourly)
- Combines L2 state root and DAO governance root
- Posts checkpoints to CheckpointRegistry on L1
- Checkpoint finalization after delay period

### 5. Bridge Client (`bridge/client.ts`)
- Cross-chain receipt relay
- Emits CrossChainReceiptBridge events
- Tracks confirmation status on target chain
- Automatic retry and failure handling

## Installation

```bash
cd packages/rollup
npm install
```

## Configuration

Set the following environment variables:

```bash
# Network Configuration
L1_RPC_URL=https://ethereum-mainnet-rpc-url
L2_RPC_URL=https://l2-network-rpc-url

# Keys
PRIVATE_KEY=your-private-key
ROLLUP_PRIVATE_KEY=your-rollup-operator-key

# Contract Addresses
ANCHOR_REGISTRY_ADDRESS=0x...
CHECKPOINT_REGISTRY_ADDRESS=0x...

# Service Flags
ENABLE_SEQUENCER=true
ENABLE_DA_ADAPTER=true
ENABLE_CHECKPOINT=true
ENABLE_BLOB_STORAGE=false

# Configuration
BATCH_INTERVAL=30000
MAX_BATCH_SIZE=1000
CHECKPOINT_INTERVAL=3600000
MAX_CALLDATA_SIZE=131072
ROLLUP_STATE_DB_PATH=./data/rollup-state
```

## CLI Usage

### Start All Services

```bash
rollup start --all
```

### Start Specific Services

```bash
# Start only the sequencer
rollup start --sequencer

# Start only the checkpoint service
rollup start --checkpoint
```

### Force Batch Creation

```bash
rollup batch --force
```

### Create Manual Checkpoint

```bash
rollup checkpoint --l2-root 0x... --dao-root 0x...
```

### Check Status

```bash
rollup status
```

## API Integration

Add rollup routes to your Express server:

```typescript
import { createRollupRoutes, initializeRollupServices } from './server/rollup-routes';

// Initialize services
await initializeRollupServices({
  anchorRegistryABI: [...],
  checkpointRegistryABI: [...],
});

// Add routes
app.use(createRollupRoutes());
```

### Available Endpoints

#### GET `/api/rollup/status`
Get status of all rollup services

```json
{
  "timestamp": 1700000000000,
  "services": {
    "sequencer": {
      "running": true,
      "stats": {
        "queueSize": 42,
        "isProcessing": false,
        "batchInterval": 30000,
        "maxBatchSize": 1000
      }
    },
    "stateManager": { ... },
    "dataAvailability": { ... },
    "checkpoint": { ... },
    "bridge": { ... }
  }
}
```

#### POST `/api/rollup/event`
Submit an event to the sequencer

```json
{
  "id": "event-123",
  "type": "message",
  "userId": "user-456",
  "data": { ... }
}
```

#### POST `/api/rollup/batch/force`
Force immediate batch creation

#### GET `/api/rollup/state/event/:eventId`
Get event index from state

#### GET `/api/rollup/state/consent/:userId`
Get consent root for a user

Query params:
- `version` (optional): Specific version to retrieve

#### POST `/api/rollup/bridge/relay`
Relay a receipt cross-chain

```json
{
  "receiptId": "receipt-123",
  "sourceChain": "ethereum",
  "targetChain": "optimism",
  "data": { ... }
}
```

#### GET `/api/rollup/bridge/receipt/:receiptId`
Get cross-chain receipt status

## Smart Contracts

### CheckpointRegistry (L1)

Located at `contracts/rollup/CheckpointRegistry.sol`

Key functions:
- `submitCheckpoint(l2Root, daoStateRoot, metadata)` - Submit new checkpoint
- `finalizeCheckpoint(checkpointId)` - Finalize after delay
- `getCheckpoint(checkpointId)` - Get checkpoint details
- `getLatestCheckpoint()` - Get most recent checkpoint
- `authorizeSubmitter(address)` - Authorize checkpoint submitter
- `setFinalizationDelay(delay)` - Update finalization delay

## Event Flow

1. **Event Submission**: Application events are submitted to the sequencer
2. **Batching**: Sequencer orders events and creates batches every 30s (or when full)
3. **Merkle Root**: Sequencer generates Merkle root of batch
4. **L2 Anchoring**: Batch posted to AnchorRegistry on L2
5. **Data Availability**: Batch data written to L2 calldata (or blob storage)
6. **State Indexing**: Events indexed in RocksDB state manager
7. **Checkpointing**: Hourly checkpoints submitted to L1 CheckpointRegistry
8. **Cross-chain**: Receipts relayed to other chains via bridge

## Development

Build:
```bash
npm run build
```

Run CLI in development:
```bash
npm run cli -- status
```

## License

Apache-2.0
