import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { launcherTiles, launcherFolders, folderColorTags } from '../../shared/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'launcher' });
const router = Router();

const layoutQuerySchema = z.object({
  address: z.string().min(1),
});

const saveTileSchema = z.object({
  tileId: z.string(),
  folderId: z.string().uuid().nullable().optional(),
  orderIndex: z.number().int().min(0),
  colorTag: z.enum(folderColorTags).optional(),
});

const saveLayoutSchema = z.object({
  address: z.string().min(1),
  tiles: z.array(saveTileSchema),
  vectorClock: z.number().int().optional(),
});

const folderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50),
  colorTag: z.enum(folderColorTags).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const folderOperationSchema = z.object({
  address: z.string().min(1),
  operation: z.enum(['create', 'rename', 'delete', 'reorder']),
  folder: folderSchema,
});

router.get('/layout', async (req: Request, res: Response) => {
  try {
    const { address } = layoutQuerySchema.parse(req.query);
    const normalizedAddress = address.toLowerCase();

    const [tiles, folders] = await Promise.all([
      db.select().from(launcherTiles)
        .where(eq(launcherTiles.walletAddress, normalizedAddress))
        .orderBy(asc(launcherTiles.orderIndex)),
      db.select().from(launcherFolders)
        .where(eq(launcherFolders.walletAddress, normalizedAddress))
        .orderBy(asc(launcherFolders.orderIndex)),
    ]);

    res.json({
      ok: true,
      layout: { tiles, folders },
      vectorClock: Date.now(),
    });
  } catch (error: any) {
    logger.error('Failed to get launcher layout', { error: error.message });
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/layout', async (req: Request, res: Response) => {
  try {
    const { address, tiles, vectorClock } = saveLayoutSchema.parse(req.body);
    const normalizedAddress = address.toLowerCase();

    await db.delete(launcherTiles).where(eq(launcherTiles.walletAddress, normalizedAddress));

    if (tiles.length > 0) {
      const insertData = tiles.map(tile => ({
        walletAddress: normalizedAddress,
        tileId: tile.tileId,
        folderId: tile.folderId || null,
        orderIndex: tile.orderIndex,
        colorTag: tile.colorTag || 'default' as const,
        updatedAt: new Date(),
      }));

      await db.insert(launcherTiles).values(insertData);
    }

    const serverClock = Date.now();
    const merged = !vectorClock || serverClock >= vectorClock;

    res.json({
      ok: true,
      merged,
      vectorClock: serverClock,
    });
  } catch (error: any) {
    logger.error('Failed to save launcher layout', { error: error.message });
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post('/folders', async (req: Request, res: Response) => {
  try {
    const { address, operation, folder } = folderOperationSchema.parse(req.body);
    const normalizedAddress = address.toLowerCase();

    switch (operation) {
      case 'create': {
        const existingFolders = await db.select().from(launcherFolders)
          .where(eq(launcherFolders.walletAddress, normalizedAddress));
        
        const maxOrder = existingFolders.reduce((max, f) => Math.max(max, f.orderIndex), -1);
        
        const [created] = await db.insert(launcherFolders).values({
          walletAddress: normalizedAddress,
          name: folder.name,
          colorTag: folder.colorTag || 'default',
          orderIndex: folder.orderIndex ?? maxOrder + 1,
        }).returning();

        res.json({ ok: true, folder: created });
        break;
      }

      case 'rename': {
        if (!folder.id) {
          return res.status(400).json({ ok: false, error: 'Folder ID required for rename' });
        }

        const [updated] = await db.update(launcherFolders)
          .set({ 
            name: folder.name, 
            colorTag: folder.colorTag,
            updatedAt: new Date() 
          })
          .where(and(
            eq(launcherFolders.id, folder.id),
            eq(launcherFolders.walletAddress, normalizedAddress)
          ))
          .returning();

        res.json({ ok: true, folder: updated });
        break;
      }

      case 'delete': {
        if (!folder.id) {
          return res.status(400).json({ ok: false, error: 'Folder ID required for delete' });
        }

        await db.update(launcherTiles)
          .set({ folderId: null, updatedAt: new Date() })
          .where(eq(launcherTiles.folderId, folder.id));

        await db.delete(launcherFolders)
          .where(and(
            eq(launcherFolders.id, folder.id),
            eq(launcherFolders.walletAddress, normalizedAddress)
          ));

        res.json({ ok: true, deleted: folder.id });
        break;
      }

      case 'reorder': {
        if (!folder.id || folder.orderIndex === undefined) {
          return res.status(400).json({ ok: false, error: 'Folder ID and orderIndex required for reorder' });
        }

        const [updated] = await db.update(launcherFolders)
          .set({ orderIndex: folder.orderIndex, updatedAt: new Date() })
          .where(and(
            eq(launcherFolders.id, folder.id),
            eq(launcherFolders.walletAddress, normalizedAddress)
          ))
          .returning();

        res.json({ ok: true, folder: updated });
        break;
      }

      default:
        res.status(400).json({ ok: false, error: 'Unknown operation' });
    }
  } catch (error: any) {
    logger.error('Failed to perform folder operation', { error: error.message });
    res.status(400).json({ ok: false, error: error.message });
  }
});

export default router;
