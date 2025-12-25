/**
 * Atlas API 2.0 - Frame Signing
 * 
 * Cryptographic signing and verification for AccessFrame integrity.
 * Uses HMAC-SHA256 for server-side signing with rotating key support.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { 
  AccessFrame, 
  encodeAccessFrame,
  decodeAccessFrame,
  Readiness,
  AccessMode,
  toBase64 as accessFrameToBase64,
} from './wire/accessFrame';
import {
  ReceiptEvent,
  encodeReceiptEvent,
  decodeReceiptEvent,
  toBase64 as receiptEventToBase64,
} from './wire/receiptEvent';

const SIGNING_KEY_ENV = 'ATLAS_FRAME_SIGNING_KEY';
const SIGNATURE_VERSION = 0x01;
const SIGNATURE_LENGTH = 32;

interface RotatingKey {
  key: Buffer;
  version: number;
  createdAt: number;
  expiresAt: number;
}

const keyRing: Map<number, RotatingKey> = new Map();
let activeKeyVersion = 0;
let signingKey: Buffer | null = null;

function getSigningKey(): Buffer {
  if (signingKey) {
    return signingKey;
  }

  const envKey = process.env[SIGNING_KEY_ENV];
  if (envKey) {
    signingKey = Buffer.from(envKey, 'hex');
    if (signingKey.length < 32) {
      throw new Error(`${SIGNING_KEY_ENV} must be at least 32 bytes (64 hex characters)`);
    }
    return signingKey;
  }

  console.warn('[signing] No ATLAS_FRAME_SIGNING_KEY set, generating ephemeral key (NOT FOR PRODUCTION)');
  signingKey = randomBytes(32);
  return signingKey;
}

function getActiveKey(): RotatingKey | null {
  return keyRing.get(activeKeyVersion) || null;
}

function computeSignaturePayload(frame: AccessFrame): Uint8Array {
  const unsignedFrame: AccessFrame = {
    ...frame,
    signature: undefined,
  };
  return encodeAccessFrame(unsignedFrame);
}

function computeHmac(data: Uint8Array, keyOverride?: Buffer): Buffer {
  const key = keyOverride || getSigningKey();
  const hmac = createHmac('sha256', key);
  hmac.update(Buffer.from(data));
  return hmac.digest();
}

function computeHmacWithKeyRing(data: Uint8Array): { hmac: Buffer; keyVersion: number } {
  const activeKey = getActiveKey();
  if (activeKey && activeKey.expiresAt > Date.now()) {
    return {
      hmac: computeHmac(data, activeKey.key),
      keyVersion: activeKey.version,
    };
  }
  return {
    hmac: computeHmac(data),
    keyVersion: 0,
  };
}

export interface SigningResult {
  frame: AccessFrame;
  signatureHex: string;
  keyVersion: number;
}

export function signFrame(frame: AccessFrame): SigningResult {
  const payload = computeSignaturePayload(frame);
  const { hmac: hmacDigest, keyVersion } = computeHmacWithKeyRing(payload);
  
  const signature = new Uint8Array(2 + SIGNATURE_LENGTH);
  signature[0] = SIGNATURE_VERSION;
  signature[1] = keyVersion;
  signature.set(hmacDigest, 2);

  const signedFrame: AccessFrame = {
    ...frame,
    signature,
  };

  return {
    frame: signedFrame,
    signatureHex: Buffer.from(signature).toString('hex'),
    keyVersion,
  };
}

export function signAccessFrame(frame: AccessFrame): SigningResult {
  return signFrame(frame);
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  version?: number;
  keyVersion?: number;
}

export function verifyFrame(frame: AccessFrame): VerificationResult {
  if (!frame.signature || frame.signature.length === 0) {
    return { valid: false, error: 'No signature present' };
  }

  if (frame.signature.length === 1 + SIGNATURE_LENGTH) {
    const version = frame.signature[0];
    if (version !== SIGNATURE_VERSION) {
      return { valid: false, error: `Unknown signature version: ${version}`, version };
    }

    const payload = computeSignaturePayload(frame);
    const expectedHmac = computeHmac(payload);
    const actualHmac = Buffer.from(frame.signature.slice(1));

    try {
      const isValid = timingSafeEqual(expectedHmac, actualHmac);
      return { valid: isValid, version, keyVersion: 0 };
    } catch {
      return { valid: false, error: 'Signature comparison failed' };
    }
  }

  if (frame.signature.length === 2 + SIGNATURE_LENGTH) {
    const version = frame.signature[0];
    const keyVersion = frame.signature[1];
    
    if (version !== SIGNATURE_VERSION) {
      return { valid: false, error: `Unknown signature version: ${version}`, version };
    }

    const payload = computeSignaturePayload(frame);
    
    let keyToUse: Buffer;
    if (keyVersion === 0) {
      keyToUse = getSigningKey();
    } else {
      const rotatingKey = keyRing.get(keyVersion);
      if (!rotatingKey) {
        return { valid: false, error: `Unknown key version: ${keyVersion}`, version, keyVersion };
      }
      keyToUse = rotatingKey.key;
    }
    
    const expectedHmac = computeHmac(payload, keyToUse);
    const actualHmac = Buffer.from(frame.signature.slice(2));

    try {
      const isValid = timingSafeEqual(expectedHmac, actualHmac);
      return { valid: isValid, version, keyVersion };
    } catch {
      return { valid: false, error: 'Signature comparison failed' };
    }
  }

  return { valid: false, error: `Invalid signature length: ${frame.signature.length}` };
}

export function verifyAccessFrame(frame: AccessFrame): VerificationResult {
  return verifyFrame(frame);
}

export function signAndSerialize(frame: AccessFrame): Uint8Array {
  const { frame: signedFrame } = signFrame(frame);
  return encodeAccessFrame(signedFrame);
}

export function parseAndVerify(bytes: Uint8Array): { frame: AccessFrame; verification: VerificationResult } {
  const frame = decodeAccessFrame(bytes);
  const verification = verifyFrame(frame);
  return { frame, verification };
}

export function generateSigningKey(): string {
  return randomBytes(32).toString('hex');
}

export function setSigningKey(keyHex: string): void {
  const keyBuffer = Buffer.from(keyHex, 'hex');
  if (keyBuffer.length < 32) {
    throw new Error('Signing key must be at least 32 bytes (64 hex characters)');
  }
  signingKey = keyBuffer;
}

export function clearSigningKey(): void {
  signingKey = null;
}

export function hasSigningKey(): boolean {
  return signingKey !== null || !!process.env[SIGNING_KEY_ENV];
}

export interface KeyRotationConfig {
  keyHex?: string;
  ttlMs?: number;
}

export function rotateKey(config?: KeyRotationConfig): number {
  const newKeyVersion = activeKeyVersion + 1;
  const ttlMs = config?.ttlMs ?? 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  const newKey: RotatingKey = {
    key: config?.keyHex ? Buffer.from(config.keyHex, 'hex') : randomBytes(32),
    version: newKeyVersion,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  
  keyRing.set(newKeyVersion, newKey);
  activeKeyVersion = newKeyVersion;
  
  pruneExpiredKeys();
  
  console.log(`[signing] Rotated to key version ${newKeyVersion}, expires at ${new Date(newKey.expiresAt).toISOString()}`);
  
  return newKeyVersion;
}

export function pruneExpiredKeys(): number {
  const now = Date.now();
  let prunedCount = 0;
  const gracePeriod = 60 * 60 * 1000;
  
  for (const [version, key] of keyRing.entries()) {
    if (version !== activeKeyVersion && key.expiresAt + gracePeriod < now) {
      keyRing.delete(version);
      prunedCount++;
    }
  }
  
  if (prunedCount > 0) {
    console.log(`[signing] Pruned ${prunedCount} expired keys`);
  }
  
  return prunedCount;
}

export function getKeyRingStatus(): { activeVersion: number; keyCount: number; keys: Array<{ version: number; expiresAt: number; isActive: boolean }> } {
  const keys = Array.from(keyRing.entries()).map(([version, key]) => ({
    version,
    expiresAt: key.expiresAt,
    isActive: version === activeKeyVersion,
  }));
  
  return {
    activeVersion: activeKeyVersion,
    keyCount: keyRing.size,
    keys,
  };
}

export function clearKeyRing(): void {
  keyRing.clear();
  activeKeyVersion = 0;
}

export interface SignedFrameBundle {
  wireBytes: Uint8Array;
  base64: string;
  signatureHex: string;
  frameId: string;
  readiness: string;
  keyVersion: number;
}

export function createSignedFrameBundle(frame: AccessFrame): SignedFrameBundle {
  const { frame: signedFrame, signatureHex, keyVersion } = signFrame(frame);
  const wireBytes = encodeAccessFrame(signedFrame);
  const base64 = accessFrameToBase64(signedFrame);

  const readinessMap: Record<Readiness, string> = {
    [Readiness.UNKNOWN]: 'unknown',
    [Readiness.PENDING]: 'pending',
    [Readiness.READY]: 'ready',
    [Readiness.DEGRADED]: 'degraded',
  };

  return {
    wireBytes,
    base64,
    signatureHex,
    frameId: signedFrame.id,
    readiness: readinessMap[signedFrame.readiness],
    keyVersion,
  };
}

export function signReceiptEvent(event: ReceiptEvent): { signedBytes: Uint8Array; base64: string; signatureHex: string } {
  const eventBytes = encodeReceiptEvent(event);
  const { hmac, keyVersion } = computeHmacWithKeyRing(eventBytes);
  
  const signedBytes = new Uint8Array(eventBytes.length + 2 + SIGNATURE_LENGTH);
  signedBytes.set(eventBytes, 0);
  signedBytes[eventBytes.length] = SIGNATURE_VERSION;
  signedBytes[eventBytes.length + 1] = keyVersion;
  signedBytes.set(hmac, eventBytes.length + 2);
  
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  const len = signedBytes.length;
  
  for (let i = 0; i < len; i += 3) {
    const b1 = signedBytes[i];
    const b2 = i + 1 < len ? signedBytes[i + 1] : 0;
    const b3 = i + 2 < len ? signedBytes[i + 2] : 0;
    base64 += base64Chars[b1 >> 2];
    base64 += base64Chars[((b1 & 0x03) << 4) | (b2 >> 4)];
    base64 += i + 1 < len ? base64Chars[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
    base64 += i + 2 < len ? base64Chars[b3 & 0x3f] : '=';
  }
  
  return {
    signedBytes,
    base64,
    signatureHex: Buffer.from(hmac).toString('hex'),
  };
}

export {
  AccessFrame,
  AccessMode,
  Readiness,
  encodeAccessFrame,
  decodeAccessFrame,
} from './wire/accessFrame';

export {
  ReceiptEvent,
  Action,
  encodeReceiptEvent,
  decodeReceiptEvent,
} from './wire/receiptEvent';

export { toBase64 as accessFrameToBase64 } from './wire/accessFrame';
export { toBase64 as receiptEventToBase64 } from './wire/receiptEvent';
