import type { EndpointMeta, AppInfo, Scope } from '../types';
import { 
  loadRegistry, 
  findEndpointByQuery,
  searchEndpoints,
  getEndpointsForApp,
  getEndpointsByScope,
  getExternalApps
} from './registryAdapter';
import { 
  getImplementedEndpoints,
  getStorageEndpoints,
  getOAuthEndpoints 
} from './executor';

export interface DevKitEndpoint {
  key: string;
  app: string;
  fn: string;
  description?: string;
  scopes: Scope[];
  args: Record<string, string>;
  samplePhrases?: string[];
  status: 'live' | 'storage' | 'oauth' | 'stub';
}

export interface DevKitFlow {
  id: string;
  name: string;
  description: string;
  steps: string[];
  requiredScopes: Scope[];
}

export interface DevKitApp {
  id: string;
  name: string;
  version: string;
  endpointCount: number;
  permissions: Scope[];
}

export interface DevKitQuery {
  type: 'endpoints' | 'flows' | 'apps' | 'search' | 'describe' | 'help';
  query?: string;
  scope?: Scope;
  appId?: string;
}

export interface DevKitResponse {
  ok: boolean;
  type: DevKitQuery['type'];
  data: DevKitEndpoint[] | DevKitFlow[] | DevKitApp[] | DevKitEndpoint | string;
  count?: number;
  suggestions?: string[];
}

const compoundFlows: DevKitFlow[] = [
  // Proxy Flows
  {
    id: 'play-and-notify',
    name: 'Play and Notify',
    description: 'Play music on Spotify and notify the team on Slack',
    steps: ['proxy.spotify.play', 'proxy.slack.send'],
    requiredScopes: ['proxy'],
  },
  {
    id: 'status-check',
    name: 'Status Check',
    description: 'Check status across all connected apps',
    steps: ['proxy.spotify.current', 'proxy.slack.unread', 'proxy.gmail.unread'],
    requiredScopes: ['proxy'],
  },
  {
    id: 'secure-message',
    name: 'Secure Message',
    description: 'Send encrypted message and create blockchain anchor',
    steps: ['messages.compose', 'anchors.create'],
    requiredScopes: ['messages', 'anchors'],
  },
  // Meta-Adapter Public API Flows
  {
    id: 'weather-and-joke',
    name: 'Weather & Joke',
    description: 'Get current weather and a random joke',
    steps: ['public.open_meteo.forecast', 'public.jokeapi.random'],
    requiredScopes: ['public' as Scope],
  },
  {
    id: 'morning-brief',
    name: 'Morning Brief',
    description: 'Weather, holidays, and an inspiring quote',
    steps: ['public.open_meteo.forecast', 'public.nager_date.nextHoliday', 'public.quotable.random'],
    requiredScopes: ['public' as Scope],
  },
  {
    id: 'crypto-and-news',
    name: 'Crypto & Holiday',
    description: 'Check cryptocurrency prices and upcoming holidays',
    steps: ['public.coingecko.prices', 'public.nager_date.nextHoliday'],
    requiredScopes: ['public' as Scope],
  },
  {
    id: 'fun-facts',
    name: 'Fun Facts',
    description: 'Random dog pic, cat fact, and inspirational quote',
    steps: ['public.dog_ceo.random', 'public.catfact.random', 'public.quotable.random'],
    requiredScopes: ['public' as Scope],
  },
  {
    id: 'geek-pack',
    name: 'Geek Pack',
    description: 'Pokemon, Star Wars, and Rick & Morty trivia',
    steps: ['public.pokeapi.pokemon', 'public.swapi.people', 'public.rickandmorty.character'],
    requiredScopes: ['public' as Scope],
  },
  {
    id: 'science-discovery',
    name: 'Science Discovery',
    description: 'NASA picture of the day and SpaceX launch info',
    steps: ['public.nasa.apod', 'public.spacex.launches'],
    requiredScopes: ['public' as Scope],
  },
  // Web3 Flows
  {
    id: 'wallet-check',
    name: 'Wallet Check',
    description: 'Check wallet balance and token holdings',
    steps: ['web3.moralis.wallet_balance', 'web3.moralis.token_balances'],
    requiredScopes: ['wallet'],
  },
  {
    id: 'portfolio-brief',
    name: 'Portfolio Brief',
    description: 'Complete portfolio overview with balances and gas prices',
    steps: ['web3.moralis.wallet_balance', 'web3.moralis.token_balances', 'web3.alchemy.gas_price'],
    requiredScopes: ['wallet'],
  },
  {
    id: 'nft-explorer',
    name: 'NFT Explorer',
    description: 'Explore NFTs owned by a wallet',
    steps: ['web3.moralis.nfts', 'web3.alchemy.nft_ownership'],
    requiredScopes: ['wallet'],
  },
  {
    id: 'web3-morning',
    name: 'Web3 Morning Brief',
    description: 'Start your day with wallet status and gas prices',
    steps: ['web3.moralis.wallet_balance', 'web3.alchemy.gas_price'],
    requiredScopes: ['wallet'],
  },
  {
    id: 'solana-check',
    name: 'Solana Wallet Check',
    description: 'Check Solana wallet balances and NFTs',
    steps: ['web3.helius.balances', 'web3.helius.nfts'],
    requiredScopes: ['wallet'],
  },
  {
    id: 'multi-chain',
    name: 'Multi-Chain Overview',
    description: 'Check balances across Ethereum and Solana',
    steps: ['web3.moralis.wallet_balance', 'web3.helius.balances', 'web3.alchemy.gas_price'],
    requiredScopes: ['wallet'],
  },
];

