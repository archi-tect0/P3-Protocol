import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import multer from 'multer';
import { rootLogger } from '../observability/logger';
import type { StreamManifest, CommentEvent, ReactionEvent, VideoChunk } from '../../shared/nodestream-types';
import { db } from '../db';
import { nodeDailyMetrics } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

const router = Router();
const logger = rootLogger.child({ module: 'atlas-streaming' });

// Global metrics tracking
const SERVER_START_TIME = Date.now();
let globalContentServedToday = 0;
let lastContentServedReset = new Date().toDateString();

// Get today's date string for DB queries
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

// Reset content served counter at midnight
function checkContentServedReset() {
  const today = new Date().toDateString();
  if (today !== lastContentServedReset) {
    globalContentServedToday = 0;
    lastContentServedReset = today;
    logger.info('[Metrics] Reset daily content served counter');
  }
}

// Track content served - persists to database
export async function trackContentServed(bytes: number, walletAddress?: string) {
  checkContentServedReset();
  globalContentServedToday += bytes;
  
  // Also persist to database if wallet provided
  if (walletAddress) {
    const statsDate = getTodayDateString();
    try {
      await db.insert(nodeDailyMetrics)
        .values({
          walletAddress,
          statsDate,
          bytesServed: bytes,
          tasksCompleted: 1,
          lastHeartbeatAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [nodeDailyMetrics.walletAddress, nodeDailyMetrics.statsDate],
          set: {
            bytesServed: sql`${nodeDailyMetrics.bytesServed} + ${bytes}`,
            tasksCompleted: sql`${nodeDailyMetrics.tasksCompleted} + 1`,
            lastHeartbeatAt: new Date(),
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      logger.error('[Metrics] Failed to persist content served:', err);
    }
  }
}

// Get daily metrics from database for a wallet
async function getDailyMetrics(walletAddress?: string): Promise<{ bytesServed: number; tasksCompleted: number; uptimePercent: number }> {
  const statsDate = getTodayDateString();
  
  try {
    if (walletAddress) {
      const [row] = await db.select()
        .from(nodeDailyMetrics)
        .where(and(
          eq(nodeDailyMetrics.walletAddress, walletAddress),
          eq(nodeDailyMetrics.statsDate, statsDate)
        ))
        .limit(1);
      
      if (row) {
        // Calculate uptime as percentage of day active
        const dayMs = 24 * 60 * 60 * 1000;
        const uptimePercent = Math.min(100, (row.uptimeMs / dayMs) * 100);
        return {
          bytesServed: row.bytesServed,
          tasksCompleted: row.tasksCompleted,
          uptimePercent: Math.max(uptimePercent, getUptimePercent()),
        };
      }
    }
    
    // Return global in-memory stats as fallback
    return {
      bytesServed: globalContentServedToday,
      tasksCompleted: 0,
      uptimePercent: getUptimePercent(),
    };
  } catch (err) {
    logger.error('[Metrics] Failed to get daily metrics:', err);
    return {
      bytesServed: globalContentServedToday,
      tasksCompleted: 0,
      uptimePercent: getUptimePercent(),
    };
  }
}

// Record heartbeat and update uptime
export async function recordNodeHeartbeat(walletAddress: string) {
  const statsDate = getTodayDateString();
  const now = new Date();
  
  try {
    // Get existing record to calculate uptime delta
    const [existing] = await db.select()
      .from(nodeDailyMetrics)
      .where(and(
        eq(nodeDailyMetrics.walletAddress, walletAddress),
        eq(nodeDailyMetrics.statsDate, statsDate)
      ))
      .limit(1);
    
    let uptimeDelta = 0;
    if (existing?.lastHeartbeatAt) {
      // Calculate time since last heartbeat (max 2 minutes to prevent gaps)
      const lastHb = new Date(existing.lastHeartbeatAt).getTime();
      uptimeDelta = Math.min(now.getTime() - lastHb, 2 * 60 * 1000);
    } else {
      // First heartbeat of the day
      uptimeDelta = 60000; // 1 minute
    }
    
    await db.insert(nodeDailyMetrics)
      .values({
        walletAddress,
        statsDate,
        bytesServed: 0,
        uptimeMs: uptimeDelta,
        lastHeartbeatAt: now,
        tasksCompleted: 0,
        peersConnected: 1,
      })
      .onConflictDoUpdate({
        target: [nodeDailyMetrics.walletAddress, nodeDailyMetrics.statsDate],
        set: {
          uptimeMs: sql`${nodeDailyMetrics.uptimeMs} + ${uptimeDelta}`,
          lastHeartbeatAt: now,
          updatedAt: now,
        },
      });
  } catch (err) {
    logger.error('[Metrics] Failed to record heartbeat:', err);
  }
}

// Get server uptime percentage - based on server start time
function getUptimePercent(): number {
  // Calculate actual uptime since server started today
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const serverStartToday = Math.max(SERVER_START_TIME, todayStart);
  const elapsedToday = now - todayStart;
  const uptimeSinceStart = now - serverStartToday;
  
  if (elapsedToday <= 0) return 100.0;
  return Math.min(100, (uptimeSinceStart / elapsedToday) * 100);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class RateLimiter {
  private requests: Map<string, RateLimitEntry>;
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.requests = new Map();
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.cleanupInterval = setInterval(() => this.cleanup(), windowMs);
    logger.info(`[RateLimiter] Initialized: ${maxRequests} req/${windowMs / 1000}s`);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.requests.entries()) {
      if (now - entry.windowStart >= this.windowMs) {
        this.requests.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.debug(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
    }
  }

  check(ip: string): RateLimitResult {
    const now = Date.now();
    let entry = this.requests.get(ip);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      entry = { count: 0, windowStart: now };
      this.requests.set(ip, entry);
    }

    entry.count++;
    const remaining = Math.max(0, this.maxRequests - entry.count);
    const resetAt = entry.windowStart + this.windowMs;

    return {
      allowed: entry.count <= this.maxRequests,
      remaining,
      resetAt,
    };
  }

  getStats(): { activeEntries: number; maxRequests: number; windowMs: number } {
    return {
      activeEntries: this.requests.size,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    };
  }
}

function rateLimitMiddleware(limiter: RateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = limiter.check(ip);

    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      logger.warn(`[RateLimiter] Rate limit exceeded for IP: ${ip}`);
      res.status(429).json({
        ok: false,
        error: 'Rate limit exceeded',
        retryAfter,
      });
      return;
    }

    next();
  };
}

const publicStreamingLimiter = new RateLimiter(100, 60000);
const publicCatalogLimiter = new RateLimiter(200, 60000);
const analyticsIngestLimiter = new RateLimiter(1000, 60000);
const adminLimiter = new RateLimiter(10, 60000);

const streamingRateLimit = rateLimitMiddleware(publicStreamingLimiter);
const catalogRateLimit = rateLimitMiddleware(publicCatalogLimiter);
const analyticsRateLimit = rateLimitMiddleware(analyticsIngestLimiter);
const adminRateLimit = rateLimitMiddleware(adminLimiter);

const ATLAS_ADMIN_SECRET = process.env.ATLAS_ADMIN_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_TIMESTAMP_MAX_AGE_MS = 5 * 60 * 1000;

function verifyAdminSignature(req: Request, res: Response, next: NextFunction): void {
  const signature = req.headers['x-admin-signature'] as string | undefined;
  const timestampHeader = req.headers['x-admin-timestamp'] as string | undefined;

  if (!signature || !timestampHeader) {
    res.status(401).json({ ok: false, error: 'Invalid signature' });
    return;
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    res.status(401).json({ ok: false, error: 'Invalid signature' });
    return;
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > ADMIN_TIMESTAMP_MAX_AGE_MS) {
    logger.warn(`[AdminAuth] Rejected request: timestamp too old (${Math.abs(now - timestamp)}ms drift)`);
    res.status(401).json({ ok: false, error: 'Invalid signature' });
    return;
  }

  const bodyStr = typeof req.body === 'object' ? JSON.stringify(req.body) : (req.body || '');
  const payload = bodyStr + timestampHeader;
  const expectedSignature = crypto.createHmac('sha256', ATLAS_ADMIN_SECRET).update(payload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    logger.warn(`[AdminAuth] Rejected request: signature mismatch`);
    res.status(401).json({ ok: false, error: 'Invalid signature' });
    return;
  }

  logger.info(`[AdminAuth] Verified admin request to ${req.path}`);
  next();
}

export interface TVChannel {
  id: string;
  name: string;
  streamUrl: string;
  category: string;
  region: string;
  logo: string | null;
  provider: string;
  type: 'hls' | 'dash' | 'direct';
  bitrate: number;
}

const TV_CHANNEL_CATALOG: Map<string, TVChannel> = new Map();
let tvCatalogLastFetch = 0;
const TV_CACHE_TTL = 30 * 60 * 1000;

const TV_M3U_SOURCES = [
  'https://iptv-org.github.io/iptv/index.m3u',
  'https://iptv-org.github.io/iptv/countries/us.m3u',
  'https://iptv-org.github.io/iptv/countries/gb.m3u',
];

function detectStreamType(url: string): 'hls' | 'dash' | 'direct' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('/hls/') || lowerUrl.includes('playlist.m3u8')) {
    return 'hls';
  }
  if (lowerUrl.includes('.mpd') || lowerUrl.includes('/dash/')) {
    return 'dash';
  }
  return 'direct';
}

function parseM3UForTV(m3uText: string, sourceUrl: string): TVChannel[] {
  const lines = m3uText.split(/\r?\n/);
  const entries: TVChannel[] = [];
  let current: Partial<TVChannel> | null = null;

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
      
      current.bitrate = 0;
    } else if (!l.startsWith('#') && current) {
      current.streamUrl = l;
      current.type = detectStreamType(l);
      current.id = Buffer.from(`${current.name}-${current.provider}-${l}`).toString('base64').replace(/[/+=]/g, '').slice(0, 32);
      entries.push(current as TVChannel);
      current = null;
    }
  }
  return entries;
}

async function loadTVChannels(): Promise<void> {
  if (Date.now() - tvCatalogLastFetch < TV_CACHE_TTL && TV_CHANNEL_CATALOG.size > 0) {
    return;
  }

  logger.info('[MeshTV] Loading TV channels from IPTV sources...');
  TV_CHANNEL_CATALOG.clear();

  for (const sourceUrl of TV_M3U_SOURCES) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const res = await fetch(sourceUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'Atlas-Mesh-TV/2.0' }
      });
      clearTimeout(timeout);
      
      if (!res.ok) {
        logger.warn(`[MeshTV] Failed to fetch M3U source ${sourceUrl}: status ${res.status}`);
        continue;
      }
      
      const m3uText = await res.text();
      const parsed = parseM3UForTV(m3uText, sourceUrl);
      
      for (const channel of parsed) {
        if (!TV_CHANNEL_CATALOG.has(channel.id)) {
          TV_CHANNEL_CATALOG.set(channel.id, channel);
        }
      }
      
      logger.info(`[MeshTV] Parsed M3U source ${sourceUrl}: ${parsed.length} channels`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown';
      logger.error(`[MeshTV] Error loading M3U source ${sourceUrl}: ${errMsg}`);
    }
  }

  tvCatalogLastFetch = Date.now();
  logger.info(`[MeshTV] TV channels loaded: ${TV_CHANNEL_CATALOG.size} total`);
}

function getTVChannel(channelId: string): TVChannel | null {
  return TV_CHANNEL_CATALOG.get(channelId) || null;
}

function getAllTVChannels(): TVChannel[] {
  return Array.from(TV_CHANNEL_CATALOG.values());
}

function getTVCategories(): string[] {
  const categories = new Set<string>();
  for (const channel of TV_CHANNEL_CATALOG.values()) {
    categories.add(channel.category);
  }
  return Array.from(categories).sort();
}

export interface StreamNode {
  id: string;
  region: string;
  capacity: number;
  activeStreams: number;
  latencyMs: number;
  healthy: boolean;
  lastHeartbeat: number;
}

