import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { tenantPolicies, insertTenantPolicySchema } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

interface EnterpriseRequest extends Request {
  walletAddr?: string;
  isSuperuser?: boolean;
}

function getWalletAddr(req: Request): string | undefined {
  return (req.headers['x-p3-addr'] as string)?.toLowerCase();
}

async function requireAdminOrSuperuser(
  req: EnterpriseRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const addr = getWalletAddr(req);

  if (!addr) {
    res.status(403).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const isSuperuser = ADMIN_WALLET ? addr === ADMIN_WALLET : false;

  if (!isSuperuser) {
    res.status(403).json({ 
      error: 'Access denied: Requires admin or superuser privileges',
    });
    return;
  }

  req.walletAddr = addr;
  req.isSuperuser = isSuperuser;
  next();
}

const setPolicySchema = z.object({
  tenantId: z.string().min(1).max(64),
  featuresJson: z.record(z.any()).optional(),
  sandbox: z.boolean().optional(),
  sandboxChain: z.string().max(32).optional(),
});

router.post('/set', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const result = setPolicySchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    return;
  }

  const { tenantId, featuresJson, sandbox, sandboxChain } = result.data;

  try {
    const [existing] = await db
      .select()
      .from(tenantPolicies)
      .where(eq(tenantPolicies.tenantId, tenantId))
      .limit(1);

    if (existing) {
      const updateData: Record<string, any> = {};
      if (featuresJson !== undefined) updateData.featuresJson = featuresJson;
      if (sandbox !== undefined) updateData.sandbox = sandbox;
      if (sandboxChain !== undefined) updateData.sandboxChain = sandboxChain;
      
      const [updated] = await db
        .update(tenantPolicies)
        .set(updateData)
        .where(eq(tenantPolicies.tenantId, tenantId))
        .returning();

      res.json({
        ok: true,
        action: 'updated',
        policy: {
          id: updated.id,
          tenantId: updated.tenantId,
          sandbox: updated.sandbox,
          sandboxChain: updated.sandboxChain,
          featuresJson: updated.featuresJson,
        },
      });
    } else {
      const [created] = await db
        .insert(tenantPolicies)
        .values({
          tenantId,
          featuresJson: featuresJson || {},
          sandbox: sandbox || false,
          sandboxChain: sandboxChain || null,
        })
        .returning();

      res.status(201).json({
        ok: true,
        action: 'created',
        policy: {
          id: created.id,
          tenantId: created.tenantId,
          sandbox: created.sandbox,
          sandboxChain: created.sandboxChain,
          featuresJson: created.featuresJson,
        },
      });
    }
  } catch (error) {
    console.error('[POLICY] Error setting policy:', error);
    res.status(500).json({ error: 'Failed to set policy' });
  }
});

router.get('/get', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const tenantId = req.query.tenantId as string;
  
  if (!tenantId) {
    res.status(400).json({ error: 'tenantId query parameter is required' });
    return;
  }

  try {
    const [policy] = await db
      .select()
      .from(tenantPolicies)
      .where(eq(tenantPolicies.tenantId, tenantId))
      .limit(1);

    if (!policy) {
      res.status(404).json({ 
        error: 'Policy not found',
        tenantId,
      });
      return;
    }

    res.json({
      ok: true,
      policy: {
        id: policy.id,
        tenantId: policy.tenantId,
        sandbox: policy.sandbox,
        sandboxChain: policy.sandboxChain,
        featuresJson: policy.featuresJson,
      },
    });
  } catch (error) {
    console.error('[POLICY] Error fetching policy:', error);
    res.status(500).json({ error: 'Failed to fetch policy' });
  }
});

router.get('/list', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const policies = await db
      .select({
        id: tenantPolicies.id,
        tenantId: tenantPolicies.tenantId,
        sandbox: tenantPolicies.sandbox,
        sandboxChain: tenantPolicies.sandboxChain,
        featuresJson: tenantPolicies.featuresJson,
      })
      .from(tenantPolicies)
      .limit(limit)
      .offset(offset);

    res.json({
      ok: true,
      policies,
      pagination: {
        limit,
        offset,
        count: policies.length,
      },
    });
  } catch (error) {
    console.error('[POLICY] Error listing policies:', error);
    res.status(500).json({ error: 'Failed to list policies' });
  }
});

router.delete('/delete', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const tenantId = req.query.tenantId as string;
  
  if (!tenantId) {
    res.status(400).json({ error: 'tenantId query parameter is required' });
    return;
  }

  try {
    const [deleted] = await db
      .delete(tenantPolicies)
      .where(eq(tenantPolicies.tenantId, tenantId))
      .returning();

    if (!deleted) {
      res.status(404).json({ 
        error: 'Policy not found',
        tenantId,
      });
      return;
    }

    res.json({
      ok: true,
      deleted: {
        id: deleted.id,
        tenantId: deleted.tenantId,
      },
    });
  } catch (error) {
    console.error('[POLICY] Error deleting policy:', error);
    res.status(500).json({ error: 'Failed to delete policy' });
  }
});

export default router;
