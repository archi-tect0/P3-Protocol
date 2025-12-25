import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Shield, Key, Layers, Database, Code, FileKey } from "lucide-react";
import { SiGithub } from "react-icons/si";
import SEO from "@/components/SEO";

export default function EncryptionGuide() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <SEO 
        title="Encryption Stack Implementation Guide | P3 Protocol"
        description="Learn how to implement end-to-end encryption with TweetNaCl (Curve25519), key backup/restore flows, and Kyber-ready architecture for future post-quantum support."
      />
      
      <div className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <a href="https://github.com/p3-protocol/p3-protocol/blob/main/client/src/lib/crypto.ts" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-white/20">
                <SiGithub className="w-4 h-4 mr-2" />
                View Source
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Encryption Stack</h1>
              <p className="text-slate-400">End-to-End Encryption with TweetNaCl</p>
            </div>
          </div>
          <p className="text-slate-300 text-lg leading-relaxed">
            P3 Protocol uses TweetNaCl (Curve25519 + XSalsa20-Poly1305) for all message encryption. The architecture includes an EnvelopeV3 structure ready for hybrid Kyber post-quantum encryption, though Kyber WASM bindings are currently stubbed. Keys are generated client-side and never leave the device unencrypted.
          </p>
        </div>

        <div className="space-y-8">
          {/* Core Crypto Service */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Key className="w-5 h-5 text-violet-400" />
              Core CryptoService Class
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                The <code>CryptoService</code> class manages key generation, storage, encryption/decryption, and session state. Keys are stored in localStorage (public key only) with the secret key held in memory during active sessions:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

interface KeyPair {
  publicKey: string;  // Base64 encoded
  secretKey: string;  // Base64 encoded
}

interface EncryptedMessage {
  nonce: string;             // 24-byte random nonce
  ciphertext: string;        // Encrypted data
  ephemeralPublicKey: string; // Sender's ephemeral key for decryption
}

class CryptoService {
  private keyPair: nacl.BoxKeyPair | null = null;
  private sessionUnlocked = false;
  private readonly STORAGE_KEY = 'dciphrs_pubkey';

  // Generate new keypair and store public key
  generateSessionKeys(): { publicKey: string; secretKeyForBackup: string } {
    this.keyPair = nacl.box.keyPair();
    localStorage.setItem(this.STORAGE_KEY, encodeBase64(this.keyPair.publicKey));
    this.sessionUnlocked = true;
    
    return {
      publicKey: encodeBase64(this.keyPair.publicKey),
      secretKeyForBackup: encodeBase64(this.keyPair.secretKey), // User must save this!
    };
  }

  // Restore from backup (user provides their secret key)
  restoreFromBackup(secretKeyB64: string): boolean {
    try {
      const secretKey = decodeBase64(secretKeyB64);
      if (secretKey.length !== 32) throw new Error('Invalid key length');
      
      this.keyPair = {
        publicKey: nacl.box.keyPair.fromSecretKey(secretKey).publicKey,
        secretKey,
      };
      localStorage.setItem(this.STORAGE_KEY, encodeBase64(this.keyPair.publicKey));
      this.sessionUnlocked = true;
      return true;
    } catch {
      return false;
    }
  }

  isSessionUnlocked(): boolean {
    // Checks: flag is set, keypair exists, and secret key is valid (not zeroed)
    return this.sessionUnlocked && this.keyPair !== null && this.keyPair.secretKey[0] !== 0;
  }

  clearSessionKeys(): void {
    if (this.keyPair) {
      this.keyPair.secretKey.fill(0); // Secure wipe
    }
    this.keyPair = null;
    this.sessionUnlocked = false;
  }
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Encrypt/Decrypt */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-cyan-400" />
              Message Encryption & Decryption
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Messages use ephemeral key pairs for forward secrecy. Each message generates a fresh keypair, encrypts with the recipient's public key, and includes the ephemeral public key in the output:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Encrypt a message for a recipient
encrypt(message: string, recipientPublicKey: string): EncryptedMessage {
  const recipientKey = decodeBase64(recipientPublicKey);
  const messageUint8 = decodeUTF8(message);
  const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
  
  // Generate ephemeral keypair for forward secrecy
  const ephemeralKeyPair = nacl.box.keyPair();
  
  // Encrypt using NaCl box (Curve25519 + XSalsa20-Poly1305)
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

// Decrypt a received message
// Note: _senderPublicKey param kept for API compatibility but uses ephemeral key
decrypt(encryptedMessage: EncryptedMessage, _senderPublicKey: string): string {
  const nonce = decodeBase64(encryptedMessage.nonce);
  const ciphertext = decodeBase64(encryptedMessage.ciphertext);
  const ephemeralPublicKey = decodeBase64(encryptedMessage.ephemeralPublicKey);
  
  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPublicKey,  // Uses ephemeral key, not sender's static key
    this.keyPair.secretKey
  );

  if (!decrypted) throw new Error('Decryption failed');
  return encodeUTF8(decrypted);
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Hybrid Kyber - Architecture Ready */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              Hybrid Kyber Post-Quantum (Stubbed)
            </h2>
            <div className="prose prose-invert max-w-none">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-4">
                <p className="text-sm text-amber-300">
                  <strong>Implementation Status:</strong> The envelope structure and hybrid key derivation logic are in place, but actual CRYSTALS-Kyber WASM bindings are <strong>stubbed</strong>. The current implementation uses placeholder random bytes where Kyber encapsulation would occur. This is ready for drop-in Kyber support when a WASM implementation is added.
                </p>
              </div>
              <p className="text-slate-300">
                The architecture supports a hybrid scheme combining Curve25519 with CRYSTALS-Kyber. When implemented, the final symmetric key will be derived by XORing both shared secrets:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// EnvelopeV3 structure supports hybrid encryption
interface EnvelopeV3 {
  version: 'v3';
  senderEphemeralPubB64: string;
  nonceB64: string;
  wrappedKeyB64: string;        // Curve25519 wrapped key
  kyberWrappedKeyB64?: string;  // Kyber KEM ciphertext (STUBBED)
  ciphertextB64: string;
  kyberEnabled: boolean;
}

// Feature flag controls Kyber usage
import { isKyberEnabled } from './featureFlags';

export function shouldUseKyber(recipientKyberPub?: string): boolean {
  return Boolean(recipientKyberPub) && isKyberEnabled();
}

// Current implementation with Kyber stubs
function encryptHybridEnvelope(
  plaintext: Uint8Array,
  recipientCurvePubB64: string,
  recipientKyberPubB64?: string
): EnvelopeV3 {
  const recipientCurvePub = Buffer.from(recipientCurvePubB64, 'base64');
  const ephemeralKeyPair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(24);
  
  // Curve25519 shared secret (fully implemented)
  const curveSharedSecret = nacl.box.before(recipientCurvePub, ephemeralKeyPair.secretKey);
  
  let finalKey = curveSharedSecret;
  let kyberWrappedKeyB64: string | undefined;
  const useKyber = shouldUseKyber(recipientKyberPubB64);
  
  if (useKyber && recipientKyberPubB64) {
    // TODO: Kyber WASM implementation will be added later
    // Current stub uses random bytes as placeholder
    const kyberPlaceholderSecret = nacl.randomBytes(32);
    kyberWrappedKeyB64 = Buffer.from(kyberPlaceholderSecret).toString('base64');
    finalKey = xorBytes(curveSharedSecret, kyberPlaceholderSecret);
    
    // When implemented, this becomes:
    // const { sharedSecret, ciphertext } = kyberEncapsulate(recipientKyberPubB64);
    // kyberWrappedKeyB64 = ciphertext;
    // finalKey = xorBytes(curveSharedSecret, sharedSecret);
  }
  
  const symKey = finalKey.slice(0, 32);
  const ciphertext = nacl.secretbox(plaintext, nonce, symKey);
  // ... rest of encryption
}`}</code></pre>
              </div>
              <p className="text-slate-400 text-sm mt-4">
                <strong>To enable Kyber:</strong> Implement a WASM wrapper for CRYSTALS-Kyber (e.g., using liboqs or pqcrypto-rs compiled to WASM), then replace the placeholder stub with actual kyberEncapsulate/kyberDecapsulate calls.
              </p>
            </div>
          </section>

          {/* Key Backup Flow */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Key Backup & Recovery
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Since secret keys never leave the device, users must back up their key to recover messages on a new device. The backup is a Base64-encoded 32-byte secret key:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// On key generation - prompt user to save this
const { publicKey, secretKeyForBackup } = cryptoService.generateSessionKeys();

// Show to user (they must save this securely!)
console.log('Your backup key:', secretKeyForBackup);
// Example: "kJ3x8mP5nQ2wL9vC6tB7..."

// On new device - restore from backup
const success = cryptoService.restoreFromBackup(userProvidedBackupKey);
if (success) {
  console.log('Keys restored! You can now decrypt messages.');
} else {
  console.error('Invalid backup key');
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Helper Functions */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Code className="w-5 h-5 text-pink-400" />
              Helper Functions
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">
                Convenience wrappers for common encryption patterns:
              </p>
              <div className="bg-slate-900 rounded-xl p-4 mt-4">
                <pre className="text-sm text-slate-300 overflow-x-auto"><code>{`// Encrypt message to JSON string (for API transport)
function encryptMessage(
  recipientPubkeyB64: string,
  message: string,
  senderKeyPair: nacl.BoxKeyPair
): EncryptedPayload {
  const recipientPubkey = Buffer.from(recipientPubkeyB64, 'base64');
  const plaintext = new TextEncoder().encode(message);
  return encryptForRecipient(recipientPubkey, plaintext, senderKeyPair);
}

// Decrypt message from EncryptedPayload
function decryptMessage(
  payload: EncryptedPayload,
  recipientSecretKey: Uint8Array
): string {
  const senderPubkey = Buffer.from(payload.senderPubkeyB64, 'base64');
  const plaintext = decryptWithSecretKey(recipientSecretKey, senderPubkey, payload);
  return new TextDecoder().decode(plaintext);
}

// Hash message for integrity verification
function hashMessage(message: string): string {
  const hash = nacl.hash(decodeUTF8(message));
  return encodeBase64(hash);
}`}</code></pre>
              </div>
            </div>
          </section>

          {/* Key Files */}
          <section className="bg-white/5 rounded-2xl border border-white/10 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <FileKey className="w-5 h-5 text-violet-400" />
              Key Files
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-violet-400">client/src/lib/crypto.ts</code>
                <span className="text-xs text-slate-500">Core encryption service (~400 lines)</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-cyan-400">client/src/lib/featureFlags.ts</code>
                <span className="text-xs text-slate-500">Kyber toggle flag</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <code className="text-sm text-amber-400">server/services/vault.ts</code>
                <span className="text-xs text-slate-500">Server-side vault unlock</span>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-12 flex justify-between">
          <Link href="/docs/session-bridge">
            <Button variant="outline" className="border-white/20">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous: Session Bridge
            </Button>
          </Link>
          <Link href="/docs/atlas-api">
            <Button className="bg-gradient-to-r from-violet-500 to-purple-500">
              Next: Atlas API v2
              <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
