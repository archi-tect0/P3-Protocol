# P3 Hub Shell Documentation

> **Wallet-Anchored Application Launcher**

P3 Hub is a mobile-first application launcher organizing 50+ apps into categories. Features customizable dock, password protection, background theming, voice search, and external app installation—all anchored to wallet identity.

---

## Architecture

```
client/src/
├── components/
│   ├── HubDock.tsx                    # 5-slot customizable dock
│   ├── HubPasswordSettings.tsx        # Password lock configuration
│   ├── P3HubLogo.tsx                  # Brand logo component
│   └── atlas/modes/
│       └── HubMode.tsx                # Main Hub interface (1195 lines)
├── lib/
│   ├── hubPreferences.ts              # Dock, background, password storage
│   ├── hubLayout.ts                   # Tile layout management
│   └── externalAppsRegistry.tsx       # 85+ external app definitions
├── hooks/
│   ├── use-hub-preferences.ts         # Preference React hooks
│   ├── use-hub-layout.ts              # Layout React hooks
│   └── useSpeechCapture.ts            # Voice search integration
├── pages/launcher/
│   ├── LauncherPage.tsx               # Standalone launcher
│   ├── appRegistry.tsx                # 50+ built-in app definitions
│   └── HubAboutPage.tsx               # About page
└── components/tiles/                  # Individual app tile components
    ├── IdentityVaultTile.tsx
    ├── KeyRotationTile.tsx
    ├── PresenceTile.tsx
    └── ... (40+ tiles)
```

---

## Domain Categories (HubMode.tsx)

| Domain | Label | Icon | Gradient |
|--------|-------|------|----------|
| `installed` | Installed Apps | Globe | cyan → teal |
| `media` | Media & Entertainment | Video | pink → rose |
| `commerce` | Commerce & Marketplace | ShoppingBag | amber → orange |
| `communication` | Communication | MessageSquare | cyan → blue |
| `governance` | Governance & Identity | Shield | violet → purple |
| `tools` | Productivity Tools | Zap | emerald → green |
| `system` | System & Developer | Server | slate → zinc |

---

## App Registry Categories (appRegistry.tsx)

| Category | Example Apps |
|----------|--------------|
| `communication` | Messages, Video Calls, Voice Calls, Notes |
| `security` | Identity Vault, Key Rotation, Presence, Badges |
| `payments` | Invoice, Marketplace, Rewards, Payments |
| `creative` | Sketchpad, Whiteboard, Loop, Music Jam, Meme Mint |
| `social` | Story, Video Feed, Link, Reminder |
| `governance` | Vote, Micro DAO, Policy Ack, Gated Access |
| `analytics` | Analytics, Receipts, Quota |
| `developer` | Moderator Panel, Atlas |
| `games` | Asteroid, Breakout, Maze, Coin, Racer, Tower |
| `external` | Gmail, Slack, Notion, Figma, Spotify (85+ apps) |

---

## Key Features

### Customizable Dock (HubDock.tsx)
- 5 configurable slots
- Long-press to open settings
- Drag to reorder
- Tint color options: slate, purple, cyan, rose, amber, emerald

```typescript
interface DockApp {
  appId: string;
  position: number;  // 0-4
}

interface DockStyle {
  opacity: number;   // 0.3 to 1.0
  tintColor: string; // 'slate', 'purple', 'cyan', etc.
}
```

### Password Protection (hubPreferences.ts)
```typescript
interface HubPreferences {
  dock: DockApp[];
  background: HubBackground;
  decryptPasswordHash?: string;  // SHA-256 hashed password
  showDock: boolean;
  dockStyle?: DockStyle;
}
```

### Background Theming
```typescript
interface HubBackground {
  type: 'gradient' | 'image' | 'ipfs';
  value: string;  // CSS gradient or URL
}
```

### Voice Search (useSpeechCapture)
- Integrated speech-to-text for app search
- Voice command routing to apps

### External Apps (externalAppsRegistry.tsx)
- 85+ pre-defined external apps
- Categories: communication, productivity, design, media, commerce, social, learning
- Installed apps stored in `localStorage.getItem('p3_installed_apps')`

---

## Built-in Apps by Category

### Security (appRegistry.tsx)
| App | Component | Anchor Events |
|-----|-----------|---------------|
| Identity Vault | `IdentityVaultTile` | identity_created, identity_verified |
| Key Rotation | `KeyRotationTile` | key_rotated, key_generated, key_revoked |
| Presence | `PresenceTile` | presence_verified, check_in, check_out |
| Badges | `BadgeCollectorTile` | badge_earned, badge_claimed |
| Session Resume | `SessionResumeTile` | session_started, session_resumed |

### Communication
| App | Component | Purpose |
|-----|-----------|---------|
| Messages | `MessagingTile` | E2E encrypted messaging |
| Video Calls | `VideoCallsTile` | WebRTC video |
| Voice Calls | `VoiceCallsTile` | WebRTC voice |
| Notes | `NotesTile` | Encrypted notes |

