import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET environment variable must be set in production');
    }
    console.warn('[SDK:auth] WARNING: JWT_SECRET not set, using insecure development secret. DO NOT USE IN PRODUCTION.');
    return 'dev-secret-insecure';
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();

export interface SDKUser {
  wallet: string;
  roles: string[];
  sessionId?: string;
}

declare global {
  namespace Express {
    interface Request {
      sdkUser?: SDKUser;
    }
  }
}

export function requireWalletToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'missing_token', message: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      wallet: string; 
      roles?: string[];
      sessionId?: string;
    };

    if (!decoded.wallet) {
      return res.status(401).json({ error: 'invalid_token', message: 'Token missing wallet claim' });
    }

    req.sdkUser = {
      wallet: decoded.wallet.toLowerCase(),
      roles: decoded.roles || ['user'],
      sessionId: decoded.sessionId,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'token_expired', message: 'Token has expired' });
    }
    return res.status(401).json({ error: 'invalid_token', message: 'Invalid authorization token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.sdkUser) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const hasRole = roles.some(role => req.sdkUser!.roles.includes(role));
    if (!hasRole) {
      return res.status(403).json({ 
        error: 'forbidden', 
        message: `Required roles: ${roles.join(' or ')}` 
      });
    }

    next();
  };
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { 
      wallet: string; 
      roles?: string[];
      sessionId?: string;
    };

    if (decoded.wallet) {
      req.sdkUser = {
        wallet: decoded.wallet.toLowerCase(),
        roles: decoded.roles || ['user'],
        sessionId: decoded.sessionId,
      };
    }
  } catch {
    // Invalid token, continue without user
  }

  next();
}
