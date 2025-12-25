import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { webSessions, webSessionReceipts, siteProfiles } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  createPage,
  navigate,
  refresh,
  scrape,
  capture,
  captureBase64,
  getCookies,
  setStorage,
  getStorage,
  closePage,
  hasPage,
} from '../services/webBridge';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[WEB-BROWSER] ${msg}`),
  error: (msg: string) => console.error(`[WEB-BROWSER ERROR] ${msg}`),
};

function getWallet(req: Request): string | null {
  return ((req.headers['x-wallet-address'] as string) || '').toLowerCase() || null;
}

const OpenWebSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  mode: z.enum(['preview', 'full', 'scrape']).default('preview'),
  profileId: z.string().uuid().optional(),
  allowUnknownDomain: z.boolean().optional().default(false),
});

async function lookupProfile(url: string) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const [profile] = await db
      .select()
      .from(siteProfiles)
      .where(eq(siteProfiles.domain, domain));
    return profile || null;
  } catch {
    return null;
  }
}

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

const WebOpsSchema = z.object({
  sessionId: z.string().uuid(),
  op: z.enum(['navigate', 'refresh', 'scrape', 'capture', 'signout', 'setStorage', 'getStorage']),
  url: z.string().url().optional(),
  selectors: z.array(z.string()).optional(),
  capture: z.object({
    type: z.enum(['screenshot', 'pdf']),
    path: z.string().optional(),
  }).optional(),
  storage: z.record(z.any()).optional(),
});

const MultiTabSchema = z.object({
  action: z.enum(['createTab', 'closeTab', 'switchTab', 'reorderTabs']),
  sessionId: z.string().uuid(),
  url: z.string().url().optional(),
  tabIndex: z.number().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const sessions = await db
      .select()
      .from(webSessions)
      .where(eq(webSessions.walletAddress, wallet))
      .orderBy(desc(webSessions.updatedAt));

    res.json({ sessions });
  } catch (err: any) {
    logger.error(`List sessions failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/open', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = OpenWebSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { url, title, mode, profileId, allowUnknownDomain } = parse.data;

    const profile = profileId 
      ? await db.select().from(siteProfiles).where(eq(siteProfiles.id, profileId)).then(r => r[0])
      : await lookupProfile(url);

    if (profile && profile.safe === false) {
      const [blockedSession] = await db
        .insert(webSessions)
        .values({
          walletAddress: wallet,
          url,
          title: profile.name,
          status: 'error',
          metaJson: { mode, profileId: profile.id, blockedReason: 'unsafe_domain' },
        })
        .returning();

      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId: blockedSession.id,
        actor: 'system',
        action: 'web.blocked',
        metaJson: { url, reason: 'unsafe_domain', profileId: profile.id, domain: profile.domain },
      });
      
      logger.info(`Blocked unsafe domain ${profile.domain} for ${wallet}`);
      return res.status(403).json({ 
        error: 'Unsafe domain', 
        reason: 'This site is marked as unsafe and requires governance approval',
        profileId: profile.id,
        sessionId: blockedSession.id,
      });
    }

    let domain: string;
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const allProfiles = await db.select().from(siteProfiles);
    const knownDomains = new Set(allProfiles.map(p => p.domain));
    const isUnknownDomain = !profile && !knownDomains.has(domain);

    if (isUnknownDomain && !allowUnknownDomain) {
      const [blockedSession] = await db
        .insert(webSessions)
        .values({
          walletAddress: wallet,
          url,
          title: domain,
          status: 'error',
          metaJson: { mode, blockedReason: 'unknown_domain', domain },
        })
        .returning();

      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId: blockedSession.id,
        actor: 'system',
        action: 'web.blocked',
        metaJson: { url, domain, reason: 'unknown_domain', note: 'Domain not in SiteProfiles registry, requires explicit override or profile registration' },
      });
      
      logger.info(`Blocked unknown domain ${domain} for ${wallet}`);
      return res.status(403).json({ 
        error: 'Unknown domain', 
        reason: 'This domain is not registered in the SiteProfiles registry. Use allowUnknownDomain: true to override.',
        domain,
        sessionId: blockedSession.id,
      });
    }

    const [session] = await db
      .insert(webSessions)
      .values({
        walletAddress: wallet,
        url,
        title: title || profile?.name || null,
        status: 'active',
        metaJson: { mode, profileId: profile?.id || null, unknownDomain: isUnknownDomain, domain },
      })
      .returning();

    if (isUnknownDomain && allowUnknownDomain) {
      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId: session.id,
        actor: 'system',
        action: 'web.unknown_domain_override',
        metaJson: { url, domain, note: 'Unknown domain allowed via explicit override' },
      });
      logger.info(`Unknown domain ${domain} allowed via override for ${wallet}`);
    }

    const cookies = (session.cookiesJson as any[]) || [];
    let resolvedTitle = title || url;
    let previewText = '';

    try {
      const result = await createPage(session.id, url, cookies);
      resolvedTitle = result.title || resolvedTitle;
      previewText = result.previewText;

      const newCookies = await getCookies(session.id);
      await db
        .update(webSessions)
        .set({
          title: resolvedTitle,
          cookiesJson: newCookies as any,
          metaJson: { ...(session.metaJson as object), lastAction: 'open' },
          updatedAt: new Date(),
        })
        .where(eq(webSessions.id, session.id));
    } catch (err: any) {
      await db
        .update(webSessions)
        .set({ status: 'error', metaJson: { ...(session.metaJson as object), error: err.message } })
        .where(eq(webSessions.id, session.id));
      logger.error(`Failed to create page: ${err.message}`);
    }

    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId: session.id,
      actor: 'agent:ATLAS',
      action: 'web.open',
      metaJson: { url, domain, mode, profileId: profile?.id || null },
    });

    const [updated] = await db
      .select()
      .from(webSessions)
      .where(eq(webSessions.id, session.id));

    logger.info(`Opened web session ${session.id} for ${wallet}`);
    res.json({
      session: updated,
      profile: profile || null,
      preview: mode === 'preview' ? previewText : null,
    });
  } catch (err: any) {
    logger.error(`Open session failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ops', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = WebOpsSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { sessionId, op, url, selectors, capture: cap, storage } = parse.data;

    const [session] = await db
      .select()
      .from(webSessions)
      .where(and(eq(webSessions.id, sessionId), eq(webSessions.walletAddress, wallet)));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }

    if (!hasPage(sessionId)) {
      const cookies = (session.cookiesJson as any[]) || [];
      await createPage(sessionId, session.url, cookies);
    }

    let result: any = null;

    try {
      if (op === 'navigate' && url) {
        const navProfile = await lookupProfile(url);
        let navDomain: string;
        try {
          navDomain = new URL(url).hostname.replace(/^www\./, '');
        } catch {
          return res.status(400).json({ error: 'Invalid navigation URL' });
        }

        if (navProfile && navProfile.safe === false) {
          await db.insert(webSessionReceipts).values({
            walletAddress: wallet,
            sessionId,
            actor: 'system',
            action: 'web.navigate_blocked',
            metaJson: { url, reason: 'unsafe_domain', profileId: navProfile.id, domain: navDomain },
          });
          logger.info(`Navigation to unsafe domain ${navDomain} blocked for session ${sessionId}`);
          return res.status(403).json({ 
            error: 'Navigation blocked', 
            reason: 'Target site is marked as unsafe',
          });
        }

        const allProfiles = await db.select().from(siteProfiles);
        const knownDomains = new Set(allProfiles.map(p => p.domain));
        const isUnknownNav = !navProfile && !knownDomains.has(navDomain);
        
        if (isUnknownNav) {
          await db.insert(webSessionReceipts).values({
            walletAddress: wallet,
            sessionId,
            actor: 'system',
            action: 'web.navigate_blocked',
            metaJson: { url, domain: navDomain, reason: 'unknown_domain', note: 'Navigation to unknown domain blocked' },
          });
          await db.update(webSessions).set({ 
            metaJson: { ...(session.metaJson as object), lastBlockedNav: navDomain },
            updatedAt: new Date() 
          }).where(eq(webSessions.id, sessionId));
          logger.info(`Navigation to unknown domain ${navDomain} blocked for session ${sessionId}`);
          return res.status(403).json({ 
            error: 'Navigation blocked', 
            reason: 'Target domain is not registered in SiteProfiles registry',
            domain: navDomain,
          });
        }

        result = await navigate(sessionId, url);
        await db.update(webSessions).set({ 
          url, 
          metaJson: { ...(session.metaJson as object), domain: navDomain, lastNavDomain: navDomain },
          updatedAt: new Date() 
        }).where(eq(webSessions.id, sessionId));
        
        await db.insert(webSessionReceipts).values({
          walletAddress: wallet,
          sessionId,
          actor: 'agent:ATLAS',
          action: 'web.navigate',
          metaJson: { url, domain: navDomain },
        });
        
        logger.info(`Navigated session ${sessionId} to ${navDomain} for ${wallet}`);
        return res.json({ result });
      } else if (op === 'refresh') {
        result = await refresh(sessionId);
      } else if (op === 'scrape' && selectors) {
        result = await scrape(sessionId, selectors);
      } else if (op === 'capture') {
        result = await capture(sessionId, cap?.type || 'screenshot', cap?.path);
        await db.update(webSessions).set({ snapshotPath: result.path, updatedAt: new Date() }).where(eq(webSessions.id, sessionId));
      } else if (op === 'setStorage' && storage) {
        result = await setStorage(sessionId, storage);
      } else if (op === 'getStorage') {
        result = await getStorage(sessionId);
      } else if (op === 'signout') {
        await closePage(sessionId);
        await db
          .update(webSessions)
          .set({ status: 'signedOut', cookiesJson: {}, storageJson: {}, updatedAt: new Date() })
          .where(eq(webSessions.id, sessionId));
        result = { ok: true };
      }

      if (op !== 'signout') {
        const cookies = await getCookies(sessionId);
        await db
          .update(webSessions)
          .set({
            cookiesJson: cookies as any,
            metaJson: { ...(session.metaJson as object), lastAction: op },
            updatedAt: new Date(),
          })
          .where(eq(webSessions.id, sessionId));
      }

      const [freshSession] = await db.select().from(webSessions).where(eq(webSessions.id, sessionId));
      const freshMeta = freshSession?.metaJson as Record<string, any> || {};
      const currentDomain = freshMeta?.domain || extractDomainFromUrl(freshSession?.url || session.url);
      
      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId,
        actor: op === 'signout' ? 'user' : 'agent:ATLAS',
        action: `web.${op}`,
        metaJson: { url: freshSession?.url || session.url, domain: currentDomain, selectors, capture: cap },
      });

      logger.info(`Op ${op} on session ${sessionId} for ${wallet}`);
      res.json({ result });
    } catch (err: any) {
      await db
        .update(webSessions)
        .set({ status: 'error', metaJson: { ...(session.metaJson as object), error: err.message } })
        .where(eq(webSessions.id, sessionId));
      logger.error(`Op ${op} failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  } catch (err: any) {
    logger.error(`Ops failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/signout', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }

    const [session] = await db
      .select()
      .from(webSessions)
      .where(and(eq(webSessions.id, sessionId), eq(webSessions.walletAddress, wallet)));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await closePage(sessionId);
    await db
      .update(webSessions)
      .set({ status: 'signedOut', cookiesJson: {}, storageJson: {}, updatedAt: new Date() })
      .where(eq(webSessions.id, sessionId));

    const sessionMeta = session.metaJson as Record<string, any>;
    const sessionDomain = sessionMeta?.domain || extractDomainFromUrl(session.url);
    
    await db.insert(webSessionReceipts).values({
      walletAddress: wallet,
      sessionId,
      actor: 'user',
      action: 'web.signout',
      metaJson: { url: session.url, domain: sessionDomain },
    });

    logger.info(`Signed out session ${sessionId} for ${wallet}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Signout failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tabs', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = MultiTabSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { action, sessionId, url, tabIndex } = parse.data;

    const [session] = await db
      .select()
      .from(webSessions)
      .where(and(eq(webSessions.id, sessionId), eq(webSessions.walletAddress, wallet)));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionMeta = session.metaJson as Record<string, any>;
    const currentDomain = sessionMeta?.domain || extractDomainFromUrl(session.url);

    if (action === 'createTab' && url) {
      const newDomain = extractDomainFromUrl(url);
      const cookies = (session.cookiesJson as any[]) || [];
      const { previewText } = await createPage(sessionId, url, cookies);
      await db
        .update(webSessions)
        .set({ 
          url, 
          metaJson: { ...(session.metaJson as object), domain: newDomain, lastAction: 'createTab' }, 
          updatedAt: new Date() 
        })
        .where(eq(webSessions.id, sessionId));

      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId,
        actor: 'agent:ATLAS',
        action: 'web.navigate',
        metaJson: { url, domain: newDomain },
      });

      return res.json({ preview: previewText });
    }

    if (action === 'closeTab') {
      await closePage(sessionId);
      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId,
        actor: 'user',
        action: 'web.close',
        metaJson: { url: session.url, domain: currentDomain, note: 'tab closed' },
      });
      return res.json({ ok: true });
    }

    if (action === 'switchTab' && typeof tabIndex === 'number') {
      await db.update(webSessions).set({ tabIndex, updatedAt: new Date() }).where(eq(webSessions.id, sessionId));
      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId,
        actor: 'agent:ATLAS',
        action: 'web.switch',
        metaJson: { url: session.url, domain: currentDomain, tabIndex },
      });
      return res.json({ ok: true });
    }

    if (action === 'reorderTabs' && typeof tabIndex === 'number') {
      await db.update(webSessions).set({ tabIndex, updatedAt: new Date() }).where(eq(webSessions.id, sessionId));
      await db.insert(webSessionReceipts).values({
        walletAddress: wallet,
        sessionId,
        actor: 'system',
        action: 'web.reorder',
        metaJson: { url: session.url, domain: currentDomain, tabIndex },
      });
      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'Invalid action or missing parameters' });
  } catch (err: any) {
    logger.error(`Tabs action failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const [session] = await db
      .select()
      .from(webSessions)
      .where(and(eq(webSessions.id, id), eq(webSessions.walletAddress, wallet)));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const meta = session.metaJson as Record<string, any>;
    const profile = meta?.profileId
      ? await db.select().from(siteProfiles).where(eq(siteProfiles.id, meta.profileId)).then(r => r[0])
      : await lookupProfile(session.url);

    const receipts = await db
      .select()
      .from(webSessionReceipts)
      .where(eq(webSessionReceipts.sessionId, id))
      .orderBy(desc(webSessionReceipts.timestamp))
      .limit(10);

    res.json({ session, profile: profile || null, receipts });
  } catch (err: any) {
    logger.error(`Get session failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/preview', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const [session] = await db
      .select()
      .from(webSessions)
      .where(and(eq(webSessions.id, id), eq(webSessions.walletAddress, wallet)));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let preview: { kind: string; value: string } | null = null;

    if (session.status === 'active' && hasPage(id)) {
      try {
        const { base64 } = await captureBase64(id);
        preview = { kind: 'image', value: `data:image/png;base64,${base64}` };
      } catch {
        preview = null;
      }
    } else if (session.snapshotPath) {
      if (session.snapshotPath.endsWith('.png')) {
        preview = { kind: 'image', value: session.snapshotPath };
      } else if (session.snapshotPath.endsWith('.pdf')) {
        preview = { kind: 'pdf', value: session.snapshotPath };
      }
    }

    const receipts = await db
      .select()
      .from(webSessionReceipts)
      .where(eq(webSessionReceipts.sessionId, id))
      .orderBy(desc(webSessionReceipts.timestamp))
      .limit(5);

    const meta = session.metaJson as Record<string, any>;
    const profile = meta?.profileId
      ? await db.select().from(siteProfiles).where(eq(siteProfiles.id, meta.profileId)).then(r => r[0])
      : await lookupProfile(session.url);

    const DEFAULT_ACTIONS = ['refresh', 'capture', 'signout'];
    const profileActions = profile?.defaultActions as string[] || null;
    const actionsSource = profileActions && profileActions.length > 0 ? profileActions : DEFAULT_ACTIONS;
    const actions = actionsSource.map(a => {
      if (a === 'capture') return [{ type: 'capture', target: 'screenshot' }, { type: 'capture', target: 'pdf' }];
      return { type: a };
    }).flat();

    const card = {
      type: 'WebCard',
      sessionId: session.id,
      title: session.title || session.url,
      url: session.url,
      status: session.status,
      profile: profile ? {
        name: profile.name,
        iconUrl: profile.iconUrl,
        description: profile.description,
        selectors: profile.selectorsJson as Record<string, string> | null,
      } : null,
      preview,
      actions,
      receipts: receipts.map((r) => ({
        id: r.id,
        action: r.action,
        timestamp: r.timestamp.toISOString(),
      })),
    };

    res.json({ card });
  } catch (err: any) {
    logger.error(`Get preview failed: ${err.message}`);
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

    const [session] = await db
      .select()
      .from(webSessions)
      .where(and(eq(webSessions.id, id), eq(webSessions.walletAddress, wallet)));

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await closePage(id);
    await db.delete(webSessions).where(eq(webSessions.id, id));

    logger.info(`Deleted session ${id} for ${wallet}`);
    res.json({ ok: true });
  } catch (err: any) {
    logger.error(`Delete session failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
