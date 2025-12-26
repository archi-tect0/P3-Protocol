# Session Bridge

The Session Bridge is P3 Protocol's solution to Web3's fragmentation problem: users hate re-signing messages every time they refresh, switch tabs, or change devices. The Session Bridge provides atomic wallet-to-browser handoff with persistent session continuity.

---

## Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      SESSION BRIDGE FLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │   Wallet    │────▶│   Bridge    │────▶│   Browser   │            │
│  │  (Mobile)   │     │   Layer     │     │   Session   │            │
│  └─────────────┘     └─────────────┘     └─────────────┘            │
│        │                    │                    │                   │
│        │   WalletConnect    │   Install Token    │   localStorage    │
│        │   EthereumProvider │   Transfer         │   Persistence     │
│        │                    │                    │                   │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    CAPABILITIES                              │    │
│  │  • Atomic handoff (no re-signing)                           │    │
│  │  • Cross-tab session sync                                   │    │
│  │  • Cross-device continuity via install tokens               │    │
│  │  • Wallet browser detection (MetaMask, Coinbase, Trust)     │    │
│  │  • Signing mutex (prevents race conditions)                 │    │
│  │  • Diagnostics pipeline for debugging                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Atomic Wallet Handoff
Users connect once and stay connected. The bridge maintains session state across:
- Page refreshes
- Tab switches
- Browser restarts
- Device changes (via install tokens)

### Signing Mutex
Prevents race conditions where multiple code paths trigger signature requests simultaneously. Only one signature request can be active at a time.

```typescript
// Module-level lock ensures single signature request
let signingMutex: Promise<any> | null = null;

function acquireSigningLock(caller: string): { canProceed: boolean; attemptId: number } {
  if (signingMutex !== null) {
    return { canProceed: false, attemptId };  // Blocked
  }
  return { canProceed: true, attemptId };  // Acquired
}
```

### Wallet Browser Detection
Detects wallet in-app browsers via both injected provider flags and user agent patterns:

| Wallet | Detection Method |
|--------|------------------|
| MetaMask | `ethereum.isMetaMask` |
| Coinbase/Base | `ethereum.isCoinbaseWallet`, `ethereum.isSmartWallet` |
| Trust Wallet | `ethereum.isTrust`, `ethereum.isTrustWallet` |
| Rainbow | `ethereum.isRainbow` |

```typescript
const { isWalletBrowser, browserName, platform } = detectWalletBrowser();
// Returns: { isWalletBrowser: true, browserName: 'Coinbase/Base', platform: 'ios' }
```

### Install Token Transfer
For cross-device session continuity, the bridge generates secure install tokens that transfer wallet authentication to new contexts (PWA installs, browser popouts).

```typescript
// Generate token on authenticated device
const response = await fetch('/api/pwa/create-install-token', {
  method: 'POST',
  body: JSON.stringify({ walletAddress, appMode: false })
});
const { token } = await response.json();

// Use token on new device/context
const atlasUrl = `/atlas?install_token=${token}&wallet_return=true`;
```

---

## Architecture

### File Structure

```
client/src/lib/
├── sessionBridgeV2.ts      # Core bridge logic (1600+ lines)
│   ├── detectWalletBrowser()   # Wallet browser detection
│   ├── initProvider()          # WalletConnect initialization
│   ├── connectBridge()         # Connection flow
│   ├── disconnectBridge()      # Cleanup
│   ├── getSession()            # Session retrieval
│   ├── saveSession()           # Session persistence
│   ├── triggerAtlasPopout()    # PWA/browser popout
│   └── pushDiag()              # Diagnostics
│
├── coinbaseAuth.ts         # PIN authentication layer
│   ├── checkPinStatus()        # Check if PIN is set
│   ├── setupPin()              # Create new PIN
│   ├── verifyPin()             # Verify PIN
│   └── getConnectedAddress()   # Get authenticated address
│
client/src/hooks/
├── useSessionBridge.ts     # React hook for WebSocket session
│   ├── connect()               # WebSocket connection
│   ├── sendIntent()            # Send user intent
│   └── requestRender()         # Request mode render

server/
├── pwa-routes.ts           # Install token endpoints
│   ├── POST /api/pwa/create-install-token
│   └── POST /api/pwa/verify-install-token
```

### Session Data Structure

```typescript
interface BridgeSession {
  address: string;           // Wallet address (0x...)
  chainId: number;           // Chain ID (8453 for Base)
  method: 'walletconnect' | 'extension' | 'deeplink';
  connected: boolean;        // Current connection status
  topic?: string;            // WalletConnect topic
  peerName?: string;         // Connected wallet name
  timestamp: number;         // Session creation time
}
```

---

## Usage

### Basic Connection

