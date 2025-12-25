import { useEffect, useState } from 'react';
import { useAtlasStore } from '@/state/useAtlasStore';
import { EmbeddedAppViewer } from '@/components/EmbeddedAppViewer';
import { Button } from '@/components/ui/button';
import { ExternalLink, X, Globe, ArrowLeft } from 'lucide-react';

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
  'amazon.com/gp/video',
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
  // Web3
  'dehub.io',
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

export default function ExternalAppMode() {
  const { externalApp, closeExternalApp } = useAtlasStore();
  const [launched, setLaunched] = useState(false);
  
  const shouldOpenDirectly = externalApp ? isKnownNonEmbeddable(externalApp.url) : false;
  
  useEffect(() => {
    if (externalApp && shouldOpenDirectly && !launched) {
      window.open(externalApp.url, '_blank', 'noopener,noreferrer');
      setLaunched(true);
    }
  }, [externalApp, shouldOpenDirectly, launched]);
  
  useEffect(() => {
    if (!externalApp) {
      setLaunched(false);
    }
  }, [externalApp]);
  
  if (!externalApp) {
    return null;
  }

  if (shouldOpenDirectly) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0a]">
        <header className={`flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r ${externalApp.gradient || 'from-slate-600 to-zinc-700'}`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{externalApp.icon}</span>
            <h2 className="text-sm font-semibold text-white truncate max-w-[200px]">{externalApp.name}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeExternalApp}
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            data-testid="button-close-external-app"
          >
            <X className="w-4 h-4" />
          </Button>
        </header>
        
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Globe className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl text-white font-medium mb-2">
              {launched ? `${externalApp.name} opened` : externalApp.name}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {launched 
                ? "This app is now running in a new browser tab. You can switch back to it anytime."
                : "This app works best in its own tab for full functionality."}
            </p>
            
            <div className="space-y-3">
              {!launched ? (
                <Button
                  onClick={() => {
                    window.open(externalApp.url, '_blank', 'noopener,noreferrer');
                    setLaunched(true);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 w-full"
                  data-testid="button-launch-external"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open {externalApp.name}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    window.open(externalApp.url, '_blank', 'noopener,noreferrer');
                  }}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 w-full"
                  data-testid="button-reopen-external"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Again
                </Button>
              )}
              
              <Button
                onClick={closeExternalApp}
                variant="ghost"
                className="text-slate-400 hover:text-white w-full"
                data-testid="button-back-to-atlas"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Atlas
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <EmbeddedAppViewer
      isOpen={true}
      onClose={closeExternalApp}
      appName={externalApp.name}
      appUrl={externalApp.url}
      appIcon={externalApp.icon}
      gradient={externalApp.gradient}
    />
  );
}
