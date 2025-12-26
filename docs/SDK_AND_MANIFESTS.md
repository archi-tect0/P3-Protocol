# SDK & App Manifests

The P3 SDK enables developers to build wallet-anchored applications with standardized manifests, permissions, and lifecycle management.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         P3 SDK ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    APP MANIFESTS                             │    │
│  │  Identity │ Permissions │ Widgets │ Deep Links │ Actions    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    SDK MODULES                               │    │
│  │  Anchor │ Messaging │ Payments │ Identity │ Storage │ ZK   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    RUNTIME                                   │    │
│  │  Session Bridge │ Permission Check │ Receipt Trail          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## App Manifest Schema

Every P3 Hub app requires a manifest defining identity, permissions, and capabilities:

```typescript
// client/src/lib/sdk/apps.ts
interface AppManifest {
  id: string;                    // Unique identifier (lowercase, hyphenated)
  title: string;                 // Display name
  version: string;               // Semantic version
  category: AppCategory;         // 'security' | 'payments' | 'social' | 'productivity' | etc.
  description: string;           // User-facing description
  
  developer: {
    name: string;
    contact: string;             // Telegram, email, or support URL
    website?: string;
  };

  permissions: Permission[];     // Required permissions
  
  widgets?: Widget[];            // Home screen widgets (optional)
  
  links: {
    pwa?: string;                // Standalone PWA path
    external?: string;           // External URL (optional)
  };
}

type Permission = 
  | 'wallet'      // Access wallet address
  | 'anchoring'   // Anchor receipts to blockchain
  | 'messaging'   // Send/receive messages
  | 'payments'    // Process payments
  | 'storage'     // Use local storage
  | 'camera'      // Access camera
  | 'microphone'  // Access microphone
  | 'notifications'; // Push notifications

type AppCategory =
  | 'security'
  | 'payments'
  | 'social'
  | 'productivity'
  | 'media'
  | 'utilities'
  | 'games';
```

**Source:** `client/src/lib/sdk/apps.ts`

### Example Manifest

```typescript
// client/src/lib/sdk/manifests.ts
const invoiceApp: AppManifest = {
  id: 'invoice',
  title: 'Invoice',
  version: '1.0.0',
  category: 'payments',
  description: 'Create and manage invoices with on-chain payment tracking.',
  developer: {
    name: 'Dciphrs',
    contact: 'https://t.me/P3Atlas',
    website: 'https://dciphrs.io/apps/invoice'
  },
  permissions: ['wallet', 'payments', 'anchoring'],
  widgets: [
    {
      id: 'invoice-pending',
      title: 'Pending',
      size: '1x1',
      entry: '/standalone/invoice/widget.html'
    }
  ],
  contextMenu: [
    { id: 'create-invoice', label: 'Create invoice', action: 'create' }
  ],
  links: {
    pwa: '/standalone/invoice/'
  }
};
```

---

## Widget System

Widgets provide at-a-glance information on the Hub home screen:

```typescript
interface Widget {
  id: string;
  title: string;
  size: '1x1' | '2x1' | '2x2' | '4x2';
  entry: string;                 // HTML entry point
  refreshInterval?: number;      // Auto-refresh (ms)
  permissions?: Permission[];    // Widget-specific permissions
}

// Widget sizes
// 1x1: 100px x 100px (small indicator)
// 2x1: 200px x 100px (horizontal bar)
// 2x2: 200px x 200px (square card)
// 4x2: 400px x 200px (wide panel)
```

### Widget Communication

```typescript
// Inside widget iframe
window.parent.postMessage({
  type: 'widget:ready',
  widgetId: 'invoice-pending',
}, '*');

// Receive data from parent
window.addEventListener('message', (event) => {
  if (event.data.type === 'widget:update') {
    updateDisplay(event.data.payload);
  }
});

// Request refresh
window.parent.postMessage({
  type: 'widget:refresh',
  widgetId: 'invoice-pending',
}, '*');
```

---

## SDK Modules

### Core Module

