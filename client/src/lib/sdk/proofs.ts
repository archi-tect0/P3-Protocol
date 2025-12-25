import { assertAttestation } from "./attest";
import { getAnchors } from "./anchors";

// Proof types
export type ProofType = 'message' | 'payment' | 'meeting' | 'document' | 'vote' | 'custom';

// Proof payload
export interface ProofPayload {
  type: ProofType;
  hash: string;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

// Published proof result
export interface ProofResult {
  cid: string;
  txHash?: string;
  explorerUrl?: string;
  timestamp: number;
  anchored: boolean;
}

// Get explorer URL
function getExplorerUrl(hash: string, chainId: number): string {
  const explorers: Record<number, string> = {
    8453: 'https://basescan.org/tx/',
    84532: 'https://sepolia.basescan.org/tx/'
  };
  return (explorers[chainId] || 'https://basescan.org/tx/') + hash;
}

// Dispatch anchor published event
function dispatchAnchorEvent(payload: ProofPayload, result: ProofResult) {
  const event = new CustomEvent('p3:anchor:published', {
    detail: {
      appId: (payload.metadata?.appId as string) || payload.type,
      event: `${payload.type} proof ${result.anchored ? 'anchored' : 'stored'}`,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      timestamp: result.timestamp
    }
  });
  window.dispatchEvent(event);
}

// Publish proof to IPFS and optionally anchor on-chain
export async function publish(payload: ProofPayload): Promise<ProofResult> {
  await assertAttestation();
  
  const anchors = getAnchors();
  const timestamp = payload.timestamp || Date.now();
  
  // Prepare proof data
  const proofData = {
    ...payload,
    timestamp,
    chainId: anchors.chainId,
    contract: anchors.contract
  };
  
  try {
    const response = await fetch('/api/anchor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proofData)
    });
    
    if (!response.ok) {
      throw new Error('Failed to publish proof');
    }
    
    const data = await response.json();
    
    const result: ProofResult = {
      cid: data.cid || data.ipfsHash || `ipfs://${Date.now()}`,
      txHash: data.txHash,
      explorerUrl: data.txHash ? getExplorerUrl(data.txHash, anchors.chainId) : undefined,
      timestamp,
      anchored: !!data.txHash
    };
    
    dispatchAnchorEvent(payload, result);
    
    return result;
  } catch (e) {
    console.warn('[P3 SDK] Proof anchoring failed, using local fallback:', e);
    const fallbackResult: ProofResult = {
      cid: `local://${Date.now()}-${payload.hash.slice(0, 8)}`,
      timestamp,
      anchored: false
    };
    
    dispatchAnchorEvent(payload, fallbackResult);
    
    return fallbackResult;
  }
}

// Verify proof exists
export async function verify(cid: string): Promise<{ valid: boolean; data?: any }> {
  try {
    const response = await fetch(`/api/explorer/proofs/${cid}`);
    if (response.ok) {
      const data = await response.json();
      return { valid: true, data };
    }
  } catch {
    console.warn('[P3 SDK] Proof verification failed');
  }
  return { valid: false };
}

// Get proof by transaction hash
export async function getByTxHash(txHash: string): Promise<ProofResult | null> {
  try {
    const response = await fetch(`/api/explorer/tx/${txHash}`);
    if (response.ok) {
      const data = await response.json();
      return {
        cid: data.cid,
        txHash,
        explorerUrl: data.explorerUrl,
        timestamp: data.timestamp,
        anchored: true
      };
    }
  } catch {
    console.warn('[P3 SDK] Failed to fetch proof by txHash');
  }
  return null;
}

// Hash data for proof
export function hashData(data: string | object): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  // Simple hash for demo - production would use keccak256
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
}
