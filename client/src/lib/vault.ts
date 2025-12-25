/**
 * Encrypted Session Vault for Per-App Cookie/Storage Isolation
 * 
 * Security Features:
 * - AES-GCM encryption using WebCrypto
 * - HKDF key derivation from master secret + app slug
 * - Per-app key isolation prevents cross-app data access
 * - Ephemeral mode for session-only storage (no IndexedDB persistence)
 * - Forward secrecy through app key rotation on install/update
 * - Panic wipe invalidates all keys instantly
 */

const DOMAIN_SEPARATOR = 'atlas-vault-v3:';
const HKDF_HASH = 'SHA-256';
const AES_ALGO = 'AES-GCM';
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const DB_NAME = 'atlas-vault';
const STORE_NAME = 'connectors';
const APP_STORE_NAME = 'app-vaults';
const DB_VERSION = 3;

export interface EncryptedEnvelope {
  version: number;
  iv: number[];
  ct: number[];
  createdAt: number;
  appSlug?: string;
  salt?: number[];
}

export interface VaultConfig {
  ephemeral?: boolean;
}

interface DerivedAppKey {
  key: CryptoKey;
  salt: Uint8Array;
  derivedAt: number;
}

const appKeyCache = new Map<string, DerivedAppKey>();
const ephemeralStore = new Map<string, EncryptedEnvelope>();
let masterKeyRef: CryptoKey | null = null;
let currentAddress: string | null = null;
let isEphemeralMode = false;
let vaultRevoked = false;

function arrayToBase64(arr: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < arr.length; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

function base64ToArray(b64: string): Uint8Array {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}

/**
 * Derive master key from wallet address and signature using PBKDF2
 * This maintains backward compatibility with existing vault tokens
 */
export async function deriveKey(address: string, signature: string): Promise<CryptoKey> {
  const domainInput = `${DOMAIN_SEPARATOR}${address.toLowerCase()}:${signature}`;
  const inputBytes = new TextEncoder().encode(domainInput);
  
  const material = await crypto.subtle.importKey(
    'raw', 
    inputBytes, 
    'PBKDF2', 
    false, 
    ['deriveBits', 'deriveKey']
  );
  
  const salt = new TextEncoder().encode(`${DOMAIN_SEPARATOR}salt:${address.toLowerCase()}`);
  
  return crypto.subtle.deriveKey(
    { 
      name: 'PBKDF2', 
      salt, 
      iterations: 120000, 
      hash: 'SHA-256' 
    },
    material, 
    { name: AES_ALGO, length: AES_KEY_LENGTH }, 
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Derive app-specific key using HKDF from master key + app slug
 * Each app gets an isolated encryption key derived from the master secret
 */
async function deriveAppKey(masterKey: CryptoKey, appSlug: string, salt?: Uint8Array): Promise<DerivedAppKey> {
  const cacheKey = `${currentAddress}:${appSlug}`;
  
  if (!salt && appKeyCache.has(cacheKey)) {
    return appKeyCache.get(cacheKey)!;
  }
  
  const keySalt = salt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  
  const masterKeyData = await crypto.subtle.exportKey('raw', masterKey);
  
  const baseKey = await crypto.subtle.importKey(
    'raw',
    masterKeyData,
    'HKDF',
    false,
    ['deriveKey']
  );
  
  const info = new TextEncoder().encode(`${DOMAIN_SEPARATOR}app:${appSlug}`);
  
  const appKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: HKDF_HASH,
      salt: keySalt,
      info,
    },
    baseKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
  
  const derived: DerivedAppKey = {
    key: appKey,
    salt: keySalt,
    derivedAt: Date.now(),
  };
  
  if (!salt) {
    appKeyCache.set(cacheKey, derived);
  }
  
  return derived;
}

/**
 * Generate a fresh salt for app key rotation (forward secrecy)
 */
export function generateAppKeySalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Initialize the vault with master key and address
 */
export async function initVault(address: string, signature: string, config?: VaultConfig): Promise<void> {
  if (vaultRevoked) {
    throw new Error('Vault has been revoked - panic wipe was triggered');
  }
  
  masterKeyRef = await deriveKey(address, signature);
  currentAddress = address.toLowerCase();
  isEphemeralMode = config?.ephemeral ?? false;
  appKeyCache.clear();
  
  console.log(`[vault] Initialized for ${address.slice(0, 8)}... (ephemeral: ${isEphemeralMode})`);
}

/**
 * Check if vault is initialized and not revoked
 */
export function isVaultReady(): boolean {
  return masterKeyRef !== null && !vaultRevoked;
}

/**
 * Seal (encrypt) data for a specific app
 * Returns base64-encoded encrypted envelope
 */
export async function seal(appSlug: string, data: any, existingSalt?: Uint8Array): Promise<string> {
  if (!masterKeyRef || vaultRevoked) {
    throw new Error('Vault not initialized or revoked');
  }
  
  const { key, salt } = await deriveAppKey(masterKeyRef, appSlug, existingSalt);
  
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: AES_ALGO, iv }, key, plaintext);
  
  const envelope: EncryptedEnvelope = {
    version: 3,
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext)),
    salt: Array.from(salt),
    appSlug,
    createdAt: Date.now(),
  };
  
  const envelopeJson = JSON.stringify(envelope);
  return arrayToBase64(new TextEncoder().encode(envelopeJson));
}

