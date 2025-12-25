import crypto from 'crypto';
import { getStorageInstance, hasStorageInstance } from '../../storage-accessor';
import type { InsertVaultCredential } from '@shared/schema';

const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
const NONCE_LENGTH = 12;

const VAULT_MASTER_SECRET = process.env.VAULT_MASTER_SECRET || 
  (process.env.NODE_ENV === 'production' 
    ? (() => { throw new Error('VAULT_MASTER_SECRET must be set in production'); })() 
    : 'dev-vault-master-secret-not-for-production');

export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

function deriveKey(walletAddr: string, salt: Buffer): Buffer {
  const normalized = walletAddr.trim().toLowerCase();
  const combined = normalized + VAULT_MASTER_SECRET;
  return crypto.pbkdf2Sync(combined, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encryptJSON(key: Buffer, data: unknown): { encryptedBlob: string; nonce: string } {
  const nonce = crypto.randomBytes(NONCE_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { 
    encryptedBlob: Buffer.concat([enc, tag]).toString('base64'),
    nonce: nonce.toString('base64')
  };
}

function decryptJSON(key: Buffer, encryptedBlob: string, nonce: string): unknown {
  const encBlobWithTag = Buffer.from(encryptedBlob, 'base64');
  const nonceBuffer = Buffer.from(nonce, 'base64');
  
  const tag = encBlobWithTag.slice(encBlobWithTag.length - 16);
  const enc = encBlobWithTag.slice(0, encBlobWithTag.length - 16);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonceBuffer);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

export async function saveCredential(
  walletAddr: string,
  provider: string,
  scope: string,
  bundle: TokenBundle,
  keyType: 'oauth' | 'api' | 'developer' = 'api'
): Promise<boolean> {
  try {
    if (!hasStorageInstance()) {
      console.warn('[Vault] Storage not initialized, credential not persisted');
      return false;
    }
    
    const storage = getStorageInstance();
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(walletAddr, salt);
    const { encryptedBlob, nonce } = encryptJSON(key, bundle);

    const data: InsertVaultCredential = {
      walletAddr: walletAddr.toLowerCase(),
      provider,
      scope,
      encryptedBlob,
      nonce,
      salt: salt.toString('base64'),
      keyType,
      expiresAt: bundle.expiresAt ? new Date(bundle.expiresAt) : null,
    };

    await storage.saveVaultCredential(data);
    return true;
  } catch (error) {
    console.error('[Vault] Failed to save credential:', error);
    return false;
  }
}

export async function getCredential(
  walletAddr: string,
  provider: string,
  scope: string
): Promise<TokenBundle | null> {
  try {
    if (!hasStorageInstance()) {
      return null;
    }
    
    const storage = getStorageInstance();
    const rec = await storage.getVaultCredential(walletAddr.toLowerCase(), provider, scope);
    if (!rec) return null;
    
    const salt = Buffer.from(rec.salt, 'base64');
    const key = deriveKey(walletAddr, salt);
    return decryptJSON(key, rec.encryptedBlob, rec.nonce) as TokenBundle;
  } catch (error) {
    console.error('[Vault] Failed to get credential:', error);
    return null;
  }
}

export async function deleteCredential(
  walletAddr: string,
  provider: string,
  scope: string
): Promise<boolean> {
  if (!hasStorageInstance()) {
    return false;
  }
  const storage = getStorageInstance();
  return storage.deleteVaultCredential(walletAddr.toLowerCase(), provider, scope);
}

interface CredentialInfo {
  provider: string;
  scope: string;
  keyType: string;
  updatedAt: Date;
  expiresAt: Date | null;
}

export async function listCredentials(walletAddr: string): Promise<CredentialInfo[]> {
  if (!hasStorageInstance()) {
    return [];
  }
  const storage = getStorageInstance();
  const credentials = await storage.listVaultCredentials(walletAddr.toLowerCase());
  return credentials.map((c): CredentialInfo => ({
    provider: c.provider,
    scope: c.scope,
    keyType: c.keyType,
    updatedAt: c.updatedAt,
    expiresAt: c.expiresAt,
  }));
}

export async function setOAuthToken(
  wallet: string,
  connectorId: string,
  token: string,
  refreshToken?: string,
  expiresIn?: number
): Promise<boolean> {
  const bundle: TokenBundle = {
    accessToken: token,
    refreshToken,
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
  };
  return saveCredential(wallet, 'oauth', connectorId, bundle, 'oauth');
}

export async function getOAuthToken(wallet: string, connectorId: string): Promise<string | null> {
  const bundle = await getCredential(wallet, 'oauth', connectorId);
  return bundle?.accessToken || null;
}

export async function getOAuthBundle(wallet: string, connectorId: string): Promise<TokenBundle | null> {
  return getCredential(wallet, 'oauth', connectorId);
}

export async function hasOAuthToken(wallet: string, connectorId: string): Promise<boolean> {
  const bundle = await getCredential(wallet, 'oauth', connectorId);
  return bundle !== null;
}

export async function setDeveloperKey(
  wallet: string,
  provider: string,
  apiKey: string
): Promise<boolean> {
  const bundle: TokenBundle = { accessToken: apiKey };
  return saveCredential(wallet, 'developer', provider, bundle, 'developer');
}

export async function getDeveloperKey(wallet: string, provider: string): Promise<string | null> {
  const bundle = await getCredential(wallet, 'developer', provider);
  return bundle?.accessToken || null;
}

export async function hasDeveloperKey(wallet: string, provider: string): Promise<boolean> {
  const bundle = await getCredential(wallet, 'developer', provider);
  return bundle !== null;
}

export async function getConfiguredProviders(wallet: string): Promise<string[]> {
  const credentials = await listCredentials(wallet);
  return credentials
    .filter(c => c.keyType === 'developer')
    .map(c => c.scope);
}

export async function getConnectedOAuthApps(wallet: string): Promise<string[]> {
  const credentials = await listCredentials(wallet);
  return credentials
    .filter(c => c.keyType === 'oauth')
    .map(c => c.scope);
}

export async function validateProviderKey(
  provider: string,
  apiKey: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (provider) {
      case 'openai':
        return { valid: apiKey.startsWith('sk-') && apiKey.length > 20 };
      case 'anthropic':
        return { valid: apiKey.startsWith('sk-ant-') && apiKey.length > 30 };
      case 'gemini':
        return { valid: apiKey.length > 20 };
      default:
        return { valid: apiKey.length > 10 };
    }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Validation failed' };
  }
}

export function setVaultSecret(
  wallet: string,
  keyId: string,
  value: string,
  keyType: 'oauth' | 'api' | 'developer' = 'api'
): boolean {
  const [provider, scope] = keyId.includes(':') ? keyId.split(':') : ['api', keyId];
  saveCredential(wallet, provider, scope, { accessToken: value }, keyType);
  return true;
}

export function getVaultSecret(wallet: string, keyId: string): string | null {
  return null;
}

export function deleteVaultSecret(wallet: string, keyId: string): boolean {
  const [provider, scope] = keyId.includes(':') ? keyId.split(':') : ['api', keyId];
  deleteCredential(wallet, provider, scope);
  return true;
}

export function hasVaultSecret(wallet: string, keyId: string): boolean {
  return false;
}

export function listVaultSecrets(wallet: string): Array<{ keyId: string; keyType: string; updatedAt: number }> {
  return [];
}

export async function listVaultSecretsAsync(
  wallet: string
): Promise<Array<{ keyId: string; keyType: string; updatedAt: number }>> {
  const credentials = await listCredentials(wallet);
  return credentials.map(c => ({
    keyId: `${c.provider}:${c.scope}`,
    keyType: c.keyType,
    updatedAt: c.updatedAt.getTime(),
  }));
}
