const CHANNEL_NAME = 'p3-mesh-session';
const MESH_STATE_KEY = 'p3.mesh.state';

export interface MeshSessionState {
  wallet: string | null;
  vaultUnlocked: boolean;
  activeApps: string[];
  connectedProxies: string[];
  lastActivity: number;
}

type MeshListener = (state: MeshSessionState) => void;

class MeshSessionBridge {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<MeshListener> = new Set();
  private state: MeshSessionState = {
    wallet: null,
    vaultUnlocked: false,
    activeApps: [],
    connectedProxies: [],
    lastActivity: Date.now()
  };

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = this.handleMessage.bind(this);
    }
    
    this.loadPersistedState();
    
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
      window.addEventListener('atlas:vault:changed', this.handleVaultChange.bind(this) as EventListener);
    }
  }

  private loadPersistedState() {
    try {
      const stored = localStorage.getItem(MESH_STATE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = { ...this.state, ...parsed };
      }
      
      const wallet = localStorage.getItem('walletAddress');
      if (wallet) {
        this.state.wallet = wallet;
      }
      
      const vaultUnlocked = sessionStorage.getItem('atlas.vault.unlocked') === 'true';
      this.state.vaultUnlocked = vaultUnlocked;
    } catch (e) {
      console.warn('[MeshSessionBridge] Failed to load persisted state:', e);
    }
  }

  private persistState() {
    try {
      localStorage.setItem(MESH_STATE_KEY, JSON.stringify({
        activeApps: this.state.activeApps,
        connectedProxies: this.state.connectedProxies,
        lastActivity: this.state.lastActivity
      }));
    } catch (e) {
      console.warn('[MeshSessionBridge] Failed to persist state:', e);
    }
  }

  private handleMessage(event: MessageEvent) {
    if (event.data?.type === 'mesh_update') {
      this.state = { ...this.state, ...event.data.state };
      this.notifyListeners();
    }
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'walletAddress') {
      this.state.wallet = event.newValue;
      this.notifyListeners();
    } else if (event.key === MESH_STATE_KEY) {
      this.loadPersistedState();
      this.notifyListeners();
    }
  }

  private handleVaultChange(event: CustomEvent) {
    this.state.vaultUnlocked = event.detail?.unlocked ?? false;
    this.broadcast();
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }

  private broadcast() {
    if (this.channel) {
      this.channel.postMessage({
        type: 'mesh_update',
        state: this.state
      });
    }
  }

  getState(): MeshSessionState {
    return { ...this.state };
  }

  setWallet(wallet: string | null) {
    this.state.wallet = wallet;
    this.state.lastActivity = Date.now();
    this.broadcast();
    this.persistState();
    this.notifyListeners();
  }

  setVaultUnlocked(unlocked: boolean) {
    this.state.vaultUnlocked = unlocked;
    this.state.lastActivity = Date.now();
    this.broadcast();
    this.notifyListeners();
  }

  addActiveApp(appId: string) {
    if (!this.state.activeApps.includes(appId)) {
      this.state.activeApps = [...this.state.activeApps, appId];
      this.state.lastActivity = Date.now();
      this.broadcast();
      this.persistState();
      this.notifyListeners();
    }
  }

  removeActiveApp(appId: string) {
    this.state.activeApps = this.state.activeApps.filter(id => id !== appId);
    this.state.lastActivity = Date.now();
    this.broadcast();
    this.persistState();
    this.notifyListeners();
  }

  addConnectedProxy(proxyId: string) {
    if (!this.state.connectedProxies.includes(proxyId)) {
      this.state.connectedProxies = [...this.state.connectedProxies, proxyId];
      this.state.lastActivity = Date.now();
      this.broadcast();
      this.persistState();
      this.notifyListeners();
    }
  }

  removeConnectedProxy(proxyId: string) {
    this.state.connectedProxies = this.state.connectedProxies.filter(id => id !== proxyId);
    this.state.lastActivity = Date.now();
    this.broadcast();
    this.persistState();
    this.notifyListeners();
  }

  subscribe(listener: MeshListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  destroy() {
    if (this.channel) {
      this.channel.close();
    }
    this.listeners.clear();
  }
}

export const meshSessionBridge = new MeshSessionBridge();

export function useMeshSession() {
  return meshSessionBridge;
}
