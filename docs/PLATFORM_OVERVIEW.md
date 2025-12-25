# P3 Protocol - Platform Overview

A comprehensive overview of P3 Protocol's architecture, capabilities, and systems.

---

## What is P3 Protocol?

P3 Protocol is a Web3 Mesh Operating System that unifies applications, communication, and blockchain infrastructure under a single wallet-anchored platform. Instead of scattered dApps and fragmented experiences, P3 provides a cohesive substrate where everything connects.

**Core Pillars:**
- **Atlas** - The operating system canvas with 30+ modes
- **Nexus** - Wallet-to-wallet encrypted communication
- **Mesh Network** - Distributed content and relay infrastructure
- **Cross-Chain Receipts** - Immutable blockchain-anchored audit trails
- **Security Stack** - Zero-PII identity with layered encryption

---

## Atlas - The Operating System

### What Atlas Does

Atlas is the execution layer where apps, APIs, and Web3 flows run. Think of it like iOS or Android, but for Web3 - it provides the unified interface where everything else operates.

### 30+ Canvas Modes

| Category       | Modes                                           |
|----------------|-------------------------------------------------|
| Communication  | Inbox, Messages, Calls, Notifications           |
| Finance        | Payments, Tokens, Receipts                      |
| Media          | TV, Radio, Gallery, Reader, Camera              |
| Productivity   | Notes, Writer, Calc, FileHub, Clipboard         |
| Web3           | Governance, Identity, Registry                  |
| Entertainment  | GameDeck, AtlasOne (marketplace)                |
| Development    | Sandbox, DevKit, Orchestration                  |
| Utilities      | Weather, WebBrowser, Directory, Feed            |
| System         | SystemMonitor, Metrics, Pulse, Node             |

Each mode is a full application running on the Atlas substrate.

### Deep Link Integrations

Atlas can open and control 50+ external apps with data pre-filled:

| Category    | Apps                                              |
|-------------|---------------------------------------------------|
| Rides       | Uber, Lyft, Via, Curb, Bolt, Grab                 |
| Food        | DoorDash, UberEats, Grubhub, Instacart            |
| Messaging   | WhatsApp, Telegram, Signal, iMessage              |
| Payments    | Venmo, Cash App, PayPal, Zelle                    |
| Music       | Spotify, Apple Music, YouTube Music               |
| Video       | Netflix, YouTube, Disney+, Prime Video            |
| Navigation  | Google Maps, Waze, Apple Maps                     |

### Voice & Natural Language

Atlas understands 55+ natural language patterns through a 3-tier intent system:

1. **Regex matching** - Fast pattern detection
2. **Keyword mapping** - Direct command recognition  
3. **LLM fallback** - Complex utterance parsing

Examples:
- "check my balance" → Wallet balance flow
- "send $50 to john" → Payment flow
- "get me an uber to LAX" → Deep link to Uber
- "what's the weather" → Weather mode

### LLM Providers

| Provider   | Model                    | Use Case                    |
|------------|--------------------------|------------------------------|
| OpenAI     | gpt-4o-mini              | Fast intent parsing          |
| Anthropic  | claude-3-5-haiku         | Complex reasoning            |
| Gemini     | gemini-1.5-flash         | Multimodal understanding     |

---

## Nexus - Encrypted Communication

### What Nexus Does

Nexus is wallet-to-wallet communication. Messages, calls, and payments - all encrypted, all identified by wallet address.

No accounts. No passwords. No phone numbers. Just wallets.

### Features

| Feature      | How It Works                                    |
|--------------|-------------------------------------------------|
| Messaging    | End-to-end encrypted text via wallet address    |
| Video Calls  | WebRTC peer-to-peer, encrypted streams          |
| Voice Calls  | Audio-only option for lower bandwidth           |
| Payments     | Send crypto directly in conversation            |
| Directory    | Find wallets, see public keys                   |
| Receipts     | Every action gets a blockchain-anchored proof   |

### Message Flow

1. You compose a message
2. Nexus encrypts with recipient's public key (X25519)
3. Only their wallet can decrypt
4. Server never sees plaintext
5. Message delivered

Even if someone compromises the server, they cannot read messages.

---

## Security Architecture

### Zero-PII Design

P3 Protocol stores no personal information:

| What                  | How It's Handled                    |
|-----------------------|-------------------------------------|
| Identity              | Wallet address only                 |
| Authentication        | SIWE (Sign-In With Ethereum)        |
| Session tokens        | JWT with wallet as subject          |
| Personal data         | None collected or stored            |

### Authentication Flow

1. Client requests challenge nonce
2. Server generates time-limited challenge
3. User signs with wallet (EIP-191)
4. Server verifies signature
5. Session token issued

