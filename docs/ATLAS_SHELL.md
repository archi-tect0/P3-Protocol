# Atlas Shell Documentation

> **Multi-Mode Content Canvas with Intent Routing**

Atlas is P3's primary interface shell—a 30+ mode content canvas with natural language intent parsing, 8-lane transport, and AI-powered command routing.

---

## Architecture

```
client/src/
├── components/atlas/
│   ├── AtlasShell.tsx                 # Main shell container
│   ├── AtlasTiles.tsx                 # Mode registry & navigation
│   ├── AtlasHeader.tsx                # Top bar with search
│   ├── AtlasNav.tsx                   # Mode navigation
│   └── modes/                         # 30+ mode components
│       ├── AIChatMode.tsx             # AI assistant with intents
│       ├── ChatMode.tsx               # Intent-aware chat
│       ├── HubMode.tsx                # App launcher
│       ├── TVMode.tsx                 # Live TV streaming
│       ├── RadioMode.tsx              # Internet radio
│       ├── ReaderMode.tsx             # Ebook reader
│       ├── GameDeckMode.tsx           # Gaming hub
│       ├── PulseMode.tsx              # Analytics dashboard
│       ├── NodeMode.tsx               # Mesh node status
│       ├── SettingsMode.tsx           # Configuration
│       └── ... (20+ more modes)
├── state/
│   └── useAtlasStore.ts               # Global Atlas state (Zustand)
└── lib/
    └── atlasIntents.ts                # Intent definitions

server/atlas/
├── index.ts                           # Atlas API router
├── routes.ts                          # Mode-specific endpoints
├── streaming.ts                       # 8-lane transport
├── config.ts                          # Configuration
└── services/
    ├── intentSemantic.ts              # Natural language → intent
    ├── semanticGenerator.ts           # Auto-generate intent patterns
    ├── agentMesh.ts                   # Multi-agent routing
    ├── connectorService.ts            # External API connectors
    └── registryAdapter.ts             # App registry with intents
```

---

## Canvas Modes

### Media & Entertainment
| Mode | File | Description |
|------|------|-------------|
| TV | `TVMode.tsx` | 5000+ live channels (IPTV) |
| Radio | `RadioMode.tsx` | Internet radio streams |
| Reader | `ReaderMode.tsx` | Ebook reader (EPUB) |
| Game Deck | `GameDeckMode.tsx` | Free-to-play games |
| News | `NewsMode.tsx` | Live news feeds |
| Gallery | `GalleryMode.tsx` | Encrypted image gallery |

### Communication
| Mode | File | Description |
|------|------|-------------|
| Messages | `MessagesMode.tsx` | E2E encrypted messaging |
| Inbox | `InboxMode.tsx` | Message list |
| Calls | `CallsMode.tsx` | Voice/video calls |
| AI Chat | `AIChatMode.tsx` | AI assistant |
| Chat | `ChatMode.tsx` | Intent-aware chat |

### Productivity
| Mode | File | Description |
|------|------|-------------|
| Hub | `HubMode.tsx` | App launcher |
| Calc | `CalcMode.tsx` | Calculator |
| Clipboard | `ClipboardMode.tsx` | Clipboard manager |
| Camera | `CameraMode.tsx` | Photo/video capture |
| File Hub | `FileHubMode.tsx` | File manager |
| Task Manager | `TaskManagerMode.tsx` | Encrypted workflows |

### System
| Mode | File | Description |
|------|------|-------------|
| Node | `NodeMode.tsx` | Mesh node status |
| Pulse | `PulseMode.tsx` | Analytics dashboard |
| Settings | `SettingsMode.tsx` | Configuration |
| Identity | `IdentityMode.tsx` | Wallet identity |
| Directory | `DirectoryMode.tsx` | Contact directory |

---

## Intent System

Atlas uses a 3-tier intent matching system to route natural language queries to capabilities.

### Tier 1: Regex Patterns (intentSemantic.ts)

```typescript
// Direct pattern matching
const patterns = {
  'check_weather': /weather|forecast|temperature/i,
  'send_message': /send|message|dm|text/i,
  'play_music': /play|music|song|spotify/i,
};
```

### Tier 2: Keyword Mapping (registryAdapter.ts)

```typescript
// App-specific intents
{
  id: 'messages-inbox',
  endpoint: '/api/nexus/messages',
  intents: ['messages_inbox', 'check_messages'],
  semantics: { keywords: ['inbox', 'messages', 'unread'] }
}
```

### Tier 3: Semantic Fallback (agentMesh.ts)

```typescript
// LLM-powered intent parsing
export function parseAgentIntent(query: string): IntentMatch | null {
  // Uses OpenAI/Anthropic/Gemini to understand intent
  // Routes to appropriate agent or capability
}
```

### Intent Flow

```
User Query → Regex Match → Keyword Match → Semantic LLM → Route to Capability
     ↓            ↓             ↓               ↓
   "weather"    match!      no match       LLM parse     Execute
```

---

## Agent Mesh (agentMesh.ts)

Multi-agent system for complex queries:

| Agent | Provider | Capabilities |
|-------|----------|--------------|
| `claude` | Anthropic | Analysis, reasoning |
| `gpt` | OpenAI | General purpose |
| `gemini` | Google | Multi-modal |
| `weather` | Open-Meteo | Weather data |
| `web3` | Internal | Blockchain queries |

