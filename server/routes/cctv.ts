import { Router, Request, Response } from 'express';
import { rootLogger } from '../observability/logger';
import { getRedisClient } from '../redis/client';

const logger = rootLogger.child({ module: 'cctv' });
const router = Router();

// Redis cache for JPEG images - prevents hammering upstream APIs
const JPEG_CACHE_TTL = 15; // Cache images for 15 seconds
const jpegFetchInProgress = new Map<string, Promise<Buffer | null>>(); // Request coalescing

async function getCachedJpeg(streamId: string, endpoint: string): Promise<{ data: Buffer | null; fromCache: boolean }> {
  const redis = getRedisClient();
  const cacheKey = `cctv:jpeg:${streamId}`;
  
  try {
    // Check Redis cache first
    const cached = await redis.getBuffer(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true };
    }
  } catch (err) {
    logger.debug(`Redis cache miss for ${streamId}: ${err}`);
  }
  
  // Check if fetch is already in progress (request coalescing)
  const inProgress = jpegFetchInProgress.get(streamId);
  if (inProgress) {
    const data = await inProgress;
    return { data, fromCache: false };
  }
  
  // Fetch from upstream with coalescing
  const fetchPromise = (async (): Promise<Buffer | null> => {
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        return null;
      }
      
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Cache in Redis
      try {
        await redis.setex(cacheKey, JPEG_CACHE_TTL, buffer);
      } catch (cacheErr) {
        logger.debug(`Failed to cache JPEG for ${streamId}: ${cacheErr}`);
      }
      
      return buffer;
    } catch (err) {
      logger.error(`JPEG fetch error for ${streamId}: ${err}`);
      return null;
    } finally {
      jpegFetchInProgress.delete(streamId);
    }
  })();
  
  jpegFetchInProgress.set(streamId, fetchPromise);
  const data = await fetchPromise;
  return { data, fromCache: false };
}

export interface CCTVStream {
  id: string;
  name: string;
  location: string;
  endpoint: string;
  type: 'mjpeg' | 'jpeg' | 'hls' | 'embed';
  category: 'traffic' | 'weather' | 'public' | 'nature' | 'industrial' | 'gaming';
  status: 'live' | 'offline' | 'unknown';
  embedProvider?: 'twitch' | 'youtube' | 'steam';
  provider: string;
  country: string;
  metrics: {
    latency: number;
    uptime: number;
    frameRate: number;
    lastCheck: number;
    healthy: boolean;
  };
}

interface CaltransCamera {
  cctv: {
    index: string;
    location: {
      district: string;
      locationName: string;
      nearbyPlace: string;
      longitude: string;
      latitude: string;
      route: string;
      county: string;
    };
    inService: string;
    imageData: {
      static: {
        currentImageURL: string;
      };
    };
  };
}

interface CaltransResponse {
  data: CaltransCamera[];
}

interface ClientConnection {
  id: string;
  lastHeartbeat: number;
  streamId: string;
  subscriptionToken: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface AnalyticsCache {
  data: Record<string, unknown>;
  lastUpdate: number;
  subscribers: Set<string>;
}

const streamCache: { streams: CCTVStream[]; lastFetch: number; validated: boolean } = {
  streams: [],
  lastFetch: 0,
  validated: false
};

const activeConnections = new Map<string, ClientConnection>();
const rateLimitMap = new Map<string, RateLimitEntry>();
const analyticsCache: AnalyticsCache = {
  data: {},
  lastUpdate: 0,
  subscribers: new Set()
};
const requestQueue = new Map<string, number>();

const CACHE_TTL = 10 * 60 * 1000;
const HEARTBEAT_TIMEOUT = 15000; // Reduced from 60s to 15s for faster stale cleanup
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX_REQUESTS = 200; // Increased from 100 to 200 with Redis caching
const QUEUE_DEPTH_THRESHOLD = 50;
const ANALYTICS_CACHE_TTL = 5000;

let circuitBreakerOpen = false;
let circuitBreakerResetTime = 0;

function getClientId(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0] : req.ip || 'unknown';
  return `${ip}-${req.headers['user-agent']?.slice(0, 50) || 'unknown'}`;
}

function checkRateLimit(clientId: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(clientId);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW };
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetIn: entry.resetTime - now };
}

