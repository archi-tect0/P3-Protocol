import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import type { IStorage } from '../../storage';
import { handleError, AppError, ErrorCategory } from '../../utils/error-handler';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'nexus-calls' });

interface SessionRequest extends Request {
  wallet?: string;
  session?: {
    wallet?: string;
  };
}

interface ActiveCall {
  callId: string;
  type: 'voice' | 'video';
  initiator: string;
  targetWallet: string;
  status: 'pending' | 'ringing' | 'connected' | 'ended';
  signals: { from: string; signal: any; timestamp: number }[];
  createdAt: number;
  connectedAt?: number;
  endedAt?: number;
}

const activeCalls = new Map<string, ActiveCall>();

const startCallSchema = z.object({
  type: z.enum(['voice', 'video']),
  targetWallet: z.string().min(1),
});

const signalSchema = z.object({
  callId: z.string().uuid(),
  signal: z.any(),
});

const endCallSchema = z.object({
  callId: z.string().uuid(),
});

const callIdParamSchema = z.object({
  callId: z.string().uuid(),
});

function requireSession(req: SessionRequest, res: Response, next: () => void): void {
  const wallet = req.wallet || req.session?.wallet || req.headers['x-wallet-address'] as string;
  
  if (!wallet) {
    res.status(401).json({ error: 'unauthorized', message: 'Wallet session required' });
    return;
  }
  
  req.wallet = wallet.toLowerCase();
  next();
}

function cleanupExpiredCalls(): void {
  const now = Date.now();
  const CALL_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  
  const entries = Array.from(activeCalls.entries());
  for (const [callId, call] of entries) {
    if (call.status === 'ended' || (now - call.createdAt > CALL_TIMEOUT && call.status !== 'connected')) {
      activeCalls.delete(callId);
    }
  }
}

setInterval(cleanupExpiredCalls, 60000);

export function createCallsRoutes(storage: IStorage): Router {
  const router = Router();

  router.post('/start', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = startCallSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { type, targetWallet } = result.data;
      const wallet = req.wallet!;
      const normalizedTarget = targetWallet.toLowerCase();
      
      if (wallet === normalizedTarget) {
        throw new AppError(ErrorCategory.VALIDATION, 'Cannot call yourself');
      }
      
      const existingCall = Array.from(activeCalls.values()).find(
        c => c.status !== 'ended' && 
        ((c.initiator === wallet && c.targetWallet === normalizedTarget) ||
         (c.initiator === normalizedTarget && c.targetWallet === wallet))
      );
      
      if (existingCall) {
        throw new AppError(ErrorCategory.CONFLICT, 'Active call already exists with this wallet');
      }
      
      const callId = randomUUID();
      const call: ActiveCall = {
        callId,
        type,
        initiator: wallet,
        targetWallet: normalizedTarget,
        status: 'pending',
        signals: [],
        createdAt: Date.now(),
      };
      
      activeCalls.set(callId, call);
      
      logger.info('Call started', { 
        callId, 
        type, 
        initiator: wallet, 
        target: normalizedTarget 
      });
      
      res.status(201).json({
        ok: true,
        callId,
        type,
        targetWallet: normalizedTarget,
        status: call.status,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'startCall',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/signal', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = signalSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { callId, signal } = result.data;
      const wallet = req.wallet!;
      
      const call = activeCalls.get(callId);
      
      if (!call) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Call not found');
      }
      
      if (call.initiator !== wallet && call.targetWallet !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Not a participant of this call');
      }
      
      if (call.status === 'ended') {
        throw new AppError(ErrorCategory.VALIDATION, 'Call has ended');
      }
      
      call.signals.push({
        from: wallet,
        signal,
        timestamp: Date.now(),
      });
      
      if (call.status === 'pending' && wallet === call.targetWallet) {
        call.status = 'ringing';
      }
      
      if (signal?.type === 'answer' || (call.signals.length >= 2 && call.status !== 'connected')) {
        call.status = 'connected';
        call.connectedAt = Date.now();
      }
      
      logger.debug('Signal exchanged', { callId, from: wallet });
      
      res.json({
        ok: true,
        callId,
        status: call.status,
        signalCount: call.signals.length,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'exchangeSignal',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/end', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = endCallSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { callId } = result.data;
      const wallet = req.wallet!;
      
      const call = activeCalls.get(callId);
      
      if (!call) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Call not found');
      }
      
      if (call.initiator !== wallet && call.targetWallet !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Not a participant of this call');
      }
      
      call.status = 'ended';
      call.endedAt = Date.now();
      
      const duration = call.connectedAt ? Math.floor((call.endedAt - call.connectedAt) / 1000) : 0;
      
      logger.info('Call ended', { 
        callId, 
        endedBy: wallet,
        duration,
        type: call.type,
      });
      
      res.json({
        ok: true,
        callId,
        duration,
        status: call.status,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'endCall',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/active', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      
      const userCalls = Array.from(activeCalls.values())
        .filter(c => 
          c.status !== 'ended' && 
          (c.initiator === wallet || c.targetWallet === wallet)
        )
        .map(c => ({
          callId: c.callId,
          type: c.type,
          initiator: c.initiator,
          targetWallet: c.targetWallet,
          status: c.status,
          createdAt: c.createdAt,
          connectedAt: c.connectedAt,
          peer: c.initiator === wallet ? c.targetWallet : c.initiator,
          isInitiator: c.initiator === wallet,
        }));
      
      res.json({
        ok: true,
        calls: userCalls,
        count: userCalls.length,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'listActiveCalls',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/:callId/signals', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const paramResult = callIdParamSchema.safeParse({ callId: req.params.callId });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid call ID');
      }
      
      const { callId } = paramResult.data;
      const wallet = req.wallet!;
      
      const call = activeCalls.get(callId);
      
      if (!call) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Call not found');
      }
      
      if (call.initiator !== wallet && call.targetWallet !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Not a participant of this call');
      }
      
      const signals = call.signals.filter(s => s.from !== wallet);
      
      res.json({
        ok: true,
        callId,
        status: call.status,
        signals,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'getCallSignals',
        requestId: (req as any).id,
      });
    }
  });

  return router;
}
