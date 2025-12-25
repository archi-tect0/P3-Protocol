import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { IStorage } from '../../storage';
import { handleError, AppError, ErrorCategory } from '../../utils/error-handler';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'nexus-notes' });

interface SessionRequest extends Request {
  wallet?: string;
  session?: {
    wallet?: string;
  };
}

const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  encryptedBody: z.string().min(1),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  searchableContent: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  encryptedBody: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  searchableContent: z.string().optional(),
});

const noteIdSchema = z.object({
  id: z.string().uuid(),
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

export function createNotesRoutes(storage: IStorage): Router {
  const router = Router();

  router.post('/', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const result = createNoteSchema.safeParse(req.body);
      
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const { title, encryptedBody, tags, isPinned, searchableContent } = result.data;
      const wallet = req.wallet!;
      
      const note = await storage.createNote({
        walletAddress: wallet,
        title,
        encryptedBody,
        tags: tags || null,
        isPinned: isPinned ? 1 : 0,
        searchableContent: searchableContent || null,
      });
      
      logger.info('Note created', { noteId: note.id, wallet });
      
      res.status(201).json({
        ok: true,
        note,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'createNote',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const wallet = req.wallet!;
      const { search, tag } = req.query;
      
      const notes = await storage.listNotes({ 
        walletAddress: wallet,
        searchQuery: search as string | undefined,
      });
      
      let filteredNotes = notes;
      if (tag) {
        filteredNotes = notes.filter(n => n.tags?.includes(tag as string));
      }
      
      const sortedNotes = filteredNotes.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      
      res.json({
        ok: true,
        notes: sortedNotes,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'listNotes',
        requestId: (req as any).id,
      });
    }
  });

  router.get('/:id', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const wallet = req.wallet!;
      
      const paramResult = noteIdSchema.safeParse({ id });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid note ID');
      }
      
      const note = await storage.getNote(id);
      
      if (!note) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Note not found');
      }
      
      if (note.walletAddress !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied');
      }
      
      res.json({
        ok: true,
        note,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'getNote',
        requestId: (req as any).id,
      });
    }
  });

  router.patch('/:id', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const wallet = req.wallet!;
      
      const paramResult = noteIdSchema.safeParse({ id });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid note ID');
      }
      
      const result = updateNoteSchema.safeParse(req.body);
      if (!result.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid request data', result.error.errors);
      }
      
      const note = await storage.getNote(id);
      
      if (!note) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Note not found');
      }
      
      if (note.walletAddress !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied');
      }
      
      const updateData: any = { ...result.data };
      if (typeof updateData.isPinned === 'boolean') {
        updateData.isPinned = updateData.isPinned ? 1 : 0;
      }
      
      const updatedNote = await storage.updateNote(id, updateData);
      
      logger.info('Note updated', { noteId: id, wallet });
      
      res.json({
        ok: true,
        note: updatedNote,
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'updateNote',
        requestId: (req as any).id,
      });
    }
  });

  router.delete('/:id', requireSession, async (req: SessionRequest, res: Response) => {
    try {
      const { id } = req.params;
      const wallet = req.wallet!;
      
      const paramResult = noteIdSchema.safeParse({ id });
      if (!paramResult.success) {
        throw new AppError(ErrorCategory.VALIDATION, 'Invalid note ID');
      }
      
      const note = await storage.getNote(id);
      
      if (!note) {
        throw new AppError(ErrorCategory.NOT_FOUND, 'Note not found');
      }
      
      if (note.walletAddress !== wallet) {
        throw new AppError(ErrorCategory.AUTHORIZATION, 'Access denied');
      }
      
      await storage.deleteNote(id);
      
      logger.info('Note deleted', { noteId: id, wallet });
      
      res.json({
        ok: true,
        message: 'Note deleted successfully',
      });
    } catch (error) {
      handleError(error, res, {
        operation: 'deleteNote',
        requestId: (req as any).id,
      });
    }
  });

  return router;
}
