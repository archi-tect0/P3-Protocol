import { useEffect, useState } from 'react';
import { useParams } from 'wouter';
import { appRegistry } from '@/pages/launcher/appRegistry';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Home } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export default function StandaloneApp() {
  const params = useParams<{ appId: string }>();
  const appId = params.appId;
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  );

  const app = appRegistry.find(a => a.id === appId);

  useEffect(() => {
    if (!app) return;

    document.title = `${app.name} | P3 Protocol`;

    const existingManifest = document.querySelector('link[rel="manifest"]');
    if (existingManifest) {
      existingManifest.setAttribute('href', `/manifests/${appId}.json`);
    } else {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `/manifests/${appId}.json`;
      document.head.appendChild(link);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      deferredPrompt = null;
      setIsInstallable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [app, appId]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    deferredPrompt = null;
  };

  if (!app) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">App Not Found</h1>
          <Button onClick={() => window.location.href = '/launcher'} data-testid="button-back-launcher">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Hub
          </Button>
        </div>
      </div>
    );
  }

  const AppComponent = app.component;

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            {!isStandalone && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.href = '/launcher'}
                data-testid="button-back-hub"
              >
                <Home className="w-4 h-4" />
              </Button>
            )}
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${app.gradient} p-1.5`}>
              {app.icon}
            </div>
            <h1 className="text-lg font-semibold text-white">{app.name}</h1>
          </div>
          
          {isInstallable && !isStandalone && (
            <Button 
              size="sm" 
              onClick={handleInstall}
              className="bg-gradient-to-r from-cyan-500 to-purple-600"
              data-testid="button-install-app"
            >
              <Download className="w-4 h-4 mr-1" />
              Install
            </Button>
          )}
        </div>
      </header>
      
      <main className="pt-16 p-4">
        <div className="max-w-lg mx-auto">
          <AppComponent />
        </div>
      </main>
    </div>
  );
}
