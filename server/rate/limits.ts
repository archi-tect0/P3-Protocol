import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function rateLimitHandler(req: Request, res: Response): void {
  res.status(429).json({
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

export const apiLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    return `api:${getClientIp(req)}`;
  },
});

export const anchorLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const wallet = req.headers['x-wallet'] as string;
    if (wallet) {
      return `anchor:wallet:${wallet.toLowerCase()}`;
    }
    return `anchor:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK Crypto Rate Limiter
 * 
 * More restrictive limits for cryptographic operations:
 * - 100 requests per minute per wallet (prevents abuse)
 * - Falls back to IP-based limiting if no wallet
 */
export const sdkCryptoLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000, // 1 minute window
  max: 100, // 100 requests per minute per wallet
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:crypto:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:crypto:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK Session Rate Limiter
 * 
 * Limits session operations:
 * - 30 requests per minute per IP (prevents brute force)
 */
export const sdkSessionLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    return `sdk:session:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK Anchor Rate Limiter
 * 
 * Limits anchor operations:
 * - 200 requests per minute per wallet (allows batch processing)
 * - Falls back to IP-based limiting if no wallet
 */
export const sdkAnchorLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:anchor:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:anchor:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK ZK Proof Rate Limiter
 * 
 * More restrictive limits for ZK proof generation (expensive operations):
 * - 20 requests per minute per wallet
 * - Falls back to IP-based limiting if no wallet
 */
export const sdkZKLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:zk:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:zk:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK DAO Rate Limiter
 * 
 * Limits DAO operations:
 * - 60 requests per minute per wallet
 */
export const sdkDAOLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:dao:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:dao:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK Media Rate Limiter
 * 
 * Limits media operations (uploads, calls):
 * - 50 requests per minute per wallet
 */
export const sdkMediaLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:media:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:media:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK Identity Rate Limiter
 * 
 * Limits identity operations:
 * - 60 requests per minute per wallet
 */
export const sdkIdentityLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:identity:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:identity:ip:${getClientIp(req)}`;
  },
});

/**
 * SDK Ticket Rate Limiter
 * 
 * Limits ticket operations (grant, check, revoke):
 * - 30 requests per minute per IP (prevents abuse)
 */
export const sdkTicketLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req: Request): string => {
    const sdkUser = (req as any).sdkUser;
    if (sdkUser?.wallet) {
      return `sdk:ticket:wallet:${sdkUser.wallet.toLowerCase()}`;
    }
    return `sdk:ticket:ip:${getClientIp(req)}`;
  },
});
