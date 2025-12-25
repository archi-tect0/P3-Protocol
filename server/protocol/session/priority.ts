/**
 * Session Priority Scheduler - Atlas API 2.0
 * 
 * Manages priority levels for all 8 session lanes:
 * - Access lane: HIGH priority (content decryption keys, critical access)
 * - Media lane: HIGH priority (streaming, real-time media)
 * - Manifests lane: MEDIUM-HIGH priority (content manifests, metadata)
 * - Commerce lane: MEDIUM-HIGH priority (cart, checkout, payments)
 * - Chat lane: MEDIUM-HIGH priority (real-time messaging)
 * - Receipts lane: MEDIUM priority (analytics, receipts)
 * - Notifications lane: MEDIUM priority (push notifications)
 * - Governance lane: LOW priority (votes, proposals)
 * 
 * Supports dynamic reprioritization based on focus signals.
 */

import { LaneId, LaneRegistry, ALL_LANE_IDS } from './protocol';

export type LaneType = 'access' | 'manifests' | 'receipts' | 'media' | 'commerce' | 'governance' | 'notifications' | 'chat';

export enum Priority {
  CRITICAL = 100,
  HIGH = 90,
  MEDIUM_HIGH = 80,
  MEDIUM = 50,
  LOW = 20,
  BACKGROUND = 1,
}

export interface PriorityEntry {
  sessionId: string;
  laneType: LaneType;
  laneId: LaneId;
  priority: number;
  focusBoost: number;
  lastUpdated: number;
}

export interface FocusSignal {
  sessionId: string;
  laneType: LaneType;
  isFocused: boolean;
  timestamp: number;
}

const DEFAULT_LANE_PRIORITIES: Record<LaneType, number> = {
  access: Priority.CRITICAL,
  media: Priority.HIGH,
  manifests: Priority.MEDIUM_HIGH,
  commerce: Priority.MEDIUM_HIGH,
  chat: Priority.MEDIUM_HIGH,
  receipts: Priority.MEDIUM,
  notifications: Priority.MEDIUM,
  governance: Priority.LOW,
};

const LANE_TYPE_TO_ID: Record<LaneType, LaneId> = {
  access: LaneId.ACCESS,
  manifests: LaneId.MANIFESTS,
  receipts: LaneId.RECEIPTS,
  media: LaneId.MEDIA,
  commerce: LaneId.COMMERCE,
  governance: LaneId.GOVERNANCE,
  notifications: LaneId.NOTIFICATIONS,
  chat: LaneId.CHAT,
};

const LANE_ID_TO_TYPE: Record<LaneId, LaneType> = {
  [LaneId.ACCESS]: 'access',
  [LaneId.MANIFESTS]: 'manifests',
  [LaneId.RECEIPTS]: 'receipts',
  [LaneId.MEDIA]: 'media',
  [LaneId.COMMERCE]: 'commerce',
  [LaneId.GOVERNANCE]: 'governance',
  [LaneId.NOTIFICATIONS]: 'notifications',
  [LaneId.CHAT]: 'chat',
};

export const ALL_LANE_TYPES: LaneType[] = [
  'access', 'manifests', 'receipts', 'media', 'commerce', 'governance', 'notifications', 'chat'
];

const FOCUS_BOOST = 20;
const PRIORITY_DECAY_MS = 30000;

export function laneIdToType(id: LaneId): LaneType {
  return LANE_ID_TO_TYPE[id];
}

export function laneTypeToId(type: LaneType): LaneId {
  return LANE_TYPE_TO_ID[type];
}

export class PriorityScheduler {
  private entries: Map<string, PriorityEntry> = new Map();
  private focusSignals: Map<string, FocusSignal> = new Map();

  private getEntryKey(sessionId: string, laneType: LaneType): string {
    return `${sessionId}:${laneType}`;
  }

  getBasePriority(laneType: LaneType): number {
    return DEFAULT_LANE_PRIORITIES[laneType] ?? Priority.LOW;
  }

  getBasePriorityById(laneId: LaneId): number {
    const spec = LaneRegistry[laneId];
    return spec?.priority ?? Priority.LOW;
  }

  registerSession(sessionId: string, lanes?: LaneId[]): void {
    const now = Date.now();
    const lanesToRegister = lanes || ALL_LANE_IDS;
    
    for (const laneId of lanesToRegister) {
      const laneType = laneIdToType(laneId);
      const key = this.getEntryKey(sessionId, laneType);
      this.entries.set(key, {
        sessionId,
        laneType,
        laneId,
        priority: this.getBasePriority(laneType),
        focusBoost: 0,
        lastUpdated: now,
      });
    }

    console.log(`[PriorityScheduler] Registered session: ${sessionId} with ${lanesToRegister.length} lanes`);
  }

