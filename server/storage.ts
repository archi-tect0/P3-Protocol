import { randomUUID } from "crypto";
import type {
  User,
  InsertUser,
  Receipt,
  InsertReceipt,
  AuditLog,
  InsertAuditLog,
  LedgerEvent,
  InsertLedgerEvent,
  Allocation,
  InsertAllocation,
  TelemetryEvent,
  InsertTelemetryEvent,
  WalletRegistry,
  InsertWalletRegistry,
  CallSession,
  InsertCallSession,
  TelemetryVoice,
  InsertTelemetryVoice,
  TrustConfig,
  InsertTrustConfig,
  TrustRule,
  InsertTrustRule,
  TrustPlugin,
  InsertTrustPlugin,
  BridgeJob,
  InsertBridgeJob,
  Message,
  InsertMessage,
  Note,
  InsertNote,
  DirectoryEntry,
  InsertDirectoryEntry,
  InboxItem,
  InsertInboxItem,
  PaymentTransaction,
  InsertPaymentTransaction,
  InstallToken,
  InsertInstallToken,
  Payment,
  InsertPayment,
  AddressIndex,
  InsertAddressIndex,
  QuarantineItem,
  InsertQuarantineItem,
  VaultCredential,
  InsertVaultCredential,
  WalletProfile,
  InsertWalletProfile,
  AtlasEndpoint,
  InsertAtlasEndpoint,
  ApiRequestMetrics,
  InsertApiRequestMetrics,
  WalletPin,
  InsertWalletPin,
  PushSubscription,
  InsertPushSubscription,
} from "@shared/schema";

/**
 * Metrics interfaces for telemetry aggregation
 */
export interface LiveUserMetrics {
  activeUsers: number;
  sessions: number;
}

export interface GeoMetrics {
  region: string;
  count: number;
}

export interface FunnelMetrics {
  step: string;
  count: number;
  conversionRate: number;
}

export interface DeviceMetrics {
  device: string;
  count: number;
}

export interface FraudMetrics {
  averageFraudScore: number;
  highRiskSessions: number;
}

/**
 * IStorage interface - defines all storage operations for the P3 Protocol
 */
export interface IStorage {
  // Health check
  ping(): Promise<boolean>;

  // User operations
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;

  // Receipt operations
  createReceipt(data: InsertReceipt): Promise<Receipt>;
  getReceipt(id: string): Promise<Receipt | null>;
  listReceipts(filters?: { type?: string; subjectId?: string }): Promise<Receipt[]>;
  verifyReceipt(id: string): Promise<boolean>;

  // Ledger operations
  createLedgerEvent(data: InsertLedgerEvent): Promise<LedgerEvent>;
  getLedgerEvents(filters?: { chainId?: string; direction?: string }): Promise<LedgerEvent[]>;
  createAllocation(data: InsertAllocation): Promise<Allocation>;
  getAllocations(ledgerEventId?: string): Promise<Allocation[]>;

  // Telemetry operations
  recordTelemetryEvent(data: InsertTelemetryEvent): Promise<TelemetryEvent>;
  getMetrics(): Promise<{
    liveUsers: LiveUserMetrics;
    geo: GeoMetrics[];
    funnel: FunnelMetrics[];
    devices: DeviceMetrics[];
    fraud: FraudMetrics;
  }>;

