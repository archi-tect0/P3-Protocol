import { Response } from 'express';
import { z } from 'zod';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'error-handler' });

/**
 * Standard error response format for consistency
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
  requestId?: string;
}

/**
 * Error categories for classification and handling
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION_ERROR',
  DATABASE = 'DATABASE_ERROR',
  BLOCKCHAIN = 'BLOCKCHAIN_ERROR',
  EXTERNAL_API = 'EXTERNAL_API_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
}

/**
 * Map error categories to HTTP status codes
 */
const categoryToStatusCode: Record<ErrorCategory, number> = {
  [ErrorCategory.VALIDATION]: 400,
  [ErrorCategory.DATABASE]: 500,
  [ErrorCategory.BLOCKCHAIN]: 503,
  [ErrorCategory.EXTERNAL_API]: 502,
  [ErrorCategory.AUTHENTICATION]: 401,
  [ErrorCategory.AUTHORIZATION]: 403,
  [ErrorCategory.NOT_FOUND]: 404,
  [ErrorCategory.CONFLICT]: 409,
  [ErrorCategory.RATE_LIMIT]: 429,
  [ErrorCategory.INTERNAL]: 500,
};

/**
 * User-friendly error messages for each category
 */
const categoryToMessage: Record<ErrorCategory, string> = {
  [ErrorCategory.VALIDATION]: 'Invalid request data. Please check your input and try again.',
  [ErrorCategory.DATABASE]: 'Database operation failed. Please try again later.',
  [ErrorCategory.BLOCKCHAIN]: 'Blockchain service is temporarily unavailable. Please try again later.',
  [ErrorCategory.EXTERNAL_API]: 'External service is temporarily unavailable. Please try again later.',
  [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please log in and try again.',
  [ErrorCategory.AUTHORIZATION]: 'You do not have permission to perform this action.',
  [ErrorCategory.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCategory.CONFLICT]: 'This operation conflicts with existing data.',
  [ErrorCategory.RATE_LIMIT]: 'Too many requests. Please slow down and try again later.',
  [ErrorCategory.INTERNAL]: 'An unexpected error occurred. Please try again later.',
};

/**
 * Custom error class with category and context
 */
export class AppError extends Error {
  constructor(
    public category: ErrorCategory,
    public message: string,
    public details?: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Handle errors in a standardized way with proper logging
 */
export function handleError(
  error: unknown,
  res: Response,
  context: {
    operation: string;
    userId?: string;
    entityId?: string;
    entityType?: string;
    requestId?: string;
  }
): void {
  const timestamp = new Date().toISOString();

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    logger.warn('Validation error', {
      ...context,
      errors: error.errors,
    });

    res.status(400).json({
      error: categoryToMessage[ErrorCategory.VALIDATION],
      code: ErrorCategory.VALIDATION,
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      timestamp,
      requestId: context.requestId,
    } as ErrorResponse);
    return;
  }

  // Handle custom AppError
  if (error instanceof AppError) {
    const statusCode = categoryToStatusCode[error.category];
    const userMessage = categoryToMessage[error.category];

    logger.error('Application error', {
      ...context,
      category: error.category,
      message: error.message,
      details: error.details,
      originalError: error.originalError?.message,
    });

    res.status(statusCode).json({
      error: userMessage,
      code: error.category,
      details: error.details,
      timestamp,
      requestId: context.requestId,
    } as ErrorResponse);
    return;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Classify common error types
    let category = ErrorCategory.INTERNAL;
    let details: any = undefined;

    // Database errors
    if (error.message.includes('database') || error.message.includes('sql') || error.message.includes('query')) {
      category = ErrorCategory.DATABASE;
      details = { hint: 'Database operation failed' };
    }
    // Blockchain errors
    else if (error.message.includes('blockchain') || error.message.includes('contract') || error.message.includes('transaction')) {
      category = ErrorCategory.BLOCKCHAIN;
      details = { hint: 'Blockchain transaction failed' };
    }
    // Network/API errors
    else if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('timeout')) {
      category = ErrorCategory.EXTERNAL_API;
      details = { hint: 'External service communication failed' };
    }
    // Authentication errors
    else if (error.message.includes('authentication') || error.message.includes('unauthorized') || error.message.includes('token')) {
      category = ErrorCategory.AUTHENTICATION;
      details = { hint: 'Authentication check failed' };
    }

    logger.error('Error occurred', {
      ...context,
      category,
      message: error.message,
      stack: error.stack,
    });

    const statusCode = categoryToStatusCode[category];
    const userMessage = categoryToMessage[category];

    res.status(statusCode).json({
      error: userMessage,
      code: category,
      details,
      timestamp,
      requestId: context.requestId,
    } as ErrorResponse);
    return;
  }

  // Handle unknown errors
  logger.error('Unknown error occurred', {
    ...context,
    error: String(error),
  });

  res.status(500).json({
    error: categoryToMessage[ErrorCategory.INTERNAL],
    code: ErrorCategory.INTERNAL,
    timestamp,
    requestId: context.requestId,
  } as ErrorResponse);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends any[]>(
  fn: (...args: T) => Promise<any>
) {
  return (...args: T) => {
    const result = fn(...args);
    const res = args.find(arg => arg && typeof arg.status === 'function');
    if (result && typeof result.catch === 'function' && res) {
      result.catch((error: unknown) => {
        if (!res.headersSent) {
          handleError(error, res as Response, {
            operation: 'unknown',
          });
        }
      });
    }
    return result;
  };
}

/**
 * Blockchain transaction rollback tracker
 */
export class BlockchainTransactionTracker {
  private pendingTransactions: Map<string, {
    txHash: string;
    operation: string;
    timestamp: Date;
    metadata?: any;
  }> = new Map();

  /**
   * Track a blockchain transaction
   */
  track(id: string, txHash: string, operation: string, metadata?: any): void {
    this.pendingTransactions.set(id, {
      txHash,
      operation,
      timestamp: new Date(),
      metadata,
    });

    logger.info('Blockchain transaction tracked', {
      id,
      txHash,
      operation,
      metadata,
    });
  }

  /**
   * Mark transaction as confirmed
   */
  confirm(id: string): void {
    const tx = this.pendingTransactions.get(id);
    if (tx) {
      logger.info('Blockchain transaction confirmed', {
        id,
        txHash: tx.txHash,
        operation: tx.operation,
        duration: Date.now() - tx.timestamp.getTime(),
      });
      this.pendingTransactions.delete(id);
    }
  }

  /**
   * Get pending transactions for rollback
   */
  getPending(id: string): any {
    return this.pendingTransactions.get(id);
  }

  /**
   * Clear pending transaction (on failure)
   */
  clear(id: string): void {
    const tx = this.pendingTransactions.get(id);
    if (tx) {
      logger.warn('Blockchain transaction rolled back', {
        id,
        txHash: tx.txHash,
        operation: tx.operation,
      });
      this.pendingTransactions.delete(id);
    }
  }

  /**
   * Get all pending transactions
   */
  getAllPending(): Array<{ id: string; tx: any }> {
    return Array.from(this.pendingTransactions.entries()).map(([id, tx]) => ({ id, tx }));
  }
}

/**
 * Global blockchain transaction tracker instance
 */
export const blockchainTxTracker = new BlockchainTransactionTracker();

/**
 * Wrap database operations with error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    operation: string;
    userId?: string;
    entityType?: string;
  }
): Promise<T> {
  try {
    const result = await operation();
    logger.debug('Database operation successful', context);
    return result;
  } catch (error) {
    logger.error('Database operation failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new AppError(
      ErrorCategory.DATABASE,
      'Database operation failed',
      { operation: context.operation },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Wrap blockchain operations with error handling and rollback tracking
 */
export async function withBlockchainErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    operation: string;
    userId?: string;
    trackingId?: string;
  }
): Promise<T> {
  try {
    const result = await operation();
    
    // If result contains txHash, track it
    if (result && typeof result === 'object' && 'txHash' in result && context.trackingId) {
      blockchainTxTracker.track(
        context.trackingId,
        (result as any).txHash,
        context.operation,
        { userId: context.userId }
      );
    }

    logger.info('Blockchain operation successful', context);
    return result;
  } catch (error) {
    // Clear any pending transaction
    if (context.trackingId) {
      blockchainTxTracker.clear(context.trackingId);
    }

    logger.error('Blockchain operation failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new AppError(
      ErrorCategory.BLOCKCHAIN,
      'Blockchain operation failed',
      { 
        operation: context.operation,
        hint: 'The blockchain transaction could not be completed. No changes were made to the blockchain.',
      },
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Wrap external API calls with error handling and timeout
 */
export async function withExternalAPIErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    operation: string;
    service: string;
    userId?: string;
  },
  timeoutMs: number = 10000
): Promise<T> {
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${context.service} API timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const result = await Promise.race([
      operation(),
      timeoutPromise,
    ]);

    logger.debug('External API call successful', context);
    return result;
  } catch (error) {
    logger.error('External API call failed', {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });

    throw new AppError(
      ErrorCategory.EXTERNAL_API,
      `${context.service} service failed`,
      { 
        operation: context.operation,
        service: context.service,
      },
      error instanceof Error ? error : undefined
    );
  }
}
