import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { tvFavorites } from '@shared/schema';
import { eq, and, ilike, or } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'tv-app' });
const router = Router();

interface Channel {
  id: string;
  name: string;
  category: string;
  region: string;
  logo: string | null;
  streamUrl: string | null;
  provider: string;
}

interface EPGProgram {
  title: string;
  start: string;
  stop: string;
  description?: string;
  category?: string;
}

interface EPGChannel {
  id: string;
  name: string;
  programs: EPGProgram[];
}

interface EPGGuide {
  channel: string;
  site: string;
  lang: string;
  url: string;
}

const CHANNELS: Channel[] = [];
let lastFetch = 0;
const CACHE_TTL = 30 * 60 * 1000;

const EPG_CACHE: Map<string, { programs: EPGProgram[]; fetchedAt: number }> = new Map();
const EPG_GUIDES: EPGGuide[] = [];
let epgGuidesLastFetch = 0;
const EPG_CACHE_TTL = 60 * 60 * 1000;

const M3U_SOURCES = [
  'https://iptv-org.github.io/iptv/index.m3u',
  'https://iptv-org.github.io/iptv/countries/us.m3u',
  'https://iptv-org.github.io/iptv/countries/gb.m3u',
];

function parseM3U(m3uText: string, sourceUrl: string): Channel[] {
  const lines = m3uText.split(/\r?\n/);
  const entries: Channel[] = [];
  let current: Partial<Channel> | null = null;

  for (const line of lines) {
    const l = line.trim();
    if (!l || l.startsWith('#EXTM3U')) continue;

    if (l.startsWith('#EXTINF')) {
      current = { provider: new URL(sourceUrl).hostname };
      const nameMatch = l.split(',').pop();
      current.name = nameMatch?.trim() || 'Unknown';

      const logoMatch = l.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) current.logo = logoMatch[1];

      const groupMatch = l.match(/group-title="([^"]+)"/);
      current.category = groupMatch ? groupMatch[1] : 'General';

      const countryMatch = l.match(/tvg-country="([^"]+)"/);
      current.region = countryMatch ? countryMatch[1] : 'Global';
    } else if (!l.startsWith('#') && current) {
      current.streamUrl = l;
      current.id = Buffer.from(`${current.name}-${current.provider}-${l}`).toString('base64').slice(0, 32);
      entries.push(current as Channel);
      current = null;
    }
  }
  return entries;
}

