import { Router } from 'express';
import { sdkFlags } from './config/flags';
import { requireWalletToken, optionalAuth } from './middleware/auth';
import { requireTicket } from './middleware/access';
import { sdkErrorHandler, notFound } from './middleware/errors';
import { 
  sdkCryptoLimiter, 
  sdkSessionLimiter,
  sdkAnchorLimiter,
  sdkZKLimiter,
  sdkDAOLimiter,
  sdkMediaLimiter,
  sdkIdentityLimiter,
  sdkTicketLimiter
} from '../rate/limits';

import versionRouter from './routes/version';
import anchorRouter from './routes/anchor';
import anchorBatchRouter from './routes/anchorBatch';
import cryptoRouter from './routes/crypto';
import sessionRouter from './routes/session';
import ssoRouter from './routes/sso';
import daoRouter from './routes/dao';
import explorerRouter from './routes/explorer';
import auditRouter from './routes/audit';
import mediaRouter from './routes/media';
import ticketRouter from './routes/ticket';
import identityRouter from './routes/identity';
import zkRouter from './routes/zk';
import diagnosticsRouter from './routes/diagnostics';
import registryRouter from './routes/registry';

const router = Router();

// Version endpoint (public)
router.use('/version', versionRouter);

// Registry endpoint (public - for launcher discovery)
router.use('/registry', registryRouter);

// Health check (public)
router.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    version: '2.0.0',
    ticketGate: sdkFlags.ticketGate,
  });
});

// Ticket routes (grant/check/revoke - before auth for ticket flow)
router.use('/ticket', sdkTicketLimiter, ticketRouter);

// SSO public routes (challenge/status - before auth)
router.get('/sso/status', (req, res, next) => ssoRouter(req, res, next));
router.post('/sso/challenge', (req, res, next) => ssoRouter(req, res, next));
router.post('/sso/verify', (req, res, next) => ssoRouter(req, res, next));

// Diagnostics public routes (health/status/ping) - before auth
router.get('/diagnostics/health', (req, res) => {
  res.json({ ok: true, service: 'p3-sdk', timestamp: Date.now() });
});
router.get('/diagnostics/ping', (req, res) => {
  res.json({ ok: true, latency: 0, timestamp: Date.now() });
});

// Public SDK anchor checkpoint (for Developer Kit - no auth needed for testnet)
router.post('/anchor-checkpoint', async (req, res) => {
  try {
    const { walletAddress, sdkVersion, type } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }
    
    const crypto = await import('crypto');
    const metadata = JSON.stringify({ walletAddress, sdkVersion, type, timestamp: Date.now() });
    const contentHash = '0x' + crypto.createHash('sha256').update(metadata).digest('hex');
    
    // Try real blockchain call on Base Sepolia
    if (process.env.PRIVATE_KEY) {
      try {
        const { getBaseSepoliaService } = await import('../services/blockchain');
        const blockchain = getBaseSepoliaService();
        
        const result = await blockchain.anchorData(contentHash, metadata);
        
        console.log('[SDK] Anchor checkpoint created on-chain:', { 
          walletAddress, sdkVersion, type, 
          anchorId: result.anchorId,
          txHash: result.txHash 
        });
        
        return res.json({
          success: true,
          txHash: result.txHash,
          anchorId: result.anchorId,
          contentHash,
          chain: 'base-sepolia',
          timestamp: Date.now(),
          onChain: true
        });
      } catch (blockchainError: any) {
        console.warn('[SDK] Blockchain call failed, falling back to queue:', blockchainError.message);
      }
    }
    
    // Fallback: Queue for later processing via outbox pattern
    const { enqueueAnchors } = await import('../anchor/queue');
    const result = await enqueueAnchors([{
      appId: 'sdk-checkpoint',
      event: 'checkpoint',
      data: { walletAddress, sdkVersion, type, contentHash },
      ts: Date.now(),
    }]);
    
    console.log('[SDK] Anchor checkpoint queued:', { walletAddress, sdkVersion, type, ids: result.ids });
    
    res.json({
      success: true,
      receiptId: result.ids[0],
      contentHash,
      chain: 'base-sepolia',
      timestamp: Date.now(),
      queued: true,
      onChain: false
    });
  } catch (error: any) {
    console.error('[SDK] Anchor checkpoint error:', error);
    res.status(500).json({ error: error.message || 'Failed to create anchor checkpoint' });
  }
});

// All other routes require wallet authentication
router.use(requireWalletToken);

// SSO authenticated routes (validate/token/logout)
router.use('/sso', sdkSessionLimiter, ssoRouter);

// Mount module routers based on feature flags
// Ticket gate middleware is applied per-module when FLAG_TICKET_GATE=1
if (sdkFlags.sdkAnchor) {
  // Mount anchorBatch first for BullMQ-based batch processing
  router.use('/anchor', sdkAnchorLimiter, anchorBatchRouter);
  router.use('/anchor', sdkAnchorLimiter, anchorRouter);
}

if (sdkFlags.sdkCrypto) {
  router.use('/crypto', sdkCryptoLimiter, requireTicket(['encrypt']), cryptoRouter);
}

if (sdkFlags.sdkSession) {
  router.use('/session', sdkSessionLimiter, requireTicket(['session']), sessionRouter);
}

if (sdkFlags.sdkDAO) {
  router.use('/dao', sdkDAOLimiter, requireTicket(['dao']), daoRouter);
}

if (sdkFlags.sdkExplorer) {
  router.use('/explorer', explorerRouter);
}

if (sdkFlags.sdkAudit) {
  router.use('/audit', requireTicket(['audit']), auditRouter);
}

if (sdkFlags.sdkMedia) {
  router.use('/media', sdkMediaLimiter, requireTicket(['media']), mediaRouter);
}

// Identity routes - always enabled for hub profile management
router.use('/identity', sdkIdentityLimiter, identityRouter);

// ZK (zero-knowledge) routes - always enabled for privacy-preserving proofs
router.use('/zk', sdkZKLimiter, zkRouter);

// Diagnostics routes - always enabled for system health checks
router.use('/diagnostics', diagnosticsRouter);

// 404 handler for SDK routes
router.use(notFound);

// Error handler
router.use(sdkErrorHandler);

export default router;
