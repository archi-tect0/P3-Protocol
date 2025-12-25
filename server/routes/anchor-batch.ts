import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { enqueueAnchors, AnchorEvent } from '../anchor/queue';
import { anchorLimiter } from '../rate/limits';

const router = Router();

const batchAnchorSchema = z.object({
  events: z.array(z.object({
    appId: z.string(),
    event: z.string(),
    data: z.record(z.unknown()).optional(),
    ts: z.number().optional(),
  })).min(1).max(1000),
});

router.post('/api/anchor/batch', anchorLimiter, async (req: Request, res: Response) => {
  try {
    const result = batchAnchorSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: result.error.errors,
      });
    }

    const events: AnchorEvent[] = result.data.events;
    const queueResult = await enqueueAnchors(events);

    return res.json({ 
      ok: true, 
      queued: queueResult.count, 
      async: queueResult.queued 
    });
  } catch (error) {
    console.error('Batch anchor error:', error);
    return res.status(500).json({
      error: 'Failed to process anchor events',
    });
  }
});

export default router;
