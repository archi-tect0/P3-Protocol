import { useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LauncherModal, AppIcon } from '@/components/LauncherModal';
import { EmbeddedAppViewer } from '@/components/EmbeddedAppViewer';
import { cn } from '@/lib/utils';
import { appRegistry, categoryInfo, type AppDefinition } from './appRegistry';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { 
  Search, 
  Shield,
  ShieldCheck,
  Download,
  X,
  Menu,
  Info,
  FileText,
  Compass,
  Code,
  Anchor,
  Paintbrush
} from 'lucide-react';
import { setWalletAddress, clearWalletAddress } from './config';
import { useToast } from '@/hooks/use-toast';
import P3HubLogo from '@/components/P3HubLogo';
import RecentAnchors from '@/components/RecentAnchors';
import { 
  restoreBridge, 
  resumeSession,
  disconnectBridge, 
  getSession,
  checkWalletReturn,
  type BridgeSession 
} from '@/lib/sessionBridgeV2';
import { useSessionRestore } from '@/hooks/use-session-restore';
import { usePWA } from '@/hooks/use-pwa';
import { useHubLayout } from '@/hooks/use-hub-layout';
import { TileContextSheet } from '@/components/TileContextSheet';
import { TileRef } from '@/lib/hubLayout';
import { Pager } from '@/components/Pager';
import { HomeScreen } from '@/components/HomeScreen';
import { InstalledToggle } from '@/components/InstalledToggle';
import { P3, Roles } from '@/lib/sdk';
import { WalletLauncherButton } from '@/components/WalletLauncherMenu';
import { BrowserHandoffButton, useAutoPopout } from '@/components/BrowserHandoffButton';
import { HubDock } from '@/components/HubDock';
import { DockAppPicker } from '@/components/DockAppPicker';
import { BackgroundPicker } from '@/components/BackgroundPicker';
import { HubPasswordSettings } from '@/components/HubPasswordSettings';
import { useHubPreferences } from '@/hooks/use-hub-preferences';


interface ContextSheetState {
  isOpen: boolean;
  tile: TileRef | null;
  tileIcon: ReactNode | null;
  gradient: string;
}

