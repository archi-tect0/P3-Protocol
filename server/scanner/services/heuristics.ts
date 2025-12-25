import type { ManifestSubmission } from './gateway';

export type HeuristicFlag = 
  | 'endpoint_sprawl'
  | 'oversized_arg_surface'
  | 'scope_mismatch'
  | 'unsigned_manifest'
  | 'suspicious_name'
  | 'excessive_permissions'
  | 'no_description'
  | 'invalid_entry'
  | 'duplicate_endpoints'
  | 'nested_objects_in_args'
  | 'version_zero';

export interface HeuristicResult {
  flags: HeuristicFlag[];
  warnings: string[];
  recommendations: string[];
}

export function analyzeHeuristics(manifest: ManifestSubmission): HeuristicResult {
  const flags: HeuristicFlag[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  const endpoints = Object.entries(manifest.endpoints || {});
  const epCount = endpoints.length;
  
  // Check endpoint sprawl
  if (epCount > 500) {
    flags.push('endpoint_sprawl');
    warnings.push(`Manifest declares ${epCount} endpoints - this is unusually high`);
    recommendations.push('Consider splitting into multiple apps or using sub-manifests');
  }
  
  // Check argument surface area
  const hasOversizedArgs = endpoints.some(([, ep]) => 
    ep.args && Object.keys(ep.args).length > 25
  );
  if (hasOversizedArgs) {
    flags.push('oversized_arg_surface');
    warnings.push('Some endpoints have more than 25 arguments');
    recommendations.push('Reduce argument count by using structured objects');
  }
  
  // Check for nested object arguments (potential for injection)
  const hasNestedObjects = endpoints.some(([, ep]) => 
    ep.args && Object.values(ep.args).some(t => t === 'object' || t === 'any')
  );
  if (hasNestedObjects) {
    flags.push('nested_objects_in_args');
    warnings.push('Endpoints use object/any types which bypass validation');
    recommendations.push('Use strongly typed argument schemas');
  }
  
  // Check scope mismatch
  const declaredPermissions = new Set(manifest.permissions || []);
  const usedScopes = new Set<string>();
  
  for (const [, ep] of endpoints) {
    for (const scope of ep.scopes || []) {
      usedScopes.add(scope);
    }
  }
  
  const undeclaredScopes = [...usedScopes].filter(s => !declaredPermissions.has(s));
  if (undeclaredScopes.length > 0) {
    flags.push('scope_mismatch');
    warnings.push(`Scopes used but not declared: ${undeclaredScopes.join(', ')}`);
    recommendations.push('Add all used scopes to the permissions array');
  }
  
  // Check for unsigned manifest
  if (!manifest.signature) {
    flags.push('unsigned_manifest');
    warnings.push('Manifest is not cryptographically signed');
    recommendations.push('Sign manifest with publisher wallet for trust verification');
  }
  
  // Check for suspicious naming
  const suspiciousPatterns = [
    /official/i,
    /verified/i,
    /authentic/i,
    /real/i,
    /true/i,
    /legit/i,
  ];
  
  if (suspiciousPatterns.some(p => p.test(manifest.name) || p.test(manifest.id))) {
    flags.push('suspicious_name');
    warnings.push('Name or ID contains trust-implying keywords');
    recommendations.push('Remove words like "official", "verified", "authentic" unless authorized');
  }
  
  // Check for excessive permissions
  if (manifest.permissions && manifest.permissions.length > 8) {
    flags.push('excessive_permissions');
    warnings.push(`Requests ${manifest.permissions.length} permissions - users may distrust this`);
    recommendations.push('Request only necessary permissions');
  }
  
  // Check for missing description
  if (!manifest.description) {
    flags.push('no_description');
    warnings.push('No description provided');
    recommendations.push('Add a description to help users understand the app');
  }
  
  // Check for invalid entry
  if (manifest.entry && 
      !manifest.entry.startsWith('/') && 
      !manifest.entry.startsWith('http://') && 
      !manifest.entry.startsWith('https://')) {
    flags.push('invalid_entry');
    warnings.push('Entry point is not a valid URL or path');
    recommendations.push('Use absolute path (/) or full URL (https://)');
  }
  
  // Check for duplicate endpoint function names
  const fnNames = endpoints.map(([, ep]) => ep.fn);
  const duplicates = fnNames.filter((fn, i) => fnNames.indexOf(fn) !== i);
  if (duplicates.length > 0) {
    flags.push('duplicate_endpoints');
    warnings.push(`Duplicate function names: ${[...new Set(duplicates)].join(', ')}`);
    recommendations.push('Use unique function names for each endpoint');
  }
  
  // Check for version 0.x.x
  if (manifest.version.startsWith('0.')) {
    flags.push('version_zero');
    warnings.push('App is in pre-release (0.x.x) - may be unstable');
    recommendations.push('Consider releasing version 1.0.0 when stable');
  }
  
  return { flags, warnings, recommendations };
}

export function hasBlockingFlags(flags: HeuristicFlag[]): boolean {
  const blockingFlags: HeuristicFlag[] = [
    'scope_mismatch',
    'invalid_entry',
  ];
  return flags.some(f => blockingFlags.includes(f));
}
