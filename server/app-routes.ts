import { Router, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import type { IStorage } from './storage';
import { authenticateJWT, type AuthenticatedRequest } from './auth';
import {
  insertMessageSchema,
  insertNoteSchema,
  insertDirectoryEntrySchema,
  insertInboxItemSchema,
} from '@shared/schema';
import { anchorToBlockchain } from './middleware/anchoring';
import { ReceiptService } from './services/receipts';
import { getIPFSService } from './services/ipfs';
import { rootLogger } from './observability/logger';
import { handleError, AppError, ErrorCategory } from './utils/error-handler';

const logger = rootLogger.child({ component: 'app-routes' });

/**
 * App Layer Routes - Encrypted Messaging, Notes, Directory, Inbox
 * 
 * Features:
 * - X25519+XChaCha20 encrypted messaging with content hashing
 * - Wallet-scoped notes with full-text search
 * - ENS/Basename directory resolution
 * - Message inbox with bulk operations
 */

// Validation schemas
const sendMessageSchema = z.object({
  toWallet: z.string(),
  messageType: z.enum(['text', 'voice', 'video']).default('text'),
  encryptedContent: z.string(),
  contentHash: z.string().optional(),
  ipfsCid: z.string().optional(),
  uploadToIPFS: z.boolean().default(false),
  shouldAnchor: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

const createNoteSchema = insertNoteSchema.extend({
  title: z.string().min(1),
  encryptedBody: z.string().min(1),
  searchableContent: z.string().optional(),
  tags: z.array(z.string()).optional(),
  shouldAnchor: z.boolean().default(false),
});

const updateNoteSchema = z.object({
  title: z.string().optional(),
  encryptedBody: z.string().optional(),
  searchableContent: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.number().optional(),
  shouldAnchor: z.boolean().optional(),
});

const updateDirectorySchema = z.object({
  ensName: z.string().optional(),
  basename: z.string().optional(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const bulkInboxActionSchema = z.object({
  ids: z.array(z.string()),
  action: z.enum(['archive', 'delete', 'star', 'unstar', 'read', 'unread']),
});

/**
 * Helper to validate and parse request body
 */
function validateBody<T>(schema: z.ZodSchema<T>, body: any): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(ErrorCategory.VALIDATION, `Validation error: ${result.error.message}`, {
      errors: result.error.errors,
    });
  }
  return result.data;
}

/**
 * Helper to compute SHA-256 content hash
 */
function computeContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Helper to extract wallet address from authenticated user
 */
function getWalletAddress(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new AppError(ErrorCategory.AUTHENTICATION, 'Not authenticated');
  }
  
  // Extract wallet address from email format: address@wallet
  const email = (req.user as any).email || '';
  if (email.endsWith('@wallet')) {
    return email.replace('@wallet', '');
  }
  
  // Fallback to userId if not wallet-based auth
  return req.user.userId;
}

/**
 * Create app routes
 */
export function createAppRoutes(storage: IStorage): Router {
  const router = Router();
  const receiptService = new ReceiptService(storage);
  const ipfsService = getIPFSService();

  // ============================================================================
  // Message Routes - Encrypted Messaging
  // ============================================================================

  /**
   * POST /api/messages
   * Send encrypted message with optional blockchain anchoring
   */
  router.post('/api/messages', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = validateBody(sendMessageSchema, req.body);
      const fromWallet = getWalletAddress(req);

      // Compute content hash (use provided hash or compute from content)
      const contentHash = data.contentHash || computeContentHash(data.encryptedContent);

      // Upload to IPFS if requested
      let ipfsCid = data.ipfsCid || null;
      if (data.uploadToIPFS && !ipfsCid) {
        const ipfsResult = await ipfsService.uploadJSON(
          {
            encryptedContent: data.encryptedContent,
            contentHash,
            from: fromWallet,
            to: data.toWallet,
            timestamp: new Date().toISOString(),
          },
          {
            name: `message-${contentHash.substring(0, 8)}.json`,
            metadata: {
              type: 'encrypted_message',
              from: fromWallet,
              to: data.toWallet,
            },
          }
        );

        if (ipfsResult.success) {
          ipfsCid = ipfsResult.cid!;
          logger.info('Message uploaded to IPFS', { cid: ipfsCid, fromWallet, toWallet: data.toWallet });
        } else {
          logger.error('IPFS upload failed', new Error(ipfsResult.error || 'Unknown IPFS error'), {
            fromWallet,
            toWallet: data.toWallet,
          });
        }
      }

      // Anchor to blockchain if requested
      const shouldAnchor = data.shouldAnchor ?? false;
      const anchorResult = await anchorToBlockchain(
        contentHash,
        'message',
        shouldAnchor
      );

      // Create message with anchor data and IPFS CID
      const message = await storage.createMessage({
        fromWallet,
        toWallet: data.toWallet,
        messageType: data.messageType,
        encryptedContent: data.encryptedContent,
        contentHash,
        ipfsCid,
        status: 'sent',
        metadata: data.metadata || null,
        anchorTxHash: anchorResult.anchorTxHash,
        anchorStatus: anchorResult.anchorStatus,
        anchorTimestamp: anchorResult.anchorTimestamp,
        receiptId: null,
        deliveredAt: null,
        readAt: null,
      });

      // Create receipt if anchored
      let receipt = null;
      if (shouldAnchor && anchorResult.anchorStatus !== 'failed') {
        try {
          receipt = await receiptService.createReceipt({
            type: 'message',
            subjectId: message.id,
            content: contentHash,
            actor: fromWallet,
            ipfsCid: ipfsCid || undefined,
            anchorTxHash: anchorResult.anchorTxHash || undefined,
          });
          logger.info('Receipt created for message', { messageId: message.id, receiptId: receipt.id });
        } catch (receiptError) {
          logger.error('Receipt creation failed', receiptError as Error, { messageId: message.id });
          // Continue even if receipt creation fails
        }
      }

      // Create inbox item for recipient
      await storage.createInboxItem({
        walletAddress: data.toWallet,
        messageId: message.id,
        status: 'unread',
        isStarred: 0,
        labels: [],
      });

      // Log audit trail
      await storage.appendAuditLog({
        entityType: 'message',
        entityId: message.id,
        action: 'created',
        actor: fromWallet,
        meta: {
          toWallet: data.toWallet,
          anchored: shouldAnchor,
          anchorStatus: anchorResult.anchorStatus,
          ipfsCid,
          uploadedToIPFS: !!ipfsCid,
          receiptId: receipt?.id || null,
        },
      });

      logger.info('Message sent successfully', {
        messageId: message.id,
        fromWallet,
        toWallet: data.toWallet,
        anchored: shouldAnchor,
        receiptGenerated: !!receipt,
      });

      res.status(201).json({
        ...message,
        receiptGenerated: !!receipt,
        receiptId: receipt?.id || null,
        ipfsGatewayUrl: ipfsCid ? ipfsService.getGatewayUrl(ipfsCid) : null,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'sendMessage',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * GET /api/messages
   * List messages (sent and received)
   */
  router.get('/api/messages', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const messages = await storage.listMessages({ walletAddress });

      res.json(messages);
    } catch (error) {
      handleError(error, res, {
        operation: 'listMessages',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * GET /api/messages/:id
   * Get message by ID
   */
  router.get('/api/messages/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const message = await storage.getMessage(req.params.id);

      if (!message) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Message not found', { messageId: req.params.id });
      }

      // Verify user has access to this message
      if (message.fromWallet !== walletAddress && message.toWallet !== walletAddress) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied to this message', {
          messageId: req.params.id,
          walletAddress,
        });
      }

      // Mark as read if user is recipient
      if (message.toWallet === walletAddress && message.status === 'delivered') {
        await storage.updateMessageStatus(message.id, 'read', new Date());
        logger.info('Message marked as read', { messageId: message.id, walletAddress });
      }

      res.json(message);
    } catch (error) {
      handleError(error, res, {
        operation: 'getMessage',
        userId: req.user?.userId,
        entityId: req.params.id,
        requestId: req.id,
      });
    }
  });

  // ============================================================================
  // Notes Routes - Wallet-Scoped Notes
  // ============================================================================

  /**
   * POST /api/notes
   * Create note with optional blockchain anchoring
   */
  router.post('/api/notes', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = validateBody(createNoteSchema, req.body);
      const walletAddress = getWalletAddress(req);

      // Generate content hash from title + encryptedBody
      const contentHash = computeContentHash(data.title + data.encryptedBody);

      // Anchor to blockchain if requested
      const shouldAnchor = data.shouldAnchor ?? false;
      const anchorResult = await anchorToBlockchain(
        contentHash,
        'note',
        shouldAnchor
      );

      // Create note with anchor data
      const note = await storage.createNote({
        walletAddress,
        title: data.title,
        encryptedBody: data.encryptedBody,
        searchableContent: data.searchableContent || null,
        tags: data.tags || [],
        isPinned: 0,
        receiptId: null,
        anchorTxHash: anchorResult.anchorTxHash,
        anchorStatus: anchorResult.anchorStatus,
        anchorTimestamp: anchorResult.anchorTimestamp,
      });

      // Create receipt if anchored
      let receipt = null;
      if (shouldAnchor && anchorResult.anchorStatus !== 'failed') {
        try {
          receipt = await receiptService.createReceipt({
            type: 'message',
            subjectId: note.id,
            content: contentHash,
            actor: walletAddress,
            anchorTxHash: anchorResult.anchorTxHash || undefined,
          });

          // Update note with receiptId
          if (receipt) {
            await storage.updateNote(note.id, { receiptId: receipt.id });
          }
        } catch (receiptError) {
          logger.error('Receipt creation failed for note', receiptError as Error, { noteId: note.id });
          // Continue even if receipt creation fails
        }
      }

      // Log audit trail
      await storage.appendAuditLog({
        entityType: 'note',
        entityId: note.id,
        action: 'created',
        actor: walletAddress,
        meta: {
          anchored: shouldAnchor,
          anchorStatus: anchorResult.anchorStatus,
          receiptId: receipt?.id || null,
        },
      });

      logger.info('Note created', {
        noteId: note.id,
        walletAddress,
        anchored: shouldAnchor,
        receiptGenerated: !!receipt,
      });

      res.status(201).json({
        ...note,
        receiptId: receipt?.id || note.receiptId,
        receiptGenerated: !!receipt,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'createNote',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * GET /api/notes
   * List notes with optional search
   */
  router.get('/api/notes', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const searchQuery = req.query.search as string | undefined;

      const notes = await storage.listNotes({
        walletAddress,
        searchQuery,
      });

      res.json(notes);
    } catch (error) {
      handleError(error, res, {
        operation: 'listNotes',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * GET /api/notes/:id
   * Get note by ID
   */
  router.get('/api/notes/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const note = await storage.getNote(req.params.id);

      if (!note) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Note not found', { noteId: req.params.id });
      }

      // Verify ownership
      if (note.walletAddress !== walletAddress) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied to this note', {
          noteId: req.params.id,
          walletAddress,
        });
      }

      res.json(note);
    } catch (error) {
      handleError(error, res, {
        operation: 'getNote',
        userId: req.user?.userId,
        entityId: req.params.id,
        requestId: req.id,
      });
    }
  });

  /**
   * PATCH /api/notes/:id
   * Update note with optional re-anchoring
   */
  router.patch('/api/notes/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const data = validateBody(updateNoteSchema, req.body);
      
      const existingNote = await storage.getNote(req.params.id);
      
      if (!existingNote) {
        res.status(404).json({ error: 'Note not found' });
        return;
      }

      // Verify ownership
      if (existingNote.walletAddress !== walletAddress) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Check if content changed and re-anchoring is requested
      const shouldAnchor = data.shouldAnchor ?? false;
      const contentChanged = data.title || data.encryptedBody;
      
      let anchorResult = null;
      let receipt = null;

      if (shouldAnchor && contentChanged) {
        // Generate new content hash from updated content
        const newTitle = data.title || existingNote.title;
        const newBody = data.encryptedBody || existingNote.encryptedBody;
        const contentHash = computeContentHash(newTitle + newBody);

        // Anchor to blockchain
        anchorResult = await anchorToBlockchain(
          contentHash,
          'note',
          shouldAnchor
        );

        // Create receipt if anchored successfully
        if (anchorResult.anchorStatus !== 'failed') {
          try {
            receipt = await receiptService.createReceipt({
              type: 'message',
              subjectId: req.params.id,
              content: contentHash,
              actor: walletAddress,
              anchorTxHash: anchorResult.anchorTxHash || undefined,
            });
          } catch (receiptError) {
            logger.error('Receipt creation failed for note update', receiptError as Error, { noteId: req.params.id });
            // Continue even if receipt creation fails
          }
        }
      }

      // Update note with new data and anchor information
      const updateData = {
        ...data,
        ...(anchorResult && {
          anchorTxHash: anchorResult.anchorTxHash,
          anchorStatus: anchorResult.anchorStatus,
          anchorTimestamp: anchorResult.anchorTimestamp,
        }),
        ...(receipt && {
          receiptId: receipt.id,
        }),
      };

      // Remove shouldAnchor from update data as it's not a db field
      delete (updateData as any).shouldAnchor;

      const note = await storage.updateNote(req.params.id, updateData);

      // Log audit trail
      await storage.appendAuditLog({
        entityType: 'note',
        entityId: note.id,
        action: 'updated',
        actor: walletAddress,
        meta: {
          anchored: shouldAnchor,
          anchorStatus: anchorResult?.anchorStatus || null,
          receiptId: receipt?.id || null,
        },
      });

      logger.info('Note updated', {
        noteId: note.id,
        walletAddress,
        anchored: shouldAnchor,
        receiptGenerated: !!receipt,
      });

      res.json({
        ...note,
        receiptGenerated: !!receipt,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'updateNote',
        userId: req.user?.userId,
        entityId: req.params.id,
        requestId: req.id,
      });
    }
  });

  /**
   * DELETE /api/notes/:id
   * Delete note
   */
  router.delete('/api/notes/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const note = await storage.getNote(req.params.id);

      if (!note) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Note not found', { noteId: req.params.id });
      }

      // Verify ownership
      if (note.walletAddress !== walletAddress) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied to this note', {
          noteId: req.params.id,
          walletAddress,
        });
      }

      logger.info('Deleting note', { noteId: req.params.id, walletAddress });
      await storage.deleteNote(req.params.id);

      logger.info('Note deleted', { noteId: req.params.id });
      res.status(204).send();
    } catch (error) {
      handleError(error, res, {
        operation: 'deleteNote',
        userId: req.user?.userId,
        entityId: req.params.id,
        requestId: req.id,
      });
    }
  });

  // ============================================================================
  // IPFS Routes - Pin and Fetch Content
  // ============================================================================

  /**
   * POST /api/ipfs/pin
   * Pin content to IPFS and optionally update a note with the CID
   */
  router.post('/api/ipfs/pin', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const { content, type, noteId } = req.body;

      if (!content) {
        throw new AppError(ErrorCategory.VALIDATION, 'Content is required');
      }

      logger.info('Pinning content to IPFS', { walletAddress, type, noteId });

      const ipfsResult = await ipfsService.uploadJSON(
        {
          content,
          type: type || 'note',
          wallet: walletAddress,
          timestamp: new Date().toISOString(),
        },
        {
          name: `${type || 'note'}-${Date.now()}.json`,
          metadata: {
            type: type || 'note',
            wallet: walletAddress,
          },
        }
      );

      if (!ipfsResult.success) {
        throw new AppError(ErrorCategory.EXTERNAL_SERVICE, ipfsResult.error || 'IPFS upload failed');
      }

      // If noteId is provided, update the note with the CID
      if (noteId) {
        const note = await storage.getNote(noteId);
        if (note && note.walletAddress === walletAddress) {
          await storage.updateNote(noteId, { ipfsCid: ipfsResult.cid });
          logger.info('Note updated with IPFS CID', { noteId, cid: ipfsResult.cid });
        }
      }

      logger.info('Content pinned to IPFS successfully', { cid: ipfsResult.cid, walletAddress });

      res.json({
        success: true,
        cid: ipfsResult.cid,
        gatewayUrl: ipfsResult.gatewayUrl,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'pinToIPFS',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * GET /api/ipfs/:cid
   * Fetch content from IPFS by CID
   */
  router.get('/api/ipfs/:cid', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { cid } = req.params;
      
      if (!cid) {
        throw new AppError(ErrorCategory.VALIDATION, 'CID is required');
      }

      logger.info('Fetching content from IPFS', { cid });

      // Use Pinata gateway to fetch content
      const gatewayUrl = ipfsService.getGatewayUrl(cid);
      
      try {
        const response = await fetch(gatewayUrl);
        if (!response.ok) {
          throw new AppError(ErrorCategory.NOT_FOUND, 'Content not found on IPFS', { cid });
        }
        
        const data = await response.json();
        logger.info('Content fetched from IPFS successfully', { cid });
        
        res.json({
          success: true,
          cid,
          gatewayUrl,
          data,
        });
      } catch (fetchError) {
        throw new AppError(ErrorCategory.EXTERNAL_SERVICE, 'Failed to fetch content from IPFS', { cid });
      }
    } catch (error) {
      handleError(error, res, {
        operation: 'fetchFromIPFS',
        userId: req.user?.userId,
        entityId: req.params.cid,
        requestId: req.id,
      });
    }
  });

  // ============================================================================
  // Directory Routes - ENS/Basename Resolution
  // ============================================================================

  /**
   * GET /api/directory
   * List directory entries
   */
  router.get('/api/directory', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const searchQuery = req.query.search as string | undefined;
      const isVerified = req.query.verified === 'true' ? true : undefined;

      const entries = await storage.listDirectoryEntries({
        searchQuery,
        isVerified,
      });

      res.json(entries);
    } catch (error) {
      handleError(error, res, {
        operation: 'listDirectory',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * GET /api/directory/:walletAddress
   * Get directory entry by wallet address
   */
  router.get('/api/directory/:walletAddress', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const entry = await storage.getDirectoryEntry(req.params.walletAddress);

      if (!entry) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Directory entry not found', {
          walletAddress: req.params.walletAddress,
        });
      }

      res.json(entry);
    } catch (error) {
      handleError(error, res, {
        operation: 'getDirectoryEntry',
        userId: req.user?.userId,
        entityId: req.params.walletAddress,
        requestId: req.id,
      });
    }
  });

  /**
   * POST /api/directory
   * Create or update directory entry (own profile)
   */
  router.post('/api/directory', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const data = validateBody(updateDirectorySchema, req.body);

      logger.info('Updating directory entry', { walletAddress });

      const entry = await storage.createOrUpdateDirectoryEntry({
        walletAddress,
        ...data,
      });

      logger.info('Directory entry updated', { walletAddress });
      res.json(entry);
    } catch (error) {
      handleError(error, res, {
        operation: 'updateDirectory',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  // ============================================================================
  // Inbox Routes - Message Inbox
  // ============================================================================

  /**
   * GET /api/inbox
   * Get inbox items
   */
  router.get('/api/inbox', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const status = req.query.status as string | undefined;

      const items = await storage.listInboxItems({
        walletAddress,
        status,
      });

      res.json(items);
    } catch (error) {
      handleError(error, res, {
        operation: 'listInbox',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  /**
   * PATCH /api/inbox/:id
   * Update inbox item
   */
  router.patch('/api/inbox/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const item = await storage.getInboxItem(req.params.id);

      if (!item) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Inbox item not found', { inboxItemId: req.params.id });
      }

      // Verify ownership
      if (item.walletAddress !== walletAddress) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied to this inbox item', {
          inboxItemId: req.params.id,
          walletAddress,
        });
      }

      logger.info('Updating inbox item', { inboxItemId: req.params.id, walletAddress });
      const updated = await storage.updateInboxItem(req.params.id, req.body);

      res.json(updated);
    } catch (error) {
      handleError(error, res, {
        operation: 'updateInboxItem',
        userId: req.user?.userId,
        entityId: req.params.id,
        requestId: req.id,
      });
    }
  });

  /**
   * POST /api/inbox/bulk
   * Bulk action on inbox items
   */
  router.post('/api/inbox/bulk', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const data = validateBody(bulkInboxActionSchema, req.body);

      // Verify all items belong to user
      for (const id of data.ids) {
        const item = await storage.getInboxItem(id);
        if (!item || item.walletAddress !== walletAddress) {
          throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied to one or more inbox items', {
            walletAddress,
            attemptedIds: data.ids,
          });
        }
      }

      logger.info('Performing bulk inbox action', {
        action: data.action,
        count: data.ids.length,
        walletAddress,
      });

      // Perform bulk action
      switch (data.action) {
        case 'archive':
          await storage.bulkUpdateInboxItems(data.ids, { status: 'archived' });
          break;
        case 'delete':
          await storage.bulkDeleteInboxItems(data.ids);
          break;
        case 'star':
          await storage.bulkUpdateInboxItems(data.ids, { isStarred: 1 });
          break;
        case 'unstar':
          await storage.bulkUpdateInboxItems(data.ids, { isStarred: 0 });
          break;
        case 'read':
          await storage.bulkUpdateInboxItems(data.ids, { status: 'read' });
          break;
        case 'unread':
          await storage.bulkUpdateInboxItems(data.ids, { status: 'unread' });
          break;
      }

      logger.info('Bulk inbox action completed', { action: data.action, count: data.ids.length });
      res.json({ success: true, count: data.ids.length });
    } catch (error) {
      handleError(error, res, {
        operation: 'bulkInboxAction',
        userId: req.user?.userId,
        requestId: req.id,
      });
    }
  });

  return router;
}