```typescript
interface IntentMatch {
  provider: AgentProvider;
  action: string;
  confidence: number;
  parameters?: Record<string, unknown>;
}
```

---

## 8-Lane Transport (streaming.ts)

Atlas Transport prevents bulk data from blocking critical signals:

| Lane | Purpose | Priority |
|------|---------|----------|
| 0 | System/Heartbeat | Highest |
| 1 | Auth/Security | Critical |
| 2 | Real-time Messages | High |
| 3 | Voice/Video Signaling | High |
| 4 | API Responses | Medium |
| 5 | Content Metadata | Medium |
| 6 | Media Streaming | Low |
| 7 | Bulk Downloads | Lowest |

---

## White-Label Use Cases

### 1. Minimal Dashboard

```
AI Prompt:
"Create a minimal version of Atlas:

1. In client/src/components/atlas/AtlasTiles.tsx:
   - Keep only: HubMode, MessagesMode, SettingsMode
   - Remove all media modes

2. In client/src/components/atlas/AtlasShell.tsx:
   - Replace tile grid with horizontal tab bar
   - Simplify header to just logo + settings

3. In client/src/index.css:
   - Minimal color palette (black, white, one accent)
   - Remove glassmorphism effects
   - Clean typography"
```

### 2. Healthcare Portal

```
AI Prompt:
"Rebrand Atlas for healthcare:

1. In client/src/components/atlas/AtlasTiles.tsx:
   - Rename to 'MedHub'
   - Add modes: PatientPortal, Telehealth, Records, Scheduling
   - Remove: TVMode, RadioMode, GameDeckMode, ReaderMode

2. In server/atlas/streaming.ts:
   - Configure Lane 4 for medical telemetry
   - Add HIPAA compliance headers
   - Mandatory encryption for all lanes

3. Create healthcare-specific intents:
   - 'schedule_appointment'
   - 'view_records'
   - 'start_telehealth'
   - 'refill_prescription'"
```

### 3. Trading Terminal

```
AI Prompt:
"Configure Atlas as a trading terminal:

1. Create client/src/components/atlas/modes/TradingMode.tsx:
   - Real-time price charts
   - Order book visualization
   - Position management
   - Alert configuration

2. In server/atlas/streaming.ts:
   - Dedicate Lane 2 for market data (sub-100ms latency)
   - Lane 4 for order execution
   - Lane 6 for historical data

3. Add trading intents:
   - 'buy {amount} {symbol}'
   - 'sell {amount} {symbol}'
   - 'set alert {symbol} {price}'
   - 'show portfolio'"
```

### 4. Gaming Platform

```
AI Prompt:
"Build a gaming platform on Atlas:

1. In client/src/components/atlas/modes/GameDeckMode.tsx:
   - Add multiplayer lobby system
   - Integrate leaderboards
   - Add achievement system with blockchain anchoring

2. In server/atlas/streaming.ts:
   - Configure Lane 2 for game state (60 updates/sec)
   - Lane 3 for voice chat
   - Lane 6 for asset streaming

3. Create gaming intents:
   - 'find match {game}'
   - 'invite {friend} to {game}'
   - 'show leaderboard {game}'
   - 'claim achievement {name}'"
```

---

## Customization Points

### Add New Mode

**Step 1:** Create mode component

```typescript
// client/src/components/atlas/modes/MyMode.tsx
export function MyMode() {
  return (
    <div className="p-4">
      <h1>My Custom Mode</h1>
    </div>
  );
}
```

**Step 2:** Register in store

```typescript
// client/src/state/useAtlasStore.ts
export type AtlasMode = 
  | 'hub' | 'messages' | 'calls' 
  | 'mymode'  // Add your mode
  | ...;
```

**Step 3:** Add to navigation

```typescript
// client/src/components/atlas/AtlasTiles.tsx
const MODES = [
  { id: 'mymode', name: 'My Mode', icon: Star, category: 'tools' },
  // ...
];
```

### Add Intent Pattern

**File:** `server/atlas/services/registryAdapter.ts`

```typescript
{
  id: 'my-capability',
  endpoint: '/api/my-endpoint',
  method: 'GET',
  intents: ['my_intent', 'do_my_thing'],
  semantics: {
    keywords: ['my', 'thing', 'action'],
    description: 'Performs my custom action',
  }
}
```

### Configure Transport Lane

**File:** `server/atlas/streaming.ts`

```typescript
// Assign custom data to specific lane
function getLaneForDataType(type: string): number {
  switch (type) {
    case 'medical_telemetry': return 4;
    case 'trading_data': return 2;
    default: return 5;
  }
}
```

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/atlas/modes` | List available modes |
| `/api/atlas/intent` | Parse natural language intent |
| `/api/atlas/execute` | Execute capability |
| `/api/atlas/stream` | SSE event stream |
| `/api/atlas/pulse` | Analytics data |
| `/api/atlas/config` | Canvas configuration |

---

## Related Documentation

- [AI Development Guide](./AI_DEVELOPMENT_GUIDE.md)
- [Atlas Transport](./ATLAS_TRANSPORT.md)
- [Integration Guide](./INTEGRATION_GUIDE.md)
- [Hub Shell](./HUB_SHELL.md)
- [Nexus Shell](./NEXUS_SHELL.md)
