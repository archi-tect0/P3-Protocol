import { sdkReq } from './core';

export type EncryptResult = {
  cipher: string;
  nonce?: string;
};

export type DecryptResult = {
  text?: string;
  bytes?: number[];
};

export type SignResult = {
  signature: string;
};

export type VerifyResult = {
  ok: boolean;
};

export async function encrypt(
  plain: string | Uint8Array,
  recipientPubKey: string
): Promise<EncryptResult> {
  const body = typeof plain === 'string' 
    ? { text: plain } 
    : { bytes: Array.from(plain) };
  
  return sdkReq<EncryptResult>('/api/sdk/crypto/encrypt', {
    method: 'POST',
    body: JSON.stringify({ ...body, recipientPubKey }),
  });
}

export async function decrypt(cipher: string, senderPubKey: string): Promise<DecryptResult> {
  return sdkReq<DecryptResult>('/api/sdk/crypto/decrypt', {
    method: 'POST',
    body: JSON.stringify({ cipher, senderPubKey }),
  });
}

export async function sign(message: string): Promise<SignResult> {
  return sdkReq<SignResult>('/api/sdk/crypto/sign', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function verify(
  message: string,
  signature: string,
  pubKey: string
): Promise<VerifyResult> {
  return sdkReq<VerifyResult>('/api/sdk/crypto/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature, pubKey }),
  });
}

export async function deriveShared(theirPubKey: string): Promise<{ sharedKey: string }> {
  return sdkReq<{ sharedKey: string }>('/api/sdk/crypto/derive', {
    method: 'POST',
    body: JSON.stringify({ theirPubKey }),
  });
}
