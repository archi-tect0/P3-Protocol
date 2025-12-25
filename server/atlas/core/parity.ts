import { manifestRegistry, type CanvasDisplay, type Visibility } from './registry';

export interface ParityReport {
  ok: boolean;
  totalManifests: number;
  missingCanvasMetadata: ParityIssue[];
  missingEvents: ParityIssue[];
  gatingMismatches: ParityIssue[];
  summary: string;
}

export interface ParityIssue {
  key: string;
  issue: string;
  severity: 'error' | 'warning';
}

export async function runCanvasParity(): Promise<ParityReport> {
  const listed = manifestRegistry.listAll();
  
  const missingCanvasMetadata: ParityIssue[] = [];
  const missingEvents: ParityIssue[] = [];
  const gatingMismatches: ParityIssue[] = [];

  for (const m of listed) {
    const key = m['devkit.key'];
    const display = m['canvas.display'];
    const visibility = m['security.visibility'];

    if (!display) {
      missingCanvasMetadata.push({ key, issue: 'No canvas.display defined', severity: 'error' });
      continue;
    }

    if (!display.type) {
      missingCanvasMetadata.push({ key, issue: 'canvas.display.type is required', severity: 'error' });
    }

    if (!display.title) {
      missingCanvasMetadata.push({ key, issue: 'canvas.display.title is required', severity: 'error' });
    }

    if (display.type === 'card' && (!display.fields || display.fields.length === 0)) {
      missingCanvasMetadata.push({ key, issue: 'Card requires at least one field', severity: 'warning' });
    }

    if (display.type === 'pipeline' && (!display.steps || display.steps.length === 0)) {
      missingCanvasMetadata.push({ key, issue: 'Pipeline requires steps to render', severity: 'warning' });
    }

    if (display.type === 'table' && (!display.fields || display.fields.length === 0)) {
      missingCanvasMetadata.push({ key, issue: 'Table requires fields to render', severity: 'warning' });
    }

    if (!visibility) {
      gatingMismatches.push({ key, issue: 'Missing security.visibility', severity: 'error' });
    }

    if (!manifestRegistry.hasEventPublisher(key)) {
      missingEvents.push({ key, issue: 'Not wrapped with EventPublisher - lifecycle events will not emit', severity: 'warning' });
    }
  }

  const errorCount = [...missingCanvasMetadata, ...missingEvents, ...gatingMismatches].filter(i => i.severity === 'error').length;
  const warningCount = [...missingCanvasMetadata, ...missingEvents, ...gatingMismatches].filter(i => i.severity === 'warning').length;

  const ok = errorCount === 0;

  const summary = ok
    ? `All ${listed.length} manifests are Canvas-ready${warningCount > 0 ? ` (${warningCount} warnings)` : ''}`
    : `${errorCount} errors, ${warningCount} warnings across ${listed.length} manifests`;

  return {
    ok,
    totalManifests: listed.length,
    missingCanvasMetadata,
    missingEvents,
    gatingMismatches,
    summary,
  };
}

export function validateManifestForCanvas(m: { 'devkit.key': string; 'canvas.display'?: Partial<CanvasDisplay> }): { valid: boolean; issues: ParityIssue[] } {
  const issues: ParityIssue[] = [];
  const key = m['devkit.key'];

  if (!m['canvas.display']) {
    issues.push({ key, issue: 'canvas.display is required', severity: 'error' });
    return { valid: false, issues };
  }

  const display = m['canvas.display'];

  if (!display.type) {
    issues.push({ key, issue: 'canvas.display.type is required (card|pipeline|table)', severity: 'error' });
  }

  if (!display.title) {
    issues.push({ key, issue: 'canvas.display.title is required', severity: 'error' });
  }

  if (display.type === 'card' && (!display.fields || display.fields.length === 0)) {
    issues.push({ key, issue: 'Card type requires at least one field', severity: 'warning' });
  }

  if (display.type === 'pipeline' && (!display.steps || display.steps.length === 0)) {
    issues.push({ key, issue: 'Pipeline type requires steps', severity: 'warning' });
  }

  if (display.fields) {
    for (let i = 0; i < display.fields.length; i++) {
      const f = display.fields[i];
      if (!f.key) issues.push({ key, issue: `Field ${i} missing key`, severity: 'error' });
      if (!f.label) issues.push({ key, issue: `Field ${i} missing label`, severity: 'warning' });
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  return { valid: !hasErrors, issues };
}

export function getParityStats(): {
  total: number;
  endpoints: number;
  flows: number;
  bySource: Record<string, number>;
  byVisibility: Record<string, number>;
  byDisplayType: Record<string, number>;
  canvasReady: number;
  hasLifecycle: number;
} {
  const endpoints = manifestRegistry.listEndpoints();
  const flows = manifestRegistry.listFlows();
  
  const bySource: Record<string, number> = {};
  const byVisibility: Record<string, number> = {};
  const byDisplayType: Record<string, number> = {};
  let canvasReady = 0;
  let hasLifecycle = 0;

  const all = [...endpoints, ...flows];

  for (const m of all) {
    const source = m.source || 'atlas';
    bySource[source] = (bySource[source] || 0) + 1;
    
    byVisibility[m['security.visibility']] = (byVisibility[m['security.visibility']] || 0) + 1;
    
    const displayType = m['canvas.display']?.type || 'none';
    byDisplayType[displayType] = (byDisplayType[displayType] || 0) + 1;

    if (m['canvas.display']?.type && m['canvas.display']?.title) {
      canvasReady++;
    }

    if (manifestRegistry.hasEventPublisher(m['devkit.key'])) {
      hasLifecycle++;
    }
  }

  return {
    total: endpoints.length + flows.length,
    endpoints: endpoints.length,
    flows: flows.length,
    bySource,
    byVisibility,
    byDisplayType,
    canvasReady,
    hasLifecycle,
  };
}
