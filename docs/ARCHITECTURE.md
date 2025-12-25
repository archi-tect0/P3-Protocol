# P3 Protocol - System Architecture

**Privacy-Preserving Proof-of-Communication Protocol**

This document provides a comprehensive overview of the P3 Protocol architecture, components, data flows, and design decisions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Database Schemas](#database-schemas)
5. [Smart Contracts](#smart-contracts)
6. [ZK Proof System](#zk-proof-system)
7. [Cross-Chain Bridge](#cross-chain-bridge)
8. [Rollup Infrastructure](#rollup-infrastructure)
9. [Security Model](#security-model)
10. [API Layer](#api-layer)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Auth   │  │ Receipts │  │   DAO    │  │   Messaging  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS/WSS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │   Auth   │  │  Receipts│  │   DAO    │  │   Services   │   │
│  │  Routes  │  │  Routes  │  │  Routes  │  │   Routes     │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└───┬────────────┬──────────────┬─────────────┬──────────────────┘
    │            │              │             │
    ▼            ▼              ▼             ▼
┌──────┐   ┌──────────┐   ┌─────────┐   ┌──────────┐
│ Postgres│  │ ZK Prover│   │Smart    │   │ Rollup   │
│Database │  │  System  │   │Contracts│   │ Services │
└──────┘   └──────────┘   └─────────┘   └──────────┘
    │            │              │             │
    │            │              ▼             ▼
    │            │         ┌──────────────────────┐
    │            │         │   Base Network       │
    │            │         │  (Layer 1/Layer 2)   │
    │            │         └──────────────────────┘
    │            │
    │            ▼
    │       ┌──────────┐
    │       │ IPFS/DA  │
    │       │  Layer   │
    │       └──────────┘
    │
    ▼
┌──────────────┐
│  Trust Layer │
│   Plugins    │
└──────────────┘
```

### Core Components

1. **Frontend Layer** - React SPA with wallet integration
2. **API Gateway** - Express.js REST/WebSocket server
3. **Database Layer** - PostgreSQL with Drizzle ORM
4. **Smart Contracts** - Solidity contracts on Base network
5. **ZK Prover** - Zero-knowledge proof generation system
6. **Rollup Services** - L2 sequencer, state manager, checkpoint service
7. **Trust Layer** - Configurable trust policies and plugins
8. **Cross-Chain Bridge** - Multi-chain receipt relay system

---

## Component Architecture

### 1. API Gateway (Express)

**Location:** `server/`

**Responsibilities:**
- HTTP REST API endpoints
- WebSocket connections
- Authentication & authorization (JWT)
- Rate limiting
- Request validation (Zod schemas)
- Logging (Pino)
- Metrics collection (Prometheus)

**Key Files:**
- `server/index.ts` - Main entry point
- `server/routes.ts` - Core route definitions
- `server/auth.ts` - JWT authentication middleware
- `server/dao-routes.ts` - DAO governance endpoints
- `server/app-routes.ts` - Messaging/notes/directory endpoints
- `server/services-routes.ts` - ENS resolver, webhooks, exports
- `server/rollup-routes.ts` - Rollup sequencer endpoints

**Technology Stack:**
- Express.js 4.x
- JWT for authentication
- Zod for validation
- Pino for logging
- Prometheus for metrics

### 2. Database Layer (PostgreSQL)

**Location:** `server/pg-storage.ts`, `shared/schema.ts`

**Responsibilities:**
- Data persistence
- Transaction management
- Query optimization
- Connection pooling

**Schema Organization:**
```
├── Core Tables
│   ├── users (authentication)
│   ├── receipts (communication receipts)
│   └── audit_log (compliance tracking)
│
├── Ledger Tables
│   ├── ledger_events (event sourcing)
│   ├── allocations (token distributions)
│   └── telemetry_events (usage tracking)
│
├── Trust Layer Tables
│   ├── trust_config (policy configuration)
│   ├── trust_rules (rule definitions)
│   ├── trust_plugins (plugin registry)
│   └── wallet_registry (known wallets)
│
├── App Layer Tables
│   ├── messages (encrypted messaging)
│   ├── notes (wallet-scoped notes)
│   ├── directory_entries (ENS/Basename directory)
│   └── inbox_items (message inbox)
│
├── Bridge Tables
│   └── bridge_jobs (cross-chain relays)
│
└── DAO Tables
    └── dao_proposals (governance proposals)
```

**Connection Pooling:**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,              // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 3. Smart Contracts (Solidity)

**Location:** `contracts/`

**Contract Architecture:**

```
┌─────────────────────────────────────────────────────┐
│                 Governance Layer                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │GovernanceToken│  │  GovernorP3  │  │ Treasury │  │
│  │   (ERC20)    │  │  (Governor)  │  │(Timelock)│  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                   Core Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │AnchorRegistry│  │ConsentRegistry│ │  Receipt │  │
│  │  (Registry)  │  │  (Registry)  │  │BoundToken│  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  Trust Layer                         │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │TrustPolicyRouter│ │ZKReceipts  │                 │
│  │  (Router)    │  │  Verifier   │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

**Contracts:**

1. **GovernanceToken** (ERC20)
   - Voting power token
   - Transferable governance rights
   - Used in DAO proposals

2. **GovernorP3** (OpenZeppelin Governor)
   - On-chain governance
   - Proposal creation and voting
   - Timelock integration

3. **Treasury** (Timelock)
   - Secure fund management
   - Delayed execution
   - Multi-sig compatible

4. **AnchorRegistry**
   - Merkle root anchoring
   - Receipt batch commitments
   - Immutable audit trail

5. **ConsentRegistry**
   - User consent tracking
   - Privacy preferences
   - GDPR compliance

6. **ReceiptBoundToken** (ERC721)
   - Non-transferable receipts
   - Soulbound tokens
   - Proof of communication

7. **TrustPolicyRouter**
   - Policy enforcement
   - Rule evaluation
   - Plugin integration

8. **ZKReceiptsVerifier**
   - ZK proof verification
   - Groth16 verifier
   - On-chain validation

### 4. ZK Proof System

**Location:** `packages/zk/`

**Architecture:**

```
┌─────────────────────────────────────────────────────┐
│                    Circuits                          │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │MessageReceipt│  │MeetingReceipt│                 │
│  │   Circuit    │  │   Circuit    │                 │
│  └──────────────┘  └──────────────┘                 │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │PaymentReceipt│  │ConsentState  │                 │
│  │   Circuit    │  │   Circuit    │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                   Prover Service                     │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ WASM Witness │  │Groth16 Prover│                 │
│  │  Calculator  │  │   (snarkjs)  │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                 Verification Layer                   │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │  Off-chain   │  │  On-chain    │                 │
│  │ Verification │  │ Verification │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

**Circuits:**

1. **MessageReceipt.circom**
   - Proves message was sent/received
   - Inputs: messageHash, sender, recipient, timestamp
   - Outputs: proof, publicSignals

2. **MeetingReceipt.circom**
   - Proves meeting participation
   - Inputs: meetingId, participants[], duration
   - Outputs: proof, publicSignals

3. **PaymentReceipt.circom**
   - Proves payment was made
   - Inputs: amount, sender, recipient, txHash
   - Outputs: proof, publicSignals

4. **ConsentState.circom**
   - Proves consent state without revealing details
   - Inputs: consentRoot, preferences[]
   - Outputs: proof, publicSignals

**Proof Generation Flow:**

```
1. User action → Generate inputs
2. Inputs → WASM witness calculator
3. Witness + Proving key → Groth16 prover
4. Prover → Generate proof + public signals
5. Proof → Verify off-chain (optional)
6. Proof → Submit to smart contract
7. Smart contract → Verify proof on-chain
8. Verified → Execute action
```

### 5. Rollup Infrastructure

**Location:** `packages/rollup/`

**Components:**

```
┌─────────────────────────────────────────────────────┐
│                   Sequencer                          │
│  - Batch events into Merkle trees                    │
│  - Generate state roots                              │
│  - Submit to L1 anchor registry                      │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│                  State Manager                       │
│  - Manage L2 state transitions                       │
│  - Store event indices                               │
│  - Track consent roots                               │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Data Availability Adapter               │
│  - Publish batches to L1 (calldata)                  │
│  - Optional: EIP-4844 blob storage                   │
│  - Ensure data retrievability                        │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│              Checkpoint Service                      │
│  - Periodic L1 state anchoring                       │
│  - Finality guarantees                               │
│  - Fraud proof submission                            │
└─────────────────────────────────────────────────────┘
```

**Sequencer Flow:**

```
1. Events arrive → Add to pending queue
2. Wait for batch interval (30s) or max size (1000)
3. Build Merkle tree from events
4. Calculate Merkle root
5. Submit batch to AnchorRegistry
6. Update state manager
7. Publish data to DA layer
8. Emit batch confirmation
```

---

## Data Flow Diagrams

### Receipt Creation Flow

```
┌──────┐         ┌────────┐         ┌──────────┐         ┌─────────┐
│Client│         │ API    │         │ Database │         │ Smart   │
│      │         │ Server │         │          │         │Contract │
└──┬───┘         └───┬────┘         └────┬─────┘         └────┬────┘
   │                 │                   │                    │
   │ POST /receipts  │                   │                    │
   ├────────────────>│                   │                    │
   │                 │                   │                    │
   │            Validate request         │                    │
   │                 │                   │                    │
   │                 │ Create receipt    │                    │
   │                 ├──────────────────>│                    │
   │                 │                   │                    │
   │                 │ Receipt created   │                    │
   │                 │<──────────────────┤                    │
   │                 │                   │                    │
   │            Generate ZK proof        │                    │
   │                 │                   │                    │
   │                 │                   │                    │
   │                 │                   │ Mint receipt NFT   │
   │                 │                   ├───────────────────>│
   │                 │                   │                    │
   │                 │                   │ NFT minted (txHash)│
   │                 │                   │<───────────────────┤
   │                 │                   │                    │
   │                 │ Update with txHash│                    │
   │                 ├──────────────────>│                    │
   │                 │                   │                    │
   │ 201 Created     │                   │                    │
   │<────────────────┤                   │                    │
   │ {receipt,proof} │                   │                    │
   │                 │                   │                    │
```

### DAO Proposal Flow

```
┌──────┐      ┌────────┐      ┌──────────┐      ┌─────────┐      ┌─────────┐
│Client│      │  API   │      │ Database │      │Governor │      │Timelock │
│      │      │ Server │      │          │      │Contract │      │Contract │
└──┬───┘      └───┬────┘      └────┬─────┘      └────┬────┘      └────┬────┘
   │              │                │                 │                 │
   │ POST proposal│                │                 │                 │
   ├─────────────>│                │                 │                 │
   │              │                │                 │                 │
   │         Validate & create     │                 │                 │
   │              │                │                 │                 │
   │              │                │  propose()      │                 │
   │              │                ├────────────────>│                 │
   │              │                │                 │                 │
   │              │                │ proposalId      │                 │
   │              │                │<────────────────┤                 │
   │              │                │                 │                 │
   │              │ Store proposal │                 │                 │
   │              ├───────────────>│                 │                 │
   │              │                │                 │                 │
   │ Created      │                │                 │                 │
   │<─────────────┤                │                 │                 │
   │              │                │                 │                 │
   │              │      Voting Period (7 days)      │                 │
   │              │                │                 │                 │
   │ POST vote    │                │                 │                 │
   ├─────────────>│                │                 │                 │
   │              │                │  castVote()     │                 │
   │              │                ├────────────────>│                 │
   │              │                │                 │                 │
   │              │      Voting Succeeded            │                 │
   │              │                │                 │                 │
   │ POST queue   │                │                 │                 │
   ├─────────────>│                │                 │                 │
   │              │                │  queue()        │                 │
   │              │                ├────────────────>│                 │
   │              │                │                 │                 │
   │              │                │                 │ schedule()      │
   │              │                │                 ├────────────────>│
   │              │                │                 │                 │
   │              │      Timelock Delay (2 days)     │                 │
   │              │                │                 │                 │
   │ POST execute │                │                 │                 │
   ├─────────────>│                │                 │                 │
   │              │                │  execute()      │                 │
   │              │                ├────────────────>│                 │
   │              │                │                 │                 │
   │              │                │                 │ execute()       │
   │              │                │                 ├────────────────>│
   │              │                │                 │                 │
   │              │                │                 │ Executed ✓      │
   │              │                │                 │<────────────────┤
   │              │                │                 │                 │
   │ Executed     │                │                 │                 │
   │<─────────────┤                │                 │                 │
   │              │                │                 │                 │
```

### Cross-Chain Bridge Flow

```
┌──────┐      ┌────────┐      ┌─────────┐      ┌─────────┐      ┌────────┐
│Client│      │  API   │      │ Bridge  │      │ Source  │      │Target  │
│      │      │ Server │      │ Client  │      │ Chain   │      │ Chain  │
└──┬───┘      └───┬────┘      └────┬────┘      └────┬────┘      └────┬───┘
   │              │                │                │                │
   │ POST relay   │                │                │                │
   ├─────────────>│                │                │                │
   │              │                │                │                │
   │         Create bridge job     │                │                │
   │              │                │                │                │
   │              │  relayReceipt()│                │                │
   │              ├───────────────>│                │                │
   │              │                │                │                │
   │              │                │ getReceipt()   │                │
   │              │                ├───────────────>│                │
   │              │                │                │                │
   │              │                │ receipt data   │                │
   │              │                │<───────────────┤                │
   │              │                │                │                │
   │              │                │ Generate proof │                │
   │              │                │                │                │
   │              │                │                │ verifyAndMint()│
   │              │                │                ├───────────────>│
   │              │                │                │                │
   │              │                │                │ Minted (txHash)│
   │              │                │                │<───────────────┤
   │              │                │                │                │
   │              │  Update job    │                │                │
   │              │<───────────────┤                │                │
   │              │  status=success│                │                │
   │              │                │                │                │
   │ Success      │                │                │                │
   │<─────────────┤                │                │                │
   │ {txHash}     │                │                │                │
   │              │                │                │                │
```

---

## Database Schemas

### Core Tables

#### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### receipts
```sql
CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  subject_type TEXT,
  content TEXT,
  metadata JSONB,
  merkle_proof JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  on_chain_tx_hash TEXT,
  token_id TEXT
);

CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_type ON receipts(type);
CREATE INDEX idx_receipts_subject_id ON receipts(subject_id);
CREATE INDEX idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX idx_receipts_metadata ON receipts USING gin(metadata);
```

#### audit_log
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
```

### Ledger Tables

#### ledger_events
```sql
CREATE TABLE ledger_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  receipt_id TEXT REFERENCES receipts(id),
  amount TEXT,
  metadata JSONB,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ledger_user ON ledger_events(user_id);
CREATE INDEX idx_ledger_type ON ledger_events(event_type);
CREATE INDEX idx_ledger_ts ON ledger_events(ts DESC);
```

### Trust Layer Tables

#### trust_config
```sql
CREATE TABLE trust_config (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  enforcement_mode TEXT NOT NULL,
  default_action TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trust_wallet ON trust_config(wallet_address);
```

#### trust_rules
```sql
CREATE TABLE trust_rules (
  id TEXT PRIMARY KEY,
  config_id TEXT NOT NULL REFERENCES trust_config(id),
  rule_type TEXT NOT NULL,
  conditions JSONB NOT NULL,
  action TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  metadata JSONB
);

CREATE INDEX idx_rules_config ON trust_rules(config_id);
CREATE INDEX idx_rules_type ON trust_rules(rule_type);
CREATE INDEX idx_rules_priority ON trust_rules(priority DESC);
```

### App Layer Tables

#### messages
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_wallet TEXT NOT NULL,
  to_wallet TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  ipfs_cid TEXT,
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP
);

CREATE INDEX idx_messages_from ON messages(from_wallet);
CREATE INDEX idx_messages_to ON messages(to_wallet);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

#### notes
```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  title TEXT NOT NULL,
  encrypted_body TEXT NOT NULL,
  searchable_content TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_pinned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notes_wallet ON notes(wallet_address);
CREATE INDEX idx_notes_pinned ON notes(is_pinned);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX idx_notes_searchable ON notes USING gin(to_tsvector('english', searchable_content));
```

### DAO Tables

#### dao_proposals
```sql
CREATE TABLE dao_proposals (
  id TEXT PRIMARY KEY,
  proposal_id TEXT UNIQUE NOT NULL,
  proposer TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  targets TEXT[] NOT NULL,
  values TEXT[] NOT NULL,
  calldatas TEXT[] NOT NULL,
  status TEXT NOT NULL,
  votes_for TEXT DEFAULT '0',
  votes_against TEXT DEFAULT '0',
  votes_abstain TEXT DEFAULT '0',
  start_block TEXT,
  end_block TEXT,
  eta TIMESTAMP,
  tx_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dao_proposal_id ON dao_proposals(proposal_id);
CREATE INDEX idx_dao_status ON dao_proposals(status);
CREATE INDEX idx_dao_proposer ON dao_proposals(proposer);
```

---

## Smart Contracts

### Contract Interactions

#### GovernorP3

**Functions:**
- `propose(targets, values, calldatas, description)` - Create proposal
- `castVote(proposalId, support)` - Vote on proposal
- `queue(targets, values, calldatas, descriptionHash)` - Queue proposal
- `execute(targets, values, calldatas, descriptionHash)` - Execute proposal
- `state(proposalId)` - Get proposal state
- `proposalVotes(proposalId)` - Get vote counts

**Events:**
- `ProposalCreated(proposalId, proposer, targets, values, calldatas, description)`
- `VoteCast(voter, proposalId, support, weight, reason)`
- `ProposalQueued(proposalId, eta)`
- `ProposalExecuted(proposalId)`

#### AnchorRegistry

**Functions:**
- `anchor(merkleRoot, batchSize, metadata)` - Anchor batch
- `getBatch(batchId)` - Get batch details
- `verifyInclusion(batchId, proof, leaf)` - Verify Merkle proof

**Events:**
- `BatchAnchored(batchId, merkleRoot, batchSize, timestamp)`

#### ZKReceiptsVerifier

**Functions:**
- `verifyProof(proof, publicSignals)` - Verify ZK proof
- `setVerificationKey(vkey)` - Update verification key (admin)

**Events:**
- `ProofVerified(proofHash, timestamp)`

---

## Security Model

### Authentication & Authorization

```
┌─────────────────────────────────────────────────────┐
│                 Authentication                       │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │   Password   │  │   Wallet     │                 │
│  │     Auth     │  │     Auth     │                 │
│  └──────────────┘  └──────────────┘                 │
│          │                  │                        │
│          └──────────┬───────┘                        │
│                     ▼                                │
│              ┌──────────────┐                        │
│              │  JWT Token   │                        │
│              └──────────────┘                        │
└─────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                 Authorization                        │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │     RBAC     │  │   Resource   │                 │
│  │   (Roles)    │  │  Ownership   │                 │
│  └──────────────┘  └──────────────┘                 │
└─────────────────────────────────────────────────────┘
```

### Security Layers

1. **Transport Security**
   - TLS 1.3 for all HTTPS traffic
   - WSS for WebSocket connections
   - Certificate pinning (mobile apps)

2. **Application Security**
   - JWT token authentication
   - RBAC (admin, user roles)
   - Rate limiting (100 req/min per IP)
   - Input validation (Zod schemas)
   - SQL injection prevention (parameterized queries)
   - XSS prevention (Content Security Policy)

3. **Data Security**
   - Password hashing (bcrypt, cost=10)
   - Encrypted messaging (X25519+XChaCha20)
   - Encrypted notes (client-side encryption)
   - Database encryption at rest
   - Backup encryption

4. **Smart Contract Security**
   - OpenZeppelin contracts
   - Access control (Ownable, AccessControl)
   - Reentrancy protection
   - Integer overflow protection (Solidity 0.8+)
   - Timelock for governance
   - Multi-sig for critical operations

5. **ZK Security**
   - Trusted setup verification
   - Proof validation
   - Circuit auditing
   - Groth16 scheme

### Threat Model

**Threats Mitigated:**
- ✓ SQL injection
- ✓ XSS attacks
- ✓ CSRF attacks
- ✓ Replay attacks
- ✓ Man-in-the-middle
- ✓ Brute force authentication
- ✓ Smart contract reentrancy
- ✓ Front-running (MEV)
- ✓ Proof forgery

**Risks & Mitigations:**
- **Private key compromise** → Hardware wallets, multi-sig
- **Database breach** → Encryption at rest, access controls
- **DoS attacks** → Rate limiting, CDN, load balancing
- **ZK circuit bugs** → Formal verification, audits
- **Governance attacks** → Timelock, token distribution

---

## API Layer

### REST API

**Base URL:** `https://api.p3protocol.com`

**Authentication:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Endpoints:**
- Authentication: `/api/auth/*`
- Receipts: `/api/receipts/*`
- DAO: `/api/dao/*`
- Messages: `/api/messages/*`
- Notes: `/api/notes/*`
- Directory: `/api/directory/*`
- Services: `/api/services/*`
- Rollup: `/api/rollup/*`

See [API.md](API.md) for complete documentation.

### WebSocket API

**URL:** `wss://api.p3protocol.com/socket.io`

**Events:**
- `receipt:created` - New receipt created
- `message:received` - New message received
- `proposal:created` - New DAO proposal
- `proof:generated` - ZK proof completed

---

**For more information:**
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment guide
- [RUNBOOK.md](RUNBOOK.md) - Operations procedures
- [API.md](API.md) - Complete API reference
