import { create } from 'zustand';

export type ConnectorId = 'gmail' | 'reddit' | 'drive' | 'discord' | 'stripe' | 'calendar';
export type ConnectorStatus = 'disconnected' | 'connected' | 'paused' | 'error';

export interface ConnectorManifest {
  id: ConnectorId;
  title: string;
  icon: string;
  oauth: {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    redirectUri: string;
  };
  verbs: Array<{
    intent: string;
    endpoint: string;
    visual: string;
  }>;
  consent: {
    anchorWrites: boolean;
    anchorReads: boolean;
  };
  renderHints?: Record<string, any>;
}

export interface ConnectorState {
  id: ConnectorId;
  title: string;
  icon: string;
  status: ConnectorStatus;
  scopes: string[];
  lastActivity?: number;
  error?: string;
}

export interface ConnectorReceipt {
  id: string;
  hash: string;
  scope: string;
  connectorId: string;
  timestamp: number;
}

interface ConnectorStoreState {
  connectors: ConnectorState[];
  manifests: ConnectorManifest[];
  receipts: ConnectorReceipt[];
  vaultUnlocked: boolean;
  manifestsLoaded: boolean;
  
  setConnectors: (c: ConnectorState[]) => void;
  setManifests: (m: ConnectorManifest[]) => void;
  updateConnector: (id: ConnectorId, patch: Partial<ConnectorState>) => void;
  pushReceipt: (r: ConnectorReceipt) => void;
  setVaultUnlocked: (v: boolean) => void;
  loadManifests: () => Promise<void>;
}

const defaultConnectors: ConnectorState[] = [
  { id: 'gmail', title: 'Gmail', icon: '📧', status: 'disconnected', scopes: [] },
  { id: 'reddit', title: 'Reddit', icon: '🔴', status: 'disconnected', scopes: [] },
  { id: 'drive', title: 'Google Drive', icon: '📁', status: 'disconnected', scopes: [] },
  { id: 'discord', title: 'Discord', icon: '💬', status: 'disconnected', scopes: [] },
  { id: 'stripe', title: 'Stripe', icon: '💳', status: 'disconnected', scopes: [] },
  { id: 'calendar', title: 'Calendar', icon: '📅', status: 'disconnected', scopes: [] },
];

export const useConnectorStore = create<ConnectorStoreState>((set, get) => ({
  connectors: defaultConnectors,
  manifests: [],
  receipts: [],
  vaultUnlocked: false,
  manifestsLoaded: false,
  
  setConnectors: (c) => set({ connectors: c }),
  setManifests: (m) => set({ manifests: m }),
  
  updateConnector: (id, patch) => set((s) => ({
    connectors: s.connectors.map(c => c.id === id ? { ...c, ...patch } : c)
  })),
  
  pushReceipt: (r) => set((s) => ({
    receipts: [r, ...s.receipts].slice(0, 50)
  })),
  
  setVaultUnlocked: (v) => {
    if (v) {
      sessionStorage.setItem('atlas.vault.unlocked', 'true');
    } else {
      sessionStorage.removeItem('atlas.vault.unlocked');
    }
    window.dispatchEvent(new CustomEvent('atlas:vault:changed', { detail: { unlocked: v } }));
    set({ vaultUnlocked: v });
  },
  
  loadManifests: async () => {
    if (get().manifestsLoaded) return;
    
    try {
      const token = localStorage.getItem('jwt') || localStorage.getItem('sessionToken');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch('/api/atlas/manifests', { headers });
      
      if (res.ok) {
        const data = await res.json();
        const manifests = data.manifests || [];
        
        const connectorMap = new Map(defaultConnectors.map(c => [c.id, c]));
        manifests.forEach((m: ConnectorManifest) => {
          if (connectorMap.has(m.id)) {
            connectorMap.set(m.id, {
              ...connectorMap.get(m.id)!,
              title: m.title,
              icon: m.icon
            });
          }
        });
        
        set({
          manifests,
          connectors: Array.from(connectorMap.values()),
          manifestsLoaded: true
        });
      }
    } catch (err) {
      console.warn('[connectorStore] Failed to load manifests:', err);
    }
  }
}));
