import { sdkReq } from './core';

export type ExportOptions = {
  range: string;
  format?: 'json' | 'csv';
  appId?: string;
  eventTypes?: string[];
};

export type ExportResult = {
  url: string;
  expiresAt: number;
  recordCount: number;
};

export type AuditLog = {
  id: string;
  action: string;
  actor: string;
  target?: string;
  data: Record<string, unknown>;
  timestamp: number;
  ip?: string;
};

export async function exportReport(opts: ExportOptions): Promise<ExportResult> {
  return sdkReq<ExportResult>('/api/sdk/audit/export', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function getLogs(opts?: {
  limit?: number;
  offset?: number;
  action?: string;
  actor?: string;
  since?: number;
  until?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  return sdkReq<{ logs: AuditLog[]; total: number }>('/api/sdk/audit/logs', {
    method: 'POST',
    body: JSON.stringify(opts || {}),
  });
}

export async function logAction(
  action: string,
  data: Record<string, unknown>,
  opts?: { anchor?: boolean }
): Promise<{ ok: boolean; logId: string }> {
  return sdkReq<{ ok: boolean; logId: string }>('/api/sdk/audit/log', {
    method: 'POST',
    body: JSON.stringify({ action, data, anchor: opts?.anchor }),
  });
}
