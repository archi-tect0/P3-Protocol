export interface TokenPrice {
  address: string;
  chain: string;
  usdPrice: number | null;
  source: 'moralis' | 'mock';
  priceChange24h?: number | null;
  lastUpdated: number;
}

export interface TrackedToken {
  address: string;
  chain: string;
  addedAt: number;
}

const MORALIS_API_KEY = import.meta.env.VITE_MORALIS_API_KEY || '';

const CHAIN_IDS: Record<string, string> = {
  ethereum: '0x1',
  base: '0x2105',
  polygon: '0x89',
};

const MOCK_PRICES: Record<string, number> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1.0,
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 1.0,
  '0x6b175474e89094c44da98b954eedeac495271d0f': 1.0,
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 3200 + Math.random() * 100,
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 95000 + Math.random() * 2000,
};

function generateMockPrice(address: string): number {
  const knownPrice = MOCK_PRICES[address.toLowerCase()];
  if (knownPrice) return knownPrice;
  
  const seed = address.toLowerCase().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const basePrice = (seed % 1000) + Math.random() * 10;
  return parseFloat(basePrice.toFixed(4));
}

function generateMockPriceChange(): number {
  return parseFloat(((Math.random() - 0.5) * 20).toFixed(2));
}

export async function fetchEvmTokenPrice(address: string, chain: string): Promise<TokenPrice> {
  const chainId = CHAIN_IDS[chain.toLowerCase()];
  
  if (!MORALIS_API_KEY) {
    return {
      address,
      chain,
      usdPrice: generateMockPrice(address),
      source: 'mock',
      priceChange24h: generateMockPriceChange(),
      lastUpdated: Date.now(),
    };
  }

  try {
    const response = await fetch(
      `https://deep-index.moralis.io/api/v2.2/erc20/${address}/price?chain=${chainId}&include=percent_change`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      address,
      chain,
      usdPrice: data.usdPrice || null,
      source: 'moralis',
      priceChange24h: data['24hrPercentChange'] || null,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Moralis API error, falling back to mock:', error);
    return {
      address,
      chain,
      usdPrice: generateMockPrice(address),
      source: 'mock',
      priceChange24h: generateMockPriceChange(),
      lastUpdated: Date.now(),
    };
  }
}

export async function fetchSolanaTokenPrice(address: string): Promise<TokenPrice> {
  if (!MORALIS_API_KEY) {
    return {
      address,
      chain: 'solana',
      usdPrice: generateMockPrice(address),
      source: 'mock',
      priceChange24h: generateMockPriceChange(),
      lastUpdated: Date.now(),
    };
  }

  try {
    const response = await fetch(
      `https://solana-gateway.moralis.io/token/mainnet/${address}/price`,
      {
        headers: {
          'X-API-Key': MORALIS_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Moralis Solana API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      address,
      chain: 'solana',
      usdPrice: data.usdPrice || null,
      source: 'moralis',
      priceChange24h: null,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Moralis Solana API error, falling back to mock:', error);
    return {
      address,
      chain: 'solana',
      usdPrice: generateMockPrice(address),
      source: 'mock',
      priceChange24h: generateMockPriceChange(),
      lastUpdated: Date.now(),
    };
  }
}

export async function fetchTokenPrice(address: string, chain: string): Promise<TokenPrice> {
  if (chain.toLowerCase() === 'solana') {
    return fetchSolanaTokenPrice(address);
  }
  return fetchEvmTokenPrice(address, chain);
}

export function getStorageKey(walletAddress: string): string {
  return `p3:crypto:tokens:${walletAddress.toLowerCase()}`;
}

export function loadTrackedTokens(walletAddress: string): TrackedToken[] {
  try {
    const stored = localStorage.getItem(getStorageKey(walletAddress));
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading tracked tokens:', error);
  }
  return [];
}

export function saveTrackedTokens(walletAddress: string, tokens: TrackedToken[]): void {
  try {
    localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(tokens));
  } catch (error) {
    console.error('Error saving tracked tokens:', error);
  }
}

export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'base', name: 'Base', symbol: 'BASE' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
];
