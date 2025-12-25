import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { siteProfiles, siteProfileActions, siteProfileCategoryEnum } from '@shared/schema';
import { eq, desc, ilike, asc, and } from 'drizzle-orm';
import { ALL_PROFILES, PROFILES_BY_CATEGORY, CATEGORY_DISPLAY_ORDER, type SiteProfileSeed } from '../atlas/data/siteProfiles';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[SITE-PROFILES] ${msg}`),
  error: (msg: string) => console.error(`[SITE-PROFILES ERROR] ${msg}`),
};

const SiteProfileSchema = z.object({
  domain: z.string().min(3),
  name: z.string().min(1),
  category: z.enum(siteProfileCategoryEnum).default('other'),
  iconUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  defaultActions: z.array(z.enum(siteProfileActions)).default(['navigate', 'refresh', 'capture', 'signout']),
  selectorsJson: z.record(z.string()).optional().nullable(),
  loginMacros: z.record(z.any()).optional().nullable(),
  safe: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(999),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, category, featured, safe } = req.query;

    let whereClause: any = undefined;

    if (search && typeof search === 'string') {
      whereClause = ilike(siteProfiles.domain, `%${search}%`);
    }

    if (category && typeof category === 'string') {
      const catCondition = eq(siteProfiles.category, category);
      whereClause = whereClause ? and(whereClause, catCondition) : catCondition;
    }

    if (featured === 'true') {
      const featuredCondition = eq(siteProfiles.featured, true);
      whereClause = whereClause ? and(whereClause, featuredCondition) : featuredCondition;
    }

    const profiles = whereClause
      ? await db.select().from(siteProfiles).where(whereClause).orderBy(asc(siteProfiles.sortOrder), desc(siteProfiles.updatedAt))
      : await db.select().from(siteProfiles).orderBy(asc(siteProfiles.sortOrder), desc(siteProfiles.updatedAt));

    res.json({ profiles });
  } catch (err: any) {
    logger.error(`List profiles failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = CATEGORY_DISPLAY_ORDER.map(cat => ({
      id: cat,
      name: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: PROFILES_BY_CATEGORY[cat]?.length || 0,
    }));

    res.json({ categories });
  } catch (err: any) {
    logger.error(`Get categories failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/featured', async (req: Request, res: Response) => {
  try {
    const featured = await db.select().from(siteProfiles)
      .where(eq(siteProfiles.featured, true))
      .orderBy(asc(siteProfiles.sortOrder));

    res.json({ profiles: featured });
  } catch (err: any) {
    logger.error(`Get featured failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const parse = SiteProfileSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const existing = await db
      .select()
      .from(siteProfiles)
      .where(eq(siteProfiles.domain, parse.data.domain));

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Profile for this domain already exists' });
    }

    const [profile] = await db
      .insert(siteProfiles)
      .values({
        domain: parse.data.domain,
        name: parse.data.name,
        iconUrl: parse.data.iconUrl || null,
        description: parse.data.description || null,
        defaultActions: parse.data.defaultActions,
        selectorsJson: parse.data.selectorsJson || null,
        loginMacros: parse.data.loginMacros || null,
        safe: parse.data.safe,
      })
      .returning();

    logger.info(`Created profile for ${parse.data.domain}`);
    res.json({ profile });
  } catch (err: any) {
    logger.error(`Create profile failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url query parameter required' });
    }

    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const [profile] = await db
      .select()
      .from(siteProfiles)
      .where(eq(siteProfiles.domain, domain));

    if (!profile) {
      const baseDomain = domain.replace(/^www\./, '');
      const [baseProfile] = await db
        .select()
        .from(siteProfiles)
        .where(eq(siteProfiles.domain, baseDomain));

      if (baseProfile) {
        return res.json({ profile: baseProfile });
      }
      return res.json({ profile: null });
    }

    res.json({ profile });
  } catch (err: any) {
    logger.error(`Lookup profile failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    const [profile] = await db
      .select()
      .from(siteProfiles)
      .where(eq(siteProfiles.domain, domain));

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ profile });
  } catch (err: any) {
    logger.error(`Get profile failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parse = SiteProfileSchema.partial().safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const [existing] = await db
      .select()
      .from(siteProfiles)
      .where(eq(siteProfiles.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const [updated] = await db
      .update(siteProfiles)
      .set({
        ...parse.data,
        updatedAt: new Date(),
      })
      .where(eq(siteProfiles.id, id))
      .returning();

    logger.info(`Updated profile ${id}`);
    res.json({ profile: updated });
  } catch (err: any) {
    logger.error(`Update profile failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [existing] = await db
      .select()
      .from(siteProfiles)
      .where(eq(siteProfiles.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    await db.delete(siteProfiles).where(eq(siteProfiles.id, id));

    logger.info(`Deleted profile ${id}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Delete profile failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed', async (req: Request, res: Response) => {
  try {
    const { category } = req.body;
    const profilesToSeed: SiteProfileSeed[] = category && PROFILES_BY_CATEGORY[category]
      ? PROFILES_BY_CATEGORY[category]
      : ALL_PROFILES;

    const created: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const profile of profilesToSeed) {
      try {
        const [existing] = await db
          .select()
          .from(siteProfiles)
          .where(eq(siteProfiles.domain, profile.domain));

        if (existing) {
          skipped.push(profile.domain);
          continue;
        }

        const [inserted] = await db
          .insert(siteProfiles)
          .values({
            domain: profile.domain,
            name: profile.name,
            category: profile.category,
            iconUrl: profile.iconUrl || null,
            description: profile.description || null,
            defaultActions: profile.defaultActions,
            selectorsJson: profile.selectorsJson || null,
            loginMacros: profile.loginMacros || null,
            safe: profile.safe,
            featured: profile.featured,
            sortOrder: profile.sortOrder,
          })
          .returning();

        created.push(inserted);
      } catch (err: any) {
        errors.push(`${profile.domain}: ${err.message}`);
      }
    }

    logger.info(`Seeded ${created.length} profiles, skipped ${skipped.length}, errors ${errors.length}`);
    res.json({
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
      errorDetails: errors.slice(0, 10),
      total: profilesToSeed.length,
    });
  } catch (err: any) {
    logger.error(`Seed profiles failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed-all', async (req: Request, res: Response) => {
  try {
    const results: Record<string, { created: number; skipped: number }> = {};

    for (const category of CATEGORY_DISPLAY_ORDER) {
      const profiles = PROFILES_BY_CATEGORY[category] || [];
      let created = 0;
      let skipped = 0;

      for (const profile of profiles) {
        try {
          const [existing] = await db
            .select()
            .from(siteProfiles)
            .where(eq(siteProfiles.domain, profile.domain));

          if (existing) {
            skipped++;
            continue;
          }

          await db.insert(siteProfiles).values({
            domain: profile.domain,
            name: profile.name,
            category: profile.category,
            iconUrl: profile.iconUrl || null,
            description: profile.description || null,
            defaultActions: profile.defaultActions,
            selectorsJson: profile.selectorsJson || null,
            loginMacros: profile.loginMacros || null,
            safe: profile.safe,
            featured: profile.featured,
            sortOrder: profile.sortOrder,
          });

          created++;
        } catch {
          skipped++;
        }
      }

      results[category] = { created, skipped };
    }

    const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);

    logger.info(`Seeded all profiles: ${totalCreated} created, ${totalSkipped} skipped`);
    res.json({
      results,
      total: { created: totalCreated, skipped: totalSkipped, available: ALL_PROFILES.length },
    });
  } catch (err: any) {
    logger.error(`Seed all profiles failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
