# Cryptography Primitives

P3 Protocol implements a comprehensive cryptographic stack for E2E encryption, key management, and zero-knowledge proofs.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CRYPTOGRAPHIC LAYERS                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    APPLICATION LAYER                         │    │
│  │  Messages │ Receipts │ Identity │ Payments │ Documents      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    CRYPTO PRIMITIVES                         │    │
│  │  TweetNaCl │ SHA-256 │ Poseidon │ Groth16 │ Ed25519         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    KEY MANAGEMENT                            │    │
│  │  Generation │ Rotation │ Derivation │ Secure Erasure        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Symmetric Encryption

### XSalsa20-Poly1305 (TweetNaCl)

Used for message encryption after key exchange:

| Property | Value |
|----------|-------|
| Algorithm | XSalsa20 stream cipher |
| Authentication | Poly1305 MAC |
| Key size | 256 bits |
| Nonce size | 192 bits |
| Security level | 128-bit |

```typescript
// client/src/lib/crypto.ts
import nacl from 'tweetnacl';

// Symmetric encryption
function encryptSecretBox(plaintext: Uint8Array, key: Uint8Array): { nonce: string; ciphertext: string } {
  const nonce = nacl.randomBytes(24);
  const ciphertext = nacl.secretbox(plaintext, nonce, key);
  
  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
}

function decryptSecretBox(nonce: string, ciphertext: string, key: Uint8Array): Uint8Array | null {
  const decrypted = nacl.secretbox.open(
    decodeBase64(ciphertext),
    decodeBase64(nonce),
    key
  );
  return decrypted;
}
```

---

## Asymmetric Encryption

### X25519 Key Exchange + XSalsa20-Poly1305

Used for E2E encrypted messaging:

| Property | Value |
|----------|-------|
| Key exchange | X25519 (Curve25519) |
| Key size | 256 bits |
| Encryption | XSalsa20-Poly1305 (nacl.box) |

```typescript
// Generate keypair
const keyPair = nacl.box.keyPair();
// keyPair.publicKey: 32 bytes
// keyPair.secretKey: 32 bytes

// Encrypt message for recipient
function encryptBox(
  plaintext: string,
  recipientPublicKey: Uint8Array,
  senderSecretKey: Uint8Array
): EncryptedMessage {
  const nonce = nacl.randomBytes(24);
  const ciphertext = nacl.box(
    decodeUTF8(plaintext),
    nonce,
    recipientPublicKey,
    senderSecretKey
  );

  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
    ephemeralPublicKey: encodeBase64(senderPublicKey),
  };
}

// Decrypt received message
function decryptBox(
  message: EncryptedMessage,
  senderPublicKey: Uint8Array,
  recipientSecretKey: Uint8Array
): string | null {
  const plaintext = nacl.box.open(
    decodeBase64(message.ciphertext),
    decodeBase64(message.nonce),
    senderPublicKey,
    recipientSecretKey
  );

  return plaintext ? encodeUTF8(plaintext) : null;
}
```

**Source:** `client/src/lib/crypto.ts`

---

## Digital Signatures

### Ethereum Signatures (secp256k1)

Primary signature scheme for wallet authentication:

```typescript
import { verifyMessage } from 'ethers';

// Verify wallet signature
function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}
```

---

## Hash Functions

### SHA-256

Used for content hashing and receipt generation:

```typescript
import { sha256 } from '@noble/hashes/sha256';

function hashContent(content: string): string {
  const hash = sha256(new TextEncoder().encode(content));
  return Buffer.from(hash).toString('hex');
}

// Receipt hash generation
function generateReceiptHash(receipt: Receipt): string {
  const canonical = JSON.stringify({
    type: receipt.type,
    timestamp: receipt.timestamp,
    data: receipt.data,
  });
  return '0x' + hashContent(canonical);
}
```

### Poseidon (ZK-friendly)

Used for zero-knowledge circuits:

```typescript
// packages/zk/prover/index.ts
import { buildPoseidon } from 'circomlibjs';

const poseidon = await buildPoseidon();

// ZK-friendly hash
function poseidonHash(inputs: bigint[]): bigint {
  return poseidon.F.toObject(poseidon(inputs));
}

// Example: Hash wallet address for ZK proof
const walletHash = poseidonHash([BigInt(walletAddress)]);
```

---

## Zero-Knowledge Proofs

### Groth16 (via snarkjs)

Used for privacy-preserving receipt verification:

| Property | Value |
|----------|-------|
| Proof system | Groth16 |
| Curve | BN254 |
| Proof size | ~200 bytes |
| Verification time | ~10ms |

```typescript
// packages/zk/prover/index.ts
export class ZKProverService {
  private circuitPaths = {
    MessageReceipt: { wasm: '...', zkey: '...' },
    MeetingReceipt: { wasm: '...', zkey: '...' },
    PaymentReceipt: { wasm: '...', zkey: '...' },
    ConsentState: { wasm: '...', zkey: '...' },
  };

  async generateProof(input: ProofInput): Promise<ProofOutput> {
    const circuit = this.circuitPaths[input.circuit];
    
    const { proof, publicSignals } = await groth16.fullProve(
      input.inputs,
      circuit.wasm,
      circuit.zkey
    );

    return { proof, publicSignals };
  }

  async verifyProof(
    proof: any,
    publicSignals: string[],
    circuit: string
  ): Promise<boolean> {
    const vkey = await this.loadVerificationKey(circuit);
    return groth16.verify(vkey, publicSignals, proof);
  }
}
```

