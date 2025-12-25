import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, MotionButton, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  User, Settings, Key, RefreshCw, AlertCircle, 
  Check, X, Edit3, Save, Eye, EyeOff, Palette, Loader2,
  Bot, Sparkles, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  walletAddress: string;
  name: string | null;
  avatar: string | null;
  theme: 'light' | 'dark' | 'system';
  createdAt: string;
  updatedAt: string;
}

interface Provider {
  id: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  isConfigured: boolean;
  lastUsed: string | null;
  usageCount: number;
}

interface ProfileResponse {
  profile: Profile;
  receipt: { status: string };
}

interface ProvidersResponse {
  providers: Provider[];
  count: number;
  receipt: { status: string };
}

const PROVIDER_CONFIG = {
  openai: { 
    label: 'OpenAI', 
    icon: '🤖', 
    color: 'from-green-400/20 to-emerald-400/20', 
    border: 'border-green-400/30',
    placeholder: 'sk-...'
  },
  anthropic: { 
    label: 'Anthropic', 
    icon: '🎭', 
    color: 'from-orange-400/20 to-amber-400/20', 
    border: 'border-orange-400/30',
    placeholder: 'sk-ant-...'
  },
  gemini: { 
    label: 'Gemini', 
    icon: '💎', 
    color: 'from-blue-400/20 to-indigo-400/20', 
    border: 'border-blue-400/30',
    placeholder: 'AIza...'
  },
};

const THEMES = [
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
  { value: 'system', label: 'System', icon: '💻' },
];

