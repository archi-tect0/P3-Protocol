import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface P3DB extends DBSchema {
  pointers: { key: string; value: { id: string; kind: string; payload: any; timestamp: number } };
  decrypted: { key: string; value: { id: string; kind: string; plaintext: string; timestamp: number } };
}

let dbPromise: Promise<IDBPDatabase<P3DB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<P3DB>('p3-nexus', 1, {
      upgrade(db) {
        db.createObjectStore('pointers', { keyPath: 'id' });
        db.createObjectStore('decrypted', { keyPath: 'id' });
      }
    });
  }
  return dbPromise;
}

export async function savePointer(kind: 'payment' | 'message' | 'note', payload: any) {
  const db = await getDB();
  const id = payload.id || payload.txHash || `${kind}-${Date.now()}`;
  await db.put('pointers', { id, kind, payload, timestamp: Date.now() });
}

export async function saveDecrypted(kind: string, id: string, plaintext: string) {
  const db = await getDB();
  await db.put('decrypted', { id, kind, plaintext, timestamp: Date.now() });
}

export async function getPointers(kind: string) {
  const db = await getDB();
  const all = await db.getAll('pointers');
  return all.filter(p => p.kind === kind);
}
