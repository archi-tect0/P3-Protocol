# Security Architecture

P3 Protocol implements a zero-PII, wallet-anchored security model with end-to-end encryption, biometric unlock, and defense-in-depth protections.

---

## Threat Model

### Assets Protected
| Asset | Protection |
|-------|------------|
| User identity | Wallet address only (zero PII) |
| Messages | E2E encrypted (TweetNaCl box) |
| Session keys | Memory-only, never persisted |
| Receipts | Blockchain-anchored, immutable |
| Preferences | Wallet-scoped, encrypted at rest |

### Attack Vectors Addressed
| Vector | Mitigation |
|--------|------------|
| Session hijacking | Wallet signature verification |
| Replay attacks | Nonce-based challenges |
| MITM | TLS + E2E encryption |
| Key extraction | Memory-only secret keys |
| Brute force | Rate limiting per wallet |

---

## Zero-PII Design

P3 Protocol stores **no personally identifiable information**:

- **Identity**: Wallet address is the sole identifier
- **Authentication**: Cryptographic signature, not passwords
- **Contacts**: Wallet addresses, not names/emails
- **Messages**: E2E encrypted, server sees ciphertext only
- **Analytics**: Anonymized, wallet-hashed metrics

```typescript
// No PII in user records - wallet address is sole identifier
// Sessions contain only:
// - walletAddress (0x...)
// - publicKey (for E2E encryption)
// - sessionToken (ephemeral)
// No name, email, phone, or other PII stored
```

**Source:** `server/auth.ts`, `client/src/lib/sessionBridgeV2.ts`

---

## Wallet Authentication

### Challenge-Response Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Server  │         │ Wallet   │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │ 1. Request challenge│                    │
     │ ───────────────────>│                    │
     │                     │                    │
     │ 2. Return nonce     │                    │
     │ <───────────────────│                    │
     │                     │                    │
     │ 3. Sign nonce       │                    │
     │ ────────────────────────────────────────>│
     │                     │                    │
     │ 4. Return signature │                    │
     │ <────────────────────────────────────────│
     │                     │                    │
     │ 5. Submit signature │                    │
     │ ───────────────────>│                    │
     │                     │ 6. Verify via      │
     │                     │    ecrecover       │
     │ 7. Session token    │                    │
     │ <───────────────────│                    │
```

### Implementation

The challenge-response flow uses SIWE (Sign-In with Ethereum) compatible messages:

```typescript
// Server generates challenge with nonce
// Client signs with wallet (WalletConnect, Coinbase, etc.)
// Server verifies signature recovers correct wallet address

import { verifyMessage } from 'ethers';

const recoveredAddress = verifyMessage(challengeMessage, signature);
const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
```

**Source:** `server/auth.ts`, `client/src/lib/sessionBridgeV2.ts`, `client/src/lib/coinbaseAuth.ts`

---

## Encryption Stack

### TweetNaCl (Current)

P3 uses TweetNaCl for all E2E encryption:

| Operation | Algorithm | Key Size |
|-----------|-----------|----------|
| Key exchange | X25519 | 256-bit |
| Symmetric encryption | XSalsa20-Poly1305 | 256-bit |
| Signing | Ed25519 | 256-bit |

```typescript
// Message encryption
const nonce = nacl.randomBytes(24);
const ciphertext = nacl.box(
  decodeUTF8(plaintext),
  nonce,
  recipientPublicKey,
  senderSecretKey
);

// Encrypted message format
interface EncryptedMessage {
  nonce: string;           // Base64-encoded nonce
  ciphertext: string;      // Base64-encoded ciphertext
  ephemeralPublicKey: string; // Sender's ephemeral public key
}
```

**Source:** `client/src/lib/crypto.ts`

### Kyber Post-Quantum (Roadmap)

Architecture is designed for post-quantum migration:

```typescript
// Hybrid encryption envelope (future)
interface HybridEnvelope {
  classicalCiphertext: string;  // Current X25519
  pqCiphertext: string;         // Future Kyber-1024
  algorithm: 'x25519' | 'kyber' | 'hybrid';
}
```

**Note:** Kyber integration requires compiled WebAssembly binaries. The architecture supports drop-in replacement.

---

## Key Management

### Key Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     KEY LIFECYCLE                            │
├─────────────────────────────────────────────────────────────┤
│  1. GENERATION                                               │
│     └── nacl.box.keyPair() → ephemeral keys                 │
│                                                              │
│  2. STORAGE                                                  │
│     └── Public key: localStorage (persistent)               │
│     └── Secret key: Memory only (session-scoped)            │
│                                                              │
│  3. BACKUP (optional)                                        │
│     └── User exports base64 secret key                      │
│     └── Never stored server-side                            │
│                                                              │
│  4. ROTATION                                                 │
│     └── Generate new keypair                                │
│     └── Re-encrypt existing messages (optional)             │
│     └── Publish new public key                              │
│                                                              │
│  5. DESTRUCTION                                              │
│     └── secretKey.fill(0) - secure erasure                  │
│     └── Clear references                                    │
└─────────────────────────────────────────────────────────────┘
```