```typescript
import { connectBridge, getSession, disconnectBridge } from '@/lib/sessionBridgeV2';

// Connect wallet
const result = await connectBridge();
if (result.success) {
  console.log('Connected:', result.address);
}

// Check existing session
const session = getSession();
if (session?.connected) {
  console.log('Already connected:', session.address);
}

// Disconnect
await disconnectBridge();
```

### React Hook Usage

```typescript
import { useSessionBridge } from '@/hooks/useSessionBridge';

function AtlasCanvas() {
  const { sendIntent, requestRender } = useSessionBridge();
  
  // Send natural language intent
  sendIntent('show me the weather');
  
  // Request specific mode
  requestRender('weather', { location: 'New York' });
}
```

### Wallet Browser Popout

```typescript
import { detectWalletBrowser, triggerAtlasPopout } from '@/lib/sessionBridgeV2';

// After wallet authentication
const { isWalletBrowser } = detectWalletBrowser();
if (isWalletBrowser) {
  // Opens Atlas in system browser with session transfer
  await triggerAtlasPopout(walletAddress);
}
```

---

## Event System

The bridge emits custom events for state changes:

| Event | Payload | Description |
|-------|---------|-------------|
| `p3:wallet:changed` | `{ address: string \| null }` | Account changed or disconnected |
| `p3:chain:changed` | `{ chainId: number }` | Network changed |
| `p3:wallet:transport:disconnected` | - | WalletConnect transport lost |

```typescript
window.addEventListener('p3:wallet:changed', (e) => {
  const { address } = e.detail;
  if (address) {
    console.log('Wallet changed to:', address);
  }
});
```

---

## Diagnostics

Built-in diagnostics pipeline for debugging wallet browser issues:

```typescript
import { pushDiag, getDiagSessionId } from '@/lib/sessionBridgeV2';

// Push diagnostic event
pushDiag('connection_attempt', { wallet: 'MetaMask', platform: 'ios' });

// Get session ID for log correlation
const diagId = getDiagSessionId();
```

Diagnostics are sent via `navigator.sendBeacon` (preferred for mobile) with `fetch` fallback, ensuring delivery even during page unload.

---

## WalletConnect Configuration

The bridge uses WalletConnect v2 with EthereumProvider:

```typescript
const provider = await EthereumProvider.init({
  projectId: PROJECT_ID,
  chains: [8453],                    // Base mainnet
  optionalChains: [84532, 1],        // Base Sepolia, Ethereum
  showQrModal: true,
  methods: [
    'eth_sendTransaction',
    'eth_signTransaction',
    'eth_sign',
    'personal_sign',
    'eth_signTypedData',
    'eth_signTypedData_v4',
  ],
  metadata: {
    name: 'P3 Protocol',
    description: 'Privacy-Preserving Proof of Communication',
    url: origin,
    icons: [`${origin}/icons/owl-192.svg`],
  },
});
```

---

## Integration Checklist

To integrate the Session Bridge into your project:

1. **Copy files:**
   ```
   client/src/lib/sessionBridgeV2.ts
   client/src/lib/coinbaseAuth.ts
   client/src/hooks/useSessionBridge.ts
   server/pwa-routes.ts
   ```

2. **Install dependencies:**
   ```bash
   npm install @walletconnect/ethereum-provider
   ```

3. **Set environment variable:**
   ```env
   VITE_WALLETCONNECT_PROJECT_ID=your-project-id
   ```

4. **Register server routes:**
   ```typescript
   import { createPWARoutes } from './pwa-routes';
   import { storage } from './storage';  // Your IStorage implementation
   
   // Routes are already prefixed with /api/pwa/ internally
   app.use(createPWARoutes(storage));
   ```

   The `createPWARoutes` function requires an `IStorage` instance that implements:
   - `createInstallToken()`
   - `getInstallToken()`
   - `deleteInstallToken()`
   - `cleanupExpiredInstallTokens()`

5. **Initialize in your app:**
   ```typescript
   import { connectBridge, getSession } from '@/lib/sessionBridgeV2';
   
   // Check for existing session on app load
   const session = getSession();
   if (!session?.connected) {
     await connectBridge();
   }
   ```

---

## Security Considerations

- **Session tokens are short-lived** - Install tokens expire after use
- **No PII stored** - Only wallet addresses, no personal data
- **Signing mutex** - Prevents duplicate signature requests
- **Transport disconnect tolerance** - Transient disconnects don't clear wallet state
- **localStorage isolation** - Each domain has its own session

---

## Troubleshooting

### Session not persisting
Check that `localStorage` is available and not blocked by browser settings.

### Duplicate signature popups
The signing mutex should prevent this. Check console for `[MUTEX]` logs.

### Wallet browser detection failing
Ensure you're checking both `window.ethereum` flags and user agent patterns.

### Install token transfer failing
Verify the server endpoint `/api/pwa/create-install-token` is registered and accessible.
