# P3 Protocol Binary Wire Format

This package contains the Protobuf schema definitions for Atlas API 2.0 binary frames.

## Overview

The P3 Protocol uses a lightweight binary wire format compatible with Protocol Buffers for efficient content access manifest transport. The implementation uses manual binary encoding without requiring an external protobuf compiler.

## Schemas

### AccessFrame (`proto/access_frame.proto`)

The primary binary manifest for content access, containing:

- **AccessMode**: How content can be accessed (URI, EMBED, OPEN_WEB)
- **Readiness**: Resolver/cache state (PENDING, READY, DEGRADED)
- **Capabilities**: Media playback capabilities (codec, segment duration, CORS)
- **Signature**: Server signature for integrity verification

### ReceiptEvent (`proto/receipt_event.proto`)

User engagement events for the receipts system:

- **Action**: User engagement type (PLAY, READ, WATCH, BUY, LISTEN, VOTE, BROWSE)
- **Session/Item IDs**: Context identifiers
- **Metadata**: Extensible key-value metadata map

## Wire Format

The binary encoding follows standard protobuf wire format:

- **Varint encoding** for integers and enums
- **Length-prefixed encoding** for strings and bytes
- **Field tags**: `(field_number << 3) | wire_type`

Wire types:
- `0`: Varint (int32, int64, uint32, uint64, bool, enum)
- `2`: Length-delimited (string, bytes, embedded messages)

## Usage

### Server-side (TypeScript)

```typescript
import {
  buildAccessFrame,
  serializeAccessFrame,
  parseAccessFrame,
  signAccessFrame,
  verifyAccessFrame,
  encodeAccessFrameForSSE,
  AccessMode,
  Readiness,
} from '@server/protocol';

// Build a frame
const frame = buildAccessFrame({
  id: 'uuid-v4-here',
  mode: AccessMode.EMBED,
  embed: 'https://example.com/player/123',
  readiness: Readiness.READY,
  ttlMs: 300000,
  capabilities: {
    codec: 'h264',
    segmentMs: 2000,
    cors: true,
  },
});

// Sign and serialize
const { frame: signedFrame } = signAccessFrame(frame);
const bytes = serializeAccessFrame(signedFrame);

// For SSE transport
const base64Data = encodeAccessFrameForSSE(signedFrame);
// Send via: `data: ${base64Data}\n\n`
```

### Client-side (JavaScript)

```javascript
// Decode from SSE event
const bytes = decodeBase64(event.data);
const frame = parseAccessFrame(bytes);

console.log(frame.mode);       // AccessMode.EMBED
console.log(frame.embed);      // 'https://example.com/player/123'
console.log(frame.readiness);  // Readiness.READY
```

## SSE Transport

Binary frames are base64-encoded for SSE transport:

```
event: access
data: CiR1dWlkLXY0LWhlcmUQAhoiaHR0cHM6Ly9leGFtcGxlLmNvbS9wbGF5ZXIvMTIzKAI=

```

The client decodes the base64 payload back to binary and parses the frame.

## Frame Signing

Frames are signed using HMAC-SHA256 for integrity verification:

```typescript
// Server signs frame
const { frame: signedFrame, signatureHex } = signAccessFrame(frame);

// Verification
const result = verifyAccessFrame(signedFrame);
if (result.valid) {
  // Frame integrity verified
}
```

Set the signing key via environment variable:
```
ATLAS_FRAME_SIGNING_KEY=<64-hex-characters>
```

## Size Efficiency

Binary frames are typically 40-60% smaller than equivalent JSON:

| Frame Type | JSON Size | Binary Size | Savings |
|------------|-----------|-------------|---------|
| AccessFrame (minimal) | ~150 bytes | ~60 bytes | 60% |
| AccessFrame (full) | ~400 bytes | ~180 bytes | 55% |
| ReceiptEvent | ~200 bytes | ~80 bytes | 60% |

## License

Apache-2.0
