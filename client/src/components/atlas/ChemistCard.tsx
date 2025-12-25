import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MotionDiv } from '@/lib/motion';
import {
  FlaskConical,
  Key,
  Check,
  X,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { SiOpenai, SiGoogle } from 'react-icons/si';

export interface LLMProvider {
  id: string;
  name: string;
  icon: typeof SiOpenai;
  placeholder: string;
  validatePrefix?: string;
  docsUrl: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: SiOpenai,
    placeholder: 'sk-...',
    validatePrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: Sparkles,
    placeholder: 'sk-ant-...',
    validatePrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: SiGoogle,
    placeholder: 'AI...',
    docsUrl: 'https://aistudio.google.com/app/apikey'
  }
];

interface ChemistCardProps {
  wallet: string;
  onComplete?: () => void;
  compact?: boolean;
}

interface ProviderStatus {
  configured: boolean;
  loading: boolean;
}

export default function ChemistCard({ wallet, onComplete, compact = false }: ChemistCardProps) {
  const { toast } = useToast();
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const fetchProviderStatuses = useCallback(async () => {
    if (!wallet) return;
    
    try {
      const response = await fetch(`/api/atlas/profile/vault/providers?wallet=${wallet}`);
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.providers)) {
        const statuses: Record<string, ProviderStatus> = {};
        LLM_PROVIDERS.forEach(p => {
          statuses[p.id] = { 
            configured: data.providers.includes(p.id), 
            loading: false 
          };
        });
        setProviderStatuses(statuses);
      }
    } catch (error) {
      console.error('Failed to fetch provider statuses:', error);
    }
  }, [wallet]);

  useEffect(() => {
    fetchProviderStatuses();
  }, [fetchProviderStatuses]);

  const validateKey = async (provider: string, key: string): Promise<boolean> => {
    setValidating(true);
    try {
      const response = await fetch('/api/atlas/profile/vault/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key })
      });
      const data = await response.json();
      return data.valid === true;
    } catch {
      return false;
    } finally {
      setValidating(false);
    }
  };

  const saveApiKey = async () => {
    if (!activeProvider || !apiKey.trim() || !wallet) return;

    setSaving(true);
    try {
      const isValid = await validateKey(activeProvider, apiKey);
      if (!isValid) {
        toast({
          title: 'Invalid API Key',
          description: 'The key format appears incorrect. Please check and try again.',
          variant: 'destructive'
        });
        setSaving(false);
        return;
      }

      const response = await fetch('/api/atlas/profile/vault/developer-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          provider: activeProvider,
          apiKey: apiKey.trim()
        })
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: 'API Key Saved',
          description: `Your ${LLM_PROVIDERS.find(p => p.id === activeProvider)?.name} key has been encrypted and stored.`
        });
        
        setProviderStatuses(prev => ({
          ...prev,
          [activeProvider]: { configured: true, loading: false }
        }));
        
        setActiveProvider(null);
        setApiKey('');
        setShowKey(false);
      } else {
        throw new Error(data.error || 'Failed to save key');
      }
    } catch (error) {
      toast({
        title: 'Failed to Save',
        description: error instanceof Error ? error.message : 'Could not save API key',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const removeApiKey = async (providerId: string) => {
    if (!wallet) return;

    setProviderStatuses(prev => ({
      ...prev,
      [providerId]: { ...prev[providerId], loading: true }
    }));

    try {
      const response = await fetch('/api/atlas/profile/vault/developer-key', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, provider: providerId })
      });

      const data = await response.json();
      
      if (data.ok) {
        toast({
          title: 'API Key Removed',
          description: `Your ${LLM_PROVIDERS.find(p => p.id === providerId)?.name} key has been deleted.`
        });
        
        setProviderStatuses(prev => ({
          ...prev,
          [providerId]: { configured: false, loading: false }
        }));
      }
    } catch (error) {
      toast({
        title: 'Failed to Remove',
        description: 'Could not delete API key',
        variant: 'destructive'
      });
      setProviderStatuses(prev => ({
        ...prev,
        [providerId]: { ...prev[providerId], loading: false }
      }));
    }
  };

  const configuredCount = Object.values(providerStatuses).filter(s => s.configured).length;

  if (compact) {
    return (
      <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
        <div className="flex items-center gap-3 mb-3">
          <FlaskConical className="w-5 h-5 text-amber-400" />
          <span className="font-medium text-white">Chemist Card</span>
          <Badge variant="outline" className="ml-auto border-amber-400/30 text-amber-400">
            {configuredCount}/{LLM_PROVIDERS.length} configured
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {LLM_PROVIDERS.map(provider => {
            const Icon = provider.icon;
            const status = providerStatuses[provider.id];
            
            return (
              <button
                key={provider.id}
                data-testid={`chemist-provider-${provider.id}`}
                onClick={() => setActiveProvider(provider.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  status?.configured
                    ? 'bg-green-500/20 border-green-400/30 text-green-400'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{provider.name}</span>
                {status?.configured && <Check className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        {activeProvider && (
          <MotionDiv
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-4 pt-4 border-t border-white/10"
          >
            <div className="space-y-3">
              <Label className="text-white/70">
                {LLM_PROVIDERS.find(p => p.id === activeProvider)?.name} API Key
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={LLM_PROVIDERS.find(p => p.id === activeProvider)?.placeholder}
                    className="pr-10 bg-black/30 border-white/20"
                    data-testid="input-api-key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  onClick={saveApiKey}
                  disabled={!apiKey.trim() || saving || validating}
                  className="bg-amber-500 hover:bg-amber-600"
                  data-testid="button-save-key"
                >
                  {saving || validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setActiveProvider(null); setApiKey(''); }}
                  data-testid="button-cancel-key"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-white/40 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Keys are encrypted with your wallet and never leave Atlas
              </p>
            </div>
          </MotionDiv>
        )}
      </div>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-red-500/10 
                 border border-amber-500/20 backdrop-blur-sm"
      data-testid="chemist-card"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-amber-500/20">
          <FlaskConical className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Chemist Card</h3>
          <p className="text-sm text-white/60">Configure your LLM API keys</p>
        </div>
        <Badge variant="outline" className="ml-auto border-amber-400/30 text-amber-400">
          {configuredCount}/{LLM_PROVIDERS.length}
        </Badge>
      </div>

      <div className="space-y-4">
        {LLM_PROVIDERS.map((provider, idx) => {
          const Icon = provider.icon;
          const status = providerStatuses[provider.id] || { configured: false, loading: false };
          const isActive = activeProvider === provider.id;

          return (
            <MotionDiv
              key={provider.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-4 rounded-xl border transition-all ${
                status.configured
                  ? 'bg-green-500/10 border-green-400/30'
                  : isActive
                    ? 'bg-amber-500/10 border-amber-400/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-6 h-6 ${status.configured ? 'text-green-400' : 'text-white/60'}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{provider.name}</span>
                    {status.configured && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-400/30">
                        <Check className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    )}
                  </div>
                  <a 
                    href={provider.docsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    Get API key →
                  </a>
                </div>
                
                {status.loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white/40" />
                ) : status.configured ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeApiKey(provider.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    data-testid={`button-remove-${provider.id}`}
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveProvider(isActive ? null : provider.id)}
                    className="border-white/20 hover:bg-white/10"
                    data-testid={`button-configure-${provider.id}`}
                  >
                    {isActive ? 'Cancel' : 'Configure'}
                  </Button>
                )}
              </div>

              {isActive && !status.configured && (
                <MotionDiv
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-4 pt-4 border-t border-white/10"
                >
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={provider.placeholder}
                        className="pr-10 bg-black/30 border-white/20"
                        data-testid="input-provider-api-key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={saveApiKey}
                        disabled={!apiKey.trim() || saving || validating}
                        className="bg-amber-500 hover:bg-amber-600"
                        data-testid="button-save-provider-key"
                      >
                        {saving || validating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {validating ? 'Validating...' : 'Saving...'}
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4 mr-2" />
                            Save Key
                          </>
                        )}
                      </Button>
                      
                      <p className="text-xs text-white/40 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Encrypted with your wallet
                      </p>
                    </div>
                  </div>
                </MotionDiv>
              )}
            </MotionDiv>
          );
        })}
      </div>

      <div className="mt-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-400/80">
            Your API keys are encrypted using your wallet address and stored securely. 
            They never leave Atlas and are only used to make requests on your behalf.
          </p>
        </div>
      </div>

      {onComplete && (
        <Button
          onClick={onComplete}
          className="w-full mt-4"
          variant="outline"
          data-testid="button-chemist-done"
        >
          {configuredCount > 0 ? 'Continue' : 'Skip for Now'}
        </Button>
      )}
    </MotionDiv>
  );
}

export { LLM_PROVIDERS };
