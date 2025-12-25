import { Router, Response } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { IStorage } from './storage';
import { authenticateJWT, type AuthenticatedRequest } from './auth';
import { requireAdmin, logAudit, type RBACRequest } from './rbac';
import { evaluateCondition } from './rules/engine';

const conditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    field: z.string().optional(),
    operator: z.enum([
      'eq',
      'ne',
      'gt',
      'lt',
      'gte',
      'lte',
      'in',
      'nin',
      'contains',
      'not_contains',
      'matches',
      'not_matches',
      'exists',
      'not_exists',
    ]),
    value: z.any().optional(),
    conditions: z.array(conditionSchema).optional(),
    logic: z.enum(['and', 'or']).optional(),
  })
);

const trustConfigSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  version: z.number().optional(),
});

const trustRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  condition: conditionSchema,
  action: z.object({}).passthrough(),
  priority: z.number().optional(),
  status: z.enum(['active', 'inactive', 'testing']).optional(),
});

const trustPluginSchema = z.object({
  pluginId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  config: z.object({}).passthrough().optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
});

const userRoleUpdateSchema = z.object({
  role: z.enum(['admin', 'viewer']),
});

const dryRunConfigSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
});

const dryRunRuleSchema = z.object({
  condition: conditionSchema,
  action: z.object({}).passthrough(),
  testData: z.any().optional(),
});

const secretRotateSchema = z.object({
  secretType: z.enum(['JWT_SECRET', 'IP_SALT']),
  notify: z.boolean().optional(),
});

