import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { notifications, notificationTypes, insertNotificationSchema, pushSubscriptions } from '@shared/schema';
import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';
import { fetchRandomWikipedia, sendWikiNotification } from '../services/pushNotifications';
import { getVapidPublicKey, webPush } from '../services/vapidKeys';

const logger = rootLogger.child({ module: 'notifications-routes' });
const router = Router();

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

const listNotificationsSchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  type: z.enum(notificationTypes).optional(),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 50),
  offset: z.string().optional().transform(v => v ? parseInt(v) : 0),
});

const createNotificationSchema = z.object({
  walletAddress: z.string().min(1),
  type: z.enum(notificationTypes),
  title: z.string().min(1).max(256),
  body: z.string().optional(),
  iconUrl: z.string().url().optional(),
  source: z.string().min(1).max(64),
  meta: z.record(z.any()).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      logger.warn(`[${new Date().toISOString()}] List notifications failed: no wallet`);
      return res.status(401).json({ 
        error: 'Wallet address required', 
        receipt: { status: 'error', timestamp: new Date().toISOString() } 
      });
    }

    const parsed = listNotificationsSchema.parse(req.query);
    
    let query = db.select().from(notifications)
      .where(eq(notifications.walletAddress, wallet))
      .orderBy(desc(notifications.createdAt))
      .limit(parsed.limit)
      .offset(parsed.offset);

    const allNotifications = await query;
    
    let filtered = allNotifications;
    if (parsed.unread === 'true') {
      filtered = filtered.filter(n => n.readAt === null);
    } else if (parsed.unread === 'false') {
      filtered = filtered.filter(n => n.readAt !== null);
    }
    
    if (parsed.type) {
      filtered = filtered.filter(n => n.type === parsed.type);
    }

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Listed ${filtered.length} notifications for wallet ${wallet} (${latencyMs}ms)`);
    
    res.json({ 
      notifications: filtered, 
      count: filtered.length, 
      receipt: { 
        status: filtered.length ? 'success' : 'empty',
        timestamp: new Date().toISOString(),
        latencyMs 
      } 
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to list notifications: ${err.message}`);
    res.status(400).json({ 
      error: err.message, 
      receipt: { status: 'error', timestamp: new Date().toISOString() } 
    });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const parsed = createNotificationSchema.parse(req.body);
    
    const [notification] = await db.insert(notifications).values({
      walletAddress: parsed.walletAddress.toLowerCase(),
      type: parsed.type,
      title: parsed.title,
      body: parsed.body,
      iconUrl: parsed.iconUrl,
      source: parsed.source,
      meta: parsed.meta,
    }).returning();

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Created notification ${notification.id} for wallet ${parsed.walletAddress} (${latencyMs}ms)`);
    
    res.status(201).json({ 
      notification, 
      receipt: { 
        status: 'success',
        timestamp: new Date().toISOString(),
        latencyMs 
      } 
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to create notification: ${err.message}`);
    res.status(400).json({ 
      error: err.message, 
      receipt: { status: 'error', timestamp: new Date().toISOString() } 
    });
  }
});

router.post('/:id/read', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      logger.warn(`[${new Date().toISOString()}] Mark read failed: no wallet`);
      return res.status(401).json({ 
        error: 'Wallet address required', 
        receipt: { status: 'error', timestamp: new Date().toISOString() } 
      });
    }

    const [updated] = await db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(
        eq(notifications.id, req.params.id),
        eq(notifications.walletAddress, wallet)
      ))
      .returning();

    if (!updated) {
      logger.warn(`[${new Date().toISOString()}] Notification ${req.params.id} not found for wallet ${wallet}`);
      return res.status(404).json({ 
        error: 'Notification not found', 
        receipt: { status: 'error', timestamp: new Date().toISOString() } 
      });
    }

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Marked notification ${req.params.id} as read for wallet ${wallet} (${latencyMs}ms)`);
    
    res.json({ 
      notification: updated, 
      receipt: { 
        status: 'success',
        timestamp: new Date().toISOString(),
        latencyMs 
      } 
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to mark notification as read: ${err.message}`);
    res.status(400).json({ 
      error: err.message, 
      receipt: { status: 'error', timestamp: new Date().toISOString() } 
    });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      logger.warn(`[${new Date().toISOString()}] Delete notification failed: no wallet`);
      return res.status(401).json({ 
        error: 'Wallet address required', 
        receipt: { status: 'error', timestamp: new Date().toISOString() } 
      });
    }

    const [deleted] = await db.delete(notifications)
      .where(and(
        eq(notifications.id, req.params.id),
        eq(notifications.walletAddress, wallet)
      ))
      .returning();

    if (!deleted) {
      logger.warn(`[${new Date().toISOString()}] Notification ${req.params.id} not found for wallet ${wallet}`);
      return res.status(404).json({ 
        error: 'Notification not found', 
        receipt: { status: 'error', timestamp: new Date().toISOString() } 
      });
    }

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Deleted notification ${req.params.id} for wallet ${wallet} (${latencyMs}ms)`);
    
    res.json({ 
      success: true, 
      receipt: { 
        status: 'success',
        timestamp: new Date().toISOString(),
        latencyMs 
      } 
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to delete notification: ${err.message}`);
    res.status(400).json({ 
      error: err.message, 
      receipt: { status: 'error', timestamp: new Date().toISOString() } 
    });
  }
});

