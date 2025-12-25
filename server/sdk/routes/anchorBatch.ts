/**
 * Anchor Batch Route
 * 
 * POST /batch endpoint that accepts { events: AnchorEvent[] }
 * Chunks events into max 500 per job and adds to BullMQ queue.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getAnchorQueue, AnchorEvent, AnchorBatchJobData } from '../../queues/anchorQueue';
import { createError } from '../middleware/errors';
import { rootLogger } from '../../observability/logger';

interface AuthenticatedRequest extends Request {
  sdkUser?: { wallet: string; roles: string[] };
  wallet?: string;
}

const router = Router();

const MAX_EVENTS_PER_JOB = 500;
const MAX_EVENTS_PER_REQUEST = 10000;

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const wallet = req.sdkUser?.wallet || req.wallet || (req as any).session?.wallet;
  if (!wallet) {
    return res.status(401).json({ error: 'missing_token', message: 'Authorization token required' });
  }
  (req as any).authenticatedWallet = wallet;
  next();
}

router.post('/batch', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events)) {
      throw createError('events must be an array', 400, 'invalid_request');
    }

    if (events.length === 0) {
      throw createError('events array cannot be empty', 400, 'invalid_request');
    }

    if (events.length > MAX_EVENTS_PER_REQUEST) {
      throw createError(
        `Maximum ${MAX_EVENTS_PER_REQUEST} events per request`,
        400,
        'batch_too_large'
      );
    }

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event.appId || typeof event.appId !== 'string') {
        throw createError(`Event at index ${i} missing required 'appId' field`, 400, 'invalid_event');
      }
      if (!event.event || typeof event.event !== 'string') {
        throw createError(`Event at index ${i} missing required 'event' field`, 400, 'invalid_event');
      }
    }

    const wallet = (req as any).authenticatedWallet;
    const anchorEvents: AnchorEvent[] = events.map((e: any) => ({
      appId: e.appId,
      event: e.event,
      data: { ...e.data, wallet },
      ts: e.ts || Date.now(),
      idempotencyKey: e.idempotencyKey,
    }));

    const eventChunks = chunkArray(anchorEvents, MAX_EVENTS_PER_JOB);
    const queue = getAnchorQueue();
    const jobIds: string[] = [];
    const batchIds: string[] = [];
    const createdAt = Date.now();

    for (const chunk of eventChunks) {
      const batchId = generateBatchId();
      batchIds.push(batchId);

      const jobData: AnchorBatchJobData = {
        events: chunk,
        batchId,
        wallet,
        createdAt,
      };

      const job = await queue.add('anchor-batch', jobData, {
        jobId: `${batchId}`,
      });

      if (job.id) {
        jobIds.push(job.id);
      }
    }

    rootLogger.info('[AnchorBatch] Events queued', {
      totalEvents: events.length,
      batches: eventChunks.length,
      wallet: wallet?.slice(0, 10),
    });

    res.json({
      ok: true,
      accepted: events.length,
      batches: eventChunks.length,
      jobIds,
      batchIds,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/job/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const queue = getAnchorQueue();

    const job = await queue.getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'not_found',
        message: `Job ${jobId} not found`,
      });
    }

    const state = await job.getState();
    const progress = job.progress;

    res.json({
      jobId,
      state,
      progress: typeof progress === 'number' ? progress : 0,
      eventCount: (job.data as AnchorBatchJobData).events?.length || 0,
      createdAt: (job.data as AnchorBatchJobData).createdAt,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/queue-metrics', async (req, res, next) => {
  try {
    const queue = getAnchorQueue();

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    res.json({
      queue: queue.name,
      metrics: {
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