function checkCircuitBreaker(): boolean {
  const now = Date.now();
  
  if (circuitBreakerOpen && now > circuitBreakerResetTime) {
    circuitBreakerOpen = false;
    logger.info('Circuit breaker reset');
  }
  
  let totalQueueDepth = 0;
  requestQueue.forEach((depth) => {
    totalQueueDepth += depth;
  });
  
  if (totalQueueDepth > QUEUE_DEPTH_THRESHOLD && !circuitBreakerOpen) {
    circuitBreakerOpen = true;
    circuitBreakerResetTime = now + 30000;
    logger.warn(`Circuit breaker triggered: queue depth ${totalQueueDepth} exceeds threshold ${QUEUE_DEPTH_THRESHOLD}`);
  }
  
  return circuitBreakerOpen;
}

function cleanupStaleConnections(): void {
  const now = Date.now();
  let cleaned = 0;
  
  activeConnections.forEach((conn, id) => {
    if (now - conn.lastHeartbeat > HEARTBEAT_TIMEOUT) {
      activeConnections.delete(id);
      analyticsCache.subscribers.delete(id);
      cleaned++;
    }
  });
  
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} stale connections`);
  }
}

setInterval(cleanupStaleConnections, 30000);

setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  });
}, 60000);

function getSharedAnalytics(): Record<string, unknown> {
  const now = Date.now();
  
  if (now - analyticsCache.lastUpdate < ANALYTICS_CACHE_TTL && Object.keys(analyticsCache.data).length > 0) {
    return analyticsCache.data;
  }
  
  const streams = streamCache.streams;
  const analytics = {
    totalStreams: streams.length,
    healthyStreams: streams.filter(s => s.metrics.healthy).length,
    byCategory: {} as Record<string, number>,
    byProvider: {} as Record<string, number>,
    byCountry: {} as Record<string, number>,
    avgUptime: 0,
    activeConnections: activeConnections.size,
    subscriberCount: analyticsCache.subscribers.size,
    lastUpdate: now
  };
  
  let totalUptime = 0;
  streams.forEach(s => {
    analytics.byCategory[s.category] = (analytics.byCategory[s.category] || 0) + 1;
    analytics.byProvider[s.provider] = (analytics.byProvider[s.provider] || 0) + 1;
    analytics.byCountry[s.country] = (analytics.byCountry[s.country] || 0) + 1;
    totalUptime += s.metrics.uptime;
  });
  
  analytics.avgUptime = streams.length > 0 ? totalUptime / streams.length : 0;
  
  analyticsCache.data = analytics;
  analyticsCache.lastUpdate = now;
  
  return analytics;
}

async function validateCamera(stream: CCTVStream): Promise<boolean> {
  try {
    const response = await fetch(stream.endpoint, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    try {
      const response = await fetch(stream.endpoint, {
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        return contentType.includes('image') || contentType.includes('multipart');
      }
      return false;
    } catch {
      return false;
    }
  }
}

const STATIC_CAMERAS: CCTVStream[] = [
  { id: 'wsdot-1', name: 'I-5 Mercer Street', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc16571.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-2', name: 'I-5 Ship Canal Bridge', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc16645.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-3', name: 'I-5 NE 45th St', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc16818.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-4', name: 'I-5 James St', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc16435.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-5', name: 'I-90 Rainier Ave', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/090vc03854.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-6', name: 'I-5 SR-16', location: 'Tacoma, WA', endpoint: 'https://images.wsdot.wa.gov/sw/005vc13251.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-7', name: 'I-5 Seneca St', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc16390.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-8', name: 'I-5 Spokane St', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc16207.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-9', name: 'SR-520 Montlake', location: 'Seattle, WA', endpoint: 'https://images.wsdot.wa.gov/nw/520vc00180.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-10', name: 'I-405 NE 8th St', location: 'Bellevue, WA', endpoint: 'https://images.wsdot.wa.gov/nw/405vc02500.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-11', name: 'I-5 US-2', location: 'Everett, WA', endpoint: 'https://images.wsdot.wa.gov/nw/005vc19281.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-12', name: 'I-5 US-101', location: 'Olympia, WA', endpoint: 'https://images.wsdot.wa.gov/sw/005vc10466.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-13', name: 'I-5 Mill Plain', location: 'Vancouver, WA', endpoint: 'https://images.wsdot.wa.gov/sw/005vc00187.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-14', name: 'I-90 Division St', location: 'Spokane, WA', endpoint: 'https://images.wsdot.wa.gov/rw/090vc28282.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'wsdot-15', name: 'I-82 US-97', location: 'Yakima, WA', endpoint: 'https://images.wsdot.wa.gov/sc/082vc03025.jpg', type: 'jpeg', category: 'traffic', status: 'live', provider: 'WSDOT', country: 'USA', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'japan-1', name: 'Urban Residence', location: 'Tokyo', endpoint: 'http://61.211.241.239/nphMotionJpeg?Resolution=320x240&Quality=Standard', type: 'mjpeg', category: 'public', status: 'live', provider: 'Japan Public', country: 'Japan', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'japan-2', name: 'Mountain Village', location: 'Tsumago', endpoint: 'http://honjin1.miemasu.net/nphMotionJpeg?Resolution=640x480&Quality=Standard', type: 'mjpeg', category: 'nature', status: 'live', provider: 'Japan Public', country: 'Japan', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
  { id: 'norway-1', name: 'Ski Station', location: 'Kaiskuru', endpoint: 'http://77.222.181.11:8080/mjpg/video.mjpg', type: 'mjpeg', category: 'nature', status: 'live', provider: 'Nordic Cams', country: 'Norway', metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true } },
];

async function fetchCaltransCameras(district: string): Promise<CCTVStream[]> {
  try {
    const response = await fetch(`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${district.padStart(2, '0')}.json`, {
      signal: AbortSignal.timeout(15000)
    });
    
    if (!response.ok) {
      logger.warn(`Caltrans D${district} fetch failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json() as CaltransResponse;
    const cameras: CCTVStream[] = [];
    
    const districtNames: Record<string, string> = {
      '3': 'Sacramento', '4': 'Bay Area', '5': 'Central Coast', '6': 'Fresno',
      '7': 'Los Angeles', '8': 'San Bernardino', '10': 'Stockton', '11': 'San Diego', '12': 'Orange County'
    };
    
    for (const item of data.data.slice(0, 20)) {
      const cam = item.cctv;
      if (cam.inService !== 'true') continue;
      
      const imageUrl = cam.imageData?.static?.currentImageURL;
      if (!imageUrl) continue;
      
      cameras.push({
        id: `caltrans-d${district}-${cam.index}`,
        name: cam.location.locationName.replace(/^\([^)]+\)\s*/, '').replace(/^TV\d+\s*--\s*/, '').substring(0, 40),
        location: `${cam.location.nearbyPlace || cam.location.county}, CA`,
        endpoint: imageUrl,
        type: 'jpeg',
        category: 'traffic',
        status: 'live',
        provider: `Caltrans ${districtNames[district] || `D${district}`}`,
        country: 'USA',
        metrics: { latency: 0, uptime: 100, frameRate: 0, lastCheck: Date.now(), healthy: true }
      });
    }
    
    return cameras;
  } catch (err) {
    logger.error(`Caltrans D${district} error: ${err}`);
    return [];
  }
}