### Key Management

| Layer                 | Protection                          |
|-----------------------|-------------------------------------|
| Transport             | TLS 1.3 encryption                  |
| Message content       | TweetNaCl X25519 + XSalsa20-Poly1305|
| Session tokens        | JWT with HMAC-SHA256                |
| API keys              | Server-side vault, never exposed    |

### Defense in Depth

- Rate limiting on all endpoints
- Challenge replay protection (5-minute expiry)
- Wallet-gated access to sensitive operations
- Audit logging for all authentication events

**Full details:** [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md)

---

## Cryptography Stack

### Encryption Primitives

| Function              | Algorithm                           |
|-----------------------|-------------------------------------|
| Key Exchange          | X25519 (Curve25519 ECDH)            |
| Symmetric Encryption  | XSalsa20-Poly1305                   |
| Hashing               | SHA-256, Keccak-256                 |
| Signatures            | secp256k1 (Ethereum standard)       |

### How Encryption Works

**Key Generation:**
```
User wallet → Derive X25519 keypair → Store public key on-chain
```

**Message Encryption:**
```
Sender secret + Recipient public → Shared secret → Encrypt with XSalsa20
```

**Verification:**
```
Message hash → Ethereum signature → Recover signer address → Compare
```

### Post-Quantum Roadmap

Architecture supports future Kyber integration for quantum-resistant key exchange.

**Full details:** [CRYPTOGRAPHY_PRIMITIVES.md](./CRYPTOGRAPHY_PRIMITIVES.md)

---

## Real-Time Infrastructure

### Transport Layers

| Protocol    | Use Case                                        |
|-------------|-------------------------------------------------|
| WebSocket   | Bidirectional real-time messaging               |
| SSE         | Server-to-client streaming (8-lane protocol)    |
| WebRTC      | Peer-to-peer voice/video calls                  |

### Atlas API 2.0 - 8-Lane Protocol

Data flows through prioritized lanes:

| Lane | Name          | Priority | Content                    |
|------|---------------|----------|----------------------------|
| 1    | ACCESS        | Highest  | Auth tokens, session data  |
| 2    | MANIFESTS     | High     | App definitions, metadata  |
| 3    | RECEIPTS      | High     | Blockchain anchors, proofs |
| 4    | MEDIA         | Medium   | Images, video, audio       |
| 5    | COMMERCE      | Medium   | Payments, purchases        |
| 6    | GOVERNANCE    | Medium   | Votes, proposals           |
| 7    | NOTIFICATIONS | Low      | Alerts, updates            |
| 8    | CHAT          | Low      | Messages, AI responses     |

**Benefits:**
- ~50% bandwidth savings (MessagePack binary encoding)
- Critical operations never blocked by bulk data
- Real-time streaming with automatic prioritization

### WebRTC Calls

1. Caller initiates via signaling server
2. ICE candidates exchanged for NAT traversal
3. DTLS-SRTP encrypted media streams
4. Direct peer-to-peer connection established

**Full details:** [REALTIME_INFRASTRUCTURE.md](./REALTIME_INFRASTRUCTURE.md)

---

## Cross-Chain Receipts

### What Receipts Do

Every significant action generates a cryptographic receipt anchored to the blockchain - creating an immutable audit trail.

### Receipt Structure

```
Receipt {
  id: unique identifier
  type: message | payment | call | vote
  hash: SHA-256 of payload
  timestamp: Unix timestamp
  parties: [sender, recipient]
  chainId: target blockchain
  txHash: on-chain transaction (after anchoring)
}
```

### Anchoring Flow

1. Action occurs (message sent, payment made)
2. Receipt created with SHA-256 hash
3. Queued for batch anchoring (cost efficiency)
4. Smart contract stores hash on-chain
5. Transaction hash linked to receipt
6. Receipt becomes independently verifiable

### Verification

Anyone can verify a receipt:
1. Recompute hash from receipt data
2. Query smart contract for stored hash
3. Compare hashes - match confirms authenticity

**Full details:** [CROSS_CHAIN_RECEIPTS.md](./CROSS_CHAIN_RECEIPTS.md)

---

## Mesh Network

### What the Mesh Does

Distributed infrastructure for content delivery, relay, and cross-chain bridging.

### Components

| Component     | Role                                            |
|---------------|-------------------------------------------------|
| MeshClient    | Browser-side connection to mesh network         |
| Relay Nodes   | Forward content between peers                   |
| Storage Nodes | Content-addressed chunk storage                 |
| Bridge Nodes  | Cross-chain receipt anchoring                   |

### Content Delivery

1. Content split into chunks
2. Each chunk content-addressed (hash-based ID)
3. Chunks distributed across nodes
4. Clients request by hash
5. Any node with chunk can serve it

