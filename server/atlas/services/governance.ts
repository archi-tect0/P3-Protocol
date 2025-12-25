import type { Session, FlowStep, Scope } from '../types';
import { atlasConfig } from '../config';
import { getEndpoint } from './registryAdapter';

export class ConsentError extends Error {
  constructor(
    public missingScopes: Scope[],
    message?: string
  ) {
    super(message || `Missing required scopes: ${missingScopes.join(', ')}`);
    this.name = 'ConsentError';
  }
}

export class RoleError extends Error {
  constructor(
    public requiredRoles: string[],
    public userRoles: string[],
    message?: string
  ) {
    super(message || `Insufficient role. Required: ${requiredRoles.join(' or ')}, has: ${userRoles.join(', ')}`);
    this.name = 'RoleError';
  }
}

export async function ensureConsent(session: Session, step: FlowStep): Promise<void> {
  const endpoint = await getEndpoint(step.key);
  
  if (!endpoint) {
    return;
  }
  
  const requiredScopes = endpoint.scopes;
  const missingScopes = requiredScopes.filter(scope => !session.grants.includes(scope));
  
  if (missingScopes.length > 0) {
    throw new ConsentError(missingScopes);
  }
  
  if (session.expiresAt < Date.now()) {
    throw new Error('Session expired');
  }
}

export async function reviewGate(step: FlowStep): Promise<'allow' | 'review'> {
  const endpoint = await getEndpoint(step.key);
  
  if (!endpoint) {
    return 'allow';
  }
  
  const hasHighRiskScope = endpoint.scopes.some(scope => 
    atlasConfig.reviewScopes.includes(scope as Scope)
  );
  
  if (hasHighRiskScope) {
    return 'review';
  }
  
  const isHighValuePayment = step.key === 'payments.send' && 
    parseFloat(step.args.amount || '0') > 100;
  
  if (isHighValuePayment) {
    return 'review';
  }
  
  return 'allow';
}

export function checkRole(session: Session, requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  
  for (const userRole of session.roles) {
    const allowedRoles = atlasConfig.roleHierarchy[userRole] || [userRole];
    
    for (const required of requiredRoles) {
      if (allowedRoles.includes(required)) {
        return true;
      }
    }
  }
  
  return false;
}

export function validateSession(session: Session): { valid: boolean; reason?: string } {
  if (!session.wallet) {
    return { valid: false, reason: 'No wallet address' };
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(session.wallet)) {
    return { valid: false, reason: 'Invalid wallet address format' };
  }
  
  if (session.expiresAt < Date.now()) {
    return { valid: false, reason: 'Session expired' };
  }
  
  if (!session.roles || session.roles.length === 0) {
    return { valid: false, reason: 'No roles assigned' };
  }
  
  return { valid: true };
}
