import nacl from 'tweetnacl';
import {
  decodeUTF8,
  encodeUTF8,
  encodeBase64,
  decodeBase64,
} from 'tweetnacl-util';

export interface KeyPair {
  publicKey: string;
  secretKey: string;
}

export interface EncryptedMessage {
  nonce: string;
  ciphertext: string;
  ephemeralPublicKey: string;
}

export class CryptoService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private readonly STORAGE_KEY = 'dciphrs_pubkey';
  private sessionUnlocked = false;

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    const storedPubKey = localStorage.getItem(this.STORAGE_KEY);
    
    if (storedPubKey) {
      try {
        const publicKey = decodeBase64(storedPubKey);
        this.keyPair = {
          publicKey,
          secretKey: new Uint8Array(32),
        };
      } catch (error) {
        console.error('Failed to load public key');
        this.keyPair = null;
      }
    }
  }

  generateNewKeyPair(): void {
    this.keyPair = nacl.box.keyPair();
    localStorage.setItem(this.STORAGE_KEY, encodeBase64(this.keyPair.publicKey));
    this.sessionUnlocked = true;
  }

  generateSessionKeys(): { publicKey: string; secretKeyForBackup: string } {
    this.keyPair = nacl.box.keyPair();
    localStorage.setItem(this.STORAGE_KEY, encodeBase64(this.keyPair.publicKey));
    this.sessionUnlocked = true;
    
    return {
      publicKey: encodeBase64(this.keyPair.publicKey),
      secretKeyForBackup: encodeBase64(this.keyPair.secretKey),
    };
  }

  restoreFromBackup(secretKeyB64: string): boolean {
    try {
      const secretKey = decodeBase64(secretKeyB64);
      if (secretKey.length !== 32) {
        throw new Error('Invalid secret key length');
      }
      
      this.keyPair = {
        publicKey: nacl.box.keyPair.fromSecretKey(secretKey).publicKey,
        secretKey,
      };
      localStorage.setItem(this.STORAGE_KEY, encodeBase64(this.keyPair.publicKey));
      this.sessionUnlocked = true;
      return true;
    } catch (error) {
      console.error('Failed to restore from backup');
      return false;
    }
  }

  isSessionUnlocked(): boolean {
    return this.sessionUnlocked && this.keyPair !== null && this.keyPair.secretKey[0] !== 0;
  }

  clearSessionKeys(): void {
    if (this.keyPair) {
      this.keyPair.secretKey.fill(0);
    }
    this.keyPair = null;
    this.sessionUnlocked = false;
  }

  getPublicKey(): string {
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized');
    }
    return encodeBase64(this.keyPair.publicKey);
  }

  exportKeyPair(): KeyPair {
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized');
    }
    return {
      publicKey: encodeBase64(this.keyPair.publicKey),
      secretKey: encodeBase64(this.keyPair.secretKey),
    };
  }

  importKeyPair(keyPair: KeyPair): void {
    try {
      const secretKey = decodeBase64(keyPair.secretKey);
      const publicKey = decodeBase64(keyPair.publicKey);
      if (secretKey.length !== 32 || publicKey.length !== 32) {
        throw new Error('Invalid key length');
      }
      this.keyPair = { publicKey, secretKey };
      localStorage.setItem(this.STORAGE_KEY, encodeBase64(this.keyPair.publicKey));
      this.sessionUnlocked = true;
    } catch (error) {
      throw new Error('Failed to import key pair');
    }
  }

  getPublicKeyHex(): string {
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized');
    }
    return Array.from(this.keyPair.publicKey)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  encrypt(message: string, recipientPublicKey: string): EncryptedMessage {
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized');
    }

    const recipientKey = decodeBase64(recipientPublicKey);
    const messageUint8 = decodeUTF8(message);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    
    const ephemeralKeyPair = nacl.box.keyPair();
    
    const ciphertext = nacl.box(
      messageUint8,
      nonce,
      recipientKey,
      ephemeralKeyPair.secretKey
    );

    return {
      nonce: encodeBase64(nonce),
      ciphertext: encodeBase64(ciphertext),
      ephemeralPublicKey: encodeBase64(ephemeralKeyPair.publicKey),
    };
  }

  decrypt(encryptedMessage: EncryptedMessage, _senderPublicKey: string): string {
    if (!this.keyPair) {
      throw new Error('KeyPair not initialized');
    }

    try {
      const nonce = decodeBase64(encryptedMessage.nonce);
      const ciphertext = decodeBase64(encryptedMessage.ciphertext);
      const ephemeralPublicKey = decodeBase64(encryptedMessage.ephemeralPublicKey);
      
      const decrypted = nacl.box.open(
        ciphertext,
        nonce,
        ephemeralPublicKey,
        this.keyPair.secretKey
      );

      if (!decrypted) {
        throw new Error('Decryption failed - invalid ciphertext or key');
      }

      return encodeUTF8(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  encryptToJSON(message: string, recipientPublicKey: string): string {
    const encrypted = this.encrypt(message, recipientPublicKey);
    return JSON.stringify(encrypted);
  }

  decryptFromJSON(encryptedJSON: string, senderPublicKey: string): string {
    const encrypted = JSON.parse(encryptedJSON) as EncryptedMessage;
    return this.decrypt(encrypted, senderPublicKey);
  }

  regenerateKeyPair(): { publicKey: string; secretKeyForBackup: string } {
    localStorage.removeItem(this.STORAGE_KEY);
    return this.generateSessionKeys();
  }

  getPublicKeyOnly(): string | null {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored || null;
  }

  hashMessage(message: string): string {
    const hash = nacl.hash(decodeUTF8(message));
    return encodeBase64(hash);
  }
}

export const cryptoService = new CryptoService();

export type EncryptedPayload = {
  nonceB64: string;
  wrappedKeyB64: string;
  ciphertextB64: string;
  senderPubkeyB64: string;
};

export function encryptForRecipient(
  recipientPubkey: Uint8Array,
  plaintext: Uint8Array,
  senderKeyPair: nacl.BoxKeyPair
): EncryptedPayload {
  const symKey = nacl.randomBytes(32);
  const nonce = nacl.randomBytes(24);

  const ciphertext = nacl.secretbox(plaintext, nonce, symKey);

  const wrappedKey = nacl.box(symKey, nonce, recipientPubkey, senderKeyPair.secretKey);

  return {
    nonceB64: Buffer.from(nonce).toString('base64'),
    wrappedKeyB64: Buffer.from(wrappedKey).toString('base64'),
    ciphertextB64: Buffer.from(ciphertext).toString('base64'),
    senderPubkeyB64: Buffer.from(senderKeyPair.publicKey).toString('base64'),
  };
}

export function decryptWithSecretKey(
  recipientSecretKey: Uint8Array,
  senderPubkey: Uint8Array,
  payload: EncryptedPayload
): Uint8Array {
  const nonce = Buffer.from(payload.nonceB64, 'base64');
  const wrappedKey = Buffer.from(payload.wrappedKeyB64, 'base64');
  const ciphertext = Buffer.from(payload.ciphertextB64, 'base64');

  const symKey = nacl.box.open(wrappedKey, nonce, senderPubkey, recipientSecretKey);
  if (!symKey) throw new Error('Failed to unwrap key');

  const plaintext = nacl.secretbox.open(ciphertext, nonce, symKey);
  if (!plaintext) throw new Error('Failed to decrypt');

  return plaintext;
}

export function encryptMessage(
  recipientPubkeyB64: string,
  message: string,
  senderKeyPair: nacl.BoxKeyPair
): EncryptedPayload {
  const recipientPubkey = Buffer.from(recipientPubkeyB64, 'base64');
  const plaintext = new TextEncoder().encode(message);
  return encryptForRecipient(recipientPubkey, plaintext, senderKeyPair);
}

export function decryptMessage(
  payload: EncryptedPayload,
  recipientSecretKey: Uint8Array
): string {
  const senderPubkey = Buffer.from(payload.senderPubkeyB64, 'base64');
  const plaintext = decryptWithSecretKey(recipientSecretKey, senderPubkey, payload);
  return new TextDecoder().decode(plaintext);
}

import { isKyberEnabled } from './featureFlags';

export interface EnvelopeV3 {
  version: 'v3';
  senderEphemeralPubB64: string;
  nonceB64: string;
  wrappedKeyB64: string;
  kyberWrappedKeyB64?: string;
  ciphertextB64: string;
  kyberEnabled: boolean;
}

export function shouldUseKyber(recipientKyberPub?: string): boolean {
  return Boolean(recipientKyberPub) && isKyberEnabled();
}

function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

export function encryptHybridEnvelope(
  plaintext: Uint8Array,
  recipientCurvePubB64: string,
  recipientKyberPubB64?: string
): EnvelopeV3 {
  const recipientCurvePub = Buffer.from(recipientCurvePubB64, 'base64');
  const ephemeralKeyPair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  
  const curveSharedSecret = nacl.box.before(recipientCurvePub, ephemeralKeyPair.secretKey);
  
  let finalKey = curveSharedSecret;
  let kyberWrappedKeyB64: string | undefined;
  const useKyber = shouldUseKyber(recipientKyberPubB64);
  
  if (useKyber && recipientKyberPubB64) {
    // TODO: Kyber WASM implementation will be added later
    // For now, stub the Kyber encapsulation
    // When implemented:
    // 1. const { sharedSecret, ciphertext } = kyberEncapsulate(recipientKyberPubB64);
    // 2. kyberWrappedKeyB64 = ciphertext;
    // 3. finalKey = xorBytes(curveSharedSecret, sharedSecret);
    
    const kyberPlaceholderSecret = nacl.randomBytes(32);
    kyberWrappedKeyB64 = Buffer.from(kyberPlaceholderSecret).toString('base64');
    finalKey = xorBytes(curveSharedSecret, kyberPlaceholderSecret);
  }
  
  const symKey = finalKey.slice(0, 32);
  const ciphertext = nacl.secretbox(plaintext, nonce, symKey);
  
  const wrappedKey = nacl.box(symKey, nonce, recipientCurvePub, ephemeralKeyPair.secretKey);
  
  return {
    version: 'v3',
    senderEphemeralPubB64: Buffer.from(ephemeralKeyPair.publicKey).toString('base64'),
    nonceB64: Buffer.from(nonce).toString('base64'),
    wrappedKeyB64: Buffer.from(wrappedKey).toString('base64'),
    kyberWrappedKeyB64,
    ciphertextB64: Buffer.from(ciphertext).toString('base64'),
    kyberEnabled: useKyber,
  };
}

export function decryptHybridEnvelope(
  envelope: EnvelopeV3,
  recipientCurveSecretKey: Uint8Array,
  recipientKyberSecretKey?: Uint8Array
): Uint8Array {
  const senderEphemeralPub = Buffer.from(envelope.senderEphemeralPubB64, 'base64');
  const nonce = Buffer.from(envelope.nonceB64, 'base64');
  const wrappedKey = Buffer.from(envelope.wrappedKeyB64, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertextB64, 'base64');
  
  const curveSharedSecret = nacl.box.before(senderEphemeralPub, recipientCurveSecretKey);
  
  let decryptionKey = curveSharedSecret;
  
  if (envelope.kyberEnabled && envelope.kyberWrappedKeyB64 && recipientKyberSecretKey) {
    // TODO: Kyber WASM implementation will be added later
    // For now, stub the Kyber decapsulation
    // When implemented:
    // 1. const kyberSharedSecret = kyberDecapsulate(envelope.kyberWrappedKeyB64, recipientKyberSecretKey);
    // 2. decryptionKey = xorBytes(curveSharedSecret, kyberSharedSecret);
    
    const kyberPlaceholderSecret = Buffer.from(envelope.kyberWrappedKeyB64, 'base64');
    decryptionKey = xorBytes(curveSharedSecret, kyberPlaceholderSecret);
  }
  
  const symKey = nacl.box.open(wrappedKey, nonce, senderEphemeralPub, recipientCurveSecretKey);
  if (!symKey) throw new Error('Failed to unwrap Curve25519 key');
  
  // When Kyber is enabled, we need to XOR the unwrapped key with the hybrid key derivation
  const finalSymKey = envelope.kyberEnabled && envelope.kyberWrappedKeyB64 
    ? xorBytes(symKey, decryptionKey.slice(0, 32)) 
    : symKey;
  
  const plaintext = nacl.secretbox.open(ciphertext, nonce, finalSymKey);
  if (!plaintext) throw new Error('Failed to decrypt hybrid envelope');
  
  return plaintext;
}

export function encryptHybridMessage(
  message: string,
  recipientCurvePubB64: string,
  recipientKyberPubB64?: string
): EnvelopeV3 {
  const plaintext = new TextEncoder().encode(message);
  return encryptHybridEnvelope(plaintext, recipientCurvePubB64, recipientKyberPubB64);
}

export function decryptHybridMessage(
  envelope: EnvelopeV3,
  recipientCurveSecretKey: Uint8Array,
  recipientKyberSecretKey?: Uint8Array
): string {
  const plaintext = decryptHybridEnvelope(envelope, recipientCurveSecretKey, recipientKyberSecretKey);
  return new TextDecoder().decode(plaintext);
}
