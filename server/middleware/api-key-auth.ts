import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db';
import { apiKeys, ApiKey } from '@shared/schema';
import { eq } from 'drizzle-orm';

declare global {
  namespace Express {
    interface Request {
      ctx?: {
        apiKey?: ApiKey;
      };
    }
  }
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function apiKeyAuth(required: boolean = true) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      if (required) {
        res.status(401).json({
          error: 'missing_api_key',
          message: 'API key is required. Provide it via x-api-key header.',
        });
        return;
      }
      return next();
    }

    const keyHash = hashKey(apiKey);

    try {
      const [keyRecord] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))
        .limit(1);

      if (!keyRecord) {
        res.status(403).json({
          error: 'invalid_api_key',
          message: 'The provided API key is invalid.',
        });
        return;
      }

      if (keyRecord.status === 'revoked') {
        res.status(403).json({
          error: 'revoked_api_key',
          message: 'This API key has been revoked.',
        });
        return;
      }

      if (keyRecord.status === 'expired') {
        res.status(403).json({
          error: 'expired_api_key',
          message: 'This API key has expired.',
        });
        return;
      }

      if (keyRecord.expiresAt && new Date(keyRecord.expiresAt) < new Date()) {
        res.status(403).json({
          error: 'expired_api_key',
          message: 'This API key has expired.',
        });
        return;
      }

      if (keyRecord.status !== 'active') {
        res.status(403).json({
          error: 'inactive_api_key',
          message: 'This API key is not active.',
        });
        return;
      }

      req.ctx = req.ctx || {};
      req.ctx.apiKey = keyRecord;

      next();
    } catch (error) {
      console.error('[api-key-auth] Database error:', error);
      res.status(500).json({
        error: 'internal_error',
        message: 'An error occurred while validating the API key.',
      });
    }
  };
}