router.get('/stream', async (req: Request, res: Response) => {
  const wallet = getWallet(req);
  if (!wallet) {
    logger.warn(`[${new Date().toISOString()}] SSE stream failed: no wallet`);
    return res.status(401).json({ 
      error: 'Wallet address required', 
      receipt: { status: 'error', timestamp: new Date().toISOString() } 
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  logger.info(`[${new Date().toISOString()}] SSE stream opened for wallet ${wallet}`);

  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    wallet,
    timestamp: new Date().toISOString() 
  })}\n\n`);
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }

  const unreadNotifications = await db.select().from(notifications)
    .where(and(
      eq(notifications.walletAddress, wallet),
      isNull(notifications.readAt)
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(10);

  for (const notification of unreadNotifications) {
    res.write(`data: ${JSON.stringify({
      type: 'notification',
      id: notification.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      iconUrl: notification.iconUrl,
      source: notification.source,
      meta: notification.meta,
      createdAt: notification.createdAt,
      timestamp: new Date().toISOString()
    })}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  }

  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ 
        type: 'heartbeat', 
        timestamp: new Date().toISOString() 
      })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeatInterval);
    logger.info(`[${new Date().toISOString()}] SSE stream closed for wallet ${wallet}`);
  });
});

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
    expirationTime: z.number().nullable().optional(),
  }),
  topics: z.array(z.string()).optional(),
});

const testPushSchema = z.object({
  title: z.string().default('Test Notification'),
  body: z.string().default('This is a test push notification from P3 Protocol'),
  icon: z.string().optional(),
  data: z.record(z.any()).optional(),
});

router.get('/vapid-public-key', (req: Request, res: Response) => {
  logger.info(`[${new Date().toISOString()}] VAPID public key requested`);
  res.json({
    publicKey: getVapidPublicKey(),
    receipt: { status: 'success', timestamp: new Date().toISOString() },
  });
});

router.post('/subscribe', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      logger.warn(`[${new Date().toISOString()}] Push subscribe failed: no wallet`);
      return res.status(401).json({
        error: 'Wallet address required',
        receipt: { status: 'error', timestamp: new Date().toISOString() },
      });
    }

    const parsed = subscribeSchema.parse(req.body);
    const { subscription, topics } = parsed;

    const existing = await db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
      .limit(1);

    if (existing.length > 0) {
      await db.update(pushSubscriptions)
        .set({
          walletAddress: wallet,
          keys: subscription.keys,
          topics: topics || [],
        })
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      
      const latencyMs = Date.now() - startTime;
      logger.info(`[${new Date().toISOString()}] Updated push subscription for wallet ${wallet} (${latencyMs}ms)`);
      return res.json({
        success: true,
        updated: true,
        receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
      });
    }

    const [created] = await db.insert(pushSubscriptions).values({
      walletAddress: wallet,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      topics: topics || [],
    }).returning();

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Created push subscription ${created.id} for wallet ${wallet} (${latencyMs}ms)`);

    res.status(201).json({
      success: true,
      subscriptionId: created.id,
      receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to subscribe: ${err.message}`);
    res.status(400).json({
      error: err.message,
      receipt: { status: 'error', timestamp: new Date().toISOString() },
    });
  }
});

