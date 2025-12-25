import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../../storage';
import { handleError, AppError, ErrorCategory } from '../../utils/error-handler';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'nexus-directory' });

interface SessionRequest extends Request {
  wallet?: string;
  session?: {
    wallet?: string;
  };
}

const createContactSchema = z.object({
  walletAddress: z.string().min(1),
  ensName: z.string().optional(),
  basename: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  bio: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateContactSchema = z.object({
  ensName: z.string().optional(),
  basename: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  metadata: z.record(z.any()).optional(),
  isVerified: z.boolean().optional(),
});

const walletParamSchema = z.object({
  wallet: z.string().min(1),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  verified: z.enum(['true', 'false']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
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

export function createDirectoryRoutes(storage: IStorage): Router {
  const router = Router();

  router.get('/', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const queryResult = listQuerySchema.safeParse(req.query);
      if (!queryResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid query parameters', queryResult.error.errors);
      }
      
      const { search, verified, limit = '50', offset = '0' } = queryResult.data;
      
      const filters: { searchQuery?: string; isVerified?: boolean } = {};
      
      if (search) {
        filters.searchQuery = search;
      }
      
      if (verified === 'true') {
        filters.isVerified = true;
      } else if (verified === 'false') {
        filters.isVerified = false;
      }
      
      const entries = await storage.listDirectoryEntries(filters);
      
      const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
      const offsetNum = parseInt(offset, 10) || 0;
      
      const paginatedEntries = entries.slice(offsetNum, offsetNum + limitNum);
      
      res.json({
        ok: true,
        contacts: paginatedEntries,
        total: entries.length,
        hasMore: offsetNum + limitNum < entries.length,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'listContacts',
        requestId: (req as any).id,
      });
    }
  });

  router.post('/', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = createContactSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { walletAddress, ensName, basename, avatarUrl, bio, metadata } = result.data;
      const normalizedWallet = walletAddress.toLowerCase();
      
      const existing = await storage.getDirectoryEntry(normalizedWallet);
      if (existing) {
        throw new AppError(ErrorCategory.CONFLICT, 'Contact already exists');
      }
      
      const entry = await storage.createOrUpdateDirectoryEntry({
        walletAddress: normalizedWallet,
        ensName: ensName || null,
        basename: basename || null,
        avatarUrl: avatarUrl || null,
        bio: bio || null,
        isVerified: 0,
        metadata: metadata || null,
        lastResolvedAt: new Date(),
      });
      
      logger.info('Contact created', { 
        wallet: normalizedWallet, 
        createdBy: req.wallet 
      });
      
      res.status(201).json({
        ok: true,
        contact: entry,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'createContact',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/:wallet', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const paramResult = walletParamSchema.safeParse({ wallet: req.params.wallet });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid wallet address');
      }
      
      const { wallet } = paramResult.data;
      const normalizedWallet = wallet.toLowerCase();
      
      const entry = await storage.getDirectoryEntry(normalizedWallet);
      
      if (!entry) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Contact not found');
      }
      
      res.json({
        ok: true,
        contact: entry,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'getContact',
        requestId: (req as any).id,
      });
    }
  });

  router.patch('/:wallet', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const paramResult = walletParamSchema.safeParse({ wallet: req.params.wallet });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid wallet address');
      }
      
      const { wallet } = paramResult.data;
      const normalizedWallet = wallet.toLowerCase();
      
      const result = updateContactSchema.safeParse(req.body);
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const existing = await storage.getDirectoryEntry(normalizedWallet);
      if (!existing) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Contact not found');
      }
      
      const updateData: any = {
        walletAddress: normalizedWallet,
        lastResolvedAt: new Date(),
      };
      
      if (result.data.ensName !== undefined) {
        updateData.ensName = result.data.ensName;
      }
      if (result.data.basename !== undefined) {
        updateData.basename = result.data.basename;
      }
      if (result.data.avatarUrl !== undefined) {
        updateData.avatarUrl = result.data.avatarUrl;
      }
      if (result.data.bio !== undefined) {
        updateData.bio = result.data.bio;
      }
      if (result.data.metadata !== undefined) {
        updateData.metadata = result.data.metadata;
      }
      if (result.data.isVerified !== undefined) {
        updateData.isVerified = result.data.isVerified ? 1 : 0;
      }
      
      const entry = await storage.createOrUpdateDirectoryEntry(updateData);
      
      logger.info('Contact updated', { 
        wallet: normalizedWallet, 
        updatedBy: req.wallet 
      });
      
      res.json({
        ok: true,
        contact: entry,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'updateContact',
        requestId: (req as any).id,
      });
    }
  });

  router.delete('/:wallet', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const paramResult = walletParamSchema.safeParse({ wallet: req.params.wallet });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid wallet address');
      }
      
      const { wallet } = paramResult.data;
      const normalizedWallet = wallet.toLowerCase();
      
      const existing = await storage.getDirectoryEntry(normalizedWallet);
      if (!existing) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Contact not found');
      }
      
      await storage.createOrUpdateDirectoryEntry({
        walletAddress: normalizedWallet,
        ensName: null,
        basename: null,
        avatarUrl: null,
        bio: null,
        isVerified: 0,
        metadata: null,
        lastResolvedAt: new Date(),
      });
      
      logger.info('Contact removed', { 
        wallet: normalizedWallet, 
        removedBy: req.wallet 
      });
      
      res.json({
        ok: true,
        message: 'Contact removed successfully',
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'removeContact',
        requestId: (req as any).id,
      });
    }
  });

  return router;
}
