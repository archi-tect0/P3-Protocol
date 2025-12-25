import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Phone, Lock, Mail, Users, Code, Key, Wifi, StickyNote, CreditCard } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function NexusGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Nexus Messaging Implementation Guide | P3 Protocol"
        description="Learn how to implement end-to-end encrypted messaging with wallet-anchored identity, WebRTC voice/video calls, and inbox sync."
      />
      
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <a href="https://github.com/archi-tect0/P3-Protocol" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-white/20">
                <SiGithub className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Nexus Messaging</h1>
              <p className="text-slate-400">End-to-End Encrypted Communication</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            Nexus provides fully encrypted messaging and calling using wallet addresses as identity. All messages are encrypted client-side with TweetNaCl before leaving the device. The server only sees encrypted blobs and cannot read message content.
          </p>
        </div>

        <div className="space-y-8">
          {/* Architecture */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-cyan-400" />
              Architecture Overview
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Nexus operates on a simple principle: wallet addresses are the only identity. There are no usernames, emails, or passwords. Users exchange public keys derived from their wallet, and all messages are encrypted end-to-end.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Message Flow</h4>
                  <ol className="text-sm text-slate-400 space-y-1 list-decimal pl-4">
                    <li>Sender encrypts message with recipient's public key</li>
                    <li>Encrypted blob sent to server</li>
                    <li>Server stores blob, notifies recipient</li>
                    <li>Recipient fetches and decrypts locally</li>
                  </ol>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Server Sees</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Sender wallet address</li>
                    <li>Recipient wallet address</li>
                    <li>Encrypted blob (unreadable)</li>
                    <li>Timestamp</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Sending Messages */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-violet-400" />
              Sending Encrypted Messages
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Messages are encrypted using the recipient's Curve25519 public key. The sender generates an ephemeral keypair for forward secrecy:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Client-side message sending
import { cryptoService } from '@/lib/crypto';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  from: string;        // Sender wallet address
  to: string;          // Recipient wallet address  
  encryptedContent: string;  // Base64 encrypted blob
  timestamp: number;
}

async function sendMessage(
  recipientAddress: string,
  recipientPubKey: string,
  content: string
): Promise<void> {
  // Encrypt message client-side
  const encrypted = cryptoService.encrypt(content, recipientPubKey);
  
  // Send encrypted blob to server
  await apiRequest('/api/nexus/messages', {
    method: 'POST',
    body: JSON.stringify({
      to: recipientAddress,
      encryptedContent: JSON.stringify(encrypted),
    })
  });
}

