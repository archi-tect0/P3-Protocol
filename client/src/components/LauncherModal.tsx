import { useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Minimize2, Maximize2, Download, Check, Sparkles, Anchor } from 'lucide-react';
import { anchorEventsMap } from '@/pages/launcher/appRegistry';
import { TileRef } from '@/lib/hubLayout';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PWAInstallStatus = 'installable' | 'installed' | 'pwa-ready' | 'unknown';

interface PWAAppState {
  status: PWAInstallStatus;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

const pwaAppStates = new Map<string, PWAAppState>();
const pwaStateListeners = new Set<() => void>();

function notifyPWAListeners() {
  pwaStateListeners.forEach(listener => listener());
}

function getPWAAppState(appId: string): PWAAppState {
  if (!pwaAppStates.has(appId)) {
    pwaAppStates.set(appId, { status: 'unknown', deferredPrompt: null });
  }
  return pwaAppStates.get(appId)!;
}

function setPWAAppStatus(appId: string, status: PWAInstallStatus, deferredPrompt?: BeforeInstallPromptEvent | null) {
  const currentState = getPWAAppState(appId);
  pwaAppStates.set(appId, {
    status,
    deferredPrompt: deferredPrompt !== undefined ? deferredPrompt : currentState.deferredPrompt
  });
  notifyPWAListeners();
}

function initializePWAListeners() {
  if (typeof window === 'undefined') return;
  
  const handleBeforeInstall = (e: Event) => {
    e.preventDefault();
    const event = e as BeforeInstallPromptEvent;
    pwaAppStates.forEach((state, appId) => {
      if (state.status !== 'installed') {
        setPWAAppStatus(appId, 'installable', event);
      }
    });
    console.log('[PWA Hub] Install prompt available for apps');
  };

  const handleAppInstalled = () => {
    pwaAppStates.forEach((state, appId) => {
      if (state.status === 'installable') {
        setPWAAppStatus(appId, 'installed', null);
      }
    });
    console.log('[PWA Hub] App installed');
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstall);
  window.addEventListener('appinstalled', handleAppInstalled);

  return () => {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    window.removeEventListener('appinstalled', handleAppInstalled);
  };
}

let pwaListenersInitialized = false;
let pwaListenersCleanup: (() => void) | undefined;

if (typeof window !== 'undefined' && !pwaListenersInitialized) {
  pwaListenersCleanup = initializePWAListeners();
  pwaListenersInitialized = true;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (pwaListenersCleanup) {
      pwaListenersCleanup();
      pwaListenersInitialized = false;
    }
  });
}

export function usePWAAppStatus(appId: string, supportsPWA: boolean = false) {
  const [state, setState] = useState<PWAAppState>(() => {
    const existing = getPWAAppState(appId);
    if (existing.status === 'unknown' && supportsPWA) {
      return { status: 'pwa-ready', deferredPrompt: null };
    }
    return existing;
  });

  useEffect(() => {
    if (supportsPWA && getPWAAppState(appId).status === 'unknown') {
      setPWAAppStatus(appId, 'pwa-ready');
    }
  }, [appId, supportsPWA]);

  useEffect(() => {
    const listener = () => {
      setState(getPWAAppState(appId));
    };
    pwaStateListeners.add(listener);
    return () => {
      pwaStateListeners.delete(listener);
    };
  }, [appId]);

  const triggerInstall = useCallback(async (): Promise<boolean> => {
    const appState = getPWAAppState(appId);
    if (!appState.deferredPrompt) {
      console.log('[PWA Hub] No install prompt available for', appId);
      return false;
    }

    try {
      await appState.deferredPrompt.prompt();
      const choice = await appState.deferredPrompt.userChoice;
      console.log('[PWA Hub] User choice for', appId, ':', choice.outcome);
      
      if (choice.outcome === 'accepted') {
        setPWAAppStatus(appId, 'installed', null);
        return true;
      }
    } catch (error) {
      console.error('[PWA Hub] Install error for', appId, ':', error);
    }
    
    return false;
  }, [appId]);

  return { ...state, triggerInstall };
}

interface LauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  gradient?: string;
}

export function LauncherModal({ 
  isOpen, 
  onClose, 
  title, 
  icon,
  children,
  gradient = 'from-purple-500 to-indigo-600'
}: LauncherModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div 
        className={`relative bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen 
            ? 'w-full h-full rounded-none' 
            : 'w-[95vw] max-w-2xl h-[85vh] max-h-[700px]'
        }`}
      >
        <div className={`flex items-center justify-between p-3 border-b border-white/10 bg-gradient-to-r ${gradient}`}>
          <div className="flex items-center gap-2">
            {icon && <div className="w-6 h-6 text-white">{icon}</div>}
            <h2 className="text-sm font-semibold text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-1">
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
              data-testid="button-close-modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div className="h-[calc(100%-48px)] overflow-y-auto p-4 bg-[#141414]">
          {children}
        </div>
      </div>
    </div>
  );
}

interface PWAInstallBadgeProps {
  status: PWAInstallStatus;
}

