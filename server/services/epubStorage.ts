/**
 * EPUB Storage Service
 * 
 * Downloads and stores EPUB files locally when users add books to their library.
 * Serves stored EPUBs to avoid CORS issues with external sources.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const EPUB_STORAGE_DIR = path.join(process.cwd(), 'server', 'storage', 'epubs');

async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(EPUB_STORAGE_DIR);
  } catch {
    await fs.mkdir(EPUB_STORAGE_DIR, { recursive: true });
  }
}

function getEpubFilename(itemId: string): string {
  const hash = crypto.createHash('md5').update(itemId).digest('hex').slice(0, 8);
  return `${itemId}-${hash}.epub`;
}

function getEpubPath(itemId: string): string {
  return path.join(EPUB_STORAGE_DIR, getEpubFilename(itemId));
}

export async function isEpubDownloaded(itemId: string): Promise<boolean> {
  try {
    await fs.access(getEpubPath(itemId));
    return true;
  } catch {
    return false;
  }
}

export async function downloadAndStoreEpub(
  itemId: string,
  epubUrl: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    await ensureStorageDir();
    
    const filePath = getEpubPath(itemId);
    
    // Check if already downloaded
    if (await isEpubDownloaded(itemId)) {
      console.log(`[EPUB] Already downloaded: ${itemId}`);
      return { success: true, localPath: filePath };
    }
    
    console.log(`[EPUB] Downloading: ${epubUrl}`);
    
    const response = await fetch(epubUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AtlasOne/1.0)',
        'Accept': 'application/epub+zip, */*',
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `Download failed: ${response.status} ${response.statusText}` };
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('epub') && !contentType.includes('octet-stream') && !contentType.includes('zip')) {
      console.warn(`[EPUB] Unexpected content-type: ${contentType}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    if (buffer.length < 1000) {
      return { success: false, error: 'Downloaded file too small, likely an error page' };
    }
    
    await fs.writeFile(filePath, buffer);
    console.log(`[EPUB] Saved: ${filePath} (${buffer.length} bytes)`);
    
    return { success: true, localPath: filePath };
  } catch (err) {
    console.error(`[EPUB] Download error:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function getStoredEpubPath(itemId: string): Promise<string | null> {
  const filePath = getEpubPath(itemId);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

export async function deleteStoredEpub(itemId: string): Promise<boolean> {
  try {
    const filePath = getEpubPath(itemId);
    await fs.unlink(filePath);
    console.log(`[EPUB] Deleted: ${filePath}`);
    return true;
  } catch {
    return false;
  }
}

export function getEpubServeUrl(itemId: string): string {
  return `/api/gamedeck/ebooks/file/${itemId}`;
}

export async function getEpubBuffer(itemId: string): Promise<Buffer | null> {
  try {
    const filePath = getEpubPath(itemId);
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}
