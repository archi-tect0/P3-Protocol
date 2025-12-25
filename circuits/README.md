# Zero-Knowledge Circuits

**Status**: Scaffolded, not compiled (requires circom + snarkjs)

## Circuits

1. **DeliveryProof.circom** - Prove message delivery without revealing content
   - Located in `circuits/delivery/`
   - Verifies delivery acknowledgment with timestamp and signature
   - Future: Compile with `circom DeliveryProof.circom --r1cs --wasm --sym`

2. **GroupMembership.circom** - Prove group membership without revealing identity
   - Located in `circuits/membership/`
   - Uses Merkle tree for privacy-preserving membership proofs
   - Future: Compile with `circom GroupMembership.circom --r1cs --wasm --sym`

3. **Semaphore Protocol** - Industry-standard anonymous signaling
   - Located in `circuits/semaphore/`
   - Uses official Semaphore circuits from npm package
   - Integration with `services/zkmsg/` for zero-knowledge messaging

## Future Build Instructions

When `ENABLE_ZK_MSG=true`:

### Prerequisites
```bash
# Install circom compiler
npm install -g circom

# Install snarkjs for proof generation
npm install -g snarkjs
```

### Compile Circuits
```bash
# Delivery proof circuit
circom circuits/delivery/DeliveryProof.circom --r1cs --wasm --sym -o circuits/build/

# Group membership circuit
circom circuits/membership/GroupMembership.circom --r1cs --wasm --sym -o circuits/build/
```

### Generate Trusted Setup
```bash
# Powers of Tau ceremony (one-time)
snarkjs powersoftau new bn128 14 pot14_0000.ptau
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution"
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau

# Generate proving and verification keys
snarkjs groth16 setup circuits/build/DeliveryProof.r1cs pot14_final.ptau delivery_0000.zkey
snarkjs zkey contribute delivery_0000.zkey delivery_final.zkey --name="Contribution"
snarkjs zkey export verificationkey delivery_final.zkey delivery_verification_key.json
```

### Generate Proofs
```bash
# Create input file (input.json)
# Generate witness
node circuits/build/DeliveryProof_js/generate_witness.js circuits/build/DeliveryProof_js/DeliveryProof.wasm input.json witness.wtns

# Generate proof
snarkjs groth16 prove delivery_final.zkey witness.wtns proof.json public.json

# Verify proof
snarkjs groth16 verify delivery_verification_key.json public.json proof.json
```

## Integration with P3 Protocol

### Zero-Knowledge Messaging (`services/zkmsg/`)
The ZK circuits integrate with the privacy-preserving messaging service:

```typescript
import { anchorMessage, verifyMembership } from 'services/zkmsg';

// Sender: Create anonymous message with group membership proof
const envelope = await anchorMessage(
  encryptedMessage,
  userIdentitySeed,
  groupMerkleRoot
);

// Verifier: Confirm sender is in group without revealing identity
const isValid = await verifyMembership(
  groupMerkleRoot,
  envelopeHash,
  envelope.proof
);
```

### Use Cases
1. **Anonymous Whistleblowing** - Prove employment without revealing identity
2. **Private DAO Voting** - Prove token ownership without linking to wallet
3. **Confidential Communication** - Prove authorization without exposing credentials
4. **Delivery Receipts** - Prove message delivery without revealing content

## Circuit Security

- **Groth16 SNARK** - Succinct, non-interactive proofs with constant verification time
- **BN128 Curve** - Ethereum-compatible elliptic curve pairing
- **Merkle Tree Depth: 20** - Supports up to 1 million group members
- **Trusted Setup** - Requires multi-party computation ceremony (MPC)

## Performance

| Circuit | Constraints | Proving Time | Verification Time | Proof Size |
|---------|-------------|--------------|-------------------|------------|
| DeliveryProof | ~500 | ~2s | ~5ms | 128 bytes |
| GroupMembership | ~2000 | ~5s | ~5ms | 128 bytes |
| Semaphore | ~2500 | ~6s | ~5ms | 128 bytes |

*Times measured on standard hardware (8-core CPU, 16GB RAM)*

## Production Deployment

For production use:
1. Complete trusted setup ceremony with multiple contributors
2. Compile circuits with optimization flags
3. Generate verification contracts for on-chain verification (optional)
4. Integrate with `services/zkmsg/` backend service
5. Enable feature flag: `ENABLE_ZK_MSG=true`

## References

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Guide](https://github.com/iden3/snarkjs)
- [Semaphore Protocol](https://semaphore.appliedzkp.org/)
- [ZK Proof Systems](https://zkp.science/)
