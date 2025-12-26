# Nexus Shell Documentation

> **End-to-End Encrypted Communications Platform**

Nexus is P3's messaging and communications shell providing encrypted messaging, voice/video calls, and real-time presence—all anchored to wallet identity with zero PII.

---

## Architecture

```
client/src/
├── components/
│   ├── MessageComposer.tsx            # Message input with encryption
│   └── atlas/modes/
│       ├── MessagesMode.tsx           # Inbox and thread view
│       ├── InboxMode.tsx              # Message list
│       ├── CallsMode.tsx              # Voice/video calls
│       └── ChatMode.tsx               # AI chat with intents
├── lib/
│   ├── crypto.ts                      # TweetNaCl encryption
│   ├── nexusStore.ts                  # Message state management
│   └── sdk/
│       └── messaging.ts               # Messaging SDK
├── pages/
│   ├── MessagesPage.tsx               # Standalone messages page
│   └── docs/NexusGuide.tsx            # Documentation page
└── components/tiles/
    ├── NexusLinkTile.tsx              # MessagingTile, VideoCallsTile, etc.
    └── SessionResumeTile.tsx          # Cross-device session resume

server/
├── routes/
│   └── nexus/                         # Nexus API endpoints
├── services/
│   ├── sessionBridge.ts               # SIWE authentication
│   ├── ticket.ts                      # Support ticket system
│   └── pushNotifications.ts           # Web push notifications
└── atlas/
    └── streaming.ts                   # Real-time message delivery
```

---

## Core Features

### End-to-End Encryption (crypto.ts)

| Algorithm | Purpose |
|-----------|---------|
| X25519 | Key exchange (Diffie-Hellman) |
| XSalsa20-Poly1305 | Symmetric encryption |
| TweetNaCl | Cryptographic library |

```typescript
// Encryption flow
const sharedSecret = nacl.box.before(recipientPublicKey, senderSecretKey);
const encrypted = nacl.box.after(message, nonce, sharedSecret);
```

### Message Types

| Type | Description |
|------|-------------|
| `text` | Plain text messages |
| `voice` | Voice message with audio blob |
| `image` | Encrypted image attachment |
| `file` | Encrypted file attachment |
| `reaction` | Emoji reactions |
| `receipt` | Blockchain-anchored receipt |

### Real-time Delivery (streaming.ts)

- WebSocket connections via Socket.io
- 8-lane transport prioritization
- Lane 2: Real-time messaging (high priority)
- Lane 3: Voice/video signaling (high priority)

### Wallet-Anchored Identity

- Wallet address as sole identifier
- SIWE (Sign-In With Ethereum) authentication
- No email, phone, or PII required
- Cross-device session resume via Session Bridge

---

## Messaging Modes

All modes are located in `client/src/components/atlas/modes/` and rendered within the Atlas shell:

### InboxMode.tsx
- Conversation list
- Unread indicators
- Last message preview
- Contact presence status

### MessagesMode.tsx
- Thread view with message history
- Real-time message streaming
- Typing indicators
- Read receipts

### CallsMode.tsx
- WebRTC voice calls
- WebRTC video calls
- Call history
- Missed call notifications

> **Note:** Calls functionality is rendered within Atlas Canvas but provides Nexus-style encrypted communications.

### ChatMode.tsx
- AI chat with intent parsing
- Natural language to action routing
- Multi-provider support (OpenAI, Anthropic, Gemini)

---

## Nexus SDK (messaging.ts)

```typescript
import { NexusMessaging } from '@/lib/sdk/messaging';

// Initialize
const nexus = new NexusMessaging(walletAddress);

// Send encrypted message
await nexus.send(recipientAddress, {
  type: 'text',
  content: 'Hello, secure world!',
  encrypted: true,
});

// Listen for messages
nexus.onMessage((msg) => {
  console.log('New message:', msg);
});

// Voice message
await nexus.sendVoice(recipientAddress, audioBlob);
```

---

## White-Label Use Cases

### 1. Secure Enterprise Communications

