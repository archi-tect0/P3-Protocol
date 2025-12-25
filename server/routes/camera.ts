import { Router, Request, Response } from 'express';
import { db } from '../db';
import { cameraCaptures, CameraCapture } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { createHash } from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[CAMERA] ${msg}`),
  error: (msg: string) => console.error(`[CAMERA ERROR] ${msg}`),
};

const CAMERA_DIR = 'uploads/camera';
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_CAPTURES_PER_WALLET = 500;

function isValidWalletAddress(wallet: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(wallet);
}

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const wallet = req.headers['x-wallet-address'] as string;
    if (!wallet || !isValidWalletAddress(wallet)) {
      return cb(new Error('Valid wallet address required in x-wallet-address header'), '');
    }
    
    const normalizedWallet = wallet.toLowerCase();
    const walletDir = path.join(CAMERA_DIR, normalizedWallet);
    
    const resolvedPath = path.resolve(walletDir);
    const baseDir = path.resolve(CAMERA_DIR);
    if (!resolvedPath.startsWith(baseDir)) {
      return cb(new Error('Invalid wallet address'), '');
    }
    
    try {
      await fs.mkdir(walletDir, { recursive: true });
      cb(null, walletDir);
    } catch (err: any) {
      cb(err, '');
    }
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `capture-${timestamp}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

const annotateSchema = z.object({
  annotations: z.array(z.object({
    type: z.enum(['box', 'highlight', 'label', 'mask']),
    coordinates: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
    label: z.string().optional(),
    color: z.string().optional(),
  })).optional(),
  processOcr: z.boolean().optional().default(false),
  recognizeEquations: z.boolean().optional().default(false),
  provider: z.enum(['openai', 'anthropic', 'gemini']).optional(),
});

function createReceiptHash(data: any): string {
  return '0x' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function requireWallet(req: Request, res: Response): string | null {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(401).json({ error: 'Valid wallet address required in x-wallet-address header' });
    return null;
  }
  return wallet.toLowerCase();
}

async function processWithAI(
  imagePath: string,
  options: { ocr?: boolean; equations?: boolean; provider?: string },
  walletAddress: string
): Promise<{ ocrResult?: any; equations?: any; providerMeta?: any }> {
  const result: any = {};
  
  if (!options.ocr && !options.equations) {
    return result;
  }

  const prompt = options.equations 
    ? 'Analyze this image. Extract any text visible (OCR) and identify any mathematical equations. For equations, provide both the raw text and LaTeX representation. Return as JSON with "text", "equations" (array of {raw, latex, description}) fields.'
    : 'Extract all visible text from this image (OCR). Return as JSON with "text" field containing the extracted text, and "blocks" array with text regions.';

  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-wallet-address': walletAddress,
      },
      body: JSON.stringify({
        messages: [
          { 
            role: 'user', 
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
            ],
          },
        ],
        provider: options.provider || 'openai',
        stream: false,
      }),
    });

    if (response.ok) {
      const data = await response.json() as {
        message?: { content?: string };
        content?: string;
        model?: string;
        usage?: { input: number; output: number; total: number };
      };
      const content = data.message?.content || data.content || '';
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (options.ocr) {
            result.ocrResult = {
              text: parsed.text || '',
              blocks: parsed.blocks || [],
              confidence: parsed.confidence,
            };
          }
          if (options.equations && parsed.equations) {
            result.equations = parsed.equations;
          }
        }
      } catch {
        result.ocrResult = { text: content, raw: true };
      }

      result.providerMeta = {
        provider: options.provider || 'openai',
        model: data.model,
        usage: data.usage,
        processedAt: new Date().toISOString(),
      };
    }
  } catch (err: any) {
    logger.error(`AI processing failed: ${err.message}`);
    result.providerMeta = { error: err.message };
  }

  return result;
}

