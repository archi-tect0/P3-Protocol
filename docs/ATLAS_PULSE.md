# Atlas Pulse - Metrics & Observability

Atlas Pulse provides real-time metrics, efficiency tracking, and node network telemetry for the P3 Protocol mesh operating system.

---

## Overview

Pulse operates at three levels:
1. **Canvas Metrics** - User activity, page views, navigation flow
2. **Efficiency Metrics** - Protocol performance vs REST baselines
3. **Node Telemetry** - Mesh network node status and task completion

---

## Accessing Pulse

### UI Modes

| Mode | Route | Description |
|------|-------|-------------|
| PulseMode | Atlas Canvas → Pulse | Full dashboard with all metrics |
| MetricsMode | Atlas Canvas → Metrics | System status and activity charts |
| NodeMode | Atlas Canvas → Node | Node operator view |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics/live` | GET | Current active sessions |
| `/api/metrics/anchored` | GET | Blockchain-anchored events count |
| `/api/metrics/system-status` | GET | Service health (DB, IPFS, WebRTC) |
| `/api/metrics/geo` | GET | Geographic distribution |
| `/api/metrics/devices` | GET | Device/browser breakdown |
| `/api/pulse` | GET | Full Pulse metrics bundle |
| `/pulse/stream` | WS | Real-time WebSocket stream |

---

## Canvas Metrics

### Live Activity (`PulseMetrics`)

```typescript
interface PulseMetrics {
  liveUsers: number;              // Currently connected sessions
  uniqueVisitors24h: number;      // Unique wallets in 24h
  totalPageViews: number;         // Cumulative page views
  topPages: { route: string; views: number }[];
  topReferrers: { referrer: string; views: number }[];
  geoData: { country: string; count: number }[];
  browsers: { browser: string; views: number }[];
  devices: { device: string; views: number }[];
  messagesToday: number;          // Nexus messages sent today
  catalogItems: number;           // Total catalog entries
  trafficByHour: { hour: number; count: number }[];
}
```

### Session Analytics

```typescript
interface SessionAnalytics {
  sessionDepth: {
    avgPagesPerSession: number;   // Average pages viewed per session
    totalSessions: number;        // Total sessions tracked
    deepSessions: number;         // Sessions with 5+ page views
  };
  timeOnSurface: {
    avgSeconds: number;           // Mean time on site
    medianSeconds: number;        // Median time on site
    maxSeconds: number;           // Longest session
  };
  navigationFlow: {
    from: string;                 // Source route
    to: string;                   // Destination route
    count: number;                // Transition count
  }[];
  searchIntentDensity: {
    avgSearchesPerUser: number;
    totalSearches: number;
    uniqueSearchers: number;
  };
}
```

---

## Efficiency Metrics

Atlas Pulse compares v2 protocol performance against REST baselines.

### Payload Efficiency

```typescript
interface PayloadMetrics {
  atlasAvgBytes: number;          // Average v2 request size
  restAvgBytes: number;           // Average REST request size
  savingsPercent: number;         // Reduction percentage
  details: {
    binaryEncoding: string;       // "MessagePack enabled"
    compression: string;          // "Dictionary + Gzip"
    deltaSync: string;            // "Enabled for user state"
    requestsTracked: number;
  };
}
```

### Latency Metrics

```typescript
interface LatencyMetrics {
  atlasP50Ms: number;             // v2 median latency
  atlasP95Ms: number;             // v2 95th percentile
  restP50Ms: number;              // REST median latency
  restP95Ms: number;              // REST 95th percentile
  improvementPercent: number;     // Latency reduction
  details: {
    connectionPool: string;       // "Multiplexed (8 lanes)"
    edgeCaching: string;          // "Session dictionary cached"
    prefetching: string;          // "Manifest prefetch enabled"
    requestsTracked: number;
  };
}
```

### Session Efficiency

```typescript
interface SessionMetrics {
  atlasSessionReuse: number;      // Sessions reused (%)
  restStatelessOverhead: number;  // REST auth overhead (ms)
  savedConnections: number;       // TCP connections avoided
  details: {
    authentication: string;       // "Wallet-signed, cached"
    sessionDuration: string;      // "30 min TTL"
    encryption: string;           // "TweetNaCl E2E"
    totalSessions: number;
  };
}
```

### Developer Experience

```typescript
interface DeveloperMetrics {
  unifiedEndpoints: number;       // v2 endpoint count
  fragmentedEndpoints: number;    // Equivalent REST endpoints
  reductionPercent: number;       // API surface reduction
  details: {
    canvasModes: number;          // Atlas modes available
    deepLinkApps: number;         // P3 Hub apps registered
    voiceCommands: boolean;       // Voice control enabled
    blockchainAnchoring: boolean; // Receipt anchoring active
  };
}
```

### Resource Usage

```typescript
interface ResourceMetrics {
  atlasBandwidthMb: number;       // v2 bandwidth usage
  restBandwidthMb: number;        // Equivalent REST bandwidth
  savingsPercent: number;         // Bandwidth reduction
  cpuReductionPercent: number;    // Server CPU savings
  details: {
    serverPool: string;           // "Connection pooling active"
    caching: string;              // "Dictionary + manifest cache"
    serialization: string;        // "MessagePack (binary)"
    totalRequests: number;
  };
}
```

---

## Node Network Telemetry

### Node Heartbeats

Mesh nodes report heartbeats via WebSocket to track uptime and availability.

```typescript
// Heartbeat record
interface NodeHeartbeat {
  nodeId: string;
  wallet: string;
  lastSeen: number;               // Unix timestamp
  tasksCompleted: number;         // Lifetime task count
  bytesProcessed: number;         // Lifetime bytes relayed
}
```

**Persistence:** Heartbeats are stored in the database via `recordNodeHeartbeat()` for historical tracking.

### Task Completion

Nodes report completed tasks (content relay, bridge operations) via the Pulse WebSocket:

```typescript
// WebSocket message
{
  "type": "node:task:complete",
  "data": {
    "taskId": "task-abc123",
    "taskType": "relay",
    "bytesProcessed": 1048576,
    "durationMs": 2340
  }
}
```

### Node Authentication

Nodes must authenticate via wallet signature before receiving tasks:

1. Node connects to `/pulse/stream`
2. Node sends `node:register` with wallet address
3. Server returns challenge nonce
4. Node signs challenge and submits signature
5. Server validates and registers node

---

## WebSocket Streaming

### Connecting to Pulse Stream

```typescript
const ws = new WebSocket('wss://your-domain/pulse/stream');

