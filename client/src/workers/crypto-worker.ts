import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { x25519 } from '@noble/curves/ed25519';
import { randomBytes } from '@noble/ciphers/webcrypto';

export interface EncryptRequest {
  type: 'encrypt';
  plaintext: Uint8Array;
  recipientPublicKey: Uint8Array;
  senderPrivateKey: Uint8Array;
}

export interface DecryptRequest {
  type: 'decrypt';
  ciphertext: Uint8Array;
  senderPublicKey: Uint8Array;
  recipientPrivateKey: Uint8Array;
  nonce: Uint8Array;
}

export interface GenerateKeyPairRequest {
  type: 'generateKeyPair';
}

export type CryptoWorkerRequest = EncryptRequest | DecryptRequest | GenerateKeyPairRequest;

self.onmessage = async (event: MessageEvent<CryptoWorkerRequest>) => {
  const { type } = event.data;

  try {
    switch (type) {
      case 'encrypt': {
        const { plaintext, recipientPublicKey, senderPrivateKey } = event.data;
        
        const sharedSecret = x25519.getSharedSecret(senderPrivateKey, recipientPublicKey);
        const nonce = randomBytes(24);
        
        const cipher = xchacha20poly1305(sharedSecret, nonce);
        const ciphertext = cipher.encrypt(plaintext);

        self.postMessage({
          success: true,
          result: {
            ciphertext: Array.from(ciphertext),
            nonce: Array.from(nonce),
          },
        });
        break;
      }

      case 'decrypt': {
        const { ciphertext, senderPublicKey, recipientPrivateKey, nonce } = event.data;
        
        const sharedSecret = x25519.getSharedSecret(recipientPrivateKey, senderPublicKey);
        
        const cipher = xchacha20poly1305(sharedSecret, nonce);
        const plaintext = cipher.decrypt(ciphertext);

        self.postMessage({
          success: true,
          result: {
            plaintext: Array.from(plaintext),
          },
        });
        break;
      }

      case 'generateKeyPair': {
        const privateKey = x25519.utils.randomPrivateKey();
        const publicKey = x25519.getPublicKey(privateKey);

        self.postMessage({
          success: true,
          result: {
            privateKey: Array.from(privateKey),
            publicKey: Array.from(publicKey),
          },
        });
        break;
      }

      default:
        throw new Error(`Unknown operation: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
