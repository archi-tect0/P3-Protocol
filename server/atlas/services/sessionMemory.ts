import type { Scope } from '../types';

export interface SessionMemoryState {
  wallet: string;
  pinned: string[];
  recentFlows: string[];
  lastQueries: string[];
  preferences: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface SessionMemoryResponse {
  ok: boolean;
  session?: SessionMemoryState;
  error?: string;
  count?: number;
}

const MAX_PINNED = 20;
const MAX_FLOWS = 50;
const MAX_QUERIES = 100;

const memoryStore = new Map<string, SessionMemoryState>();

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase();
}

function cloneSession(session: SessionMemoryState): SessionMemoryState {
  return {
    wallet: session.wallet,
    pinned: [...session.pinned],
    recentFlows: [...session.recentFlows],
    lastQueries: [...session.lastQueries],
    preferences: { ...session.preferences },
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function ensureSession(wallet: string): SessionMemoryState {
  const key = normalizeWallet(wallet);
  
  if (!memoryStore.has(key)) {
    memoryStore.set(key, {
      wallet: key,
      pinned: [],
      recentFlows: [],
      lastQueries: [],
      preferences: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  
  return memoryStore.get(key)!;
}

function getAndClone(wallet: string): SessionMemoryState {
  return cloneSession(ensureSession(wallet));
}

export function getSessionMemory(wallet: string): SessionMemoryState {
  return getAndClone(wallet);
}

export function addPinned(wallet: string, appId: string): SessionMemoryState {
  const session = ensureSession(wallet);
  
  if (!session.pinned.includes(appId)) {
    session.pinned.unshift(appId);
    if (session.pinned.length > MAX_PINNED) {
      session.pinned = session.pinned.slice(0, MAX_PINNED);
    }
    session.updatedAt = Date.now();
  }
  
  return cloneSession(session);
}

export function removePinned(wallet: string, appId: string): SessionMemoryState {
  const session = ensureSession(wallet);
  
  session.pinned = session.pinned.filter(id => id !== appId);
  session.updatedAt = Date.now();
  
  return cloneSession(session);
}

export function isPinned(wallet: string, appId: string): boolean {
  const session = ensureSession(wallet);
  return session.pinned.includes(appId);
}

export function getPinnedApps(wallet: string): string[] {
  return [...ensureSession(wallet).pinned];
}

export function recordFlow(wallet: string, flowId: string): SessionMemoryState {
  const session = ensureSession(wallet);
  
  session.recentFlows = session.recentFlows.filter(f => f !== flowId);
  session.recentFlows.unshift(flowId);
  if (session.recentFlows.length > MAX_FLOWS) {
    session.recentFlows = session.recentFlows.slice(0, MAX_FLOWS);
  }
  session.updatedAt = Date.now();
  
  return cloneSession(session);
}

export function getRecentFlows(wallet: string, limit = 10): string[] {
  return [...ensureSession(wallet).recentFlows.slice(0, limit)];
}

export function recordQuery(wallet: string, query: string): SessionMemoryState {
  const session = ensureSession(wallet);
  
  const trimmed = query.trim();
  if (trimmed.length === 0) return cloneSession(session);
  
  session.lastQueries = session.lastQueries.filter(q => q !== trimmed);
  session.lastQueries.unshift(trimmed);
  if (session.lastQueries.length > MAX_QUERIES) {
    session.lastQueries = session.lastQueries.slice(0, MAX_QUERIES);
  }
  session.updatedAt = Date.now();
  
  return cloneSession(session);
}

export function getRecentQueries(wallet: string, limit = 20): string[] {
  return [...ensureSession(wallet).lastQueries.slice(0, limit)];
}

export function setPreference(wallet: string, key: string, value: any): SessionMemoryState {
  const session = ensureSession(wallet);
  
  session.preferences[key] = value;
  session.updatedAt = Date.now();
  
  return cloneSession(session);
}

export function getPreference(wallet: string, key: string): any {
  const session = ensureSession(wallet);
  return session.preferences[key];
}

export function clearHistory(wallet: string, type: 'flows' | 'queries' | 'all' = 'all'): SessionMemoryState {
  const session = ensureSession(wallet);
  
  if (type === 'flows' || type === 'all') {
    session.recentFlows = [];
  }
  
  if (type === 'queries' || type === 'all') {
    session.lastQueries = [];
  }
  
  session.updatedAt = Date.now();
  
  return cloneSession(session);
}

export function clearAllPins(wallet: string): SessionMemoryState {
  const session = ensureSession(wallet);
  
  session.pinned = [];
  session.updatedAt = Date.now();
  
  return cloneSession(session);
}

export function resetSession(wallet: string): SessionMemoryState {
  const key = normalizeWallet(wallet);
  
  memoryStore.delete(key);
  
  return getAndClone(wallet);
}

export function getMemoryStats(): {
  totalSessions: number;
  totalPins: number;
  totalFlows: number;
  totalQueries: number;
} {
  let totalPins = 0;
  let totalFlows = 0;
  let totalQueries = 0;
  
  for (const session of memoryStore.values()) {
    totalPins += session.pinned.length;
    totalFlows += session.recentFlows.length;
    totalQueries += session.lastQueries.length;
  }
  
  return {
    totalSessions: memoryStore.size,
    totalPins,
    totalFlows,
    totalQueries,
  };
}

export function hasSession(wallet: string): boolean {
  return memoryStore.has(normalizeWallet(wallet));
}

export function deleteSession(wallet: string): boolean {
  return memoryStore.delete(normalizeWallet(wallet));
}