```
AI Prompt:
"Adapt Nexus for enterprise secure messaging:

1. In client/src/components/atlas/modes/MessagesMode.tsx:
   - Add organization/team selectors
   - Implement message retention policies
   - Add compliance audit logging

2. In client/src/lib/crypto.ts:
   - Add organization-level key management
   - Implement key escrow for compliance

3. In server/services/sessionBridge.ts:
   - Add SAML/SSO authentication alongside wallet
   - Map enterprise roles to message permissions

4. Create server/services/compliance.ts:
   - Message archiving for legal hold
   - DLP (data loss prevention) scanning
   - Export for e-discovery"
```

### 2. Customer Support Platform

```
AI Prompt:
"Build a customer support system on Nexus:

1. In client/src/components/atlas/modes/InboxMode.tsx:
   - Add ticket queue view
   - Priority sorting (urgent, high, normal)
   - Assignment to agents

2. In server/services/ticket.ts:
   - Extend ticket system with SLA tracking
   - Add escalation workflows
   - Integrate with external ticketing (Zendesk, Freshdesk)

3. Create client/src/components/atlas/modes/SupportDashboard.tsx:
   - Agent performance metrics
   - Queue depth visualization
   - Customer satisfaction scores

4. Add canned responses and knowledge base integration"
```

### 3. Telemedicine Platform

```
AI Prompt:
"Configure Nexus for HIPAA-compliant telemedicine:

1. In client/src/components/atlas/modes/CallsMode.tsx:
   - Add waiting room functionality
   - Implement session recording (with consent)
   - Add screen sharing for imaging review

2. In client/src/lib/crypto.ts:
   - Ensure AES-256-GCM for all PHI
   - Add audit logging for every access

3. In server/atlas/streaming.ts:
   - Configure Lane 3 for medical telemetry
   - Add HIPAA compliance headers

4. Create appointment scheduling integration
   - Calendar sync
   - Reminder notifications
   - Post-visit summary generation"
```

### 4. Supply Chain Communications

```
AI Prompt:
"Adapt Nexus for supply chain coordination:

1. In client/src/components/atlas/modes/MessagesMode.tsx:
   - Add shipment/order context to threads
   - Link messages to tracking numbers
   - Show delivery status inline

2. In server/routes/nexus/:
   - Add /api/nexus/orders/:orderId/messages
   - Integrate with logistics APIs

3. Create notification triggers:
   - Shipment delayed
   - Customs hold
   - Delivery confirmed
   - Exception occurred

4. Add proof-of-delivery with photo/signature capture"
```

---

## Customization Points

### Add Message Type

**File:** `client/src/components/MessageComposer.tsx`

```typescript
// Add new message type handler
const sendLocation = async () => {
  const position = await getCurrentPosition();
  await sendMessage({
    type: 'location',
    content: JSON.stringify(position),
    encrypted: true,
  });
};
```

### Custom Encryption

**File:** `client/src/lib/crypto.ts`

```typescript
// Add post-quantum hybrid encryption
export async function encryptMessagePQ(
  message: string,
  recipientPubKey: Uint8Array,
  kyberPubKey: Uint8Array
): Promise<EncryptedMessage> {
  // Hybrid X25519 + Kyber encryption
}
```

### Add Call Feature

**File:** `client/src/components/atlas/modes/CallsMode.tsx`

```typescript
// Add screen sharing
const startScreenShare = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia();
  peerConnection.addTrack(stream.getVideoTracks()[0], stream);
};
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/nexus/messages` | GET | List conversations |
| `/api/nexus/messages/:threadId` | GET | Get thread messages |
| `/api/nexus/messages` | POST | Send message |
| `/api/nexus/calls/initiate` | POST | Start call |
| `/api/nexus/presence` | GET | Get online status |
| `/api/nexus/keys/:address` | GET | Get public key |

---

## Related Documentation

- [AI Development Guide](./AI_DEVELOPMENT_GUIDE.md)
- [Cryptography Primitives](./CRYPTOGRAPHY_PRIMITIVES.md)
- [Real-Time Infrastructure](./REALTIME_INFRASTRUCTURE.md)
- [Session Bridge](./SESSION_BRIDGE.md)
- [Hub Shell](./HUB_SHELL.md)
- [Atlas Shell](./ATLAS_SHELL.md)
