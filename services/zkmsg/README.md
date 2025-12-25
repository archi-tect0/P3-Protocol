# Zero-Knowledge Messaging Module

This module provides privacy-preserving messaging capabilities using zero-knowledge proofs and the Semaphore protocol for group membership verification.

## Features

- **Group Membership Proofs**: Prove membership in a group without revealing identity
- **Privacy-Preserving Messaging**: Send messages with cryptographic proof of authorization
- **Semaphore Integration**: Built on the Semaphore protocol for anonymous signaling
- **Delivery Proofs**: Cryptographic proof that messages were delivered to valid group members

## Architecture

The ZK messaging module enables users to send messages while proving they belong to an authorized group, without revealing their specific identity. This is achieved through:

1. **Identity Commitment**: Users generate a secret identity that gets committed to a Merkle tree
2. **Group Root**: The Merkle root represents the set of authorized participants
3. **Zero-Knowledge Proofs**: When sending a message, users generate a ZK proof that:
   - They know a secret identity in the group (membership)
   - The message hash corresponds to their encrypted message
   - Without revealing which specific member they are

## Installation

```bash
cd services/zkmsg
npm install
npm run build
```

## Configuration

Set the following environment variable to enable ZK messaging:

```bash
ENABLE_ZK_MSG=true  # Set to false to disable ZK messaging (default: false)
```

When disabled, the module operates in demo mode with no actual ZK proof generation.

## Usage Examples

### 1. Create a Group Identity

```typescript
import { createGroupIdentity } from './services/zkmsg';

// Generate a new identity with a random seed
const identity = createGroupIdentity();

// Or use a deterministic seed
const deterministicIdentity = createGroupIdentity("my-secret-seed");
```

### 2. Anchor a Message with ZK Proof

```typescript
import { anchorMessage } from './services/zkmsg';

// Encrypt your message
const messageText = "Hello, anonymous group!";
const ciphertext = new TextEncoder().encode(messageText);

// Create envelope with ZK proof
const envelope = await anchorMessage(
  ciphertext,
  "user-identity-seed",
  "0x1234...groupRoot"  // Merkle root of authorized group
);

console.log("Encrypted envelope:", envelope);
// {
//   ctext: Uint8Array,
//   salt: Uint8Array,
//   groupRoot: "0x1234...",
//   proof: { ... }  // ZK proof of group membership
// }
```

### 3. Verify Group Membership

```typescript
import { verifyMembership } from './services/zkmsg';
import { blake3 } from "@noble/hashes/blake3";

// Hash the envelope
const envelopeHash = blake3(envelope.ctext);
const envelopeHashHex = Buffer.from(envelopeHash).toString("hex");

// Verify the sender was in the authorized group
const isValid = await verifyMembership(
  envelope.groupRoot,
  envelopeHashHex,
  envelope.proof
);

console.log("Valid group member:", isValid);
```

## Integration with P3 Protocol

### Anonymous Message Receipts

Combine ZK messaging with P3 receipts for privacy-preserving message verification:

```typescript
import { anchorMessage, verifyMembership } from './services/zkmsg';
import { anchorReceipt } from '../server/services/receipts';

async function sendAnonymousMessage(
  message: string,
  userIdentitySeed: string,
  groupRoot: string
) {
  // Encrypt the message
  const ciphertext = new TextEncoder().encode(message);
  
  // Create ZK envelope
  const envelope = await anchorMessage(ciphertext, userIdentitySeed, groupRoot);
  
  // Anchor on-chain for immutability
  const receipt = {
    type: "ZKMessage",
    envelopeHash: Buffer.from(blake3(envelope.ctext)).toString("hex"),
    groupRoot: envelope.groupRoot,
    proof: envelope.proof,
    timestamp: new Date().toISOString()
  };
  
  const txHash = await anchorReceipt(receipt);
  
  return { envelope, txHash };
}
```

### Group Chat with Privacy

Create private group chats where participants can prove membership without doxxing:

```typescript
// Define a group of authorized DIDs
const groupMembers = [
  "did:key:z6Mkh...",
  "did:key:z6Mkp...",
  "did:key:z6Mkq..."
];

// Build Merkle tree and get root
const groupRoot = buildMerkleRoot(groupMembers);

// Send message as anonymous group member
const { envelope } = await sendAnonymousMessage(
  "Meeting at 3pm",
  myIdentitySeed,
  groupRoot
);

// Recipients verify sender is in authorized group
const isAuthorized = await verifyMembership(
  envelope.groupRoot,
  Buffer.from(blake3(envelope.ctext)).toString("hex"),
  envelope.proof
);
```

