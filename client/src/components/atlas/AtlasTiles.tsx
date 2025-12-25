import { useState, useEffect, useRef, useCallback } from 'react';
import { MotionButton, MotionDiv } from '@/lib/motion';
import { useAtlasStore, AtlasMode } from '@/state/useAtlasStore';
import { usePWA } from '@/hooks/use-pwa';
import { 
  MessageSquare, 
  BarChart3, 
  Vote, 
  StickyNote, 
  Image, 
  CreditCard,
  Tv,
  Settings,
  Code,
  Globe,
  Phone,
  Users,
  Shield,
  Inbox,
  Coins,
  Cloud,
  Bot,
  Box,
  FolderOpen,
  User,
  Bell,
  ClipboardList,
  Activity,
  Calculator,
  Camera,
  Monitor,
  FileText,
  Table,
  GitBranch,
  Gamepad2,
  BookOpen,
  ChevronUp,
  ChevronDown,
  Newspaper,
  Radio,
  Network,
  LayoutGrid,
  Video,
  BookOpenCheck,
  Headphones,
  Download,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

const P3_SUPPORT_WALLET = '0x5af178E1354A0Df4B8b0Fea77E9a1E802BF877e2';

interface TileConfig {
  id: string;
  title: string;
  defaultMode: AtlasMode;
  icon: typeof MessageSquare;
  isContactUs?: boolean;
  isExternalApp?: boolean;
  externalUrl?: string;
  gradient?: string;
}

const defaultTiles: TileConfig[] = [
  { id: 'chat', title: 'Chat', defaultMode: 'chat' as AtlasMode, icon: MessageSquare },
  { id: 'launcher', title: 'Hub', defaultMode: 'hub' as AtlasMode, icon: LayoutGrid },
  { id: 'news', title: 'News', defaultMode: 'news' as AtlasMode, icon: Newspaper },
  { id: 'cctv', title: 'CCTV', defaultMode: 'cctv' as AtlasMode, icon: Video },
  { id: 'pulse', title: 'Pulse', defaultMode: 'pulse' as AtlasMode, icon: Radio },
  { id: 'node', title: 'Pulse Node', defaultMode: 'node' as AtlasMode, icon: Network },
  { id: 'gamedeck', title: 'Game Deck', defaultMode: 'gamedeck' as AtlasMode, icon: Gamepad2 },
  { id: 'inbox', title: 'Inbox', defaultMode: 'inbox' as AtlasMode, icon: Inbox },
  { id: 'messages', title: 'Messages', defaultMode: 'messages' as AtlasMode, icon: MessageSquare },
  { id: 'calls', title: 'Calls', defaultMode: 'calls' as AtlasMode, icon: Phone },
  { id: 'directory', title: 'Directory', defaultMode: 'directory' as AtlasMode, icon: Users },
  { id: 'payments', title: 'Payments', defaultMode: 'payments' as AtlasMode, icon: CreditCard },
  { id: 'receipts', title: 'Explorer', defaultMode: 'receipts' as AtlasMode, icon: Shield },
  { id: 'notes', title: 'Notes', defaultMode: 'notes' as AtlasMode, icon: StickyNote },
  { id: 'tv', title: 'Live TV', defaultMode: 'tv' as AtlasMode, icon: Tv },
  { id: 'tokens', title: 'Tokens', defaultMode: 'tokens' as AtlasMode, icon: Coins },
  { id: 'weather', title: 'Weather', defaultMode: 'weather' as AtlasMode, icon: Cloud },
  { id: 'ai', title: 'AI Chat', defaultMode: 'ai' as AtlasMode, icon: Bot },
  { id: 'gallery', title: 'Gallery', defaultMode: 'gallery' as AtlasMode, icon: Image },
  { id: 'registry', title: 'Registry', defaultMode: 'registry' as AtlasMode, icon: Globe },
  { id: 'metrics', title: 'Metrics', defaultMode: 'metrics' as AtlasMode, icon: BarChart3 },
  { id: 'governance', title: 'Governance', defaultMode: 'governance' as AtlasMode, icon: Vote },
  { id: 'feed', title: 'Feed', defaultMode: 'feed' as AtlasMode, icon: BarChart3 },
  { id: 'identity', title: 'Identity', defaultMode: 'identity' as AtlasMode, icon: User },
  { id: 'notifications', title: 'Notifications', defaultMode: 'notifications' as AtlasMode, icon: Bell },
  { id: 'clipboard', title: 'Clipboard', defaultMode: 'clipboard' as AtlasMode, icon: ClipboardList },
  { id: 'system', title: 'Tasks', defaultMode: 'system' as AtlasMode, icon: Activity },
  { id: 'math', title: 'Math', defaultMode: 'math' as AtlasMode, icon: Calculator },
  { id: 'camera', title: 'Camera', defaultMode: 'camera' as AtlasMode, icon: Camera },
  { id: 'fileHub', title: 'Files', defaultMode: 'fileHub' as AtlasMode, icon: FolderOpen },
  { id: 'webBrowser', title: 'Browser', defaultMode: 'webBrowser' as AtlasMode, icon: Monitor },
  { id: 'sandbox', title: 'Sandbox', defaultMode: 'sandbox' as AtlasMode, icon: Box },
  { id: 'writer', title: 'Writer', defaultMode: 'writer' as AtlasMode, icon: FileText },
  { id: 'calc', title: 'Calc', defaultMode: 'calc' as AtlasMode, icon: Table },
  { id: 'orchestration', title: 'Flows', defaultMode: 'orchestration' as AtlasMode, icon: GitBranch },
  { id: 'reader', title: 'eBooks', defaultMode: 'reader' as AtlasMode, icon: BookOpen },
  { id: 'radio', title: 'Radio', defaultMode: 'radio' as AtlasMode, icon: Headphones },
  { id: 'nodestream', title: 'Node Stream', defaultMode: 'nodestream' as AtlasMode, icon: Video },
  { id: 'wikipedia', title: 'Wikipedia', defaultMode: 'wikipedia' as AtlasMode, icon: BookOpenCheck },
  { id: 'developer', title: 'Developer', defaultMode: 'developer' as AtlasMode, icon: Code },
  { id: 'support', title: 'Contact Us', defaultMode: 'support' as AtlasMode, icon: HelpCircle, isContactUs: true },
  { id: 'settings', title: 'Settings', defaultMode: 'settings' as AtlasMode, icon: Settings },
];

export default function AtlasTiles() {
  const tiles = useAtlasStore((s) => s.tiles);
  const dissolveInto = useAtlasStore((s) => s.dissolveInto);
  const mode = useAtlasStore((s) => s.mode);
  const sidebarOpen = useAtlasStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAtlasStore((s) => s.setSidebarOpen);
  const openComposeFor = useAtlasStore((s) => s.openComposeFor);
  const openExternalApp = useAtlasStore((s) => s.openExternalApp);
  const displayTiles = tiles.length > 0 ? tiles : defaultTiles;
  const [isExpanded, setIsExpanded] = useState(false);
  const lastScrollTop = useRef(0);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<Element | null>(null);
  const { isInstallable, isInstalled, isStandalone, promptInstall } = usePWA('atlas');

  useEffect(() => {
    if (mode !== 'idle' && hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  }, [mode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSidebarOpen(false);
        setIsExpanded(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [sidebarOpen, setSidebarOpen]);

  const handleScroll = useCallback((scrollTop: number) => {
    const scrollingDown = scrollTop > lastScrollTop.current;
    const scrollDelta = Math.abs(scrollTop - lastScrollTop.current);
    
    if (scrollDelta > 10) {
      if (scrollingDown && scrollTop > 50) {
        setIsExpanded(false);
      }
    }
    
    lastScrollTop.current = scrollTop;
  }, []);

  useEffect(() => {
    const findScrollContainer = () => {
      const canvasElement = document.querySelector('[data-testid="atlas-canvas"]');
      if (canvasElement) {
        const scrollable = canvasElement.querySelector('.overflow-y-auto');
        if (scrollable) return scrollable;
      }
      return null;
    };
    
    const scrollContainer = findScrollContainer();
    scrollContainerRef.current = scrollContainer;
    
    if (scrollContainer) {
      const handler = (e: Event) => {
        const target = e.target as Element;
        handleScroll(target.scrollTop);
      };
      scrollContainer.addEventListener('scroll', handler, { passive: true });
      return () => scrollContainer.removeEventListener('scroll', handler);
    } else {
      const handler = () => handleScroll(window.scrollY);
      window.addEventListener('scroll', handler, { passive: true });
      return () => window.removeEventListener('scroll', handler);
    }
  }, [handleScroll]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handlePointerInteraction = useCallback(() => {
    setSidebarOpen(true);
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
  }, [setSidebarOpen]);

  const visibleTiles = isExpanded ? displayTiles : displayTiles.slice(0, 8);

  return (
    <MotionDiv
      ref={containerRef}
      className="fixed right-3 sm:right-4 top-20 z-30 flex flex-col items-end gap-2"
      initial={{ opacity: 0, x: 60 }}
      animate={{ 
        opacity: sidebarOpen ? 1 : 0,
        x: sidebarOpen ? 0 : 60,
        pointerEvents: sidebarOpen ? 'auto' : 'none'
      }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      data-testid="atlas-tiles"
      onPointerDown={handlePointerInteraction}
    >
      <div className="flex flex-col gap-2.5 sm:gap-3 max-h-[60vh] overflow-y-auto scrollbar-hide bg-black/40 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-white/10">
        {visibleTiles.map((tile: any, index: number) => {
          const Icon = tile.icon || MessageSquare;
          const isActive = mode === tile.defaultMode;
          
          return (
            <MotionButton
              key={tile.id}
              onClick={() => {
                if (tile.isContactUs) {
                  openComposeFor(P3_SUPPORT_WALLET);
                } else if (tile.isExternalApp && tile.externalUrl) {
                  openExternalApp({
                    id: tile.id,
                    name: tile.title,
                    url: tile.externalUrl,
                    icon: '🌐',
                    gradient: tile.gradient || 'from-violet-500 to-purple-600',
                  });
                } else {
                  dissolveInto(tile.defaultMode);
                }
              }}
              className={`
                relative min-w-[48px] min-h-[48px] p-3 sm:p-3.5 rounded-xl backdrop-blur-sm
                border transition-all duration-300 flex items-center justify-center
                ${isActive 
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300' 
                  : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/15 hover:border-white/20 hover:text-white'
                }
              `}
              whileHover={{ scale: 1.1, x: -4 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.02 }}
              data-testid={`tile-${tile.id}`}
              title={tile.title}
            >
              <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-cyan-400 rounded-r-full" />
              )}
            </MotionButton>
          );
        })}
        
        {displayTiles.length > 8 && (
          <MotionButton
            onClick={() => setIsExpanded(!isExpanded)}
            className="min-w-[48px] min-h-[48px] p-3 sm:p-3.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="tile-expand-toggle"
            title={isExpanded ? 'Show less' : 'Show more'}
          >
            {isExpanded ? (
              <ChevronUp className="w-6 h-6 sm:w-7 sm:h-7" />
            ) : (
              <ChevronDown className="w-6 h-6 sm:w-7 sm:h-7" />
            )}
          </MotionButton>
        )}
        
        {/* Atlas PWA Install Button */}
        {isInstalled || isStandalone ? (
          <MotionButton
            className="min-w-[48px] min-h-[48px] p-3 sm:p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 cursor-default"
            data-testid="tile-atlas-installed"
            title="Atlas Installed"
          >
            <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7" />
          </MotionButton>
        ) : isInstallable ? (
          <MotionButton
            onClick={() => promptInstall()}
            className="min-w-[48px] min-h-[48px] p-3 sm:p-3.5 rounded-xl bg-violet-500/20 border border-violet-400/50 text-violet-300 hover:bg-violet-500/30 hover:text-white transition-all"
            whileHover={{ scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.95 }}
            data-testid="tile-install-atlas"
            title="Install Atlas"
          >
            <Download className="w-6 h-6 sm:w-7 sm:h-7" />
          </MotionButton>
        ) : null}
      </div>
    </MotionDiv>
  );
}
