import * as cryptoV2 from "./modules/crypto";

export interface MessageEnvelope {
  version: 2 | 3;
  cipher: string;
  recipientPubKey: string;
  anchorId?: string;
}

export interface EncryptedMessage {
  envelope: MessageEnvelope;
  cid?: string;
  timestamp: number;
}

export async function msgEncrypted(
  recipientPubkey: string,
  message: string,
  options?: { anchor?: boolean; type?: string }
): Promise<EncryptedMessage> {
  const { cipher } = await cryptoV2.encrypt(message, recipientPubkey);
  
  const envelope: MessageEnvelope = {
    version: 3,
    cipher,
    recipientPubKey: recipientPubkey
  };
  
  let cid: string | undefined;
  
  if (options?.anchor) {
    try {
      const response = await fetch('/api/sdk/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: options.type || 'encrypted_message',
          data: { cipherHash: cipher.slice(0, 64) }
        })
      });
      if (response.ok) {
        const data = await response.json();
        cid = data.anchorId;
        envelope.anchorId = cid;
      }
    } catch (e) {
      console.warn('[P3 SDK] Failed to anchor message:', e);
    }
  }
  
  return {
    envelope,
    cid,
    timestamp: Date.now()
  };
}

export async function decryptMessage(
  envelope: MessageEnvelope,
  senderPubKey: string = ''
): Promise<string> {
  const result = await cryptoV2.decrypt(envelope.cipher, senderPubKey);
  if (!result.text) {
    throw new Error('Decryption failed');
  }
  return result.text;
}

export async function getRecipientPubkey(address: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/sdk/session/pubkey/${address}`);
    if (response.ok) {
      const data = await response.json();
      return data.pubkey;
    }
  } catch {
    console.warn('[P3 SDK] Failed to fetch pubkey');
  }
  return null;
}

export async function registerPubkey(pubkey: string): Promise<boolean> {
  try {
    const response = await fetch('/api/sdk/session/pubkey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey })
    });
    return response.ok;
  } catch {
    return false;
  }
}
