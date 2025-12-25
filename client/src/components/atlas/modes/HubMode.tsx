import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore, AtlasMode } from '@/state/useAtlasStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search, Mic, Activity, Users, MessageSquare, Phone, CreditCard,
  Tv, Cloud, Brain, ShoppingBag, Gamepad2, BookOpen, Image,
  Vote, Coins, Mail, Fingerprint, FileText, Calculator, Camera,
  Monitor, Globe, GitBranch, Radio, Zap, ChevronDown,
  Network, Layers, TrendingUp,
  Newspaper, Server, Shield, Video, Box, ExternalLink, Plus, Check,
  Headphones, BookOpenCheck, Square, Loader2
} from 'lucide-react';
import { getExternalApps, getExternalAppById, type ExternalAppDefinition } from '@/lib/externalAppsRegistry';
import { useSpeechCapture } from '@/hooks/useSpeechCapture';
import { useToast } from '@/hooks/use-toast';

interface HubTile {
  id: string;
  name: string;
  mode: AtlasMode;
  icon: typeof Activity;
  domain: 'media' | 'commerce' | 'communication' | 'governance' | 'tools' | 'system' | 'installed';
  gradient: string;
  glowColor: string;
  description: string;
  metrics?: {
    label: string;
    value: number | string;
    trend?: 'up' | 'down' | 'stable';
  };
  health: 'excellent' | 'good' | 'warning' | 'critical';
  isLive: boolean;
  externalAppId?: string;
  emojiIcon?: string;
}

interface PulseData {
  success: boolean;
  metrics: {
    liveUsers: number;
    messagesToday: number;
    catalogItems: number;
    totalPageViews: number;
  };
}

interface NodeDiagnosticsData {
  success: boolean;
  diagnostics: {
    mesh: {
      participatingNodes: number;
      peersConnected: number;
      tasksCompleted: number;
    };
  };
}

const DOMAIN_CONFIG = {
  installed: { label: 'Installed Apps', icon: Globe, gradient: 'from-cyan-500 to-teal-500' },
  media: { label: 'Media & Entertainment', icon: Video, gradient: 'from-pink-500 to-rose-500' },
  commerce: { label: 'Commerce & Marketplace', icon: ShoppingBag, gradient: 'from-amber-500 to-orange-500' },
  communication: { label: 'Communication', icon: MessageSquare, gradient: 'from-cyan-500 to-blue-500' },
  governance: { label: 'Governance & Identity', icon: Shield, gradient: 'from-violet-500 to-purple-500' },
  tools: { label: 'Productivity Tools', icon: Zap, gradient: 'from-emerald-500 to-green-500' },
  system: { label: 'System & Developer', icon: Server, gradient: 'from-slate-500 to-zinc-500' },
};

function getInstalledAppTiles(): HubTile[] {
  try {
    const saved = localStorage.getItem('p3_installed_apps');
    if (!saved) return [];
    const ids: string[] = JSON.parse(saved);
    return ids.map(id => {
      const app = getExternalAppById(id);
      if (!app) return null;
      return {
        id: `installed-${app.id}`,
        name: app.name,
        mode: 'externalApp' as AtlasMode,
        icon: ExternalLink,
        domain: 'installed' as const,
        gradient: `${app.gradient.split(' ')[0]}/20 ${app.gradient.split(' ')[1]}/20`,
        glowColor: 'cyan',
        description: app.category,
        health: 'excellent' as const,
        isLive: true,
        externalAppId: app.id,
        emojiIcon: app.icon,
      };
    }).filter(Boolean) as HubTile[];
  } catch {
    return [];
  }
}

