# Atlas Transport

This document describes the Atlas Transport layer, P3 Protocol's streaming and content delivery infrastructure.

## Overview

Atlas Transport provides:
- **Video/Audio Streaming**: Content delivery with caching
- **TV Channel Catalog**: IPTV channel management
- **Node Metrics**: Bandwidth tracking and uptime monitoring
- **Static Asset Serving**: SDK bundles, games, media files
- **Analytics Ingestion**: Privacy-preserving event collection

## Directory Structure

```
server/atlas/
├── streaming.ts           # Main transport module (3000+ lines)
├── routes.ts              # API route definitions
├── core/                  # Core services
├── services/              # Business logic
├── one/                   # Atlas One catalog system
├── gamedeck/              # Game catalog integration
└── data/                  # Static data files
```

## Exported Components

From `streaming.ts`:

```typescript
export {
  streamingRouter,           // Express router
  meshNode,                  // Mesh node instance
  STREAM_CATALOG,            // Stream catalog
  TV_CHANNEL_CATALOG,        // TV channel catalog
  loadTVChannels,            // Load TV channels
  getTVChannel,              // Get single channel
  getAllTVChannels,          // Get all channels
  CachedCatalog,             // Catalog cache class
  catalogCache,              // Catalog cache instance
  APPS_REGISTRY,             // App registry
  StaticAssetCache,          // Asset cache class
  staticAssetCache,          // Asset cache instance
  computeSha256,             // Hash utility
  generateAssetEtag,         // ETag generation
  MediaRelayNode,            // Relay node class
  MediaRelayRegistry,        // Relay registry class
  mediaRelayRegistry,        // Relay registry instance
  AnalyticsIngester,         // Analytics class
  analyticsIngester,         // Analytics instance
  anonymizeWallet,           // Privacy utility
};
```

## Key Functions

### Content Tracking

```typescript
import { trackContentServed, recordNodeHeartbeat } from './atlas/streaming';

// Track bytes delivered (persists to database if wallet provided)
await trackContentServed(byteCount, walletAddress);

// Record node heartbeat for uptime tracking
await recordNodeHeartbeat(walletAddress);
```

### TV Channels

```typescript
import { getTVChannel, getAllTVChannels, loadTVChannels } from './atlas/streaming';

// Load channels from IPTV sources
await loadTVChannels();

// Get all channels
const channels = getAllTVChannels();

// Get single channel
const channel = getTVChannel('channel-id');
```

## Database Integration

Atlas Transport persists metrics to PostgreSQL via Drizzle ORM:

```typescript
// Schema: nodeDailyMetrics
{
  walletAddress: string,
  statsDate: string,        // YYYY-MM-DD
  bytesServed: number,
  tasksCompleted: number,
  uptimeMs: number,
  peersConnected: number,
  lastHeartbeatAt: Date,
}
```

### Automatic Features

- Daily metrics reset at midnight
- Heartbeat-based uptime calculation (2-minute max gap)
- Conflict-resolution for concurrent updates via `onConflictDoUpdate`

## Rate Limiting

Built-in rate limiter:

```typescript
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  check(key: string): RateLimitResult;
  reset(key: string): void;
}
```

## Caching

### Catalog Cache

```typescript
export class CachedCatalog<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttl?: number): void;
  invalidate(key: string): void;
}
```

### Static Asset Cache

```typescript
export class StaticAssetCache {
  get(assetId: string): StaticAsset | undefined;
  set(asset: StaticAsset): void;
  getManifest(type: StaticAssetType): StaticAssetManifest;
}
```

## Analytics

Privacy-preserving analytics with wallet anonymization:

```typescript
import { analyticsIngester, anonymizeWallet } from './atlas/streaming';

// Anonymize wallet for privacy
const anonWallet = anonymizeWallet(walletAddress);

// Analytics are batched and processed asynchronously
```

## External Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server and routing |
| `axios` | HTTP client for upstream requests |
| `drizzle-orm` | Database ORM |
| `multer` | File upload handling |
| `crypto` | Hash generation |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |

## Integration Example

```typescript
import express from 'express';
import { streamingRouter } from './atlas/streaming';

const app = express();

// Mount streaming routes
app.use('/api/stream', streamingRouter);
```

## Interfaces

### TVChannel

```typescript
interface TVChannel {
  id: string;
  name: string;
  logo?: string;
  url: string;
  group?: string;
  language?: string;
}
```

### StreamNode

```typescript
interface StreamNode {
  id: string;
  walletAddress: string;
  status: 'online' | 'offline';
  bytesServed: number;
  uptimeMs: number;
}
```

### StaticAsset

```typescript
interface StaticAsset {
  id: string;
  type: 'sdk' | 'bundle' | 'game' | 'media';
  url: string;
  size: number;
  sha256: string;
  etag: string;
}
```

## Modular Extraction

Atlas Transport has dependencies on:
- Database schema (`@shared/schema`)
- Drizzle ORM
- Logger (`server/observability/`)

### Extraction Strategy

Recommended: Extract as `@p3/atlas` including schema types.

### Files to Copy

```
server/atlas/streaming.ts
shared/nodestream-types.ts
shared/schema.ts (nodeDailyMetrics table)
```

### Extraction Checklist

- [ ] Abstract database layer with adapter pattern
- [ ] Make logger injectable
- [ ] Extract schema types to shared package
- [ ] Create standalone test suite

## Related Documentation

- [REALTIME_INFRASTRUCTURE.md](./REALTIME_INFRASTRUCTURE.md) - WebSocket/SSE details
- [MESH_NETWORK.md](./MESH_NETWORK.md) - P2P content distribution

## License

Apache License 2.0
