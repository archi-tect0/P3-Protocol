import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  moderatorRoles, 
  moderationActions, 
  platformReports,
  bannedWallets,
  hubCategories
} from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

type ModeratorRole = 'superuser' | 'admin' | 'moderator' | 'reviewer';
type ModeratorStatus = 'active' | 'suspended' | 'revoked';

const ROLE_HIERARCHY: Record<ModeratorRole, number> = {
  superuser: 4,
  admin: 3,
  moderator: 2,
  reviewer: 1,
};

interface ModerationRequest extends Request {
  moderatorAddr?: string;
  moderatorRole?: ModeratorRole;
  isSuperuser?: boolean;
}

interface RoleInfo {
  walletAddress: string;
  role: ModeratorRole;
  status: ModeratorStatus;
  isSuperuser: boolean;
  permissions?: Record<string, boolean> | null;
}

async function getRoleInfo(walletAddress: string): Promise<RoleInfo | null> {
  const normalizedAddr = walletAddress.toLowerCase();
  
  if (ADMIN_WALLET && normalizedAddr === ADMIN_WALLET) {
    return {
      walletAddress: normalizedAddr,
      role: 'superuser',
      status: 'active',
      isSuperuser: true,
      permissions: null,
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
      status: roleRecord.status as ModeratorStatus,
      isSuperuser: false,
      permissions: roleRecord.permissions as Record<string, boolean> | null,
    };
  } catch (error) {
    console.error('[MOD] Error fetching role info:', error);
    return null;
  }
}

