import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { browserFavorites, webSessions, siteProfiles, webSessionReceipts, favoriteTargetTypes, favoriteSections } from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[FAVORITES] ${msg}`),
  error: (msg: string) => console.error(`[FAVORITES ERROR] ${msg}`),
};

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string) || null;
}

const AddFavoriteSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(favoriteTargetTypes),
  section: z.enum(favoriteSections).default('canvasTop'),
  position: z.number().int().min(0).optional(),
  customName: z.string().optional(),
  customIcon: z.string().url().optional(),
});

const RemoveFavoriteSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(favoriteTargetTypes),
  section: z.enum(favoriteSections).default('canvasTop'),
});

const ReorderFavoritesSchema = z.object({
  section: z.enum(favoriteSections),
  order: z.array(z.object({
    targetId: z.string(),
    targetType: z.enum(favoriteTargetTypes),
    position: z.number().int().min(0),
  })),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { section } = req.query;

    let whereClause = eq(browserFavorites.walletAddress, wallet);

    if (section && typeof section === 'string' && favoriteSections.includes(section as any)) {
      whereClause = and(
        eq(browserFavorites.walletAddress, wallet),
        eq(browserFavorites.section, section as any)
      )!;
    }

    const favorites = await db.select().from(browserFavorites)
      .where(whereClause)
      .orderBy(asc(browserFavorites.section), asc(browserFavorites.position));

    const enriched = await Promise.all(favorites.map(async (fav) => {
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

    res.json({ favorites: enriched });
  } catch (err: any) {
    logger.error(`List favorites failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/add', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = AddFavoriteSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { targetId, targetType, section, position, customName, customIcon } = parse.data;

    const [existing] = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.walletAddress, wallet),
      eq(browserFavorites.targetId, targetId),
      eq(browserFavorites.targetType, targetType),
      eq(browserFavorites.section, section)
    ));

    if (existing) {
      return res.status(409).json({ error: 'Favorite already exists' });
    }

    if (typeof position === 'number') {
      const toShift = await db.select().from(browserFavorites).where(and(
        eq(browserFavorites.walletAddress, wallet),
        eq(browserFavorites.section, section)
      ));
      
      for (const fav of toShift.filter(f => f.position >= position)) {
        await db.update(browserFavorites)
          .set({ position: fav.position + 1, updatedAt: new Date() })
          .where(eq(browserFavorites.id, fav.id));
      }
    }

    const count = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.walletAddress, wallet),
      eq(browserFavorites.section, section)
    ));
    
    const pos = typeof position === 'number' ? position : count.length;

    const [favorite] = await db.insert(browserFavorites).values({
      walletAddress: wallet,
      targetId,
      targetType,
      section,
      position: pos,
      customName: customName || null,
      customIcon: customIcon || null,
    }).returning();

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: targetType === 'webSession' ? targetId : null as any,
      actor: 'user',
      action: 'favorites.add',
      metaJson: { targetId, targetType, section, position: pos },
    });

    logger.info(`Added favorite ${targetId} to ${section} for ${wallet}`);
    res.json({ favorite });
  } catch (err: any) {
    logger.error(`Add favorite failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/remove', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = RemoveFavoriteSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { targetId, targetType, section } = parse.data;

    const [fav] = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.walletAddress, wallet),
      eq(browserFavorites.targetId, targetId),
      eq(browserFavorites.targetType, targetType),
      eq(browserFavorites.section, section)
    ));

    if (!fav) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await db.delete(browserFavorites).where(eq(browserFavorites.id, fav.id));

    const rest = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.walletAddress, wallet),
      eq(browserFavorites.section, section)
    )).orderBy(asc(browserFavorites.position));

    for (let i = 0; i < rest.length; i++) {
      await db.update(browserFavorites)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(browserFavorites.id, rest[i].id));
    }

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: targetType === 'webSession' ? targetId : null as any,
      actor: 'user',
      action: 'favorites.remove',
      metaJson: { targetId, targetType, section },
    });

    logger.info(`Removed favorite ${targetId} from ${section} for ${wallet}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Remove favorite failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reorder', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = ReorderFavoritesSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { section, order } = parse.data;

    const current = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.walletAddress, wallet),
      eq(browserFavorites.section, section)
    ));

    for (const o of order) {
      const match = current.find(c => c.targetId === o.targetId && c.targetType === o.targetType);
      if (!match) {
        return res.status(400).json({ error: `Missing favorite ${o.targetId}` });
      }
    }

    for (const o of order) {
      await db.update(browserFavorites)
        .set({ position: o.position, updatedAt: new Date() })
        .where(and(
          eq(browserFavorites.walletAddress, wallet),
          eq(browserFavorites.section, section),
          eq(browserFavorites.targetId, o.targetId),
          eq(browserFavorites.targetType, o.targetType)
        ));
    }

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: null as any,
      actor: 'user',
      action: 'favorites.reorder',
      metaJson: { section, order },
    });

    logger.info(`Reordered favorites in ${section} for ${wallet}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Reorder favorites failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const [fav] = await db.select().from(browserFavorites).where(and(
      eq(browserFavorites.id, id),
      eq(browserFavorites.walletAddress, wallet)
    ));

    if (!fav) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await db.delete(browserFavorites).where(eq(browserFavorites.id, id));

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
      action: 'favorites.remove',
      metaJson: { favoriteId: id, targetId: fav.targetId, targetType: fav.targetType, section: fav.section },
    });

    logger.info(`Deleted favorite ${id} for ${wallet}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Delete favorite failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
