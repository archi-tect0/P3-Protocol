# Atlas Manifest Schema

## The Core Principle: "Written for Them, Not for Us"

Atlas doesn't demand that apps be rewritten for it. Instead, Atlas is architected as a **substrate** that speaks the dialects those apps already expect. The manifest is the only contract between your app and Atlas - everything else is yours.

```
Traditional OS:          Atlas Substrate:
┌──────────────┐        ┌──────────────┐
│   Your App   │        │   Your App   │
│   (rewrite   │        │   (as-is)    │
│   for OS)    │        │              │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  OS APIs     │        │   Manifest   │ ← The only contract
│  (learn us)  │        │   (JSON)     │
└──────────────┘        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │    Atlas     │
                        │  (interprets │
                        │  & executes) │
                        └──────────────┘
```

---

## Manifest Types

Atlas supports two manifest types:

### 1. Protocol-Native Apps (P3 Apps)

For apps built within the P3 ecosystem with wallet-anchored actions:

```typescript
interface AppManifest {
  id: string;                    // Unique identifier
  title: string;                 // Display name
  version: string;               // Semantic version
  category: string;              // 'security' | 'payments' | 'creative' | 'social' | 'governance' | 'analytics' | 'developer' | 'games'
  description: string;           // What it does
  
  developer: {
    name: string;
    contact: string;             // mailto: or URL
    website: string;
  };
  
  permissions: Permission[];     // 'wallet' | 'payments' | 'messaging' | 'storage' | 'anchoring' | 'notifications'
  
  widgets?: Widget[];            // Optional tile widgets
  contextMenu?: MenuItem[];      // Optional context actions
  links: {
    pwa: string;                 // Entry point URL
    deeplinks?: Record<string, string>;
  };
}
```

**Example: A payment invoice app**
```json
{
  "id": "invoice",
  "title": "Invoice",
  "version": "1.0.0",
  "category": "payments",
  "description": "Create and manage invoices with on-chain payment tracking.",
  "developer": {
    "name": "Dciphrs",
    "contact": "mailto:dev@dciphrs.io",
    "website": "https://dciphrs.io/apps/invoice"
  },
  "permissions": ["wallet", "payments", "anchoring"],
  "widgets": [
    { "id": "invoice-pending", "title": "Pending", "size": "1x1", "entry": "/standalone/invoice/widget.html" }
  ],
  "contextMenu": [
    { "id": "create-invoice", "label": "Create invoice", "action": "create" }
  ],
  "links": { "pwa": "/standalone/invoice/" }
}
```

### 2. External Apps (Third-Party Integrations)

For apps outside the P3 ecosystem, connecting via OAuth or API proxy:

```typescript
interface ExternalAppManifest {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  icon: string;                  // Emoji or icon URL
  url: string;                   // App's home URL
  gradient: string;              // Tailwind gradient classes
  launchMode: LaunchMode;        // 'embed' | 'tab' | 'popup' | 'redirect'
  embeddable: boolean;           // Can be iframed?
  
  oauthConnector?: string;       // OAuth connector ID (if needed)
  proxyStatus: ProxyStatus;      // 'available' | 'oauth_required' | 'unavailable'
  
  actions: AppAction[];          // Executable actions
  atlasIntents: string[];        // Natural language triggers
  scopes: string[];              // Required OAuth scopes
}

interface AppAction {
  id: string;                    // Action identifier
  name: string;                  // Display name
  description: string;           // What it does
  endpoint: string;              // API endpoint
  params: string[];              // Required parameters
  requiresAuth: boolean;         // Needs OAuth?
}
```

**Example: Gmail integration**
```json
{
  "id": "gmail",
  "name": "Gmail",
  "icon": "📧",
  "url": "https://mail.google.com",
  "gradient": "from-red-500 to-red-600",
  "launchMode": "tab",
  "embeddable": false,
  "oauthConnector": "gmail",
  "proxyStatus": "oauth_required",
  "actions": [
    { "id": "compose", "name": "Compose Email", "description": "Create a new email", "endpoint": "/api/proxy/gmail/compose", "params": ["to", "subject", "body"], "requiresAuth": true },
    { "id": "search", "name": "Search Inbox", "description": "Search emails", "endpoint": "/api/proxy/gmail/search", "params": ["query"], "requiresAuth": true },
    { "id": "unread", "name": "Unread Count", "description": "Get unread email count", "endpoint": "/api/proxy/gmail/unread", "params": [], "requiresAuth": true },
    { "id": "send", "name": "Send Email", "description": "Send an email", "endpoint": "/api/proxy/gmail/send", "params": ["to", "subject", "body"], "requiresAuth": true }
  ],
  "atlasIntents": ["send email to", "compose email", "check my inbox", "search emails for", "how many unread emails"],
  "scopes": ["email.read", "email.compose", "email.send"]
}
```

---

## How Atlas Uses Manifests

### 1. Registration & Discovery

```
Developer → /api/atlas/canvas/register → Atlas Registry
                                              │
                                              ▼
                                        Manifest stored
                                        in capability map
```

### 2. Intent Resolution

When a user says "send email to John":

```
User Intent: "send email to John"
        │
        ▼
┌─────────────────────────────────┐
│  Intent Matcher (3-tier)        │
│  1. Regex patterns              │
│  2. Keyword mappings            │
│  3. Semantic fallback           │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Manifest Lookup                │
│  atlasIntents: ["send email to"]│
│  → gmail.actions.compose        │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Execution                      │
│  POST /api/proxy/gmail/compose  │
│  { to: "John", subject: "...",  │
│    body: "..." }                │
└─────────────────────────────────┘
```

### 3. Canvas Auto-Materialization

