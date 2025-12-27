import { create } from 'zustand';
import type { AtlasVisualizationSettings, VisualizationTheme } from '@/components/atlas/faces/types';
import type { RadioStation } from '@/components/atlas/modes/RadioMode';

export type AtlasMode = 'idle' | 'hub' | 'feed' | 'metrics' | 'governance' | 'notes' | 'gallery' | 'messages' | 'payments' | 'connectors' | 'developer' | 'registry' | 'calls' | 'directory' | 'receipts' | 'inbox' | 'tokens' | 'tv' | 'weather' | 'ai' | 'identity' | 'notifications' | 'clipboard' | 'system' | 'math' | 'camera' | 'sandbox' | 'fileHub' | 'webBrowser' | 'writer' | 'calc' | 'orchestration' | 'gamedeck' | 'one' | 'reader' | 'pulse' | 'capability' | 'library' | 'news' | 'wikipedia' | 'node' | 'launcher' | 'chat' | 'settings' | 'cctv' | 'taskManager' | 'radio' | 'externalApp' | 'nodestream' | 'media';

export interface ExternalAppContext {
  id: string;
  name: string;
  url: string;
  icon: string;
  gradient: string;
}

export type RunningAppState = 'active' | 'playing' | 'paused' | 'background';

export interface RunningApp {
  id: string;
  mode: AtlasMode;
  name: string;
  icon: string;
  state: RunningAppState;
  metadata?: {
    title?: string;
    subtitle?: string;
    progress?: number;
    thumbnail?: string;
  };
  startedAt: number;
  supportsPip?: boolean;
}

export const DEFAULT_VISUALIZATION_SETTINGS: AtlasVisualizationSettings = {
  theme: 'line' as VisualizationTheme,
  colorPrimary: '#5CC8FF',
  colorAccent: '#00D4FF',
  glowIntensity: 0.6,
  motionLevel: 0.5,
  speakingReactive: true,
  listeningReactive: true,
};

export interface CanvasRenderable {
  key: string;
  display: {
    type: 'card' | 'table' | 'pipeline';
    title: string;
    subtitle?: string;
    fields?: Array<{ key: string; label: string; format?: string }>;
    actions?: Array<{ label: string; action?: string }>;
  };
  visibility: 'public' | 'private' | 'gated';
  type: 'endpoint' | 'flow' | 'app';
  source: string;
}
export type AtlasRole = 'user' | 'admin' | 'developer' | 'moderator';

export interface AtlasReceipt {
  id: string;
  hash: string;
  scope: string;
  endpoint: string;
  timestamp: number;
  error?: string;
  data?: any;
}

export interface AtlasSuggestion {
  id: string;
  label: string;
  intent: string;
  category: 'action' | 'query' | 'admin' | 'workflow';
}

export interface AtlasTile {
  id: string;
  title: string;
  defaultMode: AtlasMode;
  scopes: string[];
  visuals: string[];
  renderHints?: Record<string, any>;
}

export interface RenderDirective {
  mode: AtlasMode;
  payload: any;
  manifest?: AtlasTile;
  consent?: { scopes: string[]; role: AtlasRole };
}

export type OnboardingPath = 'end_user' | 'developer' | null;

export type PulseView = 'global' | 'personal';

export type TabId = 'chat' | 'canvas' | 'flows' | 'recipes' | 'settings' | 'metrics';

export interface SubstrateState {
  isVoiceActive: boolean;
  voiceLevel: number;
  typingIntensity: number;
  meshHealth: number;
  flowActivity: number;
}

export interface NodeDiagnostics {
  connectivity: {
    status: 'connected' | 'degraded' | 'offline';
    signalStrength: number;
    connectionType: string;
    latencyMs: number;
  };
  mesh: {
    participatingNodes: number;
    peersConnected: number;
    tasksCompleted: number;
    bandwidthContributed: number;
  };
  lastSync: string;
}

export interface NodeModeState {
  enabled: boolean;
  globalRelayEnabled: boolean;
  globalNodeId: string | null;
  diagnostics: NodeDiagnostics | null;
  narrative: string;
}

interface AtlasState {
  wallet: string | null;
  role: AtlasRole;
  mode: AtlasMode;
  activeTab: TabId;
  presenceActive: boolean;
  dissolving: boolean;
  receipts: AtlasReceipt[];
  suggestions: AtlasSuggestion[];
  tiles: AtlasTile[];
  renderables: CanvasRenderable[];
  renderPayload: any;
  
  composeRecipient: string | null;
  setComposeRecipient: (recipient: string | null) => void;
  openComposeFor: (recipient: string) => void;
  
  onboardingCompleted: boolean;
  onboardingPath: OnboardingPath;
  onboardingCompletedAt: number | null;
  