async function loadChannels(): Promise<void> {
  if (Date.now() - lastFetch < CACHE_TTL && CHANNELS.length > 0) {
    return;
  }

  logger.info('Loading TV channels from IPTV sources...');
  CHANNELS.length = 0;

  for (const sourceUrl of M3U_SOURCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(sourceUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Atlas-TV-App/1.0' }
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        logger.warn(`Failed to fetch M3U source: ${sourceUrl} (${res.status})`);
        continue;
      }
      
      const m3uText = await res.text();
      const parsed = parseM3U(m3uText, sourceUrl);
      CHANNELS.push(...parsed);
      logger.info(`Parsed M3U source: ${sourceUrl} (${parsed.length} channels)`);
    } catch (err) {
      logger.error(`Error loading M3U source: ${sourceUrl}`, err instanceof Error ? err : undefined);
    }
  }

  const seen = new Set<string>();
  const deduped: Channel[] = [];
  for (const ch of CHANNELS) {
    const key = `${ch.name.toLowerCase()}:${ch.streamUrl}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ch);
    }
  }
  CHANNELS.length = 0;
  CHANNELS.push(...deduped);
  lastFetch = Date.now();
  logger.info(`TV channels loaded and deduplicated: ${CHANNELS.length} total`);
}

function getWallet(req: Request): string {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet) throw new Error('Missing wallet identity header');
  return wallet.toLowerCase();
}

router.get('/channels', async (req: Request, res: Response) => {
  try {
    await loadChannels();
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const channels = CHANNELS.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    const hasMore = nextOffset < CHANNELS.length;
    
    res.json({
      channels,
      total: CHANNELS.length,
      limit,
      offset,
      hasMore,
      nextOffset: hasMore ? nextOffset : null,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error('Failed to list channels', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to list channels',
      receipt: { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
    });
  }
});

router.get('/channels/search', async (req: Request, res: Response) => {
  try {
    await loadChannels();
    const { q, category, region } = req.query;
    const ql = q ? (q as string).toLowerCase() : null;

    let filtered = CHANNELS.filter(ch => {
      const okQ = ql ? ch.name.toLowerCase().includes(ql) : true;
      const okC = category ? ch.category.toLowerCase() === (category as string).toLowerCase() : true;
      const okR = region ? ch.region.toLowerCase() === (region as string).toLowerCase() : true;
      return okQ && okC && okR;
    });

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    filtered = filtered.slice(0, limit);

    res.json({
      channels: filtered,
      count: filtered.length,
      receipt: { status: filtered.length ? 'success' : 'empty', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error('Search failed', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Search failed',
      receipt: { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
    });
  }
});

router.get('/channels/categories', async (req: Request, res: Response) => {
  try {
    await loadChannels();
    const categories = [...new Set(CHANNELS.map(ch => ch.category))].sort();
    res.json({
      categories,
      count: categories.length,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to get categories',
      receipt: { status: 'error' }
    });
  }
});

router.post('/play', async (req: Request, res: Response) => {
  try {
    await loadChannels();
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ error: 'Missing channelId', receipt: { status: 'error' } });
    }

    const channel = CHANNELS.find(c => c.id === channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found', receipt: { status: 'error' } });
    }

    if (!channel.streamUrl) {
      return res.status(502).json({ error: 'No stream URL available', receipt: { status: 'error' } });
    }

    res.json({
      streamUrl: channel.streamUrl,
      channel: {
        id: channel.id,
        name: channel.name,
        logo: channel.logo,
        category: channel.category
      },
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error('Playback resolution failed', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Playback resolution failed',
      receipt: { status: 'error', message: err instanceof Error ? err.message : 'Unknown error' }
    });
  }
});

router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    const favorites = await db.select().from(tvFavorites).where(eq(tvFavorites.walletAddress, wallet));
    
    res.json({
      favorites: favorites.map(f => ({
        id: f.channelId,
        name: f.channelName,
        logo: f.channelLogo,
        category: f.channelCategory,
        addedAt: f.addedAt
      })),
      count: favorites.length,
      receipt: { status: favorites.length ? 'success' : 'empty', timestamp: Date.now() }
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('wallet')) {
      return res.status(401).json({ error: err.message, receipt: { status: 'error' } });
    }
    logger.error('Failed to get favorites', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to get favorites',
      receipt: { status: 'error' }
    });
  }
});

router.post('/favorites', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    const { channelId } = req.body;
    
    await loadChannels();
    const channel = CHANNELS.find(c => c.id === channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found', receipt: { status: 'error' } });
    }

    const existing = await db.select().from(tvFavorites).where(
      and(eq(tvFavorites.walletAddress, wallet), eq(tvFavorites.channelId, channelId))
    );

    if (existing.length > 0) {
      return res.json({ receipt: { status: 'success', message: 'Already in favorites' } });
    }

    await db.insert(tvFavorites).values({
      walletAddress: wallet,
      channelId: channel.id,
      channelName: channel.name,
      channelLogo: channel.logo,
      channelCategory: channel.category
    });

    res.json({ receipt: { status: 'success', timestamp: Date.now() } });
  } catch (err) {
    if (err instanceof Error && err.message.includes('wallet')) {
      return res.status(401).json({ error: err.message, receipt: { status: 'error' } });
    }
    logger.error('Failed to add favorite', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to add favorite',
      receipt: { status: 'error' }
    });
  }
});

router.delete('/favorites/:channelId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    const { channelId } = req.params;

    await db.delete(tvFavorites).where(
      and(eq(tvFavorites.walletAddress, wallet), eq(tvFavorites.channelId, channelId))
    );

    res.json({ receipt: { status: 'success', timestamp: Date.now() } });
  } catch (err) {
    if (err instanceof Error && err.message.includes('wallet')) {
      return res.status(401).json({ error: err.message, receipt: { status: 'error' } });
    }
    logger.error('Failed to remove favorite', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to remove favorite',
      receipt: { status: 'error' }
    });
  }
});

async function loadEPGGuides(): Promise<void> {
  if (Date.now() - epgGuidesLastFetch < EPG_CACHE_TTL && EPG_GUIDES.length > 0) {
    return;
  }

  logger.info('Loading EPG guides from IPTV-org...');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const res = await fetch('https://iptv-org.github.io/api/guides.json', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Atlas-TV-App/1.0' }
    });
    clearTimeout(timeout);
    
    if (!res.ok) {
      logger.warn(`Failed to fetch EPG guides: ${res.status}`);
      return;
    }
    
    const rawGuides: Array<{ channel: string | null; site: string; lang: string }> = await res.json();
    EPG_GUIDES.length = 0;
    
    for (const guide of rawGuides) {
      if (guide.channel && guide.site) {
        EPG_GUIDES.push({
          channel: guide.channel,
          site: guide.site,
          lang: guide.lang || 'en',
          url: `https://iptv-org.github.io/epg/guides/${guide.site}/${guide.channel}.xml`
        });
      }
    }
    
    epgGuidesLastFetch = Date.now();
    logger.info(`Loaded ${EPG_GUIDES.length} EPG guide sources`);
  } catch (err) {
    logger.error('Error loading EPG guides', err instanceof Error ? err : undefined);
  }
}