export default function LauncherPage() {
  const [session, setSession] = useState<BridgeSession | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeApp, setActiveApp] = useState<AppDefinition | null>(null);
  const [contextSheet, setContextSheet] = useState<ContextSheetState>({
    isOpen: false,
    tile: null,
    tileIcon: null,
    gradient: '',
  });
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [installedApps, setInstalledApps] = useState<string[]>([]);
  const [isModerator, setIsModerator] = useState(false);
  const [showAnchors, setShowAnchors] = useState(false);
  const [isDockEditing, setIsDockEditing] = useState(false);
  const [dockPickerOpen, setDockPickerOpen] = useState(false);
  const [dockPickerPosition, setDockPickerPosition] = useState(0);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [passwordSettingsOpen, setPasswordSettingsOpen] = useState(false);
  const [embeddedApp, setEmbeddedApp] = useState<{ name: string; url: string; icon: string } | null>(null);
  
  const { isRestoring, restoredWallet } = useSessionRestore();
  const { isInstallable, isStandalone, promptInstall } = usePWA('launcher');
  useToast();
  useAutoPopout({ isPrimaryRoute: true }); // Hub is the primary popout trigger
  
  const {
    layout,
    toggleFavorite,
    isFavorite,
    createFolder,
    addToFolder,
    removeFromFolder,
    getTileFolder,
  } = useHubLayout(session?.address || null);

  const {
    preferences,
    updateDockApp,
    deleteDockApp,
    updateBackground,
    updateDockStyle,
    toggleDock,
    setPassword,
    clearPassword,
  } = useHubPreferences(session?.address || null);

  useEffect(() => {
    const restore = async () => {
      if (checkWalletReturn()) {
        const resumed = await resumeSession();
        if (resumed) {
          setSession(resumed);
          setWalletAddress(resumed.address);
          window.history.replaceState({}, '', '/launcher');
          return;
        }
      }
      
      if (restoredWallet) {
        setSession({
          address: restoredWallet,
          chainId: 8453,
          method: 'extension',
          connected: true,
          timestamp: Date.now(),
        });
        setWalletAddress(restoredWallet);
        return;
      }
      
      const existingSession = getSession();
      if (existingSession) {
        setSession(existingSession);
      } else {
        const restored = await restoreBridge();
        if (restored) {
          setSession(restored);
        }
      }
    };
    
    if (!isRestoring) {
      restore();
    }
  }, [isRestoring, restoredWallet]);

  useEffect(() => {
    const handleChange = (e: CustomEvent) => {
      setSession(prev => prev ? { ...prev, address: e.detail.address } : null);
    };
    
    const handleDisconnect = () => {
      setSession(null);
    };

    window.addEventListener('p3:wallet:changed', handleChange as EventListener);
    window.addEventListener('p3:wallet:disconnected', handleDisconnect);
    
    return () => {
      window.removeEventListener('p3:wallet:changed', handleChange as EventListener);
      window.removeEventListener('p3:wallet:disconnected', handleDisconnect);
    };
  }, []);

  useEffect(() => {
    const loadInstalled = async () => {
      if (session?.address) {
        const list = await P3.Apps.installed(session.address);
        setInstalledApps(list);
        const modStatus = await Roles.isModerator();
        setIsModerator(modStatus);
      } else {
        setInstalledApps([]);
        setIsModerator(false);
      }
    };
    loadInstalled();
  }, [session?.address]);

  const { data: externalAppsData } = useQuery<{
    ok: boolean;
    apps: Array<{
      id: string;
      name: string;
      url: string;
      icon: string;
      category: string;
      scopes: string[];
      phrases: string[];
      tags: string[];
    }>;
    categories: string[];
    total: number;
  }>({
    queryKey: ['/api/atlas/external-apps'],
  });

  const dynamicExternalApps: AppDefinition[] = useMemo(() => {
    if (!externalAppsData?.apps) return [];
    
    return externalAppsData.apps.map(app => ({
      id: app.id,
      name: app.name,
      icon: <img src={app.icon} alt={app.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'; }} />,
      gradient: 'from-slate-600 to-zinc-700',
      category: 'external' as const,
      component: function ExternalAppTile() {
        return (
          <div className="p-4 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-600 to-zinc-700 flex items-center justify-center shadow-lg overflow-hidden">
              <img src={app.icon} alt={app.name} className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <h3 className="font-medium text-white mb-2">{app.name}</h3>
            <p className="text-sm text-slate-400 mb-4">Opens in new tab</p>
            <a 
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium transition-colors"
              data-testid={`link-open-${app.id}`}
            >
              <ExternalLink className="w-4 h-4" />
              Open {app.name}
            </a>
          </div>
        );
      },
    }));
  }, [externalAppsData?.apps]);

  const allApps = useMemo(() => [...appRegistry, ...dynamicExternalApps], [dynamicExternalApps]);

  const handleConnect = (newSession: BridgeSession) => {
    setSession(newSession);
    setWalletAddress(newSession.address);
  };

  const handleDisconnect = async () => {
    await disconnectBridge();
    clearWalletAddress();
    setSession(null);
  };

  const handleLongPress = useCallback((tile: TileRef, icon: ReactNode, gradient: string) => {
    if (!session) return;
    setContextSheet({
      isOpen: true,
      tile,
      tileIcon: icon,
      gradient,
    });
  }, [session]);

  const handleCloseContextSheet = useCallback(() => {
    setContextSheet(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleToggleFavorite = useCallback(() => {
    if (contextSheet.tile) {
      toggleFavorite(contextSheet.tile);
    }
  }, [contextSheet.tile, toggleFavorite]);

  const handleAddToFolder = useCallback((folderId: string) => {
    if (contextSheet.tile) {
      addToFolder(folderId, contextSheet.tile);
    }
  }, [contextSheet.tile, addToFolder]);

  const handleRemoveFromFolder = useCallback((folderId: string) => {
    if (contextSheet.tile) {
      removeFromFolder(folderId, contextSheet.tile.appId);
    }
  }, [contextSheet.tile, removeFromFolder]);

  const handleCreateFolder = useCallback((name: string) => {
    const folder = createFolder(name);
    if (contextSheet.tile) {
      addToFolder(folder.id, contextSheet.tile);
    }
  }, [contextSheet.tile, createFolder, addToFolder]);

  const filteredApps = allApps.filter((app) => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || app.category === selectedCategory;
    const matchesInstalled = !showInstalledOnly || installedApps.includes(app.id);
    const passesRoleGate = !app.gatedRole || (app.gatedRole === 'moderator' && isModerator);
    return matchesSearch && matchesCategory && matchesInstalled && passesRoleGate;
  });

  const handleInstalledToggle = useCallback((value: boolean) => {
    setShowInstalledOnly(value);
  }, []);

  const handleInstallChange = useCallback(async () => {
    if (session?.address) {
      const list = await P3.Apps.installed(session.address);
      setInstalledApps(list);
    }
  }, [session?.address]);

  const handleDockAppClick = useCallback((app: AppDefinition) => {
    setActiveApp(app);
  }, []);

  const handleDockAddApp = useCallback((position: number) => {
    setDockPickerPosition(position);
    setDockPickerOpen(true);
  }, []);

  const handleDockSelectApp = useCallback((appId: string) => {
    updateDockApp(appId, dockPickerPosition);
  }, [updateDockApp, dockPickerPosition]);

  const groupedApps = filteredApps.reduce((acc, app) => {
    if (!acc[app.category]) acc[app.category] = [];
    acc[app.category].push(app);
    return acc;
  }, {} as Record<string, AppDefinition[]>);

  const backgroundStyle = preferences.background.type === 'image' 
    ? { backgroundImage: `url(${preferences.background.value})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div className="h-screen bg-[#0a0a0a] overflow-hidden flex flex-col" style={backgroundStyle}>
      {preferences.background.type === 'gradient' ? (
        <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none", preferences.background.value)} />
      ) : (
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      )}
      
      {/* Open Beta Banner */}
      <div className="relative z-50 bg-gradient-to-r from-amber-500/90 via-orange-500/90 to-amber-500/90 shrink-0">
        <div className="container mx-auto px-4 py-1.5">
          <p className="text-center text-xs font-medium text-white">
            <span className="inline-flex items-center gap-2">
              <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px] font-bold">BETA</span>
              Open beta — expect bugs and frequent updates
            </span>
          </p>
        </div>
      </div>
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div 
        className={`fixed top-0 left-0 h-full w-56 bg-[#0d0d0d] border-r border-white/10 z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <P3HubLogo className="w-14 text-white" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="text-slate-400 hover:text-white h-7 w-7"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-2 pb-40">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-2">Categories</p>
          {Object.entries(categoryInfo).map(([id, info]) => (
            <button
              key={id}
              data-testid={`sidebar-category-${id}`}
              onClick={() => {
                setSelectedCategory(id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 transition-all text-xs ${
                selectedCategory === id
                  ? 'bg-purple-600/30 text-white border-l-2 border-purple-500'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{info.name}</span>
            </button>
          ))}
          
          {session && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Personalize</p>
              <button 
                onClick={() => { setBgPickerOpen(true); setSidebarOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-slate-400 hover:text-white hover:bg-white/5 text-xs"
                data-testid="sidebar-background"
              >
                <Paintbrush className="w-3 h-3" />
                <span>Background</span>
              </button>
              <button 
                onClick={() => { setPasswordSettingsOpen(true); setSidebarOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-slate-400 hover:text-white hover:bg-white/5 text-xs"
                data-testid="sidebar-password"
              >
                <Shield className="w-3 h-3" />
                <span>Unlock Password</span>
                {preferences.decryptPasswordHash && (
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-400">ON</span>
                )}
              </button>
            </>
          )}
          
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Resources</p>
          <Link href="/launcher/about">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-slate-400 hover:text-white hover:bg-white/5 text-xs">
              <Info className="w-3 h-3" />
              <span>About</span>
            </button>
          </Link>
          <Link href="/launcher/whitepaper">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-slate-400 hover:text-white hover:bg-white/5 text-xs">
              <FileText className="w-3 h-3" />
              <span>Whitepaper</span>
            </button>
          </Link>
          <Link href="/launcher/usecases">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-slate-400 hover:text-white hover:bg-white/5 text-xs">
              <Compass className="w-3 h-3" />
              <span>Use Cases</span>
            </button>
          </Link>
          <Link href="/launcher/sdk">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-slate-400 hover:text-white hover:bg-white/5 text-xs">
              <Code className="w-3 h-3" />
              <span>SDK</span>
            </button>
          </Link>
          <button 
            onClick={() => {
              setShowAnchors(true);
              setSidebarOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 text-xs"
            data-testid="sidebar-recent-anchors"
          >
            <Anchor className="w-3 h-3" />
            <span>Recent Anchors</span>
          </button>
          
          {isModerator && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Admin</p>
              <Link href="/mod/">
                <button 
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 text-xs"
                  data-testid="sidebar-moderator-panel"
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>Moderator Panel</span>
                </button>
              </Link>
            </>
          )}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-2 pb-24 border-t border-white/10 bg-[#0d0d0d] space-y-2">
          {isInstallable && !isStandalone && (
            <Button
              data-testid="button-install-launcher-sidebar"
              onClick={promptInstall}
              className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white border-0 text-xs py-1.5 h-7"
            >
              <Download className="w-3 h-3 mr-1" />
              Install
            </Button>
          )}
          
          {/* Session Status & Disconnect in sidebar */}
          {session && (
            <div 
              className="relative overflow-hidden rounded-lg p-2"
              style={{
                background: 'rgba(12, 22, 35, 0.85)',
                backdropFilter: 'blur(12px)',
              }}
              data-testid="sidebar-session-panel"
            >
              {/* Animated glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-transparent to-emerald-500/20 animate-pulse" />
              
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="text-[10px] text-emerald-400 font-medium">Session active</span>
                </div>
                
                <p className="text-[9px] font-mono text-slate-400 mb-2 truncate">
                  {session.address.slice(0, 8)}...{session.address.slice(-6)}
                </p>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    handleDisconnect();
                    setSidebarOpen(false);
                  }}
                  className="w-full h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 rounded"
                  data-testid="button-disconnect-sidebar"
                >
                  <X className="w-2 h-2 mr-1" />
                  Disconnect
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="relative z-10 px-4 py-3 flex-shrink-0">
        <header className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="text-slate-400 hover:text-white hover:bg-white/10 h-8 w-8"
              data-testid="button-menu"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <P3HubLogo className="w-12 text-white" />
          </div>
          <WalletLauncherButton
            session={session}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            returnPath="/launcher"
            variant="compact"
          />
        </header>

        <div className="mb-4">
          <div className="relative w-full max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              data-testid="input-search-apps"
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-28 h-9 bg-[#1a1a1a]/80 border-white/10 text-white text-sm placeholder:text-slate-500 focus:border-purple-500/50"
            />
            {session && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <InstalledToggle onChange={handleInstalledToggle} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative z-10">
        <Pager defaultIndex={1}>
          <HomeScreen
            layout={layout}
            session={session}
            onAppClick={setActiveApp}
            onLongPress={handleLongPress}
          />
          <div className="px-4 py-2" data-testid="app-drawer">
            {selectedCategory === 'all' ? (
              Object.entries(groupedApps).map(([category, apps]) => (
                <section key={category} className="mb-6">
                  <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
                    <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${categoryInfo[category as keyof typeof categoryInfo]?.gradient || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
                      <Shield className="w-3 h-3 text-white" />
                    </div>
                    <h2 className="text-sm font-semibold text-white">{categoryInfo[category as keyof typeof categoryInfo]?.name || category}</h2>
                    <span className="text-[10px] text-slate-500">({apps.length})</span>
                    <span className="text-[13px] opacity-[0.72] text-slate-300">{categoryInfo[category as keyof typeof categoryInfo]?.tagline}</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
                    {apps.map((app) => (
                      <AppIcon
                        key={app.id}
                        name={app.name}
                        icon={app.icon}
                        gradient={app.gradient}
                        onClick={() => setActiveApp(app)}
                        category={app.category}
                        appId={app.id}
                        onLongPress={handleLongPress}
                        isFavorite={isFavorite(app.id)}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3 px-1 flex-wrap">
                  <h2 className="text-sm font-semibold text-white">{categoryInfo[selectedCategory as keyof typeof categoryInfo]?.name}</h2>
                  <span className="text-[10px] text-slate-500">({filteredApps.length})</span>
                  <span className="text-[13px] opacity-[0.72] text-slate-300">{categoryInfo[selectedCategory as keyof typeof categoryInfo]?.tagline}</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1">
                  {filteredApps.map((app) => (
                    <AppIcon
                      key={app.id}
                      name={app.name}
                      icon={app.icon}
                      gradient={app.gradient}
                      onClick={() => setActiveApp(app)}
                      category={app.category}
                      appId={app.id}
                      onLongPress={handleLongPress}
                      isFavorite={isFavorite(app.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredApps.length === 0 && (
              <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-800/50 flex items-center justify-center">
                  <Search className="w-6 h-6 text-slate-500" />
                </div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">No apps found</h3>
                <p className="text-xs text-slate-500">Try a different search</p>
              </div>
            )}
          </div>
        </Pager>
      </div>

      {activeApp && (
        <LauncherModal
          isOpen={!!activeApp}
          onClose={() => setActiveApp(null)}
          title={activeApp.name}
          icon={activeApp.icon}
          gradient={activeApp.gradient}
        >
          <activeApp.component onEmbed={(name: string, url: string, icon: string) => {
            setActiveApp(null);
            setEmbeddedApp({ name, url, icon });
          }} />
        </LauncherModal>
      )}

      {embeddedApp && (
        <EmbeddedAppViewer
          isOpen={!!embeddedApp}
          onClose={() => setEmbeddedApp(null)}
          appName={embeddedApp.name}
          appUrl={embeddedApp.url}
          appIcon={embeddedApp.icon}
        />
      )}

      <TileContextSheet
        isOpen={contextSheet.isOpen}
        onClose={handleCloseContextSheet}
        tile={contextSheet.tile}
        tileIcon={contextSheet.tileIcon}
        gradient={contextSheet.gradient}
        isFavorite={contextSheet.tile ? isFavorite(contextSheet.tile.appId) : false}
        isInstalled={contextSheet.tile ? installedApps.includes(contextSheet.tile.appId) : false}
        folders={layout.folders}
        currentFolderId={contextSheet.tile ? getTileFolder(contextSheet.tile.appId)?.id || null : null}
        onToggleFavorite={handleToggleFavorite}
        onAddToFolder={handleAddToFolder}
        onRemoveFromFolder={handleRemoveFromFolder}
        onCreateFolder={handleCreateFolder}
        onInstallChange={handleInstallChange}
      />

      {session && (
        <HubDock
          dockApps={preferences.dock}
          dockStyle={preferences.dockStyle}
          onAppClick={handleDockAppClick}
          onAddApp={handleDockAddApp}
          onRemoveApp={deleteDockApp}
          isEditing={isDockEditing}
          onToggleEdit={() => setIsDockEditing(!isDockEditing)}
          showDock={preferences.showDock}
          onToggleDock={() => toggleDock(!preferences.showDock)}
          onStyleChange={updateDockStyle}
        />
      )}

      <DockAppPicker
        isOpen={dockPickerOpen}
        onClose={() => setDockPickerOpen(false)}
        onSelect={handleDockSelectApp}
        position={dockPickerPosition}
        existingDockApps={preferences.dock}
      />

      <BackgroundPicker
        isOpen={bgPickerOpen}
        onClose={() => setBgPickerOpen(false)}
        onSelect={updateBackground}
        currentBackground={preferences.background}
      />

      <HubPasswordSettings
        isOpen={passwordSettingsOpen}
        onClose={() => setPasswordSettingsOpen(false)}
        hasPassword={!!preferences.decryptPasswordHash}
        onSetPassword={setPassword}
        onRemovePassword={clearPassword}
      />

      <BrowserHandoffButton />
      
      {showAnchors && (
        <RecentAnchors onClose={() => setShowAnchors(false)} />
      )}
    </div>
  );
}
