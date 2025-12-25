import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface ConnectButtonProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export default function ConnectButton({ onConnect, onDisconnect: _onDisconnect }: ConnectButtonProps) {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const walletAddress = localStorage.getItem("walletAddress");

  useEffect(() => {
    setConnected(!!walletAddress);
  }, [walletAddress]);

  const handleConnect = async () => {
    setBusy(true);
    try {
      onConnect?.();
    } finally {
      setBusy(false);
    }
  };

  // When connected, show nothing in topbar - session indicator is in hamburger menu
  if (connected) {
    return null;
  }

  return (
    <Button
      onClick={handleConnect}
      disabled={busy}
      className={`
        bg-gradient-to-b from-blue-500 to-blue-600 
        hover:from-blue-400 hover:to-blue-500
        text-white border-0 rounded-xl px-4 py-2
        transition-all duration-300
        ${!busy ? "shadow-[0_0_12px_rgba(255,77,109,0.45),0_0_32px_rgba(255,77,109,0.25)]" : ""}
      `}
      data-testid="button-connect"
    >
      <Wallet className="w-4 h-4 mr-2" />
      {busy ? "Connecting..." : "Connect"}
    </Button>
  );
}
