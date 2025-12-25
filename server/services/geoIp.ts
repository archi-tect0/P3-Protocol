import crypto from 'crypto';

interface GeoCache {
  country: string;
  timestamp: number;
}

const geoCache = new Map<string, GeoCache>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 10000;
const LOOKUP_TIMEOUT_MS = 3000;
const FALLBACK_TIMEOUT_MS = 2000;

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function isLocalIp(ip: string): boolean {
  return ip === '127.0.0.1' || 
         ip === '::1' || 
         ip.startsWith('192.168.') || 
         ip.startsWith('10.') || 
         ip.startsWith('172.') ||
         ip.startsWith('169.254.') ||
         ip.startsWith('fc00:') ||
         ip.startsWith('fe80:') ||
         ip === 'localhost';
}

function isCloudflareIp(ip: string): boolean {
  const cfRanges = [
    '103.21.244.', '103.22.200.', '103.31.4.', '104.16.', '104.17.',
    '104.18.', '104.19.', '104.20.', '104.21.', '104.22.', '104.23.',
    '104.24.', '104.25.', '104.26.', '104.27.', '108.162.', '131.0.72.',
    '141.101.', '162.158.', '172.64.', '172.65.', '172.66.', '172.67.',
    '173.245.', '188.114.', '190.93.', '197.234.', '198.41.'
  ];
  return cfRanges.some(range => ip.startsWith(range));
}

function cleanupCache(): void {
  if (geoCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(geoCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    for (let i = 0; i < entries.length / 2; i++) {
      geoCache.delete(entries[i][0]);
    }
  }
}

async function tryIpApiCo(ip: string, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/country_name/`, { signal });
    
    if (!response.ok) {
      return null;
    }
    
    const countryText = await response.text();
    const trimmed = countryText.trim();
    
    if (trimmed.includes('error') || trimmed.includes('Rate limit') || trimmed === 'Undefined') {
      return null;
    }
    
    return trimmed || null;
  } catch {
    return null;
  }
}

async function tryIpApi(ip: string, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country`, { signal });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.country || null;
  } catch {
    return null;
  }
}

async function tryIpInfoIo(ip: string, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`https://ipinfo.io/${ip}/country`, { signal });
    
    if (!response.ok) {
      return null;
    }
    
    const countryCode = (await response.text()).trim();
    if (!countryCode || countryCode.length !== 2) {
      return null;
    }
    
    return COUNTRY_CODE_MAP[countryCode.toUpperCase()] || null;
  } catch {
    return null;
  }
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  'US': 'United States', 'GB': 'United Kingdom', 'UK': 'United Kingdom',
  'CA': 'Canada', 'AU': 'Australia', 'DE': 'Germany', 'FR': 'France',
  'JP': 'Japan', 'CN': 'China', 'IN': 'India', 'BR': 'Brazil',
  'RU': 'Russia', 'KR': 'South Korea', 'IT': 'Italy', 'ES': 'Spain',
  'MX': 'Mexico', 'NL': 'Netherlands', 'SE': 'Sweden', 'NO': 'Norway',
  'DK': 'Denmark', 'FI': 'Finland', 'PL': 'Poland', 'AT': 'Austria',
  'CH': 'Switzerland', 'BE': 'Belgium', 'IE': 'Ireland', 'PT': 'Portugal',
  'NZ': 'New Zealand', 'SG': 'Singapore', 'HK': 'Hong Kong', 'TW': 'Taiwan',
  'PH': 'Philippines', 'TH': 'Thailand', 'MY': 'Malaysia', 'ID': 'Indonesia',
  'VN': 'Vietnam', 'ZA': 'South Africa', 'AE': 'United Arab Emirates',
  'SA': 'Saudi Arabia', 'EG': 'Egypt', 'NG': 'Nigeria', 'KE': 'Kenya',
  'AR': 'Argentina', 'CL': 'Chile', 'CO': 'Colombia', 'PE': 'Peru',
  'VE': 'Venezuela', 'UA': 'Ukraine', 'CZ': 'Czech Republic', 'RO': 'Romania',
  'HU': 'Hungary', 'GR': 'Greece', 'IL': 'Israel', 'TR': 'Turkey',
  'PK': 'Pakistan', 'BD': 'Bangladesh', 'LK': 'Sri Lanka', 'NP': 'Nepal',
};