// Server only stores the encrypted blob - it cannot read the content
// POST /api/nexus/messages handler:
app.post('/api/nexus/messages', async (req, res) => {
  const { to, encryptedContent } = req.body;
  const from = req.session.walletAddress; // Authenticated sender
  
  await db.insert(messages).values({
    id: ulid(),
    from,
    to,
    encryptedContent, // Opaque blob to server
    timestamp: Date.now()
  });
  
  // Notify recipient via WebSocket
  io.to(to).emit('new_message', { from, timestamp: Date.now() });
  
  res.json({ success: true });
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* Inbox Sync */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              Inbox & Conversation Sync
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The inbox fetches encrypted messages and decrypts them locally. Conversations are grouped by contact address:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Fetching and decrypting inbox
async function loadInbox(): Promise<Conversation[]> {
  // Fetch encrypted messages from server
  const response = await fetch('/api/nexus/inbox');
  const { messages } = await response.json();
  
  // Group by conversation partner
  const conversations = new Map<string, Message[]>();
  
  for (const msg of messages) {
    const partner = msg.from === myAddress ? msg.to : msg.from;
    
    // Decrypt each message locally
    const encrypted = JSON.parse(msg.encryptedContent);
    const decrypted = cryptoService.decrypt(encrypted, msg.from);
    
    if (!conversations.has(partner)) {
      conversations.set(partner, []);
    }
    conversations.get(partner)!.push({
      ...msg,
      content: decrypted, // Decrypted content (never sent to server)
    });
  }
  
  return Array.from(conversations.entries()).map(([address, msgs]) => ({
    address,
    messages: msgs.sort((a, b) => a.timestamp - b.timestamp),
    lastMessage: msgs[msgs.length - 1],
  }));
}

// Real-time updates via Socket.io
socket.on('new_message', async ({ from, timestamp }) => {
  // Fetch the new message
  const response = await fetch(\`/api/nexus/messages/\${from}?since=\${timestamp - 1000}\`);
  const { messages } = await response.json();
  
  // Decrypt and add to conversation
  for (const msg of messages) {
    const encrypted = JSON.parse(msg.encryptedContent);
    const content = cryptoService.decrypt(encrypted, msg.from);
    addMessageToConversation(from, { ...msg, content });
  }
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* WebRTC Calls */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-amber-400" />
              WebRTC Voice & Video Calls
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Nexus supports peer-to-peer voice and video calls using WebRTC. Signaling happens through the server, but media flows directly between peers:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// WebRTC call initiation
class NexusCall {
  private pc: RTCPeerConnection;
  private localStream: MediaStream | null = null;
  
  async startCall(recipientAddress: string, video: boolean = false): Promise<void> {
    // Create peer connection with STUN/TURN servers
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:turn.p3protocol.io', username: 'p3', credential: '...' }
      ]
    });
    
    // Get local media
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video
    });
    
    // Add tracks to peer connection
    this.localStream.getTracks().forEach(track => {
      this.pc.addTrack(track, this.localStream!);
    });
    
    // Create and send offer via signaling server
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    
    socket.emit('call:offer', {
      to: recipientAddress,
      offer: this.pc.localDescription
    });
    
    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('call:ice-candidate', {
          to: recipientAddress,
          candidate: event.candidate
        });
      }
    };
    
    // Handle incoming remote stream
    this.pc.ontrack = (event) => {
      const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
      remoteVideo.srcObject = event.streams[0];
    };
  }
  
  async answerCall(offer: RTCSessionDescriptionInit, callerAddress: string): Promise<void> {
    await this.pc.setRemoteDescription(offer);
    
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    
    socket.emit('call:answer', {
      to: callerAddress,
      answer: this.pc.localDescription
    });
  }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Server Signaling */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-pink-400" />
              WebSocket Signaling Server
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The signaling server relays WebRTC offers, answers, and ICE candidates between peers:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// server/ws/signaling.ts
import { Server } from 'socket.io';

export function setupSignaling(io: Server) {
  io.on('connection', (socket) => {
    const walletAddress = socket.handshake.auth.walletAddress;
    
    // Join room by wallet address for targeted messaging
    socket.join(walletAddress);
    
    // Relay call offer
    socket.on('call:offer', ({ to, offer }) => {
      io.to(to).emit('call:incoming', {
        from: walletAddress,
        offer
      });
    });
    
    // Relay call answer
    socket.on('call:answer', ({ to, answer }) => {
      io.to(to).emit('call:answered', {
        from: walletAddress,
        answer
      });
    });
    
    // Relay ICE candidates
    socket.on('call:ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('call:ice-candidate', {
        from: walletAddress,
        candidate
      });
    });
    
    // Handle call end
    socket.on('call:end', ({ to }) => {
      io.to(to).emit('call:ended', { from: walletAddress });
    });
  });
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Exchange */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-cyan-400" />
              Public Key Exchange
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Before messaging, users must exchange public keys. This happens when adding a contact:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Adding a contact (exchanging public keys)
async function addContact(contactAddress: string): Promise<Contact> {
  // Get my public key
  const myPubKey = cryptoService.getPublicKey();
  
  // Register my public key with server (if not already)
  await apiRequest('/api/nexus/keys', {
    method: 'POST',
    body: JSON.stringify({ publicKey: myPubKey })
  });
  
  // Fetch contact's public key
  const response = await fetch(\`/api/nexus/keys/\${contactAddress}\`);
  const { publicKey: contactPubKey } = await response.json();
  
  if (!contactPubKey) {
    throw new Error('Contact has not registered their public key');
  }
  
  // Store contact locally
  const contact = {
    address: contactAddress,
    publicKey: contactPubKey,
    addedAt: Date.now()
  };
  
  await localDb.contacts.add(contact);
  return contact;
}

// Server endpoint for public key storage
app.post('/api/nexus/keys', async (req, res) => {
  const { publicKey } = req.body;
  const walletAddress = req.session.walletAddress;
  
  await db.insert(publicKeys).values({
    walletAddress,
    publicKey,
    updatedAt: Date.now()
  }).onConflictDoUpdate({
    target: publicKeys.walletAddress,
    set: { publicKey, updatedAt: Date.now() }
  });
  
  res.json({ success: true });
});`}</code></pre>
              </div>
            </div>
          </section>

          {/* Encrypted Notes */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-amber-400" />
              Encrypted Notes
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Notes are encrypted client-side before storage. Only the wallet owner can decrypt their notes.
                Notes sync across devices via the server but remain unreadable to anyone without the private key.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// client/src/components/atlas/modes/NotesMode.tsx

interface NoteRecord {
  id: string;
  title: string;
  encryptedBody?: string;      // Encrypted with user's key
  searchableContent?: string;  // Optional plaintext for local search
  isPinned: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Creating an encrypted note
async function createNote(title: string, content: string): Promise<void> {
  const encrypted = cryptoService.encrypt(content, userPublicKey);
  
  await apiRequest('/api/nexus/notes', {
    method: 'POST',
    body: JSON.stringify({
      title,
      encryptedBody: JSON.stringify(encrypted),
      // Optionally include searchable content for local indexing
      searchableContent: null  // Keep null for full privacy
    })
  });
}

// Notes are fetched encrypted, decrypted locally
const { data } = useQuery({
  queryKey: ['/api/nexus/notes', wallet],
  enabled: !!wallet,
});

// Decrypt each note on the client
const decryptedNotes = data.notes.map(note => ({
  ...note,
  content: note.encryptedBody 
    ? cryptoService.decrypt(JSON.parse(note.encryptedBody))
    : note.searchableContent
}));`}</code></pre>
              </div>
            </div>
          </section>

          {/* Payments & Anchoring */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              Payments & Blockchain Anchoring
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Payments are tracked by wallet address and anchored to the blockchain for immutable audit trails.
                Each payment generates a receipt that can be verified on-chain.
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// client/src/components/atlas/modes/PaymentsMode.tsx

interface PaymentRecord {
  id: string;
  type: string;           // 'sent' | 'received'
  amount: string;
  token?: string;         // Token symbol (ETH, USDC, etc.)
  fromWallet?: string;
  toWallet?: string;
  status: string;         // 'pending' | 'confirmed' | 'anchored'
  txHash?: string;        // On-chain transaction hash
  createdAt?: string;
}

// Fetch payment history for connected wallet
const { data } = useQuery({
  queryKey: ['/api/payments/history', wallet],
  queryFn: async () => {
    const res = await fetch(\`/api/payments/history?address=\${wallet}\`, {
      headers: { 'x-wallet-address': wallet }
    });
    return res.json();
  },
  enabled: !!wallet,
});

// Each payment action generates a receipt for audit trail
useEffect(() => {
  if (data?.payments) {
    pushReceipt({
      id: \`receipt-payments-\${Date.now()}\`,
      hash: \`0x\${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}\`,
      scope: 'atlas.render.payments',
      endpoint: '/api/payments',
      timestamp: Date.now()
    });
  }
}, [data]);`}</code></pre>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Payment Flow</h4>
                  <ol className="text-sm text-slate-400 space-y-1 list-decimal pl-4">
                    <li>User initiates payment from wallet</li>
                    <li>Transaction submitted to blockchain</li>
                    <li>Server detects confirmation</li>
                    <li>Receipt anchored via BullMQ queue</li>
                    <li>Immutable audit trail created</li>
                  </ol>
                </div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <h4 className="font-semibold text-white mb-2">Anchoring Data</h4>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc pl-4">
                    <li>Payment hash (SHA-256)</li>
                    <li>Sender/recipient addresses</li>
                    <li>Amount and token</li>
                    <li>Timestamp (block time)</li>
                    <li>Receipt ID for lookup</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-cyan-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">client/src/lib/crypto.ts</code>
                <span className="text-xs text-slate-500">Encryption service</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-violet-400">server/routes/nexus/messaging.ts</code>
                <span className="text-xs text-slate-500">Message API routes</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">client/src/components/atlas/modes/NotesMode.tsx</code>
                <span className="text-xs text-slate-500">Encrypted notes UI</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-emerald-400">client/src/components/atlas/modes/PaymentsMode.tsx</code>
                <span className="text-xs text-slate-500">Payments UI</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-pink-400">client/src/components/nodestream/</code>
                <span className="text-xs text-slate-500">WebRTC components</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/atlas-api">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Atlas API v2
            </Button>
          </Link>
          <Link href="/docs/canvas-modes">
            <Button className="bg-gradient-to-r from-cyan-500 to-blue-500">
              Next: Canvas Modes
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
