# P3 Protocol - Zero-Knowledge Circuits

This package contains zero-knowledge circuits and prover infrastructure for the P3 Protocol, enabling privacy-preserving proofs for communication, meetings, payments, and consent.

## Overview

The ZK package provides four main circuits:

1. **MessageReceipt**: Proves message authenticity without revealing content
2. **MeetingReceipt**: Proves meeting validity without exposing participant details
3. **PaymentReceipt**: Proves payment compliance without revealing sensitive data
4. **ConsentState**: Proves user consent without exposing user identity

## Directory Structure

```
packages/zk/
├── circuits/           # Circom circuit definitions
│   ├── MessageReceipt.circom
│   ├── MeetingReceipt.circom
│   ├── PaymentReceipt.circom
│   └── ConsentState.circom
├── prover/            # TypeScript prover service
│   └── index.ts
├── build/             # Compiled circuits and keys (generated)
└── package.json       # Build scripts and dependencies
```

## Building the Circuits

### Prerequisites

- Node.js >= 16
- circom compiler (installed via npm)
- snarkjs

### Compilation Steps

1. **Compile all circuits:**
   ```bash
   cd packages/zk
   npm run compile
   ```

2. **Generate proving and verification keys:**
   ```bash
   npm run keygen
   ```

   Note: Key generation can take several minutes and requires significant memory.

3. **Full build (compile + keygen):**
   ```bash
   npm run build
   ```

### Individual Circuit Commands

- Compile specific circuit: `npm run compile:message`
- Generate keys for specific circuit: `npm run keygen:payment`

## Circuit Specifications

### MessageReceipt

**Public Inputs:**
- `contentHash`: Poseidon hash of message content
- `senderHash`: Poseidon hash of sender address
- `recipientHash`: Poseidon hash of recipient address
- `timestampMin`, `timestampMax`: Valid timestamp range

**Private Inputs:**
- `rawContent[256]`: Actual message content
- `senderAddress[4]`: Sender wallet address
- `recipientAddress[4]`: Recipient wallet address
- `timestamp`: Exact timestamp

**Proof:** Verifies that the private inputs hash to the public values and timestamp is in range.

### MeetingReceipt

**Public Inputs:**
- `roomIdHash`: Hash of meeting room identifier
- `participantsRoot`: Merkle root of participants
- `startTime`, `endTime`: Meeting time boundaries
- `metricsRoot`: Hash of meeting metrics

**Private Inputs:**
- `participantAddresses[8][4]`: Up to 8 participant addresses
- `participantCount`: Actual participant count
- `rawMetrics[16]`: Meeting quality metrics
- `roomId[32]`: Room identifier

**Proof:** Verifies meeting validity without revealing participant identities or raw metrics.

### PaymentReceipt

**Public Inputs:**
- `ledgerEventHash`: Hash of transaction event
- `amount`: Payment amount
- `asset[32]`: Asset identifier
- `counterpartyHash`: Hash of counterparty address
- `minAmount`, `maxAmount`: Compliance range

**Private Inputs:**
- `rawAddress[4]`: Counterparty address
- `memo[128]`: Private transaction memo
- `txData[64]`: Raw transaction data

**Proof:** Proves payment compliance and validity without exposing sensitive details.

### ConsentState

**Public Inputs:**
- `consentRoot`: Merkle root of all consents
- `policyHash`: Hash of privacy policy
- `userHash`: Hash of user identity
- `requiredScopes[8]`: Required permission scopes
- `minValidUntil`: Minimum validity timestamp

**Private Inputs:**
- `userIdentity[4]`: User wallet address
- `consentData[32]`: Consent details and scopes
- `policyData[64]`: Full policy document
- `signature[2]`: User signature on consent

**Proof:** Proves user consent without revealing identity or full consent details.

## Prover Service

### Usage

```typescript
import { zkProverService } from './packages/zk/prover/index';

// Generate a proof
const result = await zkProverService.generateProof({
  circuit: 'MessageReceipt',
  inputs: {
    rawContent: [...],
    senderAddress: [...],
    contentHash: '0x...',
    // ... other inputs
  }
});

console.log(result.proof);
console.log(result.publicSignals);

// Verify a proof
const isValid = await zkProverService.verifyProof(
  'MessageReceipt',
  proof,
  publicSignals
);
```

