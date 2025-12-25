# Atlas API v2 - Technical Architecture

Atlas API v2 is a multiplexed transport protocol designed for efficiency over standard REST/HTTP. This document covers the architecture, features, and how to validate performance claims.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Single Connection                                  │   │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │   │
│  │  │ L1  │ │ L2  │ │ L3  │ │ L4  │ │ L5  │ │ L6  │ │ L7  │ │ L8  │   │   │
│  │  │Auth │ │Data │ │Event│ │Sync │ │File │ │Video│ │Notif│ │Ctrl │   │   │
│  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │   │
│  │                    8-Lane Multiplexer                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              Encoding Pipeline                                        │   │
│  │  MessagePack → Dictionary Compression → Gzip (opportunistic)         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. 8-Lane Multiplexing

Atlas v2 maintains eight logical lanes over a single connection, each with independent flow control.

| Lane | Purpose | Priority |
|------|---------|----------|
| 1 | Authentication & Session | Highest |
| 2 | Data Queries | High |
| 3 | Real-time Events | High |
| 4 | Delta Sync | Medium |
| 5 | File Transfer | Medium |
| 6 | Streaming Media | Medium |
| 7 | Notifications | Low |
| 8 | Control & Diagnostics | Low |

**Advantage over REST:** Eliminates connection setup overhead for parallel requests. Standard REST opens new connections per request; Atlas v2 reuses a single multiplexed connection.

**Source:** `server/protocol/transport.ts`

### 2. Binary Encoding (MessagePack)

Atlas v2 uses MessagePack binary encoding instead of JSON text.

| Format | Example Payload | Size |
|--------|-----------------|------|
| JSON | `{"ok":true,"count":42}` | 23 bytes |
| MessagePack | Binary equivalent | 15 bytes |

**Typical reduction:** 30-50% smaller payloads for structured data.

**Source:** `server/protocol/encoding.ts`

### 3. Adaptive Dictionary Compression

Frequently transmitted strings (field names, enum values) are replaced with short integer codes.

```
Without dictionary:  {"walletAddress": "0x...", "status": "connected"}
With dictionary:     {1: "0x...", 2: 3}
```

The dictionary is negotiated at session start and refreshed as needed.

**Source:** `server/protocol/wire.ts`

### 4. Opportunistic Gzip

Large payloads are compressed with gzip when beneficial. Small payloads skip compression to avoid overhead.

**Threshold:** ~1KB (payloads smaller than this are sent uncompressed)

### 5. Session Reuse & Delta Sync

Sessions persist across requests, enabling:
- **State caching:** Server remembers client state
- **Delta sync:** Only changes are transmitted, not full datasets
- **Replay protection:** Prevents duplicate processing

**Source:** `server/protocol/session.ts`

---

## Benchmark Infrastructure

Atlas includes a benchmark runner that compares v2 endpoints against equivalent REST baselines.

### Running Benchmarks

The benchmark runner is automatically started with the server and runs every 60 seconds. Results are stored in the `api_request_metrics` database table.

### Benchmark Endpoints

| Atlas Endpoint | REST Baseline | Data |
|----------------|---------------|------|
| `/api/atlas/canvas/renderables` | `/api/rest-baseline/renderables` | Canvas UI components |
| `/api/atlas/one/catalog/search` | `/api/rest-baseline/catalog` | Catalog search |

### Viewing Results

```sql
-- Compare average payload sizes
SELECT 
  CASE WHEN is_atlas_api THEN 'Atlas v2' ELSE 'REST' END as protocol,
  ROUND(AVG(response_bytes)) as avg_bytes,
  ROUND(AVG(latency_ms)) as avg_latency_ms,
  COUNT(*) as samples
FROM api_request_metrics 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY is_atlas_api;
```

### Expected Results

Based on the encoding pipeline, Atlas v2 is designed to achieve:
- **Payload reduction:** 30-60% smaller responses (MessagePack + dictionary + gzip)
- **Latency reduction:** Lower connection overhead due to multiplexing
- **Bandwidth savings:** Delta sync reduces repeat data transfer

*Note: Actual results depend on payload characteristics. Run benchmarks on your workloads to validate.*

---

## API Endpoints

### Canvas Renderables
```
GET /api/atlas/canvas/renderables
Accept: application/msgpack
Accept-Encoding: gzip
```

Returns UI components optimized for rendering.

### Session Management
```
POST /api/atlas/session/start
POST /api/atlas/session/refresh
POST /api/atlas/session/end
```

### Catalog Search
```
GET /api/atlas/one/catalog/search?search=query&kind=video&limit=20
```

### Settings Sync
```
GET /api/atlas/settings?wallet=0x...
POST /api/atlas/settings
```

---

## Integration Guide

### Client-Side

Request MessagePack responses:
```typescript
const response = await fetch('/api/atlas/canvas/renderables', {
  headers: {
    'Accept': 'application/msgpack',
    'Accept-Encoding': 'gzip',
  },
});

const buffer = await response.arrayBuffer();
const data = msgpack.decode(new Uint8Array(buffer));
```

### Session Lifecycle

```typescript
// 1. Start session
const session = await fetch('/api/atlas/session/start', {
  method: 'POST',
  body: JSON.stringify({ wallet: '0x...' }),
});

// 2. Use session token for subsequent requests
const token = session.token;

// 3. Requests reuse the session
await fetch('/api/atlas/canvas/renderables', {
  headers: { 'Authorization': `Bearer ${token}` },
});

// 4. End session when done
await fetch('/api/atlas/session/end', { method: 'POST' });
```

---

## Comparison with Standard Protocols

| Feature | REST/HTTP | Atlas v2 |
|---------|-----------|----------|
| Connection | New per request | Single multiplexed |
| Encoding | JSON text | MessagePack binary |
| Compression | Optional gzip | Adaptive dictionary + gzip |
| State | Stateless | Session-aware |
| Sync | Full payload | Delta sync supported |
| Lanes | N/A | 8 independent channels |

---

## Limitations & Considerations

1. **MessagePack dependency:** Clients need msgpack library
2. **Session overhead:** Short-lived connections may not benefit from session reuse
3. **Dictionary warmup:** First requests in a session don't benefit from dictionary compression
4. **Browser support:** WebSocket fallback needed for true multiplexing in browsers

---

## Source Files

| Component | File |
|-----------|------|
| Transport Layer | `server/protocol/transport.ts` |
| Encoding Pipeline | `server/protocol/encoding.ts` |
| Wire Format | `server/protocol/wire.ts` |
| Session Management | `server/protocol/session.ts` |
| Benchmark Runner | `server/benchmark/runner.ts` |
| REST Baseline | `server/benchmark/restBaseline.ts` |
| Atlas Routes | `server/atlas/routes.ts` |
| Streaming | `server/atlas/streaming.ts` |

---

## Verification

To verify Atlas v2 efficiency claims:

1. **Start the server:** `npm run dev`
2. **Wait 60 seconds:** Benchmark runner executes automatically
3. **Query metrics:** Check `api_request_metrics` table
4. **Compare:** Atlas vs REST baseline for same endpoints

Claims are substantiated when benchmark data shows measurable differences.
