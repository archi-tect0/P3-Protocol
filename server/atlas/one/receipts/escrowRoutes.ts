/**
 * Receipt Escrow Routes
 * 
 * Atlas API 2.0 - Client-signed receipts with async anchoring.
 * 
 * Endpoints:
 * - POST /ingest - Fire-and-forget receipt ingestion (returns 202 Accepted)
 * - POST /batch - Batch ingestion for multiple receipts
 * - GET /status/:id - Check anchoring status for a receipt
 * - GET /wallet/:address - Get wallet's pending/anchored receipts
 * - GET /session/:sessionId - Get receipts by session
 * - POST /retry - Retry failed receipts
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  escrowReceipt,
  queueReceiptBatch,
  getEscrowStatus,
  getReceiptsByWallet,
  getReceiptsBySession,
  getEscrowedReceipts,
  getPendingReceipts,
  retryFailedReceipts,
  type ReceiptInput,
} from './escrowService';
import { getEscrowWorkerStatus } from './escrowWorker';
import { rootLogger } from '../../../observability/logger';

const router = Router();

const receiptInputSchema = z.object({
  sessionId: z.string().min(1).max(64),
  walletAddress: z.string().max(42).optional(),
  itemId: z.string().min(1).max(128),
  itemType: z.string().max(32).optional(),
  action: z.enum(['play', 'read', 'watch', 'buy', 'listen', 'vote', 'browse']),
  clientSignature: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const batchInputSchema = z.object({
  receipts: z.array(receiptInputSchema).min(1).max(50),
});

router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const parseResult = receiptInputSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid receipt data',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const receipt = parseResult.data as ReceiptInput;

    const result = await escrowReceipt(receipt);

    if (!result.queued) {
      return res.status(400).json({
        error: result.error || 'Failed to queue receipt',
        receiptId: 0,
      });
    }

    rootLogger.info('[EscrowRoutes] Receipt ingested', {
      receiptId: result.receiptId,
      sessionId: receipt.sessionId,
      itemId: receipt.itemId,
      action: receipt.action,
    });

    res.status(202).json({
      ok: true,
      receiptId: result.receiptId,
      jobId: result.jobId,
      status: 'pending',
      message: 'Receipt accepted for anchoring',
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Ingest failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/batch', async (req: Request, res: Response) => {
  try {
    const parseResult = batchInputSchema.safeParse(req.body);
    
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid batch data',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { receipts } = parseResult.data;

    const result = await queueReceiptBatch(receipts as ReceiptInput[]);

    rootLogger.info('[EscrowRoutes] Batch ingested', {
      submitted: receipts.length,
      accepted: result.accepted,
    });

    res.status(202).json({
      ok: true,
      submitted: receipts.length,
      accepted: result.accepted,
      results: result.results.map(r => ({
        receiptId: r.receiptId,
        queued: r.queued,
        error: r.error,
      })),
      message: 'Batch accepted for anchoring',
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Batch ingest failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/status/:id', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.id, 10);
    
    if (isNaN(receiptId) || receiptId <= 0) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }

    const status = await getEscrowStatus(receiptId);

    if (!status) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({
      receiptId: status.receiptId,
      status: status.status,
      anchoredAt: status.anchoredAt,
      anchorTxHash: status.anchorTxHash,
      createdAt: status.createdAt,
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Status check failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/wallet/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { status, limit } = req.query;
    
    if (!address || address.length < 10) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    let receipts;
    if (status && typeof status === 'string') {
      receipts = await getEscrowedReceipts(address, status);
    } else {
      receipts = await getReceiptsByWallet(address, limit ? parseInt(limit as string, 10) : 50);
    }

    const summary = {
      pending: receipts.filter(r => r.status === 'pending').length,
      anchoring: receipts.filter(r => r.status === 'anchoring').length,
      anchored: receipts.filter(r => r.status === 'anchored').length,
      failed: receipts.filter(r => r.status === 'failed').length,
    };

    res.json({
      wallet: address,
      receipts: receipts.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        itemId: r.itemId,
        itemType: r.itemType,
        action: r.action,
        status: r.status,
        txHash: r.txHash,
        anchoredAt: r.anchoredAt,
        createdAt: r.createdAt,
      })),
      count: receipts.length,
      summary,
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Wallet receipts failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;
    
    if (!sessionId || sessionId.length < 8) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const receipts = await getReceiptsBySession(sessionId, limit ? parseInt(limit as string, 10) : 50);

    res.json({
      sessionId,
      receipts: receipts.map(r => ({
        id: r.id,
        walletAddress: r.walletAddress,
        itemId: r.itemId,
        itemType: r.itemType,
        action: r.action,
        status: r.status,
        txHash: r.txHash,
        anchoredAt: r.anchoredAt,
        createdAt: r.createdAt,
      })),
      count: receipts.length,
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Session receipts failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    
    const receipts = await getPendingReceipts(limit ? parseInt(limit as string, 10) : 100);

    res.json({
      receipts: receipts.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        walletAddress: r.walletAddress,
        itemId: r.itemId,
        itemType: r.itemType,
        action: r.action,
        status: r.status,
        createdAt: r.createdAt,
      })),
      count: receipts.length,
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Pending receipts failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/retry', async (req: Request, res: Response) => {
  try {
    const { limit } = req.body;
    
    const result = await retryFailedReceipts(limit || 50);

    rootLogger.info('[EscrowRoutes] Retry triggered', { retried: result.retried });

    res.json({
      ok: true,
      retried: result.retried,
      message: `${result.retried} failed receipts queued for retry`,
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Retry failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/worker/status', async (_req: Request, res: Response) => {
  try {
    const status = getEscrowWorkerStatus();
    
    res.json({
      worker: status,
      queue: 'receipt-escrow',
    });
  } catch (err: any) {
    rootLogger.error('[EscrowRoutes] Worker status failed', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
