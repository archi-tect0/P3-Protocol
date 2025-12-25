# Production-Grade Error Handling Implementation Guide

This document outlines the comprehensive error handling pattern implemented for the P3 Protocol server routes, with special focus on blockchain transaction tracking and rollback mechanisms.

## Overview

All server routes now use a centralized error handling system that provides:

1. **Standardized error responses** with user-friendly messages
2. **Detailed logging** with context for debugging
3. **Error categorization** (validation, database, blockchain, etc.)
4. **Blockchain transaction tracking** with automatic rollback on failures
5. **Database error wrapping** for consistent handling
6. **External API error handling** with timeouts

## Core Components

### Error Handler Utility (`server/utils/error-handler.ts`)

The centralized error handling module provides:

- **`handleError()`** - Main error handler for standardized responses
- **`AppError`** - Custom error class with categories and context
- **`ErrorCategory`** - Enum for error types (VALIDATION, DATABASE, BLOCKCHAIN, etc.)
- **`withDatabaseErrorHandling()`** - Wrapper for all database operations
- **`withBlockchainErrorHandling()`** - Wrapper for blockchain operations with transaction tracking
- **`withExternalAPIErrorHandling()`** - Wrapper for external API calls with timeouts
- **`BlockchainTransactionTracker`** - Tracks pending blockchain transactions for rollback
- **`blockchainTxTracker`** - Global transaction tracker instance

## Implementation Pattern

### Pattern 1: Database Operations

```typescript
// BEFORE (basic error handling)
router.get('/api/resources', async (req: Request, res: Response) => {
  try {
    const resources = await storage.getResources();
    res.json(resources);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to get resources' });
  }
});

// AFTER (comprehensive error handling)
import { handleError, withDatabaseErrorHandling } from './utils/error-handler';

router.get('/api/resources', async (req: Request, res: Response) => {
  try {
    const resources = await withDatabaseErrorHandling(
      () => storage.getResources(),
      {
        operation: 'getResources',
        entityType: 'resource',
      }
    );
    
    res.json(resources);
  } catch (error) {
    handleError(error, res, {
      operation: 'getResources',
      entityType: 'resource',
      requestId: req.id,
    });
  }
});
```

### Pattern 2: Blockchain Operations with Transaction Tracking

```typescript
// BEFORE (no transaction tracking or rollback)
router.post('/api/blockchain/action', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await blockchain.performAction(data);
    await storage.saveResult(result);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// AFTER (with transaction tracking and rollback)
import { 
  handleError, 
  AppError, 
  ErrorCategory,
  withDatabaseErrorHandling,
  withBlockchainErrorHandling,
  blockchainTxTracker,
} from './utils/error-handler';

router.post('/api/blockchain/action', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const trackingId = `action-${Date.now()}`;
  
  try {
    const data = validateBody(schema, req.body);
    
    if (!req.user) {
      throw new AppError(ErrorCategory.AUTHENTICATION, 'Authentication required');
    }
    
    // Blockchain operation with transaction tracking
    const blockchainResult = await withBlockchainErrorHandling(
      () => blockchain.performAction(data),
      {
        operation: 'performAction',
        userId: req.user.userId,
        trackingId,
      }
    );
    
    // Database operation
    const saved = await withDatabaseErrorHandling(
      () => storage.saveResult({
        ...blockchainResult,
        txHash: blockchainResult.txHash,
        trackingId,
      }),
      {
        operation: 'saveResult',
        userId: req.user.userId,
        entityType: 'action_result',
      }
    );
    
    // Confirm successful blockchain transaction
    blockchainTxTracker.confirm(trackingId);
    
    res.json(saved);
  } catch (error) {
    // Clear blockchain transaction tracking on error
    blockchainTxTracker.clear(trackingId);
    
    handleError(error, res, {
      operation: 'performBlockchainAction',
      userId: req.user?.userId,
      entityType: 'action_result',
      requestId: req.id,
    });
  }
});
```

