import { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import type { IStorage } from './storage';

export interface RBACRequest extends AuthenticatedRequest {
  storage?: IStorage;
}

export function requireAdmin(req: RBACRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ 
      error: 'Forbidden',
      message: 'Admin access required for this operation' 
    });
    return;
  }

  next();
}

export async function logAudit(
  storage: IStorage,
  entityType: string,
  entityId: string,
  action: string,
  actor: string,
  meta?: any
): Promise<void> {
  try {
    await storage.appendAuditLog({
      entityType,
      entityId,
      action,
      actor,
      meta: meta || null,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}
