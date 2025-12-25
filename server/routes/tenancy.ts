import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { tenancyZones, insertTenancyZoneSchema } from '@shared/schema';
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

const setZoneSchema = z.object({
  tenantId: z.string().min(1).max(64),
  provider: z.string().min(1).max(16),
  region: z.string().min(1).max(32),
});

router.post('/zone/set', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const result = setZoneSchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    return;
  }

  const { tenantId, provider, region } = result.data;

  try {
    const [existing] = await db
      .select()
      .from(tenancyZones)
      .where(eq(tenancyZones.tenantId, tenantId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(tenancyZones)
        .set({
          provider,
          region,
        })
        .where(eq(tenancyZones.tenantId, tenantId))
        .returning();

      res.json({
        ok: true,
        action: 'updated',
        zone: {
          id: updated.id,
          tenantId: updated.tenantId,
          provider: updated.provider,
          region: updated.region,
          createdAt: updated.createdAt,
        },
      });
    } else {
      const [created] = await db
        .insert(tenancyZones)
        .values({
          tenantId,
          provider,
          region,
        })
        .returning();

      res.status(201).json({
        ok: true,
        action: 'created',
        zone: {
          id: created.id,
          tenantId: created.tenantId,
          provider: created.provider,
          region: created.region,
          createdAt: created.createdAt,
        },
      });
    }
  } catch (error) {
    console.error('[TENANCY] Error setting zone:', error);
    res.status(500).json({ error: 'Failed to set zone' });
  }
});

router.get('/zone/get', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const tenantId = req.query.tenantId as string;
  
  if (!tenantId) {
    res.status(400).json({ error: 'tenantId query parameter is required' });
    return;
  }

  try {
    const [zone] = await db
      .select()
      .from(tenancyZones)
      .where(eq(tenancyZones.tenantId, tenantId))
      .limit(1);

    if (!zone) {
      res.status(404).json({ 
        error: 'Zone not found',
        tenantId,
      });
      return;
    }

    res.json({
      ok: true,
      zone: {
        id: zone.id,
        tenantId: zone.tenantId,
        provider: zone.provider,
        region: zone.region,
        createdAt: zone.createdAt,
      },
    });
  } catch (error) {
    console.error('[TENANCY] Error fetching zone:', error);
    res.status(500).json({ error: 'Failed to fetch zone' });
  }
});

router.get('/zones/list', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  const provider = req.query.provider as string;
  const region = req.query.region as string;

  try {
    let query = db.select().from(tenancyZones);
    
    if (provider) {
      query = query.where(eq(tenancyZones.provider, provider)) as typeof query;
    }
    
    if (region) {
      query = query.where(eq(tenancyZones.region, region)) as typeof query;
    }

    const zones = await query.limit(limit).offset(offset);

    res.json({
      ok: true,
      zones,
      pagination: {
        limit,
        offset,
        count: zones.length,
      },
    });
  } catch (error) {
    console.error('[TENANCY] Error listing zones:', error);
    res.status(500).json({ error: 'Failed to list zones' });
  }
});

router.delete('/zone/delete', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const tenantId = req.query.tenantId as string;
  
  if (!tenantId) {
    res.status(400).json({ error: 'tenantId query parameter is required' });
    return;
  }

  try {
    const [deleted] = await db
      .delete(tenancyZones)
      .where(eq(tenancyZones.tenantId, tenantId))
      .returning();

    if (!deleted) {
      res.status(404).json({ 
        error: 'Zone not found',
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
    console.error('[TENANCY] Error deleting zone:', error);
    res.status(500).json({ error: 'Failed to delete zone' });
  }
});

export default router;