  visualization: AtlasVisualizationSettings;
  visualizationLoaded: boolean;
  
  pulseView: PulseView;
  
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  setWallet: (w: string | null) => void;
  setRole: (r: AtlasRole) => void;
  setMode: (m: AtlasMode) => void;
  dissolveInto: (m: AtlasMode) => void;
  returnToPresence: () => void;
  pushReceipt: (rec: AtlasReceipt) => void;
  removeReceipt: (id: string) => void;
  clearReceipts: () => void;
  setSuggestions: (s: AtlasSuggestion[]) => void;
  setTiles: (t: AtlasTile[]) => void;
  setRenderables: (r: CanvasRenderable[]) => void;
  setRenderPayload: (p: any) => void;
  
  setOnboardingComplete: (path: OnboardingPath, timestamp: number) => void;
  resetOnboarding: () => void;
  loadOnboardingState: (completed: boolean, path: OnboardingPath, completedAt: number | null) => void;
  
  setVisualization: (v: AtlasVisualizationSettings) => void;
  updateVisualization: (updates: Partial<AtlasVisualizationSettings>) => void;
  loadVisualization: (v: AtlasVisualizationSettings) => void;
  
  setPulseView: (view: PulseView) => void;
  setActiveTab: (tab: TabId) => void;
  
  substrate: SubstrateState;
  setVoiceActive: (active: boolean, level?: number) => void;
  setTypingIntensity: (intensity: number) => void;
  setMeshHealth: (health: number) => void;
  setFlowActivity: (activity: number) => void;
  pulseSubstrate: () => void;
  
  nodeMode: NodeModeState;
  setNodeModeEnabled: (enabled: boolean) => void;
  setGlobalRelayEnabled: (enabled: boolean, nodeId?: string | null) => void;
  setNodeDiagnostics: (diagnostics: NodeDiagnostics | null, narrative?: string) => void;
  
  runningApps: RunningApp[];
  addRunningApp: (app: Omit<RunningApp, 'id' | 'startedAt'>) => void;
  removeRunningApp: (id: string) => void;
  updateRunningApp: (id: string, updates: Partial<RunningApp>) => void;
  focusApp: (id: string) => void;
  closeAllApps: () => void;
  
  externalApp: ExternalAppContext | null;
  openExternalApp: (app: ExternalAppContext) => void;
  closeExternalApp: () => void;
  
  radio: {
    currentStation: RadioStation | null;
    isPlaying: boolean;
    volume: number;
    streamUrl: string | null;
  };
  setRadioStation: (station: RadioStation | null, streamUrl?: string | null) => void;
  setRadioPlaying: (playing: boolean) => void;
  setRadioVolume: (volume: number) => void;
  clearRadio: () => void;
}

