/**
 * Parallel Chunked Upload for P3 Uploads Optimization
 * 
 * Features:
 * - Multi-lane parallel chunk uploads
 * - Content-Range based chunk tracking
 * - SHA-256 based upload ID for deduplication
 * - Progress tracking callbacks
 * - Retry logic for failed chunks
 */

import { hashFile } from './compress';

export type UploadProgress = {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  chunksCompleted: number;
  totalChunks: number;
  percentComplete: number;
};

export type UploadOptions = {
  lanes?: number;
  chunkSize?: number;
  onProgress?: (progress: UploadProgress) => void;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
};

/**
 * Upload a file using parallel chunked uploads
 * 
 * @param file - The file to upload
 * @param lanes - Number of parallel upload lanes (default 4)
 * @param chunkSize - Size of each chunk in bytes (default 512KB)
 * @returns Promise<string> - The upload ID (file hash)
 */
export async function uploadParallel(
  file: File,
  lanes = 4,
  chunkSize = 512 * 1024
): Promise<string> {
  const id = await hashFile(file);
  let offset = 0;
  const total = file.size;

  async function lane() {
    while (true) {
      const start = offset;
      if (start >= total) return;
      offset = Math.min(start + chunkSize, total);
      const blob = file.slice(start, offset);
      const res = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: { 'X-Upload-Id': id, 'Content-Range': `${start}-${offset - 1}/${total}` },
        body: await blob.arrayBuffer(),
      });
      if (!res.ok) throw new Error('Chunk failed');
    }
  }

  await Promise.all(Array.from({ length: lanes }, lane));
  await fetch('/api/upload/complete', { method: 'POST', headers: { 'X-Upload-Id': id } });
  return id;
}

/**
 * Advanced parallel upload with progress tracking and retry logic
 * 
 * @param file - The file to upload
 * @param options - Upload options
 * @returns Promise<string> - The upload ID (file hash)
 */
export async function uploadParallelAdvanced(
  file: File,
  options: UploadOptions = {}
): Promise<string> {
  const {
    lanes = 4,
    chunkSize = 512 * 1024,
    onProgress,
    maxRetries = 3,
    retryDelay = 1000,
    headers = {}
  } = options;

  const id = await hashFile(file);
  const total = file.size;
  const totalChunks = Math.ceil(total / chunkSize);
  
  let completedChunks = 0;
  let uploadedBytes = 0;
  const lock = { offset: 0 };

  function reportProgress() {
    if (onProgress) {
      onProgress({
        uploadId: id,
        bytesUploaded: uploadedBytes,
        totalBytes: total,
        chunksCompleted: completedChunks,
        totalChunks,
        percentComplete: Math.round((uploadedBytes / total) * 100)
      });
    }
  }

  async function uploadChunk(start: number, end: number, retries = 0): Promise<void> {
    const blob = file.slice(start, end);
    
    try {
      const res = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: {
          'X-Upload-Id': id,
          'Content-Range': `${start}-${end - 1}/${total}`,
          'Content-Type': 'application/octet-stream',
          ...headers
        },
        body: await blob.arrayBuffer(),
      });

      if (!res.ok) {
        throw new Error(`Chunk upload failed with status ${res.status}`);
      }

      completedChunks++;
      uploadedBytes += (end - start);
      reportProgress();
    } catch (error) {
      if (retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retries + 1)));
        return uploadChunk(start, end, retries + 1);
      }
      throw error;
    }
  }

  async function lane(): Promise<void> {
    while (true) {
      let start: number;
      let end: number;

      start = lock.offset;
      if (start >= total) return;
      end = Math.min(start + chunkSize, total);
      lock.offset = end;

      await uploadChunk(start, end);
    }
  }

  reportProgress();

  await Promise.all(Array.from({ length: Math.min(lanes, totalChunks) }, lane));

  const completeRes = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: {
      'X-Upload-Id': id,
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      filename: file.name,
      mimetype: file.type,
      totalSize: total
    })
  });

  if (!completeRes.ok) {
    throw new Error('Failed to complete upload');
  }

  return id;
}

/**
 * Resume an interrupted upload
 * 
 * @param file - The file to resume uploading
 * @param options - Upload options
 * @returns Promise<string> - The upload ID
 */
export async function resumeUpload(
  file: File,
  options: UploadOptions = {}
): Promise<string> {
  const id = await hashFile(file);
  const { headers = {} } = options;

  const statusRes = await fetch(`/api/upload/status/${id}`, {
    method: 'GET',
    headers
  });

  if (!statusRes.ok) {
    return uploadParallelAdvanced(file, options);
  }

  const status = await statusRes.json();
  const uploadedRanges: [number, number][] = status.uploadedRanges || [];
  
  if (status.complete) {
    return id;
  }

  const total = file.size;
  const chunkSize = options.chunkSize || 512 * 1024;
  const missingChunks: [number, number][] = [];
  
  let pos = 0;
  for (const [start, end] of uploadedRanges.sort((a, b) => a[0] - b[0])) {
    if (pos < start) {
      missingChunks.push([pos, start]);
    }
    pos = end + 1;
  }
  if (pos < total) {
    missingChunks.push([pos, total]);
  }

  if (missingChunks.length === 0) {
    await fetch('/api/upload/complete', {
      method: 'POST',
      headers: {
        'X-Upload-Id': id,
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        filename: file.name,
        mimetype: file.type,
        totalSize: total
      })
    });
    return id;
  }

  const lanes = options.lanes || 4;
  let chunkIndex = 0;

  async function lane(): Promise<void> {
    while (true) {
      const idx = chunkIndex++;
      
      const chunk = missingChunks.find((_, i) => {
        const start = missingChunks.slice(0, i).reduce((sum, [s, e]) => sum + Math.ceil((e - s) / chunkSize), 0);
        const count = Math.ceil((missingChunks[i][1] - missingChunks[i][0]) / chunkSize);
        return idx >= start && idx < start + count;
      });
      
      if (!chunk) return;

      const [rangeStart, rangeEnd] = chunk;
      const localOffset = (idx - missingChunks.slice(0, missingChunks.indexOf(chunk)).reduce((sum, [s, e]) => sum + Math.ceil((e - s) / chunkSize), 0)) * chunkSize;
      const start = rangeStart + localOffset;
      const end = Math.min(start + chunkSize, rangeEnd);

      const blob = file.slice(start, end);
      const res = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: {
          'X-Upload-Id': id,
          'Content-Range': `${start}-${end - 1}/${total}`,
          'Content-Type': 'application/octet-stream',
          ...headers
        },
        body: await blob.arrayBuffer(),
      });

      if (!res.ok) {
        throw new Error('Chunk upload failed');
      }
    }
  }

  await Promise.all(Array.from({ length: lanes }, lane));

  await fetch('/api/upload/complete', {
    method: 'POST',
    headers: {
      'X-Upload-Id': id,
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      filename: file.name,
      mimetype: file.type,
      totalSize: total
    })
  });

  return id;
}

/**
 * Check if an upload already exists (deduplication)
 * 
 * @param file - The file to check
 * @returns Promise<{ exists: boolean; uploadId: string }> - Dedup status
 */
export async function checkDedupe(file: File): Promise<{ exists: boolean; uploadId: string }> {
  const id = await hashFile(file);
  
  try {
    const res = await fetch(`/api/upload/exists/${id}`, {
      method: 'HEAD'
    });
    
    return {
      exists: res.ok,
      uploadId: id
    };
  } catch {
    return {
      exists: false,
      uploadId: id
    };
  }
}
