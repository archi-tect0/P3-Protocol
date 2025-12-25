import { useCallback, useMemo, lazy, Suspense, useEffect, useRef } from 'react';
import { useAtlasStore } from '@/state/useAtlasStore';
import { MotionDiv, AnimatePresence, MotionButton } from '@/lib/motion';
import { Loader2, ArrowLeft, Menu, Radio, Pause, Play, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { radioAudioManager } from '@/lib/radioAudioManager';

const prefetchHubMode = () => import('./modes/HubMode');
const prefetchChatMode = () => import('./modes/ChatMode');
const prefetchNewsMode = () => import('./modes/NewsMode');
const prefetchMessagesMode = () => import('./modes/MessagesMode');
const prefetchTVMode = () => import('./modes/TVMode');

const HubMode = lazy(prefetchHubMode);
const ChatMode = lazy(prefetchChatMode);
const NewsMode = lazy(prefetchNewsMode);
const MessagesMode = lazy(prefetchMessagesMode);
const TVMode = lazy(prefetchTVMode);

const FeedMode = lazy(() => import('./modes/FeedMode'));
const MetricsMode = lazy(() => import('./modes/MetricsMode'));
const GovernanceMode = lazy(() => import('./modes/GovernanceMode'));
const NotesMode = lazy(() => import('./modes/NotesMode'));
const GalleryMode = lazy(() => import('./modes/GalleryMode'));
const PaymentsMode = lazy(() => import('./modes/PaymentsMode'));
const RegistryMode = lazy(() => import('./modes/RegistryMode'));
const CallsMode = lazy(() => import('./modes/CallsMode'));
const DirectoryMode = lazy(() => import('./modes/DirectoryMode'));
const ReceiptsMode = lazy(() => import('./modes/ReceiptsMode'));
const InboxMode = lazy(() => import('./modes/InboxMode'));
const TokensMode = lazy(() => import('./modes/TokensMode'));
const WeatherMode = lazy(() => import('./modes/WeatherMode'));
const AIChatMode = lazy(() => import('./modes/AIChatMode'));
const IdentityMode = lazy(() => import('./modes/IdentityMode'));
const NotificationsMode = lazy(() => import('./modes/NotificationsMode'));
const ClipboardMode = lazy(() => import('./modes/ClipboardMode'));
const SystemMonitorMode = lazy(() => import('./modes/SystemMonitorMode'));
const MathMode = lazy(() => import('./modes/MathMode'));
const CameraMode = lazy(() => import('./modes/CameraMode'));
const SandboxMode = lazy(() => import('./modes/SandboxMode'));
const FileHubMode = lazy(() => import('./modes/FileHubMode'));
const WebBrowserMode = lazy(() => import('./modes/WebBrowserMode'));
const WriterMode = lazy(() => import('./modes/WriterMode'));
const CalcMode = lazy(() => import('./modes/CalcMode'));
const OrchestrationMode = lazy(() => import('./modes/OrchestrationMode'));
const GameDeckMode = lazy(() => import('./modes/GameDeckMode'));
const ReaderMode = lazy(() => import('./modes/ReaderMode'));
const AtlasOneMode = lazy(() => import('./modes/AtlasOneMode'));
const PulseMode = lazy(() => import('./modes/PulseMode'));
const CapabilityMode = lazy(() => import('./modes/CapabilityMode'));
const LibraryMode = lazy(() => import('./modes/LibraryMode'));
const WikipediaMode = lazy(() => import('./modes/WikipediaMode'));
const NodeMode = lazy(() => import('./modes/NodeMode'));
const LauncherMode = lazy(() => import('./modes/LauncherMode'));
const SettingsMode = lazy(() => import('./modes/SettingsMode'));
const CCTVMode = lazy(() => import('./modes/CCTVMode'));
const RadioMode = lazy(() => import('./modes/RadioMode'));
const TaskManagerMode = lazy(() => import('./modes/TaskManagerMode'));
const ExternalAppMode = lazy(() => import('./modes/ExternalAppMode'));
const NodeStreamMode = lazy(() => import('./modes/NodeStreamMode'));
const ControlPanel = lazy(() => import('./ControlPanel'));
const DeveloperSettings = lazy(() => import('./DeveloperSettings'));

function ModeLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
    </div>
  );
}

