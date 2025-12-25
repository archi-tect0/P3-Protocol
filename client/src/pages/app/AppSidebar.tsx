import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  MessageSquare, 
  FileText,
  Wallet, 
  Vote,
  Video,
  Phone,
  Search,
  Settings,
  X,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession, disconnectBridge } from "@/lib/sessionBridgeV2";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

const navItems: NavItem[] = [
  { path: "/app/messages", label: "Messages", icon: MessageSquare, testId: "nav-messages" },
  { path: "/app/notes", label: "Notes", icon: FileText, testId: "nav-notes" },
  { path: "/app/payments", label: "Payments", icon: Wallet, testId: "nav-payments" },
  { path: "/app/dao", label: "DAO", icon: Vote, testId: "nav-dao" },
  { path: "/app/calls", label: "Video", icon: Video, testId: "nav-video" },
  { path: "/app/voice", label: "Voice", icon: Phone, testId: "nav-voice" },
  { path: "/app/explorer", label: "Explorer", icon: Search, testId: "nav-explorer" },
  { path: "/app/settings", label: "Settings", icon: Settings, testId: "nav-settings" },
];

export default function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = () => {
      const session = getSession();
      const storedWallet = localStorage.getItem('walletAddress');
      setIsConnected(session !== null && session.connected);
      setWalletAddress(session?.address || storedWallet);
    };

    checkSession();

    const handleConnected = () => {
      setIsConnected(true);
      setWalletAddress(localStorage.getItem('walletAddress'));
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setWalletAddress(null);
    };

    window.addEventListener('p3:wallet:connected', handleConnected);
    window.addEventListener('p3:wallet:disconnected', handleDisconnected);
    window.addEventListener('p3:connect_approved', handleConnected);
    window.addEventListener('p3:session_revoked', handleDisconnected);

    return () => {
      window.removeEventListener('p3:wallet:connected', handleConnected);
      window.removeEventListener('p3:wallet:disconnected', handleDisconnected);
      window.removeEventListener('p3:connect_approved', handleConnected);
      window.removeEventListener('p3:session_revoked', handleDisconnected);
    };
  }, []);

  const handleDisconnect = async () => {
    await disconnectBridge();
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('token');
    localStorage.removeItem('walletToken');
    setIsConnected(false);
    setWalletAddress(null);
    window.location.href = '/';
  };

  const isActive = (path: string) => location === path || (path === "/app/messages" && location === "/app");

  return (
    <>
      {open && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden" 
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
        border-r border-slate-200/50 dark:border-slate-700/50
        transform transition-transform duration-300 ease-out
        ${open ? "translate-x-0 flex" : "-translate-x-full md:translate-x-0"}
        overflow-y-auto md:flex flex-col
        shadow-xl md:shadow-none
      `}>
        <div className="p-4 border-b border-slate-200/50 dark:border-slate-700/50 md:hidden flex items-center justify-between">
          <span className="font-bold text-slate-900 dark:text-white">Menu</span>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-sidebar">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-3 flex-1">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-3">
            Workspace
          </h2>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} href={item.path}>
                  <a
                    data-testid={item.testId}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${active
                        ? "bg-blue-100/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white"
                      }
                    `}
                  >
                    <div className={`p-1.5 rounded-lg ${active ? "bg-blue-200/50 dark:bg-blue-800/30" : ""}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <span>{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                  </a>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-3 border-t border-slate-200/50 dark:border-slate-700/50 space-y-3">
          {/* Network Status */}
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Base Network</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Connected to mainnet for anchoring
            </p>
          </div>

          {/* Session Status & Disconnect */}
          {isConnected && (
            <div 
              className="relative overflow-hidden rounded-xl p-3"
              style={{
                background: 'rgba(12, 22, 35, 0.85)',
                backdropFilter: 'blur(12px)',
              }}
              data-testid="sidebar-session-panel"
            >
              {/* Animated glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-emerald-500/20 animate-pulse" />
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-xs text-emerald-400 font-medium">Session active</span>
                </div>
                
                {walletAddress && (
                  <p className="text-[10px] font-mono text-slate-400 mb-3 truncate">
                    {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}
                  </p>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  className="w-full h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded-lg"
                  data-testid="button-disconnect-sidebar"
                >
                  <LogOut className="w-3 h-3 mr-2" />
                  Disconnect Wallet
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
