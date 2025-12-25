import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from './storage';
import { authenticateJWT, requireRole, type AuthenticatedRequest } from './auth';
import { BridgeRelayService } from '../packages/bridge/relay/service';
import { BridgeMonitor } from '../packages/bridge/monitor/index';

const relayReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  targetChains: z.array(z.enum(['polygon', 'arbitrum', 'optimism'])),
  metadata: z.record(z.any()).optional(),
});

export function createBridgeRoutes(storage: IStorage): Router {
  const router = Router();
  const relayService = new BridgeRelayService();
  const monitor = new BridgeMonitor(relayService);

  router.post('/api/bridge/relay', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = relayReceiptSchema.parse(req.body);

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const receipt = await storage.getReceipt(data.receiptId);
      if (!receipt) {
        res.status(404).json({ error: 'Receipt not found' });
        return;
      }

      const docHash = receipt.contentHash;

      const jobs = await Promise.all(
        data.targetChains.map(async (targetChain) => {
          const job = await storage.createBridgeJob({
            receiptId: receipt.id,
            docHash,
            sourceChain: 'base',
            targetChain,
            status: 'pending',
            confirmations: 0,
            requiredConfirmations: getRequiredConfirmations(targetChain),
            attempts: 0,
            maxAttempts: 3,
            metadata: data.metadata || null,
          });

          const updateJob = async (status: string, txHash?: string, error?: string) => {
            await storage.updateBridgeJob(job.id, {
              status: status as any,
              txHash: txHash || null,
              lastError: error || null,
              attempts: job.attempts + 1,
            });
          };

          relayService
            .retryRelay(
              {
                id: job.id,
                docHash,
                targetChain,
                receiptData: {
                  type: receipt.type,
                  subjectId: receipt.subjectId,
                  contentHash: receipt.contentHash,
                  proofBlob: receipt.proofBlob,
                  immutableSeq: receipt.immutableSeq,
                },
                attempts: 0,
                maxAttempts: 3,
                status: 'pending',
              },
              updateJob
            )
            .then((result) => {
              if (result.success && result.txHash) {
                monitor.startPolling(
                  docHash,
                  targetChain,
                  result.txHash,
                  async (confirmations, status) => {
                    await storage.updateBridgeJob(job.id, {
                      confirmations,
                      status: status as any,
                      confirmedAt: status === 'confirmed' ? new Date() : null,
                    });
                  }
                );
              }
            })
            .catch((error) => {
              console.error(`Relay failed for ${targetChain}:`, error);
            });

          return job;
        })
      );

      res.status(201).json({
        docHash,
        jobs: jobs.map(j => ({
          id: j.id,
          targetChain: j.targetChain,
          status: j.status,
        })),
      });
    } catch (error) {
      console.error('Bridge relay error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to relay receipt',
      });
    }
  });

  router.get('/api/bridge/status/:docHash', async (req: Request, res: Response) => {
    try {
      const { docHash } = req.params;

      const jobs = await storage.getBridgeJobsByDocHash(docHash);

      if (jobs.length === 0) {
        res.status(404).json({ error: 'No bridge jobs found for this document hash' });
        return;
      }

      const status = await monitor.getCrossChainStatus(docHash, jobs.map(j => ({
        ...j,
        lastError: j.lastError ?? undefined,
      })));

      res.json(status);
    } catch (error) {
      console.error('Bridge status error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get bridge status',
      });
    }
  });

  router.get('/api/receipts/:hash', async (req: Request, res: Response) => {
    try {
      const { hash } = req.params;

      const receipt = await storage.getReceiptByHash(hash);
      if (!receipt) {
        res.status(404).json({ error: 'Receipt not found' });
        return;
      }

      const bridgeJobs = await storage.getBridgeJobsByDocHash(receipt.contentHash);

      const crossChainStatus = bridgeJobs.length > 0
        ? await monitor.getCrossChainStatus(receipt.contentHash, bridgeJobs.map(j => ({
            ...j,
            lastError: j.lastError ?? undefined,
          })))
        : null;

      res.json({
        receipt,
        crossChainStatus,
      });
    } catch (error) {
      console.error('Receipt unified status error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get unified receipt status',
      });
    }
  });

  return router;
}

function getRequiredConfirmations(chain: string): number {
  const confirmations: Record<string, number> = {
    polygon: 128,
    arbitrum: 20,
    optimism: 50,
  };
  return confirmations[chain] || 12;
}
