import type { RawApiEntry, ApiCatalogEntry, ApiEndpointDef, QUALITY_THRESHOLDS } from './types';

const API_ENDPOINT_TEMPLATES: Record<string, ApiEndpointDef[]> = {
  'Open-Meteo': [
    { name: 'forecast', path: '/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true', method: 'GET', description: 'Get current weather and forecast for coordinates' },
  ],
  'JokeAPI': [
    { name: 'random', path: '/joke/Any', method: 'GET', description: 'Get a random joke' },
    { name: 'programming', path: '/joke/Programming', method: 'GET', description: 'Get a programming joke' },
  ],
  'CoinGecko': [
    { name: 'prices', path: '/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd', method: 'GET', description: 'Get cryptocurrency prices' },
    { name: 'coins', path: '/api/v3/coins/markets?vs_currency=usd', method: 'GET', description: 'List all coins with market data' },
    { name: 'markets', path: '/api/v3/coins/markets?vs_currency={vs_currency}&ids={ids}&per_page={per_page}', method: 'GET', description: 'Get cryptocurrency market data with custom parameters' },
  ],
  'Dog CEO': [
    { name: 'random', path: '/api/breeds/image/random', method: 'GET', description: 'Get a random dog image' },
    { name: 'breed', path: '/api/breed/{breed}/images', method: 'GET', description: 'Get images by breed' },
  ],
  'Cat Facts': [
    { name: 'fact', path: '/fact', method: 'GET', description: 'Get a random cat fact' },
    { name: 'facts', path: '/facts', method: 'GET', description: 'Get multiple cat facts' },
  ],
  'Bored': [
    { name: 'activity', path: '/api/activity', method: 'GET', description: 'Get a random activity suggestion' },
  ],
  'Advice Slip': [
    { name: 'random', path: '/advice', method: 'GET', description: 'Get random advice' },
  ],
  'Chuck Norris': [
    { name: 'random', path: '/jokes/random', method: 'GET', description: 'Get a random Chuck Norris joke' },
  ],
  'Quotable': [
    { name: 'random', path: '/random', method: 'GET', description: 'Get a random quote' },
    { name: 'quotes', path: '/quotes', method: 'GET', description: 'List quotes with pagination' },
  ],
  'REST Countries': [
    { name: 'all', path: '/v3.1/all', method: 'GET', description: 'Get all countries' },
    { name: 'byName', path: '/v3.1/name/{name}', method: 'GET', description: 'Search countries by name' },
  ],
  'PokeAPI': [
    { name: 'pokemon', path: '/api/v2/pokemon/{name}', method: 'GET', description: 'Get Pokemon by name' },
    { name: 'list', path: '/api/v2/pokemon?limit=20', method: 'GET', description: 'List Pokemon' },
  ],
  'NASA': [
    { name: 'apod', path: '/planetary/apod', method: 'GET', description: 'Astronomy Picture of the Day' },
  ],
  'Random User': [
    { name: 'user', path: '/api/', method: 'GET', description: 'Generate random user data' },
  ],
  'Nager.Date': [
    { name: 'holidays', path: '/api/v3/PublicHolidays/{year}/{country}', method: 'GET', description: 'Get public holidays for a country' },
    { name: 'nextHoliday', path: '/api/v3/NextPublicHolidays/{country}', method: 'GET', description: 'Get next public holidays' },
  ],
  'TheCocktailDB': [
    { name: 'random', path: '/api/json/v1/1/random.php', method: 'GET', description: 'Get a random cocktail recipe' },
    { name: 'search', path: '/api/json/v1/1/search.php?s={name}', method: 'GET', description: 'Search cocktails by name' },
  ],
  'TheMealDB': [
    { name: 'random', path: '/api/json/v1/1/random.php', method: 'GET', description: 'Get a random meal recipe' },
    { name: 'search', path: '/api/json/v1/1/search.php?s={name}', method: 'GET', description: 'Search meals by name' },
  ],
  'xkcd': [
    { name: 'current', path: '/info.0.json', method: 'GET', description: 'Get the current XKCD comic' },
  ],
  'Rick and Morty': [
    { name: 'characters', path: '/api/character', method: 'GET', description: 'List all characters' },
    { name: 'character', path: '/api/character/{id}', method: 'GET', description: 'Get character by ID' },
  ],
  'Star Wars': [
    { name: 'people', path: '/api/people/', method: 'GET', description: 'List Star Wars characters' },
    { name: 'planets', path: '/api/planets/', method: 'GET', description: 'List Star Wars planets' },
  ],
  'SpaceX': [
    { name: 'launches', path: '/v5/launches/latest', method: 'GET', description: 'Get latest launch' },
    { name: 'rockets', path: '/v4/rockets', method: 'GET', description: 'List all rockets' },
  ],
  'Trivia API': [
    { name: 'questions', path: '/api.php?amount=10', method: 'GET', description: 'Get trivia questions' },
  ],
  'IP API': [
    { name: 'lookup', path: '/json/', method: 'GET', description: 'Get geolocation for current IP' },
  ],
  'Agify': [
    { name: 'predict', path: '/?name={name}', method: 'GET', description: 'Predict age from name' },
  ],
  'Genderize': [
    { name: 'predict', path: '/?name={name}', method: 'GET', description: 'Predict gender from name' },
  ],
  'Nationalize': [
    { name: 'predict', path: '/?name={name}', method: 'GET', description: 'Predict nationality from name' },
  ],
  'Dictionary': [
    { name: 'define', path: '/api/v2/entries/en/{word}', method: 'GET', description: 'Get word definition' },
  ],
  'Lorem Picsum': [
    { name: 'random', path: '/200/300', method: 'GET', description: 'Get a random image' },
  ],
  'Punk API': [
    { name: 'random', path: '/v2/beers/random', method: 'GET', description: 'Get a random beer' },
    { name: 'list', path: '/v2/beers', method: 'GET', description: 'List beers' },
  ],
  'JSONPlaceholder': [
    { name: 'posts', path: '/posts', method: 'GET', description: 'List all posts' },
    { name: 'users', path: '/users', method: 'GET', description: 'List all users' },
  ],
  'Numbers': [
    { name: 'trivia', path: '/{number}/trivia', method: 'GET', description: 'Get trivia about a number' },
    { name: 'random', path: '/random/trivia', method: 'GET', description: 'Get random number trivia' },
  ],
  'Open Library': [
    { name: 'search', path: '/search.json?q={query}', method: 'GET', description: 'Search books' },
    { name: 'book', path: '/api/books?bibkeys=ISBN:{isbn}&format=json', method: 'GET', description: 'Get book by ISBN' },
  ],
};