function getEndpointStatus(key: string): 'live' | 'storage' | 'oauth' | 'stub' {
  if (getImplementedEndpoints().includes(key)) return 'live';
  if (getStorageEndpoints().includes(key)) return 'storage';
  if (getOAuthEndpoints().includes(key)) return 'oauth';
  return 'stub';
}

function toDevKitEndpoint(key: string, meta: EndpointMeta): DevKitEndpoint {
  return {
    key,
    app: meta.app,
    fn: meta.fn,
    description: meta.description,
    scopes: meta.scopes,
    args: meta.args,
    samplePhrases: meta.semantics?.phrases?.slice(0, 3),
    status: getEndpointStatus(key),
  };
}

export function listAllEndpoints(): DevKitEndpoint[] {
  const registry = loadRegistry();
  return Object.entries(registry.endpoints).map(([key, meta]) => 
    toDevKitEndpoint(key, meta)
  );
}

export function listAllApps(): DevKitApp[] {
  const registry = loadRegistry();
  const endpoints = registry.endpoints;
  
  return Object.entries(registry.apps).map(([id, app]) => {
    const appEndpoints = Object.values(endpoints).filter(e => e.app === id);
    return {
      id,
      name: app.name,
      version: app.version,
      endpointCount: appEndpoints.length,
      permissions: app.permissions,
    };
  });
}

export function listAllFlows(): DevKitFlow[] {
  return compoundFlows;
}

export function getFlow(flowId: string): DevKitFlow | null {
  return compoundFlows.find(f => f.id === flowId) || null;
}

export async function searchDevKit(query: string): Promise<DevKitEndpoint[]> {
  const results = await searchEndpoints(query);
  return results.map(r => toDevKitEndpoint(r.key, r));
}

export function describeEndpoint(key: string): DevKitEndpoint | null {
  const registry = loadRegistry();
  const meta = registry.endpoints[key];
  if (!meta) return null;
  return toDevKitEndpoint(key, meta);
}

export function getEndpointsByAppId(appId: string): DevKitEndpoint[] {
  const results = getEndpointsForApp(appId);
  return results.map(r => toDevKitEndpoint(r.key, r.meta));
}

export function getEndpointsByScopeFilter(scope: Scope): DevKitEndpoint[] {
  const results = getEndpointsByScope(scope);
  return results.map(r => toDevKitEndpoint(r.key, r.meta));
}

export function getDevKitHelp(): string {
  return `Atlas Developer Kit - Available Commands:

1. "atlas devkit endpoints" - List all available endpoints
2. "atlas devkit apps" - List all registered apps
3. "atlas devkit flows" - List compound flows
4. "atlas devkit search <query>" - Search endpoints by keyword
5. "atlas devkit describe <endpoint>" - Get details about an endpoint
6. "atlas devkit scope <scope>" - Filter endpoints by scope
7. "atlas devkit wallet-gated" - Learn how to add wallet-gated private endpoints

Example phrases:
- "atlas devkit endpoints" → shows all P3 SDK endpoints
- "atlas devkit search spotify" → finds Spotify-related endpoints
- "atlas devkit describe proxy.spotify.play" → shows play endpoint details
- "atlas devkit scope proxy" → shows all proxy endpoints
- "atlas devkit wallet-gated" → developer pattern for private endpoints

Scopes: wallet, messages, storage, payments, anchors, dao, proxy, admin`;
}