router.post('/capture', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const existingCount = await db.select().from(cameraCaptures)
      .where(eq(cameraCaptures.walletAddress, wallet));
    
    if (existingCount.length >= MAX_CAPTURES_PER_WALLET) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ 
        error: `Maximum ${MAX_CAPTURES_PER_WALLET} captures per wallet`,
      });
    }

    const name = req.body.name || `Capture ${new Date().toLocaleString()}`;
    const source = req.body.source || 'upload';

    const receiptHash = createReceiptHash({
      wallet,
      path: req.file.path,
      timestamp: Date.now(),
    });

    const [capture] = await db.insert(cameraCaptures).values({
      walletAddress: wallet,
      name,
      path: req.file.path,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      source,
      receiptHash,
    }).returning();

    logger.info(`Camera capture ${capture.id} created for wallet ${wallet}`);

    res.status(201).json({
      capture: {
        id: capture.id,
        name: capture.name,
        path: capture.path,
        mimeType: capture.mimeType,
        sizeBytes: capture.sizeBytes,
        source: capture.source,
        createdAt: capture.createdAt,
      },
      receipt: {
        hash: receiptHash,
        wallet,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error(`Capture failed: ${err.message}`);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/annotate', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = annotateSchema.parse(req.body);

    const [capture] = await db.select().from(cameraCaptures)
      .where(and(
        eq(cameraCaptures.id, req.params.id),
        eq(cameraCaptures.walletAddress, wallet)
      ));

    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }

    const updates: Partial<CameraCapture> = {};
    
    if (parsed.annotations) {
      updates.annotations = parsed.annotations;
    }

    if (parsed.processOcr || parsed.recognizeEquations) {
      const aiResult = await processWithAI(
        capture.path,
        { 
          ocr: parsed.processOcr, 
          equations: parsed.recognizeEquations,
          provider: parsed.provider,
        },
        wallet
      );

      if (aiResult.ocrResult) {
        updates.ocrResult = aiResult.ocrResult;
      }
      if (aiResult.equations) {
        updates.recognizedEquations = aiResult.equations;
      }
      if (aiResult.providerMeta) {
        updates.providerMeta = aiResult.providerMeta;
      }
    }

    const [updated] = await db.update(cameraCaptures)
      .set(updates)
      .where(eq(cameraCaptures.id, req.params.id))
      .returning();

    logger.info(`Camera capture ${req.params.id} annotated for wallet ${wallet}`);

    res.json({
      capture: updated,
      receipt: {
        hash: createReceiptHash({ ...updates, captureId: req.params.id, wallet }),
        wallet,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error(`Annotation failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const captures = await db.select().from(cameraCaptures)
      .where(eq(cameraCaptures.walletAddress, wallet))
      .orderBy(desc(cameraCaptures.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      captures: captures.map(c => ({
        id: c.id,
        name: c.name,
        path: c.path,
        mimeType: c.mimeType,
        sizeBytes: c.sizeBytes,
        source: c.source,
        hasOcr: !!c.ocrResult,
        hasEquations: !!c.recognizedEquations,
        hasAnnotations: !!c.annotations,
        createdAt: c.createdAt,
      })),
      count: captures.length,
    });
  } catch (err: any) {
    logger.error(`Failed to list captures: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [capture] = await db.select().from(cameraCaptures)
      .where(and(
        eq(cameraCaptures.id, req.params.id),
        eq(cameraCaptures.walletAddress, wallet)
      ));

    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }

    res.json({ capture });
  } catch (err: any) {
    logger.error(`Failed to fetch capture: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/image', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [capture] = await db.select().from(cameraCaptures)
      .where(and(
        eq(cameraCaptures.id, req.params.id),
        eq(cameraCaptures.walletAddress, wallet)
      ));

    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }

    try {
      const stats = await fs.stat(capture.path);
      res.setHeader('Content-Type', capture.mimeType || 'image/png');
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      
      const fileStream = require('fs').createReadStream(capture.path);
      fileStream.pipe(res);
    } catch {
      return res.status(404).json({ error: 'Image file not found' });
    }
  } catch (err: any) {
    logger.error(`Failed to serve image: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [capture] = await db.select().from(cameraCaptures)
      .where(and(
        eq(cameraCaptures.id, req.params.id),
        eq(cameraCaptures.walletAddress, wallet)
      ));

    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }

    await fs.unlink(capture.path).catch(() => {});

    await db.delete(cameraCaptures).where(eq(cameraCaptures.id, req.params.id));

    logger.info(`Camera capture ${req.params.id} deleted for wallet ${wallet}`);

    res.json({
      deleted: true,
      receipt: {
        hash: createReceiptHash({ captureId: req.params.id, wallet, deleted: true }),
        wallet,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error(`Failed to delete capture: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
