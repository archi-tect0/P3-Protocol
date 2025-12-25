# Real-Time Infrastructure

P3 Protocol provides real-time communication via WebRTC voice/video, WebSocket messaging, and Server-Sent Events for streaming updates.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME INFRASTRUCTURE                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │  WebRTC     │    │  WebSocket  │    │    SSE      │              │
│  │  Voice/Video│    │  Messaging  │    │  Streaming  │              │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│         │                  │                  │                       │
│         ▼                  ▼                  ▼                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    SIGNALING SERVER                           │   │
│  │  WebSocket + STUN/TURN + Room Management + Rate Limiting     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    SOCKET.IO SHARD MANAGER                    │   │
│  │  8 Shards + Redis Pub/Sub + Connection Balancing             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## WebRTC Voice/Video Calls

### Signaling Server

The signaling server facilitates WebRTC connection establishment:

```typescript
// server/signaling.ts
interface SignalingMessage {
  type: 'auth' | 'join' | 'offer' | 'answer' | 'ice' | 'end' | 'heartbeat';
  roomId?: string;
  address?: string;
  signature?: string;
  data?: any;
}

const clients = new Map<WebSocket, ClientInfo>();
const rooms = new Map<string, Set<WebSocket>>();

function handleSignalingMessage(ws: WebSocket, message: SignalingMessage) {
  switch (message.type) {
    case 'auth':
      // Verify wallet signature
      const verified = verifySignature(message.address, message.signature);
      if (verified) {
        clients.get(ws).authenticated = true;
        ws.send(JSON.stringify({ type: 'auth_ok' }));
      }
      break;

    case 'join':
      // Join room for call
      joinRoom(ws, message.roomId);
      break;

    case 'offer':
    case 'answer':
    case 'ice':
      // Relay to peer in room
      relayToPeer(ws, message);
      break;
  }
}
```

**Source:** `server/signaling.ts`

### ICE/TURN Configuration

```typescript
function getWebRTCConfig(deviceType: 'mobile' | 'desktop', turnEnabled: boolean) {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (turnEnabled) {
    iceServers.push({
      urls: [
        'turn:turn.replit.dev:3478?transport=udp',
        'turn:turn.replit.dev:3478?transport=tcp',
      ],
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return {
    iceServers,
    codecPreferences: {
      audio: deviceType === 'mobile' ? 'opus/24000/2' : 'opus/48000/2',
    },
    sdpSemantics: 'unified-plan',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
  };
}
```

### Call Quality Monitoring

```typescript
interface StatsData {
  rtt: number;           // Round-trip time (ms)
  jitter: number;        // Packet jitter (ms)
  packetLoss: number;    // Packet loss (%)
  bitrate: number;       // Current bitrate
  codec: string;         // Active codec
  iceState: string;      // ICE connection state
  timestamp: number;
}

// Quality thresholds
const RTT_THRESHOLD = 300;           // ms
const PACKET_LOSS_THRESHOLD = 5;     // %
const ICE_TIMEOUT_THRESHOLD = 8000;  // ms

// Adaptive quality adjustment
function assessNetworkQuality(stats: StatsData): 'excellent' | 'good' | 'poor' | 'critical' {
  if (stats.rtt < 100 && stats.packetLoss < 1) return 'excellent';
  if (stats.rtt < RTT_THRESHOLD && stats.packetLoss < PACKET_LOSS_THRESHOLD) return 'good';
  if (stats.rtt < 500 && stats.packetLoss < 10) return 'poor';
  return 'critical';
}
```

---

## WebSocket Architecture

P3 uses native WebSocket servers for real-time communication:

```
┌─────────────────────────────────────────────────────────────┐
│                    WEBSOCKET TOPOLOGY                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client → WebSocket Server → Room Management                │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Signaling Server (ws)                  │    │
│  │  - WebRTC offer/answer relay                       │    │
│  │  - ICE candidate exchange                          │    │
│  │  - Room-based peer matching                        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Pulse Stream (/pulse/stream)           │    │
│  │  - Node registration                               │    │
│  │  - Metrics broadcast                               │    │
│  │  - Task distribution                               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Connection Management

```typescript
// server/signaling.ts
const clients = new Map<WebSocket, ClientInfo>();
const rooms = new Map<string, Set<WebSocket>>();

// Connection handling
wss.on('connection', (ws) => {
  // Initialize client info
  clients.set(ws, {
    ws,
    authenticated: false,
    lastHeartbeat: Date.now(),
  });

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    handleSignalingMessage(ws, message);
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});
```

**Source:** `server/signaling.ts`

### Message Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `message:send` | Client → Server | `{ to, content, encrypted }` |
| `message:receive` | Server → Client | `{ from, content, timestamp }` |
| `presence:update` | Bidirectional | `{ status, lastSeen }` |
| `typing:start` | Client → Server | `{ conversationId }` |
| `typing:indicator` | Server → Client | `{ from, isTyping }` |
| `call:incoming` | Server → Client | `{ from, roomId }` |
| `call:accepted` | Bidirectional | `{ roomId }` |

---

## Server-Sent Events (SSE)

### Lane-Based Streaming

Atlas API v2 uses SSE for streaming updates on dedicated lanes:

```typescript
// server/protocol/session/lanes.ts
function setupSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

