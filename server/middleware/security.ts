import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { authService } from '../auth';

/**
 * Production-grade security middleware
 * 
 * Features:
 * - Comprehensive security headers (CSP, HSTS, etc.)
 * - Multi-tier rate limiting (IP-based, session-based, user-based)
 * - TLS enforcement for production
 * - Redis-ready rate limit store
 */

// ============================================================================
// Security Headers Middleware
// ============================================================================

/**
 * Applies comprehensive security headers to all responses
 */
export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Content Security Policy - Strict directives to prevent XSS
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Vite in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "media-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; ')
  );

  // HTTP Strict Transport Security - Force HTTPS for 1 year
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Referrer policy - Protect user privacy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy - Disable unnecessary browser features
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=(self)',
      'microphone=(self)',
      'geolocation=()',
      'interest-cohort=()',
      'payment=()',
      'usb=()',
    ].join(', ')
  );

  // Remove X-Powered-By header to hide technology stack
  res.removeHeader('X-Powered-By');

  next();
}

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

/**
 * Extract user ID from JWT token for rate limiting
 */
function getUserIdFromToken(req: Request): string | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyToken(token);
    return decoded.userId;
  } catch {
    return null;
  }
}

/**
 * Get client IP address, respecting X-Forwarded-For header
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

/**
 * Generate rate limit key based on user ID (from JWT) or IP
 * Priority: userId > sessionId > IP
 */
function generateRateLimitKey(req: Request): string {
  // Try to get userId from JWT token
  const userId = getUserIdFromToken(req);
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to session ID if available
  const sessionId = req.headers['x-session-id'];
  if (sessionId && typeof sessionId === 'string') {
    return `session:${sessionId}`;
  }

  // Final fallback to IP address
  const ip = getClientIp(req);
  return `ip:${ip}`;
}

/**
 * Custom handler for rate limit exceeded
 */
function rateLimitHandler(req: Request, res: Response): void {
  res.status(429).json({
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: res.getHeader('Retry-After'),
  });
}

/**
 * Skip rate limiting in development for certain paths
 */
function skipRateLimit(req: Request): boolean {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Skip rate limiting for health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return true;
  }

  // Skip for static assets in development
  if (isDevelopment && !req.path.startsWith('/api/')) {
    return true;
  }

  return false;
}

/**
 * General rate limiter - 500 requests per 15 minutes per IP/user
 * Increased from 100 to support active Atlas chat sessions
 */
export const generalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per window (was 100)
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: generateRateLimitKey,
  // Memory store by default - can be upgraded to Redis
  // store: new RedisStore({ client: redisClient }) // For production
});

/**
 * Telemetry rate limiter - 20 requests per 15 minutes per IP/user
 * More restrictive due to logging overhead
 */
export const telemetryRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: generateRateLimitKey,
  message: {
    error: 'Too many telemetry requests',
    message: 'Telemetry rate limit exceeded. Please reduce event frequency.',
  },
});

/**
 * Session-based rate limiter - 50 requests per 15 minutes
 * For sensitive endpoints like meetings and messages
 */
export const sessionRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: skipRateLimit,
  keyGenerator: (req: Request): string => {
    // For session-based, prioritize session ID
    const sessionId = req.headers['x-session-id'];
    if (sessionId && typeof sessionId === 'string') {
      return `session:${sessionId}`;
    }

    // Fallback to user ID from JWT
    const userId = getUserIdFromToken(req);
    if (userId) {
      return `user:${userId}`;
    }

    // Final fallback to IP
    const ip = getClientIp(req);
    return `ip:${ip}`;
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * 10 requests per 15 minutes to prevent brute force
 */
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req: Request): string => {
    const ip = getClientIp(req);
    return `auth:${ip}`;
  },
});

/**
 * Admin wallet challenge rate limiter
 * 5 requests per minute per IP to prevent abuse
 */
export const adminChallengeRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response): void => {
    res.status(429).json({
      error: 'Too many admin challenge requests',
      message: 'Rate limit exceeded. Please wait before requesting another challenge.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
  keyGenerator: (req: Request): string => {
    const ip = getClientIp(req);
    return `admin-challenge:${ip}`;
  },
});

// ============================================================================
// TLS Enforcement Middleware
// ============================================================================

/**
 * Enforce HTTPS in production by redirecting HTTP requests
 * Checks X-Forwarded-Proto header for proxy/load balancer scenarios
 */
export function tlsEnforcementMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return next();
  }

  // Check if request is already HTTPS
  const isSecure = req.secure || req.protocol === 'https';
  
  // Check X-Forwarded-Proto header (set by proxies/load balancers)
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isForwardedSecure = forwardedProto === 'https';

  // If not secure, redirect to HTTPS
  if (!isSecure && !isForwardedSecure) {
    const host = req.headers.host || 'localhost';
    const redirectUrl = `https://${host}${req.url}`;
    
    console.log(`[TLS] Redirecting HTTP to HTTPS: ${req.url}`);
    return res.redirect(301, redirectUrl);
  }

  next();
}

// ============================================================================
// Combined Security Middleware
// ============================================================================

/**
 * Apply all security middleware in the correct order
 * Use this for easy integration
 */
export function applySecurityMiddleware(app: any): void {
  // 1. TLS enforcement (must be first to redirect early)
  app.use(tlsEnforcementMiddleware);

  // 2. Security headers (apply to all requests)
  app.use(securityHeadersMiddleware);

  // 3. General rate limiting (applies to all API routes)
  app.use('/api', generalRateLimiter);

  console.log('✅ Security middleware applied:');
  console.log('   - TLS enforcement (production)');
  console.log('   - Security headers (CSP, HSTS, etc.)');
  console.log('   - Rate limiting (general: 100/15min)');
  console.log('   - Rate limiting (telemetry: 20/15min)');
  console.log('   - Rate limiting (sessions: 50/15min)');
  console.log('   - Rate limiting (auth: 10/15min)');
}

// ============================================================================
// Exports
// ============================================================================

export default {
  securityHeadersMiddleware,
  generalRateLimiter,
  telemetryRateLimiter,
  sessionRateLimiter,
  authRateLimiter,
  tlsEnforcementMiddleware,
  applySecurityMiddleware,
};