### Payments
| App | Component | Anchor Events |
|-----|-----------|---------------|
| Invoice | `InvoiceTile` | invoice_created, payment_received |
| Marketplace | `MarketplaceTile` | listing_created, purchase_made |
| Payments | `PaymentsTile` | payment_sent, payment_received |
| Rewards | `RewardTile` | reward_earned, reward_claimed |

---

## White-Label Use Cases

### 1. Corporate Portal

```
AI Prompt:
"Rebrand P3 Hub as a corporate intranet portal:

1. In client/src/components/atlas/modes/HubMode.tsx:
   - Modify DOMAIN_CONFIG to replace categories: 'hr', 'it', 'finance', 'ops'
   - Add company branding to header

2. In client/src/pages/launcher/appRegistry.tsx:
   - Replace app definitions with internal tools
   - Add category: 'enterprise' for business apps

3. In client/src/lib/hubPreferences.ts:
   - Add 'ssoSession' field for enterprise auth token
   - Extend loadHubPreferences to validate SSO

4. In client/src/components/P3HubLogo.tsx:
   - Replace with company logo"
```

### 2. IoT Dashboard

```
AI Prompt:
"Convert P3 Hub into IoT device controller:

1. In client/src/pages/launcher/appRegistry.tsx:
   - Create device tiles with status indicators
   - Add category: 'devices' with gradient 'from-teal-500 to-cyan-500'

2. In client/src/components/atlas/modes/HubMode.tsx:
   - Add DOMAIN_CONFIG entry: devices: { label: 'Connected Devices', ... }
   - Modify tile rendering to show online/offline status

3. Create client/src/components/tiles/DeviceTile.tsx:
   - Real-time status from MQTT/WebSocket
   - Quick actions: reboot, configure, update

4. In server/services/telemetry.ts:
   - Add device registration endpoints
   - Implement heartbeat monitoring"
```

### 3. Franchise Operations

```
AI Prompt:
"Build franchise management hub:

1. In client/src/components/atlas/modes/HubMode.tsx:
   - Add location selector in header
   - Filter tiles by location_id

2. In client/src/pages/launcher/appRegistry.tsx:
   - Add category: 'operations' for POS, inventory, scheduling
   - Add category: 'reports' for sales, labor, customers

3. In client/src/lib/hubPreferences.ts:
   - Add 'selectedLocationId' field
   - Add 'userRole' for franchise owner, regional, corporate

4. Create server/routes/franchise.ts:
   - Multi-tenant data isolation
   - Role-based endpoint access"
```

---

## Customization Points

### Add New Domain Category

**File:** `client/src/components/atlas/modes/HubMode.tsx`

```typescript
const DOMAIN_CONFIG = {
  // Add your domain
  healthcare: { 
    label: 'Healthcare', 
    icon: Stethoscope, 
    gradient: 'from-red-500 to-rose-500' 
  },
  // ... existing domains
};
```

### Add Built-in App

**File:** `client/src/pages/launcher/appRegistry.tsx`

```typescript
export const appRegistry: AppDefinition[] = [
  {
    id: 'my-app',
    name: 'My App',
    icon: <MyIcon className="w-8 h-8" />,
    gradient: 'from-blue-500 to-cyan-600',
    category: 'tools',
    component: MyAppTile,
    anchorEvents: ['my_event_created'],
  },
  // ... existing apps
];
```

### Add External App

**File:** `client/src/lib/externalAppsRegistry.tsx`

```typescript
const EXTERNAL_APPS: ExternalAppDefinition[] = [
  { 
    id: 'my-saas', 
    name: 'My SaaS', 
    url: 'https://mysaas.com', 
    icon: '🚀', 
    category: 'productivity', 
    scopes: ['tasks'], 
    gradient: 'from-indigo-500 to-indigo-600' 
  },
  // ... existing apps
];
```

### Modify Default Dock

**File:** `client/src/lib/hubPreferences.ts`

```typescript
const DEFAULT_DOCK: DockApp[] = [
  { appId: 'your-app-1', position: 0 },
  { appId: 'your-app-2', position: 1 },
  // ... up to 5 apps
];
```

---

## Storage Keys

| Key | Purpose |
|-----|---------|
| `p3:hub:prefs:{wallet}` | User preferences (dock, background, password) |
| `p3_installed_apps` | Array of installed external app IDs |
| `p3:hub:layout:{wallet}` | Tile layout customization |

---

## Related Documentation

- [AI Development Guide](./AI_DEVELOPMENT_GUIDE.md)
- [Session Bridge](./SESSION_BRIDGE.md)
- [Nexus Shell](./NEXUS_SHELL.md)
- [Atlas Shell](./ATLAS_SHELL.md)
