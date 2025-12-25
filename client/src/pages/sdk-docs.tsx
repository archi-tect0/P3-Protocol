import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Gamepad2,
  Wallet,
  Zap,
  Anchor,
  Image,
  Trophy,
  Package,
  ShoppingCart,
  DollarSign,
  Shield,
  Code,
  Copy,
  Check,
  Globe,
} from 'lucide-react';

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre 
        className="bg-zinc-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm"
        data-testid="code-block"
      >
        {code}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-zinc-800 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid="btn-copy-code"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
      </button>
    </div>
  );
}

function EndpointCard({ 
  method, 
  path, 
  description, 
  requestExample, 
  responseExample,
  typeDefinition,
  testId
}: { 
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  requestExample?: string;
  responseExample?: string;
  typeDefinition?: string;
  testId: string;
}) {
  const methodColors = {
    GET: 'bg-green-500/20 text-green-400 border-green-500/30',
    POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700" data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${methodColors[method]}`}>
            {method}
          </span>
          <code className="text-sm text-slate-300 font-mono">{path}</code>
        </div>
        <CardDescription className="text-slate-400 mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {typeDefinition && (
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">TypeScript Types</h4>
            <CodeBlock code={typeDefinition} />
          </div>
        )}
        {requestExample && (
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Request</h4>
            <CodeBlock code={requestExample} />
          </div>
        )}
        {responseExample && (
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2">Response</h4>
            <CodeBlock code={responseExample} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6" data-testid="tab-content-overview">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white">Getting Started</CardTitle>
          <CardDescription className="text-slate-400">
            The Atlas Game Deck SDK provides a comprehensive API for game developers to integrate with the P3 Protocol ecosystem.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Gamepad2 className="w-5 h-5 text-purple-400" />
                <h4 className="font-medium text-white">Games API</h4>
              </div>
              <p className="text-sm text-slate-400">Submit, search, and manage games in the Game Deck catalog.</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h4 className="font-medium text-white">Events API</h4>
              </div>
              <p className="text-sm text-slate-400">Log player events like achievements, sessions, and scores.</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <Anchor className="w-5 h-5 text-cyan-400" />
                <h4 className="font-medium text-white">Anchoring API</h4>
              </div>
              <p className="text-sm text-slate-400">Anchor events on-chain for verifiable proof and transparency.</p>
            </div>
            <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="flex items-center gap-3 mb-2">
                <ShoppingCart className="w-5 h-5 text-green-400" />
                <h4 className="font-medium text-white">Purchases API</h4>
              </div>
              <p className="text-sm text-slate-400">Handle game purchases with blockchain verification.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Base URL</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={`// All API endpoints are prefixed with:
const BASE_URL = '/api/gamedeck';

// Example: Submit a game
const response = await fetch('/api/gamedeck/submit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-wallet-address': walletAddress
  },
  body: JSON.stringify(gameData)
});`} />
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">Quick Example</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={`// 1. Submit a game
const game = await fetch('/api/gamedeck/submit', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({ 
    title: 'My Awesome Game', 
    genre: 'action', 
    platform: 'web', 
    developer: 'My Studio' 
  }),
}).then(r => r.json());

// 2. Log a player event
const event = await fetch('/api/gamedeck/event', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({ 
    gameId: game.game.id, 
    type: 'achievement', 
    payload: { name: 'First Victory', score: 1000 } 
  }),
}).then(r => r.json());

// 3. Anchor the event on-chain
const anchor = await fetch('/api/gamedeck/anchor/direct', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({ 
    chain: 'base', 
    gameId: game.game.id, 
    eventId: event.event.id 
  }),
}).then(r => r.json());`} />
        </CardContent>
      </Card>
    </div>
  );
}

function AuthenticationTab() {
  return (
    <div className="space-y-6" data-testid="tab-content-authentication">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            Wallet Authentication
          </CardTitle>
          <CardDescription className="text-slate-400">
            All authenticated endpoints require a wallet address passed via the x-wallet-address header.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock code={`// Required header for authenticated requests
const headers = {
  'Content-Type': 'application/json',
  'x-wallet-address': '0x742d35Cc6634C0532925a3b844Bc9e7595f...'
};

// Example authenticated request
const response = await fetch('/api/gamedeck/submit', {
  method: 'POST',
  headers,
  body: JSON.stringify(data)
});`} />
          
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h4 className="font-medium text-amber-400 mb-2">Authentication Flow</h4>
            <ol className="text-sm text-slate-300 space-y-2 list-decimal list-inside">
              <li>User connects wallet via WalletConnect or injected provider</li>
              <li>Wallet address is extracted from the connected session</li>
              <li>Include <code className="text-amber-400">x-wallet-address</code> header in all API requests</li>
              <li>Server validates the wallet and associates actions with the address</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white">TypeScript Helper</CardTitle>
        </CardHeader>
        <CardContent>
          <CodeBlock code={`// Helper function for authenticated requests
