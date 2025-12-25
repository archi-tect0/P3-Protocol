import type { ManifestSubmission } from './gateway';
import type { StaticAnalysisResult } from './analyzer';

export interface FactorWeights {
  scopeSensitivity: number;
  argSurfaceArea: number;
  endpointVolume: number;
  versionChurn: number;
  signatureTrust: number;
  spoofRisk: number;
}

export interface RiskScore {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: Record<string, number>;
}

const DEFAULT_WEIGHTS: FactorWeights = {
  scopeSensitivity: 10,
  argSurfaceArea: 6,
  endpointVolume: 5,
  versionChurn: 4,
  signatureTrust: 3,
  spoofRisk: 7,
};

const SENSITIVE_SCOPES = ['payments', 'dao', 'anchors', 'wallet'];
const SPOOF_PATTERNS = [
  /n[e3]xus/i,
  /p[3e]3/i,
  /hub[z0]/i,
  /pr0t0col/i,
  /wa[l1]let/i,
];

const LEGITIMATE_IDS = ['app.nexus', 'app.hub', 'app.p3', 'app.protocol', 'app.wallet'];

export function scoreManifest(
  manifest: ManifestSubmission,
  analysis: StaticAnalysisResult,
  weights: FactorWeights = DEFAULT_WEIGHTS
): RiskScore {
  const factors: Record<string, number> = {};
  
  // Collect all scopes from endpoints
  const allScopes: string[] = [];
  if (manifest.endpoints) {
    for (const ep of Object.values(manifest.endpoints)) {
      allScopes.push(...(ep.scopes || []));
    }
  }
  
  // Factor 1: Scope sensitivity
  const sensitiveCount = allScopes.filter(s => SENSITIVE_SCOPES.includes(s)).length;
  const totalScopes = allScopes.length || 1;
  factors.scopeSensitivity = Math.min(10, (sensitiveCount / totalScopes) * weights.scopeSensitivity);
  
  // Factor 2: Argument surface area
  const endpoints = Object.values(manifest.endpoints || {});
  const totalArgs = endpoints.reduce((sum, ep) => sum + Object.keys(ep.args || {}).length, 0);
  const avgArgs = totalArgs / Math.max(1, endpoints.length);
  factors.argSurfaceArea = Math.min(10, (avgArgs / 10) * weights.argSurfaceArea);
  
  // Factor 3: Endpoint volume
  const endpointCount = endpoints.length;
  factors.endpointVolume = Math.min(10, (endpointCount / 100) * weights.endpointVolume);
  
  // Factor 4: Version churn (simplified - would use history in production)
  const [major, minor, patch] = manifest.version.split('.').map(Number);
  const isNewVersion = major === 0 || patch > 10;
  factors.versionChurn = isNewVersion ? weights.versionChurn / 2 : 0;
  
  // Factor 5: Signature trust
  factors.signatureTrust = analysis.provenance.trustedPublisher ? 0 : 
                            manifest.signature ? weights.signatureTrust / 2 : weights.signatureTrust;
  
  // Factor 6: Spoof risk
  const isSpoofPattern = SPOOF_PATTERNS.some(p => p.test(manifest.id) || p.test(manifest.name));
  const isLegitimate = LEGITIMATE_IDS.includes(manifest.id);
  factors.spoofRisk = (isSpoofPattern && !isLegitimate) ? weights.spoofRisk : 0;
  
  // Calculate total score
  const rawScore = Object.values(factors).reduce((sum, f) => sum + f, 0);
  const normalizedScore = Math.min(10, rawScore / 4); // Normalize to 0-10 range
  
  // Determine risk level
  let level: RiskScore['level'];
  if (normalizedScore >= 8) level = 'critical';
  else if (normalizedScore >= 6) level = 'high';
  else if (normalizedScore >= 3) level = 'medium';
  else level = 'low';
  
  return {
    score: Number(normalizedScore.toFixed(2)),
    level,
    factors,
  };
}

export function updateWeights(newWeights: Partial<FactorWeights>): FactorWeights {
  return { ...DEFAULT_WEIGHTS, ...newWeights };
}
