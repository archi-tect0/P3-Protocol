// Testnet Anchor Utility for Free SDK Access Tracking
// Uses Base Sepolia (chainId 84532) - gas covered by Base

import { ethers } from 'ethers';

// Base Sepolia AnchorRegistry
const TESTNET_CONTRACT = '0xD0b8f9f6c9055574D835355B466C418b7558aCE0';
const BASE_SEPOLIA_CHAIN_ID = 84532;
// Multiple RPC endpoints for reliability
const BASE_SEPOLIA_RPCS = [
  'https://sepolia.base.org',
  'https://base-sepolia.blockpi.network/v1/rpc/public',
  'https://base-sepolia-rpc.publicnode.com'
];
const BASE_SEPOLIA_RPC = BASE_SEPOLIA_RPCS[0];

// Minimal ABI for anchorEvent function
const ANCHOR_ABI = [
  {
    inputs: [
      { internalType: 'bytes32', name: 'eventHash', type: 'bytes32' },
      { internalType: 'string', name: 'metadata', type: 'string' }
    ],
    name: 'anchorEvent',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'anchorId', type: 'bytes32' },
      { indexed: false, internalType: 'bytes32', name: 'eventHash', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'submitter', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' }
    ],
    name: 'EventAnchored',
    type: 'event'
  }
];

export interface SDKDownloadAnchor {
  success: boolean;
  txHash?: string;
  anchorId?: string;
  wallet?: string;
  timestamp?: number;
  error?: string;
}

// Hash SDK download event
function hashSDKDownload(wallet: string, sdkVersion: string): string {
  const data = ethers.solidityPacked(
    ['string', 'address', 'string', 'uint256'],
    ['SDK_DOWNLOAD', wallet, sdkVersion, Math.floor(Date.now() / 1000)]
  );
  return ethers.keccak256(data);
}

// Switch to Base Sepolia network
async function switchToBaseSepolia(): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    return false;
  }

  const ethereum = (window as any).ethereum;
  
  try {
    // Try to switch
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` }]
    });
    return true;
  } catch (switchError: any) {
    // Chain not added, try to add it
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}`,
            chainName: 'Base Sepolia',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: BASE_SEPOLIA_RPCS,
            blockExplorerUrls: ['https://sepolia.basescan.org']
          }]
        });
        return true;
      } catch {
        return false;
      }
    }
    // User rejected or other error - still might work if already on chain
    return false;
  }
}

