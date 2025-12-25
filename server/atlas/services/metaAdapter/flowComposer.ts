import type { AutoFlow, AutoFlowStep, ApiCatalogEntry } from './types';
import { getAllApis, getApisByCategory, storeFlow, getAllFlows, getFlow } from './catalogStore';

export interface Web3Flow {
  id: string;
  name: string;
  description: string;
  steps: { key: string; name: string; provider: string; optional: boolean }[];
  categories: string[];
}

export const WEB3_FLOW_TEMPLATES: Web3Flow[] = [
  {
    id: 'wallet-check',
    name: 'Wallet Check',
    description: 'Check wallet balance and token holdings',
    steps: [
      { key: 'web3.moralis.wallet_balance', name: 'Get ETH Balance', provider: 'moralis', optional: false },
      { key: 'web3.moralis.token_balances', name: 'Get Token Balances', provider: 'moralis', optional: true },
    ],
    categories: ['Web3'],
  },
  {
    id: 'portfolio-brief',
    name: 'Portfolio Brief',
    description: 'Complete portfolio overview with balances and prices',
    steps: [
      { key: 'web3.moralis.wallet_balance', name: 'Get ETH Balance', provider: 'moralis', optional: false },
      { key: 'web3.moralis.token_balances', name: 'Get Token Balances', provider: 'moralis', optional: true },
      { key: 'web3.alchemy.gas_price', name: 'Current Gas Price', provider: 'alchemy', optional: true },
    ],
    categories: ['Web3', 'Cryptocurrency'],
  },
  {
    id: 'nft-explorer',
    name: 'NFT Explorer',
    description: 'Explore NFTs owned by a wallet',
    steps: [
      { key: 'web3.moralis.nfts', name: 'Get NFTs (Moralis)', provider: 'moralis', optional: false },
      { key: 'web3.alchemy.nft_ownership', name: 'Get NFTs (Alchemy)', provider: 'alchemy', optional: true },
    ],
    categories: ['Web3'],
  },
  {
    id: 'web3-morning',
    name: 'Web3 Morning Brief',
    description: 'Start your day with wallet status and gas prices',
    steps: [
      { key: 'web3.moralis.wallet_balance', name: 'Check Balance', provider: 'moralis', optional: false },
      { key: 'web3.alchemy.gas_price', name: 'Gas Prices', provider: 'alchemy', optional: false },
    ],
    categories: ['Web3'],
  },
  {
    id: 'solana-check',
    name: 'Solana Wallet Check',
    description: 'Check Solana wallet balances and NFTs',
    steps: [
      { key: 'web3.helius.balances', name: 'SOL Balances', provider: 'helius', optional: false },
      { key: 'web3.helius.nfts', name: 'Solana NFTs', provider: 'helius', optional: true },
    ],
    categories: ['Web3'],
  },
  {
    id: 'multi-chain',
    name: 'Multi-Chain Overview',
    description: 'Check balances across Ethereum and Solana',
    steps: [
      { key: 'web3.moralis.wallet_balance', name: 'ETH Balance', provider: 'moralis', optional: false },
      { key: 'web3.helius.balances', name: 'SOL Balance', provider: 'helius', optional: true },
      { key: 'web3.alchemy.gas_price', name: 'ETH Gas', provider: 'alchemy', optional: true },
    ],
    categories: ['Web3'],
  },
];

export function getWeb3FlowTemplates() {
  return WEB3_FLOW_TEMPLATES;
}

export function getWeb3Flow(id: string): Web3Flow | undefined {
  return WEB3_FLOW_TEMPLATES.find(f => f.id === id);
}

