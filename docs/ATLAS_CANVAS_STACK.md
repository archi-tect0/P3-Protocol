# Atlas Canvas Stack

Atlas Canvas is a unified interface system with 40+ modes, intent routing, and deterministic rendering. This document covers the architecture, intent resolution, and mode taxonomy.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ATLAS CANVAS                                  │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Mode Layer │  │Intent Router│  │Session Store│  │Receipt Trail│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│         │                │                │                │         │
│         ▼                ▼                ▼                ▼         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    UNIFIED RENDERING ENGINE                   │   │
│  │  Canvas → Mode → Components → State → Receipts → Anchoring   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Mode Taxonomy

### Core Modes (30+)

| Category | Modes | Description |
|----------|-------|-------------|
| **Communication** | Messages, Calls, Inbox, Notifications | E2E encrypted messaging and WebRTC calls |
| **Media** | Reader, GameDeck | Content consumption |
| **Productivity** | Notes, Writer, Calculator, TaskManager | Creation and organization |
| **Finance** | Tokens, Receipts, Governance | Wallet and transaction management |
| **System** | Settings, Metrics, Pulse, Node | Configuration and monitoring |
| **Discovery** | Hub, Library, Directory | Content discovery and apps |
| **External** | Weather, News, Wikipedia, Feed | Third-party data integration |

### Mode Interface

```typescript
interface CanvasMode {
  id: string;
  title: string;
  icon: LucideIcon;
  component: React.ComponentType;
  permissions?: string[];
  requiresAuth?: boolean;
  persistState?: boolean;
}

// Example mode registration
const modes: Record<string, CanvasMode> = {
  messages: {
    id: 'messages',
    title: 'Messages',
    icon: MessageSquare,
    component: MessagesMode,
    permissions: ['wallet'],
    requiresAuth: true,
    persistState: true,
  },
  // ... 40+ modes
};
```

**Source:** `client/src/components/atlas/modes/`

---

## Intent Router

The intent router translates natural language and deep links into mode activations.

### 3-Tier Intent Matching

```
┌─────────────────────────────────────────────────────────────┐
│                   INTENT RESOLUTION                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TIER 1: REGEX PATTERNS (Fastest)                           │
│  └── /play (.+) on spotify/i → playMedia + spotify          │
│  └── /call (.+)/i → callContact                             │
│  └── /send message to (.+)/i → sendMessage                  │
│                                                              │
│  TIER 2: KEYWORD MAPPING (Fast)                              │
│  └── "weather" → WeatherMode                                │
│  └── "settings" → SettingsMode                              │
│  └── "messages" → MessagesMode                              │
│                                                              │
│  TIER 3: SEMANTIC FALLBACK (LLM)                            │
│  └── Ambiguous intents parsed by AI                         │
│  └── Returns structured JSON action                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Intent Parser

```typescript
// client/src/lib/intentParser.ts
export type IntentType = 
  | 'playMedia' | 'navigateTo' | 'sendMessage' | 'callContact'
  | 'emailContact' | 'bookRide' | 'orderFood' | 'searchFile'
  | 'searchProfile' | 'openApp' | 'unknown';

export interface ParsedIntent {
  intentType: IntentType;
  appName: string | null;
  parameters: Record<string, string>;
  confidence: number;
  rawUtterance: string;
}

export function parseIntent(utterance: string): ParsedIntent {
  // Tier 1: Regex patterns
  for (const pattern of INTENT_PATTERNS) {
    const match = utterance.match(pattern.regex);
    if (match) {
      return {
        intentType: pattern.intentType,
        appName: pattern.extractApp?.(match) || null,
        parameters: pattern.extractParams?.(match) || {},
        confidence: 0.95,
        rawUtterance: utterance,
      };
    }
  }

  // Tier 2: Keyword mapping
  const keyword = KEYWORD_MAP[utterance.toLowerCase().trim()];
  if (keyword) {
    return { ...keyword, confidence: 0.85, rawUtterance: utterance };
  }

  // Tier 3: Semantic fallback
  return { intentType: 'unknown', confidence: 0.0, ... };
}
```

**Source:** `client/src/lib/intentParser.ts`, `client/src/lib/atlasIntentRouter.ts`

### Intent Router

```typescript
// client/src/lib/atlasIntentRouter.ts
export async function routeIntent(
  utterance: string,
  options: RouterOptions = {}
): Promise<IntentResult> {
  const platform = detectPlatform();
  const intent = parseIntent(utterance);

  // Resolve app for intent
  let appName = intent.appName || DEFAULT_APP_MAPPING[intent.intentType];
  const app = getAppById(normalizeAppName(appName));

  // Find matching deep link
  const deepLink = getDeepLinkForIntent(utterance, platform);

  // Execute if auto-execute enabled
  if (options.autoExecute && deepLink) {
    const url = buildDeepLinkUrl(deepLink, intent.parameters, platform);
    await executeDeepLink(url, options);
  }

  return { success: true, intent, app, deepLink, platform };
}
```

---

## Deep Link Manifest

External apps are registered with deep link configurations:

```typescript
// client/src/lib/deepLinkManifest.ts
export interface AppManifest {
  id: string;
  name: string;
  icon: string;
  platforms: Platform[];
  intents: IntentMapping[];
}

