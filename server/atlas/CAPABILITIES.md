# Atlas - Orchestration Substrate for Web3

**Atlas is the orchestration substrate — the OS layer that unifies apps, APIs, and Web3 flows.**

Unlike chatbots that simulate intelligence or API gateways that route requests, Atlas is infrastructure that executes. It spans Web2, Web3, voice, and memory from a single substrate. Every command produces real results. Every flow chains real endpoints. No hallucination. No stubs.

---

## Quickstart: Run Your First Flow in 60 Seconds

### 1. Check Your Wallet Balance (Web3)

```bash
curl -X POST https://your-domain/api/atlas/meta/web3/flow \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"flowId": "wallet-check", "address": "0xYourWallet"}'
```

**Response:**
```json
{
  "success": true,
  "flowId": "wallet-check",
  "results": {
    "balance": { "native": "7.54 ETH", "usd": "$18,245.32" },
    "tokens": [
      { "symbol": "USDC", "balance": "2,500.00" },
      { "symbol": "LINK", "balance": "150.75" }
    ]
  }
}
```

### 2. Get Your Full Portfolio Brief

```bash
curl -X POST https://your-domain/api/atlas/meta/web3/flow \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"flowId": "portfolio-brief", "address": "0xYourWallet"}'
```

**Response:**
```json
{
  "success": true,
  "flowId": "portfolio-brief",
  "results": {
    "balance": { "native": "7.54 ETH" },
    "tokens": [...],
    "gas": { "fast": "47 Gwei", "standard": "32 Gwei" }
  }
}
```

### 3. Voice Command (Natural Language)

```bash
curl -X POST https://your-domain/api/atlas/voice/utter \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"utterance": "check my balance"}'
```

Atlas understands 55+ natural language patterns and routes them to the correct endpoints automatically.

---

## Why Atlas is Different

| Traditional Approach | Atlas Substrate |
|---------------------|-----------------|
| Apps sit on platforms | Atlas IS the platform |
| APIs return data | Atlas orchestrates flows |
| Chatbots simulate actions | Atlas executes real endpoints |
| Integrations are siloed | Atlas unifies Web2 + Web3 + Voice |
| State lives in apps | State is wallet-anchored |

**The difference**: Atlas doesn't just connect services — it becomes the execution layer they run on.

---

## How Atlas Was Conceived

Atlas wasn't born from a product roadmap — it emerged from a protocol worldview. The founder's Cisco Academy background fundamentally shaped how Atlas approaches infrastructure: not as an app layer sitting on platforms, but as a mesh OS substrate that applications run *on*.

### The Founder Lens

That Cisco Academy training wired a specific mental model:

- **Protocol-first mindset** — Thinking in terms of lanes, sessions, and transport reliability. That's exactly how Atlas API 2.0's 8-lane architecture is designed.
- **Systems coherence** — Routing, switching, QoS. The instinct to build multi-vertical substrates instead of siloed apps.
- **Security awareness** — PKI, encryption, lifecycle management. Post-quantum pipelines and anchored receipts feel natural, not exotic.
- **Operational discipline** — Labs force troubleshooting, iteration, documentation. That's why audits are reproducible and credible.

Without that background, Atlas might have been framed as a product. With it, Atlas is framed as infrastructure — an OS fabric, not just a marketplace.

### The Technical Lens: Cisco → Atlas Mapping

| Cisco Concept | What It Teaches | Atlas Primitive | Evidence |
|---------------|-----------------|-----------------|----------|
| **QoS Lanes** | Prioritizing traffic flows, ensuring voice/video packets don't starve | 8 multiplexed lanes with graded readiness | ACCESS, MANIFESTS, RECEIPTS, MEDIA, COMMERCE, GOVERNANCE, NOTIFICATIONS, CHAT |
| **Session Persistence** | Keeping state across connections, handling drops gracefully | Session-native transport | Persona dots, receipts, wallet hydration, persistent settings |
| **PKI & Encryption** | Public key infrastructure, certs, secure tunnels | Anchored receipts + PQ pipeline | Blockchain receipts, post-quantum crypto, attestation APIs |
| **Routing & Switching** | Packets move through coherent paths, not chaos | Universal manifest system | Resolver logic, schema-aware payloads, catalog ingestion |
| **VLANs** | Isolating traffic for security and efficiency | Vertical substrates | Game Deck, Atlas One — each runs as a lane but unified under mesh OS |
| **Control Plane vs Data Plane** | Separation of signaling vs payload | Intent vs execution split | Voice commands (intent) vs deterministic substrate execution (data) |

### The Positioning

