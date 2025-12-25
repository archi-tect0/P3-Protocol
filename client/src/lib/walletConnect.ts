import { EthereumProvider } from '@walletconnect/ethereum-provider';

const PROJECT_ID = import.meta.env.VITE_P3_WALLETCONNECT_PROJECT_ID || '';

const CHAINS = {
  base: 8453,
  baseSepolia: 84532,
  ethereum: 1,
};

let provider: InstanceType<typeof EthereumProvider> | null = null;
let connectionPromise: Promise<InstanceType<typeof EthereumProvider>> | null = null;

export interface WCSession {
  address: string;
  chainId: number;
  connected: boolean;
  method: 'walletconnect';
  topic?: string;
  peerName?: string;
}

const SESSION_KEY = 'p3.wc.session';

export async function getWalletConnectProvider(): Promise<InstanceType<typeof EthereumProvider>> {
  if (provider) return provider;
  
  if (connectionPromise) return connectionPromise;
  
  connectionPromise = EthereumProvider.init({
    projectId: PROJECT_ID,
    chains: [CHAINS.base],
    optionalChains: [CHAINS.baseSepolia, CHAINS.ethereum],
    showQrModal: true,
    methods: [
      'eth_sendTransaction',
      'eth_signTransaction',
      'eth_sign',
      'personal_sign',
      'eth_signTypedData',
      'eth_signTypedData_v4',
    ],
    events: ['chainChanged', 'accountsChanged', 'disconnect'],
    metadata: {
      name: 'P3 Protocol',
      description: 'Privacy-Preserving Proof of Communication',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://p3protocol.io',
      icons: ['https://p3protocol.io/logo.png'],
    },
    qrModalOptions: {
      themeMode: 'dark',
    },
  });
  
  provider = await connectionPromise;
  connectionPromise = null;
  
  provider.on('accountsChanged', (accounts: string[]) => {
    console.log('[WC] Accounts changed:', accounts);
    if (accounts.length > 0) {
      updateSession({ address: accounts[0] });
      window.dispatchEvent(new CustomEvent('walletChanged', { detail: { address: accounts[0] } }));
    } else {
      clearWCSession();
      window.dispatchEvent(new CustomEvent('walletDisconnected'));
    }
  });
  
  provider.on('chainChanged', (chainId: string) => {
    console.log('[WC] Chain changed:', chainId);
    const numChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : Number(chainId);
    updateSession({ chainId: numChainId });
    window.dispatchEvent(new CustomEvent('chainChanged', { detail: { chainId: numChainId } }));
  });
  
  provider.on('disconnect', () => {
    console.log('[WC] Disconnected');
    clearWCSession();
    window.dispatchEvent(new CustomEvent('walletDisconnected'));
  });
  
  return provider;
}

export async function connectWalletConnect(): Promise<WCSession | null> {
  try {
    const wcProvider = await getWalletConnectProvider();
    
    await wcProvider.connect();
    
    const accounts = wcProvider.accounts;
    const chainId = wcProvider.chainId;
    
    if (!accounts || accounts.length === 0) {
      console.error('[WC] No accounts after connect');
      return null;
    }
    
    const session: WCSession = {
      address: accounts[0],
      chainId: chainId || CHAINS.base,
      connected: true,
      method: 'walletconnect',
      topic: wcProvider.session?.topic,
      peerName: wcProvider.session?.peer?.metadata?.name,
    };
    
    saveWCSession(session);
    
    localStorage.setItem('walletAddress', session.address);
    localStorage.setItem('connectionMethod', 'walletconnect');
    
    console.log('[WC] Connected:', session);
    return session;
  } catch (error: any) {
    if (error.message?.includes('User rejected') || error.code === 4001) {
      console.log('[WC] User rejected connection');
      return null;
    }
    console.error('[WC] Connection error:', error);
    throw error;
  }
}

export async function disconnectWalletConnect(): Promise<void> {
  try {
    if (provider) {
      await provider.disconnect();
    }
    clearWCSession();
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('connectionMethod');
    provider = null;
  } catch (error) {
    console.error('[WC] Disconnect error:', error);
    clearWCSession();
  }
}

export async function restoreWCSession(): Promise<WCSession | null> {
  const stored = getWCSession();
  if (!stored) return null;
  
  try {
    const wcProvider = await getWalletConnectProvider();
    
    if (wcProvider.session) {
      const accounts = wcProvider.accounts;
      const chainId = wcProvider.chainId;
      
      if (accounts && accounts.length > 0) {
        const session: WCSession = {
          address: accounts[0],
          chainId: chainId || stored.chainId,
          connected: true,
          method: 'walletconnect',
          topic: wcProvider.session.topic,
          peerName: wcProvider.session.peer?.metadata?.name,
        };
        
        saveWCSession(session);
        localStorage.setItem('walletAddress', session.address);
        
        console.log('[WC] Session restored:', session);
        return session;
      }
    }
    
    clearWCSession();
    return null;
  } catch (error) {
    console.error('[WC] Restore error:', error);
    clearWCSession();
    return null;
  }
}

export async function signMessage(message: string): Promise<string | null> {
  try {
    const wcProvider = await getWalletConnectProvider();
    const session = getWCSession();
    
    if (!session?.address) {
      throw new Error('No wallet connected');
    }
    
    const signature = await wcProvider.request({
      method: 'personal_sign',
      params: [message, session.address],
    });
    
    return signature as string;
  } catch (error: any) {
    if (error.code === 4001) {
      console.log('[WC] User rejected signing');
      return null;
    }
    console.error('[WC] Sign error:', error);
    throw error;
  }
}

export async function sendTransaction(tx: {
  to: string;
  value?: string;
  data?: string;
}): Promise<string | null> {
  try {
    const wcProvider = await getWalletConnectProvider();
    const session = getWCSession();
    
    if (!session?.address) {
      throw new Error('No wallet connected');
    }
    
    const txHash = await wcProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: session.address,
        to: tx.to,
        value: tx.value || '0x0',
        data: tx.data || '0x',
      }],
    });
    
    return txHash as string;
  } catch (error: any) {
    if (error.code === 4001) {
      console.log('[WC] User rejected transaction');
      return null;
    }
    console.error('[WC] Transaction error:', error);
    throw error;
  }
}

export async function switchChain(chainId: number): Promise<boolean> {
  try {
    const wcProvider = await getWalletConnectProvider();
    
    await wcProvider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${chainId.toString(16)}` }],
    });
    
    updateSession({ chainId });
    return true;
  } catch (error: any) {
    console.error('[WC] Switch chain error:', error);
    return false;
  }
}

function saveWCSession(session: WCSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('[WC] Save session error:', e);
  }
}

export function getWCSession(): WCSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[WC] Get session error:', e);
  }
  return null;
}

function updateSession(updates: Partial<WCSession>): void {
  const current = getWCSession();
  if (current) {
    saveWCSession({ ...current, ...updates });
  }
}

function clearWCSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    console.error('[WC] Clear session error:', e);
  }
}

export function isWCConnected(): boolean {
  const session = getWCSession();
  return session !== null && session.connected;
}

export { CHAINS };
