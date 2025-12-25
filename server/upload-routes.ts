import { Router, Response, Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { getIPFSService } from './services/ipfs';
import { authenticateJWT, type AuthenticatedRequest } from './auth';
import type { IStorage } from './storage';
import { anchorToBlockchain } from './middleware/anchoring';
import { ReceiptService } from './services/receipts';
import { rootLogger } from './observability/logger';

const logger = rootLogger.child({ module: 'upload-routes' });

/**
 * In-memory storage for chunked uploads
 * In production, this should be replaced with Redis or a distributed cache
 */
interface ChunkUploadState {
  chunks: Map<number, Buffer>;
  totalSize: number;
  filename?: string;
  mimetype?: string;
  createdAt: number;
  lastUpdated: number;
}

const chunkedUploads = new Map<string, ChunkUploadState>();

const CHUNK_UPLOAD_TTL = 24 * 60 * 60 * 1000;

function cleanupExpiredUploads() {
  const now = Date.now();
  for (const [id, state] of chunkedUploads.entries()) {
    if (now - state.lastUpdated > CHUNK_UPLOAD_TTL) {
      chunkedUploads.delete(id);
      logger.info('Cleaned up expired chunked upload', { uploadId: id });
    }
  }
}

setInterval(cleanupExpiredUploads, 60 * 60 * 1000);

/**
 * Extend AuthenticatedRequest with file property from multer
 */
interface AuthenticatedRequestWithFile extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

/**
 * Upload Routes - File and Video Upload with IPFS Integration
 * 
 * Features:
 * - File upload to IPFS via Pinata
 * - Video upload with metadata
 * - Optional blockchain anchoring
 * - Receipt generation for uploaded content
 * - Graceful fallback when IPFS is not configured
 */

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (_req: any, _file: any, cb: any) => {
    // Accept all file types - validation will be done per route
    cb(null, true);
  },
});

// Validation schemas
const uploadMetadataSchema = z.object({
  shouldAnchor: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().optional().default(false)
  ),
  type: z.enum(['video', 'audio', 'image', 'document', 'other']).optional(),
  description: z.string().optional(),
  metadata: z.preprocess(
    (val) => {
      if (!val || typeof val !== 'string') return undefined;
      try {
        return JSON.parse(val);
      } catch {
        return undefined;
      }
    },
    z.any().optional()
  ),
});

/**
 * Helper to validate and parse form data
 */
function validateFormData<T>(schema: z.ZodSchema<T>, data: any): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Helper to extract wallet address from authenticated user
 */
function getWalletAddress(req: AuthenticatedRequest): string {
  if (!req.user) {
    throw new Error('Not authenticated');
  }
  
  const email = (req.user as any).email || '';
  if (email.endsWith('@wallet')) {
    return email.replace('@wallet', '');
  }
  
  return req.user.userId;
}

/**
 * Create upload routes
 */
