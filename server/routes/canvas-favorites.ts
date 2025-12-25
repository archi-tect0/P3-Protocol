import { Router, Request, Response } from 'express';
import { db } from '../db';
import { browserFavorites, webSessions, siteProfiles, webSessionReceipts } from '@shared/schema';
import { eq, and, asc, desc } from 'drizzle-orm';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[CANVAS-FAVORITES] ${msg}`),
  error: (msg: string) => console.error(`[CANVAS-FAVORITES ERROR] ${msg}`),
};

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string) || null;
}

const DEFAULT_WEB_ACTIONS = [
  { type: 'refresh', label: 'Refresh' },
  { type: 'capture', target: 'screenshot', label: 'Screenshot' },
  { type: 'signout', label: 'Sign out' },
];

const DEFAULT_PROFILE_ACTIONS = [
  { type: 'openProfile', label: 'Open' },
];

const DEFAULT_APP_ACTIONS = [
  { type: 'openApp', label: 'Open' },
];

export type CanvasCard = {
  type: 'WebCard' | 'ProfileCard' | 'AppCard' | 'HubAppCard';
  id: string;
  favoriteId: string;
  section: string;
  position: number;
  displayName: string;
  displayIcon: string | null;
  actions: Array<{ type: string; label?: string; target?: string }>;
  sessionId?: string;
  url?: string;
  status?: string;
  preview?: { kind: 'image' | 'pdf'; value: string };
  profileId?: string;
  domain?: string;
  category?: string;
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { section } = req.query;

    let whereClause = eq(browserFavorites.walletAddress, wallet);

    if (section && typeof section === 'string') {
      whereClause = and(
        eq(browserFavorites.walletAddress, wallet),
        eq(browserFavorites.section, section as any)
      )!;
    }

    const favorites = await db.select().from(browserFavorites)
      .where(whereClause)
      .orderBy(asc(browserFavorites.section), asc(browserFavorites.position));

    const cards: CanvasCard[] = [];

    for (const fav of favorites) {
      if (fav.targetType === 'webSession') {
        const [session] = await db.select().from(webSessions).where(eq(webSessions.id, fav.targetId));
        if (!session) continue;

        const meta = session.metaJson as Record<string, any>;
        const profileId = meta?.profileId;
        let profile = null;

        if (profileId) {
          const [p] = await db.select().from(siteProfiles).where(eq(siteProfiles.id, profileId));
          profile = p;
        }

        cards.push({
          type: 'WebCard',
          id: fav.targetId,
          favoriteId: fav.id,
          section: fav.section,
          position: fav.position,
          displayName: fav.customName || session.title || profile?.name || session.url,
          displayIcon: fav.customIcon || profile?.iconUrl || null,
          sessionId: session.id,
          url: session.url,
          status: session.status,
          domain: meta?.domain || new URL(session.url).hostname.replace(/^www\./, ''),
          preview: session.snapshotPath
            ? {
                kind: session.snapshotPath.endsWith('.pdf') ? 'pdf' : 'image',
                value: session.snapshotPath,
              }
            : undefined,
          actions: profile?.defaultActions
            ? (profile.defaultActions as string[]).map(a => ({ type: a, label: a }))
            : DEFAULT_WEB_ACTIONS,
        });
      } else if (fav.targetType === 'siteProfile') {
        const [profile] = await db.select().from(siteProfiles).where(eq(siteProfiles.id, fav.targetId));
        if (!profile) continue;

        cards.push({
          type: 'ProfileCard',
          id: fav.targetId,
          favoriteId: fav.id,
          section: fav.section,
          position: fav.position,
          displayName: fav.customName || profile.name,
          displayIcon: fav.customIcon || profile.iconUrl,
          profileId: profile.id,
          domain: profile.domain,
          category: profile.category || 'other',
          actions: DEFAULT_PROFILE_ACTIONS,
        });
      } else if (fav.targetType === 'primitive') {
        cards.push({
          type: 'AppCard',
          id: fav.targetId,
          favoriteId: fav.id,
          section: fav.section,
          position: fav.position,
          displayName: fav.customName || fav.targetId,
          displayIcon: fav.customIcon,
          actions: DEFAULT_APP_ACTIONS,
        });
      } else if (fav.targetType === 'hubApp') {
        cards.push({
          type: 'HubAppCard',
          id: fav.targetId,
          favoriteId: fav.id,
          section: fav.section,
          position: fav.position,
          displayName: fav.customName || fav.targetId,
          displayIcon: fav.customIcon,
          actions: DEFAULT_APP_ACTIONS,
        });
      }
    }

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: null as any,
      actor: 'agent:ATLAS',
      action: 'canvas.favorites.open',
      metaJson: { section: section || 'all', count: cards.length },
    });

    res.json({ cards });
  } catch (err: any) {
    logger.error(`Get canvas favorites failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/quick-launch', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const featuredProfiles = await db.select().from(siteProfiles)
      .where(eq(siteProfiles.featured, true))
      .orderBy(asc(siteProfiles.sortOrder))
      .limit(20);

    const favorites = await db.select().from(browserFavorites)
      .where(eq(browserFavorites.walletAddress, wallet))
      .orderBy(asc(browserFavorites.position))
      .limit(10);

    const activeSessions = await db.select().from(webSessions)
      .where(and(
        eq(webSessions.walletAddress, wallet),
        eq(webSessions.status, 'active')
      ))
      .orderBy(desc(webSessions.updatedAt))
      .limit(5);

    res.json({
      featuredProfiles: featuredProfiles.map(p => ({
        id: p.id,
        domain: p.domain,
        name: p.name,
        iconUrl: p.iconUrl,
        category: p.category,
        description: p.description,
      })),
      favorites: favorites.map(f => ({
        id: f.id,
        targetId: f.targetId,
        targetType: f.targetType,
        section: f.section,
        displayName: f.customName || f.targetId,
        displayIcon: f.customIcon,
      })),
      activeSessions: activeSessions.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        status: s.status,
        snapshotPath: s.snapshotPath,
      })),
    });
  } catch (err: any) {
    logger.error(`Get quick launch failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
