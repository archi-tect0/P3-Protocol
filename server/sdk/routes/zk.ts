import { Router, Request, Response } from 'express';
import { z } from 'zod';

let zkProverService: any = null;

try {
  const zkModule = require('../../../packages/zk/prover/index');
  zkProverService = zkModule.zkProverService;
} catch (err) {
  console.warn('[SDK:zk] ZK prover service not available:', err);
}

const router = Router();

function requireProver(req: Request, res: Response, next: Function) {
  if (!zkProverService) {
    return res.status(503).json({ 
      error: 'ZK prover service not configured',
      available: false 
    });
  }
  next();
}

const proveSchema = z.object({
  circuit: z.enum(['MessageReceipt', 'MeetingReceipt', 'PaymentReceipt', 'ConsentState']),
  inputs: z.record(z.unknown()),
});

const verifySchema = z.object({
  circuit: z.string(),
  proof: z.unknown(),
  publicSignals: z.array(z.string()),
});

router.post('/prove', requireProver, async (req: Request, res: Response) => {
  try {
    const wallet = req.sdkUser?.wallet;
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet authentication required' });
    }

    const result = proveSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { circuit, inputs } = result.data;

    console.log(`[SDK:zk] Generating ${circuit} proof for ${wallet}`);

    const proofResult = await zkProverService.generateProof({
      circuit,
      inputs: inputs as Record<string, unknown>,
    });

    res.json({
      ok: true,
      circuit,
      proof: proofResult.proof,
      publicSignals: proofResult.publicSignals,
      generatedAt: Date.now(),
    });
  } catch (error) {
    console.error('[SDK:zk] Proof generation error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate proof' 
    });
  }
});

router.post('/verify', requireProver, async (req: Request, res: Response) => {
  try {
    const result = verifySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { circuit, proof, publicSignals } = result.data;

    console.log(`[SDK:zk] Verifying ${circuit} proof`);

    const isValid = await zkProverService.verifyProof(circuit, proof, publicSignals);

    res.json({
      ok: true,
      valid: isValid,
      circuit,
      verifiedAt: Date.now(),
    });
  } catch (error) {
    console.error('[SDK:zk] Proof verification error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to verify proof' 
    });
  }
});

router.get('/circuits', (req: Request, res: Response) => {
  res.json({
    circuits: [
      { 
        id: 'MessageReceipt', 
        description: 'Prove message delivery without revealing content',
        inputs: ['messageHash', 'senderPubKey', 'recipientPubKey', 'timestamp']
      },
      { 
        id: 'MeetingReceipt', 
        description: 'Prove meeting attendance without revealing participants',
        inputs: ['meetingId', 'participantHash', 'startTime', 'endTime']
      },
      { 
        id: 'PaymentReceipt', 
        description: 'Prove payment without revealing amount or parties',
        inputs: ['paymentHash', 'senderHash', 'recipientHash', 'assetType']
      },
      { 
        id: 'ConsentState', 
        description: 'Prove consent state without revealing identity',
        inputs: ['consentHash', 'partyAHash', 'partyBHash', 'agreementType']
      },
    ],
    version: '1.0.0',
  });
});

router.get('/status', async (req: Request, res: Response) => {
  if (!zkProverService) {
    return res.json({
      ok: true,
      ready: false,
      available: false,
      message: 'ZK prover service not configured',
    });
  }

  try {
    const metrics = zkProverService.getMetrics();
    const queueLength = zkProverService.getQueueLength();

    res.json({
      ok: true,
      ready: true,
      available: true,
      queueLength,
      metrics: {
        totalProofs: metrics.totalProofs || 0,
        successfulProofs: metrics.successfulProofs || 0,
        failedProofs: metrics.failedProofs || 0,
        avgProofTime: metrics.avgProofTime || 0,
      },
    });
  } catch (error) {
    res.json({
      ok: false,
      ready: false,
      error: 'ZK prover service unavailable',
    });
  }
});

export default router;
