# AI Development Guide for P3 Protocol

> **Use AI to build on P3 in minutes, not months.**

P3 Protocol is architected for the AI-assisted development era. This guide shows you how to leverage Cursor, Copilot, Claude, or any AI assistant to customize, extend, and deploy P3 for your specific use case.

---

## Table of Contents

1. [Orientation & Setup](#orientation--setup)
2. [Code Manipulation Patterns](#code-manipulation-patterns)
3. [Mesh Network Alterations](#mesh-network-alterations)
   - [Global Relay Network](#global-relay-network)
4. [Atlas Transport Lane Customization](#atlas-transport-lane-customization)
5. [Node Configuration by App Type](#node-configuration-by-app-type)
6. [The Three Shells](#the-three-shells)
7. [Device Extension Prompts](#device-extension-prompts)
8. [Atlas Mashup Gallery](#atlas-mashup-gallery)
9. [Forward-Looking Blueprints](#forward-looking-blueprints)
   - [Global AI Mesh Futures](#global-ai-mesh-futures)
10. [AI Prompt Recipe Book](#ai-prompt-recipe-book)

---

## Orientation & Setup

### Repository Map

Before prompting your AI, give it context. Paste this structure:

```
P3-Protocol/
├── client/                    # React frontend
│   └── src/
│       ├── components/atlas/  # Canvas modes (30+ UI modes)
│       ├── lib/               # Crypto, WebSocket, mesh client
│       └── pages/             # Route pages
├── server/                    # Express backend
│   ├── atlas/                 # Transport, streaming, routing
│   ├── services/              # Business logic (receipts, IPFS, etc.)
│   └── routes.ts              # API endpoints
├── packages/
│   ├── sdk/                   # Extractable SDK package
│   └── zk/                    # Zero-knowledge circuits
├── rust/pqcrypto/             # Post-quantum cryptography
├── shared/schema.ts           # Database schema & types
└── docs/                      # Technical documentation
```

### AI Workflow Tips

1. **Start with `tree -L 3`** - Paste the output to orient your AI
2. **Reference specific files** - Always include file paths in prompts
3. **Use existing docs** - Point AI to `docs/INTEGRATION_GUIDE.md` for patterns
4. **Iterative refinement** - Start broad, then narrow focus

### Install Paths

| Method | Command | Use Case |
|--------|---------|----------|
| Full Stack | `git clone && npm install && npm run dev` | New projects |
| SDK Only | `npm install @p3/protocol` | Add to existing app |
| Module Extraction | Copy individual files | Cherry-pick features |

---

## Code Manipulation Patterns

### Key Abstractions

P3 is built around these core abstractions that AI can easily understand and modify:

| Abstraction | Location | Purpose |
|-------------|----------|---------|
| Session Bridge | `server/services/sessionBridge.ts` | Wallet-to-browser authentication |
| Mesh Client | `client/src/lib/meshClient.ts` | P2P node connectivity |
| Crypto Layer | `client/src/lib/crypto.ts` | E2E encryption (X25519, XSalsa20) |
| Storage Adapter | `server/storage.ts` | Database abstraction |
| Receipt Anchor | `server/services/receipts.ts` | Blockchain audit trails |

### Manipulation Prompts

**Add a new authentication method:**
```
In server/services/sessionBridge.ts, add Passkey/WebAuthn authentication 
as a fallback when wallet connection fails. Preserve existing SIWE flow.
```

**Swap the database layer:**
```
Replace PostgreSQL in server/storage.ts with MongoDB. Update the IStorage 
interface and all repository methods. Reference shared/schema.ts for types.
```

**Add custom middleware:**
```
In server/routes.ts, add rate limiting middleware that uses wallet address 
as the key. Allow 100 requests/minute for authenticated users, 10 for anonymous.
```

---

## Mesh Network Alterations

### Mesh Architecture

The mesh network creates a self-healing P2P topology where browsers become nodes.

| Component | File | Controls |
|-----------|------|----------|
| Mesh Config | `server/atlas/config.ts` | Node limits, timeouts, protocols |
| Peer Discovery | `client/src/lib/meshClient.ts` | How nodes find each other |
| Data Routing | `server/atlas/streaming.ts` | Content delivery paths |
| WebRTC Signaling | `server/services/webrtc.ts` | Peer connection setup |

### Topology Modifications

**Change peer discovery strategy:**
```
In client/src/lib/meshClient.ts, modify the peer discovery algorithm from 
random sampling to geographic proximity. Add latency-based peer scoring.
```

**Adjust mesh density:**
```
In server/atlas/config.ts, change MAX_PEERS from 8 to 16 for higher 
redundancy. Add adaptive scaling based on content popularity.
```

**Add mesh analytics:**
```
Create a new service in server/services/meshTelemetry.ts that tracks:
- Peer connection success rates
- Average hop count for content delivery
- Geographic distribution of nodes
Expose this via /api/mesh/stats endpoint.
```

### Global Relay Network

The Global Relay Network enables cross-app mesh connectivity. If 1000 different apps adopt P3 Protocol, their nodes can discover and relay through each other using foundation lanes.

| Component | File | Purpose |
|-----------|------|---------|
| Global Registry | `server/mesh/globalRelay.ts` | Node registration, peer discovery |
| Mesh Client | `client/src/lib/meshClient.ts` | `registerGlobalNode()`, `discoverGlobalPeers()` |
| UI Toggle | Settings → Node Mode → Global Relay | User control |

**Foundation Lanes (Universal):**

| Lane | Purpose | Cross-App Relay |
|------|---------|-----------------|
| 0 | Handshake | ✅ Yes |
| 1 | Identity | ✅ Yes |
| 2 | Keepalive | ✅ Yes |
| 3 | Telemetry | ✅ Yes |
| 4+ | Custom (app-specific) | ❌ No (security isolation) |

**Enable global relay via AI prompt:**
```
In client/src/pages/atlas/SettingsTab.tsx, the Global Relay toggle 
uses WalletConnect to sign the canonical message:
  p3-global-relay:{nodeId}:{wallet}:{timestamp}

The backend in server/mesh/globalRelay.ts verifies using ethers.verifyMessage()
to ensure nodes prove wallet ownership before joining the global network.
```

**AI-powered peer discovery:**
```
Extend server/mesh/globalRelay.ts to add intelligent peer selection:
1. Score peers by latency, uptime, and relay success rate
2. Use embeddings on node capabilities for semantic matching
3. Prefer geographically proximate nodes for lower latency
4. Implement load balancing across available relays
```

**Atlas automation for global relay:**
```
Add Atlas intent handlers for global relay operations:
- "Join the global network" → enable global relay toggle
- "Show global network status" → fetch /api/mesh/global/stats
- "Find peers with video capability" → filter discoverGlobalPeers()
- "Relay keepalive to all governance nodes" → targeted lane-2 broadcast
```

**Reference:** [MESH_NETWORK.md](./MESH_NETWORK.md) for full technical details, [API.md](./API.md) for endpoint reference.

---

## Atlas Transport Lane Customization

### The 8-Lane System

Atlas Transport uses prioritized lanes to prevent bulk data from blocking critical signals:

| Lane | Default Purpose | Priority | Files |
|------|-----------------|----------|-------|
| Lane 0 | System/Heartbeat | Highest | `server/atlas/streaming.ts` |
| Lane 1 | Authentication/Security | Critical | `server/atlas/routes.ts` |
| Lane 2 | Real-time Messaging | High | `server/atlas/streaming.ts` |
| Lane 3 | Voice/Video Signaling | High | `server/services/webrtc.ts` |
| Lane 4 | API Responses | Medium | `server/atlas/routes.ts` |
| Lane 5 | Content Metadata | Medium | `server/atlas/streaming.ts` |
| Lane 6 | Media Streaming | Low | `server/atlas/streaming.ts` |
| Lane 7 | Bulk Downloads | Lowest | `server/atlas/streaming.ts` |

### Lane Customization Prompts

**Repurpose for medical telemetry:**
```
In server/atlas/streaming.ts, rename Lane 4 to 'MedicalTelemetry' with:
- Priority weight: 95 (just below security)
- Rate limit: 1000 messages/second
- Encryption: mandatory AES-256-GCM
- Audit logging: every message
Add HIPAA compliance headers to all Lane 4 responses.
```

**Gaming optimization:**
```
In server/atlas/streaming.ts, configure lanes for real-time gaming:
- Lane 2: Player positions (60 updates/second, <16ms latency target)
- Lane 3: Game state sync (authoritative server updates)
- Lane 4: Voice chat (WebRTC, adaptive bitrate)
- Lane 6: Asset streaming (textures, models)
Add client-side prediction and server reconciliation.
```

**Financial data streams:**
```
In server/atlas/streaming.ts, create a 'FinancialData' lane with:
- Exactly-once delivery guarantee
- Cryptographic message ordering
- Audit trail for every transaction
- Automatic failover to backup lanes
Reference docs/CROSS_CHAIN_RECEIPTS.md for settlement patterns.
```

---

## Node Configuration by App Type

### Content Delivery Network

Turn P3 into a decentralized CDN:

```
Configure P3 as a content delivery mesh:

1. In server/atlas/config.ts:
   - Set CACHE_TTL to 24 hours for static content
   - Enable aggressive edge caching
   - Add geographic routing hints

2. In client/src/lib/meshClient.ts:
   - Implement content-addressed caching (IPFS-style)
   - Add bandwidth contribution tracking
   - Reward nodes that serve more content

3. Create server/services/cdnMetrics.ts:
   - Track cache hit ratios
   - Monitor bandwidth usage per node
   - Implement popularity-based replication
```

### Enterprise Messaging

Configure for secure corporate communications:

```
Set up P3 for enterprise messaging:

1. In server/services/sessionBridge.ts:
   - Add SAML/SSO integration
   - Implement organization-level encryption keys
   - Add compliance audit logging

2. In server/atlas/config.ts:
   - Disable public mesh (private network only)
   - Set message retention policies
   - Add DLP (Data Loss Prevention) hooks

3. Create server/services/compliance.ts:
   - Message archiving for legal hold
   - Keyword scanning (optional)
   - Export for e-discovery
```

### IoT Network

Configure for device mesh:

```
Adapt P3 for IoT device networks:

1. In server/atlas/streaming.ts:
   - Add MQTT bridge for legacy devices
   - Implement CoAP protocol support
   - Optimize for low-bandwidth connections

2. In server/atlas/config.ts:
   - Set MAX_PEERS to 1000+ for device density
   - Enable lightweight heartbeats (every 30s)
   - Add device registration workflow

3. Create server/services/deviceRegistry.ts:
   - Device provisioning with certificates
   - Firmware update distribution via mesh
   - Telemetry aggregation and alerting
```

### Gaming Infrastructure

Configure for real-time multiplayer:

```
Build multiplayer game infrastructure on P3:

1. In server/atlas/streaming.ts:
   - Implement game room management
   - Add authoritative server state sync
   - Enable client-side prediction helpers

2. In client/src/lib/meshClient.ts:
   - Add WebRTC data channels for P2P game data
   - Implement lag compensation
   - Add spectator mode (one-way mesh)

3. Create server/services/matchmaking.ts:
   - Skill-based matchmaking
   - Geographic proximity matching
   - Anti-cheat hooks
```

---

## The Three Shells

P3 Protocol provides three white-label application shells, each serving different purposes:

| Shell | Purpose | Documentation |
|-------|---------|---------------|
| **Atlas** | Multi-mode content canvas with 30+ modes, intent routing, and 8-lane transport | [ATLAS_SHELL.md](./ATLAS_SHELL.md) |
| **Hub** | Wallet-anchored app launcher with 50+ apps, customizable dock, and password protection | [HUB_SHELL.md](./HUB_SHELL.md) |
| **Nexus** | E2E encrypted messaging with voice/video calls and real-time presence | [NEXUS_SHELL.md](./NEXUS_SHELL.md) |

### Atlas Canvas

30+ modes organized by category: Media (TV, Radio, Reader, Games), Communication (Messages, Calls, AI Chat), Productivity (Hub, Calc, Camera), and System (Node, Pulse, Settings).

**Key features:**
- Natural language intent routing (3-tier: regex → keywords → semantic LLM)
- 8-lane transport preventing bulk data from blocking critical signals
- Multi-agent mesh (Claude, GPT, Gemini, Weather, Web3)

See [ATLAS_SHELL.md](./ATLAS_SHELL.md) for customization prompts.

### P3 Hub

Mobile-first app launcher with categories: Communication, Security, Payments, Media, Commerce, Governance, Tools, System.

**Key features:**
- 5-slot customizable dock with long-press settings
- Password protection with SHA-256 hashing
- Background theming (gradient, image, IPFS)
- Voice search integration
- 85+ external apps (Gmail, Slack, Notion, Figma, etc.)

See [HUB_SHELL.md](./HUB_SHELL.md) for customization prompts.

### Nexus Messaging

Zero-PII encrypted communications anchored to wallet identity.

**Key features:**
- E2E encryption (X25519 + XSalsa20-Poly1305)
- WebRTC voice/video calls
- Real-time presence
- Cross-device session resume via Session Bridge

See [NEXUS_SHELL.md](./NEXUS_SHELL.md) for customization prompts.

### Quick Shell Selection

| Use Case | Shell | Why |
|----------|-------|-----|
| Content platform | Atlas | Media modes, intent routing |
| Corporate intranet | Hub | App organization, SSO-ready |
| Secure communications | Nexus | E2E encryption, zero PII |
| Healthcare portal | Atlas + Nexus | Telehealth + messaging |
| Trading terminal | Atlas | Real-time data, custom lanes |
| IoT dashboard | Hub | Device tiles, status monitoring |
| Smart TV | Roku API | QR pairing, wallet binding |
| Voice assistant | Alexa API | Voice-first access |
| Picture frame | Handshake | Minimal capability client |

### Device Extensions

P3 includes production-ready integrations for accessing Atlas from external devices:

| Integration | Status | Documentation |
|-------------|--------|---------------|
| **Roku** | Production-ready | QR pairing, PIN unlock, TV commands |
| **Alexa** | Production-ready | Voice interface, session tracking |
| **Universal Handshake** | Production-ready | Any device with HTTP client |
| Xbox, Silk, Picture Frames | Buildable | Use handshake as foundation |

See [DEVICE_EXTENSIONS.md](./DEVICE_EXTENSIONS.md) for complete API reference.

---

## Device Extension Prompts

### Build a Mesh Photo Frame

Use the Roku pairing pattern for a dedicated photo display:

```
Build a mesh-connected photo frame using P3's pairing system:

1. Create server/atlas/photoframe.ts (copy from roku.ts):
   - Simplify to 4-digit pairing codes
   - Add photo-specific commands: next, previous, slideshow
   - Store album preferences per paired wallet

2. Create client endpoint for frame:
   - Minimal capability set: { iframe: true, hls: false }
   - Poll for new photos from user's gallery
   - Display QR for initial pairing

3. Use Atlas GalleryMode.tsx as photo source:
   - Sync wallet's photo library to frame
   - Support shared family albums

AI Prompt:
"Using server/atlas/roku.ts as a template, create server/atlas/photoframe.ts 
for a minimal photo frame device. Use 4-digit codes, add slideshow commands, 
and sync photos from the user's GalleryMode library. The frame should poll 
/api/atlas/photoframe/session/:id/photos to get the current album."
```

### Build an Alexa Skill for Atlas

Expand voice capabilities:

```
Extend Alexa integration with custom skills:

1. In server/atlas/routes/alexa.ts:
   - Add intent for "open my messages"
   - Add intent for "play music on {device}"
   - Add intent for "check my payments"

2. Create Alexa skill manifest:
   - Define invocation: "Atlas"
   - Map intents to P3 capabilities
   - Configure account linking with wallet

3. Add cross-platform handoff:
   - "Continue on my phone" → trigger push notification
   - "Show on TV" → use Roku pairing session

AI Prompt:
"Extend server/atlas/routes/alexa.ts to add these intents: 
'open inbox' (reads unread message count), 'check balance' (reads wallet 
token balances from TokensMode), 'play on roku' (triggers Roku session). 
Include proper error handling and wallet authentication."
```

### Xbox/Windows App

Build using PlayReady DRM:

```
Create Xbox-compatible Atlas client:

1. Use universal handshake with Xbox capabilities:
   - drm: { playready: true }
   - codecs: { h264: true, h265: true }
   - screen: { width: 3840, height: 2160 }

2. Implement controller navigation:
   - D-pad for tile selection
   - A button for select, B for back
   - Menu button for settings

3. Focus on media modes:
   - TVMode for live streaming
   - GameDeckMode for game library
   - AtlasOneMode for content browsing

AI Prompt:
"Create a handshake request in /v1/session/handshake for an Xbox client 
with PlayReady DRM, H.265 codec support, and 4K resolution. Design a 
controller-friendly navigation scheme for AtlasTiles.tsx that works 
with gamepad input events."
```

### Smart Display / IoT Dashboard

Minimal client for always-on displays:

```
Build IoT dashboard display:

1. Create server/atlas/iot-display.ts:
   - Copy pairing flow from roku.ts
   - Add display-specific endpoints:
     - /widgets - Get configured widgets
     - /refresh - Force data refresh
   - Support multiple widget types

2. Widget types:
   - Weather (from WeatherMode)
   - Crypto prices (from TokensMode)
   - Notifications (from InboxMode)
   - Calendar (new widget)

3. Minimal capability handshake:
   - { iframe: true, screen: { width: 800, height: 480 } }
   - JSON-only encoding for simplicity

AI Prompt:
"Create server/atlas/iot-display.ts with pairing like roku.ts but 
optimized for small IoT displays. Add /widgets endpoint that returns 
configured widget data (weather, crypto, notifications) based on 
the paired wallet's preferences. Use a 30-second polling interval."
```

### Voice-Controlled Mesh App

Build a custom voice assistant:

```
Create voice-controlled Atlas interface:

1. Copy server/atlas/routes/alexa.ts → voice.ts
   - Replace Alexa-specific logic with generic voice processing
   - Add support for wake word detection
   - Integrate with local speech-to-text

2. Add Atlas-specific intents:
   - "Navigate to {mode}" → switch Atlas modes
   - "Send message to {contact}" → InboxMode compose
   - "Show {query} on screen" → search and display

3. Text-to-speech responses:
   - Integrate with Google TTS (already in package.json)
   - Cache common responses
   - Stream long responses

AI Prompt:
"Create server/atlas/routes/voice.ts as a generic voice interface 
for Atlas. Use the intent matching from alexa.ts but add support 
for Atlas mode navigation ('open TV mode', 'show my messages'). 
Return SSML-formatted speech responses for TTS processing."
```

---

## Atlas Mashup Gallery

Remixing Atlas into new concepts is not only possible but is the exact scenario the Atlas Canvas Stack and API v2 were built for. Because the repo uses a **Substrate Architecture**, an AI can help you "prompt" new versions into existence by generating new External App Manifests and Site Profiles.

### How AI Remixing Works

| Action | What AI Generates |
|--------|-------------------|
| "Generate an ExternalAppManifest for X" | JSON that tells Atlas shell which lanes to listen to |
| "Remix AtlasCanvas.tsx to prioritize modes Y and Z" | Modified `useAtlasStore.ts` logic to lock UI into specific modes |
| "Create a 2G-optimized Site Profile" | Configured `dictionary.ts` and `priority.ts` for low-bandwidth |

---

### Game Creation & NFT Assets

**Problem:** Interactive gaming with verifiable asset ownership.

**Components:**
- **Game Deck** (`server/atlas/gamedeck`) for game logic
- **ReceiptBoundToken.sol** for NFT assets only usable with valid anchored receipts
- **8-Lane Streaming** - video on Lane 6, game state on Lane 3 with minimal lag

**AI Prompt:**
```
"Create an ExternalAppManifest for an interactive play-along game stream 
that uses Lane 6 for video and Lane 3 for real-time player position updates. 
Bind all in-game items to ReceiptBoundToken verification."
```

---

### Decentralized Video Platform

**Problem:** Video access in regions where centralized platforms are blocked or slow.

**Components:**
- **Mesh Client** (`client/src/lib/meshClient.ts`) for P2P relay
- **Feed Mode** via `getRenderPayload` for trending content
- **Node caching** - users receive video fragments from nearby nodes

**AI Prompt:**
```
"Configure Atlas as a localized content mesh where nodes cache and relay 
video chunks to neighbors. Optimize for 2G regions by maximizing 
compression in dictionary.ts and enabling aggressive mesh caching."
```

---

### Journalist "Verified Source" Portal

**Problem:** Secure document drops with cryptographic proof of receipt timing.

**Components:**
- **Writer Mode** for content creation
- **Nexus encryption** (TweetNaCl) for post-quantum secure interviews
- **ZK-Receipts** proving document received at specific time without server seeing content

**AI Prompt:**
```
"Remix AtlasCanvas to prioritize Writer and Nexus modes for a journalist 
profile. Add a 'Confidential Drop-box' that auto-generates ZK-Receipts 
for uploaded documents with timestamp proofs."
```

---

### Election Watching Interface

**Problem:** Real-time, publicly verifiable election results.

**Components:**
- **Pulse Mode** for live analytics
- **Governance Mode** (replace DAO Proposals with Election Precincts)
- **Lane 3** for real-time vote count pushes
- **AnchorRegistry.sol** for immutable, public result verification

**AI Prompt:**
```
"Generate an ExternalAppManifest for an Election Watcher app. Replace 
Governance proposals with precinct data, push vote counts via Lane 3, 
and auto-anchor results to blockchain using AnchorRegistry."
```

---

### Gig Economy Instant Payments

**Problem:** Workers need instant payment upon verified task completion.

**Components:**
- **Nexus Payments** for social/chat payments (Venmo for Web3)
- **Atlas Payment Canvas** for merchant POS/invoicing
- **Receipt anchoring** triggers instant payout

**AI Prompt:**
```
"Create a gig-economy app manifest where workers receive instant payment 
upon the anchoring of a task-completion receipt. Use Nexus for social 
payments and Atlas Canvas for merchant-side QR generation."
```

---

### Disaster Response Nerve Center

**Problem:** Offline-capable emergency coordination across agencies.

**Components:**
- **NodeMode** + **PulseMode** for network status
- **CCTVMode** + **WeatherMode** for situational awareness
- **Lanes 0-3** prioritized for emergency telemetry
- **Offline mesh fallback** when connectivity fails

**AI Prompt:**
```
"Generate an ExternalAppManifest 'disaster-nerve-center' binding NodeMode, 
PulseMode, CCTVMode, WeatherMode. Route emergency events over lanes 0-3 
with offline cache fallback enabled."
```

---

### Smart City Operations Grid

**Problem:** Orchestrating multi-agency IoT data and control systems.

**Components:**
- **NodeStreamMode** for device telemetry
- **GovernanceMode** for inter-agency coordination
- **PaymentsMode** for utility billing
- **Lane 3** for telemetry, **Lane 4** for actuator commands

**AI Prompt:**
```
"Remix AtlasCanvas to register 'smart-city' profile prioritizing 
NodeStream, Governance, Payments, Registry modes. Throttle lane-4 
actuator commands via streaming.ts policy hook."
```

---

### Creator Cooperative Studio

**Problem:** Co-authoring media with instant monetization and fair splits.

**Components:**
- **WriterMode** + **GameDeckMode** + **GalleryMode**
- **Marketplace receipts** for revenue tracking
- **Mesh session handoff** on Lanes 2 and 6 for collaboration

**AI Prompt:**
```
"Create a SiteProfile 'creator-coop' locking Writer, GameDeck, Gallery 
modes and auto-spawning receipt-bound drops via gamedeck workflows. 
Enable mesh session handoff for live co-authoring."
```

---

### Biofabrication Lab Twin

**Problem:** Synchronizing lab instrumentation with compliance proofs.

**Components:**
- **CalcMode** + **SandboxMode** for data analysis
- **CameraMode** for microscopy capture
- **Lane 3** for health telemetry
- **ZKReceiptsVerifier** for experiment anchoring

**AI Prompt:**
```
"Assemble an ExternalAppManifest 'biofab-lab-twin' that streams 
instrumentation metrics over lane-3, captures microscopy via CameraMode, 
and anchors every experiment result with ZK receipts."
```

---

### DAO Governance War Room

**Problem:** Live vote orchestration with real-time dispute mediation.

**Components:**
- **GovernanceMode** + **CallsMode** for deliberation
- **WriterMode** for proposal drafting
- **ReceiptsMode** for vote attestations
- **Foundation lanes 0-3** for identity proofs in voting

**AI Prompt:**
```
"Refit AtlasShell for 'dao-war-room' by pinning Governance, Calls, Writer, 
Receipts modes and wiring lane-1 identity proofs into vote casting."
```

---

### Immersive Field School

**Problem:** Hybrid AR field instruction across varying bandwidth conditions.

**Components:**
- **TVMode** + **RadioMode** for content delivery
- **NotesMode** + **PresenceTile** for collaboration
- **Mesh session bridge** + **Device extensions** for AR handoffs
- **Low-bandwidth manifests** via `abr.ts`

**AI Prompt:**
```
"Create a 'field-school' profile that syncs TV, Radio, Notes, Presence 
modes and generates low-bandwidth manifests in client/src/lib/media/abr.ts 
for 2G/3G field conditions."
```

---

### Carbon Market Exchange

**Problem:** Auditable carbon credit settlement with live environmental telemetry.

**Components:**
- **WeatherMode** for satellite/sensor data
- **TokensMode** + **AnalyticsTile** for trading
- **ReceiptsMode** + **AnchorRegistry** for settlement
- **Lane 4** for trade execution

**AI Prompt:**
```
"Build 'carbon-exchange' manifest linking Weather, Tokens, Analytics, 
Receipts modes and auto-anchoring trades via server/services/receipts.ts. 
Ingest satellite data on lane-3."
```

---

### Retail Pop-up Atlas

**Problem:** Temporary POS networks with adaptive traffic management.

**Components:**
- **PaymentsMode** for transactions
- **DirectoryMode** for inventory
- **CameraMode** for security
- **Lane QoS throttling** for POS vs marketing

**AI Prompt:**
```
"Spin up 'retail-popup' canvas defaulting to Payments, Directory, Camera, 
Notifications modes. Adjust lane priorities in streaming.ts for POS 
burst traffic during peak hours."
```

---

### Mission Control Mesh

**Problem:** Aerospace telemetry and anomaly simulation with cryptographic command verification.

**Components:**
- **PulseMode** + **NodeStreamMode** for telemetry
- **CCTVMode** for visual monitoring
- **SandboxMode** for anomaly simulation
- **Signed command receipts** on lanes 0-3 and 6

**AI Prompt:**
```
"Draft 'mission-control' manifest binding Pulse, NodeStream, CCTV, 
Sandbox modes. Enforce signed command routing with metaAdapter and 
anchor all commands to blockchain."
```

---

### Mainstream Web3 & Web2 Mashups

These are the everyday apps developers want to build - familiar concepts powered by Atlas's unique capabilities.

#### NFT Marketplace & Gallery

**Components:** GalleryMode, MarketplaceTile, ReceiptsMode, TokensMode, Lane 6 media

**AI Prompt:**
```
"Generate an ExternalAppManifest 'nft-gallery' that pins Gallery, Marketplace, 
Receipts, Tokens modes and streams showcase video on lane-6 while anchoring 
sales via receipts."
```

---

#### Token Launchpad

**Components:** GovernanceMode, SandboxMode, ReceiptsMode, PaymentsMode

**AI Prompt:**
```
"Create a 'token-launchpad' profile that wires Governance proposals to token 
mint configs, validates via Sandbox simulations, and issues receipts for 
each launch milestone."
```

---

#### DEX Swap Terminal

**Components:** TokensMode, CalcMode, AnalyticsTile, NodeStreamMode

**AI Prompt:**
```
"Remix AtlasCanvas so TokensMode hosts swap pairs, CalcMode handles slippage 
math, Analytics streams price feeds over lane-2 via NodeStream."
```

---

#### Staking & Yield Dashboard

**Components:** PulseMode, TokensMode, ReceiptsMode, Notifications

**AI Prompt:**
```
"Draft 'staking-dashboard' manifest aggregating validator stats in Pulse, 
staking balances in Tokens, auto-anchoring reward receipts, and surfacing 
notifications."
```

---

#### Wallet Portfolio Tracker

**Components:** TokensMode, AnalyticsTile, DirectoryMode, FeedMode

**AI Prompt:**
```
"Configure 'portfolio-tracker' site profile locking Tokens, Analytics, 
Directory, Feed modes with lane-5 news ingestion."
```

---

#### DAO Treasury Console

**Components:** GovernanceMode, ReceiptsMode, CalcMode, CallsMode

**AI Prompt:**
```
"Generate 'dao-treasury' manifest to manage proposals, visualize treasury 
math, and schedule voice calls for approvals with receipt anchoring."
```

---

#### Airdrop & Rewards Manager

**Components:** RewardTile, DirectoryMode, NotificationsMode, ReceiptsMode

**AI Prompt:**
```
"Create an ExternalAppManifest 'airdrop-manager' that ingests wallet lists 
via Directory, issues reward receipts, and pushes status notifications."
```

---

#### Social Feed & Messaging Hub

**Components:** FeedMode, MessagesMode, PresenceTile, Media uploads

**AI Prompt:**
```
"Remix AtlasCanvas for 'social-hub' prioritizing Feed, Messages, Presence 
and enabling media lane-6 uploads with moderation hooks."
```

---

#### E-commerce Storefront

**Components:** MarketplaceTile, PaymentsMode, GalleryMode, ReceiptsMode

**AI Prompt:**
```
"Spin up 'commerce-storefront' profile combining product gallery, Payments 
checkout, and receipt anchoring per order."
```

---

#### Project Management Workspace

**Components:** TaskManagerMode, NotesMode, CallsMode, DirectoryMode, Notifications

**AI Prompt:**
```
"Build 'project-workspace' manifest aligning TaskManager, Notes, Calls, 
Directory modes with lane-2 task events and reminder notifications."
```

---

## Forward-Looking Blueprints

### Global AI Mesh Futures

The Global Relay Network opens transformative possibilities for AI-enhanced decentralized systems:

| Capability | Description | Foundation Lane |
|------------|-------------|-----------------|
| **AI-Powered Node Discovery** | Use embeddings to match nodes by semantic capabilities; LLMs classify telemetry to identify high-quality relays | Lane 3 (Telemetry) |
| **LLM Routing Optimization** | AI agents analyze lane KPIs and rebalance traffic across the global mesh for optimal performance | Lane 0 (Handshake) |
| **Self-Healing Diagnostics** | Atlas agents monitor `/health` and `/stats`, generate repair intents, and invoke keepalive relays to recover degraded nodes | Lane 2 (Keepalive) |
| **Intent-Based Commands** | Natural language → mesh actions: "Relay telemetry to governance nodes" translates to lane-3 targeted broadcast | Lane 3 (Telemetry) |
| **Cross-App AI Collaboration** | Foundation lanes host shared context (prompt caches, multilingual summaries) synchronized via relay queues | Lanes 0-3 |
| **Adaptive Trust Scoring** | LLMs label anomalous nodes based on behavior patterns, feeding back into registration criteria | Lane 1 (Identity) |

**AI Prompt: Build AI-powered mesh optimizer:**
```
Create server/mesh/aiOptimizer.ts that:
1. Fetches /api/mesh/global/stats every 30 seconds
2. Uses an LLM to analyze node health patterns
3. Identifies underperforming nodes and generates remediation intents
4. Sends keepalive probes via lane-2 to verify node responsiveness
5. Suggests peer rebalancing to Atlas for user confirmation

Reference the foundation lane isolation in server/mesh/globalRelay.ts 
to ensure all AI-driven relays stay within lanes 0-3.
```

**AI Prompt: Cross-app context sharing:**
```
Implement shared AI context across P3 apps using foundation lanes:
1. Lane 0 (Handshake): Negotiate shared context format
2. Lane 1 (Identity): Verify wallet-anchored AI agent identity
3. Lane 3 (Telemetry): Broadcast summarized context updates

Create client/src/lib/sharedAIContext.ts that:
- Maintains a local context cache
- Syncs deltas via global relay
- Merges context from multiple apps
- Respects foundation lane rate limits
```

**Security Guardrails for AI Mesh:**
- AI agents must respect foundation lane isolation (lanes 0-3 only for global relay)
- Wallet signature verification prevents spoofed AI nodes
- Payload limits (64KB) constrain AI context size
- 5-minute timestamp drift prevents replay attacks

---

### Sovereign Media Mesh

Community-owned streaming where viewers are the CDN:

```
Build a sovereign media platform:

Key Components:
- Atlas Transport (Lane 6/7 for streaming)
- Mesh Network (viewer nodes serve content)
- Receipt Anchoring (creator royalty tracking)
- ZK Circuits (anonymous viewership proofs)

Implementation Steps:
1. Configure mesh for content-addressed streaming
2. Add creator wallet for revenue splits
3. Implement popularity-based replication
4. Add viewer rewards (tokens for bandwidth contribution)

AI Prompt:
"Using P3's mesh network in client/src/lib/meshClient.ts and streaming 
in server/atlas/streaming.ts, implement a decentralized video platform 
where viewers contribute bandwidth and earn tokens proportional to 
content they serve to other viewers."
```

### Compliance Mesh (Air-Gapped Enterprise)

On-premises deployment with audit trails:

```
Deploy P3 for regulated enterprise:

Key Components:
- Session Bridge (SSO/SAML integration)
- PQ Crypto (post-quantum encryption)
- Blockchain Anchoring (immutable audit logs)
- Local mesh (no external connectivity)

Implementation Steps:
1. Disable all external API calls
2. Configure local-only peer discovery
3. Add compliance logging to every action
4. Implement data retention policies

AI Prompt:
"Configure P3 for an air-gapped enterprise deployment. Disable all 
external network calls, implement local-only mesh discovery in 
client/src/lib/meshClient.ts, and add comprehensive audit logging 
that anchors to an internal blockchain node."
```

### Disaster Response Communications

Offline-first encrypted messaging for first responders:

```
Build emergency response infrastructure:

Key Components:
- Nexus Messaging (E2E encrypted)
- WebRTC (P2P voice/video)
- Local-first sync (works offline)
- Mesh Network (ad-hoc connectivity)

Implementation Steps:
1. Implement offline message queue
2. Add mesh-based message relay
3. Create priority channels for emergencies
4. Add location sharing (opt-in)

AI Prompt:
"Adapt P3 for disaster response: implement offline-first messaging 
in client/src/lib/crypto.ts with local storage queue, add mesh-based 
message relay when connectivity is partial, and create priority 
lanes in server/atlas/streaming.ts for SOS signals."
```

### DAO Command Center

Token-gated workspace with on-chain governance:

```
Build a DAO operations platform:

Key Components:
- ZK Circuits (token balance proofs)
- Session Bridge (wallet-gated access)
- Task Manager (encrypted workflows)
- Governance Mode (voting interfaces)

Implementation Steps:
1. Add token-gating to session bridge
2. Implement proposal creation and voting
3. Add treasury visibility dashboards
4. Create role-based access from on-chain data

AI Prompt:
"Create a DAO command center using P3. In server/services/sessionBridge.ts, 
add token-gating that checks ERC-20 balance. Create a GovernanceMode in 
client/src/components/atlas/modes/ with proposal creation, voting 
(weighted by token balance), and treasury dashboard."
```

### AI Concierge Network

Distributed AI assistants with privacy:

```
Build a private AI assistant network:

Key Components:
- AIChatMode (existing chat interface)
- E2E Encryption (queries never leave client unencrypted)
- Mesh routing (distribute inference load)
- Receipt Anchoring (usage tracking)

Implementation Steps:
1. Add client-side query encryption
2. Implement inference load balancing across nodes
3. Create privacy-preserving usage metering
4. Add model selection (local vs. cloud)

AI Prompt:
"Extend P3's AIChatMode to create a privacy-preserving AI network. 
Encrypt all queries client-side before sending, implement mesh-based 
load balancing for inference requests, and add ZK proofs for usage 
metering without revealing query content."
```

---

## AI Prompt Recipe Book

### Quick Reference Prompts

Copy-paste these prompts directly into your AI assistant:

#### Setup & Orientation

```
I'm working with P3 Protocol (https://github.com/archi-tect0/P3-Protocol).
Analyze the repository structure and explain the key architectural decisions.
Focus on: session management, mesh networking, and the Atlas transport system.
```

#### Feature Addition

```
In P3 Protocol, add [FEATURE] to [COMPONENT]:

Files to modify:
- server/[path]: Backend logic
- client/src/[path]: Frontend UI
- shared/schema.ts: Types (if needed)

Requirements:
- Maintain existing patterns from docs/INTEGRATION_GUIDE.md
- Add proper TypeScript types
- Include error handling
- Add to API routes if backend change
```

#### Performance Optimization

```
Analyze P3 Protocol's [COMPONENT] for performance bottlenecks.
Focus on:
- Memory usage patterns
- Network request efficiency
- Rendering performance (if frontend)
- Database query optimization (if backend)

Provide specific code changes with before/after.
```

#### Security Audit

```
Review P3 Protocol's [COMPONENT] for security vulnerabilities:

Check for:
- Input validation
- Authentication/authorization gaps
- Encryption implementation correctness
- Rate limiting
- Injection vulnerabilities

Reference docs/SECURITY_ARCHITECTURE.md for existing patterns.
```

#### White-Label Rebranding

```
Rebrand P3 Protocol for [INDUSTRY/COMPANY]:

1. Update all "P3" and "Atlas" references to [NEW_NAME]
2. Replace color scheme in client/src/index.css
3. Update logos in client/public/
4. Modify landing page in client/src/pages/LandingPage.tsx
5. Keep all core infrastructure intact

Provide a complete file-by-file change list.
```

---

## Additional Resources

- [Integration Guide](./INTEGRATION_GUIDE.md) - Modular component adoption
- [Modular Seams](./MODULAR_SEAMS.md) - Component extraction patterns
- [Atlas Transport](./ATLAS_TRANSPORT.md) - Lane system deep dive
- [Mesh Network](./MESH_NETWORK.md) - P2P architecture
- [Session Bridge](./SESSION_BRIDGE.md) - Authentication patterns
- [Security Architecture](./SECURITY_ARCHITECTURE.md) - Encryption standards

---

**P3 Protocol is designed to be prompt-able. The more context you give your AI, the better results you'll get.**