const createHubTiles = (pulseData?: PulseData, nodeData?: NodeDiagnosticsData): HubTile[] => [
  {
    id: 'news',
    name: 'News',
    mode: 'news',
    icon: Newspaper,
    domain: 'media',
    gradient: 'from-rose-500/20 to-pink-600/20',
    glowColor: 'rose',
    description: 'Live news streams',
    metrics: { label: 'Articles', value: '1.2K+', trend: 'up' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'tv',
    name: 'Live TV',
    mode: 'tv',
    icon: Tv,
    domain: 'media',
    gradient: 'from-purple-500/20 to-violet-600/20',
    glowColor: 'purple',
    description: 'Global live channels',
    metrics: { label: 'Channels', value: '5K+', trend: 'stable' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'gamedeck',
    name: 'Game Deck',
    mode: 'gamedeck',
    icon: Gamepad2,
    domain: 'media',
    gradient: 'from-cyan-500/20 to-blue-600/20',
    glowColor: 'cyan',
    description: 'Free-to-play games',
    metrics: { label: 'Games', value: '800+', trend: 'up' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'reader',
    name: 'Reader',
    mode: 'reader',
    icon: BookOpen,
    domain: 'media',
    gradient: 'from-amber-500/20 to-yellow-600/20',
    glowColor: 'amber',
    description: 'eBooks & documents',
    metrics: { label: 'Books', value: '70K+', trend: 'up' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'gallery',
    name: 'Gallery',
    mode: 'gallery',
    icon: Image,
    domain: 'media',
    gradient: 'from-fuchsia-500/20 to-pink-600/20',
    glowColor: 'fuchsia',
    description: 'Visual collections',
    metrics: { label: 'Images', value: '∞' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'library',
    name: 'Library',
    mode: 'library',
    icon: Layers,
    domain: 'media',
    gradient: 'from-indigo-500/20 to-blue-600/20',
    glowColor: 'indigo',
    description: 'Your saved content',
    metrics: { label: 'Saved', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'radio',
    name: 'Radio',
    mode: 'radio',
    icon: Headphones,
    domain: 'media',
    gradient: 'from-orange-500/20 to-red-600/20',
    glowColor: 'orange',
    description: 'Live radio streams',
    metrics: { label: 'Stations', value: '1K+', trend: 'up' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    mode: 'wikipedia',
    icon: BookOpenCheck,
    domain: 'media',
    gradient: 'from-slate-500/20 to-gray-600/20',
    glowColor: 'slate',
    description: 'Knowledge base',
    metrics: { label: 'Articles', value: '6M+' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'one',
    name: 'Atlas One',
    mode: 'one',
    icon: Box,
    domain: 'commerce',
    gradient: 'from-amber-500/20 to-orange-600/20',
    glowColor: 'amber',
    description: 'Unified marketplace',
    metrics: { label: 'Catalog', value: pulseData?.metrics?.catalogItems?.toLocaleString() || '16K+', trend: 'up' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'tokens',
    name: 'Tokens',
    mode: 'tokens',
    icon: Coins,
    domain: 'commerce',
    gradient: 'from-yellow-500/20 to-amber-600/20',
    glowColor: 'yellow',
    description: 'Token portfolio',
    metrics: { label: 'Assets', value: '∞' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'payments',
    name: 'Payments',
    mode: 'payments',
    icon: CreditCard,
    domain: 'commerce',
    gradient: 'from-emerald-500/20 to-green-600/20',
    glowColor: 'emerald',
    description: 'Send & receive',
    metrics: { label: 'Volume', value: '$0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'receipts',
    name: 'Receipts',
    mode: 'receipts',
    icon: FileText,
    domain: 'commerce',
    gradient: 'from-teal-500/20 to-cyan-600/20',
    glowColor: 'teal',
    description: 'Blockchain receipts',
    metrics: { label: 'Anchored', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'messages',
    name: 'Messages',
    mode: 'messages',
    icon: MessageSquare,
    domain: 'communication',
    gradient: 'from-blue-500/20 to-cyan-600/20',
    glowColor: 'blue',
    description: 'Encrypted messaging',
    metrics: { label: 'Today', value: pulseData?.metrics?.messagesToday || 0 },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'calls',
    name: 'Calls',
    mode: 'calls',
    icon: Phone,
    domain: 'communication',
    gradient: 'from-green-500/20 to-emerald-600/20',
    glowColor: 'green',
    description: 'Voice & video',
    metrics: { label: 'Active', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'inbox',
    name: 'Inbox',
    mode: 'inbox',
    icon: Mail,
    domain: 'communication',
    gradient: 'from-sky-500/20 to-blue-600/20',
    glowColor: 'sky',
    description: 'Notifications hub',
    metrics: { label: 'Unread', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'governance',
    name: 'Governance',
    mode: 'governance',
    icon: Vote,
    domain: 'governance',
    gradient: 'from-violet-500/20 to-purple-600/20',
    glowColor: 'violet',
    description: 'DAO & proposals',
    metrics: { label: 'Active', value: '3' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'identity',
    name: 'Identity',
    mode: 'identity',
    icon: Fingerprint,
    domain: 'governance',
    gradient: 'from-pink-500/20 to-rose-600/20',
    glowColor: 'pink',
    description: 'DID & credentials',
    metrics: { label: 'Claims', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'registry',
    name: 'Registry',
    mode: 'registry',
    icon: Network,
    domain: 'governance',
    gradient: 'from-indigo-500/20 to-violet-600/20',
    glowColor: 'indigo',
    description: 'Entity registry',
    metrics: { label: 'Entries', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'ai',
    name: 'AI Chat',
    mode: 'ai',
    icon: Brain,
    domain: 'tools',
    gradient: 'from-fuchsia-500/20 to-purple-600/20',
    glowColor: 'fuchsia',
    description: 'AI assistant',
    metrics: { label: 'Ready', value: '✓' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'writer',
    name: 'Writer',
    mode: 'writer',
    icon: FileText,
    domain: 'tools',
    gradient: 'from-slate-500/20 to-gray-600/20',
    glowColor: 'slate',
    description: 'Document editor',
    metrics: { label: 'Docs', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'calc',
    name: 'Calculator',
    mode: 'calc',
    icon: Calculator,
    domain: 'tools',
    gradient: 'from-zinc-500/20 to-neutral-600/20',
    glowColor: 'zinc',
    description: 'Math & crypto calc',
    metrics: { label: 'Ready', value: '✓' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'weather',
    name: 'Weather',
    mode: 'weather',
    icon: Cloud,
    domain: 'tools',
    gradient: 'from-sky-500/20 to-blue-600/20',
    glowColor: 'sky',
    description: 'Global forecasts',
    metrics: { label: 'Live', value: '✓' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'camera',
    name: 'Camera',
    mode: 'camera',
    icon: Camera,
    domain: 'tools',
    gradient: 'from-rose-500/20 to-red-600/20',
    glowColor: 'rose',
    description: 'Capture & scan',
    metrics: { label: 'Ready', value: '✓' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'webBrowser',
    name: 'Browser',
    mode: 'webBrowser',
    icon: Globe,
    domain: 'tools',
    gradient: 'from-blue-500/20 to-indigo-600/20',
    glowColor: 'blue',
    description: 'Web browser',
    metrics: { label: 'Ready', value: '✓' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'pulse',
    name: 'Pulse',
    mode: 'pulse',
    icon: Activity,
    domain: 'system',
    gradient: 'from-cyan-500/20 to-teal-600/20',
    glowColor: 'cyan',
    description: 'Substrate health',
    metrics: { label: 'Live Users', value: pulseData?.metrics?.liveUsers || 0, trend: 'up' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'system',
    name: 'System',
    mode: 'system',
    icon: Monitor,
    domain: 'system',
    gradient: 'from-gray-500/20 to-slate-600/20',
    glowColor: 'gray',
    description: 'System monitor',
    metrics: { label: 'Status', value: 'OK' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'orchestration',
    name: 'Flows',
    mode: 'orchestration',
    icon: GitBranch,
    domain: 'system',
    gradient: 'from-orange-500/20 to-red-600/20',
    glowColor: 'orange',
    description: 'Orchestration',
    metrics: { label: 'Active', value: '0' },
    health: 'good',
    isLive: false,
  },
  {
    id: 'node',
    name: 'Node Mode',
    mode: 'node',
    icon: Radio,
    domain: 'system',
    gradient: 'from-emerald-500/20 to-green-600/20',
    glowColor: 'emerald',
    description: 'Distributed mesh',
    metrics: { label: 'Nodes', value: nodeData?.diagnostics?.mesh?.participatingNodes ?? 0 },
    health: (nodeData?.diagnostics?.mesh?.participatingNodes ?? 0) > 0 ? 'excellent' : 'good',
    isLive: true,
  },
  {
    id: 'developer',
    name: 'Developer',
    mode: 'developer',
    icon: Server,
    domain: 'system',
    gradient: 'from-violet-500/20 to-indigo-600/20',
    glowColor: 'violet',
    description: 'API & settings',
    metrics: { label: 'APIs', value: '47' },
    health: 'excellent',
    isLive: true,
  },
  {
    id: 'settings',
    name: 'Settings',
    mode: 'settings',
    icon: Shield,
    domain: 'system',
    gradient: 'from-slate-500/20 to-zinc-600/20',
    glowColor: 'slate',
    description: 'Preferences & config',
    metrics: { label: 'Ready', value: '✓' },
    health: 'excellent',
    isLive: false,
  },
];

function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <MotionDiv
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white/20"
          initial={{
            x: Math.random() * 400,
            y: Math.random() * 800,
            opacity: 0,
          }}
          animate={{
            x: [Math.random() * 400, Math.random() * 400],
            y: [Math.random() * 800, Math.random() * 800],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

function MeshLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10" preserveAspectRatio="none">
      <defs>
        <linearGradient id="meshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#A855F7" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#EC4899" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g>
        {[...Array(8)].map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0%"
            y1={`${(i + 1) * 12}%`}
            x2="100%"
            y2={`${(i + 1) * 12}%`}
            stroke="url(#meshGradient)"
            strokeWidth="0.5"
          />
        ))}
        {[...Array(6)].map((_, i) => (
          <line
            key={`v-${i}`}
            x1={`${(i + 1) * 16}%`}
            y1="0%"
            x2={`${(i + 1) * 16}%`}
            y2="100%"
            stroke="url(#meshGradient)"
            strokeWidth="0.5"
          />
        ))}
      </g>
    </svg>
  );
}

function HealthBadge({ health }: { health: HubTile['health'] }) {
  const colors = {
    excellent: 'bg-green-500 shadow-green-500/50',
    good: 'bg-blue-500 shadow-blue-500/50',
    warning: 'bg-yellow-500 shadow-yellow-500/50',
    critical: 'bg-red-500 shadow-red-500/50',
  };

  return (
    <MotionDiv
      className={`w-2 h-2 rounded-full ${colors[health]} shadow-lg`}
      animate={{
        scale: [1, 1.3, 1],
        opacity: [1, 0.7, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

function HubTileCard({ 
  tile, 
  index, 
  onLaunch 
}: { 
  tile: HubTile; 
  index: number; 
  onLaunch: (tile: HubTile) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.03,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ 
        scale: 1.05, 
        y: -5,
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => onLaunch(tile)}
      className="relative group cursor-pointer"
      data-testid={`hub-tile-${tile.id}`}
    >
      <div className={`
        relative p-4 rounded-2xl
        bg-gradient-to-br ${tile.gradient}
        backdrop-blur-xl
        border border-white/10
        overflow-hidden
        transition-all duration-300
        ${isHovered ? 'border-white/30 shadow-2xl' : 'shadow-lg'}
      `}>
        <div 
          className={`
            absolute inset-0 opacity-0 group-hover:opacity-100
            bg-gradient-to-br ${tile.gradient}
            transition-opacity duration-500
          `}
          style={{
            filter: 'blur(40px)',
            transform: 'scale(1.5)',
          }}
        />
        
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <MotionDiv
              className={`
                p-2.5 rounded-xl
                bg-white/10 backdrop-blur-sm
                border border-white/10
              `}
              animate={isHovered ? { rotate: [0, -5, 5, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              {tile.emojiIcon ? (
                <span className="text-xl">{tile.emojiIcon}</span>
              ) : (
                <tile.icon className="w-5 h-5 text-white" />
              )}
            </MotionDiv>
            <div className="flex items-center gap-2">
              {tile.isLive && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
                  LIVE
                </span>
              )}
              <HealthBadge health={tile.health} />
            </div>
          </div>
          
          <h3 className="text-white font-semibold text-sm mb-1">{tile.name}</h3>
          <p className="text-white/50 text-xs mb-3 line-clamp-1">{tile.description}</p>
          
          {tile.metrics && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-xs">{tile.metrics.label}:</span>
                <span className="text-white font-semibold text-sm">{tile.metrics.value}</span>
              </div>
              {tile.metrics.trend && (
                <TrendingUp className={`w-3 h-3 ${
                  tile.metrics.trend === 'up' ? 'text-green-400' :
                  tile.metrics.trend === 'down' ? 'text-red-400 rotate-180' :
                  'text-white/40'
                }`} />
              )}
            </div>
          )}
        </div>
        
        <MotionDiv
          className="absolute inset-0 rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
          }}
        />
      </div>
    </MotionDiv>
  );
}

function DomainSection({
  domain,
  tiles,
  onLaunch,
  startIndex,
  isExpanded,
  onToggle,
}: {
  domain: keyof typeof DOMAIN_CONFIG;
  tiles: HubTile[];
  onLaunch: (tile: HubTile) => void;
  startIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const config = DOMAIN_CONFIG[domain];
  const DomainIcon = config.icon;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full group"
        data-testid={`hub-domain-${domain}`}
      >
        <div className={`
          p-2 rounded-xl
          bg-gradient-to-br ${config.gradient}
          opacity-80 group-hover:opacity-100
          transition-opacity
        `}>
          <DomainIcon className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
          {config.label}
        </span>
        <span className="text-xs text-white/40 ml-1">({tiles.length})</span>
        <div className="flex-1" />
        <MotionDiv
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </MotionDiv>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
              {tiles.map((tile, i) => (
                <HubTileCard
                  key={tile.id}
                  tile={tile}
                  index={startIndex + i}
                  onLaunch={onLaunch}
                />
              ))}
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}

export default function HubMode() {
  const { setMode, openExternalApp, wallet } = useAtlasStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    new Set(['installed', 'media', 'commerce', 'communication', 'governance', 'tools', 'system'])
  );
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();
  
  const { state: voiceState, startCapture, stopCapture } = useSpeechCapture({
    wallet: wallet || '',
    onTranscript: (text: string) => {
      setIsListening(false);
      setSearchQuery(text);
    },
    onError: (error: string) => {
      toast({ title: 'Voice Error', description: error, variant: 'destructive' });
      setIsListening(false);
    }
  });
  
  const handleVoiceClick = async () => {
    if (isListening || voiceState === 'recording') {
      stopCapture();
      setIsListening(false);
    } else {
      setIsListening(true);
      await startCapture();
    }
  };
  
  const isVoiceActive = isListening || voiceState === 'recording';
  const isVoiceProcessing = voiceState === 'processing';

  const { data: pulseData } = useQuery<PulseData>({
    queryKey: ['/api/atlas/pulse'],
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const { data: nodeData } = useQuery<NodeDiagnosticsData>({
    queryKey: ['/api/atlas/pulse/node/diagnostics'],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const [installedAppsVersion, setInstalledAppsVersion] = useState(0);
  
  useEffect(() => {
    const handleStorage = () => setInstalledAppsVersion(v => v + 1);
    const handleAppsChanged = () => setInstalledAppsVersion(v => v + 1);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('p3_apps_changed', handleAppsChanged);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('p3_apps_changed', handleAppsChanged);
    };
  }, []);
  
  const tiles = useMemo(() => {
    const baseTiles = createHubTiles(pulseData, nodeData);
    const installedTiles = getInstalledAppTiles();
    return [...installedTiles, ...baseTiles];
  }, [pulseData, nodeData, installedAppsVersion]);

  const filteredTiles = useMemo(() => {
    if (!searchQuery.trim()) return tiles;
    const query = searchQuery.toLowerCase();
    return tiles.filter(
      tile =>
        tile.name.toLowerCase().includes(query) ||
        tile.description.toLowerCase().includes(query) ||
        tile.domain.toLowerCase().includes(query)
    );
  }, [tiles, searchQuery]);

  const groupedTiles = useMemo(() => {
    const groups: Record<string, HubTile[]> = {};
    for (const tile of filteredTiles) {
      if (!groups[tile.domain]) groups[tile.domain] = [];
      groups[tile.domain].push(tile);
    }
    return groups;
  }, [filteredTiles]);

  const handleLaunch = useCallback((tile: HubTile) => {
    if (tile.externalAppId) {
      const app = getExternalAppById(tile.externalAppId);
      if (app) {
        openExternalApp({
          id: app.id,
          name: app.name,
          url: app.url,
          icon: app.icon,
          gradient: app.gradient,
        });
        return;
      }
    }
    setMode(tile.mode);
  }, [setMode, openExternalApp]);

  const toggleDomain = useCallback((domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  }, []);

  const liveCount = tiles.filter(t => t.isLive).length;
  const totalViews = pulseData?.metrics?.totalPageViews || 0;

  let runningIndex = 0;

  return (
    <div className="relative min-h-full p-4 md:p-6 overflow-hidden" data-testid="hub-mode">
      <ParticleField />
      <MeshLines />
      
      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-4 text-sm">
            <MotionDiv
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20"
              animate={{ opacity: [1, 0.7, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-400 font-medium">{liveCount} Live Apps</span>
            </MotionDiv>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-white/60">{pulseData?.metrics?.liveUsers || 0} Active</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-white/60">{totalViews.toLocaleString()} Views</span>
            </div>
          </div>
        </MotionDiv>

        <MotionDiv
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-xl" />
          <div className="relative flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <Search className="w-5 h-5 text-white/40" />
            <Input
              type="text"
              placeholder="Search apps, tools, or say 'open hub'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-0 text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="hub-search-input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleVoiceClick}
              className={`transition-colors ${
                isVoiceActive 
                  ? 'text-pink-400 hover:text-pink-300 bg-pink-500/20' 
                  : 'text-white/40 hover:text-cyan-400 hover:bg-cyan-500/10'
              }`}
              data-testid="hub-voice-search"
            >
              {isVoiceProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isVoiceActive ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>
          </div>
        </MotionDiv>

        {searchQuery && filteredTiles.length === 0 ? (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Search className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40">No apps found for "{searchQuery}"</p>
          </MotionDiv>
        ) : searchQuery ? (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <p className="text-sm text-white/40">
              {filteredTiles.length} result{filteredTiles.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredTiles.map((tile, i) => (
                <HubTileCard
                  key={tile.id}
                  tile={tile}
                  index={i}
                  onLaunch={handleLaunch}
                />
              ))}
            </div>
          </MotionDiv>
        ) : (
          <div className="space-y-6">
            {(['installed', 'media', 'commerce', 'communication', 'governance', 'tools', 'system'] as const).map((domain) => {
              const domainTiles = groupedTiles[domain] || [];
              if (domainTiles.length === 0) return null;
              const startIdx = runningIndex;
              runningIndex += domainTiles.length;
              return (
                <DomainSection
                  key={domain}
                  domain={domain}
                  tiles={domainTiles}
                  onLaunch={handleLaunch}
                  startIndex={startIdx}
                  isExpanded={expandedDomains.has(domain)}
                  onToggle={() => toggleDomain(domain)}
                />
              );
            })}
          </div>
        )}

        <ExternalAppsSection />

        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center pt-8 pb-4"
        >
          <p className="text-xs text-white/30">
            {tiles.length} apps • {Object.keys(DOMAIN_CONFIG).length} domains • Powered by Atlas Mesh OS
          </p>
        </MotionDiv>
      </div>
    </div>
  );
}

function ExternalAppsSection() {
  const { openExternalApp } = useAtlasStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [installedApps, setInstalledApps] = useState<Set<string>>(new Set());
  
  const externalApps = useMemo(() => getExternalApps(), []);
  
  useEffect(() => {
    const saved = localStorage.getItem('p3_installed_apps');
    if (saved) {
      try {
        setInstalledApps(new Set(JSON.parse(saved)));
      } catch {}
    }
  }, []);
  
  const categories = useMemo(() => {
    const cats = new Map<string, ExternalAppDefinition[]>();
    externalApps.forEach(app => {
      if (!cats.has(app.category)) cats.set(app.category, []);
      cats.get(app.category)!.push(app);
    });
    return cats;
  }, [externalApps]);
  
  const displayApps = useMemo(() => {
    if (selectedCategory) {
      return categories.get(selectedCategory) || [];
    }
    return isExpanded ? externalApps : externalApps.slice(0, 12);
  }, [externalApps, categories, selectedCategory, isExpanded]);
  
  const handleInstall = useCallback((appId: string) => {
    setInstalledApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(appId)) {
        newSet.delete(appId);
      } else {
        newSet.add(appId);
      }
      localStorage.setItem('p3_installed_apps', JSON.stringify([...newSet]));
      window.dispatchEvent(new CustomEvent('p3_apps_changed'));
      return newSet;
    });
  }, []);
  
  const handleLaunch = useCallback((app: ExternalAppDefinition) => {
    openExternalApp({
      id: app.id,
      name: app.name,
      url: app.url,
      icon: app.icon,
      gradient: app.gradient,
    });
  }, [openExternalApp]);
  
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mt-8 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Web Apps</h3>
          <span className="text-xs text-white/40 ml-2">{externalApps.length} apps available</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCategory && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(null)}
              className="text-xs text-white/60 hover:text-white"
              data-testid="button-clear-category"
            >
              Clear filter
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-cyan-400 hover:text-cyan-300"
            data-testid="button-toggle-apps"
          >
            {isExpanded ? 'Show less' : 'Show all'}
            <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {Array.from(categories.keys()).map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
            className={`text-xs capitalize ${
              selectedCategory === cat
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30'
            }`}
            data-testid={`button-category-${cat}`}
          >
            {cat} ({categories.get(cat)?.length})
          </Button>
        ))}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {displayApps.map((app, i) => (
          <MotionDiv
            key={app.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.02 }}
            className={`relative group bg-gradient-to-br ${app.gradient} p-3 rounded-xl cursor-pointer hover:scale-105 transition-transform`}
            onClick={() => handleLaunch(app)}
            data-testid={`card-external-app-${app.id}`}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-2xl">{app.icon}</span>
              <span className="text-xs font-medium text-white truncate w-full">{app.name}</span>
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInstall(app.id);
              }}
              className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                installedApps.has(app.id)
                  ? 'bg-green-500 text-white'
                  : 'bg-black/30 text-white/60 opacity-0 group-hover:opacity-100'
              }`}
              data-testid={`button-install-${app.id}`}
            >
              {installedApps.has(app.id) ? (
                <Check className="w-3 h-3" />
              ) : (
                <Plus className="w-3 h-3" />
              )}
            </button>
            
            <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </MotionDiv>
        ))}
      </div>
      
      {installedApps.size > 0 && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <p className="text-xs text-white/60 mb-2">
            <Check className="w-3 h-3 inline mr-1 text-green-400" />
            {installedApps.size} app{installedApps.size !== 1 ? 's' : ''} installed to your launcher
          </p>
        </div>
      )}
    </MotionDiv>
  );
}
