import { Router, Request, Response } from 'express';
import axios from 'axios';
import { rootLogger } from '../observability/logger';

const router = Router();
const logger = rootLogger.child({ module: 'radio-proxy' });

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  state: string;
  language: string;
  votes: number;
  codec: string;
  bitrate: number;
  lastcheckok: number;
  clickcount: number;
}

interface CachedStation {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  genre: string;
  streamUrl: string;
  logo?: string;
  bitrate?: number;
  codec?: string;
  website?: string;
  votes: number;
  clicks: number;
}

let stationsCache: CachedStation[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const RADIO_BROWSER_SERVERS = [
  'de1.api.radio-browser.info',
  'nl1.api.radio-browser.info',
  'at1.api.radio-browser.info',
];

async function getRandomServer(): Promise<string> {
  return RADIO_BROWSER_SERVERS[Math.floor(Math.random() * RADIO_BROWSER_SERVERS.length)];
}

async function fetchStationsFromAPI(): Promise<CachedStation[]> {
  const server = await getRandomServer();
  const baseUrl = `https://${server}/json`;
  
  logger.info(`[RadioBrowser] Fetching stations from ${server}`);
  
  try {
    // Fetch top voted stations (these are most reliable)
    const response = await axios.get<RadioBrowserStation[]>(`${baseUrl}/stations/topvote/1500`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Atlas/1.0 (Radio Browser Client)',
      },
    });
    
    const stations = response.data
      .filter(s => s.lastcheckok === 1 && s.url_resolved)
      .map(s => ({
        id: s.stationuuid,
        name: s.name.trim(),
        country: s.country || 'Unknown',
        countryCode: s.countrycode || '',
        genre: s.tags ? s.tags.split(',')[0].trim() : 'Various',
        streamUrl: s.url_resolved || s.url,
        logo: s.favicon || undefined,
        bitrate: s.bitrate || 128,
        codec: s.codec || 'MP3',
        website: s.homepage || undefined,
        votes: s.votes,
        clicks: s.clickcount,
      }));
    
    logger.info(`[RadioBrowser] Fetched ${stations.length} stations`);
    return stations;
  } catch (err: any) {
    logger.error(`[RadioBrowser] Failed to fetch from ${server}:`, err.message);
    throw err;
  }
}

async function getStations(): Promise<CachedStation[]> {
  const now = Date.now();
  
  // Return cached if still valid
  if (stationsCache.length > 0 && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return stationsCache;
  }
  
  try {
    stationsCache = await fetchStationsFromAPI();
    cacheTimestamp = now;
    return stationsCache;
  } catch (err) {
    // If fetch fails but we have stale cache, return it
    if (stationsCache.length > 0) {
      logger.warn('[RadioBrowser] Using stale cache due to fetch failure');
      return stationsCache;
    }
    throw err;
  }
}

