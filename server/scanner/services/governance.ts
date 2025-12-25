import type { RiskScore } from './scoring';
import type { HeuristicFlag } from './heuristics';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-governance' });

export type Decision = 'approve' | 'reject' | 'suspend' | 'quarantine' | 'manual_review';

export interface DecisionResult {
  decision: Decision;
  reason: string;
  requiresHumanReview: boolean;
  autoApproved: boolean;
}

export interface GovernancePolicy {
  autoApproveMaxRisk: number;
  mandatoryReviewScopes: string[];
  blockOnFlags: HeuristicFlag[];
  suspendOnFlags: HeuristicFlag[];
  quarantineOnIssues: boolean;
}

const DEFAULT_POLICY: GovernancePolicy = {
  autoApproveMaxRisk: 2.5,
  mandatoryReviewScopes: ['payments', 'dao', 'anchors'],
  blockOnFlags: ['scope_mismatch', 'invalid_entry'],
  suspendOnFlags: ['endpoint_sprawl', 'unsigned_manifest', 'suspicious_name'],
  quarantineOnIssues: true,
};

export function makeDecision(
  riskScore: RiskScore,
  flags: HeuristicFlag[],
  issues: string[],
  scopes: string[],
  policy: GovernancePolicy = DEFAULT_POLICY
): DecisionResult {
  // Check for blocking issues first
  if (policy.quarantineOnIssues && issues.length > 0) {
    logger.info('Quarantining manifest due to issues', { issueCount: issues.length });
    return {
      decision: 'quarantine',
      reason: `Manifest has ${issues.length} validation issues`,
      requiresHumanReview: true,
      autoApproved: false,
    };
  }
  
  // Check for blocking flags
  const hasBlockingFlag = flags.some(f => policy.blockOnFlags.includes(f));
  if (hasBlockingFlag) {
    const blockingFlags = flags.filter(f => policy.blockOnFlags.includes(f));
    logger.info('Rejecting manifest due to blocking flags', { flags: blockingFlags });
    return {
      decision: 'reject',
      reason: `Contains blocking flags: ${blockingFlags.join(', ')}`,
      requiresHumanReview: false,
      autoApproved: false,
    };
  }
  
  // Check for suspend flags
  const hasSuspendFlag = flags.some(f => policy.suspendOnFlags.includes(f));
  if (hasSuspendFlag && riskScore.level !== 'low') {
    const suspendFlags = flags.filter(f => policy.suspendOnFlags.includes(f));
    logger.info('Suspending manifest for review', { flags: suspendFlags, riskLevel: riskScore.level });
    return {
      decision: 'suspend',
      reason: `Flagged for review: ${suspendFlags.join(', ')}`,
      requiresHumanReview: true,
      autoApproved: false,
    };
  }
  
  // Check for mandatory review scopes
  const hasMandatoryReviewScope = scopes.some(s => policy.mandatoryReviewScopes.includes(s));
  if (hasMandatoryReviewScope) {
    const reviewScopes = scopes.filter(s => policy.mandatoryReviewScopes.includes(s));
    logger.info('Manifest requires manual review due to sensitive scopes', { scopes: reviewScopes });
    return {
      decision: 'manual_review',
      reason: `Uses sensitive scopes requiring review: ${reviewScopes.join(', ')}`,
      requiresHumanReview: true,
      autoApproved: false,
    };
  }
  
  // Check risk level
  if (riskScore.level === 'critical') {
    return {
      decision: 'quarantine',
      reason: `Critical risk score: ${riskScore.score}`,
      requiresHumanReview: true,
      autoApproved: false,
    };
  }
  
  if (riskScore.level === 'high') {
    return {
      decision: 'suspend',
      reason: `High risk score: ${riskScore.score}`,
      requiresHumanReview: true,
      autoApproved: false,
    };
  }
  
  // Check for auto-approval threshold
  if (riskScore.score <= policy.autoApproveMaxRisk && flags.length === 0) {
    logger.info('Auto-approving manifest', { risk: riskScore.score });
    return {
      decision: 'approve',
      reason: 'Passed all automated checks',
      requiresHumanReview: false,
      autoApproved: true,
    };
  }
  
  // Default to manual review for medium risk
  return {
    decision: 'manual_review',
    reason: `Medium risk score (${riskScore.score}) with ${flags.length} flags`,
    requiresHumanReview: true,
    autoApproved: false,
  };
}

export function overrideDecision(
  ticketId: string,
  moderatorWallet: string,
  newDecision: Decision,
  notes: string
): void {
  logger.info('Moderator override decision', {
    ticketId,
    moderator: moderatorWallet,
    decision: newDecision,
    notes,
  });
  
  // In production, this would:
  // 1. Verify moderator has required role
  // 2. Update decision in database
  // 3. Trigger registry rebuild if approved
  // 4. Create audit trail entry
}