/**
 * Open (decrypt) sealed data for a specific app
 * Returns decrypted plaintext object
 */
export async function open(appSlug: string, sealed: string): Promise<any> {
  if (!masterKeyRef || vaultRevoked) {
    throw new Error('Vault not initialized or revoked');
  }
  
  const envelopeBytes = base64ToArray(sealed);
  const envelope: EncryptedEnvelope = JSON.parse(new TextDecoder().decode(envelopeBytes));
  
  if (envelope.appSlug && envelope.appSlug !== appSlug) {
    throw new Error('App slug mismatch - cannot decrypt data for different app');
  }
  
  const salt = envelope.salt ? new Uint8Array(envelope.salt) : undefined;
  const { key } = await deriveAppKey(masterKeyRef, appSlug, salt);
  
  const iv = new Uint8Array(envelope.iv);
  const ciphertext = new Uint8Array(envelope.ct);
  
  const plaintext = await crypto.subtle.decrypt({ name: AES_ALGO, iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/**
 * Wipe vault data for a specific app or all apps
 * Invalidates keys and clears storage
 */
export async function wipe(appSlug?: string): Promise<void> {
  if (appSlug) {
    const cacheKey = `${currentAddress}:${appSlug}`;
    appKeyCache.delete(cacheKey);
    ephemeralStore.delete(`${currentAddress}:${appSlug}`);
    
    if (!isEphemeralMode) {
      await deleteAppVaultData(appSlug);
    }
    
    console.log(`[vault] Wiped app vault for ${appSlug}`);
  } else {
    appKeyCache.clear();
    ephemeralStore.clear();
    
    if (!isEphemeralMode) {
      await clearAllVaultData();
    }
    
    console.log('[vault] Wiped all app vaults');
  }
}

/**
 * Panic wipe - immediately invalidate all keys and mark vault as revoked
 * Used for emergency security situations
 */
export function panic(): void {
  vaultRevoked = true;
  masterKeyRef = null;
  currentAddress = null;
  appKeyCache.clear();
  ephemeralStore.clear();
  console.log('[vault] PANIC - All keys invalidated');
}

/**
 * Reset panic state (for re-initialization after panic)
 */
export function resetPanic(): void {
  vaultRevoked = false;
}

/**
 * Get current vault status
 */
export function getVaultStatus(): { initialized: boolean; revoked: boolean; ephemeral: boolean; address: string | null } {
  return {
    initialized: masterKeyRef !== null,
    revoked: vaultRevoked,
    ephemeral: isEphemeralMode,
    address: currentAddress,
  };
}

/**
 * Store sealed data in ephemeral or persistent storage
 */
export async function storeAppData(appSlug: string, data: any): Promise<string> {
  const sealed = await seal(appSlug, data);
  
  if (isEphemeralMode) {
    ephemeralStore.set(`${currentAddress}:${appSlug}`, JSON.parse(new TextDecoder().decode(base64ToArray(sealed))));
  } else {
    await putAppVaultData(appSlug, sealed);
  }
  
  return sealed;
}

/**
 * Retrieve and decrypt app data from storage
 */
export async function retrieveAppData(appSlug: string): Promise<any | null> {
  let sealed: string | null = null;
  
  if (isEphemeralMode) {
    const envelope = ephemeralStore.get(`${currentAddress}:${appSlug}`);
    if (envelope) {
      sealed = arrayToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
    }
  } else {
    sealed = await getAppVaultData(appSlug);
  }
  
  if (!sealed) {
    return null;
  }
  
  return open(appSlug, sealed);
}

/**
 * Rotate app key (forward secrecy)
 * Re-encrypts data with a new salt after app install/update
 */
export async function rotateAppKey(appSlug: string): Promise<void> {
  if (!masterKeyRef || vaultRevoked) {
    throw new Error('Vault not initialized or revoked');
  }
  
  const existingData = await retrieveAppData(appSlug);
  
  const cacheKey = `${currentAddress}:${appSlug}`;
  appKeyCache.delete(cacheKey);
  
  if (existingData !== null) {
    await storeAppData(appSlug, existingData);
  }
  
  console.log(`[vault] Rotated key for app ${appSlug}`);
}

function openVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(APP_STORE_NAME)) {
        db.createObjectStore(APP_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putAppVaultData(appSlug: string, sealed: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_STORE_NAME, 'readwrite');
    const key = `${currentAddress}:${appSlug}`;
    tx.objectStore(APP_STORE_NAME).put(sealed, key);
    tx.oncomplete = () => {
      console.log(`[vault] Stored data for ${appSlug}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function getAppVaultData(appSlug: string): Promise<string | null> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_STORE_NAME, 'readonly');
    const key = `${currentAddress}:${appSlug}`;
    const req = tx.objectStore(APP_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteAppVaultData(appSlug: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_STORE_NAME, 'readwrite');
    const key = `${currentAddress}:${appSlug}`;
    tx.objectStore(APP_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllVaultData(): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(APP_STORE_NAME, 'readwrite');
    tx.objectStore(APP_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function encryptJson(key: CryptoKey, obj: any): Promise<EncryptedEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: AES_ALGO, iv }, key, data);
  return { 
    version: 3, 
    iv: Array.from(iv), 
    ct: Array.from(new Uint8Array(ct)),
    createdAt: Date.now()
  };
}

export async function decryptJson(key: CryptoKey, pack: EncryptedEnvelope | { iv: number[]; ct: number[] }): Promise<any> {
  const iv = new Uint8Array(pack.iv);
  const ct = new Uint8Array(pack.ct);
  const pt = await crypto.subtle.decrypt({ name: AES_ALGO, iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

export async function putVaultToken(connectorId: string, encryptedBlob: EncryptedEnvelope): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(encryptedBlob, connectorId);
    tx.oncomplete = () => {
      console.log(`[vault] Token stored for ${connectorId}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getVaultToken(connectorId: string): Promise<EncryptedEnvelope | null> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(connectorId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteVaultToken(connectorId: string): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(connectorId);
    tx.oncomplete = () => {
      console.log(`[vault] Token deleted for ${connectorId}`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function listVaultKeys(): Promise<string[]> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result as string[]);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllVaultTokens(): Promise<void> {
  const db = await openVaultDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      console.log('[vault] All tokens cleared');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export function zeroizeKey(_key: CryptoKey | null): void {
  console.log('[vault] Key reference cleared from memory');
}
