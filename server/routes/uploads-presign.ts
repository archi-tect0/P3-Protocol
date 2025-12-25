import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateJWT, type AuthenticatedRequest } from '../auth';
import { rootLogger } from '../observability/logger';
import * as crypto from 'crypto';

const logger = rootLogger.child({ module: 'uploads-presign' });

/**
 * Presigned Upload Routes for P3 Tier 2-3 Scaling
 * 
 * Features:
 * - Generate presigned URLs for direct S3/GCS uploads
 * - Bypass server for large file uploads
 * - Supports future cloud storage integration
 */

const presignRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  contentLength: z.number().positive(),
  metadata: z.record(z.string()).optional(),
});

type PresignRequest = z.infer<typeof presignRequestSchema>;

interface PresignedUpload {
  url: string;
  key: string;
  fields?: Record<string, string>;
  expiresAt: number;
}

interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

function getS3Config(): S3Config | null {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || process.env.AWS_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    return null;
  }
  
  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint: process.env.S3_ENDPOINT,
  };
}

function generateUploadKey(filename: string, userId: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  return `uploads/${userId}/${timestamp}-${random}${ext ? '.' + ext : ''}`;
}

async function createPresignedUrl(
  config: S3Config,
  key: string,
  contentType: string,
  contentLength: number,
  expiresIn: number = 3600
): Promise<PresignedUpload> {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    
    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    });
    
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    
    const url = await getSignedUrl(client, command, { expiresIn });
    
    return {
      url,
      key,
      expiresAt: Date.now() + expiresIn * 1000,
    };
  } catch (error) {
    logger.warn('S3 SDK not available, using stub implementation', { error });
    throw new Error('S3 SDK not available');
  }
}

function createStubPresignedUrl(key: string, contentType: string): PresignedUpload {
  const uploadId = crypto.randomBytes(16).toString('hex');
  
  return {
    url: `/api/upload/direct/${uploadId}`,
    key,
    fields: {
      'Content-Type': contentType,
      'X-Upload-Key': key,
    },
    expiresAt: Date.now() + 3600 * 1000,
  };
}

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

