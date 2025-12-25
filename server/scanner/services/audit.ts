import { createHash, randomBytes } from 'crypto';
import type { ScanResult } from './queue';
import type { DecisionResult } from './governance';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-audit' });

export interface AuditEntry {
  id: string;
  ticketId: string;
  manifestId: string;
  manifestVersion: string;
  action: 'submit' | 'scan_complete' | 'decision' | 'override' | 'publish' | 'unpublish';
  actor: string;
  timestamp: number;
  digest: string;
  details: Record<string, any>;
  chainAnchored: boolean;
  anchorTxHash?: string;
}

const auditLog: AuditEntry[] = [];

export function createAuditEntry(
  ticketId: string,
  manifestId: string,
  manifestVersion: string,
  action: AuditEntry['action'],
  actor: string,
  details: Record<string, any>
): AuditEntry {
  const entry: AuditEntry = {
    id: `audit-${Date.now()}-${randomBytes(4).toString('hex')}`,
    ticketId,
    manifestId,
    manifestVersion,
    action,
    actor,
    timestamp: Date.now(),
    digest: computeAuditDigest(ticketId, action, actor, details),
    details,
    chainAnchored: false,
  };

  auditLog.push(entry);
  
  logger.info('Audit entry created', {
    id: entry.id,
    action,
    manifestId,
    actor,
  });

  return entry;
}

function computeAuditDigest(
  ticketId: string,
  action: string,
  actor: string,
  details: Record<string, any>
): string {
  const payload = JSON.stringify({
    ticketId,
    action,
    actor,
    details,
    timestamp: Date.now(),
  });
  return `sha256:${createHash('sha256').update(payload).digest('hex')}`;
}

export function recordScanComplete(scanResult: ScanResult, submitterWallet: string): AuditEntry {
  return createAuditEntry(
    scanResult.ticketId,
    scanResult.manifestId,
    scanResult.version,
    'scan_complete',
    'system',
    {
      riskScore: scanResult.risk.score,
      riskLevel: scanResult.risk.level,
      issueCount: scanResult.analysis.issues.length,
      flagCount: scanResult.heuristics.flags.length,
      decision: scanResult.decision.decision,
      autoApproved: scanResult.decision.autoApproved,
    }
  );
}

export function recordDecision(
  ticketId: string,
  manifestId: string,
  version: string,
  decision: DecisionResult,
  actorWallet: string
): AuditEntry {
  return createAuditEntry(
    ticketId,
    manifestId,
    version,
    'decision',
    actorWallet,
    {
      decision: decision.decision,
      reason: decision.reason,
      requiresHumanReview: decision.requiresHumanReview,
      autoApproved: decision.autoApproved,
    }
  );
}

export function recordOverride(
  ticketId: string,
  manifestId: string,
  version: string,
  moderatorWallet: string,
  newDecision: string,
  notes: string
): AuditEntry {
  return createAuditEntry(
    ticketId,
    manifestId,
    version,
    'override',
    moderatorWallet,
    {
      newDecision,
      notes,
      overrideReason: 'moderator_override',
    }
  );
}

export function recordPublish(
  manifestId: string,
  version: string,
  publisherWallet: string
): AuditEntry {
  return createAuditEntry(
    `publish-${Date.now()}`,
    manifestId,
    version,
    'publish',
    publisherWallet,
    {
      status: 'live',
    }
  );
}

export function recordUnpublish(
  manifestId: string,
  version: string,
  actorWallet: string,
  reason: string
): AuditEntry {
  return createAuditEntry(
    `unpublish-${Date.now()}`,
    manifestId,
    version,
    'unpublish',
    actorWallet,
    {
      status: 'removed',
      reason,
    }
  );
}

export function getAuditLog(filters?: {
  manifestId?: string;
  action?: AuditEntry['action'];
  actor?: string;
  startTime?: number;
  endTime?: number;
}): AuditEntry[] {
  let entries = [...auditLog];

  if (filters) {
    if (filters.manifestId) {
      entries = entries.filter(e => e.manifestId === filters.manifestId);
    }
    if (filters.action) {
      entries = entries.filter(e => e.action === filters.action);
    }
    if (filters.actor) {
      entries = entries.filter(e => e.actor.toLowerCase() === filters.actor!.toLowerCase());
    }
    if (filters.startTime) {
      entries = entries.filter(e => e.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      entries = entries.filter(e => e.timestamp <= filters.endTime!);
    }
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

export function getAuditEntry(id: string): AuditEntry | undefined {
  return auditLog.find(e => e.id === id);
}

export async function anchorAuditEntry(entryId: string, txHash: string): Promise<void> {
  const entry = auditLog.find(e => e.id === entryId);
  if (entry) {
    entry.chainAnchored = true;
    entry.anchorTxHash = txHash;
    logger.info('Audit entry anchored on-chain', { entryId, txHash });
  }
}

export function exportAuditLog(format: 'json' | 'csv' = 'json'): string {
  if (format === 'csv') {
    const headers = ['id', 'ticketId', 'manifestId', 'version', 'action', 'actor', 'timestamp', 'digest', 'chainAnchored'];
    const rows = auditLog.map(e => [
      e.id,
      e.ticketId,
      e.manifestId,
      e.manifestVersion,
      e.action,
      e.actor,
      new Date(e.timestamp).toISOString(),
      e.digest,
      e.chainAnchored ? 'true' : 'false',
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
  return JSON.stringify(auditLog, null, 2);
}
