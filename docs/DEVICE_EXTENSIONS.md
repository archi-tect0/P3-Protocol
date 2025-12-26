# Device Extensions

Access Atlas from any device with a screen or speaker. P3 Protocol provides production-ready integrations for smart TVs and voice assistants, plus a universal handshake protocol for building custom device clients.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Device Extension Layer                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Roku API    │  │  Alexa API   │  │  Universal Handshake │   │
│  │  /atlas/roku │  │  /atlas/alexa│  │  /v1/session/...     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────────▼───────────┐   │
│  │ QR Pairing   │  │ Voice Intent │  │ Device Capabilities  │   │
│  │ PIN Unlock   │  │ Session Bind │  │ Lane Negotiation     │   │
│  │ TV Commands  │  │ Wallet Link  │  │ Encoding Selection   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
            ┌─────────────────────────────────────┐
            │          Session Bridge             │
            │   Cross-device session continuity   │
            │   WalletConnect-based handoff       │
            └─────────────────────────────────────┘
```

---

## Production-Ready Integrations

### Roku Integration

Full smart TV pairing system with QR codes and PIN unlock.

**Endpoints:** `server/atlas/roku.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/atlas/roku/session/start` | POST | Create pairing session |
| `/api/atlas/roku/session/:id/bind` | POST | Bind wallet to session |
| `/api/atlas/roku/session/:id/status` | GET | Check pairing status |
| `/api/atlas/roku/session/:id/qr` | GET | Get QR code (JSON) |
| `/api/atlas/roku/session/:id/qr.png` | GET | Get QR code (image) |
| `/api/atlas/roku/session/:id/command` | POST | Send command to TV |
| `/api/atlas/roku/session/:id/pin/set` | POST | Set unlock PIN |
| `/api/atlas/roku/session/:id/pin/verify` | POST | Verify PIN |
| `/api/atlas/roku/stats` | GET | Session statistics |

**Pairing Flow:**

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   Roku TV   │                    │   Server    │                    │   Mobile    │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │ POST /session/start              │                                  │
       │ {device: "roku", model: "..."}   │                                  │
       ├─────────────────────────────────►│                                  │
       │                                  │                                  │
       │ {sessionId, pairingCode: 123456, │                                  │
       │  token, pairUrl}                 │                                  │
       │◄─────────────────────────────────┤                                  │
       │                                  │                                  │
       │ Display QR code on TV screen     │                                  │
       │ GET /session/:id/qr.png?token=   │                                  │
       ├─────────────────────────────────►│                                  │
       │                                  │                                  │
       │ ◄──── QR: atlas://pair?s=...     │                                  │
       │                                  │                                  │
       │                                  │    User scans QR with phone      │
       │                                  │◄───────────────────────────────┤
       │                                  │                                  │
       │                                  │    POST /pair                    │
       │                                  │    {code, walletAddress, token}  │
       │                                  │◄──────────────────────────────────┤
       │                                  │                                  │
       │                                  │    {ok: true, sessionId}         │
       │                                  ├──────────────────────────────────►│
       │                                  │                                  │
       │ Poll /session/:id/status         │                                  │
       │ → paired: true                   │                                  │
       │◄─────────────────────────────────┤                                  │
       │                                  │                                  │
       │ TV now has wallet access!        │                                  │
       └──────────────────────────────────┴──────────────────────────────────┘
```

**Security Features:**
- Cryptographically secure 6-digit pairing codes
- Session tokens required for all operations
- Rate limiting (5 attempts/minute)
- PIN lockout after 3 failed attempts (15 min)
- Timing-safe PIN verification
- 5-minute pairing window, 24-hour session after bind

**QR Payload Format:**
```
atlas://pair?s={sessionId}&c={pairingCode}&t={token}
```

**Example: Start Roku Session**
```typescript
const response = await fetch('/api/atlas/roku/session/start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ device: 'roku', model: 'Ultra' })
});

const { sessionId, pairingCode, token, pairUrl } = await response.json();
// Display pairingCode on TV: "123456"
// Or show QR code from /session/{sessionId}/qr.png?token={token}
```

---

### Alexa Integration

