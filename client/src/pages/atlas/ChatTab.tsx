import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePWA } from '@/hooks/use-pwa';
import { useSpeechCapture } from '@/hooks/useSpeechCapture';
import { getVaultToken, decryptJson } from '@/lib/vault';
import { useAtlasStore, AtlasMode, PulseView } from '@/state/useAtlasStore';
import { 
  Send, 
  Loader2, 
  Bot, 
  User, 
  Sparkles,
  Play,
  Mic,
  Square,
  Link2,
  Download,
  X
} from 'lucide-react';

type ProviderId = 'openai' | 'anthropic' | 'gemini';

interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  capabilities: string[];
}

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

interface Message {
  id: string;
  type: 'user' | 'atlas';
  content: string;
  timestamp: number;
  endpoints?: Array<{ key: string; args: Record<string, any> }>;
  suggestions?: string[];
  action?: 'pwa-install';
}

const CHAT_VERSION = 'v1206-A';

const WELCOME_SUGGESTIONS = [
  'What is Atlas?',
  'Explain Nexus encryption',
  'How does gating work?',
  'What is Node Mode?',
  'Open Pulse',
  'Open Node Mode',
  'Open News',
  'Search Wikipedia for...',
  'Open Library',
  'Send a message',
];

function getCachedVaultKey(): CryptoKey | null {
  return (window as any).__atlasVaultKey || null;
}

async function getConfiguredProvider(): Promise<{ provider: ProviderId; apiKey: string; model: string } | null> {
  const key = getCachedVaultKey();
  if (!key) return null;
  
  const providers: ProviderId[] = ['anthropic', 'openai', 'gemini'];
  for (const p of providers) {
    try {
      const envelope = await getVaultToken(`dev-${p}`);
      if (envelope) {
        const cfg = await decryptJson(key, envelope);
        if (cfg?.apiKey) {
          return { provider: p, apiKey: cfg.apiKey, model: cfg.model || '' };
        }
      }
    } catch (e) {
      console.warn(`Failed to get ${p} config`);
    }
  }
  return null;
}