### Secure Key Erasure

```typescript
clearSessionKeys(): void {
  if (this.keyPair) {
    this.keyPair.secretKey.fill(0); // Overwrite memory
  }
  this.keyPair = null;
  this.sessionUnlocked = false;
}
```

**Source:** `client/src/lib/crypto.ts`

---

## Session Security

### Session Bridge

The session bridge syncs wallet state across tabs and devices:

```typescript
interface BridgeSession {
  address: string;
  chainId: number;
  connected: boolean;
  publicKey: string;
  sessionToken: string;
}

// Cross-tab synchronization via BroadcastChannel
const channel = new BroadcastChannel('p3-session');
channel.onmessage = (event) => {
  if (event.data.type === 'session-update') {
    syncSession(event.data.session);
  }
};
```

### Session Hardening

| Protection | Implementation |
|------------|----------------|
| Token expiry | 1-hour JWT lifetime |
| Replay protection | Single-use nonces |
| Tab isolation | BroadcastChannel scoping |
| Logout propagation | Cross-tab session clear |

**Source:** `client/src/lib/sessionBridgeV2.ts`

---

## Biometric & PIN Unlock

### PIN Recovery Flow

For devices without hardware wallet access:

```typescript
// PIN-based key derivation
const salt = crypto.randomBytes(16);
const derivedKey = await crypto.subtle.deriveBits(
  {
    name: 'PBKDF2',
    salt: salt,
    iterations: 100000,
    hash: 'SHA-256',
  },
  pinKey,
  256
);

// Encrypted secret key backup
const encryptedBackup = nacl.secretbox(
  secretKey,
  nonce,
  derivedKey
);
```

### Biometric Integration (Platform-Dependent)

```typescript
// WebAuthn credential creation
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: serverChallenge,
    rp: { name: 'P3 Protocol' },
    user: {
      id: walletAddressBytes,
      name: walletAddress,
      displayName: 'P3 User',
    },
    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
  },
});
```

**Source:** `client/src/components/PinAuthDialog.tsx`

---

## Rate Limiting

### Per-Wallet Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Challenge requests | 5 | 60 sec |
| WebSocket connections | 3 | Per wallet |
| Messages per minute | 60 | Per connection |
| API requests | 100 | 60 sec |

### Implementation

```typescript
const walletRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(wallet: string): boolean {
  const now = Date.now();
  const limit = walletRateLimits.get(wallet);
  
  if (!limit || now > limit.resetAt) {
    walletRateLimits.set(wallet, { count: 1, resetAt: now + 60000 });
    return true;
  }
  
  return limit.count++ < RATE_LIMIT_MAX;
}
```

**Source:** `server/routes/pulse.ts`, `server/middleware/security.ts`

---

## Incident Response

### Security Events Logged

| Event | Action |
|-------|--------|
| Failed signature verification | Log + rate limit |
| Session token reuse | Invalidate all sessions |
| Rate limit exceeded | Temporary block |
| Invalid message format | Log + drop |

### Audit Trail

All security-relevant events are anchored:

```typescript
// Anchor security event
await anchorReceipt({
  type: 'security.event',
  eventHash: sha256(JSON.stringify(event)),
  timestamp: Date.now(),
  severity: 'warning',
});
```

---

## Source Files

| Component | Location |
|-----------|----------|
| Crypto service | `client/src/lib/crypto.ts` |
| Session bridge | `client/src/lib/sessionBridgeV2.ts` |
| Auth service | `server/auth.ts` |
| Security middleware | `server/middleware/security.ts` |
| PIN auth dialog | `client/src/components/PinAuthDialog.tsx` |
| Rate limiting | `server/routes/pulse.ts` |
