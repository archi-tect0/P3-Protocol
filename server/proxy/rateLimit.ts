import type { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

interface ProviderLimits {
  windowMs: number;
  max: number;
}

const LIMITS: Record<string, ProviderLimits> = {
  google: { windowMs: 60_000, max: 800 },
  slack: { windowMs: 60_000, max: 300 },
  spotify: { windowMs: 60_000, max: 200 },
  discord: { windowMs: 60_000, max: 300 },
  github: { windowMs: 60_000, max: 500 },
  notion: { windowMs: 60_000, max: 300 },
  twitter: { windowMs: 60_000, max: 100 },
  default: { windowMs: 60_000, max: 200 },
};

const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;

if (redisUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    redis.on('error', (err) => {
      console.error('[RateLimit] Redis error:', err.message);
    });
  } catch (error) {
    console.warn('[RateLimit] Redis connection failed, using in-memory fallback');
    redis = null;
  }
}

interface InMemoryEntry {
  count: number;
  resetAt: number;
}

const inMemory: Map<string, InMemoryEntry> = new Map();

function getKey(provider: string, walletAddr?: string): string {
  return walletAddr ? `rl:${provider}:${walletAddr.toLowerCase()}` : `rl:${provider}`;
}

export function applyRateLimit(provider: string) {
  const limits = LIMITS[provider] || LIMITS.default;

  return async (req: Request, res: Response, next: NextFunction) => {
    const walletAddr = (req.headers['x-wallet'] as string) || (req.query.wallet as string) || (req.body?.wallet as string);
    const key = getKey(provider, walletAddr);
    const now = Date.now();

    try {
      if (redis) {
        const ttl = Math.floor(limits.windowMs / 1000);
        const tx = redis.multi();
        tx.incr(key);
        tx.expire(key, ttl);
        const results = await tx.exec();
        
        if (results) {
          const count = Number(results[0]?.[1]) || 0;
          
          res.setHeader('X-RateLimit-Limit', limits.max.toString());
          res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.max - count).toString());
          
          if (count > limits.max) {
            res.status(429).json({ 
              error: `Rate limit exceeded for ${provider}`,
              retryAfter: ttl,
            });
            return;
          }
        }
        return next();
      } else {
        const cur = inMemory.get(key);
        
        if (!cur || cur.resetAt < now) {
          inMemory.set(key, { count: 1, resetAt: now + limits.windowMs });
          res.setHeader('X-RateLimit-Limit', limits.max.toString());
          res.setHeader('X-RateLimit-Remaining', (limits.max - 1).toString());
          return next();
        }
        
        cur.count += 1;
        
        res.setHeader('X-RateLimit-Limit', limits.max.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limits.max - cur.count).toString());
        
        if (cur.count > limits.max) {
          const retryAfter = Math.ceil((cur.resetAt - now) / 1000);
          res.status(429).json({ 
            error: `Rate limit exceeded for ${provider}`,
            retryAfter,
          });
          return;
        }
        
        return next();
      }
    } catch (error) {
      console.error('[RateLimit] Error:', error);
      return next();
    }
  };
}

export function getRateLimitStatus(provider: string, walletAddr?: string): {
  remaining: number;
  limit: number;
  resetAt: number;
} {
  const limits = LIMITS[provider] || LIMITS.default;
  const key = getKey(provider, walletAddr);
  const now = Date.now();
  
  const cur = inMemory.get(key);
  
  if (!cur || cur.resetAt < now) {
    return {
      remaining: limits.max,
      limit: limits.max,
      resetAt: now + limits.windowMs,
    };
  }
  
  return {
    remaining: Math.max(0, limits.max - cur.count),
    limit: limits.max,
    resetAt: cur.resetAt,
  };
}

export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of inMemory.entries()) {
    if (entry.resetAt < now) {
      inMemory.delete(key);
    }
  }
}

setInterval(cleanupExpiredEntries, 60_000);

export function getProviderLimits(provider: string): ProviderLimits {
  return LIMITS[provider] || LIMITS.default;
}

export function setProviderLimits(provider: string, limits: ProviderLimits): void {
  LIMITS[provider] = limits;
}