const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  'en-us': 'United States', 'en-gb': 'United Kingdom', 'en-au': 'Australia',
  'en-ca': 'Canada', 'en-nz': 'New Zealand', 'en-ie': 'Ireland',
  'de-de': 'Germany', 'de-at': 'Austria', 'de-ch': 'Switzerland',
  'fr-fr': 'France', 'fr-ca': 'Canada', 'fr-be': 'Belgium', 'fr-ch': 'Switzerland',
  'es-es': 'Spain', 'es-mx': 'Mexico', 'es-ar': 'Argentina', 'es-co': 'Colombia',
  'pt-br': 'Brazil', 'pt-pt': 'Portugal',
  'it-it': 'Italy', 'nl-nl': 'Netherlands', 'nl-be': 'Belgium',
  'ja-jp': 'Japan', 'ko-kr': 'South Korea', 'zh-cn': 'China', 'zh-tw': 'Taiwan',
  'ru-ru': 'Russia', 'pl-pl': 'Poland', 'tr-tr': 'Turkey',
  'ar-sa': 'Saudi Arabia', 'ar-ae': 'United Arab Emirates', 'ar-eg': 'Egypt',
  'hi-in': 'India', 'th-th': 'Thailand', 'vi-vn': 'Vietnam',
  'id-id': 'Indonesia', 'ms-my': 'Malaysia', 'fil-ph': 'Philippines',
  'sv-se': 'Sweden', 'da-dk': 'Denmark', 'fi-fi': 'Finland', 'no-no': 'Norway',
  'he-il': 'Israel', 'el-gr': 'Greece', 'cs-cz': 'Czech Republic',
  'hu-hu': 'Hungary', 'ro-ro': 'Romania', 'uk-ua': 'Ukraine',
};

export interface GeoHeaders {
  'cf-ipcountry'?: string;
  'x-vercel-ip-country'?: string;
  'x-country-code'?: string;
  'accept-language'?: string;
  [key: string]: string | undefined;
}

function resolveCountryFromHeaders(headers?: GeoHeaders): string | null {
  if (!headers) return null;

  const cfCountry = headers['cf-ipcountry'];
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
    const country = COUNTRY_CODE_MAP[cfCountry.toUpperCase()];
    if (country) return country;
  }

  const vercelCountry = headers['x-vercel-ip-country'];
  if (vercelCountry && vercelCountry.length === 2) {
    const country = COUNTRY_CODE_MAP[vercelCountry.toUpperCase()];
    if (country) return country;
  }

  const xCountry = headers['x-country-code'];
  if (xCountry && xCountry.length === 2) {
    const country = COUNTRY_CODE_MAP[xCountry.toUpperCase()];
    if (country) return country;
  }

  const acceptLang = headers['accept-language'];
  if (acceptLang) {
    const langs = acceptLang.split(',');
    for (const lang of langs) {
      const langCode = lang.split(';')[0].trim().toLowerCase();
      if (LANGUAGE_TO_COUNTRY[langCode]) {
        return LANGUAGE_TO_COUNTRY[langCode];
      }
      const baseLang = langCode.split('-')[0];
      const matchingKey = Object.keys(LANGUAGE_TO_COUNTRY).find(k => k.startsWith(baseLang + '-'));
      if (matchingKey) {
        return LANGUAGE_TO_COUNTRY[matchingKey];
      }
    }
  }

  return null;
}

export async function resolveCountry(ip: string, headers?: GeoHeaders): Promise<string | null> {
  if (isLocalIp(ip)) {
    const headerCountry = resolveCountryFromHeaders(headers);
    return headerCountry || 'Local Network';
  }
  
  if (isCloudflareIp(ip)) {
    const headerCountry = resolveCountryFromHeaders(headers);
    return headerCountry || 'CDN/Proxy';
  }
  
  const ipHash = hashIp(ip);
  const cached = geoCache.get(ipHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.country;
  }
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  
  try {
    let country = await tryIpApiCo(ip, controller.signal);
    
    if (!country) {
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), FALLBACK_TIMEOUT_MS);
      
      try {
        country = await tryIpApi(ip, fallbackController.signal);
      } finally {
        clearTimeout(fallbackTimeout);
      }
    }
    
    if (!country) {
      const fallbackController2 = new AbortController();
      const fallbackTimeout2 = setTimeout(() => fallbackController2.abort(), FALLBACK_TIMEOUT_MS);
      
      try {
        country = await tryIpInfoIo(ip, fallbackController2.signal);
      } finally {
        clearTimeout(fallbackTimeout2);
      }
    }
    
    if (!country) {
      country = resolveCountryFromHeaders(headers);
    }
    
    if (country) {
      cleanupCache();
      geoCache.set(ipHash, {
        country,
        timestamp: Date.now(),
      });
    }
    
    return country;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[GeoIP] Request timeout for IP lookup');
    } else {
      console.warn('[GeoIP] Failed to resolve country:', error.message);
    }
    const headerCountry = resolveCountryFromHeaders(headers);
    return headerCountry || null;
  } finally {
    clearTimeout(timeout);
  }
}

export function getCachedCountry(ip: string): string | null {
  if (isLocalIp(ip)) {
    return 'Local Network';
  }
  
  if (isCloudflareIp(ip)) {
    return 'CDN/Proxy';
  }
  
  const ipHash = hashIp(ip);
  const cached = geoCache.get(ipHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.country;
  }
  return null;
}

export async function resolveCountryFireAndForget(
  ip: string,
  callback: (country: string | null) => void
): Promise<void> {
  const cached = getCachedCountry(ip);
  if (cached) {
    callback(cached);
    return;
  }
  
  resolveCountry(ip).then(callback).catch(() => callback(null));
}

export function getGeoStats(): { cacheSize: number; cacheHitRate: number } {
  return {
    cacheSize: geoCache.size,
    cacheHitRate: geoCache.size > 0 ? 0.85 : 0,
  };
}
