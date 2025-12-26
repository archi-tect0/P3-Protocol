# Modular Seams Documentation

This document maps the dependency boundaries for P3 Protocol's high-value components ("gold mines"). Use this as a reference for:
1. Developers cherry-picking individual components
2. Future pnpm workspace extraction
3. Understanding what needs decoupling before components can stand alone

---

## Component Overview

| Component | Location | Status | Extraction Difficulty |
|-----------|----------|--------|----------------------|
| Session Bridge | `client/src/lib/sessionBridgeV2.ts` | Production | Medium |
| ZK Circuits | `packages/zk/` | Production | Low |
| PQ Crypto | `rust/pqcrypto/` | Scaffolded | Low |
| Cross-Chain Bridge | `packages/bridge/` | Production | Medium |
| Atlas Transport | `server/atlas/` | Production | High |

---

## Session Bridge

**Purpose**: Atomic wallet-to-browser handoff with cross-device session continuity.

### File Dependencies

| File | Role |
|------|------|
| `client/src/lib/sessionBridgeV2.ts` | Core bridge logic (1600+ lines) |
| `client/src/lib/coinbaseAuth.ts` | PIN authentication layer |
| `client/src/hooks/useSessionBridge.ts` | React WebSocket hook |
| `server/pwa-routes.ts` | Install token endpoints |

### Internal Dependencies

```
sessionBridgeV2.ts
├── imports: coinbaseAuth.ts (checkPinStatus, setupPin, verifyPin, getConnectedAddress)
├── uses: localStorage (p3.bridge.session, p3.bridge.resume, p3.diag.sessionId)
├── calls: /api/diag (diagnostics endpoint)
└── calls: /api/pwa/* (install token endpoints)

useSessionBridge.ts
├── imports: @/state/useAtlasStore (dissolveInto, pushReceipt, setSuggestions)
└── connects: /atlas/session (WebSocket)

pwa-routes.ts
├── imports: IStorage interface
├── imports: server/atlas/services/sessionBridge (startSession)
├── requires: JWT_SECRET env var
└── storage methods: createInstallToken, getInstallToken, updateInstallTokenWallet, consumeInstallToken, cleanupExpiredInstallTokens
```

### External Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@walletconnect/ethereum-provider` | ^2.x | WalletConnect v2 connection |
| `jsonwebtoken` | ^9.x | JWT token generation |

### Environment Variables

| Variable | Required | Context |
|----------|----------|---------|
| `VITE_WALLETCONNECT_PROJECT_ID` | Yes | Frontend - WalletConnect project ID |
| `JWT_SECRET` | Yes (prod) | Backend - Token signing |

### Storage Interface Requirements

The server component requires an `IStorage` implementation with:
```typescript
interface IStorage {
  createInstallToken(data: InsertInstallToken): Promise<InstallToken>;
  getInstallToken(token: string): Promise<InstallToken | undefined>;
  updateInstallTokenWallet(token: string, walletAddress: string): Promise<void>;
  consumeInstallToken(token: string): Promise<void>;
  cleanupExpiredInstallTokens(): Promise<void>;
}
```

### Server-Side Dependencies

The PWA routes also import from Atlas services:
```typescript
import { startSession } from './atlas/services/sessionBridge';
```
This creates a session after token consumption. For standalone extraction, this would need to be abstracted or made optional.

### Extraction Checklist

- [ ] Extract `coinbaseAuth.ts` alongside `sessionBridgeV2.ts`
- [ ] Abstract `useAtlasStore` dependency in hook (make it configurable callback)
- [ ] Abstract `startSession` dependency (make it optional or injectable)
- [ ] Create standalone storage adapter interface with all 5 methods
- [ ] Bundle JWT utilities or make them optional
- [ ] Document WalletConnect project ID setup
- [ ] Note: Hook connects to WebSocket at `/atlas/session` - document or make configurable

---

## ZK Circuits

**Purpose**: Zero-knowledge proofs for privacy-preserving receipts (message, meeting, payment, consent).

### File Dependencies

| File | Role |
|------|------|
| `packages/zk/prover/index.ts` | Proof generation service |
| `packages/zk/circuits/*.circom` | Circuit definitions |
| `packages/zk/package.json` | Already has proper package.json |

### Internal Dependencies

```
prover/index.ts
├── imports: fs, path (Node.js built-ins)
├── runtime requires: snarkjs (dynamic import, GPL-excluded)
├── expects: build/*.wasm, build/*_final.zkey files
└── no other P3 dependencies
```

### External Dependencies

| Package | Version | Purpose | License Note |
|---------|---------|---------|--------------|
| `snarkjs` | ^0.7.6 | ZK proof generation | GPL - dynamically loaded |
| `circomlib` | ^2.0.5 | Circuit primitives | MIT |
| `ffjavascript` | ^0.3.0 | Finite field math | MIT |

### Environment Variables

None required.

### Build Prerequisites

Circuits require compilation before use:
1. **circom CLI** - Compiles `.circom` to R1CS + WASM
2. **snarkjs** - Generates proving/verification keys (Powers of Tau ceremony)
3. **Build artifacts** - Not included in repo; generated via `npm run build`

### Runtime Prerequisites

The prover dynamically loads snarkjs at runtime:
- If `snarkjs` is available: ZK proving works
- If `snarkjs` is missing: Graceful degradation with error message (GPL exclusion for Apache 2.0)

### Extraction Checklist

