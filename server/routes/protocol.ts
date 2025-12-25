/**
 * Protocol Routes
 * 
 * Mounts all P3 Protocol API routes including:
 * - Session Fabric (v1/session/* - legacy, v2/session/* - current)
 * - Protocol Settlement (/protocol/settlement/*)
 * 
 * Atlas API 2.0 Session Fabric provides:
 * - Multiplexed lane communication (manifests, access, receipts)
 * - Capability negotiation during handshake
 * - Priority scheduling with focus-aware reprioritization
 */

import { Router } from 'express';
import { sessionRouter } from '../protocol/session';
import { protocolSettlementRouter } from '../protocol/settlement';

const router = Router();

router.use('/v1', sessionRouter);
router.use('/v2', sessionRouter);

router.use('/protocol/settlement', protocolSettlementRouter);

router.get('/protocol/health', (_req, res) => {
  res.json({
    status: 'healthy',
    services: {
      session: 'active',
      settlement: 'active',
    },
    timestamp: Date.now(),
    version: '2.0.0',
  });
});

export default router;