function findEPGGuide(channelName: string, channelId: string): EPGGuide | null {
  const normalizedName = channelName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const guide of EPG_GUIDES) {
    const guideChannelNorm = guide.channel.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (guideChannelNorm === normalizedName || guide.channel === channelId) {
      return guide;
    }
  }
  
  for (const guide of EPG_GUIDES) {
    const guideChannelNorm = guide.channel.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (guideChannelNorm.includes(normalizedName) || normalizedName.includes(guideChannelNorm)) {
      return guide;
    }
  }
  
  return null;
}

async function fetchEPGData(channelId: string, channelName: string): Promise<EPGProgram[]> {
  const cacheKey = channelId;
  const cached = EPG_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < EPG_CACHE_TTL) {
    return cached.programs;
  }

  await loadEPGGuides();
  
  const guide = findEPGGuide(channelName, channelId);
  if (!guide) {
    EPG_CACHE.set(cacheKey, { programs: [], fetchedAt: Date.now() });
    return [];
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const res = await fetch(guide.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Atlas-TV-App/1.0' }
    });
    clearTimeout(timeout);
    
    if (!res.ok) {
      EPG_CACHE.set(cacheKey, { programs: [], fetchedAt: Date.now() });
      return [];
    }
    
    const xmlText = await res.text();
    const programs = parseEPGXml(xmlText, guide.channel);
    
    EPG_CACHE.set(cacheKey, { programs, fetchedAt: Date.now() });
    return programs;
  } catch (err) {
    logger.error(`Error fetching EPG for ${channelName}`, err instanceof Error ? err : undefined);
    EPG_CACHE.set(cacheKey, { programs: [], fetchedAt: Date.now() });
    return [];
  }
}

function parseEPGXml(xmlText: string, targetChannel: string): EPGProgram[] {
  const programs: EPGProgram[] = [];
  const now = new Date();
  
  const programmeRegex = /<programme[^>]*channel="([^"]*)"[^>]*start="([^"]*)"[^>]*stop="([^"]*)"[^>]*>([\s\S]*?)<\/programme>/gi;
  const titleRegex = /<title[^>]*>([^<]*)<\/title>/i;
  const descRegex = /<desc[^>]*>([^<]*)<\/desc>/i;
  const categoryRegex = /<category[^>]*>([^<]*)<\/category>/i;
  
  let match;
  while ((match = programmeRegex.exec(xmlText)) !== null) {
    const [, channel, startStr, stopStr, content] = match;
    
    if (channel.toLowerCase() !== targetChannel.toLowerCase()) continue;
    
    const start = parseEPGDate(startStr);
    const stop = parseEPGDate(stopStr);
    
    if (stop < now) continue;
    
    const titleMatch = content.match(titleRegex);
    const descMatch = content.match(descRegex);
    const categoryMatch = content.match(categoryRegex);
    
    programs.push({
      title: titleMatch ? titleMatch[1].trim() : 'Unknown Program',
      start: start.toISOString(),
      stop: stop.toISOString(),
      description: descMatch ? descMatch[1].trim() : undefined,
      category: categoryMatch ? categoryMatch[1].trim() : undefined
    });
  }
  
  programs.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  return programs.slice(0, 10);
}

function parseEPGDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/);
  if (!match) return new Date();
  
  const [, year, month, day, hour, min, sec, tz] = match;
  let isoStr = `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  
  if (tz) {
    isoStr += `${tz.slice(0, 3)}:${tz.slice(3)}`;
  } else {
    isoStr += 'Z';
  }
  
  return new Date(isoStr);
}

router.get('/epg', async (req: Request, res: Response) => {
  try {
    await loadEPGGuides();
    
    res.json({
      guideCount: EPG_GUIDES.length,
      cacheSize: EPG_CACHE.size,
      lastUpdate: epgGuidesLastFetch,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error('Failed to get EPG info', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to get EPG info',
      receipt: { status: 'error' }
    });
  }
});

router.get('/epg/:channelId', async (req: Request, res: Response) => {
  try {
    await loadChannels();
    const { channelId } = req.params;
    
    const channel = CHANNELS.find(c => c.id === channelId);
    if (!channel) {
      return res.status(404).json({ 
        error: 'Channel not found', 
        programs: [],
        receipt: { status: 'error' } 
      });
    }
    
    const programs = await fetchEPGData(channelId, channel.name);
    const now = new Date();
    
    const nowPlaying = programs.find(p => {
      const start = new Date(p.start);
      const stop = new Date(p.stop);
      return start <= now && stop > now;
    });
    
    const upNext = programs.find(p => {
      const start = new Date(p.start);
      return start > now;
    });
    
    res.json({
      channelId,
      channelName: channel.name,
      nowPlaying: nowPlaying || null,
      upNext: upNext || null,
      programs: programs.slice(0, 5),
      hasEPG: programs.length > 0,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error('Failed to get EPG for channel', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to get EPG data',
      programs: [],
      receipt: { status: 'error' }
    });
  }
});

router.post('/epg/batch', async (req: Request, res: Response) => {
  try {
    await loadChannels();
    const { channelIds } = req.body;
    
    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({ 
        error: 'channelIds must be a non-empty array',
        receipt: { status: 'error' } 
      });
    }
    
    const limitedIds = channelIds.slice(0, 20);
    const results: Record<string, any> = {};
    
    await Promise.all(limitedIds.map(async (channelId: string) => {
      const channel = CHANNELS.find(c => c.id === channelId);
      if (!channel) {
        results[channelId] = { hasEPG: false, nowPlaying: null, upNext: null };
        return;
      }
      
      const programs = await fetchEPGData(channelId, channel.name);
      const now = new Date();
      
      const nowPlaying = programs.find(p => {
        const start = new Date(p.start);
        const stop = new Date(p.stop);
        return start <= now && stop > now;
      });
      
      const upNext = programs.find(p => {
        const start = new Date(p.start);
        return start > now;
      });
      
      results[channelId] = {
        hasEPG: programs.length > 0,
        nowPlaying: nowPlaying || null,
        upNext: upNext || null
      };
    }));
    
    res.json({
      epg: results,
      count: Object.keys(results).length,
      receipt: { status: 'success', timestamp: Date.now() }
    });
  } catch (err) {
    logger.error('Failed to get batch EPG', err instanceof Error ? err : undefined);
    res.status(500).json({
      error: 'Failed to get batch EPG data',
      epg: {},
      receipt: { status: 'error' }
    });
  }
});

export default router;