const FLOW_TEMPLATES = [
  {
    id: 'weather-and-joke',
    name: 'Weather & Joke',
    description: 'Get current weather and a random joke to brighten your day',
    categories: ['Weather', 'Entertainment'],
    pattern: [
      { category: 'Weather', apiName: 'Open-Meteo', endpoint: 'forecast' },
      { category: 'Entertainment', apiName: 'JokeAPI', endpoint: 'random' },
    ],
  },
  {
    id: 'crypto-and-news',
    name: 'Crypto & Holiday',
    description: 'Check cryptocurrency prices and upcoming holidays',
    categories: ['Cryptocurrency', 'Calendar'],
    pattern: [
      { category: 'Cryptocurrency', apiName: 'CoinGecko', endpoint: 'prices' },
      { category: 'Calendar', apiName: 'Nager.Date', endpoint: 'nextHoliday' },
    ],
  },
  {
    id: 'fun-facts',
    name: 'Fun Facts Bundle',
    description: 'Get random dog picture, cat fact, and a quote',
    categories: ['Animals', 'Entertainment'],
    pattern: [
      { category: 'Animals', apiName: 'Dog CEO', endpoint: 'random' },
      { category: 'Animals', apiName: 'Cat Facts', endpoint: 'fact' },
      { category: 'Entertainment', apiName: 'Quotable', endpoint: 'random' },
    ],
  },
  {
    id: 'trivia-time',
    name: 'Trivia Time',
    description: 'Get trivia questions and random advice',
    categories: ['Games', 'Entertainment'],
    pattern: [
      { category: 'Games', apiName: 'Trivia API', endpoint: 'questions' },
      { category: 'Entertainment', apiName: 'Advice Slip', endpoint: 'random' },
    ],
  },
  {
    id: 'food-and-drink',
    name: 'Recipe Discovery',
    description: 'Get a random meal and cocktail recipe',
    categories: ['Food & Drink'],
    pattern: [
      { category: 'Food & Drink', apiName: 'TheMealDB', endpoint: 'random' },
      { category: 'Food & Drink', apiName: 'TheCocktailDB', endpoint: 'random' },
    ],
  },
  {
    id: 'geek-pack',
    name: 'Geek Pack',
    description: 'Pokemon, Star Wars, and Rick & Morty data',
    categories: ['Games', 'Entertainment'],
    pattern: [
      { category: 'Games', apiName: 'PokeAPI', endpoint: 'pokemon' },
      { category: 'Entertainment', apiName: 'Star Wars', endpoint: 'people' },
      { category: 'Entertainment', apiName: 'Rick and Morty', endpoint: 'characters' },
    ],
  },
  {
    id: 'science-discovery',
    name: 'Science Discovery',
    description: 'NASA picture of the day and SpaceX launches',
    categories: ['Science'],
    pattern: [
      { category: 'Science', apiName: 'NASA', endpoint: 'apod' },
      { category: 'Science', apiName: 'SpaceX', endpoint: 'launches' },
    ],
  },
  {
    id: 'name-analyzer',
    name: 'Name Analyzer',
    description: 'Predict age, gender, and nationality from a name',
    categories: ['Science'],
    pattern: [
      { category: 'Science', apiName: 'Agify', endpoint: 'predict' },
      { category: 'Science', apiName: 'Genderize', endpoint: 'predict' },
      { category: 'Science', apiName: 'Nationalize', endpoint: 'predict' },
    ],
  },
  {
    id: 'morning-brief',
    name: 'Morning Brief',
    description: 'Weather, holidays, and an inspiring quote',
    categories: ['Weather', 'Calendar', 'Entertainment'],
    pattern: [
      { category: 'Weather', apiName: 'Open-Meteo', endpoint: 'forecast' },
      { category: 'Calendar', apiName: 'Nager.Date', endpoint: 'nextHoliday' },
      { category: 'Entertainment', apiName: 'Quotable', endpoint: 'random' },
    ],
  },
  {
    id: 'dev-test',
    name: 'Developer Test APIs',
    description: 'JSONPlaceholder and Random User for testing',
    categories: ['Open Data'],
    pattern: [
      { category: 'Open Data', apiName: 'JSONPlaceholder', endpoint: 'posts' },
      { category: 'Open Data', apiName: 'Random User', endpoint: 'user' },
    ],
  },
];

