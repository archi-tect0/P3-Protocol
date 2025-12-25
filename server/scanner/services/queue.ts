import type { ManifestSubmission } from './gateway';
import { staticAnalyze } from './analyzer';
import { scoreManifest } from './scoring';
import { analyzeHeuristics } from './heuristics';
import { makeDecision, type DecisionResult } from './governance';
import { updateTicketStatus } from './gateway';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-queue' });

export interface ScanResult {
  ticketId: string;
  manifestId: string;
  version: string;
  digest: string;
  analysis: {
    issues: string[];
    valid: boolean;
  };
  risk: {
    score: number;
    level: string;
    factors: Record<string, number>;
  };
  heuristics: {
    flags: string[];
    warnings: string[];
    recommendations: string[];
  };
  decision: DecisionResult;
  scannedAt: number;
}

const scanResults = new Map<string, ScanResult>();
const pendingScans = new Map<string, { manifest: ManifestSubmission; wallet: string }>();

export async function enqueueManifestScan(
  ticketId: string,
  manifest: ManifestSubmission,
  wallet: string
): Promise<void> {
  pendingScans.set(ticketId, { manifest, wallet });
  
  // Process asynchronously
  setImmediate(() => processManifestScan(ticketId));
}

async function processManifestScan(ticketId: string): Promise<void> {
  const pending = pendingScans.get(ticketId);
  if (!pending) {
    logger.error('Scan ticket not found in pending queue', { ticketId });
    return;
  }
  
  const { manifest, wallet } = pending;
  pendingScans.delete(ticketId);
  
  try {
    updateTicketStatus(ticketId, 'scanning');
    logger.info('Starting manifest scan', { ticketId, manifestId: manifest.id });
    
    // Step 1: Static analysis
    const analysis = await staticAnalyze(manifest);
    
    // Step 2: Risk scoring
    const riskScore = scoreManifest(manifest, analysis);
    
    // Step 3: Heuristics analysis
    const heuristics = analyzeHeuristics(manifest);
    
    // Step 4: Collect all scopes
    const allScopes: string[] = [];
    if (manifest.endpoints) {
      for (const ep of Object.values(manifest.endpoints)) {
        allScopes.push(...(ep.scopes || []));
      }
    }
    
    // Step 5: Make governance decision
    const decision = makeDecision(
      riskScore,
      heuristics.flags,
      analysis.issues,
      allScopes
    );
    
    // Build result
    const result: ScanResult = {
      ticketId,
      manifestId: manifest.id,
      version: manifest.version,
      digest: analysis.digest,
      analysis: {
        issues: analysis.issues,
        valid: analysis.valid,
      },
      risk: {
        score: riskScore.score,
        level: riskScore.level,
        factors: riskScore.factors,
      },
      heuristics: {
        flags: heuristics.flags,
        warnings: heuristics.warnings,
        recommendations: heuristics.recommendations,
      },
      decision,
      scannedAt: Date.now(),
    };
    
    scanResults.set(ticketId, result);
    updateTicketStatus(ticketId, 'complete');
    
    logger.info('Manifest scan complete', {
      ticketId,
      manifestId: manifest.id,
      decision: decision.decision,
      risk: riskScore.score,
      issueCount: analysis.issues.length,
      flagCount: heuristics.flags.length,
    });
    
    // If auto-approved, add to registry
    if (decision.autoApproved) {
      await addToApprovedRegistry(manifest);
    }
    
  } catch (error) {
    logger.error('Manifest scan failed', { ticketId, error });
    updateTicketStatus(ticketId, 'failed');
  }
}

export function getScanResult(ticketId: string): ScanResult | undefined {
  return scanResults.get(ticketId);
}

export function getAllResults(): ScanResult[] {
  return Array.from(scanResults.values());
}

// Approved registry (in production, this would be in database)
const approvedManifests = new Map<string, ManifestSubmission>();

async function addToApprovedRegistry(manifest: ManifestSubmission): Promise<void> {
  approvedManifests.set(manifest.id, manifest);
  logger.info('Manifest added to approved registry', { 
    manifestId: manifest.id, 
    version: manifest.version 
  });
}

export function getApprovedManifests(): ManifestSubmission[] {
  return Array.from(approvedManifests.values());
}

export function removeFromRegistry(manifestId: string): boolean {
  return approvedManifests.delete(manifestId);
}
