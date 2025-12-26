# @p3/protocol

P3 Protocol SDK - One-click integration for decentralized mesh applications.

## Installation

```bash
npm install @p3/protocol
```

## Quick Start

```typescript
import { createP3Client } from '@p3/protocol';

// Initialize client
const p3 = createP3Client({
  relay: 'wss://relay.p3protocol.io',
  usePQC: true,
  useZK: true,
});

// Connect wallet
const { address, chainId } = await p3.connect();
console.log(`Connected: ${address} on chain ${chainId}`);

// Send encrypted message
await p3.messaging.send(recipientPubkey, 'Hello, secure world!');

// Anchor receipt to blockchain
await p3.receipts.anchor(receiptHash);
```

## Configuration

```typescript
interface P3Config {
  relay?: string;      // Relay server URL
  usePQC?: boolean;    // Enable post-quantum cryptography
  useZK?: boolean;     // Enable zero-knowledge proofs
  chainId?: number;    // Chain ID for blockchain operations
  rpcUrl?: string;     // RPC URL for blockchain
  debug?: boolean;     // Enable debug logging
}
```

## Modules

### Messaging

End-to-end encrypted messaging with wallet identity.

```typescript
// Send encrypted message
await p3.messaging.send(recipientPubkey, 'Hello!');
```

### Receipts

Immutable blockchain audit trails.

```typescript
// Anchor receipt hash
const { txHash } = await p3.receipts.anchor(receiptHash);
```

### Session

Wallet session management.

```typescript
// Get session info
const { wallet, connected } = await p3.session.info();
```

### Governance

DAO governance interactions.

```typescript
import { GovernanceSDK, VoteType } from '@p3/protocol';

const gov = new GovernanceSDK(governorAddress, provider, signer);

// Create proposal
const { proposalId } = await gov.proposePolicyChange(actions, description);

// Vote
await gov.vote(proposalId, VoteType.For, 'Supporting this change');

// Execute
await gov.executeProposal(params);
```

## React Integration

For React applications, use the full SDK from the main package:

```typescript
import { P3, init } from 'p3-sdk';

// Initialize
await init();

// Use P3 namespace
const wallet = await P3.wallet();
```

## Advanced Usage

### Post-Quantum Cryptography

Enable quantum-resistant encryption:

```typescript
const p3 = createP3Client({ usePQC: true });
```

### Zero-Knowledge Proofs

Enable privacy-preserving identity verification:

```typescript
const p3 = createP3Client({ useZK: true });
```

## License

Apache License 2.0