async function validateBatch(cameras: CCTVStream[], batchSize: number = 10): Promise<CCTVStream[]> {
  const validated: CCTVStream[] = [];
  
  for (let i = 0; i < cameras.length; i += batchSize) {
    const batch = cameras.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (cam) => {
        const healthy = await validateCamera(cam);
        return { ...cam, metrics: { ...cam.metrics, healthy, lastCheck: Date.now() } };
      })
    );
    validated.push(...results.filter(c => c.metrics.healthy));
  }
  
  return validated;
}

async function fetchAllStreams(): Promise<CCTVStream[]> {
  const now = Date.now();
  
  if (streamCache.streams.length > 0 && (now - streamCache.lastFetch) < CACHE_TTL) {
    return streamCache.streams;
  }
  
  logger.info('Fetching fresh CCTV streams from providers...');
  
  const caltransPromises = ['3', '4', '5', '6', '7', '8', '10', '11', '12'].map(d => fetchCaltransCameras(d));
  const caltransResults = await Promise.all(caltransPromises);
  const allCaltrans = caltransResults.flat();
  
  logger.info(`Validating ${allCaltrans.length} Caltrans cameras...`);
  const validatedCaltrans = await validateBatch(allCaltrans, 20);
  logger.info(`Caltrans validation: ${validatedCaltrans.length}/${allCaltrans.length} healthy`);
  
  logger.info(`Validating ${STATIC_CAMERAS.length} static cameras...`);
  const validatedStatic = await validateBatch(STATIC_CAMERAS, 10);
  logger.info(`Static validation: ${validatedStatic.length}/${STATIC_CAMERAS.length} healthy`);
  
  const allCameras = [...validatedStatic, ...validatedCaltrans];
  
  streamCache.streams = allCameras;
  streamCache.lastFetch = now;
  streamCache.validated = true;
  
  logger.info(`Loaded ${allCameras.length} verified CCTV streams`);
  
  return allCameras;
}