The manifest's structure determines how the UI renders:

```typescript
// In manifest
"widgets": [
  { "id": "invoice-pending", "title": "Pending", "size": "1x1", "entry": "/widget.html" }
]

// Atlas automatically generates
<CanvasCard
  id="invoice-pending"
  title="Pending"
  size="1x1"
  src="/widget.html"
/>
```

---

## Language-Agnostic Execution

Atlas doesn't care what language your app uses. The manifest normalizes everything:

| App Language | What You Provide | What Atlas Sees |
|-------------|------------------|-----------------|
| Python Flask | `/api/v1/create` | endpoint: `/api/v1/create` |
| Node Express | `/invoices/new` | endpoint: `/invoices/new` |
| Rust Actix | `/submit` | endpoint: `/submit` |
| Solidity | `createInvoice()` | endpoint: contract call |

The substrate interprets and materializes flows from whatever language or framework you chose, as long as the manifest is correct.

---

## Security Model

### Credential Isolation
- LLMs never hold API keys
- All execution flows through Atlas with server-side injection
- Manifest declares what scopes are needed, Atlas manages the OAuth dance

### Wallet Anchoring
- Protocol-native apps require wallet signature for sensitive operations
- Every action can be anchored on-chain for auditability
- Session tickets bind to wallet address

---

## Minimal Manifest Template

The absolute minimum to get your app working with Atlas:

```json
{
  "id": "my-app",
  "title": "My App",
  "version": "1.0.0",
  "category": "developer",
  "description": "What my app does",
  "developer": {
    "name": "Your Name",
    "contact": "mailto:you@example.com",
    "website": "https://example.com"
  },
  "permissions": ["wallet"],
  "links": { "pwa": "/my-app/" }
}
```

That's it. No P3-specific code required in your app. Just a JSON contract.

---

## Chat-Enabled Endpoints (Developer Private APIs)

Developers can register endpoints that respond to natural language queries in Atlas chat. This lets you say "check my app status" or "show my sales" and Atlas will call your private endpoint.

### Adding Chat to Your Endpoints

When registering an endpoint via Canvas, add these fields:

```json
{
  "devkit.key": "my-app.sales",
  "name": "My Sales Report",
  "method": "GET",
  "url": "https://myapi.com/sales",
  "security.visibility": "wallet-gated",
  "security.ownerWallet": "0x1234...",
  "security.collaborators": ["0x5678...", "0x9abc..."],
  "semantics.phrases": [
    "show my sales",
    "how many sales today",
    "sales report",
    "check revenue"
  ],
  "chat.enabled": true,
  "chat.authMode": "owner",
  "canvas.display": {
    "type": "card",
    "title": "Sales Report",
    "fields": [
      { "label": "Total", "key": "total", "format": "currency" }
    ]
  }
}
```

### Chat Authorization Modes

| Mode | Who Can Access |
|------|----------------|
| `owner` | Only the wallet in `security.ownerWallet` |
| `collaborators` | Owner + wallets in `security.collaborators` |
| `public` | Any authenticated wallet |

### How It Works

1. Developer registers endpoint with `semantics.phrases`
2. User says "show my sales" in Atlas chat
3. Atlas matches the phrase to your endpoint
4. Atlas verifies caller wallet against `chat.authMode`
5. Atlas calls your endpoint with `X-Atlas-Wallet` header
6. Response is displayed in chat

### Example Flow

```
Developer Manifest:
├── semantics.phrases: ["show my sales", "revenue today"]
├── security.ownerWallet: "0x1234..."
├── chat.authMode: "owner"
└── url: "https://myapi.com/sales"

User (wallet 0x1234...) says: "show my sales"
  ↓
Atlas matches "show my sales" → my-app.sales (score: 100)
  ↓
Atlas checks: 0x1234... == ownerWallet? ✓
  ↓
Atlas calls: GET https://myapi.com/sales
  Headers: X-Atlas-Wallet: 0x1234...
  ↓
Response displayed in chat
```

---

## Canvas Mode Registration

Atlas Canvas renders capabilities as native UI modes. The 7 Nexus-powered modes demonstrate this pattern:

| Mode | Endpoint | Canvas Type |
|------|----------|-------------|
| InboxMode | `/api/nexus/inbox` | Notification list |
| MessagesMode | `/api/nexus/messaging/list` | Conversation list |
| CallsMode | `/api/nexus/calls/active` | Active/history list |
| DirectoryMode | `/api/nexus/directory` | Contact grid |
| PaymentsMode | `/api/payments` | Transaction list |
| ReceiptsMode | `/api/nexus/receipts` | Blockchain explorer |
| NotesMode | `/api/nexus/notes` | Note grid |

### Wallet Header Injection

Canvas modes automatically receive wallet context via `x-wallet-address` header injection in the queryClient. No manual header management required.

### Receipt Instrumentation

Every Canvas mode should push receipts for:
- **Success**: Data loaded successfully
- **Empty**: Valid response with no data
- **Error**: Request failed

This creates cryptographic audit trails for all UI renders.

---

## Why This Matters

Traditional OSes are "platforms apps run on."
Atlas is "a substrate apps are materialized through."

The distinction is subtle but huge:
- Apps don't need to learn Atlas APIs
- Apps don't need to be rewritten
- Apps keep their own language/framework choices
- Atlas just needs the manifest to know what you can do

**The OS bends to the apps, not the other way around.**

---

## See Also

- [Nexus-Atlas Canvas Integration](../NEXUS_CANVAS_INTEGRATION.md) - Full integration guide
- [Atlas Developer Guide](../ATLAS_DEVELOPER_GUIDE.md) - Building apps for Atlas
