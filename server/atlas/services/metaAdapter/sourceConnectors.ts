import type { RawApiEntry, ApiSource } from './types';

const GITHUB_PUBLIC_APIS_URL = 'https://raw.githubusercontent.com/public-apis/public-apis/master/data/entries.json';
const GITHUB_FALLBACK_URL = 'https://api.github.com/repos/public-apis/public-apis/contents/data';

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Atlas-MetaAdapter/1.0',
        'Accept': 'application/json',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchGitHubPublicApis(): Promise<RawApiEntry[]> {
  try {
    const response = await fetchWithTimeout(GITHUB_PUBLIC_APIS_URL);
    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }
    const data = await response.json() as any;
    
    if (Array.isArray(data)) {
      return data.map(normalizeGitHubEntry);
    }
    if (data && data.entries && Array.isArray(data.entries)) {
      return data.entries.map(normalizeGitHubEntry);
    }
    
    return [];
  } catch (error) {
    console.error('[MetaAdapter] GitHub fetch failed:', error);
    return getBuiltinPublicApis();
  }
}

function normalizeGitHubEntry(entry: any): RawApiEntry {
  return {
    API: entry.API || entry.api || entry.name || 'Unknown',
    Description: entry.Description || entry.description || '',
    Auth: entry.Auth || entry.auth || '',
    HTTPS: entry.HTTPS ?? entry.https ?? true,
    Cors: entry.Cors || entry.cors || 'unknown',
    Category: entry.Category || entry.category || 'Other',
    Link: entry.Link || entry.link || entry.url || '',
  };
}