- [x] Already has `package.json` with `@p3/zk` scope
- [x] Self-contained with no P3 dependencies
- [ ] Document snarkjs GPL exclusion for Apache 2.0 builds
- [ ] Add pre-built WASM/zkey artifacts or clear build instructions
- [ ] Consider arkworks-rs or gnark as Apache 2.0 alternatives

---

## PQ Crypto (Post-Quantum)

**Purpose**: Rust-to-WASM bindings for quantum-resistant cryptography.

### File Dependencies

| File | Role |
|------|------|
| `rust/pqcrypto/src/lib.rs` | WASM-bindgen exports (scaffolded) |
| `rust/pqcrypto/Cargo.toml` | Rust dependencies |
| `rust/pqcrypto/README.md` | Documentation |

### Internal Dependencies

```
lib.rs
├── imports: pqcrypto-dilithium (commented, future)
├── imports: pqcrypto-kyber (commented, future)
├── imports: wasm-bindgen (commented, future)
└── no P3 dependencies
```

### External Dependencies (Future)

| Crate | Version | Purpose |
|-------|---------|---------|
| `pqcrypto-dilithium` | 0.8 | Lattice signatures |
| `pqcrypto-kyber` | 0.8 | Key encapsulation |
| `wasm-bindgen` | 0.2 | WASM bindings |
| `blake3` | 1.5 | Hashing |

### Environment Variables

| Variable | Required | Context |
|----------|----------|---------|
| `ENABLE_PQ` | No | Set to enable WASM build |

### Extraction Checklist

- [x] Already standalone with no P3 dependencies
- [x] Has README documentation
- [ ] Uncomment and test WASM build
- [ ] Add GitHub Actions workflow for WASM publishing
- [ ] Publish to crates.io and npm (dual package)

---

## Cross-Chain Bridge

**Purpose**: Bridge adapters for cross-chain asset transfers.

### File Dependencies

| File | Role |
|------|------|
| `packages/bridge/adapters/base-*.ts` | Chain-specific adapters |
| `packages/bridge/relay/service.ts` | Relay service |
| `packages/bridge/monitor/index.ts` | Bridge monitoring |

### Internal Dependencies

```
adapters/*.ts
├── likely imports: ethers.js
├── likely imports: chain-specific RPCs
└── TBD: needs audit

relay/service.ts
├── TBD: needs audit
└── likely imports: bridge adapters

monitor/index.ts
├── TBD: needs audit
└── likely imports: observability
```

### Extraction Checklist

- [ ] Audit all imports in bridge package
- [ ] Create package.json with proper scope
- [ ] Document supported chains
- [ ] Abstract RPC configuration

---

## Atlas Transport

**Purpose**: 8-lane multiplexed protocol with streaming, real-time updates, and intent processing.

### File Dependencies

| Directory | Role |
|-----------|------|
| `server/atlas/streaming.ts` | Video/content streaming (3000+ lines) |
| `server/atlas/routes.ts` | API routes |
| `server/atlas/core/` | Core services |
| `server/atlas/ingest/` | API manifest ingestion |
| `server/atlas/services/` | Business logic |

### Internal Dependencies

```
streaming.ts
├── imports: express, axios, multer
├── imports: server/observability/logger
├── imports: server/db (Drizzle)
├── imports: @shared/schema (nodeDailyMetrics)
└── imports: shared/nodestream-types

routes.ts
├── imports: multiple atlas/* modules
├── imports: storage interface
└── deeply coupled to full server
```

### External Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `socket.io` | Real-time communication |
| `@msgpack/msgpack` | Binary encoding |
| `axios` | HTTP client |
| `drizzle-orm` | Database ORM |

### Environment Variables

| Variable | Required | Context |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `REDIS_URL` | Optional | Caching/pub-sub |

### Extraction Difficulty: HIGH

Atlas Transport is deeply integrated with:
- Database models (`@shared/schema`)
- Storage interface (`IStorage`)
- Observability (`server/observability/`)
- Multiple service layers

**Recommendation**: Extract as a larger `@p3/atlas` package that includes necessary schema types, or refactor to accept adapters for storage/database.

---

## Existing Packages Status

The `packages/` directory already contains partially modular components:

| Package | Has package.json | Scoped Name | Standalone |
|---------|-----------------|-------------|------------|
| `packages/zk` | Yes | `@p3/zk` | Yes |
| `packages/protocol` | Yes | `@p3/protocol` | Yes (protobuf schemas only) |
| `packages/rollup` | Yes | `@p3/rollup` | Partial (has dependencies) |
| `packages/bridge` | No | - | Partial |
| `packages/react-ui` | No | - | Empty directory |
| `packages/sdk` | No | - | Minimal (1 file) |

---

## Recommended Extraction Order

Based on dependency complexity and standalone viability:

1. **ZK Circuits** (`packages/zk`) - Already standalone, just needs publishing
2. **PQ Crypto** (`rust/pqcrypto`) - Standalone, needs WASM build activation
3. **Session Bridge** - Medium coupling, well-documented seams
4. **Cross-Chain Bridge** (`packages/bridge`) - Needs audit first
5. **Atlas Transport** - High coupling, extract last or as monolithic `@p3/atlas`

---

## Next Steps

1. **Pilot extraction**: Start with `@p3/zk` - it already has package.json
2. **Add missing package.json**: Create for `packages/bridge`, `packages/sdk`
3. **Audit deep dependencies**: Map Atlas Transport's full dependency tree
4. **Setup pnpm workspace**: Create `pnpm-workspace.yaml` after first successful extraction
5. **Automate publishing**: GitHub Actions for versioning and npm/crates.io publishing
