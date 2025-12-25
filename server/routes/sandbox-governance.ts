import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { 
  sandboxGovernanceReviews, sandboxProjects, sandboxManifests, sandboxReceipts,
  moderatorRoles
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

const logger = {
  info: (msg: string) => console.log(`[GOVERNANCE] ${msg}`),
  error: (msg: string) => console.error(`[GOVERNANCE ERROR] ${msg}`),
};

type ModeratorRole = 'reviewer' | 'moderator' | 'admin' | 'superuser';

interface ModerationRequest extends Request {
  moderatorAddr?: string;
  moderatorRole?: ModeratorRole;
  isSuperuser?: boolean;
}

function requireWallet(req: Request, res: Response): string | null {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(401).json({ error: 'Valid wallet address required' });
    return null;
  }
  return wallet.toLowerCase();
}

async function getRoleInfo(walletAddress: string) {
  const normalizedAddr = walletAddress.toLowerCase();
  
  if (ADMIN_WALLET && normalizedAddr === ADMIN_WALLET) {
    return {
      walletAddress: normalizedAddr,
      role: 'superuser' as ModeratorRole,
      isSuperuser: true,
    };
  }

  try {
    const [roleRecord] = await db
      .select()
      .from(moderatorRoles)
      .where(eq(sql`lower(${moderatorRoles.walletAddress})`, normalizedAddr))
      .limit(1);

    if (!roleRecord || roleRecord.status !== 'active') {
      return null;
    }

    return {
      walletAddress: roleRecord.walletAddress,
      role: roleRecord.role as ModeratorRole,
      isSuperuser: false,
    };
  } catch (error) {
    logger.error(`Error fetching role info: ${error}`);
    return null;
  }
}

function requireModeratorRole(minimumRole: ModeratorRole = 'moderator') {
  const roleHierarchy: Record<ModeratorRole, number> = {
    reviewer: 1,
    moderator: 2,
    admin: 3,
    superuser: 4,
  };

  return async (req: ModerationRequest, res: Response, next: NextFunction) => {
    const wallet = req.headers['x-wallet-address'] as string;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(401).json({ error: 'Valid wallet address required' });
    }

    const roleInfo = await getRoleInfo(wallet);
    if (!roleInfo) {
      return res.status(403).json({ error: 'Access denied: No moderator role assigned' });
    }

    if (roleHierarchy[roleInfo.role] < roleHierarchy[minimumRole]) {
      return res.status(403).json({
        error: `Access denied: Requires ${minimumRole} role or higher`,
        yourRole: roleInfo.role,
        requiredRole: minimumRole,
      });
    }

    req.moderatorAddr = roleInfo.walletAddress;
    req.moderatorRole = roleInfo.role;
    req.isSuperuser = roleInfo.isSuperuser;
    next();
  };
}

async function logReceipt(wallet: string, projectId: string | null, actor: string, action: string, meta?: any) {
  const requestId = randomUUID();
  await db.insert(sandboxReceipts).values({
    walletAddress: wallet,
    projectId: projectId || undefined,
    actor,
    action,
    metaJson: meta,
    requestId,
  });
  return requestId;
}

router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const status = req.query.status as string;
    
    const reviews = await db.select().from(sandboxGovernanceReviews)
      .orderBy(desc(sandboxGovernanceReviews.createdAt));

    const filtered = status 
      ? reviews.filter(r => r.status === status)
      : reviews;

    res.json({ reviews: filtered, count: filtered.length });
  } catch (err: any) {
    logger.error(`List reviews failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/reviews/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [review] = await db.select().from(sandboxGovernanceReviews)
      .where(eq(sandboxGovernanceReviews.id, req.params.id));

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const [project] = await db.select().from(sandboxProjects)
      .where(eq(sandboxProjects.id, review.projectId));

    const [manifest] = await db.select().from(sandboxManifests)
      .where(eq(sandboxManifests.projectId, review.projectId));

    res.json({ review, project, manifest });
  } catch (err: any) {
    logger.error(`Get review failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews/:id/decision', requireModeratorRole('moderator'), async (req: ModerationRequest, res: Response) => {
  try {
    const wallet = req.moderatorAddr;
    if (!wallet) {
      return res.status(401).json({ error: 'Moderator authentication required' });
    }

    const { decision, notes } = req.body as { decision: 'approve' | 'reject'; notes?: string };

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be "approve" or "reject"' });
    }

    const [review] = await db.select().from(sandboxGovernanceReviews)
      .where(eq(sandboxGovernanceReviews.id, req.params.id));

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.status !== 'pending') {
      return res.status(400).json({ error: 'Review already decided' });
    }

    const newStatus = decision === 'approve' ? 'approved' : 'rejected';
    const projectStatus = decision === 'approve' ? 'approved' : 'rejected';

    await db.update(sandboxGovernanceReviews)
      .set({ 
        status: newStatus, 
        reviewer: wallet, 
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(sandboxGovernanceReviews.id, review.id));

    await db.update(sandboxProjects)
      .set({ status: projectStatus, updatedAt: new Date() })
      .where(eq(sandboxProjects.id, review.projectId));

    if (decision === 'approve') {
      const [project] = await db.select().from(sandboxProjects)
        .where(eq(sandboxProjects.id, review.projectId));
      
      const [manifest] = await db.select().from(sandboxManifests)
        .where(eq(sandboxManifests.projectId, review.projectId));

      if (project && manifest) {
        logger.info(`Project ${project.id} approved - ready for Hub materialization`);
      }
    }

    await logReceipt(wallet, review.projectId, 'moderator', `governance.${decision}`, { 
      reviewId: review.id, 
      decision, 
      notes,
      moderatorRole: req.moderatorRole,
    });

    logger.info(`Review ${review.id} decided: ${decision} by ${wallet} (${req.moderatorRole})`);

    res.json({ status: newStatus, decision, moderator: wallet });
  } catch (err: any) {
    logger.error(`Decision failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

export default router;
