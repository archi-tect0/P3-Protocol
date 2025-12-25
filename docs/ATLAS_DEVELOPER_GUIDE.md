# How to Write an App for Atlas in 5 Steps

Atlas is the conversational OS layer for the P3 Protocol mesh. Apps written for Atlas don't need dashboards, onboarding flows, or complex UIs. They just need a manifest.

---

## Step 1: Define Your Manifest

Create a manifest that declares your app's identity, endpoints, and scopes.

```json
{
  "id": "poetry.app",
  "name": "Poetry Generator",
  "version": "1.0.0",
  "adapter": "https://your-server.com/api/poetry",
  "permissions": ["storage"],
  "endpoints": {
    "poetry.compose": {
      "fn": "compose",
      "args": { "recipient": "string", "style": "string" },
      "scopes": ["storage"],
      "description": "Compose a poem for someone",
      "semantics": {
        "intents": ["poetry_compose", "write_poem"],
        "tags": ["creative", "poetry", "gift"],
        "phrases": [
          "compose a poem for {recipient}",
          "write a {style} poem",
          "create a poem"
        ]
      }
    },
    "poetry.list": {
      "fn": "list",
      "args": { "limit": "number" },
      "scopes": ["storage"],
      "description": "List saved poems",
      "semantics": {
        "intents": ["poetry_list"],
        "tags": ["poetry", "history"],
        "phrases": ["show my poems", "list poems", "my poetry"]
      }
    }
  },
  "events": [
    { "key": "poetry.created", "description": "New poem created" },
    { "key": "poetry.shared", "description": "Poem shared with recipient" }
  ]
}
```

---

## Step 2: Implement Your Adapter

Your adapter is a simple HTTP endpoint that Atlas calls. It receives a standard request and returns a standard response.

```typescript
// POST https://your-server.com/api/poetry
export async function handleAtlasCall(req, res) {
  const { method, params, session } = req.body;

  switch (method) {
    case "compose":
      const poem = await generatePoem(params.recipient, params.style);
      return res.json({ ok: true, result: { poem, id: poem.id } });

    case "list":
      const poems = await listPoems(session.wallet, params.limit);
      return res.json({ ok: true, result: poems });

    default:
      return res.json({ ok: false, error: "Unknown method" });
  }
}
```

**That's it.** No auth logic. No session management. No scope checks. Atlas handles all of that.

---

## Step 3: Register with the Mesh

Submit your manifest to the mesh scanner for validation:

```bash
curl -X POST https://p3.mesh/api/scanner/submit \
  -H "Content-Type: application/json" \
  -d @manifest.json
```

The scanner validates:
- Endpoint schema compliance
- Security patterns (no exposed secrets, proper scope usage)
- Semantic tag quality

Once approved, your app appears in the mesh registry.

---

## Step 4: Define Your Dialect (Optional)

Want Atlas to understand natural language specific to your app? Add semantic metadata:

```json
"semantics": {
  "intents": ["poetry_compose"],
  "tags": ["creative", "poetry"],
  "phrases": [
    "compose a poem for {recipient}",
    "write me a haiku about {topic}",
    "create a love poem for {recipient}"
  ]
}
```

Now users can say:
- "Write a haiku about the ocean" → `poetry.compose({ style: "haiku", topic: "ocean" })`
- "Compose a poem for Alice" → `poetry.compose({ recipient: "Alice" })`

Atlas extracts variables from the phrase templates and routes to your endpoint.

---

## Step 5: Join Recipes (Optional)

Your app can participate in multi-step automated flows:

```json
{
  "id": "poem_and_notify",
  "title": "Poem & Notify",
  "steps": [
    { "key": "poetry.compose", "args": { "recipient": "", "style": "sonnet" } },
    { "key": "messages.send", "args": { "to": "", "text": "I wrote you a poem!" } }
  ],
  "triggers": [
    { "type": "cron", "expr": "0 9 * * *" }
  ]
}
```

