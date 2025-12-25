import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { screenshots } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';

const logger = rootLogger.child({ module: 'screenshot-routes' });
const router = Router();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_ITEMS_PER_WALLET = 500;
const UPLOADS_DIR = 'uploads/screenshots';

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

function createReceipt(status: 'success' | 'error' | 'empty', extra?: Record<string, any>) {
  return {
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function ensureUploadDir(wallet: string): string {
  const walletDir = path.join(UPLOADS_DIR, wallet);
  if (!fs.existsSync(walletDir)) {
    fs.mkdirSync(walletDir, { recursive: true });
  }
  return walletDir;
}

const captureScreenshotSchema = z.object({
  imageData: z.string().min(1),
  name: z.string().max(256).optional(),
  context: z.string().max(64).optional(),
  meta: z.record(z.any()).optional(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const parsed = captureScreenshotSchema.parse(req.body);

    const base64Match = parsed.imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!base64Match) {
      return res.status(400).json({ 
        error: 'Invalid image data format. Expected base64 encoded image with data URI prefix.',
        receipt: createReceipt('error') 
      });
    }

    const mimeType = `image/${base64Match[1]}`;
    const base64Data = base64Match[2];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      return res.status(400).json({
        error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
        receipt: createReceipt('error', { maxSize: MAX_IMAGE_SIZE, actualSize: imageBuffer.length }),
      });
    }

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(screenshots)
      .where(eq(screenshots.walletAddress, wallet));
    const currentCount = Number(countResult?.count || 0);

    if (currentCount >= MAX_ITEMS_PER_WALLET) {
      return res.status(429).json({
        error: `Maximum ${MAX_ITEMS_PER_WALLET} screenshots per wallet exceeded`,
        receipt: createReceipt('error', { limit: MAX_ITEMS_PER_WALLET, current: currentCount }),
      });
    }

    const walletDir = ensureUploadDir(wallet);
    const timestamp = Date.now();
    const extension = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
    const filename = `${timestamp}.${extension}`;
    const filePath = path.join(walletDir, filename);
    const relativePath = path.join(wallet, filename);

    fs.writeFileSync(filePath, imageBuffer);

    const name = parsed.name || `Screenshot ${new Date(timestamp).toLocaleString()}`;

    const [screenshot] = await db.insert(screenshots).values({
      walletAddress: wallet,
      name,
      path: relativePath,
      mimeType,
      sizeBytes: imageBuffer.length,
      context: parsed.context,
      meta: parsed.meta,
    }).returning();

    logger.info(`Created screenshot ${screenshot.id} for wallet ${wallet} (size: ${imageBuffer.length} bytes)`);

    res.status(201).json({
      screenshot,
      receipt: createReceipt('success', { 
        screenshotId: screenshot.id,
        path: relativePath,
        sizeBytes: imageBuffer.length,
      }),
    });
  } catch (err: any) {
    logger.error(`Failed to capture screenshot: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || DEFAULT_PAGE_LIMIT, 100);
    const context = req.query.context as string | undefined;

    let query = db.select().from(screenshots)
      .where(context 
        ? and(eq(screenshots.walletAddress, wallet), eq(screenshots.context, context))
        : eq(screenshots.walletAddress, wallet))
      .orderBy(desc(screenshots.createdAt))
      .limit(limit)
      .offset(offset);

    const items = await query;

    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(screenshots)
      .where(context 
        ? and(eq(screenshots.walletAddress, wallet), eq(screenshots.context, context))
        : eq(screenshots.walletAddress, wallet));
    const total = Number(countResult?.count || 0);

    logger.info(`Listed ${items.length} screenshots for wallet ${wallet}`);
    res.json({
      screenshots: items,
      pagination: { offset, limit, total },
      receipt: createReceipt(items.length ? 'success' : 'empty', { count: items.length }),
    });
  } catch (err: any) {
    logger.error(`Failed to list screenshots: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const screenshotId = req.params.id;

    const [screenshot] = await db.select().from(screenshots)
      .where(and(eq(screenshots.id, screenshotId), eq(screenshots.walletAddress, wallet)));

    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found', receipt: createReceipt('error') });
    }

    logger.info(`Retrieved screenshot ${screenshotId} for wallet ${wallet}`);
    res.json({
      screenshot,
      receipt: createReceipt('success', { screenshotId }),
    });
  } catch (err: any) {
    logger.error(`Failed to get screenshot: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: createReceipt('error') });
    }

    const screenshotId = req.params.id;

    const [screenshot] = await db.select().from(screenshots)
      .where(and(eq(screenshots.id, screenshotId), eq(screenshots.walletAddress, wallet)));

    if (!screenshot) {
      return res.status(404).json({ error: 'Screenshot not found', receipt: createReceipt('error') });
    }

    const filePath = path.join(UPLOADS_DIR, screenshot.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const [deleted] = await db.delete(screenshots)
      .where(and(eq(screenshots.id, screenshotId), eq(screenshots.walletAddress, wallet)))
      .returning();

    logger.info(`Deleted screenshot ${screenshotId} for wallet ${wallet}`);

    res.json({
      success: true,
      receipt: createReceipt('success', { screenshotId }),
    });
  } catch (err: any) {
    logger.error(`Failed to delete screenshot: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: createReceipt('error') });
  }
});

export default router;
