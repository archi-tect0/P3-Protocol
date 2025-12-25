/**
 * P3 Uploads Optimization Module
 * 
 * Provides client-side utilities for optimized file uploads:
 * - Client-side image compression (WebP conversion)
 * - SHA-256 file hashing for deduplication
 * - Parallel chunked uploads with progress tracking
 * - Resume capability for interrupted uploads
 */

export {
  hashFile,
  toWebP,
  resizeImage,
  isImage,
  supportsWebP,
  compressIfNeeded,
  prepareForUpload,
  type CompressionResult,
} from './compress';

export {
  uploadParallel,
  uploadParallelAdvanced,
  resumeUpload,
  checkDedupe,
  type UploadProgress,
  type UploadOptions,
} from './parallel';