  // Page Analytics operations
  recordPageView(data: {
    route: string;
    referrer?: string;
    userAgent?: string;
    deviceType?: string;
    browser?: string;
    country?: string;
    hashedIp: string;
    sessionId?: string;
    walletAddress?: string;
  }): Promise<void>;
  updatePageViewCountry(hashedIp: string, country: string): Promise<void>;
  getPageAnalytics(range?: '24h' | '7d' | '30d'): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    topPages: { route: string; views: number }[];
    topReferrers: { referrer: string; views: number }[];
    topDevices: { device: string; views: number }[];
    topBrowsers: { browser: string; views: number }[];
  }>;

  // Audit operations
  appendAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLog(filters?: { entityType?: string; entityId?: string }): Promise<AuditLog[]>;

  // Wallet registry operations
  getWalletRegistry(): Promise<WalletRegistry[]>;
  setPreferredWallet(userId: string, walletId: string): Promise<void>;
  getPreferredWallet(userId: string): Promise<string | null>;

  // Voice call operations
  createCallSession(data: InsertCallSession): Promise<CallSession>;
  updateCallSession(id: string, data: Partial<InsertCallSession>): Promise<CallSession>;
  getCallSession(id: string): Promise<CallSession | null>;
  getCallSessionByRoomId(roomId: string): Promise<CallSession | null>;
  listCallSessions(roomId?: string): Promise<CallSession[]>;
  
  // Voice telemetry operations
  recordVoiceTelemetry(data: InsertTelemetryVoice): Promise<TelemetryVoice>;
  getVoiceTelemetry(filters?: { roomHash?: string; sessionId?: string }): Promise<TelemetryVoice[]>;

  // Trust Config operations
  getTrustConfig(key?: string): Promise<TrustConfig[]>;
  createTrustConfig(data: InsertTrustConfig): Promise<TrustConfig>;
  updateTrustConfig(key: string, value: any, userId: string): Promise<TrustConfig>;

  // Trust Rules operations
  getTrustRules(filters?: { status?: string }): Promise<TrustRule[]>;
  getTrustRule(id: string): Promise<TrustRule | null>;
  createTrustRule(data: InsertTrustRule): Promise<TrustRule>;
  updateTrustRule(id: string, data: Partial<InsertTrustRule>): Promise<TrustRule>;
  incrementRuleExecution(id: string): Promise<void>;

  // Trust Plugin operations
  getTrustPlugins(filters?: { status?: string }): Promise<TrustPlugin[]>;
  getTrustPlugin(id: string): Promise<TrustPlugin | null>;
  createTrustPlugin(data: InsertTrustPlugin): Promise<TrustPlugin>;
  updateTrustPlugin(id: string, data: Partial<InsertTrustPlugin>): Promise<TrustPlugin>;

  // User management operations
  listUsers(): Promise<User[]>;
  updateUserRole(id: string, role: 'admin' | 'viewer'): Promise<User>;
  deleteUser(id: string): Promise<void>;

  // Bridge operations
  createBridgeJob(data: InsertBridgeJob): Promise<BridgeJob>;
  getBridgeJob(id: string): Promise<BridgeJob | null>;
  getBridgeJobsByDocHash(docHash: string): Promise<BridgeJob[]>;
  getBridgeJobsByReceipt(receiptId: string): Promise<BridgeJob[]>;
  updateBridgeJob(id: string, data: Partial<InsertBridgeJob>): Promise<BridgeJob>;
  listBridgeJobs(filters?: { status?: string; targetChain?: string }): Promise<BridgeJob[]>;
  getReceiptByHash(hash: string): Promise<Receipt | null>;

  // Message operations
  createMessage(data: InsertMessage): Promise<Message>;
  getMessage(id: string): Promise<Message | null>;
  listMessages(filters?: { fromWallet?: string; toWallet?: string; walletAddress?: string }): Promise<Message[]>;
  updateMessageStatus(id: string, status: string, timestamp?: Date): Promise<Message>;
  updateMessageAnchor(id: string, anchorTxHash: string, anchorStatus: string, anchorTimestamp: Date): Promise<Message>;

  // Note operations
  createNote(data: InsertNote): Promise<Note>;
  getNote(id: string): Promise<Note | null>;
  listNotes(filters?: { walletAddress?: string; searchQuery?: string }): Promise<Note[]>;
  updateNote(id: string, data: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  updateNoteAnchor(id: string, anchorTxHash: string, anchorStatus: string, anchorTimestamp: Date): Promise<Note>;

  // Directory operations
  createOrUpdateDirectoryEntry(data: any): Promise<any>;
  getDirectoryEntry(walletAddress: string): Promise<any | null>;
  listDirectoryEntries(filters?: { searchQuery?: string; isVerified?: boolean }): Promise<any[]>;

  // Inbox operations
  createInboxItem(data: any): Promise<any>;
  getInboxItem(id: string): Promise<any | null>;
  listInboxItems(filters?: { walletAddress?: string; status?: string }): Promise<any[]>;
  updateInboxItem(id: string, data: Partial<any>): Promise<any>;
  bulkUpdateInboxItems(ids: string[], data: Partial<any>): Promise<void>;
  bulkDeleteInboxItems(ids: string[]): Promise<void>;

  // DAO Proposal operations
  createDaoProposal(data: any): Promise<any>;
  getDaoProposal(id: string): Promise<any | null>;
  getDaoProposalByProposalId(proposalId: string): Promise<any | null>;
  listDaoProposals(filters?: { status?: string; proposer?: string }): Promise<any[]>;
  updateDaoProposal(id: string, data: Partial<any>): Promise<any>;

  // Payment Transaction operations
  createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  getPaymentTransaction(id: string): Promise<PaymentTransaction | null>;
  listPaymentTransactions(filters?: { fromAddress?: string; toAddress?: string; status?: string; asset?: string }): Promise<PaymentTransaction[]>;
  updatePaymentTransaction(id: string, data: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction>;
  estimateGas(asset: string, amount: string): Promise<{ gasEstimate: string; gasFee: string }>;

  // Install Token operations (Session Bridge)
  createInstallToken(data: InsertInstallToken): Promise<InstallToken>;
  getInstallToken(token: string): Promise<InstallToken | null>;
  consumeInstallToken(token: string): Promise<void>;
  updateInstallTokenWallet(token: string, walletAddress: string): Promise<void>;
  cleanupExpiredInstallTokens(): Promise<void>;

  // Payment operations (Phase 1 Stream A)
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPaymentByTxHash(txHash: string): Promise<Payment | undefined>;
  getPaymentsByAddress(address: string): Promise<Payment[]>;
  updatePaymentStatus(txHash: string, status: string, blockNumber?: number, gasUsed?: string): Promise<Payment | undefined>;
  upsertAddressIndex(address: string, chainId: number): Promise<void>;

  // Quarantine operations
  getQuarantinedItems(): Promise<QuarantineItem[]>;
  createQuarantineItem(data: InsertQuarantineItem): Promise<QuarantineItem>;
  releaseQuarantinedItem(id: string, releasedBy: string): Promise<QuarantineItem | null>;
  deleteQuarantinedItem(id: string): Promise<void>;

  // Vault Credential operations (encrypted OAuth tokens and API keys)
  saveVaultCredential(data: InsertVaultCredential): Promise<VaultCredential>;
  getVaultCredential(walletAddr: string, provider: string, scope: string): Promise<VaultCredential | null>;
  deleteVaultCredential(walletAddr: string, provider: string, scope: string): Promise<boolean>;
  listVaultCredentials(walletAddr: string): Promise<VaultCredential[]>;

  // Wallet Profile operations (unified wallet-scoped personalization)
  getWalletProfile(wallet: string): Promise<WalletProfile | null>;
  upsertWalletProfile(data: Partial<InsertWalletProfile> & { wallet: string }): Promise<WalletProfile>;

  // Atlas Endpoints operations
  createAtlasEndpoint(data: InsertAtlasEndpoint): Promise<AtlasEndpoint>;
  getAtlasEndpointsByWallet(walletAddress: string): Promise<AtlasEndpoint[]>;
  getAtlasEndpoint(id: string): Promise<AtlasEndpoint | null>;
  updateAtlasEndpoint(id: string, data: Partial<InsertAtlasEndpoint>): Promise<AtlasEndpoint | null>;
  deleteAtlasEndpoint(id: string): Promise<boolean>;

  // API Request Metrics operations
  recordApiRequestMetrics(data: InsertApiRequestMetrics): Promise<ApiRequestMetrics>;

  // Wallet PIN operations (SIWE fallback)
  getWalletPin(walletAddress: string): Promise<WalletPin | null>;
  createWalletPin(data: InsertWalletPin): Promise<WalletPin>;
  updateWalletPin(walletAddress: string, data: Partial<WalletPin>): Promise<WalletPin | null>;
  incrementPinFailedAttempts(walletAddress: string): Promise<{ failedAttempts: number; lockedUntil: Date | null } | null>;
  resetPinFailedAttempts(walletAddress: string): Promise<void>;

  // Push Subscription operations
  createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription>;
  getPushSubscription(endpoint: string): Promise<PushSubscription | null>;
  getPushSubscriptionsByWallet(walletAddress: string): Promise<PushSubscription[]>;
  deletePushSubscription(endpoint: string): Promise<boolean>;
  deletePushSubscriptionsByWallet(walletAddress: string): Promise<number>;

  // Cleanup operations
  close(): Promise<void>;
}

/**
 * MemStorage - In-memory implementation of IStorage
 * 
 * Uses Map<string, T> for each entity type for O(1) lookups
 * Includes immutableSeq counters for receipts and ledger events
 * Content hashing is handled by the service layer
 */
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private receipts: Map<string, Receipt>;
  private auditLogs: Map<string, AuditLog>;
  private ledgerEvents: Map<string, LedgerEvent>;
  private allocations: Map<string, Allocation>;
  private telemetryEvents: Map<string, TelemetryEvent>;
  private walletRegistries: Map<string, WalletRegistry>;
  private userPreferredWallets: Map<string, string>;
  private callSessions: Map<string, CallSession>;
  private voiceTelemetry: Map<string, TelemetryVoice>;
  private bridgeJobs: Map<string, BridgeJob>;
  private paymentTransactions: Map<string, PaymentTransaction>;
  private payments: Map<number, Payment>;
  private addressIndexMap: Map<string, AddressIndex>;
  private atlasEndpointsMap: Map<string, AtlasEndpoint>;

  private receiptSeqCounter: number;
  private ledgerSeqCounter: number;
  private callSessionSeqCounter: number;
  private paymentIdCounter: number;
  private addressIndexIdCounter: number;

  constructor() {
    this.users = new Map();
    this.receipts = new Map();
    this.auditLogs = new Map();
    this.ledgerEvents = new Map();
    this.allocations = new Map();
    this.telemetryEvents = new Map();
    this.walletRegistries = new Map();
    this.userPreferredWallets = new Map();
    this.callSessions = new Map();
    this.voiceTelemetry = new Map();
    this.bridgeJobs = new Map();
    this.paymentTransactions = new Map();
    this.payments = new Map();
    this.addressIndexMap = new Map();
    this.atlasEndpointsMap = new Map();

    this.receiptSeqCounter = 0;
    this.ledgerSeqCounter = 0;
    this.callSessionSeqCounter = 0;
    this.paymentIdCounter = 0;
    this.addressIndexIdCounter = 0;
  }

  /**
   * Health check ping - always returns true for in-memory storage
   */
  async ping(): Promise<boolean> {
    return true;
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async createUser(data: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role || "viewer",
      createdAt: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.users = new Map(this.users).set(id, user);

    return user;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  // ============================================================================
  // Receipt Operations
  // ============================================================================

  async createReceipt(data: InsertReceipt): Promise<Receipt> {
    const id = randomUUID();
    
    // Increment immutableSeq counter for this receipt
    this.receiptSeqCounter++;
    
    const receipt: Receipt = {
      id,
      type: data.type,
      subjectId: data.subjectId,
      contentHash: data.contentHash,
      proofBlob: data.proofBlob,
      createdBy: data.createdBy,
      immutableSeq: this.receiptSeqCounter,
      createdAt: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.receipts = new Map(this.receipts).set(id, receipt);

    return receipt;
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    return this.receipts.get(id) || null;
  }

  async listReceipts(filters?: { type?: string; subjectId?: string }): Promise<Receipt[]> {
    let results = Array.from(this.receipts.values());

    if (filters?.type) {
      results = results.filter(r => r.type === filters.type);
    }

    if (filters?.subjectId) {
      results = results.filter(r => r.subjectId === filters.subjectId);
    }

    // Sort by immutableSeq descending (newest first)
    return results.sort((a, b) => b.immutableSeq - a.immutableSeq);
  }

  async verifyReceipt(id: string): Promise<boolean> {
    const receipt = this.receipts.get(id);
    if (!receipt) {
      return false;
    }

    // Verify receipt exists and has valid structure
    return !!(receipt.contentHash && receipt.proofBlob && receipt.immutableSeq);
  }

  // ============================================================================
  // Ledger Operations
  // ============================================================================

  async createLedgerEvent(data: InsertLedgerEvent): Promise<LedgerEvent> {
    const id = randomUUID();
    
    // Increment immutableSeq counter for this ledger event
    this.ledgerSeqCounter++;

    const ledgerEvent: LedgerEvent = {
      id,
      txHash: data.txHash,
      chainId: data.chainId,
      direction: data.direction,
      amount: data.amount,
      asset: data.asset,
      counterparty: data.counterparty,
      memoHash: data.memoHash || null,
      immutableSeq: this.ledgerSeqCounter,
      createdAt: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.ledgerEvents = new Map(this.ledgerEvents).set(id, ledgerEvent);

    return ledgerEvent;
  }

  async getLedgerEvents(filters?: { chainId?: string; direction?: string }): Promise<LedgerEvent[]> {
    let results = Array.from(this.ledgerEvents.values());

    if (filters?.chainId) {
      results = results.filter(e => e.chainId === filters.chainId);
    }

    if (filters?.direction) {
      results = results.filter(e => e.direction === filters.direction);
    }

    // Sort by immutableSeq descending (newest first)
    return results.sort((a, b) => b.immutableSeq - a.immutableSeq);
  }

  async createAllocation(data: InsertAllocation): Promise<Allocation> {
    const id = randomUUID();
    const allocation: Allocation = {
      id,
      ledgerEventId: data.ledgerEventId,
      bucket: data.bucket,
      percent: data.percent,
      amount: data.amount,
      policyRef: data.policyRef,
      createdAt: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.allocations = new Map(this.allocations).set(id, allocation);

    return allocation;
  }

  async getAllocations(ledgerEventId?: string): Promise<Allocation[]> {
    let results = Array.from(this.allocations.values());

    if (ledgerEventId) {
      results = results.filter(a => a.ledgerEventId === ledgerEventId);
    }

    return results;
  }

  // ============================================================================
  // Telemetry Operations
  // ============================================================================

  async recordTelemetryEvent(data: InsertTelemetryEvent): Promise<TelemetryEvent> {
    const id = randomUUID();

    const telemetryEvent: TelemetryEvent = {
      id,
      eventType: data.eventType,
      sessionId: data.sessionId,
      hashedIp: data.hashedIp,
      geoRegion: data.geoRegion || null,
      device: data.device || null,
      uaHash: data.uaHash || null,
      fraudScore: data.fraudScore || null,
      ts: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.telemetryEvents = new Map(this.telemetryEvents).set(id, telemetryEvent);

    return telemetryEvent;
  }

  async getMetrics(): Promise<{
    liveUsers: LiveUserMetrics;
    geo: GeoMetrics[];
    funnel: FunnelMetrics[];
    devices: DeviceMetrics[];
    fraud: FraudMetrics;
  }> {
    const events = Array.from(this.telemetryEvents.values());

    // Live users (sessions active in last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEvents = events.filter(e => e.ts >= fiveMinutesAgo);
    const uniqueSessions = new Set(recentEvents.map(e => e.sessionId));

    const liveUsers: LiveUserMetrics = {
      activeUsers: uniqueSessions.size,
      sessions: uniqueSessions.size,
    };

    // Geo metrics
    const geoMap = new Map<string, number>();
    for (const event of events) {
      if (event.geoRegion) {
        geoMap.set(event.geoRegion, (geoMap.get(event.geoRegion) || 0) + 1);
      }
    }
    const geo: GeoMetrics[] = Array.from(geoMap.entries()).map(([region, count]) => ({
      region,
      count,
    }));

    // Funnel metrics (based on event types)
    const funnelMap = new Map<string, number>();
    for (const event of events) {
      funnelMap.set(event.eventType, (funnelMap.get(event.eventType) || 0) + 1);
    }
    const totalEvents = events.length || 1;
    const funnel: FunnelMetrics[] = Array.from(funnelMap.entries()).map(([step, count]) => ({
      step,
      count,
      conversionRate: (count / totalEvents) * 100,
    }));

    // Device metrics
    const deviceMap = new Map<string, number>();
    for (const event of events) {
      if (event.device) {
        deviceMap.set(event.device, (deviceMap.get(event.device) || 0) + 1);
      }
    }
    const devices: DeviceMetrics[] = Array.from(deviceMap.entries()).map(([device, count]) => ({
      device,
      count,
    }));

    // Fraud metrics
    const fraudScores = events
      .filter(e => e.fraudScore !== null)
      .map(e => parseFloat(e.fraudScore as string));
    
    const averageFraudScore = fraudScores.length > 0
      ? fraudScores.reduce((sum, score) => sum + score, 0) / fraudScores.length
      : 0;
    
    const highRiskSessions = new Set(
      events
        .filter(e => e.fraudScore && parseFloat(e.fraudScore as string) > 0.7)
        .map(e => e.sessionId)
    ).size;

    const fraud: FraudMetrics = {
      averageFraudScore,
      highRiskSessions,
    };

    return {
      liveUsers,
      geo,
      funnel,
      devices,
      fraud,
    };
  }

  // ============================================================================
  // Audit Operations
  // ============================================================================

  async appendAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const auditLog: AuditLog = {
      id,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      actor: data.actor,
      meta: data.meta || null,
      createdAt: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.auditLogs = new Map(this.auditLogs).set(id, auditLog);

    return auditLog;
  }

  async getAuditLog(filters?: { entityType?: string; entityId?: string }): Promise<AuditLog[]> {
    let results = Array.from(this.auditLogs.values());

    if (filters?.entityType) {
      results = results.filter(log => log.entityType === filters.entityType);
    }

    if (filters?.entityId) {
      results = results.filter(log => log.entityId === filters.entityId);
    }

    // Sort by createdAt descending (newest first)
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ============================================================================
  // Wallet Registry Operations
  // ============================================================================

  async getWalletRegistry(): Promise<WalletRegistry[]> {
    return Array.from(this.walletRegistries.values());
  }

  async setPreferredWallet(userId: string, walletId: string): Promise<void> {
    // Concurrency-safe: create new Map with updated entry
    this.userPreferredWallets = new Map(this.userPreferredWallets).set(userId, walletId);
  }

  async getPreferredWallet(userId: string): Promise<string | null> {
    return this.userPreferredWallets.get(userId) || null;
  }

  // ============================================================================
  // Voice Call Operations
  // ============================================================================

  async createCallSession(data: InsertCallSession): Promise<CallSession> {
    const id = randomUUID();
    
    // Increment immutableSeq counter for this call session
    this.callSessionSeqCounter++;

    const callSession: CallSession = {
      id,
      roomId: data.roomId,
      participantsHashes: data.participantsHashes,
      mediaType: data.mediaType,
      startTx: data.startTx || null,
      endTx: data.endTx || null,
      startedAt: data.startedAt,
      endedAt: data.endedAt || null,
      durationSec: data.durationSec || null,
      metricsSummary: data.metricsSummary || null,
      immutableSeq: this.callSessionSeqCounter,
    };

    // Concurrency-safe: create new Map with added entry
    this.callSessions = new Map(this.callSessions).set(id, callSession);

    return callSession;
  }

  async updateCallSession(id: string, data: Partial<InsertCallSession>): Promise<CallSession> {
    const existing = this.callSessions.get(id);
    if (!existing) {
      throw new Error(`Call session not found: ${id}`);
    }

    const updated: CallSession = {
      ...existing,
      ...(data.roomId && { roomId: data.roomId }),
      ...(data.participantsHashes && { participantsHashes: data.participantsHashes }),
      ...(data.mediaType && { mediaType: data.mediaType }),
      ...(data.startTx !== undefined && { startTx: data.startTx }),
      ...(data.endTx !== undefined && { endTx: data.endTx }),
      ...(data.startedAt && { startedAt: data.startedAt }),
      ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
      ...(data.durationSec !== undefined && { durationSec: data.durationSec }),
      ...(data.metricsSummary !== undefined && { metricsSummary: data.metricsSummary }),
    };

    // Concurrency-safe: create new Map with updated entry
    this.callSessions = new Map(this.callSessions).set(id, updated);

    return updated;
  }

  async getCallSession(id: string): Promise<CallSession | null> {
    return this.callSessions.get(id) || null;
  }

  async getCallSessionByRoomId(roomId: string): Promise<CallSession | null> {
    for (const session of this.callSessions.values()) {
      if (session.roomId === roomId && !session.endedAt) {
        return session;
      }
    }
    return null;
  }

  async listCallSessions(roomId?: string): Promise<CallSession[]> {
    let results = Array.from(this.callSessions.values());

    if (roomId) {
      results = results.filter(s => s.roomId === roomId);
    }

    // Sort by immutableSeq descending (newest first)
    return results.sort((a, b) => b.immutableSeq - a.immutableSeq);
  }

  // ============================================================================
  // Voice Telemetry Operations
  // ============================================================================

  async recordVoiceTelemetry(data: InsertTelemetryVoice): Promise<TelemetryVoice> {
    const id = randomUUID();

    const voiceTelemetry: TelemetryVoice = {
      id,
      roomHash: data.roomHash,
      sessionId: data.sessionId,
      rttMs: data.rttMs || null,
      jitterMs: data.jitterMs || null,
      packetsLostPct: data.packetsLostPct || null,
      bitrateKbps: data.bitrateKbps || null,
      codec: data.codec || null,
      audioLevel: data.audioLevel || null,
      iceState: data.iceState || null,
      ts: new Date(),
    };

    // Concurrency-safe: create new Map with added entry
    this.voiceTelemetry = new Map(this.voiceTelemetry).set(id, voiceTelemetry);

    return voiceTelemetry;
  }

  async getVoiceTelemetry(filters?: { roomHash?: string; sessionId?: string }): Promise<TelemetryVoice[]> {
    let results = Array.from(this.voiceTelemetry.values());

    if (filters?.roomHash) {
      results = results.filter(t => t.roomHash === filters.roomHash);
    }

    if (filters?.sessionId) {
      results = results.filter(t => t.sessionId === filters.sessionId);
    }

    // Sort by timestamp descending (newest first)
    return results.sort((a, b) => b.ts.getTime() - a.ts.getTime());
  }

  // ============================================================================
  // Trust Config Operations (Not implemented in MemStorage)
  // ============================================================================

  async getTrustConfig(_key?: string): Promise<TrustConfig[]> {
    throw new Error('Trust Config operations require PgStorage. Please use a database.');
  }

  async createTrustConfig(_data: InsertTrustConfig): Promise<TrustConfig> {
    throw new Error('Trust Config operations require PgStorage. Please use a database.');
  }

  async updateTrustConfig(_key: string, _value: any, _userId: string): Promise<TrustConfig> {
    throw new Error('Trust Config operations require PgStorage. Please use a database.');
  }

  // ============================================================================
  // Trust Rules Operations (Not implemented in MemStorage)
  // ============================================================================

  async getTrustRules(_filters?: { status?: string }): Promise<TrustRule[]> {
    throw new Error('Trust Rules operations require PgStorage. Please use a database.');
  }

  async getTrustRule(_id: string): Promise<TrustRule | null> {
    throw new Error('Trust Rules operations require PgStorage. Please use a database.');
  }

  async createTrustRule(_data: InsertTrustRule): Promise<TrustRule> {
    throw new Error('Trust Rules operations require PgStorage. Please use a database.');
  }

  async updateTrustRule(_id: string, _data: Partial<InsertTrustRule>): Promise<TrustRule> {
    throw new Error('Trust Rules operations require PgStorage. Please use a database.');
  }

  async incrementRuleExecution(_id: string): Promise<void> {
    throw new Error('Trust Rules operations require PgStorage. Please use a database.');
  }

  // ============================================================================
  // Trust Plugin Operations (Not implemented in MemStorage)
  // ============================================================================

  async getTrustPlugins(_filters?: { status?: string }): Promise<TrustPlugin[]> {
    throw new Error('Trust Plugin operations require PgStorage. Please use a database.');
  }

  async getTrustPlugin(_id: string): Promise<TrustPlugin | null> {
    throw new Error('Trust Plugin operations require PgStorage. Please use a database.');
  }

  async createTrustPlugin(_data: InsertTrustPlugin): Promise<TrustPlugin> {
    throw new Error('Trust Plugin operations require PgStorage. Please use a database.');
  }

  async updateTrustPlugin(_id: string, _data: Partial<InsertTrustPlugin>): Promise<TrustPlugin> {
    throw new Error('Trust Plugin operations require PgStorage. Please use a database.');
  }

  // ============================================================================
  // User Management Operations
  // ============================================================================

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserRole(id: string, role: 'admin' | 'viewer'): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }

    const updated: User = {
      ...user,
      role,
    };

    this.users = new Map(this.users).set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    if (!this.users.has(id)) {
      throw new Error(`User not found: ${id}`);
    }

    const newUsers = new Map(this.users);
    newUsers.delete(id);
    this.users = newUsers;
  }

  // ============================================================================
  // Bridge Operations
  // ============================================================================

  async createBridgeJob(data: InsertBridgeJob): Promise<BridgeJob> {
    const id = randomUUID();
    const bridgeJob: BridgeJob = {
      id,
      receiptId: data.receiptId,
      docHash: data.docHash,
      sourceChain: data.sourceChain || 'base',
      targetChain: data.targetChain,
      status: data.status || 'pending',
      txHash: data.txHash || null,
      confirmations: data.confirmations || 0,
      requiredConfirmations: data.requiredConfirmations || 12,
      attempts: data.attempts || 0,
      maxAttempts: data.maxAttempts || 3,
      lastError: data.lastError || null,
      metadata: data.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      confirmedAt: data.confirmedAt || null,
    };

    this.bridgeJobs = new Map(this.bridgeJobs).set(id, bridgeJob);
    return bridgeJob;
  }

  async getBridgeJob(id: string): Promise<BridgeJob | null> {
    return this.bridgeJobs.get(id) || null;
  }

  async getBridgeJobsByDocHash(docHash: string): Promise<BridgeJob[]> {
    return Array.from(this.bridgeJobs.values())
      .filter(job => job.docHash === docHash)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getBridgeJobsByReceipt(receiptId: string): Promise<BridgeJob[]> {
    return Array.from(this.bridgeJobs.values())
      .filter(job => job.receiptId === receiptId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateBridgeJob(id: string, data: Partial<InsertBridgeJob>): Promise<BridgeJob> {
    const existing = this.bridgeJobs.get(id);
    if (!existing) {
      throw new Error(`Bridge job not found: ${id}`);
    }

    const updated: BridgeJob = {
      ...existing,
      ...(data.status && { status: data.status }),
      ...(data.txHash !== undefined && { txHash: data.txHash }),
      ...(data.confirmations !== undefined && { confirmations: data.confirmations }),
      ...(data.attempts !== undefined && { attempts: data.attempts }),
      ...(data.lastError !== undefined && { lastError: data.lastError }),
      ...(data.confirmedAt !== undefined && { confirmedAt: data.confirmedAt }),
      updatedAt: new Date(),
    };

    this.bridgeJobs = new Map(this.bridgeJobs).set(id, updated);
    return updated;
  }

  async listBridgeJobs(filters?: { status?: string; targetChain?: string }): Promise<BridgeJob[]> {
    let results = Array.from(this.bridgeJobs.values());

    if (filters?.status) {
      results = results.filter(job => job.status === filters.status);
    }

    if (filters?.targetChain) {
      results = results.filter(job => job.targetChain === filters.targetChain);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getReceiptByHash(hash: string): Promise<Receipt | null> {
    for (const receipt of this.receipts.values()) {
      if (receipt.contentHash === hash || receipt.id === hash) {
        return receipt;
      }
    }
    return null;
  }

  // ============================================================================
  // App Layer Operations (Stub implementations for MemStorage)
  // ============================================================================

  async createMessage(_data: any): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async getMessage(_id: string): Promise<any | null> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async listMessages(_filters?: any): Promise<any[]> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async updateMessageStatus(_id: string, _status: string, _timestamp?: Date): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async createNote(_data: any): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async getNote(_id: string): Promise<any | null> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async listNotes(_filters?: any): Promise<any[]> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async updateNote(_id: string, _data: Partial<any>): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async deleteNote(_id: string): Promise<void> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async createOrUpdateDirectoryEntry(_data: any): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async getDirectoryEntry(_walletAddress: string): Promise<any | null> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async listDirectoryEntries(_filters?: any): Promise<any[]> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async createInboxItem(_data: any): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async getInboxItem(_id: string): Promise<any | null> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async listInboxItems(_filters?: any): Promise<any[]> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async updateInboxItem(_id: string, _data: Partial<any>): Promise<any> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async bulkUpdateInboxItems(_ids: string[], _data: Partial<any>): Promise<void> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async bulkDeleteInboxItems(_ids: string[]): Promise<void> {
    throw new Error('App layer operations require PgStorage. Please use a database.');
  }

  async createDaoProposal(_data: any): Promise<any> {
    throw new Error('DAO operations require PgStorage. Please use a database.');
  }

  async getDaoProposal(_id: string): Promise<any | null> {
    throw new Error('DAO operations require PgStorage. Please use a database.');
  }

  async getDaoProposalByProposalId(_proposalId: string): Promise<any | null> {
    throw new Error('DAO operations require PgStorage. Please use a database.');
  }

  async listDaoProposals(_filters?: any): Promise<any[]> {
    throw new Error('DAO operations require PgStorage. Please use a database.');
  }

  async updateDaoProposal(_id: string, _data: Partial<any>): Promise<any> {
    throw new Error('DAO operations require PgStorage. Please use a database.');
  }

  // ============================================================================
  // Payment Transaction Operations
  // ============================================================================

  async createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const id = randomUUID();
    const payment: PaymentTransaction = {
      id,
      fromAddress: data.fromAddress,
      toAddress: data.toAddress,
      asset: data.asset,
      amount: data.amount,
      gasEstimate: data.gasEstimate || null,
      gasFee: data.gasFee || null,
      totalAmount: data.totalAmount,
      status: data.status || "pending",
      txHash: data.txHash || null,
      chainId: data.chainId || "8453",
      anchorTxHash: data.anchorTxHash || null,
      anchorStatus: data.anchorStatus || "none",
      anchorTimestamp: data.anchorTimestamp || null,
      receiptId: data.receiptId || null,
      toEnsName: data.toEnsName || null,
      toBasename: data.toBasename || null,
      metadata: data.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.paymentTransactions = new Map(this.paymentTransactions).set(id, payment);
    return payment;
  }

  async getPaymentTransaction(id: string): Promise<PaymentTransaction | null> {
    return this.paymentTransactions.get(id) || null;
  }

  async listPaymentTransactions(filters?: { fromAddress?: string; toAddress?: string; status?: string; asset?: string }): Promise<PaymentTransaction[]> {
    let results = Array.from(this.paymentTransactions.values());

    if (filters?.fromAddress) {
      results = results.filter(p => p.fromAddress.toLowerCase() === filters.fromAddress!.toLowerCase());
    }

    if (filters?.toAddress) {
      results = results.filter(p => p.toAddress.toLowerCase() === filters.toAddress!.toLowerCase());
    }

    if (filters?.status) {
      results = results.filter(p => p.status === filters.status);
    }

    if (filters?.asset) {
      results = results.filter(p => p.asset === filters.asset);
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updatePaymentTransaction(id: string, data: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction> {
    const existing = this.paymentTransactions.get(id);
    if (!existing) {
      throw new Error(`Payment transaction not found: ${id}`);
    }

    const updated: PaymentTransaction = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };

    this.paymentTransactions = new Map(this.paymentTransactions).set(id, updated);
    return updated;
  }

  async estimateGas(asset: string, amount: string): Promise<{ gasEstimate: string; gasFee: string }> {
    const gasEstimate = "0.00042";
    const gasFee = "0.000315";
    
    return { gasEstimate, gasFee };
  }

  async close(): Promise<void> {
    return;
  }

  // Install Token operations (Session Bridge)
  private installTokens: Map<string, InstallToken> = new Map();

  async createInstallToken(data: InsertInstallToken): Promise<InstallToken> {
    const token: InstallToken = {
      token: data.token,
      walletAddress: data.walletAddress,
      appMode: data.appMode ?? false,
      expiresAt: data.expiresAt,
      isConsumed: false,
      consumedAt: null,
      sessionData: data.sessionData || null,
      createdAt: new Date(),
    };
    this.installTokens.set(data.token, token);
    return token;
  }

  async getInstallToken(token: string): Promise<InstallToken | null> {
    return this.installTokens.get(token) || null;
  }

  async consumeInstallToken(token: string): Promise<void> {
    const existing = this.installTokens.get(token);
    if (existing) {
      existing.isConsumed = true;
      existing.consumedAt = new Date();
      this.installTokens.set(token, existing);
    }
  }

  async updateInstallTokenWallet(token: string, walletAddress: string): Promise<void> {
    const existing = this.installTokens.get(token);
    if (existing) {
      existing.walletAddress = walletAddress;
      this.installTokens.set(token, existing);
    }
  }

  async cleanupExpiredInstallTokens(): Promise<void> {
    const now = new Date();
    for (const [key, token] of this.installTokens.entries()) {
      if (new Date(token.expiresAt) < now) {
        this.installTokens.delete(key);
      }
    }
  }

  // ============================================================================
  // Payment Operations (Phase 1 Stream A)
  // ============================================================================

  async createPayment(payment: InsertPayment): Promise<Payment> {
    this.paymentIdCounter++;
    const id = this.paymentIdCounter;

    const newPayment: Payment = {
      id,
      txHash: payment.txHash,
      chainId: payment.chainId,
      fromAddress: payment.fromAddress,
      toAddress: payment.toAddress,
      amount: payment.amount,
      token: payment.token || null,
      tokenSymbol: payment.tokenSymbol || null,
      timestamp: new Date(),
      status: payment.status || "pending",
      memo: payment.memo || null,
      proofCid: payment.proofCid || null,
      gasUsed: payment.gasUsed || null,
      blockNumber: payment.blockNumber || null,
    };

    this.payments = new Map(this.payments).set(id, newPayment);
    return newPayment;
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | undefined> {
    for (const payment of this.payments.values()) {
      if (payment.txHash === txHash) {
        return payment;
      }
    }
    return undefined;
  }

  async getPaymentsByAddress(address: string): Promise<Payment[]> {
    const normalizedAddress = address.toLowerCase();
    const results: Payment[] = [];
    
    for (const payment of this.payments.values()) {
      if (
        payment.fromAddress.toLowerCase() === normalizedAddress ||
        payment.toAddress.toLowerCase() === normalizedAddress
      ) {
        results.push(payment);
      }
    }
    
    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async updatePaymentStatus(
    txHash: string,
    status: string,
    blockNumber?: number,
    gasUsed?: string
  ): Promise<Payment | undefined> {
    for (const [id, payment] of this.payments.entries()) {
      if (payment.txHash === txHash) {
        const updated: Payment = {
          ...payment,
          status,
          ...(blockNumber !== undefined && { blockNumber }),
          ...(gasUsed !== undefined && { gasUsed }),
        };
        this.payments = new Map(this.payments).set(id, updated);
        return updated;
      }
    }
    return undefined;
  }

  async upsertAddressIndex(address: string, chainId: number): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    const existing = this.addressIndexMap.get(normalizedAddress);

    if (existing) {
      const chains = (existing.chains || []) as number[];
      if (!chains.includes(chainId)) {
        chains.push(chainId);
      }
      
      const updated: AddressIndex = {
        ...existing,
        lastSeenAt: new Date(),
        chains,
        paymentCount: (existing.paymentCount || 0) + 1,
      };
      this.addressIndexMap = new Map(this.addressIndexMap).set(normalizedAddress, updated);
    } else {
      this.addressIndexIdCounter++;
      const newEntry: AddressIndex = {
        id: this.addressIndexIdCounter,
        address: normalizedAddress,
        lastSeenAt: new Date(),
        chains: [chainId],
        paymentCount: 1,
      };
      this.addressIndexMap = new Map(this.addressIndexMap).set(normalizedAddress, newEntry);
    }
  }

  // ============================================================================
  // Quarantine Operations
  // ============================================================================

  private quarantineItems: Map<string, QuarantineItem> = new Map();

  async getQuarantinedItems(): Promise<QuarantineItem[]> {
    return Array.from(this.quarantineItems.values())
      .filter(item => item.status === 'pending')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createQuarantineItem(data: InsertQuarantineItem): Promise<QuarantineItem> {
    const id = randomUUID();
    const item: QuarantineItem = {
      id,
      type: data.type,
      sender: data.sender,
      reason: data.reason,
      payload: data.payload || null,
      status: data.status || 'pending',
      createdAt: new Date(),
      releasedAt: null,
      releasedBy: null,
    };

    this.quarantineItems = new Map(this.quarantineItems).set(id, item);
    return item;
  }

  async releaseQuarantinedItem(id: string, releasedBy: string): Promise<QuarantineItem | null> {
    const existing = this.quarantineItems.get(id);
    if (!existing) {
      return null;
    }

    const updated: QuarantineItem = {
      ...existing,
      status: 'released',
      releasedAt: new Date(),
      releasedBy,
    };

    this.quarantineItems = new Map(this.quarantineItems).set(id, updated);
    return updated;
  }

  async deleteQuarantinedItem(id: string): Promise<void> {
    this.quarantineItems = new Map(this.quarantineItems);
    this.quarantineItems.delete(id);
  }

  // ============================================================================
  // Vault Credential Operations (In-Memory with Persistence Fallback)
  // ============================================================================

  private vaultCredentials: Map<string, VaultCredential> = new Map();

  private getVaultCredentialKey(walletAddr: string, provider: string, scope: string): string {
    return `${walletAddr.toLowerCase()}:${provider}:${scope}`;
  }

  async saveVaultCredential(data: InsertVaultCredential): Promise<VaultCredential> {
    const id = randomUUID();
    const key = this.getVaultCredentialKey(data.walletAddr, data.provider, data.scope);
    
    const existing = this.vaultCredentials.get(key);
    
    const credential: VaultCredential = {
      id: existing?.id || id,
      walletAddr: data.walletAddr.toLowerCase(),
      provider: data.provider,
      scope: data.scope,
      encryptedBlob: data.encryptedBlob,
      nonce: data.nonce,
      salt: data.salt,
      keyType: data.keyType || 'api',
      expiresAt: data.expiresAt || null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.vaultCredentials = new Map(this.vaultCredentials).set(key, credential);
    return credential;
  }

  async getVaultCredential(walletAddr: string, provider: string, scope: string): Promise<VaultCredential | null> {
    const key = this.getVaultCredentialKey(walletAddr, provider, scope);
    return this.vaultCredentials.get(key) || null;
  }

  async deleteVaultCredential(walletAddr: string, provider: string, scope: string): Promise<boolean> {
    const key = this.getVaultCredentialKey(walletAddr, provider, scope);
    if (this.vaultCredentials.has(key)) {
      this.vaultCredentials = new Map(this.vaultCredentials);
      this.vaultCredentials.delete(key);
      return true;
    }
    return false;
  }

  async listVaultCredentials(walletAddr: string): Promise<VaultCredential[]> {
    const prefix = walletAddr.toLowerCase() + ':';
    const results: VaultCredential[] = [];
    
    for (const [key, credential] of this.vaultCredentials.entries()) {
      if (key.startsWith(prefix)) {
        results.push(credential);
      }
    }
    
    return results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // ============================================================================
  // Wallet Profile Operations (Unified wallet-scoped personalization)
  // ============================================================================

  private walletProfiles: Map<string, WalletProfile> = new Map();

  async getWalletProfile(wallet: string): Promise<WalletProfile | null> {
    return this.walletProfiles.get(wallet.toLowerCase()) || null;
  }

  async upsertWalletProfile(data: Partial<InsertWalletProfile> & { wallet: string }): Promise<WalletProfile> {
    const walletKey = data.wallet.toLowerCase();
    const existing = this.walletProfiles.get(walletKey);
    
    const profile: WalletProfile = {
      id: existing?.id || randomUUID(),
      wallet: walletKey,
      displayName: data.displayName ?? existing?.displayName ?? null,
      avatarCid: data.avatarCid ?? existing?.avatarCid ?? null,
      facePreset: data.facePreset ?? existing?.facePreset ?? 'line',
      interfacePreference: data.interfacePreference ?? existing?.interfacePreference ?? 'canvas',
      voiceStyle: data.voiceStyle ?? existing?.voiceStyle ?? 'default',
      voiceGender: data.voiceGender ?? existing?.voiceGender ?? 'neutral',
      voiceSpeed: data.voiceSpeed ?? existing?.voiceSpeed ?? 100,
      themeMode: data.themeMode ?? existing?.themeMode ?? 'dark',
      primaryColor: data.primaryColor ?? existing?.primaryColor ?? 'purple',
      pinnedManifests: data.pinnedManifests ?? existing?.pinnedManifests ?? [],
      sessionMemoryEnabled: data.sessionMemoryEnabled ?? existing?.sessionMemoryEnabled ?? true,
      rememberPinnedApps: data.rememberPinnedApps ?? existing?.rememberPinnedApps ?? true,
      rememberQueries: data.rememberQueries ?? existing?.rememberQueries ?? false,
      rememberFlowHistory: data.rememberFlowHistory ?? existing?.rememberFlowHistory ?? true,
      onboardingCompletedAt: data.onboardingCompletedAt ?? existing?.onboardingCompletedAt ?? null,
      onboardingPath: data.onboardingPath ?? existing?.onboardingPath ?? null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.walletProfiles = new Map(this.walletProfiles).set(walletKey, profile);
    return profile;
  }

  // ============================================================================
  // Atlas Endpoints Operations (Personal Pulse)
  // ============================================================================

  async createAtlasEndpoint(data: InsertAtlasEndpoint): Promise<AtlasEndpoint> {
    const id = randomUUID();
    
    const endpoint: AtlasEndpoint = {
      id,
      walletAddress: data.walletAddress,
      endpointUrl: data.endpointUrl,
      displayName: data.displayName,
      status: data.status || "pending",
      protocolVersion: data.protocolVersion || null,
      telemetryCaps: data.telemetryCaps || null,
      lastValidationAt: data.lastValidationAt || null,
      lastMetricsFetchAt: data.lastMetricsFetchAt || null,
      metricsCache: data.metricsCache || null,
      createdAt: new Date(),
    };

    this.atlasEndpointsMap = new Map(this.atlasEndpointsMap).set(id, endpoint);
    return endpoint;
  }

  async getAtlasEndpointsByWallet(walletAddress: string): Promise<AtlasEndpoint[]> {
    const results: AtlasEndpoint[] = [];
    const normalizedAddress = walletAddress.toLowerCase();
    
    for (const endpoint of this.atlasEndpointsMap.values()) {
      if (endpoint.walletAddress.toLowerCase() === normalizedAddress) {
        results.push(endpoint);
      }
    }
    
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAtlasEndpoint(id: string): Promise<AtlasEndpoint | null> {
    return this.atlasEndpointsMap.get(id) || null;
  }

  async updateAtlasEndpoint(id: string, data: Partial<InsertAtlasEndpoint>): Promise<AtlasEndpoint | null> {
    const existing = this.atlasEndpointsMap.get(id);
    if (!existing) {
      return null;
    }

    const updated: AtlasEndpoint = {
      ...existing,
      walletAddress: data.walletAddress ?? existing.walletAddress,
      endpointUrl: data.endpointUrl ?? existing.endpointUrl,
      displayName: data.displayName ?? existing.displayName,
      status: data.status ?? existing.status,
      protocolVersion: data.protocolVersion !== undefined ? data.protocolVersion : existing.protocolVersion,
      telemetryCaps: data.telemetryCaps !== undefined ? data.telemetryCaps : existing.telemetryCaps,
      lastValidationAt: data.lastValidationAt !== undefined ? data.lastValidationAt : existing.lastValidationAt,
      lastMetricsFetchAt: data.lastMetricsFetchAt !== undefined ? data.lastMetricsFetchAt : existing.lastMetricsFetchAt,
      metricsCache: data.metricsCache !== undefined ? data.metricsCache : existing.metricsCache,
    };

    this.atlasEndpointsMap = new Map(this.atlasEndpointsMap).set(id, updated);
    return updated;
  }

  async deleteAtlasEndpoint(id: string): Promise<boolean> {
    if (this.atlasEndpointsMap.has(id)) {
      this.atlasEndpointsMap = new Map(this.atlasEndpointsMap);
      this.atlasEndpointsMap.delete(id);
      return true;
    }
    return false;
  }

  async recordPageView(_data: {
    route: string;
    referrer?: string;
    userAgent?: string;
    deviceType?: string;
    browser?: string;
    country?: string;
    hashedIp: string;
    sessionId?: string;
    walletAddress?: string;
  }): Promise<void> {
  }

  async updatePageViewCountry(_hashedIp: string, _country: string): Promise<void> {
  }

  async getPageAnalytics(_range?: '24h' | '7d' | '30d'): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    topPages: { route: string; views: number }[];
    topReferrers: { referrer: string; views: number }[];
    topDevices: { device: string; views: number }[];
    topBrowsers: { browser: string; views: number }[];
  }> {
    return {
      totalViews: 0,
      uniqueVisitors: 0,
      topPages: [],
      topReferrers: [],
      topDevices: [],
      topBrowsers: [],
    };
  }

  async updateMessageAnchor(_id: string, _anchorTxHash: string): Promise<any> {
    return null;
  }

  async updateNoteAnchor(_id: string, _anchorTxHash: string): Promise<any> {
    return null;
  }

  async recordApiRequestMetrics(data: InsertApiRequestMetrics): Promise<ApiRequestMetrics> {
    const id = randomUUID();
    const metric: ApiRequestMetrics = {
      id,
      endpoint: data.endpoint,
      method: data.method,
      requestBytes: data.requestBytes ?? null,
      responseBytes: data.responseBytes ?? null,
      latencyMs: data.latencyMs,
      statusCode: data.statusCode,
      isAtlasApi: data.isAtlasApi ?? true,
      sessionReused: data.sessionReused ?? false,
      ts: new Date(),
    };
    return metric;
  }

  // ============================================================================
  // Wallet PIN Operations (SIWE Fallback Authentication)
  // ============================================================================

  private walletPins: Map<string, WalletPin> = new Map();
  private readonly MAX_PIN_ATTEMPTS = 5;
  private readonly PIN_LOCKOUT_MINUTES = 15;

  async getWalletPin(walletAddress: string): Promise<WalletPin | null> {
    return this.walletPins.get(walletAddress.toLowerCase()) || null;
  }

  async createWalletPin(data: InsertWalletPin): Promise<WalletPin> {
    const walletKey = data.walletAddress.toLowerCase();
    const now = new Date();
    
    const pin: WalletPin = {
      id: randomUUID(),
      walletAddress: walletKey,
      pinHash: data.pinHash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    };

    this.walletPins = new Map(this.walletPins).set(walletKey, pin);
    return pin;
  }

  async updateWalletPin(walletAddress: string, data: Partial<WalletPin>): Promise<WalletPin | null> {
    const walletKey = walletAddress.toLowerCase();
    const existing = this.walletPins.get(walletKey);
    if (!existing) return null;

    const updated: WalletPin = {
      ...existing,
      ...data,
      walletAddress: walletKey,
      updatedAt: new Date(),
    };

    this.walletPins = new Map(this.walletPins).set(walletKey, updated);
    return updated;
  }

  async incrementPinFailedAttempts(walletAddress: string): Promise<{ failedAttempts: number; lockedUntil: Date | null } | null> {
    const walletKey = walletAddress.toLowerCase();
    const existing = this.walletPins.get(walletKey);
    if (!existing) return null;

    const newAttempts = existing.failedAttempts + 1;
    let lockedUntil: Date | null = null;

    if (newAttempts >= this.MAX_PIN_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + this.PIN_LOCKOUT_MINUTES * 60 * 1000);
    }

    const updated: WalletPin = {
      ...existing,
      failedAttempts: newAttempts,
      lockedUntil,
      updatedAt: new Date(),
    };

    this.walletPins = new Map(this.walletPins).set(walletKey, updated);
    return { failedAttempts: newAttempts, lockedUntil };
  }

  async resetPinFailedAttempts(walletAddress: string): Promise<void> {
    const walletKey = walletAddress.toLowerCase();
    const existing = this.walletPins.get(walletKey);
    if (!existing) return;

    const updated: WalletPin = {
      ...existing,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    };

    this.walletPins = new Map(this.walletPins).set(walletKey, updated);
  }

  // ============================================================================
  // Push Subscription Operations
  // ============================================================================

  private pushSubscriptionsMap: Map<string, PushSubscription> = new Map();

  async createPushSubscription(data: InsertPushSubscription): Promise<PushSubscription> {
    const id = randomUUID();
    const now = new Date();
    const subscription: PushSubscription = {
      id,
      walletAddress: data.walletAddress.toLowerCase(),
      endpoint: data.endpoint,
      keys: data.keys,
      topics: data.topics || [],
      createdAt: now,
    };
    this.pushSubscriptionsMap.set(data.endpoint, subscription);
    return subscription;
  }

  async getPushSubscription(endpoint: string): Promise<PushSubscription | null> {
    return this.pushSubscriptionsMap.get(endpoint) || null;
  }

  async getPushSubscriptionsByWallet(walletAddress: string): Promise<PushSubscription[]> {
    const wallet = walletAddress.toLowerCase();
    return Array.from(this.pushSubscriptionsMap.values()).filter(
      (sub) => sub.walletAddress === wallet
    );
  }

  async deletePushSubscription(endpoint: string): Promise<boolean> {
    return this.pushSubscriptionsMap.delete(endpoint);
  }

  async deletePushSubscriptionsByWallet(walletAddress: string): Promise<number> {
    const wallet = walletAddress.toLowerCase();
    let count = 0;
    for (const [key, sub] of this.pushSubscriptionsMap.entries()) {
      if (sub.walletAddress === wallet) {
        this.pushSubscriptionsMap.delete(key);
        count++;
      }
    }
    return count;
  }
}
