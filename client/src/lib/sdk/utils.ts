// Crypto utilities
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple hash (for demo - production uses keccak256)
export function simpleHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(64, '0');
}

// Address utilities
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function checksumAddress(address: string): string {
  return address; // Simplified - production would implement EIP-55
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// Amount utilities
export function parseEther(eth: string): bigint {
  const [whole, dec = ''] = eth.split('.');
  const decimals = (dec + '000000000000000000').slice(0, 18);
  return BigInt(whole + decimals);
}

export function formatEther(wei: bigint): string {
  const str = wei.toString().padStart(19, '0');
  const whole = str.slice(0, -18) || '0';
  const dec = str.slice(-18).replace(/0+$/, '');
  return dec ? `${whole}.${dec}` : whole;
}

export function formatGwei(wei: bigint): string {
  return (Number(wei) / 1e9).toFixed(2);
}

// Time utilities
export function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

export function isExpired(expiresAt: number): boolean {
  return expiresAt < Date.now();
}

// Network utilities
export function getNetworkName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    84532: 'Base Sepolia',
    11155111: 'Sepolia'
  };
  return names[chainId] || `Chain ${chainId}`;
}

export function getExplorerUrl(chainId: number): string {
  const explorers: Record<number, string> = {
    1: 'https://etherscan.io',
    8453: 'https://basescan.org',
    84532: 'https://sepolia.basescan.org',
    11155111: 'https://sepolia.etherscan.io'
  };
  return explorers[chainId] || 'https://basescan.org';
}

export function getTxUrl(txHash: string, chainId: number): string {
  return `${getExplorerUrl(chainId)}/tx/${txHash}`;
}

export function getAddressUrl(address: string, chainId: number): string {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}
