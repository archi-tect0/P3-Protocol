import { ReactNode, useState } from "react";
import { Link } from "wouter";
import { 
  MessageSquare, 
  Phone, 
  DollarSign, 
  FileText, 
  Vote, 
  Search,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  Wallet
} from "lucide-react";
import E2EEBadge from "./E2EEBadge";
import { Button } from "./ui/button";

interface AppShellProps {
  children: ReactNode;
  currentRoute: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
}

const navItems: NavItem[] = [
  { path: "/app/messages", label: "Messages", icon: MessageSquare, emoji: "💬" },
  { path: "/app/calls", label: "Voice Calls", icon: Phone, emoji: "📞" },
  { path: "/app/payments", label: "Payments", icon: DollarSign, emoji: "💸" },
  { path: "/app/notes", label: "Notes", icon: FileText, emoji: "📝" },
  { path: "/app/dao", label: "DAO", icon: Vote, emoji: "🗳" },
  { path: "/app/explorer", label: "Explorer", icon: Search, emoji: "🔍" },
];

export default function AppShell({ children, currentRoute }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [walletAddress] = useState("0x1234...5678"); // Mock wallet address
  const [isWalletConnected] = useState(true);

  const isActive = (path: string) => currentRoute === path;

  const getPageTitle = () => {
    const item = navItems.find(item => item.path === currentRoute);
    return item?.label || "Dashboard";
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleDisconnect = () => {
    console.log("Disconnecting wallet...");
    // Add wallet disconnect logic here
  };

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-purple-50/30 dark:from-slate-950 dark:to-purple-950/10">
      {/* Sidebar */}
      <aside 
        className={`
          border-r border-slate-200/50 dark:border-slate-800/50 
          bg-white/60 dark:bg-slate-950/60 
          backdrop-blur-xl
          transition-all duration-300 ease-in-out
          flex flex-col
          ${isCollapsed ? 'w-[60px]' : 'w-[240px]'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center">
            <span className="text-white font-bold text-xl">P</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <div key={item.path} className="relative group">
                <Link href={item.path}>
                  <a
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg
                      transition-all duration-200
                      ${active
                        ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/30"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80"
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <Icon className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
                    {!isCollapsed && (
                      <span className="font-medium text-sm">{item.label}</span>
                    )}
                    {!isCollapsed && (
                      <span className="ml-auto">{item.emoji}</span>
                    )}
                  </a>
                </Link>
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="
                    absolute left-full ml-2 px-3 py-1.5 rounded-lg
                    bg-slate-900 dark:bg-slate-700 text-white text-sm
                    opacity-0 group-hover:opacity-100
                    pointer-events-none transition-opacity duration-200
                    whitespace-nowrap z-50
                    top-1/2 -translate-y-1/2
                  ">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Wallet Address & Disconnect */}
        <div className="p-3 border-t border-slate-200/50 dark:border-slate-800/50">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80">
                <Wallet className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                  {truncateAddress(walletAddress)}
                </span>
              </div>
              <Button
                onClick={handleDisconnect}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 text-sm"
                data-testid="button-disconnect-wallet"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </Button>
            </div>
          ) : (
            <button
              onClick={handleDisconnect}
              className="w-full flex justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              data-testid="button-disconnect-wallet"
            >
              <LogOut className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          )}
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="m-3 flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          data-testid="button-toggle-sidebar"
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          )}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
          <div className="h-full px-6 flex items-center justify-between">
            {/* Left: Page Title */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {getPageTitle()}
              </h1>
            </div>

            {/* Right: Status Indicators & Settings */}
            <div className="flex items-center gap-4">
              {/* Wallet Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className={`w-2 h-2 rounded-full ${isWalletConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isWalletConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* E2EE Indicator */}
              <E2EEBadge variant="shield" size="md" />

              {/* Settings Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  data-testid="button-settings"
                >
                  <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>

                {showSettings && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowSettings(false)}
                    />
                    
                    {/* Dropdown Menu */}
                    <div className="
                      absolute right-0 mt-2 w-48 
                      bg-white dark:bg-slate-900 
                      border border-slate-200 dark:border-slate-700
                      rounded-lg shadow-xl
                      py-1 z-50
                    ">
                      <Link href="/app/settings">
                        <a
                          className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setShowSettings(false)}
                          data-testid="link-settings"
                        >
                          Settings
                        </a>
                      </Link>
                      <Link href="/app/profile">
                        <a
                          className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          onClick={() => setShowSettings(false)}
                          data-testid="link-profile"
                        >
                          Profile
                        </a>
                      </Link>
                      <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
                      <button
                        onClick={() => {
                          handleDisconnect();
                          setShowSettings(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                        data-testid="button-logout"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
