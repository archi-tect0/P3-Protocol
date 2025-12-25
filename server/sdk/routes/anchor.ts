import { Router } from 'express';
import { enqueueAnchors, AnchorEvent } from '../../anchor/queue';
import { createError } from '../middleware/errors';

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { appId, event, data, anchor = false, ts, batchId } = req.body;

    if (!appId || !event) {
      throw createError('appId and event are required', 400, 'invalid_request');
    }

    const anchorEvent: AnchorEvent = {
      appId,
      event,
      data: { ...data, wallet: req.sdkUser?.wallet },
      ts: ts || Date.now(),
    };

    let receiptId: string | undefined;

    if (anchor) {
      const result = await enqueueAnchors([anchorEvent]);
      receiptId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    res.json({ ok: true, receiptId, batchId });
  } catch (err) {
    next(err);
  }
});

router.post('/batch', async (req, res, next) => {
  try {
    const { events = [], anchor = true } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      throw createError('events array is required', 400, 'invalid_request');
    }

    if (events.length > 1000) {
      throw createError('Maximum 1000 events per batch', 400, 'batch_too_large');
    }

    const wallet = req.sdkUser?.wallet;
    const anchorEvents: AnchorEvent[] = events.map((e: any) => ({
      appId: e.appId,
      event: e.event,
      data: { ...e.data, wallet },
      ts: e.ts || Date.now(),
    }));

    if (anchor && anchorEvents.length > 0) {
      await enqueueAnchors(anchorEvents);
    }

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    res.json({ ok: true, count: events.length, batchId });
  } catch (err) {
    next(err);
  }
});

router.get('/status/:receiptId', async (req, res, next) => {
  try {
    const { receiptId } = req.params;
    
    const { db } = await import('../../pg-storage');
    const { anchorReceipts, anchorOutbox } = await import('@shared/schema');
    const { eq, or } = await import('drizzle-orm');
    
    // Check receipts table for confirmed anchors
    const receipt = await db
      .select()
      .from(anchorReceipts)
      .where(or(
        eq(anchorReceipts.idempotencyKey, receiptId),
        eq(anchorReceipts.outboxId, receiptId)
      ))
      .limit(1);
    
    if (receipt.length > 0) {
      return res.json({
        confirmed: receipt[0].status === 'confirmed',
        txHash: receipt[0].txHash || undefined,
        blockNumber: receipt[0].blockNumber || undefined,
        status: receipt[0].status,
        confirmedAt: receipt[0].confirmedAt?.toISOString(),
        receiptId,
      });
    }
    
    // Check outbox for pending/processing events
    const outboxEntry = await db
      .select()
      .from(anchorOutbox)
      .where(eq(anchorOutbox.id, receiptId))
      .limit(1);
    
    if (outboxEntry.length > 0) {
      return res.json({
        confirmed: outboxEntry[0].status === 'completed',
        status: outboxEntry[0].status,
        queuedAt: outboxEntry[0].createdAt?.toISOString(),
        receiptId,
      });
    }
    
    // Not found
    res.json({ 
      confirmed: false, 
      status: 'not_found',
      receiptId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