export default function ChatTab({ session }: { session: Session }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setMode, setPulseView, setActiveTab, setTypingIntensity, setVoiceActive } = useAtlasStore();
  const { isInstallable, isStandalone, promptInstall } = usePWA('atlas');
  const [pwaPromptDismissed, setPwaPromptDismissed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'atlas',
      content: `[${CHAT_VERSION}] Hey there! I'm Atlas, your voice-first assistant for the P3 mesh. Node Mode is active by default to help monitor and stabilize your connection. You can turn it off anytime in Settings. Just ask or tap the mic to talk!`,
      timestamp: Date.now(),
      suggestions: WELCOME_SUGGESTIONS,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [connectedApps, setConnectedApps] = useState<ConnectedApp[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pwaPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pwaPromptAddedRef = useRef(false);
  const sendMessageRef = useRef<((text: string) => void) | null>(null);
  
  const handleTranscript = useCallback((text: string) => {
    if (sendMessageRef.current) {
      sendMessageRef.current(text);
    }
    setInput('');
  }, []);
  
  const handleSpeechError = useCallback((error: string) => {
    toast({
      title: 'Voice input error',
      description: error,
      variant: 'destructive',
    });
  }, [toast]);

  const {
    state: speechState,
    interimText,
    audioLevel,
    isSupported: isVoiceSupported,
    startCapture,
    stopCapture,
  } = useSpeechCapture({
    wallet: session.wallet,
    onTranscript: handleTranscript,
    onError: handleSpeechError,
  });
  
  const isRecording = speechState === 'recording';
  const isProcessing = speechState === 'processing';

  useEffect(() => {
    setVoiceActive(isRecording, audioLevel);
  }, [isRecording, audioLevel, setVoiceActive]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (input.length > 0) {
      const intensity = Math.min(1, input.length / 50);
      setTypingIntensity(intensity);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        setTypingIntensity(0);
      }, 1500);
    } else {
      setTypingIntensity(0);
    }
    
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [input, setTypingIntensity]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (session?.wallet && !sessionStarted) {
      startAtlasSession();
    }
  }, [session?.wallet, sessionStarted]);

  useEffect(() => {
    if (session?.wallet) {
      fetchConnectedApps();
    }
  }, [session?.wallet]);

  async function fetchConnectedApps() {
    try {
      const response = await fetch(`/api/atlas/mesh/connected?wallet=${session.wallet}`);
      const result = await response.json();
      if (result.ok && result.apps) {
        setConnectedApps(result.apps);
      }
    } catch (err) {
      console.error('Failed to fetch connected apps:', err);
    }
  }


  useEffect(() => {
    if (isInstallable && !isStandalone && !pwaPromptDismissed && !pwaPromptAddedRef.current) {
      if (pwaPromptTimerRef.current) {
        clearTimeout(pwaPromptTimerRef.current);
      }
      
      pwaPromptTimerRef.current = setTimeout(() => {
        if (pwaPromptAddedRef.current) return;
        
        setMessages(prev => {
          if (prev.some(m => m.id === 'pwa-install')) return prev;
          pwaPromptAddedRef.current = true;
          return [
            ...prev,
            {
              id: 'pwa-install',
              type: 'atlas',
              content: `Quick tip - you can install Atlas as an app for a faster, fullscreen experience. Tap Install below and I'll always be just one tap away.`,
              timestamp: Date.now(),
              action: 'pwa-install',
            },
          ];
        });
      }, 1500);
    }
    
    return () => {
      if (pwaPromptTimerRef.current) {
        clearTimeout(pwaPromptTimerRef.current);
      }
    };
  }, [isInstallable, isStandalone, pwaPromptDismissed]);

  async function handlePwaInstall() {
    const installed = await promptInstall();
    if (installed) {
      setMessages(prev => prev.map(m => 
        m.id === 'pwa-install' 
          ? { ...m, content: 'Awesome! Atlas is now installed. You can launch me from your home screen anytime.', action: undefined }
          : m
      ));
      toast({ title: 'Atlas installed!', description: 'Find Atlas on your home screen.' });
    }
  }

  function dismissPwaPrompt() {
    setPwaPromptDismissed(true);
    setMessages(prev => prev.filter(m => m.id !== 'pwa-install'));
  }

  async function startAtlasSession() {
    try {
      let authToken = localStorage.getItem('token');
      
      // Helper: Decode base64url properly (handles Coinbase/mobile wallet tokens)
      function decodeBase64Url(str: string): string {
        let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        base64 = base64.replace(/=+$/, '');
        const pad = base64.length % 4;
        if (pad === 2) base64 += '==';
        else if (pad === 3) base64 += '=';
        return atob(base64);
      }
      
      // Check if JWT is valid (not expired)
      let needsAuth = !authToken;
      if (authToken) {
        try {
          const parts = authToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(decodeBase64Url(parts[1]));
            const expiry = payload.exp ? payload.exp * 1000 : 0;
            if (expiry <= Date.now()) {
              console.log('[ChatTab] JWT expired, need re-authentication');
              localStorage.removeItem('token');
              localStorage.removeItem('atlas_session_token');
              needsAuth = true;
              authToken = null;
            }
          } else {
            needsAuth = true;
            authToken = null;
          }
        } catch (e) {
          console.log('[ChatTab] JWT decode error:', e);
          needsAuth = true;
          authToken = null;
        }
      }
      
      // If no valid JWT, trigger wallet authentication
      // But FIRST check if we have an existing bridge session to avoid redirect loops
      if (needsAuth && session.wallet) {
        const { getSession: getBridgeSession, authenticateWallet, signWithBridge } = await import('@/lib/sessionBridgeV2');
        const bridgeSession = getBridgeSession();
        
        // If bridge session exists and is connected, skip re-auth
        if (bridgeSession?.connected && bridgeSession.address?.toLowerCase() === session.wallet.toLowerCase()) {
          console.log('[ChatTab] Bridge session exists, skipping re-auth');
          // Try to get JWT from server using existing bridge session
          try {
            const statusRes = await fetch(`/api/atlas/session/bridge/status?wallet=${session.wallet}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.token) {
                localStorage.setItem('token', statusData.token);
                authToken = statusData.token;
                needsAuth = false;
                console.log('[ChatTab] Restored session from bridge status');
              }
            }
          } catch (e) {
            console.log('[ChatTab] Bridge status check failed:', e);
          }
        }
        
        // Only trigger full auth if still needed
        if (needsAuth) {
          console.log('[ChatTab] No valid JWT or bridge session, triggering wallet authentication');
          const signMessage = async (msg: string) => signWithBridge(msg);
          const authenticated = await authenticateWallet(session.wallet, signMessage);
          
          if (!authenticated) {
            console.log('[ChatTab] Authentication failed or cancelled');
            return;
          }
          
          // Get the new token after authentication
          authToken = localStorage.getItem('token');
        }
      }
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await fetch('/api/atlas/session/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          wallet: session.wallet,
          roles: session.roles || ['user'],
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.session?.token) {
          localStorage.setItem('atlas_session_token', data.session.token);
        }
        setSessionStarted(true);
      }
    } catch (err) {
      console.error('Failed to start Atlas session:', err);
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      if (!sessionStarted) {
        await startAtlasSession();
      }

      const providerConfig = await getConfiguredProvider();
      
      const requestBody: any = {
        wallet: session.wallet,
        message: messageText,
        params: {},
        roles: session.roles,
      };
      
      if (providerConfig) {
        requestBody.provider = providerConfig.provider;
        requestBody.apiKey = providerConfig.apiKey;
        requestBody.model = providerConfig.model;
      }

      const response = await fetch('/api/atlas/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      // Handle navigation intents
      if (data.ok && data.navigate) {
        const atlasMessage: Message = {
          id: `atlas-${Date.now()}`,
          type: 'atlas',
          content: data.message || 'Navigating...',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, atlasMessage]);
        setLoading(false);
        // Navigate after a short delay for feedback
        setTimeout(() => setLocation(data.navigate), 500);
        return;
      }

      // Handle canvas mode switching intents
      if (data.ok && data.canvasMode) {
        const atlasMessage: Message = {
          id: `atlas-${Date.now()}`,
          type: 'atlas',
          content: data.message || 'Switching mode...',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, atlasMessage]);
        setLoading(false);
        // Set pulseView if present in response (for personal pulse intents)
        if (data.pulseView) {
          setPulseView(data.pulseView as PulseView);
        }
        // Switch canvas mode and tab after a short delay for feedback
        setTimeout(() => {
          setMode(data.canvasMode as AtlasMode);
          setActiveTab('canvas');
        }, 300);
        return;
      }

      const validEndpoints = (data.receipts || [])
        .map((r: any) => {
          const rawKey = r.step ?? r.key ?? r.endpointKey ?? r.endpoint ?? r.capability ?? '';
          return { 
            key: String(rawKey), 
            args: r.args || {} 
          };
        })
        .filter((ep: any) => ep.key && ep.key.trim() !== '' && ep.key !== '0');

      const errorMsg = data.error || 
        (data.errors && data.errors.length > 0 ? data.errors.join(', ') : null) ||
        (data.message ? data.message : 'Unknown error');
      
      const atlasMessage: Message = {
        id: `atlas-${Date.now()}`,
        type: 'atlas',
        content: data.ok 
          ? formatAskResponse(data)
          : `Sorry, I couldn't process that request: ${errorMsg}`,
        timestamp: Date.now(),
        endpoints: validEndpoints.length > 0 ? validEndpoints : undefined,
        suggestions: data.suggestions || [],
      };

      setMessages(prev => [...prev, atlasMessage]);
    } catch (err: any) {
      console.error('Query failed:', err);
      const errorMessage: Message = {
        id: `atlas-${Date.now()}`,
        type: 'atlas',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({ title: 'Query failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }
  
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sessionStarted, session.wallet, session.roles, loading, input, toast]);

  function formatAskResponse(data: any): string {
    let response = '';
    
    if (data.message) {
      response = data.message;
    }
    
    if (data.data?.endpoints && data.data.endpoints.length > 0) {
      const endpointsList = data.data.endpoints
        .slice(0, 10)
        .map((ep: any) => `• **${ep.key}** - ${ep.description || ep.app || 'Available'}`)
        .join('\n');
      response = response 
        ? `${response}\n\n${endpointsList}`
        : endpointsList;
      if (data.data.total > 10) {
        response += `\n\n...and ${data.data.total - 10} more.`;
      }
    }
    
    if (data.data?.apps && data.data.apps.length > 0) {
      const appsList = data.data.apps
        .slice(0, 8)
        .map((app: any) => `• **${app.name || app.id}** (v${app.version || '1.0'})`)
        .join('\n');
      response = response 
        ? `${response}\n\n${appsList}`
        : appsList;
    }
    
    if (response) return response;
    
    if (data.receipts && data.receipts.length > 0) {
      const successCount = data.receipts.filter((r: any) => r.status === 'ok').length;
      const heldCount = data.heldForReview?.length || 0;
      
      if (successCount > 0) {
        return `Done! Executed ${successCount} action(s) successfully.${heldCount > 0 ? ` ${heldCount} held for review.` : ''}`;
      }
      
      if (heldCount > 0) {
        return `Your request has been held for review (requires additional approval for ${data.feature}).`;
      }
    }
    
    if (data.intent) {
      return `I understood your request (${data.intent}) but couldn't find a matching capability. Try connecting more apps.`;
    }
    
    return "I processed your request. Is there anything else you'd like to do?";
  }

  async function executeEndpoint(endpoint: { key: string; args: Record<string, any> }) {
    setLoading(true);
    try {
      const response = await fetch('/api/atlas/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointKey: endpoint.key,
          args: endpoint.args,
          session,
        }),
      });

      const data = await response.json();

      const resultMessage: Message = {
        id: `atlas-${Date.now()}`,
        type: 'atlas',
        content: data.ok
          ? `Executed **${endpoint.key}** successfully!\n\nReceipt: \`${data.receipt?.digest?.slice(0, 16)}...\``
          : `Execution failed: ${data.error || 'Unknown error'}`,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, resultMessage]);
      toast({ 
        title: data.ok ? 'Endpoint executed' : 'Execution failed',
        variant: data.ok ? 'default' : 'destructive',
      });
    } catch (err) {
      console.error('Execution failed:', err);
      toast({ title: 'Execution failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: '100%', maxHeight: '100%' }}>
      {connectedApps.length > 0 && (
        <div className="px-4 pt-3 pb-2 border-b border-white/5">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Link2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wide flex-shrink-0">Connected:</span>
            {connectedApps.map(app => (
              <div
                key={app.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10 flex-shrink-0"
                title={`${app.name}: ${app.capabilities.join(', ')}`}
              >
                <span className="text-sm">{app.icon}</span>
                <span className="text-[10px] text-slate-300">{app.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-3 space-y-3">
        {messages.map(message => (
          <div
            key={message.id}
            data-testid={`message-${message.id}`}
            className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.type === 'atlas' && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-[80%] ${message.type === 'user' ? 'order-first' : ''}`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-purple-600 text-white ml-auto'
                    : 'glass-message text-slate-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>

              {message.endpoints && message.endpoints.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.endpoints.map((ep, i) => (
                    <button
                      key={i}
                      data-testid={`endpoint-${ep.key}`}
                      onClick={() => executeEndpoint(ep)}
                      disabled={loading}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-slate-300">{ep.key}</span>
                      </div>
                      <Play className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
                    </button>
                  ))}
                </div>
              )}

              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      data-testid={`suggestion-${i}`}
                      onClick={() => sendMessage(suggestion)}
                      disabled={loading}
                      className="text-xs px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {message.action === 'pwa-install' && (
                <div className="mt-3 flex gap-2">
                  <button
                    data-testid="button-install-atlas"
                    onClick={handlePwaInstall}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-purple-500/20"
                  >
                    <Download className="w-4 h-4" />
                    Install Atlas
                  </button>
                  <button
                    data-testid="button-dismiss-install"
                    onClick={dismissPwaPrompt}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-300 text-sm border border-white/10 transition-all"
                  >
                    <X className="w-4 h-4" />
                    Maybe later
                  </button>
                </div>
              )}
            </div>

            {message.type === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="glass-message rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 p-4 border-t border-white/5">
        <div className="flex gap-2">
          {isVoiceSupported && (
            <Button
              data-testid="button-voice"
              onClick={() => {
                import('@/lib/diag').then(({ diag }) => {
                  diag('ChatTab', 'Mic button clicked', { isRecording, isProcessing, loading, isVoiceSupported });
                });
                if (isRecording) {
                  stopCapture();
                } else {
                  startCapture();
                }
              }}
              disabled={loading || isProcessing}
              variant="outline"
              title={isRecording ? "Stop recording" : isProcessing ? "Processing..." : "Start voice input"}
              className={`relative border-white/10 ${
                isRecording 
                  ? 'bg-red-500/20 border-red-500/50 text-red-400' 
                  : isProcessing
                    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isRecording ? (
                <>
                  <Square className="w-4 h-4 relative z-10" />
                  <span 
                    className="absolute inset-0 rounded-md bg-red-500/20 animate-pulse pointer-events-none"
                    style={{ transform: `scale(${1 + audioLevel * 0.3})` }}
                  />
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          )}
          <Input
            data-testid="input-message"
            value={(isRecording || isProcessing) ? interimText : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? (interimText ? "" : "Listening...") : isProcessing ? "Processing..." : "Ask Atlas anything..."}
            disabled={loading || isProcessing}
            readOnly={isRecording || isProcessing}
            className={`flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500 ${
              isRecording ? 'border-red-500/30 bg-red-500/5' : isProcessing ? 'border-yellow-500/30 bg-yellow-500/5' : ''
            }`}
          />
          <Button
            data-testid="button-send"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim() || isRecording}
            className="bg-purple-600 hover:bg-purple-500"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <style>{`
        .glass-message {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
