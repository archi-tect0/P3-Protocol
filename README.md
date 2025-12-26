# P3 Protocol

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Base Network](https://img.shields.io/badge/Base-0052FF?style=flat&logo=coinbase&logoColor=white)](https://base.org/)

**Open Source Web3 Mesh Operating System**

*Stop building apps that live on servers. Start launching networks that live everywhere.*

---

## Overview

P3 Protocol is production-ready infrastructure for decentralized applications. Connect a wallet, become a node. No installation, no configuration—just participation.

**What makes it different:**
- **Zero-config mesh entry** - Users become contributing nodes by visiting a URL
- **Blind packet neutrality** - The network treats all data equally by design
- **Self-healing streams** - Every viewer strengthens the network
- **Modular by default** - Use individual components or deploy the full stack

---

## Quick Start

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

---

## Core Systems

P3 Protocol is a **composable toolkit**. Each system can be adopted independently:

| System | Description | Documentation |
|--------|-------------|---------------|
| **Session Bridge** | Wallet-to-browser handoff with cross-device continuity | [SESSION_BRIDGE.md](./docs/SESSION_BRIDGE.md) |
| **ZK Circuits** | Privacy-preserving proofs for identity and reputation | [packages/zk/](./packages/zk/README.md) |
| **PQ Crypto** | Post-quantum cryptography (Kyber, Dilithium) | [rust/pqcrypto/](./rust/pqcrypto/README.md) |
| **Cross-Chain Bridge** | Multi-chain receipt relay (Polygon, Arbitrum, Optimism) | [CROSS_CHAIN_BRIDGE.md](./docs/CROSS_CHAIN_BRIDGE.md) |
| **Atlas Transport** | Streaming, caching, and content delivery | [ATLAS_TRANSPORT.md](./docs/ATLAS_TRANSPORT.md) |
| **Cryptography** | E2E encryption (TweetNaCl X25519, XSalsa20-Poly1305) | [CRYPTOGRAPHY_PRIMITIVES.md](./docs/CRYPTOGRAPHY_PRIMITIVES.md) |
| **Real-Time** | WebSocket pub/sub, SSE, WebRTC | [REALTIME_INFRASTRUCTURE.md](./docs/REALTIME_INFRASTRUCTURE.md) |
| **Receipt Anchoring** | Immutable blockchain audit trails | [CROSS_CHAIN_RECEIPTS.md](./docs/CROSS_CHAIN_RECEIPTS.md) |
| **Mesh Network** | Distributed P2P content delivery | [MESH_NETWORK.md](./docs/MESH_NETWORK.md) |

**[Full Integration Guide](./docs/INTEGRATION_GUIDE.md)** - Step-by-step instructions for adopting individual components.

---

## What's Included

### Atlas Canvas
Multi-mode content interface with 30+ modes: TV, radio, ebooks, games, weather, AI chat. Built on open sources (IPTV aggregation, Project Gutenberg, free game catalogs).

### Nexus Messaging
End-to-end encrypted messaging with wallet identity. Zero PII design—wallet addresses are the only identifiers. Includes WebRTC for peer-to-peer voice and video.

### Blockchain Anchoring
SHA-256 hashed receipts anchored to Base Network. Bridge adapters enable cross-chain settlement to Polygon, Arbitrum, and Optimism.

### P3 Hub
Wallet-anchored application launcher with 50+ apps. Session Bridge enables seamless wallet-to-browser handoff across MetaMask, Coinbase, Trust, Rainbow, and 100+ wallets.

### Also Included
- **Multi-PWA Profiles** - Three installable configurations (Atlas, Launcher, Enterprise)
- **LLM Orchestration** - OpenAI, Anthropic, and Gemini with automatic fallback
- **NodeStream Visualization** - Real-time mesh network graphs
- **Task Manager** - Encrypted workflow automation
- **Explorer & Marketplace** - Discovery interfaces for content and apps

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React, TypeScript, Vite, TanStack Query, shadcn/ui, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript, PostgreSQL (Drizzle ORM), WebSocket |
| **Blockchain** | Ethers.js v6, Hardhat, Base Network, IPFS via Pinata |
| **Cryptography** | TweetNaCl (X25519, XSalsa20-Poly1305), SHA-256, SIWE |

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
│   ├── services/        # Business logic
│   ├── atlas/           # Atlas Transport layer
│   └── routes.ts        # API endpoints
├── packages/            # Extractable modules
│   ├── zk/              # Zero-knowledge circuits
│   └── bridge/          # Cross-chain bridge adapters
├── rust/                # Rust modules
│   └── pqcrypto/        # Post-quantum cryptography
├── shared/              # Shared types
│   └── schema.ts        # Database schema & types
├── contracts/           # Solidity smart contracts
└── docs/                # Technical documentation
```

---

## Documentation

### Getting Started
- **[Integration Guide](./docs/INTEGRATION_GUIDE.md)** - Modular component adoption
- **[Platform Overview](./docs/PLATFORM_OVERVIEW.md)** - Complete system introduction
- **[Environment Setup](./docs/ENV_SETUP.md)** - Configuration guide

### Core System Guides
- **[Session Bridge](./docs/SESSION_BRIDGE.md)** - Wallet-to-browser handoff
- **[Atlas Transport](./docs/ATLAS_TRANSPORT.md)** - Streaming and content delivery
- **[Cross-Chain Bridge](./docs/CROSS_CHAIN_BRIDGE.md)** - Multi-chain receipt relay
- **[Cryptography Primitives](./docs/CRYPTOGRAPHY_PRIMITIVES.md)** - Encryption standards
- **[Real-Time Infrastructure](./docs/REALTIME_INFRASTRUCTURE.md)** - WebSocket, SSE, WebRTC

### Architecture
- **[Architecture Overview](./docs/ARCHITECTURE.md)** - System design and patterns
- **[Modular Seams](./docs/MODULAR_SEAMS.md)** - Component extraction guide
- **[Security Architecture](./docs/SECURITY_ARCHITECTURE.md)** - Auth, encryption, key management

### Operations
- **[API Reference](./docs/API.md)** - Endpoint documentation
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