### Pattern 3: External API Calls

```typescript
// BEFORE (no timeout or proper error handling)
router.post('/api/external/webhook', async (req: Request, res: Response) => {
  try {
    const result = await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(data) });
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed' });
  }
});

// AFTER (with timeout and proper error handling)
import { handleError, withExternalAPIErrorHandling } from './utils/error-handler';

router.post('/api/external/webhook', async (req: Request, res: Response) => {
  try {
    const result = await withExternalAPIErrorHandling(
      async () => {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        return await response.json();
      },
      {
        operation: 'sendWebhook',
        service: 'Webhook Service',
      },
      10000 // 10 second timeout
    );
    
    res.json(result);
  } catch (error) {
    handleError(error, res, {
      operation: 'sendWebhook',
      requestId: req.id,
    });
  }
});
```

### Pattern 4: Validation Errors

```typescript
// Zod validation errors are automatically handled by handleError()
try {
  const data = validateBody(schema, req.body); // Throws z.ZodError on failure
  // ... rest of logic
} catch (error) {
  // handleError() will detect z.ZodError and return a 400 with field-level details
  handleError(error, res, {
    operation: 'validateInput',
    requestId: req.id,
  });
}
```

### Pattern 5: Custom Application Errors

```typescript
import { AppError, ErrorCategory } from './utils/error-handler';

// Throw custom errors with appropriate categories
if (!user) {
  throw new AppError(ErrorCategory.NOT_FOUND, 'User not found', { userId });
}

if (!hasPermission) {
  throw new AppError(ErrorCategory.AUTHORIZATION, 'Insufficient permissions', { required: 'admin' });
}

if (invalidState) {
  throw new AppError(ErrorCategory.VALIDATION, 'Invalid state transition', { from: 'pending', to: 'executed' });
}
```

## Error Categories and HTTP Status Codes

| Category | HTTP Status | Use Case |
|----------|-------------|----------|
| VALIDATION | 400 | Invalid input data, Zod validation failures |
| AUTHENTICATION | 401 | Missing or invalid authentication |
| AUTHORIZATION | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists or state conflict |
| RATE_LIMIT | 429 | Too many requests |
| INTERNAL | 500 | Unexpected server errors |
| DATABASE | 500 | Database operation failures |
| BLOCKCHAIN | 503 | Blockchain service unavailable or transaction failures |
| EXTERNAL_API | 502 | External service communication failures |

## Error Response Format

All errors return a consistent JSON structure:

```json
{
  "error": "User-friendly error message",
  "code": "ERROR_CATEGORY",
  "details": {
    "field": "additional context",
    "hint": "helpful information"
  },
  "timestamp": "2025-11-16T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

## Blockchain Transaction Rollback

### How it Works

1. **Track**: When a blockchain operation starts, create a tracking ID and pass it to `withBlockchainErrorHandling()`
2. **Execute**: The blockchain operation is executed and the transaction hash is tracked
3. **Confirm**: On success, call `blockchainTxTracker.confirm(trackingId)` to mark as complete
4. **Rollback**: On failure, call `blockchainTxTracker.clear(trackingId)` to remove tracking

### Example with Database Rollback

```typescript
const trackingId = `proposal-create-${Date.now()}`;
let proposal = null;

