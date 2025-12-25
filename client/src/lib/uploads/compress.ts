/**
 * Client-Side Compression Utilities for P3 Uploads Optimization
 * 
 * Features:
 * - SHA-256 file hashing for deduplication and upload IDs
 * - WebP image conversion for reduced file sizes
 * - Canvas-based image processing
 */

/**
 * Generate SHA-256 hash of a file
 * Used for deduplication and as upload identifiers
 * 
 * @param file - The file to hash
 * @returns Promise<string> - Hex-encoded SHA-256 hash
 */
export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert an image file to WebP format for reduced file size
 * 
 * @param file - The source image file (JPEG, PNG, etc.)
 * @param quality - WebP quality setting (0-1), default 0.82
 * @returns Promise<File> - The converted WebP file
 */
export async function toWebP(file: File, quality = 0.82): Promise<File> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/webp', quality));
  return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
}

/**
 * Resize an image while maintaining aspect ratio
 * 
 * @param file - The source image file
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - Output quality (0-1)
 * @returns Promise<File> - The resized image as WebP
 */
export async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.82
): Promise<File> {
  const bmp = await createImageBitmap(file);
  
  let width = bmp.width;
  let height = bmp.height;
  
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  
  const blob = await new Promise<Blob>(res => 
    canvas.toBlob(b => res(b!), 'image/webp', quality)
  );
  
  return new File([blob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
}

/**
 * Check if a file is an image based on MIME type
 * 
 * @param file - The file to check
 * @returns boolean - True if the file is an image
 */
export function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if the browser supports WebP encoding
 * 
 * @returns Promise<boolean> - True if WebP is supported
 */
export async function supportsWebP(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Compress an image if it's above a certain size threshold
 * 
 * @param file - The source image file
 * @param options - Compression options
 * @returns Promise<File> - The compressed file or original if not compressible
 */
export async function compressIfNeeded(
  file: File,
  options: {
    sizeThreshold?: number;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<File> {
  const {
    sizeThreshold = 1024 * 1024,
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.82
  } = options;
  
  if (!isImage(file) || file.size < sizeThreshold) {
    return file;
  }
  
  const canCompress = await supportsWebP();
  if (!canCompress) {
    return file;
  }
  
  try {
    const compressed = await resizeImage(file, maxWidth, maxHeight, quality);
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}

export type CompressionResult = {
  file: File;
  hash: string;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
  savings: number;
};

/**
 * Prepare a file for upload with optional compression and hashing
 * 
 * @param file - The source file
 * @param options - Preparation options
 * @returns Promise<CompressionResult> - Result with file, hash, and compression stats
 */
export async function prepareForUpload(
  file: File,
  options: {
    compress?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<CompressionResult> {
  const originalSize = file.size;
  
  let processedFile = file;
  let compressed = false;
  
  if (options.compress && isImage(file)) {
    const maybeCompressed = await compressIfNeeded(file, {
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      quality: options.quality
    });
    
    if (maybeCompressed !== file) {
      processedFile = maybeCompressed;
      compressed = true;
    }
  }
  
  const hash = await hashFile(processedFile);
  
  return {
    file: processedFile,
    hash,
    compressed,
    originalSize,
    finalSize: processedFile.size,
    savings: originalSize - processedFile.size
  };
}