```typescript
// client/src/lib/sdk/modules/core.ts
import { useP3 } from '../useP3';

const { wallet, session, permissions } = useP3();

// Get connected wallet
const address = wallet.address;

// Check session status
const isConnected = session.isConnected;

// Request permission
const granted = await permissions.request(['messaging', 'anchoring']);
```

### Anchoring Module

```typescript
// client/src/lib/sdk/modules/anchor.ts
interface AnchorModule {
  anchor(data: AnchorData): Promise<AnchorResult>;
  verify(hash: string): Promise<VerifyResult>;
  batch(items: AnchorData[]): Promise<BatchResult>;
}

// Anchor a receipt
const result = await p3.anchor.anchor({
  type: 'document.signed',
  contentHash: sha256(document),
  metadata: { title: 'Contract v1.0' },
});

// Verify existing anchor
const verification = await p3.anchor.verify(result.hash);
console.log(verification.exists, verification.timestamp);
```

**Source:** `client/src/lib/sdk/modules/anchor.ts`

### Messaging Module

```typescript
// client/src/lib/sdk/modules/messaging.ts
interface MessagingModule {
  send(to: string, content: string): Promise<SendResult>;
  onMessage(handler: MessageHandler): void;
  getConversations(): Promise<Conversation[]>;
}

// Send encrypted message
await p3.messaging.send('0x...recipient', 'Hello!');

// Listen for incoming messages
p3.messaging.onMessage((message) => {
  console.log(`From: ${message.from}, Content: ${message.content}`);
});
```

**Source:** `client/src/lib/sdk/modules/messaging.ts`

### Payments Module

```typescript
// client/src/lib/sdk/payments.ts
interface PaymentsModule {
  requestPayment(params: PaymentRequest): Promise<PaymentResult>;
  getHistory(): Promise<Payment[]>;
}

// Request payment
const payment = await p3.payments.requestPayment({
  amount: '0.01',
  currency: 'ETH',
  recipient: wallet.address,
  memo: 'Invoice #1234',
});

// Payment automatically anchored as receipt
console.log(payment.receiptHash);
```

**Source:** `client/src/lib/sdk/payments.ts`

### ZK Module

```typescript
// client/src/lib/sdk/modules/zk.ts
interface ZKModule {
  generateProof(circuit: string, inputs: any): Promise<Proof>;
  verifyProof(proof: Proof): Promise<boolean>;
}

// Generate privacy-preserving proof
const proof = await p3.zk.generateProof('MessageReceipt', {
  senderHash: poseidon([senderAddress]),
  recipientHash: poseidon([recipientAddress]),
  timestamp: Date.now(),
});

// Verify on-chain
const valid = await p3.zk.verifyProof(proof);
```

**Source:** `client/src/lib/sdk/modules/zk.ts`

---

## Mini-App Lifecycle

### Initialization

```typescript
// App entry point
import { initP3App } from '@p3/sdk';

const app = await initP3App({
  manifestId: 'invoice',
  onConnect: (session) => {
    console.log('Connected:', session.wallet);
  },
  onDisconnect: () => {
    console.log('Disconnected');
  },
});

// App is ready
app.ready();
```

### Lifecycle Events

| Event | Trigger | Handler |
|-------|---------|---------|
| `connect` | Wallet connected | `onConnect(session)` |
| `disconnect` | Wallet disconnected | `onDisconnect()` |
| `suspend` | Tab backgrounded | `onSuspend()` |
| `resume` | Tab foregrounded | `onResume()` |
| `update` | Session data changed | `onUpdate(data)` |

### State Persistence

```typescript
// Save app state (wallet-scoped)
await app.storage.set('invoices', invoiceList);

// Load app state
const invoices = await app.storage.get('invoices');

// Clear app state
await app.storage.clear();
```

---

## App Registry

Apps are registered in the Hub's app registry:

```typescript
// client/src/pages/launcher/appRegistry.tsx
import { appManifests } from '@/lib/sdk/manifests';

export function getRegisteredApps(): AppManifest[] {
  return Object.values(appManifests);
}

export function getAppById(id: string): AppManifest | undefined {
  return appManifests[id];
}

export function getAppsByCategory(category: AppCategory): AppManifest[] {
  return Object.values(appManifests).filter(app => app.category === category);
}
```