const BASE_URL_MAP: Record<string, string> = {
  'Open-Meteo': 'https://api.open-meteo.com',
  'JokeAPI': 'https://v2.jokeapi.dev',
  'CoinGecko': 'https://api.coingecko.com',
  'Dog CEO': 'https://dog.ceo',
  'Cat Facts': 'https://catfact.ninja',
  'Bored': 'https://www.boredapi.com',
  'Advice Slip': 'https://api.adviceslip.com',
  'Chuck Norris': 'https://api.chucknorris.io',
  'Quotable': 'https://api.quotable.io',
  'REST Countries': 'https://restcountries.com',
  'PokeAPI': 'https://pokeapi.co',
  'NASA': 'https://api.nasa.gov',
  'Random User': 'https://randomuser.me',
  'Nager.Date': 'https://date.nager.at',
  'TheCocktailDB': 'https://www.thecocktaildb.com',
  'TheMealDB': 'https://www.themealdb.com',
  'xkcd': 'https://xkcd.com',
  'Rick and Morty': 'https://rickandmortyapi.com',
  'Star Wars': 'https://swapi.dev',
  'SpaceX': 'https://api.spacexdata.com',
  'Trivia API': 'https://opentdb.com',
  'IP API': 'http://ip-api.com',
  'Agify': 'https://api.agify.io',
  'Genderize': 'https://api.genderize.io',
  'Nationalize': 'https://api.nationalize.io',
  'Dictionary': 'https://api.dictionaryapi.dev',
  'Lorem Picsum': 'https://picsum.photos',
  'Punk API': 'https://api.punkapi.com',
  'JSONPlaceholder': 'https://jsonplaceholder.typicode.com',
  'Numbers': 'http://numbersapi.com',
  'Open Library': 'https://openlibrary.org',
};