  unregisterSession(sessionId: string): void {
    for (const laneType of ALL_LANE_TYPES) {
      const key = this.getEntryKey(sessionId, laneType);
      this.entries.delete(key);
      this.focusSignals.delete(key);
    }

    console.log(`[PriorityScheduler] Unregistered session: ${sessionId}`);
  }

  applyFocusSignal(signal: FocusSignal): void {
    const key = this.getEntryKey(signal.sessionId, signal.laneType);
    const entry = this.entries.get(key);

    if (!entry) {
      console.warn(`[PriorityScheduler] No entry found for ${key}`);
      return;
    }

    this.focusSignals.set(key, signal);

    const boostDelta = signal.isFocused ? FOCUS_BOOST : -FOCUS_BOOST;
    const newBoost = Math.max(0, Math.min(50, entry.focusBoost + boostDelta));

    entry.focusBoost = newBoost;
    entry.lastUpdated = signal.timestamp;

    console.log(`[PriorityScheduler] Focus signal applied: ${key}, boost: ${newBoost}, focused: ${signal.isFocused}`);
  }

  getEffectivePriority(sessionId: string, laneType: LaneType): number {
    const key = this.getEntryKey(sessionId, laneType);
    const entry = this.entries.get(key);

    if (!entry) {
      return this.getBasePriority(laneType);
    }

    const now = Date.now();
    const ageMs = now - entry.lastUpdated;
    const decayFactor = Math.max(0, 1 - (ageMs / PRIORITY_DECAY_MS));
    
    const effectiveBoost = entry.focusBoost * decayFactor;
    return entry.priority + effectiveBoost;
  }

  getEffectivePriorityById(sessionId: string, laneId: LaneId): number {
    return this.getEffectivePriority(sessionId, laneIdToType(laneId));
  }

  compareLanes(
    sessionId1: string,
    laneType1: LaneType,
    sessionId2: string,
    laneType2: LaneType
  ): number {
    const p1 = this.getEffectivePriority(sessionId1, laneType1);
    const p2 = this.getEffectivePriority(sessionId2, laneType2);
    return p2 - p1;
  }

  prioritizeTasks<T extends { sessionId: string; laneType: LaneType }>(tasks: T[]): T[] {
    return [...tasks].sort((a, b) => 
      this.compareLanes(a.sessionId, a.laneType, b.sessionId, b.laneType)
    );
  }

  getSessionPriorities(sessionId: string): Record<LaneType, number> {
    const priorities: Record<LaneType, number> = {} as Record<LaneType, number>;
    for (const laneType of ALL_LANE_TYPES) {
      priorities[laneType] = this.getEffectivePriority(sessionId, laneType);
    }
    return priorities;
  }

  getAllEntries(): PriorityEntry[] {
    return Array.from(this.entries.values());
  }

  getStats(): {
    totalSessions: number;
    entriesByLane: Record<LaneType, number>;
    averagePriorities: Record<LaneType, number>;
  } {
    const sessionIds = new Set(Array.from(this.entries.values()).map(e => e.sessionId));
    const entriesByLane: Record<LaneType, number> = {} as Record<LaneType, number>;
    const prioritySums: Record<LaneType, number> = {} as Record<LaneType, number>;

    for (const laneType of ALL_LANE_TYPES) {
      entriesByLane[laneType] = 0;
      prioritySums[laneType] = 0;
    }

    for (const entry of this.entries.values()) {
      entriesByLane[entry.laneType]++;
      prioritySums[entry.laneType] += this.getEffectivePriority(entry.sessionId, entry.laneType);
    }

    const averagePriorities: Record<LaneType, number> = {} as Record<LaneType, number>;
    for (const laneType of ALL_LANE_TYPES) {
      averagePriorities[laneType] = entriesByLane[laneType] > 0 
        ? prioritySums[laneType] / entriesByLane[laneType] 
        : 0;
    }

    return {
      totalSessions: sessionIds.size,
      entriesByLane,
      averagePriorities,
    };
  }

  cleanup(): void {
    const now = Date.now();
    const staleThreshold = PRIORITY_DECAY_MS * 10;

    for (const [key, entry] of this.entries.entries()) {
      if (now - entry.lastUpdated > staleThreshold) {
        this.entries.delete(key);
        this.focusSignals.delete(key);
      }
    }
  }
}

export const priorityScheduler = new PriorityScheduler();

setInterval(() => {
  priorityScheduler.cleanup();
}, 60000);

export default priorityScheduler;