### Supported Circuits

| Circuit | Purpose | Public Inputs |
|---------|---------|---------------|
| `MessageReceipt` | Prove message sent | Recipient hash, timestamp |
| `MeetingReceipt` | Prove meeting occurred | Duration, participant count |
| `PaymentReceipt` | Prove payment made | Amount hash, recipient hash |
| `ConsentState` | Prove consent given | Policy hash, timestamp |

**Source:** `packages/zk/circuits/`, `packages/zk/prover/index.ts`

---

## Key Rotation

### Rotation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    KEY ROTATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Generate new keypair                                    │
│     └── newKeyPair = nacl.box.keyPair()                    │
│                                                              │
│  2. Publish new public key                                  │
│     └── Anchor to blockchain                               │
│     └── Broadcast to contacts                              │
│                                                              │
│  3. Re-encrypt existing data (optional)                    │
│     └── Decrypt with old key                               │
│     └── Re-encrypt with new key                            │
│                                                              │
│  4. Secure erasure of old key                              │
│     └── oldKey.secretKey.fill(0)                           │
│     └── Clear all references                               │
│                                                              │
│  5. Update session                                          │
│     └── Store new public key                               │
│     └── Notify connected sessions                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
async function rotateKeys(cryptoService: CryptoService) {
  // 1. Generate new keypair
  const { publicKey, secretKeyForBackup } = cryptoService.generateSessionKeys();

  // 2. Anchor new public key
  await anchorReceipt({
    type: 'key.rotation',
    publicKey,
    timestamp: Date.now(),
  });

  // 3. Broadcast to contacts
  await broadcastKeyUpdate(publicKey);

  // 4. Clear old key (happens in generateSessionKeys)
  // Old secretKey is zeroed before new key is set

  return { publicKey, backup: secretKeyForBackup };
}
```

---

## Post-Quantum Roadmap

### Kyber Integration (Planned)

```typescript
// Future hybrid encryption envelope
interface HybridEnvelope {
  version: 2;
  classical: {
    algorithm: 'x25519-xsalsa20-poly1305';
    ciphertext: string;
    nonce: string;
  };
  postQuantum: {
    algorithm: 'kyber-1024';
    encapsulation: string;
    ciphertext: string;
  };
}

// Decryption requires both keys
async function decryptHybrid(
  envelope: HybridEnvelope,
  classicalSecretKey: Uint8Array,
  kyberSecretKey: Uint8Array
): Promise<Uint8Array> {
  // 1. Decrypt classical layer
  const classicalPlaintext = nacl.box.open(...);
  
  // 2. Decrypt post-quantum layer
  const pqPlaintext = await kyber.decapsulate(
    envelope.postQuantum.encapsulation,
    kyberSecretKey
  );

  // 3. XOR both plaintexts (defense in depth)
  return xor(classicalPlaintext, pqPlaintext);
}
```

### Migration Path

| Phase | Timeline | Actions |
|-------|----------|---------|
| 1. Prepare | Now | Architecture supports hybrid envelopes |
| 2. Optional | 2025 | Kyber available for opt-in |
| 3. Default | 2026 | Hybrid encryption default |
| 4. Mandatory | 2027+ | PQ-only for new keys |

---

## Security Considerations

### Key Storage

| Context | Storage | Protection |
|---------|---------|------------|
| Public key | localStorage | Persistent, shareable |
| Secret key | Memory only | Session-scoped, never persisted |
| Backup | User export | User-controlled |
| Session token | Memory | Ephemeral |

### Secure Erasure

```typescript
// Always zero secret keys before disposal
function secureErase(key: Uint8Array): void {
  key.fill(0);
}

// CryptoService implementation
clearSessionKeys(): void {
  if (this.keyPair) {
    this.keyPair.secretKey.fill(0); // Overwrite memory
  }
  this.keyPair = null;
  this.sessionUnlocked = false;
}
```

### Random Number Generation

```typescript
// Always use cryptographic RNG
const nonce = nacl.randomBytes(24);      // TweetNaCl CSPRNG
const challenge = crypto.randomBytes(32); // Node.js crypto
const uuid = crypto.randomUUID();         // Web Crypto API
```

---

## Source Files

| Component | Location |
|-----------|----------|
| Crypto service | `client/src/lib/crypto.ts` |
| Atlas crypto | `client/src/lib/atlasCrypto.ts` |
| Gallery crypto | `client/src/lib/galleryCrypto.ts` |
| ZK prover | `packages/zk/prover/index.ts` |
| ZK circuits | `packages/zk/circuits/` |
| SDK crypto module | `client/src/lib/sdk/modules/crypto.ts` |
| Vault | `client/src/lib/vault.ts` |