export default function IdentityMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [showAddProvider, setShowAddProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: profileData, isLoading: loadingProfile, error: profileError, refetch: refetchProfile } = useQuery<ProfileResponse>({
    queryKey: ['/api/identity/profile', wallet],
    enabled: !!wallet,
  });

  const { data: providersData, isLoading: loadingProviders, error: providersError, refetch: refetchProviders } = useQuery<ProvidersResponse>({
    queryKey: ['/api/identity/providers', wallet],
    enabled: !!wallet,
  });

  const updateProfile = useMutation({
    mutationFn: async (data: { name?: string; avatar?: string; theme?: string }) => {
      return apiRequest('/api/identity/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/identity/profile'] });
      setEditingProfile(false);
      toast({ title: 'Profile updated' });
      pushReceipt({
        id: `receipt-identity-update-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.identity.profile.update',
        endpoint: '/api/identity/profile',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to update profile', description: err.message, variant: 'destructive' });
    },
  });

  const addProvider = useMutation({
    mutationFn: async (data: { provider: string; apiKey: string }) => {
      return apiRequest('/api/identity/providers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/identity/providers'] });
      setShowAddProvider(null);
      setApiKeyInput('');
      toast({ title: 'Provider configured' });
      pushReceipt({
        id: `receipt-identity-provider-add-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.identity.provider.add',
        endpoint: '/api/identity/providers',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to add provider', description: err.message, variant: 'destructive' });
    },
  });

  const removeProvider = useMutation({
    mutationFn: async (provider: string) => {
      return apiRequest(`/api/identity/providers/${provider}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/identity/providers'] });
      toast({ title: 'Provider removed' });
      pushReceipt({
        id: `receipt-identity-provider-remove-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.identity.provider.remove',
        endpoint: '/api/identity/providers',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to remove provider', description: err.message, variant: 'destructive' });
    },
  });

  useEffect(() => {
    if (profileData?.profile) {
      setEditName(profileData.profile.name || '');
      setEditAvatar(profileData.profile.avatar || '');
    }
  }, [profileData]);

  useEffect(() => {
    if (profileData?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-identity-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.identity',
        endpoint: '/api/identity/profile',
        timestamp: Date.now()
      });
    }
  }, [profileData]);

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="identity-no-wallet">
        <User className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to manage identity</p>
      </div>
    );
  }

  const isLoading = loadingProfile || loadingProviders;
  const hasError = profileError || providersError;

  if (isLoading && !profileData && !providersData) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="identity-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="identity-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load identity settings</p>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchProfile();
            refetchProviders();
          }}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-identity-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const profile = profileData?.profile;
  const providers = providersData?.providers || [];

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="identity-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20">
            <Settings className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-identity-title">
            Identity & Settings
          </h2>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => {
            refetchProfile();
            refetchProviders();
          }}
          className="text-white/60 hover:text-white p-2"
          data-testid="button-identity-refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-6">
        <div className="p-5 rounded-xl bg-white/5 border border-white/10" data-testid="card-profile">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-medium text-white/80">Profile</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingProfile(!editingProfile)}
              className="text-white/60 hover:text-white p-1.5"
              data-testid="button-edit-profile"
            >
              {editingProfile ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-start gap-4">
            <div className="relative">
              {profile?.avatar ? (
                <img 
                  src={profile.avatar} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full bg-white/10"
                  data-testid="img-avatar"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400/20 to-purple-400/20 flex items-center justify-center" data-testid="img-avatar-placeholder">
                  <User className="w-8 h-8 text-white/40" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {editingProfile ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Display name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    data-testid="input-profile-name"
                  />
                  <Input
                    placeholder="Avatar URL"
                    value={editAvatar}
                    onChange={(e) => setEditAvatar(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                    data-testid="input-profile-avatar"
                  />
                  <MotionButton
                    onClick={() => updateProfile.mutate({ name: editName, avatar: editAvatar })}
                    disabled={updateProfile.isPending}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-400/20 border border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/30 text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-testid="button-save-profile"
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    Save
                  </MotionButton>
                </div>
              ) : (
                <>
                  <p className="text-lg font-medium text-white/90 truncate" data-testid="text-profile-name">
                    {profile?.name || 'Anonymous'}
                  </p>
                  <p className="text-sm text-white/40 truncate" data-testid="text-profile-address">
                    {wallet.slice(0, 8)}...{wallet.slice(-6)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white/5 border border-white/10" data-testid="card-theme">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-medium text-white/80">Theme</h3>
          </div>
          <div className="flex gap-2">
            {THEMES.map((theme) => (
              <Button
                key={theme.value}
                variant={profile?.theme === theme.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => updateProfile.mutate({ theme: theme.value })}
                disabled={updateProfile.isPending}
                className={profile?.theme === theme.value 
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30' 
                  : 'text-white/60 hover:text-white'}
                data-testid={`button-theme-${theme.value}`}
              >
                <span className="mr-1.5">{theme.icon}</span>
                {theme.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white/5 border border-white/10" data-testid="card-providers">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-medium text-white/80">AI Providers</h3>
            </div>
          </div>

          <div className="space-y-3">
            {Object.entries(PROVIDER_CONFIG).map(([key, config]) => {
              const provider = providers.find(p => p.provider === key);
              const isConfigured = provider?.isConfigured ?? false;

              return (
                <div key={key} className={`p-4 rounded-lg bg-gradient-to-br ${config.color} border ${config.border}`} data-testid={`provider-card-${key}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{config.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white/90" data-testid={`text-provider-name-${key}`}>{config.label}</p>
                        <p className="text-xs text-white/50" data-testid={`text-provider-status-${key}`}>
                          {isConfigured ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <Check className="w-3 h-3" /> Configured
                            </span>
                          ) : (
                            'Not configured'
                          )}
                        </p>
                      </div>
                    </div>
                    {isConfigured ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProvider.mutate(key)}
                        disabled={removeProvider.isPending}
                        className="text-red-400/60 hover:text-red-400 p-1.5"
                        data-testid={`button-remove-provider-${key}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddProvider(showAddProvider === key ? null : key)}
                        className="text-white/60 hover:text-white p-1.5"
                        data-testid={`button-add-provider-${key}`}
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showAddProvider === key && (
                      <MotionDiv
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 pt-3 border-t border-white/10"
                      >
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showApiKey ? 'text' : 'password'}
                              placeholder={config.placeholder}
                              value={apiKeyInput}
                              onChange={(e) => setApiKeyInput(e.target.value)}
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/40 pr-10"
                              data-testid={`input-api-key-${key}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                              data-testid={`button-toggle-api-key-${key}`}
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <Button
                            onClick={() => addProvider.mutate({ provider: key, apiKey: apiKeyInput })}
                            disabled={addProvider.isPending || !apiKeyInput}
                            className="bg-green-400/20 text-green-400 hover:bg-green-400/30"
                            data-testid={`button-save-api-key-${key}`}
                          >
                            {addProvider.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </MotionDiv>
                    )}
                  </AnimatePresence>

                  {isConfigured && provider?.usageCount !== undefined && provider.usageCount > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-4 text-xs text-white/40">
                      <span data-testid={`text-provider-usage-${key}`}>
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        {provider.usageCount} requests
                      </span>
                      {provider.lastUsed && (
                        <span data-testid={`text-provider-last-used-${key}`}>
                          Last used: {new Date(provider.lastUsed).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}
