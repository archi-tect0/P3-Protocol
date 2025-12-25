import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { browserFavorites, webSessions, webSessionReceipts, siteProfiles } from '@shared/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { closePage, refresh } from '../services/webBridge';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[TASK-MANAGER] ${msg}`),
  error: (msg: string) => console.error(`[TASK-MANAGER ERROR] ${msg}`),
};

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string) || null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const activeSessions = await db.select().from(webSessions).where(and(
      eq(webSessions.walletAddress, wallet),
      eq(webSessions.status, 'active')
    ));

    const favorites = await db.select().from(browserFavorites)
      .where(eq(browserFavorites.walletAddress, wallet))
      .orderBy(asc(browserFavorites.section), asc(browserFavorites.position));

    const receipts = await db.select().from(webSessionReceipts)
      .where(eq(webSessionReceipts.walletAddress, wallet))
      .orderBy(desc(webSessionReceipts.timestamp))
      .limit(50);

    const enrichedFavorites = await Promise.all(favorites.map(async (fav) => {
      let target: any = null;
      
      if (fav.targetType === 'webSession') {
        const [session] = await db.select().from(webSessions).where(eq(webSessions.id, fav.targetId));
        target = session;
      } else if (fav.targetType === 'siteProfile') {
        const [profile] = await db.select().from(siteProfiles).where(eq(siteProfiles.id, fav.targetId));
        target = profile;
      }
      
      return {
        ...fav,
        target,
        displayName: fav.customName || target?.name || target?.title || fav.targetId,
        displayIcon: fav.customIcon || target?.iconUrl || null,
      };
    }));

    const stats = {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      activeSessions: activeSessions.length,
      favoritesCount: favorites.length,
      receiptsCount: receipts.length,
    };

    const formattedReceipts = receipts.map(r => ({
      id: r.id,
      action: r.action,
      actor: r.actor,
      timestamp: r.timestamp.toISOString(),
      meta: r.metaJson as Record<string, any>,
      sessionId: r.sessionId,
    }));

    res.json({
      stats,
      activeSessions: activeSessions.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        status: s.status,
        snapshotPath: s.snapshotPath,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
      favorites: enrichedFavorites,
      receipts: formattedReceipts,
    });
  } catch (err: any) {
    logger.error(`Get task manager failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

const ReplayReceiptSchema = z.object({
  receiptId: z.string().uuid(),
});

router.post('/receipts/replay', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = ReplayReceiptSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { receiptId } = parse.data;

    const [receipt] = await db.select().from(webSessionReceipts).where(and(
      eq(webSessionReceipts.id, receiptId),
      eq(webSessionReceipts.walletAddress, wallet)
    ));

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const meta = receipt.metaJson as Record<string, any>;
    let result: any = { replayed: receipt.action };

    if (receipt.action.startsWith('web.')) {
      if (receipt.sessionId) {
        const [session] = await db.select().from(webSessions).where(eq(webSessions.id, receipt.sessionId));
        if (session && session.status === 'active') {
          if (receipt.action === 'web.refresh') {
            await refresh(receipt.sessionId);
            result.refreshed = true;
          } else if (receipt.action === 'web.navigate' && meta.url) {
            result.navigateTo = meta.url;
          }
        }
      }
    } else if (receipt.action.startsWith('favorites.')) {
      result.favoriteAction = receipt.action;
      result.meta = meta;
    }

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: receipt.sessionId,
      actor: 'agent:ATLAS',
      action: 'receipt.replay',
      metaJson: { sourceReceiptId: receiptId, originalAction: receipt.action },
    });

    logger.info(`Replayed receipt ${receiptId} for ${wallet}`);
    res.json(result);
  } catch (err: any) {
    logger.error(`Replay receipt failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

const UnpinFavoriteSchema = z.object({
  favoriteId: z.string().uuid(),
});

router.post('/favorites/unpin', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = UnpinFavoriteSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { favoriteId } = parse.data;

    const [fav] = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.id, favoriteId),
      eq(browserFavorites.walletAddress, wallet)
    ));

    if (!fav) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await db.delete(browserFavorites).where(eq(browserFavorites.id, favoriteId));

    const rest = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.walletAddress, wallet),
      eq(browserFavorites.section, fav.section)
    )).orderBy(asc(browserFavorites.position));

    for (let i = 0; i < rest.length; i++) {
      await db.update(browserFavorites)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(browserFavorites.id, rest[i].id));
    }

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: fav.targetType === 'webSession' ? fav.targetId : null as any,
      actor: 'user',
      action: 'favorites.unpin',
      metaJson: { favoriteId, targetId: fav.targetId, targetType: fav.targetType, section: fav.section },
    });

    logger.info(`Unpinned favorite ${favoriteId} for ${wallet}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Unpin favorite failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

const SessionOpSchema = z.object({
  sessionId: z.string().uuid(),
  op: z.enum(['refresh', 'resume', 'signout']),
});

router.post('/sessions/op', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = SessionOpSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { sessionId, op } = parse.data;

    const [session] = await db.select().from(webSessions).where(and(
      eq(webSessions.id, sessionId),
      eq(webSessions.walletAddress, wallet)
    ));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let result: any = { op, sessionId };

    if (op === 'refresh' && session.status === 'active') {
      await refresh(sessionId);
      result.refreshed = true;
    } else if (op === 'signout') {
      await closePage(sessionId);
      await db.update(webSessions)
        .set({ status: 'signedOut', cookiesJson: {}, storageJson: {}, updatedAt: new Date() })
        .where(eq(webSessions.id, sessionId));
      result.signedOut = true;
    } else if (op === 'resume') {
      result.resumeUrl = session.url;
    }

    const meta = session.metaJson as Record<string, any>;
    const domain = meta?.domain || 'unknown';

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId,
      actor: 'user',
      action: `taskmanager.${op}`,
      metaJson: { sessionId, url: session.url, domain },
    });

    logger.info(`Task manager ${op} on session ${sessionId} for ${wallet}`);
    res.json(result);
  } catch (err: any) {
    logger.error(`Session op failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/receipts', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { limit = '50', offset = '0', action } = req.query;

    let whereClause = eq(webSessionReceipts.walletAddress, wallet);

    if (action && typeof action === 'string') {
      whereClause = and(
        eq(webSessionReceipts.walletAddress, wallet),
        eq(webSessionReceipts.action, action)
      )!;
    }

    const receipts = await db.select().from(webSessionReceipts)
      .where(whereClause)
      .orderBy(desc(webSessionReceipts.timestamp))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({
      receipts: receipts.map(r => ({
        id: r.id,
        action: r.action,
        actor: r.actor,
        timestamp: r.timestamp.toISOString(),
        meta: r.metaJson,
        sessionId: r.sessionId,
      })),
    });
  } catch (err: any) {
    logger.error(`Get receipts failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
