import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface GalleryItem {
  id: string;
  kind: 'small' | 'large';
  cid?: string;
  encryptedBlob?: string;
  iv?: string;
  thumbnailData?: string;
  mimeType: string;
  size: number;
  timestamp: number;
  owner: string;
  anchorTx?: string;
  status: 'pending' | 'uploading' | 'anchored' | 'failed';
}

export interface GallerySettings {
  owner: string;
  saltB64: string;
  requirePasswordOnOpen: boolean;
  createdAt: number;
}

interface GalleryDB extends DBSchema {
  items: { 
    key: string; 
    value: GalleryItem;
    indexes: { 'by-owner': string; 'by-status': string };
  };
  settings: { 
    key: string; 
    value: GallerySettings;
  };
  pending: {
    key: string;
    value: { id: string; blob: Blob; iv: string; timestamp: number };
  };
}

let dbPromise: Promise<IDBPDatabase<GalleryDB>> | null = null;

function getGalleryDB() {
  if (!dbPromise) {
    dbPromise = openDB<GalleryDB>('p3-gallery', 1, {
      upgrade(db) {
        const itemStore = db.createObjectStore('items', { keyPath: 'id' });
        itemStore.createIndex('by-owner', 'owner');
        itemStore.createIndex('by-status', 'status');
        db.createObjectStore('settings', { keyPath: 'owner' });
        db.createObjectStore('pending', { keyPath: 'id' });
      }
    });
  }
  return dbPromise;
}

export async function saveGalleryItem(item: GalleryItem): Promise<void> {
  const db = await getGalleryDB();
  await db.put('items', item);
}

export async function getGalleryItems(owner: string): Promise<GalleryItem[]> {
  const db = await getGalleryDB();
  const all = await db.getAllFromIndex('items', 'by-owner', owner);
  return all.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getGalleryItem(id: string): Promise<GalleryItem | undefined> {
  const db = await getGalleryDB();
  return db.get('items', id);
}

export async function updateItemStatus(id: string, status: GalleryItem['status'], anchorTx?: string): Promise<void> {
  const db = await getGalleryDB();
  const item = await db.get('items', id);
  if (item) {
    item.status = status;
    if (anchorTx) item.anchorTx = anchorTx;
    await db.put('items', item);
  }
}

export async function deleteGalleryItem(id: string): Promise<void> {
  const db = await getGalleryDB();
  await db.delete('items', id);
}

export async function saveSettings(settings: GallerySettings): Promise<void> {
  const db = await getGalleryDB();
  await db.put('settings', settings);
}

export async function getSettings(owner: string): Promise<GallerySettings | undefined> {
  const db = await getGalleryDB();
  return db.get('settings', owner);
}

export async function savePendingUpload(id: string, blob: Blob, iv: string): Promise<void> {
  const db = await getGalleryDB();
  await db.put('pending', { id, blob, iv, timestamp: Date.now() });
}

export async function getPendingUploads(): Promise<{ id: string; blob: Blob; iv: string; timestamp: number }[]> {
  const db = await getGalleryDB();
  return db.getAll('pending');
}

export async function clearPendingUpload(id: string): Promise<void> {
  const db = await getGalleryDB();
  await db.delete('pending', id);
}

export async function getItemCount(owner: string): Promise<number> {
  const db = await getGalleryDB();
  const items = await db.getAllFromIndex('items', 'by-owner', owner);
  return items.length;
}

export async function getTotalSize(owner: string): Promise<number> {
  const db = await getGalleryDB();
  const items = await db.getAllFromIndex('items', 'by-owner', owner);
  return items.reduce((sum, item) => sum + item.size, 0);
}