async function gameDeckFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const wallet = localStorage.getItem('walletAddress');
  if (!wallet) throw new Error('Wallet not connected');

  const response = await fetch(\`/api/gamedeck\${endpoint}\`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-wallet-address': wallet,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

// Usage
const game = await gameDeckFetch<{ game: Game }>('/submit', {
  method: 'POST',
  body: JSON.stringify({ title: 'My Game', developer: 'My Studio' }),
});`} />
        </CardContent>
      </Card>
    </div>
  );
}

function GamesAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-games">
      <EndpointCard
        method="POST"
        path="/api/gamedeck/submit"
        description="Submit a new game or update an existing one. Games are identified by a generated slug based on the developer name and title."
        typeDefinition={`interface GameSubmitRequest {
  title: string;           // 1-200 characters
  genre?: string;          // e.g., 'action', 'puzzle', 'rpg'
  platform?: string;       // e.g., 'web', 'mobile', 'desktop'
  url?: string;            // Valid URL to the game
  thumbnail?: string;      // Valid URL to thumbnail image
  developer: string;       // 1-100 characters
  description?: string;    // Max 2000 characters
  tags?: string[];         // Array of tag strings
}

interface GameSubmitResponse {
  game: {
    id: string;
    title: string;
    genre: string | null;
    platform: string | null;
    url: string | null;
    thumbnail: string | null;
    developer: string;
    description: string | null;
    tags: string[];
    source: 'developer';
    createdAt: string;
    updatedAt: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/submit', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    title: 'Space Raiders',
    genre: 'action',
    platform: 'web',
    url: 'https://mygame.example.com',
    thumbnail: 'https://mygame.example.com/thumb.png',
    developer: 'Indie Studio',
    description: 'An epic space adventure game',
    tags: ['space', 'shooter', 'multiplayer']
  }),
});`}
        responseExample={`{
  "game": {
    "id": "dev:indie-studio:space-raiders",
    "title": "Space Raiders",
    "genre": "action",
    "platform": "web",
    "url": "https://mygame.example.com",
    "thumbnail": "https://mygame.example.com/thumb.png",
    "developer": "Indie Studio",
    "description": "An epic space adventure game",
    "tags": ["space", "shooter", "multiplayer"],
    "source": "developer",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-games-submit"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/games"
        description="Search and list games with optional filters for genre, platform, source, and text search."
        typeDefinition={`interface GamesQueryParams {
  q?: string;              // Text search query
  genre?: string;          // Filter by genre
  platform?: string;       // Filter by platform
  source?: 'developer' | 'freetogame' | 'gamerpower' | 'itch';
  limit?: number;          // Max 100, default 50
  offset?: number;         // Pagination offset
}

interface GamesListResponse {
  games: Game[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}`}
        requestExample={`// Search for action games
const response = await fetch('/api/gamedeck/games?q=space&genre=action&limit=10');

// Get developer-submitted games
const devGames = await fetch('/api/gamedeck/games?source=developer&limit=20');`}
        responseExample={`{
  "games": [
    {
      "id": "dev:indie-studio:space-raiders",
      "title": "Space Raiders",
      "genre": "action",
      "platform": "web",
      "developer": "Indie Studio",
      "source": "developer"
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 1
  }
}`}
        testId="endpoint-games-list"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/games/favorite"
        description="Add a game to the user's favorites list with optional position ordering."
        typeDefinition={`interface FavoriteGameRequest {
  gameId: string;          // Game ID to favorite
  position?: number;       // Optional position in favorites (0-indexed)
}

interface FavoriteGameResponse {
  favorite: {
    id: string;
    wallet: string;
    gameId: string;
    position: number;
    createdAt: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/games/favorite', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    position: 0
  }),
});`}
        responseExample={`{
  "favorite": {
    "id": "fav_abc123",
    "wallet": "0x742d35Cc...",
    "gameId": "dev:indie-studio:space-raiders",
    "position": 0,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-games-favorite"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/games/pull"
        description="Pull games from external sources (FreeToGame, GamerPower) into the Game Deck catalog."
        typeDefinition={`interface PullGamesRequest {
  source: 'freetogame' | 'gamerpower';
  filters?: {
    genre?: string;
    platform?: string;
    search?: string;
    type?: string;
  };
}

interface PullGamesResponse {
  source: string;
  fetched: number;
  upserted: number;
  errors: string[];
}`}
        requestExample={`const response = await fetch('/api/gamedeck/games/pull', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'freetogame',
    filters: { genre: 'mmorpg' }
  }),
});`}
        responseExample={`{
  "source": "freetogame",
  "fetched": 50,
  "upserted": 48,
  "errors": []
}`}
        testId="endpoint-games-pull"
      />
    </div>
  );
}

function EventsAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-events">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Event Types
          </CardTitle>
          <CardDescription className="text-slate-400">
            The Events API supports various event types for tracking player activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {['session.start', 'session.end', 'achievement', 'score', 'level.complete', 'purchase', 'tournament.entry', 'custom'].map(type => (
              <div key={type} className="px-3 py-2 bg-slate-800 rounded text-sm font-mono text-amber-400">
                {type}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EndpointCard
        method="POST"
        path="/api/gamedeck/event"
        description="Log a player event for a game. Events can be anchored on-chain for verifiable proof."
        typeDefinition={`type GameEventType = 
  | 'session.start' 
  | 'session.end' 
  | 'achievement' 
  | 'score' 
  | 'level.complete' 
  | 'purchase' 
  | 'tournament.entry' 
  | 'custom';

interface GameEventRequest {
  gameId: string;                    // Game ID
  type: GameEventType;               // Event type
  payload: Record<string, any>;      // Event-specific data
}

interface GameEventResponse {
  event: {
    id: string;                      // UUID
    wallet: string;
    gameId: string;
    eventType: GameEventType;
    payload: Record<string, any>;
    developer: string;
    anchorId: string | null;
    createdAt: string;
  };
}`}
        requestExample={`// Log an achievement event
const response = await fetch('/api/gamedeck/event', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    type: 'achievement',
    payload: {
      name: 'First Victory',
      description: 'Won your first battle',
      score: 1000,
      level: 5
    }
  }),
});

// Log a session start
const session = await fetch('/api/gamedeck/event', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    type: 'session.start',
    payload: {
      platform: 'web',
      userAgent: navigator.userAgent
    }
  }),
});`}
        responseExample={`{
  "event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "wallet": "0x742d35Cc...",
    "gameId": "dev:indie-studio:space-raiders",
    "eventType": "achievement",
    "payload": {
      "name": "First Victory",
      "description": "Won your first battle",
      "score": 1000,
      "level": 5
    },
    "developer": "Indie Studio",
    "anchorId": null,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-events-create"
      />
    </div>
  );
}

function AnchoringAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-anchoring">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Anchor className="w-5 h-5 text-cyan-400" />
            On-Chain Anchoring
          </CardTitle>
          <CardDescription className="text-slate-400">
            Anchor game events on-chain to create verifiable, immutable proofs. Events are hashed and stored in a Merkle tree for efficient verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <h4 className="font-medium text-cyan-400 mb-2">Anchoring Modes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-white">Direct Anchoring</span>
                <p className="text-slate-400">Anchor a single event immediately. Best for critical events.</p>
              </div>
              <div>
                <span className="font-medium text-white">Batch Anchoring</span>
                <p className="text-slate-400">Anchor multiple events in one transaction. More cost-effective.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EndpointCard
        method="POST"
        path="/api/gamedeck/anchor/direct"
        description="Anchor a single event directly on-chain. Creates an immediate proof with transaction hash."
        typeDefinition={`interface AnchorDirectRequest {
  chain?: string;          // Default: 'base'
  gameId: string;          // Game ID
  eventId: string;         // UUID of the event to anchor
}

interface AnchorDirectResponse {
  anchorId: string;
  txHash: string;
  feeWei: string;
}`}
        requestExample={`const response = await fetch('/api/gamedeck/anchor/direct', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    chain: 'base',
    gameId: 'dev:indie-studio:space-raiders',
    eventId: '550e8400-e29b-41d4-a716-446655440000'
  }),
});`}
        responseExample={`{
  "anchorId": "anchor_xyz789",
  "txHash": "0x1234567890abcdef...",
  "feeWei": "100000000000000"
}`}
        testId="endpoint-anchor-direct"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/anchor/batch"
        description="Anchor multiple events in a single transaction using a Merkle tree. More cost-effective for bulk operations."
        typeDefinition={`interface AnchorBatchRequest {
  chain?: string;          // Default: 'base'
  gameId: string;          // Game ID
  eventIds: string[];      // Array of event UUIDs (1-100)
}

interface AnchorBatchResponse {
  anchorId: string;
  txHash: string;
  rootHash: string;
  perEventFeeWei: string;
  totalFeeWei: string;
}`}
        requestExample={`const response = await fetch('/api/gamedeck/anchor/batch', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    chain: 'base',
    gameId: 'dev:indie-studio:space-raiders',
    eventIds: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002'
    ]
  }),
});`}
        responseExample={`{
  "anchorId": "anchor_batch_abc123",
  "txHash": "0xabcdef1234567890...",
  "rootHash": "0x9876543210fedcba...",
  "perEventFeeWei": "100000000000000",
  "totalFeeWei": "300000000000000"
}`}
        testId="endpoint-anchor-batch"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/anchor/:eventId"
        description="Get the anchor status and proof for a specific event."
        typeDefinition={`interface AnchorStatusResponse {
  event: GameEvent;
  anchored: boolean;
  verified: boolean;
  proof: {
    leafHash: string;
    merklePath: string[];
    leafIndex: number;
  } | null;
  anchorRecord: {
    id: string;
    chain: string;
    mode: 'direct' | 'batch';
    txHash: string;
    rootHash: string;
    status: string;
  } | null;
}`}
        requestExample={`const response = await fetch('/api/gamedeck/anchor/550e8400-e29b-41d4-a716-446655440000');`}
        responseExample={`{
  "event": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "wallet": "0x742d35Cc...",
    "gameId": "dev:indie-studio:space-raiders",
    "eventType": "achievement"
  },
  "anchored": true,
  "verified": true,
  "proof": {
    "leafHash": "0xabc123...",
    "merklePath": ["0xdef456...", "0x789ghi..."],
    "leafIndex": 0
  },
  "anchorRecord": {
    "id": "anchor_xyz789",
    "chain": "base",
    "mode": "direct",
    "txHash": "0x1234567890abcdef...",
    "rootHash": "0x9876543210fedcba...",
    "status": "confirmed"
  }
}`}
        testId="endpoint-anchor-status"
      />
    </div>
  );
}

function NFTsAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-nfts">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Image className="w-5 h-5 text-pink-400" />
            NFT Integration
          </CardTitle>
          <CardDescription className="text-slate-400">
            Inject and manage game-related NFTs. Track ownership and metadata for in-game assets.
          </CardDescription>
        </CardHeader>
      </Card>

      <EndpointCard
        method="POST"
        path="/api/gamedeck/nfts/inject"
        description="Inject an NFT into the Game Deck registry. Associates the NFT with the user's wallet for in-game use."
        typeDefinition={`interface NftInjectRequest {
  chain: string;           // e.g., 'ethereum', 'base', 'polygon'
  contract: string;        // NFT contract address
  tokenId: string;         // Token ID
  metadata?: {
    name?: string;
    description?: string;
    image?: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}

interface NftInjectResponse {
  nft: {
    id: string;            // Format: chain:contract:tokenId
    wallet: string;
    chain: string;
    contract: string;
    tokenId: string;
    name: string | null;
    description: string | null;
    image: string | null;
    attributes: any[] | null;
    metadata: any | null;
    createdAt: string;
    updatedAt: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/nfts/inject', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    chain: 'base',
    contract: '0x1234567890abcdef...',
    tokenId: '42',
    metadata: {
      name: 'Legendary Sword',
      description: 'A powerful weapon from Space Raiders',
      image: 'ipfs://QmXyz...',
      attributes: [
        { trait_type: 'Damage', value: 100 },
        { trait_type: 'Rarity', value: 'Legendary' }
      ]
    }
  }),
});`}
        responseExample={`{
  "nft": {
    "id": "base:0x1234567890abcdef...:42",
    "wallet": "0x742d35Cc...",
    "chain": "base",
    "contract": "0x1234567890abcdef...",
    "tokenId": "42",
    "name": "Legendary Sword",
    "description": "A powerful weapon from Space Raiders",
    "image": "ipfs://QmXyz...",
    "attributes": [
      { "trait_type": "Damage", "value": 100 },
      { "trait_type": "Rarity", "value": "Legendary" }
    ],
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-nfts-inject"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/nfts"
        description="Get all NFTs owned by the authenticated wallet."
        requestExample={`const response = await fetch('/api/gamedeck/nfts', {
  headers: { 'x-wallet-address': wallet }
});`}
        responseExample={`{
  "wallet": "0x742d35Cc...",
  "nfts": [
    {
      "id": "base:0x1234...:42",
      "name": "Legendary Sword",
      "chain": "base",
      "tokenId": "42"
    }
  ],
  "count": 1
}`}
        testId="endpoint-nfts-list"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/nfts/by-wallet/:wallet"
        description="Get NFTs owned by a specific wallet address. Useful for viewing other players' collections."
        requestExample={`const response = await fetch('/api/gamedeck/nfts/by-wallet/0x742d35Cc...');`}
        responseExample={`{
  "wallet": "0x742d35Cc...",
  "nfts": [
    {
      "id": "base:0x1234...:42",
      "name": "Legendary Sword"
    }
  ],
  "count": 1
}`}
        testId="endpoint-nfts-by-wallet"
      />
    </div>
  );
}

function LeaderboardsAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-leaderboards">
      <EndpointCard
        method="POST"
        path="/api/gamedeck/leaderboard"
        description="Submit a score to a game's leaderboard. Scores are associated with events for verification."
        typeDefinition={`interface LeaderboardSubmitRequest {
  gameId: string;          // Game ID
  score: number;           // Player's score
  eventId: string;         // UUID of the score event
  key?: string;            // Leaderboard key (default: 'global')
}

interface LeaderboardSubmitResponse {
  entry: {
    id: string;
    wallet: string;
    gameId: string;
    score: number;
    eventId: string;
    key: string;
    rank: number;
    createdAt: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/leaderboard', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    score: 15000,
    eventId: '550e8400-e29b-41d4-a716-446655440000',
    key: 'weekly'
  }),
});`}
        responseExample={`{
  "entry": {
    "id": "lb_abc123",
    "wallet": "0x742d35Cc...",
    "gameId": "dev:indie-studio:space-raiders",
    "score": 15000,
    "eventId": "550e8400-e29b-41d4-a716-446655440000",
    "key": "weekly",
    "rank": 5,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-leaderboard-submit"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/leaderboard/:gameId"
        description="Get the leaderboard for a specific game. Supports different leaderboard types and pagination."
        typeDefinition={`interface LeaderboardQueryParams {
  key?: string;            // Leaderboard key (default: 'global')
  limit?: number;          // Max entries (default: 50, max: 100)
  offset?: number;         // Pagination offset
}

interface LeaderboardResponse {
  gameId: string;
  key: string;
  entries: Array<{
    rank: number;
    wallet: string;
    score: number;
    eventId: string;
    createdAt: string;
  }>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}`}
        requestExample={`// Get global leaderboard
const response = await fetch('/api/gamedeck/leaderboard/dev:indie-studio:space-raiders?limit=10');

// Get weekly leaderboard
const weekly = await fetch('/api/gamedeck/leaderboard/dev:indie-studio:space-raiders?key=weekly&limit=10');`}
        responseExample={`{
  "gameId": "dev:indie-studio:space-raiders",
  "key": "global",
  "entries": [
    { "rank": 1, "wallet": "0xabc...", "score": 50000 },
    { "rank": 2, "wallet": "0xdef...", "score": 45000 },
    { "rank": 3, "wallet": "0x742...", "score": 15000 }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 150
  }
}`}
        testId="endpoint-leaderboard-get"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/tournament"
        description="Create a new tournament for a game with defined start/end times and rules."
        typeDefinition={`interface TournamentCreateRequest {
  gameId: string;
  name: string;            // 1-200 characters
  startsAt: string;        // ISO 8601 datetime
  endsAt: string;          // ISO 8601 datetime
  rulesJson?: Record<string, any>;
  prizePool?: Record<string, any>;
  maxParticipants?: number;
}

interface TournamentCreateResponse {
  tournament: {
    id: string;
    gameId: string;
    name: string;
    startsAt: string;
    endsAt: string;
    rulesJson: any;
    prizePool: any;
    maxParticipants: number | null;
    anchored: boolean;
    anchorId: string | null;
    createdAt: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/tournament', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    name: 'Weekly Championship',
    startsAt: '2024-01-20T00:00:00Z',
    endsAt: '2024-01-27T23:59:59Z',
    rulesJson: { minLevel: 10, allowedMods: false },
    prizePool: { first: '100 USDC', second: '50 USDC' },
    maxParticipants: 100
  }),
});`}
        responseExample={`{
  "tournament": {
    "id": "tour_abc123",
    "gameId": "dev:indie-studio:space-raiders",
    "name": "Weekly Championship",
    "startsAt": "2024-01-20T00:00:00Z",
    "endsAt": "2024-01-27T23:59:59Z",
    "rulesJson": { "minLevel": 10, "allowedMods": false },
    "prizePool": { "first": "100 USDC", "second": "50 USDC" },
    "maxParticipants": 100,
    "anchored": false,
    "anchorId": null,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-tournament-create"
      />
    </div>
  );
}

function ModsAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-mods">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-400" />
            Mods Integration
          </CardTitle>
          <CardDescription className="text-slate-400">
            Manage game modifications. Pull mods from CurseForge or Modrinth, or submit developer-created mods.
          </CardDescription>
        </CardHeader>
      </Card>

      <EndpointCard
        method="GET"
        path="/api/gamedeck/mods/:gameId"
        description="List mods available for a specific game with optional filters."
        typeDefinition={`interface ModsQueryParams {
  source?: 'curseforge' | 'modrinth' | 'developer';
  enabled?: 'true' | 'false';
  search?: string;
  limit?: number;          // Max 100, default 50
  offset?: number;
}

interface ModsListResponse {
  mods: Array<{
    id: string;
    gameId: string;
    wallet: string;
    title: string;
    description: string | null;
    version: string | null;
    source: string;
    sourceId: string;
    url: string | null;
    enabled: boolean;
  }>;
  pagination: {
    limit: number;
    offset: number;
    count: number;
  };
}`}
        requestExample={`// List all mods for a game
const response = await fetch('/api/gamedeck/mods/dev:indie-studio:space-raiders');

// Filter by source
const curseforge = await fetch('/api/gamedeck/mods/dev:indie-studio:space-raiders?source=curseforge');

// Search mods
const search = await fetch('/api/gamedeck/mods/dev:indie-studio:space-raiders?search=graphics');`}
        responseExample={`{
  "mods": [
    {
      "id": "mod_abc123",
      "gameId": "dev:indie-studio:space-raiders",
      "wallet": "0x742d35Cc...",
      "title": "HD Graphics Pack",
      "description": "High-definition textures for Space Raiders",
      "version": "1.2.0",
      "source": "developer",
      "sourceId": "dev:0x742d35Cc:hd-graphics-pack",
      "url": "https://example.com/mod",
      "enabled": true
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}`}
        testId="endpoint-mods-list"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/mods/submit"
        description="Submit a new mod for a game. Mods are associated with the developer's wallet."
        typeDefinition={`interface ModSubmitRequest {
  gameId: string;
  title: string;           // 1-200 characters
  description?: string;    // Max 2000 characters
  version?: string;        // Max 50 characters
  url?: string;            // Valid URL
}

interface ModSubmitResponse {
  mod: {
    id: string;
    gameId: string;
    wallet: string;
    title: string;
    description: string | null;
    version: string | null;
    source: 'developer';
    sourceId: string;
    url: string | null;
    enabled: boolean;
    createdAt: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/mods/submit', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    title: 'HD Graphics Pack',
    description: 'High-definition textures for Space Raiders',
    version: '1.2.0',
    url: 'https://example.com/mod/hd-graphics'
  }),
});`}
        responseExample={`{
  "mod": {
    "id": "mod_abc123",
    "gameId": "dev:indie-studio:space-raiders",
    "wallet": "0x742d35Cc...",
    "title": "HD Graphics Pack",
    "description": "High-definition textures for Space Raiders",
    "version": "1.2.0",
    "source": "developer",
    "sourceId": "dev:0x742d35Cc:hd-graphics-pack",
    "url": "https://example.com/mod/hd-graphics",
    "enabled": false,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}`}
        testId="endpoint-mods-submit"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/mods/enable/:modId"
        description="Enable a mod for the authenticated user."
        requestExample={`const response = await fetch('/api/gamedeck/mods/enable/mod_abc123', {
  method: 'POST',
  headers: { 'x-wallet-address': wallet }
});`}
        responseExample={`{
  "mod": {
    "id": "mod_abc123",
    "enabled": true
  }
}`}
        testId="endpoint-mods-enable"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/mods/disable/:modId"
        description="Disable a mod for the authenticated user."
        requestExample={`const response = await fetch('/api/gamedeck/mods/disable/mod_abc123', {
  method: 'POST',
  headers: { 'x-wallet-address': wallet }
});`}
        responseExample={`{
  "mod": {
    "id": "mod_abc123",
    "enabled": false
  }
}`}
        testId="endpoint-mods-disable"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/mods/pull"
        description="Pull mods from external sources (CurseForge, Modrinth) into the Game Deck catalog."
        typeDefinition={`interface ModsPullRequest {
  gameId: string;
  source: 'curseforge' | 'modrinth';
  curseforgeGameId?: number;   // Required for CurseForge
  filters?: {
    query?: string;
    searchFilter?: string;
    categoryId?: number;
    gameVersion?: string;
  };
}

interface ModsPullResponse {
  source: string;
  gameId: string;
  fetched: number;
  upserted: number;
  errors: string[];
}`}
        requestExample={`const response = await fetch('/api/gamedeck/mods/pull', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    source: 'modrinth',
    filters: { query: 'graphics' }
  }),
});`}
        responseExample={`{
  "source": "modrinth",
  "gameId": "dev:indie-studio:space-raiders",
  "fetched": 25,
  "upserted": 23,
  "errors": []
}`}
        testId="endpoint-mods-pull"
      />
    </div>
  );
}

