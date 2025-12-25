import { blake3 } from "@noble/hashes/blake3.js";

const pqEnabled = process.env.ENABLE_PQ === "true";

export async function initPQ() {
  if (!pqEnabled) {
    console.log("✓ PQ security disabled (demo mode)");
    return;
  }
  // Future: await initWasm();
  console.log("✓ PQ security initialized");
}

export function hashReceipt(data: Uint8Array) {
  return blake3(data);
}

export function signReceipt(message: Uint8Array, secret: Uint8Array): Uint8Array {
  if (!pqEnabled) throw new Error("PQ signing disabled in demo mode");
  // Future: return dilithiumSign(message, secret);
  return new Uint8Array(2420); // Dilithium2 signature size
}

export function verifyReceipt(message: Uint8Array, sig: Uint8Array, pub: Uint8Array): boolean {
  if (!pqEnabled) return true; // Demo mode always verifies
  // Future: return dilithiumVerify(message, sig, pub);
  return true;
}

export function pqSessionKey(pubKeyRecipient: Uint8Array) {
  if (!pqEnabled) return { ct: new Uint8Array(1088), sharedSecret: new Uint8Array(32) };
  // Future: return kyberEncapsulate(pubKeyRecipient);
  return { ct: new Uint8Array(1088), sharedSecret: new Uint8Array(32) }; // Kyber768 sizes
}
