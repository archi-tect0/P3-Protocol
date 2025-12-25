import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { fileHubEntries, fileHubTypes } from '@shared/schema';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[FILE-HUB] ${msg}`),
  error: (msg: string) => console.error(`[FILE-HUB ERROR] ${msg}`),
};

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

function createReceipt(wallet: string, action: string, meta?: Record<string, any>) {
  const data = JSON.stringify({ wallet, action, meta, ts: Date.now() });
  const hash = '0x' + createHash('sha256').update(data).digest('hex');
  return { status: 'success', hash, timestamp: new Date().toISOString() };
}

function inferFileType(mime: string): typeof fileHubTypes[number] {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('application/pdf') || mime.includes('document') || mime.includes('text')) return 'document';
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z')) return 'archive';
  if (mime.includes('json') || mime.includes('csv') || mime.includes('xml')) return 'data';
  return 'other';
}

const createEntrySchema = z.object({
  name: z.string().min(1).max(256),
  mime: z.string().max(128).default('application/octet-stream'),
  sizeBytes: z.number().int().min(0).default(0),
  storageRef: z.string().optional(),
  storageProvider: z.enum(['local', 'ipfs', 's3']).default('local'),
  parentId: z.string().uuid().optional().nullable(),
  isFolder: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  sha256: z.string().optional(),
});

const createFolderSchema = z.object({
  name: z.string().min(1).max(256),
  parentId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const updateEntrySchema = z.object({
  name: z.string().min(1).max(256).optional(),
  parentId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parentId = req.query.parentId as string | undefined;
    const typeFilter = req.query.type as string | undefined;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    let conditions = [eq(fileHubEntries.walletAddress, wallet)];

    if (parentId) {
      conditions.push(eq(fileHubEntries.parentId, parentId));
    } else {
      conditions.push(isNull(fileHubEntries.parentId));
    }

    if (typeFilter && fileHubTypes.includes(typeFilter as any)) {
      conditions.push(eq(fileHubEntries.type, typeFilter as typeof fileHubTypes[number]));
    }

    const entries = await db.select().from(fileHubEntries)
      .where(and(...conditions))
      .orderBy(desc(fileHubEntries.isFolder), desc(fileHubEntries.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(fileHubEntries)
      .where(and(...conditions));
    const total = Number(countResult?.count || 0);

    const [statsResult] = await db.select({
      totalFiles: sql<number>`count(*) filter (where is_folder = false)`,
      totalFolders: sql<number>`count(*) filter (where is_folder = true)`,
      totalSize: sql<number>`coalesce(sum(size_bytes), 0)`,
    }).from(fileHubEntries)
      .where(eq(fileHubEntries.walletAddress, wallet));

    logger.info(`Listed ${entries.length} entries for wallet ${wallet}`);
    res.json({
      entries,
      pagination: { offset, limit, total },
      stats: {
        totalFiles: Number(statsResult?.totalFiles || 0),
        totalFolders: Number(statsResult?.totalFolders || 0),
        totalSize: Number(statsResult?.totalSize || 0),
      },
      receipt: createReceipt(wallet, 'list'),
    });
  } catch (err: any) {
    logger.error(`List entries failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const [entry] = await db.select().from(fileHubEntries)
      .where(and(
        eq(fileHubEntries.id, req.params.id),
        eq(fileHubEntries.walletAddress, wallet)
      ));

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    logger.info(`Retrieved entry ${entry.id} for wallet ${wallet}`);
    res.json({ entry, receipt: createReceipt(wallet, 'get', { entryId: entry.id }) });
  } catch (err: any) {
    logger.error(`Get entry failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parsed = createEntrySchema.parse(req.body);
    const fileType = inferFileType(parsed.mime);

    if (parsed.parentId) {
      const [parent] = await db.select().from(fileHubEntries)
        .where(and(
          eq(fileHubEntries.id, parsed.parentId),
          eq(fileHubEntries.walletAddress, wallet),
          eq(fileHubEntries.isFolder, true)
        ));

      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    const receiptData = JSON.stringify({ wallet, name: parsed.name, ts: Date.now() });
    const receiptHash = '0x' + createHash('sha256').update(receiptData).digest('hex');

    const [entry] = await db.insert(fileHubEntries).values({
      walletAddress: wallet,
      name: parsed.name,
      type: fileType,
      mime: parsed.mime,
      sizeBytes: parsed.sizeBytes,
      storageRef: parsed.storageRef,
      storageProvider: parsed.storageProvider,
      parentId: parsed.parentId || null,
      isFolder: parsed.isFolder,
      tags: parsed.tags,
      metadata: parsed.metadata,
      sha256: parsed.sha256,
      receiptHash,
    }).returning();

    logger.info(`Created entry ${entry.id} for wallet ${wallet}`);
    res.status(201).json({ entry, receipt: createReceipt(wallet, 'create', { entryId: entry.id }) });
  } catch (err: any) {
    logger.error(`Create entry failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.post('/folder', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parsed = createFolderSchema.parse(req.body);

    if (parsed.parentId) {
      const [parent] = await db.select().from(fileHubEntries)
        .where(and(
          eq(fileHubEntries.id, parsed.parentId),
          eq(fileHubEntries.walletAddress, wallet),
          eq(fileHubEntries.isFolder, true)
        ));

      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    const receiptData = JSON.stringify({ wallet, name: parsed.name, ts: Date.now() });
    const receiptHash = '0x' + createHash('sha256').update(receiptData).digest('hex');

    const [folder] = await db.insert(fileHubEntries).values({
      walletAddress: wallet,
      name: parsed.name,
      type: 'other',
      mime: 'inode/directory',
      sizeBytes: 0,
      parentId: parsed.parentId || null,
      isFolder: true,
      tags: parsed.tags,
      receiptHash,
    }).returning();

    logger.info(`Created folder ${folder.id} for wallet ${wallet}`);
    res.status(201).json({ folder, receipt: createReceipt(wallet, 'createFolder', { folderId: folder.id }) });
  } catch (err: any) {
    logger.error(`Create folder failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const [existing] = await db.select().from(fileHubEntries)
      .where(and(
        eq(fileHubEntries.id, req.params.id),
        eq(fileHubEntries.walletAddress, wallet)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const parsed = updateEntrySchema.parse(req.body);

    if (parsed.parentId) {
      if (parsed.parentId === existing.id) {
        return res.status(400).json({ error: 'Cannot move entry into itself' });
      }

      const [parent] = await db.select().from(fileHubEntries)
        .where(and(
          eq(fileHubEntries.id, parsed.parentId),
          eq(fileHubEntries.walletAddress, wallet),
          eq(fileHubEntries.isFolder, true)
        ));

      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' });
      }
    }

    const [updated] = await db.update(fileHubEntries)
      .set({
        ...parsed,
        updatedAt: new Date(),
      })
      .where(eq(fileHubEntries.id, existing.id))
      .returning();

    logger.info(`Updated entry ${updated.id} for wallet ${wallet}`);
    res.json({ entry: updated, receipt: createReceipt(wallet, 'update', { entryId: updated.id }) });
  } catch (err: any) {
    logger.error(`Update entry failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const [existing] = await db.select().from(fileHubEntries)
      .where(and(
        eq(fileHubEntries.id, req.params.id),
        eq(fileHubEntries.walletAddress, wallet)
      ));

    if (!existing) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (existing.isFolder) {
      const [childCount] = await db.select({ count: sql<number>`count(*)` })
        .from(fileHubEntries)
        .where(eq(fileHubEntries.parentId, existing.id));

      if (Number(childCount?.count || 0) > 0) {
        return res.status(400).json({ error: 'Cannot delete non-empty folder' });
      }
    }

    await db.delete(fileHubEntries)
      .where(eq(fileHubEntries.id, existing.id));

    logger.info(`Deleted entry ${existing.id} for wallet ${wallet}`);
    res.json({ deleted: true, receipt: createReceipt(wallet, 'delete', { entryId: existing.id }) });
  } catch (err: any) {
    logger.error(`Delete entry failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/breadcrumbs', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const breadcrumbs: Array<{ id: string; name: string }> = [];
    let currentId: string | null = req.params.id;

    while (currentId) {
      const [entry] = await db.select().from(fileHubEntries)
        .where(and(
          eq(fileHubEntries.id, currentId),
          eq(fileHubEntries.walletAddress, wallet)
        ));

      if (!entry) break;

      breadcrumbs.unshift({ id: entry.id, name: entry.name });
      currentId = entry.parentId;
    }

    res.json({ breadcrumbs, receipt: createReceipt(wallet, 'breadcrumbs') });
  } catch (err: any) {
    logger.error(`Get breadcrumbs failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/search/query', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const query = (req.query.q as string || '').trim().toLowerCase();
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const entries = await db.select().from(fileHubEntries)
      .where(and(
        eq(fileHubEntries.walletAddress, wallet),
        sql`lower(name) LIKE ${'%' + query + '%'}`
      ))
      .orderBy(desc(fileHubEntries.updatedAt))
      .limit(50);

    logger.info(`Search found ${entries.length} entries for wallet ${wallet}`);
    res.json({ entries, query, receipt: createReceipt(wallet, 'search', { query }) });
  } catch (err: any) {
    logger.error(`Search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
