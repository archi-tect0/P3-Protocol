import { Router } from 'express';
import { createError } from '../middleware/errors';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { db } from '../../db';
import { walletKeys } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

/**
 * Server Key Encryption
 * 
 * All wallet secret keys are encrypted before storage using AES-256-GCM
 * with a server-side key derived from PRIVATE_KEY environment variable.
 * This ensures keys are protected at rest and only the server can decrypt them.
 */
function getServerEncryptionKey(): Buffer {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required for crypto operations');
  }
  return crypto.createHash('sha256').update(privateKey).digest();
}

function encryptSecretKey(secretKey: Uint8Array): string {
  const key = getServerEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  
  return encodeBase64(new Uint8Array([...iv, ...authTag, ...encrypted]));
}

function decryptSecretKey(encryptedData: string): Uint8Array {
  const key = getServerEncryptionKey();
  const data = decodeBase64(encryptedData);
  
  const iv = data.slice(0, 12);
  const authTag = data.slice(12, 28);
  const encrypted = data.slice(28);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(authTag));
  
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted)),
    decipher.final()
  ]);
  
  return new Uint8Array(decrypted);
}

/**
 * Key Management with Database Persistence
 * 
 * Keys are generated once per wallet and stored encrypted in the database.
 * This ensures:
 * - Keys survive server restarts
 * - Keys are protected at rest with AES-256-GCM
 * - Consistent signing/encryption across sessions
 */
async function getOrCreateKeyPairs(wallet: string): Promise<{
  boxKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  signKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
}> {
  const normalizedWallet = wallet.toLowerCase();
  
  const existing = await db
    .select()
    .from(walletKeys)
    .where(eq(walletKeys.wallet, normalizedWallet))
    .limit(1);
  
  if (existing.length > 0) {
    const record = existing[0];
    
    await db
      .update(walletKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(walletKeys.wallet, normalizedWallet));
    
    return {
      boxKeyPair: {
        publicKey: decodeBase64(record.boxPublicKey),
        secretKey: decryptSecretKey(record.encryptedBoxSecret),
      },
      signKeyPair: {
        publicKey: decodeBase64(record.signPublicKey),
        secretKey: decryptSecretKey(record.encryptedSignSecret),
      },
    };
  }
  
  const boxKeyPair = nacl.box.keyPair();
  const signKeyPair = nacl.sign.keyPair();
  
  await db.insert(walletKeys).values({
    wallet: normalizedWallet,
    encryptedBoxSecret: encryptSecretKey(boxKeyPair.secretKey),
    boxPublicKey: encodeBase64(boxKeyPair.publicKey),
    encryptedSignSecret: encryptSecretKey(signKeyPair.secretKey),
    signPublicKey: encodeBase64(signKeyPair.publicKey),
  });
  
  return { boxKeyPair, signKeyPair };
}

/**
 * POST /api/sdk/crypto/encrypt
 * 
 * Encrypts a message using NaCl box (X25519 + XSalsa20-Poly1305).
 * The sender's keypair is derived from their wallet address.
 */
router.post('/encrypt', async (req, res, next) => {
  try {
    const { text, bytes, recipientPubKey } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!text && !bytes) {
      throw createError('text or bytes required', 400, 'invalid_request');
    }

    if (!recipientPubKey) {
      throw createError('recipientPubKey required', 400, 'invalid_request');
    }

    const message = text 
      ? new TextEncoder().encode(text) 
      : new Uint8Array(bytes);

    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const { boxKeyPair } = await getOrCreateKeyPairs(wallet);
    
    let recipientPubKeyBytes: Uint8Array;
    try {
      recipientPubKeyBytes = decodeBase64(recipientPubKey);
    } catch {
      throw createError('Invalid recipientPubKey format', 400, 'invalid_key');
    }

    const encrypted = nacl.box(message, nonce, recipientPubKeyBytes, boxKeyPair.secretKey);
    const cipher = encodeBase64(new Uint8Array([...nonce, ...encrypted]));

    res.json({ 
      cipher, 
      nonce: encodeBase64(nonce),
      senderPubKey: encodeBase64(boxKeyPair.publicKey),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sdk/crypto/decrypt
 * 
 * Decrypts a message using NaCl box.
 * Requires the sender's public key to decrypt.
 */
router.post('/decrypt', async (req, res, next) => {
  try {
    const { cipher, senderPubKey } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!cipher) {
      throw createError('cipher required', 400, 'invalid_request');
    }

    if (!senderPubKey) {
      throw createError('senderPubKey required', 400, 'invalid_request');
    }

    const cipherBytes = decodeBase64(cipher);
    const nonce = cipherBytes.slice(0, nacl.box.nonceLength);
    const message = cipherBytes.slice(nacl.box.nonceLength);

    const { boxKeyPair } = await getOrCreateKeyPairs(wallet);
    const senderPubKeyBytes = decodeBase64(senderPubKey);
    
    const decrypted = nacl.box.open(message, nonce, senderPubKeyBytes, boxKeyPair.secretKey);

    if (!decrypted) {
      throw createError('Decryption failed - invalid ciphertext or wrong sender key', 400, 'decryption_failed');
    }

    const text = new TextDecoder().decode(decrypted);
    res.json({ text });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sdk/crypto/sign
 * 
 * Signs a message using Ed25519.
 * Uses persistent signing keypair for the wallet.
 */
router.post('/sign', async (req, res, next) => {
  try {
    const { message } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!message) {
      throw createError('message required', 400, 'invalid_request');
    }

    const { signKeyPair } = await getOrCreateKeyPairs(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, signKeyPair.secretKey);

    res.json({ 
      signature: encodeBase64(signature),
      publicKey: encodeBase64(signKeyPair.publicKey),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sdk/crypto/verify
 * 
 * Verifies an Ed25519 signature.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { message, signature, pubKey } = req.body;

    if (!message || !signature || !pubKey) {
      throw createError('message, signature, and pubKey required', 400, 'invalid_request');
    }

    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeBase64(signature);
    const pubKeyBytes = decodeBase64(pubKey);

    const ok = nacl.sign.detached.verify(messageBytes, signatureBytes, pubKeyBytes);

    res.json({ ok });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/sdk/crypto/derive
 * 
 * Derives a shared secret using ECDH (X25519).
 */
router.post('/derive', async (req, res, next) => {
  try {
    const { theirPubKey } = req.body;
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    if (!theirPubKey) {
      throw createError('theirPubKey required', 400, 'invalid_request');
    }

    const { boxKeyPair } = await getOrCreateKeyPairs(wallet);
    const theirPubKeyBytes = decodeBase64(theirPubKey);

    const sharedKey = nacl.box.before(theirPubKeyBytes, boxKeyPair.secretKey);

    res.json({ sharedKey: encodeBase64(sharedKey) });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/sdk/crypto/pubkey
 * 
 * Returns the public keys for a wallet (box + sign).
 */
router.get('/pubkey', async (req, res, next) => {
  try {
    const wallet = req.sdkUser?.wallet;

    if (!wallet) {
      throw createError('Wallet required', 401, 'unauthorized');
    }

    const { boxKeyPair, signKeyPair } = await getOrCreateKeyPairs(wallet);

    res.json({ 
      publicKey: encodeBase64(boxKeyPair.publicKey),
      signPublicKey: encodeBase64(signKeyPair.publicKey),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