router.delete('/unsubscribe', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      logger.warn(`[${new Date().toISOString()}] Push unsubscribe failed: no wallet`);
      return res.status(401).json({
        error: 'Wallet address required',
        receipt: { status: 'error', timestamp: new Date().toISOString() },
      });
    }

    const endpoint = req.body?.endpoint || req.query?.endpoint;

    if (endpoint) {
      const [deleted] = await db.delete(pushSubscriptions)
        .where(and(
          eq(pushSubscriptions.endpoint, endpoint as string),
          eq(pushSubscriptions.walletAddress, wallet)
        ))
        .returning();

      if (!deleted) {
        logger.warn(`[${new Date().toISOString()}] Push subscription not found for endpoint`);
        return res.status(404).json({
          error: 'Subscription not found',
          receipt: { status: 'error', timestamp: new Date().toISOString() },
        });
      }

      const latencyMs = Date.now() - startTime;
      logger.info(`[${new Date().toISOString()}] Deleted push subscription for wallet ${wallet} (${latencyMs}ms)`);
      return res.json({
        success: true,
        receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
      });
    }

    const result = await db.delete(pushSubscriptions)
      .where(eq(pushSubscriptions.walletAddress, wallet))
      .returning();

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Deleted ${result.length} push subscriptions for wallet ${wallet} (${latencyMs}ms)`);

    res.json({
      success: true,
      deletedCount: result.length,
      receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to unsubscribe: ${err.message}`);
    res.status(400).json({
      error: err.message,
      receipt: { status: 'error', timestamp: new Date().toISOString() },
    });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      logger.warn(`[${new Date().toISOString()}] Test push failed: no wallet`);
      return res.status(401).json({
        error: 'Wallet address required',
        receipt: { status: 'error', timestamp: new Date().toISOString() },
      });
    }

    const parsed = testPushSchema.parse(req.body);
    
    const subscriptionsList = await db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.walletAddress, wallet));

    if (subscriptionsList.length === 0) {
      logger.warn(`[${new Date().toISOString()}] No push subscriptions found for wallet ${wallet}`);
      return res.status(404).json({
        error: 'No push subscriptions found for this wallet',
        receipt: { status: 'error', timestamp: new Date().toISOString() },
      });
    }

    const payload = JSON.stringify({
      title: parsed.title,
      body: parsed.body,
      icon: parsed.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: parsed.data || { type: 'test', timestamp: new Date().toISOString() },
    });

    const results = await Promise.allSettled(
      subscriptionsList.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        return webPush.sendNotification(pushSubscription, payload);
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const err = (results[i] as PromiseRejectedResult).reason;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, subscriptionsList[i].endpoint));
          logger.info(`[${new Date().toISOString()}] Removed stale subscription for wallet ${wallet}`);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Sent test push to wallet ${wallet}: ${succeeded} succeeded, ${failed} failed (${latencyMs}ms)`);

    res.json({
      success: true,
      sent: succeeded,
      failed,
      total: subscriptionsList.length,
      receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to send test push: ${err.message}`);
    res.status(400).json({
      error: err.message,
      receipt: { status: 'error', timestamp: new Date().toISOString() },
    });
  }
});

router.get('/subscriptions', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({
        error: 'Wallet address required',
        receipt: { status: 'error', timestamp: new Date().toISOString() },
      });
    }

    const subs = await db.select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      topics: pushSubscriptions.topics,
      createdAt: pushSubscriptions.createdAt,
    }).from(pushSubscriptions)
      .where(eq(pushSubscriptions.walletAddress, wallet));

    const latencyMs = Date.now() - startTime;
    res.json({
      subscriptions: subs,
      count: subs.length,
      receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Failed to list subscriptions: ${err.message}`);
    res.status(400).json({
      error: err.message,
      receipt: { status: 'error', timestamp: new Date().toISOString() },
    });
  }
});

router.get('/random-wiki', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const wikiArticle = await fetchRandomWikipedia();
    
    if (!wikiArticle) {
      logger.warn(`[${new Date().toISOString()}] Failed to fetch random Wikipedia article`);
      return res.status(503).json({
        error: 'Failed to fetch Wikipedia article',
        receipt: { status: 'error', timestamp: new Date().toISOString() },
      });
    }

    const sendToAll = req.query.broadcast === 'true';
    
    const result = await sendWikiNotification(
      wikiArticle.title,
      wikiArticle.extract,
      wikiArticle.url
    );

    const latencyMs = Date.now() - startTime;
    logger.info(`[${new Date().toISOString()}] Random wiki notification sent: ${wikiArticle.title} (${latencyMs}ms)`);

    res.json({
      ok: true,
      article: {
        title: wikiArticle.title,
        extract: wikiArticle.extract,
        url: wikiArticle.url,
        thumbnail: wikiArticle.thumbnail,
      },
      notifications: {
        sent: result.sent,
        failed: result.failed,
        removed: result.removed,
      },
      receipt: { status: 'success', timestamp: new Date().toISOString(), latencyMs },
    });
  } catch (err: any) {
    logger.error(`[${new Date().toISOString()}] Random wiki notification error: ${err.message}`);
    res.status(500).json({
      error: err.message,
      receipt: { status: 'error', timestamp: new Date().toISOString() },
    });
  }
});

export default router;