### Running a Node

Operators can run nodes to:
- Relay content for the network
- Store and serve chunks
- Bridge receipts across chains
- Earn rewards for participation

**Full details:** [MESH_NETWORK.md](./MESH_NETWORK.md)

---

## SDK & Manifests

### Building on Atlas

Developers extend Atlas through manifests - declarative descriptions of what an app or API can do.

### Manifest Structure

```json
{
  "name": "My Weather App",
  "version": "1.0.0",
  "baseUrl": "https://api.weather.com",
  "endpoints": [
    {
      "key": "weather.current",
      "name": "Get Current Weather",
      "method": "GET",
      "path": "/current",
      "samplePhrases": ["what's the weather"]
    }
  ],
  "permissions": ["network"]
}
```

### App Lifecycle

1. **Draft** - Developer building
2. **Pending** - Submitted for review
3. **Approved** - Live in Atlas
4. **Rejected** - Needs changes

### Permission Model

| Permission    | Access Granted                          |
|---------------|-----------------------------------------|
| network       | HTTP requests to declared domains       |
| storage       | Wallet-scoped persistent storage        |
| wallet        | Read wallet address                     |
| sign          | Request transaction signatures          |

### Integration Options

1. **Full manifest** - Complete app with UI
2. **API adapter** - Expose existing API to Atlas
3. **Canvas card** - Widget in the Atlas interface
4. **Workflow** - Multi-step automation

**Full details:** [SDK_AND_MANIFESTS.md](./SDK_AND_MANIFESTS.md)

---

## Session Bridge

### The Problem

Wallet browsers have limited capabilities. Real browsers (Safari, Chrome) provide better experience. But switching browsers loses wallet connection.

### The Solution

1. User connects wallet in wallet browser
2. Taps "Open in Browser"
3. Session Bridge creates one-time token
4. Real browser opens with token
5. Token consumed, session transfers
6. User continues in real browser, still connected

### Security

- Tokens are single-use
- Tokens expire after 5 minutes
- Replay attacks rejected
- No credentials transmitted in URL

---

## The Complete Stack

```
┌─────────────────────────────────────┐
│          Your Application           │  ← Built with SDK, described by Manifest
├─────────────────────────────────────┤
│         Atlas Canvas (30+)          │  ← TV, Payments, Messages, Games, etc.
├─────────────────────────────────────┤
│          Intent Router              │  ← Natural language → structured actions
├─────────────────────────────────────┤
│       Nexus Communication           │  ← E2E encrypted messages, calls
├─────────────────────────────────────┤
│        Cross-Chain Receipts         │  ← Blockchain-anchored audit trails
├─────────────────────────────────────┤
│          Mesh Network               │  ← Distributed content, relays
├─────────────────────────────────────┤
│        Atlas API 2.0 (SSE)          │  ← 8-lane streaming protocol
├─────────────────────────────────────┤
│        Security Stack               │  ← SIWE auth, encryption, key vault
├─────────────────────────────────────┤
│      WalletConnect / Session        │  ← Wallet connection + browser handoff
└─────────────────────────────────────┘
```

Each layer has a single responsibility. Together they form a complete Web3 operating system.

---

## Key Differentiators

| Traditional Approach       | P3 Protocol                         |
|----------------------------|-------------------------------------|
| Apps sit on platforms      | Atlas IS the platform               |
| APIs return data           | Atlas orchestrates flows            |
| Integrations are siloed    | Unified Web2 + Web3 + Voice         |
| State lives in apps        | State is wallet-anchored            |
| Users manage credentials   | Server-side vault handles keys      |
| Phone/email identity       | Wallet address only                 |
| Trust the platform         | Trust cryptography                  |

---

## Summary

**P3 Protocol is a wallet-anchored mesh operating system that unifies 30+ app modes, encrypted communication, blockchain receipts, distributed infrastructure, and a developer SDK - all running on an 8-lane streaming protocol with zero personal information required.**

---

## Further Reading

- [Integration Guide](./INTEGRATION_GUIDE.md) - Adopt individual components
- [Security Architecture](./SECURITY_ARCHITECTURE.md) - Auth and encryption details
- [Cryptography Primitives](./CRYPTOGRAPHY_PRIMITIVES.md) - Encryption standards
- [Real-Time Infrastructure](./REALTIME_INFRASTRUCTURE.md) - WebSocket, SSE, WebRTC
- [Cross-Chain Receipts](./CROSS_CHAIN_RECEIPTS.md) - Blockchain anchoring
- [SDK & Manifests](./SDK_AND_MANIFESTS.md) - Building on Atlas
- [Mesh Network](./MESH_NETWORK.md) - Node and relay architecture
