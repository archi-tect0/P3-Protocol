import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { writerService } from '../atlas/suite/writer/service';

const router = Router();

const walletScopeSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  sessionId: z.string().min(1, 'Session ID is required'),
  profileId: z.string().optional()
});

const createDocSchema = z.object({
  scope: walletScopeSchema,
  init: z.object({
    title: z.string().optional(),
    blocks: z.array(z.object({
      blockType: z.enum(['paragraph', 'heading1', 'heading2', 'heading3', 'listOrdered', 'listUnordered', 'table', 'image', 'quote', 'codeBlock', 'embed']).optional(),
      text: z.string().optional(),
      marks: z.array(z.string()).optional(),
      attrs: z.record(z.unknown()).optional()
    })).optional()
  }).optional()
});

const insertTextSchema = z.object({
  scope: walletScopeSchema,
  blockId: z.string().uuid('Invalid block ID'),
  offset: z.number().int().min(0),
  text: z.string()
});

const applyStyleSchema = z.object({
  scope: walletScopeSchema,
  blockId: z.string().uuid('Invalid block ID'),
  marks: z.array(z.enum(['bold', 'italic', 'underline', 'code', 'link', 'strikethrough']))
});

const insertBlockSchema = z.object({
  scope: walletScopeSchema,
  block: z.object({
    blockType: z.enum(['paragraph', 'heading1', 'heading2', 'heading3', 'listOrdered', 'listUnordered', 'table', 'image', 'quote', 'codeBlock', 'embed']).optional(),
    text: z.string().optional(),
    marks: z.array(z.string()).optional(),
    attrs: z.record(z.unknown()).optional()
  }),
  position: z.object({
    afterId: z.string().uuid().optional()
  }).optional()
});

const deleteBlockSchema = z.object({
  scope: walletScopeSchema,
  blockId: z.string().uuid('Invalid block ID')
});

const trackChangesSchema = z.object({
  scope: walletScopeSchema,
  enabled: z.boolean()
});

const exportDocSchema = z.object({
  scope: walletScopeSchema,
  format: z.enum(['md', 'pdf', 'docx'])
});

const listDocsSchema = z.object({
  scope: walletScopeSchema
});

router.post('/docs', async (req: Request, res: Response) => {
  try {
    const parsed = createDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, init } = parsed.data;
    const result = await writerService.createDoc(scope, init);

    res.status(201).json({
      ok: true,
      doc: result.doc,
      artifact: result.artifact,
      receipt: result.receipt,
      'data-testid': 'writer-create-doc-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.get('/docs/:docId', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const result = await writerService.getDoc(docId);

    if (!result) {
      res.status(404).json({
        ok: false,
        error: 'Document not found',
        'data-testid': 'writer-not-found'
      });
      return;
    }

    res.json({
      ok: true,
      doc: result.doc,
      blocks: result.blocks,
      'data-testid': 'writer-get-doc-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/list', async (req: Request, res: Response) => {
  try {
    const parsed = listDocsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    const docs = await writerService.listDocs(scope);

    res.json({
      ok: true,
      docs,
      count: docs.length,
      'data-testid': 'writer-list-docs-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/:docId/insert-text', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const parsed = insertTextSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, blockId, offset, text } = parsed.data;
    const result = await writerService.insertText(docId, scope, blockId, offset, text);

    res.json({
      ok: true,
      block: result.block,
      receipt: result.receipt,
      'data-testid': 'writer-insert-text-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/:docId/apply-style', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const parsed = applyStyleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, blockId, marks } = parsed.data;
    const result = await writerService.applyStyle(docId, scope, blockId, marks);

    res.json({
      ok: true,
      block: result.block,
      receipt: result.receipt,
      'data-testid': 'writer-apply-style-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/:docId/insert-block', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const parsed = insertBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, block, position } = parsed.data;
    const result = await writerService.insertBlock(docId, scope, block, position);

    res.json({
      ok: true,
      block: result.block,
      receipt: result.receipt,
      'data-testid': 'writer-insert-block-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/:docId/delete-block', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const parsed = deleteBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, blockId } = parsed.data;
    const result = await writerService.deleteBlock(docId, scope, blockId);

    res.json({
      ok: true,
      receipt: result.receipt,
      'data-testid': 'writer-delete-block-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/:docId/track-changes', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const parsed = trackChangesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, enabled } = parsed.data;
    const result = await writerService.enableTrackChanges(docId, scope, enabled);

    res.json({
      ok: true,
      doc: result.doc,
      trackChangesEnabled: enabled,
      'data-testid': 'writer-track-changes-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.post('/docs/:docId/export', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const parsed = exportDocSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const { scope, format } = parsed.data;
    const result = await writerService.exportDoc(docId, scope, format);

    res.json({
      ok: true,
      format: result.format,
      content: result.content,
      filename: result.filename,
      mimeType: result.mimeType,
      'data-testid': 'writer-export-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.get('/docs/:docId/revisions', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    if (!docId || !/^[0-9a-f-]{36}$/i.test(docId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid document ID',
        'data-testid': 'writer-validation-error'
      });
      return;
    }

    const revisions = await writerService.getRevisions(docId);

    res.json({
      ok: true,
      revisions,
      count: revisions.length,
      'data-testid': 'writer-revisions-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'writer-error'
    });
  }
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'writer',
    timestamp: Date.now(),
    'data-testid': 'writer-health-response'
  });
});

export default router;
