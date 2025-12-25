export interface KnowledgeTopic {
  id: string;
  title: string;
  category: 'overview' | 'security' | 'features' | 'infrastructure' | 'developer';
  keywords: string[];
  summary: string;
  content: string;
  followUp: string[];
}

export const knowledgeBase: KnowledgeTopic[] = [
  {
    id: 'atlas-overview',
    title: 'What is Atlas?',
    category: 'overview',
    keywords: ['atlas', 'what is atlas', 'about atlas', 'explain atlas', 'tell me about atlas'],
    summary: 'Atlas is your voice-first AI assistant for the P3 mesh network.',
    content: `Atlas is the central orchestration layer of the P3 Protocol - a voice-first AI assistant that unifies Web2, Web3, and voice interactions into a single, deterministic execution substrate.

**Core Capabilities:**
• **Voice Commands** - Speak naturally to navigate apps, send messages, or execute flows
• **Canvas UI** - 30+ modes including News, Games, eReader, Payments, and more
• **Mesh Participation** - Contribute to network health via Node Mode
• **Wallet-Anchored Sessions** - Your wallet is your identity, no passwords needed
• **End-to-End Encryption** - All messages secured with Nexus encryption

Atlas serves as your personal gateway to the decentralized P3 mesh, making Web3 interactions as simple as having a conversation.`,
    followUp: ['What is P3 Protocol?', 'Explain Nexus encryption', 'What is Node Mode?'],
  },
  {
    id: 'p3-protocol',
    title: 'What is P3 Protocol?',
    category: 'overview',
    keywords: ['p3', 'p3 protocol', 'what is p3', 'protocol', 'mesh network'],
    summary: 'P3 Protocol is a Web3 Mesh Operating System for decentralized applications.',
    content: `P3 Protocol is a production-ready Web3 Mesh Operating System offering programmable infrastructure for decentralized applications.

**Key Components:**
• **Atlas** - Central orchestration substrate for apps, APIs, and Web3 flows
• **Nexus** - End-to-end encrypted messaging and calls
• **Node Mode** - Distributed client network for mesh participation
• **Canvas** - Unified UI surface with 30+ application modes
• **Blockchain Anchoring** - Immutable audit trails on Base Network

**Design Principles:**
• Zero-PII - Wallet addresses are the sole identifiers
• Production-First - All code is production-ready
• Deterministic Execution - Endpoints execute reliably with LLM interpretation
• Credential Isolation - LLMs never touch API keys

P3 unifies Web2, Web3, and voice into a single execution substrate.`,
    followUp: ['What is Atlas?', 'How does gating work?', 'Explain blockchain anchoring'],
  },
  {
    id: 'nexus-encryption',
    title: 'Nexus Encryption',
    category: 'security',
    keywords: ['nexus', 'encryption', 'e2ee', 'end to end', 'secure messaging', 'cryptography'],
    summary: 'Nexus provides military-grade end-to-end encryption for all P3 communications.',
    content: `Nexus is the cryptographic backbone of P3 Protocol, providing end-to-end encryption for all communications.

**Encryption Stack:**
• **TweetNaCl** - Fast, audited cryptographic primitives
• **Kyber Post-Quantum Hybrid** - Future-proof against quantum attacks
• **AES-256-GCM** - Industry-standard symmetric encryption

**How It Works:**
1. Each wallet generates a unique keypair on first connection
2. Messages are encrypted client-side before transmission
3. Only the recipient's private key can decrypt
4. Server never sees plaintext content

**What's Protected:**
• Direct messages between wallets
• Voice/video call signaling
• File attachments and media
• Payment metadata

Your conversations remain private - not even Atlas can read them.`,
    followUp: ['What is wallet gating?', 'How do secure calls work?', 'What is P3 Protocol?'],
  },
  {
    id: 'gating',
    title: 'How Gating Works',
    category: 'security',
    keywords: ['gating', 'wallet gating', 'access control', 'permissions', 'token gating', 'nft gating'],
    summary: 'Gating controls access to content and features based on wallet credentials.',
    content: `Gating is the P3 access control system that determines what you can see and do based on your wallet credentials.

**Types of Gating:**
• **Token Gating** - Requires holding specific tokens (ERC-20, ERC-721, ERC-1155)
• **Wallet Gating** - Restricts to specific wallet addresses
• **Role Gating** - Based on assigned roles (user, developer, admin)
• **Subscription Gating** - Time-based access via on-chain subscriptions

**How It Works:**
1. Content creator sets gating requirements
2. When you attempt access, Atlas verifies your wallet
3. Smart contract checks are performed on-chain
4. Access granted or denied based on verification

**Use Cases:**
• Premium content for token holders
• Private channels for community members
• Developer-only API endpoints
• Exclusive app features

Gating is cryptographically enforced - no backdoors, no exceptions.`,
    followUp: ['Explain Nexus encryption', 'What is blockchain anchoring?', 'How do payments work?'],
  },
  {
    id: 'node-mode',
    title: 'What is Node Mode?',
    category: 'infrastructure',
    keywords: ['node', 'node mode', 'mesh', 'participation', 'distributed', 'peer'],
    summary: 'Node Mode lets you contribute to the P3 mesh network while earning participation rewards.',
    content: `Node Mode transforms your device into a participating node in the P3 mesh network.

**What Node Mode Does:**
• **Validation** - Helps verify content authenticity
• **Relay** - Routes encrypted messages between peers
• **Caching** - Stores popular content for faster delivery

**Benefits:**
• Improved network reliability for everyone
• Faster content loading through distributed caching
• Contribution tracking for future rewards
• Real-time diagnostics on your connection health

**How It Works:**
1. Node Mode is enabled by default when you open Atlas
2. Your device joins the mesh as a lightweight participant
3. Tasks are assigned based on your connection quality
4. Diagnostics show your contribution level and network health

**Privacy:**
• You relay encrypted data you cannot read
• No personal data is collected or shared
• Opt-out anytime in Settings

Node Mode is how Atlas stays alive - every connected device strengthens the mesh.`,
    followUp: ['View my diagnostics', 'What is P3 Protocol?', 'Explain Nexus encryption'],
  },
  {
    id: 'canvas-modes',
    title: 'Canvas Modes',
    category: 'features',
    keywords: ['canvas', 'modes', 'apps', 'hub', 'features', 'what can atlas do'],
    summary: 'Canvas provides 30+ application modes accessible through voice or touch.',
    content: `Canvas is the unified UI surface of Atlas, offering 30+ specialized modes for different tasks.

**Nexus Modes (Communication):**
• **Inbox** - Unified notification center
• **Messages** - End-to-end encrypted chat
• **Calls** - Secure voice/video calls
• **Payments** - Send and receive crypto

**Content Modes:**
• **News** - Live news feeds with AI summaries
• **TV** - Live streaming channels
• **Game Deck** - Free-to-play game discovery
• **eReader** - Digital book library
• **Media** - Video and audio content

**Utility Modes:**
• **Weather** - Location-based forecasts
• **Calculator** - Math and conversions
• **Notes** - Encrypted note-taking
• **Camera** - Photo capture

**Developer Modes:**
• **Pulse** - Analytics dashboard
• **Registry** - API endpoint management
• **Orchestration** - Flow builder

Access any mode by voice: "Open News", "Launch Game Deck", "Show my messages"`,
    followUp: ['Open Hub', 'What is Node Mode?', 'How do payments work?'],
  },
  {
    id: 'blockchain-anchoring',
    title: 'Blockchain Anchoring',
    category: 'infrastructure',
    keywords: ['blockchain', 'anchoring', 'base', 'immutable', 'audit', 'receipts', 'on-chain'],
    summary: 'Blockchain anchoring creates immutable audit trails for critical actions.',
    content: `Blockchain anchoring creates permanent, tamper-proof records of important actions on the Base Network.

**What Gets Anchored:**
• Payment transactions
• Content purchases and rentals
• Identity verifications
• Critical flow executions

**How It Works:**
1. Action is completed in Atlas
2. SHA-256 hash of the action data is computed
3. Hash is submitted to P3 Protocol smart contract on Base
4. Transaction ID returned as proof

**Benefits:**
• **Immutability** - Records cannot be altered or deleted
• **Transparency** - Anyone can verify the audit trail
• **Dispute Resolution** - Cryptographic proof of actions
• **Compliance** - Auditable history for regulations

**Viewing Receipts:**
Say "Show my receipts" or open the Receipts mode to see all your anchored transactions.

Anchoring is asynchronous - it happens in the background via BullMQ without blocking your experience.`,
    followUp: ['How do payments work?', 'What is P3 Protocol?', 'Show my receipts'],
  },
  {
    id: 'payments',
    title: 'How Payments Work',
    category: 'features',
    keywords: ['payments', 'pay', 'send', 'receive', 'crypto', 'transfer', 'money'],
    summary: 'Send and receive crypto payments directly through Atlas voice commands.',
    content: `Atlas enables seamless crypto payments through voice or the Payments canvas.

**Sending Payments:**
• Say "Send 0.1 ETH to [address]" or "Pay @username 50 USDC"
• Confirm the transaction details
• Sign with your connected wallet
• Transaction is anchored on-chain

**Receiving Payments:**
• Share your wallet address or username
• Get notified when payment arrives
• View history in Payments mode

**Supported:**
• ETH and ERC-20 tokens on Base Network
• Cross-chain support via bridges (coming soon)

**Security:**
• All transactions require wallet signature
• No funds are ever custodied by Atlas
• Transaction receipts are blockchain-anchored

**Voice Commands:**
• "Send payment" - Start payment flow
• "Check my balance" - View wallet balance
• "Show payment history" - View past transactions

Your keys, your crypto - Atlas just makes it easier to use.`,
    followUp: ['What is blockchain anchoring?', 'Explain Nexus encryption', 'What is gating?'],
  },
];

export function findKnowledgeTopic(query: string): KnowledgeTopic | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  for (const topic of knowledgeBase) {
    for (const keyword of topic.keywords) {
      if (normalizedQuery.includes(keyword)) {
        return topic;
      }
    }
  }
  
  const partialMatches = knowledgeBase.filter(topic => {
    const words = normalizedQuery.split(/\s+/);
    return words.some(word => 
      word.length > 3 && topic.keywords.some(kw => kw.includes(word) || word.includes(kw.split(' ')[0]))
    );
  });
  
  return partialMatches[0] || null;
}

export function getKnowledgeSuggestions(): string[] {
  return [
    'What is Atlas?',
    'Explain Nexus encryption',
    'How does gating work?',
    'What is Node Mode?',
    'Tell me about P3 Protocol',
  ];
}

export function formatKnowledgeResponse(topic: KnowledgeTopic): {
  content: string;
  suggestions: string[];
} {
  return {
    content: `**${topic.title}**\n\n${topic.content}`,
    suggestions: topic.followUp,
  };
}
