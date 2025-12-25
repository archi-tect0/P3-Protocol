import { useState, useEffect } from 'react';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { deriveKey, encryptJson, decryptJson, putVaultToken, getVaultToken, deleteVaultToken } from '@/lib/vault';
import { 
  Key, Zap, Check, X, RefreshCw, 
  Brain, Sparkles, Bot, AlertTriangle, Lock, Unlock
} from 'lucide-react';

type ProviderId = 'openai' | 'anthropic' | 'gemini';

interface ProviderConfig {
  apiKey: string;
  model: string;
  connected: boolean;
}

interface ProviderMeta {
  id: ProviderId;
  title: string;
  icon: typeof Brain;
  modelHint: string;
  description: string;
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'openai', title: 'OpenAI', icon: Sparkles, modelHint: 'gpt-4o', description: 'GPT-4o, GPT-4 Turbo, GPT-3.5' },
  { id: 'anthropic', title: 'Anthropic', icon: Brain, modelHint: 'claude-sonnet-4-20250514', description: 'Claude Sonnet, Opus, Haiku' },
  { id: 'gemini', title: 'Google Gemini', icon: Bot, modelHint: 'gemini-1.5-pro', description: 'Gemini Pro, Flash, Ultra' },
];

function getCachedVaultKey(): CryptoKey | null {
  return (window as any).__atlasVaultKey || null;
}

function setCachedVaultKey(key: CryptoKey | null) {
  (window as any).__atlasVaultKey = key;
}

