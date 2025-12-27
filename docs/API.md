# P3 Protocol - API Documentation

**Privacy-Preserving Proof-of-Communication Protocol API**

Complete API reference for the P3 Protocol REST and WebSocket APIs.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limits](#rate-limits)
4. [Error Codes](#error-codes)
5. [Authentication Endpoints](#authentication-endpoints)
6. [Receipt Endpoints](#receipt-endpoints)
7. [Trust Layer Endpoints](#trust-layer-endpoints)
8. [DAO Governance Endpoints](#dao-governance-endpoints)
9. [Messaging Endpoints](#messaging-endpoints)
10. [Notes Endpoints](#notes-endpoints)
11. [Directory Endpoints](#directory-endpoints)
12. [Inbox Endpoints](#inbox-endpoints)
13. [Service Endpoints](#service-endpoints)
14. [Rollup Endpoints](#rollup-endpoints)
15. [Global Mesh Relay Endpoints](#global-mesh-relay-endpoints)
16. [ZK Proof Endpoints](#zk-proof-endpoints)
17. [Webhooks](#webhooks)
18. [WebSocket Events](#websocket-events)

---

## Overview

**Base URL:** `https://api.p3protocol.com`

**API Version:** v1

**Content Type:** `application/json`

**Authentication:** JWT Bearer token (except public endpoints)

---

## Authentication

### Bearer Token

All authenticated endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <JWT_TOKEN>
```

### Obtaining a Token

1. Register or login via authentication endpoints
2. Receive JWT token in response
3. Include token in all subsequent requests
4. Token expires in 7 days (default)

### Example

```bash
# Login
curl -X POST https://api.p3protocol.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "user"
  }
}

# Use token
curl https://api.p3protocol.com/api/receipts \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Rate Limits

**Default Limits:**
- 100 requests per minute per IP address
- 1000 requests per hour per user
- 10,000 requests per day per user

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637000000
```

**Rate Limit Exceeded Response:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 204 | No Content | Request successful, no content returned |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Response Format

```json
{
  "error": "Validation error",
  "message": "Email is required",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "constraint": "required"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication failed |
| `TOKEN_EXPIRED` | JWT token expired |
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE` | Resource already exists |
| `FORBIDDEN` | Insufficient permissions |
| `RATE_LIMITED` | Too many requests |
| `DATABASE_ERROR` | Database operation failed |
| `BLOCKCHAIN_ERROR` | Smart contract interaction failed |
| `ZK_PROOF_ERROR` | ZK proof generation/verification failed |

---

## Authentication Endpoints

### POST /api/auth/register

Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `201 Created`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-abc123",
    "email": "user@example.com",
    "role": "user",
    "created_at": "2025-11-15T00:00:00.000Z"
  }
}
```

**Validation Rules:**
- Email: Valid email format, unique
- Password: Minimum 8 characters, 1 uppercase, 1 number

---

### POST /api/auth/login

Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-abc123",
    "email": "user@example.com",
    "role": "user"
  }
}
```

---

### POST /api/auth/wallet

Authenticate with wallet signature (SIWE).

**Request:**
```json
{
  "message": "Sign in to P3 Protocol\nNonce: abc123",
  "signature": "0x123456...",
  "address": "0xabcdef..."
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-wallet-xyz",
    "email": "0xabcdef...@wallet",
    "walletAddress": "0xabcdef...",
    "role": "user"
  }
}
```

---

### GET /api/auth/me

Get current user profile.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "user-abc123",
  "email": "user@example.com",
  "role": "user",
  "walletAddress": "0xabcdef...",
  "created_at": "2025-11-15T00:00:00.000Z"
}
```

---

## Receipt Endpoints

### POST /api/receipts

Create a new receipt.

**Auth:** Required

**Request:**
```json
{
  "type": "message",
  "subjectId": "msg-123",
  "subjectType": "email",
  "content": "Email sent to john@example.com",
  "metadata": {
    "to": "john@example.com",
    "subject": "Hello",
    "timestamp": 1637000000
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "receipt-xyz789",
  "userId": "user-abc123",
  "type": "message",
  "subjectId": "msg-123",
  "subjectType": "email",
  "content": "Email sent to john@example.com",
  "metadata": {
    "to": "john@example.com",
    "subject": "Hello",
    "timestamp": 1637000000
  },
  "merkleProof": {
    "leaf": "0x123...",
    "root": "0xabc...",
    "siblings": ["0xdef...", "0x456..."]
  },
  "createdAt": "2025-11-15T00:00:00.000Z",
  "onChainTxHash": null,
  "tokenId": null
}
```

---

### GET /api/receipts

List receipts for current user.

**Auth:** Required

**Query Parameters:**
- `type` (optional) - Filter by receipt type
- `limit` (optional, default: 50) - Number of results
- `offset` (optional, default: 0) - Pagination offset

**Response:** `200 OK`
```json
[
  {
    "id": "receipt-xyz789",
    "type": "message",
    "subjectId": "msg-123",
    "content": "Email sent to john@example.com",
    "metadata": {},
    "createdAt": "2025-11-15T00:00:00.000Z"
  }
]
```

---

### GET /api/receipts/:id

Get receipt by ID.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "receipt-xyz789",
  "userId": "user-abc123",
  "type": "message",
  "subjectId": "msg-123",
  "content": "Email sent to john@example.com",
  "metadata": {},
  "merkleProof": {
    "leaf": "0x123...",
    "root": "0xabc...",
    "siblings": ["0xdef...", "0x456..."]
  },
  "createdAt": "2025-11-15T00:00:00.000Z",
  "onChainTxHash": "0x789...",
  "tokenId": "42"
}
```

---

### POST /api/receipts/:id/mint

Mint receipt as NFT on-chain.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "receiptId": "receipt-xyz789",
  "txHash": "0xabc123...",
  "tokenId": "42",
  "contractAddress": "0xdef456...",
  "network": "base"
}
```

---

### POST /api/receipts/:id/verify

Verify receipt Merkle proof.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "receiptId": "receipt-xyz789",
  "valid": true,
  "merkleRoot": "0xabc...",
  "batchId": "batch-123",
  "anchoredAt": "2025-11-15T00:00:00.000Z"
}
```

---

## Trust Layer Endpoints

### GET /api/trust/config

Get trust configuration for current wallet.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "config-123",
  "walletAddress": "0xabc...",
  "enforcementMode": "strict",
  "defaultAction": "allow",
  "enabled": 1,
  "metadata": {},
  "createdAt": "2025-11-15T00:00:00.000Z"
}
```

---

### POST /api/trust/config

Create or update trust configuration.

**Auth:** Required

**Request:**
```json
{
  "enforcementMode": "strict",
  "defaultAction": "deny",
  "enabled": true
}
```

**Response:** `200 OK`
```json
{
  "id": "config-123",
  "walletAddress": "0xabc...",
  "enforcementMode": "strict",
  "defaultAction": "deny",
  "enabled": 1,
  "updatedAt": "2025-11-15T00:00:00.000Z"
}
```

---

### GET /api/trust/rules

List trust rules.

**Auth:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "rule-1",
    "configId": "config-123",
    "ruleType": "whitelist",
    "conditions": {
      "addresses": ["0xdef...", "0x456..."]
    },
    "action": "allow",
    "priority": 10,
    "enabled": 1
  }
]
```

---

### POST /api/trust/rules

Create a new trust rule.

**Auth:** Required

**Request:**
```json
{
  "ruleType": "whitelist",
  "conditions": {
    "addresses": ["0xdef...", "0x456..."]
  },
  "action": "allow",
  "priority": 10
}
```

**Response:** `201 Created`
```json
{
  "id": "rule-2",
  "configId": "config-123",
  "ruleType": "whitelist",
  "conditions": {
    "addresses": ["0xdef...", "0x456..."]
  },
  "action": "allow",
  "priority": 10,
  "enabled": 1
}
```

---

### POST /api/trust/evaluate

Evaluate trust policy for a transaction.

**Auth:** Required

**Request:**
```json
{
  "from": "0xabc...",
  "to": "0xdef...",
  "value": "1000000000000000000",
  "data": "0x123..."
}
```

**Response:** `200 OK`
```json
{
  "allowed": true,
  "matchedRules": ["rule-1"],
  "action": "allow",
  "reason": "Whitelist match"
}
```

---

## DAO Governance Endpoints

### GET /api/dao/proposals

List all DAO proposals.

**Query Parameters:**
- `status` (optional) - Filter by status
- `proposer` (optional) - Filter by proposer address

**Response:** `200 OK`
```json
[
  {
    "id": "prop-1",
    "proposalId": "0x123...",
    "proposer": "0xabc...",
    "title": "Increase voting period",
    "description": "Proposal to increase voting period from 7 to 14 days",
    "status": "active",
    "votesFor": "1000000000000000000000",
    "votesAgainst": "500000000000000000000",
    "votesAbstain": "100000000000000000000",
    "startBlock": "12345678",
    "endBlock": "12350000",
    "createdAt": "2025-11-15T00:00:00.000Z",
    "onChainState": "Active"
  }
]
```

---

### POST /api/dao/proposals

Create a new DAO proposal.

**Auth:** Required

**Request:**
```json
{
  "title": "Increase voting period",
  "description": "Proposal to increase voting period from 7 to 14 days",
  "actions": [
    {
      "target": "0xGovernor...",
      "value": "0",
      "calldata": "0x123..."
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "prop-2",
  "proposalId": "0x456...",
  "proposer": "0xabc...",
  "title": "Increase voting period",
  "txHash": "0x789...",
  "status": "pending",
  "createdAt": "2025-11-15T00:00:00.000Z"
}
```

---

### POST /api/dao/vote

Vote on a proposal.

**Auth:** Required

**Request:**
```json
{
  "proposalId": "0x123...",
  "support": 1,
  "reason": "I support this proposal"
}
```

**Support Values:**
- 0 = Against
- 1 = For
- 2 = Abstain

**Response:** `200 OK`
```json
{
  "success": true,
  "txHash": "0xabc...",
  "votes": {
    "for": "1000000000000000000000",
    "against": "500000000000000000000",
    "abstain": "100000000000000000000"
  }
}
```

---

### POST /api/dao/queue

Queue a succeeded proposal for execution.

**Auth:** Required (Admin)

**Request:**
```json
{
  "proposalId": "0x123..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "txHash": "0xdef...",
  "eta": "2025-11-17T00:00:00.000Z"
}
```

---

### POST /api/dao/execute

Execute a queued proposal.

**Auth:** Required (Admin)

**Request:**
```json
{
  "proposalId": "0x123..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "txHash": "0x456..."
}
```

---

## Messaging Endpoints

### POST /api/messages

Send encrypted message.

**Auth:** Required

**Request:**
```json
{
  "toWallet": "0xdef...",
  "encryptedContent": "base64-encrypted-content",
  "ipfsCid": "QmXyz...",
  "metadata": {
    "subject": "Hello"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "msg-123",
  "fromWallet": "0xabc...",
  "toWallet": "0xdef...",
  "encryptedContent": "base64-encrypted-content",
  "contentHash": "0x789...",
  "ipfsCid": "QmXyz...",
  "status": "sent",
  "createdAt": "2025-11-15T00:00:00.000Z",
  "receiptGenerated": false
}
```

---

### GET /api/messages

List messages (sent and received).

**Auth:** Required

**Response:** `200 OK`
```json
[
  {
    "id": "msg-123",
    "fromWallet": "0xabc...",
    "toWallet": "0xdef...",
    "encryptedContent": "base64-encrypted-content",
    "status": "read",
    "createdAt": "2025-11-15T00:00:00.000Z",
    "readAt": "2025-11-15T01:00:00.000Z"
  }
]
```

---

### GET /api/messages/:id

Get message by ID.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "msg-123",
  "fromWallet": "0xabc...",
  "toWallet": "0xdef...",
  "encryptedContent": "base64-encrypted-content",
  "contentHash": "0x789...",
  "ipfsCid": "QmXyz...",
  "status": "read",
  "metadata": {},
  "createdAt": "2025-11-15T00:00:00.000Z",
  "readAt": "2025-11-15T01:00:00.000Z"
}
```

---

## Notes Endpoints

### POST /api/notes

Create a new note.

**Auth:** Required

**Request:**
```json
{
  "title": "Meeting Notes",
  "encryptedBody": "base64-encrypted-content",
  "searchableContent": "meeting discussion topics",
  "tags": ["work", "meeting"]
}
```

**Response:** `201 Created`
```json
{
  "id": "note-123",
  "walletAddress": "0xabc...",
  "title": "Meeting Notes",
  "encryptedBody": "base64-encrypted-content",
  "searchableContent": "meeting discussion topics",
  "tags": ["work", "meeting"],
  "isPinned": 0,
  "createdAt": "2025-11-15T00:00:00.000Z"
}
```

---

### GET /api/notes

List notes with optional search.

**Auth:** Required

**Query Parameters:**
- `search` (optional) - Search in searchable content
- `tag` (optional) - Filter by tag

**Response:** `200 OK`
```json
[
  {
    "id": "note-123",
    "title": "Meeting Notes",
    "tags": ["work", "meeting"],
    "isPinned": 0,
    "createdAt": "2025-11-15T00:00:00.000Z",
    "updatedAt": "2025-11-15T00:00:00.000Z"
  }
]
```

---

### GET /api/notes/:id

Get note by ID.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "id": "note-123",
  "walletAddress": "0xabc...",
  "title": "Meeting Notes",
  "encryptedBody": "base64-encrypted-content",
  "searchableContent": "meeting discussion topics",
  "tags": ["work", "meeting"],
  "isPinned": 0,
  "createdAt": "2025-11-15T00:00:00.000Z",
  "updatedAt": "2025-11-15T00:00:00.000Z"
}
```

---

### PATCH /api/notes/:id

Update note.

**Auth:** Required

**Request:**
```json
{
  "title": "Updated Meeting Notes",
  "isPinned": 1
}
```

**Response:** `200 OK`
```json
{
  "id": "note-123",
  "title": "Updated Meeting Notes",
  "isPinned": 1,
  "updatedAt": "2025-11-15T02:00:00.000Z"
}
```

---

### DELETE /api/notes/:id

Delete note.

**Auth:** Required

**Response:** `204 No Content`

---

## Directory Endpoints

### GET /api/directory

List directory entries (ENS/Basename).

**Auth:** Required

**Query Parameters:**
- `search` (optional) - Search by name or address
- `verified` (optional) - Filter by verification status

**Response:** `200 OK`
```json
[
  {
    "walletAddress": "0xabc...",
    "ensName": "alice.eth",
    "basename": "alice.base.eth",
    "avatarUrl": "https://...",
    "bio": "Web3 developer",
    "isVerified": 1,
    "metadata": {}
  }
]
```

---

### GET /api/directory/:walletAddress

Get directory entry by wallet address.

**Auth:** Required

**Response:** `200 OK`
```json
{
  "walletAddress": "0xabc...",
  "ensName": "alice.eth",
  "basename": "alice.base.eth",
  "avatarUrl": "https://...",
  "bio": "Web3 developer",
  "isVerified": 1,
  "metadata": {},
  "createdAt": "2025-11-15T00:00:00.000Z"
}
```

---

### POST /api/directory

Create or update own directory entry.

**Auth:** Required

**Request:**
```json
{
  "ensName": "alice.eth",
  "basename": "alice.base.eth",
  "avatarUrl": "https://...",
  "bio": "Web3 developer"
}
```

**Response:** `200 OK`
```json
{
  "walletAddress": "0xabc...",
  "ensName": "alice.eth",
  "basename": "alice.base.eth",
  "avatarUrl": "https://...",
  "bio": "Web3 developer",
  "isVerified": 0,
  "updatedAt": "2025-11-15T00:00:00.000Z"
}
```

---

## Inbox Endpoints

### GET /api/inbox

Get inbox items.

**Auth:** Required

**Query Parameters:**
- `status` (optional) - Filter by status (unread, read, archived)

**Response:** `200 OK`
```json
[
  {
    "id": "inbox-1",
    "walletAddress": "0xabc...",
    "messageId": "msg-123",
    "status": "unread",
    "isStarred": 0,
    "labels": ["important"],
    "createdAt": "2025-11-15T00:00:00.000Z"
  }
]
```

---

### PATCH /api/inbox/:id

Update inbox item.

**Auth:** Required

**Request:**
```json
{
  "status": "read",
  "isStarred": 1
}
```

**Response:** `200 OK`
```json
{
  "id": "inbox-1",
  "status": "read",
  "isStarred": 1,
  "updatedAt": "2025-11-15T02:00:00.000Z"
}
```

---

### POST /api/inbox/bulk

Bulk action on inbox items.

**Auth:** Required

**Request:**
```json
{
  "ids": ["inbox-1", "inbox-2", "inbox-3"],
  "action": "archive"
}
```

**Actions:** `archive`, `delete`, `star`, `unstar`, `read`, `unread`

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 3
}
```

---

## Service Endpoints

### GET /api/services/resolve/:address

Resolve Ethereum address to ENS/Basename.

**Response:** `200 OK`
```json
{
  "address": "0xabc...",
  "ensName": "alice.eth",
  "basename": "alice.base.eth",
  "resolved": true,
  "timestamp": "2025-11-15T00:00:00.000Z"
}
```

---

### POST /api/services/resolve/batch

Batch resolve addresses.

**Request:**
```json
{
  "addresses": ["0xabc...", "0xdef...", "0x123..."]
}
```

**Response:** `200 OK`
```json
{
  "count": 3,
  "results": [
    {
      "address": "0xabc...",
      "ensName": "alice.eth",
      "basename": "alice.base.eth"
    },
    {
      "address": "0xdef...",
      "ensName": null,
      "basename": "bob.base.eth"
    }
  ]
}
```

---

### POST /api/services/webhook/test

Test webhook delivery.

**Auth:** Required

**Request:**
```json
{
  "url": "https://example.com/webhook",
  "encrypted": false
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "statusCode": 200,
  "responseTime": 123,
  "timestamp": "2025-11-15T00:00:00.000Z"
}
```

---

### GET /api/exports/:format

Generate audit export.

**Auth:** Required (Admin)

**Formats:** `pdf`, `csv`

**Query Parameters:**
- `entityType` (optional) - Filter by entity type
- `entityId` (optional) - Filter by entity ID
- `startDate` (optional) - Start date (ISO 8601)
- `endDate` (optional) - End date (ISO 8601)
- `compress` (optional) - Gzip compression

**Response:** `200 OK` (Binary)

**Headers:**
```http
Content-Type: application/pdf | text/csv | application/gzip
Content-Disposition: attachment; filename="audit-export-20251115.pdf"
X-Export-Hash: sha256:abc123...
X-Export-Timestamp: 1637000000
```

---

## Rollup Endpoints

### GET /api/rollup/status

Get rollup services status.

**Response:** `200 OK`
```json
{
  "timestamp": 1637000000,
  "services": {
    "sequencer": {
      "running": true,
      "stats": {
        "pendingEvents": 42,
        "totalBatches": 1234,
        "lastBatchAt": "2025-11-15T00:00:00.000Z"
      }
    },
    "stateManager": {
      "running": true,
      "stats": {
        "totalEvents": 50000,
        "currentStateRoot": "0xabc..."
      }
    },
    "dataAvailability": {
      "running": true,
      "stats": {
        "totalPublished": 1234,
        "avgPublishTime": 1500
      }
    },
    "checkpoint": {
      "running": true,
      "stats": {
        "lastCheckpoint": "2025-11-15T00:00:00.000Z",
        "totalCheckpoints": 100
      }
    }
  }
}
```

---

### POST /api/rollup/event

Submit event to sequencer.

**Request:**
```json
{
  "id": "evt-123",
  "type": "message_sent",
  "userId": "user-abc",
  "data": {
    "messageId": "msg-123",
    "from": "0xabc...",
    "to": "0xdef..."
  },
  "timestamp": 1637000000
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "eventId": "evt-123",
  "queued": true
}
```

---

### POST /api/rollup/batch/force

Force batch creation (for testing).

**Auth:** Required (Admin)

**Response:** `200 OK`
```json
{
  "success": true,
  "batch": {
    "id": "batch-456",
    "eventCount": 42,
    "merkleRoot": "0xabc...",
    "startTime": 1637000000,
    "endTime": 1637000030
  }
}
```

---

### GET /api/rollup/state/event/:eventId

Get event state from rollup.

**Response:** `200 OK`
```json
{
  "success": true,
  "event": {
    "eventId": "evt-123",
    "batchId": "batch-456",
    "index": 5,
    "merkleProof": ["0xabc...", "0xdef..."]
  }
}
```

---

### POST /api/rollup/bridge/relay

Relay receipt to another chain.

**Request:**
```json
{
  "receiptId": "receipt-123",
  "sourceChain": "base",
  "targetChain": "ethereum",
  "data": {
    "proof": "0xabc...",
    "publicSignals": []
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "receiptId": "receipt-123",
  "txHash": "0xdef...",
  "status": "pending"
}
```

---

## Global Mesh Relay Endpoints

The Global Relay Network enables cross-app P3 mesh connectivity. Nodes from different P3-based applications can discover and relay messages through each other using foundation lanes.

### POST /api/mesh/global/register

Register node with the global relay network.

**Auth:** Wallet signature required

**Request:**
```json
{
  "nodeId": "node_abc123",
  "wallet": "0x1234567890abcdef1234567890abcdef12345678",
  "signature": "0x...",
  "foundationLaneVersion": "1.0.0",
  "customLanes": ["chat", "video"],
  "capabilities": ["relay", "cache", "stream"],
  "endpoint": "https://myapp.example.com",
  "timestamp": 1735000000000
}
```

**Signature Message Format:**
```
p3-global-relay:{nodeId}:{wallet}:{timestamp}
```

**Response:** `200 OK`
```json
{
  "ok": true,
  "nodeId": "node_abc123",
  "registeredAt": 1735000000000,
  "peersAvailable": 42,
  "foundationLanes": {
    "HANDSHAKE": 0,
    "IDENTITY": 1,
    "KEEPALIVE": 2,
    "TELEMETRY": 3
  }
}
```

---

### POST /api/mesh/global/unregister

Leave the global relay network.

**Headers:**
```http
x-wallet-address: 0x1234567890abcdef1234567890abcdef12345678
```

**Response:** `200 OK`
```json
{
  "ok": true,
  "message": "Unregistered from global network"
}
```

---

### GET /api/mesh/global/peers

Discover available peers on the global network.

**Headers:**
```http
x-wallet-address: 0x1234567890abcdef1234567890abcdef12345678
```

**Response:** `200 OK`
```json
{
  "ok": true,
  "peers": [
    {
      "nodeId": "node_xyz789",
      "wallet": "0xabcd...",
      "signature": "***",
      "foundationLaneVersion": "1.0.0",
      "customLanes": ["messaging"],
      "capabilities": ["relay"],
      "endpoint": "https://otherapp.example.com",
      "timestamp": 1735000000000
    }
  ],
  "total": 1,
  "foundationLaneVersion": "1.0.0"
}
```

---

### POST /api/mesh/global/relay

Send a message via global relay (foundation lanes only).

**Headers:**
```http
x-wallet-address: 0x1234567890abcdef1234567890abcdef12345678
```

**Request:**
```json
{
  "target": "node_xyz789",
  "lane": 2,
  "payload": {
    "type": "keepalive",
    "timestamp": 1735000000000
  }
}
```

**Lane Restrictions:**
- Lane 0: Handshake
- Lane 1: Identity
- Lane 2: Keepalive
- Lane 3: Telemetry
- Lanes > 3: Rejected (custom lanes require direct peer connection)

**Response:** `200 OK`
```json
{
  "ok": true,
  "relayed": true,
  "lane": 2,
  "timestamp": 1735000000000
}
```

---

### GET /api/mesh/global/messages

Receive queued messages for this node.

**Headers:**
```http
x-wallet-address: 0x1234567890abcdef1234567890abcdef12345678
```

**Response:** `200 OK`
```json
{
  "ok": true,
  "messages": [
    {
      "target": "node_abc123",
      "lane": 2,
      "payload": {"type": "keepalive"},
      "timestamp": 1735000000000,
      "from": "node_xyz789"
    }
  ]
}
```

---

### GET /api/mesh/global/stats

Get global relay network statistics.

**Response:** `200 OK`
```json
{
  "ok": true,
  "nodes": 42,
  "relays": 1234,
  "uptime": 86400,
  "foundationLaneVersion": "1.0.0",
  "foundationLanes": {
    "HANDSHAKE": 0,
    "IDENTITY": 1,
    "KEEPALIVE": 2,
    "TELEMETRY": 3
  }
}
```

---

### GET /api/mesh/global/health

Health check for the global relay service.

**Response:** `200 OK`
```json
{
  "ok": true,
  "status": "healthy",
  "nodes": 42
}
```

---

## ZK Proof Endpoints

### POST /api/zk/prove

Generate ZK proof.

**Auth:** Required

**Request:**
```json
{
  "circuit": "MessageReceipt",
  "inputs": {
    "messageHash": "0x123...",
    "sender": "0xabc...",
    "recipient": "0xdef...",
    "timestamp": 1637000000
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "proof": {
    "pi_a": ["0x...", "0x..."],
    "pi_b": [["0x...", "0x..."], ["0x...", "0x..."]],
    "pi_c": ["0x...", "0x..."],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicSignals": ["0x123...", "0xabc..."],
  "generatedAt": "2025-11-15T00:00:00.000Z"
}
```

---

### POST /api/zk/verify

Verify ZK proof (off-chain).

**Request:**
```json
{
  "circuit": "MessageReceipt",
  "proof": {
    "pi_a": ["0x...", "0x..."],
    "pi_b": [["0x...", "0x..."], ["0x...", "0x..."]],
    "pi_c": ["0x...", "0x..."]
  },
  "publicSignals": ["0x123...", "0xabc..."]
}
```

**Response:** `200 OK`
```json
{
  "valid": true,
  "verifiedAt": "2025-11-15T00:00:00.000Z"
}
```

---

### GET /api/zk/health

Check ZK prover health.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "circuits": {
    "MessageReceipt": "ready",
    "MeetingReceipt": "ready",
    "PaymentReceipt": "ready",
    "ConsentState": "ready"
  },
  "queueLength": 5,
  "averageProofTime": 2500
}
```

---

## Webhooks

### Webhook Events

P3 Protocol can send webhook notifications for various events.

**Event Types:**
- `message_received` - New message received
- `call_started` - VoIP call initiated
- `payment_received` - Payment received
- `proposal_created` - New DAO proposal
- `proof_generated` - ZK proof completed

### Webhook Payload

**Format:**
```json
{
  "eventType": "message_received",
  "timestamp": 1637000000,
  "data": {
    "messageId": "msg-123",
    "fromWallet": "0xabc...",
    "toWallet": "0xdef...",
    "encryptedContent": "base64..."
  },
  "signature": "0x123456..."
}
```

### Signature Verification

Verify webhook signature using ECDSA:

```javascript
const ethers = require('ethers');

function verifyWebhookSignature(payload, signature, expectedAddress) {
  const message = JSON.stringify(payload);
  const messageHash = ethers.utils.id(message);
  const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}
```

### Setup Webhook

Configure webhook URL in user settings or via API:

```bash
curl -X POST https://api.p3protocol.com/api/user/settings \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://example.com/webhook",
    "webhookEvents": ["message_received", "payment_received"]
  }'
```

---

## WebSocket Events

### Connection

```javascript
const socket = io('wss://api.p3protocol.com', {
  auth: {
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
});

socket.on('connect', () => {
  console.log('Connected to P3 Protocol');
});
```

### Events

#### receipt:created

Emitted when a new receipt is created.

```javascript
socket.on('receipt:created', (data) => {
  console.log('New receipt:', data);
  // {
  //   receiptId: 'receipt-123',
  //   type: 'message',
  //   userId: 'user-abc',
  //   timestamp: 1637000000
  // }
});
```

#### message:received

Emitted when a new message is received.

```javascript
socket.on('message:received', (data) => {
  console.log('New message:', data);
  // {
  //   messageId: 'msg-123',
  //   fromWallet: '0xabc...',
  //   toWallet: '0xdef...',
  //   timestamp: 1637000000
  // }
});
```

#### proposal:created

Emitted when a new DAO proposal is created.

```javascript
socket.on('proposal:created', (data) => {
  console.log('New proposal:', data);
  // {
  //   proposalId: '0x123...',
  //   proposer: '0xabc...',
  //   title: 'Increase voting period',
  //   timestamp: 1637000000
  // }
});
```

#### proof:generated

Emitted when a ZK proof is generated.

```javascript
socket.on('proof:generated', (data) => {
  console.log('Proof generated:', data);
  // {
  //   proofId: 'proof-123',
  //   circuit: 'MessageReceipt',
  //   status: 'success',
  //   timestamp: 1637000000
  // }
});
```

#### rollup:batch

Emitted when a new rollup batch is anchored.

```javascript
socket.on('rollup:batch', (data) => {
  console.log('Batch anchored:', data);
  // {
  //   batchId: 'batch-456',
  //   merkleRoot: '0xabc...',
  //   eventCount: 42,
  //   timestamp: 1637000000
  // }
});
```

### Disconnect

```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from P3 Protocol');
});
```

---

## SDKs & Libraries

### JavaScript/TypeScript SDK

```bash
npm install @p3protocol/sdk
```

```typescript
import { P3Client } from '@p3protocol/sdk';

const client = new P3Client({
  apiUrl: 'https://api.p3protocol.com',
  apiKey: 'your-api-key'
});

// Create receipt
const receipt = await client.receipts.create({
  type: 'message',
  subjectId: 'msg-123',
  content: 'Hello World'
});

// Generate ZK proof
const proof = await client.zk.prove({
  circuit: 'MessageReceipt',
  inputs: {
    messageHash: '0x123...',
    sender: '0xabc...',
    recipient: '0xdef...'
  }
});
```

### Python SDK

```bash
pip install p3protocol
```

```python
from p3protocol import P3Client

client = P3Client(
    api_url='https://api.p3protocol.com',
    api_key='your-api-key'
)

# Create receipt
receipt = client.receipts.create(
    type='message',
    subject_id='msg-123',
    content='Hello World'
)
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters:**
- `limit` (default: 50, max: 100)
- `offset` (default: 0)

**Response Headers:**
```http
X-Total-Count: 1234
X-Page-Limit: 50
X-Page-Offset: 0
```

**Example:**
```bash
curl 'https://api.p3protocol.com/api/receipts?limit=25&offset=50' \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Testing

### Sandbox Environment

**Base URL:** `https://sandbox-api.p3protocol.com`

**Features:**
- Free test tokens
- Base Sepolia testnet
- No rate limits
- Data reset weekly

### Test Wallets

Pre-funded test wallets available:
- Wallet 1: `0xtest1...` (1000 ETH)
- Wallet 2: `0xtest2...` (1000 ETH)

---

**For more information:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [RUNBOOK.md](RUNBOOK.md) - Operations procedures
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
