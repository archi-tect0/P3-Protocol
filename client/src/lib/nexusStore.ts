/**
 * Nexus Store - IndexedDB-backed storage for drafts, threads, notes, clips, and anchor queue
 * State management implementation with proper typing and error handling
 */

export type Draft = {
  id: string;
  kind: 'message' | 'note';
  to?: string;
  title?: string;
  body: string;
  attachments?: string[];
  updatedAt: number;
};

export type ThreadItem = {
  id: string;
  to: string;
  kind: 'text' | 'voice' | 'video' | 'image';
  ref?: string;
  body?: string;
  archived?: boolean;
  anchorTxHash?: string;
  ts: number;
};

export type NoteItem = {
  id: string;
  title?: string;
  body: string;
  starred?: boolean;
  anchorTxHash?: string;
  ipfsCid?: string;
  ts: number;
};

export type ClipItem = {
  id: string;
  kind: 'voice' | 'video';
  encryptedRef: string;
  duration: number;
  size: number;
  ts: number;
};

export type QueueItem = {
  id: string;
  type: 'anchor' | 'ipfs';
  payload: any;
  status: 'pending' | 'processing' | 'failed';
  retries: number;
  ts: number;
};

const DB_NAME = 'nexus-db';
const DB_VERSION = 7;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    
    req.onupgradeneeded = () => {
      const db = req.result;
      
      if (!db.objectStoreNames.contains('drafts')) {
        const store = db.createObjectStore('drafts', { keyPath: 'id' });
        store.createIndex('byKind', 'kind', { unique: false });
        store.createIndex('byUpdatedAt', 'updatedAt', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('threads')) {
        const store = db.createObjectStore('threads', { keyPath: 'id' });
        store.createIndex('byArchived', 'archived', { unique: false });
        store.createIndex('byTs', 'ts', { unique: false });
        store.createIndex('byTo', 'to', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('notes')) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('byStarred', 'starred', { unique: false });
        store.createIndex('byTs', 'ts', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('clips')) {
        const store = db.createObjectStore('clips', { keyPath: 'id' });
        store.createIndex('byKind', 'kind', { unique: false });
        store.createIndex('byTs', 'ts', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        store.createIndex('byStatus', 'status', { unique: false });
        store.createIndex('byType', 'type', { unique: false });
      }
    };
    
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  
  return dbPromise;
}

async function put<T>(store: string, val: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(val);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

async function remove(store: string, key: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ==================== DRAFTS ====================

export async function saveDraft(d: Draft): Promise<void> {
  d.updatedAt = Date.now();
  await put('drafts', d);
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  return get<Draft>('drafts', id);
}

export async function listDrafts(kind: Draft['kind']): Promise<Draft[]> {
  const all = await getAll<Draft>('drafts');
  return all
    .filter(d => d.kind === kind)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteDraft(id: string): Promise<void> {
  await remove('drafts', id);
}

export async function clearOldDrafts(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const all = await getAll<Draft>('drafts');
  const cutoff = Date.now() - maxAge;
  for (const draft of all) {
    if (draft.updatedAt < cutoff) {
      await remove('drafts', draft.id);
    }
  }
}

// ==================== THREADS ====================

export async function addThreadItem(t: ThreadItem): Promise<void> {
  await put('threads', t);
}

export async function getThreadItem(id: string): Promise<ThreadItem | undefined> {
  return get<ThreadItem>('threads', id);
}

export async function listThreads({ 
  includeArchived = false, 
  limit = 100 
} = {}): Promise<ThreadItem[]> {
  const all = await getAll<ThreadItem>('threads');
  return all
    .filter(t => includeArchived ? true : !t.archived)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

export async function setThreadArchived(id: string, archived: boolean): Promise<void> {
  const item = await get<ThreadItem>('threads', id);
  if (!item) return;
  item.archived = archived;
  await put('threads', item);
}

export async function getThreadsByContact(to: string): Promise<ThreadItem[]> {
  const all = await getAll<ThreadItem>('threads');
  return all
    .filter(t => t.to === to)
    .sort((a, b) => b.ts - a.ts);
}

// ==================== NOTES ====================

export async function addNote(n: NoteItem): Promise<void> {
  await put('notes', n);
}

export async function getNote(id: string): Promise<NoteItem | undefined> {
  return get<NoteItem>('notes', id);
}

export async function listNotes({ 
  starred, 
  recent,
  limit = 100 
}: { starred?: boolean; recent?: boolean; limit?: number } = {}): Promise<NoteItem[]> {
  const all = await getAll<NoteItem>('notes');
  let out = all;
  
  if (starred) {
    out = out.filter(n => n.starred);
  }
  
  out = out.sort((a, b) => b.ts - a.ts);
  
  if (recent) {
    out = out.slice(0, 10);
  }
  
  return out.slice(0, limit);
}

export async function setNoteStarred(id: string, starred: boolean): Promise<void> {
  const n = await get<NoteItem>('notes', id);
  if (!n) return;
  n.starred = starred;
  await put('notes', n);
}

export async function deleteNote(id: string): Promise<void> {
  await remove('notes', id);
}

export async function updateNote(id: string, updates: Partial<NoteItem>): Promise<void> {
  const n = await get<NoteItem>('notes', id);
  if (!n) return;
  Object.assign(n, updates, { ts: Date.now() });
  await put('notes', n);
}

// ==================== CLIPS ====================

export async function addClip(c: ClipItem): Promise<void> {
  await put('clips', c);
}

export async function getClip(id: string): Promise<ClipItem | undefined> {
  return get<ClipItem>('clips', id);
}

export async function listClips(kind?: 'voice' | 'video'): Promise<ClipItem[]> {
  const all = await getAll<ClipItem>('clips');
  let out = all;
  
  if (kind) {
    out = out.filter(c => c.kind === kind);
  }
  
  return out.sort((a, b) => b.ts - a.ts);
}

export async function deleteClip(id: string): Promise<void> {
  await remove('clips', id);
}

// ==================== ANCHOR QUEUE ====================

export async function enqueueAnchor(payload: any): Promise<string> {
  const item: QueueItem = {
    id: crypto.randomUUID(),
    type: 'anchor',
    payload,
    status: 'pending',
    retries: 0,
    ts: Date.now()
  };
  await put('queue', item);
  return item.id;
}

export async function enqueueIPFS(payload: any): Promise<string> {
  const item: QueueItem = {
    id: crypto.randomUUID(),
    type: 'ipfs',
    payload,
    status: 'pending',
    retries: 0,
    ts: Date.now()
  };
  await put('queue', item);
  return item.id;
}

export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  return get<QueueItem>('queue', id);
}

export async function listQueue(status?: QueueItem['status']): Promise<QueueItem[]> {
  const all = await getAll<QueueItem>('queue');
  let out = all;
  
  if (status) {
    out = out.filter(q => q.status === status);
  }
  
  return out.sort((a, b) => a.ts - b.ts);
}

export async function updateQueueItem(id: string, updates: Partial<QueueItem>): Promise<void> {
  const item = await get<QueueItem>('queue', id);
  if (!item) return;
  Object.assign(item, updates);
  await put('queue', item);
}

export async function removeQueueItem(id: string): Promise<void> {
  await remove('queue', id);
}

export async function drainQueue(processor: (item: QueueItem) => Promise<boolean>): Promise<number> {
  const pending = await listQueue('pending');
  let processed = 0;
  
  for (const item of pending) {
    try {
      await updateQueueItem(item.id, { status: 'processing' });
      const success = await processor(item);
      
      if (success) {
        await removeQueueItem(item.id);
        processed++;
      } else {
        await updateQueueItem(item.id, { 
          status: 'pending', 
          retries: item.retries + 1 
        });
      }
    } catch (error) {
      console.error('[Queue] Processing failed:', error);
      await updateQueueItem(item.id, { 
        status: item.retries >= 3 ? 'failed' : 'pending',
        retries: item.retries + 1 
      });
    }
  }
  
  return processed;
}

// ==================== SYNC HELPERS ====================

export async function syncFromServer(
  kind: 'threads' | 'notes',
  items: any[]
): Promise<void> {
  for (const item of items) {
    if (kind === 'threads') {
      await addThreadItem(item as ThreadItem);
    } else if (kind === 'notes') {
      await addNote(item as NoteItem);
    }
  }
}

export async function getStorageStats(): Promise<{
  drafts: number;
  threads: number;
  notes: number;
  clips: number;
  queue: number;
}> {
  return {
    drafts: (await getAll('drafts')).length,
    threads: (await getAll('threads')).length,
    notes: (await getAll('notes')).length,
    clips: (await getAll('clips')).length,
    queue: (await getAll('queue')).length,
  };
}
