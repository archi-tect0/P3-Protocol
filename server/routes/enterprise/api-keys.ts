import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../../db';
import { apiKeys, apiUsage } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

interface EnterpriseRequest extends Request {
  walletAddr?: string;
  isSuperuser?: boolean;
}

async function requireAdminOrSuperuser(
  req: EnterpriseRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const addr = req.headers['x-p3-addr'] as string | undefined;

  if (!addr) {
    res.status(403).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const normalizedAddr = addr.toLowerCase();
  const isSuperuser = ADMIN_WALLET ? normalizedAddr === ADMIN_WALLET : false;

  if (!isSuperuser) {
    res.status(403).json({ 
      error: 'Access denied: Requires admin or superuser privileges',
    });
    return;
  }

  req.walletAddr = normalizedAddr;
  req.isSuperuser = isSuperuser;
  next();
}

const createKeySchema = z.object({
  tenantId: z.string().min(1).max(64),
  tierId: z.number().int().optional(),
  quotaMonthly: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

router.post('/create', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response) => {
  const result = createKeySchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { tenantId, tierId, quotaMonthly, expiresAt } = result.data;

  try {
    const plaintextKey = crypto.randomBytes(32).toString('hex');
    
    const keyHash = crypto
      .createHash('sha256')
      .update(plaintextKey)
      .digest('hex');

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        keyHash,
        walletOwner: req.walletAddr!,
        tenantId,
        tierId: tierId ?? null,
        quotaMonthly: quotaMonthly ?? 100000,
        status: 'active',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    res.status(201).json({
      ok: true,
      keyId: newKey.id,
      apiKey: plaintextKey,
      tenantId: newKey.tenantId,
      quotaMonthly: newKey.quotaMonthly,
      expiresAt: newKey.expiresAt,
      warning: 'Store this API key securely. It will not be shown again.',
    });
  } catch (error) {
    console.error('[ENTERPRISE API-KEYS] Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

const revokeKeySchema = z.object({
  keyId: z.string().uuid(),
});

router.post('/revoke', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response) => {
  const result = revokeKeySchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { keyId } = result.data;

  try {
    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    if (existing.status === 'revoked') {
      return res.status(400).json({ error: 'API key is already revoked' });
    }

    const [revoked] = await db
      .update(apiKeys)
      .set({ status: 'revoked' })
      .where(eq(apiKeys.id, keyId))
      .returning();

    res.json({
      ok: true,
      keyId: revoked.id,
      status: revoked.status,
      message: 'API key has been revoked',
    });
  } catch (error) {
    console.error('[ENTERPRISE API-KEYS] Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

const listKeysSchema = z.object({
  tenantId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.get('/list', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response) => {
  const result = listKeysSchema.safeParse(req.query);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid query parameters', details: result.error.errors });
  }

  const { tenantId, page, limit } = result.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (tenantId) {
      conditions.push(eq(apiKeys.tenantId, tenantId));
    }

    const baseQuery = conditions.length > 0
      ? db.select({
          id: apiKeys.id,
          walletOwner: apiKeys.walletOwner,
          tenantId: apiKeys.tenantId,
          tierId: apiKeys.tierId,
          quotaMonthly: apiKeys.quotaMonthly,
          status: apiKeys.status,
          createdAt: apiKeys.createdAt,
          expiresAt: apiKeys.expiresAt,
        }).from(apiKeys).where(and(...conditions))
      : db.select({
          id: apiKeys.id,
          walletOwner: apiKeys.walletOwner,
          tenantId: apiKeys.tenantId,
          tierId: apiKeys.tierId,
          quotaMonthly: apiKeys.quotaMonthly,
          status: apiKeys.status,
          createdAt: apiKeys.createdAt,
          expiresAt: apiKeys.expiresAt,
        }).from(apiKeys);

    const keys = await baseQuery
      .orderBy(desc(apiKeys.createdAt))
      .limit(limit)
      .offset(offset);

    const countQuery = conditions.length > 0
      ? db.select({ count: sql<number>`count(*)` }).from(apiKeys).where(and(...conditions))
      : db.select({ count: sql<number>`count(*)` }).from(apiKeys);
    
    const [countResult] = await countQuery;
    const total = countResult?.count || 0;

    res.json({
      keys,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    console.error('[ENTERPRISE API-KEYS] Error listing API keys:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

router.get('/:id/usage', requireAdminOrSuperuser, async (req: EnterpriseRequest, res: Response) => {
  const { id } = req.params;

  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid key ID format' });
  }

  try {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const usageByEndpoint = await db
      .select({
        endpoint: apiUsage.endpoint,
        totalCount: sql<number>`sum(${apiUsage.count})`,
        lastHitAt: sql<Date>`max(${apiUsage.lastHitAt})`,
      })
      .from(apiUsage)
      .where(
        and(
          eq(apiUsage.keyId, id),
          sql`${apiUsage.periodStart} >= ${periodStart}`,
          sql`${apiUsage.periodEnd} <= ${periodEnd}`
        )
      )
      .groupBy(apiUsage.endpoint);

    const totalUsage = usageByEndpoint.reduce((sum, u) => sum + Number(u.totalCount || 0), 0);

    res.json({
      keyId: id,
      tenantId: key.tenantId,
      status: key.status,
      quotaMonthly: key.quotaMonthly,
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
      },
      usage: {
        total: totalUsage,
        remaining: Math.max(0, key.quotaMonthly - totalUsage),
        percentUsed: key.quotaMonthly > 0 ? ((totalUsage / key.quotaMonthly) * 100).toFixed(2) : 0,
        byEndpoint: usageByEndpoint.map(u => ({
          endpoint: u.endpoint,
          count: Number(u.totalCount || 0),
          lastHitAt: u.lastHitAt,
        })),
      },
    });
  } catch (error) {
    console.error('[ENTERPRISE API-KEYS] Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

export default router;
