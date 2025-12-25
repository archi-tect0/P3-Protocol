/**
 * Atlas Cryptographic Primitives
 * 
 * Session key derivation, device pairing, proximity attestations,
 * and handoff receipts for zero-trust cross-device communication.
 */

const DOMAIN_SEPARATOR = 'atlas-srk-v1:';
const HKDF_HASH = 'SHA-256';
const ECDSA_CURVE = { name: 'ECDSA', namedCurve: 'P-256' };
const AES_ALGO = 'AES-GCM';
const AES_KEY_LENGTH = 256;

export interface DeviceKeyPair {
  publicKey: JsonWebKey;
  privateKey: CryptoKey;
  fingerprint: string;
}

export interface ProximityAttestation {
  payload: {
    ts: number;
    proximityMeters: number;
    token: string;
  };
  signature: string;
}

export interface AnchorReceipt {
  receiptId: string;
  sessionId: string;
  fromDevice: string;
  toDevice: string;
  ts: number;
  signature: string;
  stateHash?: string;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomNonce(length: number = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return arrayBufferToHex(bytes);
}

export async function deriveSessionRootKey(
  walletAddress: string,
  signature: string
): Promise<CryptoKey> {
  const domainInput = `${DOMAIN_SEPARATOR}${walletAddress.toLowerCase()}:${signature}`;
  const inputBytes = new TextEncoder().encode(domainInput);
  
  const material = await crypto.subtle.importKey(
    'raw',
    inputBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const salt = new TextEncoder().encode(`${DOMAIN_SEPARATOR}salt:${walletAddress.toLowerCase()}`);
  
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

export async function deriveDeviceSessionKey(
  srk: CryptoKey,
  deviceId: string
): Promise<CryptoKey> {
  const srkBits = await crypto.subtle.exportKey('raw', srk);
  const info = new TextEncoder().encode(`session:${deviceId}`);
  const salt = new TextEncoder().encode('atlas-device-key');
  
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    srkBits,
    'HKDF',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: HKDF_HASH,
      salt,
      info
    },
    hkdfKey,
    { name: AES_ALGO, length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    ECDSA_CURVE,
    true,
    ['sign', 'verify']
  );
  
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
  const fingerprintBytes = await crypto.subtle.digest('SHA-256', publicKeyRaw);
  const fingerprint = arrayBufferToHex(fingerprintBytes).slice(0, 16);
  
  return {
    publicKey: publicKeyJwk,
    privateKey: keyPair.privateKey,
    fingerprint
  };
}

export async function signData(
  privateKey: CryptoKey,
  data: string
): Promise<string> {
  const dataBytes = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBytes
  );
  return arrayBufferToBase64(signature);
}

export async function verifySignature(
  publicKeyJwk: JsonWebKey,
  signature: string,
  data: string
): Promise<boolean> {
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      ECDSA_CURVE,
      false,
      ['verify']
    );
    
    const dataBytes = new TextEncoder().encode(data);
    const signatureBytes = base64ToArrayBuffer(signature);
    
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      signatureBytes,
      dataBytes
    );
  } catch {
    return false;
  }
}

export async function createProximityAttestation(
  deviceKey: CryptoKey,
  proximityMeters: number
): Promise<ProximityAttestation> {
  const payload = {
    ts: Date.now(),
    proximityMeters,
    token: randomNonce(8)
  };
  
  const payloadStr = JSON.stringify(payload);
  const signature = await signData(deviceKey, payloadStr);
  
  return { payload, signature };
}

export async function verifyProximityAttestation(
  attestation: ProximityAttestation,
  publicKeyJwk: JsonWebKey,
  freshnessWindowMs: number = 5000,
  maxProximityMeters: number = 1.5
): Promise<{ valid: boolean; reason?: string }> {
  const now = Date.now();
  const age = now - attestation.payload.ts;
  
  if (age > freshnessWindowMs) {
    return { valid: false, reason: 'Attestation expired' };
  }
  
  if (attestation.payload.proximityMeters > maxProximityMeters) {
    return { valid: false, reason: 'Device too far' };
  }
  
  const payloadStr = JSON.stringify(attestation.payload);
  const sigValid = await verifySignature(publicKeyJwk, attestation.signature, payloadStr);
  
  if (!sigValid) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

export async function createAnchorReceipt(
  deviceKey: CryptoKey,
  sessionId: string,
  fromDevice: string,
  toDevice: string,
  stateHash?: string
): Promise<AnchorReceipt> {
  const receiptId = randomNonce(16);
  const ts = Date.now();
  
  const receiptData = {
    receiptId,
    sessionId,
    fromDevice,
    toDevice,
    ts,
    stateHash
  };
  
  const signature = await signData(deviceKey, JSON.stringify(receiptData));
  
  return {
    ...receiptData,
    signature
  };
}

export async function verifyAnchorReceipt(
  receipt: AnchorReceipt,
  publicKeyJwk: JsonWebKey,
  freshnessWindowMs: number = 30000
): Promise<{ valid: boolean; reason?: string }> {
  const now = Date.now();
  const age = now - receipt.ts;
  
  if (age > freshnessWindowMs) {
    return { valid: false, reason: 'Receipt expired' };
  }
  
  const { signature, ...receiptData } = receipt;
  const sigValid = await verifySignature(publicKeyJwk, signature, JSON.stringify(receiptData));
  
  if (!sigValid) {
    return { valid: false, reason: 'Invalid signature' };
  }
  
  return { valid: true };
}

export async function encryptState(
  sessionKey: CryptoKey,
  state: any
): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(state));
  const ct = await crypto.subtle.encrypt({ name: AES_ALGO, iv }, sessionKey, data);
  
  return {
    iv: arrayBufferToBase64(iv),
    ct: arrayBufferToBase64(ct)
  };
}

export async function decryptState(
  sessionKey: CryptoKey,
  encrypted: { iv: string; ct: string }
): Promise<any> {
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const ct = base64ToArrayBuffer(encrypted.ct);
  const pt = await crypto.subtle.decrypt({ name: AES_ALGO, iv }, sessionKey, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}

const DEVICE_KEY_STORE = 'atlas-device-keys';

export async function storeDeviceKey(deviceId: string, keyPair: DeviceKeyPair): Promise<void> {
  const stored = localStorage.getItem(DEVICE_KEY_STORE);
  const keys = stored ? JSON.parse(stored) : {};
  keys[deviceId] = {
    publicKey: keyPair.publicKey,
    fingerprint: keyPair.fingerprint
  };
  localStorage.setItem(DEVICE_KEY_STORE, JSON.stringify(keys));
}

export async function getStoredDeviceInfo(deviceId: string): Promise<{ publicKey: JsonWebKey; fingerprint: string } | null> {
  const stored = localStorage.getItem(DEVICE_KEY_STORE);
  if (!stored) return null;
  const keys = JSON.parse(stored);
  return keys[deviceId] || null;
}

export function generateDeviceId(): string {
  return randomNonce(16);
}
