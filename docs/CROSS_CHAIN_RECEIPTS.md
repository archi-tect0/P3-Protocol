# Cross-Chain Receipts & Blockchain Anchoring

P3 Protocol anchors cryptographic receipts to the blockchain, creating immutable proof of events. This document covers the anchoring flow, smart contracts, and cross-chain bridging.

---

## Overview

Every significant user action generates a receipt that can be anchored on-chain:

| Event Type | Receipt Data | Anchoring |
|------------|--------------|-----------|
| Message sent | Hash of encrypted content | Immediate |
| Payment made | Amount, recipient, timestamp | Immediate |
| Meeting completed | Duration, participants (hashed) | Batched |
| Document signed | Document hash, signer | Immediate |
| Consent given | Policy hash, timestamp | Immediate |

---

## Receipt Structure

```typescript
interface Receipt {
  id: string;                    // Unique identifier
  eventHash: string;             // SHA-256 of event data
  eventType: string;             // 'message' | 'payment' | 'meeting' | etc.
  timestamp: number;             // Unix timestamp
  walletAddress: string;         // Signer's wallet
  signature: string;             // User's signature
  metadata?: Record<string, any>; // Optional metadata
  anchorTx?: string;             // Blockchain transaction hash
  anchorChain?: string;          // 'base' | 'polygon' | 'arbitrum'
}
```

**Source:** `server/atlas/one/receipts/index.ts`

---

## Anchoring Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ANCHORING FLOW                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. EVENT OCCURS                                                      │
│     └── User sends message / makes payment / signs document           │
│                                                                       │
│  2. RECEIPT GENERATION                                                │
│     └── Hash event data with SHA-256                                 │
│     └── User signs receipt (optional for immediate anchor)           │
│     └── Store in local receipt queue                                 │
│                                                                       │
│  3. BATCH QUEUE                                                       │
│     └── Receipts accumulate in BullMQ queue                          │
│     └── Worker processes batches every 60 seconds                    │
│     └── Or immediately for high-priority events                      │
│                                                                       │
│  4. BLOCKCHAIN ANCHOR                                                 │
│     └── Call ReceiptBoundToken.issueReceipt()                        │
│     └── Mint soulbound NFT to user's wallet                          │
│     └── Event hash stored on-chain                                   │
│                                                                       │
│  5. CONFIRMATION                                                      │
│     └── Wait for block confirmation                                  │
│     └── Update receipt with transaction hash                         │
│     └── Notify user via SSE/WebSocket                                │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

### ReceiptBoundToken (ERC-721 Soulbound)

Non-transferable NFT receipts that prove event occurrence:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ReceiptBoundToken is ERC721, Ownable {
    struct Receipt {
        bytes32 eventHash;
        uint256 timestamp;
        address issuer;
        string metadata;
    }

    mapping(uint256 => Receipt) public receipts;
    mapping(bytes32 => uint256) public eventHashToTokenId;

    function issueReceipt(
        address recipient,
        bytes32 eventHash,
        string calldata metadata
    ) external onlyOwner returns (uint256);

    // Transfers disabled (soulbound)
    function _update(address to, uint256 tokenId, address auth) 
        internal override returns (address) {
        if (from != address(0) && to != address(0)) {
            revert("Receipt tokens are non-transferable");
        }
        return super._update(to, tokenId, auth);
    }
}
```

**Source:** `contracts/ReceiptBoundToken.sol`

### AnchorRegistry

Central registry for all anchored events:

```solidity
contract AnchorRegistry {
    struct Anchor {
        bytes32 contentHash;
        address submitter;
        uint256 timestamp;
        string anchorType;
    }

    mapping(bytes32 => Anchor) public anchors;

    function anchor(bytes32 contentHash, string calldata anchorType) external;
    function verify(bytes32 contentHash) external view returns (bool exists, Anchor memory);
}
```

**Source:** `contracts/AnchorRegistry.sol`

### ZKReceiptsVerifier

Zero-knowledge proof verification for privacy-preserving receipts:

```solidity
contract ZKReceiptsVerifier {
    function verifyProof(
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicInputs
    ) public view returns (bool);
}
```

**Source:** `contracts/ZKReceiptsVerifier.sol`

---

## Cross-Chain Bridging

### Supported Chains

| Chain | Adapter | Status |
|-------|---------|--------|
| Base (Primary) | Native | Active |
| Polygon | `base-polygon.ts` | Active |
| Arbitrum | `base-arbitrum.ts` | Active |
| Optimism | `base-optimism.ts` | Active |

### Bridge Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BASE (Primary Chain)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ReceiptBoundToken  │  AnchorRegistry  │  Treasury   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────┬───────────────────────────────┘
                              │ LayerZero / Wormhole
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Polygon     │     │   Arbitrum    │     │   Optimism    │
│  P3RouterLZ   │     │  P3RouterLZ   │     │  P3RouterLZ   │
└───────────────┘     └───────────────┘     └───────────────┘
```

