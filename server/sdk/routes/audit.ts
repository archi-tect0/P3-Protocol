import { Router } from 'express';
import { createError } from '../middleware/errors';
import { requireRole } from '../middleware/auth';
import { enqueueAnchors } from '../../anchor/queue';

const router = Router();

// In-memory audit log (in production, use database)
const auditLogs: Array<{
  id: string;
  action: string;
  actor: string;
  target?: string;
  data: Record<string, unknown>;
  timestamp: number;
  ip?: string;
}> = [];

router.post('/export', requireRole('admin', 'auditor'), async (req, res, next) => {
  try {
    const { range, format = 'json', appId, eventTypes } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!range) {
      throw createError('range required (e.g., "7d", "30d", "custom")', 400, 'invalid_request');
    }

    // Parse range
    let since = 0;
    const now = Date.now();
    if (range === '7d') {
      since = now - 7 * 24 * 60 * 60 * 1000;
    } else if (range === '30d') {
      since = now - 30 * 24 * 60 * 60 * 1000;
    } else if (range === '90d') {
      since = now - 90 * 24 * 60 * 60 * 1000;
    }

    // Filter logs
    let filteredLogs = auditLogs.filter(log => log.timestamp >= since);

    if (eventTypes && Array.isArray(eventTypes)) {
      filteredLogs = filteredLogs.filter(log => eventTypes.includes(log.action));
    }

    // Generate export URL (in production, upload to S3/GCS and return presigned URL)
    const exportId = `export-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const url = `/api/exports/${exportId}.${format}`;
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    res.json({ url, expiresAt, recordCount: filteredLogs.length });
  } catch (err) {
    next(err);
  }
});

router.post('/logs', requireRole('admin', 'auditor'), async (req, res, next) => {
  try {
    const { limit = 100, offset = 0, action, actor, since, until } = req.body;

    let filteredLogs = [...auditLogs];

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    if (actor) {
      filteredLogs = filteredLogs.filter(log => log.actor === actor);
    }

    if (since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= since);
    }

    if (until) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= until);
    }

    // Sort by timestamp descending
    filteredLogs.sort((a, b) => b.timestamp - a.timestamp);

    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);

    res.json({ logs: paginatedLogs, total });
  } catch (err) {
    next(err);
  }
});

router.post('/log', async (req, res, next) => {
  try {
    const { action, data, anchor = false } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!action) {
      throw createError('action required', 400, 'invalid_request');
    }

    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const logEntry = {
      id: logId,
      action,
      actor: wallet,
      data: data || {},
      timestamp: Date.now(),
      ip: req.ip,
    };

    auditLogs.push(logEntry);

    // Keep only last 10000 logs in memory
    if (auditLogs.length > 10000) {
      auditLogs.splice(0, auditLogs.length - 10000);
    }

    if (anchor) {
      await enqueueAnchors([{
        appId: 'audit',
        event: action,
        data: { logId, ...data, wallet },
        ts: Date.now(),
      }]);
    }

    res.json({ ok: true, logId });
  } catch (err) {
    next(err);
  }
});

export default router;