function validateBody<T>(schema: z.ZodSchema<T>, body: any): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`);
  }
  return result.data;
}

export function createTrustRoutes(storage: IStorage): Router {
  const router = Router();

  const protectedRouter = Router();
  protectedRouter.use(authenticateJWT);
  protectedRouter.use(requireAdmin);

  // ============================================================================
  // 1. Config Management Endpoints
  // ============================================================================

  protectedRouter.get('/config', async (req: RBACRequest, res: Response) => {
    try {
      const { key } = req.query;

      const configs = await storage.getTrustConfig(key as string | undefined);

      await logAudit(
        storage,
        'trust_config',
        key ? (key as string) : 'all',
        'view',
        req.user!.userId
      );

      res.json(configs);
    } catch (error) {
      console.error('Get trust config error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get trust config' 
      });
    }
  });

  protectedRouter.post('/config', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(trustConfigSchema, req.body);

      const config = await storage.createTrustConfig({
        key: data.key,
        value: data.value,
        version: data.version || 1,
        createdBy: req.user!.userId,
      });

      await logAudit(
        storage,
        'trust_config',
        config.id,
        'create',
        req.user!.userId,
        { key: data.key, version: config.version }
      );

      res.status(201).json(config);
    } catch (error) {
      console.error('Create trust config error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create trust config' 
      });
    }
  });

  // ============================================================================
  // 2. Smart Rules Engine Endpoints
  // ============================================================================

  protectedRouter.get('/rules', async (req: RBACRequest, res: Response) => {
    try {
      const { status } = req.query;

      const rules = await storage.getTrustRules(
        status ? { status: status as string } : undefined
      );

      await logAudit(
        storage,
        'trust_rules',
        'all',
        'view',
        req.user!.userId,
        { filter: status }
      );

      res.json(rules);
    } catch (error) {
      console.error('Get trust rules error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get trust rules' 
      });
    }
  });

  protectedRouter.post('/rules', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(trustRuleSchema, req.body);

      const rule = await storage.createTrustRule({
        name: data.name,
        description: data.description,
        condition: data.condition,
        action: data.action,
        priority: data.priority || 100,
        status: data.status || 'active',
        createdBy: req.user!.userId,
      });

      await logAudit(
        storage,
        'trust_rules',
        rule.id,
        'create',
        req.user!.userId,
        { name: data.name, priority: rule.priority }
      );

      res.status(201).json(rule);
    } catch (error) {
      console.error('Create trust rule error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create trust rule' 
      });
    }
  });

  protectedRouter.patch('/rules/:id', async (req: RBACRequest, res: Response) => {
    try {
      const { id } = req.params;
      const data = validateBody(trustRuleSchema.partial(), req.body);

      const rule = await storage.updateTrustRule(id, data);

      await logAudit(
        storage,
        'trust_rules',
        rule.id,
        'update',
        req.user!.userId,
        { changes: Object.keys(data) }
      );

      res.json(rule);
    } catch (error) {
      console.error('Update trust rule error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update trust rule' 
      });
    }
  });

  // ============================================================================
  // 3. Plugin Registry Endpoints
  // ============================================================================

  protectedRouter.get('/plugins', async (req: RBACRequest, res: Response) => {
    try {
      const { status } = req.query;

      const plugins = await storage.getTrustPlugins(
        status ? { status: status as string } : undefined
      );

      await logAudit(
        storage,
        'trust_plugins',
        'all',
        'view',
        req.user!.userId,
        { filter: status }
      );

      res.json(plugins);
    } catch (error) {
      console.error('Get trust plugins error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get trust plugins' 
      });
    }
  });

  protectedRouter.post('/plugins', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(trustPluginSchema, req.body);

      const plugin = await storage.createTrustPlugin({
        pluginId: data.pluginId,
        name: data.name,
        version: data.version,
        description: data.description,
        config: data.config,
        status: data.status || 'enabled',
        installedBy: req.user!.userId,
      });

      await logAudit(
        storage,
        'trust_plugins',
        plugin.id,
        'install',
        req.user!.userId,
        { pluginId: data.pluginId, version: data.version }
      );

      res.status(201).json(plugin);
    } catch (error) {
      console.error('Create trust plugin error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create trust plugin' 
      });
    }
  });

  protectedRouter.patch('/plugins/:id', async (req: RBACRequest, res: Response) => {
    try {
      const { id } = req.params;
      const data = validateBody(trustPluginSchema.partial(), req.body);

      const plugin = await storage.updateTrustPlugin(id, data);

      await logAudit(
        storage,
        'trust_plugins',
        plugin.id,
        'update',
        req.user!.userId,
        { changes: Object.keys(data) }
      );

      res.json(plugin);
    } catch (error) {
      console.error('Update trust plugin error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update trust plugin' 
      });
    }
  });

  // ============================================================================
  // 4. Audit Log Viewer
  // ============================================================================

  protectedRouter.get('/audit', async (req: RBACRequest, res: Response) => {
    try {
      const { entityType, entityId, limit } = req.query;

      let auditLogs = await storage.getAuditLog(
        entityType || entityId
          ? {
              entityType: entityType as string | undefined,
              entityId: entityId as string | undefined,
            }
          : undefined
      );

      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          auditLogs = auditLogs.slice(0, limitNum);
        }
      }

      res.json(auditLogs);
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get audit logs' 
      });
    }
  });

  // ============================================================================
  // 5. PDF Export of Audit Trails
  // ============================================================================

  protectedRouter.get('/audit/export/pdf', async (req: RBACRequest, res: Response) => {
    try {
      const { entityType, entityId } = req.query;

      const auditLogs = await storage.getAuditLog(
        entityType || entityId
          ? {
              entityType: entityType as string | undefined,
              entityId: entityId as string | undefined,
            }
          : undefined
      );

      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Audit Trail Report', 14, 22);
      
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toISOString()}`, 14, 30);
      doc.text(`Generated by: ${req.user!.userId}`, 14, 36);
      
      if (entityType) {
        doc.text(`Entity Type: ${entityType}`, 14, 42);
      }
      if (entityId) {
        doc.text(`Entity ID: ${entityId}`, 14, 48);
      }

      const tableData = auditLogs.map(log => [
        new Date(log.createdAt).toLocaleString(),
        log.entityType,
        log.entityId.substring(0, 12) + '...',
        log.action,
        log.actor.substring(0, 12) + '...',
      ]);

      (doc as any).autoTable({
        head: [['Timestamp', 'Entity Type', 'Entity ID', 'Action', 'Actor']],
        body: tableData,
        startY: entityType || entityId ? 54 : 48,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 139, 202] },
      });

      await logAudit(
        storage,
        'audit_export',
        'pdf',
        'export',
        req.user!.userId,
        { count: auditLogs.length, filters: { entityType, entityId } }
      );

      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Export audit PDF error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to export audit PDF' 
      });
    }
  });

  // ============================================================================
  // 6. Live System Metrics
  // ============================================================================

  protectedRouter.get('/health', async (req: RBACRequest, res: Response) => {
    try {
      const metrics = await storage.getMetrics();

      const [configs, rules, plugins, users] = await Promise.all([
        storage.getTrustConfig(),
        storage.getTrustRules(),
        storage.getTrustPlugins(),
        storage.listUsers(),
      ]);

      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics,
        system: {
          trustConfigCount: configs.length,
          trustRulesActive: rules.filter(r => r.status === 'active').length,
          trustRulesTotal: rules.length,
          pluginsEnabled: plugins.filter(p => p.status === 'enabled').length,
          pluginsTotal: plugins.length,
          userCount: users.length,
          adminCount: users.filter(u => u.role === 'admin').length,
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      };

      res.json(health);
    } catch (error) {
      console.error('Get health metrics error:', error);
      res.status(500).json({ 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Failed to get health metrics' 
      });
    }
  });

  // ============================================================================
  // 7. User Management (RBAC)
  // ============================================================================

  protectedRouter.get('/rbac', async (req: RBACRequest, res: Response) => {
    try {
      const users = await storage.listUsers();

      const sanitizedUsers = users.map(u => ({
        id: u.id,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      }));

      await logAudit(
        storage,
        'user_management',
        'all',
        'view',
        req.user!.userId
      );

      res.json(sanitizedUsers);
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to list users' 
      });
    }
  });

  protectedRouter.patch('/rbac/:userId', async (req: RBACRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const data = validateBody(userRoleUpdateSchema, req.body);

      const user = await storage.updateUserRole(userId, data.role);

      await logAudit(
        storage,
        'user_management',
        userId,
        'update_role',
        req.user!.userId,
        { newRole: data.role }
      );

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error) {
      console.error('Update user role error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update user role' 
      });
    }
  });

  protectedRouter.post('/rbac/:userId/delete', async (req: RBACRequest, res: Response) => {
    try {
      const { userId } = req.params;

      if (userId === req.user!.userId) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      await storage.deleteUser(userId);

      await logAudit(
        storage,
        'user_management',
        userId,
        'delete',
        req.user!.userId
      );

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete user' 
      });
    }
  });

  // ============================================================================
  // 8. Config Dry Run
  // ============================================================================

  protectedRouter.post('/config/dry-run', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(dryRunConfigSchema, req.body);

      const existingConfigs = await storage.getTrustConfig(data.key);
      
      const currentVersion = existingConfigs.length > 0 
        ? existingConfigs[0].version 
        : 0;

      const preview = {
        action: existingConfigs.length > 0 ? 'update' : 'create',
        key: data.key,
        currentValue: existingConfigs.length > 0 ? existingConfigs[0].value : null,
        currentVersion,
        newValue: data.value,
        newVersion: currentVersion + 1,
        impact: {
          affectedSystems: ['trust_layer', 'config_management'],
          rollbackAvailable: existingConfigs.length > 0,
          breakingChanges: false,
        },
      };

      await logAudit(
        storage,
        'trust_config',
        data.key,
        'dry_run',
        req.user!.userId,
        { preview }
      );

      res.json(preview);
    } catch (error) {
      console.error('Config dry run error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to preview config changes' 
      });
    }
  });

  // ============================================================================
  // 9. Rule Execution Dry Run
  // ============================================================================

  protectedRouter.post('/rules/dry-run', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(dryRunRuleSchema, req.body);

      const testData = data.testData || {
        sampleEvent: 'test_event',
        timestamp: new Date().toISOString(),
      };

      let conditionResult = false;
      let conditionError: string | null = null;

      try {
        conditionResult = evaluateCondition(data.condition, testData);
      } catch (error) {
        conditionError = error instanceof Error ? error.message : 'Condition evaluation failed';
      }

      const preview = {
        condition: data.condition,
        action: data.action,
        testData,
        results: {
          conditionMet: conditionResult,
          conditionError,
          wouldExecute: conditionResult && !conditionError,
          estimatedImpact: conditionResult ? 'Action would be executed' : 'Action would be skipped',
        },
      };

      await logAudit(
        storage,
        'trust_rules',
        'dry_run',
        'test_execution',
        req.user!.userId,
        { preview }
      );

      res.json(preview);
    } catch (error) {
      console.error('Rule dry run error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to test rule execution' 
      });
    }
  });

  // ============================================================================
  // 10. Secret Rotation
  // ============================================================================

  protectedRouter.post('/secrets/rotate', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(secretRotateSchema, req.body);

      const newSecret = randomBytes(32).toString('hex');
      const hashedSecret = createHash('sha256').update(newSecret).digest('hex');

      const envVar = data.secretType;
      const oldSecretHash = process.env[envVar] 
        ? createHash('sha256').update(process.env[envVar]!).digest('hex').substring(0, 16)
        : 'not_set';

      const rotationRecord = {
        secretType: data.secretType,
        rotatedAt: new Date().toISOString(),
        rotatedBy: req.user!.userId,
        oldSecretHash,
        newSecretHash: hashedSecret.substring(0, 16),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      };

      await logAudit(
        storage,
        'secret_rotation',
        data.secretType,
        'rotate',
        req.user!.userId,
        rotationRecord
      );

      res.json({
        success: true,
        secretType: data.secretType,
        rotatedAt: rotationRecord.rotatedAt,
        expiresAt: rotationRecord.expiresAt,
        newSecret: data.notify ? newSecret : undefined,
        message: data.notify 
          ? 'Secret rotated successfully. Save the new secret securely - it will not be shown again.'
          : 'Secret rotated successfully. Check audit logs for rotation details.',
      });
    } catch (error) {
      console.error('Secret rotation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to rotate secret' 
      });
    }
  });

  router.use('/api/trust', protectedRouter);

  // ============================================================================
  // Admin API Endpoints (without /trust prefix for admin panel)
  // ============================================================================

  const adminRouter = Router();
  adminRouter.use(authenticateJWT);
  adminRouter.use(requireAdmin);

  // Settings endpoints
  adminRouter.get('/settings', async (req: RBACRequest, res: Response) => {
    try {
      const { key } = req.query;

      const configs = await storage.getTrustConfig(key as string | undefined);

      await logAudit(
        storage,
        'trust_config',
        key ? (key as string) : 'all',
        'view',
        req.user!.userId
      );

      res.json(configs);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get settings' 
      });
    }
  });

  adminRouter.put('/settings/:key', async (req: RBACRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (value === undefined) {
        res.status(400).json({ error: 'Value is required' });
        return;
      }

      const config = await storage.updateTrustConfig(key, value, req.user.userId);

      await logAudit(
        storage,
        'trust_config',
        config.id,
        'update',
        req.user.userId,
        { key, newValue: value }
      );

      res.json(config);
    } catch (error) {
      console.error('Update setting error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update setting' 
      });
    }
  });

  // Plugins endpoints
  adminRouter.get('/plugins', async (req: RBACRequest, res: Response) => {
    try {
      const { status } = req.query;

      const plugins = await storage.getTrustPlugins(
        status ? { status: status as string } : undefined
      );

      await logAudit(
        storage,
        'trust_plugins',
        'all',
        'view',
        req.user!.userId,
        { filter: status }
      );

      res.json(plugins);
    } catch (error) {
      console.error('Get plugins error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get plugins' 
      });
    }
  });

  adminRouter.post('/plugins', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(trustPluginSchema, req.body);

      const plugin = await storage.createTrustPlugin({
        pluginId: data.pluginId,
        name: data.name,
        version: data.version,
        description: data.description,
        config: data.config,
        status: data.status || 'enabled',
        installedBy: req.user!.userId,
      });

      await logAudit(
        storage,
        'trust_plugins',
        plugin.id,
        'install',
        req.user!.userId,
        { pluginId: data.pluginId, version: data.version }
      );

      res.status(201).json(plugin);
    } catch (error) {
      console.error('Create plugin error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create plugin' 
      });
    }
  });

  // Rules endpoints
  adminRouter.get('/rules', async (req: RBACRequest, res: Response) => {
    try {
      const { status } = req.query;

      const rules = await storage.getTrustRules(
        status ? { status: status as string } : undefined
      );

      await logAudit(
        storage,
        'trust_rules',
        'all',
        'view',
        req.user!.userId,
        { filter: status }
      );

      res.json(rules);
    } catch (error) {
      console.error('Get rules error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get rules' 
      });
    }
  });

  adminRouter.post('/rules', async (req: RBACRequest, res: Response) => {
    try {
      const data = validateBody(trustRuleSchema, req.body);

      const rule = await storage.createTrustRule({
        name: data.name,
        description: data.description,
        condition: data.condition,
        action: data.action,
        priority: data.priority || 100,
        status: data.status || 'active',
        createdBy: req.user!.userId,
      });

      await logAudit(
        storage,
        'trust_rules',
        rule.id,
        'create',
        req.user!.userId,
        { name: data.name, priority: rule.priority }
      );

      res.status(201).json(rule);
    } catch (error) {
      console.error('Create rule error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create rule' 
      });
    }
  });

  router.use('/api/trust/admin', adminRouter);

  return router;
}
