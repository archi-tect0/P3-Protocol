import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAtlasThemes, useSetTheme, useAtlasSettings } from '@/hooks/useAtlasVisualization';
import { useAtlasStore } from '@/state/useAtlasStore';
import { AtlasFace, DEFAULT_VISUALIZATION_SETTINGS, DEFAULT_ATLAS_STATE } from './AtlasFace';
import type { VisualizationTheme, AtlasState } from './faces/types';
import { MotionDiv } from '@/lib/motion';
import {
  User,
  Code,
  Cloud,
  Bitcoin,
  MessageSquare,
  Receipt,
  Sparkles,
  Check,
  ChevronRight,
  ChevronLeft,
  Volume2,
  VolumeX,
  Loader2,
  Globe,
  Palette,
  Waves,
  Circle,
  Grid3X3,
  Sun,
  Type,
  Stars,
  Target,
  Droplets,
  Eye,
  Layout,
  MessageCircle,
  UserCircle,
  FlaskConical,
  Brain
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ChemistCard from './ChemistCard';

export type OnboardingStep =
  | 'welcome'
  | 'user_type'
  | 'interface_preference'
  | 'profile_setup'
  | 'face_setup'
  | 'demo_weather'
  | 'demo_crypto'
  | 'demo_chat'
  | 'demo_receipts'
  | 'developer_extras'
  | 'chemist_card'
  | 'complete';

export type UserPath = 'end_user' | 'developer';

interface OnboardingReceipt {
  id: string;
  hash: string;
  scope: string;
  endpoint: string;
  timestamp: number;
  data?: any;
}

interface StepConfig {
  id: OnboardingStep;
  title: string;
  narration: string;
  icon: typeof User;
  forPaths?: UserPath[];
}

const STEP_CONFIGS: StepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Atlas',
    narration: 'Hello, I\'m Atlas. I\'m your personal interface to the decentralized web. Let\'s get you set up in just a moment.',
    icon: Globe,
  },
  {
    id: 'user_type',
    title: 'Choose Your Path',
    narration: 'First, tell me how you\'d like to use Atlas. Are you here as an end user exploring apps, or as a developer building on the platform?',
    icon: User,
  },
  {
    id: 'interface_preference',
    title: 'Interface Preference',
    narration: 'Would you like me to default to Canvas view with visual tiles, or Chat mode for conversation? You can change this anytime in Settings.',
    icon: Layout,
  },
  {
    id: 'profile_setup',
    title: 'Profile Setup',
    narration: 'What would you like me to call you? This helps personalize your experience. Your profile is encrypted and tied to your wallet.',
    icon: UserCircle,
  },
  {
    id: 'face_setup',
    title: 'Choose Your Face',
    narration: 'I can appear in different visual styles. Choose a face that suits you, from minimal dots to flowing particles. This face will animate in response to voice and activity.',
    icon: Palette,
  },
  {
    id: 'demo_weather',
    title: 'Live Data: Weather',
    narration: 'These cards are auto-materialized from public endpoints. No app store, no downloads—just live data rendered directly onto your canvas.',
    icon: Cloud,
  },
  {
    id: 'demo_crypto',
    title: 'Live Data: Crypto',
    narration: 'Real-time prices, no frontend code required. Any developer can register an endpoint, and Atlas renders it as a tile you can pin or dismiss.',
    icon: Bitcoin,
  },
  {
    id: 'demo_chat',
    title: 'Multi-LLM Integration',
    narration: 'You can talk to me directly, or choose which AI engine powers my responses. Your preferences are stored locally, encrypted by your wallet.',
    icon: MessageSquare,
  },
  {
    id: 'demo_receipts',
    title: 'Receipt System',
    narration: 'Every action you take emits a receipt—cryptographically signed proof of what happened. These receipts are yours to keep, share, or anchor on-chain.',
    icon: Receipt,
  },
  {
    id: 'developer_extras',
    title: 'Developer DevKit',
    narration: 'The Hub is where apps live. Register your endpoints with a JSON schema, and Atlas auto-generates UI tiles. DevKit lets you query the registry, inspect flows, and debug in real-time.',
    icon: Code,
    forPaths: ['developer'],
  },
  {
    id: 'chemist_card',
    title: 'LLM API Keys',
    narration: 'Would you like to add your LLM API keys now? These are encrypted with your wallet and used to power AI features. You can skip this and add them later in Settings.',
    icon: FlaskConical,
    forPaths: ['developer'],
  },
  {
    id: 'complete',
    title: 'Ready to Go!',
    narration: 'Atlas isn\'t an app. I\'m your substrate—a composable layer that connects you to decentralized services while you stay in control of your data. Welcome aboard!',
    icon: Sparkles,
  },
];

