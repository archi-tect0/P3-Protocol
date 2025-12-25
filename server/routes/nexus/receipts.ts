import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../../storage';
import { handleError, AppError, ErrorCategory } from '../../utils/error-handler';
import { rootLogger } from '../../observability/logger';
import { enqueueAnchors, AnchorEvent } from '../../anchor/queue';

const logger = rootLogger.child({ module: 'nexus-receipts' });

interface SessionRequest extends Request {
  wallet?: string;
  session?: {
    wallet?: string;
  };
}

const listQuerySchema = z.object({
  type: z.enum(['message', 'meeting', 'money']).optional(),
  subjectId: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const receiptIdParamSchema = z.object({
  id: z.string().uuid(),
});

const verifyProofSchema = z.object({
  receiptId: z.string().uuid(),
  proof: z.any().optional(),
});

const anchorReceiptSchema = z.object({
  type: z.enum(['message', 'meeting', 'money']),
  subjectId: z.string().min(1),
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

function requireSession(req: SessionRequest, res: Response, next: () => void): void {
  const wallet = req.wallet || req.session?.wallet || req.headers['x-wallet-address'] as string;
  
  if (!wallet) {
    res.status(401).json({ error: 'unauthorized', message: 'Wallet session required' });
    return;
  }
  
  req.wallet = wallet.toLowerCase();
  next();
}

function hashContent(content: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(content).digest('hex');
}

export function createReceiptsRoutes(storage: IStorage): Router {
  const router = Router();

  router.get('/', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const queryResult = listQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid query parameters', queryResult.error.errors);
      }
      
      const { type, subjectId, limit = '50', offset = '0' } = queryResult.data;
      
      const filters: { type?: string; subjectId?: string } = {};
      
      if (type) {
        filters.type = type;
      }
      
      if (subjectId) {
        filters.subjectId = subjectId;
      }
      
      const receipts = await storage.listReceipts(filters);
      
      const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
      const offsetNum = parseInt(offset, 10) || 0;
      
      const paginatedReceipts = receipts.slice(offsetNum, offsetNum + limitNum);
      
      res.json({
        ok: true,
        receipts: paginatedReceipts.map(r => ({
          id: r.id,
          type: r.type,
          subjectId: r.subjectId,
          contentHash: r.contentHash,
          createdAt: r.createdAt,
          immutableSeq: r.immutableSeq,
        })),
        total: receipts.length,
        hasMore: offsetNum + limitNum < receipts.length,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'listReceipts',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/:id', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const paramResult = receiptIdParamSchema.safeParse({ id: req.params.id });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid receipt ID');
      }
      
      const { id } = paramResult.data;
      
      const receipt = await storage.getReceipt(id);
      
      if (!receipt) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Receipt not found');
      }
      
      res.json({
        ok: true,
        receipt: {
          id: receipt.id,
          type: receipt.type,
          subjectId: receipt.subjectId,
          contentHash: receipt.contentHash,
          proofBlob: receipt.proofBlob,
          createdAt: receipt.createdAt,
          createdBy: receipt.createdBy,
          immutableSeq: receipt.immutableSeq,
        },
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'getReceipt',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/verify', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = verifyProofSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { receiptId, proof } = result.data;
      
      const receipt = await storage.getReceipt(receiptId);
      
      if (!receipt) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Receipt not found');
      }
      
      const isValid = await storage.verifyReceipt(receiptId);
      
      const verificationResult = {
        receiptId,
        isValid,
        contentHash: receipt.contentHash,
        type: receipt.type,
        immutableSeq: receipt.immutableSeq,
        verifiedAt: new Date().toISOString(),
      };
      
      logger.info('Receipt verified', { 
        receiptId, 
        isValid, 
        verifiedBy: req.wallet 
      });
      
      res.json({
        ok: true,
        verification: verificationResult,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'verifyProof',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/anchor', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = anchorReceiptSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { type, subjectId, content, metadata } = result.data;
      const wallet = req.wallet!;
      
      const contentHash = hashContent(content);
      
      const anchorEvent: AnchorEvent = {
        appId: 'nexus-receipts',
        event: `receipt:${type}`,
        data: {
          wallet,
          subjectId,
          contentHash,
          type,
          timestamp: Date.now(),
          ...metadata,
        },
        ts: Date.now(),
        idempotencyKey: `${wallet}:${contentHash}:${Date.now()}`,
      };
      
      const { queued, ids } = await enqueueAnchors([anchorEvent]);
      
      logger.info('Receipt anchored', { 
        type, 
        subjectId, 
        contentHash,
        wallet,
        queued,
        anchorId: ids[0],
      });
      
      res.status(201).json({
        ok: true,
        anchor: {
          id: ids[0],
          type,
          subjectId,
          contentHash,
          queued,
          status: queued ? 'pending' : 'processed',
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'anchorReceipt',
        requestId: (req as any).id,
      });
    }
  });

  return router;
}