## Semaphore Protocol

The module is designed to integrate with [Semaphore](https://semaphore.appliedzkp.org/), a zero-knowledge protocol for anonymous signaling:

### Key Concepts

1. **Identity**: A secret value known only to the user
   ```typescript
   identity = hash(secret)
   ```

2. **Identity Commitment**: A public commitment to the identity
   ```typescript
   identityCommitment = poseidon(identity)
   ```

3. **Group**: A Merkle tree of identity commitments
   ```typescript
   group = MerkleTree([commitment1, commitment2, ...])
   groupRoot = group.root
   ```

4. **Proof Generation**: Prove membership without revealing which member
   ```typescript
   proof = generateProof({
     identity,
     groupRoot,
     signal: messageHash,
     nullifier: hash(identity, externalNullifier)
   })
   ```

### Current Implementation Status

The module is scaffolded with commented-out Semaphore imports to allow:

- **Development Mode**: Work on integration without full ZK circuit compilation
- **Testing**: Test message flow with mock proofs
- **Future Integration**: Uncomment imports when ready to use real Semaphore proofs

To enable full Semaphore:

1. Compile Semaphore circuits (computationally intensive)
2. Uncomment import statements in `index.ts`
3. Set `ENABLE_ZK_MSG=true`
4. Use `generateProof` and `verifyProof` for real ZK proofs

## Use Cases

### 1. Anonymous Whistleblowing

Employees can report issues while proving they're authorized reporters:

```typescript
const report = "Security vulnerability in system X";
const envelope = await anchorMessage(
  new TextEncoder().encode(report),
  employeeIdentitySeed,
  companyEmployeesGroupRoot
);
// Proof shows: "Someone in the company sent this" without revealing who
```

### 2. Private DAO Voting

Vote on proposals while maintaining privacy:

```typescript
const vote = "YES";
const envelope = await anchorMessage(
  new TextEncoder().encode(vote),
  voterIdentitySeed,
  daoMembersGroupRoot
);
// Proof shows: "A valid DAO member voted" without revealing which member
```

### 3. Confidential Messaging

Send messages to authorized groups with plausible deniability:

```typescript
const message = "Sensitive information";
const envelope = await anchorMessage(
  new TextEncoder().encode(message),
  senderIdentitySeed,
  authorizedRecipientsGroupRoot
);
// Proof shows: "Someone authorized sent this" preserving sender anonymity
```

## Security Considerations

1. **Identity Protection**: Never expose or commit identity seeds to version control
2. **Group Management**: Carefully control who gets added to group Merkle trees
3. **Nullifiers**: Use external nullifiers to prevent double-signaling attacks
4. **Replay Protection**: Include timestamps or nonces in message hashes
5. **Proof Verification**: Always verify ZK proofs before trusting anonymous messages

## Dependencies

- `@noble/hashes`: Cryptographic hashing (blake3)
- `snarkjs`: zk-SNARK proof generation and verification
- `semaphore-protocol`: Group membership and anonymous signaling

## Performance Notes

- **Proof Generation**: CPU-intensive, takes ~2-5 seconds on modern hardware
- **Proof Verification**: Fast, takes ~10-100ms
- **Group Size**: Supports groups up to ~65,000 members (Merkle tree depth 16)
- **Caching**: Consider caching Merkle proofs for frequently used groups

## Future Enhancements

- [ ] Rate limiting with RLN (Rate-Limiting Nullifier)
- [ ] Multi-group membership proofs
- [ ] Selective message disclosure with additional ZK circuits
- [ ] Integration with P3 rollup for scalable on-chain anchoring
- [ ] Support for larger groups with deeper Merkle trees
- [ ] Message threading with privacy preservation
- [ ] Integration with DID/VC for credential-gated groups

## References

- [Semaphore Protocol](https://semaphore.appliedzkp.org/)
- [ZK Messaging Whitepaper](https://eprint.iacr.org/2021/1243)
- [Privacy-Preserving Messaging](https://research.protocol.ai/blog/2021/privacy-preserving-messaging/)
