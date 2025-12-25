import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

const redactPaths = [
  'password',
  'passwordHash',
  'secret',
  'token',
  'apiKey',
  'privateKey',
  'authorization',
  'cookie',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        host: bindings.hostname,
        node_version: process.version,
      };
    },
  },
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      query: req.query,
      params: req.params,
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
      remoteAddress: req.remoteAddress,
      remotePort: req.remotePort,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
      headers: res.getHeaders ? res.getHeaders() : {},
    }),
    err: pino.stdSerializers.err,
  },
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

export interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private baseLogger: pino.Logger;

  constructor(context: LogContext = {}) {
    this.baseLogger = logger.child(context);
  }

  child(context: LogContext): StructuredLogger {
    return new StructuredLogger(context);
  }

  debug(message: string, context?: LogContext): void {
    this.baseLogger.debug(context || {}, message);
  }

  info(message: string, context?: LogContext): void {
    this.baseLogger.info(context || {}, message);
  }

  warn(message: string, context?: LogContext): void {
    this.baseLogger.warn(context || {}, message);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.baseLogger.error({ err: error, ...context }, message);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.baseLogger.fatal({ err: error, ...context }, message);
  }
}

export function createRequestLogger(correlationId: string): StructuredLogger {
  return new StructuredLogger({ correlationId });
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = req.headers['x-correlation-id'] as string || req['correlationId'];
  const start = Date.now();

  const requestLogger = createRequestLogger(correlationId);

  (req as any).logger = requestLogger;

  requestLogger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    requestLogger[level]('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
}

export const rootLogger = new StructuredLogger();

declare global {
  namespace Express {
    interface Request {
      logger?: StructuredLogger;
    }
  }
}