export const useAtlasStore = create<AtlasState>((set) => ({
  wallet: null,
  role: 'user',
  mode: 'hub',
  activeTab: 'canvas',
  presenceActive: true,
  dissolving: false,
  receipts: [],
  suggestions: [],
  tiles: [],
  renderables: [],
  renderPayload: null,
  
  composeRecipient: null,
  setComposeRecipient: (recipient) => set({ composeRecipient: recipient }),
  openComposeFor: (recipient) => set({ composeRecipient: recipient, mode: 'messages' }),
  
  onboardingCompleted: false,
  onboardingPath: null,
  onboardingCompletedAt: null,
  
  visualization: DEFAULT_VISUALIZATION_SETTINGS,
  visualizationLoaded: false,
  
  pulseView: 'global',
  
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setWallet: (w) => set({ wallet: w }),
  setRole: (r) => set({ role: r }),
  setMode: (m) => set({ mode: m }),
  
  dissolveInto: (m) => set({ 
    dissolving: true, 
    mode: m, 
    presenceActive: false 
  }),
  
  returnToPresence: () => set({ 
    dissolving: false, 
    mode: 'hub', 
    presenceActive: true,
    renderPayload: null 
  }),
  
  pushReceipt: (rec) => set((s) => ({ 
    receipts: [rec, ...s.receipts].slice(0, 50) 
  })),
  
  removeReceipt: (id: string) => set((s) => ({
    receipts: s.receipts.filter(r => r.id !== id)
  })),
  
  clearReceipts: () => set({ receipts: [] }),
  
  setSuggestions: (s) => set({ suggestions: s }),
  setTiles: (t) => set({ tiles: t }),
  setRenderables: (r) => set({ renderables: r }),
  setRenderPayload: (p) => set({ renderPayload: p }),
  
  setOnboardingComplete: (path, timestamp) => set({
    onboardingCompleted: true,
    onboardingPath: path,
    onboardingCompletedAt: timestamp,
  }),
  
  resetOnboarding: () => set({
    onboardingCompleted: false,
    onboardingPath: null,
    onboardingCompletedAt: null,
  }),
  
  loadOnboardingState: (completed, path, completedAt) => set({
    onboardingCompleted: completed,
    onboardingPath: path,
    onboardingCompletedAt: completedAt,
  }),
  
  setVisualization: (v) => set({ visualization: v, visualizationLoaded: true }),
  updateVisualization: (updates) => set((s) => ({
    visualization: { ...s.visualization, ...updates },
    visualizationLoaded: true,
  })),
  loadVisualization: (v) => set({ visualization: v, visualizationLoaded: true }),
  
  setPulseView: (view) => set({ pulseView: view }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  substrate: {
    isVoiceActive: false,
    voiceLevel: 0,
    typingIntensity: 0,
    meshHealth: 1,
    flowActivity: 0,
  },
  
  setVoiceActive: (active, level = 0) => set((s) => ({
    substrate: { ...s.substrate, isVoiceActive: active, voiceLevel: level }
  })),
  
  setTypingIntensity: (intensity) => set((s) => ({
    substrate: { ...s.substrate, typingIntensity: Math.min(1, Math.max(0, intensity)) }
  })),
  
  setMeshHealth: (health) => set((s) => ({
    substrate: { ...s.substrate, meshHealth: Math.min(1, Math.max(0, health)) }
  })),
  
  setFlowActivity: (activity) => set((s) => ({
    substrate: { ...s.substrate, flowActivity: Math.min(1, Math.max(0, activity)) }
  })),
  
  pulseSubstrate: () => set((s) => ({
    substrate: { ...s.substrate, flowActivity: Math.min(1, s.substrate.flowActivity + 0.3) }
  })),
  
  nodeMode: {
    enabled: true,
    globalRelayEnabled: false,
    globalNodeId: null,
    diagnostics: null,
    narrative: 'Node Mode is active by default to help Atlas monitor and stabilize your connection.',
  },
  
  setNodeModeEnabled: (enabled) => set((s) => ({
    nodeMode: { ...s.nodeMode, enabled }
  })),
  
  setGlobalRelayEnabled: (enabled, nodeId = null) => set((s) => ({
    nodeMode: { ...s.nodeMode, globalRelayEnabled: enabled, globalNodeId: nodeId }
  })),
  
  setNodeDiagnostics: (diagnostics, narrative) => set((s) => ({
    nodeMode: { 
      ...s.nodeMode, 
      diagnostics, 
      narrative: narrative || s.nodeMode.narrative 
    }
  })),
  
  runningApps: [],
  
  addRunningApp: (app) => set((s) => {
    const existing = s.runningApps.find(a => a.mode === app.mode);
    if (existing) {
      return {
        runningApps: s.runningApps.map(a => 
          a.id === existing.id ? { ...a, state: 'active' as RunningAppState, metadata: app.metadata || a.metadata } : a
        )
      };
    }
    const newApp: RunningApp = {
      ...app,
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      startedAt: Date.now(),
    };
    return { runningApps: [...s.runningApps, newApp] };
  }),
  
  removeRunningApp: (id) => set((s) => ({
    runningApps: s.runningApps.filter(a => a.id !== id)
  })),
  
  updateRunningApp: (id, updates) => set((s) => ({
    runningApps: s.runningApps.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  
  focusApp: (id) => set((s) => {
    const app = s.runningApps.find(a => a.id === id);
    if (!app) return {};
    return {
      mode: app.mode,
      runningApps: s.runningApps.map(a => ({
        ...a,
        state: a.id === id ? 'active' as RunningAppState : (a.state === 'active' ? 'background' as RunningAppState : a.state)
      }))
    };
  }),
  
  closeAllApps: () => set({ runningApps: [] }),
  
  externalApp: null,
  
  openExternalApp: (app) => set({ 
    externalApp: app, 
    mode: 'externalApp' 
  }),
  
  closeExternalApp: () => set({ 
    externalApp: null, 
    mode: 'hub' 
  }),
  
  radio: {
    currentStation: null,
    isPlaying: false,
    volume: 80,
    streamUrl: null,
  },
  setRadioStation: (station, streamUrl = null) => set((s) => ({ 
    radio: { ...s.radio, currentStation: station, streamUrl: streamUrl ?? s.radio.streamUrl } 
  })),
  setRadioPlaying: (playing) => set((s) => ({ radio: { ...s.radio, isPlaying: playing } })),
  setRadioVolume: (volume) => set((s) => ({ radio: { ...s.radio, volume } })),
  clearRadio: () => set((s) => ({ 
    radio: { ...s.radio, currentStation: null, isPlaying: false, streamUrl: null } 
  })),
}));
