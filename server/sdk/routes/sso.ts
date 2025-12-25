/**
 * P3 SDK SSO Routes - Wallet-Based Single Sign-On
 * 
 * These endpoints enable third-party apps to integrate P3 SSO.
 * 
 * Flow:
 * 1. App requests challenge: POST /api/sdk/sso/challenge
 * 2. User signs challenge with wallet
 * 3. App verifies signature: POST /api/sdk/sso/verify
 * 4. App receives JWT token for authenticated requests
 * 
 * For apps already in the P3 ecosystem, session is shared automatically.
 */

import { Router } from 'express';
import { createError } from '../middleware/errors';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

const router = Router();

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET environment variable must be set in production');
    }
    console.warn('[SDK:sso] WARNING: JWT_SECRET not set, using insecure development secret.');
    return 'dev-secret-insecure';
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();
const CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// In-memory stores (use Redis in production for multi-instance)
const challenges = new Map<string, {
  wallet: string;
  nonce: string;
  message: string;
  expiresAt: number;
}>();

const ssoSessions = new Map<string, {
  wallet: string;
  roles: string[];
  appId: string | null;
  scopes: string[];
  createdAt: number;
  expiresAt: number;
}>();

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, challenge] of challenges.entries()) {
    if (challenge.expiresAt < now) challenges.delete(key);
  }
  for (const [key, session] of ssoSessions.entries()) {
    if (session.expiresAt < now) ssoSessions.delete(key);
  }
}, 60000);

/**
 * Request a challenge for wallet signature
 * POST /api/sdk/sso/challenge
 */
router.post('/challenge', async (req, res, next) => {
  try {
    const { wallet } = req.body;

    if (!wallet || typeof wallet !== 'string') {
      throw createError('Wallet address required', 400, 'invalid_request');
    }

    const normalizedWallet = wallet.toLowerCase();
    const nonce = randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const expiresAt = timestamp + CHALLENGE_TTL;

    const message = [
      'P3 Protocol SSO Authentication',
      '',
      `Wallet: ${normalizedWallet}`,
      `Nonce: ${nonce}`,
      `Timestamp: ${new Date(timestamp).toISOString()}`,
      '',
      'Sign this message to authenticate with P3 Protocol.',
      'This signature will not trigger any blockchain transaction.',
    ].join('\n');

    // Store challenge
    const challengeId = createHash('sha256')
      .update(`${normalizedWallet}:${nonce}`)
      .digest('hex')
      .slice(0, 16);

    challenges.set(challengeId, {
      wallet: normalizedWallet,
      nonce,
      message,
      expiresAt,
    });

    res.json({
      nonce,
      message,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Verify signed challenge and issue token
 * POST /api/sdk/sso/verify
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { wallet, nonce, signature, appId } = req.body;

    if (!wallet || !nonce || !signature) {
      throw createError('Wallet, nonce, and signature required', 400, 'invalid_request');
    }

    const normalizedWallet = wallet.toLowerCase();
    const challengeId = createHash('sha256')
      .update(`${normalizedWallet}:${nonce}`)
      .digest('hex')
      .slice(0, 16);

    const challenge = challenges.get(challengeId);

    if (!challenge) {
      throw createError('Challenge not found or expired', 401, 'challenge_expired');
    }

    if (challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId);
      throw createError('Challenge expired', 401, 'challenge_expired');
    }

    if (challenge.wallet !== normalizedWallet) {
      throw createError('Wallet mismatch', 401, 'wallet_mismatch');
    }

    // Verify signature using ethers
    let recoveredAddress: string;
    try {
      const { ethers } = await import('ethers');
      recoveredAddress = ethers.verifyMessage(challenge.message, signature).toLowerCase();
    } catch (err) {
      throw createError('Invalid signature format', 401, 'invalid_signature');
    }

    if (recoveredAddress !== normalizedWallet) {
      throw createError('Signature verification failed', 401, 'signature_mismatch');
    }

    // Challenge verified - delete it
    challenges.delete(challengeId);

    // Create session
    const sessionId = `sso-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const session = {
      wallet: normalizedWallet,
      roles: ['user'],
      appId: appId || null,
      scopes: ['read', 'session'],
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL,
    };
    ssoSessions.set(sessionId, session);

    // Generate JWT token
    const token = jwt.sign(
      { 
        wallet: normalizedWallet, 
        roles: session.roles, 
        sessionId,
        appId: appId || 'p3-ecosystem',
        type: 'sso',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      authenticated: true,
      wallet: normalizedWallet,
      chainId: 8453, // Base mainnet
      sessionId,
      roles: session.roles,
      expiresAt: session.expiresAt,
      method: 'walletconnect',
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Validate existing session for an app
 * POST /api/sdk/sso/validate
 */
router.post('/validate', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;
    const { appId, scopes = [] } = req.body;

    if (!wallet) {
      throw createError('Not authenticated', 401, 'unauthorized');
    }

    if (!appId) {
      throw createError('App ID required', 400, 'invalid_request');
    }

    // Find session for this wallet
    const session = Array.from(ssoSessions.entries())
      .find(([_, s]) => s.wallet === wallet && s.expiresAt > Date.now())?.[1];

    // Check if session has required scopes
    const requestedScopes = Array.isArray(scopes) ? scopes : [];
    const hasScopes = requestedScopes.every(scope => 
      session?.scopes.includes(scope) || scope === 'read'
    );

    res.json({
      valid: !!session && hasScopes,
      wallet,
      appId,
      scopes: session?.scopes || [],
      expiresAt: session?.expiresAt || null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get a fresh token for API calls
 * POST /api/sdk/sso/token
 */
router.post('/token', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Not authenticated', 401, 'unauthorized');
    }

    // Generate fresh token
    const expiresAt = Date.now() + SESSION_TTL;
    const token = jwt.sign(
      { 
        wallet, 
        roles: req.sdkUser?.roles || ['user'], 
        type: 'api',
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      expiresAt,
      wallet,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Logout / revoke SSO session
 * POST /api/sdk/sso/logout
 */
router.post('/logout', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      res.json({ ok: true });
      return;
    }

    // Revoke all SSO sessions for this wallet
    for (const [id, session] of ssoSessions.entries()) {
      if (session.wallet === wallet) {
        ssoSessions.delete(id);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Public: Check SSO availability
 * GET /api/sdk/sso/status
 */
router.get('/status', (req, res) => {
  res.json({
    available: true,
    version: '1.0.0',
    methods: ['wallet_signature'],
    chains: [8453, 84532], // Base mainnet, Base Sepolia
    ttl: SESSION_TTL,
  });
});

export default router;
