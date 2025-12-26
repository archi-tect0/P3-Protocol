# Post-Quantum Cryptography WASM Bindings

Rust-to-WebAssembly bindings for NIST-standardized post-quantum cryptographic algorithms. This module provides quantum-resistant key exchange and digital signatures for P3 Protocol.

---

## Overview

As quantum computers advance, current cryptographic standards (RSA, ECDSA, ECDH) will become vulnerable. P3 Protocol includes scaffolded bindings for NIST's post-quantum cryptography standards:

| Algorithm | Type | Purpose | Key Sizes |
|-----------|------|---------|-----------|
| **Kyber768** | KEM | Key encapsulation | 1184 byte public key, 1088 byte ciphertext |
| **Dilithium2** | Signature | Digital signatures | 1312 byte public key, 2420 byte signature |

---

## Status

**Current**: Scaffolded, not compiled (prevents WASM build overhead in demo mode)

**Activation**: Set `ENABLE_PQ=true` environment variable to build WASM bindings

The code is ready—dependencies and function signatures are defined but commented out until needed.

---

## Architecture

```
rust/pqcrypto/
├── Cargo.toml          # Dependencies (commented until activation)
├── src/
│   └── lib.rs          # WASM-bindgen exports (scaffolded)
└── README.md           # This file

Related TypeScript:
├── packages/zk/        # TypeScript interop layer
└── server/services/pq/ # Server-side PQ services
```

---

## Algorithms

### Kyber768 (Key Encapsulation)

NIST-selected lattice-based key encapsulation mechanism for establishing shared secrets.

```rust
// Encapsulate: Generate ciphertext and shared secret from public key
pub fn kyber_encapsulate(pub_key: &[u8]) -> Vec<u8> {
    let pk = KyberPub::from_bytes(pub_key).unwrap();
    let (ciphertext, shared_secret) = encapsulate(&pk);
    [ciphertext.as_bytes(), shared_secret.as_bytes()].concat()
}
```

**Use case**: Replace X25519 ECDH for quantum-resistant key exchange in messaging.

### Dilithium2 (Digital Signatures)

NIST-selected lattice-based signature scheme for authentication.

```rust
// Sign a message
pub fn dilithium_sign(message: &[u8], secret: &[u8]) -> Vec<u8> {
    sign(message, secret).as_bytes().to_vec()
}

// Verify a signature
pub fn dilithium_verify(message: &[u8], signature: &[u8], public_key: &[u8]) -> bool {
    verify(message, signature, public_key).is_ok()
}
```

**Use case**: Replace Ed25519/ECDSA for quantum-resistant transaction signing.

---

## Build Instructions

### Prerequisites

1. Install Rust:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. Install wasm-pack:
   ```bash
   cargo install wasm-pack
   ```

### Activation

1. Set environment variable:
   ```bash
   export ENABLE_PQ=true
   ```

2. Uncomment dependencies in `Cargo.toml`:
   ```toml
   [dependencies]
   pqcrypto-dilithium = "0.8"
   pqcrypto-kyber = "0.8"
   blake3 = "1.5"
   wasm-bindgen = "0.2"
   ```

3. Uncomment code in `src/lib.rs`

4. Build WASM:
   ```bash
   wasm-pack build --target nodejs
   ```

5. Output: `pkg/pqcrypto.js` and `pkg/pqcrypto_bg.wasm`

---

## JavaScript Usage

After building, the following functions will be available (currently scaffolded, not compiled):

```typescript
import * as pq from './pkg/pqcrypto';

// Digital signatures (scaffolded in src/lib.rs)
const signature = pq.dilithium_sign(message, secretKey);
const valid = pq.dilithium_verify(message, signature, publicKey);

// Key encapsulation (scaffolded in src/lib.rs)
const encapsulated = pq.kyber_encapsulate(publicKey);
// Returns concatenated [ciphertext, sharedSecret]
```

**Note**: Key generation functions (`kyber_keygen`, `dilithium_keygen`) are not yet scaffolded. These would need to be added to `src/lib.rs` before building.

---

## Integration with P3 Protocol

The PQ bindings integrate with the existing encryption stack:

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID ENCRYPTION                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Current (Classical)          Future (Post-Quantum)         │
│  ─────────────────────        ─────────────────────         │
│  X25519 (Key Exchange)   →    Kyber768 (KEM)                │
│  Ed25519 (Signatures)    →    Dilithium2 (Signatures)       │
│  XSalsa20-Poly1305       →    XSalsa20-Poly1305 (unchanged) │
│                                                              │
│  Hybrid Mode: Run BOTH classical and PQ in parallel         │
│  - Protects against implementation bugs in new algorithms   │
│  - Maintains backward compatibility                         │
│  - Gradual migration path                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Performance Considerations

| Operation | Classical (µs) | Post-Quantum (µs) | Overhead |
|-----------|----------------|-------------------|----------|
| Key generation | ~50 | ~200 | 4x |
| Encapsulation | ~100 | ~300 | 3x |
| Signature | ~50 | ~500 | 10x |
| Verification | ~100 | ~200 | 2x |

PQ operations are slower but still practical for most applications. Signature creation has the highest overhead.

---

## Security Notes

- **NIST Standardized**: Kyber and Dilithium are NIST's selected algorithms (August 2024)
- **Lattice-based**: Resistant to both classical and quantum attacks
- **Hybrid recommended**: Run classical + PQ in parallel during transition period
- **Key sizes larger**: Plan for increased bandwidth/storage requirements

---

## References

- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [Kyber Specification](https://pq-crystals.org/kyber/)
- [Dilithium Specification](https://pq-crystals.org/dilithium/)
- [pqcrypto Rust crate](https://crates.io/crates/pqcrypto)