function normalizeAuth(auth: string): ApiCatalogEntry['auth'] {
  const a = auth.toLowerCase().trim();
  if (!a || a === 'no' || a === 'none' || a === '') return 'none';
  if (a.includes('oauth')) return 'oauth';
  if (a.includes('apikey') || a.includes('api key') || a.includes('key')) return 'apiKey';
  return 'custom';
}

function normalizeCors(cors: string): boolean | 'unknown' {
  const c = cors.toLowerCase().trim();
  if (c === 'yes' || c === 'true') return true;
  if (c === 'no' || c === 'false') return false;
  return 'unknown';
}

function calculateQualityScore(entry: RawApiEntry): number {
  let score = 0.5;
  
  if (entry.HTTPS) score += 0.2;
  if (normalizeCors(entry.Cors) === true) score += 0.1;
  if (normalizeAuth(entry.Auth) === 'none') score += 0.15;
  if (entry.Description && entry.Description.length > 20) score += 0.05;
  
  return Math.min(1, Math.max(0, score));
}

function extractBaseUrl(link: string, name: string): string {
  if (BASE_URL_MAP[name]) return BASE_URL_MAP[name];
  
  try {
    const url = new URL(link);
    return `${url.protocol}//${url.host}`;
  } catch {
    return link;
  }
}

function generateEndpoints(name: string): ApiEndpointDef[] {
  if (API_ENDPOINT_TEMPLATES[name]) {
    return API_ENDPOINT_TEMPLATES[name];
  }
  
  return [{
    name: 'default',
    path: '/',
    method: 'GET',
    description: `Call ${name} API`,
  }];
}

export function normalizeRawEntry(entry: RawApiEntry, source: string): ApiCatalogEntry | null {
  if (!entry.API || !entry.Link) return null;
  
  const qualityScore = calculateQualityScore(entry);
  
  if (qualityScore < 0.4) return null;
  
  return {
    name: entry.API,
    description: entry.Description || `${entry.API} API`,
    auth: normalizeAuth(entry.Auth),
    https: entry.HTTPS,
    cors: normalizeCors(entry.Cors),
    category: entry.Category || 'Other',
    baseUrl: extractBaseUrl(entry.Link, entry.API),
    link: entry.Link,
    endpoints: generateEndpoints(entry.API),
    source,
    qualityScore,
    lastChecked: Date.now(),
    healthStatus: 'unknown',
  };
}

export function deduplicateEntries(entries: ApiCatalogEntry[]): ApiCatalogEntry[] {
  const seen = new Map<string, ApiCatalogEntry>();
  
  for (const entry of entries) {
    const key = entry.name.toLowerCase();
    const existing = seen.get(key);
    
    if (!existing || entry.qualityScore > existing.qualityScore) {
      seen.set(key, entry);
    }
  }
  
  return Array.from(seen.values());
}

export function filterByQuality(
  entries: ApiCatalogEntry[],
  options: Partial<typeof QUALITY_THRESHOLDS> = {}
): ApiCatalogEntry[] {
  const { MIN_SCORE = 0.4, HTTPS_REQUIRED = true, AUTH_NONE_PREFERRED = true } = options;
  
  return entries.filter(entry => {
    if (entry.qualityScore < MIN_SCORE) return false;
    if (HTTPS_REQUIRED && !entry.https) return false;
    if (AUTH_NONE_PREFERRED && entry.auth !== 'none') {
      return entry.qualityScore >= 0.7;
    }
    return true;
  });
}
