import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from './storage';
import { authenticateJWT, requireRole, type AuthenticatedRequest } from './auth';
import { ENSResolverService } from './services/ens-resolver';
import { WebhookService } from './services/webhook-service';
import { ExportService, type ExportFormat } from './services/export-service';

/**
 * Validation schemas for service routes
 */

// ENS resolution schemas
const resolveAddressSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
});

const resolveBatchSchema = z.object({
  addresses: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')).min(1).max(50),
});

// Webhook schemas
const testWebhookSchema = z.object({
  url: z.string().url(),
  encrypted: z.boolean().optional().default(false),
  encryptedConfig: z.object({
    encryptedUrl: z.string(),
    iv: z.string(),
    tag: z.string(),
  }).optional(),
});

const encryptWebhookUrlSchema = z.object({
  url: z.string().url(),
});

const verifyWebhookSignatureSchema = z.object({
  payload: z.object({
    eventType: z.enum(['message_received', 'call_started', 'payment_received']),
    timestamp: z.number(),
    data: z.record(z.any()),
  }),
  signature: z.string(),
  expectedAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

// Export schemas
const exportAuditSchema = z.object({
  format: z.enum(['pdf', 'csv']),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  compress: z.boolean().optional().default(false),
});

/**
 * Helper function to validate and parse request body
 */
function validateBody<T>(schema: z.ZodSchema<T>, body: any): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Create service routes with injected storage
 */
export function createServicesRoutes(storage: IStorage): Router {
  const router = Router();

  // Initialize services
  const ensResolver = new ENSResolverService();
  const webhookService = new WebhookService(process.env.WEBHOOK_ENCRYPTION_KEY);
  const exportService = new ExportService(storage);

  // ============================================================================
  // ENS/Basename Resolution Routes
  // ============================================================================

  /**
   * GET /api/services/resolve/:address
   * Resolve a single Ethereum address to ENS name and Basename
   */
  router.get('/api/services/resolve/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        res.status(400).json({ error: 'Invalid Ethereum address format' });
        return;
      }

      const result = await ensResolver.resolve(address);

      res.json(result);
    } catch (error) {
      console.error('ENS resolution error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to resolve address' 
      });
    }
  });

  /**
   * POST /api/services/resolve/batch
   * Resolve multiple Ethereum addresses to ENS names and Basenames
   */
  router.post('/api/services/resolve/batch', async (req: Request, res: Response) => {
    try {
      const data = validateBody(resolveBatchSchema, req.body);

      const results = await ensResolver.resolveBatch(data.addresses);

      res.json({
        count: results.length,
        results,
      });
    } catch (error) {
      console.error('Batch ENS resolution error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to resolve addresses' 
      });
    }
  });

  /**
   * GET /api/services/resolve/cache/stats
   * Get ENS resolver cache statistics
   */
  router.get('/api/services/resolve/cache/stats', async (req: Request, res: Response) => {
    try {
      const stats = ensResolver.getCacheStats();
      res.json(stats);
    } catch (error) {
      console.error('Cache stats error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get cache stats' 
      });
    }
  });

  /**
   * DELETE /api/services/resolve/cache
   * Clear ENS resolver cache (admin only)
   */
  router.delete('/api/services/resolve/cache', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      ensResolver.clearCache();
      res.json({ success: true, message: 'Cache cleared successfully' });
    } catch (error) {
      console.error('Cache clear error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to clear cache' 
      });
    }
  });

  // ============================================================================
  // Webhook Routes
  // ============================================================================

  /**
   * POST /api/services/webhook/test
   * Test webhook delivery
   */
  router.post('/api/services/webhook/test', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = validateBody(testWebhookSchema, req.body);

      let url: string | any = data.url;

      // Use encrypted config if provided
      if (data.encrypted && data.encryptedConfig) {
        url = data.encryptedConfig;
      }

      const result = await webhookService.testWebhook(url);

      res.json(result);
    } catch (error) {
      console.error('Webhook test error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to test webhook' 
      });
    }
  });

  /**
   * POST /api/services/webhook/encrypt
   * Encrypt a webhook URL for secure storage
   */
  router.post('/api/services/webhook/encrypt', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = validateBody(encryptWebhookUrlSchema, req.body);

      const encryptedConfig = webhookService.encryptWebhookUrl(data.url);

      res.json(encryptedConfig);
    } catch (error) {
      console.error('Webhook encryption error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to encrypt webhook URL' 
      });
    }
  });

  /**
   * POST /api/services/webhook/verify
   * Verify webhook signature (for receiver side)
   */
  router.post('/api/services/webhook/verify', async (req: Request, res: Response) => {
    try {
      const data = validateBody(verifyWebhookSignatureSchema, req.body);

      const isValid = await webhookService.verifySignature(
        data.payload,
        data.signature,
        data.expectedAddress
      );

      res.json({ valid: isValid });
    } catch (error) {
      console.error('Webhook signature verification error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to verify signature' 
      });
    }
  });

  // ============================================================================
  // Audit Export Routes
  // ============================================================================

  /**
   * GET /api/exports/:format
   * Generate audit export in specified format (PDF or CSV)
   * Admin only - role-based export permissions
   */
  router.get('/api/exports/:format', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const format = req.params.format as ExportFormat;

      if (!['pdf', 'csv'].includes(format)) {
        res.status(400).json({ error: 'Invalid format. Must be "pdf" or "csv"' });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Parse query parameters
      const options = {
        format,
        entityType: req.query.entityType as string | undefined,
        entityId: req.query.entityId as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        compress: req.query.compress === 'true',
      };

      const result = await exportService.generateExport(options, req.user.userId);

      // Set appropriate headers
      const contentType = result.compressed 
        ? 'application/gzip'
        : (format === 'pdf' ? 'application/pdf' : 'text/csv');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Export-Hash', result.hash);
      res.setHeader('X-Export-Timestamp', result.generatedAt.toString());

      res.send(result.data);
    } catch (error) {
      console.error('Export generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to generate export' 
      });
    }
  });

  /**
   * POST /api/exports/generate
   * Generate audit export with detailed options (POST for complex filters)
   * Admin only
   */
  router.post('/api/exports/generate', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = validateBody(exportAuditSchema, req.body);

      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const options = {
        format: data.format,
        entityType: data.entityType,
        entityId: data.entityId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        compress: data.compress,
      };

      const result = await exportService.generateExport(options, req.user.userId);

      // Return metadata instead of binary data
      res.json({
        filename: result.filename,
        hash: result.hash,
        format: result.format,
        compressed: result.compressed,
        generatedAt: result.generatedAt,
        generatedBy: result.generatedBy,
        size: result.data.length,
        downloadUrl: `/api/exports/download/${result.hash}`,
      });
    } catch (error) {
      console.error('Export generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to generate export' 
      });
    }
  });

  /**
   * GET /api/exports/verify/:hash
   * Verify export hash integrity
   */
  router.get('/api/exports/verify/:hash', authenticateJWT, requireRole('admin'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { hash } = req.params;

      // Export verification requires persistent storage of generated exports
      // Current implementation validates hash format only
      res.json({
        hash,
        valid: /^[a-f0-9]{64}$/.test(hash),
        message: 'Export storage integration required for full verification',
      });
    } catch (error) {
      console.error('Export verification error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to verify export' 
      });
    }
  });

  return router;
}