function hasMinimumRole(userRole: ModeratorRole, requiredRole: ModeratorRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

function requireRole(minimumRole: ModeratorRole) {
  return async (req: ModerationRequest, res: Response, next: NextFunction) => {
    const addr = req.headers['x-p3-addr'] as string | undefined;

    if (!addr) {
      return res.status(403).json({ error: 'Missing X-P3-Addr header' });
    }

    const roleInfo = await getRoleInfo(addr);

    if (!roleInfo) {
      return res.status(403).json({ error: 'Access denied: No moderator role assigned' });
    }

    if (!hasMinimumRole(roleInfo.role, minimumRole)) {
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

const requireReviewer = requireRole('reviewer');
const requireModerator = requireRole('moderator');
const requireAdmin = requireRole('admin');
const requireSuperuser = requireRole('superuser');

async function logModerationAction(
  actionType: string,
  moderatorWallet: string,
  targetType: string,
  targetId: string,
  reason?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(moderationActions).values({
      actionType: actionType as any,
      moderatorWallet,
      targetType,
      targetId,
      reason: reason || null,
      metadata: metadata || null,
    });
  } catch (error) {
    console.error('[MOD] Failed to log moderation action:', error);
  }
}

router.get('/whoami', async (req: Request, res: Response) => {
  const addr = req.headers['x-p3-addr'] as string | undefined;

  if (!addr) {
    return res.json({
      authenticated: false,
      role: null,
      message: 'No wallet address provided',
    });
  }

  const roleInfo = await getRoleInfo(addr);

  if (!roleInfo) {
    return res.json({
      authenticated: true,
      walletAddress: addr.toLowerCase(),
      role: null,
      isSuperuser: false,
      isStaff: false,
      message: 'No moderator role assigned',
    });
  }

  res.json({
    authenticated: true,
    walletAddress: roleInfo.walletAddress,
    role: roleInfo.role,
    status: roleInfo.status,
    isSuperuser: roleInfo.isSuperuser,
    isStaff: true,
    permissions: roleInfo.permissions,
    hierarchy: ROLE_HIERARCHY[roleInfo.role],
  });
});

const assignRoleSchema = z.object({
  walletAddress: z.string().min(1).max(42),
  role: z.enum(['admin', 'moderator', 'reviewer']),
  notes: z.string().optional(),
  permissions: z.record(z.boolean()).optional(),
});

router.get('/roles', requireAdmin, async (req: ModerationRequest, res: Response) => {
  try {
    const roles = await db
      .select()
      .from(moderatorRoles)
      .orderBy(desc(moderatorRoles.createdAt));

    const rolesWithSuperuser = roles.map(r => ({
      ...r,
      isSuperuser: ADMIN_WALLET ? r.walletAddress.toLowerCase() === ADMIN_WALLET : false,
    }));

    if (ADMIN_WALLET) {
      const superuserExists = roles.some(r => r.walletAddress.toLowerCase() === ADMIN_WALLET);
      if (!superuserExists) {
        rolesWithSuperuser.unshift({
          id: 'env-superuser',
          walletAddress: ADMIN_WALLET,
          role: 'superuser' as const,
          status: 'active' as const,
          permissions: null,
          assignedBy: 'SYSTEM',
          notes: 'Environment-configured superuser (ADMIN_WALLET)',
          createdAt: new Date(),
          updatedAt: new Date(),
          isSuperuser: true,
        });
      }
    }

    res.json({
      roles: rolesWithSuperuser,
      count: rolesWithSuperuser.length,
    });
  } catch (error) {
    console.error('[MOD] Error listing roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.post('/roles', requireSuperuser, async (req: ModerationRequest, res: Response) => {
  const result = assignRoleSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { walletAddress, role, notes, permissions } = result.data;
  const normalizedWallet = walletAddress.toLowerCase();

  if (ADMIN_WALLET && normalizedWallet === ADMIN_WALLET) {
    return res.status(400).json({ 
      error: 'Cannot modify the environment-configured superuser role' 
    });
  }

  try {
    const [existing] = await db
      .select()
      .from(moderatorRoles)
      .where(eq(sql`lower(${moderatorRoles.walletAddress})`, normalizedWallet))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(moderatorRoles)
        .set({
          role: role as any,
          status: 'active',
          notes: notes || existing.notes,
          permissions: permissions || existing.permissions,
          assignedBy: req.moderatorAddr!,
          updatedAt: new Date(),
        })
        .where(eq(moderatorRoles.id, existing.id))
        .returning();

      await logModerationAction(
        'assign_role',
        req.moderatorAddr!,
        'wallet',
        normalizedWallet,
        `Updated role to ${role}`,
        { previousRole: existing.role, newRole: role }
      );

      return res.json({
        ok: true,
        action: 'updated',
        role: updated,
      });
    }

    const [newRole] = await db
      .insert(moderatorRoles)
      .values({
        walletAddress: normalizedWallet,
        role: role as any,
        status: 'active',
        permissions: permissions || null,
        assignedBy: req.moderatorAddr!,
        notes: notes || null,
      })
      .returning();

    await logModerationAction(
      'assign_role',
      req.moderatorAddr!,
      'wallet',
      normalizedWallet,
      `Assigned role: ${role}`,
      { role }
    );

    res.json({
      ok: true,
      action: 'created',
      role: newRole,
    });
  } catch (error) {
    console.error('[MOD] Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

router.delete('/roles/:wallet', requireSuperuser, async (req: ModerationRequest, res: Response) => {
  const { wallet } = req.params;
  const normalizedWallet = wallet.toLowerCase();

  if (ADMIN_WALLET && normalizedWallet === ADMIN_WALLET) {
    return res.status(400).json({ 
      error: 'Cannot revoke the environment-configured superuser role' 
    });
  }

  try {
    const [existing] = await db
      .select()
      .from(moderatorRoles)
      .where(eq(sql`lower(${moderatorRoles.walletAddress})`, normalizedWallet))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Role not found for this wallet' });
    }

    const [revoked] = await db
      .update(moderatorRoles)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(eq(moderatorRoles.id, existing.id))
      .returning();

    await logModerationAction(
      'revoke_role',
      req.moderatorAddr!,
      'wallet',
      normalizedWallet,
      `Revoked ${existing.role} role`,
      { previousRole: existing.role, previousStatus: existing.status }
    );

    res.json({
      ok: true,
      revoked: revoked.walletAddress,
      previousRole: existing.role,
    });
  } catch (error) {
    console.error('[MOD] Error revoking role:', error);
    res.status(500).json({ error: 'Failed to revoke role' });
  }
});

router.get('/reports', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { status, type, limit = '50', offset = '0' } = req.query;

  try {
    let query = db.select().from(platformReports);

    const conditions = [];
    if (status && typeof status === 'string') {
      conditions.push(eq(platformReports.status, status as any));
    }
    if (type && typeof type === 'string') {
      conditions.push(eq(platformReports.reportType, type as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const reports = await query
      .orderBy(desc(platformReports.createdAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformReports);

    res.json({
      reports,
      total: countResult?.count || 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('[MOD] Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

const resolveReportSchema = z.object({
  resolution: z.enum(['resolved', 'dismissed']),
  reason: z.string().optional(),
  actionTaken: z.string().optional(),
});

router.post('/reports/:id/resolve', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const result = resolveReportSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { resolution, reason, actionTaken } = result.data;

  try {
    const [existing] = await db
      .select()
      .from(platformReports)
      .where(eq(platformReports.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (existing.status === 'resolved' || existing.status === 'dismissed') {
      return res.status(400).json({ 
        error: 'Report already resolved',
        currentStatus: existing.status,
      });
    }

    const [updated] = await db
      .update(platformReports)
      .set({
        status: resolution,
        resolution: reason || actionTaken || null,
        resolvedBy: req.moderatorAddr!,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(platformReports.id, id))
      .returning();

    await logModerationAction(
      'dismiss_report',
      req.moderatorAddr!,
      'report',
      id,
      reason || `Report ${resolution}`,
      { 
        resolution, 
        reportType: existing.reportType,
        targetId: existing.targetId,
        actionTaken,
      }
    );

    res.json({
      ok: true,
      report: updated,
    });
  } catch (error) {
    console.error('[MOD] Error resolving report:', error);
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

router.get('/actions', requireAdmin, async (req: ModerationRequest, res: Response) => {
  const { 
    moderator, 
    actionType, 
    targetType,
    limit = '100', 
    offset = '0' 
  } = req.query;

  try {
    let query = db.select().from(moderationActions);

    const conditions = [];
    if (moderator && typeof moderator === 'string') {
      conditions.push(eq(sql`lower(${moderationActions.moderatorWallet})`, moderator.toLowerCase()));
    }
    if (actionType && typeof actionType === 'string') {
      conditions.push(eq(moderationActions.actionType, actionType as any));
    }
    if (targetType && typeof targetType === 'string') {
      conditions.push(eq(moderationActions.targetType, targetType));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const actions = await query
      .orderBy(desc(moderationActions.createdAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderationActions);

    res.json({
      actions,
      total: countResult?.count || 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error('[MOD] Error fetching actions:', error);
    res.status(500).json({ error: 'Failed to fetch moderation actions' });
  }
});

const visibilitySchema = z.object({
  visible: z.boolean(),
  reason: z.string().optional(),
});

router.post('/apps/:id/visibility', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const result = visibilitySchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { visible, reason } = result.data;
  const actionType = visible ? 'show_app' : 'hide_app';

  await logModerationAction(
    actionType,
    req.moderatorAddr!,
    'app',
    id,
    reason,
    { visible }
  );

  console.log(`[MOD] ${actionType}: ${id} by ${req.moderatorAddr}`);
  
  res.json({ 
    ok: true, 
    appId: id, 
    visible,
    actionBy: req.moderatorAddr,
  });
});

const categorySchema = z.object({
  category: z.string(),
  reason: z.string().optional(),
});

router.post('/apps/:id/category', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const result = categorySchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { category, reason } = result.data;

  await logModerationAction(
    'change_category',
    req.moderatorAddr!,
    'app',
    id,
    reason,
    { category }
  );

  console.log(`[MOD] Changed app ${id} category to ${category} by ${req.moderatorAddr}`);
  
  res.json({ 
    ok: true, 
    appId: id, 
    category,
    actionBy: req.moderatorAddr,
  });
});

router.delete('/reviews/:id', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  await logModerationAction(
    'delete_review',
    req.moderatorAddr!,
    'review',
    id,
    reason,
    {}
  );

  console.log(`[MOD] Removed review: ${id} by ${req.moderatorAddr}`);
  
  res.json({ 
    ok: true, 
    removed: id,
    actionBy: req.moderatorAddr,
  });
});

router.post('/widgets/:id/approve', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  await logModerationAction(
    'approve_widget',
    req.moderatorAddr!,
    'widget',
    id,
    reason,
    {}
  );

  console.log(`[MOD] Approved widget: ${id} by ${req.moderatorAddr}`);
  
  res.json({ 
    ok: true, 
    approved: id,
    actionBy: req.moderatorAddr,
  });
});

router.post('/widgets/:id/reject', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body || {};

  await logModerationAction(
    'reject_widget',
    req.moderatorAddr!,
    'widget',
    id,
    reason,
    {}
  );

  console.log(`[MOD] Rejected widget: ${id} by ${req.moderatorAddr}`);
  
  res.json({ 
    ok: true, 
    rejected: id,
    actionBy: req.moderatorAddr,
  });
});

const banUserSchema = z.object({
  address: z.string().min(1).max(42),
  reason: z.string().optional(),
  banType: z.enum(['permanent', 'temporary']).optional(),
  expiresAt: z.string().datetime().optional(),
});

router.get('/users/banned', requireModerator, async (req: ModerationRequest, res: Response) => {
  try {
    const banned = await db
      .select()
      .from(bannedWallets)
      .orderBy(desc(bannedWallets.createdAt));

    res.json({
      users: banned,
      count: banned.length,
    });
  } catch (error) {
    console.error('[MOD] Error fetching banned users:', error);
    res.status(500).json({ error: 'Failed to fetch banned users' });
  }
});

router.post('/users/ban', requireModerator, async (req: ModerationRequest, res: Response) => {
  const result = banUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { address, reason, banType = 'permanent', expiresAt } = result.data;
  const normalizedAddr = address.toLowerCase();

  if (ADMIN_WALLET && normalizedAddr === ADMIN_WALLET) {
    return res.status(400).json({ error: 'Cannot ban the superuser wallet' });
  }

  try {
    const [existing] = await db
      .select()
      .from(bannedWallets)
      .where(eq(sql`lower(${bannedWallets.walletAddress})`, normalizedAddr))
      .limit(1);

    if (existing) {
      return res.status(400).json({ 
        error: 'User is already banned',
        bannedAt: existing.createdAt,
      });
    }

    const [banned] = await db
      .insert(bannedWallets)
      .values({
        walletAddress: normalizedAddr,
        banType: banType as any,
        reason: reason || null,
        bannedBy: req.moderatorAddr!,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    await logModerationAction(
      'ban_user',
      req.moderatorAddr!,
      'wallet',
      normalizedAddr,
      reason,
      { banType, expiresAt }
    );

    res.json({
      ok: true,
      banned: banned.walletAddress,
      banType: banned.banType,
    });
  } catch (error) {
    console.error('[MOD] Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

const unbanUserSchema = z.object({
  address: z.string().min(1).max(42),
  reason: z.string().optional(),
});

router.post('/users/unban', requireModerator, async (req: ModerationRequest, res: Response) => {
  const result = unbanUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { address, reason } = result.data;
  const normalizedAddr = address.toLowerCase();

  try {
    const [existing] = await db
      .select()
      .from(bannedWallets)
      .where(eq(sql`lower(${bannedWallets.walletAddress})`, normalizedAddr))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'User is not banned' });
    }

    await db
      .delete(bannedWallets)
      .where(eq(bannedWallets.id, existing.id));

    await logModerationAction(
      'unban_user',
      req.moderatorAddr!,
      'wallet',
      normalizedAddr,
      reason,
      { previousBanType: existing.banType }
    );

    res.json({
      ok: true,
      unbanned: normalizedAddr,
    });
  } catch (error) {
    console.error('[MOD] Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

router.get('/stats', requireAdmin, async (req: ModerationRequest, res: Response) => {
  try {
    const [rolesCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderatorRoles)
      .where(eq(moderatorRoles.status, 'active'));

    const [pendingReports] = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformReports)
      .where(eq(platformReports.status, 'pending'));

    const [totalReports] = await db
      .select({ count: sql<number>`count(*)` })
      .from(platformReports);

    const [bannedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bannedWallets);

    const [actionsToday] = await db
      .select({ count: sql<number>`count(*)` })
      .from(moderationActions)
      .where(sql`${moderationActions.createdAt} >= NOW() - INTERVAL '24 hours'`);

    res.json({
      activeRoles: rolesCount?.count || 0,
      pendingReports: pendingReports?.count || 0,
      totalReports: totalReports?.count || 0,
      bannedUsers: bannedCount?.count || 0,
      actionsLast24h: actionsToday?.count || 0,
      adminWalletConfigured: !!ADMIN_WALLET,
    });
  } catch (error) {
    console.error('[MOD] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch moderation stats' });
  }
});

// ============================================
// Hub Categories Management (Community-governed)
// ============================================

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().default('📦'),
  color: z.string().default('violet'),
  description: z.string().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  displayOrder: z.number().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.get('/categories', requireReviewer, async (req: ModerationRequest, res: Response) => {
  try {
    const categories = await db
      .select()
      .from(hubCategories)
      .orderBy(hubCategories.displayOrder);

    res.json({ categories });
  } catch (error) {
    console.error('[MOD] Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/categories', requireModerator, async (req: ModerationRequest, res: Response) => {
  const result = createCategorySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { name, icon, color, description } = result.data;
  const slug = slugify(name);

  try {
    const existing = await db
      .select()
      .from(hubCategories)
      .where(eq(hubCategories.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Category with this name already exists' });
    }

    const [maxOrder] = await db
      .select({ max: sql<number>`COALESCE(MAX(display_order), 0)` })
      .from(hubCategories);

    const [category] = await db
      .insert(hubCategories)
      .values({
        name,
        slug,
        icon,
        color,
        description,
        displayOrder: (maxOrder?.max || 0) + 1,
        createdBy: req.moderatorAddr!,
      })
      .returning();

    await logModerationAction(
      'create_category',
      req.moderatorAddr!,
      'category',
      category.id,
      undefined,
      { name, slug, icon, color }
    );

    res.json({ category });
  } catch (error) {
    console.error('[MOD] Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.patch('/categories/:id', requireModerator, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;
  const result = updateCategorySchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  try {
    const [existing] = await db
      .select()
      .from(hubCategories)
      .where(eq(hubCategories.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    
    if (result.data.name) {
      updates.name = result.data.name;
      updates.slug = slugify(result.data.name);
    }
    if (result.data.icon) updates.icon = result.data.icon;
    if (result.data.color) updates.color = result.data.color;
    if (result.data.description !== undefined) updates.description = result.data.description;
    if (result.data.displayOrder !== undefined) updates.displayOrder = result.data.displayOrder;
    if (result.data.status) updates.status = result.data.status;

    const [category] = await db
      .update(hubCategories)
      .set(updates)
      .where(eq(hubCategories.id, id))
      .returning();

    await logModerationAction(
      'update_category',
      req.moderatorAddr!,
      'category',
      id,
      undefined,
      { updates: result.data }
    );

    res.json({ category });
  } catch (error) {
    console.error('[MOD] Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/categories/:id', requireAdmin, async (req: ModerationRequest, res: Response) => {
  const { id } = req.params;

  try {
    const [existing] = await db
      .select()
      .from(hubCategories)
      .where(eq(hubCategories.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await db.delete(hubCategories).where(eq(hubCategories.id, id));

    await logModerationAction(
      'delete_category',
      req.moderatorAddr!,
      'category',
      id,
      undefined,
      { name: existing.name, slug: existing.slug }
    );

    res.json({ ok: true, deleted: id });
  } catch (error) {
    console.error('[MOD] Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
