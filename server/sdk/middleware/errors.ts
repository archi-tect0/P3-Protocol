import { Request, Response, NextFunction } from 'express';

export interface SDKError extends Error {
  status?: number;
  code?: string;
}

export function sdkErrorHandler(err: SDKError, req: Request, res: Response, next: NextFunction) {
  console.error('[SDK Error]', {
    path: req.path,
    method: req.method,
    wallet: req.sdkUser?.wallet,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const status = err.status || 500;
  const code = err.code || 'internal_error';
  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({
    error: code,
    message,
    ...(process.env.NODE_ENV === 'development' && { debug: err.stack }),
  });
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: 'not_found',
    message: `SDK endpoint ${req.method} ${req.path} not found`,
  });
}

export function createError(message: string, status = 400, code?: string): SDKError {
  const error = new Error(message) as SDKError;
  error.status = status;
  error.code = code;
  return error;
}
