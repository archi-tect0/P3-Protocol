import { createHash } from 'crypto';
import { verifyMessage } from 'ethers';
import type { ManifestSubmission } from './gateway';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-analyzer' });

export interface StaticAnalysisResult {
  digest: string;
  provenance: ProvenanceInfo;
  issues: string[];
  valid: boolean;
}

export interface ProvenanceInfo {
  trustedPublisher: boolean;
  knownSigner: boolean;
  history: { version: string; ts: number }[];
}

const ALLOWED_SCOPES = new Set([
  'wallet',
  'messages',
  'payments',
  'dao',
  'storage',
  'anchors',
  'camera',
  'microphone',
  'contacts',
  'notifications',
  'media',
]);

const TRUSTED_PUBLISHERS = new Set([
  '0x0000000000000000000000000000000000000000', // Placeholder for P3 official
]);

export function computeManifestDigest(manifest: ManifestSubmission): string {
  const normalized = JSON.stringify({
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    entry: manifest.entry,
    permissions: manifest.permissions?.sort(),
    endpoints: manifest.endpoints ? Object.keys(manifest.endpoints).sort() : [],
    routes: manifest.routes ? Object.keys(manifest.routes).sort() : [],
  });
  return `sha256:${createHash('sha256').update(normalized).digest('hex')}`;
}

export async function verifyManifestSignature(manifest: ManifestSubmission): Promise<boolean> {
  if (!manifest.signature || !manifest.signer) {
    return false;
  }

  try {
    const message = JSON.stringify({
      id: manifest.id,
      version: manifest.version,
      entry: manifest.entry,
    });
    
    const recoveredAddress = verifyMessage(message, manifest.signature);
    return recoveredAddress.toLowerCase() === manifest.signer.toLowerCase();
  } catch (error) {
    logger.warn('Signature verification failed', { manifestId: manifest.id, error });
    return false;
  }
}

export async function checkProvenance(signer?: string): Promise<ProvenanceInfo> {
  const trustedPublisher = signer ? TRUSTED_PUBLISHERS.has(signer.toLowerCase()) : false;
  
  return {
    trustedPublisher,
    knownSigner: !!signer,
    history: [], // Would be populated from database in production
  };
}

export async function staticAnalyze(manifest: ManifestSubmission): Promise<StaticAnalysisResult> {
  const issues: string[] = [];
  
  // Compute digest
  const digest = computeManifestDigest(manifest);
  
  // Verify signature if present
  if (manifest.signature) {
    const signatureValid = await verifyManifestSignature(manifest);
    if (!signatureValid) {
      issues.push('Invalid manifest signature');
    }
  } else {
    issues.push('Manifest is unsigned');
  }
  
  // Check provenance
  const provenance = await checkProvenance(manifest.signer);
  
  // Validate app ID format
  if (!manifest.id.startsWith('app.')) {
    issues.push('Invalid app id prefix - must start with "app."');
  }
  
  // Check for reserved IDs
  const reservedIds = ['app.nexus', 'app.hub', 'app.p3', 'app.protocol'];
  if (reservedIds.includes(manifest.id) && !provenance.trustedPublisher) {
    issues.push(`Reserved app ID "${manifest.id}" - only trusted publishers can use this`);
  }
  
  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    issues.push('Version must be semver format (X.Y.Z)');
  }
  
  // Collect and validate all scopes
  const allScopes: string[] = [];
  if (manifest.endpoints) {
    for (const [epKey, ep] of Object.entries(manifest.endpoints)) {
      const epScopes = ep.scopes || [];
      allScopes.push(...epScopes);
      
      // Check for unknown scopes
      const unknownScopes = epScopes.filter(s => !ALLOWED_SCOPES.has(s));
      if (unknownScopes.length > 0) {
        issues.push(`Endpoint "${epKey}" uses unknown scopes: ${unknownScopes.join(', ')}`);
      }
    }
  }
  
  // Check permission declarations match scope usage
  const declaredPermissions = new Set(manifest.permissions || []);
  const usedScopes = new Set(allScopes);
  
  for (const scope of usedScopes) {
    if (!declaredPermissions.has(scope) && ALLOWED_SCOPES.has(scope)) {
      issues.push(`Scope "${scope}" used in endpoints but not declared in permissions`);
    }
  }
  
  // Check for sensitive scopes
  const sensitiveScopes = ['payments', 'dao', 'anchors'];
  const hasSensitiveScopes = sensitiveScopes.some(s => usedScopes.has(s));
  if (hasSensitiveScopes && !manifest.signature) {
    issues.push('Manifests using sensitive scopes (payments, dao, anchors) must be signed');
  }
  
  // Validate endpoint definitions
  if (manifest.endpoints) {
    const endpointCount = Object.keys(manifest.endpoints).length;
    if (endpointCount > 500) {
      issues.push(`Too many endpoints (${endpointCount}) - maximum is 500`);
    }
    
    for (const [key, ep] of Object.entries(manifest.endpoints)) {
      if (!ep.fn) {
        issues.push(`Endpoint "${key}" missing function name`);
      }
      if (ep.args && Object.keys(ep.args).length > 25) {
        issues.push(`Endpoint "${key}" has too many arguments (max 25)`);
      }
    }
  }
  
  // Check entry URL
  if (manifest.entry && !manifest.entry.startsWith('/') && !manifest.entry.startsWith('http')) {
    issues.push('Entry must be an absolute path or URL');
  }
  
  logger.info('Static analysis complete', {
    manifestId: manifest.id,
    digest,
    issueCount: issues.length,
    provenance: provenance.trustedPublisher,
  });
  
  return {
    digest,
    provenance,
    issues,
    valid: issues.length === 0,
  };
}