// Anchor SDK download on testnet (FREE - gas covered by Base)
export async function anchorSDKDownload(sdkVersion: string = '2.0.0'): Promise<SDKDownloadAnchor> {
  // Check for wallet - try multiple detection methods
  const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
  const walletAddress = typeof window !== 'undefined' ? localStorage.getItem('walletAddress') : null;
  
  // If no injected provider, try server-side proxy
  if (!ethereum) {
    console.log('[SDK Anchor] No injected provider, trying server proxy');
    return anchorViaServerProxy(walletAddress, sdkVersion);
  }

  try {
    // Request accounts
    let accounts: string[];
    try {
      accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    } catch (reqError: any) {
      console.log('[SDK Anchor] eth_requestAccounts failed, trying server proxy');
      return anchorViaServerProxy(walletAddress, sdkVersion);
    }
    
    if (!accounts || accounts.length === 0) {
      return anchorViaServerProxy(walletAddress, sdkVersion);
    }

    const wallet = accounts[0];

    // Switch to Base Sepolia
    const switched = await switchToBaseSepolia();
    if (!switched) {
      console.log('[SDK Anchor] Chain switch failed, trying server proxy');
      return anchorViaServerProxy(wallet, sdkVersion);
    }

    // Create provider and signer
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();

    // Create contract instance
    const contract = new ethers.Contract(TESTNET_CONTRACT, ANCHOR_ABI, signer);

    // Create event hash and metadata
    const eventHash = hashSDKDownload(wallet, sdkVersion);
    const metadata = JSON.stringify({
      type: 'sdk_download',
      version: sdkVersion,
      timestamp: Date.now(),
      wallet: wallet.toLowerCase()
    });

    // Call anchorEvent (FREE on testnet)
    const tx = await contract.anchorEvent(eventHash, metadata);
    const receipt = await tx.wait();

    // Extract anchor ID from event
    let anchorId: string | undefined;
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === 'EventAnchored') {
          anchorId = parsed.args.anchorId;
          break;
        }
      } catch {
        // Skip non-matching logs
      }
    }

    return {
      success: true,
      txHash: receipt.hash,
      anchorId,
      wallet: wallet.toLowerCase(),
      timestamp: Date.now()
    };
  } catch (error: any) {
    console.error('[SDK Anchor] Direct anchor error:', error);
    
    // Try server proxy as fallback
    const wallet = walletAddress || (ethereum ? await ethereum.request({ method: 'eth_accounts' }).then((a: string[]) => a[0]).catch(() => null) : null);
    if (wallet) {
      return anchorViaServerProxy(wallet, sdkVersion);
    }
    
    // Better error messages for common issues
    let errorMessage = error.message || 'Failed to anchor SDK download';
    
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network') || errorMessage.includes('CORS')) {
      errorMessage = 'Network connection issue. Please check your internet and try again.';
    } else if (errorMessage.includes('rejected') || errorMessage.includes('denied')) {
      errorMessage = 'Transaction was rejected. Please approve the transaction in your wallet.';
    } else if (errorMessage.includes('insufficient funds')) {
      errorMessage = 'Insufficient funds for gas. Get free testnet ETH from a faucet.';
    } else if (error.code === -32603) {
      errorMessage = 'RPC connection failed. Try again or check your wallet settings.';
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}

// Server-side proxy for anchoring when browser wallet isn't available
async function anchorViaServerProxy(walletAddress: string | null, sdkVersion: string): Promise<SDKDownloadAnchor> {
  if (!walletAddress) {
    return { success: false, error: 'Please connect your wallet first' };
  }
  
  try {
    console.log('[SDK Anchor] Using server proxy for:', walletAddress);
    const response = await fetch('/api/sdk/anchor-checkpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        walletAddress,
        sdkVersion,
        type: 'sdk_download'
      }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    const result = await response.json();
    return {
      success: true,
      txHash: result.txHash,
      anchorId: result.anchorId,
      wallet: walletAddress.toLowerCase(),
      timestamp: Date.now()
    };
  } catch (error: any) {
    console.error('[SDK Anchor] Server proxy error:', error);
    return {
      success: false,
      error: error.message || 'Failed to anchor via server. Please try again.'
    };
  }
}

// Get current chain ID
export async function getCurrentChainId(): Promise<number | null> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    return null;
  }

  try {
    const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainId, 16);
  } catch {
    return null;
  }
}

// Check if on Base Sepolia
export async function isOnBaseSepolia(): Promise<boolean> {
  const chainId = await getCurrentChainId();
  return chainId === BASE_SEPOLIA_CHAIN_ID;
}

// Contract addresses for SDK reference
export const SDK_CONTRACTS = {
  testnet: {
    name: 'Base Sepolia',
    chainId: BASE_SEPOLIA_CHAIN_ID,
    rpc: BASE_SEPOLIA_RPC,
    rpcs: BASE_SEPOLIA_RPCS,
    explorer: 'https://sepolia.basescan.org',
    anchorRegistry: TESTNET_CONTRACT
  },
  mainnet: {
    name: 'Base Mainnet',
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    rpcs: ['https://mainnet.base.org', 'https://base.blockpi.network/v1/rpc/public', 'https://base-rpc.publicnode.com'],
    explorer: 'https://basescan.org',
    anchorRegistry: '0x2539823790424051Eb03eBea1EA9bc40A475A34D'
  }
};
