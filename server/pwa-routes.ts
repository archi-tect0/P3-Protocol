import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { IStorage } from './storage';
import { startSession } from './atlas/services/sessionBridge';

function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: JWT_SECRET must be set in production');
    }
    console.warn('[PWA] WARNING: JWT_SECRET not set, using development secret');
    return 'dev-secret-insecure'; // Must match sdk/middleware/auth.ts fallback for wallet-based JWT
  }
  return secret;
}

const JWT_SECRET = getJWTSecret();

export function createPWARoutes(storage: IStorage): Router {
  const router = Router();

  // Generate cryptographically secure token
  function generateToken(): string {
    return Array.from(crypto.randomBytes(32))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Create transfer token for browser handoff
  router.post('/api/pwa/create-install-token', async (req: Request, res: Response) => {
    try {
      const { appMode, walletAddress } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
      }
      
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      
      await storage.createInstallToken({
        token,
        walletAddress,
        appMode: appMode || false,
        expiresAt,
        sessionData: JSON.stringify({
          createdAt: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
        }),
      });
      
      // Cleanup expired tokens async
      storage.cleanupExpiredInstallTokens().catch(err => 
        console.error('[PWA] Cleanup error:', err)
      );
      
      console.log(`[PWA] Generated install token for wallet: ${walletAddress}`);
      res.json({ token, expiresAt: expiresAt.toISOString() });
    } catch (error: any) {
      console.error('[PWA] Token generation error:', error);
      res.status(500).json({ error: 'Failed to generate install token' });
    }
  });

  // Create a pending token BEFORE wallet connection (for mobile deep link flow)
  // This token doesn't have a wallet address yet - it gets bound after signature
  router.post('/api/pwa/create-pending-token', async (req: Request, res: Response) => {
    try {
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes (longer for wallet flow)
      
      // Store as pending (no wallet address yet)
      await storage.createInstallToken({
        token,
        walletAddress: 'pending', // Placeholder - will be updated after signature
        appMode: false,
        expiresAt,
        sessionData: JSON.stringify({
          createdAt: new Date().toISOString(),
          userAgent: req.headers['user-agent'],
          isPending: true,
        }),
      });
      
      console.log(`[PWA] Generated pending token for wallet deep link`);
      res.json({ token, expiresAt: expiresAt.toISOString() });
    } catch (error: any) {
      console.error('[PWA] Pending token generation error:', error);
      res.status(500).json({ error: 'Failed to generate pending token' });
    }
  });

  // Bind wallet address to pending token after signature (single-use enforcement)
  router.post('/api/pwa/bind-pending-token', async (req: Request, res: Response) => {
    try {
      const { token, walletAddress } = req.body;
      
      if (!token || !walletAddress) {
        return res.status(400).json({ error: 'Token and wallet address required' });
      }
      
      const tokenData = await storage.getInstallToken(token);
      
      if (!tokenData) {
        return res.status(404).json({ error: 'TOKEN_NOT_FOUND' });
      }
      
      // Check if token is expired
      if (new Date(tokenData.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'TOKEN_EXPIRED' });
      }
      
      // Check if already consumed (replay protection)
      if (tokenData.isConsumed) {
        return res.status(400).json({ error: 'TOKEN_ALREADY_USED' });
      }
      
      if (tokenData.walletAddress !== 'pending') {
        // Already bound - verify it matches (prevent rebinding attack)
        if (tokenData.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          console.warn(`[PWA] Token rebind attempt blocked: ${token.slice(0, 8)} from ${walletAddress}`);
          return res.status(403).json({ error: 'TOKEN_ALREADY_BOUND' });
        }
        return res.json({ success: true, walletAddress: tokenData.walletAddress });
      }
      
      // Update the token with the actual wallet address
      await storage.updateInstallTokenWallet(token, walletAddress);
      
      console.log(`[PWA] Bound pending token to wallet: ${walletAddress}`);
      res.json({ success: true, walletAddress });
    } catch (error: any) {
      console.error('[PWA] Token binding error:', error);
      res.status(500).json({ error: 'Failed to bind token' });
    }
  });
  
  // Atomic bind + consume for SIWE completion (prevents race conditions)
  router.post('/api/pwa/complete-pending-token', async (req: Request, res: Response) => {
    try {
      const { token, walletAddress } = req.body;
      
      if (!token || !walletAddress) {
        return res.status(400).json({ error: 'Token and wallet address required' });
      }
      
      const tokenData = await storage.getInstallToken(token);
      
      if (!tokenData) {
        return res.status(404).json({ error: 'TOKEN_NOT_FOUND' });
      }
      
      // Check if token is expired
      if (new Date(tokenData.expiresAt) < new Date()) {
        return res.status(410).json({ error: 'TOKEN_EXPIRED' });
      }
      
      // Check if already consumed (replay protection)
      if (tokenData.isConsumed) {
        return res.status(400).json({ error: 'TOKEN_ALREADY_USED' });
      }
      
      // Verify wallet matches if already bound
      if (tokenData.walletAddress !== 'pending' && 
          tokenData.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        console.warn(`[PWA] Token completion blocked - wallet mismatch: ${token.slice(0, 8)}`);
        return res.status(403).json({ error: 'TOKEN_WALLET_MISMATCH' });
      }
      
      // Atomic: bind wallet (if needed) and consume in one operation
      if (tokenData.walletAddress === 'pending') {
        await storage.updateInstallTokenWallet(token, walletAddress);
      }
      await storage.consumeInstallToken(token);
      
      console.log(`[PWA] Completed pending token for wallet: ${walletAddress}`);
      res.json({ success: true, walletAddress, consumed: true });
    } catch (error: any) {
      console.error('[PWA] Token completion error:', error);
      res.status(500).json({ error: 'Failed to complete token' });
    }
  });

  // Consume transfer token and restore session
  router.post('/api/pwa/consume-install-token', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ 
          error: 'TOKEN_REQUIRED', 
          message: 'Token is required' 
        });
      }
      
      const tokenData = await storage.getInstallToken(token);
      
      if (!tokenData) {
        return res.status(404).json({ 
          error: 'TOKEN_NOT_FOUND', 
          message: 'Token not found' 
        });
      }
      
      if (tokenData.isConsumed) {
        return res.status(400).json({ 
          error: 'TOKEN_ALREADY_USED', 
          message: 'Token has already been consumed' 
        });
      }
      
      if (new Date(tokenData.expiresAt) < new Date()) {
        return res.status(410).json({ 
          error: 'TOKEN_EXPIRED', 
          message: 'Token has expired' 
        });
      }
      
      // Handle pending tokens - wallet address not yet bound via SIWE
      // Return specific error so client can show appropriate UI
      if (tokenData.walletAddress === 'pending') {
        console.log(`[PWA] Token has pending wallet address: ${token.slice(0, 8)}`);
        return res.status(202).json({
          error: 'TOKEN_NOT_BOUND',
          message: 'Wallet address not yet bound - please complete signature in wallet',
          pending: true
        });
      }
      
      // Mark token as consumed
      await storage.consumeInstallToken(token);
      
      // Create a proper session via sessionBridge (required for NodeMode mesh connection)
      const atlasSession = startSession(tokenData.walletAddress, ['user']);
      
      // CRITICAL: Also generate a proper JWT for client-side auth persistence
      // This JWT is what the client stores and validates on page reload
      // SECURITY: Do NOT embed raw session token in JWT - use hashed reference instead
      const crypto = await import('crypto');
      const sessionRef = crypto.createHash('sha256').update(atlasSession.token).digest('hex').slice(0, 16);
      const jwtToken = jwt.sign(
        { 
          wallet: tokenData.walletAddress.toLowerCase(), 
          roles: ['user'], 
          sessionRef,
          type: 'install_token_bridge',
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      console.log(`[PWA] Consumed install token, created session for wallet: ${tokenData.walletAddress.slice(0, 10)}...`);
      res.json({ 
        success: true, 
        walletAddress: tokenData.walletAddress,
        appMode: tokenData.appMode,
        token: jwtToken,
      });
    } catch (error: any) {
      console.error('[PWA] Token consumption error:', error);
      res.status(500).json({ 
        error: 'INTERNAL_ERROR', 
        message: 'Failed to consume token' 
      });
    }
  });

  return router;
}