export function getWalletGatedDocs(): string {
  return `## Wallet-Gated Private Endpoints

Add private endpoints that only your wallet can access. This pattern enables you to build your own analytics, admin features, or proprietary app logic that runs through Atlas.

### How It Works

1. **Register your endpoint** in the manifest system with a unique feature key
2. **Add intent patterns** so Atlas recognizes natural language queries
3. **Implement the handler** with wallet verification
4. **Query via Atlas** using natural language or voice

### Example: Adding a Wallet-Gated Endpoint

\`\`\`typescript
// 1. Add intent pattern in intent.ts
{
  pattern: /my private data|show my data/i,
  nlIntent: 'myapp_private_data',
  feature: 'myapp.private',
  extractParams: () => ({})
}

// 2. Add handler in executor.ts
'myapp.private': async (args, session) => {
  const myWallet = process.env.MY_WALLET?.toLowerCase();
  
  // Wallet verification - only your wallet can access
  if (!myWallet || session.wallet.toLowerCase() !== myWallet) {
    return {
      type: 'myapp',
      error: 'unauthorized',
      message: 'This endpoint is restricted.',
      ts: Date.now(),
    };
  }
  
  // Your private logic here
  const data = await fetchMyPrivateData(session.wallet);
  
  return {
    type: 'myapp',
    action: 'private',
    data,
    message: 'Here is your private data.',
    ts: Date.now(),
  };
}
\`\`\`

### Canvas Visualization

To make your endpoint visible in Canvas, emit flow events:

\`\`\`typescript
import { flowEventBus } from '../../flows/eventBus';

const flowId = \`myapp-private-\${Date.now()}\`;
flowEventBus.emit(flowId, { type: 'flow-start', flowId, feature: 'myapp.private', timestamp: Date.now() });

// ... your logic ...

flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
\`\`\`

### Live Example

The analytics endpoints (analytics.overview, analytics.traffic, etc.) demonstrate this pattern:
- Wallet-gated to ADMIN_WALLET
- Natural language queries: "Show my analytics", "How many visitors"
- Canvas-visible with flow events

Query "describe analytics.overview" to see the implementation.`;
}

export function processDevKitQuery(rawQuery: string): DevKitResponse {
  const query = rawQuery.toLowerCase().trim();
  
  if (query === 'help' || query === '') {
    return {
      ok: true,
      type: 'help',
      data: getDevKitHelp(),
    };
  }
  
  // Wallet-gated / private endpoints documentation
  if (query === 'wallet-gated' || query === 'private endpoints' || query === 'wallet gated' || 
      query.includes('how to add private') || query.includes('wallet-gated endpoint') ||
      query.includes('add my own endpoint') || query.includes('register private')) {
    return {
      ok: true,
      type: 'help',
      data: getWalletGatedDocs(),
    };
  }
  
  if (query === 'endpoints' || query === 'list endpoints' || query === 'show endpoints') {
    const endpoints = listAllEndpoints();
    return {
      ok: true,
      type: 'endpoints',
      data: endpoints,
      count: endpoints.length,
    };
  }
  
  if (query === 'apps' || query === 'list apps' || query === 'show apps') {
    const apps = listAllApps();
    return {
      ok: true,
      type: 'apps',
      data: apps,
      count: apps.length,
    };
  }
  
  if (query === 'flows' || query === 'list flows' || query === 'show flows') {
    const flows = listAllFlows();
    return {
      ok: true,
      type: 'flows',
      data: flows,
      count: flows.length,
    };
  }
  
  if (query.startsWith('search ')) {
    const searchTerm = query.slice(7).trim();
    const endpoints = listAllEndpoints().filter(e => 
      e.key.toLowerCase().includes(searchTerm) ||
      e.description?.toLowerCase().includes(searchTerm) ||
      e.app.toLowerCase().includes(searchTerm)
    );
    return {
      ok: true,
      type: 'search',
      data: endpoints,
      count: endpoints.length,
    };
  }
  
  if (query.startsWith('describe ')) {
    const endpointKey = query.slice(9).trim();
    const endpoint = describeEndpoint(endpointKey);
    if (!endpoint) {
      return {
        ok: false,
        type: 'describe',
        data: `Endpoint "${endpointKey}" not found`,
        suggestions: listAllEndpoints()
          .filter(e => e.key.includes(endpointKey.split('.')[0]))
          .slice(0, 5)
          .map(e => e.key),
      };
    }
    return {
      ok: true,
      type: 'describe',
      data: endpoint,
    };
  }
  
  if (query.startsWith('scope ')) {
    const scope = query.slice(6).trim() as Scope;
    const endpoints = getEndpointsByScopeFilter(scope);
    return {
      ok: true,
      type: 'endpoints',
      data: endpoints,
      count: endpoints.length,
    };
  }
  
  if (query.startsWith('app ')) {
    const appId = query.slice(4).trim();
    const endpoints = getEndpointsByAppId(appId);
    return {
      ok: true,
      type: 'endpoints',
      data: endpoints,
      count: endpoints.length,
    };
  }
  
  const endpoints = listAllEndpoints().filter(e => 
    e.key.toLowerCase().includes(query) ||
    e.description?.toLowerCase().includes(query)
  );
  
  if (endpoints.length > 0) {
    return {
      ok: true,
      type: 'search',
      data: endpoints,
      count: endpoints.length,
    };
  }
  
  return {
    ok: false,
    type: 'help',
    data: getDevKitHelp(),
    suggestions: ['endpoints', 'apps', 'flows', 'search <query>', 'describe <endpoint>'],
  };
}

export function getQuickStats(): {
  totalEndpoints: number;
  liveEndpoints: number;
  totalApps: number;
  totalFlows: number;
} {
  const endpoints = listAllEndpoints();
  return {
    totalEndpoints: endpoints.length,
    liveEndpoints: endpoints.filter(e => e.status === 'live').length,
    totalApps: listAllApps().length,
    totalFlows: listAllFlows().length,
  };
}