router.use((req: Request, res: Response, next) => {
  const clientId = getClientId(req);
  const rateLimit = checkRateLimit(clientId);
  
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000).toString());
  
  if (!rateLimit.allowed) {
    logger.warn(`Rate limit exceeded for client: ${clientId}`);
    return res.status(429).json({ 
      success: false, 
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil(rateLimit.resetIn / 1000)
    });
  }
  
  if (checkCircuitBreaker()) {
    return res.status(503).json({ 
      success: false, 
      error: 'Service temporarily unavailable',
      retryAfter: Math.ceil((circuitBreakerResetTime - Date.now()) / 1000)
    });
  }
  
  next();
});

router.post('/subscribe', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { streamId, token } = req.body;
  
  if (!streamId || !token) {
    return res.status(400).json({ success: false, error: 'Missing streamId or token' });
  }
  
  const existingConnection = activeConnections.get(clientId);
  if (existingConnection && existingConnection.subscriptionToken === token) {
    existingConnection.lastHeartbeat = Date.now();
    return res.json({ success: true, status: 'already_subscribed' });
  }
  
  activeConnections.set(clientId, {
    id: clientId,
    lastHeartbeat: Date.now(),
    streamId,
    subscriptionToken: token
  });
  
  analyticsCache.subscribers.add(clientId);
  
  logger.debug(`Client ${clientId} subscribed to stream ${streamId}`);
  
  res.json({ 
    success: true, 
    status: 'subscribed',
    connectionId: clientId
  });
});

router.post('/unsubscribe', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { token } = req.body;
  
  const connection = activeConnections.get(clientId);
  if (connection && connection.subscriptionToken === token) {
    activeConnections.delete(clientId);
    analyticsCache.subscribers.delete(clientId);
    logger.debug(`Client ${clientId} unsubscribed`);
    return res.json({ success: true, status: 'unsubscribed' });
  }
  
  res.json({ success: true, status: 'not_found' });
});

// Immediate cleanup endpoint - called when CCTV mode unmounts
router.post('/cleanup', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  
  // Remove all connections for this client immediately
  activeConnections.delete(clientId);
  analyticsCache.subscribers.delete(clientId);
  requestQueue.delete(clientId);
  rateLimitMap.delete(clientId);
  
  logger.debug(`Client ${clientId} cleanup completed`);
  res.json({ success: true, status: 'cleaned' });
});

router.post('/heartbeat', (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const { token } = req.body;
  
  const connection = activeConnections.get(clientId);
  if (connection && connection.subscriptionToken === token) {
    connection.lastHeartbeat = Date.now();
    return res.json({ success: true, status: 'ok' });
  }
  
  res.status(404).json({ success: false, error: 'Connection not found' });
});

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = getSharedAnalytics();
    res.json({ success: true, analytics });
  } catch (err) {
    logger.error(`Failed to get analytics: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to get analytics' });
  }
});

router.get('/connections', (req: Request, res: Response) => {
  res.json({
    success: true,
    activeConnections: activeConnections.size,
    subscribers: analyticsCache.subscribers.size,
    circuitBreakerOpen,
    queueDepth: Array.from(requestQueue.values()).reduce((a, b) => a + b, 0)
  });
});

router.get('/streams', async (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const currentDepth = requestQueue.get(clientId) || 0;
  requestQueue.set(clientId, currentDepth + 1);
  
  try {
    const { category, country } = req.query;
    
    let streams = await fetchAllStreams();
    
    if (category && category !== 'all') {
      streams = streams.filter(s => s.category === category);
    }
    if (country && country !== 'all') {
      streams = streams.filter(s => s.country === country);
    }
    
    logger.info(`CCTV: ${streams.length} streams (category: ${category || 'all'}, country: ${country || 'all'})`);
    
    res.json({
      success: true,
      count: streams.length,
      streams: streams.map(s => ({
        ...s,
        proxyEndpoint: `/api/atlas/cctv/proxy/${s.id}`
      }))
    });
  } catch (err) {
    logger.error(`Failed to fetch streams: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to load streams' });
  } finally {
    const depth = requestQueue.get(clientId) || 1;
    if (depth <= 1) {
      requestQueue.delete(clientId);
    } else {
      requestQueue.set(clientId, depth - 1);
    }
  }
});