function generateEndpointKey(apiName: string, endpointName: string): string {
  const normalizedApi = apiName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const normalizedEndpoint = endpointName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `public.${normalizedApi}.${normalizedEndpoint}`;
}

function findApiByName(apis: ApiCatalogEntry[], name: string): ApiCatalogEntry | undefined {
  return apis.find(a => a.name.toLowerCase() === name.toLowerCase());
}

export function generateAutoFlows(): AutoFlow[] {
  const apis = getAllApis();
  const flows: AutoFlow[] = [];

  for (const template of FLOW_TEMPLATES) {
    const steps: AutoFlowStep[] = [];
    let isValid = true;

    for (const stepPattern of template.pattern) {
      const api = findApiByName(apis, stepPattern.apiName);
      
      if (api) {
        const endpoint = api.endpoints.find(e => 
          e.name.toLowerCase() === stepPattern.endpoint.toLowerCase()
        );
        
        if (endpoint) {
          steps.push({
            id: `step-${steps.length + 1}`,
            endpointKey: generateEndpointKey(api.name, endpoint.name),
            description: endpoint.description,
            optional: false,
          });
        } else {
          isValid = false;
          break;
        }
      } else {
        isValid = false;
        break;
      }
    }

    if (isValid && steps.length > 0) {
      const flow: AutoFlow = {
        id: template.id,
        name: template.name,
        description: template.description,
        steps,
        categories: template.categories,
        createdAt: Date.now(),
        source: 'auto',
      };
      
      flows.push(flow);
      storeFlow(flow);
    }
  }

  return flows;
}

export function generateCategoryFlow(categories: string[]): AutoFlow | null {
  const apis = getAllApis();
  const steps: AutoFlowStep[] = [];

  for (const category of categories) {
    const categoryApis = apis.filter(a => 
      a.category.toLowerCase() === category.toLowerCase() && 
      a.auth === 'none'
    );
    
    if (categoryApis.length > 0) {
      const api = categoryApis[0];
      const endpoint = api.endpoints[0];
      
      if (endpoint) {
        steps.push({
          id: `step-${steps.length + 1}`,
          endpointKey: generateEndpointKey(api.name, endpoint.name),
          description: endpoint.description,
          optional: false,
        });
      }
    }
  }

  if (steps.length < 2) return null;

  const flowId = `custom-${categories.map(c => c.toLowerCase().replace(/[^a-z]/g, '')).join('-')}`;
  
  const flow: AutoFlow = {
    id: flowId,
    name: `${categories.join(' + ')} Flow`,
    description: `Combine ${categories.join(', ')} APIs`,
    steps,
    categories,
    createdAt: Date.now(),
    source: 'auto',
  };

  storeFlow(flow);
  return flow;
}

export function listAutoFlows(): AutoFlow[] {
  return getAllFlows().filter(f => f.source === 'auto');
}

export function getAutoFlow(id: string): AutoFlow | null {
  return getFlow(id);
}

export function describeFlow(id: string): string | null {
  const flow = getFlow(id);
  if (!flow) return null;

  const stepsDesc = flow.steps.map((s, i) => 
    `${i + 1}. **${s.endpointKey}** - ${s.description}`
  ).join('\n');

  return `
**${flow.name}**
${flow.description}

**Steps:**
${stepsDesc}

**Categories:** ${flow.categories.join(', ')}
`.trim();
}

export function getAvailableFlowTemplates() {
  return FLOW_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    categories: t.categories,
  }));
}

export function getFlowStats() {
  const flows = getAllFlows();
  const byCategory: Record<string, number> = {};
  
  for (const flow of flows) {
    for (const cat of flow.categories) {
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
  }

  return {
    totalFlows: flows.length,
    autoGenerated: flows.filter(f => f.source === 'auto').length,
    manual: flows.filter(f => f.source === 'manual').length,
    byCategory,
    templates: FLOW_TEMPLATES.length,
  };
}
