import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = 
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    randomUUID();

  (req as any).correlationId = correlationId;
  
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}
