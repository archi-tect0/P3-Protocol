# Infrastructure - Advanced Systems

This guide documents P3 Protocol's infrastructure features including the 8-lane protocol, PWA cache protection, and decentralized EPG.

## 8-Lane Protocol

P3 Protocol uses an 8-lane architecture for prioritized, multiplexed streaming.

### Architecture

**Code Reference:** `server/protocol/session/handshake-v2.ts`

```typescript
// All lane IDs
const ALL_LANE_IDS = [1, 2, 3, 4, 5, 6, 7, 8];

// Lane purposes
const LANE_NAMES = {
  1: 'Control',        // Session management, heartbeats
  2: 'Messaging',      // Chat, notifications
  3: 'Voice',          // Audio streams
  4: 'Video',          // Video streams
  5: 'Data',           // File transfers, bulk data
  6: 'Telemetry',      // Metrics, diagnostics
  7: 'Sync',           // State synchronization
  8: 'Relay'           // Fallback, overflow
};
```

### Session Handshake

```bash
POST /api/protocol/v2/session/handshake
{
  "clientId": "device-123",
  "wallet": "0x...",
  "capabilities": {
    "transports": ["http1", "http3"],
    "encodings": ["protobuf", "msgpack", "json"],
    "lanes": [1, 2, 3, 4]
  },
  "deviceInfo": {
    "platform": "web",
    "version": "1.0.0"
  }
}
```

### Handshake Response

```json
{
  "sessionId": "uuid",
  "transport": "http1",
  "lanes": [
    {
      "id": 1,
      "name": "Control",
      "encoding": "msgpack",
      "url": "/api/protocol/v2/session/{sid}/lane/1/stream"
    }
  ],
  "dictionary": {
    "version": "1",
    "tokens": ["msg", "ts", "from", "..."],
    "indexMap": { "msg": 1, "ts": 2, "...": 3 }
  },
  "serverTime": 1735689600000,
  "ttlSeconds": 3600,
  "protocol": {
    "version": "2.0.0",
    "features": ["msgpack", "dictionary", "priority"]
  }
}
```

### Lane Configuration

Each lane has specific characteristics:

```typescript
interface LaneSpec {
  defaultEncoding: Encoding;
  priority: number;        // Higher = more important
  queueDepth: number;      // Buffer size
  reliable: boolean;       // Guaranteed delivery
}

const LaneRegistry = {
  1: { defaultEncoding: 'msgpack', priority: 100, queueDepth: 100, reliable: true },
  2: { defaultEncoding: 'msgpack', priority: 90, queueDepth: 500, reliable: true },
  3: { defaultEncoding: 'protobuf', priority: 80, queueDepth: 50, reliable: false },
  // ...
};
```

### Session Management

```typescript
// Get session status
GET /api/protocol/v2/session/:sid

// Close session
DELETE /api/protocol/v2/session/:sid

// Protocol info
GET /api/protocol/v2/protocol/info
```

### Priority Scheduling

The priority scheduler manages bandwidth allocation across lanes:

```typescript
// Register session with lanes
priorityScheduler.registerSession(sessionId, validLanes);

// Unregister on close
priorityScheduler.unregisterSession(sessionId);
```

---

## Nexus as P2P Signaling

The Nexus messaging system doubles as a WebRTC signaling layer.

### Signaling Flow

```
1. Caller initiates: POST /api/nexus/calls/initiate
2. System sends offer via Nexus messaging (Lane 2)
3. Callee receives signaling message
4. ICE candidates exchanged via Nexus
5. Direct P2P connection established
6. Media flows peer-to-peer
```

### Use Cases

- **Decentralized Video Calls**: No central signaling server
- **P2P File Sync**: Direct device-to-device transfers
- **Gaming**: Low-latency peer connections
- **Mesh Networking**: Node-to-node connections

### Implementation Pattern

```typescript
// Send signaling message via Nexus
await nexus.sendMessage({
  to: peerWallet,
  type: 'webrtc-offer',
  payload: {
    sdp: offer.sdp,
    type: offer.type
  }
});

// Receive signaling messages
nexus.onMessage((msg) => {
  if (msg.type === 'webrtc-offer') {
    handleOffer(msg.payload);
  } else if (msg.type === 'webrtc-ice') {
    addIceCandidate(msg.payload);
  }
});
```

---

## PWA Cache Protection

P3 Protocol includes automatic stale-cache detection and cleanup.

### Architecture

**Code Reference:** `server/index.ts`

The version check script detects outdated PWA instances:

```typescript
const versionCheckScript = `
  (async () => {
    const serverVersion = await fetch('/api/version').then(r => r.json());
    const appVersion = document.querySelector('meta[name="app-version"]')?.content;
    
    if (appVersion && serverVersion.version !== appVersion) {
      // Clear Service Worker
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
      
      // Clear caches
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(c => caches.delete(c)));
      
      // Force reload
      window.location.reload(true);
    }
  })();
`;
```

### How It Works

1. PWA loads with cached version
2. Script fetches `/api/version` from server
3. Compares against `<meta name="app-version">` in HTML
4. If mismatch detected:
   - Unregisters all Service Workers
   - Clears all browser caches
   - Forces hard reload

### Benefits

- **No Stale Code**: Users always get latest version
- **Automatic Updates**: No manual cache clearing needed
- **Graceful Degradation**: Works even if SW update fails
- **Zero Downtime**: Update happens transparently

---

## Decentralized EPG

P3 Protocol includes a decentralized Electronic Program Guide synced from IPTV-org.

### Architecture

**Code Reference:** `server/atlas/one/sync/iptvService.ts`

```typescript
const IPTV_API_BASE = 'https://iptv-org.github.io/api';

// Data sources
// - channels.json: 38,000+ channel metadata
// - streams.json: Stream URLs
```

### Sync Options

```typescript
interface SyncOptions {
  countries?: string[];      // Filter by country codes
  categories?: string[];     // Filter by category
  limit?: number;           // Max channels to import
  excludeNSFW?: boolean;    // Filter adult content
}
```

### Syncing Channels

```typescript
import { syncIPTVChannels } from './atlas/one/sync/iptvService';

const result = await syncIPTVChannels({
  countries: ['US', 'UK', 'CA'],
  categories: ['news', 'sports'],
  limit: 1000,
  excludeNSFW: true
});

console.log(result);
// { fetched: 1000, imported: 950, skipped: 50, errors: [] }
```

### Channel Categories

```typescript
const CATEGORY_MAP = {
  'general': 'General',
  'entertainment': 'Entertainment',
  'news': 'News',
  'sports': 'Sports',
  'music': 'Music',
  'movies': 'Movies',
  'kids': 'Kids',
  'documentary': 'Documentary',
  // ... 24 categories total
};
```

### Data Flow

```
IPTV-org API
    │
    ├── channels.json (metadata)
    │   └── id, name, country, categories, network
    │
    └── streams.json (playback)
        └── channel_id, url, quality
            │
            ▼
    marketplace_items table
    (vertical: 'tv', source: 'iptv-org')
```

### Browse Experience

Users can browse:
- **By Country**: 200+ countries supported
- **By Category**: News, sports, music, etc.
- **By Network**: BBC, CNN, ESPN, etc.
- **Now Playing**: Current program information

### Rate Limiting

Sync respects API limits:
- Incremental sync via cursors
- Configurable batch sizes
- Automatic retry with backoff
