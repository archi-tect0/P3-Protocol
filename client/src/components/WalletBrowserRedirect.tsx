import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Smartphone, Copy } from "lucide-react";

interface WalletBrowserRedirectProps {
  walletAddress: string;
  onDismiss?: () => void;
}

function detectWalletBrowser(): { 
  isWalletBrowser: boolean; 
  browserName: string; 
  platform: 'ios' | 'android' | 'unknown' 
} {
  if (typeof window === 'undefined') {
    return { isWalletBrowser: false, browserName: 'unknown', platform: 'unknown' };
  }

  const ua = navigator.userAgent.toLowerCase();
  
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua) || /base/i.test(ua);
  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'unknown';
  
  const walletBrowsers = {
    metamask: /metamask/i.test(ua),
    trust: /trust/i.test(ua),
    coinbase: /coinbase/i.test(ua) || /cbwallet/i.test(ua),
    rainbow: /rainbow/i.test(ua),
    imtoken: /imtoken/i.test(ua),
    tokenpocket: /tokenpocket/i.test(ua),
  };
  
  const browserName = Object.entries(walletBrowsers).find(([, detected]) => detected)?.[0] || 'unknown';
  const isWalletBrowser = Object.values(walletBrowsers).some(detected => detected);
  
  console.log(`[WalletBrowserRedirect] Detected - Browser: ${browserName}, Platform: ${platform}`);
  
  return { isWalletBrowser, browserName, platform };
}

export function WalletBrowserRedirect({ walletAddress, onDismiss }: WalletBrowserRedirectProps) {
  const [redirecting, setRedirecting] = useState(false);
  const [urlWithToken, setUrlWithToken] = useState<string>('');
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const { toast } = useToast();

  const walletContext = detectWalletBrowser();

  const handleRedirectToChrome = async () => {
    setRedirecting(true);

    try {
      const appMode = localStorage.getItem('app-mode') === 'true';
      
      const tokenResponse = await fetch('/api/pwa/create-install-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appMode, walletAddress }),
        credentials: 'include'
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to create transfer token');
      }

      const { token } = await tokenResponse.json();

      const url = new URL(window.location.href);
      url.searchParams.set('install_token', token);
      url.searchParams.set('from_wallet_browser', 'true');
      
      if (walletContext.platform === 'android') {
        const intentUrl = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;
        
        try {
          // Use iframe-only approach - NEVER mutate window.location
          // This ensures the wallet browser keeps the authenticated session if intent fails
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = intentUrl;
          document.body.appendChild(iframe);
          
          setTimeout(() => {
            try { document.body.removeChild(iframe); } catch (e) {}
          }, 500);
          
          setTimeout(() => {
            toast({
              title: "Opening in Chrome...",
              description: "Your session is being transferred to Chrome",
            });
          }, 100);
          
          // Show manual instructions as fallback after 2s (without breaking current page)
          setTimeout(() => {
            setUrlWithToken(url.toString());
            setShowManualInstructions(true);
            setRedirecting(false);
          }, 2000);
        } catch (error) {
          console.error('Chrome intent failed:', error);
          setUrlWithToken(url.toString());
          setShowManualInstructions(true);
          toast({
            title: "Couldn't create handoff link",
            description: "Try opening Chrome manually",
            variant: "destructive"
          });
        }
      } else if (walletContext.platform === 'ios') {
        setUrlWithToken(url.toString());
        setShowManualInstructions(true);
        
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Continue in Safari',
              text: 'Tap to open in Safari and continue',
              url: url.toString()
            });
          } catch (error) {
            console.log('Share cancelled:', error);
          }
        }
      }
    } catch (error) {
      console.error('Redirect error:', error);
      toast({
        title: "Transfer Failed",
        description: "Unable to transfer session. Please try again.",
        variant: "destructive"
      });
      setRedirecting(false);
    }
  };

  const copyUrl = () => {
    if (urlWithToken) {
      navigator.clipboard.writeText(urlWithToken);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard. Paste in Safari to continue.",
      });
    }
  };

  if (!walletContext.isWalletBrowser) {
    return null;
  }

  if (showManualInstructions) {
    return (
      <Card className="border-2 border-purple-500 bg-slate-800/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Smartphone className="h-5 w-5 text-purple-400" />
            Continue in Safari
          </CardTitle>
          <CardDescription className="text-slate-300">
            To get the best experience and install the app, open this link in Safari:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={copyUrl}
              variant="outline"
              className="flex-1 border-slate-600 text-white hover:bg-slate-700"
              data-testid="button-copy-url"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Link
            </Button>
            <Button
              onClick={() => setShowManualInstructions(false)}
              variant="ghost"
              className="text-slate-400 hover:text-white"
              data-testid="button-dismiss"
            >
              Dismiss
            </Button>
          </div>
          <div className="text-sm text-slate-400 space-y-2">
            <p className="font-medium text-slate-300">iOS Instructions:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Tap "Copy Link" above</li>
              <li>Open Safari browser</li>
              <li>Paste the link in the address bar</li>
              <li>Your session will be restored automatically</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-500 bg-purple-500/10 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <ExternalLink className="h-5 w-5 text-purple-400" />
          Continue in {walletContext.platform === 'android' ? 'Chrome' : 'Safari'}
        </CardTitle>
        <CardDescription className="text-slate-300">
          For the best experience, we recommend using {walletContext.platform === 'android' ? 'Chrome' : 'Safari'} browser. 
          Your wallet ({walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}) will stay connected!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button 
            onClick={handleRedirectToChrome}
            disabled={redirecting}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            data-testid="button-open-chrome"
          >
            {redirecting ? (
              <>Opening...</>
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in {walletContext.platform === 'android' ? 'Chrome' : 'Safari'}
              </>
            )}
          </Button>
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="ghost"
              className="text-slate-400 hover:text-white"
              data-testid="button-stay-here"
            >
              Stay Here
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { detectWalletBrowser };
