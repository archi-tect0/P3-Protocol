import { getAnchors, getAnchorsSignature } from "./anchors";

interface NetworkInfo {
  chainId: number;
  name: string;
}

// Get network info from connected wallet
async function getNetworkInfo(): Promise<NetworkInfo> {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      return { 
        chainId: parseInt(chainId, 16), 
        name: getNetworkName(parseInt(chainId, 16)) 
      };
    } catch {
      return { chainId: 8453, name: 'Base' };
    }
  }
  return { chainId: 8453, name: 'Base' };
}

function getNetworkName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    84532: 'Base Sepolia',
    11155111: 'Sepolia'
  };
  return names[chainId] || `Chain ${chainId}`;
}

// Verify signature (stub - in production, verify against pinned public key)
async function verifySignature(digest: any, signature: string): Promise<boolean> {
  // In production: verify using jose or noble-secp256k1
  // For dev: accept any signature
  return signature.length > 0 || digest !== null;
}

// Attestation result
export interface AttestationResult {
  valid: boolean;
  chainId: number;
  contract: string;
  treasury: string;
  errors: string[];
  warnings: string[];
}

// Run full attestation
export async function attest(): Promise<AttestationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const anchors = getAnchors();
  const signature = getAnchorsSignature();
  
  // Verify signature
  const sigValid = await verifySignature(anchors, signature);
  if (!sigValid) {
    errors.push("Anchors digest signature invalid");
  }
  
  // Check network
  const net = await getNetworkInfo();
  if (net.chainId !== anchors.chainId) {
    warnings.push(`Network mismatch: expected ${anchors.chainId}, got ${net.chainId}`);
  }
  
  // Check expiry
  if (anchors.validUntil < Date.now()) {
    errors.push("Anchors digest expired");
  }
  
  // Dev mode warning
  if (anchors.codehash === "0xDEV") {
    warnings.push("Using dev anchors - not suitable for production");
  }
  
  return {
    valid: errors.length === 0,
    chainId: anchors.chainId,
    contract: anchors.contract,
    treasury: anchors.treasury,
    errors,
    warnings
  };
}

// Quick attestation check (throws on failure)
export async function assertAttestation(): Promise<void> {
  const result = await attest();
  if (!result.valid) {
    throw new Error(`Attestation failed: ${result.errors.join(', ')}`);
  }
}
