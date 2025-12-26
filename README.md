# P3 Protocol

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Base Network](https://img.shields.io/badge/Base-0052FF?style=flat&logo=coinbase&logoColor=white)](https://base.org/)

**Open Source Web3 Mesh Operating System**

*Stop building apps that live on servers. Start launching networks that live everywhere.*

---

## Overview

P3 Protocol is open-source infrastructure for an era that hasn't arrived yet. We're giving you the protocol, the encryption, and the network. What you build on top of it is up to you.

Most decentralized networks require specialized browsers, cryptography expertise, or expensive hardware. P3 requires a click. The mesh logic integrates directly into the stack—a user becomes a contributing node just by visiting a URL. No installation. No configuration. Just participation.

This is the first protocol that prioritizes the packet, not the provider. True net neutrality, hard-coded into the mesh. Multiplexed P2P routing with end-to-end encryption means the network is mathematically incapable of discriminating between a video stream and a private message. Both receive equal treatment.

The architecture inverts the traditional CDN model. Instead of corporations spending billions to prevent buffering, P3 makes every viewer part of the solution. Users become micro-distributors. The network gets stronger and faster as more people join. No central bottlenecks. Self-healing by design.

P3 isn't a finished product—it's the factory. A production-ready template where developers can plug in any service (streaming, messaging, finance, identity) without rebuilding the underlying security or networking. Grab individual components: the encryption stack, the real-time transport, the receipt anchoring, the mesh relay. Or deploy the entire operating system.

*Build in five minutes what used to take five years. The definitive template for a neutral, decentralized future.*

## Features

### Atlas Canvas
- **30+ Modes** - TV, radio, ebooks, games, weather, AI chat, and more
- **Unified Interface** - Single canvas for all content types
- **Open Sources** - IPTV aggregation, Project Gutenberg, free game catalogs

### Nexus Messaging
- **E2E Encryption** - TweetNaCl X25519 with post-quantum ready architecture
- **Wallet Identity** - Zero PII design, wallet addresses as sole identifiers
- **WebRTC Calls** - Peer-to-peer encrypted voice and video

### Blockchain Anchoring
- **Immutable Receipts** - SHA-256 hashed, blockchain-anchored audit trails
- **Base Network** - Primary chain for smart contracts
- **Cross-Chain Ready** - Bridge adapters for multi-chain settlement

### P3 Hub
- **50+ Apps** - Wallet-anchored application launcher
- **Session Bridge** - Seamless wallet-to-browser handoff
- **Multi-Wallet** - MetaMask, Coinbase, Trust, Rainbow, and 100+ more

### Also Included

- **Multi-PWA Profiles** - Three installable app configurations (Atlas, Launcher, Enterprise) with dedicated service workers. Users install directly from browser—zero-install mesh entry.
- **LLM Orchestration** - Built-in router with OpenAI, Anthropic, and Gemini fallback. AI chat modes ready to use.
- **NodeStream Visualization** - Real-time graph rendering for mesh network activity and data flows.
- **Task Manager** - Production workflow automation through Nexus with encrypted task queues.
- **Explorer & Marketplace** - Pre-built discovery interfaces for content, apps, and catalog items.
- **Atlas UI Templates** - The entire Atlas interface is modular and modifiable. Use it as a starting point, swap modes, or build your own canvas.

---

## Core Infrastructure

These are the high-value subsystems that solve hard problems:

### Session Bridge
Atomic wallet-to-browser handoff with cross-device session continuity. Users connect once, stay connected across tabs, refreshes, and devices. **[Full Documentation](./docs/SESSION_BRIDGE.md)**
```
client/src/lib/sessionBridgeV2.ts  - Core bridge logic
client/src/hooks/useSessionBridge.ts - React integration
server/pwa-routes.ts                - Install token endpoints
```

### Atlas API v2 Transport
8-lane multiplexed protocol with MessagePack encoding, adaptive compression, and session delta-sync. High-efficiency wire format for real-time applications.
```
server/protocol/transport.ts  - Transport layer
server/protocol/encoding.ts   - MessagePack + compression
server/protocol/wire.ts       - Wire protocol
server/protocol/session/*     - Session management
```

### Post-Quantum Cryptography
Kyber and Dilithium bindings ready for the post-quantum era. Rust-to-TypeScript bridge for quantum-safe key exchange and signatures.
```
rust/pqcrypto/          - Rust bindings
packages/zk/            - TypeScript interop
server/services/pq/     - Server-side PQ services
```

### Zero-Knowledge Circuits
Pre-built ZK circuits for privacy-preserving proofs. Mesh reputation and message verification without revealing identity.
```
circuits/               - Circom circuits
packages/zk/circuits/   - Compiled circuits
packages/zk/prover/     - Proving services
server/services/zkmsg/  - ZK message verification
```

### Viewport-Aware Prefetching
Scroll-velocity-aware prefetching with IntersectionObserver, batch requests, and automatic cancellation. Netflix-grade content loading.
```
client/src/hooks/usePrefetchWindow.ts  - Prefetch engine
server/atlas/one/*                      - Catalog batching
```

---

## Modular Architecture

P3 Protocol is designed as a **composable toolkit**. Pick what you need:

| Component | Use Case | Documentation |
|-----------|----------|---------------|
| **Session Bridge** | Wallet-to-browser handoff | [SESSION_BRIDGE.md](./docs/SESSION_BRIDGE.md) |
| **Cryptography** | E2E encryption for any app | [CRYPTOGRAPHY_PRIMITIVES.md](./docs/CRYPTOGRAPHY_PRIMITIVES.md) |
| **Real-Time** | WebSocket, SSE, WebRTC | [REALTIME_INFRASTRUCTURE.md](./docs/REALTIME_INFRASTRUCTURE.md) |
| **Receipt Anchoring** | Immutable audit trails | [CROSS_CHAIN_RECEIPTS.md](./docs/CROSS_CHAIN_RECEIPTS.md) |
| **Mesh Network** | Distributed content delivery | [MESH_NETWORK.md](./docs/MESH_NETWORK.md) |
| **Atlas Canvas** | Multi-mode UI framework | [ATLAS_CANVAS_STACK.md](./docs/ATLAS_CANVAS_STACK.md) |
| **SDK & Manifests** | App/plugin system | [SDK_AND_MANIFESTS.md](./docs/SDK_AND_MANIFESTS.md) |
| **Security** | Auth, encryption, key management | [SECURITY_ARCHITECTURE.md](./docs/SECURITY_ARCHITECTURE.md) |

**[Full Integration Guide](./docs/INTEGRATION_GUIDE.md)** - Step-by-step instructions for adopting individual components.

---

## Tech Stack

**Frontend:** React, TypeScript, Vite, TanStack Query, shadcn/ui, Tailwind CSS

**Backend:** Node.js, Express, TypeScript, PostgreSQL (Drizzle ORM), WebSocket

**Blockchain:** Ethers.js v6, Hardhat, Base Network, IPFS via Pinata

**Cryptography:** TweetNaCl (X25519, XSalsa20-Poly1305), SHA-256, SIWE

---

## Quick Start

### Full Stack Deployment

```bash
# Clone the repository
git clone https://github.com/archi-tect0/P3-Protocol.git
cd P3-Protocol

# Install dependencies
npm install

# Start development server
npm run dev
```

The application runs on `http://localhost:5000`.

### Component Integration

Import individual modules into your existing project:

```typescript
// Encryption
import { generateKeyPair, encrypt, decrypt } from './lib/crypto';

// Receipt anchoring
import { createReceipt, anchorToChain } from './lib/receipts';

// WebSocket pub/sub
import { createChannel, subscribe, publish } from './lib/realtime';
```

See [INTEGRATION_GUIDE.md](./docs/INTEGRATION_GUIDE.md) for detailed examples.

---

## Project Structure

```
P3-Protocol/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components (including Atlas Canvas)
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities (crypto, websocket, etc.)
│   │   └── hooks/       # React hooks
├── server/              # Express backend
│   ├── services/        # Business logic (encryption, receipts, mesh)
│   └── routes.ts        # API endpoints
├── shared/              # Shared types
│   └── schema.ts        # Database schema & types
├── contracts/           # Solidity smart contracts
├── docs/                # Technical documentation
└── scripts/             # Deployment scripts
```

---

## Documentation

### Getting Started
- **[Platform Overview](./docs/PLATFORM_OVERVIEW.md)** - Complete system introduction
- **[Integration Guide](./docs/INTEGRATION_GUIDE.md)** - Modular component adoption
- **[Environment Setup](./docs/ENV_SETUP.md)** - Configuration guide
- **[Atlas Developer Guide](./docs/ATLAS_DEVELOPER_GUIDE.md)** - Building with Atlas

### Architecture Guides
- **[Architecture Overview](./docs/ARCHITECTURE.md)** - System design and patterns
- **[Session Bridge](./docs/SESSION_BRIDGE.md)** - Wallet-to-browser handoff
- **[Modular Seams](./docs/MODULAR_SEAMS.md)** - Component extraction guide
- **[Security Architecture](./docs/SECURITY_ARCHITECTURE.md)** - Auth, encryption, key management
- **[Atlas Canvas Stack](./docs/ATLAS_CANVAS_STACK.md)** - UI framework and modes

### Protocol Specifications
- **[Atlas API v2](./docs/ATLAS_API_V2.md)** - 8-lane multiplexed protocol
- **[Cross-Chain Receipts](./docs/CROSS_CHAIN_RECEIPTS.md)** - Blockchain anchoring
- **[Cryptography Primitives](./docs/CRYPTOGRAPHY_PRIMITIVES.md)** - Encryption standards

### Infrastructure
- **[Real-Time Infrastructure](./docs/REALTIME_INFRASTRUCTURE.md)** - WebSocket, SSE, WebRTC
- **[Mesh Network](./docs/MESH_NETWORK.md)** - Node relay and P2P networking
- **[SDK & Manifests](./docs/SDK_AND_MANIFESTS.md)** - App extension system

### Operations
- **[API Reference](./docs/API.md)** - Endpoint documentation
- **[API Bridge](./docs/API_BRIDGE.md)** - External API integrations
- **[Deployment](./docs/DEPLOYMENT.md)** - Production deployment
- **[Runbook](./docs/RUNBOOK.md)** - Operations and troubleshooting

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**Required:**
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Authentication secret
- `VITE_WALLETCONNECT_PROJECT_ID` - From [WalletConnect Cloud](https://cloud.walletconnect.com/)
- `ADMIN_WALLET` - Admin wallet address

See [docs/ENV_SETUP.md](./docs/ENV_SETUP.md) for full configuration guide.

---

## Contributing

Contributions welcome! 

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

**Apache License 2.0** - Use commercially with attribution.

See [LICENSE](./LICENSE) for full terms.

---

## Contact

- **GitHub:** [github.com/archi-tect0/P3-Protocol](https://github.com/archi-tect0/P3-Protocol)

---

**Built for developers building decentralized infrastructure.**
