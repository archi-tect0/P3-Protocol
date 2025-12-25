# REST v1 to Atlas API v2 Migration Guide

This guide covers migrating from traditional REST API endpoints to the Atlas API v2 multiplexed protocol.

---

## Overview

Atlas API v2 replaces individual REST endpoints with a unified session-based transport that multiplexes 8 logical lanes over a single connection.

| Aspect | REST v1 | Atlas v2 |
|--------|---------|----------|
| Connection | New TCP per request | Single persistent connection |
| Authentication | JWT Bearer token | Wallet-signed session |
| Encoding | JSON text | MessagePack binary |
| State | Stateless | Session-anchored |
| Streaming | Polling or long-poll | SSE lanes + WebSocket |

---

## Endpoint Mapping

### Session Establishment

**REST v1:**
```http
POST /api/auth/login
Content-Type: application/json

{"username": "...", "password": "..."}
```

**Atlas v2:**
```http
POST /v2/session/handshake
Content-Type: application/json

{
  "walletAddress": "0x...",
  "signature": "<signed-challenge>",
  "encoding": "msgpack"
}
```

The handshake returns a `sessionId` and dictionary tokens used for all subsequent requests.

---

### Lane Mapping

| REST v1 Endpoint | v2 Lane | Description |
|------------------|---------|-------------|
| `POST /api/auth/*` | Lane 1 (Auth) | Session creation, refresh, logout |
| `GET /api/catalog/*` | Lane 2 (Data) | Catalog queries, search, filters |
| `WS /socket.io` | Lane 3 (Events) | Real-time notifications |
| `GET /api/user/state` | Lane 4 (Sync) | User preferences, delta sync |
| `POST /api/upload` | Lane 5 (File) | File uploads, IPFS pinning |
| `GET /api/stream/*` | Lane 6 (Media) | Video/audio manifest delivery |
| `GET /api/notifications` | Lane 7 (Notif) | Push notification queue |
| `GET /api/health` | Lane 8 (Control) | Health checks, diagnostics |

---

### SSE Lane Endpoints

For streaming data, Atlas v2 uses Server-Sent Events on dedicated lane endpoints:

```http
GET /v1/session/:sessionId/lane/manifests
GET /v1/session/:sessionId/lane/access
POST /v1/session/:sessionId/lane/receipts
```

**Manifests Lane:** Streams content manifest updates (HLS, DASH, EPUB, PDF locations).

**Access Lane:** Delivers decryption keys and access permissions as binary frames.

**Receipts Lane:** Fire-and-forget event reporting (view, play, pause, seek, complete).

---

## Authentication Migration

### From JWT to Wallet-Signed Sessions

**REST v1 Flow:**
1. User submits credentials
2. Server returns JWT token
3. Client includes `Authorization: Bearer <jwt>` header

**Atlas v2 Flow:**
1. Client requests challenge: `GET /v2/session/challenge?wallet=0x...`
2. User signs challenge with wallet
3. Client submits signature: `POST /v2/session/handshake`
4. Server returns `sessionId` + dictionary

```typescript
// Client-side session establishment
const challenge = await fetch(`/v2/session/challenge?wallet=${address}`);
const signature = await wallet.signMessage(challenge.nonce);

const session = await fetch('/v2/session/handshake', {
  method: 'POST',
  body: JSON.stringify({
    walletAddress: address,
    signature,
    encoding: 'msgpack'
  })
});

// Use sessionId for all subsequent requests
const { sessionId, dictionary } = await session.json();
```

---

## Payload Encoding

### JSON to MessagePack

Atlas v2 uses MessagePack binary encoding by default. The encoding is negotiated at handshake.

**Encoding Options:**
- `json` - Standard JSON (compatible fallback)
- `msgpack` - MessagePack binary (30-50% smaller)
- `msgpack+dict` - MessagePack with dictionary compression (additional 25-35% reduction)

```typescript
// Sending encoded request
import { encode, decode } from '@msgpack/msgpack';

const payload = encode({ action: 'query', filters: { ... } });
const response = await fetch(`/v2/session/${sessionId}/lane/2`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/msgpack' },
  body: payload
});

const result = decode(await response.arrayBuffer());
```

### Dictionary Compression

Common field names are replaced with integer tokens:

| Field | Token |
|-------|-------|
| `walletAddress` | 1 |
| `timestamp` | 2 |
| `status` | 3 |
| `itemId` | 4 |
| ... | ... |

The dictionary is returned at handshake and cached client-side.

---

## Backward Compatibility

### REST Shim Layer

For gradual migration, Atlas v2 includes a REST compatibility shim that translates v1 requests:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  REST Client    │ ──── │  Shim Layer     │ ──── │  Atlas v2       │
│  (unchanged)    │      │  /api/* → v2    │      │  Protocol       │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

**Shim behavior:**
- Accepts standard REST requests at `/api/*` endpoints
- Translates to v2 protocol internally
- Returns JSON responses (no MessagePack)
- Does not benefit from session reuse or delta sync

**Use case:** Allow existing clients to continue working while migrating.

---

## Migration Checklist

### Phase 1: Parallel Operation
- [ ] Deploy Atlas v2 endpoints alongside existing REST
- [ ] Configure REST shim for backward compatibility
- [ ] Update client SDK to support both protocols
- [ ] Monitor v2 adoption via Pulse metrics

### Phase 2: Client Migration
- [ ] Implement wallet-based authentication
- [ ] Add MessagePack encoding/decoding
- [ ] Replace polling with SSE lane subscriptions
- [ ] Implement dictionary caching

### Phase 3: Optimization
- [ ] Enable `msgpack+dict` encoding
- [ ] Implement delta sync for user state
- [ ] Add receipt reporting for analytics
- [ ] Remove REST shim after migration complete

---

## Error Handling

### Session Errors

| Error Code | Meaning | Action |
|------------|---------|--------|
| `SESSION_EXPIRED` | Session timed out | Re-handshake |
| `SESSION_INVALID` | Session not found | Re-handshake |
| `SIGNATURE_INVALID` | Bad wallet signature | Re-sign challenge |
| `ENCODING_MISMATCH` | Wrong content type | Check headers |

### Lane Errors

| Error Code | Meaning | Action |
|------------|---------|--------|
| `LANE_BUSY` | Lane at capacity | Retry with backoff |
| `LANE_CLOSED` | SSE connection dropped | Reconnect |
| `PRIORITY_PREEMPTED` | Lower priority deferred | Wait and retry |

---

## Performance Comparison

Run the built-in benchmark to compare v1 vs v2 performance in your environment:

```bash
# Benchmarks run automatically every 60s
# View results in Pulse metrics dashboard or database

SELECT endpoint, avg_latency_ms, avg_bytes, sample_count
FROM api_request_metrics
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY endpoint;
```

Expected improvements:
- **Payload size:** 25-50% reduction
- **Connection overhead:** Eliminated (single connection)
- **Latency:** 20-40% improvement for concurrent requests

---

## Source Files

| Component | Location |
|-----------|----------|
| Session handshake | `server/protocol/session/handshake.ts` |
| Lane endpoints | `server/protocol/session/lanes.ts` |
| MessagePack encoding | `server/protocol/encoding/frames.ts` |
| Dictionary management | `server/protocol/encoding/dictionary.ts` |
| REST shim | `server/routes/legacy.ts` |
