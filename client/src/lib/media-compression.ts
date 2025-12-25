/**
 * Media Compression Utilities
 * 
 * Handles client-side compression of audio and video before upload to IPFS
 */

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface CompressionResult {
  blob: Blob;
  size: number;
  duration: number;
  format: string;
  compressed: boolean;
  originalSize: number;
}

/**
 * Compress audio blob if it exceeds max size
 */
export async function compressAudio(blob: Blob): Promise<CompressionResult> {
  const originalSize = blob.size;
  
  // If already under limit, return as is
  if (originalSize <= MAX_FILE_SIZE) {
    return {
      blob,
      size: originalSize,
      duration: await getAudioDuration(blob),
      format: blob.type || 'audio/webm',
      compressed: false,
      originalSize,
    };
  }

  try {
    // For audio, we can re-encode with lower bitrate
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Re-encode with lower bitrate using MediaRecorder
    const stream = audioContext.createMediaStreamDestination();
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(stream);
    
    const mediaRecorder = new MediaRecorder(stream.stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 64000, // Lower bitrate for compression
    });

    const chunks: Blob[] = [];
    
    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: 'audio/webm' });
        audioContext.close();
        
        resolve({
          blob: compressedBlob,
          size: compressedBlob.size,
          duration: audioBuffer.duration,
          format: 'audio/webm',
          compressed: true,
          originalSize,
        });
      };

      source.start();
      mediaRecorder.start();
      
      // Stop after audio finishes
      source.onended = () => {
        mediaRecorder.stop();
      };
    });
  } catch (error) {
    console.error('Audio compression failed, using original:', error);
    return {
      blob,
      size: originalSize,
      duration: await getAudioDuration(blob),
      format: blob.type || 'audio/webm',
      compressed: false,
      originalSize,
    };
  }
}

/**
 * Compress video blob if it exceeds max size
 */
export async function compressVideo(blob: Blob): Promise<CompressionResult> {
  const originalSize = blob.size;
  
  // If already under limit, return as is
  if (originalSize <= MAX_FILE_SIZE) {
    return {
      blob,
      size: originalSize,
      duration: await getVideoDuration(blob),
      format: blob.type || 'video/webm',
      compressed: false,
      originalSize,
    };
  }

  try {
    // For video, we reduce the bitrate
    // Note: True video re-encoding requires ffmpeg.wasm or server-side processing
    // For now, we'll just warn and send the original if it's too large
    // In production, you'd want server-side compression
    
    const duration = await getVideoDuration(blob);
    
    // Calculate target bitrate to hit 20MB
    const targetBitrate = Math.floor((MAX_FILE_SIZE * 8) / duration * 0.9); // 90% to leave room
    
    console.warn(
      `Video file is ${(originalSize / 1024 / 1024).toFixed(2)}MB. ` +
      `Consider server-side compression. Target bitrate: ${targetBitrate}bps`
    );
    
    // Return original for now - in production, implement server-side compression
    return {
      blob,
      size: originalSize,
      duration,
      format: blob.type || 'video/webm',
      compressed: false,
      originalSize,
    };
  } catch (error) {
    console.error('Video compression failed:', error);
    return {
      blob,
      size: originalSize,
      duration: await getVideoDuration(blob),
      format: blob.type || 'video/webm',
      compressed: false,
      originalSize,
    };
  }
}

/**
 * Get audio duration from blob
 */
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.addEventListener('loadedmetadata', () => {
      resolve(audio.duration);
      audio.remove();
    });
    audio.addEventListener('error', () => {
      resolve(0);
      audio.remove();
    });
    audio.src = URL.createObjectURL(blob);
  });
}

/**
 * Get video duration from blob
 */
async function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.addEventListener('loadedmetadata', () => {
      resolve(video.duration);
      video.remove();
    });
    video.addEventListener('error', () => {
      resolve(0);
      video.remove();
    });
    video.src = URL.createObjectURL(blob);
  });
}

/**
 * Generate video thumbnail
 */
export async function generateVideoThumbnail(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, video.duration / 2); // Capture at 1s or middle
    });
    
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        video.remove();
        resolve(thumbnail);
      } else {
        video.remove();
        reject(new Error('Failed to get canvas context'));
      }
    });
    
    video.addEventListener('error', (e) => {
      video.remove();
      reject(e);
    });
    
    video.src = URL.createObjectURL(blob);
    video.load();
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Convert blob to base64 for encryption
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert base64 back to blob
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
