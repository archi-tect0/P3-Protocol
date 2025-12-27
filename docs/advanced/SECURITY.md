# Security & Identity - Advanced Systems

This guide documents P3 Protocol's advanced security features including post-quantum encryption, zero-knowledge proofs, secret management, and privacy-preserving telemetry.

## Post-Quantum Kyber

P3 Protocol includes database infrastructure for hybrid post-quantum encryption using CRYSTALS-Kyber (lattice-based cryptography).

### Database Schema

**Code Reference:** `server/migrations/009_add_kyber_columns.sql`

```sql
ALTER TABLE pubkeys 
ADD COLUMN IF NOT EXISTS kyber_pub_b64 TEXT,
ADD COLUMN IF NOT EXISTS kyber_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pubkeys_kyber_enabled 
  ON pubkeys(kyber_enabled) WHERE kyber_enabled = TRUE;
```

### What This Enables

The Kyber columns allow storing:
- `kyber_pub_b64`: Base64-encoded Kyber-1024 public key
- `kyber_enabled`: Flag indicating post-quantum capability

### Hybrid Handshake Flow

When both parties support Kyber, the handshake performs:

```
1. Standard X25519 key exchange (classical security)
2. Kyber-1024 encapsulation (quantum resistance)
3. Combined shared secret derivation
```

This provides defense-in-depth: even if quantum computers break X25519, Kyber protects the session.

### Provisioning Kyber Keys

To enable post-quantum for an identity:

```typescript
// Future implementation pattern
import { kyber1024 } from '@noble/post-quantum';

const { publicKey, privateKey } = kyber1024.keypair();

// Store public key in database
await db.update(pubkeys)
  .set({
    kyber_pub_b64: Buffer.from(publicKey).toString('base64'),
    kyber_enabled: true
  })
  .where(eq(pubkeys.wallet, walletAddress));
```

### Current Status

- Database columns: **Ready**
- Handshake integration: **Planned** (see `server/protocol/session/handshake-v2.ts`)
- Key generation: **External dependency** (use `@noble/post-quantum` or similar)

---

## Zero-Knowledge Proofs

P3 Protocol includes ZK proof generation and verification for privacy-preserving receipts.

### Architecture

**Code Reference:** `server/zk-routes.ts`

The ZK system supports four circuit types:
- `MessageReceipt`: Prove message delivery without revealing content
- `MeetingReceipt`: Prove call participation without revealing participants
- `PaymentReceipt`: Prove payment occurred without revealing wallet addresses
- `ConsentState`: Prove consent without revealing identity

### API Endpoints

```bash
# Check ZK availability
GET /api/zk/status

# Generate proof (authenticated)
POST /api/zk/prove
{
  "circuit": "PaymentReceipt",
  "inputs": { ... }
}

# Verify proof (public)
POST /api/zk/verify
{
  "circuit": "PaymentReceipt",
  "proof": { ... },
  "publicSignals": ["..."]
}

# Get metrics (admin only)
GET /api/zk/metrics
```

### Apache 2.0 Compatibility

The default implementation uses snarkjs (GPL). For Apache 2.0 compliance, alternatives are suggested:

```json
{
  "alternatives": [
    "arkworks-rs (MIT/Apache-2.0)",
    "gnark (Apache-2.0)"
  ]
}
```

### Privacy Guarantee

ZK proofs allow:
- Proving a transaction occurred without revealing wallet addresses
- Proving payment amount within a range without exact value
- Proving identity membership without revealing which identity

Proof size: ~200 bytes (BN254 curve)
Verification time: ~10ms

---

## Secret Vault

P3 Protocol includes a production-grade secret management system with encryption at rest and automatic rotation.

### Features

**Code Reference:** `server/secrets.ts`

- AES-256-GCM encryption for all secrets
- 90-day rotation tracking with expiry alerts
- Short-lived TURN credentials (≤30 minutes)
- Comprehensive audit logging
- Master key derivation via PBKDF2

### Managed Secret Types

```typescript
type SecretKey =
  | 'JWT_SECRET'
  | 'IP_SALT'
  | 'TURN_USERNAME'
  | 'TURN_CREDENTIAL'
  | 'PINATA_JWT'
  | 'WEB3_STORAGE_TOKEN'
  | 'NFT_STORAGE_TOKEN';
```

### Usage

```typescript
import { getSecretManager, initializeSecretManager } from './secrets';

// Initialize (once at startup)
const secretManager = initializeSecretManager(storage, process.env.MASTER_KEY);
await secretManager.initialize('system');

// Get a secret
const jwtSecret = await secretManager.getSecret('JWT_SECRET', 'api-server');

// Rotate a secret
const newValue = await secretManager.rotateSecret('JWT_SECRET', 'admin');

// Generate short-lived TURN token
const turnToken = await secretManager.generateTurnToken('webrtc-service');
// Returns: { username, credential, expiresAt } - valid for 30 minutes

// Check for expiring secrets
const warnings = await secretManager.checkExpiringSecrets();
// Returns secrets expiring within 7 days
```

### Rotation Workflow

```
1. Secret created with 90-day expiry
2. Warning generated at 7 days before expiry
3. rotateSecret() generates new value
4. Old secret immediately invalidated
5. Rotation event logged to audit trail
```

### Audit Logging

Every secret access is logged:

```typescript
interface SecretAccessLog {
  key: SecretKey;
  action: 'read' | 'write' | 'rotate' | 'generate_turn_token';
  timestamp: Date;
  actor: string;
}
```

---

## Privacy-Preserving Telemetry

P3 Protocol implements telemetry that enables fraud detection without storing personally identifiable information.

### Schema Design

**Code Reference:** `shared/schema.ts`

```typescript
// Telemetry events use cryptographic hashes, not raw values
hashedIp: text("hashed_ip").notNull(),  // SHA-256 of IP + salt
uaHash: text("ua_hash"),                 // SHA-256 of User-Agent
```

### How It Works

```
User IP: 192.168.1.100
Salt: [per-deployment secret from vault]
Stored: SHA-256(IP + Salt) = "a1b2c3..."
```

Benefits:
- **Fraud Detection**: Same hash = same device fingerprint
- **Privacy**: Cannot reverse hash to get IP
- **Compliance**: No PII stored
- **Audit**: Can prove same device without knowing which device

### Implementation Pattern

```typescript
import { createHash } from 'crypto';

function hashIdentifier(value: string, salt: string): string {
  return createHash('sha256')
    .update(value + salt)
    .digest('hex');
}

// Usage in telemetry
const event = {
  hashedIp: hashIdentifier(req.ip, await getSecret('IP_SALT')),
  uaHash: hashIdentifier(req.headers['user-agent'], await getSecret('IP_SALT')),
  // ... other non-PII fields
};
```

### Use Cases

1. **Sybil Attack Detection**: Same `hashedIp` creating multiple wallets
2. **Session Hijacking**: Different `uaHash` for same session
3. **Rate Limiting**: Count requests per `hashedIp` without storing IP
4. **Abuse Reporting**: Link abusive behavior to device without deanonymizing

### Privacy Guarantee

Users can verify:
1. No raw IP addresses in database
2. No raw user agents in database
3. Hashes are one-way (cannot recover original)
4. Salt rotation invalidates old hashes
