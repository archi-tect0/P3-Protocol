/**
 * Client Signature Verification for Receipt Escrow
 * 
 * Verifies client-signed receipts using wallet signature verification.
 * Supports EIP-191 personal_sign and EIP-712 typed signatures.
 */

import { verifyMessage, hashMessage, recoverAddress } from 'ethers';
import { rootLogger } from '../../../observability/logger';
import crypto from 'crypto';

export interface ReceiptData {
  sessionId: string;
  itemId: string;
  itemType?: string;
  action: string;
  ts: number;
  metadata?: Record<string, unknown>;
}

export interface SignatureVerificationResult {
  valid: boolean;
  recoveredAddress?: string;
  error?: string;
}

function canonicalizeReceipt(receipt: ReceiptData): string {
  const canonical = {
    sessionId: receipt.sessionId,
    itemId: receipt.itemId,
    itemType: receipt.itemType || '',
    action: receipt.action,
    ts: receipt.ts,
  };
  return JSON.stringify(canonical, Object.keys(canonical).sort());
}

export function computeReceiptHash(receipt: ReceiptData): string {
  const canonical = canonicalizeReceipt(receipt);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function buildSigningMessage(receipt: ReceiptData): string {
  const hash = computeReceiptHash(receipt);
  return `P3 Receipt\n\nSession: ${receipt.sessionId}\nItem: ${receipt.itemId}\nAction: ${receipt.action}\nTimestamp: ${receipt.ts}\n\nHash: ${hash}`;
}

export async function verifyClientSignature(
  receipt: ReceiptData,
  signature: string,
  walletAddress: string
): Promise<SignatureVerificationResult> {
  try {
    if (!signature || signature.length < 132) {
      return {
        valid: false,
        error: 'Invalid signature format',
      };
    }

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return {
        valid: false,
        error: 'Invalid wallet address format',
      };
    }

    const message = buildSigningMessage(receipt);
    
    let recoveredAddress: string;
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch (err: any) {
      try {
        const canonicalMessage = canonicalizeReceipt(receipt);
        recoveredAddress = verifyMessage(canonicalMessage, signature);
      } catch (innerErr: any) {
        return {
          valid: false,
          error: `Signature verification failed: ${err.message}`,
        };
      }
    }

    const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

    if (isValid) {
      rootLogger.debug('[ClientSigning] Signature verified', {
        sessionId: receipt.sessionId,
        itemId: receipt.itemId,
        wallet: walletAddress.substring(0, 10) + '...',
      });
    } else {
      rootLogger.warn('[ClientSigning] Signature mismatch', {
        expected: walletAddress.toLowerCase(),
        recovered: recoveredAddress.toLowerCase(),
        sessionId: receipt.sessionId,
      });
    }

    return {
      valid: isValid,
      recoveredAddress: recoveredAddress.toLowerCase(),
    };
  } catch (err: any) {
    rootLogger.error('[ClientSigning] Verification error', err);
    return {
      valid: false,
      error: err.message,
    };
  }
}

export async function verifyBinaryReceiptSignature(
  sessionId: string,
  itemId: string,
  action: string,
  ts: number,
  clientSig: Uint8Array,
  walletAddress: string
): Promise<SignatureVerificationResult> {
  const signature = '0x' + Buffer.from(clientSig).toString('hex');
  
  return verifyClientSignature(
    { sessionId, itemId, action, ts },
    signature,
    walletAddress
  );
}

export function isValidSignatureFormat(signature: string): boolean {
  if (!signature) return false;
  
  const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
  
  if (sig.length !== 130) return false;
  
  const r = sig.slice(0, 64);
  const s = sig.slice(64, 128);
  const v = sig.slice(128, 130);
  
  if (!/^[0-9a-fA-F]+$/.test(sig)) return false;
  
  const vNum = parseInt(v, 16);
  if (vNum !== 27 && vNum !== 28 && vNum !== 0 && vNum !== 1) return false;
  
  return true;
}

export const clientSigning = {
  verifyClientSignature,
  verifyBinaryReceiptSignature,
  computeReceiptHash,
  buildSigningMessage,
  isValidSignatureFormat,
};

export default clientSigning;