**Atlas is Cisco-grade infrastructure, but at the app layer.**

Traditional networking solved transport coherence at the packet level. Atlas solves execution coherence at the application level — unifying Web2, Web3, voice, and memory from a single substrate.

That's why developers who understand protocols immediately recognize Atlas as infrastructure. It's not an API gateway pretending to be smart. It's a mesh OS that applications can trust.

---

## Adding Your App to Atlas

Want your API or app to show up in Atlas? Here's the flow:

### The Manifest-to-Canvas Pipeline

```
Your Manifest → Validation → Meta-Adapter → Catalog → Canvas → Live
```

Every external API or app enters Atlas through this pipeline. There are no shortcuts.

### Step 1: Write a Manifest

A manifest declares your API's endpoints, auth requirements, and capabilities:

```json
{
  "name": "My API",
  "baseUrl": "https://api.example.com",
  "auth": "apiKey",
  "endpoints": [
    {
      "key": "my.api.users",
      "name": "Get Users",
      "method": "GET",
      "path": "/users",
      "params": [
        { "name": "limit", "required": false, "description": "Max results" }
      ],
      "samplePhrases": ["show users", "list all users"]
    }
  ]
}
```

### Step 2: Validation Layer

Atlas validates your manifest before accepting it:

- **Schema check** — Required fields present
- **Endpoint signatures** — Valid HTTP methods and paths
- **Auth declaration** — How credentials are provided
- **NL patterns** — Sample phrases for voice/natural language

If validation fails, you get a structured error explaining what's wrong.

### Step 3: Meta-Adapter (The Chokepoint)

All sources — Web2 APIs, Web3 providers, custom apps — pass through the meta-adapter:

- **Normalization** — Converts to internal catalog format
- **Pattern generation** — Auto-generates NL patterns from endpoint names
- **Key assignment** — Unique keys for every endpoint
- **Vault mapping** — Credentials stored securely, injected server-side

This is where Atlas enforces safety. No raw code execution. No credential leakage.

### Step 4: Catalog Registry

Your endpoints are indexed and queryable:

```bash
GET /api/atlas/devkit/search?q=users
```

Returns your endpoint alongside others matching "users".

### Step 5: Canvas Visibility

Once registered, your endpoints appear in:

- **DevKit** — Queryable via `/api/atlas/devkit/endpoints`
- **Voice** — Triggerable via natural language
- **Flows** — Composable with other endpoints
- **Canvas UI** — Visible and inspectable

**Transparency is enforced.** If it's in Atlas, it's visible.

### What You Can Do

- Write new manifests (Web2, Web3, custom)
- Remix existing flows (add steps to portfolio-brief)
- Publish flows to ecosystem
- Query via DevKit
- Trigger via voice/NL

### What You Cannot Do

- Bypass schema validation
- Inject raw code
- Hide endpoints from Canvas
- Access credentials directly
- Skip rate limiting

### The Key Insight

> Atlas is open to extension but closed to corruption.
> Developers plug INTO Atlas — they don't bypass its substrate rules.

---

## Core Flows (Ready to Run)

### Web3 Flows

| Flow ID | Description | Command |
|---------|-------------|---------|
| `wallet-check` | ETH balance + token holdings | `"check my balance"` |
| `portfolio-brief` | Balance + tokens + gas prices | `"show my portfolio"` |
| `nft-explorer` | NFTs across all providers | `"show my NFTs"` |
| `multi-chain` | ETH + Solana overview | `"multi-chain status"` |
| `solana-check` | Solana balances and NFTs | `"check my Solana"` |
| `web3-morning` | Morning wallet status + gas | `"web3 morning brief"` |

### Web2 Flows

| Flow ID | Description | Command |
|---------|-------------|---------|
| `morning-brief` | Weather + holiday + quote | `"good morning"` |
| `weather-and-joke` | Weather + random joke | `"weather and joke"` |
| `crypto-and-news` | Crypto prices + headlines | `"crypto news"` |
| `fun-facts` | Dog pic + cat fact + quote | `"fun facts"` |
| `science-discovery` | NASA APOD + SpaceX | `"science discovery"` |

---

## Web3 Providers (Live)

Atlas integrates 3 Web3 providers with 12 curated endpoints:

### Moralis (EVM)
```
web3.moralis.wallet_balance   - Native token balance
web3.moralis.token_balances   - All ERC20 tokens
web3.moralis.nfts             - Owned NFTs
web3.moralis.transactions     - Transaction history
web3.moralis.token_price      - Token prices
```

