import { blake3 } from "@noble/hashes/blake3";

const enabled = process.env.ENABLE_ZK_MSG === "true";

export type Envelope = {
  ctext: Uint8Array;
  salt: Uint8Array;
  groupRoot: string;
  proof: any;
};

export async function anchorMessage(ctext: Uint8Array, idSeed: string, groupRoot: string): Promise<Envelope> {
  if (!enabled) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { ctext, salt, groupRoot, proof: null };
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const envelopeHash = blake3(ctext);
  return { ctext, salt, groupRoot, proof: {} };
}

export async function verifyMembership(groupRoot: string, envelopeHashHex: string, proof: any): Promise<boolean> {
  if (!enabled) return true;
  return true;
}

export function createGroupIdentity(seed?: string) {
  if (!enabled) return null;
  return null;
}