function PWAInstallBadge({ status }: PWAInstallBadgeProps) {
  if (status === 'unknown') return null;

  const badgeConfig: Record<Exclude<PWAInstallStatus, 'unknown'>, { 
    label: string; 
    gradient: string; 
    icon: ReactNode;
  }> = {
    'installable': {
      label: 'Install',
      gradient: 'from-[#3CCB7C] to-[#4FE1A8]',
      icon: <Download className="w-2.5 h-2.5" />
    },
    'installed': {
      label: 'Installed',
      gradient: 'from-[#7AA8FF] to-[#9BD1FF]',
      icon: <Check className="w-2.5 h-2.5" />
    },
    'pwa-ready': {
      label: 'PWA',
      gradient: 'from-slate-500 to-slate-400',
      icon: <Sparkles className="w-2.5 h-2.5" />
    }
  };

  const config = badgeConfig[status];

  return (
    <div 
      className={`absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r ${config.gradient} text-[11px] font-semibold text-white shadow-md`}
      data-testid={`pwa-badge-${status}`}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.label}</span>
    </div>
  );
}

interface AnchorPreviewProps {
  appId: string;
  visible: boolean;
}

function AnchorPreview({ appId, visible }: AnchorPreviewProps) {
  const events = anchorEventsMap[appId] || ['action_completed'];
  
  return (
    <div 
      className={`absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[calc(100%+4px)] z-50 min-w-[140px] max-w-[180px] p-2 rounded-lg transition-all duration-200 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      data-testid={`anchor-preview-${appId}`}
    >
      <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/10">
        <Anchor className="w-3 h-3 text-emerald-400" />
        <span className="text-[10px] font-semibold text-white/90">Anchor Events</span>
      </div>
      <div className="space-y-1">
        {events.slice(0, 4).map((event) => (
          <div key={event} className="flex items-center justify-between gap-2">
            <span className="text-[9px] text-white/70 font-mono truncate">{event}</span>
            <span className="flex items-center gap-0.5 text-[8px] text-emerald-400 font-medium">
              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
              ready
            </span>
          </div>
        ))}
        {events.length > 4 && (
          <div className="text-[8px] text-white/50 text-center pt-0.5">
            +{events.length - 4} more
          </div>
        )}
      </div>
    </div>
  );
}

const LONG_PRESS_THRESHOLD = 420;

interface AppIconProps {
  name: string;
  icon: ReactNode;
  gradient: string;
  onClick: () => void;
  category?: 'communication' | 'security' | 'payments' | 'creative' | 'social' | 'governance' | 'analytics' | 'developer' | 'games' | 'external';
  appId?: string;
  supportsPWA?: boolean;
  anchorEvents?: string[];
  onLongPress?: (tile: TileRef, icon: ReactNode, gradient: string) => void;
  isFavorite?: boolean;
}

export function AppIcon({ 
  name, 
  icon, 
  gradient, 
  onClick, 
  category, 
  appId, 
  supportsPWA = false, 
  anchorEvents: _anchorEvents,
  onLongPress,
  isFavorite = false,
}: AppIconProps) {
  const effectiveAppId = appId || name.toLowerCase().replace(/\s+/g, '-');
  const { status, triggerInstall } = usePWAAppStatus(effectiveAppId, supportsPWA);
  const [showAnchorPreview, setShowAnchorPreview] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressTriggered = useRef(false);

  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const triggerLongPress = useCallback(() => {
    if (onLongPress && category) {
      isLongPressTriggered.current = true;
      const tile: TileRef = {
        appId: effectiveAppId,
        title: name,
        category,
      };
      onLongPress(tile, icon, gradient);
    }
    clearLongPressTimer();
  }, [onLongPress, effectiveAppId, name, category, icon, gradient, clearLongPressTimer]);

  const startLongPress = useCallback(() => {
    isLongPressTriggered.current = false;
    setIsLongPressing(true);
    longPressTimer.current = setTimeout(() => {
      triggerLongPress();
    }, LONG_PRESS_THRESHOLD);
  }, [triggerLongPress]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      startLongPress();
    }
  }, [startLongPress]);

  const handleMouseUp = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchStart = useCallback((_e: React.TouchEvent) => {
    startLongPress();
  }, [startLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleTouchMove = useCallback(() => {
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if (isLongPressTriggered.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressTriggered.current = false;
      return;
    }

    if (isTouchDevice && !showAnchorPreview) {
      e.preventDefault();
      setShowAnchorPreview(true);
      return;
    }
    
    if (status === 'installable') {
      e.stopPropagation();
      const installed = await triggerInstall();
      if (!installed) {
        onClick();
      }
    } else {
      onClick();
    }
    setShowAnchorPreview(false);
  }, [status, triggerInstall, onClick, isTouchDevice, showAnchorPreview]);

  const handleMouseEnter = useCallback(() => {
    if (!isTouchDevice) {
      setShowAnchorPreview(true);
    }
  }, [isTouchDevice]);

  const handleMouseLeave = useCallback(() => {
    setShowAnchorPreview(false);
    clearLongPressTimer();
  }, [clearLongPressTimer]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={(e) => e.preventDefault()}
      className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all duration-200 ${isLongPressing ? 'scale-95' : 'active:scale-95'}`}
      data-testid={`app-icon-${effectiveAppId}`}
    >
      <div 
        className={`app-tile-icon relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg transition-all duration-[140ms] ease-out group-hover:-translate-y-[2px] group-hover:brightness-[1.03] ${category ? `app-tile-glow-${category}` : ''} ${isLongPressing ? 'ring-2 ring-purple-500/50' : ''}`}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 text-white">
          {icon}
        </div>
        {supportsPWA && <PWAInstallBadge status={status} />}
        {isFavorite && (
          <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow-md">
            <span className="text-[8px]">⭐</span>
          </div>
        )}
      </div>
      <span className="text-[11px] sm:text-xs text-slate-300 text-center font-medium leading-tight max-w-[72px] truncate">
        {name}
      </span>
      <AnchorPreview appId={effectiveAppId} visible={showAnchorPreview} />
    </button>
  );
}