try {
  // Blockchain operation (tracked)
  const blockchainResult = await withBlockchainErrorHandling(
    () => blockchain.createProposal(data),
    { operation: 'createProposal', trackingId }
  );
  
  // Database operation
  proposal = await withDatabaseErrorHandling(
    () => storage.createProposal({ ...data, txHash: blockchainResult.txHash }),
    { operation: 'createProposal' }
  );
  
  // Both succeeded - confirm transaction
  blockchainTxTracker.confirm(trackingId);
  
  res.status(201).json(proposal);
} catch (error) {
  // Rollback blockchain transaction tracking
  blockchainTxTracker.clear(trackingId);
  
  // Rollback database if proposal was created
  if (proposal) {
    await storage.deleteProposal(proposal.id).catch(err => {
      logger.error('Rollback failed', { proposalId: proposal.id, error: err });
    });
  }
  
  handleError(error, res, { operation: 'createProposal' });
}
```

## Logging

All error handling functions automatically log errors with context:

- **Debug level**: Successful database operations
- **Info level**: Successful blockchain transactions
- **Warn level**: Validation errors, missing resources
- **Error level**: Database failures, blockchain failures, unexpected errors

Example log entry:
```json
{
  "level": "error",
  "module": "dao-routes",
  "operation": "createProposal",
  "userId": "user_123",
  "entityType": "dao_proposal",
  "category": "BLOCKCHAIN_ERROR",
  "message": "Blockchain operation failed",
  "details": {
    "operation": "createProposal",
    "hint": "The blockchain transaction could not be completed"
  },
  "timestamp": "2025-11-16T12:00:00.000Z"
}
```

## Migration Checklist

When updating a route file to use the new error handling:

- [ ] Import error handling utilities at the top
- [ ] Wrap all `storage.*` calls with `withDatabaseErrorHandling()`
- [ ] Wrap all `blockchain.*` calls with `withBlockchainErrorHandling()`
- [ ] Wrap all external API calls with `withExternalAPIErrorHandling()`
- [ ] Create tracking IDs for blockchain operations
- [ ] Confirm or clear transaction tracking based on success/failure
- [ ] Replace all custom error responses with `handleError()`
- [ ] Use `AppError` for throwing custom errors with categories
- [ ] Add proper context to all error handling calls
- [ ] Remove console.log/console.error in favor of the logger
- [ ] Test error scenarios to ensure proper rollback

## Files Already Updated

✅ **server/utils/error-handler.ts** - Centralized error handling utility
✅ **server/dao-routes.ts** - DAO governance routes with blockchain transaction tracking

## Files Requiring Updates

The following files need to be updated with the same pattern:

1. **server/routes.ts** - Auth, receipts, telemetry, ledger, wallet, voice routes
2. **server/app-routes.ts** - Messaging, notes, directory, inbox routes
3. **server/bridge-routes.ts** - Cross-chain bridge operations
4. **server/trust-routes.ts** - Trust configuration routes
5. **server/zk-routes.ts** - ZK proof generation and verification
6. **server/services-routes.ts** - ENS, webhook, export services
7. **server/routes/future-ready.ts** - Future-ready module endpoints

## Testing Error Handling

Test scenarios to verify:

1. **Database errors**: Simulate database connection failures
2. **Blockchain errors**: Test with invalid blockchain configurations
3. **Validation errors**: Send invalid request bodies
4. **Authentication errors**: Test without auth tokens
5. **Not found errors**: Request non-existent resources
6. **Transaction rollback**: Verify database rollback on blockchain failures
7. **Timeout handling**: Test external API timeouts
8. **Logging**: Verify error logs contain proper context

## Best Practices

1. **Always provide context**: Include operation, userId, entityType, entityId in error handling
2. **Use specific error categories**: Choose the most appropriate ErrorCategory
3. **Track all blockchain transactions**: Use tracking IDs for rollback capability
4. **Add user-friendly hints**: Include helpful details in AppError for debugging
5. **Never expose sensitive data**: Error responses should not leak secrets or internal details
6. **Log before throwing**: Use logger for detailed technical information before throwing errors
7. **Validate early**: Use Zod schemas to catch validation errors before processing
8. **Fail fast**: Throw errors as soon as validation or auth fails
9. **Clean up resources**: Always clear transaction tracking in catch blocks
10. **Test error paths**: Ensure error handling works for all failure scenarios

## Questions?

For questions or issues with the error handling implementation, review:
- `server/utils/error-handler.ts` - Core error handling logic
- `server/dao-routes.ts` - Reference implementation with blockchain tracking
- This guide - Comprehensive patterns and examples
