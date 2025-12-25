import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWA, type PWAType } from '@/hooks/use-pwa';

interface PWAInstallPromptProps {
  type: PWAType;
  onDismiss?: () => void;
}

export default function PWAInstallPrompt({ type, onDismiss }: PWAInstallPromptProps) {
  const { isInstallable, isStandalone, promptInstall } = usePWA(type);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || isStandalone || !isInstallable) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setDismissed(true);
    }
  };

  const appName = type === 'launcher' ? 'P3 Hub' : 'Atlas';
  const description = type === 'launcher' 
    ? 'Protocol ecosystem marketplace'
    : 'Voice-First Web3 Mesh OS';

  return (
    <Card 
      data-testid="pwa-install-prompt"
      className="fixed bottom-20 left-4 right-4 z-50 p-4 bg-gradient-to-r from-cyan-900/90 to-purple-900/90 backdrop-blur-xl border-cyan-500/30 shadow-xl shadow-cyan-500/20 animate-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-white text-sm">Install {appName}</h3>
              <p className="text-xs text-slate-300 mt-0.5">{description}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-white -mt-1 -mr-2"
              data-testid="button-dismiss-pwa"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleInstall}
              size="sm"
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white text-xs"
              data-testid="button-install-pwa"
            >
              <Download className="w-3 h-3 mr-1.5" />
              Install
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDismiss}
              className="text-slate-300 border-white/20 hover:bg-white/10 text-xs"
              data-testid="button-later-pwa"
            >
              Later
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