### Features

- **Job Queue**: Asynchronous proof generation with queuing
- **Retry Logic**: Exponential backoff for failed proofs (max 3 attempts)
- **Metrics**: Tracks proof generation statistics
  - Total proofs generated
  - Success/failure rates
  - Average proof time
  - Queue length

### API Endpoints

The ZK routes are mounted at `/api/zk/`:

#### POST /api/zk/prove
Generate a zero-knowledge proof.

**Request:**
```json
{
  "circuit": "MessageReceipt",
  "inputs": {
    "contentHash": "12345...",
    "rawContent": [1, 2, 3, ...],
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "proof": { ... },
  "publicSignals": ["123", "456", ...],
  "circuit": "MessageReceipt"
}
```

#### POST /api/zk/verify
Verify a zero-knowledge proof.

**Request:**
```json
{
  "circuit": "MessageReceipt",
  "proof": { ... },
  "publicSignals": ["123", "456", ...]
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "circuit": "MessageReceipt"
}
```

#### GET /api/zk/metrics
Get prover service metrics (admin only).

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalProofs": 100,
    "successfulProofs": 98,
    "failedProofs": 2,
    "avgProofTime": 1234,
    "lastProofTime": 1100,
    "queueLength": 3
  }
}
```

#### GET /api/zk/health
Check prover service health.

**Response:**
```json
{
  "success": true,
  "healthy": true,
  "queueLength": 0,
  "totalProofs": 100
}
```

## Integration Example

```typescript
// In your application code
import { apiRequest } from '@/lib/queryClient';

// Generate a message receipt proof
const generateMessageProof = async (messageData) => {
  const response = await apiRequest('/api/zk/prove', {
    method: 'POST',
    body: JSON.stringify({
      circuit: 'MessageReceipt',
      inputs: {
        rawContent: messageData.content,
        senderAddress: messageData.sender,
        recipientAddress: messageData.recipient,
        timestamp: messageData.timestamp,
        contentHash: hashContent(messageData.content),
        senderHash: hashAddress(messageData.sender),
        recipientHash: hashAddress(messageData.recipient),
        timestampMin: messageData.timestamp - 300,
        timestampMax: messageData.timestamp + 300,
      }
    })
  });
  
  return response.json();
};

// Verify a proof
const verifyProof = async (circuit, proof, publicSignals) => {
  const response = await apiRequest('/api/zk/verify', {
    method: 'POST',
    body: JSON.stringify({
      circuit,
      proof,
      publicSignals
    })
  });
  
  return response.json();
};
```

## Performance Considerations

- **Proof Generation Time**: Typically 1-5 seconds depending on circuit complexity
- **Memory Requirements**: Minimum 4GB RAM for key generation
- **Circuit Size**: MessageReceipt (~256 constraints), MeetingReceipt (~512 constraints)
- **Queue Management**: Proofs are processed sequentially to manage resource usage

## Security Notes

1. **Trusted Setup**: The current implementation uses a deterministic powers of tau ceremony. For production, use a multi-party computation ceremony.
2. **Private Input Protection**: Never log or expose private inputs
3. **Proof Verification**: Always verify proofs before trusting public signals
4. **Key Security**: Store proving keys securely and never share verification keys

## Troubleshooting

### Circuit compilation fails
- Ensure circom is installed: `circom --version`
- Check circuit syntax in `.circom` files
- Verify circomlib path in includes

### Key generation runs out of memory
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=8192 npm run keygen`
- Reduce circuit size if possible
- Use a machine with more RAM (recommended: 8GB+)

### Proof generation is slow
- Check if queue has backlog: `GET /api/zk/metrics`
- Consider horizontal scaling with multiple prover instances
- Optimize circuit constraints

## Development

To add a new circuit:

1. Create `circuits/YourCircuit.circom`
2. Add compile script to `package.json`: `"compile:your": "circom circuits/YourCircuit.circom ..."`
3. Add keygen scripts: `"keygen:your": "..."`
4. Update `prover/index.ts` to include circuit paths
5. Run `npm run build`

## License

Apache License 2.0 - See LICENSE file for details