function CanvasParticleField({ isActive }: { isActive: boolean }) {
  const substrate = useAtlasStore((s) => s.substrate);
  const { isVoiceActive, typingIntensity, flowActivity } = substrate;
  
  const particles = useMemo(() => 
    [...Array(20)].map((_, i) => ({
      id: i,
      initialX: Math.random() * 100,
      initialY: Math.random() * 100,
      targetX: Math.random() * 100,
      targetY: Math.random() * 100,
      baseDuration: 15 + Math.random() * 10,
      delay: Math.random() * 5,
      size: 1.5 + Math.random() * 1.5,
      baseOpacity: 0.15 + Math.random() * 0.2,
    })), 
  []);

  const activeColor = useMemo(() => {
    if (isVoiceActive) return 'from-pink-400/70 to-purple-500/70';
    if (typingIntensity > 0.3) return 'from-cyan-300/70 to-blue-500/70';
    if (flowActivity > 0.2) return 'from-green-400/60 to-emerald-500/60';
    return 'from-cyan-400/60 to-purple-500/60';
  }, [isVoiceActive, typingIntensity, flowActivity]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" data-testid="canvas-particle-field">
      {particles.map((p) => (
        <MotionDiv
          key={p.id}
          className={`absolute rounded-full bg-gradient-to-br ${activeColor}`}
          style={{ width: p.size, height: p.size, willChange: 'transform, opacity' }}
          initial={{
            x: `${p.initialX}vw`,
            y: `${p.initialY}vh`,
            opacity: 0,
          }}
          animate={{
            x: [`${p.initialX}vw`, `${p.targetX}vw`, `${p.initialX}vw`],
            y: [`${p.initialY}vh`, `${p.targetY}vh`, `${p.initialY}vh`],
            opacity: [0, p.baseOpacity, 0],
          }}
          transition={{
            duration: p.baseDuration,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

function useMeshHealth() {
  const setMeshHealth = useAtlasStore((s) => s.setMeshHealth);
  
  useQuery({
    queryKey: ['/api/atlas/pulse'],
    refetchInterval: 60000,
    staleTime: 30000,
    gcTime: 60000,
    refetchOnWindowFocus: false,
    select: (data: any) => {
      if (data?.ok) {
        const uptime = data.metrics?.uptime || 0;
        const liveUsers = data.metrics?.liveUsers || 0;
        const health = Math.min(1, 0.5 + (uptime > 0 ? 0.3 : 0) + (liveUsers > 0 ? 0.2 : 0));
        setMeshHealth(health);
      }
      return data;
    }
  });
}

function GlobalRadioPlayer() {
  const mode = useAtlasStore((s) => s.mode);
  const radio = useAtlasStore((s) => s.radio);
  const prevModeRef = useRef<string | null>(null);
  const wasPlayingRef = useRef<boolean>(false);
  
  useEffect(() => {
    const wasInRadioMode = prevModeRef.current === 'radio';
    prevModeRef.current = mode;
    
    if (mode === 'radio') {
      wasPlayingRef.current = radio.isPlaying;
      return;
    }
    
    const shouldBePlaying = radio.isPlaying || (wasInRadioMode && wasPlayingRef.current);
    
    if (radio.currentStation && shouldBePlaying) {
      radioAudioManager.setVolume(radio.volume);
      
      if (!radioAudioManager.isPlaying()) {
        const streamUrl = radio.streamUrl || `/api/atlas/streaming/v2/stream/${radio.currentStation.id}`;
        // Audio events will update store state (playing/pause events)
        radioAudioManager.play(radio.currentStation, streamUrl).catch(() => {});
      }
    } else if (!shouldBePlaying && radioAudioManager.isPlaying()) {
      // Audio events will update store state
      radioAudioManager.pause();
    }
  }, [mode, radio.currentStation, radio.isPlaying, radio.volume, radio.streamUrl]);
  
  return null;
}

function MiniNowPlayingBar() {
  const mode = useAtlasStore((s) => s.mode);
  const radio = useAtlasStore((s) => s.radio);
  const setMode = useAtlasStore((s) => s.setMode);
  const clearRadio = useAtlasStore((s) => s.clearRadio);
  
  // Show mini player when there's a station selected (regardless of playing state)
  if (mode === 'radio' || !radio.currentStation) return null;
  
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (radio.isPlaying) {
      // Audio pause event will update store state
      radioAudioManager.pause();
    } else {
      // Audio playing event will update store state
      const streamUrl = radio.streamUrl || `/api/atlas/streaming/v2/stream/${radio.currentStation!.id}`;
      radioAudioManager.play(radio.currentStation!, streamUrl).catch(() => {});
    }
  };
  
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    radioAudioManager.pause();
    clearRadio();
  };
  
  return (
    <div 
      className="fixed bottom-20 left-6 right-24 z-40 p-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 backdrop-blur-sm cursor-pointer"
      onClick={() => setMode('radio')}
      data-testid="mini-now-playing"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-pink-500/20">
          <Radio className="w-4 h-4 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{radio.currentStation.name}</p>
          <p className="text-xs text-white/60 truncate">{radio.currentStation.genre}</p>
        </div>
        <button 
          onClick={handleTogglePlay}
          className="p-1.5 rounded-full hover:bg-white/10"
          data-testid="button-mini-toggle"
        >
          {radio.isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white" />
          )}
        </button>
        <button 
          onClick={handleClose}
          className="p-1.5 rounded-full hover:bg-white/10"
          data-testid="button-mini-close"
        >
          <X className="w-4 h-4 text-white/60 hover:text-white" />
        </button>
      </div>
    </div>
  );
}

export default function AtlasCanvas() {
  const mode = useAtlasStore((s) => s.mode);
  const returnToPresence = useAtlasStore((s) => s.returnToPresence);
  
  useEffect(() => {
    prefetchHubMode();
    prefetchChatMode();
    prefetchNewsMode();
    prefetchMessagesMode();
    prefetchTVMode();
  }, []);
  
  useMeshHealth();

  const renderMode = useCallback(() => {
    switch (mode) {
      case 'hub': return <HubMode />;
      case 'feed': return <FeedMode />;
      case 'metrics': return <MetricsMode />;
      case 'governance': return <GovernanceMode />;
      case 'notes': return <NotesMode />;
      case 'gallery': return <GalleryMode />;
      case 'messages': return <MessagesMode />;
      case 'payments': return <PaymentsMode />;
      case 'registry': return <RegistryMode />;
      case 'calls': return <CallsMode />;
      case 'directory': return <DirectoryMode />;
      case 'receipts': return <ReceiptsMode />;
      case 'inbox': return <InboxMode />;
      case 'tokens': return <TokensMode />;
      case 'tv': return <TVMode />;
      case 'weather': return <WeatherMode />;
      case 'ai': return <AIChatMode />;
      case 'identity': return <IdentityMode />;
      case 'notifications': return <NotificationsMode />;
      case 'clipboard': return <ClipboardMode />;
      case 'system': return <SystemMonitorMode />;
      case 'math': return <MathMode />;
      case 'camera': return <CameraMode />;
      case 'sandbox': return <SandboxMode />;
      case 'fileHub': return <FileHubMode />;
      case 'webBrowser': return <WebBrowserMode />;
      case 'writer': return <WriterMode />;
      case 'calc': return <CalcMode />;
      case 'orchestration': return <OrchestrationMode />;
      case 'gamedeck': return <GameDeckMode />;
      case 'one': return <AtlasOneMode />;
      case 'reader': return <ReaderMode />;
      case 'pulse': return <PulseMode />;
      case 'capability': return <CapabilityMode />;
      case 'library': return <LibraryMode />;
      case 'news': return <NewsMode />;
      case 'wikipedia': return <WikipediaMode />;
      case 'node': return <NodeMode />;
      case 'launcher': return <LauncherMode />;
      case 'chat': return <ChatMode />;
      case 'settings': return <SettingsMode />;
      case 'cctv': return <CCTVMode />;
      case 'radio': return <RadioMode />;
      case 'taskManager': return <TaskManagerMode />;
      case 'externalApp': return <ExternalAppMode />;
      case 'nodestream': return <NodeStreamMode />;
      case 'connectors': return <ControlPanel />;
      case 'developer': return <DeveloperSettings />;
      default: return <IdleSurface />;
    }
  }, [mode]);

  const isInMode = mode !== null && mode !== 'idle';
  const showBackButton = isInMode && mode !== 'hub';

  return (
    <div 
      className="relative flex flex-col flex-1 h-full overflow-hidden z-10"
      data-testid="atlas-canvas"
    >
      <CanvasParticleField isActive={!isInMode} />
      
      <div className="relative z-10 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <MotionDiv
            key={mode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="h-full"
          >
            <Suspense fallback={<ModeLoader />}>
              {renderMode()}
            </Suspense>
          </MotionDiv>
        </AnimatePresence>
      </div>

      {showBackButton && (
        <MotionButton
          onClick={returnToPresence}
          className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          data-testid="button-back"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </MotionButton>
      )}

      <MenuFAB />
      <GlobalRadioPlayer />
      <MiniNowPlayingBar />
    </div>
  );
}

function IdleSurface() {
  const dissolveInto = useAtlasStore((s) => s.dissolveInto);
  const wallet = useAtlasStore((s) => s.wallet);
  
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] px-4" data-testid="idle-surface">
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        <div className="relative mb-8">
          <MotionDiv
            className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center backdrop-blur-sm"
            animate={{ 
              boxShadow: [
                '0 0 30px rgba(0,212,255,0.2)',
                '0 0 50px rgba(168,85,247,0.2)',
                '0 0 30px rgba(0,212,255,0.2)'
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-5xl">🌐</span>
          </MotionDiv>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">
          Atlas
        </h1>
        <p className="text-lg text-white/60 mb-8">
          {wallet ? 'Your mesh OS awaits' : 'Connect wallet to begin'}
        </p>
        
        <div className="flex flex-wrap justify-center gap-3">
          <MotionButton
            onClick={() => dissolveInto('hub')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-enter-hub"
          >
            Enter Hub
          </MotionButton>
          <MotionButton
            onClick={() => dissolveInto('chat')}
            className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium"
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.15)' }}
            whileTap={{ scale: 0.95 }}
            data-testid="button-start-chat"
          >
            Start Chat
          </MotionButton>
        </div>
      </MotionDiv>
    </div>
  );
}

function MenuFAB() {
  const sidebarOpen = useAtlasStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAtlasStore((s) => s.setSidebarOpen);
  
  return (
    <MotionButton
      onClick={() => setSidebarOpen(!sidebarOpen)}
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid="button-menu"
    >
      <Menu className="w-6 h-6 text-white" />
    </MotionButton>
  );
}