export function getBuiltinPublicApis(): RawApiEntry[] {
  return [
    { API: 'Open-Meteo', Description: 'Open-source weather API with hourly and daily forecasts', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Weather', Link: 'https://open-meteo.com/' },
    { API: 'JokeAPI', Description: 'Programming, dark, and general jokes', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://jokeapi.dev/' },
    { API: 'CoinGecko', Description: 'Cryptocurrency data including prices, market cap, and volume', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Cryptocurrency', Link: 'https://www.coingecko.com/en/api' },
    { API: 'Nager.Date', Description: 'Public holidays for various countries', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Calendar', Link: 'https://date.nager.at/' },
    { API: 'Dog CEO', Description: 'Random pictures of dogs', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Animals', Link: 'https://dog.ceo/dog-api/' },
    { API: 'Cat Facts', Description: 'Random facts about cats', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Animals', Link: 'https://catfact.ninja/' },
    { API: 'Numbers', Description: 'Interesting facts about numbers', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Science', Link: 'http://numbersapi.com/' },
    { API: 'Bored', Description: 'Suggestions for random activities', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://www.boredapi.com/' },
    { API: 'Advice Slip', Description: 'Random advice slips', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://api.adviceslip.com/' },
    { API: 'Agify', Description: 'Predict the age of a name', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Science', Link: 'https://agify.io/' },
    { API: 'Genderize', Description: 'Predict the gender of a name', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Science', Link: 'https://genderize.io/' },
    { API: 'Nationalize', Description: 'Predict the nationality of a name', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Science', Link: 'https://nationalize.io/' },
    { API: 'REST Countries', Description: 'Information about countries', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Geocoding', Link: 'https://restcountries.com/' },
    { API: 'IP API', Description: 'IP geolocation data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Geocoding', Link: 'https://ip-api.com/' },
    { API: 'Open Library', Description: 'Books and library data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Books', Link: 'https://openlibrary.org/developers/api' },
    { API: 'Chuck Norris', Description: 'Random Chuck Norris jokes', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://api.chucknorris.io/' },
    { API: 'Quotable', Description: 'Random famous quotes', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://quotable.io/' },
    { API: 'Random User', Description: 'Generate random user data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Open Data', Link: 'https://randomuser.me/' },
    { API: 'JSONPlaceholder', Description: 'Fake online REST API for testing', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Open Data', Link: 'https://jsonplaceholder.typicode.com/' },
    { API: 'PokeAPI', Description: 'Pokemon data and images', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Games', Link: 'https://pokeapi.co/' },
    { API: 'NASA', Description: 'NASA open APIs including APOD', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Science', Link: 'https://api.nasa.gov/' },
    { API: 'SpaceX', Description: 'SpaceX launch and rocket data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Science', Link: 'https://github.com/r-spacex/SpaceX-API' },
    { API: 'Exchange Rates', Description: 'Currency exchange rate data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Finance', Link: 'https://exchangerate-api.com/' },
    { API: 'OpenWeatherMap', Description: 'Current weather data worldwide', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Weather', Link: 'https://openweathermap.org/api' },
    { API: 'NewsAPI', Description: 'News headlines from around the world', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'News', Link: 'https://newsapi.org/' },
    { API: 'The Movie DB', Description: 'Movies, TV shows, and actors', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://www.themoviedb.org/documentation/api' },
    { API: 'Giphy', Description: 'Animated GIFs and stickers', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://developers.giphy.com/' },
    { API: 'Unsplash', Description: 'High-quality free photos', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Art & Design', Link: 'https://unsplash.com/developers' },
    { API: 'Lorem Picsum', Description: 'Random placeholder images', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Art & Design', Link: 'https://picsum.photos/' },
    { API: 'TheCocktailDB', Description: 'Cocktail recipes and ingredients', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Food & Drink', Link: 'https://www.thecocktaildb.com/api.php' },
    { API: 'TheMealDB', Description: 'Meal recipes from around the world', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Food & Drink', Link: 'https://www.themealdb.com/api.php' },
    { API: 'Trivia API', Description: 'Trivia questions across categories', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Games', Link: 'https://opentdb.com/api_config.php' },
    { API: 'Deck of Cards', Description: 'Simulate a deck of cards', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Games', Link: 'https://deckofcardsapi.com/' },
    { API: 'RoboHash', Description: 'Generate unique robot images', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Art & Design', Link: 'https://robohash.org/' },
    { API: 'QR Code Generator', Description: 'Generate QR codes', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Open Data', Link: 'https://goqr.me/api/' },
    { API: 'IP Geolocation', Description: 'Geolocation from IP address', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Geocoding', Link: 'https://ipapi.co/' },
    { API: 'URLhaus', Description: 'Malware and malicious URL data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Security', Link: 'https://urlhaus-api.abuse.ch/' },
    { API: 'Have I Been Pwned', Description: 'Check if email has been breached', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Security', Link: 'https://haveibeenpwned.com/API/v3' },
    { API: 'Carbon Intensity', Description: 'UK electricity carbon intensity', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Environment', Link: 'https://carbonintensity.org.uk/' },
    { API: 'Open Food Facts', Description: 'Food product database', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Food & Drink', Link: 'https://world.openfoodfacts.org/data' },
    { API: 'Dictionary', Description: 'Word definitions and pronunciations', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Books', Link: 'https://dictionaryapi.dev/' },
    { API: 'Faker', Description: 'Generate fake data for testing', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Open Data', Link: 'https://fakerapi.it/en' },
    { API: 'Bible API', Description: 'Bible verses and chapters', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Books', Link: 'https://bible-api.com/' },
    { API: 'Superhero', Description: 'Superhero information database', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://superheroapi.com/' },
    { API: 'Punk API', Description: 'Brewdog beer database', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Food & Drink', Link: 'https://punkapi.com/' },
    { API: 'Rick and Morty', Description: 'Rick and Morty character data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://rickandmortyapi.com/' },
    { API: 'Star Wars', Description: 'Star Wars universe data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://swapi.dev/' },
    { API: 'Marvel', Description: 'Marvel comics and characters', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://developer.marvel.com/' },
    { API: 'xkcd', Description: 'XKCD comics data', Auth: '', HTTPS: true, Cors: 'yes', Category: 'Entertainment', Link: 'https://xkcd.com/json.html' },
    { API: 'GitHub', Description: 'GitHub API for repositories and users', Auth: 'oauth', HTTPS: true, Cors: 'yes', Category: 'Development', Link: 'https://docs.github.com/en/rest' },
    // Web3 APIs
    { API: 'Moralis', Description: 'Unified Web3 API for wallets, NFTs, tokens, and on-chain data', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Web3', Link: 'https://moralis.io/' },
    { API: 'Alchemy', Description: 'Ethereum and multi-chain API for NFTs, tokens, and smart contracts', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Web3', Link: 'https://www.alchemy.com/' },
    { API: 'Helius', Description: 'Solana blockchain API for transactions, tokens, and DeFi data', Auth: 'apiKey', HTTPS: true, Cors: 'yes', Category: 'Web3', Link: 'https://helius.dev/' },
  ];
}

export interface Web3Endpoint {
  key: string;
  name: string;
  description: string;
  provider: 'moralis' | 'alchemy' | 'helius';
  method: 'GET' | 'POST';
  path: string;
  params: { name: string; required: boolean; description: string }[];
  samplePhrases: string[];
}

export function getWeb3Endpoints(): Web3Endpoint[] {
  return [
    // Moralis Endpoints (v2.2 API paths)
    {
      key: 'web3.moralis.wallet_balance',
      name: 'Get Wallet Balance',
      description: 'Get native token balance for a wallet address',
      provider: 'moralis',
      method: 'GET',
      path: '/{address}/balance?chain={chain}',
      params: [
        { name: 'address', required: true, description: 'Wallet address (0x...)' },
        { name: 'chain', required: false, description: 'Chain ID (eth, polygon, base)' },
      ],
      samplePhrases: ['check my wallet balance', 'what is my ETH balance', 'wallet balance'],
    },
    {
      key: 'web3.moralis.token_balances',
      name: 'Get Token Balances',
      description: 'Get all ERC20 token balances for a wallet',
      provider: 'moralis',
      method: 'GET',
      path: '/{address}/erc20?chain={chain}',
      params: [
        { name: 'address', required: true, description: 'Wallet address (0x...)' },
        { name: 'chain', required: false, description: 'Chain ID (eth, polygon, base)' },
      ],
      samplePhrases: ['show my tokens', 'what tokens do I have', 'token balances'],
    },
    {
      key: 'web3.moralis.nfts',
      name: 'Get NFTs',
      description: 'Get all NFTs owned by a wallet address',
      provider: 'moralis',
      method: 'GET',
      path: '/{address}/nft?chain={chain}',
      params: [
        { name: 'address', required: true, description: 'Wallet address (0x...)' },
        { name: 'chain', required: false, description: 'Chain ID (eth, polygon, base)' },
      ],
      samplePhrases: ['show my NFTs', 'what NFTs do I own', 'my NFT collection'],
    },
    {
      key: 'web3.moralis.transactions',
      name: 'Get Transaction History',
      description: 'Get transaction history for a wallet',
      provider: 'moralis',
      method: 'GET',
      path: '/{address}?chain={chain}',
      params: [
        { name: 'address', required: true, description: 'Wallet address (0x...)' },
        { name: 'chain', required: false, description: 'Chain ID (eth, polygon, base)' },
      ],
      samplePhrases: ['show my transactions', 'transaction history', 'recent transactions'],
    },
    {
      key: 'web3.moralis.token_price',
      name: 'Get Token Price',
      description: 'Get current price of an ERC20 token',
      provider: 'moralis',
      method: 'GET',
      path: '/erc20/{address}/price?chain={chain}',
      params: [
        { name: 'address', required: true, description: 'Token contract address' },
        { name: 'chain', required: false, description: 'Chain ID (eth, polygon, base)' },
      ],
      samplePhrases: ['token price', 'what is the price of', 'check token price'],
    },
    // Alchemy Endpoints
    {
      key: 'web3.alchemy.nft_ownership',
      name: 'Get NFTs for Owner',
      description: 'Get all NFTs owned by an address via Alchemy',
      provider: 'alchemy',
      method: 'GET',
      path: '/getNFTsForOwner?owner={address}',
      params: [
        { name: 'address', required: true, description: 'Wallet address (0x...)' },
      ],
      samplePhrases: ['alchemy NFTs', 'get my NFTs from alchemy'],
    },
    {
      key: 'web3.alchemy.nft_floor_price',
      name: 'Get NFT Floor Price',
      description: 'Get floor price for an NFT collection',
      provider: 'alchemy',
      method: 'GET',
      path: '/getFloorPrice?contractAddress={contract}',
      params: [
        { name: 'contract', required: true, description: 'NFT contract address' },
      ],
      samplePhrases: ['NFT floor price', 'collection floor price', 'what is the floor'],
    },
    {
      key: 'web3.alchemy.token_balances',
      name: 'Get Token Balances (Alchemy)',
      description: 'Get all token balances via Alchemy',
      provider: 'alchemy',
      method: 'POST',
      path: '/',
      params: [
        { name: 'address', required: true, description: 'Wallet address (0x...)' },
      ],
      samplePhrases: ['alchemy token balances', 'check tokens alchemy'],
    },
    {
      key: 'web3.alchemy.gas_price',
      name: 'Get Gas Price',
      description: 'Get current gas price estimates',
      provider: 'alchemy',
      method: 'POST',
      path: '/',
      params: [],
      samplePhrases: ['gas price', 'what is gas', 'current gas fees', 'ethereum gas'],
    },
    // Helius (Solana) Endpoints
    {
      key: 'web3.helius.balances',
      name: 'Get Solana Balances',
      description: 'Get token balances for a Solana wallet',
      provider: 'helius',
      method: 'GET',
      path: '/addresses/{address}/balances?api-key={apiKey}',
      params: [
        { name: 'address', required: true, description: 'Solana wallet address' },
      ],
      samplePhrases: ['solana balance', 'my SOL', 'solana tokens'],
    },
    {
      key: 'web3.helius.transactions',
      name: 'Get Solana Transactions',
      description: 'Get transaction history for a Solana wallet',
      provider: 'helius',
      method: 'GET',
      path: '/addresses/{address}/transactions?api-key={apiKey}',
      params: [
        { name: 'address', required: true, description: 'Solana wallet address' },
      ],
      samplePhrases: ['solana transactions', 'SOL history', 'solana activity'],
    },
    {
      key: 'web3.helius.nfts',
      name: 'Get Solana NFTs',
      description: 'Get NFTs owned by a Solana wallet',
      provider: 'helius',
      method: 'GET',
      path: '/addresses/{address}/nfts?api-key={apiKey}',
      params: [
        { name: 'address', required: true, description: 'Solana wallet address' },
      ],
      samplePhrases: ['solana NFTs', 'my SOL NFTs', 'solana collection'],
    },
  ];
}

export async function parseGitHubEntries(data: string): Promise<RawApiEntry[]> {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeGitHubEntry);
    }
    if (parsed.entries) {
      return parsed.entries.map(normalizeGitHubEntry);
    }
    return [];
  } catch {
    return [];
  }
}

export function getDefaultSources(): ApiSource[] {
  return [
    {
      id: 'github-public-apis',
      name: 'GitHub Public APIs',
      url: GITHUB_PUBLIC_APIS_URL,
      format: 'json',
      parser: parseGitHubEntries,
      fetchInterval: 86400000,
      lastFetch: 0,
      status: 'active',
    },
    {
      id: 'builtin-curated',
      name: 'Atlas Built-in Curated APIs',
      url: 'builtin://curated',
      format: 'json',
      parser: async () => getBuiltinPublicApis(),
      fetchInterval: 0,
      lastFetch: 0,
      status: 'active',
    },
  ];
}