// Priority/fallback stations for when API fails or for guaranteed working streams
const FALLBACK_STATIONS: CachedStation[] = [
  // USA - SomaFM (CORS-friendly, guaranteed to work)
  { id: 'somafm-groovesalad', name: 'SomaFM Groove Salad', country: 'USA', countryCode: 'US', genre: 'Ambient/Chill', streamUrl: 'https://ice1.somafm.com/groovesalad-256-mp3', bitrate: 256, codec: 'MP3', votes: 10000, clicks: 50000 },
  { id: 'somafm-dronezone', name: 'SomaFM Drone Zone', country: 'USA', countryCode: 'US', genre: 'Ambient', streamUrl: 'https://ice1.somafm.com/dronezone-256-mp3', bitrate: 256, codec: 'MP3', votes: 9500, clicks: 48000 },
  { id: 'somafm-secretagent', name: 'SomaFM Secret Agent', country: 'USA', countryCode: 'US', genre: 'Lounge', streamUrl: 'https://ice1.somafm.com/secretagent-256-mp3', bitrate: 256, codec: 'MP3', votes: 8500, clicks: 42000 },
  { id: 'somafm-indiepop', name: 'SomaFM Indie Pop Rocks', country: 'USA', countryCode: 'US', genre: 'Indie Pop', streamUrl: 'https://ice1.somafm.com/indiepop-256-mp3', bitrate: 256, codec: 'MP3', votes: 8000, clicks: 40000 },
  { id: 'somafm-beatblender', name: 'SomaFM Beat Blender', country: 'USA', countryCode: 'US', genre: 'Electronic', streamUrl: 'https://ice1.somafm.com/beatblender-256-mp3', bitrate: 256, codec: 'MP3', votes: 7500, clicks: 38000 },
  { id: 'somafm-defcon', name: 'SomaFM DEF CON', country: 'USA', countryCode: 'US', genre: 'Electronic', streamUrl: 'https://ice1.somafm.com/defcon-256-mp3', bitrate: 256, codec: 'MP3', votes: 7000, clicks: 35000 },
  { id: 'somafm-sonicuniverse', name: 'SomaFM Sonic Universe', country: 'USA', countryCode: 'US', genre: 'Jazz', streamUrl: 'https://ice1.somafm.com/sonicuniverse-256-mp3', bitrate: 256, codec: 'MP3', votes: 6500, clicks: 32000 },
  { id: 'somafm-7soul', name: 'SomaFM Seven Inch Soul', country: 'USA', countryCode: 'US', genre: 'Soul', streamUrl: 'https://ice1.somafm.com/7soul-256-mp3', bitrate: 256, codec: 'MP3', votes: 6000, clicks: 30000 },
  { id: 'somafm-lush', name: 'SomaFM Lush', country: 'USA', countryCode: 'US', genre: 'Electronica', streamUrl: 'https://ice1.somafm.com/lush-256-mp3', bitrate: 256, codec: 'MP3', votes: 5500, clicks: 28000 },
  { id: 'somafm-metal', name: 'SomaFM Metal Detector', country: 'USA', countryCode: 'US', genre: 'Metal', streamUrl: 'https://ice1.somafm.com/metal-256-mp3', bitrate: 256, codec: 'MP3', votes: 5000, clicks: 25000 },
  { id: 'somafm-folkfwd', name: 'SomaFM Folk Forward', country: 'USA', countryCode: 'US', genre: 'Folk/Indie', streamUrl: 'https://ice1.somafm.com/folkfwd-256-mp3', bitrate: 256, codec: 'MP3', votes: 4800, clicks: 24000 },
  { id: 'somafm-bootliquor', name: 'SomaFM Boot Liquor', country: 'USA', countryCode: 'US', genre: 'Americana', streamUrl: 'https://ice1.somafm.com/bootliquor-256-mp3', bitrate: 256, codec: 'MP3', votes: 4600, clicks: 23000 },
  { id: 'somafm-spacestation', name: 'SomaFM Space Station', country: 'USA', countryCode: 'US', genre: 'Space/Ambient', streamUrl: 'https://ice1.somafm.com/spacestation-256-mp3', bitrate: 256, codec: 'MP3', votes: 4400, clicks: 22000 },
  { id: 'somafm-thetrip', name: 'SomaFM The Trip', country: 'USA', countryCode: 'US', genre: 'Progressive', streamUrl: 'https://ice1.somafm.com/thetrip-256-mp3', bitrate: 256, codec: 'MP3', votes: 4200, clicks: 21000 },
  { id: 'somafm-poptron', name: 'SomaFM PopTron', country: 'USA', countryCode: 'US', genre: 'Synthpop', streamUrl: 'https://ice1.somafm.com/poptron-256-mp3', bitrate: 256, codec: 'MP3', votes: 4000, clicks: 20000 },
  { id: 'somafm-covers', name: 'SomaFM Covers', country: 'USA', countryCode: 'US', genre: 'Cover Songs', streamUrl: 'https://ice1.somafm.com/covers-256-mp3', bitrate: 256, codec: 'MP3', votes: 3800, clicks: 19000 },
  { id: 'somafm-seventies', name: 'SomaFM Left Coast 70s', country: 'USA', countryCode: 'US', genre: '70s', streamUrl: 'https://ice1.somafm.com/seventies-256-mp3', bitrate: 256, codec: 'MP3', votes: 3600, clicks: 18000 },
  { id: 'somafm-underground80s', name: 'SomaFM Underground 80s', country: 'USA', countryCode: 'US', genre: '80s', streamUrl: 'https://ice1.somafm.com/u80s-256-mp3', bitrate: 256, codec: 'MP3', votes: 3400, clicks: 17000 },
  { id: 'somafm-suburbs', name: 'SomaFM Suburbs of Goa', country: 'USA', countryCode: 'US', genre: 'World/Electronic', streamUrl: 'https://ice1.somafm.com/suburbsofgoa-256-mp3', bitrate: 256, codec: 'MP3', votes: 3200, clicks: 16000 },
  { id: 'somafm-bagel', name: 'SomaFM BAGeL Radio', country: 'USA', countryCode: 'US', genre: 'Eclectic', streamUrl: 'https://ice1.somafm.com/bagel-256-mp3', bitrate: 256, codec: 'MP3', votes: 3000, clicks: 15000 },
  { id: 'somafm-cliqhop', name: 'SomaFM cliqhop idm', country: 'USA', countryCode: 'US', genre: 'IDM', streamUrl: 'https://ice1.somafm.com/cliqhop-256-mp3', bitrate: 256, codec: 'MP3', votes: 2800, clicks: 14000 },
  // USA - Radio Paradise
  { id: 'radio-paradise', name: 'Radio Paradise Main', country: 'USA', countryCode: 'US', genre: 'Eclectic', streamUrl: 'https://stream.radioparadise.com/aac-320', bitrate: 320, codec: 'AAC', votes: 9000, clicks: 45000 },
  { id: 'radio-paradise-mellow', name: 'Radio Paradise Mellow', country: 'USA', countryCode: 'US', genre: 'Chill', streamUrl: 'https://stream.radioparadise.com/mellow-320', bitrate: 320, codec: 'AAC', votes: 7000, clicks: 35000 },
  { id: 'radio-paradise-rock', name: 'Radio Paradise Rock', country: 'USA', countryCode: 'US', genre: 'Rock', streamUrl: 'https://stream.radioparadise.com/rock-320', bitrate: 320, codec: 'AAC', votes: 6500, clicks: 32000 },
  { id: 'radio-paradise-world', name: 'Radio Paradise World', country: 'USA', countryCode: 'US', genre: 'World', streamUrl: 'https://stream.radioparadise.com/world-etc-320', bitrate: 320, codec: 'AAC', votes: 6000, clicks: 30000 },
  // USA - Public Radio & Commercial
  { id: 'npr-1', name: 'NPR News', country: 'USA', countryCode: 'US', genre: 'News', streamUrl: 'https://npr-ice.streamguys1.com/live.mp3', bitrate: 128, codec: 'MP3', votes: 8000, clicks: 40000 },
  { id: 'kexp', name: 'KEXP 90.3 Seattle', country: 'USA', countryCode: 'US', genre: 'Indie/Alternative', streamUrl: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', bitrate: 128, codec: 'MP3', votes: 7500, clicks: 38000 },
  { id: 'wnyc-fm', name: 'WNYC 93.9 FM', country: 'USA', countryCode: 'US', genre: 'Public Radio', streamUrl: 'https://fm939.wnyc.org/wnycfm', bitrate: 128, codec: 'AAC', votes: 7000, clicks: 35000 },
  { id: 'kcrw', name: 'KCRW Eclectic 24', country: 'USA', countryCode: 'US', genre: 'Eclectic', streamUrl: 'https://kcrw.streamguys1.com/kcrw_192k_mp3_e24', bitrate: 192, codec: 'MP3', votes: 6500, clicks: 32000 },
  { id: 'kcrw-main', name: 'KCRW 89.9', country: 'USA', countryCode: 'US', genre: 'Public Radio', streamUrl: 'https://kcrw.streamguys1.com/kcrw_192k_mp3_live', bitrate: 192, codec: 'MP3', votes: 6000, clicks: 30000 },
  { id: 'kusc', name: 'KUSC Classical', country: 'USA', countryCode: 'US', genre: 'Classical', streamUrl: 'https://kusc.streamguys1.com/kusc-128k.mp3', bitrate: 128, codec: 'MP3', votes: 5500, clicks: 28000 },
  { id: 'wqxr', name: 'WQXR Classical', country: 'USA', countryCode: 'US', genre: 'Classical', streamUrl: 'https://stream.wqxr.org/wqxr', bitrate: 128, codec: 'AAC', votes: 5000, clicks: 25000 },
  { id: 'wbgo', name: 'WBGO Jazz 88.3', country: 'USA', countryCode: 'US', genre: 'Jazz', streamUrl: 'https://wbgo.streamguys1.com/wbgo128', bitrate: 128, codec: 'MP3', votes: 4500, clicks: 22000 },
  { id: 'kjazz', name: 'KJAZZ 88.1', country: 'USA', countryCode: 'US', genre: 'Jazz', streamUrl: 'https://kjazz.streamguys1.com/kjzz.mp3', bitrate: 128, codec: 'MP3', votes: 4000, clicks: 20000 },
  { id: 'kroq', name: 'KROQ 106.7', country: 'USA', countryCode: 'US', genre: 'Alternative Rock', streamUrl: 'https://stream.revma.ihrhls.com/zc1465', bitrate: 128, codec: 'AAC', votes: 5500, clicks: 28000 },
  { id: 'hot97', name: 'Hot 97 NYC', country: 'USA', countryCode: 'US', genre: 'Hip-Hop', streamUrl: 'https://stream.revma.ihrhls.com/zc1289', bitrate: 128, codec: 'AAC', votes: 6000, clicks: 30000 },
  { id: 'power106', name: 'Power 106 LA', country: 'USA', countryCode: 'US', genre: 'Hip-Hop', streamUrl: 'https://stream.revma.ihrhls.com/zc1561', bitrate: 128, codec: 'AAC', votes: 5500, clicks: 28000 },
  { id: 'z100', name: 'Z100 NYC', country: 'USA', countryCode: 'US', genre: 'Top 40', streamUrl: 'https://stream.revma.ihrhls.com/zc1281', bitrate: 128, codec: 'AAC', votes: 7000, clicks: 35000 },
  { id: 'kiis', name: 'KIIS FM Los Angeles', country: 'USA', countryCode: 'US', genre: 'Top 40', streamUrl: 'https://stream.revma.ihrhls.com/zc1557', bitrate: 128, codec: 'AAC', votes: 6500, clicks: 32000 },
  { id: 'wbls', name: 'WBLS 107.5', country: 'USA', countryCode: 'US', genre: 'R&B/Soul', streamUrl: 'https://stream.revma.ihrhls.com/zc1913', bitrate: 128, codec: 'AAC', votes: 5000, clicks: 25000 },
  // USA - DI.fm Electronic
  { id: 'di-chillout', name: 'DI.fm Chillout', country: 'USA', countryCode: 'US', genre: 'Chillout', streamUrl: 'https://prem2.di.fm/chillout?listen_key=public', bitrate: 128, codec: 'AAC', votes: 4000, clicks: 20000 },
  { id: 'di-trance', name: 'DI.fm Trance', country: 'USA', countryCode: 'US', genre: 'Trance', streamUrl: 'https://prem2.di.fm/trance?listen_key=public', bitrate: 128, codec: 'AAC', votes: 3800, clicks: 19000 },
  { id: 'di-house', name: 'DI.fm House', country: 'USA', countryCode: 'US', genre: 'House', streamUrl: 'https://prem2.di.fm/house?listen_key=public', bitrate: 128, codec: 'AAC', votes: 3600, clicks: 18000 },
  { id: 'di-deephouse', name: 'DI.fm Deep House', country: 'USA', countryCode: 'US', genre: 'Deep House', streamUrl: 'https://prem2.di.fm/deephouse?listen_key=public', bitrate: 128, codec: 'AAC', votes: 3400, clicks: 17000 },
  { id: 'di-techno', name: 'DI.fm Techno', country: 'USA', countryCode: 'US', genre: 'Techno', streamUrl: 'https://prem2.di.fm/techno?listen_key=public', bitrate: 128, codec: 'AAC', votes: 3200, clicks: 16000 },
  { id: 'di-drumandbass', name: 'DI.fm Drum & Bass', country: 'USA', countryCode: 'US', genre: 'Drum & Bass', streamUrl: 'https://prem2.di.fm/drumandbass?listen_key=public', bitrate: 128, codec: 'AAC', votes: 3000, clicks: 15000 },
  { id: 'di-lounge', name: 'DI.fm Lounge', country: 'USA', countryCode: 'US', genre: 'Lounge', streamUrl: 'https://prem2.di.fm/lounge?listen_key=public', bitrate: 128, codec: 'AAC', votes: 2800, clicks: 14000 },
  { id: 'di-ambient', name: 'DI.fm Ambient', country: 'USA', countryCode: 'US', genre: 'Ambient', streamUrl: 'https://prem2.di.fm/ambient?listen_key=public', bitrate: 128, codec: 'AAC', votes: 2600, clicks: 13000 },
  // UK - BBC
  { id: 'bbc-radio1', name: 'BBC Radio 1', country: 'UK', countryCode: 'GB', genre: 'Pop/Dance', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one', bitrate: 128, codec: 'AAC', votes: 8500, clicks: 42000 },
  { id: 'bbc-radio2', name: 'BBC Radio 2', country: 'UK', countryCode: 'GB', genre: 'Pop/Adult', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_two', bitrate: 128, codec: 'AAC', votes: 8000, clicks: 40000 },
  { id: 'bbc-radio3', name: 'BBC Radio 3', country: 'UK', countryCode: 'GB', genre: 'Classical', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_three', bitrate: 320, codec: 'AAC', votes: 6000, clicks: 30000 },
  { id: 'bbc-radio4', name: 'BBC Radio 4', country: 'UK', countryCode: 'GB', genre: 'News/Talk', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm', bitrate: 128, codec: 'AAC', votes: 7000, clicks: 35000 },
  { id: 'bbc-radio6', name: 'BBC Radio 6 Music', country: 'UK', countryCode: 'GB', genre: 'Alternative', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_6music', bitrate: 128, codec: 'AAC', votes: 7500, clicks: 38000 },
  { id: 'bbc-1xtra', name: 'BBC Radio 1Xtra', country: 'UK', countryCode: 'GB', genre: 'Urban', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_1xtra', bitrate: 128, codec: 'AAC', votes: 5500, clicks: 28000 },
  { id: 'bbc-asian', name: 'BBC Asian Network', country: 'UK', countryCode: 'GB', genre: 'World', streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_asian_network', bitrate: 128, codec: 'AAC', votes: 4000, clicks: 20000 },
  // UK - Commercial
  { id: 'heart-uk', name: 'Heart UK', country: 'UK', countryCode: 'GB', genre: 'Pop', streamUrl: 'https://media-ice.musicradio.com/HeartUK', bitrate: 128, codec: 'AAC', votes: 5000, clicks: 25000 },
  { id: 'capital-uk', name: 'Capital FM', country: 'UK', countryCode: 'GB', genre: 'Pop/Dance', streamUrl: 'https://media-ice.musicradio.com/CapitalUK', bitrate: 128, codec: 'AAC', votes: 4800, clicks: 24000 },
  { id: 'kiss-uk', name: 'Kiss FM UK', country: 'UK', countryCode: 'GB', genre: 'Dance/Urban', streamUrl: 'https://edge-audio-03-gos2.sharp-stream.com/kissnational.mp3', bitrate: 128, codec: 'MP3', votes: 4500, clicks: 22000 },
  { id: 'classicfm', name: 'Classic FM', country: 'UK', countryCode: 'GB', genre: 'Classical', streamUrl: 'https://media-ice.musicradio.com/ClassicFM', bitrate: 128, codec: 'AAC', votes: 5500, clicks: 28000 },
  { id: 'absolute', name: 'Absolute Radio', country: 'UK', countryCode: 'GB', genre: 'Rock', streamUrl: 'https://icecast.thisisdax.com/AbsoluteRadio', bitrate: 128, codec: 'AAC', votes: 4200, clicks: 21000 },
  { id: 'absolute-80s', name: 'Absolute 80s', country: 'UK', countryCode: 'GB', genre: '80s', streamUrl: 'https://icecast.thisisdax.com/Absolute80s', bitrate: 128, codec: 'AAC', votes: 4000, clicks: 20000 },
  { id: 'absolute-90s', name: 'Absolute 90s', country: 'UK', countryCode: 'GB', genre: '90s', streamUrl: 'https://icecast.thisisdax.com/Absolute90s', bitrate: 128, codec: 'AAC', votes: 3800, clicks: 19000 },
  { id: 'jazzfm', name: 'Jazz FM', country: 'UK', countryCode: 'GB', genre: 'Jazz', streamUrl: 'https://edge-audio-03-gos2.sharp-stream.com/jazzfm.mp3', bitrate: 128, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'lbc', name: 'LBC', country: 'UK', countryCode: 'GB', genre: 'Talk', streamUrl: 'https://media-ice.musicradio.com/LBC', bitrate: 128, codec: 'AAC', votes: 4500, clicks: 22000 },
  // France - FIP & Radio France
  { id: 'fip', name: 'FIP France', country: 'France', countryCode: 'FR', genre: 'Eclectic', streamUrl: 'https://icecast.radiofrance.fr/fip-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 6500, clicks: 32000 },
  { id: 'fip-rock', name: 'FIP Rock', country: 'France', countryCode: 'FR', genre: 'Rock', streamUrl: 'https://icecast.radiofrance.fr/fiprock-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 4000, clicks: 20000 },
  { id: 'fip-jazz', name: 'FIP Jazz', country: 'France', countryCode: 'FR', genre: 'Jazz', streamUrl: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 4500, clicks: 22000 },
  { id: 'fip-electro', name: 'FIP Electro', country: 'France', countryCode: 'FR', genre: 'Electronic', streamUrl: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 3800, clicks: 19000 },
  { id: 'fip-world', name: 'FIP World', country: 'France', countryCode: 'FR', genre: 'World', streamUrl: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'fip-groove', name: 'FIP Groove', country: 'France', countryCode: 'FR', genre: 'Soul/Funk', streamUrl: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 3200, clicks: 16000 },
  { id: 'france-musique', name: 'France Musique', country: 'France', countryCode: 'FR', genre: 'Classical', streamUrl: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 5000, clicks: 25000 },
  { id: 'france-culture', name: 'France Culture', country: 'France', countryCode: 'FR', genre: 'Culture/Talk', streamUrl: 'https://icecast.radiofrance.fr/franceculture-midfi.mp3', bitrate: 128, codec: 'MP3', votes: 4500, clicks: 22000 },
  // Norway - NRK
  { id: 'nrk-p1', name: 'NRK P1', country: 'Norway', countryCode: 'NO', genre: 'Public Radio', streamUrl: 'https://lyd.nrk.no/nrk_radio_p1_oslo_mp3_h', bitrate: 192, codec: 'MP3', votes: 4000, clicks: 20000 },
  { id: 'nrk-p2', name: 'NRK P2', country: 'Norway', countryCode: 'NO', genre: 'Culture', streamUrl: 'https://lyd.nrk.no/nrk_radio_p2_mp3_h', bitrate: 192, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'nrk-p3', name: 'NRK P3', country: 'Norway', countryCode: 'NO', genre: 'Pop/Youth', streamUrl: 'https://lyd.nrk.no/nrk_radio_p3_mp3_h', bitrate: 192, codec: 'MP3', votes: 5000, clicks: 25000 },
  { id: 'nrk-klassisk', name: 'NRK Klassisk', country: 'Norway', countryCode: 'NO', genre: 'Classical', streamUrl: 'https://lyd.nrk.no/nrk_radio_klassisk_mp3_h', bitrate: 192, codec: 'MP3', votes: 3000, clicks: 15000 },
  { id: 'nrk-jazz', name: 'NRK Jazz', country: 'Norway', countryCode: 'NO', genre: 'Jazz', streamUrl: 'https://lyd.nrk.no/nrk_radio_jazz_mp3_h', bitrate: 192, codec: 'MP3', votes: 2800, clicks: 14000 },
  // Germany
  { id: 'wdr-cosmo', name: 'WDR COSMO', country: 'Germany', countryCode: 'DE', genre: 'World', streamUrl: 'https://wdr-cosmo-live.icecast.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3', bitrate: 128, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'wdr-1live', name: 'WDR 1LIVE', country: 'Germany', countryCode: 'DE', genre: 'Pop', streamUrl: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3', bitrate: 128, codec: 'MP3', votes: 4000, clicks: 20000 },
  { id: 'br-klassik', name: 'BR-KLASSIK', country: 'Germany', countryCode: 'DE', genre: 'Classical', streamUrl: 'https://dispatcher.rndfnk.com/br/brklassik/live/mp3/mid', bitrate: 128, codec: 'MP3', votes: 3200, clicks: 16000 },
  { id: 'flux-fm', name: 'FluxFM', country: 'Germany', countryCode: 'DE', genre: 'Alternative', streamUrl: 'https://fluxfm.streamabc.net/flx-fluxfm-mp3-128-3618489', bitrate: 128, codec: 'MP3', votes: 3000, clicks: 15000 },
  // Switzerland
  { id: 'radio-swiss-jazz', name: 'Radio Swiss Jazz', country: 'Switzerland', countryCode: 'CH', genre: 'Jazz', streamUrl: 'https://stream.srg-ssr.ch/m/rsj/mp3_128', bitrate: 128, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'radio-swiss-classic', name: 'Radio Swiss Classic', country: 'Switzerland', countryCode: 'CH', genre: 'Classical', streamUrl: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128', bitrate: 128, codec: 'MP3', votes: 3200, clicks: 16000 },
  { id: 'radio-swiss-pop', name: 'Radio Swiss Pop', country: 'Switzerland', countryCode: 'CH', genre: 'Pop', streamUrl: 'https://stream.srg-ssr.ch/m/rsp/mp3_128', bitrate: 128, codec: 'MP3', votes: 3000, clicks: 15000 },
  // Netherlands
  { id: 'radio-1-nl', name: 'NPO Radio 1', country: 'Netherlands', countryCode: 'NL', genre: 'News/Talk', streamUrl: 'https://icecast.omroep.nl/radio1-bb-mp3', bitrate: 192, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'radio-2-nl', name: 'NPO Radio 2', country: 'Netherlands', countryCode: 'NL', genre: 'Pop', streamUrl: 'https://icecast.omroep.nl/radio2-bb-mp3', bitrate: 192, codec: 'MP3', votes: 4000, clicks: 20000 },
  { id: '3fm-nl', name: 'NPO 3FM', country: 'Netherlands', countryCode: 'NL', genre: 'Alternative', streamUrl: 'https://icecast.omroep.nl/3fm-bb-mp3', bitrate: 192, codec: 'MP3', votes: 3800, clicks: 19000 },
  { id: 'radio-4-nl', name: 'NPO Radio 4', country: 'Netherlands', countryCode: 'NL', genre: 'Classical', streamUrl: 'https://icecast.omroep.nl/radio4-bb-mp3', bitrate: 192, codec: 'MP3', votes: 3000, clicks: 15000 },
  // Australia
  { id: 'triplej', name: 'Triple J', country: 'Australia', countryCode: 'AU', genre: 'Alternative', streamUrl: 'https://live-radio01.mediahubaustralia.com/2TJW/mp3/', bitrate: 96, codec: 'MP3', votes: 5000, clicks: 25000 },
  { id: 'triplej-unearthed', name: 'Triple J Unearthed', country: 'Australia', countryCode: 'AU', genre: 'Indie', streamUrl: 'https://live-radio01.mediahubaustralia.com/XJUW/mp3/', bitrate: 96, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'abc-classic', name: 'ABC Classic', country: 'Australia', countryCode: 'AU', genre: 'Classical', streamUrl: 'https://live-radio01.mediahubaustralia.com/2FMW/mp3/', bitrate: 96, codec: 'MP3', votes: 3000, clicks: 15000 },
  { id: 'abc-jazz', name: 'ABC Jazz', country: 'Australia', countryCode: 'AU', genre: 'Jazz', streamUrl: 'https://live-radio01.mediahubaustralia.com/JAZW/mp3/', bitrate: 96, codec: 'MP3', votes: 2800, clicks: 14000 },
  // Ireland
  { id: 'rte-radio1', name: 'RTÉ Radio 1', country: 'Ireland', countryCode: 'IE', genre: 'Public Radio', streamUrl: 'https://icecast.rte.ie/radio1', bitrate: 128, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'rte-2fm', name: 'RTÉ 2FM', country: 'Ireland', countryCode: 'IE', genre: 'Pop', streamUrl: 'https://icecast.rte.ie/2fm', bitrate: 128, codec: 'MP3', votes: 3000, clicks: 15000 },
  { id: 'rte-lyric', name: 'RTÉ Lyric FM', country: 'Ireland', countryCode: 'IE', genre: 'Classical', streamUrl: 'https://icecast.rte.ie/lyric', bitrate: 128, codec: 'MP3', votes: 2500, clicks: 12000 },
  // Italy
  { id: 'rai-radio1', name: 'Rai Radio 1', country: 'Italy', countryCode: 'IT', genre: 'Public Radio', streamUrl: 'https://icestreaming.rai.it/1.mp3', bitrate: 128, codec: 'MP3', votes: 3500, clicks: 17000 },
  { id: 'rai-radio2', name: 'Rai Radio 2', country: 'Italy', countryCode: 'IT', genre: 'Pop', streamUrl: 'https://icestreaming.rai.it/2.mp3', bitrate: 128, codec: 'MP3', votes: 3000, clicks: 15000 },
  { id: 'rai-radio3', name: 'Rai Radio 3', country: 'Italy', countryCode: 'IT', genre: 'Classical', streamUrl: 'https://icestreaming.rai.it/3.mp3', bitrate: 128, codec: 'MP3', votes: 2500, clicks: 12000 },
  // New Zealand
  { id: 'radio-nz', name: 'Radio New Zealand National', country: 'New Zealand', countryCode: 'NZ', genre: 'Public Radio', streamUrl: 'https://radionz-stream.rnz.co.nz/rnz_national.mp3', bitrate: 128, codec: 'MP3', votes: 3000, clicks: 15000 },
  { id: 'radio-nz-concert', name: 'RNZ Concert', country: 'New Zealand', countryCode: 'NZ', genre: 'Classical', streamUrl: 'https://radionz-stream.rnz.co.nz/rnz_concert.mp3', bitrate: 128, codec: 'MP3', votes: 2500, clicks: 12000 },
];

const ALLOWED_STATIONS: Record<string, string> = {
  // SomaFM
  'somafm-groovesalad': 'https://ice1.somafm.com/groovesalad-256-mp3',
  'somafm-dronezone': 'https://ice1.somafm.com/dronezone-256-mp3',
  'somafm-secretagent': 'https://ice1.somafm.com/secretagent-256-mp3',
  'somafm-indiepop': 'https://ice1.somafm.com/indiepop-256-mp3',
  'somafm-beatblender': 'https://ice1.somafm.com/beatblender-256-mp3',
  'somafm-defcon': 'https://ice1.somafm.com/defcon-256-mp3',
  'somafm-sonicuniverse': 'https://ice1.somafm.com/sonicuniverse-256-mp3',
  'somafm-7soul': 'https://ice1.somafm.com/7soul-256-mp3',
  'somafm-lush': 'https://ice1.somafm.com/lush-256-mp3',
  'somafm-metal': 'https://ice1.somafm.com/metal-256-mp3',
  'somafm-folkfwd': 'https://ice1.somafm.com/folkfwd-256-mp3',
  'somafm-bootliquor': 'https://ice1.somafm.com/bootliquor-256-mp3',
  'somafm-spacestation': 'https://ice1.somafm.com/spacestation-256-mp3',
  'somafm-thetrip': 'https://ice1.somafm.com/thetrip-256-mp3',
  'somafm-poptron': 'https://ice1.somafm.com/poptron-256-mp3',
  'somafm-covers': 'https://ice1.somafm.com/covers-256-mp3',
  'somafm-seventies': 'https://ice1.somafm.com/seventies-256-mp3',
  'somafm-underground80s': 'https://ice1.somafm.com/u80s-256-mp3',
  'somafm-suburbs': 'https://ice1.somafm.com/suburbsofgoa-256-mp3',
  'somafm-bagel': 'https://ice1.somafm.com/bagel-256-mp3',
  'somafm-cliqhop': 'https://ice1.somafm.com/cliqhop-256-mp3',
  // Radio Paradise
  'radio-paradise': 'https://stream.radioparadise.com/aac-320',
  'radio-paradise-mellow': 'https://stream.radioparadise.com/mellow-320',
  'radio-paradise-rock': 'https://stream.radioparadise.com/rock-320',
  'radio-paradise-world': 'https://stream.radioparadise.com/world-etc-320',
  // USA Public Radio
  'npr-1': 'https://npr-ice.streamguys1.com/live.mp3',
  'kexp': 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3',
  'kcrw': 'https://kcrw.streamguys1.com/kcrw_192k_mp3_e24',
  'kcrw-main': 'https://kcrw.streamguys1.com/kcrw_192k_mp3_live',
  'wbgo': 'https://wbgo.streamguys1.com/wbgo128',
  'kjazz': 'https://kjazz.streamguys1.com/kjzz.mp3',
  'kusc': 'https://kusc.streamguys1.com/kusc-128k.mp3',
  'wnyc-fm': 'https://fm939.wnyc.org/wnycfm',
  'wqxr': 'https://stream.wqxr.org/wqxr',
  // USA Commercial
  'kroq': 'https://stream.revma.ihrhls.com/zc1465',
  'hot97': 'https://stream.revma.ihrhls.com/zc1289',
  'power106': 'https://stream.revma.ihrhls.com/zc1561',
  'z100': 'https://stream.revma.ihrhls.com/zc1281',
  'kiis': 'https://stream.revma.ihrhls.com/zc1557',
  'wbls': 'https://stream.revma.ihrhls.com/zc1913',
  // DI.fm
  'di-chillout': 'https://prem2.di.fm/chillout?listen_key=public',
  'di-trance': 'https://prem2.di.fm/trance?listen_key=public',
  'di-house': 'https://prem2.di.fm/house?listen_key=public',
  'di-deephouse': 'https://prem2.di.fm/deephouse?listen_key=public',
  'di-techno': 'https://prem2.di.fm/techno?listen_key=public',
  'di-drumandbass': 'https://prem2.di.fm/drumandbass?listen_key=public',
  'di-lounge': 'https://prem2.di.fm/lounge?listen_key=public',
  'di-ambient': 'https://prem2.di.fm/ambient?listen_key=public',
  // BBC
  'bbc-radio1': 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one',
  'bbc-radio2': 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_two',
  'bbc-radio3': 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_three',
  'bbc-radio4': 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm',
  'bbc-radio6': 'https://stream.live.vc.bbcmedia.co.uk/bbc_6music',
  'bbc-1xtra': 'https://stream.live.vc.bbcmedia.co.uk/bbc_1xtra',
  'bbc-asian': 'https://stream.live.vc.bbcmedia.co.uk/bbc_asian_network',
  // UK Commercial
  'heart-uk': 'https://media-ice.musicradio.com/HeartUK',
  'capital-uk': 'https://media-ice.musicradio.com/CapitalUK',
  'kiss-uk': 'https://edge-audio-03-gos2.sharp-stream.com/kissnational.mp3',
  'classicfm': 'https://media-ice.musicradio.com/ClassicFM',
  'absolute': 'https://icecast.thisisdax.com/AbsoluteRadio',
  'absolute-80s': 'https://icecast.thisisdax.com/Absolute80s',
  'absolute-90s': 'https://icecast.thisisdax.com/Absolute90s',
  'jazzfm': 'https://edge-audio-03-gos2.sharp-stream.com/jazzfm.mp3',
  'lbc': 'https://media-ice.musicradio.com/LBC',
  // France
  'fip': 'https://icecast.radiofrance.fr/fip-midfi.mp3',
  'fip-rock': 'https://icecast.radiofrance.fr/fiprock-midfi.mp3',
  'fip-jazz': 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3',
  'fip-electro': 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3',
  'fip-world': 'https://icecast.radiofrance.fr/fipworld-midfi.mp3',
  'fip-groove': 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3',
  'france-musique': 'https://icecast.radiofrance.fr/francemusique-midfi.mp3',
  'france-culture': 'https://icecast.radiofrance.fr/franceculture-midfi.mp3',
  // Norway
  'nrk-p1': 'https://lyd.nrk.no/nrk_radio_p1_oslo_mp3_h',
  'nrk-p2': 'https://lyd.nrk.no/nrk_radio_p2_mp3_h',
  'nrk-p3': 'https://lyd.nrk.no/nrk_radio_p3_mp3_h',
  'nrk-klassisk': 'https://lyd.nrk.no/nrk_radio_klassisk_mp3_h',
  'nrk-jazz': 'https://lyd.nrk.no/nrk_radio_jazz_mp3_h',
  // Germany
  'wdr-cosmo': 'https://wdr-cosmo-live.icecast.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3',
  'wdr-1live': 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3',
  'br-klassik': 'https://dispatcher.rndfnk.com/br/brklassik/live/mp3/mid',
  'flux-fm': 'https://fluxfm.streamabc.net/flx-fluxfm-mp3-128-3618489',
  // Switzerland
  'radio-swiss-jazz': 'https://stream.srg-ssr.ch/m/rsj/mp3_128',
  'radio-swiss-classic': 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128',
  'radio-swiss-pop': 'https://stream.srg-ssr.ch/m/rsp/mp3_128',
  // Netherlands
  'radio-1-nl': 'https://icecast.omroep.nl/radio1-bb-mp3',
  'radio-2-nl': 'https://icecast.omroep.nl/radio2-bb-mp3',
  '3fm-nl': 'https://icecast.omroep.nl/3fm-bb-mp3',
  'radio-4-nl': 'https://icecast.omroep.nl/radio4-bb-mp3',
  // Australia
  'triplej': 'https://live-radio01.mediahubaustralia.com/2TJW/mp3/',
  'triplej-unearthed': 'https://live-radio01.mediahubaustralia.com/XJUW/mp3/',
  'abc-classic': 'https://live-radio01.mediahubaustralia.com/2FMW/mp3/',
  'abc-jazz': 'https://live-radio01.mediahubaustralia.com/JAZW/mp3/',
  // Ireland
  'rte-radio1': 'https://icecast.rte.ie/radio1',
  'rte-2fm': 'https://icecast.rte.ie/2fm',
  'rte-lyric': 'https://icecast.rte.ie/lyric',
  // Italy
  'rai-radio1': 'https://icestreaming.rai.it/1.mp3',
  'rai-radio2': 'https://icestreaming.rai.it/2.mp3',
  'rai-radio3': 'https://icestreaming.rai.it/3.mp3',
  // New Zealand
  'radio-nz': 'https://radionz-stream.rnz.co.nz/rnz_national.mp3',
  'radio-nz-concert': 'https://radionz-stream.rnz.co.nz/rnz_concert.mp3',
};

const activeStreams = new Map<string, number>();
const MAX_CONCURRENT_STREAMS = 100;

// Get all stations from radio-browser.info API
router.get('/browse', async (req: Request, res: Response) => {
  try {
    const { country, genre, search, limit = '500', offset = '0' } = req.query;
    
    let stations = await getStations();
    
    // Apply filters
    if (country && typeof country === 'string') {
      stations = stations.filter(s => 
        s.country.toLowerCase().includes(country.toLowerCase()) ||
        s.countryCode.toLowerCase() === country.toLowerCase()
      );
    }
    
    if (genre && typeof genre === 'string') {
      stations = stations.filter(s => 
        s.genre.toLowerCase().includes(genre.toLowerCase())
      );
    }
    
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      stations = stations.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.genre.toLowerCase().includes(searchLower) ||
        s.country.toLowerCase().includes(searchLower)
      );
    }
    
    const total = stations.length;
    const limitNum = Math.min(parseInt(limit as string) || 500, 1000);
    const offsetNum = parseInt(offset as string) || 0;
    
    stations = stations.slice(offsetNum, offsetNum + limitNum);
    
    // Get unique genres and countries for filters
    const allStations = await getStations();
    const genres = [...new Set(allStations.map(s => s.genre))].filter(Boolean).sort();
    const countries = [...new Set(allStations.map(s => s.country))].filter(Boolean).sort();
    
    res.json({
      stations,
      total,
      limit: limitNum,
      offset: offsetNum,
      filters: { genres, countries },
      cached: cacheTimestamp > 0,
      cacheAge: cacheTimestamp > 0 ? Math.floor((Date.now() - cacheTimestamp) / 1000) : 0,
    });
  } catch (err: any) {
    logger.error('[RadioBrowser] Browse failed:', err.message);
    
    // Return fallback stations on error
    res.json({
      stations: FALLBACK_STATIONS,
      total: FALLBACK_STATIONS.length,
      limit: FALLBACK_STATIONS.length,
      offset: 0,
      filters: { 
        genres: [...new Set(FALLBACK_STATIONS.map(s => s.genre))],
        countries: [...new Set(FALLBACK_STATIONS.map(s => s.country))]
      },
      cached: false,
      error: 'Using fallback stations',
    });
  }
});

// Search stations by name
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, limit = '50' } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }
    
    const stations = await getStations();
    const searchLower = q.toLowerCase();
    
    const results = stations
      .filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.genre.toLowerCase().includes(searchLower)
      )
      .slice(0, parseInt(limit as string) || 50);
    
    res.json({ stations: results, total: results.length });
  } catch (err: any) {
    logger.error('[RadioBrowser] Search failed:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get stream URL by station ID (for dynamic stations from API)
router.get('/stream/:stationId', async (req: Request, res: Response) => {
  const { stationId } = req.params;
  
  // Check static allowed stations first
  if (ALLOWED_STATIONS[stationId]) {
    return res.json({ streamUrl: ALLOWED_STATIONS[stationId] });
  }
  
  // Search in cached API stations
  try {
    const stations = await getStations();
    const station = stations.find(s => s.id === stationId);
    
    if (station) {
      return res.json({ streamUrl: station.streamUrl });
    }
    
    res.status(404).json({ error: 'Station not found' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get stream URL' });
  }
});

router.get('/proxy/:stationId', async (req: Request, res: Response) => {
  const { stationId } = req.params;
  let streamUrl = ALLOWED_STATIONS[stationId];
  
  // If not in static list, try to find in cached API stations
  if (!streamUrl) {
    try {
      const stations = await getStations();
      const station = stations.find(s => s.id === stationId);
      if (station) {
        streamUrl = station.streamUrl;
      }
    } catch {
      // Ignore errors, will return 404 below
    }
  }
  
  if (!streamUrl) {
    logger.warn(`[RadioProxy] Unknown station: ${stationId}`);
    return res.status(404).json({ error: 'Station not found' });
  }
  
  if (activeStreams.size >= MAX_CONCURRENT_STREAMS) {
    logger.warn('[RadioProxy] Max concurrent streams reached');
    return res.status(503).json({ error: 'Too many active streams' });
  }
  
  const clientId = `${req.ip}-${Date.now()}`;
  activeStreams.set(clientId, Date.now());
  
  logger.info(`[RadioProxy] Starting stream for ${stationId} (active: ${activeStreams.size})`);
  
  try {
    const response = await axios.get(streamUrl, {
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Atlas/1.0 (Radio Player)',
        'Accept': '*/*',
      },
    });
    
    const contentType = response.headers['content-type'] || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    response.data.pipe(res);
    
    req.on('close', () => {
      activeStreams.delete(clientId);
      logger.info(`[RadioProxy] Stream closed for ${stationId} (active: ${activeStreams.size})`);
      response.data.destroy();
    });
    
    response.data.on('error', (err: Error) => {
      activeStreams.delete(clientId);
      logger.error(`[RadioProxy] Stream error for ${stationId}: ${err.message}`);
    });
    
  } catch (err: any) {
    activeStreams.delete(clientId);
    logger.error(`[RadioProxy] Failed to connect to ${stationId}:`, err.message);
    res.status(502).json({ error: 'Failed to connect to stream' });
  }
});

router.get('/stations', (req: Request, res: Response) => {
  res.json({
    stations: Object.keys(ALLOWED_STATIONS),
    activeStreams: activeStreams.size,
    maxStreams: MAX_CONCURRENT_STREAMS,
  });
});

// Force refresh the stations cache
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    cacheTimestamp = 0; // Force cache invalidation
    const stations = await getStations();
    res.json({ 
      success: true, 
      count: stations.length,
      message: `Refreshed ${stations.length} stations from radio-browser.info`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to refresh stations' });
  }
});

export default router;