export default function DeveloperSettings() {
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [configs, setConfigs] = useState<Record<ProviderId, ProviderConfig>>({
    openai: { apiKey: '', model: 'gpt-4o', connected: false },
    anthropic: { apiKey: '', model: 'claude-sonnet-4-20250514', connected: false },
    gemini: { apiKey: '', model: 'gemini-1.5-pro', connected: false },
  });
  const [saving, setSaving] = useState<ProviderId | null>(null);

  // Track wallet connection state
  useEffect(() => {
    const checkWallet = () => {
      const stored = localStorage.getItem('walletAddress');
      setWalletAddress(stored);
    };
    
    checkWallet();
    
    // Listen for wallet connection changes
    const handleWalletChange = () => checkWallet();
    window.addEventListener('p3:wallet:changed', handleWalletChange);
    window.addEventListener('storage', handleWalletChange);
    
    return () => {
      window.removeEventListener('p3:wallet:changed', handleWalletChange);
      window.removeEventListener('storage', handleWalletChange);
    };
  }, []);

  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);
    
    try {
      const address = walletAddress || localStorage.getItem('walletAddress');
      if (!address) throw new Error('No wallet connected');

      const message = `Atlas Vault v2\n\nDomain: atlas-vault\nAddress: ${address.toLowerCase()}\n\nSign this message to unlock your encrypted connector tokens. This signature is deterministic and can be used to derive your vault key.`;
      
      if (!window.ethereum) throw new Error('No Web3 wallet detected');
      
      // Request accounts first (prompts connection if needed in wallet browsers)
      let accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts?.length) {
        // Try requesting accounts - this triggers wallet connection in dApp browsers
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      }
      if (!accounts?.length) throw new Error('Please connect your wallet first');
      
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, accounts[0]]
      });
      
      const derivedKey = await deriveKey(address, signature);
      setCachedVaultKey(derivedKey);
      setUnlocked(true);
      sessionStorage.setItem('atlas.vault.unlocked', 'true');
      sessionStorage.setItem('atlas.vault.signature', signature);
      window.dispatchEvent(new CustomEvent('atlas:vault:changed', { detail: { unlocked: true } }));
      
      for (const p of PROVIDERS) {
        const envelope = await getVaultToken(`dev-${p.id}`);
        if (envelope && getCachedVaultKey()) {
          try {
            const cfg = await decryptJson(getCachedVaultKey()!, envelope);
            setConfigs(prev => ({
              ...prev,
              [p.id]: { ...cfg, connected: !!cfg.apiKey }
            }));
          } catch (e) {
            console.warn(`Failed to decrypt ${p.id} config`);
          }
        }
      }
      
      const multiEnvelope = await getVaultToken('dev-multiai');
      if (multiEnvelope && getCachedVaultKey()) {
        try {
          const mm = await decryptJson(getCachedVaultKey()!, multiEnvelope);
          setMultiMode(!!mm?.enabled);
        } catch (e) {}
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to unlock');
      setCachedVaultKey(null);
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = () => {
    setCachedVaultKey(null);
    setUnlocked(false);
    sessionStorage.removeItem('atlas.vault.unlocked');
    window.dispatchEvent(new CustomEvent('atlas:vault:changed', { detail: { unlocked: false } }));
    setConfigs({
      openai: { apiKey: '', model: 'gpt-4o', connected: false },
      anthropic: { apiKey: '', model: 'claude-sonnet-4-20250514', connected: false },
      gemini: { apiKey: '', model: 'gemini-1.5-pro', connected: false },
    });
  };

  const saveProvider = async (id: ProviderId) => {
    if (!getCachedVaultKey()) return;
    setSaving(id);
    setError(null);
    
    try {
      const cfg = configs[id];
      const envelope = await encryptJson(getCachedVaultKey()!, { apiKey: cfg.apiKey, model: cfg.model });
      await putVaultToken(`dev-${id}`, envelope);
      setConfigs(prev => ({
        ...prev,
        [id]: { ...prev[id], connected: !!cfg.apiKey }
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(null);
    }
  };

  const revokeProvider = async (id: ProviderId) => {
    try {
      await deleteVaultToken(`dev-${id}`);
      setConfigs(prev => ({
        ...prev,
        [id]: { apiKey: '', model: PROVIDERS.find(p => p.id === id)?.modelHint || '', connected: false }
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to revoke');
    }
  };

  const saveMultiMode = async () => {
    if (!getCachedVaultKey()) return;
    try {
      const envelope = await encryptJson(getCachedVaultKey()!, { enabled: multiMode });
      await putVaultToken('dev-multiai', envelope);
    } catch (err: any) {
      setError(err.message || 'Failed to save multi-AI mode');
    }
  };

  const updateConfig = (id: ProviderId, field: 'apiKey' | 'model', value: string) => {
    setConfigs(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="developer-settings"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-light text-white/80">Developer Settings</h2>
          <p className="text-sm text-white/40">Multi-AI plug-ins • Wallet-encrypted keys</p>
        </div>
        <MotionButton
          onClick={unlocked ? handleLock : handleUnlock}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all
            ${unlocked 
              ? 'bg-green-400/10 border-green-400/30 text-green-400 hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-400' 
              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
            }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          data-testid="dev-vault-toggle"
        >
          {unlocking ? <RefreshCw className="w-4 h-4 animate-spin" /> : unlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          <span className="text-sm">{unlocking ? 'Signing...' : unlocked ? 'Lock Vault' : 'Unlock Vault'}</span>
        </MotionButton>
      </div>

      {error && (
        <MotionDiv
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-red-400/10 border border-red-400/30 flex items-center gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </MotionDiv>
      )}

      {!unlocked ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Lock className="w-12 h-12 text-white/20 mb-4" />
          <p className="text-white/40 mb-2">Developer vault is locked</p>
          <p className="text-white/30 text-sm">Sign with your wallet to access AI provider settings</p>
        </div>
      ) : (
        <>
          <MotionDiv
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-white/80">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="font-medium">Multi-AI Mode</span>
                </div>
                <p className="text-sm text-white/40 mt-1">Run reasoning across all connected providers simultaneously</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={multiMode}
                  onChange={(e) => {
                    setMultiMode(e.target.checked);
                    setTimeout(saveMultiMode, 100);
                  }}
                  className="sr-only peer"
                  data-testid="multi-ai-toggle"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500/50"></div>
              </label>
            </div>
          </MotionDiv>

          <div className="flex items-center gap-2 mb-4 text-white/50 text-sm">
            <Key className="w-4 h-4" />
            <span>AI Providers</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {PROVIDERS.map((provider, index) => {
              const cfg = configs[provider.id];
              const Icon = provider.icon;
              
              return (
                <MotionDiv
                  key={provider.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border transition-all ${
                    cfg.connected 
                      ? 'bg-white/8 border-green-400/30' 
                      : 'bg-white/5 border-white/10'
                  }`}
                  data-testid={`provider-${provider.id}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${cfg.connected ? 'bg-green-400/20' : 'bg-white/10'}`}>
                      <Icon className={`w-5 h-5 ${cfg.connected ? 'text-green-400' : 'text-white/60'}`} />
                    </div>
                    <div>
                      <div className="font-medium text-white/90">{provider.title}</div>
                      <div className="text-xs text-white/40">{provider.description}</div>
                    </div>
                    {cfg.connected && <Check className="w-4 h-4 text-green-400 ml-auto" />}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">API Key</label>
                      <input
                        type="password"
                        placeholder="sk-..."
                        value={cfg.apiKey}
                        onChange={(e) => updateConfig(provider.id, 'apiKey', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
                        data-testid={`input-apikey-${provider.id}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Model</label>
                      <input
                        type="text"
                        placeholder={provider.modelHint}
                        value={cfg.model}
                        onChange={(e) => updateConfig(provider.id, 'model', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/90 text-sm placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none"
                        data-testid={`input-model-${provider.id}`}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => saveProvider(provider.id)}
                      disabled={saving === provider.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 text-sm hover:bg-cyan-400/20 transition-all disabled:opacity-50"
                      data-testid={`save-${provider.id}`}
                    >
                      {saving === provider.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Save
                    </button>
                    {cfg.connected && (
                      <button
                        onClick={() => revokeProvider(provider.id)}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/30 text-red-400 text-sm hover:bg-red-400/20 transition-all"
                        data-testid={`revoke-${provider.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </MotionDiv>
              );
            })}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/40">
              <strong className="text-white/60">Security:</strong> API keys are encrypted client-side with your wallet signature and stored locally in IndexedDB. 
              Keys are sent transiently to the server proxy for API calls but are never persisted server-side.
            </div>
          </div>
        </>
      )}
    </MotionDiv>
  );
}

