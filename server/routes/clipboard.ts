import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { clipboardItems } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'clipboard-routes' });
const router = Router();

const MAX_CONTENT_SIZE = 16 * 1024;
const MAX_PREVIEW_LENGTH = 256;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_ITEMS_PER_WALLET = 100;

const clipboardKinds = ['text', 'url', 'json', 'code', 'ai_output'] as const;

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

function generatePreview(content: string): string {
  if (!content) return '';
  const preview = content.slice(0, MAX_PREVIEW_LENGTH);
  return content.length > MAX_PREVIEW_LENGTH ? preview + '...' : preview;
}

function createReceipt(status: 'success' | 'error' | 'empty', extra?: Record<string, any>) {
  return {
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

const createClipboardItemSchema = z.object({
  kind: z.enum(clipboardKinds),
  content: z.string().min(1).max(MAX_CONTENT_SIZE),
  sourceApp: z.string().max(64).optional(),
});

const sseClients = new Map<string, Set<Response>>();

function notifyClipboardChange(wallet: string, event: { type: string; item?: any; itemId?: string }) {
  const clients = sseClients.get(wallet);
  if (clients) {
    const data = JSON.stringify(event);
    clients.forEach((res) => {
      try {
        res.write(`data: ${data}\n\n`);
      } catch (err) {
        clients.delete(res);
      }
    });
  }
}

router.get('/stream', async (req: Request, res: Response) => {
  const wallet = getWallet(req);
  if (!wallet) {
    return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(`data: ${JSON.stringify({ type: 'connected', wallet })}\n\n`);

  if (!sseClients.has(wallet)) {
    sseClients.set(wallet, new Set());
  }
  sseClients.get(wallet)!.add(res);

  logger.info(`SSE client connected for wallet ${wallet}`);

  req.on('close', () => {
    const clients = sseClients.get(wallet);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(wallet);
      }
    }
    logger.info(`SSE client disconnected for wallet ${wallet}`);
  });
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT, 100);

    const items = await db.select().from(clipboardItems)
      .where(eq(clipboardItems.walletAddress, wallet))
      .orderBy(desc(clipboardItems.isPinned), desc(clipboardItems.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(clipboardItems)
      .where(eq(clipboardItems.walletAddress, wallet));
    const total = Number(countResult?.count || 0);

    logger.info(`Listed ${items.length} clipboard items for wallet ${wallet}`);
    res.json({
      items,
      pagination: { offset, limit, total },
      receipt: createReceipt(items.length ? 'success' : 'empty', { count: items.length }),
    });
  } catch (err: any) {
    logger.error(`Failed to list clipboard items: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const parsed = createClipboardItemSchema.parse(req.body);

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(clipboardItems)
      .where(eq(clipboardItems.walletAddress, wallet));
    const currentCount = Number(countResult?.count || 0);

    if (currentCount >= MAX_ITEMS_PER_WALLET) {
      return res.status(429).json({
        error: `Maximum ${MAX_ITEMS_PER_WALLET} items per wallet exceeded`,
        receipt: createReceipt('error', { limit: MAX_ITEMS_PER_WALLET, current: currentCount }),
      });
    }

    const preview = generatePreview(parsed.content);

    const [item] = await db.insert(clipboardItems).values({
      walletAddress: wallet,
      kind: parsed.kind,
      content: parsed.content,
      preview,
      sourceApp: parsed.sourceApp,
      isPinned: false,
    }).returning();

    logger.info(`Created clipboard item ${item.id} for wallet ${wallet} (kind: ${parsed.kind})`);

    notifyClipboardChange(wallet, { type: 'add', item });

    res.status(201).json({
      item,
      receipt: createReceipt('success', { itemId: item.id }),
    });
  } catch (err: any) {
    logger.error(`Failed to create clipboard item: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const itemId = req.params.id;

    const [deleted] = await db.delete(clipboardItems)
      .where(and(eq(clipboardItems.id, itemId), eq(clipboardItems.walletAddress, wallet)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Item not found', receipt: createReceipt('error') });
    }

    logger.info(`Deleted clipboard item ${itemId} for wallet ${wallet}`);

    notifyClipboardChange(wallet, { type: 'delete', itemId });

    res.json({
      success: true,
      receipt: createReceipt('success', { itemId }),
    });
  } catch (err: any) {
    logger.error(`Failed to delete clipboard item: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.post('/:id/pin', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const itemId = req.params.id;

    const [existing] = await db.select().from(clipboardItems)
      .where(and(eq(clipboardItems.id, itemId), eq(clipboardItems.walletAddress, wallet)));

    if (!existing) {
      return res.status(404).json({ error: 'Item not found', receipt: createReceipt('error') });
    }

    const newPinned = !existing.isPinned;

    const [updated] = await db.update(clipboardItems)
      .set({ isPinned: newPinned })
      .where(eq(clipboardItems.id, itemId))
      .returning();

    logger.info(`Toggled pin for clipboard item ${itemId} to ${newPinned} for wallet ${wallet}`);

    notifyClipboardChange(wallet, { type: 'update', item: updated });

    res.json({
      item: updated,
      receipt: createReceipt('success', { itemId, isPinned: newPinned }),
    });
  } catch (err: any) {
    logger.error(`Failed to toggle pin: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

export default router;
