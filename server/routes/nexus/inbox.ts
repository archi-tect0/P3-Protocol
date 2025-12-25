import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../../storage';
import { handleError, AppError, ErrorCategory } from '../../utils/error-handler';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'nexus-inbox' });

interface SessionRequest extends Request {
  wallet?: string;
  session?: {
    wallet?: string;
  };
}

const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const subscribeSchema = z.object({
  topics: z.array(z.string().min(1)).min(1),
});

const inboxIdSchema = z.object({
  id: z.string().uuid(),
});

const subscriptionsStore = new Map<string, Set<string>>();

function requireSession(req: SessionRequest, res: Response, next: () => void): void {
  const wallet = req.wallet || req.session?.wallet || req.headers['x-wallet-address'] as string;
  
  if (!wallet) {
    res.status(401).json({ error: 'unauthorized', message: 'Wallet session required' });
    return;
  }
  
  req.wallet = wallet.toLowerCase();
  next();
}

export function createInboxRoutes(storage: IStorage): Router {
  const router = Router();

  router.get('/', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      const { status, limit = '50', offset = '0' } = req.query;
      
      const inboxItems = await storage.listInboxItems({
        walletAddress: wallet,
        status: status as string | undefined,
      });
      
      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 100);
      const offsetNum = parseInt(offset as string, 10) || 0;
      
      const paginatedItems = inboxItems.slice(offsetNum, offsetNum + limitNum);
      const unreadCount = inboxItems.filter(item => item.status === 'unread').length;
      
      res.json({
        ok: true,
        items: paginatedItems,
        total: inboxItems.length,
        unreadCount,
        hasMore: offsetNum + limitNum < inboxItems.length,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'getInbox',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/mark', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      
      const result = markReadSchema.safeParse(req.body);
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { ids } = result.data;
      
      const verifiedIds: string[] = [];
      for (const id of ids) {
        const item = await storage.getInboxItem(id);
        if (item && item.walletAddress === wallet) {
          verifiedIds.push(id);
        }
      }
      
      if (verifiedIds.length === 0) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'No valid inbox items found');
      }
      
      await storage.bulkUpdateInboxItems(verifiedIds, { status: 'read' });
      
      logger.info('Inbox items marked as read', { 
        count: verifiedIds.length, 
        wallet 
      });
      
      res.json({
        ok: true,
        markedCount: verifiedIds.length,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'markInboxRead',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/subscribe', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      
      const result = subscribeSchema.safeParse(req.body);
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { topics } = result.data;
      
      let userTopics = subscriptionsStore.get(wallet);
      if (!userTopics) {
        userTopics = new Set();
        subscriptionsStore.set(wallet, userTopics);
      }
      
      for (const topic of topics) {
        userTopics.add(topic);
      }
      
      logger.info('Topics subscribed', { 
        topics, 
        wallet,
        totalSubscriptions: userTopics.size,
      });
      
      res.json({
        ok: true,
        subscriptions: Array.from(userTopics),
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'subscribeTopics',
        requestId: (req as any).id,
      });
    }
  });

  router.delete('/:id', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const wallet = req.wallet!;
      
      const paramResult = inboxIdSchema.safeParse({ id });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid notification ID');
      }
      
      const item = await storage.getInboxItem(id);
      
      if (!item) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Notification not found');
      }
      
      if (item.walletAddress !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied');
      }
      
      await storage.bulkDeleteInboxItems([id]);
      
      logger.info('Inbox item deleted', { itemId: id, wallet });
      
      res.json({
        ok: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'deleteInboxItem',
        requestId: (req as any).id,
      });
    }
  });

  return router;
}