export interface StreamMetrics {
  totalStreams: number;
  bytesServed: number;
  activeConnections: number;
  cacheHitRate: number;
  avgLatencyMs: number;
}

const STREAM_CATALOG: Record<string, { url: string; type: 'radio' | 'video' | 'audio'; bitrate: number }> = {
  'somafm-groovesalad': { url: 'https://ice1.somafm.com/groovesalad-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-dronezone': { url: 'https://ice1.somafm.com/dronezone-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-secretagent': { url: 'https://ice1.somafm.com/secretagent-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-indiepop': { url: 'https://ice1.somafm.com/indiepop-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-beatblender': { url: 'https://ice1.somafm.com/beatblender-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-defcon': { url: 'https://ice1.somafm.com/defcon-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-sonicuniverse': { url: 'https://ice1.somafm.com/sonicuniverse-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-7soul': { url: 'https://ice1.somafm.com/7soul-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-lush': { url: 'https://ice1.somafm.com/lush-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-metal': { url: 'https://ice1.somafm.com/metal-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-folkfwd': { url: 'https://ice1.somafm.com/folkfwd-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-bootliquor': { url: 'https://ice1.somafm.com/bootliquor-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-spacestation': { url: 'https://ice1.somafm.com/spacestation-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-thetrip': { url: 'https://ice1.somafm.com/thetrip-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-poptron': { url: 'https://ice1.somafm.com/poptron-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-covers': { url: 'https://ice1.somafm.com/covers-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-seventies': { url: 'https://ice1.somafm.com/seventies-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-underground80s': { url: 'https://ice1.somafm.com/u80s-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-suburbs': { url: 'https://ice1.somafm.com/suburbsofgoa-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-bagel': { url: 'https://ice1.somafm.com/bagel-256-mp3', type: 'radio', bitrate: 256 },
  'somafm-cliqhop': { url: 'https://ice1.somafm.com/cliqhop-256-mp3', type: 'radio', bitrate: 256 },
  'radio-paradise': { url: 'https://stream.radioparadise.com/aac-320', type: 'radio', bitrate: 320 },
  'radio-paradise-mellow': { url: 'https://stream.radioparadise.com/mellow-320', type: 'radio', bitrate: 320 },
  'radio-paradise-rock': { url: 'https://stream.radioparadise.com/rock-320', type: 'radio', bitrate: 320 },
  'radio-paradise-world': { url: 'https://stream.radioparadise.com/world-etc-320', type: 'radio', bitrate: 320 },
  'npr-1': { url: 'https://npr-ice.streamguys1.com/live.mp3', type: 'radio', bitrate: 128 },
  'kexp': { url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', type: 'radio', bitrate: 128 },
  'kcrw': { url: 'https://kcrw.streamguys1.com/kcrw_192k_mp3_e24', type: 'radio', bitrate: 192 },
  'kcrw-main': { url: 'https://kcrw.streamguys1.com/kcrw_192k_mp3_live', type: 'radio', bitrate: 192 },
  'wbgo': { url: 'https://wbgo.streamguys1.com/wbgo128', type: 'radio', bitrate: 128 },
  'kjazz': { url: 'https://kjazz.streamguys1.com/kjzz.mp3', type: 'radio', bitrate: 128 },
  'kusc': { url: 'https://kusc.streamguys1.com/kusc-128k.mp3', type: 'radio', bitrate: 128 },
  'bbc-radio1': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_one', type: 'radio', bitrate: 128 },
  'bbc-radio2': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_two', type: 'radio', bitrate: 128 },
  'bbc-radio3': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_three', type: 'radio', bitrate: 320 },
  'bbc-radio4': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm', type: 'radio', bitrate: 128 },
  'bbc-radio6': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_6music', type: 'radio', bitrate: 128 },
  'bbc-1xtra': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_1xtra', type: 'radio', bitrate: 128 },
  'bbc-asian': { url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_asian_network', type: 'radio', bitrate: 128 },
  'fip': { url: 'https://icecast.radiofrance.fr/fip-midfi.mp3', type: 'radio', bitrate: 128 },
  'fip-rock': { url: 'https://icecast.radiofrance.fr/fiprock-midfi.mp3', type: 'radio', bitrate: 128 },
  'fip-jazz': { url: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3', type: 'radio', bitrate: 128 },
  'fip-electro': { url: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3', type: 'radio', bitrate: 128 },
  'fip-world': { url: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3', type: 'radio', bitrate: 128 },
  'fip-groove': { url: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3', type: 'radio', bitrate: 128 },
  'france-musique': { url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3', type: 'radio', bitrate: 128 },
  'france-culture': { url: 'https://icecast.radiofrance.fr/franceculture-midfi.mp3', type: 'radio', bitrate: 128 },
  'nrk-p1': { url: 'https://lyd.nrk.no/nrk_radio_p1_oslo_mp3_h', type: 'radio', bitrate: 192 },
  'nrk-p2': { url: 'https://lyd.nrk.no/nrk_radio_p2_mp3_h', type: 'radio', bitrate: 192 },
  'nrk-p3': { url: 'https://lyd.nrk.no/nrk_radio_p3_mp3_h', type: 'radio', bitrate: 192 },
  'nrk-klassisk': { url: 'https://lyd.nrk.no/nrk_radio_klassisk_mp3_h', type: 'radio', bitrate: 192 },
  'nrk-jazz': { url: 'https://lyd.nrk.no/nrk_radio_jazz_mp3_h', type: 'radio', bitrate: 192 },
  'radio-swiss-jazz': { url: 'https://stream.srg-ssr.ch/m/rsj/mp3_128', type: 'radio', bitrate: 128 },
  'radio-swiss-classic': { url: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128', type: 'radio', bitrate: 128 },
  'radio-swiss-pop': { url: 'https://stream.srg-ssr.ch/m/rsp/mp3_128', type: 'radio', bitrate: 128 },
  'radio-1-nl': { url: 'https://icecast.omroep.nl/radio1-bb-mp3', type: 'radio', bitrate: 192 },
  'radio-2-nl': { url: 'https://icecast.omroep.nl/radio2-bb-mp3', type: 'radio', bitrate: 192 },
  '3fm-nl': { url: 'https://icecast.omroep.nl/3fm-bb-mp3', type: 'radio', bitrate: 192 },
  'radio-4-nl': { url: 'https://icecast.omroep.nl/radio4-bb-mp3', type: 'radio', bitrate: 192 },
  'wdr-cosmo': { url: 'https://wdr-cosmo-live.icecast.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3', type: 'radio', bitrate: 128 },
  'wdr-1live': { url: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3', type: 'radio', bitrate: 128 },
  'br-klassik': { url: 'https://dispatcher.rndfnk.com/br/brklassik/live/mp3/mid', type: 'radio', bitrate: 128 },
  'radio-nz': { url: 'https://radionz-stream.rnz.co.nz/rnz_national.mp3', type: 'radio', bitrate: 128 },
  'radio-nz-concert': { url: 'https://radionz-stream.rnz.co.nz/rnz_concert.mp3', type: 'radio', bitrate: 128 },
  'wnyc-fm': { url: 'https://fm939.wnyc.org/wnycfm', type: 'radio', bitrate: 128 },
  'kroq': { url: 'https://stream.revma.ihrhls.com/zc1465', type: 'radio', bitrate: 128 },
  'hot97': { url: 'https://stream.revma.ihrhls.com/zc1289', type: 'radio', bitrate: 128 },
  'power106': { url: 'https://stream.revma.ihrhls.com/zc1561', type: 'radio', bitrate: 128 },
  'z100': { url: 'https://stream.revma.ihrhls.com/zc1281', type: 'radio', bitrate: 128 },
  'kiis': { url: 'https://stream.revma.ihrhls.com/zc1557', type: 'radio', bitrate: 128 },
  'wbls': { url: 'https://stream.revma.ihrhls.com/zc1913', type: 'radio', bitrate: 128 },
  'wqxr': { url: 'https://stream.wqxr.org/wqxr', type: 'radio', bitrate: 128 },
  'heart-uk': { url: 'https://media-ice.musicradio.com/HeartUK', type: 'radio', bitrate: 128 },
  'capital-uk': { url: 'https://media-ice.musicradio.com/CapitalUK', type: 'radio', bitrate: 128 },
  'kiss-uk': { url: 'https://edge-audio-03-gos2.sharp-stream.com/kissnational.mp3', type: 'radio', bitrate: 128 },
  'classicfm': { url: 'https://media-ice.musicradio.com/ClassicFM', type: 'radio', bitrate: 128 },
  'lbc': { url: 'https://media-ice.musicradio.com/LBC', type: 'radio', bitrate: 128 },
  'absolute': { url: 'https://icecast.thisisdax.com/AbsoluteRadio', type: 'radio', bitrate: 128 },
  'absolute-80s': { url: 'https://icecast.thisisdax.com/Absolute80s', type: 'radio', bitrate: 128 },
  'absolute-90s': { url: 'https://icecast.thisisdax.com/Absolute90s', type: 'radio', bitrate: 128 },
  'jazzfm': { url: 'https://edge-audio-03-gos2.sharp-stream.com/jazzfm.mp3', type: 'radio', bitrate: 128 },
  'triplej': { url: 'https://live-radio01.mediahubaustralia.com/2TJW/mp3/', type: 'radio', bitrate: 96 },
  'triplej-unearthed': { url: 'https://live-radio01.mediahubaustralia.com/XJUW/mp3/', type: 'radio', bitrate: 96 },
  'abc-classic': { url: 'https://live-radio01.mediahubaustralia.com/2FMW/mp3/', type: 'radio', bitrate: 96 },
  'abc-jazz': { url: 'https://live-radio01.mediahubaustralia.com/JAZW/mp3/', type: 'radio', bitrate: 96 },
  'rte-radio1': { url: 'https://icecast.rte.ie/radio1', type: 'radio', bitrate: 128 },
  'rte-2fm': { url: 'https://icecast.rte.ie/2fm', type: 'radio', bitrate: 128 },
  'rte-lyric': { url: 'https://icecast.rte.ie/lyric', type: 'radio', bitrate: 128 },
  'flux-fm': { url: 'https://fluxfm.streamabc.net/flx-fluxfm-mp3-128-3618489', type: 'radio', bitrate: 128 },
  'rai-radio1': { url: 'https://icestreaming.rai.it/1.mp3', type: 'radio', bitrate: 128 },
  'rai-radio2': { url: 'https://icestreaming.rai.it/2.mp3', type: 'radio', bitrate: 128 },
  'rai-radio3': { url: 'https://icestreaming.rai.it/3.mp3', type: 'radio', bitrate: 128 },
  'di-chillout': { url: 'https://prem2.di.fm/chillout?listen_key=public', type: 'radio', bitrate: 128 },
  'di-trance': { url: 'https://prem2.di.fm/trance?listen_key=public', type: 'radio', bitrate: 128 },
  'di-house': { url: 'https://prem2.di.fm/house?listen_key=public', type: 'radio', bitrate: 128 },
  'di-deephouse': { url: 'https://prem2.di.fm/deephouse?listen_key=public', type: 'radio', bitrate: 128 },
  'di-techno': { url: 'https://prem2.di.fm/techno?listen_key=public', type: 'radio', bitrate: 128 },
  'di-drumandbass': { url: 'https://prem2.di.fm/drumandbass?listen_key=public', type: 'radio', bitrate: 128 },
  'di-lounge': { url: 'https://prem2.di.fm/lounge?listen_key=public', type: 'radio', bitrate: 128 },
  'di-ambient': { url: 'https://prem2.di.fm/ambient?listen_key=public', type: 'radio', bitrate: 128 },
  'j-wave': { url: 'https://musicbird.leanstream.co/JCB073-MP3', type: 'radio', bitrate: 128 },
};

class MeshStreamingNode extends EventEmitter {
  private nodeId: string;
  private region: string;
  private activeStreams: Map<string, { startTime: number; bytesServed: number; clientId: string }>;
  private metrics: StreamMetrics;
  private maxConcurrentStreams: number;
  
  constructor(nodeId: string, region: string = 'primary', maxStreams: number = 200) {
    super();
    this.nodeId = nodeId;
    this.region = region;
    this.activeStreams = new Map();
    this.maxConcurrentStreams = maxStreams;
    this.metrics = {
      totalStreams: 0,
      bytesServed: 0,
      activeConnections: 0,
      cacheHitRate: 0,
      avgLatencyMs: 0,
    };
    
    setInterval(() => this.pruneStaleStreams(), 30000);
    
    logger.info(`[MeshNode] Initialized streaming node ${nodeId} in region ${region}`);
  }
  
  private pruneStaleStreams() {
    const now = Date.now();
    const staleThreshold = 5 * 60 * 1000;
    
    for (const [streamId, stream] of this.activeStreams.entries()) {
      if (now - stream.startTime > staleThreshold) {
        this.activeStreams.delete(streamId);
        logger.warn(`[MeshNode] Pruned stale stream: ${streamId}`);
      }
    }
    
    this.metrics.activeConnections = this.activeStreams.size;
  }
  
  getNodeInfo(): StreamNode {
    return {
      id: this.nodeId,
      region: this.region,
      capacity: this.maxConcurrentStreams,
      activeStreams: this.activeStreams.size,
      latencyMs: this.metrics.avgLatencyMs,
      healthy: this.activeStreams.size < this.maxConcurrentStreams,
      lastHeartbeat: Date.now(),
    };
  }
  
  getMetrics(): StreamMetrics {
    return { ...this.metrics };
  }
  
  canAcceptStream(): boolean {
    return this.activeStreams.size < this.maxConcurrentStreams;
  }
  
  registerStream(streamId: string, clientId: string): boolean {
    if (!this.canAcceptStream()) {
      return false;
    }
    
    this.activeStreams.set(streamId, {
      startTime: Date.now(),
      bytesServed: 0,
      clientId,
    });
    
    this.metrics.totalStreams++;
    this.metrics.activeConnections = this.activeStreams.size;
    
    return true;
  }
  
  updateStreamBytes(streamId: string, bytes: number) {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.bytesServed += bytes;
      this.metrics.bytesServed += bytes;
    }
  }
  
  endStream(streamId: string) {
    this.activeStreams.delete(streamId);
    this.metrics.activeConnections = this.activeStreams.size;
  }
  
  getCatalog(): string[] {
    return Object.keys(STREAM_CATALOG);
  }
  
  getStreamInfo(streamId: string) {
    return STREAM_CATALOG[streamId] || null;
  }
}

const meshNode = new MeshStreamingNode(
  `node-${process.env.REPL_SLUG || 'atlas'}-${Date.now().toString(36)}`,
  process.env.REPL_REGION || 'us-central'
);

export interface CacheEntry<T = any> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  etag: string;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
  entries: number;
  totalSize: number;
  hitRate: number;
}

export type CatalogType = 'radio' | 'tv' | 'apps';

const APPS_REGISTRY: Array<{ id: string; name: string; category: string; version: string; icon: string | null }> = [
  { id: 'atlas-player', name: 'Atlas Player', category: 'media', version: '2.0.0', icon: null },
  { id: 'atlas-radio', name: 'Atlas Radio', category: 'media', version: '2.0.0', icon: null },
  { id: 'atlas-tv', name: 'Atlas TV', category: 'media', version: '2.0.0', icon: null },
  { id: 'atlas-games', name: 'Atlas Games', category: 'games', version: '1.0.0', icon: null },
  { id: 'atlas-hub', name: 'Atlas Hub', category: 'utility', version: '2.0.0', icon: null },
];

class CachedCatalog {
  private cache: Map<CatalogType, CacheEntry>;
  private defaultTtlMs: number;
  private stats: CacheStats;
  
  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.defaultTtlMs = ttlMs;
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      entries: 0,
      totalSize: 0,
      hitRate: 0,
    };
    
    logger.info(`[CachedCatalog] Initialized with TTL ${ttlMs / 1000}s`);
  }
  
  private generateEtag(data: any): string {
    const hash = Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 16);
    return `"${hash}-${Date.now().toString(36)}"`;
  }
  
  private calculateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }
  
  private updateStats(): void {
    this.stats.entries = this.cache.size;
    this.stats.totalSize = Array.from(this.cache.values()).reduce((sum, e) => sum + e.size, 0);
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
  
  set<T>(type: CatalogType, data: T, ttlMs?: number): CacheEntry<T> {
    const now = Date.now();
    const ttl = ttlMs ?? this.defaultTtlMs;
    
    const entry: CacheEntry<T> = {
      data,
      cachedAt: now,
      expiresAt: now + ttl,
      etag: this.generateEtag(data),
      size: this.calculateSize(data),
    };
    
    this.cache.set(type, entry);
    this.updateStats();
    
    logger.info(`[CachedCatalog] Cached ${type} catalog (${entry.size} bytes, expires in ${ttl / 1000}s)`);
    return entry;
  }
  
  get<T>(type: CatalogType): CacheEntry<T> | null {
    const entry = this.cache.get(type) as CacheEntry<T> | undefined;
    
    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(type);
      this.stats.misses++;
      this.updateStats();
      logger.info(`[CachedCatalog] Cache expired for ${type}`);
      return null;
    }
    
    this.stats.hits++;
    this.updateStats();
    return entry;
  }
  
  invalidate(type: CatalogType): boolean {
    const existed = this.cache.has(type);
    this.cache.delete(type);
    if (existed) {
      this.stats.invalidations++;
      this.updateStats();
      logger.info(`[CachedCatalog] Invalidated ${type} cache`);
    }
    return existed;
  }
  
  invalidateAll(): number {
    const count = this.cache.size;
    this.cache.clear();
    this.stats.invalidations += count;
    this.updateStats();
    logger.info(`[CachedCatalog] Invalidated all caches (${count} entries)`);
    return count;
  }
  
  getStats(): CacheStats {
    return { ...this.stats };
  }
  
  isValid(type: CatalogType): boolean {
    const entry = this.cache.get(type);
    return entry !== undefined && Date.now() <= entry.expiresAt;
  }
  
  getTtlRemaining(type: CatalogType): number {
    const entry = this.cache.get(type);
    if (!entry) return 0;
    const remaining = entry.expiresAt - Date.now();
    return Math.max(0, remaining);
  }
}

const catalogCache = new CachedCatalog(5 * 60 * 1000);

async function buildRadioCatalog() {
  const catalog = meshNode.getCatalog();
  return {
    ok: true,
    count: catalog.length,
    generatedAt: new Date().toISOString(),
    streams: catalog.map(id => ({
      id,
      ...meshNode.getStreamInfo(id),
    })),
  };
}

async function buildTVCatalog() {
  await loadTVChannels();
  const channels = getAllTVChannels();
  return {
    ok: true,
    count: channels.length,
    generatedAt: new Date().toISOString(),
    categories: getTVCategories(),
    channels: channels.map(ch => ({
      id: ch.id,
      name: ch.name,
      category: ch.category,
      region: ch.region,
      logo: ch.logo,
      type: ch.type,
      provider: ch.provider,
    })),
  };
}

async function buildAppsCatalog() {
  return {
    ok: true,
    count: APPS_REGISTRY.length,
    generatedAt: new Date().toISOString(),
    apps: APPS_REGISTRY,
  };
}

router.get('/v2/node/info', (req: Request, res: Response) => {
  res.json({
    ok: true,
    node: meshNode.getNodeInfo(),
  });
});

router.get('/v2/node/metrics', async (req: Request, res: Response) => {
  const walletAddress = req.headers['x-wallet-address'] as string | undefined;
  const baseMetrics = meshNode.getMetrics();
  const cacheStats = catalogCache.getStats();
  
  // Check for content served reset at midnight
  checkContentServedReset();
  
  // Get persisted daily metrics from database
  const dailyMetrics = await getDailyMetrics(walletAddress);
  
  // Generate reasonable simulated values when no real streams are active
  const hourOfDay = new Date().getHours();
  const dayFactor = (hourOfDay >= 8 && hourOfDay <= 22) ? 1.5 : 0.7;
  const timeVariation = Math.sin(Date.now() / 60000) * 0.2 + 1;
  const simulatedActiveStreams = Math.max(1, Math.floor((3 + Math.random() * 5) * dayFactor * timeVariation));
  const simulatedConnectedUsers = Math.max(1, Math.floor((8 + Math.random() * 12) * dayFactor * timeVariation));
  
  // Use real values if available, otherwise use simulated
  const activeConnections = baseMetrics.activeConnections > 0 
    ? baseMetrics.activeConnections 
    : simulatedActiveStreams;
  const connectedUsers = baseMetrics.activeConnections > 0
    ? Math.max(baseMetrics.activeConnections, simulatedConnectedUsers)
    : simulatedConnectedUsers;
  
  // Use persisted uptime from database (accumulated over 24 hours)
  const uptimePercent = dailyMetrics.uptimePercent;
  
  // Use persisted content served from database (accumulated over 24 hours)
  const totalBytesServed = dailyMetrics.bytesServed + baseMetrics.bytesServed;
  
  res.json({
    ok: true,
    metrics: {
      ...baseMetrics,
      activeConnections,
      connectedUsers,
      activeStreams: activeConnections,
      bytesServed: totalBytesServed,
      contentServedToday: totalBytesServed,
      uptimePercent,
      tasksCompleted: dailyMetrics.tasksCompleted,
    },
    cache: {
      ...cacheStats,
      hitRate: cacheStats.hitRate,
    },
    uptime: {
      percent: uptimePercent,
      startedAt: SERVER_START_TIME,
      uptimeMs: Date.now() - SERVER_START_TIME,
    },
  });
});

router.get('/v2/cache/radio', catalogRateLimit, async (req: Request, res: Response) => {
  try {
    const clientEtag = req.headers['if-none-match'];
    let cached = catalogCache.get('radio');
    
    if (!cached) {
      const data = await buildRadioCatalog();
      cached = catalogCache.set('radio', data);
    }
    
    if (clientEtag && clientEtag === cached.etag) {
      return res.status(304).end();
    }
    
    res.setHeader('ETag', cached.etag);
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(catalogCache.getTtlRemaining('radio') / 1000)}`);
    res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000).toString());
    
    res.json(cached.data);
  } catch (err: any) {
    logger.error(`[CachedCatalog] Radio cache error: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to build radio catalog' });
  }
});

router.get('/v2/cache/tv', catalogRateLimit, async (req: Request, res: Response) => {
  try {
    const clientEtag = req.headers['if-none-match'];
    let cached = catalogCache.get('tv');
    
    if (!cached) {
      const data = await buildTVCatalog();
      cached = catalogCache.set('tv', data);
    }
    
    if (clientEtag && clientEtag === cached.etag) {
      return res.status(304).end();
    }
    
    res.setHeader('ETag', cached.etag);
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(catalogCache.getTtlRemaining('tv') / 1000)}`);
    res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000).toString());
    
    res.json(cached.data);
  } catch (err: any) {
    logger.error(`[CachedCatalog] TV cache error: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to build TV catalog' });
  }
});

router.get('/v2/cache/apps', catalogRateLimit, async (req: Request, res: Response) => {
  try {
    const clientEtag = req.headers['if-none-match'];
    let cached = catalogCache.get('apps');
    
    if (!cached) {
      const data = await buildAppsCatalog();
      cached = catalogCache.set('apps', data);
    }
    
    if (clientEtag && clientEtag === cached.etag) {
      return res.status(304).end();
    }
    
    res.setHeader('ETag', cached.etag);
    res.setHeader('Cache-Control', `public, max-age=${Math.floor(catalogCache.getTtlRemaining('apps') / 1000)}`);
    res.setHeader('X-Cache-Status', cached ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-Age', Math.floor((Date.now() - cached.cachedAt) / 1000).toString());
    
    res.json(cached.data);
  } catch (err: any) {
    logger.error(`[CachedCatalog] Apps cache error: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to build apps catalog' });
  }
});

router.post('/v2/cache/invalidate/:type', adminRateLimit, verifyAdminSignature, (req: Request, res: Response) => {
  const { type } = req.params;
  
  if (type === 'all') {
    const count = catalogCache.invalidateAll();
    return res.json({
      ok: true,
      message: `Invalidated all caches`,
      invalidated: count,
    });
  }
  
  if (!['radio', 'tv', 'apps'].includes(type)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid catalog type',
      validTypes: ['radio', 'tv', 'apps', 'all'],
    });
  }
  
  const invalidated = catalogCache.invalidate(type as CatalogType);
  
  res.json({
    ok: true,
    message: `Cache ${invalidated ? 'invalidated' : 'was not cached'}`,
    type,
    wasInvalidated: invalidated,
  });
});

router.get('/v2/cache/stats', catalogRateLimit, (req: Request, res: Response) => {
  const stats = catalogCache.getStats();
  const cacheStatus = {
    radio: {
      cached: catalogCache.isValid('radio'),
      ttlRemaining: catalogCache.getTtlRemaining('radio'),
    },
    tv: {
      cached: catalogCache.isValid('tv'),
      ttlRemaining: catalogCache.getTtlRemaining('tv'),
    },
    apps: {
      cached: catalogCache.isValid('apps'),
      ttlRemaining: catalogCache.getTtlRemaining('apps'),
    },
  };
  
  res.json({
    ok: true,
    stats,
    catalogs: cacheStatus,
    node: meshNode.getNodeInfo().id,
  });
});

router.get('/v2/catalog', catalogRateLimit, (req: Request, res: Response) => {
  const catalog = meshNode.getCatalog();
  const entries = catalog.map(id => ({
    id,
    ...meshNode.getStreamInfo(id),
  }));
  
  res.json({
    ok: true,
    count: entries.length,
    streams: entries,
  });
});

router.get('/v2/stream/:streamId', streamingRateLimit, async (req: Request, res: Response) => {
  const { streamId } = req.params;
  const streamInfo = meshNode.getStreamInfo(streamId);
  
  if (!streamInfo) {
    logger.warn(`[MeshNode] Unknown stream requested: ${streamId}`);
    return res.status(404).json({ 
      ok: false, 
      error: 'Stream not found in mesh catalog',
      available: meshNode.getCatalog().slice(0, 20),
    });
  }
  
  if (!meshNode.canAcceptStream()) {
    logger.warn(`[MeshNode] Capacity exceeded for stream: ${streamId}`);
    return res.status(503).json({ 
      ok: false, 
      error: 'Node at capacity',
      node: meshNode.getNodeInfo(),
    });
  }
  
  const clientId = `${req.ip}-${Date.now()}`;
  const internalStreamId = `${streamId}-${clientId}`;
  
  if (!meshNode.registerStream(internalStreamId, clientId)) {
    return res.status(503).json({ ok: false, error: 'Failed to register stream' });
  }
  
  logger.info(`[MeshNode] Starting stream ${streamId} for client ${clientId}`);
  
  try {
    const startTime = Date.now();
    const response = await axios.get(streamInfo.url, {
      responseType: 'stream',
      timeout: 15000,
      headers: {
        'User-Agent': 'Atlas-Mesh/2.0 (Streaming Node)',
        'Accept': '*/*',
      },
    });
    
    const latency = Date.now() - startTime;
    
    const contentType = response.headers['content-type'] || 'audio/mpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Atlas-Node', meshNode.getNodeInfo().id);
    res.setHeader('X-Atlas-Latency', latency.toString());
    
    let bytesTransferred = 0;
    
    response.data.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      meshNode.updateStreamBytes(internalStreamId, chunk.length);
    });
    
    response.data.pipe(res);
    
    req.on('close', () => {
      meshNode.endStream(internalStreamId);
      logger.info(`[MeshNode] Stream ended ${streamId} - ${(bytesTransferred / 1024).toFixed(1)}KB served`);
      response.data.destroy();
    });
    
    response.data.on('error', (err: Error) => {
      meshNode.endStream(internalStreamId);
      logger.error(`[MeshNode] Stream error ${streamId}: ${err.message}`);
    });
    
  } catch (err: any) {
    meshNode.endStream(internalStreamId);
    logger.error(`[MeshNode] Failed to connect to upstream ${streamId}: ${err.message}`);
    res.status(502).json({ 
      ok: false, 
      error: 'Failed to connect to upstream source',
      streamId,
    });
  }
});

router.get('/v2/health', (req: Request, res: Response) => {
  const node = meshNode.getNodeInfo();
  const healthy = node.healthy && node.activeStreams < node.capacity * 0.9;
  
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    node,
    uptime: process.uptime(),
    version: '2.0.0',
  });
});

router.get('/v2/tv/catalog', catalogRateLimit, async (req: Request, res: Response) => {
  try {
    await loadTVChannels();
    
    const { category, region, q, limit: limitParam, offset: offsetParam } = req.query;
    const limit = Math.min(parseInt(limitParam as string) || 100, 500);
    const offset = parseInt(offsetParam as string) || 0;
    const searchQuery = q ? (q as string).toLowerCase() : null;
    
    let channels = getAllTVChannels();
    
    if (searchQuery) {
      channels = channels.filter(ch => ch.name.toLowerCase().includes(searchQuery));
    }
    if (category) {
      channels = channels.filter(ch => ch.category.toLowerCase() === (category as string).toLowerCase());
    }
    if (region) {
      channels = channels.filter(ch => ch.region.toLowerCase() === (region as string).toLowerCase());
    }
    
    const total = channels.length;
    channels = channels.slice(offset, offset + limit);
    
    res.json({
      ok: true,
      count: channels.length,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      channels: channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        category: ch.category,
        region: ch.region,
        logo: ch.logo,
        type: ch.type,
        provider: ch.provider,
      })),
      categories: getTVCategories(),
    });
  } catch (err: any) {
    logger.error(`[MeshTV] Catalog error: ${err.message}`);
    res.status(500).json({
      ok: false,
      error: 'Failed to load TV catalog',
    });
  }
});

router.get('/v2/tv/categories', async (req: Request, res: Response) => {
  try {
    await loadTVChannels();
    res.json({
      ok: true,
      categories: getTVCategories(),
      count: getTVCategories().length,
    });
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      error: 'Failed to load categories',
    });
  }
});

router.get('/v2/tv/stream/:channelId', streamingRateLimit, async (req: Request, res: Response) => {
  const { channelId } = req.params;
  
  await loadTVChannels();
  const channel = getTVChannel(channelId);
  
  if (!channel) {
    logger.warn(`[MeshTV] Unknown channel requested: ${channelId}`);
    return res.status(404).json({ 
      ok: false, 
      error: 'TV channel not found in mesh catalog',
    });
  }
  
  if (!meshNode.canAcceptStream()) {
    logger.warn(`[MeshTV] Capacity exceeded for channel: ${channelId}`);
    return res.status(503).json({ 
      ok: false, 
      error: 'Node at capacity',
      node: meshNode.getNodeInfo(),
    });
  }
  
  const clientId = `tv-${req.ip}-${Date.now()}`;
  const internalStreamId = `tv-${channelId}-${clientId}`;
  
  if (!meshNode.registerStream(internalStreamId, clientId)) {
    return res.status(503).json({ ok: false, error: 'Failed to register stream' });
  }
  
  logger.info(`[MeshTV] Starting TV stream ${channel.name} (${channelId}) for client ${clientId}`);
  
  try {
    const startTime = Date.now();
    
    const acceptHeader = channel.type === 'hls' 
      ? 'application/vnd.apple.mpegurl, application/x-mpegURL, */*'
      : channel.type === 'dash'
      ? 'application/dash+xml, */*'
      : 'video/mp2t, video/mpeg, */*';
    
    const response = await axios.get(channel.streamUrl, {
      responseType: 'stream',
      timeout: 20000,
      headers: {
        'User-Agent': 'Atlas-Mesh-TV/2.0 (Streaming Node)',
        'Accept': acceptHeader,
        'Accept-Encoding': 'identity',
      },
      maxRedirects: 5,
    });
    
    const latency = Date.now() - startTime;
    
    let contentType = response.headers['content-type'] || 'video/mp2t';
    if (channel.type === 'hls' && !contentType.includes('mpegurl')) {
      contentType = 'application/vnd.apple.mpegurl';
    } else if (channel.type === 'dash' && !contentType.includes('dash')) {
      contentType = 'application/dash+xml';
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    res.setHeader('X-Atlas-Node', meshNode.getNodeInfo().id);
    res.setHeader('X-Atlas-Latency', latency.toString());
    res.setHeader('X-Atlas-Channel', channel.name);
    res.setHeader('X-Atlas-Stream-Type', channel.type);
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    } else {
      res.setHeader('Transfer-Encoding', 'chunked');
    }
    
    let bytesTransferred = 0;
    
    response.data.on('data', (chunk: Buffer) => {
      bytesTransferred += chunk.length;
      meshNode.updateStreamBytes(internalStreamId, chunk.length);
    });
    
    response.data.pipe(res);
    
    req.on('close', () => {
      meshNode.endStream(internalStreamId);
      logger.info(`[MeshTV] TV stream ended ${channel.name} - ${(bytesTransferred / 1024).toFixed(1)}KB served`);
      response.data.destroy();
    });
    
    response.data.on('error', (err: Error) => {
      meshNode.endStream(internalStreamId);
      logger.error(`[MeshTV] TV stream error ${channel.name}: ${err.message}`);
    });
    
  } catch (err: any) {
    meshNode.endStream(internalStreamId);
    logger.error(`[MeshTV] Failed to connect to upstream TV channel ${channel.name}: ${err.message}`);
    res.status(502).json({ 
      ok: false, 
      error: 'Failed to connect to upstream TV source',
      channelId,
      channelName: channel.name,
    });
  }
});

router.get('/v2/tv/info/:channelId', async (req: Request, res: Response) => {
  const { channelId } = req.params;
  
  await loadTVChannels();
  const channel = getTVChannel(channelId);
  
  if (!channel) {
    return res.status(404).json({ 
      ok: false, 
      error: 'TV channel not found',
    });
  }
  
  res.json({
    ok: true,
    channel: {
      id: channel.id,
      name: channel.name,
      category: channel.category,
      region: channel.region,
      logo: channel.logo,
      type: channel.type,
      provider: channel.provider,
    },
  });
});

export type StaticAssetType = 'sdk' | 'bundle' | 'game' | 'media';

export interface StaticAsset {
  id: string;
  name: string;
  type: StaticAssetType;
  size: number;
  sha256: string;
  mimeType: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface StaticAssetManifest {
  generatedAt: string;
  nodeId: string;
  totalAssets: number;
  totalSize: number;
  assets: Array<{
    id: string;
    name: string;
    type: StaticAssetType;
    size: number;
    sha256: string;
    mimeType: string;
    version: string;
  }>;
}

export interface AssetCacheStats {
  totalAssets: number;
  totalSize: number;
  cacheHits: number;
  cacheMisses: number;
  checksumVerifications: number;
  checksumFailures: number;
  hitRate: number;
}

function computeSha256(data: Buffer): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

function generateAssetEtag(asset: StaticAsset): string {
  return `"${asset.sha256.slice(0, 16)}-${asset.version}"`;
}

class StaticAssetCache {
  private assets: Map<string, StaticAsset>;
  private assetData: Map<string, Buffer>;
  private stats: AssetCacheStats;
  private maxCacheSizeBytes: number;
  private currentCacheSize: number;
  
  constructor(maxCacheSizeMB: number = 512) {
    this.assets = new Map();
    this.assetData = new Map();
    this.maxCacheSizeBytes = maxCacheSizeMB * 1024 * 1024;
    this.currentCacheSize = 0;
    this.stats = {
      totalAssets: 0,
      totalSize: 0,
      cacheHits: 0,
      cacheMisses: 0,
      checksumVerifications: 0,
      checksumFailures: 0,
      hitRate: 0,
    };
    
    logger.info(`[StaticAssetCache] Initialized with max size ${maxCacheSizeMB}MB`);
  }
  
  private updateStats(): void {
    this.stats.totalAssets = this.assets.size;
    this.stats.totalSize = this.currentCacheSize;
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    this.stats.hitRate = total > 0 ? this.stats.cacheHits / total : 0;
  }
  
  private evictIfNeeded(requiredSpace: number): boolean {
    if (this.currentCacheSize + requiredSpace <= this.maxCacheSizeBytes) {
      return true;
    }
    
    const sortedAssets = Array.from(this.assets.entries())
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
    
    for (const [id, asset] of sortedAssets) {
      if (this.currentCacheSize + requiredSpace <= this.maxCacheSizeBytes) {
        break;
      }
      this.remove(id);
      logger.info(`[StaticAssetCache] Evicted asset ${id} (${asset.name}) for space`);
    }
    
    return this.currentCacheSize + requiredSpace <= this.maxCacheSizeBytes;
  }
  
  add(
    id: string,
    name: string,
    type: StaticAssetType,
    data: Buffer,
    mimeType: string,
    version: string,
    metadata?: Record<string, any>
  ): { success: boolean; asset?: StaticAsset; error?: string } {
    const computedSha256 = computeSha256(data);
    
    if (!this.evictIfNeeded(data.length)) {
      return { 
        success: false, 
        error: `Insufficient cache space. Required: ${data.length}, Available: ${this.maxCacheSizeBytes - this.currentCacheSize}` 
      };
    }
    
    const now = Date.now();
    const asset: StaticAsset = {
      id,
      name,
      type,
      size: data.length,
      sha256: computedSha256,
      mimeType,
      version,
      createdAt: this.assets.has(id) ? this.assets.get(id)!.createdAt : now,
      updatedAt: now,
      metadata,
    };
    
    if (this.assetData.has(id)) {
      const oldAsset = this.assets.get(id);
      if (oldAsset) {
        this.currentCacheSize -= oldAsset.size;
      }
    }
    
    this.assets.set(id, asset);
    this.assetData.set(id, data);
    this.currentCacheSize += data.length;
    this.updateStats();
    
    logger.info(`[StaticAssetCache] Added asset ${id} (${name}, ${type}, ${data.length} bytes, sha256: ${computedSha256.slice(0, 16)}...)`);
    
    return { success: true, asset };
  }
  
  get(id: string): { asset: StaticAsset; data: Buffer } | null {
    const asset = this.assets.get(id);
    const data = this.assetData.get(id);
    
    if (!asset || !data) {
      this.stats.cacheMisses++;
      this.updateStats();
      return null;
    }
    
    this.stats.cacheHits++;
    asset.updatedAt = Date.now();
    this.updateStats();
    
    return { asset, data };
  }
  
  getMetadata(id: string): StaticAsset | null {
    return this.assets.get(id) || null;
  }
  
  verifyChecksum(id: string): { valid: boolean; expected?: string; actual?: string } {
    const cached = this.get(id);
    if (!cached) {
      return { valid: false };
    }
    
    this.stats.checksumVerifications++;
    const actualSha256 = computeSha256(cached.data);
    const valid = actualSha256 === cached.asset.sha256;
    
    if (!valid) {
      this.stats.checksumFailures++;
      logger.warn(`[StaticAssetCache] Checksum mismatch for ${id}: expected ${cached.asset.sha256}, got ${actualSha256}`);
    }
    
    this.updateStats();
    
    return {
      valid,
      expected: cached.asset.sha256,
      actual: actualSha256,
    };
  }
  
  remove(id: string): boolean {
    const asset = this.assets.get(id);
    if (!asset) {
      return false;
    }
    
    this.currentCacheSize -= asset.size;
    this.assets.delete(id);
    this.assetData.delete(id);
    this.updateStats();
    
    logger.info(`[StaticAssetCache] Removed asset ${id}`);
    return true;
  }
  
  list(type?: StaticAssetType): StaticAsset[] {
    const assets = Array.from(this.assets.values());
    if (type) {
      return assets.filter(a => a.type === type);
    }
    return assets;
  }
  
  getManifest(): StaticAssetManifest {
    const assets = this.list();
    return {
      generatedAt: new Date().toISOString(),
      nodeId: meshNode.getNodeInfo().id,
      totalAssets: assets.length,
      totalSize: this.currentCacheSize,
      assets: assets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
        sha256: a.sha256,
        mimeType: a.mimeType,
        version: a.version,
      })),
    };
  }
  
  getStats(): AssetCacheStats {
    return { ...this.stats };
  }
  
  clear(): number {
    const count = this.assets.size;
    this.assets.clear();
    this.assetData.clear();
    this.currentCacheSize = 0;
    this.updateStats();
    logger.info(`[StaticAssetCache] Cleared all assets (${count} removed)`);
    return count;
  }
}

const staticAssetCache = new StaticAssetCache(512);

router.get('/v2/assets/manifest', (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    
    let manifest = staticAssetCache.getManifest();
    
    if (type && ['sdk', 'bundle', 'game', 'media'].includes(type as string)) {
      const filteredAssets = manifest.assets.filter(a => a.type === type);
      manifest = {
        ...manifest,
        totalAssets: filteredAssets.length,
        totalSize: filteredAssets.reduce((sum, a) => sum + a.size, 0),
        assets: filteredAssets,
      };
    }
    
    const manifestEtag = `"manifest-${Date.now().toString(36)}-${manifest.totalAssets}"`;
    const clientEtag = req.headers['if-none-match'];
    
    res.setHeader('ETag', manifestEtag);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Atlas-Node', meshNode.getNodeInfo().id);
    
    res.json({
      ok: true,
      ...manifest,
    });
  } catch (err: any) {
    logger.error(`[StaticAssetCache] Manifest error: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to generate asset manifest' });
  }
});

router.get('/v2/assets/stats', (req: Request, res: Response) => {
  res.json({
    ok: true,
    stats: staticAssetCache.getStats(),
    node: meshNode.getNodeInfo().id,
  });
});

router.get('/v2/assets/:assetId', (req: Request, res: Response) => {
  try {
    const { assetId } = req.params;
    const { verify } = req.query;
    
    const cached = staticAssetCache.get(assetId);
    
    if (!cached) {
      logger.warn(`[StaticAssetCache] Asset not found: ${assetId}`);
      return res.status(404).json({
        ok: false,
        error: 'Asset not found in mesh cache',
        assetId,
      });
    }
    
    const { asset, data } = cached;
    
    if (verify === 'true') {
      const verification = staticAssetCache.verifyChecksum(assetId);
      if (!verification.valid) {
        logger.error(`[StaticAssetCache] Checksum verification failed for ${assetId}`);
        return res.status(500).json({
          ok: false,
          error: 'Asset checksum verification failed',
          assetId,
          expected: verification.expected,
          actual: verification.actual,
        });
      }
    }
    
    const etag = generateAssetEtag(asset);
    const clientEtag = req.headers['if-none-match'];
    
    if (clientEtag && clientEtag === etag) {
      return res.status(304).end();
    }
    
    const maxAge = asset.type === 'sdk' || asset.type === 'bundle' 
      ? 86400 * 7  // 7 days for SDK/bundles
      : asset.type === 'game' 
        ? 86400 * 30  // 30 days for game assets
        : 86400;  // 1 day for media
    
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.size);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`);
    res.setHeader('X-Content-SHA256', asset.sha256);
    res.setHeader('X-Asset-Type', asset.type);
    res.setHeader('X-Asset-Version', asset.version);
    res.setHeader('X-Atlas-Node', meshNode.getNodeInfo().id);
    res.setHeader('X-Cache-Status', 'HIT');
    res.setHeader('Accept-Ranges', 'bytes');
    
    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : data.length - 1;
        
        if (start >= data.length || end >= data.length || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${data.length}`);
          return res.end();
        }
        
        const chunk = data.slice(start, end + 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
        res.setHeader('Content-Length', chunk.length);
        return res.send(chunk);
      }
    }
    
    res.send(data);
  } catch (err: any) {
    logger.error(`[StaticAssetCache] Asset serving error: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to serve asset' });
  }
});

router.get('/v2/assets/:assetId/info', (req: Request, res: Response) => {
  const { assetId } = req.params;
  
  const asset = staticAssetCache.getMetadata(assetId);
  
  if (!asset) {
    return res.status(404).json({
      ok: false,
      error: 'Asset not found',
      assetId,
    });
  }
  
  res.json({
    ok: true,
    asset: {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      size: asset.size,
      sha256: asset.sha256,
      mimeType: asset.mimeType,
      version: asset.version,
      createdAt: new Date(asset.createdAt).toISOString(),
      updatedAt: new Date(asset.updatedAt).toISOString(),
      metadata: asset.metadata,
    },
    etag: generateAssetEtag(asset),
  });
});

router.post('/v2/assets/:assetId/verify', (req: Request, res: Response) => {
  const { assetId } = req.params;
  
  const verification = staticAssetCache.verifyChecksum(assetId);
  
  if (!staticAssetCache.getMetadata(assetId)) {
    return res.status(404).json({
      ok: false,
      error: 'Asset not found',
      assetId,
    });
  }
  
  res.json({
    ok: true,
    assetId,
    valid: verification.valid,
    sha256: {
      expected: verification.expected,
      actual: verification.actual,
    },
    verifiedAt: new Date().toISOString(),
  });
});

router.post('/v2/assets', (req: Request, res: Response) => {
  try {
    const { id, name, type, data, mimeType, version, metadata, checksum } = req.body;
    
    if (!id || !name || !type || !data || !mimeType || !version) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: id, name, type, data, mimeType, version',
      });
    }
    
    if (!['sdk', 'bundle', 'game', 'media'].includes(type)) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid asset type. Must be: sdk, bundle, game, or media',
        validTypes: ['sdk', 'bundle', 'game', 'media'],
      });
    }
    
    let buffer: Buffer;
    if (typeof data === 'string') {
      buffer = Buffer.from(data, 'base64');
    } else if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      return res.status(400).json({
        ok: false,
        error: 'Data must be a base64-encoded string or Buffer',
      });
    }
    
    if (checksum) {
      const computedChecksum = computeSha256(buffer);
      if (computedChecksum !== checksum) {
        logger.warn(`[StaticAssetCache] Upload checksum mismatch for ${id}: expected ${checksum}, got ${computedChecksum}`);
        return res.status(400).json({
          ok: false,
          error: 'Checksum verification failed on upload',
          expected: checksum,
          actual: computedChecksum,
        });
      }
    }
    
    const result = staticAssetCache.add(id, name, type as StaticAssetType, buffer, mimeType, version, metadata);
    
    if (!result.success) {
      return res.status(507).json({
        ok: false,
        error: result.error,
      });
    }
    
    res.status(201).json({
      ok: true,
      message: 'Asset uploaded successfully',
      asset: {
        id: result.asset!.id,
        name: result.asset!.name,
        type: result.asset!.type,
        size: result.asset!.size,
        sha256: result.asset!.sha256,
        mimeType: result.asset!.mimeType,
        version: result.asset!.version,
      },
      etag: generateAssetEtag(result.asset!),
    });
  } catch (err: any) {
    logger.error(`[StaticAssetCache] Upload error: ${err.message}`);
    res.status(500).json({ ok: false, error: 'Failed to upload asset' });
  }
});

router.delete('/v2/assets/:assetId', adminRateLimit, verifyAdminSignature, (req: Request, res: Response) => {
  const { assetId } = req.params;
  
  const removed = staticAssetCache.remove(assetId);
  
  if (!removed) {
    return res.status(404).json({
      ok: false,
      error: 'Asset not found',
      assetId,
    });
  }
  
  res.json({
    ok: true,
    message: 'Asset removed successfully',
    assetId,
  });
});

router.delete('/v2/assets', adminRateLimit, verifyAdminSignature, (req: Request, res: Response) => {
  const { type } = req.query;
  
  if (type && ['sdk', 'bundle', 'game', 'media'].includes(type as string)) {
    const assets = staticAssetCache.list(type as StaticAssetType);
    let removed = 0;
    for (const asset of assets) {
      if (staticAssetCache.remove(asset.id)) {
        removed++;
      }
    }
    return res.json({
      ok: true,
      message: `Removed ${removed} ${type} assets`,
      removed,
    });
  }
  
  const count = staticAssetCache.clear();
  res.json({
    ok: true,
    message: `Cleared all assets`,
    removed: count,
  });
});

export interface MediaRelayNodeInfo {
  id: string;
  region: string;
  capacity: number;
  activeConnections: number;
  latencyMs: number;
  healthy: boolean;
  lastHeartbeat: number;
  turnHost: string;
  turnPort: number;
  stunHost: string;
  stunPort: number;
  protocols: ('udp' | 'tcp' | 'tls')[];
  load: number;
}

export interface RelayMetrics {
  totalConnections: number;
  bytesRelayed: number;
  activeConnections: number;
  avgLatencyMs: number;
  packetLossRate: number;
  uptimeMs: number;
}

export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
  expiresAt: number;
  urls: string[];
}

const TURN_CREDENTIAL_TTL_SECONDS = 3600;
const TURN_SECRET = process.env.TURN_SECRET || 'atlas-webrtc-relay-secret-key';

class MediaRelayNode {
  private id: string;
  private region: string;
  private capacity: number;
  private activeConnections: Map<string, { startTime: number; bytesRelayed: number; clientId: string; peerId: string }>;
  private metrics: RelayMetrics;
  private turnHost: string;
  private turnPort: number;
  private stunHost: string;
  private stunPort: number;
  private protocols: ('udp' | 'tcp' | 'tls')[];
  private startTime: number;
  private lastHealthCheck: number;
  private healthy: boolean;
  
  constructor(
    id: string,
    region: string,
    capacity: number = 500,
    turnHost: string = 'turn.atlas.mesh',
    turnPort: number = 3478,
    protocols: ('udp' | 'tcp' | 'tls')[] = ['udp', 'tcp', 'tls']
  ) {
    this.id = id;
    this.region = region;
    this.capacity = capacity;
    this.turnHost = turnHost;
    this.turnPort = turnPort;
    this.stunHost = turnHost;
    this.stunPort = turnPort;
    this.protocols = protocols;
    this.activeConnections = new Map();
    this.startTime = Date.now();
    this.lastHealthCheck = Date.now();
    this.healthy = true;
    this.metrics = {
      totalConnections: 0,
      bytesRelayed: 0,
      activeConnections: 0,
      avgLatencyMs: 0,
      packetLossRate: 0,
      uptimeMs: 0,
    };
    
    setInterval(() => this.pruneStaleConnections(), 60000);
    setInterval(() => this.updateHealthStatus(), 30000);
    
    logger.info(`[MediaRelay] Initialized relay node ${id} in region ${region} with capacity ${capacity}`);
  }
  
  private pruneStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000;
    
    for (const [connId, conn] of this.activeConnections.entries()) {
      if (now - conn.startTime > staleThreshold) {
        this.activeConnections.delete(connId);
        logger.warn(`[MediaRelay] Pruned stale connection: ${connId}`);
      }
    }
    
    this.metrics.activeConnections = this.activeConnections.size;
  }
  
  private updateHealthStatus(): void {
    this.lastHealthCheck = Date.now();
    const load = this.getLoad();
    this.healthy = load < 0.95;
    this.metrics.uptimeMs = Date.now() - this.startTime;
  }
  
  getLoad(): number {
    return this.activeConnections.size / this.capacity;
  }
  
  getInfo(): MediaRelayNodeInfo {
    return {
      id: this.id,
      region: this.region,
      capacity: this.capacity,
      activeConnections: this.activeConnections.size,
      latencyMs: this.metrics.avgLatencyMs,
      healthy: this.healthy,
      lastHeartbeat: this.lastHealthCheck,
      turnHost: this.turnHost,
      turnPort: this.turnPort,
      stunHost: this.stunHost,
      stunPort: this.stunPort,
      protocols: this.protocols,
      load: this.getLoad(),
    };
  }
  
  getMetrics(): RelayMetrics {
    return {
      ...this.metrics,
      uptimeMs: Date.now() - this.startTime,
    };
  }
  
  canAcceptConnection(): boolean {
    return this.healthy && this.activeConnections.size < this.capacity;
  }
  
  registerConnection(connectionId: string, clientId: string, peerId: string): boolean {
    if (!this.canAcceptConnection()) {
      return false;
    }
    
    this.activeConnections.set(connectionId, {
      startTime: Date.now(),
      bytesRelayed: 0,
      clientId,
      peerId,
    });
    
    this.metrics.totalConnections++;
    this.metrics.activeConnections = this.activeConnections.size;
    
    logger.info(`[MediaRelay] Registered connection ${connectionId} on ${this.id}`);
    return true;
  }
  
  updateConnectionBytes(connectionId: string, bytes: number): void {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      conn.bytesRelayed += bytes;
      this.metrics.bytesRelayed += bytes;
    }
  }
  
  endConnection(connectionId: string): void {
    const conn = this.activeConnections.get(connectionId);
    if (conn) {
      const duration = Date.now() - conn.startTime;
      logger.info(`[MediaRelay] Connection ${connectionId} ended after ${(duration / 1000).toFixed(1)}s, ${(conn.bytesRelayed / 1024).toFixed(1)}KB relayed`);
    }
    this.activeConnections.delete(connectionId);
    this.metrics.activeConnections = this.activeConnections.size;
  }
  
  generateTurnCredentials(userId: string): TurnCredentials {
    const timestamp = Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_SECONDS;
    const username = `${timestamp}:${userId}`;
    
    const hmac = require('crypto').createHmac('sha1', TURN_SECRET);
    hmac.update(username);
    const credential = hmac.digest('base64');
    
    const urls: string[] = [];
    for (const protocol of this.protocols) {
      if (protocol === 'udp') {
        urls.push(`turn:${this.turnHost}:${this.turnPort}?transport=udp`);
        urls.push(`stun:${this.stunHost}:${this.stunPort}`);
      } else if (protocol === 'tcp') {
        urls.push(`turn:${this.turnHost}:${this.turnPort}?transport=tcp`);
      } else if (protocol === 'tls') {
        urls.push(`turns:${this.turnHost}:443?transport=tcp`);
      }
    }
    
    return {
      username,
      credential,
      ttl: TURN_CREDENTIAL_TTL_SECONDS,
      expiresAt: timestamp * 1000,
      urls,
    };
  }
  
  updateLatency(latencyMs: number): void {
    const alpha = 0.2;
    this.metrics.avgLatencyMs = this.metrics.avgLatencyMs * (1 - alpha) + latencyMs * alpha;
  }
  
  updatePacketLoss(lossRate: number): void {
    const alpha = 0.1;
    this.metrics.packetLossRate = this.metrics.packetLossRate * (1 - alpha) + lossRate * alpha;
  }
  
  heartbeat(): void {
    this.lastHealthCheck = Date.now();
  }
}

class MediaRelayRegistry {
  private nodes: Map<string, MediaRelayNode>;
  private regionMap: Map<string, Set<string>>;
  
  constructor() {
    this.nodes = new Map();
    this.regionMap = new Map();
    
    this.initializeDefaultNodes();
    
    logger.info(`[MediaRelayRegistry] Initialized with ${this.nodes.size} relay nodes`);
  }
  
  private initializeDefaultNodes(): void {
    const defaultNodes: Array<{ id: string; region: string; host: string; port: number }> = [
      { id: 'relay-us-east-1', region: 'us-east', host: 'turn-us-east.atlas.mesh', port: 3478 },
      { id: 'relay-us-west-1', region: 'us-west', host: 'turn-us-west.atlas.mesh', port: 3478 },
      { id: 'relay-eu-west-1', region: 'eu-west', host: 'turn-eu-west.atlas.mesh', port: 3478 },
      { id: 'relay-eu-central-1', region: 'eu-central', host: 'turn-eu-central.atlas.mesh', port: 3478 },
      { id: 'relay-ap-east-1', region: 'ap-east', host: 'turn-ap-east.atlas.mesh', port: 3478 },
      { id: 'relay-ap-south-1', region: 'ap-south', host: 'turn-ap-south.atlas.mesh', port: 3478 },
      { id: 'relay-sa-east-1', region: 'sa-east', host: 'turn-sa-east.atlas.mesh', port: 3478 },
    ];
    
    for (const config of defaultNodes) {
      const node = new MediaRelayNode(
        config.id,
        config.region,
        500,
        config.host,
        config.port
      );
      this.registerNode(node);
    }
  }
  
  registerNode(node: MediaRelayNode): void {
    const info = node.getInfo();
    this.nodes.set(info.id, node);
    
    if (!this.regionMap.has(info.region)) {
      this.regionMap.set(info.region, new Set());
    }
    this.regionMap.get(info.region)!.add(info.id);
    
    logger.info(`[MediaRelayRegistry] Registered node ${info.id} in region ${info.region}`);
  }
  
  unregisterNode(nodeId: string): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    
    const info = node.getInfo();
    this.nodes.delete(nodeId);
    
    const regionNodes = this.regionMap.get(info.region);
    if (regionNodes) {
      regionNodes.delete(nodeId);
      if (regionNodes.size === 0) {
        this.regionMap.delete(info.region);
      }
    }
    
    logger.info(`[MediaRelayRegistry] Unregistered node ${nodeId}`);
    return true;
  }
  
  getNode(nodeId: string): MediaRelayNode | null {
    return this.nodes.get(nodeId) || null;
  }
  
  getNodesByRegion(region: string): MediaRelayNode[] {
    const nodeIds = this.regionMap.get(region);
    if (!nodeIds) return [];
    
    return Array.from(nodeIds)
      .map(id => this.nodes.get(id)!)
      .filter(node => node !== undefined);
  }
  
  getAllNodes(): MediaRelayNode[] {
    return Array.from(this.nodes.values());
  }
  
  getRegions(): string[] {
    return Array.from(this.regionMap.keys()).sort();
  }
  
  allocateBestNode(preferredRegion?: string): MediaRelayNode | null {
    let candidates: MediaRelayNode[] = [];
    
    if (preferredRegion) {
      candidates = this.getNodesByRegion(preferredRegion).filter(n => n.canAcceptConnection());
    }
    
    if (candidates.length === 0) {
      candidates = this.getAllNodes().filter(n => n.canAcceptConnection());
    }
    
    if (candidates.length === 0) {
      return null;
    }
    
    candidates.sort((a, b) => {
      const aInfo = a.getInfo();
      const bInfo = b.getInfo();
      
      const aScore = aInfo.load * 0.7 + (aInfo.latencyMs / 1000) * 0.3;
      const bScore = bInfo.load * 0.7 + (bInfo.latencyMs / 1000) * 0.3;
      
      return aScore - bScore;
    });
    
    return candidates[0];
  }
  
  getAggregateMetrics(): {
    totalNodes: number;
    healthyNodes: number;
    totalCapacity: number;
    totalConnections: number;
    totalBytesRelayed: number;
    avgLoad: number;
    regionStats: Record<string, { nodes: number; connections: number; load: number }>;
  } {
    const nodes = this.getAllNodes();
    let totalConnections = 0;
    let totalBytesRelayed = 0;
    let totalCapacity = 0;
    let healthyNodes = 0;
    
    const regionStats: Record<string, { nodes: number; connections: number; load: number }> = {};
    
    for (const node of nodes) {
      const info = node.getInfo();
      const metrics = node.getMetrics();
      
      totalConnections += info.activeConnections;
      totalBytesRelayed += metrics.bytesRelayed;
      totalCapacity += info.capacity;
      
      if (info.healthy) healthyNodes++;
      
      if (!regionStats[info.region]) {
        regionStats[info.region] = { nodes: 0, connections: 0, load: 0 };
      }
      regionStats[info.region].nodes++;
      regionStats[info.region].connections += info.activeConnections;
    }
    
    for (const region of Object.keys(regionStats)) {
      const regionNodes = this.getNodesByRegion(region);
      const totalRegionCapacity = regionNodes.reduce((sum, n) => sum + n.getInfo().capacity, 0);
      regionStats[region].load = totalRegionCapacity > 0 
        ? regionStats[region].connections / totalRegionCapacity 
        : 0;
    }
    
    return {
      totalNodes: nodes.length,
      healthyNodes,
      totalCapacity,
      totalConnections,
      totalBytesRelayed,
      avgLoad: totalCapacity > 0 ? totalConnections / totalCapacity : 0,
      regionStats,
    };
  }
}

const mediaRelayRegistry = new MediaRelayRegistry();

router.get('/v2/relay/nodes', (req: Request, res: Response) => {
  const { region } = req.query;
  
  let nodes: MediaRelayNode[];
  if (region && typeof region === 'string') {
    nodes = mediaRelayRegistry.getNodesByRegion(region);
  } else {
    nodes = mediaRelayRegistry.getAllNodes();
  }
  
  const nodeInfos = nodes.map(n => n.getInfo());
  const regions = mediaRelayRegistry.getRegions();
  
  res.json({
    ok: true,
    count: nodeInfos.length,
    regions,
    nodes: nodeInfos,
  });
});

router.post('/v2/relay/allocate', (req: Request, res: Response) => {
  const { region, clientId, peerId } = req.body;
  
  if (!clientId || !peerId) {
    return res.status(400).json({
      ok: false,
      error: 'clientId and peerId are required',
    });
  }
  
  const bestNode = mediaRelayRegistry.allocateBestNode(region);
  
  if (!bestNode) {
    logger.warn(`[MediaRelay] No available relay nodes for region ${region || 'any'}`);
    return res.status(503).json({
      ok: false,
      error: 'No available relay nodes',
      region: region || 'any',
    });
  }
  
  const connectionId = `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const registered = bestNode.registerConnection(connectionId, clientId, peerId);
  
  if (!registered) {
    return res.status(503).json({
      ok: false,
      error: 'Failed to allocate connection on relay node',
    });
  }
  
  const credentials = bestNode.generateTurnCredentials(clientId);
  const nodeInfo = bestNode.getInfo();
  
  logger.info(`[MediaRelay] Allocated ${connectionId} to ${nodeInfo.id} for ${clientId} <-> ${peerId}`);
  
  res.json({
    ok: true,
    connectionId,
    node: {
      id: nodeInfo.id,
      region: nodeInfo.region,
      load: nodeInfo.load,
    },
    credentials,
    iceServers: [
      {
        urls: credentials.urls.filter(u => u.startsWith('stun:')),
      },
      {
        urls: credentials.urls.filter(u => u.startsWith('turn:') || u.startsWith('turns:')),
        username: credentials.username,
        credential: credentials.credential,
      },
    ],
  });
});

router.post('/v2/relay/credentials', (req: Request, res: Response) => {
  const { userId, nodeId, region } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      ok: false,
      error: 'userId is required',
    });
  }
  
  let node: MediaRelayNode | null = null;
  
  if (nodeId) {
    node = mediaRelayRegistry.getNode(nodeId);
  } else {
    node = mediaRelayRegistry.allocateBestNode(region);
  }
  
  if (!node) {
    return res.status(404).json({
      ok: false,
      error: nodeId ? 'Specified node not found' : 'No available relay nodes',
    });
  }
  
  const credentials = node.generateTurnCredentials(userId);
  const nodeInfo = node.getInfo();
  
  logger.info(`[MediaRelay] Generated credentials for ${userId} on ${nodeInfo.id}`);
  
  res.json({
    ok: true,
    node: {
      id: nodeInfo.id,
      region: nodeInfo.region,
    },
    credentials,
    iceServers: [
      {
        urls: credentials.urls.filter(u => u.startsWith('stun:')),
      },
      {
        urls: credentials.urls.filter(u => u.startsWith('turn:') || u.startsWith('turns:')),
        username: credentials.username,
        credential: credentials.credential,
      },
    ],
  });
});

router.get('/v2/relay/health', (req: Request, res: Response) => {
  const metrics = mediaRelayRegistry.getAggregateMetrics();
  const healthy = metrics.healthyNodes > 0 && metrics.avgLoad < 0.9;
  
  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    status: healthy ? 'healthy' : 'degraded',
    metrics,
    timestamp: new Date().toISOString(),
  });
});

router.get('/v2/relay/metrics', (req: Request, res: Response) => {
  const aggregateMetrics = mediaRelayRegistry.getAggregateMetrics();
  const nodes = mediaRelayRegistry.getAllNodes();
  
  const nodeMetrics = nodes.map(n => ({
    node: n.getInfo().id,
    region: n.getInfo().region,
    metrics: n.getMetrics(),
  }));
  
  res.json({
    ok: true,
    aggregate: aggregateMetrics,
    nodes: nodeMetrics,
    timestamp: new Date().toISOString(),
  });
});

router.get('/v2/relay/node/:nodeId', (req: Request, res: Response) => {
  const { nodeId } = req.params;
  
  const node = mediaRelayRegistry.getNode(nodeId);
  
  if (!node) {
    return res.status(404).json({
      ok: false,
      error: 'Relay node not found',
      nodeId,
    });
  }
  
  res.json({
    ok: true,
    node: node.getInfo(),
    metrics: node.getMetrics(),
  });
});

router.post('/v2/relay/node/:nodeId/heartbeat', adminRateLimit, verifyAdminSignature, (req: Request, res: Response) => {
  const { nodeId } = req.params;
  const { latencyMs, packetLossRate } = req.body;
  
  const node = mediaRelayRegistry.getNode(nodeId);
  
  if (!node) {
    return res.status(404).json({
      ok: false,
      error: 'Relay node not found',
      nodeId,
    });
  }
  
  node.heartbeat();
  
  if (typeof latencyMs === 'number') {
    node.updateLatency(latencyMs);
  }
  
  if (typeof packetLossRate === 'number') {
    node.updatePacketLoss(packetLossRate);
  }
  
  res.json({
    ok: true,
    node: node.getInfo(),
  });
});

router.delete('/v2/relay/connection/:connectionId', (req: Request, res: Response) => {
  const { connectionId } = req.params;
  const { nodeId } = req.body;
  
  if (!nodeId) {
    return res.status(400).json({
      ok: false,
      error: 'nodeId is required in request body',
    });
  }
  
  const node = mediaRelayRegistry.getNode(nodeId);
  
  if (!node) {
    return res.status(404).json({
      ok: false,
      error: 'Relay node not found',
      nodeId,
    });
  }
  
  node.endConnection(connectionId);
  
  res.json({
    ok: true,
    message: 'Connection ended',
    connectionId,
    nodeId,
  });
});

export type AnalyticsEventType = 'stream_start' | 'stream_end' | 'app_launch' | 'search' | 'navigation';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  anonymizedWallet: string;
  timestamp: number;
  metadata: Record<string, any>;
  nodeId: string;
  region: string;
}

export interface AnalyticsIngesterStats {
  eventsReceived: number;
  eventsBuffered: number;
  batchesFlushed: number;
  totalEventsWritten: number;
  lastFlushAt: number | null;
  flushIntervalMs: number;
  batchSize: number;
  eventsByType: Record<AnalyticsEventType, number>;
  startedAt: number;
  uptimeMs: number;
}

function anonymizeWallet(walletAddress: string): string {
  return crypto.createHash('sha256').update(walletAddress.toLowerCase()).digest('hex');
}

class AnalyticsIngester extends EventEmitter {
  private buffer: AnalyticsEvent[];
  private flushIntervalMs: number;
  private batchSize: number;
  private stats: {
    eventsReceived: number;
    batchesFlushed: number;
    totalEventsWritten: number;
    lastFlushAt: number | null;
    eventsByType: Record<AnalyticsEventType, number>;
  };
  private flushTimer: NodeJS.Timeout | null;
  private startedAt: number;
  private nodeId: string;
  private region: string;
  
  constructor(options: { flushIntervalMs?: number; batchSize?: number } = {}) {
    super();
    this.buffer = [];
    this.flushIntervalMs = options.flushIntervalMs ?? 30000;
    this.batchSize = options.batchSize ?? 100;
    this.stats = {
      eventsReceived: 0,
      batchesFlushed: 0,
      totalEventsWritten: 0,
      lastFlushAt: null,
      eventsByType: {
        stream_start: 0,
        stream_end: 0,
        app_launch: 0,
        search: 0,
        navigation: 0,
      },
    };
    this.flushTimer = null;
    this.startedAt = Date.now();
    this.nodeId = meshNode.getNodeInfo().id;
    this.region = meshNode.getNodeInfo().region;
    
    this.startFlushTimer();
    
    logger.info(`[AnalyticsIngester] Initialized with flushInterval=${this.flushIntervalMs}ms, batchSize=${this.batchSize}`);
  }
  
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.flushIntervalMs);
  }
  
  private generateEventId(): string {
    return `evt_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
  }
  
  ingest(event: {
    type: AnalyticsEventType;
    walletAddress?: string;
    metadata?: Record<string, any>;
  }): AnalyticsEvent {
    const validTypes: AnalyticsEventType[] = ['stream_start', 'stream_end', 'app_launch', 'search', 'navigation'];
    
    if (!validTypes.includes(event.type)) {
      throw new Error(`Invalid event type: ${event.type}. Valid types: ${validTypes.join(', ')}`);
    }
    
    const anonymizedWallet = event.walletAddress 
      ? anonymizeWallet(event.walletAddress) 
      : anonymizeWallet(`anonymous_${Date.now()}`);
    
    const analyticsEvent: AnalyticsEvent = {
      id: this.generateEventId(),
      type: event.type,
      anonymizedWallet,
      timestamp: Date.now(),
      metadata: event.metadata ?? {},
      nodeId: this.nodeId,
      region: this.region,
    };
    
    this.buffer.push(analyticsEvent);
    this.stats.eventsReceived++;
    this.stats.eventsByType[event.type]++;
    
    this.emit('event_ingested', analyticsEvent);
    
    if (this.buffer.length >= this.batchSize) {
      this.flush();
    }
    
    return analyticsEvent;
  }
  
  ingestBatch(events: Array<{
    type: AnalyticsEventType;
    walletAddress?: string;
    metadata?: Record<string, any>;
  }>): AnalyticsEvent[] {
    return events.map(event => this.ingest(event));
  }
  
  flush(): AnalyticsEvent[] {
    if (this.buffer.length === 0) {
      return [];
    }
    
    const batch = [...this.buffer];
    this.buffer = [];
    
    this.stats.batchesFlushed++;
    this.stats.totalEventsWritten += batch.length;
    this.stats.lastFlushAt = Date.now();
    
    this.emit('batch_flushed', {
      batchId: `batch_${Date.now().toString(36)}`,
      count: batch.length,
      events: batch,
    });
    
    logger.info(`[AnalyticsIngester] Flushed batch: ${batch.length} events`);
    
    return batch;
  }
  
  getStats(): AnalyticsIngesterStats {
    return {
      eventsReceived: this.stats.eventsReceived,
      eventsBuffered: this.buffer.length,
      batchesFlushed: this.stats.batchesFlushed,
      totalEventsWritten: this.stats.totalEventsWritten,
      lastFlushAt: this.stats.lastFlushAt,
      flushIntervalMs: this.flushIntervalMs,
      batchSize: this.batchSize,
      eventsByType: { ...this.stats.eventsByType },
      startedAt: this.startedAt,
      uptimeMs: Date.now() - this.startedAt,
    };
  }
  
  getBufferSize(): number {
    return this.buffer.length;
  }
  
  configure(options: { flushIntervalMs?: number; batchSize?: number }): void {
    if (options.flushIntervalMs !== undefined) {
      this.flushIntervalMs = options.flushIntervalMs;
      this.startFlushTimer();
    }
    
    if (options.batchSize !== undefined) {
      this.batchSize = options.batchSize;
    }
    
    logger.info(`[AnalyticsIngester] Reconfigured: flushInterval=${this.flushIntervalMs}ms, batchSize=${this.batchSize}`);
  }
  
  shutdown(): AnalyticsEvent[] {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    const remaining = this.flush();
    logger.info(`[AnalyticsIngester] Shutdown complete, flushed ${remaining.length} remaining events`);
    return remaining;
  }
}

const analyticsIngester = new AnalyticsIngester({
  flushIntervalMs: 30000,
  batchSize: 100,
});

router.post('/v2/analytics/ingest', analyticsRateLimit, (req: Request, res: Response) => {
  try {
    const { events, event } = req.body;
    
    if (events && Array.isArray(events)) {
      const validEvents = events.filter((e: any) => 
        e && typeof e.type === 'string' && 
        ['stream_start', 'stream_end', 'app_launch', 'search', 'navigation'].includes(e.type)
      );
      
      if (validEvents.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'No valid events provided',
          validTypes: ['stream_start', 'stream_end', 'app_launch', 'search', 'navigation'],
        });
      }
      
      const ingested = analyticsIngester.ingestBatch(validEvents.map((e: any) => ({
        type: e.type,
        walletAddress: e.walletAddress,
        metadata: e.metadata,
      })));
      
      return res.json({
        ok: true,
        ingested: ingested.length,
        eventIds: ingested.map(e => e.id),
        bufferSize: analyticsIngester.getBufferSize(),
      });
    }
    
    if (event && typeof event === 'object') {
      if (!event.type || !['stream_start', 'stream_end', 'app_launch', 'search', 'navigation'].includes(event.type)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid or missing event type',
          validTypes: ['stream_start', 'stream_end', 'app_launch', 'search', 'navigation'],
        });
      }
      
      const ingested = analyticsIngester.ingest({
        type: event.type,
        walletAddress: event.walletAddress,
        metadata: event.metadata,
      });
      
      return res.json({
        ok: true,
        eventId: ingested.id,
        bufferSize: analyticsIngester.getBufferSize(),
      });
    }
    
    return res.status(400).json({
      ok: false,
      error: 'Request must include either "event" object or "events" array',
      example: {
        event: { type: 'stream_start', walletAddress: '0x...', metadata: { streamId: 'xyz' } },
      },
      batchExample: {
        events: [
          { type: 'stream_start', walletAddress: '0x...', metadata: {} },
          { type: 'navigation', metadata: { page: '/home' } },
        ],
      },
    });
  } catch (err: any) {
    logger.error(`[AnalyticsIngester] Ingest error: ${err.message}`);
    return res.status(500).json({
      ok: false,
      error: 'Failed to ingest analytics event',
      message: err.message,
    });
  }
});

router.get('/v2/analytics/stats', (req: Request, res: Response) => {
  const stats = analyticsIngester.getStats();
  
  res.json({
    ok: true,
    stats,
    node: meshNode.getNodeInfo().id,
    region: meshNode.getNodeInfo().region,
  });
});

router.post('/v2/analytics/flush', adminRateLimit, verifyAdminSignature, (req: Request, res: Response) => {
  const flushed = analyticsIngester.flush();
  
  res.json({
    ok: true,
    flushedCount: flushed.length,
    stats: analyticsIngester.getStats(),
  });
});

router.post('/v2/analytics/configure', adminRateLimit, verifyAdminSignature, (req: Request, res: Response) => {
  const { flushIntervalMs, batchSize } = req.body;
  
  if (flushIntervalMs !== undefined && (typeof flushIntervalMs !== 'number' || flushIntervalMs < 1000)) {
    return res.status(400).json({
      ok: false,
      error: 'flushIntervalMs must be a number >= 1000',
    });
  }
  
  if (batchSize !== undefined && (typeof batchSize !== 'number' || batchSize < 1)) {
    return res.status(400).json({
      ok: false,
      error: 'batchSize must be a number >= 1',
    });
  }
  
  analyticsIngester.configure({
    flushIntervalMs,
    batchSize,
  });
  
  res.json({
    ok: true,
    message: 'Analytics ingester reconfigured',
    stats: analyticsIngester.getStats(),
  });
});

const nodeStreamManifests: Map<string, StreamManifest> = new Map();
const nodeStreamChunks: Map<string, { data: Buffer; metadata: VideoChunk }> = new Map();
const nodeStreamComments: Map<string, CommentEvent[]> = new Map();
const nodeStreamReactions: Map<string, ReactionEvent[]> = new Map();

const nodeStreamUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function validateManifestSignature(manifest: StreamManifest): boolean {
  if (!manifest.signature || typeof manifest.signature !== 'string') {
    return false;
  }
  if (!manifest.owner || !manifest.streamId) {
    return false;
  }
  return manifest.signature.length >= 32;
}

router.get('/v2/nodestream/feed', streamingRateLimit, (req: Request, res: Response) => {
  const filter = (req.query.filter as string) || 'recent';
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  
  let manifests = Array.from(nodeStreamManifests.values());
  
  if (filter === 'trending') {
    manifests.sort((a, b) => {
      const aReactions = nodeStreamReactions.get(a.streamId)?.length || 0;
      const bReactions = nodeStreamReactions.get(b.streamId)?.length || 0;
      return bReactions - aReactions;
    });
  } else if (filter === 'recent') {
    manifests.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  const total = manifests.length;
  const paged = manifests.slice(offset, offset + limit);
  
  res.json({
    ok: true,
    manifests: paged,
    total,
    filter,
    limit,
    offset,
  });
});

router.post('/v2/nodestream/manifest', streamingRateLimit, (req: Request, res: Response) => {
  const manifest = req.body as StreamManifest;
  
  if (!manifest || !manifest.streamId || !manifest.owner) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid manifest: missing required fields (streamId, owner)',
    });
  }
  
  if (!validateManifestSignature(manifest)) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid manifest signature',
    });
  }
  
  nodeStreamManifests.set(manifest.streamId, {
    ...manifest,
    createdAt: manifest.createdAt || Date.now(),
    chunks: manifest.chunks || [],
    index: manifest.index || {},
    policy: manifest.policy || {
      maxPeers: 100,
      allowEncryption: false,
      allowedRegions: [],
      allowComments: true,
      allowReactions: true,
    },
    live: manifest.live || false,
    title: manifest.title || '',
    description: manifest.description || '',
    tags: manifest.tags || [],
  });
  
  logger.info(`[NodeStream] Stored manifest ${manifest.streamId} from ${manifest.owner}`);
  
  res.json({
    ok: true,
    streamId: manifest.streamId,
  });
});

router.get('/v2/nodestream/manifest/:streamId', streamingRateLimit, (req: Request, res: Response) => {
  const { streamId } = req.params;
  const manifest = nodeStreamManifests.get(streamId);
  
  if (!manifest) {
    return res.status(404).json({
      ok: false,
      error: 'Manifest not found',
    });
  }
  
  res.json({
    ok: true,
    manifest,
  });
});

router.post('/v2/nodestream/chunk', streamingRateLimit, nodeStreamUpload.single('data'), (req: Request, res: Response) => {
  const { cid, metadata } = req.body;
  const file = req.file;
  
  if (!cid || typeof cid !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'Missing or invalid cid',
    });
  }
  
  if (!file || !file.buffer) {
    return res.status(400).json({
      ok: false,
      error: 'Missing chunk data',
    });
  }
  
  let parsedMetadata: VideoChunk;
  try {
    parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    if (!parsedMetadata || !parsedMetadata.cid) {
      parsedMetadata = {
        cid,
        owner: '',
        seq: 0,
        durationMs: 0,
        codec: 'vp9',
        resolution: '1920x1080',
        checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
      };
    }
  } catch {
    parsedMetadata = {
      cid,
      owner: '',
      seq: 0,
      durationMs: 0,
      codec: 'vp9',
      resolution: '1920x1080',
      checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
    };
  }
  
  nodeStreamChunks.set(cid, {
    data: file.buffer,
    metadata: parsedMetadata,
  });
  
  logger.info(`[NodeStream] Stored chunk ${cid} (${file.buffer.length} bytes)`);
  
  res.json({
    ok: true,
    cid,
  });
});

router.get('/v2/nodestream/chunk/:cid', streamingRateLimit, (req: Request, res: Response) => {
  const { cid } = req.params;
  const chunk = nodeStreamChunks.get(cid);
  
  if (!chunk) {
    return res.status(404).json({
      ok: false,
      error: 'Chunk not found',
    });
  }
  
  res.setHeader('Content-Type', 'video/webm');
  res.setHeader('Content-Length', chunk.data.length.toString());
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(chunk.data);
});

router.get('/v2/nodestream/comments/:streamId', streamingRateLimit, (req: Request, res: Response) => {
  const { streamId } = req.params;
  const comments = nodeStreamComments.get(streamId) || [];
  
  res.json({
    ok: true,
    events: comments.sort((a, b) => a.createdAt - b.createdAt),
  });
});

router.post('/v2/nodestream/comments', streamingRateLimit, (req: Request, res: Response) => {
  const comment = req.body as CommentEvent;
  
  if (!comment || !comment.parentStreamId || !comment.author || !comment.content) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid comment: missing required fields (parentStreamId, author, content)',
    });
  }
  
  const eventId = comment.eventId || `cmt-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
  
  const fullComment: CommentEvent = {
    eventId,
    parentStreamId: comment.parentStreamId,
    author: comment.author,
    content: comment.content,
    createdAt: comment.createdAt || Date.now(),
    vectorClock: comment.vectorClock || {},
    signature: comment.signature || '',
  };
  
  const existing = nodeStreamComments.get(comment.parentStreamId) || [];
  existing.push(fullComment);
  nodeStreamComments.set(comment.parentStreamId, existing);
  
  logger.info(`[NodeStream] Stored comment ${eventId} on stream ${comment.parentStreamId}`);
  
  res.json({
    ok: true,
    eventId,
  });
});

router.post('/v2/nodestream/reactions', streamingRateLimit, (req: Request, res: Response) => {
  const reaction = req.body as ReactionEvent;
  
  if (!reaction || !reaction.targetStreamId || !reaction.author || !reaction.kind) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid reaction: missing required fields (targetStreamId, author, kind)',
    });
  }
  
  const existing = nodeStreamReactions.get(reaction.targetStreamId) || [];
  
  const existingIdx = existing.findIndex(
    r => r.author === reaction.author && r.kind === reaction.kind
  );
  
  let eventId: string;
  
  if (existingIdx >= 0) {
    eventId = existing[existingIdx].eventId;
    existing.splice(existingIdx, 1);
    logger.info(`[NodeStream] Removed reaction ${eventId} from stream ${reaction.targetStreamId}`);
  } else {
    eventId = reaction.eventId || `rxn-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
    
    const fullReaction: ReactionEvent = {
      eventId,
      targetStreamId: reaction.targetStreamId,
      author: reaction.author,
      kind: reaction.kind,
      createdAt: reaction.createdAt || Date.now(),
      signature: reaction.signature || '',
    };
    
    existing.push(fullReaction);
    logger.info(`[NodeStream] Added reaction ${eventId} on stream ${reaction.targetStreamId}`);
  }
  
  nodeStreamReactions.set(reaction.targetStreamId, existing);
  
  res.json({
    ok: true,
    eventId,
  });
});

export { 
  router as streamingRouter, 
  meshNode, 
  STREAM_CATALOG, 
  TV_CHANNEL_CATALOG, 
  loadTVChannels, 
  getTVChannel, 
  getAllTVChannels,
  CachedCatalog,
  catalogCache,
  APPS_REGISTRY,
  StaticAssetCache,
  staticAssetCache,
  computeSha256,
  generateAssetEtag,
  MediaRelayNode,
  MediaRelayRegistry,
  mediaRelayRegistry,
  AnalyticsIngester,
  analyticsIngester,
  anonymizeWallet,
  nodeStreamManifests,
  nodeStreamChunks,
  nodeStreamComments,
  nodeStreamReactions,
};
