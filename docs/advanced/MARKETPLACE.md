# Marketplace & Commerce - Advanced Systems

This guide documents P3 Protocol's marketplace features including content licensing, lending/borrowing, and cross-chain settlement.

## Licensing Gate

The gate service handles content access control, license issuance, and decrypt token generation.

### Architecture

**Code Reference:** `server/marketplace/gate.ts`

```typescript
// Settlement modes
const SettleModeEnum = z.enum([
  'BASE_USDC',    // Direct USDC on Base
  'BASE_DIRECT',  // Native ETH on Base
  'RELAY_LZ',     // LayerZero cross-chain
  'RELAY_WH'      // Wormhole cross-chain
]);
```

### License Types

Three licensing operations are supported:

| Operation | Use Case | Token Duration |
|-----------|----------|----------------|
| **Checkout** | Purchase (perpetual) | 30 minutes |
| **Borrow** | Time-limited rental | 30 minutes |
| **Stream** | Pay-per-view | 2 hours |

### API Endpoints

```bash
# Purchase content (perpetual license)
POST /api/marketplace/gate/checkout
{
  "assetId": "uuid",
  "anchor": true,
  "settleMode": "BASE_USDC"
}

# Borrow content (time-limited)
POST /api/marketplace/gate/borrow
{
  "assetId": "uuid",
  "days": 7,
  "anchor": true
}

# Stream content (session-based)
POST /api/marketplace/gate/stream
{
  "assetId": "uuid",
  "anchor": true
}

# Check license status
GET /api/marketplace/gate/license/:id

# Verify decrypt token
POST /api/marketplace/gate/verify
{ "token": "jwt..." }
```

### Decrypt Token Structure

Licenses issue JWT-based decrypt tokens:

```typescript
{
  "licenseId": "uuid",
  "assetId": "uuid",
  "jti": "unique-token-id",
  "exp": 1735689600  // Expiry timestamp
}
```

### Response Format

```json
{
  "licenseId": "abc123",
  "decryptToken": "eyJ...",
  "settlement": {
    "mode": "BASE_USDC",
    "originChain": "base",
    "txHashBase": "0x...",
    "relayStatus": "confirmed"
  }
}
```

---

## Lending & Borrowing

The borrow system enables time-limited content access with automatic expiration.

### Borrow Schema

```typescript
const BorrowSchema = z.object({
  assetId: z.string().uuid(),
  appId: z.string().default('p3-marketplace'),
  days: z.number().min(1).max(365),  // 1 day to 1 year
  anchor: z.boolean().default(true),
  settleMode: SettleModeEnum.default('BASE_USDC'),
  originChain: z.string().default('base'),
  feeCurrency: z.string().default('USDC'),
});
```

### Borrowing Flow

```
1. User requests borrow: POST /gate/borrow { days: 7 }
2. System checks asset supports lending
3. Settlement processed on blockchain
4. License created with expiresAt = now + days
5. Decrypt token issued (30-minute validity)
6. Receipt anchored on Base
```

### Expiration Handling

```typescript
// License status check auto-expires
if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
  await db.update(marketplaceLicenses)
    .set({ status: 'expired' })
    .where(eq(marketplaceLicenses.id, license.id));
}
```

### Policy Enforcement

Assets must explicitly support borrowing:

```typescript
function ensureBorrowable(asset: any): void {
  if (!['lend_days', 'perpetual'].includes(asset.policy)) {
    throw new Error('Asset does not support borrowing');
  }
}
```

---

## Cross-Chain Settlement

P3 Protocol supports multi-chain fee settlement with LayerZero and Wormhole bridges.

### Architecture

**Code Reference:** `server/marketplace/settlement.ts`

```typescript
type SettleMode = 
  | 'BASE_USDC'    // Direct USDC transfer on Base
  | 'BASE_DIRECT'  // Native ETH on Base
  | 'RELAY_LZ'     // LayerZero cross-chain relay
  | 'RELAY_WH';    // Wormhole cross-chain relay

interface SettlementParams {
  licenseId: string;
  assetId: string;
  buyerWallet: string;
  authorWallet: string;
  amountUsd: number;
  settleMode: SettleMode;
  originChain: string;
  feeCurrency?: string;
}
```

### Settlement Methods

**BASE_USDC (Default)**
```typescript
// Direct USDC transfer on Base
const amountWei = ethers.parseUnits(params.amountUsd.toString(), 6);
const tx = await usdc.transfer(params.authorWallet, amountWei);
```

**BASE_DIRECT**
```typescript
// Native ETH transfer on Base
const ethPriceUsd = 3000; // Dynamic in production
const amountEth = params.amountUsd / ethPriceUsd;
const tx = await wallet.sendTransaction({
  to: params.authorWallet,
  value: ethers.parseEther(amountEth.toFixed(18))
});
```

**RELAY_LZ (LayerZero)**
```typescript
interface LayerZeroRelayParams extends SettlementParams {
  srcChainId: number;
  dstChainId: number;
  adapterParams?: string;
}
```

**RELAY_WH (Wormhole)**
```typescript
interface WormholeRelayParams extends SettlementParams {
  srcChainId: number;
  dstChainId: number;
}
```

### Confirmation Requirements

Different chains require different confirmation counts:

```typescript
const CONFIRMATIONS = {
  'base': 1,
  'ethereum': 12,
  'polygon': 128,
  'arbitrum': 20,
  'optimism': 20
};
```

### Relay Status Tracking

```typescript
type RelayStatus = 'pending' | 'confirmed' | 'failed';

// License tracks relay status
await db.update(marketplaceLicenses)
  .set({ relayStatus: 'confirmed' })
  .where(eq(marketplaceLicenses.id, license.id));
```

---

## Blockchain Anchoring

All marketplace operations can be anchored on Base for immutable receipts.

### Anchor Fee

```typescript
const ANCHOR_FEE_USD = 0.57;  // Per-anchor cost
```

### Anchoring Flow

```typescript
await anchorOnBase({
  eventType: 'checkout',     // or 'borrow', 'stream'
  assetId,
  buyerWallet: wallet,
  authorWallet: asset.authorWallet,
  appId,
  settleMode,
  originChain,
  txHashBase: settlementResult.txHashBase,
});
```

### Stream Batch Anchoring

For high-volume streams, plays are batched before anchoring:

```typescript
// Batch accumulates 50 plays before anchoring
if (digests.length >= 50) {
  const batchDigest = computeDigest({ batchId, digests });
  
  await db.update(streamBatches)
    .set({ status: 'closed', batchDigest, closedAt: new Date() })
    .where(eq(streamBatches.id, batchId));
  
  // Create receipt for batch
  await db.insert(marketplaceReceipts).values({
    eventType: 'stream',
    assetId,
    authorWallet: asset.authorWallet,
    digest: batchDigest,
    batchId,
    batchDigests: digests,
    status: 'submitted',
  });
}
```

### Receipt Verification

```typescript
// Verify token authenticity
const claims = jwt.verify(token, JWT_SECRET);
// Returns: { licenseId, assetId, jti, exp }

// Verify license still valid
const license = await getLicense(claims.licenseId);
if (license.status !== 'active') {
  throw new Error('License no longer valid');
}
```
