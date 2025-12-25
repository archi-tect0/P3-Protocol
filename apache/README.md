# P3 Protocol Bridge

A unified wallet connection layer for modular crypto apps.  
**Connect once, cache securely, and let every module inherit the session.**  
No private key imports. No duplicate WalletConnect flows.

---

## Features

- 🔑 **Single Wallet Handshake** — WalletConnect v2 or injected provider, one connection for all modules
- 🔒 **Secure Session Caching** — Encrypted localStorage with automatic cleanup on disconnect
- 🧩 **Simple SDK** — `getSession()`, `signMessage()`, `sendTransaction()` across all modules
- 🛡️ **Capability-Based Permissions** — Optional biometric gating and time-limited access grants
- 🚫 **Zero Private Key Exposure** — Keys never leave wallet, modules only receive signatures
- 🌐 **Cross-Module Isolation** — Each module gets sandboxed capability tokens

---

## Installation

```bash
npm install @p3protocol/bridge
# or
yarn add @p3protocol/bridge
```

---

## Quick Start

```typescript
import { 
  connectWallet, 
  getSession, 
  sendTransaction,
  onWalletEvent 
} from '@p3protocol/bridge';

async function run() {
  // Connect wallet (prompts user once)
  const session = await connectWallet({ provider: 'walletconnect' });
  console.log('Connected:', session.address);

  // Send transaction from any module
  const { txId, status } = await sendTransaction('module.purchase', {
    to: '0x...',
    value: '1000000000000000000',
  });
  console.log('Transaction:', txId, status);

  // Listen for wallet events
  onWalletEvent('accountChanged', (newSession) => {
    console.log('Account changed to:', newSession.address);
  });
}

run().catch(console.error);
```

---

## API

### `connectWallet(opts?: { provider?: 'walletconnect' | 'injected' }): Promise<Session>`

Initiates wallet connection. Prompts user once; subsequent calls return cached session.

**Returns:**
```typescript
type Session = {
  connected: boolean;
  address?: string;
  chainId?: number;
  provider: 'walletconnect' | 'injected';
};
```

### `getSession(): Promise<Session>`

Returns current cached session without prompting.

### `disconnectWallet(): Promise<void>`

Clears session and revokes all capability grants.

### `requestCapability(moduleId: string, cap: string, reason?: string): Promise<boolean>`

Requests permission for a module to perform an action (e.g., `sign_message`, `send_transaction`).

- `moduleId`: Unique identifier for the requesting module
- `cap`: Capability name (e.g., `sign_eip712`, `send_transaction`)
- `reason`: Optional user-facing reason string

**Returns:** `true` if user approved, `false` otherwise.

### `signMessage(moduleId: string, msg: Uint8Array): Promise<Uint8Array>`

Signs a raw message. Requires `sign_message` capability.

### `signTypedData(moduleId: string, eip712: Record<string, unknown>): Promise<Uint8Array>`

Signs EIP-712 structured data. Requires `sign_eip712` capability.

### `sendTransaction(moduleId: string, tx: unknown): Promise<{ txId: string; status: 'submitted' | 'failed' }>`

Sends a transaction. Requires `send_transaction` capability.

### `onWalletEvent(event: string, handler: (session: Session) => void): () => void`

Subscribes to wallet events. Returns unsubscribe function.

**Events:**
- `'connected'` — Wallet connected
- `'disconnected'` — Wallet disconnected
- `'accountChanged'` — Account switched
- `'chainChanged'` — Chain switched

---

## Module Integration Example

```typescript
// In your module
import { getSession, requestCapability, signMessage } from '@p3protocol/bridge';

export async function authenticateModule() {
  const session = await getSession();
  if (!session.connected) throw new Error('Wallet not connected');

  // Request capability once
  const granted = await requestCapability(
    'my.module.v1',
    'sign_message',
    'Authenticate your wallet address'
  );
  if (!granted) throw new Error('User denied capability');

  // Sign a challenge
  const msg = new TextEncoder().encode('Verify me');
  const signature = await signMessage('my.module.v1', msg);
  
  return { address: session.address, signature };
}
```

---

## Architecture

```
┌─────────────────────────────────────┐
│      Browser / App Container        │
├─────────────────────────────────────┤
│         P3 Bridge SDK               │
│  ┌──────────────────────────────┐  │
│  │  Wallet Connector            │  │
│  │  (WalletConnect v2/Injected) │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Session Store               │  │
│  │  (encrypted localStorage)    │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  Capability Manager          │  │
│  │  (time-limited grants)       │  │
│  └──────────────────────────────┘  │
├─────────────────────────────────────┤
│     Module 1    │    Module 2       │
│  (e.g., DAO)    │  (e.g., Swaps)    │
└─────────────────────────────────────┘
```

---

## Security Considerations

1. **No Private Keys in Modules** — Only signatures are passed; private keys remain in wallet
2. **Capability Expiration** — Grants auto-expire (default: 1 minute). Request fresh grants for sensitive ops
3. **localStorage Security** — Session tokens stored in `p3.session.v1`. Clear on logout
4. **User Consent** — Every capability requires explicit user approval via modal
5. **Wallet Signature Verification** — All module operations signed by wallet; tamper-proof

---

## File Structure

```
/src
  ├── eventBus.ts          # Event emitter for wallet events
  ├── store.ts             # Session persistence (localStorage)
  ├── ui.ts                # Consent modal (replaceable)
  ├── capabilities.ts      # Capability grant manager
  ├── walletConnector.ts   # Wallet connection logic
  ├── signer.ts            # Signing operations
  └── sdk.ts               # Main SDK export
```

---

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Publish

```bash
npm publish
```

---

## License

Released under the **Apache License 2.0**.  
Copyright © 2025 dciphrs.io  
Maintained by archi-tect0

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit changes (`git commit -am 'Add feature'`)
4. Push to branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## Support
- 📧 Email: support@dciphrs.io