router.get('/streams/:id', async (req: Request, res: Response) => {
  try {
    const streams = await fetchAllStreams();
    const stream = streams.find(s => s.id === req.params.id);
    
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    
    res.json({
      success: true,
      stream: {
        ...stream,
        proxyEndpoint: `/api/atlas/cctv/proxy/${stream.id}`
      }
    });
  } catch (err) {
    logger.error(`Failed to fetch stream: ${err}`);
    res.status(500).json({ success: false, error: 'Failed to load stream' });
  }
});

router.get('/proxy/:id', async (req: Request, res: Response) => {
  const clientId = getClientId(req);
  const currentDepth = requestQueue.get(clientId) || 0;
  requestQueue.set(clientId, currentDepth + 1);
  
  try {
    const streams = await fetchAllStreams();
    const stream = streams.find(s => s.id === req.params.id);
    
    if (!stream) {
      return res.status(404).json({ success: false, error: 'Stream not found' });
    }
    
    if (stream.type === 'mjpeg') {
      res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=--myboundary');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      const controller = new AbortController();
      const heartbeatTimeout = setTimeout(() => {
        logger.debug(`Heartbeat timeout for stream ${stream.id}, closing connection`);
        controller.abort();
      }, HEARTBEAT_TIMEOUT);
      
      try {
        const response = await fetch(stream.endpoint, {
          signal: controller.signal,
          headers: { 'Accept': 'multipart/x-mixed-replace' }
        });
        
        if (!response.ok || !response.body) {
          clearTimeout(heartbeatTimeout);
          return res.status(502).json({ success: false, error: 'Stream unavailable' });
        }
        
        const reader = response.body.getReader();
        
        req.on('close', () => {
          clearTimeout(heartbeatTimeout);
          reader.cancel();
          const depth = requestQueue.get(clientId) || 1;
          if (depth <= 1) {
            requestQueue.delete(clientId);
          } else {
            requestQueue.set(clientId, depth - 1);
          }
        });
        
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch {
            logger.debug(`MJPEG stream ended: ${stream.id}`);
          } finally {
            clearTimeout(heartbeatTimeout);
          }
        };
        
        pump();
      } catch (err) {
        clearTimeout(heartbeatTimeout);
        logger.error(`MJPEG proxy error for ${stream.id}: ${err}`);
        return res.status(502).json({ success: false, error: 'Stream connection failed' });
      }
    } else if (stream.type === 'jpeg') {
      try {
        // Use Redis-cached JPEG with request coalescing
        const { data, fromCache } = await getCachedJpeg(stream.id, stream.endpoint);
        
        if (!data) {
          return res.status(502).json({ success: false, error: 'Image unavailable' });
        }
        
        res.setHeader('Content-Type', 'image/jpeg');
        // Allow browser caching for 10 seconds to reduce requests
        res.setHeader('Cache-Control', fromCache ? 'public, max-age=10' : 'public, max-age=5');
        res.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');
        res.send(data);
      } catch (err) {
        logger.error(`JPEG proxy error for ${stream.id}: ${err}`);
        return res.status(502).json({ success: false, error: 'Image fetch failed' });
      } finally {
        const depth = requestQueue.get(clientId) || 1;
        if (depth <= 1) {
          requestQueue.delete(clientId);
        } else {
          requestQueue.set(clientId, depth - 1);
        }
      }
    } else {
      res.status(400).json({ success: false, error: 'Unsupported stream type' });
    }
  } catch (err) {
    logger.error(`Proxy error: ${err}`);
    res.status(500).json({ success: false, error: 'Internal proxy error' });
  }
});

router.get('/health', async (req: Request, res: Response) => {
  try {
    const streams = await fetchAllStreams();
    const now = Date.now();
    const healthyStreams = streams.filter(s => s.metrics.healthy);
    const providers = [...new Set(streams.map(s => s.provider))];
    const countries = [...new Set(streams.map(s => s.country))];
    
    res.json({
      success: true,
      totalStreams: streams.length,
      healthyStreams: healthyStreams.length,
      categories: [...new Set(streams.map(s => s.category))],
      providers,
      countries,
      lastCheck: now,
      cacheAge: now - streamCache.lastFetch,
      validated: streamCache.validated,
      activeConnections: activeConnections.size,
      subscriberCount: analyticsCache.subscribers.size,
      circuitBreakerOpen,
      rateLimitEntriesCount: rateLimitMap.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Health check failed' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  streamCache.lastFetch = 0;
  streamCache.validated = false;
  const streams = await fetchAllStreams();
  res.json({ success: true, count: streams.length, validated: streamCache.validated });
});

export default router;
