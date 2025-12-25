import { Router } from 'express';
import { createError } from '../middleware/errors';
import jwt from 'jsonwebtoken';

const router = Router();

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET environment variable must be set in production');
    }
    console.warn('[SDK:session] WARNING: JWT_SECRET not set, using insecure development secret. DO NOT USE IN PRODUCTION.');
    return 'dev-secret-insecure';
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory session store (in production, use Redis)
const sessions = new Map<string, {
  wallet: string;
  roles: string[];
  createdAt: number;
  expiresAt: number;
}>();

router.post('/resume', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    // Find existing session or create new one
    let session = Array.from(sessions.entries())
      .find(([_, s]) => s.wallet === wallet && s.expiresAt > Date.now())?.[1];

    const sessionId = session 
      ? Array.from(sessions.entries()).find(([_, s]) => s === session)?.[0]
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (!session) {
      session = {
        wallet,
        roles: req.sdkUser?.roles || ['user'],
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL,
      };
      sessions.set(sessionId!, session);
    }

    res.json({
      sessionId,
      wallet: session.wallet,
      roles: session.roles,
      expiresAt: session.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/revoke', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (session && session.wallet === wallet) {
        sessions.delete(sessionId);
      }
    } else {
      // Revoke all sessions for this wallet
      for (const [id, session] of sessions.entries()) {
        if (session.wallet === wallet) {
          sessions.delete(id);
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;
    const currentSessionId = req.sdkUser?.sessionId;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    // Invalidate old session if exists
    if (currentSessionId && sessions.has(currentSessionId)) {
      sessions.delete(currentSessionId);
    }

    // Create new session
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const session = {
      wallet,
      roles: req.sdkUser?.roles || ['user'],
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL,
    };
    sessions.set(sessionId, session);

    // Generate new token
    const token = jwt.sign(
      { wallet, roles: session.roles, sessionId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      sessionId,
      wallet: session.wallet,
      roles: session.roles,
      expiresAt: session.expiresAt,
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/info', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    const session = Array.from(sessions.entries())
      .find(([_, s]) => s.wallet === wallet && s.expiresAt > Date.now());

    if (!session) {
      res.json({
        sessionId: null,
        wallet,
        roles: req.sdkUser?.roles || ['user'],
        expiresAt: null,
      });
    } else {
      res.json({
        sessionId: session[0],
        wallet: session[1].wallet,
        roles: session[1].roles,
        expiresAt: session[1].expiresAt,
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
