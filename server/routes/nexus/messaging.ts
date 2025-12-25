import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../../storage';
import { handleError, AppError, ErrorCategory } from '../../utils/error-handler';
import { rootLogger } from '../../observability/logger';
import { sendMessageNotification } from '../../services/pushNotifications';

const logger = rootLogger.child({ module: 'nexus-messaging' });

interface SessionRequest extends Request {
  wallet?: string;
  session?: {
    wallet?: string;
  };
}

const sendMessageSchema = z.object({
  recipient: z.string().min(1),
  encryptedContent: z.string().min(1),
  contentHash: z.string().min(1),
  messageType: z.enum(['text', 'voice', 'video']).default('text'),
  threadId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const threadIdSchema = z.object({
  id: z.string().uuid(),
});

function normalizeMessage(msg: any): any {
  return {
    id: msg.id,
    fromWallet: msg.fromWallet || msg.from_wallet,
    toWallet: msg.toWallet || msg.to_wallet,
    messageType: msg.messageType || msg.message_type,
    encryptedContent: msg.encryptedContent || msg.encrypted_content,
    contentHash: msg.contentHash || msg.content_hash,
    status: msg.status,
    metadata: msg.metadata,
    createdAt: msg.createdAt || msg.created_at,
    deliveredAt: msg.deliveredAt || msg.delivered_at,
    readAt: msg.readAt || msg.read_at,
    ipfsCid: msg.ipfsCid || msg.ipfs_cid,
    receiptId: msg.receiptId || msg.receipt_id,
    anchorTxHash: msg.anchorTxHash || msg.anchor_tx_hash,
    anchorStatus: msg.anchorStatus || msg.anchor_status,
    anchorTimestamp: msg.anchorTimestamp || msg.anchor_timestamp,
  };
}

function requireSession(req: SessionRequest, res: Response, next: () => void): void {
  const wallet = req.wallet || req.session?.wallet || req.headers['x-wallet-address'] as string;
  
  if (!wallet) {
    res.status(401).json({ error: 'unauthorized', message: 'Wallet session required' });
    return;
  }
  
  req.wallet = wallet.toLowerCase();
  next();
}

export function createMessagingRoutes(storage: IStorage): Router {
  const router = Router();

  router.post('/send', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = sendMessageSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { recipient, encryptedContent, contentHash, messageType, metadata } = result.data;
      const wallet = req.wallet!;
      
      const rawMessage = await storage.createMessage({
        fromWallet: wallet,
        toWallet: recipient.toLowerCase(),
        messageType,
        encryptedContent,
        contentHash,
        status: 'sent',
        metadata: metadata || null,
      });
      
      const message = normalizeMessage(rawMessage);
      
      logger.info('Message sent', { 
        messageId: message.id, 
        from: wallet, 
        to: recipient.toLowerCase() 
      });

      sendMessageNotification(
        recipient.toLowerCase(),
        wallet,
        messageType === 'text' ? 'New encrypted message received' : `New ${messageType} message`
      ).catch(err => {
        logger.warn('Failed to send message push notification', { error: err.message });
      });
      
      res.status(201).json({
        ok: true,
        message,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'sendMessage',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/list', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      
      const rawMessages = await storage.listMessages({ walletAddress: wallet });
      const messages = rawMessages.map(normalizeMessage);
      
      const conversations = new Map<string, {
        peer: string;
        lastMessage: any;
        unreadCount: number;
      }>();
      
      for (const msg of messages) {
        const peer = msg.fromWallet === wallet ? msg.toWallet : msg.fromWallet;
        const existing = conversations.get(peer);
        
        if (!existing || new Date(msg.createdAt) > new Date(existing.lastMessage.createdAt)) {
          const unreadCount = msg.toWallet === wallet && msg.status !== 'read' 
            ? (existing?.unreadCount || 0) + 1 
            : existing?.unreadCount || 0;
            
          conversations.set(peer, {
            peer,
            lastMessage: msg,
            unreadCount,
          });
        } else if (msg.toWallet === wallet && msg.status !== 'read') {
          existing.unreadCount++;
        }
      }
      
      const conversationList = Array.from(conversations.values())
        .sort((a, b) => 
          new Date(b.lastMessage.createdAt).getTime() - 
          new Date(a.lastMessage.createdAt).getTime()
        );
      
      res.json({
        ok: true,
        conversations: conversationList,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'listConversations',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/thread/:id', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const wallet = req.wallet!;
      
      // Check if id is a wallet address (starts with 0x) or a UUID
      const isWalletAddress = id.startsWith('0x') && id.length === 42;
      
      if (isWalletAddress) {
        // Treat id as peer wallet address
        const peer = id.toLowerCase();
        const rawMessages = await storage.listMessages({ walletAddress: wallet });
        const allMessages = rawMessages.map(normalizeMessage);
        const threadMessages = allMessages.filter(
          m => (m.fromWallet === wallet && m.toWallet === peer) ||
               (m.fromWallet === peer && m.toWallet === wallet)
        ).sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        res.json({
          ok: true,
          peer,
          messages: threadMessages,
        });
        return;
      }
      
      // Original UUID-based thread lookup
      const paramResult = threadIdSchema.safeParse({ id });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid thread ID');
      }
      
      const rawMessage = await storage.getMessage(id);
      
      if (!rawMessage) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Thread not found');
      }
      
      const message = normalizeMessage(rawMessage);
      const peer = message.fromWallet === wallet ? message.toWallet : message.fromWallet;
      
      if (message.fromWallet !== wallet && message.toWallet !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied');
      }
      
      const rawMessages = await storage.listMessages({ walletAddress: wallet });
      const allMessages = rawMessages.map(normalizeMessage);
      const threadMessages = allMessages.filter(
        m => (m.fromWallet === wallet && m.toWallet === peer) ||
             (m.fromWallet === peer && m.toWallet === wallet)
      ).sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      res.json({
        ok: true,
        peer,
        messages: threadMessages,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'getThread',
        requestId: (req as any).id,
      });
    }
  });

  return router;
}
