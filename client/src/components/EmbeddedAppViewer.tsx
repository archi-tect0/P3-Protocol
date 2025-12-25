import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, ExternalLink, Mic, MicOff, MessageCircle, Loader2, Globe, Lock, ShieldCheck, Zap } from 'lucide-react';
import { getManifestById, type ExternalAppManifest } from '@/lib/externalAppManifest';
import { meshSessionBridge } from '@/lib/meshSessionBridge';

const ALLOWED_EMBED_ORIGINS = [
  'https://dehub.io',
  'https://www.dehub.io',
  'https://mail.google.com',
  'https://slack.com',
  'https://discord.com',
  'https://notion.so',
  'https://figma.com',
  'https://open.spotify.com',
  'https://youtube.com',
  'https://www.youtube.com',
  'https://x.com',
  'https://twitter.com',
  'https://github.com',
  'https://linkedin.com',
  'https://www.linkedin.com',
  'https://coinbase.com',
  'https://www.coinbase.com',
  'https://opensea.io',
  'https://drive.google.com',
  'https://dropbox.com',
  'https://www.dropbox.com',
  'https://trello.com',
  'https://canva.com',
];

// Sites that definitively block iframe embedding with X-Frame-Options: DENY
const KNOWN_NON_EMBEDDABLE = [
  // Google
  'voice.google.com',
  'messages.google.com',
  'mail.google.com',
  'calendar.google.com',
  'docs.google.com',
  'sheets.google.com',
  'slides.google.com',
  'drive.google.com',
  'meet.google.com',
  'photos.google.com',
  'keep.google.com',
  'chat.google.com',
  // Microsoft
  'teams.microsoft.com',
  'outlook.live.com',
  'outlook.office.com',
  'office.com',
  'onedrive.live.com',
  'sharepoint.com',
  // Social
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'reddit.com',
  'tiktok.com',
  'snapchat.com',
  'pinterest.com',
  'threads.net',
  // Messaging
  'web.whatsapp.com',
  'whatsapp.com',
  'discord.com',
  'slack.com',
  'telegram.org',
  'web.telegram.org',
  'signal.org',
  // Streaming
  'netflix.com',
  'hulu.com',
  'disneyplus.com',
  'max.com',
  'hbomax.com',
  'primevideo.com',
  'peacocktv.com',
  'paramountplus.com',
  'appletv.apple.com',
  'twitch.tv',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com',
  'crunchyroll.com',
  // Gaming
  'xbox.com',
  'playstation.com',
  'steampowered.com',
  'store.steampowered.com',
  'epicgames.com',
  'ea.com',
  'ubisoft.com',
  'battle.net',
  'riotgames.com',
  // Productivity
  'notion.so',
  'notion.site',
  'trello.com',
  'asana.com',
  'monday.com',
  'airtable.com',
  'figma.com',
  'canva.com',
  'miro.com',
  'clickup.com',
  // Video conferencing
  'zoom.us',
  'webex.com',
  'gotomeeting.com',
  // Finance
  'paypal.com',
  'venmo.com',
  'cash.app',
  'robinhood.com',
  'coinbase.com',
  'binance.com',
  'kraken.com',
  // Shopping
  'amazon.com',
  'ebay.com',
  'etsy.com',
  'walmart.com',
  'target.com',
  // Other
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'stackoverflow.com',
  'medium.com',
  'substack.com',
  'dropbox.com',
  'box.com',
  'icloud.com',
  'apple.com',
];

function isKnownNonEmbeddable(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return KNOWN_NON_EMBEDDABLE.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

function isOriginAllowed(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ALLOWED_EMBED_ORIGINS.some(allowed => {
      const allowedUrl = new URL(allowed);
      return parsedUrl.hostname === allowedUrl.hostname || 
             parsedUrl.hostname.endsWith('.' + allowedUrl.hostname);
    });
  } catch {
    return false;
  }
}

interface EmbeddedAppViewerProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
  appUrl: string;
  appIcon: string;
  gradient?: string;
}

