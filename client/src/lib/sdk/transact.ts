import { assertAttestation } from "./attest";
import { getAnchors } from "./anchors";
import { getSelector, isMethodAllowed } from "./allowlist";
import type { TxResult } from "./types";

// Encode call data (simplified - production would use viem/ethers)
function encodeCallData(selector: string, args: any[]): string {
  // In production: use viem encodeAbiParameters
  return selector + args.map(a => 
    typeof a === 'string' ? a.replace('0x', '').padStart(64, '0') : 
    BigInt(a).toString(16).padStart(64, '0')
  ).join('');
}

// Get wallet from session
async function getWallet(): Promise<{ address: string; sendTransaction: (tx: any) => Promise<{ hash: string }> }> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No wallet connected');
  }
  
  const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No wallet connected');
  }
  
  return {
    address: accounts[0],
    sendTransaction: async (tx: any) => {
      const hash = await (window as any).ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx]
      });
      return { hash };
    }
  };
}

// Execute guarded transaction
export async function transact(method: string, args: any[]): Promise<TxResult> {
  // Attestation check
  await assertAttestation();
  
  // Allowlist check
  if (!isMethodAllowed(method)) {
    throw new Error(`Method not allowed: ${method}`);
  }
  
  const selector = getSelector(method);
  const anchors = getAnchors();
  const wallet = await getWallet();
  
  const data = encodeCallData(selector, args);
  const tx = {
    from: wallet.address,
    to: anchors.contract,
    data,
    value: '0x0'
  };
  
  const result = await wallet.sendTransaction(tx);
  
  return {
    hash: result.hash,
    status: 'pending',
    timestamp: Date.now()
  };
}

// Convenience: call view function (no tx)
export async function call(method: string, args: any[]): Promise<string> {
  const selector = getSelector(method);
  const anchors = getAnchors();
  const data = encodeCallData(selector, args);
  
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return (window as any).ethereum.request({
      method: 'eth_call',
      params: [{ to: anchors.contract, data }, 'latest']
    });
  }
  throw new Error('No provider available');
}