// Manifest lane - streams content locations
app.get('/v1/session/:sid/lane/manifests', (req, res) => {
  setupSSEHeaders(res);
  
  const client = {
    sessionId: req.params.sid,
    laneType: 'manifests',
    response: res,
    connectedAt: Date.now(),
  };

  sseClients.set(getClientKey(client), client);

  req.on('close', () => {
    sseClients.delete(getClientKey(client));
  });
});

// Send event to client
function sendSSEEvent(client: SSEClient, event: LaneEvent) {
  const { response } = client;
  response.write(`event: ${event.type}\n`);
  response.write(`id: ${event.id}\n`);
  response.write(`data: ${JSON.stringify(event.data)}\n\n`);
}
```

**Source:** `server/protocol/session/lanes.ts`

### SSE Lanes

| Lane | Path | Purpose |
|------|------|---------|
| Manifests | `/v1/session/:sid/lane/manifests` | Stream content locations |
| Access | `/v1/session/:sid/lane/access` | Deliver decryption keys |
| Catalog | `/v1/session/:sid/lane/catalog` | Push catalog updates |
| Receipts | POST `/v1/session/:sid/lane/receipts` | Fire-and-forget events |

---

## Pulse WebSocket

Real-time metrics and node coordination:

```typescript
// server/routes/pulse.ts
export function attachPulseWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    
    if (pathname === '/pulse/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws) => {
    // Rate limiting per session
    const session = { messageCount: 0, lastMessageTime: Date.now() };

    ws.on('message', (data) => {
      if (!checkMessageRateLimit(session)) {
        ws.send(JSON.stringify({ type: 'error', data: { message: 'Rate limit exceeded' } }));
        return;
      }

      const message = JSON.parse(data.toString());
      handlePulseMessage(ws, message);
    });
  });
}
```

**Source:** `server/routes/pulse.ts`

---

## Connection Resilience

### Reconnection Strategy

```typescript
// Client-side reconnection
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

function createReconnectingWebSocket(url: string) {
  let ws: WebSocket;
  let reconnectAttempt = 0;

  function connect() {
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      reconnectAttempt = 0; // Reset on success
    };

    ws.onclose = (event) => {
      if (!event.wasClean) {
        const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
        setTimeout(connect, delay);
        reconnectAttempt++;
      }
    };
  }

  connect();
  return ws;
}
```

### Heartbeat Monitoring

```typescript
// Server-side heartbeat
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

setInterval(() => {
  const now = Date.now();
  
  for (const [ws, client] of clients) {
    if (now - client.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      ws.terminate();
      clients.delete(ws);
    }
  }
}, HEARTBEAT_INTERVAL);

// Client ping handling
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'ping') {
    client.lastHeartbeat = Date.now();
    ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
  }
});
```

---

## Scaling Model

### Horizontal Scaling

| Component | Scaling Strategy |
|-----------|------------------|
| Signaling | Stateless, any node |
| Socket.IO | Sharded, Redis pub/sub |
| SSE | Session-pinned, sticky |
| Pulse WS | Sharded by wallet |

### Redis Pub/Sub Channels

```typescript
// Cross-shard message routing
const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();

// Channel naming
const channels = {
  messages: 'p3:messages',      // Direct messages
  presence: 'p3:presence',      // Online status
  broadcast: 'p3:broadcast',    // System announcements
  metrics: 'p3:metrics',        // Pulse updates
};

// Subscribe to channels
subClient.subscribe(Object.values(channels));
subClient.on('message', (channel, message) => {
  const data = JSON.parse(message);
  routeToLocalClients(channel, data);
});
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TURN_USERNAME` | - | TURN server username |
| `TURN_CREDENTIAL` | - | TURN server credential |
| `REDIS_URL` | - | Redis connection URL |
| `WS_HEARTBEAT_INTERVAL` | 30000 | Heartbeat interval (ms) |
| `WS_HEARTBEAT_TIMEOUT` | 60000 | Heartbeat timeout (ms) |

---

## Source Files

| Component | Location |
|-----------|----------|
| Signaling server | `server/signaling.ts` |
| WebSocket manager | `server/realtime/ws.ts` |
| SSE lanes | `server/protocol/session/lanes.ts` |
| Pulse WebSocket | `server/routes/pulse.ts` |
| Client WebRTC | `client/src/pages/VoiceCall.tsx` |
