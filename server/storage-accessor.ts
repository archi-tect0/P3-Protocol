import type { IStorage } from './storage';

let storageInstance: IStorage | null = null;

export function setStorageInstance(storage: IStorage): void {
  storageInstance = storage;
}

export function getStorageInstance(): IStorage {
  if (!storageInstance) {
    throw new Error('Storage not initialized. Call setStorageInstance first.');
  }
  return storageInstance;
}

export function hasStorageInstance(): boolean {
  return storageInstance !== null;
}