**Source:** `client/src/pages/launcher/appRegistry.tsx`, `client/src/lib/sdk/manifests.ts`

---

## Pulse Instrumentation

Apps can emit telemetry to the Pulse metrics system:

```typescript
// client/src/lib/sdk/telemetry.ts
interface TelemetryModule {
  event(name: string, data?: object): void;
  timing(name: string, durationMs: number): void;
  error(error: Error, context?: object): void;
}

// Track user action
p3.telemetry.event('invoice.created', {
  amount: invoice.amount,
  currency: invoice.currency,
});

// Track performance
const start = Date.now();
await processInvoice();
p3.telemetry.timing('invoice.processing', Date.now() - start);

// Track errors
try {
  await riskyOperation();
} catch (error) {
  p3.telemetry.error(error, { operation: 'riskyOperation' });
}
```

**Source:** `client/src/lib/sdk/telemetry.ts`

---

## Permission Model

### Permission Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. App requests permission                                 │
│     └── p3.permissions.request(['messaging'])              │
│                                                              │
│  2. Check if already granted                               │
│     └── Return immediately if cached                       │
│                                                              │
│  3. Show permission dialog                                  │
│     └── User approves or denies                            │
│                                                              │
│  4. Store decision (wallet-scoped)                         │
│     └── localStorage: p3-permissions-{wallet}-{appId}      │
│                                                              │
│  5. Return result                                           │
│     └── { granted: true, permissions: ['messaging'] }      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Permission Checks

```typescript
// Check before using feature
if (await p3.permissions.check('anchoring')) {
  await anchorReceipt(receipt);
} else {
  const granted = await p3.permissions.request(['anchoring']);
  if (granted) {
    await anchorReceipt(receipt);
  }
}

// Revoke permission
await p3.permissions.revoke('messaging');
```

**Source:** `client/src/lib/sdk/permissions.ts`

---

## Manifest Schema Reference

Full JSON schema for app manifests:

```json
{
  "$schema": "https://p3protocol.com/schemas/manifest-v1.json",
  "type": "object",
  "required": ["id", "title", "version", "category", "description", "developer", "permissions", "links"],
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$"
    },
    "title": { "type": "string", "maxLength": 50 },
    "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "category": {
      "enum": ["security", "payments", "social", "productivity", "media", "utilities", "games"]
    },
    "description": { "type": "string", "maxLength": 500 },
    "developer": {
      "type": "object",
      "required": ["name", "contact"],
      "properties": {
        "name": { "type": "string" },
        "contact": { "type": "string" },
        "website": { "type": "string", "format": "uri" }
      }
    },
    "permissions": {
      "type": "array",
      "items": {
        "enum": ["wallet", "anchoring", "messaging", "payments", "storage", "camera", "microphone", "notifications"]
      }
    },
    "widgets": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "title", "size", "entry"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "size": { "enum": ["1x1", "2x1", "2x2", "4x2"] },
          "entry": { "type": "string" }
        }
      }
    },
    "links": {
      "type": "object",
      "properties": {
        "pwa": { "type": "string" },
        "canvas": { "type": "string" },
        "external": { "type": "string", "format": "uri" }
      }
    }
  }
}
```

**Source:** `docs/atlas/manifest-schema.md`

---

## Source Files

| Component | Location |
|-----------|----------|
| App manifests | `client/src/lib/sdk/manifests.ts` |
| App types | `client/src/lib/sdk/apps.ts` |
| App registry | `client/src/pages/launcher/appRegistry.tsx` |
| SDK modules | `client/src/lib/sdk/modules/` |
| Permissions | `client/src/lib/sdk/permissions.ts` |
| Telemetry | `client/src/lib/sdk/telemetry.ts` |
| Payments | `client/src/lib/sdk/payments.ts` |
| Manifest schema | `docs/atlas/manifest-schema.md` |