### Alchemy (Ethereum)
```
web3.alchemy.gas_price        - Current gas prices
web3.alchemy.token_balances   - Token balances
web3.alchemy.nft_ownership    - NFT verification
web3.alchemy.nft_floor_price  - NFT floor prices
```

### Helius (Solana)
```
web3.helius.balances          - Solana tokens
web3.helius.nfts              - Solana NFTs
web3.helius.transactions      - Solana transactions
```

---

## API Quick Reference

### Execute a Web3 Endpoint
```bash
POST /api/atlas/meta/web3/execute
Body: { "key": "web3.moralis.wallet_balance", "params": { "address": "0x..." } }
```

### Execute a Flow
```bash
POST /api/atlas/meta/web3/flow
Body: { "flowId": "portfolio-brief", "address": "0x...", "chain": "ethereum" }
```

### Voice Command
```bash
POST /api/atlas/voice/utter
Body: { "utterance": "check my balance", "tts": true }
```

### List All Endpoints
```bash
GET /api/atlas/devkit/endpoints
```

### Search Endpoints
```bash
GET /api/atlas/devkit/search?q=balance
```

---

## Natural Language Patterns

Atlas uses 3-tier intent matching: Regex patterns, keyword mappings, then semantic fallback.

### Web3 Commands
- `"check my balance"` → `web3.moralis.wallet_balance`
- `"what tokens do I have"` → `web3.moralis.token_balances`
- `"show my NFTs"` → `web3.moralis.nfts`
- `"current gas price"` → `web3.alchemy.gas_price`
- `"show my portfolio"` → `web3.flow.portfolio-brief`

### Memory Commands
- `"pin Slack"` → `memory_pin`
- `"my recent flows"` → `memory_flows`
- `"clear my history"` → `memory_clear`

### External App Commands
- `"open Spotify"` → `external_launch`
- `"check my GitHub"` → `proxy.github.repos`
- `"send email"` → `proxy.gmail.compose`

---

## Architecture: Substrate + Semantic Layer

Atlas is the **execution substrate**. External LLMs provide **semantic interpretation**.

```
User Intent → LLM Parse → Atlas Execute → LLM Narrate → Response
```

### Atlas (Substrate) Handles:
- Flow execution across APIs
- Web3 queries (Moralis, Alchemy, Helius)
- Memory persistence (wallet-anchored)
- Manifest-based endpoint discovery
- Structured JSON results
- **Never halluccinates** — only executes real endpoints

### LLM (Semantic) Handles:
- Intent parsing from natural language
- Response narration
- Multi-turn context tracking
- Flow chaining decisions
- Fallback guidance

### Security Boundaries
- LLM never holds API keys — Atlas injects credentials server-side
- LLM never executes directly — all execution flows through Atlas
- Wallet-scoped sessions — context isolated per user

---

## Session Memory

Wallet-anchored state persists across sessions:

```bash
GET /api/atlas/memory          # Full session state
GET /api/atlas/memory/pinned   # Pinned apps
GET /api/atlas/memory/flows    # Recent flow executions
GET /api/atlas/memory/queries  # Query history
POST /api/atlas/memory/pin     # Pin an app
POST /api/atlas/memory/clear   # Clear history
```

---

## DevKit (Introspection)

Query Atlas about itself:

```bash
GET /api/atlas/devkit/endpoints     # 128+ endpoints
GET /api/atlas/devkit/apps          # 11 registered apps
GET /api/atlas/devkit/flows         # 15+ compound flows
POST /api/atlas/devkit/query        # Natural language queries
  Body: { "query": "how do I check NFTs?" }
```

---

## Meta-Adapter (50+ Public APIs)

Atlas auto-ingests public APIs as live endpoints:

**Categories**: Weather, Crypto, Animals, Science, Games, Food, Books, Geocoding, Entertainment

```bash
GET /api/atlas/meta/status      # Adapter status
GET /api/atlas/meta/apis        # List APIs
POST /api/atlas/meta/execute    # Execute endpoint
POST /api/atlas/meta/flow       # Execute compound flow
```

---

## Stats

| Category | Count |
|----------|-------|
| Core Endpoints | 128+ |
| Registered Apps | 11 |
| Public APIs | 50+ |
| Web3 Providers | 3 |
| Web3 Endpoints | 12 |
| Compound Flows | 15+ |
| NL Intents | 55+ |

---

## The Bottom Line

Atlas isn't a chatbot, an API gateway, or an integration layer. It's the **orchestration substrate** — the OS layer that unifies apps, APIs, and Web3 flows into a single executable surface.

Run `wallet-check`. Run `portfolio-brief`. Watch real data flow through real endpoints. That's the proof.

---

**Atlas v2.0** — Production Ready
