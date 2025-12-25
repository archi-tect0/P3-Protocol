import { assertAttestation } from "./attest";
import { getAnchors } from "./anchors";
import type { TxResult } from "./types";

// Payment metadata
export interface PaymentMeta {
  memo?: string;
  sku?: string;
  invoiceId?: string;
  category?: string;
  [key: string]: string | undefined;
}

// Payment result with proof
export interface PaymentResult extends TxResult {
  recipient: string;
  amount: string;
  proofCid?: string;
  explorerUrl?: string;
}

// Get connected wallet
async function getWallet(): Promise<{ 
  address: string; 
  sendTransaction: (tx: any) => Promise<{ hash: string }> 
}> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No wallet connected');
  }
  
  const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('Wallet not connected');
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

// Get explorer URL for transaction
function getExplorerUrl(hash: string, chainId: number): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io/tx/',
    8453: 'https://basescan.org/tx/',
    84532: 'https://sepolia.basescan.org/tx/',
    11155111: 'https://sepolia.etherscan.io/tx/'
  };
  return (explorers[chainId] || 'https://basescan.org/tx/') + hash;
}

// Pay to treasury (protocol-level payment)
export async function pay(amountWei: bigint, meta?: PaymentMeta): Promise<PaymentResult> {
  await assertAttestation();
  
  const anchors = getAnchors();
  const wallet = await getWallet();
  
  const tx = {
    from: wallet.address,
    to: anchors.treasury,
    value: '0x' + amountWei.toString(16),
    data: '0x'
  };
  
  const result = await wallet.sendTransaction(tx);
  
  // Anchor proof if meta provided
  let proofCid: string | undefined;
  if (meta) {
    try {
      const response = await fetch('/api/anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'payment',
          txHash: result.hash,
          ...meta
        })
      });
      if (response.ok) {
        const data = await response.json();
        proofCid = data.cid;
      }
    } catch (e) {
      console.warn('[P3 SDK] Failed to anchor payment proof:', e);
    }
  }
  
  return {
    hash: result.hash,
    status: 'pending',
    timestamp: Date.now(),
    recipient: anchors.treasury,
    amount: amountWei.toString(),
    proofCid,
    explorerUrl: getExplorerUrl(result.hash, anchors.chainId)
  };
}

// Pay to specific recipient (P2P payment)
export async function payNative(
  recipient: string, 
  amountWei: bigint, 
  meta?: PaymentMeta
): Promise<PaymentResult> {
  await assertAttestation();
  
  const anchors = getAnchors();
  const wallet = await getWallet();
  
  // Validate recipient address
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    throw new Error('Invalid recipient address');
  }
  
  const tx = {
    from: wallet.address,
    to: recipient,
    value: '0x' + amountWei.toString(16),
    data: '0x'
  };
  
  const result = await wallet.sendTransaction(tx);
  
  // Anchor proof
  let proofCid: string | undefined;
  try {
    const response = await fetch('/api/payments/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: result.hash,
        from: wallet.address,
        to: recipient,
        amount: amountWei.toString(),
        memo: meta?.memo || '',
        chainId: anchors.chainId
      })
    });
    if (response.ok) {
      const data = await response.json();
      proofCid = data.proofCid;
    }
  } catch (e) {
    console.warn('[P3 SDK] Failed to record payment:', e);
  }
  
  return {
    hash: result.hash,
    status: 'pending',
    timestamp: Date.now(),
    recipient,
    amount: amountWei.toString(),
    proofCid,
    explorerUrl: getExplorerUrl(result.hash, anchors.chainId)
  };
}

// Parse ETH to Wei
export function parseEther(eth: string): bigint {
  const [whole, dec = ''] = eth.split('.');
  const decimals = (dec + '000000000000000000').slice(0, 18);
  return BigInt(whole + decimals);
}

// Format Wei to ETH
export function formatEther(wei: bigint): string {
  const str = wei.toString().padStart(19, '0');
  const whole = str.slice(0, -18) || '0';
  const dec = str.slice(-18).replace(/0+$/, '');
  return dec ? `${whole}.${dec}` : whole;
}