Now your poetry app is part of a daily automated flow: "Every morning at 9am, compose a poem and send it to my partner."

---

## The Developer Contract

Atlas calls your adapter with a simple JSON payload:

```typescript
interface AtlasRequest {
  method: string;           // The endpoint function (e.g., "compose")
  params: Record<string, any>; // Arguments from the user
  session: {
    wallet: string;         // User's wallet address
    grants: string[];       // Scopes the user has granted
    roles: string[];        // User's roles (user, moderator, admin)
  };
}

interface AtlasResponse {
  ok: boolean;
  result?: any;             // Success payload
  error?: string;           // Error message
}
```

**You never need to:**
- Build authentication
- Manage sessions
- Check permissions
- Handle OAuth flows
- Build a frontend

Atlas does all of that. You just build logic.

---

## Why Build for Atlas?

| Traditional App | Atlas App |
|-----------------|-----------|
| Build auth from scratch | Wallet SSO included |
| Design onboarding flows | No onboarding needed |
| Create dashboard UI | Conversational interface |
| Manage user sessions | Session bridge handles it |
| Implement rate limiting | Mesh-level rate limits |
| Write permission checks | Scope enforcement built-in |
| Build from zero users | Instant access to mesh users |

---

## Quick Start Template

```typescript
// minimal-atlas-app.ts
import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/your-app', async (req, res) => {
  const { method, params, session } = req.body;

  // Your logic here
  const result = await handleMethod(method, params, session.wallet);

  res.json({ ok: true, result });
});

app.listen(3000);
```

Deploy anywhere. Register your manifest. You're live on the mesh.

---

## Resources

- **Manifest Schema**: `/api/scanner/schema`
- **Semantic Tags Reference**: `/api/atlas/handshakes`
- **Recipe Builder**: `/api/atlas/recipes`
- **Mesh Registry**: `/api/sdk/registry`

---

## Canvas Mode Integration

Atlas Canvas provides pre-built UI modes that render Nexus capabilities. Your endpoints can follow the same pattern.

### Nexus as Canvas Modes

The 7 Nexus capabilities are now exposed as Atlas Canvas modes:

| Mode | Description | Endpoint |
|------|-------------|----------|
| Inbox | Notifications | `/api/nexus/inbox` |
| Messages | E2E encrypted chat | `/api/nexus/messaging/list` |
| Calls | Voice/video | `/api/nexus/calls/active` |
| Directory | Contacts | `/api/nexus/directory` |
| Payments | Transactions | `/api/payments` |
| Receipts | Blockchain explorer | `/api/nexus/receipts` |
| Notes | Encrypted notes | `/api/nexus/notes` |

### Building Your Own Canvas Mode

1. **Create endpoint that returns structured data**
```typescript
// Your endpoint returns JSON
GET /api/your-app/items
Response: { ok: true, items: [...], total: 42 }
```

2. **Define canvas.display in manifest**
```json
{
  "canvas.display": {
    "type": "table",
    "title": "My Items",
    "fields": [
      { "key": "name", "label": "Name" },
      { "key": "status", "label": "Status", "format": "badge" }
    ],
    "actions": [
      { "label": "Create", "action": "create" }
    ]
  }
}
```

3. **Atlas auto-materializes the UI**

No frontend code required. Atlas renders your data using the display hints.

### Wallet Authentication

All Canvas modes receive wallet context automatically:

```http
GET /api/your-app/items
Headers:
  x-wallet-address: 0x1234...abcd
```

Your endpoint validates the wallet and returns scoped data.

---

## Resources

- **Manifest Schema**: `/api/scanner/schema`
- **Semantic Tags Reference**: `/api/atlas/handshakes`
- **Recipe Builder**: `/api/atlas/recipes`
- **Mesh Registry**: `/api/sdk/registry`
- **Nexus Integration Guide**: `docs/NEXUS_CANVAS_INTEGRATION.md`

---

*Atlas is the OS. Your app is a protocol-native service. Welcome to the mesh.*