function PurchasesAPITab() {
  return (
    <div className="space-y-6" data-testid="tab-content-purchases">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-400" />
            Purchase Flow
          </CardTitle>
          <CardDescription className="text-slate-400">
            The purchase API supports a multi-step flow: initiate → complete → verify → anchor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2">1</div>
              <span className="text-sm text-slate-300">Initiate</span>
            </div>
            <div className="h-px flex-1 bg-slate-600 mx-4" />
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-2">2</div>
              <span className="text-sm text-slate-300">Complete</span>
            </div>
            <div className="h-px flex-1 bg-slate-600 mx-4" />
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-2">3</div>
              <span className="text-sm text-slate-300">Verify</span>
            </div>
            <div className="h-px flex-1 bg-slate-600 mx-4" />
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-2">4</div>
              <span className="text-sm text-slate-300">Anchor</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <EndpointCard
        method="POST"
        path="/api/gamedeck/purchase"
        description="Initiate a purchase for a game or mod. Returns a purchase ID for tracking."
        typeDefinition={`interface InitiatePurchaseRequest {
  gameId?: string;         // Game ID (either gameId or modId required)
  modId?: string;          // Mod ID
  priceWei: string;        // Price in wei
  currency?: string;       // Default: 'ETH'
  itemType?: 'game' | 'mod' | 'dlc' | 'subscription';
  metadata?: Record<string, any>;
}

interface InitiatePurchaseResponse {
  purchaseId: string;
  status: 'pending';
  priceWei: string;
  currency: string;
  gameId: string | null;
  modId: string | null;
  itemType: string;
}`}
        requestExample={`const response = await fetch('/api/gamedeck/purchase', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    gameId: 'dev:indie-studio:space-raiders',
    priceWei: '1000000000000000000', // 1 ETH
    currency: 'ETH',
    itemType: 'game',
    metadata: { discount: 'launch-special' }
  }),
});`}
        responseExample={`{
  "purchaseId": "purchase_abc123",
  "status": "pending",
  "priceWei": "1000000000000000000",
  "currency": "ETH",
  "gameId": "dev:indie-studio:space-raiders",
  "modId": null,
  "itemType": "game"
}`}
        testId="endpoint-purchase-initiate"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/purchase/:id/complete"
        description="Complete a purchase with the blockchain transaction hash."
        typeDefinition={`interface CompletePurchaseRequest {
  txHash: string;          // Blockchain transaction hash
}

interface CompletePurchaseResponse {
  purchaseId: string;
  status: 'complete';
  txHash: string;
  completedAt: string;
  receipt: {
    id: string;
    action: string;
    requestId: string;
  };
}`}
        requestExample={`const response = await fetch('/api/gamedeck/purchase/purchase_abc123/complete', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json', 
    'x-wallet-address': wallet 
  },
  body: JSON.stringify({
    txHash: '0x1234567890abcdef...'
  }),
});`}
        responseExample={`{
  "purchaseId": "purchase_abc123",
  "status": "complete",
  "txHash": "0x1234567890abcdef...",
  "completedAt": "2024-01-15T10:35:00Z",
  "receipt": {
    "id": "receipt_xyz789",
    "action": "purchase.complete",
    "requestId": "gamedeck:1705315200000:abc123"
  }
}`}
        testId="endpoint-purchase-complete"
      />

      <EndpointCard
        method="POST"
        path="/api/gamedeck/purchase/:id/verify"
        description="Verify a purchase by checking blockchain confirmation and anchor status."
        responseExample={`{
  "purchaseId": "purchase_abc123",
  "status": "complete",
  "txHash": "0x1234567890abcdef...",
  "anchored": true,
  "verified": true,
  "anchorId": "anchor_xyz789",
  "anchorStatus": "confirmed",
  "rootHash": "0x9876543210fedcba..."
}`}
        testId="endpoint-purchase-verify"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/purchases"
        description="Get the authenticated user's purchase history with optional filters."
        typeDefinition={`interface PurchasesQueryParams {
  status?: 'pending' | 'complete' | 'failed' | 'refunded';
  itemType?: 'game' | 'mod' | 'dlc' | 'subscription';
  limit?: number;          // Max 100, default 50
  offset?: number;
}

interface PurchasesListResponse {
  purchases: Purchase[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    count: number;
  };
}`}
        requestExample={`// Get all purchases
const response = await fetch('/api/gamedeck/purchases', {
  headers: { 'x-wallet-address': wallet }
});

// Get completed game purchases
const games = await fetch('/api/gamedeck/purchases?status=complete&itemType=game', {
  headers: { 'x-wallet-address': wallet }
});`}
        responseExample={`{
  "purchases": [
    {
      "id": "purchase_abc123",
      "wallet": "0x742d35Cc...",
      "gameId": "dev:indie-studio:space-raiders",
      "status": "complete",
      "priceWei": "1000000000000000000",
      "txHash": "0x1234..."
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 5,
    "count": 5
  }
}`}
        testId="endpoint-purchases-list"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/ownership"
        description="Check if the authenticated user owns a specific game or mod."
        typeDefinition={`interface OwnershipQueryParams {
  gameId?: string;         // Either gameId or modId required
  modId?: string;
}

interface OwnershipResponse {
  owned: boolean;
  gameId: string | null;
  modId: string | null;
  purchase: {
    id: string;
    status: string;
    txHash: string;
    completedAt: string;
    anchorId: string | null;
  } | null;
}`}
        requestExample={`const response = await fetch('/api/gamedeck/ownership?gameId=dev:indie-studio:space-raiders', {
  headers: { 'x-wallet-address': wallet }
});`}
        responseExample={`{
  "owned": true,
  "gameId": "dev:indie-studio:space-raiders",
  "modId": null,
  "purchase": {
    "id": "purchase_abc123",
    "status": "complete",
    "txHash": "0x1234...",
    "completedAt": "2024-01-15T10:35:00Z",
    "anchorId": "anchor_xyz789"
  }
}`}
        testId="endpoint-ownership-check"
      />
    </div>
  );
}