Voice-first Atlas access with wallet-linked personalization.

**Endpoints:** `server/atlas/routes/alexa.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/atlas/alexa` | POST | Process voice utterance |
| `/api/atlas/alexa/health` | GET | Service health check |
| `/api/atlas/alexa/metrics` | GET | Usage analytics |
| `/api/atlas/alexa/sessions` | GET | Active sessions |
| `/api/atlas/alexa/disconnect` | POST | End session |

**Supported Intents:**
- `greeting` - "Hey Atlas", "Hello"
- `weather` - Weather queries (Open-Meteo API)
- `crypto` - Bitcoin/Ethereum prices (CoinGecko)
- `help` - Available commands
- `mode_switch` - "Switch to canvas/chat mode"
- `goodbye` - End session

**Request/Response Format:**

```typescript
// Request
interface AlexaRequest {
  wallet?: string;
  utterance: string;
  sessionId?: string;
  locale?: string;
  deviceId?: string;
  previousPlatform?: string;  // For platform handoff tracking
  isNativeInstall?: boolean;
}

// Response
interface AlexaResponse {
  ok: boolean;
  speech: string;           // TTS output
  displayText?: string;     // Screen display
  visualMode: 'canvas' | 'chat';
  theme: string;
  sessionId: string;
  shouldEndSession: boolean;
  card?: { title: string; content: string; image?: string };
  analytics?: { intentMatched: string; responseTimeMs: number };
}
```

**Example: Voice Command**
```typescript
const response = await fetch('/api/atlas/alexa', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: '0x1234...',
    utterance: "What's the weather?",
    sessionId: 'alexa-session-123'
  })
});

const { speech, displayText } = await response.json();
// speech: "The current temperature in New York is 45°F."
```

---

## Universal Device Handshake

Any device with a browser or HTTP client can connect to Atlas using the session handshake protocol.

**Endpoint:** `server/protocol/session/handshake.ts`

### Device Capabilities

```typescript
interface DeviceCapabilities {
  // Streaming formats
  hls: boolean;      // HLS video support
  dash: boolean;     // DASH video support
  
  // Document formats
  epub: boolean;     // Ebook support
  pdf: boolean;      // PDF support
  iframe: boolean;   // Embedded content
  
  // Real-time
  webrtc?: boolean;  // Voice/video calls
  
  // DRM support
  drm?: {
    widevine?: boolean;   // Android, Chrome
    fairplay?: boolean;   // Apple devices
    playready?: boolean;  // Windows, Xbox
  };
  
  // Codec support
  codecs?: {
    h264?: boolean;
    h265?: boolean;  // HEVC
    vp9?: boolean;
    av1?: boolean;
  };
  
  // Display info
  screen?: {
    width?: number;
    height?: number;
    dpr?: number;     // Device pixel ratio
  };
  
  // Encoding preference
  encoding?: {
    protobuf?: boolean;
    msgpack?: boolean;
    json?: boolean;
  };
}
```

### Handshake Flow

```typescript
// POST /v1/session/handshake
const response = await fetch('/v1/session/handshake', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    capabilities: {
      hls: true,
      dash: false,
      epub: true,
      pdf: true,
      iframe: true,
      webrtc: false,
      drm: { playready: true },
      codecs: { h264: true, h265: false },
      screen: { width: 1920, height: 1080, dpr: 1 }
    },
    wallet: '0x1234...'  // Optional
  })
});

const {
  sessionId,
  laneUrls,      // 8-lane transport URLs
  dictVersion,
  serverTime,
  ttlSeconds,
  protocol       // { version, compression, encoding, keepAliveMs }
} = await response.json();
```

---

## Roadmap: Conceptual Device Support

These devices don't have bespoke integrations yet but can be built using the universal handshake:

### Xbox / Windows

Use PlayReady DRM and the handshake protocol:

```typescript
const capabilities = {
  hls: true,
  dash: true,
  drm: { playready: true },
  codecs: { h264: true, h265: true },
  screen: { width: 3840, height: 2160 }
};
```

### Silk Browser (Fire TV/Tablet)

Standard web browser access - no special integration needed. Atlas works in any modern browser.