const THEME_OPTIONS: { value: VisualizationTheme; label: string; icon: typeof Circle }[] = [
  { value: 'line', label: 'Line', icon: Waves },
  { value: 'globe', label: 'Globe', icon: Globe },
  { value: 'avatar', label: 'Avatar', icon: Eye },
  { value: 'particles', label: 'Particles', icon: Sparkles },
  { value: 'wave_orb', label: 'Wave Orb', icon: Droplets },
  { value: 'lattice', label: 'Lattice', icon: Grid3X3 },
  { value: 'aura', label: 'Aura', icon: Sun },
  { value: 'minimal_dot', label: 'Minimal', icon: Circle },
  { value: 'typography_face', label: 'Typography', icon: Type },
  { value: 'constellation', label: 'Constellation', icon: Stars },
  { value: 'halo_rings', label: 'Halo', icon: Target },
  { value: 'liquid_tile', label: 'Liquid', icon: Droplets },
];

interface OnboardingFlowProps {
  wallet: string;
  onComplete: () => void;
  onSkip?: () => void;
}

export default function OnboardingFlow({ wallet, onComplete, onSkip }: OnboardingFlowProps) {
  const { toast } = useToast();
  const { pushReceipt, visualization: storeVisualization, visualizationLoaded, setOnboardingComplete } = useAtlasStore();
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [userPath, setUserPath] = useState<UserPath | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<OnboardingReceipt[]>([]);
  
  const [selectedTheme, setSelectedTheme] = useState<VisualizationTheme>('line');
  const themeChangedByUser = useRef(false);
  const vizSettings = visualizationLoaded ? storeVisualization : DEFAULT_VISUALIZATION_SETTINGS;
  const [vizState, setVizState] = useState<AtlasState>(DEFAULT_ATLAS_STATE);
  
  const [weatherData, setWeatherData] = useState<any>(null);
  const [cryptoData, setCryptoData] = useState<any>(null);
  const [devkitData, setDevkitData] = useState<any>(null);
  
  const [interfacePreference, setInterfacePreference] = useState<'canvas' | 'chat'>('canvas');
  const [displayName, setDisplayName] = useState('');
  const [sessionMemoryEnabled, setSessionMemoryEnabled] = useState(true);

  useAtlasThemes();
  useAtlasSettings(wallet);
  const setThemeMutation = useSetTheme(wallet);

  const steps = useMemo(() => {
    return STEP_CONFIGS.filter(step => {
      if (!step.forPaths) return true;
      if (!userPath) return step.id === 'welcome' || step.id === 'user_type';
      return step.forPaths.includes(userPath);
    });
  }, [userPath]);

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  const currentConfig = STEP_CONFIGS.find(s => s.id === currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStep === 'complete';

  const speakNarration = useCallback(async (text: string) => {
    if (!ttsEnabled || !text) return;
    
    try {
      setVizState(prev => ({ ...prev, speaking: true, amplitude: 0.6 }));
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                               voices.find(v => v.lang.startsWith('en'));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        utterance.onend = () => {
          setVizState(prev => ({ ...prev, speaking: false, amplitude: 0.2 }));
        };
        
        utterance.onerror = () => {
          setVizState(prev => ({ ...prev, speaking: false, amplitude: 0.2 }));
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        setVizState(prev => ({ ...prev, speaking: false, amplitude: 0.2 }));
      }
    } catch (error) {
      console.warn('TTS failed:', error);
      setVizState(prev => ({ ...prev, speaking: false, amplitude: 0.2 }));
    }
  }, [ttsEnabled]);

  useEffect(() => {
    if (currentConfig?.narration) {
      const timer = setTimeout(() => {
        speakNarration(currentConfig.narration);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, currentConfig?.narration, speakNarration]);

  useEffect(() => {
    if (themeChangedByUser.current && selectedTheme && wallet) {
      setThemeMutation.mutate(selectedTheme);
      themeChangedByUser.current = false;
    }
  }, [selectedTheme, wallet]);

  const addReceipt = useCallback((receipt: OnboardingReceipt) => {
    setReceipts(prev => [receipt, ...prev]);
    pushReceipt({
      id: receipt.id,
      hash: receipt.hash,
      scope: receipt.scope,
      endpoint: receipt.endpoint,
      timestamp: receipt.timestamp,
    });
  }, []);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/atlas/meta/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'public.open_meteo.forecast',
          params: { lat: '40.7128', lon: '-74.0060' }
        })
      });
      
      const result = await response.json();
      
      if (result.ok && result.data) {
        setWeatherData(result.data);
        addReceipt({
          id: `receipt-weather-${Date.now()}`,
          hash: result.receiptHash || `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`,
          scope: 'onboarding.demo.weather',
          endpoint: 'public.open_meteo.forecast',
          timestamp: Date.now(),
          data: result.data,
        });
      }
    } catch (error) {
      console.error('Weather fetch failed:', error);
      toast({ title: 'Weather demo failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [addReceipt, toast]);

  const fetchCrypto = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/atlas/meta/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'public.coingecko.markets',
          params: { vs_currency: 'usd', ids: 'bitcoin,ethereum', per_page: '2' }
        })
      });
      
      const result = await response.json();
      
      if (result.ok && result.data) {
        setCryptoData(Array.isArray(result.data) ? result.data : []);
        addReceipt({
          id: `receipt-crypto-${Date.now()}`,
          hash: result.receiptHash || `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`,
          scope: 'onboarding.demo.crypto',
          endpoint: 'public.coingecko.markets',
          timestamp: Date.now(),
          data: result.data,
        });
      }
    } catch (error) {
      console.error('Crypto fetch failed:', error);
      toast({ title: 'Crypto demo failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [addReceipt, toast]);

  const fetchDevkitInfo = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/atlas/devkit/stats');
      const data = await response.json();
      
      if (data.ok) {
        setDevkitData(data);
        addReceipt({
          id: `receipt-devkit-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 40)}`,
          scope: 'onboarding.demo.devkit',
          endpoint: 'devkit.stats',
          timestamp: Date.now(),
          data: data,
        });
      }
    } catch (error) {
      console.error('DevKit fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, [addReceipt]);

  useEffect(() => {
    if (currentStep === 'demo_weather' && !weatherData) {
      fetchWeather();
    } else if (currentStep === 'demo_crypto' && !cryptoData) {
      fetchCrypto();
    } else if (currentStep === 'developer_extras' && !devkitData) {
      fetchDevkitInfo();
    }
  }, [currentStep, weatherData, cryptoData, devkitData, fetchWeather, fetchCrypto, fetchDevkitInfo]);

  const saveTheme = useCallback(async () => {
    if (!wallet) return;
    
    try {
      await setThemeMutation.mutateAsync(selectedTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  }, [wallet, selectedTheme, setThemeMutation]);

  const saveProfileToServer = useCallback(async () => {
    try {
      await fetch('/api/atlas/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          displayName: displayName || undefined,
          interfacePreference,
          theme: selectedTheme,
          sessionMemoryEnabled,
        })
      });
    } catch (error) {
      console.warn('Failed to save profile:', error);
    }
  }, [wallet, displayName, interfacePreference, selectedTheme, sessionMemoryEnabled]);

  const completeOnboarding = useCallback(async () => {
    setLoading(true);
    const timestamp = Date.now();
    try {
      await saveTheme();
      await saveProfileToServer();
      
      const response = await fetch('/api/atlas/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(timestamp).toISOString(),
          onboardingPath: userPath,
          selectedTheme,
          interfacePreference,
          displayName: displayName || undefined,
          sessionMemoryEnabled,
        }),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        localStorage.setItem(`atlas.onboarding.${wallet}`, JSON.stringify({
          completedAt: new Date(timestamp).toISOString(),
          path: userPath,
          theme: selectedTheme,
          interfacePreference,
        }));
        
        setOnboardingComplete(userPath, timestamp);
        
        toast({ title: 'Onboarding complete!', description: 'Atlas is ready to assist you.' });
        onComplete();
      } else {
        localStorage.setItem(`atlas.onboarding.${wallet}`, JSON.stringify({
          completedAt: new Date(timestamp).toISOString(),
          path: userPath,
          theme: selectedTheme,
          interfacePreference,
        }));
        setOnboardingComplete(userPath, timestamp);
        onComplete();
      }
    } catch (error) {
      console.error('Failed to save onboarding:', error);
      localStorage.setItem(`atlas.onboarding.${wallet}`, JSON.stringify({
        completedAt: new Date(timestamp).toISOString(),
        path: userPath,
        theme: selectedTheme,
        interfacePreference,
      }));
      setOnboardingComplete(userPath, timestamp);
      onComplete();
    } finally {
      setLoading(false);
    }
  }, [wallet, userPath, selectedTheme, interfacePreference, displayName, sessionMemoryEnabled, saveTheme, saveProfileToServer, toast, onComplete, setOnboardingComplete]);

  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    } else if (currentStep === 'complete') {
      completeOnboarding();
    }
  }, [currentStepIndex, steps, currentStep, completeOnboarding]);

  const goToPrevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  }, [currentStepIndex, steps]);

  const selectPath = useCallback((path: UserPath) => {
    setUserPath(path);
    setTimeout(() => setCurrentStep('interface_preference'), 300);
  }, []);

  const renderStepContent = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <MotionDiv
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <AtlasFace settings={vizSettings} state={vizState} />
            </MotionDiv>
            <p className="text-white/70 text-lg">
              Your intelligent voice-first assistant for the P3 mesh
            </p>
          </div>
        );

      case 'user_type':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <MotionDiv
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                data-testid="button-path-end-user"
                onClick={() => selectPath('end_user')}
                className={`w-full p-6 rounded-2xl border transition-all duration-300 ${
                  userPath === 'end_user'
                    ? 'bg-purple-500/20 border-purple-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <User className="w-10 h-10 mx-auto mb-3 text-purple-400" />
                <h3 className="text-lg font-semibold text-white mb-2">End User</h3>
                <p className="text-sm text-white/60">
                  Streamlined experience for daily use. Focus on voice commands and quick actions.
                </p>
              </button>
            </MotionDiv>
            
            <MotionDiv
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <button
                data-testid="button-path-developer"
                onClick={() => selectPath('developer')}
                className={`w-full p-6 rounded-2xl border transition-all duration-300 ${
                  userPath === 'developer'
                    ? 'bg-cyan-500/20 border-cyan-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Code className="w-10 h-10 mx-auto mb-3 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white mb-2">Developer</h3>
                <p className="text-sm text-white/60">
                  Full access to DevKit, endpoints, and infrastructure exploration.
                </p>
              </button>
            </MotionDiv>
          </div>
        );

      case 'interface_preference':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <MotionDiv
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <button
                data-testid="button-interface-canvas"
                onClick={() => setInterfacePreference('canvas')}
                className={`w-full p-6 rounded-2xl border transition-all duration-300 ${
                  interfacePreference === 'canvas'
                    ? 'bg-purple-500/20 border-purple-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Layout className="w-10 h-10 mx-auto mb-3 text-purple-400" />
                <h3 className="text-lg font-semibold text-white mb-2">Canvas View</h3>
                <p className="text-sm text-white/60">
                  Visual tiles that auto-materialize from endpoints. Pin, arrange, and interact with data cards.
                </p>
              </button>
            </MotionDiv>
            
            <MotionDiv
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <button
                data-testid="button-interface-chat"
                onClick={() => setInterfacePreference('chat')}
                className={`w-full p-6 rounded-2xl border transition-all duration-300 ${
                  interfacePreference === 'chat'
                    ? 'bg-cyan-500/20 border-cyan-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <MessageCircle className="w-10 h-10 mx-auto mb-3 text-cyan-400" />
                <h3 className="text-lg font-semibold text-white mb-2">Chat Mode</h3>
                <p className="text-sm text-white/60">
                  Conversational interface with Atlas. Speak or type, get responses in a familiar chat format.
                </p>
              </button>
            </MotionDiv>
          </div>
        );

      case 'profile_setup':
        return (
          <div className="space-y-6 max-w-md mx-auto">
            <MotionDiv
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-white/80">Display Name (optional)</Label>
                  <Input
                    id="displayName"
                    data-testid="input-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How should I address you?"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  />
                  <p className="text-xs text-white/40">Leave empty to remain anonymous</p>
                </div>
                
                <div className="pt-4 space-y-3">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center gap-3">
                      <Brain className="w-5 h-5 text-purple-400" />
                      <div>
                        <p className="text-white font-medium">Session Memory</p>
                        <p className="text-xs text-white/50">Remember preferences across sessions</p>
                      </div>
                    </div>
                    <button
                      data-testid="button-session-memory-toggle"
                      onClick={() => setSessionMemoryEnabled(!sessionMemoryEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        sessionMemoryEnabled ? 'bg-purple-500' : 'bg-white/20'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        sessionMemoryEnabled ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </MotionDiv>
          </div>
        );

      case 'face_setup':
        return (
          <div className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="w-48 h-48">
                <AtlasFace settings={vizSettings} state={vizState} />
              </div>
            </div>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-md mx-auto">
              {THEME_OPTIONS.map((theme) => {
                const Icon = theme.icon;
                return (
                  <button
                    key={theme.value}
                    data-testid={`button-theme-${theme.value}`}
                    onClick={() => {
                      themeChangedByUser.current = true;
                      setSelectedTheme(theme.value);
                    }}
                    className={`p-3 rounded-xl border transition-all duration-200 ${
                      selectedTheme === theme.value
                        ? 'bg-purple-500/20 border-purple-400/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-1 ${
                      selectedTheme === theme.value ? 'text-purple-400' : 'text-white/60'
                    }`} />
                    <span className="text-xs text-white/70">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'demo_weather':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <Cloud className="w-16 h-16 text-cyan-400" />
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : weatherData ? (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="text-white font-medium mb-2">New York Weather</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50">Temperature</p>
                    <p className="text-white text-lg">
                      {weatherData.current?.temperature_2m || weatherData.hourly?.temperature_2m?.[0] || 'N/A'}°C
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50">Conditions</p>
                    <p className="text-white text-lg">
                      {weatherData.current?.weathercode === 0 ? 'Clear' : 'Cloudy'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-white/50">
                <p>Weather data unavailable</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchWeather}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}
            
            {receipts.filter(r => r.scope.includes('weather')).length > 0 && (
              <ReceiptCard receipt={receipts.find(r => r.scope.includes('weather'))!} />
            )}
          </div>
        );

      case 'demo_crypto':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <Bitcoin className="w-16 h-16 text-amber-400" />
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              </div>
            ) : cryptoData && cryptoData.length > 0 ? (
              <div className="space-y-3">
                {cryptoData.map((coin: any) => (
                  <div 
                    key={coin.id}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-4"
                  >
                    {coin.image && (
                      <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
                    )}
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{coin.name}</h4>
                      <p className="text-white/50 text-sm">{coin.symbol?.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-lg font-semibold">
                        ${coin.current_price?.toLocaleString() || 'N/A'}
                      </p>
                      <p className={`text-sm ${
                        (coin.price_change_percentage_24h || 0) >= 0 
                          ? 'text-emerald-400' 
                          : 'text-red-400'
                      }`}>
                        {(coin.price_change_percentage_24h || 0).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/50">
                <p>Crypto data unavailable</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchCrypto}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}
            
            {receipts.filter(r => r.scope.includes('crypto')).length > 0 && (
              <ReceiptCard receipt={receipts.find(r => r.scope.includes('crypto'))!} />
            )}
          </div>
        );

      case 'demo_chat':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <MessageSquare className="w-16 h-16 text-purple-400" />
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="text-white font-medium mb-3">Supported LLM Providers</h4>
              <div className="space-y-2">
                {['OpenAI (GPT-4)', 'Anthropic (Claude)', 'Google (Gemini)'].map((provider, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-white/80">{provider}</span>
                    <Badge className="ml-auto bg-white/10 text-white/60">Available</Badge>
                  </div>
                ))}
              </div>
              <p className="text-white/50 text-sm mt-3">
                Configure your preferred provider in Settings → Developer
              </p>
            </div>
          </div>
        );

      case 'demo_receipts':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <Receipt className="w-16 h-16 text-emerald-400" />
            </div>
            
            <p className="text-white/60 text-center text-sm mb-4">
              {receipts.length} receipt{receipts.length !== 1 ? 's' : ''} generated during this onboarding
            </p>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {receipts.length > 0 ? (
                receipts.map((receipt) => (
                  <ReceiptCard key={receipt.id} receipt={receipt} />
                ))
              ) : (
                <div className="text-center py-8 text-white/50">
                  No receipts yet. Complete the previous steps to generate receipts.
                </div>
              )}
            </div>
          </div>
        );

      case 'developer_extras':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <Code className="w-16 h-16 text-cyan-400" />
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              </div>
            ) : devkitData ? (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="text-white font-medium mb-3">DevKit Statistics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/50">Total Endpoints</p>
                    <p className="text-white text-xl font-semibold">
                      {devkitData.stats?.totalEndpoints || devkitData.totalEndpoints || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50">Live Endpoints</p>
                    <p className="text-cyan-400 text-xl font-semibold">
                      {devkitData.stats?.liveEndpoints || devkitData.liveEndpoints || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50">Registered Apps</p>
                    <p className="text-white text-xl font-semibold">
                      {devkitData.stats?.apps || devkitData.apps || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-white/50">Compound Flows</p>
                    <p className="text-white text-xl font-semibold">
                      {devkitData.stats?.flows || devkitData.flows || 0}
                    </p>
                  </div>
                </div>
                <p className="text-white/50 text-sm mt-4">
                  Try: "list all endpoints" or "describe public.open_meteo.forecast"
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-white/50">
                <p>DevKit stats unavailable</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchDevkitInfo}
                  className="mt-2"
                >
                  Retry
                </Button>
              </div>
            )}
            
            {receipts.filter(r => r.scope.includes('devkit')).length > 0 && (
              <ReceiptCard receipt={receipts.find(r => r.scope.includes('devkit'))!} />
            )}
          </div>
        );

      case 'chemist_card':
        return (
          <div className="space-y-4">
            <div className="flex justify-center mb-4">
              <FlaskConical className="w-16 h-16 text-amber-400" />
            </div>
            
            <ChemistCard wallet={wallet} />
            
            <p className="text-white/50 text-sm text-center mt-4">
              Keys are encrypted with your wallet and stored securely. You can update them anytime in Settings.
            </p>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <MotionDiv
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center"
            >
              <Check className="w-10 h-10 text-white" />
            </MotionDiv>
            
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">You're all set!</h3>
              <p className="text-white/60">
                Atlas is configured and ready. {receipts.length} receipts were generated during setup.
              </p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              <Badge className="bg-purple-500/20 text-purple-300">
                {userPath === 'developer' ? 'Developer Mode' : 'End User Mode'}
              </Badge>
              <Badge className="bg-cyan-500/20 text-cyan-300">
                {selectedTheme.replace(/_/g, ' ')} face
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300">
                {interfacePreference === 'canvas' ? 'Canvas View' : 'Chat Mode'}
              </Badge>
              {displayName && (
                <Badge className="bg-amber-500/20 text-amber-300">
                  {displayName}
                </Badge>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#141414] z-50 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/20 pointer-events-none" />
      
      <header className="relative z-10 px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
            <Globe className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">Atlas Setup</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            data-testid="button-toggle-tts"
            variant="ghost"
            size="icon"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="text-white/60 hover:text-white"
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
          
          {onSkip && (
            <Button
              data-testid="button-skip-onboarding"
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-white/50 hover:text-white"
            >
              Skip
            </Button>
          )}
        </div>
      </header>
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-1 overflow-x-auto">
          {steps.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isPast = idx < currentStepIndex;
            const Icon = step.icon;
            
            return (
              <div 
                key={step.id}
                className="flex items-center"
              >
                <div 
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
                    isActive 
                      ? 'bg-purple-500/20 text-purple-300' 
                      : isPast 
                        ? 'text-emerald-400' 
                        : 'text-white/30'
                  }`}
                >
                  {isPast ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                  <span className="hidden sm:inline whitespace-nowrap">{step.title}</span>
                </div>
                {idx < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-white/20 mx-1 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
        
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <MotionDiv
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-lg mx-auto"
          >
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              {currentConfig?.title}
            </h2>
            <p className="text-white/60 text-center mb-6 text-sm">
              {currentConfig?.narration}
            </p>
            
            {renderStepContent()}
          </MotionDiv>
        </main>
        
        <footer className="relative z-10 px-4 py-4 border-t border-white/10">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            <Button
              data-testid="button-prev-step"
              variant="ghost"
              onClick={goToPrevStep}
              disabled={isFirstStep || loading}
              className="text-white/60 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            
            <div className="flex items-center gap-1">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentStepIndex 
                      ? 'bg-purple-400 w-4' 
                      : idx < currentStepIndex 
                        ? 'bg-emerald-400' 
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            
            <Button
              data-testid="button-next-step"
              onClick={goToNextStep}
              disabled={loading || (currentStep === 'user_type' && !userPath)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {isLastStep ? 'Get Started' : 'Continue'}
              {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: OnboardingReceipt }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 rounded-lg p-3 border border-white/10"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
          <Receipt className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{receipt.scope}</p>
          <p className="text-white/40 text-xs font-mono truncate">{receipt.hash}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-white/40 hover:text-white/60 text-xs"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/10 text-xs">
          <p className="text-white/50">Endpoint: <span className="text-white/70">{receipt.endpoint}</span></p>
          <p className="text-white/50">Time: <span className="text-white/70">{new Date(receipt.timestamp).toLocaleTimeString()}</span></p>
        </div>
      )}
    </MotionDiv>
  );
}

export function useOnboardingFlow(wallet: string | null) {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet) {
      setNeedsOnboarding(null);
      setLoading(false);
      return;
    }

    const checkOnboarding = async () => {
      setLoading(true);
      try {
        const local = localStorage.getItem(`atlas.onboarding.${wallet}`);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.completedAt) {
            setNeedsOnboarding(false);
            setLoading(false);
            return;
          }
        }

        const response = await fetch(`/api/atlas/settings?wallet=${wallet}`);
        const data = await response.json();
        
        if (data.ok && data.settings?.onboardingCompletedAt) {
          localStorage.setItem(`atlas.onboarding.${wallet}`, JSON.stringify({
            completedAt: data.settings.onboardingCompletedAt,
            path: data.settings.userPath,
            theme: data.settings.selectedTheme,
          }));
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        const local = localStorage.getItem(`atlas.onboarding.${wallet}`);
        setNeedsOnboarding(!local);
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, [wallet]);

  const markComplete = useCallback(async () => {
    if (!wallet) return;
    
    localStorage.setItem(`atlas.onboarding.${wallet}`, JSON.stringify({
      completedAt: new Date().toISOString(),
    }));
    setNeedsOnboarding(false);
  }, [wallet]);

  const resetOnboarding = useCallback(async () => {
    if (!wallet) return;
    
    localStorage.removeItem(`atlas.onboarding.${wallet}`);
    setNeedsOnboarding(true);
  }, [wallet]);

  return {
    needsOnboarding,
    loading,
    markComplete,
    resetOnboarding,
  };
}
