import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eventBus, insertEventBusSchema } from '@shared/schema';
import { eq, desc, gte, and } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

interface EnterpriseRequest extends Request {
  walletAddr?: string;
  isSuperuser?: boolean;
}

const subscribers = new Map<string, Set<Response>>();

function getWalletAddr(req: Request): string | undefined {
  return (req.headers['x-p3-addr'] as string)?.toLowerCase();
}

const publishSchema = z.object({
  topic: z.string().min(1).max(64),
  payload: z.record(z.any()),
  expiresAt: z.string().datetime().optional(),
});

router.post('/publish', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const walletAddr = getWalletAddr(req);
  
  if (!walletAddr) {
    res.status(401).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const result = publishSchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    return;
  }

  const { topic, payload, expiresAt } = result.data;

  try {
    const [event] = await db
      .insert(eventBus)
      .values({
        topic,
        payload,
        publisher: walletAddr,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    const topicSubscribers = subscribers.get(topic);
    if (topicSubscribers) {
      const sseData = JSON.stringify({
        id: event.id,
        topic: event.topic,
        payload: event.payload,
        publisher: event.publisher,
        createdAt: event.createdAt,
      });

      for (const clientRes of topicSubscribers) {
        try {
          clientRes.write(`data: ${sseData}\n\n`);
        } catch (err) {
          topicSubscribers.delete(clientRes);
        }
      }
    }

    res.status(201).json({
      ok: true,
      event: {
        id: event.id,
        topic: event.topic,
        createdAt: event.createdAt,
      },
      subscriberCount: topicSubscribers?.size || 0,
    });
  } catch (error) {
    console.error('[EVENTS] Error publishing event:', error);
    res.status(500).json({ error: 'Failed to publish event' });
  }
});

router.get('/subscribe', (req: EnterpriseRequest, res: Response): void => {
  const topic = req.query.topic as string;
  
  if (!topic) {
    res.status(400).json({ error: 'Topic query parameter is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'connected', topic })}\n\n`);

  if (!subscribers.has(topic)) {
    subscribers.set(topic, new Set());
  }
  subscribers.get(topic)!.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const topicSubs = subscribers.get(topic);
    if (topicSubs) {
      topicSubs.delete(res);
      if (topicSubs.size === 0) {
        subscribers.delete(topic);
      }
    }
  });
});

router.get('/topics', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  try {
    const events = await db
      .select({
        topic: eventBus.topic,
      })
      .from(eventBus)
      .groupBy(eventBus.topic)
      .limit(100);

    const topics = events.map(e => e.topic);
    const activeSubscribers: Record<string, number> = {};
    
    for (const [topic, subs] of subscribers) {
      activeSubscribers[topic] = subs.size;
    }

    res.json({
      topics,
      activeSubscribers,
    });
  } catch (error) {
    console.error('[EVENTS] Error fetching topics:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

router.get('/history/:topic', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const { topic } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const since = req.query.since as string;

  try {
    const conditions = [eq(eventBus.topic, topic)];
    
    if (since) {
      conditions.push(gte(eventBus.createdAt, new Date(since)));
    }

    const events = await db
      .select()
      .from(eventBus)
      .where(and(...conditions))
      .orderBy(desc(eventBus.createdAt))
      .limit(limit);

    res.json({
      topic,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('[EVENTS] Error fetching event history:', error);
    res.status(500).json({ error: 'Failed to fetch event history' });
  }
});

export default router;
