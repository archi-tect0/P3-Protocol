export interface ActivePersona {
  scope: string;
  traits: Record<string, unknown>;
  expiresAt?: string;
}

export interface SessionState {
  pinnedFlows: string[];
  pinnedEndpoints: string[];
  recentQueries: string[];
  preferences: {
    theme?: 'light' | 'dark';
    layout?: 'grid' | 'list';
    debugMode?: boolean;
  };
  lastActivity: string;
  flowHistory: Array<{
    flowId: string;
    key: string;
    status: 'success' | 'error' | 'gated';
    timestamp: string;
  }>;
  activePersona?: ActivePersona;
}

class SessionStore {
  private sessions = new Map<string, SessionState>();
  private maxHistorySize = 50;
  private maxRecentQueries = 20;

  getSession(wallet: string): SessionState {
    const existing = this.sessions.get(wallet.toLowerCase());
    if (existing) {
      if (existing.activePersona?.expiresAt && new Date(existing.activePersona.expiresAt) < new Date()) {
        existing.activePersona = undefined;
      }
      return existing;
    }
    
    const newSession: SessionState = {
      pinnedFlows: [],
      pinnedEndpoints: [],
      recentQueries: [],
      preferences: {},
      lastActivity: new Date().toISOString(),
      flowHistory: [],
    };
    this.sessions.set(wallet.toLowerCase(), newSession);
    return newSession;
  }

  updateSession(wallet: string, updates: Partial<SessionState>): SessionState {
    const session = this.getSession(wallet);
    const updated = {
      ...session,
      ...updates,
      lastActivity: new Date().toISOString(),
    };
    this.sessions.set(wallet.toLowerCase(), updated);
    return updated;
  }

  pinFlow(wallet: string, flowKey: string): SessionState {
    const session = this.getSession(wallet);
    if (!session.pinnedFlows.includes(flowKey)) {
      session.pinnedFlows.push(flowKey);
    }
    session.lastActivity = new Date().toISOString();
    return session;
  }

  unpinFlow(wallet: string, flowKey: string): SessionState {
    const session = this.getSession(wallet);
    session.pinnedFlows = session.pinnedFlows.filter(k => k !== flowKey);
    session.lastActivity = new Date().toISOString();
    return session;
  }

  pinEndpoint(wallet: string, endpointKey: string): SessionState {
    const session = this.getSession(wallet);
    if (!session.pinnedEndpoints.includes(endpointKey)) {
      session.pinnedEndpoints.push(endpointKey);
    }
    session.lastActivity = new Date().toISOString();
    return session;
  }

  unpinEndpoint(wallet: string, endpointKey: string): SessionState {
    const session = this.getSession(wallet);
    session.pinnedEndpoints = session.pinnedEndpoints.filter(k => k !== endpointKey);
    session.lastActivity = new Date().toISOString();
    return session;
  }

  addQuery(wallet: string, query: string): SessionState {
    const session = this.getSession(wallet);
    session.recentQueries = [query, ...session.recentQueries.filter(q => q !== query)].slice(0, this.maxRecentQueries);
    session.lastActivity = new Date().toISOString();
    return session;
  }

  addFlowExecution(wallet: string, flowId: string, key: string, status: 'success' | 'error' | 'gated'): SessionState {
    const session = this.getSession(wallet);
    session.flowHistory = [
      { flowId, key, status, timestamp: new Date().toISOString() },
      ...session.flowHistory,
    ].slice(0, this.maxHistorySize);
    session.lastActivity = new Date().toISOString();
    return session;
  }

  setPreference<K extends keyof SessionState['preferences']>(
    wallet: string,
    key: K,
    value: SessionState['preferences'][K]
  ): SessionState {
    const session = this.getSession(wallet);
    session.preferences[key] = value;
    session.lastActivity = new Date().toISOString();
    return session;
  }

  setDebugMode(wallet: string, enabled: boolean): SessionState {
    return this.setPreference(wallet, 'debugMode', enabled);
  }

  isDebugMode(wallet?: string): boolean {
    if (!wallet) return false;
    const session = this.sessions.get(wallet.toLowerCase());
    return session?.preferences.debugMode ?? false;
  }

  setActivePersona(wallet: string, persona: ActivePersona | null): SessionState {
    const session = this.getSession(wallet);
    session.activePersona = persona ?? undefined;
    session.lastActivity = new Date().toISOString();
    return session;
  }

  getActivePersona(wallet: string): ActivePersona | undefined {
    const session = this.getSession(wallet);
    return session.activePersona;
  }

  isPersonaExpired(wallet: string): boolean {
    const session = this.sessions.get(wallet.toLowerCase());
    if (!session?.activePersona?.expiresAt) {
      return false;
    }
    return new Date(session.activePersona.expiresAt) < new Date();
  }

  listActiveSessions(): Array<{ wallet: string; lastActivity: string; pinnedCount: number }> {
    const result: Array<{ wallet: string; lastActivity: string; pinnedCount: number }> = [];
    for (const [wallet, session] of this.sessions) {
      result.push({
        wallet,
        lastActivity: session.lastActivity,
        pinnedCount: session.pinnedFlows.length + session.pinnedEndpoints.length,
      });
    }
    return result.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
  }

  clearSession(wallet: string): void {
    this.sessions.delete(wallet.toLowerCase());
  }

  exportSession(wallet: string): SessionState | null {
    return this.sessions.get(wallet.toLowerCase()) || null;
  }

  importSession(wallet: string, state: SessionState): void {
    this.sessions.set(wallet.toLowerCase(), {
      ...state,
      lastActivity: new Date().toISOString(),
    });
  }
}

export const sessionStore = new SessionStore();
