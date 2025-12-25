import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tenantPolicies, insertTenantPolicySchema, TenantPolicy } from '@shared/schema';

interface AuthenticatedRequest extends Request {
  wallet?: string;
  tenantId?: string;
  apiKey?: {
    tenantId: string;
    keyId: string;
    walletOwner: string;
    tier?: number;
    quotaMonthly: number;
  };
  tenantPolicy?: TenantPolicy;
}

const TESTNET_CHAINS = ['sepolia', 'goerli', 'base-sepolia', 'mumbai', 'amoy'];
const SETTLEMENT_PATHS = ['/api/protocol/settlement', '/api/payments/transfer', '/api/anchor/batch'];

export async function loadTenantPolicy(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.apiKey?.tenantId || req.tenantId;
    
    if (!tenantId) {
      next();
      return;
    }
    
    const [policy] = await db.select()
      .from(tenantPolicies)
      .where(eq(tenantPolicies.tenantId, tenantId));
    
    if (policy) {
      req.tenantPolicy = policy;
    }
    
    next();
  } catch (error) {
    console.error('Error loading tenant policy:', error);
    next();
  }
}

export function requireProductionChain(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const policy = req.tenantPolicy;
  
  if (!policy?.sandbox) {
    next();
    return;
  }
  
  const isSettlementPath = SETTLEMENT_PATHS.some(path => req.path.startsWith(path));
  
  if (!isSettlementPath) {
    next();
    return;
  }
  
  const requestedChain = req.body?.chain || req.query?.chain as string;
  
  if (requestedChain && !TESTNET_CHAINS.includes(requestedChain.toLowerCase())) {
    res.status(403).json({
      error: 'Sandbox mode restricts mainnet operations',
      sandboxChain: policy.sandboxChain || 'sepolia',
      allowedChains: TESTNET_CHAINS,
      hint: 'Use a testnet chain or disable sandbox mode for production',
    });
    return;
  }
  
  next();
}

export function blockSettlementInSandbox(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const policy = req.tenantPolicy;
  
  if (!policy?.sandbox) {
    next();
    return;
  }
  
  const isSettlementPath = SETTLEMENT_PATHS.some(path => req.path.startsWith(path));
  
  if (isSettlementPath && req.method !== 'GET') {
    const requestedChain = (req.body?.chain || req.query?.chain as string || '').toLowerCase();
    
    if (!requestedChain || !TESTNET_CHAINS.includes(requestedChain)) {
      res.status(403).json({
        error: 'Settlement operations blocked in sandbox mode',
        code: 'SANDBOX_SETTLEMENT_BLOCKED',
        sandboxChain: policy.sandboxChain || 'sepolia',
        allowedChains: TESTNET_CHAINS,
        tip: 'Pass chain=sepolia to use sandbox settlement on testnet',
      });
      return;
    }
  }
  
  next();
}

export async function createTenantPolicy(tenantId: string, sandbox: boolean = false, sandboxChain?: string): Promise<TenantPolicy> {
  const existing = await db.select()
    .from(tenantPolicies)
    .where(eq(tenantPolicies.tenantId, tenantId));
  
  if (existing.length > 0) {
    const [updated] = await db.update(tenantPolicies)
      .set({ sandbox, sandboxChain })
      .where(eq(tenantPolicies.tenantId, tenantId))
      .returning();
    return updated;
  }
  
  const [policy] = await db.insert(tenantPolicies).values({
    tenantId,
    sandbox,
    sandboxChain: sandboxChain || (sandbox ? 'sepolia' : null),
  }).returning();
  
  return policy;
}

export async function getTenantPolicy(tenantId: string): Promise<TenantPolicy | null> {
  const [policy] = await db.select()
    .from(tenantPolicies)
    .where(eq(tenantPolicies.tenantId, tenantId));
  
  return policy || null;
}

export function injectSandboxHeaders(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const policy = req.tenantPolicy;
  
  if (policy?.sandbox) {
    res.setHeader('X-P3-Sandbox', 'true');
    res.setHeader('X-P3-Sandbox-Chain', policy.sandboxChain || 'sepolia');
  }
  
  next();
}
