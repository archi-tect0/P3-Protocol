import { Router } from 'express';
import gatewayRouter from './services/gateway';
import { getScanResult, getAllResults, getApprovedManifests } from './services/queue';
import { getCurrentRegistry, rebuildRegistry } from './services/registryBuilder';
import { getAuditLog, exportAuditLog } from './services/audit';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'scanner-routes' });
const router = Router();

// Mount gateway routes
router.use('/manifests', gatewayRouter);

// Get scan result by ticket ID
router.get('/scan/:ticketId', async (req, res) => {
  const { ticketId } = req.params;
  const result = getScanResult(ticketId);
  
  if (!result) {
    res.status(404).json({ ok: false, error: 'Scan result not found' });
    return;
  }
  
  res.json({ ok: true, result });
});

// Get all scan results (for moderation panel)
router.get('/scans', async (req, res) => {
  const { status, decision, limit = '50', offset = '0' } = req.query;
  
  let results = getAllResults();
  
  if (status) {
    // Filter by status if needed
  }
  
  if (decision) {
    results = results.filter(r => r.decision.decision === decision);
  }
  
  const limitNum = parseInt(limit as string, 10);
  const offsetNum = parseInt(offset as string, 10);
  const paginated = results.slice(offsetNum, offsetNum + limitNum);
  
  res.json({
    ok: true,
    results: paginated,
    total: results.length,
    limit: limitNum,
    offset: offsetNum,
  });
});

// Get approved registry
router.get('/registry', async (req, res) => {
  const registry = getCurrentRegistry();
  
  if (!registry) {
    // Build if not exists
    const built = await rebuildRegistry();
    res.json({ ok: true, registry: built });
    return;
  }
  
  res.json({ ok: true, registry });
});

// Rebuild registry (admin only)
router.post('/registry/rebuild', async (req, res) => {
  try {
    const registry = await rebuildRegistry();
    logger.info('Registry manually rebuilt');
    res.json({ ok: true, registry });
  } catch (error) {
    logger.error('Registry rebuild failed', error as Error);
    res.status(500).json({ ok: false, error: 'Failed to rebuild registry' });
  }
});

// Get approved manifests list
router.get('/approved', async (req, res) => {
  const manifests = getApprovedManifests();
  res.json({
    ok: true,
    manifests: manifests.map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      category: m.category,
      permissions: m.permissions,
    })),
    count: manifests.length,
  });
});

// Get audit log
router.get('/audit', async (req, res) => {
  const { manifestId, action, actor, format = 'json' } = req.query;
  
  if (format === 'csv') {
    const csv = exportAuditLog('csv');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="scanner-audit.csv"');
    res.send(csv);
    return;
  }
  
  const entries = getAuditLog({
    manifestId: manifestId as string,
    action: action as any,
    actor: actor as string,
  });
  
  res.json({ ok: true, entries, count: entries.length });
});

// Scanner health check
router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'manifest-scanner',
    version: '1.0.0',
    components: {
      gateway: 'operational',
      analyzer: 'operational',
      scoring: 'operational',
      sandbox: 'operational',
      governance: 'operational',
      audit: 'operational',
    },
  });
});

// Scanner metrics
router.get('/metrics', (req, res) => {
  const results = getAllResults();
  const approved = getApprovedManifests();
  
  const decisionCounts = results.reduce((acc, r) => {
    acc[r.decision.decision] = (acc[r.decision.decision] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const riskLevelCounts = results.reduce((acc, r) => {
    acc[r.risk.level] = (acc[r.risk.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  res.json({
    ok: true,
    metrics: {
      totalScans: results.length,
      approvedApps: approved.length,
      decisionBreakdown: decisionCounts,
      riskLevelBreakdown: riskLevelCounts,
      autoApprovalRate: results.filter(r => r.decision.autoApproved).length / Math.max(1, results.length),
    },
  });
});

export default router;
