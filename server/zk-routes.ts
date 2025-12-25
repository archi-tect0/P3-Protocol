import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { zkProverService, zkProverAvailable, ProofInput } from '../packages/zk/prover/index';
import { authenticateJWT, requireRole, type AuthenticatedRequest } from './auth';

const proveRequestSchema = z.object({
  circuit: z.enum(['MessageReceipt', 'MeetingReceipt', 'PaymentReceipt', 'ConsentState']),
  inputs: z.record(z.any()),
});

const verifyRequestSchema = z.object({
  circuit: z.string(),
  proof: z.any(),
  publicSignals: z.array(z.string()),
});

export function createZKRoutes(): Router {
  const router = Router();

  /**
   * GET /api/zk/status
   * Check if ZK prover is available (no auth required)
   */
  router.get('/api/zk/status', (req: Request, res: Response) => {
    res.status(200).json({
      available: zkProverAvailable,
      reason: zkProverAvailable 
        ? 'ZK prover operational' 
        : 'snarkjs (GPL) excluded from Apache 2.0 build - consider arkworks-rs or gnark alternatives',
    });
  });

  /**
   * POST /api/zk/prove
   * Generate a zero-knowledge proof for a given circuit
   */
  router.post('/api/zk/prove', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    if (!zkProverAvailable) {
      res.status(503).json({
        error: 'ZK proving unavailable',
        reason: 'snarkjs (GPL) excluded from Apache 2.0 build',
        alternatives: ['arkworks-rs (MIT/Apache-2.0)', 'gnark (Apache-2.0)'],
      });
      return;
    }

    try {
      const validatedData = proveRequestSchema.parse(req.body);

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      console.log(`Generating proof for circuit: ${validatedData.circuit}`);

      const proofInput: ProofInput = {
        circuit: validatedData.circuit,
        inputs: validatedData.inputs,
      };

      const result = await zkProverService.generateProof(proofInput);

      res.status(200).json({
        success: true,
        proof: result.proof,
        publicSignals: result.publicSignals,
        circuit: validatedData.circuit,
      });
    } catch (error) {
      console.error('ZK proof generation error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Invalid request',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to generate proof' 
      });
    }
  });

  /**
   * POST /api/zk/verify
   * Verify a zero-knowledge proof
   */
  router.post('/api/zk/verify', async (req: Request, res: Response) => {
    if (!zkProverAvailable) {
      res.status(503).json({
        error: 'ZK verification unavailable',
        reason: 'snarkjs (GPL) excluded from Apache 2.0 build',
        alternatives: ['arkworks-rs (MIT/Apache-2.0)', 'gnark (Apache-2.0)'],
      });
      return;
    }

    try {
      const validatedData = verifyRequestSchema.parse(req.body);

      console.log(`Verifying proof for circuit: ${validatedData.circuit}`);

      const isValid = await zkProverService.verifyProof(
        validatedData.circuit,
        validatedData.proof,
        validatedData.publicSignals
      );

      res.status(200).json({
        success: true,
        valid: isValid,
        circuit: validatedData.circuit,
      });
    } catch (error) {
      console.error('ZK proof verification error:', error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ 
          error: 'Invalid request',
          details: error.errors 
        });
        return;
      }

      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to verify proof' 
      });
    }
  });

  /**
   * GET /api/zk/metrics
   * Get prover metrics (authenticated, admin only)
   */
  router.get('/api/zk/metrics', authenticateJWT, requireRole('admin'), (req: AuthenticatedRequest, res: Response) => {
    try {
      const metrics = zkProverService.getMetrics();
      const queueLength = zkProverService.getQueueLength();

      res.status(200).json({
        success: true,
        available: zkProverAvailable,
        metrics: {
          ...metrics,
          queueLength,
        },
      });
    } catch (error) {
      console.error('Error fetching ZK metrics:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to fetch metrics' 
      });
    }
  });

  /**
   * GET /api/zk/health
   * Check if ZK prover service is healthy
   */
  router.get('/api/zk/health', (req: Request, res: Response) => {
    if (!zkProverAvailable) {
      res.status(200).json({
        success: true,
        healthy: false,
        available: false,
        reason: 'snarkjs (GPL) excluded from Apache 2.0 build',
      });
      return;
    }

    try {
      const queueLength = zkProverService.getQueueLength();
      const metrics = zkProverService.getMetrics();

      const isHealthy = queueLength < 100 && metrics.totalProofs >= 0;

      res.status(isHealthy ? 200 : 503).json({
        success: true,
        healthy: isHealthy,
        available: true,
        queueLength,
        totalProofs: metrics.totalProofs,
      });
    } catch (error) {
      console.error('Error checking ZK health:', error);
      res.status(503).json({ 
        success: false,
        healthy: false,
        available: zkProverAvailable,
        error: error instanceof Error ? error.message : 'Health check failed' 
      });
    }
  });

  return router;
}