export function EmbeddedAppViewer({
  isOpen,
  onClose,
  appName,
  appUrl,
  appIcon,
  gradient = 'from-slate-600 to-zinc-700'
}: EmbeddedAppViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAtlasDrawer, setShowAtlasDrawer] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [securityWarning, setSecurityWarning] = useState(false);
  const [launchMode, setLaunchMode] = useState<'embed' | 'popup' | 'tab' | 'redirect'>('embed');
  const [appManifest, setAppManifest] = useState<ExternalAppManifest | null>(null);
  const [externalLaunched, setExternalLaunched] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const walletAddress = localStorage.getItem('walletAddress');
  
  useEffect(() => {
    if (appName) {
      const manifest = getManifestById(appName.toLowerCase().replace(/\s+/g, ''));
      if (manifest) {
        setAppManifest(manifest);
        setLaunchMode(manifest.launchMode);
        
        if (manifest.launchMode !== 'embed' || !manifest.embeddable) {
          setLoadError(true);
        }
      }
    }
  }, [appName]);
  
  const handleMessage = useCallback((event: MessageEvent) => {
    if (!isOriginAllowed(event.origin)) {
      console.warn('[EmbeddedAppViewer] Blocked message from untrusted origin:', event.origin);
      return;
    }
    
    if (event.data?.type === 'p3:session:request') {
      if (walletAddress) {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'p3:session:response',
          wallet: walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4),
          connected: true
        }, event.origin);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  useEffect(() => {
    if (isOpen && appUrl) {
      if (isKnownNonEmbeddable(appUrl)) {
        setLoadError(true);
        setIsLoading(false);
      }
      if (!isOriginAllowed(appUrl)) {
        setSecurityWarning(true);
      } else {
        setSecurityWarning(false);
      }
    }
  }, [isOpen, appUrl]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(true);
      setLoadError(false);
      
      if (walletAddress && appName) {
        fetch('/api/atlas/mesh/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: walletAddress,
            appId: appName.toLowerCase().replace(/\s+/g, ''),
            url: appUrl,
            authType: 'session'
          })
        }).then(r => r.json()).then(result => {
          if (result.ok) {
            console.log(`[Mesh] Connected ${appName} for wallet`, walletAddress.slice(0, 8));
          }
        }).catch(() => {});
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, walletAddress, appName, appUrl]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAtlasDrawer) {
          setShowAtlasDrawer(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, showAtlasDrawer]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setTimeout(() => {
      if (iframeRef.current) {
        try {
          const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
          if (!iframeDoc || iframeDoc.body?.innerHTML === '') {
            setLoadError(true);
          }
        } catch (e) {
        }
      }
    }, 2000);
  };

  const handleIframeError = () => {
    setLoadError(true);
    setIsLoading(false);
  };

  const openExternal = () => {
    const appId = appName.toLowerCase().replace(/\s+/g, '');
    
    meshSessionBridge.addActiveApp(appId);
    
    if (launchMode === 'popup' && appManifest) {
      const width = 1200;
      const height = 800;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      window.open(appUrl, appId, `width=${width},height=${height},left=${left},top=${top},noopener`);
    } else {
      window.open(appUrl, '_blank', 'noopener,noreferrer');
    }
    
    setExternalLaunched(true);
  };

  const toggleMic = async () => {
    if (!micEnabled) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicEnabled(true);
      } catch (err) {
        console.error('Mic permission denied:', err);
      }
    } else {
      setMicEnabled(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a]">
      <header className={`flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r ${gradient}`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{appIcon}</span>
          <h2 className="text-sm font-semibold text-white truncate max-w-[150px]">{appName}</h2>
          {walletAddress && (
            <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-white/70">
              <Lock className="w-2.5 h-2.5" />
              <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={openExternal}
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            data-testid="button-close-embedded"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#141414] z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-600 to-zinc-700 flex items-center justify-center shadow-lg">
                <span className="text-3xl">{appIcon}</span>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading {appName}...</span>
              </div>
            </div>
          </div>
        )}

        {loadError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#141414]">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-600 to-zinc-700 flex items-center justify-center shadow-lg">
                <Globe className="w-8 h-8 text-white/50" />
              </div>
              <h3 className="text-white font-medium mb-2">
                {externalLaunched ? `${appName} is running` : `Unable to embed ${appName}`}
              </h3>
              <p className="text-sm text-slate-400 mb-4">
                {externalLaunched 
                  ? "The app is open in a separate window. Atlas can still help you with actions."
                  : launchMode === 'tab' || launchMode === 'redirect'
                    ? "This app opens in a new tab. Atlas stays connected for orchestration."
                    : "This app doesn't allow embedding. Open it externally instead."}
              </p>
              
              {!externalLaunched ? (
                <Button
                  onClick={openExternal}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600"
                  data-testid="button-open-external"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open {appName}
                </Button>
              ) : (
                <div className="space-y-3">
                  {appManifest?.actions && appManifest.actions.length > 0 && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Available Actions via Atlas</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {appManifest.actions.slice(0, 4).map(action => (
                          <span 
                            key={action.id}
                            className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs"
                          >
                            {action.name}
                          </span>
                        ))}
                        {appManifest.actions.length > 4 && (
                          <span className="px-2 py-1 rounded-full bg-white/10 text-white/50 text-xs">
                            +{appManifest.actions.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-500">
                    Say "Hey Atlas" or tap the chat button to orchestrate this app
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {securityWarning && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Running in sandbox mode</span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={appUrl}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
              allow="clipboard-read; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              title={appName}
            />
          </>
        )}

        <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-20">
          <Button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-full shadow-lg ${
              micEnabled 
                ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500' 
                : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600'
            }`}
            title={micEnabled ? 'Disable mic' : 'Enable mic for Atlas'}
          >
            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            onClick={() => setShowAtlasDrawer(!showAtlasDrawer)}
            className={`w-12 h-12 rounded-full shadow-lg ${
              showAtlasDrawer
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600'
                : 'bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600'
            }`}
            title="Talk to Atlas"
            data-testid="button-atlas-overlay"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>

        {showAtlasDrawer && (
          <AtlasDrawer 
            onClose={() => setShowAtlasDrawer(false)} 
            appName={appName}
            micEnabled={micEnabled}
          />
        )}
      </main>
    </div>
  );
}

interface AtlasDrawerProps {
  onClose: () => void;
  appName: string;
  micEnabled: boolean;
}

function AtlasDrawer({ onClose, appName, micEnabled }: AtlasDrawerProps) {
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState<{ type: 'user' | 'atlas'; text: string }[]>([
    { type: 'atlas', text: `I'm here while you use ${appName}. Ask me anything or say "Hey Atlas" if mic is enabled.` }
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    const userMessage = message;
    setMessage('');
    setResponses(prev => [...prev, { type: 'user', text: userMessage }]);
    setIsThinking(true);

    try {
      const wallet = localStorage.getItem('walletAddress');
      const res = await fetch('/api/atlas/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet, message: userMessage, params: { app: appName } })
      });
      
      const data = await res.json();
      setResponses(prev => [...prev, { 
        type: 'atlas', 
        text: data.reply || data.message || 'I processed that for you.' 
      }]);
    } catch (err) {
      setResponses(prev => [...prev, { type: 'atlas', text: 'Sorry, I had trouble with that request.' }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="absolute bottom-20 right-4 w-80 max-h-[60vh] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-white">Atlas</span>
          {micEnabled && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[10px] text-emerald-300">
              <Mic className="w-2.5 h-2.5" />
              Listening
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-white/80 hover:text-white hover:bg-white/20"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[300px]">
        {responses.map((r, i) => (
          <div key={i} className={`flex ${r.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
              r.type === 'user' 
                ? 'bg-purple-600 text-white' 
                : 'bg-white/10 text-white/90'
            }`}>
              {r.text}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-white/10 px-3 py-2 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Atlas..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:border-purple-500/50 focus:outline-none"
            data-testid="input-atlas-message"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || isThinking}
            className="px-3 bg-purple-600 hover:bg-purple-500"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

export default EmbeddedAppViewer;