ws.onopen = () => {
  // Register as a node (optional)
  ws.send(JSON.stringify({
    type: 'node:register',
    data: { wallet: '0x...' }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'metrics:update':
      // Real-time metrics push
      break;
    case 'news:update':
      // Live news broadcast
      break;
    case 'node:task':
      // Task assignment for nodes
      break;
  }
};
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `ping` | Client → Server | Keep-alive |
| `pong` | Server → Client | Keep-alive response |
| `node:register` | Client → Server | Node authentication start |
| `node:challenge` | Server → Client | Authentication challenge |
| `node:authenticated` | Server → Client | Authentication success |
| `node:task` | Server → Client | Task assignment |
| `node:task:complete` | Client → Server | Task completion report |
| `metrics:update` | Server → Client | Real-time metrics broadcast |
| `news:update` | Server → Client | Live news articles |

---

## Rate Limiting

### Connection Limits

| Limit | Value | Scope |
|-------|-------|-------|
| Connections per wallet | 3 | Per wallet address |
| Messages per minute | 60 | Per connection |
| Challenge requests per minute | 5 | Per wallet address |

### Endpoint Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/pulse` | 30 req | 60 sec |
| `/api/metrics/*` | 60 req | 60 sec |
| Node task reports | 120 req | 60 sec |

---

## Security Considerations

### Production Mode

In production (`NODE_ENV=production`):
- Diagnostics endpoints require `PULSE_DIAGNOSTICS_ENABLED=true`
- Sensitive metrics require JWT authentication
- WebSocket connections require wallet signature verification
- Rate limiting is enforced strictly

### Authentication Requirements

| Endpoint | Auth Required |
|----------|---------------|
| `/api/metrics/live` | No (public) |
| `/api/metrics/geo` | Production only |
| `/api/pulse` (full) | Production only |
| `/pulse/stream` | For task assignment |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PULSE_DIAGNOSTICS_ENABLED` | `false` | Enable diagnostic endpoints in production |
| `NODE_ENV` | `development` | Environment mode |

---

## Source Files

| Component | Location |
|-----------|----------|
| Pulse routes | `server/routes/pulse.ts` |
| Pulse service | `server/atlas/services/pulseService.ts` |
| PulseMode UI | `client/src/components/atlas/modes/PulseMode.tsx` |
| MetricsMode UI | `client/src/components/atlas/modes/MetricsMode.tsx` |
| Node streaming | `server/atlas/streaming.ts` |
| Session bridge | `server/atlas/services/sessionBridge.ts` |
