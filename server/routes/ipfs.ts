import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { getIPFSService } from '../services/ipfs';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'ipfs-routes' });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp?: string;
}

interface PinataMetadata {
  name?: string;
  keyvalues?: Record<string, string>;
}

function generateMockCid(): string {
  const hash = crypto.randomBytes(32).toString('hex');
  return `Qm${hash.slice(0, 44)}`;
}

function parsePinataMetadata(metadataStr: string | undefined): PinataMetadata | undefined {
  if (!metadataStr) return undefined;
  try {
    return JSON.parse(metadataStr);
  } catch {
    return undefined;
  }
}

export function createIPFSRoutes(): Router {
  const router = Router();
  const ipfsService = getIPFSService();

  router.post(
    '/api/ipfs/upload',
    upload.single('file'),
    async (req: Request, res: Response) => {
      const startTime = Date.now();
      const requestId = crypto.randomBytes(8).toString('hex');

      try {
        if (!req.file) {
          logger.warn('IPFS upload attempt without file', { requestId });
          res.status(400).json({ error: 'No file provided' });
          return;
        }

        const pinataMetadata = parsePinataMetadata(req.body.pinataMetadata);
        const fileName = pinataMetadata?.name || req.file.originalname || 'encrypted-blob';

        logger.info('IPFS upload attempt', {
          requestId,
          fileName,
          size: req.file.size,
          mimetype: req.file.mimetype,
          hasMetadata: !!pinataMetadata,
        });

        if (!ipfsService.isEnabled()) {
          logger.info('IPFS not configured, using mock response', { requestId });

          const mockCid = generateMockCid();
          const mockResponse: PinataResponse = {
            IpfsHash: mockCid,
            PinSize: req.file.size,
            Timestamp: new Date().toISOString(),
          };

          logger.info('IPFS mock upload complete', {
            requestId,
            cid: mockCid,
            size: req.file.size,
            duration: Date.now() - startTime,
          });

          res.json(mockResponse);
          return;
        }

        const uploadResult = await ipfsService.uploadFile(req.file.buffer, {
          name: fileName,
          metadata: {
            mimetype: req.file.mimetype || 'application/octet-stream',
            size: String(req.file.size),
            uploadedAt: new Date().toISOString(),
            ...(pinataMetadata?.keyvalues || {}),
          },
        });

        if (!uploadResult.success || !uploadResult.cid) {
          logger.error('IPFS upload failed', new Error(uploadResult.error || 'Unknown error'), {
            requestId,
            fileName,
          });

          res.status(500).json({
            error: uploadResult.error || 'Failed to upload to IPFS',
          });
          return;
        }

        const response: PinataResponse = {
          IpfsHash: uploadResult.cid,
          PinSize: req.file.size,
          Timestamp: new Date().toISOString(),
        };

        logger.info('IPFS upload complete', {
          requestId,
          cid: uploadResult.cid,
          size: req.file.size,
          duration: Date.now() - startTime,
          gatewayUrl: uploadResult.gatewayUrl,
        });

        res.json(response);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('IPFS upload error', error as Error, {
          requestId,
          duration: Date.now() - startTime,
        });

        res.status(500).json({
          error: `Upload failed: ${errorMessage}`,
        });
      }
    }
  );

  router.get('/api/ipfs/status', async (_req: Request, res: Response) => {
    try {
      const status = ipfsService.getStatus();

      res.json({
        enabled: status.enabled,
        configured: status.configured,
        gateway: status.gateway,
        maxFileSize: 50 * 1024 * 1024,
      });
    } catch (error) {
      logger.error('Failed to get IPFS status', error as Error);
      res.status(500).json({ error: 'Failed to get IPFS status' });
    }
  });

  return router;
}

export default createIPFSRoutes;