### Smart Picture Frames

Minimal capability set for photo display:

```typescript
const capabilities = {
  hls: false,
  dash: false,
  epub: false,
  pdf: false,
  iframe: true,  // Photo gallery embeds
  screen: { width: 1024, height: 768 }
};
```

### IoT Displays / Instant Screens

Build using the handshake + minimal rendering:

```typescript
const capabilities = {
  hls: false,
  dash: false,
  epub: false,
  pdf: false,
  iframe: false,
  screen: { width: 480, height: 320 },
  encoding: { json: true }  // Lightweight
};
```

---

## Session Bridge

Cross-device session continuity via `client/src/lib/sessionBridgeV2.ts`.

**Features:**
- WalletConnect-based device linking
- Session resume across devices
- Wallet-anchored preferences sync

**Usage:**
```typescript
import { createSessionBridge } from '@/lib/sessionBridgeV2';

const bridge = createSessionBridge({
  projectId: 'your-walletconnect-id',
  onSessionResume: (session) => {
    // Restore user state on new device
  }
});
```

---

## Building Custom Device Clients

### Pattern: Roku-Style Pairing

Use Roku as a template for any device that needs:
1. Display a code on screen
2. User authenticates on phone
3. Device receives wallet access

**Key files to copy/adapt:**
- `server/atlas/roku.ts` → `server/atlas/{device}.ts`
- Modify session storage, pairing code format, commands

### Pattern: Alexa-Style Voice

Use Alexa as a template for any voice interface:
1. Receive utterance
2. Match intent
3. Return speech + optional display

**Key files to copy/adapt:**
- `server/atlas/routes/alexa.ts` → `server/atlas/routes/{assistant}.ts`
- Expand intent matching, add device-specific responses

### Pattern: Browser-Based

For any device with a modern browser:
1. Load Atlas web UI
2. Connect wallet
3. Full functionality

No special integration needed - Atlas is a progressive web app.

---

## Security Considerations

### Pairing Security
- Time-limited pairing codes (5 minutes)
- Device tokens prevent session hijacking
- Rate limiting prevents brute force
- PIN lockout protects after failed attempts

### Session Security
- 24-hour session expiry after pairing
- Wallet signature required for sensitive operations
- Token rotation on sensitive endpoints

### Voice Security
- No PII in voice sessions
- Wallet binding requires explicit action
- Session isolation between devices

---

## API Reference

### Roku Endpoints

```bash
# Start session
curl -X POST /api/atlas/roku/session/start \
  -H "Content-Type: application/json" \
  -d '{"device":"roku","model":"Ultra"}'

# Check status
curl "/api/atlas/roku/session/{id}/status?token={token}"

# Get QR image
curl "/api/atlas/roku/session/{id}/qr.png?token={token}" > qr.png

# Pair via code
curl -X POST /api/atlas/roku/pair \
  -H "Content-Type: application/json" \
  -d '{"code":"123456","walletAddress":"0x...","token":"..."}'

# Set PIN
curl -X POST /api/atlas/roku/session/{id}/pin/set \
  -H "Content-Type: application/json" \
  -d '{"pin":"1234","walletAddress":"0x...","token":"..."}'
```

### Alexa Endpoints

```bash
# Process utterance
curl -X POST /api/atlas/alexa \
  -H "Content-Type: application/json" \
  -d '{"utterance":"What is the weather?","wallet":"0x..."}'

# Get metrics
curl /api/atlas/alexa/metrics
```

### Universal Handshake

```bash
# Create session
curl -X POST /v1/session/handshake \
  -H "Content-Type: application/json" \
  -d '{"capabilities":{"hls":true,"dash":false}}'
```

---

## File Reference

| File | Purpose |
|------|---------|
| `server/atlas/roku.ts` | Roku pairing API |
| `server/atlas/routes/alexa.ts` | Alexa voice interface |
| `server/protocol/session/handshake.ts` | Universal device handshake |
| `client/src/components/PinAuthDialog.tsx` | PIN unlock UI |
| `client/src/lib/sessionBridgeV2.ts` | Cross-device session bridge |