export interface IntentMapping {
  intentType: IntentType;
  deepLink: DeepLink;
  parameterMapping: Record<string, string>;
}

const apps: AppManifest[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    platforms: ['ios', 'android', 'web'],
    intents: [
      {
        intentType: 'playMedia',
        deepLink: {
          ios: 'spotify://search/{query}',
          android: 'spotify://search/{query}',
          web: 'https://open.spotify.com/search/{query}',
        },
        parameterMapping: { query: 'mediaName' },
      },
    ],
  },
  // ... more apps
];
```

**Source:** `client/src/lib/deepLinkManifest.ts`

---

## Deterministic Rendering

Canvas modes render deterministically based on state:

### State Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Intent    │───▶│   Store     │───▶│   Render    │
│   Action    │    │   Update    │    │   Mode      │
└─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Receipt    │◀───│   State     │◀───│   UI        │
│  Anchor     │    │   Persist   │    │   Events    │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Atlas Store

```typescript
// client/src/state/useAtlasStore.ts
interface AtlasState {
  currentMode: string;
  modeHistory: string[];
  receipts: Receipt[];
  preferences: UserPreferences;
  sessionId: string | null;
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  currentMode: 'home',
  modeHistory: [],
  receipts: [],

  setMode: (mode: string) => {
    set((state) => ({
      currentMode: mode,
      modeHistory: [...state.modeHistory, mode].slice(-10),
    }));
  },

  pushReceipt: (receipt: Receipt) => {
    set((state) => ({
      receipts: [...state.receipts, receipt],
    }));
    // Async anchor to blockchain
    anchorReceipt(receipt);
  },
}));
```

**Source:** `client/src/state/useAtlasStore.ts`

---

## Session Memory

Wallet-anchored session persistence:

```typescript
interface SessionMemory {
  walletAddress: string;
  preferences: {
    theme: 'light' | 'dark';
    defaultMode: string;
    favoriteApps: string[];
  };
  history: {
    recentModes: string[];
    recentSearches: string[];
    lastActive: number;
  };
  personas: {
    activePersona: string;
    customPersonas: Persona[];
  };
}

// Persist to localStorage with wallet scope
const STORAGE_KEY = `atlas-session-${walletAddress}`;
localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionMemory));
```

---

## Flow Pipeline

Compound intents execute as pipelines:

```typescript
interface FlowStep {
  id: string;
  action: string;
  params: Record<string, any>;
  dependsOn?: string[];
  rollback?: () => Promise<void>;
}

interface Flow {
  id: string;
  steps: FlowStep[];
  execution: 'sequential' | 'parallel';
}

// Example: "Order food and track delivery"
const orderFlow: Flow = {
  id: 'order-and-track',
  steps: [
    { id: 'search', action: 'searchRestaurant', params: { query: '...' } },
    { id: 'order', action: 'placeOrder', params: {}, dependsOn: ['search'] },
    { id: 'track', action: 'trackDelivery', params: {}, dependsOn: ['order'] },
  ],
  execution: 'sequential',
};

async function executeFlow(flow: Flow) {
  const completed: string[] = [];
  
  for (const step of flow.steps) {
    // Check dependencies
    if (step.dependsOn?.some(d => !completed.includes(d))) {
      throw new Error(`Dependency not met: ${step.dependsOn}`);
    }
    
    try {
      await executeStep(step);
      completed.push(step.id);
    } catch (error) {
      // Rollback completed steps
      for (const id of completed.reverse()) {
        await flow.steps.find(s => s.id === id)?.rollback?.();
      }
      throw error;
    }
  }
}
```

**Source:** `server/flows/pipeline.ts`, `server/flows/compound.ts`

---

## Auto-Manifesting UI

Endpoints define display properties for automatic UI generation:

```typescript
interface EndpointManifest {
  id: string;
  path: string;
  method: 'GET' | 'POST';
  display: {
    type: 'card' | 'table' | 'pipeline' | 'chart';
    title: string;
    fields: FieldMapping[];
    actions?: ActionButton[];
  };
}

const manifest: EndpointManifest = {
  id: 'weather-current',
  path: '/api/weather/current',
  method: 'GET',
  display: {
    type: 'card',
    title: 'Current Weather',
    fields: [
      { key: 'temperature', label: 'Temperature', format: 'temperature' },
      { key: 'condition', label: 'Condition', format: 'text' },
      { key: 'humidity', label: 'Humidity', format: 'percent' },
    ],
  },
};
```

**Source:** `docs/atlas/manifest-schema.md`

---

## Source Files

| Component | Location |
|-----------|----------|
| Canvas modes | `client/src/components/atlas/modes/` |
| Intent parser | `client/src/lib/intentParser.ts` |
| Intent router | `client/src/lib/atlasIntentRouter.ts` |
| Deep link manifest | `client/src/lib/deepLinkManifest.ts` |
| Deep link executor | `client/src/lib/deepLinkExecutor.ts` |
| Atlas store | `client/src/state/useAtlasStore.ts` |
| Flow pipeline | `server/flows/pipeline.ts` |
| Canvas shell | `client/src/pages/atlas/AtlasShell.tsx` |
