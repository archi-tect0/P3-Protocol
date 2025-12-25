import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import P3Logo from "@/components/P3Logo";
import { WalletLauncherMenu } from "@/components/WalletLauncherMenu";
import { type BridgeSession } from "@/lib/sessionBridgeV2";
import { Button } from "@/components/ui/button";

export default function WalletConnect() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const existingWallet = localStorage.getItem('walletAddress');
    if (existingWallet) {
      setLocation('/app/messages');
    }
  }, [setLocation]);

  const handleConnect = (session: BridgeSession) => {
    localStorage.setItem('walletAddress', session.address);
    
    toast({
      title: "Wallet Connected",
      description: `Connected to ${session.address.slice(0, 6)}...${session.address.slice(-4)}`,
    });
    
    setTimeout(() => {
      setLocation('/app/messages');
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-purple-50/40 to-indigo-100/30 dark:from-slate-950 dark:via-purple-950/20 dark:to-indigo-950/10 p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-300/20 dark:bg-indigo-600/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <Card className="w-full max-w-md relative backdrop-blur-sm bg-white/90 dark:bg-slate-900/90 border-slate-200/50 dark:border-slate-700/50 shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="flex justify-center animate-in fade-in-0 zoom-in-95 duration-500 delay-150">
            <P3Logo className="w-40" />
          </div>
          
          <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-300">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Connect Your Wallet
            </CardTitle>
            <CardDescription className="text-base text-slate-600 dark:text-slate-300">
              Secure, privacy-preserving communication starts here
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-500">
          <Button
            onClick={() => setMenuOpen(true)}
            className="w-full h-14 bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:from-purple-700 hover:via-purple-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            data-testid="button-connect-wallet"
          >
            Choose Wallet
          </Button>

          <div className="flex gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 rounded-lg border border-blue-200/50 dark:border-blue-800/30 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Secure & Private
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                Your private keys never leave your device. All communication is end-to-end encrypted.
              </p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Supports MetaMask, Coinbase, Trust Wallet, Rainbow & more
            </p>
          </div>
        </CardContent>
      </Card>

      <WalletLauncherMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onConnect={handleConnect}
        returnPath="/app"
      />
    </div>
  );
}