### Bridge Adapter Implementation

```typescript
// packages/bridge/adapters/base-polygon.ts
export class BasePolygonBridge {
  async bridgeReceipt(receipt: Receipt): Promise<BridgeResult> {
    // 1. Verify receipt exists on Base
    const baseAnchor = await this.baseRegistry.verify(receipt.eventHash);
    if (!baseAnchor.exists) throw new Error('Receipt not anchored on Base');

    // 2. Prepare cross-chain message
    const message = encodeReceiptMessage(receipt);

    // 3. Send via LayerZero
    const tx = await this.lzEndpoint.send(
      POLYGON_CHAIN_ID,
      this.polygonRouter,
      message,
      { value: estimatedFee }
    );

    return { txHash: tx.hash, destinationChain: 'polygon' };
  }
}
```

**Source:** `packages/bridge/adapters/`

---

## Retry & Confirmation

### Retry Policy

| Failure Type | Retry Strategy |
|--------------|----------------|
| Network timeout | 3 retries, exponential backoff |
| Insufficient gas | Auto-bump gas price, retry |
| Nonce conflict | Reset nonce, retry |
| Contract revert | Log error, notify user |

### Confirmation Rules

```typescript
const CONFIRMATION_RULES = {
  base: { blocks: 1, timeout: 30000 },
  polygon: { blocks: 32, timeout: 120000 },
  arbitrum: { blocks: 1, timeout: 30000 },
  optimism: { blocks: 1, timeout: 30000 },
};

async function waitForConfirmation(txHash: string, chain: string) {
  const rules = CONFIRMATION_RULES[chain];
  const receipt = await provider.waitForTransaction(txHash, rules.blocks);
  if (!receipt) throw new Error(`Confirmation timeout after ${rules.timeout}ms`);
  return receipt;
}
```

---

## ZK Receipt Verification

### Supported Circuits

| Circuit | Purpose | Public Inputs |
|---------|---------|---------------|
| MessageReceipt | Prove message was sent | Recipient hash, timestamp range |
| MeetingReceipt | Prove meeting occurred | Duration range, participant count |
| PaymentReceipt | Prove payment made | Amount range, recipient hash |
| ConsentState | Prove consent given | Policy hash, timestamp |

### Proof Generation

```typescript
// packages/zk/prover/index.ts
const zkProver = new ZKProverService();

const proof = await zkProver.generateProof({
  circuit: 'MessageReceipt',
  inputs: {
    senderHash: poseidon([senderAddress]),
    recipientHash: poseidon([recipientAddress]),
    timestamp: Date.now(),
    messageHash: sha256(encryptedContent),
  },
});

// Submit proof on-chain
await zkVerifier.verifyProof(
  proof.proof.a,
  proof.proof.b,
  proof.proof.c,
  proof.publicSignals
);
```

**Source:** `packages/zk/prover/index.ts`, `packages/zk/circuits/`

---

## Receipt Queue

Receipts are queued for asynchronous anchoring:

```typescript
// Receipts are queued and processed asynchronously
// The queue handles:
// - Batching for gas efficiency
// - Retry on failure
// - Merkle root computation for batch anchors

interface QueuedReceipt {
  receipt: Receipt;
  priority: 'immediate' | 'batched';
  attempts: number;
  createdAt: number;
}

// High-priority receipts (payments) anchor immediately
// Low-priority receipts batch every 60 seconds
```

**Source:** `server/atlas/one/receipts/`, `server/anchor/`

---

## Governance Protections

### Multi-Sig Requirements

| Action | Required Signatures |
|--------|---------------------|
| Contract upgrade | 3 of 5 |
| Treasury withdrawal | 2 of 3 |
| Policy change | Governance vote |

### Emergency Pause

```solidity
function pause() external onlyOwner {
    _pause();
    emit Paused(msg.sender);
}

function unpause() external onlyOwner {
    _unpause();
    emit Unpaused(msg.sender);
}
```

**Source:** `contracts/GovernorP3.sol`, `contracts/Treasury.sol`

---

## Source Files

| Component | Location |
|-----------|----------|
| Receipt types | `server/atlas/one/receipts/index.ts` |
| Escrow queue | `server/atlas/one/receipts/escrowQueue.ts` |
| Escrow worker | `server/atlas/one/receipts/escrowWorker.ts` |
| Client signing | `server/atlas/one/receipts/clientSigning.ts` |
| Bridge adapters | `packages/bridge/adapters/` |
| ZK prover | `packages/zk/prover/index.ts` |
| Circuits | `packages/zk/circuits/` |
| Smart contracts | `contracts/` |