function FeeDisclosureTab() {
  return (
    <div className="space-y-6" data-testid="tab-content-fees">
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Fee Structure
          </CardTitle>
          <CardDescription className="text-slate-400">
            Transparent fee disclosure for all Game Deck SDK operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <h4 className="font-medium text-green-400 mb-3">Anchoring Fees</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Per-Event Anchor Fee</span>
                <span className="font-mono text-green-400">0.0001 ETH (100000000000000 wei)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Batch Anchor Fee</span>
                <span className="font-mono text-green-400">0.0001 ETH × event count</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-3">API Access</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Game Submission</span>
                <span className="font-mono text-blue-400">Free</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Event Logging</span>
                <span className="font-mono text-blue-400">Free</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Leaderboards</span>
                <span className="font-mono text-blue-400">Free</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Mods Management</span>
                <span className="font-mono text-blue-400">Free</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h4 className="font-medium text-amber-400 mb-3">Purchase Fees</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-300">Platform Fee</span>
                <span className="font-mono text-amber-400">2.5% of transaction</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Purchase Anchoring</span>
                <span className="font-mono text-amber-400">0.0001 ETH</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <EndpointCard
        method="GET"
        path="/api/gamedeck/fees"
        description="Get current fee structure for Game Deck operations."
        responseExample={`{
  "perEventFeeWei": "100000000000000",
  "note": "Immutable per-event fee"
}`}
        testId="endpoint-fees-get"
      />

      <EndpointCard
        method="GET"
        path="/api/gamedeck/ledger/:wallet"
        description="Get the fee ledger for a specific wallet, showing all anchoring fees paid."
        requestExample={`const response = await fetch('/api/gamedeck/ledger/0x742d35Cc...');`}
        responseExample={`{
  "wallet": "0x742d35Cc...",
  "entries": [
    {
      "id": "ledger_abc123",
      "wallet": "0x742d35Cc...",
      "action": "anchor.direct",
      "feeWei": "100000000000000",
      "txHash": "0x1234...",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}`}
        testId="endpoint-ledger-get"
      />

      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Fee Transparency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-300">
          <p>
            All fees are immutable and disclosed upfront. The per-event anchoring fee of 0.0001 ETH is fixed
            and cannot be changed by the protocol. This ensures predictable costs for developers and players.
          </p>
          <p>
            Batch anchoring uses a Merkle tree structure, allowing multiple events to be anchored in a single
            transaction. The total fee is calculated as the per-event fee multiplied by the number of events.
          </p>
          <p>
            Purchase platform fees (2.5%) are competitive with industry standards and help maintain the
            infrastructure and development of the Game Deck ecosystem.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SDKDocsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-slate-950" data-testid="page-sdk-docs">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start gap-4 mb-8">
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white"
              data-testid="btn-back"
              title="Back to Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/')}
              className="text-slate-400 hover:text-white"
              data-testid="btn-home"
            >
              <Globe className="w-4 h-4 mr-1.5" />
              Home
            </Button>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3" data-testid="title-sdk-docs">
              <Gamepad2 className="w-7 h-7 sm:w-8 sm:h-8 text-purple-400" />
              Atlas Game Deck SDK
            </h1>
            <p className="text-slate-400 mt-1 text-sm sm:text-base">
              Developer documentation for the Game Deck API - submit games, log events, anchor proofs, and more.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-4 px-4 mb-6">
            <TabsList className="inline-flex gap-1 bg-slate-900/50 p-2 rounded-lg min-w-max" data-testid="tabs-list">
              <TabsTrigger value="overview" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-overview">
                <Code className="w-4 h-4 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="authentication" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-authentication">
                <Wallet className="w-4 h-4 mr-1.5" />
                Auth
              </TabsTrigger>
              <TabsTrigger value="games" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-games">
                <Gamepad2 className="w-4 h-4 mr-1.5" />
                Games
              </TabsTrigger>
              <TabsTrigger value="events" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-events">
                <Zap className="w-4 h-4 mr-1.5" />
                Events
              </TabsTrigger>
              <TabsTrigger value="anchoring" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-anchoring">
                <Anchor className="w-4 h-4 mr-1.5" />
                Anchoring
              </TabsTrigger>
              <TabsTrigger value="nfts" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-nfts">
                <Image className="w-4 h-4 mr-1.5" />
                NFTs
              </TabsTrigger>
              <TabsTrigger value="leaderboards" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-leaderboards">
                <Trophy className="w-4 h-4 mr-1.5" />
                Leaderboards
              </TabsTrigger>
              <TabsTrigger value="mods" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-mods">
                <Package className="w-4 h-4 mr-1.5" />
                Mods
              </TabsTrigger>
              <TabsTrigger value="purchases" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-purchases">
                <ShoppingCart className="w-4 h-4 mr-1.5" />
                Purchases
              </TabsTrigger>
              <TabsTrigger value="fees" className="whitespace-nowrap text-xs sm:text-sm" data-testid="tab-fees">
                <DollarSign className="w-4 h-4 mr-1.5" />
                Fees
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="authentication">
            <AuthenticationTab />
          </TabsContent>
          <TabsContent value="games">
            <GamesAPITab />
          </TabsContent>
          <TabsContent value="events">
            <EventsAPITab />
          </TabsContent>
          <TabsContent value="anchoring">
            <AnchoringAPITab />
          </TabsContent>
          <TabsContent value="nfts">
            <NFTsAPITab />
          </TabsContent>
          <TabsContent value="leaderboards">
            <LeaderboardsAPITab />
          </TabsContent>
          <TabsContent value="mods">
            <ModsAPITab />
          </TabsContent>
          <TabsContent value="purchases">
            <PurchasesAPITab />
          </TabsContent>
          <TabsContent value="fees">
            <FeeDisclosureTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
