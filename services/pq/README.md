# Post-Quantum Cryptography Module

## Overview

This module provides a scaffolded infrastructure for post-quantum cryptography operations, including Dilithium signatures and Kyber key encapsulation. The module is designed to work in both demo mode and production mode with full PQ security.

## Feature Flag

The PQ module is controlled by the `ENABLE_PQ` environment variable:

- **Demo Mode** (`ENABLE_PQ=false` or unset): PQ operations are stubbed out. Signature verification always passes, and dummy values are returned. This allows the application to run without requiring WASM dependencies.
- **Production Mode** (`ENABLE_PQ=true`): Full post-quantum cryptographic operations are enabled (requires WASM integration).

Set this in your `.env` file:
```
ENABLE_PQ=false  # Set to true to enable post-quantum security
```

## Current Implementation

The module currently provides stubs for the following operations:

### `initPQ()`
Initializes the PQ security module. In demo mode, logs a message indicating PQ security is disabled. In production mode, will initialize WASM modules (future implementation).

### `hashReceipt(data: Uint8Array): Uint8Array`
Hashes receipt data using BLAKE3. Works in both demo and production modes.

### `signReceipt(message: Uint8Array, secret: Uint8Array): Uint8Array`
Signs a receipt using Dilithium2 post-quantum signatures.
- **Demo mode**: Throws an error (signing not available in demo)
- **Production mode**: Will use actual Dilithium2 signatures (future implementation)
- Returns: 2420-byte signature (Dilithium2 signature size)

### `verifyReceipt(message: Uint8Array, sig: Uint8Array, pub: Uint8Array): boolean`
Verifies a receipt signature.
- **Demo mode**: Always returns `true`
- **Production mode**: Will perform actual Dilithium2 verification (future implementation)

### `pqSessionKey(pubKeyRecipient: Uint8Array)`
Generates a session key using Kyber768 key encapsulation.
- **Demo mode**: Returns dummy values
- **Production mode**: Will use actual Kyber768 encapsulation (future implementation)
- Returns: `{ ct: Uint8Array(1088), sharedSecret: Uint8Array(32) }` (Kyber768 sizes)

## Future WASM Integration

The production implementation will integrate WebAssembly modules for actual post-quantum cryptography:

### Planned Integration Steps

1. **WASM Module Selection**
   - Use `pqclean-wasm` or similar library for Dilithium and Kyber implementations
   - Ensure NIST standardization compliance (Dilithium CRYSTALS-Dilithium, Kyber CRYSTALS-KYBER)

2. **Integration Points**
   - `initPQ()`: Load and initialize WASM modules
   - `signReceipt()`: Replace stub with `dilithiumSign(message, secret)`
   - `verifyReceipt()`: Replace stub with `dilithiumVerify(message, sig, pub)`
   - `pqSessionKey()`: Replace stub with `kyberEncapsulate(pubKeyRecipient)`

3. **Build Process**
   - Update `package.json` to include WASM dependencies
   - Configure build to bundle WASM files
   - Add WASM module loading in the initialization sequence

4. **Testing**
   - Add integration tests for PQ operations
   - Performance benchmarking for signature/verification operations
   - Cross-browser WASM compatibility testing

## Dependencies

- `@noble/hashes`: For BLAKE3 hashing (currently used)
- Future: WASM-based Dilithium and Kyber libraries

## Usage Example

```typescript
import { initPQ, hashReceipt, signReceipt, verifyReceipt, pqSessionKey } from './services/pq';

// Initialize PQ module
await initPQ();

// Hash a receipt
const receiptData = new Uint8Array([1, 2, 3, 4]);
const hash = hashReceipt(receiptData);

// In production mode (ENABLE_PQ=true):
const secretKey = new Uint8Array(32); // Your secret key
const signature = signReceipt(receiptData, secretKey);

const publicKey = new Uint8Array(32); // Your public key
const isValid = verifyReceipt(receiptData, signature, publicKey);

// Generate session key
const recipientPubKey = new Uint8Array(32);
const { ct, sharedSecret } = pqSessionKey(recipientPubKey);
```

## Security Considerations

- In demo mode, all verifications pass by default. **Never use demo mode in production.**
- When implementing WASM integration, ensure proper key management and secure random number generation
- Post-quantum signatures are significantly larger than classical signatures (Dilithium2 signatures are ~2.4KB)
- Session key establishment with Kyber provides quantum-resistant confidentiality

## Building

```bash
cd services/pq
npm install
npm run build
```

This will compile TypeScript to JavaScript in the `dist/` directory.
