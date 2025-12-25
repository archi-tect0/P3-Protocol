import { useState, useEffect, useCallback } from 'react';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useConnectorStore, ConnectorId, ConnectorState } from '@/state/useConnectorStore';
import { deriveKey, encryptJson, decryptJson, putVaultToken, getVaultToken, deleteVaultToken, listVaultKeys, zeroizeKey } from '@/lib/vault';
import { 
  Shield, Lock, Unlock, Check, X, RefreshCw, 
  ExternalLink, Settings, Zap, Key, AlertTriangle
} from 'lucide-react';

function getCachedVaultKey(): CryptoKey | null {
  return (window as any).__atlasVaultKey || null;
}

function setCachedVaultKey(key: CryptoKey | null) {
  (window as any).__atlasVaultKey = key;
}

export default function ControlPanel() {
  const { connectors, receipts, vaultUnlocked, setVaultUnlocked, updateConnector, pushReceipt, loadManifests } = useConnectorStore();
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkWallet = () => {
      const stored = localStorage.getItem('walletAddress');
      if (stored) setWalletAddress(stored);
    };
    
    checkWallet();
    loadManifests();
    checkVaultStatus();
    
    // Listen for wallet connection changes
    const handleWalletChange = () => checkWallet();
    window.addEventListener('p3:wallet:changed', handleWalletChange);
    window.addEventListener('storage', handleWalletChange);
    
    return () => {
      window.removeEventListener('p3:wallet:changed', handleWalletChange);
      window.removeEventListener('storage', handleWalletChange);
    };
  }, [loadManifests]);

  const checkVaultStatus = async () => {
    try {
      const keys = await listVaultKeys();
      if (keys.length > 0 && getCachedVaultKey()) {
        for (const connectorId of keys) {
          updateConnector(connectorId as ConnectorId, { 
            status: 'connected', 
            scopes: ['encrypted'],
            lastActivity: Date.now()
          });
        }
      }
    } catch (err) {
      console.error('Failed to check vault status:', err);
    }
  };

  const handleUnlockVault = async () => {
    setUnlocking(true);
    setError(null);
    
    try {
      const address = walletAddress || localStorage.getItem('walletAddress');
      if (!address) {
        throw new Error('No wallet connected');
      }

      const message = `Atlas Vault v2\n\nDomain: atlas-vault\nAddress: ${address.toLowerCase()}\n\nSign this message to unlock your encrypted connector tokens. This signature is deterministic and can be used to derive your vault key.`;
      
      let signature: string;
      
      if (window.ethereum) {
        // Request accounts first (prompts connection if needed in wallet browsers)
        let accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          // Try requesting accounts - this triggers wallet connection in dApp browsers
          accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        }
        if (!accounts || accounts.length === 0) {
          throw new Error('Please connect your wallet first');
        }
        signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [message, accounts[0]]
        });
      } else {
        throw new Error('No Web3 wallet detected');
      }
      
      const derivedKey = await deriveKey(address, signature);
      setCachedVaultKey(derivedKey);
      sessionStorage.setItem('atlas.vault.signature', signature);
      
      const existingKeys = await listVaultKeys();
      if (existingKeys.length > 0) {
        try {
          const testToken = await getVaultToken(existingKeys[0]);
          if (testToken) {
            await decryptJson(getCachedVaultKey()!, testToken);
          }
        } catch (decryptErr) {
          console.error('Vault key mismatch - existing tokens unreadable:', decryptErr);
          setCachedVaultKey(null);
          throw new Error('Vault key mismatch. Your existing tokens cannot be decrypted with this signature.');
        }
      }
      
      setVaultUnlocked(true);
      await checkVaultStatus();
      
      pushReceipt({
        id: `receipt-vault-${Date.now()}`,
        hash: `0x${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
        scope: 'vault.unlock',
        connectorId: 'vault',
        timestamp: Date.now()
      });
      
    } catch (err: any) {
      console.error('Vault unlock failed:', err);
      setError(err.message || 'Failed to unlock vault');
      setCachedVaultKey(null);
    } finally {
      setUnlocking(false);
    }
  };

  const handleConnect = async (id: ConnectorId) => {
    if (!vaultUnlocked || !getCachedVaultKey()) {
      setError('Please unlock your vault first');
      return;
    }
    
    try {
      const mockToken = {
        access_token: `mock_token_${id}_${Date.now()}`,
        refresh_token: `mock_refresh_${id}_${Date.now()}`,
        expires_at: Date.now() + 3600000,
        scopes: ['read', 'write']
      };
      
      const encrypted = await encryptJson(getCachedVaultKey()!, mockToken);
      await putVaultToken(id, encrypted);
      
      updateConnector(id, { 
        status: 'connected', 
        scopes: mockToken.scopes, 
        lastActivity: Date.now() 
      });
      
      pushReceipt({
        id: `receipt-connect-${Date.now()}`,
        hash: `0x${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
        scope: `connector.connect.${id}`,
        connectorId: id,
        timestamp: Date.now()
      });
      
    } catch (err: any) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect');
    }
  };

  const handleRevoke = async (id: ConnectorId) => {
    try {
      await deleteVaultToken(id);
      updateConnector(id, { status: 'disconnected', scopes: [] });
      
      pushReceipt({
        id: `receipt-revoke-${Date.now()}`,
        hash: `0x${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
        scope: `connector.revoke.${id}`,
        connectorId: id,
        timestamp: Date.now()
      });
      
    } catch (err: any) {
      console.error('Revoke failed:', err);
      setError(err.message || 'Failed to revoke');
    }
  };

  const handleLockVault = useCallback(() => {
    zeroizeKey(getCachedVaultKey());
    setCachedVaultKey(null);
    sessionStorage.removeItem('atlas.vault.signature');
    setVaultUnlocked(false);
    connectors.forEach(c => {
      if (c.status === 'connected') {
        updateConnector(c.id, { status: 'disconnected' });
      }
    });
    pushReceipt({
      id: `receipt-lock-${Date.now()}`,
      hash: `0x${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      scope: 'vault.lock',
      connectorId: 'vault',
      timestamp: Date.now()
    });
  }, [connectors, setVaultUnlocked, updateConnector]);

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="control-panel"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-light text-white/80">Control Panel</h2>
          <p className="text-sm text-white/40">Encrypted connectors • Wallet-anchored vault</p>
        </div>
        <VaultStatus 
          unlocked={vaultUnlocked} 
          onUnlock={handleUnlockVault}
          onLock={handleLockVault}
          unlocking={unlocking} 
        />
      </div>

      {error && (
        <MotionDiv
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-red-400/10 border border-red-400/30 flex items-center gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400"
          >
            <X className="w-4 h-4" />
          </button>
        </MotionDiv>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ConnectorGrid 
            connectors={connectors} 
            vaultUnlocked={vaultUnlocked}
            onConnect={handleConnect}
            onRevoke={handleRevoke}
          />
        </div>
        <div>
          <ReceiptsSidebar receipts={receipts} />
        </div>
      </div>
    </MotionDiv>
  );
}

function VaultStatus({ 
  unlocked, 
  onUnlock,
  onLock,
  unlocking 
}: { 
  unlocked: boolean; 
  onUnlock: () => void;
  onLock: () => void;
  unlocking: boolean;
}) {
  return (
    <MotionButton
      onClick={unlocked ? onLock : onUnlock}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all
        ${unlocked 
          ? 'bg-green-400/10 border-green-400/30 text-green-400 hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-400' 
          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
        }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-testid="vault-status"
    >
      {unlocking ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : unlocked ? (
        <Unlock className="w-4 h-4" />
      ) : (
        <Lock className="w-4 h-4" />
      )}
      <span className="text-sm">
        {unlocking ? 'Signing...' : unlocked ? 'Lock Vault' : 'Unlock Vault'}
      </span>
    </MotionButton>
  );
}

function ConnectorGrid({ 
  connectors, 
  vaultUnlocked,
  onConnect,
  onRevoke
}: { 
  connectors: ConnectorState[];
  vaultUnlocked: boolean;
  onConnect: (id: ConnectorId) => void;
  onRevoke: (id: ConnectorId) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-white/50 text-sm">
        <Zap className="w-4 h-4" />
        <span>Services</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {connectors.map((connector, index) => (
          <ConnectorCard 
            key={connector.id}
            connector={connector}
            index={index}
            vaultUnlocked={vaultUnlocked}
            onConnect={() => onConnect(connector.id)}
            onRevoke={() => onRevoke(connector.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ConnectorCard({ 
  connector, 
  index,
  vaultUnlocked,
  onConnect,
  onRevoke
}: { 
  connector: ConnectorState;
  index: number;
  vaultUnlocked: boolean;
  onConnect: () => void;
  onRevoke: () => void;
}) {
  const isConnected = connector.status === 'connected';
  
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`p-4 rounded-xl border transition-all
        ${isConnected 
          ? 'bg-white/8 border-cyan-400/30' 
          : 'bg-white/5 border-white/10 hover:border-white/20'
        }`}
      data-testid={`connector-${connector.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{connector.icon}</div>
          <div>
            <div className="font-medium text-white/90">{connector.title}</div>
            <div className="flex items-center gap-2 text-xs">
              {isConnected ? (
                <span className="flex items-center gap-1 text-green-400">
                  <Check className="w-3 h-3" /> Connected
                </span>
              ) : (
                <span className="text-white/40">Not connected</span>
              )}
            </div>
          </div>
        </div>
        
        {isConnected && (
          <button className="p-1.5 rounded-lg hover:bg-white/10 transition-all">
            <Settings className="w-4 h-4 text-white/40" />
          </button>
        )}
      </div>
      
      {isConnected && connector.scopes.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-white/40 mb-1">Scopes</div>
          <div className="flex flex-wrap gap-1">
            {connector.scopes.map(scope => (
              <span 
                key={scope}
                className="px-2 py-0.5 text-xs rounded-full bg-white/10 text-white/60"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {connector.lastActivity && (
        <div className="text-xs text-white/30 mb-3">
          Last active: {new Date(connector.lastActivity).toLocaleString()}
        </div>
      )}
      
      <div className="flex gap-2">
        {isConnected ? (
          <>
            <button 
              onClick={onRevoke}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                        bg-red-400/10 border border-red-400/30 text-red-400 text-sm
                        hover:bg-red-400/20 transition-all"
              data-testid={`revoke-${connector.id}`}
            >
              <X className="w-3 h-3" /> Revoke
            </button>
            <button 
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                        bg-white/5 border border-white/10 text-white/60 text-sm
                        hover:bg-white/10 transition-all"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button 
            onClick={onConnect}
            disabled={!vaultUnlocked}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
              ${vaultUnlocked 
                ? 'bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/20' 
                : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
              }`}
            data-testid={`connect-${connector.id}`}
          >
            {vaultUnlocked ? (
              <>
                <Key className="w-3 h-3" /> Connect
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" /> Unlock vault first
              </>
            )}
          </button>
        )}
      </div>
    </MotionDiv>
  );
}

function ReceiptsSidebar({ receipts }: { receipts: any[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4 text-white/50 text-sm">
        <Shield className="w-4 h-4" />
        <span>Recent Activity</span>
      </div>
      
      {receipts.length === 0 ? (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <div className="text-white/40 text-sm">No activity yet</div>
          <div className="text-white/30 text-xs mt-1">
            Connect a service to see receipts
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.slice(0, 8).map((receipt, index) => (
            <MotionDiv
              key={receipt.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-3 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-cyan-400/80">
                  {receipt.scope}
                </span>
                <Check className="w-3 h-3 text-green-400" />
              </div>
              <div className="font-mono text-[10px] text-white/40 truncate">
                {receipt.hash}
              </div>
              <div className="text-[10px] text-white/30 mt-1">
                {new Date(receipt.timestamp).toLocaleTimeString()}
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </div>
  );
}