export function createUploadRoutes(storage: IStorage): Router {
  const router = Router();
  const ipfsService = getIPFSService();
  const receiptService = new ReceiptService(storage);

  /**
   * GET /api/upload/status
   * Check IPFS service status
   */
  router.get('/api/upload/status', authenticateJWT, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const status = ipfsService.getStatus();
      
      res.json({
        ipfs: status,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        supportedTypes: ['video', 'audio', 'image', 'document', 'other'],
      });
    } catch (error) {
      logger.error('Failed to get upload status', error as Error);
      res.status(500).json({ error: 'Failed to get upload status' });
    }
  });

  /**
   * POST /api/upload/file
   * Upload a file to IPFS with optional blockchain anchoring
   */
  router.post(
    '/api/upload/file',
    authenticateJWT,
    upload.single('file'),
    async (req: AuthenticatedRequestWithFile, res: Response) => {
      try {
        const walletAddress = getWalletAddress(req);

        if (!req.file) {
          res.status(400).json({ error: 'No file provided' });
          return;
        }

        // Validate metadata
        const formData = validateFormData(uploadMetadataSchema, req.body);

        logger.info('File upload requested', {
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          walletAddress,
        });

        // Upload to IPFS
        const ipfsResult = await ipfsService.uploadFile(req.file.buffer, {
          name: req.file.originalname,
          metadata: {
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadedBy: walletAddress,
            uploadedAt: new Date().toISOString(),
            type: formData.type || 'other',
            description: formData.description,
            ...(formData.metadata || {}),
          },
        });

        if (!ipfsResult.success) {
          logger.error('IPFS upload failed', new Error(ipfsResult.error || 'Unknown error'));
          res.status(500).json({
            error: ipfsResult.error || 'Failed to upload file to IPFS',
          });
          return;
        }

        const cid = ipfsResult.cid!;

        // Anchor to blockchain if requested
        let anchorResult = null;
        let receipt = null;

        if (formData.shouldAnchor) {
          anchorResult = await anchorToBlockchain(cid, 'file', true);

          // Create receipt if anchored successfully
          if (anchorResult.anchorStatus !== 'failed') {
            try {
              receipt = await receiptService.createReceipt({
                type: 'message',
                subjectId: cid,
                content: cid,
                actor: walletAddress,
                ipfsCid: cid,
                anchorTxHash: anchorResult.anchorTxHash || undefined,
              });
            } catch (receiptError) {
              logger.error('Receipt creation error', receiptError as Error);
            }
          }
        }

        // Log audit trail
        await storage.appendAuditLog({
          entityType: 'file_upload',
          entityId: cid,
          action: 'uploaded',
          actor: walletAddress,
          meta: {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            ipfsCid: cid,
            anchored: formData.shouldAnchor || false,
            anchorStatus: anchorResult?.anchorStatus || 'none',
            receiptId: receipt?.id || null,
          },
        });

        logger.info('File uploaded successfully', {
          cid,
          filename: req.file.originalname,
          anchored: formData.shouldAnchor,
        });

        res.status(201).json({
          success: true,
          cid,
          gatewayUrl: ipfsResult.gatewayUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          anchored: formData.shouldAnchor || false,
          anchorTxHash: anchorResult?.anchorTxHash || null,
          anchorStatus: anchorResult?.anchorStatus || 'none',
          receiptId: receipt?.id || null,
        });
      } catch (error) {
        logger.error('File upload error', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to upload file',
        });
      }
    }
  );

  /**
   * POST /api/upload/video
   * Upload a video file to IPFS (alias for /api/upload/file with video type)
   */
  router.post(
    '/api/upload/video',
    authenticateJWT,
    upload.single('video'),
    async (req: AuthenticatedRequestWithFile, res: Response) => {
      try {
        const walletAddress = getWalletAddress(req);

        if (!req.file) {
          res.status(400).json({ error: 'No video file provided' });
          return;
        }

        // Validate video mimetype
        if (!req.file.mimetype.startsWith('video/')) {
          res.status(400).json({ error: 'File must be a video' });
          return;
        }

        // Validate metadata
        const formData = validateFormData(uploadMetadataSchema, req.body);

        logger.info('Video upload requested', {
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          walletAddress,
        });

        // Upload to IPFS
        const ipfsResult = await ipfsService.uploadFile(req.file.buffer, {
          name: req.file.originalname,
          metadata: {
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadedBy: walletAddress,
            uploadedAt: new Date().toISOString(),
            type: 'video',
            description: formData.description,
            ...(formData.metadata || {}),
          },
        });

        if (!ipfsResult.success) {
          logger.error('IPFS video upload failed', new Error(ipfsResult.error || 'Unknown error'));
          res.status(500).json({
            error: ipfsResult.error || 'Failed to upload video to IPFS',
          });
          return;
        }

        const cid = ipfsResult.cid!;

        // Anchor to blockchain if requested
        let anchorResult = null;
        let receipt = null;

        if (formData.shouldAnchor) {
          anchorResult = await anchorToBlockchain(cid, 'video', true);

          // Create receipt if anchored successfully
          if (anchorResult.anchorStatus !== 'failed') {
            try {
              receipt = await receiptService.createReceipt({
                type: 'message',
                subjectId: cid,
                content: cid,
                actor: walletAddress,
                ipfsCid: cid,
                anchorTxHash: anchorResult.anchorTxHash || undefined,
              });
            } catch (receiptError) {
              logger.error('Receipt creation error', receiptError as Error);
            }
          }
        }

        // Log audit trail
        await storage.appendAuditLog({
          entityType: 'video_upload',
          entityId: cid,
          action: 'uploaded',
          actor: walletAddress,
          meta: {
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            ipfsCid: cid,
            anchored: formData.shouldAnchor || false,
            anchorStatus: anchorResult?.anchorStatus || 'none',
            receiptId: receipt?.id || null,
          },
        });

        logger.info('Video uploaded successfully', {
          cid,
          filename: req.file.originalname,
          anchored: formData.shouldAnchor,
        });

        res.status(201).json({
          success: true,
          cid,
          gatewayUrl: ipfsResult.gatewayUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
          anchored: formData.shouldAnchor || false,
          anchorTxHash: anchorResult?.anchorTxHash || null,
          anchorStatus: anchorResult?.anchorStatus || 'none',
          receiptId: receipt?.id || null,
        });
      } catch (error) {
        logger.error('Video upload error', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to upload video',
        });
      }
    }
  );

  /**
   * POST /api/upload/json
   * Upload JSON data to IPFS
   */
  router.post('/api/upload/json', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const { data, name, shouldAnchor } = req.body;

      if (!data) {
        res.status(400).json({ error: 'No data provided' });
        return;
      }

      logger.info('JSON upload requested', {
        name,
        walletAddress,
      });

      // Upload to IPFS
      const ipfsResult = await ipfsService.uploadJSON(data, {
        name: name || 'data.json',
        metadata: {
          uploadedBy: walletAddress,
          uploadedAt: new Date().toISOString(),
        },
      });

      if (!ipfsResult.success) {
        logger.error('IPFS JSON upload failed', new Error(ipfsResult.error || 'Unknown error'));
        res.status(500).json({
          error: ipfsResult.error || 'Failed to upload JSON to IPFS',
        });
        return;
      }

      const cid = ipfsResult.cid!;

      // Anchor to blockchain if requested
      let anchorResult = null;
      let receipt = null;

      if (shouldAnchor) {
        anchorResult = await anchorToBlockchain(cid, 'json', true);

        // Create receipt if anchored successfully
        if (anchorResult.anchorStatus !== 'failed') {
          try {
            receipt = await receiptService.createReceipt({
              type: 'message',
              subjectId: cid,
              content: cid,
              actor: walletAddress,
            });
          } catch (receiptError) {
            logger.error('Receipt creation error', receiptError as Error);
          }
        }
      }

      // Log audit trail
      await storage.appendAuditLog({
        entityType: 'json_upload',
        entityId: cid,
        action: 'uploaded',
        actor: walletAddress,
        meta: {
          name,
          ipfsCid: cid,
          anchored: shouldAnchor || false,
          anchorStatus: anchorResult?.anchorStatus || 'none',
          receiptId: receipt?.id || null,
        },
      });

      logger.info('JSON uploaded successfully', {
        cid,
        name,
        anchored: shouldAnchor,
      });

      res.status(201).json({
        success: true,
        cid,
        gatewayUrl: ipfsResult.gatewayUrl,
        name,
        anchored: shouldAnchor || false,
        anchorTxHash: anchorResult?.anchorTxHash || null,
        anchorStatus: anchorResult?.anchorStatus || 'none',
        receiptId: receipt?.id || null,
      });
    } catch (error) {
      logger.error('JSON upload error', error as Error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to upload JSON',
      });
    }
  });

  /**
   * POST /api/upload/chunk
   * Receive a chunk of a file being uploaded in parallel
   * Headers: X-Upload-Id, Content-Range (start-end/total)
   */
  router.post('/api/upload/chunk', async (req: Request, res: Response) => {
    try {
      const uploadId = req.headers['x-upload-id'] as string;
      const contentRange = req.headers['content-range'] as string;

      if (!uploadId) {
        res.status(400).json({ error: 'Missing X-Upload-Id header' });
        return;
      }

      if (!contentRange) {
        res.status(400).json({ error: 'Missing Content-Range header' });
        return;
      }

      const rangeMatch = contentRange.match(/^(\d+)-(\d+)\/(\d+)$/);
      if (!rangeMatch) {
        res.status(400).json({ error: 'Invalid Content-Range format. Expected: start-end/total' });
        return;
      }

      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const total = parseInt(rangeMatch[3], 10);

      if (isNaN(start) || isNaN(end) || isNaN(total)) {
        res.status(400).json({ error: 'Invalid range values' });
        return;
      }

      if (start > end || end >= total) {
        res.status(400).json({ error: 'Invalid range: start must be <= end, end must be < total' });
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const chunkBuffer = Buffer.concat(chunks);

      const expectedSize = end - start + 1;
      if (chunkBuffer.length !== expectedSize) {
        res.status(400).json({ 
          error: `Chunk size mismatch. Expected ${expectedSize}, got ${chunkBuffer.length}` 
        });
        return;
      }

      let uploadState = chunkedUploads.get(uploadId);
      if (!uploadState) {
        uploadState = {
          chunks: new Map(),
          totalSize: total,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
        };
        chunkedUploads.set(uploadId, uploadState);
      }

      if (uploadState.totalSize !== total) {
        res.status(400).json({ error: 'Total size mismatch with existing upload' });
        return;
      }

      uploadState.chunks.set(start, chunkBuffer);
      uploadState.lastUpdated = Date.now();

      let receivedBytes = 0;
      for (const chunk of uploadState.chunks.values()) {
        receivedBytes += chunk.length;
      }

      logger.debug('Chunk received', {
        uploadId,
        start,
        end,
        total,
        chunkSize: chunkBuffer.length,
        receivedBytes,
        chunksCount: uploadState.chunks.size,
      });

      res.json({
        success: true,
        uploadId,
        start,
        end,
        receivedBytes,
        totalBytes: total,
        complete: receivedBytes === total,
      });
    } catch (error) {
      logger.error('Chunk upload error', error as Error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to upload chunk',
      });
    }
  });

  /**
   * POST /api/upload/complete
   * Finalize a chunked upload and assemble the file
   * Headers: X-Upload-Id
   */
  router.post('/api/upload/complete', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const walletAddress = getWalletAddress(req);
      const uploadId = req.headers['x-upload-id'] as string;

      if (!uploadId) {
        res.status(400).json({ error: 'Missing X-Upload-Id header' });
        return;
      }

      const uploadState = chunkedUploads.get(uploadId);
      if (!uploadState) {
        res.status(404).json({ error: 'Upload not found' });
        return;
      }

      const { filename, mimetype, totalSize } = req.body || {};

      const sortedOffsets = Array.from(uploadState.chunks.keys()).sort((a, b) => a - b);
      
      let expectedOffset = 0;
      for (const offset of sortedOffsets) {
        if (offset !== expectedOffset) {
          res.status(400).json({ 
            error: `Missing chunk at offset ${expectedOffset}. Upload is incomplete.` 
          });
          return;
        }
        const chunk = uploadState.chunks.get(offset)!;
        expectedOffset += chunk.length;
      }

      if (expectedOffset !== uploadState.totalSize) {
        res.status(400).json({ 
          error: `Upload incomplete. Received ${expectedOffset} of ${uploadState.totalSize} bytes.` 
        });
        return;
      }

      const sortedChunks = sortedOffsets.map(offset => uploadState.chunks.get(offset)!);
      const completeBuffer = Buffer.concat(sortedChunks);

      logger.info('Assembling chunked upload', {
        uploadId,
        totalChunks: sortedChunks.length,
        totalSize: completeBuffer.length,
        walletAddress,
      });

      const ipfsResult = await ipfsService.uploadFile(completeBuffer, {
        name: filename || `upload-${uploadId}`,
        metadata: {
          mimetype: mimetype || 'application/octet-stream',
          size: completeBuffer.length,
          uploadedBy: walletAddress,
          uploadedAt: new Date().toISOString(),
          uploadMethod: 'chunked',
          uploadId,
        },
      });

      chunkedUploads.delete(uploadId);

      if (!ipfsResult.success) {
        logger.error('IPFS upload failed for chunked upload', new Error(ipfsResult.error || 'Unknown error'));
        res.status(500).json({
          error: ipfsResult.error || 'Failed to upload to IPFS',
        });
        return;
      }

      const cid = ipfsResult.cid!;

      await storage.appendAuditLog({
        entityType: 'chunked_upload',
        entityId: cid,
        action: 'completed',
        actor: walletAddress,
        meta: {
          uploadId,
          filename,
          size: completeBuffer.length,
          mimetype,
          ipfsCid: cid,
          chunksCount: sortedChunks.length,
        },
      });

      logger.info('Chunked upload completed', {
        uploadId,
        cid,
        size: completeBuffer.length,
        walletAddress,
      });

      res.status(201).json({
        success: true,
        uploadId,
        cid,
        gatewayUrl: ipfsResult.gatewayUrl,
        size: completeBuffer.length,
        filename,
        mimetype,
      });
    } catch (error) {
      logger.error('Complete upload error', error as Error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to complete upload',
      });
    }
  });

  /**
   * GET /api/upload/status/:uploadId
   * Get status of a chunked upload in progress
   */
  router.get('/api/upload/status/:uploadId', async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;

      const uploadState = chunkedUploads.get(uploadId);
      if (!uploadState) {
        res.status(404).json({ error: 'Upload not found' });
        return;
      }

      let receivedBytes = 0;
      const uploadedRanges: [number, number][] = [];
      
      const sortedOffsets = Array.from(uploadState.chunks.keys()).sort((a, b) => a - b);
      for (const offset of sortedOffsets) {
        const chunk = uploadState.chunks.get(offset)!;
        receivedBytes += chunk.length;
        uploadedRanges.push([offset, offset + chunk.length - 1]);
      }

      res.json({
        uploadId,
        totalSize: uploadState.totalSize,
        receivedBytes,
        complete: receivedBytes === uploadState.totalSize,
        chunksCount: uploadState.chunks.size,
        uploadedRanges,
        createdAt: uploadState.createdAt,
        lastUpdated: uploadState.lastUpdated,
      });
    } catch (error) {
      logger.error('Upload status error', error as Error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get upload status',
      });
    }
  });

  /**
   * HEAD /api/upload/exists/:uploadId
   * Check if a completed upload exists (for deduplication)
   */
  router.head('/api/upload/exists/:uploadId', async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;
      
      const uploadState = chunkedUploads.get(uploadId);
      if (uploadState) {
        res.status(200).end();
        return;
      }
      
      res.status(404).end();
    } catch (error) {
      logger.error('Upload exists check error', error as Error);
      res.status(500).end();
    }
  });

  /**
   * DELETE /api/upload/:uploadId
   * Cancel an in-progress chunked upload
   */
  router.delete('/api/upload/:uploadId', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uploadId } = req.params;
      const walletAddress = getWalletAddress(req);

      const uploadState = chunkedUploads.get(uploadId);
      if (!uploadState) {
        res.status(404).json({ error: 'Upload not found' });
        return;
      }

      chunkedUploads.delete(uploadId);

      await storage.appendAuditLog({
        entityType: 'chunked_upload',
        entityId: uploadId,
        action: 'cancelled',
        actor: walletAddress,
        meta: {
          uploadId,
          receivedChunks: uploadState.chunks.size,
        },
      });

      logger.info('Chunked upload cancelled', {
        uploadId,
        walletAddress,
      });

      res.json({
        success: true,
        uploadId,
        message: 'Upload cancelled',
      });
    } catch (error) {
      logger.error('Cancel upload error', error as Error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to cancel upload',
      });
    }
  });

  return router;
}