export function createPresignRoutes(): Router {
  const router = Router();

  /**
   * POST /api/uploads/presign
   * Generate a presigned URL for direct S3/GCS upload
   */
  router.post(
    '/api/uploads/presign',
    authenticateJWT,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const walletAddress = getWalletAddress(req);
        
        const parseResult = presignRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: parseResult.error.errors,
          });
          return;
        }
        
        const { filename, contentType, contentLength, metadata } = parseResult.data;
        
        const maxSize = 500 * 1024 * 1024;
        if (contentLength > maxSize) {
          res.status(400).json({
            error: `File size exceeds maximum allowed (${maxSize} bytes)`,
          });
          return;
        }
        
        const key = generateUploadKey(filename, walletAddress);
        
        const s3Config = getS3Config();
        
        let presignedUpload: PresignedUpload;
        let useDirectUpload = false;
        
        if (s3Config) {
          try {
            presignedUpload = await createPresignedUrl(
              s3Config,
              key,
              contentType,
              contentLength
            );
            
            logger.info('Generated presigned URL', {
              key,
              contentType,
              contentLength,
              walletAddress,
            });
          } catch {
            presignedUpload = createStubPresignedUrl(key, contentType);
            useDirectUpload = true;
            
            logger.info('Using stub presigned URL (S3 not available)', {
              key,
              contentType,
              walletAddress,
            });
          }
        } else {
          presignedUpload = createStubPresignedUrl(key, contentType);
          useDirectUpload = true;
          
          logger.info('Using stub presigned URL (S3 not configured)', {
            key,
            contentType,
            walletAddress,
          });
        }
        
        res.json({
          url: presignedUpload.url,
          key: presignedUpload.key,
          fields: presignedUpload.fields,
          expiresAt: presignedUpload.expiresAt,
          method: useDirectUpload ? 'direct' : 's3',
        });
      } catch (error) {
        logger.error('Presign error', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to generate presigned URL',
        });
      }
    }
  );

  /**
   * GET /api/uploads/presign/status
   * Check if presigned uploads are available
   */
  router.get(
    '/api/uploads/presign/status',
    authenticateJWT,
    async (_req: AuthenticatedRequest, res: Response) => {
      const s3Config = getS3Config();
      
      res.json({
        s3Available: !!s3Config,
        maxFileSize: 500 * 1024 * 1024,
        supportedMethods: s3Config ? ['s3', 'direct'] : ['direct'],
        expiresIn: 3600,
      });
    }
  );

  /**
   * POST /api/uploads/presign/multipart/init
   * Initialize a multipart upload for very large files
   */
  router.post(
    '/api/uploads/presign/multipart/init',
    authenticateJWT,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const walletAddress = getWalletAddress(req);
        
        const parseResult = presignRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: parseResult.error.errors,
          });
          return;
        }
        
        const { filename, contentType, contentLength } = parseResult.data;
        const key = generateUploadKey(filename, walletAddress);
        
        const s3Config = getS3Config();
        
        if (s3Config) {
          try {
            const { S3Client, CreateMultipartUploadCommand } = await import('@aws-sdk/client-s3');
            
            const client = new S3Client({
              region: s3Config.region,
              credentials: {
                accessKeyId: s3Config.accessKeyId,
                secretAccessKey: s3Config.secretAccessKey,
              },
              ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
            });
            
            const command = new CreateMultipartUploadCommand({
              Bucket: s3Config.bucket,
              Key: key,
              ContentType: contentType,
            });
            
            const response = await client.send(command);
            
            res.json({
              uploadId: response.UploadId,
              key,
              bucket: s3Config.bucket,
              partSize: 5 * 1024 * 1024,
            });
            
            return;
          } catch (error) {
            logger.warn('S3 multipart init failed, falling back to stub', { error });
          }
        }
        
        const uploadId = crypto.randomBytes(16).toString('hex');
        
        res.json({
          uploadId,
          key,
          method: 'chunked',
          partSize: 512 * 1024,
          endpoint: '/api/upload/chunk',
        });
        
      } catch (error) {
        logger.error('Multipart init error', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to initialize multipart upload',
        });
      }
    }
  );

  /**
   * POST /api/uploads/presign/multipart/part
   * Get presigned URL for uploading a specific part
   */
  router.post(
    '/api/uploads/presign/multipart/part',
    authenticateJWT,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { uploadId, key, partNumber } = req.body;
        
        if (!uploadId || !key || typeof partNumber !== 'number') {
          res.status(400).json({
            error: 'Missing required fields: uploadId, key, partNumber',
          });
          return;
        }
        
        const s3Config = getS3Config();
        
        if (s3Config) {
          try {
            const { S3Client, UploadPartCommand } = await import('@aws-sdk/client-s3');
            const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
            
            const client = new S3Client({
              region: s3Config.region,
              credentials: {
                accessKeyId: s3Config.accessKeyId,
                secretAccessKey: s3Config.secretAccessKey,
              },
              ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
            });
            
            const command = new UploadPartCommand({
              Bucket: s3Config.bucket,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
            });
            
            const url = await getSignedUrl(client, command, { expiresIn: 3600 });
            
            res.json({
              url,
              partNumber,
              expiresAt: Date.now() + 3600 * 1000,
            });
            
            return;
          } catch (error) {
            logger.warn('S3 part presign failed', { error });
          }
        }
        
        res.json({
          url: `/api/upload/chunk`,
          partNumber,
          headers: {
            'X-Upload-Id': uploadId,
            'X-Part-Number': partNumber.toString(),
          },
        });
        
      } catch (error) {
        logger.error('Multipart part error', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to generate part URL',
        });
      }
    }
  );

  /**
   * POST /api/uploads/presign/multipart/complete
   * Complete a multipart upload
   */
  router.post(
    '/api/uploads/presign/multipart/complete',
    authenticateJWT,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { uploadId, key, parts } = req.body;
        
        if (!uploadId || !key || !Array.isArray(parts)) {
          res.status(400).json({
            error: 'Missing required fields: uploadId, key, parts',
          });
          return;
        }
        
        const s3Config = getS3Config();
        
        if (s3Config) {
          try {
            const { S3Client, CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');
            
            const client = new S3Client({
              region: s3Config.region,
              credentials: {
                accessKeyId: s3Config.accessKeyId,
                secretAccessKey: s3Config.secretAccessKey,
              },
              ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
            });
            
            const command = new CompleteMultipartUploadCommand({
              Bucket: s3Config.bucket,
              Key: key,
              UploadId: uploadId,
              MultipartUpload: {
                Parts: parts.map((part: { partNumber: number; etag: string }) => ({
                  PartNumber: part.partNumber,
                  ETag: part.etag,
                })),
              },
            });
            
            const response = await client.send(command);
            
            res.json({
              success: true,
              location: response.Location,
              key,
              etag: response.ETag,
            });
            
            return;
          } catch (error) {
            logger.warn('S3 multipart complete failed', { error });
          }
        }
        
        res.json({
          success: true,
          key,
          method: 'chunked',
        });
        
      } catch (error) {
        logger.error('Multipart complete error', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Failed to complete multipart upload',
        });
      }
    }
  );

  return router;
}
