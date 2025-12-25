import { pgTable, uuid, text, timestamp, jsonb, decimal, integer, serial, varchar, boolean, numeric, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * P3 Protocol Data Models
 * 
 * Hash Strategy Documentation:
 * - contentHash (SHA-256): Used in receipts to ensure immutability of message/meeting/money content
 * - memoHash: Used in ledgerEvents to hash transaction memos while preserving privacy
 * - hashedIp: Used in telemetryEvents to protect user privacy while enabling fraud detection
 * - uaHash: User agent hash for device fingerprinting in telemetry
 */

// Enums
export const userRoles = ["admin", "viewer"] as const;
export const receiptTypes = ["message", "meeting", "money"] as const;
export const ledgerDirections = ["inflow", "outflow"] as const;
export const allocationBuckets = ["ops", "r&d", "grants", "reserve"] as const;
export const telemetryEventTypes = [
  "page_view",
  "click",
  "form_submit",
  "api_call",
  "error"
] as const;
export const mediaTypes = ["audio", "video", "screen"] as const;

// Users Table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("viewer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Receipts Table
export const receipts = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type", { enum: receiptTypes }).notNull(),
  subjectId: text("subject_id").notNull(),
  contentHash: text("content_hash").notNull(),
  proofBlob: jsonb("proof_blob").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  immutableSeq: integer("immutable_seq").notNull(),
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
});

export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;

// Audit Log Table
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  actor: text("actor").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// Ledger Events Table
export const ledgerEvents = pgTable("ledger_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  txHash: text("tx_hash").notNull(),
  chainId: text("chain_id").notNull(),
  direction: text("direction", { enum: ledgerDirections }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  asset: text("asset").notNull(),
  counterparty: text("counterparty").notNull(),
  memoHash: text("memo_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  immutableSeq: integer("immutable_seq").notNull(),
});

export const insertLedgerEventSchema = createInsertSchema(ledgerEvents).omit({
  id: true,
  createdAt: true,
});

export type InsertLedgerEvent = z.infer<typeof insertLedgerEventSchema>;
export type LedgerEvent = typeof ledgerEvents.$inferSelect;

// Allocations Table
export const allocations = pgTable("allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  ledgerEventId: uuid("ledger_event_id").notNull().references(() => ledgerEvents.id),
  bucket: text("bucket", { enum: allocationBuckets }).notNull(),
  percent: decimal("percent", { precision: 5, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  policyRef: text("policy_ref").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAllocationSchema = createInsertSchema(allocations).omit({
  id: true,
  createdAt: true,
});

export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocations.$inferSelect;

// Atlas Endpoints - Personal Pulse
export const atlasEndpointStatuses = ["pending", "validated", "failed"] as const;

export const atlasEndpoints = pgTable("atlas_endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  displayName: text("display_name").notNull(),
  status: text("status", { enum: atlasEndpointStatuses }).notNull().default("pending"),
  protocolVersion: text("protocol_version"),
  telemetryCaps: jsonb("telemetry_caps"),
  lastValidationAt: timestamp("last_validation_at"),
  lastMetricsFetchAt: timestamp("last_metrics_fetch_at"),
  metricsCache: jsonb("metrics_cache"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAtlasEndpointSchema = createInsertSchema(atlasEndpoints).omit({
  id: true,
  createdAt: true,
});

export type InsertAtlasEndpoint = z.infer<typeof insertAtlasEndpointSchema>;
export type AtlasEndpoint = typeof atlasEndpoints.$inferSelect;

// Telemetry Events Table
export const telemetryEvents = pgTable("telemetry_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type", { enum: telemetryEventTypes }).notNull(),
  sessionId: text("session_id").notNull(),
  hashedIp: text("hashed_ip").notNull(),
  geoRegion: text("geo_region"),
  device: text("device"),
  uaHash: text("ua_hash"),
  ts: timestamp("ts").notNull().defaultNow(),
  fraudScore: decimal("fraud_score", { precision: 3, scale: 2 }),
});

export const insertTelemetryEventSchema = createInsertSchema(telemetryEvents).omit({
  id: true,
  ts: true,
});

export type InsertTelemetryEvent = z.infer<typeof insertTelemetryEventSchema>;
export type TelemetryEvent = typeof telemetryEvents.$inferSelect;

// Page Analytics Table - Production-grade site analytics
export const pageAnalytics = pgTable("page_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  route: text("route").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  deviceType: text("device_type"),
  browser: text("browser"),
  country: text("country"),
  hashedIp: text("hashed_ip").notNull(),
  sessionId: text("session_id"),
  walletAddress: text("wallet_address"),
  ts: timestamp("ts").notNull().defaultNow(),
});

export const insertPageAnalyticsSchema = createInsertSchema(pageAnalytics).omit({
  id: true,
  ts: true,
});

export type InsertPageAnalytics = z.infer<typeof insertPageAnalyticsSchema>;
export type PageAnalytics = typeof pageAnalytics.$inferSelect;

// Wallet Registry Table
export const walletRegistry = pgTable("wallet_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: text("wallet_id").notNull().unique(),
  name: text("name").notNull(),
  deepLinkTemplate: text("deep_link_template"),
  qrTemplate: text("qr_template"),
  installedCheckScript: text("installed_check_script"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletRegistrySchema = createInsertSchema(walletRegistry).omit({
  id: true,
  createdAt: true,
});

export type InsertWalletRegistry = z.infer<typeof insertWalletRegistrySchema>;
export type WalletRegistry = typeof walletRegistry.$inferSelect;

// Call Sessions Table
export const callSessions = pgTable("call_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: text("room_id").notNull(),
  participantsHashes: text("participants_hashes").array().notNull(),
  mediaType: text("media_type", { enum: mediaTypes }).notNull(),
  startTx: text("start_tx"),
  endTx: text("end_tx"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationSec: integer("duration_sec"),
  metricsSummary: jsonb("metrics_summary"),
  immutableSeq: integer("immutable_seq").notNull(),
});

export const insertCallSessionSchema = createInsertSchema(callSessions).omit({
  id: true,
});

export type InsertCallSession = z.infer<typeof insertCallSessionSchema>;
export type CallSession = typeof callSessions.$inferSelect;

// Telemetry Voice Table
export const telemetryVoice = pgTable("telemetry_voice", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomHash: text("room_hash").notNull(),
  sessionId: text("session_id").notNull(),
  rttMs: integer("rtt_ms"),
  jitterMs: integer("jitter_ms"),
  packetsLostPct: decimal("packets_lost_pct", { precision: 5, scale: 2 }),
  bitrateKbps: integer("bitrate_kbps"),
  codec: text("codec"),
  audioLevel: integer("audio_level"),
  iceState: text("ice_state"),
  ts: timestamp("ts").notNull().defaultNow(),
});

export const insertTelemetryVoiceSchema = createInsertSchema(telemetryVoice).omit({
  id: true,
  ts: true,
});

export type InsertTelemetryVoice = z.infer<typeof insertTelemetryVoiceSchema>;
export type TelemetryVoice = typeof telemetryVoice.$inferSelect;

// API Request Metrics Table - for efficiency tracking
export const apiRequestMetrics = pgTable("api_request_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  requestBytes: integer("request_bytes"),
  responseBytes: integer("response_bytes"),
  latencyMs: integer("latency_ms").notNull(),
  statusCode: integer("status_code").notNull(),
  isAtlasApi: boolean("is_atlas_api").notNull().default(true),
  sessionReused: boolean("session_reused").default(false),
  ts: timestamp("ts").notNull().defaultNow(),
});

export const insertApiRequestMetricsSchema = createInsertSchema(apiRequestMetrics).omit({
  id: true,
  ts: true,
});

export type InsertApiRequestMetrics = z.infer<typeof insertApiRequestMetricsSchema>;
export type ApiRequestMetrics = typeof apiRequestMetrics.$inferSelect;

// Trust Layer Tables

// Trust Config Table (Configuration Journal)
export const trustConfig = pgTable("trust_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrustConfigSchema = createInsertSchema(trustConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrustConfig = z.infer<typeof insertTrustConfigSchema>;
export type TrustConfig = typeof trustConfig.$inferSelect;

// Trust Rules Table (Smart Rules Engine)
export const trustRuleStatuses = ["active", "inactive", "testing"] as const;

export const trustRules = pgTable("trust_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  condition: jsonb("condition").notNull(),
  action: jsonb("action").notNull(),
  priority: integer("priority").notNull().default(100),
  status: text("status", { enum: trustRuleStatuses }).notNull().default("active"),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecutedAt: timestamp("last_executed_at"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrustRuleSchema = createInsertSchema(trustRules).omit({
  id: true,
  executionCount: true,
  lastExecutedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTrustRule = z.infer<typeof insertTrustRuleSchema>;
export type TrustRule = typeof trustRules.$inferSelect;

// Trust Plugins Table (Plugin Registry)
export const pluginStatuses = ["enabled", "disabled"] as const;

export const trustPlugins = pgTable("trust_plugins", {
  id: uuid("id").primaryKey().defaultRandom(),
  pluginId: text("plugin_id").notNull().unique(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  config: jsonb("config"),
  status: text("status", { enum: pluginStatuses }).notNull().default("enabled"),
  installedBy: uuid("installed_by").notNull().references(() => users.id),
  installedAt: timestamp("installed_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrustPluginSchema = createInsertSchema(trustPlugins).omit({
  id: true,
  installedAt: true,
  updatedAt: true,
});

export type InsertTrustPlugin = z.infer<typeof insertTrustPluginSchema>;
export type TrustPlugin = typeof trustPlugins.$inferSelect;

// Bridge Jobs Table (Cross-Chain Receipt Relay)
export const bridgeJobStatuses = ["pending", "relaying", "confirmed", "failed"] as const;
export const targetChains = ["polygon", "arbitrum", "optimism"] as const;

export const bridgeJobs = pgTable("bridge_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  receiptId: uuid("receipt_id").notNull().references(() => receipts.id),
  docHash: text("doc_hash").notNull(),
  sourceChain: text("source_chain").notNull().default("base"),
  targetChain: text("target_chain", { enum: targetChains }).notNull(),
  status: text("status", { enum: bridgeJobStatuses }).notNull().default("pending"),
  txHash: text("tx_hash"),
  confirmations: integer("confirmations").notNull().default(0),
  requiredConfirmations: integer("required_confirmations").notNull().default(12),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  lastError: text("last_error"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const insertBridgeJobSchema = createInsertSchema(bridgeJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBridgeJob = z.infer<typeof insertBridgeJobSchema>;
export type BridgeJob = typeof bridgeJobs.$inferSelect;

// App Layer Tables

// Messages Table (Encrypted Messaging)
export const messageTypes = ["text", "voice", "video"] as const;
export const messageStatuses = ["sent", "delivered", "read", "failed"] as const;
export const anchorStatuses = ["pending", "confirmed", "failed", "none"] as const;

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  messageType: text("message_type", { enum: messageTypes }).notNull().default("text"),
  encryptedContent: text("encrypted_content").notNull(),
  contentHash: text("content_hash").notNull(),
  ipfsCid: text("ipfs_cid"),
  receiptId: uuid("receipt_id").references(() => receipts.id),
  anchorTxHash: text("anchor_tx_hash"),
  anchorStatus: text("anchor_status", { enum: anchorStatuses }).notNull().default("none"),
  anchorTimestamp: timestamp("anchor_timestamp"),
  status: text("status", { enum: messageStatuses }).notNull().default("sent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Notes Table (Wallet-Scoped Notes)
export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  title: text("title").notNull(),
  encryptedBody: text("encrypted_body").notNull(),
  searchableContent: text("searchable_content"),
  tags: text("tags").array(),
  isPinned: integer("is_pinned").notNull().default(0),
  ipfsCid: text("ipfs_cid"),
  receiptId: uuid("receipt_id").references(() => receipts.id),
  anchorTxHash: text("anchor_tx_hash"),
  anchorChainId: integer("anchor_chain_id"),
  anchorStatus: text("anchor_status", { enum: anchorStatuses }).notNull().default("none"),
  anchorTimestamp: timestamp("anchor_timestamp"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

// Directory Table (ENS/Basename Resolution)
export const directoryEntries = pgTable("directory_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull().unique(),
  ensName: text("ens_name"),
  basename: text("basename"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isVerified: integer("is_verified").notNull().default(0),
  metadata: jsonb("metadata"),
  lastResolvedAt: timestamp("last_resolved_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDirectoryEntrySchema = createInsertSchema(directoryEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDirectoryEntry = z.infer<typeof insertDirectoryEntrySchema>;
export type DirectoryEntry = typeof directoryEntries.$inferSelect;

// Hub Categories Table (Community-governed app categories)
export const hubCategoryStatuses = ["active", "archived"] as const;

export const hubCategories = pgTable("hub_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  icon: text("icon").notNull().default("📦"),
  color: text("color").notNull().default("violet"),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  status: text("status", { enum: hubCategoryStatuses }).notNull().default("active"),
  appCount: integer("app_count").notNull().default(0),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertHubCategorySchema = createInsertSchema(hubCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHubCategory = z.infer<typeof insertHubCategorySchema>;
export type HubCategory = typeof hubCategories.$inferSelect;

// Inbox Items Table (Message Inbox)
export const inboxStatuses = ["unread", "read", "archived", "deleted"] as const;

export const inboxItems = pgTable("inbox_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  messageId: uuid("message_id").notNull().references(() => messages.id),
  status: text("status", { enum: inboxStatuses }).notNull().default("unread"),
  isStarred: integer("is_starred").notNull().default(0),
  labels: text("labels").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInboxItemSchema = createInsertSchema(inboxItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInboxItem = z.infer<typeof insertInboxItemSchema>;
export type InboxItem = typeof inboxItems.$inferSelect;

// DAO Proposals Table (Governance)
export const proposalStatuses = ["pending", "active", "canceled", "defeated", "succeeded", "queued", "expired", "executed"] as const;

export const daoProposals = pgTable("dao_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: text("proposal_id").notNull().unique(),
  proposer: text("proposer").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  targets: text("targets").array().notNull(),
  values: text("values").array().notNull(),
  calldatas: text("calldatas").array().notNull(),
  status: text("status", { enum: proposalStatuses }).notNull().default("pending"),
  votesFor: text("votes_for").notNull().default("0"),
  votesAgainst: text("votes_against").notNull().default("0"),
  votesAbstain: text("votes_abstain").notNull().default("0"),
  startBlock: text("start_block"),
  endBlock: text("end_block"),
  eta: timestamp("eta"),
  txHash: text("tx_hash"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDaoProposalSchema = createInsertSchema(daoProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDaoProposal = z.infer<typeof insertDaoProposalSchema>;
export type DaoProposal = typeof daoProposals.$inferSelect;

// DAO Votes Table (Individual Vote Records)
export const voteChoices = ["for", "against", "abstain"] as const;

export const daoVotes = pgTable("dao_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull().references(() => daoProposals.id),
  voter: text("voter").notNull(),
  choice: text("choice", { enum: voteChoices }).notNull(),
  votingPower: text("voting_power").notNull().default("0"),
  txHash: text("tx_hash"),
  anchorQueued: boolean("anchor_queued").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDaoVoteSchema = createInsertSchema(daoVotes).omit({
  id: true,
  createdAt: true,
});

export type InsertDaoVote = z.infer<typeof insertDaoVoteSchema>;
export type DaoVote = typeof daoVotes.$inferSelect;

// Payment Transactions Table
export const paymentStatuses = ["pending", "confirmed", "failed"] as const;
export const paymentAssets = ["ETH", "USDC", "USDT", "DAI"] as const;

export const paymentTransactions = pgTable("payment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  asset: text("asset", { enum: paymentAssets }).notNull(),
  amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
  gasEstimate: decimal("gas_estimate", { precision: 20, scale: 8 }),
  gasFee: decimal("gas_fee", { precision: 20, scale: 8 }),
  totalAmount: decimal("total_amount", { precision: 20, scale: 8 }).notNull(),
  status: text("status", { enum: paymentStatuses }).notNull().default("pending"),
  txHash: text("tx_hash"),
  chainId: text("chain_id").notNull().default("8453"),
  anchorTxHash: text("anchor_tx_hash"),
  anchorStatus: text("anchor_status", { enum: anchorStatuses }).notNull().default("none"),
  anchorTimestamp: timestamp("anchor_timestamp"),
  receiptId: uuid("receipt_id").references(() => receipts.id),
  toEnsName: text("to_ens_name"),
  toBasename: text("to_basename"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

// Payments Table (Phase 1 Stream A - Payments System)
export const paymentStatusValues = ["pending", "confirmed", "failed"] as const;

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  txHash: varchar("tx_hash", { length: 66 }).notNull().unique(),
  chainId: integer("chain_id").notNull(),
  fromAddress: varchar("from_address", { length: 42 }).notNull(),
  toAddress: varchar("to_address", { length: 42 }).notNull(),
  amount: varchar("amount", { length: 78 }).notNull(),
  token: varchar("token", { length: 42 }),
  tokenSymbol: varchar("token_symbol", { length: 20 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  memo: text("memo"),
  proofCid: varchar("proof_cid", { length: 100 }),
  gasUsed: varchar("gas_used", { length: 78 }),
  blockNumber: integer("block_number"),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  timestamp: true,
});

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// Address Index Table (Phase 1 Stream A - Payments System)
export const addressIndex = pgTable("address_index", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 42 }).notNull().unique(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  chains: jsonb("chains").$type<number[]>(),
  paymentCount: integer("payment_count").default(0),
});

export const insertAddressIndexSchema = createInsertSchema(addressIndex).omit({
  id: true,
});

export type InsertAddressIndex = z.infer<typeof insertAddressIndexSchema>;
export type AddressIndex = typeof addressIndex.$inferSelect;

// Install Tokens Table (for Session Bridge)
export const installTokens = pgTable("install_tokens", {
  token: varchar("token", { length: 64 }).primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  appMode: boolean("app_mode").default(false).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isConsumed: boolean("is_consumed").default(false).notNull(),
  consumedAt: timestamp("consumed_at"),
  sessionData: text("session_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstallTokenSchema = createInsertSchema(installTokens).omit({
  createdAt: true,
  consumedAt: true,
  isConsumed: true,
});

export type InstallToken = typeof installTokens.$inferSelect;
export type InsertInstallToken = z.infer<typeof insertInstallTokenSchema>;

// ZK Encrypted Messages Table (E2E encrypted message queue with IPFS storage)
export const zkMessageStatuses = ["queued", "sent", "delivered", "read", "failed"] as const;

export const zkMessages = pgTable("zk_messages", {
  id: serial("id").primaryKey(),
  sender: varchar("sender", { length: 42 }).notNull(),
  recipient: varchar("recipient", { length: 42 }).notNull(),
  cid: varchar("cid", { length: 100 }).notNull(),
  nonce: varchar("nonce", { length: 64 }).notNull(),
  wrappedKey: text("wrapped_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  tags: text("tags").array(),
  threadId: varchar("thread_id", { length: 100 }),
});

export const insertZkMessageSchema = createInsertSchema(zkMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertZkMessage = z.infer<typeof insertZkMessageSchema>;
export type ZkMessage = typeof zkMessages.$inferSelect;

// Public Keys Table (Encryption key registry)
export const pubkeys = pgTable("pubkeys", {
  id: serial("id").primaryKey(),
  address: varchar("address", { length: 42 }).unique().notNull(),
  pubkey: text("pubkey").notNull(),
  source: varchar("source", { length: 50 }).notNull(),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow().notNull(),
  kyberPubB64: text("kyber_pub_b64"),
  kyberEnabled: boolean("kyber_enabled").default(false),
});

export const insertPubkeySchema = createInsertSchema(pubkeys).omit({
  id: true,
});

export type InsertPubkey = z.infer<typeof insertPubkeySchema>;
export type Pubkey = typeof pubkeys.$inferSelect;

// Quarantine Items Table (suspicious inbound events)
export const quarantineItems = pgTable("quarantine_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  sender: varchar("sender", { length: 255 }).notNull(),
  reason: text("reason").notNull(),
  payload: jsonb("payload"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
  releasedBy: uuid("released_by").references(() => users.id),
});

export const insertQuarantineItemSchema = createInsertSchema(quarantineItems).omit({
  id: true,
  createdAt: true,
  releasedAt: true,
  releasedBy: true,
});

export type InsertQuarantineItem = z.infer<typeof insertQuarantineItemSchema>;
export type QuarantineItem = typeof quarantineItems.$inferSelect;

// Wallet Crypto Keys Table (encrypted keypairs for server-side crypto)
export const walletKeys = pgTable("wallet_keys", {
  id: serial("id").primaryKey(),
  wallet: varchar("wallet", { length: 42 }).unique().notNull(),
  encryptedBoxSecret: text("encrypted_box_secret").notNull(),
  boxPublicKey: text("box_public_key").notNull(),
  encryptedSignSecret: text("encrypted_sign_secret").notNull(),
  signPublicKey: text("sign_public_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
});

export const insertWalletKeySchema = createInsertSchema(walletKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type InsertWalletKey = z.infer<typeof insertWalletKeySchema>;
export type WalletKey = typeof walletKeys.$inferSelect;

// Anchor Outbox Table (durable queue pattern for crash recovery)
export const anchorOutbox = pgTable("anchor_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  appId: varchar("app_id", { length: 100 }).notNull(),
  digest: varchar("digest", { length: 128 }).notNull(),
  payload: jsonb("payload").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),
  lastError: text("last_error"),
  heartbeatAt: timestamp("heartbeat_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAnchorOutboxSchema = createInsertSchema(anchorOutbox).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnchorOutbox = z.infer<typeof insertAnchorOutboxSchema>;
export type AnchorOutbox = typeof anchorOutbox.$inferSelect;

// Anchor Receipts Table (exactly-once semantics via unique idempotency key)
export const anchorReceipts = pgTable("anchor_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  idempotencyKey: varchar("idempotency_key", { length: 255 }).unique().notNull(),
  outboxId: uuid("outbox_id").references(() => anchorOutbox.id),
  txHash: varchar("tx_hash", { length: 100 }),
  blockNumber: integer("block_number"),
  status: varchar("status", { length: 20 }).notNull().default("submitted"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnchorReceiptSchema = createInsertSchema(anchorReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertAnchorReceipt = z.infer<typeof insertAnchorReceiptSchema>;
export type AnchorReceipt = typeof anchorReceipts.$inferSelect;

// ============================================================================
// MARKETPLACE DATA MODELS
// Multi-vertical marketplace infrastructure for ebooks, music, video, courses,
// games, data, and art
// ============================================================================

// Asset types for marketplace verticals
export const marketplaceAssetTypes = [
  "ebook", "track", "album", "video", "course", "module", 
  "game", "dlc", "dataset", "art", "edition"
] as const;

export const marketplacePolicies = [
  "perpetual", "lend_days", "subscription_monthly", "subscription_yearly",
  "stream_ppv", "stream_sub", "rental_hours", "enrollment", "api_access"
] as const;

export const marketplaceAssetStatuses = ["draft", "published", "archived", "suspended"] as const;
export const marketplaceLicenseStatuses = ["active", "expired", "revoked", "pending"] as const;

export const settleModes = ["BASE_USDC", "BASE_DIRECT", "RELAY_LZ", "RELAY_WH"] as const;
export const relayStatuses = ["pending", "confirmed", "failed"] as const;
export const marketplaceReceiptTypes = [
  "checkout", "borrow", "stream", "view", "download", "enroll", 
  "complete", "payout", "subscription_renewal", "dlc_purchase", "edition_purchase"
] as const;

// Marketplace Assets Table
export const marketplaceAssets = pgTable("marketplace_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 20 }).notNull(),
  authorWallet: varchar("author_wallet", { length: 42 }).notNull(),
  appId: varchar("app_id", { length: 100 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  tags: text("tags").array(),
  metadataUri: text("metadata_uri"),
  coverImageCid: varchar("cover_image_cid", { length: 100 }),
  ipfsCidEnc: varchar("ipfs_cid_enc", { length: 100 }),
  filesize: integer("filesize"),
  mime: varchar("mime", { length: 100 }),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  policy: varchar("policy", { length: 30 }).notNull().default("perpetual"),
  policyParams: jsonb("policy_params"),
  splitAuthorPct: integer("split_author_pct").notNull().default(85),
  splitMarketplacePct: integer("split_marketplace_pct").notNull().default(10),
  splitSponsorPct: integer("split_sponsor_pct").notNull().default(5),
  encryptionAlg: varchar("encryption_alg", { length: 50 }).default("xchacha20-poly1305"),
  envelopeVersion: varchar("envelope_version", { length: 10 }).default("1.0"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  parentAssetId: uuid("parent_asset_id"),
  editionCount: integer("edition_count"),
  editionsSold: integer("editions_sold").default(0),
  totalDownloads: integer("total_downloads").default(0),
  totalStreams: integer("total_streams").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketplaceAssetSchema = createInsertSchema(marketplaceAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  editionsSold: true,
  totalDownloads: true,
  totalStreams: true,
});

export type InsertMarketplaceAsset = z.infer<typeof insertMarketplaceAssetSchema>;
export type MarketplaceAsset = typeof marketplaceAssets.$inferSelect;

// Marketplace Licenses Table (tickets for access)
export const marketplaceLicenses = pgTable("marketplace_licenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  assetId: uuid("asset_id").notNull().references(() => marketplaceAssets.id),
  buyerWallet: varchar("buyer_wallet", { length: 42 }).notNull(),
  appId: varchar("app_id", { length: 100 }).notNull(),
  policy: varchar("policy", { length: 30 }).notNull(),
  expiresAt: timestamp("expires_at"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  decryptTokenJti: varchar("decrypt_token_jti", { length: 64 }),
  receiptAnchorId: uuid("receipt_anchor_id"),
  pricePaidUsd: decimal("price_paid_usd", { precision: 10, scale: 2 }),
  settleMode: varchar("settle_mode", { length: 20 }).default("BASE_USDC"),
  originChain: varchar("origin_chain", { length: 50 }),
  feeCurrency: varchar("fee_currency", { length: 20 }).default("USDC"),
  txHashBase: varchar("tx_hash_base", { length: 100 }),
  relayStatus: varchar("relay_status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketplaceLicenseSchema = createInsertSchema(marketplaceLicenses).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketplaceLicense = z.infer<typeof insertMarketplaceLicenseSchema>;
export type MarketplaceLicense = typeof marketplaceLicenses.$inferSelect;

// Marketplace Receipts Table (anchored proofs)
export const marketplaceReceipts = pgTable("marketplace_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type", { length: 30 }).notNull(),
  assetId: uuid("asset_id").references(() => marketplaceAssets.id),
  buyerWallet: varchar("buyer_wallet", { length: 42 }),
  authorWallet: varchar("author_wallet", { length: 42 }),
  appId: varchar("app_id", { length: 100 }).notNull(),
  digest: varchar("digest", { length: 128 }).notNull(),
  txHash: varchar("tx_hash", { length: 100 }),
  chain: varchar("chain", { length: 20 }).default("base"),
  status: varchar("status", { length: 20 }).notNull().default("submitted"),
  anchorId: varchar("anchor_id", { length: 100 }),
  blockNumber: integer("block_number"),
  confirmations: integer("confirmations").default(0),
  batchId: varchar("batch_id", { length: 64 }),
  batchDigests: jsonb("batch_digests"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketplaceReceiptSchema = createInsertSchema(marketplaceReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketplaceReceipt = z.infer<typeof insertMarketplaceReceiptSchema>;
export type MarketplaceReceipt = typeof marketplaceReceipts.$inferSelect;

// Treasury Config Table (author payouts and sponsorship)
export const treasuryConfigs = pgTable("treasury_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorWallet: varchar("author_wallet", { length: 42 }).notNull().unique(),
  payoutWallet: varchar("payout_wallet", { length: 42 }).notNull(),
  sponsorPayGas: boolean("sponsor_pay_gas").default(false),
  sponsorPayAnchorFees: boolean("sponsor_pay_anchor_fees").default(false),
  settlementCadence: varchar("settlement_cadence", { length: 20 }).default("weekly"),
  splitDefaultAuthor: integer("split_default_author").default(85),
  splitDefaultMarketplace: integer("split_default_marketplace").default(10),
  splitDefaultSponsor: integer("split_default_sponsor").default(5),
  totalEarnedUsd: decimal("total_earned_usd", { precision: 12, scale: 2 }).default("0"),
  totalPaidOutUsd: decimal("total_paid_out_usd", { precision: 12, scale: 2 }).default("0"),
  pendingPayoutUsd: decimal("pending_payout_usd", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTreasuryConfigSchema = createInsertSchema(treasuryConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalEarnedUsd: true,
  totalPaidOutUsd: true,
  pendingPayoutUsd: true,
});

export type InsertTreasuryConfig = z.infer<typeof insertTreasuryConfigSchema>;
export type TreasuryConfig = typeof treasuryConfigs.$inferSelect;

// Marketplace App Manifests Table
export const marketplaceManifests = pgTable("marketplace_manifests", {
  id: varchar("id", { length: 100 }).primaryKey(),
  type: varchar("type", { length: 30 }).notNull().default("marketplace"),
  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  icon: text("icon"),
  version: varchar("version", { length: 20 }).notNull(),
  routes: jsonb("routes").notNull(),
  api: jsonb("api").notNull(),
  requirements: jsonb("requirements"),
  capabilities: jsonb("capabilities"),
  authorWallet: varchar("author_wallet", { length: 42 }),
  signature: text("signature"),
  isVerified: boolean("is_verified").default(false),
  isListed: boolean("is_listed").default(true),
  pingStatus: varchar("ping_status", { length: 20 }).default("unknown"),
  lastPingAt: timestamp("last_ping_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMarketplaceManifestSchema = createInsertSchema(marketplaceManifests).omit({
  createdAt: true,
  updatedAt: true,
  pingStatus: true,
  lastPingAt: true,
});

export type InsertMarketplaceManifest = z.infer<typeof insertMarketplaceManifestSchema>;
export type MarketplaceManifest = typeof marketplaceManifests.$inferSelect;

// Marketplace Settlements Table (payout records)
export const marketplaceSettlements = pgTable("marketplace_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorWallet: varchar("author_wallet", { length: 42 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalGrossUsd: decimal("total_gross_usd", { precision: 12, scale: 2 }).notNull(),
  authorPayoutUsd: decimal("author_payout_usd", { precision: 12, scale: 2 }).notNull(),
  marketplaceFeeUsd: decimal("marketplace_fee_usd", { precision: 12, scale: 2 }).notNull(),
  anchorFeesPaidUsd: decimal("anchor_fees_paid_usd", { precision: 12, scale: 2 }).default("0"),
  txHash: varchar("tx_hash", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  anchorId: varchar("anchor_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketplaceSettlementSchema = createInsertSchema(marketplaceSettlements).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketplaceSettlement = z.infer<typeof insertMarketplaceSettlementSchema>;
export type MarketplaceSettlement = typeof marketplaceSettlements.$inferSelect;

// Stream/Play Batches Table (for music/video batch anchoring)
export const streamBatches = pgTable("stream_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: varchar("app_id", { length: 100 }).notNull(),
  assetId: uuid("asset_id").references(() => marketplaceAssets.id),
  authorWallet: varchar("author_wallet", { length: 42 }).notNull(),
  playCount: integer("play_count").notNull().default(0),
  playDigests: jsonb("play_digests"),
  batchDigest: varchar("batch_digest", { length: 128 }),
  anchorId: varchar("anchor_id", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStreamBatchSchema = createInsertSchema(streamBatches).omit({
  id: true,
  createdAt: true,
});

export type InsertStreamBatch = z.infer<typeof insertStreamBatchSchema>;
export type StreamBatch = typeof streamBatches.$inferSelect;

// ============================================================================
// Platform Moderation Tables
// ============================================================================

// Moderator Roles - persistent role assignments for Hub governance
export const moderatorRoleTypes = ["superuser", "admin", "moderator", "reviewer"] as const;
export const moderatorStatuses = ["active", "suspended", "revoked"] as const;

export const moderatorRoles = pgTable("moderator_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  role: text("role", { enum: moderatorRoleTypes }).notNull().default("reviewer"),
  status: text("status", { enum: moderatorStatuses }).notNull().default("active"),
  permissions: jsonb("permissions"),
  assignedBy: varchar("assigned_by", { length: 42 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertModeratorRoleSchema = createInsertSchema(moderatorRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertModeratorRole = z.infer<typeof insertModeratorRoleSchema>;
export type ModeratorRole = typeof moderatorRoles.$inferSelect;

// Moderation Actions - audit trail for all moderation decisions
export const moderationActionTypes = [
  "hide_app", "show_app", "delete_review", "dismiss_report",
  "ban_user", "unban_user", "approve_widget", "reject_widget",
  "change_category", "assign_role", "revoke_role", "suspend_role"
] as const;

export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actionType: text("action_type", { enum: moderationActionTypes }).notNull(),
  moderatorWallet: varchar("moderator_wallet", { length: 42 }).notNull(),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: varchar("target_id", { length: 100 }).notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  anchorId: varchar("anchor_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({
  id: true,
  createdAt: true,
});

export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type ModerationAction = typeof moderationActions.$inferSelect;

// Platform Reports - user-submitted reports for moderation review
export const reportStatuses = ["pending", "reviewing", "resolved", "dismissed"] as const;
export const reportTypes = ["app", "review", "user", "content", "widget"] as const;

export const platformReports = pgTable("platform_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportType: text("report_type", { enum: reportTypes }).notNull(),
  targetId: varchar("target_id", { length: 100 }).notNull(),
  reason: text("reason").notNull(),
  description: text("description"),
  reporterWallet: varchar("reporter_wallet", { length: 42 }).notNull(),
  status: text("status", { enum: reportStatuses }).notNull().default("pending"),
  assignedTo: varchar("assigned_to", { length: 42 }),
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by", { length: 42 }),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlatformReportSchema = createInsertSchema(platformReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformReport = z.infer<typeof insertPlatformReportSchema>;
export type PlatformReport = typeof platformReports.$inferSelect;

// Banned Wallets - permanently or temporarily banned addresses
export const banTypes = ["permanent", "temporary"] as const;

export const bannedWallets = pgTable("banned_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  banType: text("ban_type", { enum: banTypes }).notNull().default("permanent"),
  reason: text("reason"),
  bannedBy: varchar("banned_by", { length: 42 }).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBannedWalletSchema = createInsertSchema(bannedWallets).omit({
  id: true,
  createdAt: true,
});

export type InsertBannedWallet = z.infer<typeof insertBannedWalletSchema>;
export type BannedWallet = typeof bannedWallets.$inferSelect;

// ============================================================================
// ENTERPRISE SCHEMA TABLES
// Multi-tenant enterprise infrastructure for API management, billing, SSO,
// compliance, and SLA monitoring
// ============================================================================

// API Key statuses
export const apiKeyStatuses = ["active", "revoked", "expired"] as const;

// API Keys Table - Enterprise API key management
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyHash: varchar("key_hash", { length: 128 }).notNull(),
  walletOwner: varchar("wallet_owner", { length: 64 }).notNull(),
  tierId: integer("tier_id"),
  quotaMonthly: integer("quota_monthly").notNull().default(100000),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// API Usage Table - Track API consumption per key
export const apiUsage = pgTable("api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyId: uuid("key_id").notNull().references(() => apiKeys.id),
  endpoint: varchar("endpoint", { length: 128 }).notNull(),
  count: integer("count").notNull().default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  lastHitAt: timestamp("last_hit_at"),
});

export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({
  id: true,
});

export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;

// Subscription Tiers Table - Pricing and feature tiers
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 64 }).notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  featuresJson: jsonb("features_json"),
  quotaMonthly: integer("quota_monthly").notNull(),
  overagePricePerUnit: decimal("overage_price_per_unit", { precision: 10, scale: 6 }),
});

export const insertSubscriptionTierSchema = createInsertSchema(subscriptionTiers).omit({
  id: true,
});

export type InsertSubscriptionTier = z.infer<typeof insertSubscriptionTierSchema>;
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;

// Billing Accounts Table - Stripe integration for tenant billing
export const billingAccounts = pgTable("billing_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
  activePaymentMethod: varchar("active_payment_method", { length: 64 }),
  delinquent: boolean("delinquent").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBillingAccountSchema = createInsertSchema(billingAccounts).omit({
  id: true,
  createdAt: true,
});

export type InsertBillingAccount = z.infer<typeof insertBillingAccountSchema>;
export type BillingAccount = typeof billingAccounts.$inferSelect;

// Protocol State Table - Global protocol pause/unpause state
export const protocolState = pgTable("protocol_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  paused: boolean("paused").notNull().default(false),
  reason: text("reason"),
  actorWallet: varchar("actor_wallet", { length: 42 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProtocolStateSchema = createInsertSchema(protocolState).omit({
  id: true,
  updatedAt: true,
});

export type InsertProtocolState = z.infer<typeof insertProtocolStateSchema>;
export type ProtocolState = typeof protocolState.$inferSelect;

// Audit Anchor Batch statuses
export const auditAnchorBatchStatuses = ["pending", "anchored", "failed"] as const;

// Audit Anchor Batches Table - Batch anchoring for compliance audit trails
export const auditAnchorBatches = pgTable("audit_anchor_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchRootHash: varchar("batch_root_hash", { length: 66 }).notNull(),
  count: integer("count").notNull(),
  anchoredTxHash: varchar("anchored_tx_hash", { length: 66 }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditAnchorBatchSchema = createInsertSchema(auditAnchorBatches).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditAnchorBatch = z.infer<typeof insertAuditAnchorBatchSchema>;
export type AuditAnchorBatch = typeof auditAnchorBatches.$inferSelect;

// Alert Channel types
export const alertChannelTypes = ["email", "slack", "webhook"] as const;

// Alert Channels Table - Notification endpoints for tenant alerts
export const alertChannels = pgTable("alert_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  endpoint: varchar("endpoint", { length: 256 }).notNull(),
  secret: varchar("secret", { length: 256 }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertChannelSchema = createInsertSchema(alertChannels).omit({
  id: true,
  createdAt: true,
});

export type InsertAlertChannel = z.infer<typeof insertAlertChannelSchema>;
export type AlertChannel = typeof alertChannels.$inferSelect;

// Alert Rules Table - Configurable alerting thresholds
export const alertRules = pgTable("alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 64 }).notNull(),
  threshold: integer("threshold").notNull(),
  windowMinutes: integer("window_minutes").notNull().default(15),
  active: boolean("active").notNull().default(true),
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
});

export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

// SSO Provider types
export const ssoProviderTypes = ["oauth2", "saml"] as const;

// SSO Providers Table - Enterprise SSO configuration
export const ssoProviders = pgTable("sso_providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  issuer: varchar("issuer", { length: 256 }).notNull(),
  clientId: varchar("client_id", { length: 256 }).notNull(),
  clientSecret: varchar("client_secret", { length: 256 }),
  callbackUrl: varchar("callback_url", { length: 256 }),
  metadataUrl: varchar("metadata_url", { length: 256 }),
  active: boolean("active").notNull().default(true),
});

export const insertSsoProviderSchema = createInsertSchema(ssoProviders).omit({
  id: true,
});

export type InsertSsoProvider = z.infer<typeof insertSsoProviderSchema>;
export type SsoProvider = typeof ssoProviders.$inferSelect;

// SSO Identities Table - User identity mappings from SSO providers
export const ssoIdentities = pgTable("sso_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  subject: varchar("subject", { length: 256 }).notNull(),
  wallet: varchar("wallet", { length: 64 }).notNull(),
  roles: jsonb("roles"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSsoIdentitySchema = createInsertSchema(ssoIdentities).omit({
  id: true,
  createdAt: true,
});

export type InsertSsoIdentity = z.infer<typeof insertSsoIdentitySchema>;
export type SsoIdentity = typeof ssoIdentities.$inferSelect;

// Tenant Policies Table - Per-tenant feature flags and sandbox config
export const tenantPolicies = pgTable("tenant_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull().unique(),
  sandbox: boolean("sandbox").notNull().default(false),
  sandboxChain: varchar("sandbox_chain", { length: 32 }),
  featuresJson: jsonb("features_json"),
});

export const insertTenantPolicySchema = createInsertSchema(tenantPolicies).omit({
  id: true,
});

export type InsertTenantPolicy = z.infer<typeof insertTenantPolicySchema>;
export type TenantPolicy = typeof tenantPolicies.$inferSelect;

// SLA Metrics Table - Service level agreement tracking
export const slaMetrics = pgTable("sla_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 128 }).notNull(),
  latencyMsP50: integer("latency_ms_p50").notNull().default(0),
  latencyMsP95: integer("latency_ms_p95").notNull().default(0),
  uptimePct: decimal("uptime_pct", { precision: 5, scale: 2 }).notNull().default("100.00"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSlaMetricSchema = createInsertSchema(slaMetrics).omit({
  id: true,
  updatedAt: true,
});

export type InsertSlaMetric = z.infer<typeof insertSlaMetricSchema>;
export type SlaMetric = typeof slaMetrics.$inferSelect;

// Privacy Request types
export const privacyRequestTypes = ["delete", "export", "consent_withdraw"] as const;
export const privacyRequestStatuses = ["received", "processing", "completed", "failed"] as const;

// Privacy Requests Table - GDPR/CCPA compliance requests
export const privacyRequests = pgTable("privacy_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  requesterWalletOrEmail: varchar("requester_wallet_or_email", { length: 128 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("received"),
  scopeJson: jsonb("scope_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertPrivacyRequestSchema = createInsertSchema(privacyRequests).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertPrivacyRequest = z.infer<typeof insertPrivacyRequestSchema>;
export type PrivacyRequest = typeof privacyRequests.$inferSelect;

// Analytics Event Types
export const analyticsEventTypes = [
  "api_call", "app_install", "app_launch", "marketplace_view", 
  "marketplace_purchase", "role_change", "pause_event", "anchor_batch"
] as const;

// Analytics Events Table - Raw event ingestion
export const analyticEvents = pgTable("analytic_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  walletId: varchar("wallet_id", { length: 64 }),
  apiKeyId: uuid("api_key_id"),
  sessionId: varchar("session_id", { length: 128 }),
  endpoint: varchar("endpoint", { length: 256 }),
  method: varchar("method", { length: 10 }),
  latencyMs: integer("latency_ms"),
  statusCode: integer("status_code"),
  errorType: varchar("error_type", { length: 64 }),
  payloadSize: integer("payload_size"),
  appId: varchar("app_id", { length: 64 }),
  action: varchar("action", { length: 32 }),
  productId: varchar("product_id", { length: 64 }),
  price: decimal("price", { precision: 18, scale: 8 }),
  currency: varchar("currency", { length: 10 }),
  metadata: jsonb("metadata"),
  userAgent: text("user_agent"),
  geoRegion: varchar("geo_region", { length: 32 }),
});

export const insertAnalyticEventSchema = createInsertSchema(analyticEvents).omit({
  id: true,
});

export type InsertAnalyticEvent = z.infer<typeof insertAnalyticEventSchema>;
export type AnalyticEvent = typeof analyticEvents.$inferSelect;

// Analytics Rollups Table - Aggregated daily/weekly/monthly
export const analyticRollups = pgTable("analytic_rollups", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  period: varchar("period", { length: 16 }).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  endpoint: varchar("endpoint", { length: 256 }),
  totalCalls: integer("total_calls").notNull().default(0),
  successCalls: integer("success_calls").notNull().default(0),
  errorCalls: integer("error_calls").notNull().default(0),
  avgLatencyMs: integer("avg_latency_ms").notNull().default(0),
  p50LatencyMs: integer("p50_latency_ms").notNull().default(0),
  p95LatencyMs: integer("p95_latency_ms").notNull().default(0),
  totalPayloadBytes: bigint("total_payload_bytes", { mode: "number" }).notNull().default(0),
  uniqueWallets: integer("unique_wallets").notNull().default(0),
  uniqueSessions: integer("unique_sessions").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnalyticRollupSchema = createInsertSchema(analyticRollups).omit({
  id: true,
  createdAt: true,
});

export type InsertAnalyticRollup = z.infer<typeof insertAnalyticRollupSchema>;
export type AnalyticRollup = typeof analyticRollups.$inferSelect;

// Feature Flags Table - Per-tenant feature toggles
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  flagKey: varchar("flag_key", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  rolloutPercentage: integer("rollout_percentage").notNull().default(100),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;

// Timelocks Table - Delayed destructive operations
export const timelocks = pgTable("timelocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  operationType: varchar("operation_type", { length: 64 }).notNull(),
  operationData: jsonb("operation_data").notNull(),
  initiatorWallet: varchar("initiator_wallet", { length: 64 }).notNull(),
  delayHours: integer("delay_hours").notNull().default(24),
  scheduledAt: timestamp("scheduled_at").notNull(),
  executeAfter: timestamp("execute_after").notNull(),
  executedAt: timestamp("executed_at"),
  cancelledAt: timestamp("cancelled_at"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTimelockSchema = createInsertSchema(timelocks).omit({
  id: true,
  executedAt: true,
  cancelledAt: true,
  createdAt: true,
});

export type InsertTimelock = z.infer<typeof insertTimelockSchema>;
export type Timelock = typeof timelocks.$inferSelect;

// Anchored Receipts Table - On-chain billing proofs
export const anchoredReceipts = pgTable("anchored_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  invoiceId: varchar("invoice_id", { length: 128 }).notNull(),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 128 }),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  receiptHash: varchar("receipt_hash", { length: 66 }).notNull(),
  anchorTxHash: varchar("anchor_tx_hash", { length: 66 }),
  anchorChainId: integer("anchor_chain_id"),
  anchorStatus: varchar("anchor_status", { length: 16 }).notNull().default("pending"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnchoredReceiptSchema = createInsertSchema(anchoredReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertAnchoredReceipt = z.infer<typeof insertAnchoredReceiptSchema>;
export type AnchoredReceipt = typeof anchoredReceipts.$inferSelect;

// DID Documents Table - Decentralized Identity Documents
export const didDocs = pgTable("did_docs", {
  id: serial("id").primaryKey(),
  walletId: varchar("wallet_id", { length: 128 }).notNull(),
  doc: jsonb("doc").notNull(),
  docHash: varchar("doc_hash", { length: 66 }).notNull(),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const insertDidDocSchema = createInsertSchema(didDocs).omit({
  id: true,
  createdAt: true,
});

export type InsertDidDoc = z.infer<typeof insertDidDocSchema>;
export type DidDoc = typeof didDocs.$inferSelect;

// Reputations Table - Wallet Reputation Scores
export const reputations = pgTable("reputations", {
  walletId: varchar("wallet_id", { length: 128 }).primaryKey(),
  score: integer("score").notNull().default(0),
  reason: varchar("reason", { length: 256 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReputationSchema = createInsertSchema(reputations);

export type InsertReputation = z.infer<typeof insertReputationSchema>;
export type Reputation = typeof reputations.$inferSelect;

// Micro Payments Table - Small wallet-to-wallet transfers
export const microPayments = pgTable('micro_payments', {
  id: serial('id').primaryKey(),
  fromWalletId: varchar('from_wallet_id', { length: 128 }).notNull(),
  toWalletId: varchar('to_wallet_id', { length: 128 }).notNull(),
  amountWei: varchar('amount_wei', { length: 64 }).notNull(),
  txHash: varchar('tx_hash', { length: 66 }).notNull(),
  memo: varchar('memo', { length: 256 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertMicroPaymentSchema = createInsertSchema(microPayments).omit({
  id: true,
  createdAt: true,
});

export type InsertMicroPayment = z.infer<typeof insertMicroPaymentSchema>;
export type MicroPayment = typeof microPayments.$inferSelect;

// Escrows Table - Buyer-seller escrow contracts
export const escrowStates = ["locked", "released", "refunded", "disputed"] as const;

export const escrows = pgTable('escrows', {
  id: serial('id').primaryKey(),
  buyer: varchar('buyer', { length: 128 }).notNull(),
  seller: varchar('seller', { length: 128 }).notNull(),
  amountWei: varchar('amount_wei', { length: 64 }).notNull(),
  terms: varchar('terms', { length: 512 }).notNull(),
  state: varchar('state', { length: 32 }).notNull().default('locked'),
  recipient: varchar('recipient', { length: 16 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertEscrowSchema = createInsertSchema(escrows).omit({
  id: true,
  createdAt: true,
});

export type InsertEscrow = z.infer<typeof insertEscrowSchema>;
export type Escrow = typeof escrows.$inferSelect;

// Anomalies Table - Fraud detection and analytics
export const anomalies = pgTable('anomalies', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),
  score: numeric('score', { precision: 4, scale: 3 }).notNull(),
  features: jsonb('features').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertAnomalySchema = createInsertSchema(anomalies).omit({
  id: true,
  createdAt: true,
});

export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomalies.$inferSelect;

// Event Bus Table - Enterprise pub/sub event system
export const eventBus = pgTable('event_bus', {
  id: serial('id').primaryKey(),
  topic: varchar('topic', { length: 64 }).notNull(),
  payload: jsonb('payload').notNull(),
  publisher: varchar('publisher', { length: 128 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const insertEventBusSchema = createInsertSchema(eventBus).omit({
  id: true,
  createdAt: true,
});

export type InsertEventBus = z.infer<typeof insertEventBusSchema>;
export type EventBus = typeof eventBus.$inferSelect;

// Tenancy Zones Table - Multi-tenant zone configuration
export const tenancyZones = pgTable('tenancy_zones', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().unique(),
  provider: varchar('provider', { length: 16 }).notNull(),
  region: varchar('region', { length: 32 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertTenancyZoneSchema = createInsertSchema(tenancyZones).omit({
  id: true,
  createdAt: true,
});

export type InsertTenancyZone = z.infer<typeof insertTenancyZoneSchema>;
export type TenancyZone = typeof tenancyZones.$inferSelect;

// Audit Proofs Table - Encrypted audit proof storage
export const auditProofs = pgTable('audit_proofs', {
  id: serial('id').primaryKey(),
  datasetId: varchar('dataset_id', { length: 64 }).notNull(),
  selector: varchar('selector', { length: 128 }).notNull(),
  proof: jsonb('proof').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const insertAuditProofSchema = createInsertSchema(auditProofs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditProof = z.infer<typeof insertAuditProofSchema>;
export type AuditProof = typeof auditProofs.$inferSelect;

// Encrypted Messages Table - E2E encrypted messaging
export const encryptedMessages = pgTable('encrypted_messages', {
  id: serial('id').primaryKey(),
  fromWalletId: varchar('from_wallet_id', { length: 128 }).notNull(),
  toWalletId: varchar('to_wallet_id', { length: 128 }).notNull(),
  ciphertext: jsonb('ciphertext').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const insertEncryptedMessageSchema = createInsertSchema(encryptedMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertEncryptedMessage = z.infer<typeof insertEncryptedMessageSchema>;
export type EncryptedMessage = typeof encryptedMessages.$inferSelect;

// Guardian Timelocks Table - Simple guardian timelock actions
export const guardianTimelocks = pgTable('guardian_timelocks', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 128 }).notNull(),
  executeAfterSec: integer('execute_after_sec').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  executed: boolean('executed').default(false),
});

export const insertGuardianTimelockSchema = createInsertSchema(guardianTimelocks).omit({
  id: true,
  createdAt: true,
});

export type InsertGuardianTimelock = z.infer<typeof insertGuardianTimelockSchema>;
export type GuardianTimelock = typeof guardianTimelocks.$inferSelect;

// ============================================================================
// Atlas Proximity & Device Management Tables
// ============================================================================

// Device capabilities for manifest-driven permissions
export const atlasDeviceCapabilities = ['voice.speak', 'display.banner', 'sign.confirm', 'messages.read', 'proximity.sense'] as const;
export const atlasDeviceTypes = ['phone', 'watch', 'echo', 'browser', 'tablet'] as const;
export const atlasDeviceStatus = ['active', 'paired', 'revoked', 'pending'] as const;

// Atlas Devices Table - Registered user devices with key material
export const atlasDevices = pgTable('atlas_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 64 }).notNull().unique(),
  ownerWallet: varchar('owner_wallet', { length: 42 }).notNull(),
  deviceType: text('device_type', { enum: atlasDeviceTypes }).notNull(),
  publicKey: text('public_key').notNull(),
  fingerprintHash: varchar('fingerprint_hash', { length: 64 }).notNull(),
  capabilities: text('capabilities').array().notNull(),
  label: varchar('label', { length: 128 }),
  status: text('status', { enum: atlasDeviceStatus }).notNull().default('pending'),
  lastSeenAt: timestamp('last_seen_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertAtlasDeviceSchema = createInsertSchema(atlasDevices).omit({
  id: true,
  createdAt: true,
  lastSeenAt: true,
});

export type InsertAtlasDevice = z.infer<typeof insertAtlasDeviceSchema>;
export type AtlasDevice = typeof atlasDevices.$inferSelect;

// Atlas Sessions Table - Session root key envelopes (encrypted client-side)
export const atlasSessions = pgTable('atlas_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 32 }).notNull().unique(),
  ownerWallet: varchar('owner_wallet', { length: 42 }).notNull(),
  srkEnvelope: jsonb('srk_envelope'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertAtlasSessionSchema = createInsertSchema(atlasSessions).omit({
  id: true,
  createdAt: true,
});

export type InsertAtlasSession = z.infer<typeof insertAtlasSessionSchema>;
export type AtlasSession = typeof atlasSessions.$inferSelect;

// Atlas Session Devices Table - Links sessions to authorized devices
export const atlasSessionDevices = pgTable('atlas_session_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 32 }).notNull(),
  deviceId: varchar('device_id', { length: 64 }).notNull(),
  derivedKeyNonce: varchar('derived_key_nonce', { length: 32 }),
  attestationState: text('attestation_state', { enum: ['pending', 'verified', 'expired'] }).notNull().default('pending'),
  lastAttestationAt: timestamp('last_attestation_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertAtlasSessionDeviceSchema = createInsertSchema(atlasSessionDevices).omit({
  id: true,
  createdAt: true,
  lastAttestationAt: true,
});

export type InsertAtlasSessionDevice = z.infer<typeof insertAtlasSessionDeviceSchema>;
export type AtlasSessionDevice = typeof atlasSessionDevices.$inferSelect;

// Atlas User Settings Table - Privacy, consent toggles, and visualization settings
export const atlasUserSettings = pgTable('atlas_user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallet: varchar('wallet', { length: 42 }).notNull().unique(),
  proximitySurfacingEnabled: boolean('proximity_surfacing_enabled').notNull().default(true),
  voiceAnnounce: boolean('voice_announce').notNull().default(false),
  quietHoursStart: integer('quiet_hours_start'),
  quietHoursEnd: integer('quiet_hours_end'),
  quietHoursTimezone: varchar('quiet_hours_timezone', { length: 64 }),
  contentMinimization: boolean('content_minimization').notNull().default(true),
  visualization: jsonb('visualization'),
  accessibility: jsonb('accessibility'),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  onboardingPath: varchar('onboarding_path', { length: 32 }),
  interfacePreference: varchar('interface_preference', { length: 16 }),
  displayName: varchar('display_name', { length: 128 }),
  sessionMemoryEnabled: boolean('session_memory_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertAtlasUserSettingsSchema = createInsertSchema(atlasUserSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertAtlasUserSettings = z.infer<typeof insertAtlasUserSettingsSchema>;
export type AtlasUserSettings = typeof atlasUserSettings.$inferSelect;

// Atlas Handoff Receipts Table - Signed cross-device handoff records
export const atlasHandoffReceipts = pgTable('atlas_handoff_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  receiptId: varchar('receipt_id', { length: 32 }).notNull().unique(),
  sessionId: varchar('session_id', { length: 32 }).notNull(),
  fromDevice: varchar('from_device', { length: 64 }).notNull(),
  toDevice: varchar('to_device', { length: 64 }).notNull(),
  signature: text('signature').notNull(),
  stateHash: varchar('state_hash', { length: 64 }),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  consumed: boolean('consumed').notNull().default(false),
});

export const insertAtlasHandoffReceiptSchema = createInsertSchema(atlasHandoffReceipts).omit({
  id: true,
  issuedAt: true,
});

export type InsertAtlasHandoffReceipt = z.infer<typeof insertAtlasHandoffReceiptSchema>;
export type AtlasHandoffReceipt = typeof atlasHandoffReceipts.$inferSelect;

// Atlas App Manifests Table - Developer-registered apps
export const atlasAppManifests = pgTable('atlas_app_manifests', {
  id: uuid('id').primaryKey().defaultRandom(),
  appId: varchar('app_id', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 128 }).notNull(),
  version: varchar('version', { length: 16 }).notNull(),
  ownerWallet: varchar('owner_wallet', { length: 42 }).notNull(),
  entry: varchar('entry', { length: 256 }).notNull(),
  permissions: text('permissions').array().notNull(),
  semanticPhrases: jsonb('semantic_phrases'),
  status: text('status', { enum: ['draft', 'active', 'suspended'] }).notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertAtlasAppManifestSchema = createInsertSchema(atlasAppManifests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAtlasAppManifest = z.infer<typeof insertAtlasAppManifestSchema>;
export type AtlasAppManifest = typeof atlasAppManifests.$inferSelect;

// Vault Credentials Table - Encrypted OAuth tokens and API keys with per-wallet encryption
export const vaultCredentialKeyTypes = ['oauth', 'api', 'developer'] as const;

export const vaultCredentials = pgTable('vault_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddr: varchar('wallet_addr', { length: 128 }).notNull(),
  provider: varchar('provider', { length: 64 }).notNull(),
  scope: varchar('scope', { length: 128 }).notNull(),
  encryptedBlob: text('encrypted_blob').notNull(),
  nonce: text('nonce').notNull(),
  salt: text('salt').notNull(),
  keyType: text('key_type', { enum: vaultCredentialKeyTypes }).notNull().default('api'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertVaultCredentialSchema = createInsertSchema(vaultCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVaultCredential = z.infer<typeof insertVaultCredentialSchema>;
export type VaultCredential = typeof vaultCredentials.$inferSelect;

// Wallet Profiles Table - Unified wallet-scoped personalization
export const interfacePreferences = ['canvas', 'chat'] as const;
export const voiceStyles = ['default', 'calm', 'energetic', 'professional', 'friendly'] as const;
export const voiceGenders = ['neutral', 'masculine', 'feminine'] as const;

export const walletProfiles = pgTable('wallet_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  wallet: varchar('wallet', { length: 42 }).notNull().unique(),
  displayName: varchar('display_name', { length: 64 }),
  avatarCid: varchar('avatar_cid', { length: 128 }),
  facePreset: varchar('face_preset', { length: 32 }).default('line'),
  interfacePreference: text('interface_preference', { enum: interfacePreferences }).default('canvas'),
  voiceStyle: text('voice_style', { enum: voiceStyles }).default('default'),
  voiceGender: text('voice_gender', { enum: voiceGenders }).default('neutral'),
  voiceSpeed: integer('voice_speed').default(100),
  themeMode: varchar('theme_mode', { length: 16 }).default('dark'),
  primaryColor: varchar('primary_color', { length: 32 }).default('purple'),
  pinnedManifests: jsonb('pinned_manifests').$type<string[]>().default([]),
  sessionMemoryEnabled: boolean('session_memory_enabled').default(true),
  rememberPinnedApps: boolean('remember_pinned_apps').default(true),
  rememberQueries: boolean('remember_queries').default(false),
  rememberFlowHistory: boolean('remember_flow_history').default(true),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  onboardingPath: varchar('onboarding_path', { length: 16 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertWalletProfileSchema = createInsertSchema(walletProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWalletProfile = z.infer<typeof insertWalletProfileSchema>;
export type WalletProfile = typeof walletProfiles.$inferSelect;
export type InterfacePreference = typeof interfacePreferences[number];
export type VoiceStyle = typeof voiceStyles[number];
export type VoiceGender = typeof voiceGenders[number];

// ============================================
// Atlas Apps - TV, Tokens, Weather
// ============================================

// TV Favorites Table - Wallet-scoped favorite channels
export const tvFavorites = pgTable('tv_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  channelId: varchar('channel_id', { length: 128 }).notNull(),
  channelName: varchar('channel_name', { length: 256 }).notNull(),
  channelLogo: text('channel_logo'),
  channelCategory: varchar('channel_category', { length: 64 }),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const insertTvFavoriteSchema = createInsertSchema(tvFavorites).omit({
  id: true,
  addedAt: true,
});

export type InsertTvFavorite = z.infer<typeof insertTvFavoriteSchema>;
export type TvFavorite = typeof tvFavorites.$inferSelect;

// Token Watchlist Table - Wallet-scoped token tracking
export const tokenWatchlist = pgTable('token_watchlist', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  contractAddress: varchar('contract_address', { length: 42 }).notNull(),
  chainId: varchar('chain_id', { length: 16 }).notNull().default('1'),
  tokenName: varchar('token_name', { length: 128 }),
  tokenSymbol: varchar('token_symbol', { length: 32 }),
  tokenDecimals: integer('token_decimals'),
  tokenLogo: text('token_logo'),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const insertTokenWatchlistSchema = createInsertSchema(tokenWatchlist).omit({
  id: true,
  addedAt: true,
});

export type InsertTokenWatchlist = z.infer<typeof insertTokenWatchlistSchema>;
export type TokenWatchlist = typeof tokenWatchlist.$inferSelect;

// Weather Favorites Table - Wallet-scoped favorite locations
export const weatherFavorites = pgTable('weather_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  locationName: varchar('location_name', { length: 256 }).notNull(),
  latitude: numeric('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: numeric('longitude', { precision: 10, scale: 7 }).notNull(),
  country: varchar('country', { length: 64 }),
  region: varchar('region', { length: 128 }),
  addedAt: timestamp('added_at').notNull().defaultNow(),
});

export const insertWeatherFavoriteSchema = createInsertSchema(weatherFavorites).omit({
  id: true,
  addedAt: true,
});

export type InsertWeatherFavorite = z.infer<typeof insertWeatherFavoriteSchema>;
export type WeatherFavorite = typeof weatherFavorites.$inferSelect;

// ============================================
// Atlas AI Chat - Multi-provider Chat Bubbles
// ============================================

export const aiProviders = ['openai', 'anthropic', 'gemini'] as const;
export const aiMessageRoles = ['user', 'assistant', 'system'] as const;
export const aiReceiptStatuses = ['success', 'error'] as const;

// AI Threads Table - Wallet-scoped chat threads per provider
export const aiThreads = pgTable('ai_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  provider: varchar('provider', { length: 16, enum: aiProviders }).notNull(),
  title: varchar('title', { length: 256 }),
  model: varchar('model', { length: 64 }),
  systemPrompt: text('system_prompt'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertAiThreadSchema = createInsertSchema(aiThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAiThread = z.infer<typeof insertAiThreadSchema>;
export type AiThread = typeof aiThreads.$inferSelect;
export type AiProvider = typeof aiProviders[number];

// AI Messages Table - Messages within threads
export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => aiThreads.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 16, enum: aiMessageRoles }).notNull(),
  content: text('content').notNull(),
  tokenCount: integer('token_count').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({
  id: true,
  createdAt: true,
});

export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
export type AiMessageRole = typeof aiMessageRoles[number];

// AI Receipts Table - Audit log for AI interactions
export const aiReceipts = pgTable('ai_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id').notNull().references(() => aiThreads.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 16, enum: aiProviders }).notNull(),
  model: varchar('model', { length: 64 }),
  latencyMs: integer('latency_ms').default(0),
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  status: varchar('status', { length: 16, enum: aiReceiptStatuses }).notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertAiReceiptSchema = createInsertSchema(aiReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertAiReceipt = z.infer<typeof insertAiReceiptSchema>;
export type AiReceipt = typeof aiReceipts.$inferSelect;

// ============================================
// Atlas OS-Native Apps - Substrate Primitives
// ============================================

// Notification Types
export const notificationTypes = ['system', 'ai', 'payment', 'security', 'app'] as const;
export type NotificationType = typeof notificationTypes[number];

// Notifications Table - Universal inbox
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  type: varchar('type', { length: 16, enum: notificationTypes }).notNull(),
  title: varchar('title', { length: 256 }).notNull(),
  body: text('body'),
  iconUrl: text('icon_url'),
  source: varchar('source', { length: 64 }).notNull(),
  meta: jsonb('meta'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Clipboard Item Kinds
export const clipboardKinds = ['text', 'url', 'json', 'code', 'ai_output'] as const;
export type ClipboardKind = typeof clipboardKinds[number];

// Clipboard Items Table - Cross-device clipboard
export const clipboardItems = pgTable('clipboard_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  kind: varchar('kind', { length: 16, enum: clipboardKinds }).notNull(),
  content: text('content').notNull(),
  preview: varchar('preview', { length: 256 }),
  sourceApp: varchar('source_app', { length: 64 }),
  isPinned: boolean('is_pinned').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertClipboardItemSchema = createInsertSchema(clipboardItems).omit({
  id: true,
  createdAt: true,
});

export type InsertClipboardItem = z.infer<typeof insertClipboardItemSchema>;
export type ClipboardItem = typeof clipboardItems.$inferSelect;

// System Task Statuses
export const taskStatuses = ['queued', 'running', 'done', 'error', 'cancelled'] as const;
export type TaskStatus = typeof taskStatuses[number];

// System Tasks Table - Active flow tracking
export const systemTasks = pgTable('system_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }),
  type: varchar('type', { length: 64 }).notNull(),
  status: varchar('status', { length: 16, enum: taskStatuses }).notNull().default('queued'),
  description: varchar('description', { length: 256 }),
  meta: jsonb('meta'),
  progress: integer('progress').default(0),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertSystemTaskSchema = createInsertSchema(systemTasks).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
});

export type InsertSystemTask = z.infer<typeof insertSystemTaskSchema>;
export type SystemTask = typeof systemTasks.$inferSelect;

// Screenshots Table - OS-native screen capture
export const screenshots = pgTable('screenshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(),
  mimeType: varchar('mime_type', { length: 64 }).default('image/png'),
  sizeBytes: integer('size_bytes'),
  context: varchar('context', { length: 64 }),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertScreenshotSchema = createInsertSchema(screenshots).omit({
  id: true,
  createdAt: true,
});

export type InsertScreenshot = z.infer<typeof insertScreenshotSchema>;
export type Screenshot = typeof screenshots.$inferSelect;

// Math Computation Engine Types
export const mathEngines = ['symbolic', 'numeric', 'hybrid'] as const;
export type MathEngine = typeof mathEngines[number];

export const mathProviders = ['openai', 'anthropic', 'gemini', 'local'] as const;
export type MathProvider = typeof mathProviders[number];

// Math Computations Table - OS-native math processing
export const mathComputations = pgTable('math_computations', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  intentType: varchar('intent_type', { length: 64 }).notNull(), // 'arithmetic', 'algebra', 'calculus', 'physics', 'orbital', etc.
  query: text('query').notNull(), // User's original query
  inputPayload: jsonb('input_payload'), // Parsed inputs (variables, constants, units)
  engine: varchar('engine', { length: 16, enum: mathEngines }).notNull().default('hybrid'),
  provider: varchar('provider', { length: 16, enum: mathProviders }),
  equations: jsonb('equations'), // Array of equations used
  steps: jsonb('steps'), // Step-by-step derivation
  outputs: jsonb('outputs'), // Final results with units
  latencyMs: integer('latency_ms'),
  tokenUsage: jsonb('token_usage'), // { input: number, output: number, total: number }
  receiptHash: varchar('receipt_hash', { length: 66 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertMathComputationSchema = createInsertSchema(mathComputations).omit({
  id: true,
  createdAt: true,
});

export type InsertMathComputation = z.infer<typeof insertMathComputationSchema>;
export type MathComputation = typeof mathComputations.$inferSelect;

// Camera Captures Table - OS-native camera with AI processing
export const cameraCaptures = pgTable('camera_captures', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(), // /Camera/YYYY-MM-DD-HH-MM.png
  mimeType: varchar('mime_type', { length: 64 }).default('image/png'),
  sizeBytes: integer('size_bytes'),
  source: varchar('source', { length: 32 }), // 'device', 'upload', 'stream'
  annotations: jsonb('annotations'), // Bounding boxes, labels, highlights
  ocrResult: jsonb('ocr_result'), // Recognized text, equations
  recognizedEquations: jsonb('recognized_equations'), // LaTeX/MathML representations
  providerMeta: jsonb('provider_meta'), // Which AI processed this
  receiptHash: varchar('receipt_hash', { length: 66 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertCameraCaptureSchema = createInsertSchema(cameraCaptures).omit({
  id: true,
  createdAt: true,
});

export type InsertCameraCapture = z.infer<typeof insertCameraCaptureSchema>;
export type CameraCapture = typeof cameraCaptures.$inferSelect;

// ============================================
// Atlas Sandbox - AI-Built Apps Platform
// ============================================

// Sandbox Project Kinds
export const sandboxKinds = ['app', 'canvasCard', 'workflow'] as const;
export type SandboxKind = typeof sandboxKinds[number];

// Sandbox Project Statuses
export const sandboxStatuses = ['draft', 'awaitingApproval', 'approved', 'rejected', 'exported'] as const;
export type SandboxStatus = typeof sandboxStatuses[number];

// Sandbox Projects Table - Wallet-scoped AI-built apps
export const sandboxProjects = pgTable('sandbox_projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  kind: varchar('kind', { length: 16, enum: sandboxKinds }).notNull(),
  status: varchar('status', { length: 24, enum: sandboxStatuses }).notNull().default('draft'),
  manifestId: uuid('manifest_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertSandboxProjectSchema = createInsertSchema(sandboxProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSandboxProject = z.infer<typeof insertSandboxProjectSchema>;
export type SandboxProject = typeof sandboxProjects.$inferSelect;

// Artifact Types
export const artifactTypes = ['code', 'schema', 'asset', 'doc'] as const;
export type ArtifactType = typeof artifactTypes[number];

// Sandbox Artifacts Table - Code, schemas, assets within projects
export const sandboxArtifacts = pgTable('sandbox_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => sandboxProjects.id, { onDelete: 'cascade' }),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  type: varchar('type', { length: 16, enum: artifactTypes }).notNull(),
  filename: varchar('filename', { length: 256 }).notNull(),
  path: varchar('path', { length: 512 }).notNull(),
  mime: varchar('mime', { length: 128 }).notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  version: integer('version').notNull().default(1),
  contentEnc: text('content_enc'),
  sha256: varchar('sha256', { length: 66 }).notNull(),
  metaJson: jsonb('meta_json'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertSandboxArtifactSchema = createInsertSchema(sandboxArtifacts).omit({
  id: true,
  createdAt: true,
});

export type InsertSandboxArtifact = z.infer<typeof insertSandboxArtifactSchema>;
export type SandboxArtifact = typeof sandboxArtifacts.$inferSelect;

// Sandbox Manifests Table - App/Canvas card declarations
export const sandboxManifests = pgTable('sandbox_manifests', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => sandboxProjects.id, { onDelete: 'cascade' }),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  version: varchar('version', { length: 32 }).notNull(),
  kind: varchar('kind', { length: 16, enum: sandboxKinds }).notNull(),
  permissions: jsonb('permissions').notNull().default({}),
  endpoints: jsonb('endpoints'),
  canvasSchema: jsonb('canvas_schema'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertSandboxManifestSchema = createInsertSchema(sandboxManifests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSandboxManifest = z.infer<typeof insertSandboxManifestSchema>;
export type SandboxManifest = typeof sandboxManifests.$inferSelect;

// Preview Session Modes
export const previewModes = ['app', 'canvasCard'] as const;
export type PreviewMode = typeof previewModes[number];

// Preview Session Statuses
export const previewStatuses = ['active', 'stopped', 'expired'] as const;
export type PreviewStatus = typeof previewStatuses[number];

// Sandbox Preview Sessions Table - Ephemeral previews
export const sandboxPreviewSessions = pgTable('sandbox_preview_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => sandboxProjects.id, { onDelete: 'cascade' }),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  mode: varchar('mode', { length: 16, enum: previewModes }).notNull(),
  url: text('url').notNull().default(''),
  status: varchar('status', { length: 16, enum: previewStatuses }).notNull().default('active'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

export const insertSandboxPreviewSessionSchema = createInsertSchema(sandboxPreviewSessions).omit({
  id: true,
  startedAt: true,
});

export type InsertSandboxPreviewSession = z.infer<typeof insertSandboxPreviewSessionSchema>;
export type SandboxPreviewSession = typeof sandboxPreviewSessions.$inferSelect;

// Governance Review Statuses
export const governanceStatuses = ['pending', 'approved', 'rejected'] as const;
export type GovernanceStatus = typeof governanceStatuses[number];

// Sandbox Governance Reviews Table - Moderation/approval tracking
export const sandboxGovernanceReviews = pgTable('sandbox_governance_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => sandboxProjects.id, { onDelete: 'cascade' }),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  status: varchar('status', { length: 16, enum: governanceStatuses }).notNull().default('pending'),
  reviewer: varchar('reviewer', { length: 42 }),
  notes: text('notes'),
  checks: jsonb('checks').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertSandboxGovernanceReviewSchema = createInsertSchema(sandboxGovernanceReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSandboxGovernanceReview = z.infer<typeof insertSandboxGovernanceReviewSchema>;
export type SandboxGovernanceReview = typeof sandboxGovernanceReviews.$inferSelect;

// Storage Link Providers
export const storageProviders = ['googleDrive', 'oneDrive', 'dropbox'] as const;
export type StorageProvider = typeof storageProviders[number];

// Storage Links Table - User-connected cloud storage
export const sandboxStorageLinks = pgTable('sandbox_storage_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  provider: varchar('provider', { length: 16, enum: storageProviders }).notNull(),
  accessTokenEnc: text('access_token_enc').notNull(),
  refreshTokenEnc: text('refresh_token_enc'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertSandboxStorageLinkSchema = createInsertSchema(sandboxStorageLinks).omit({
  id: true,
  createdAt: true,
});

export type InsertSandboxStorageLink = z.infer<typeof insertSandboxStorageLinkSchema>;
export type SandboxStorageLink = typeof sandboxStorageLinks.$inferSelect;

// Sandbox Receipts Table - Audit log for all sandbox actions
export const sandboxReceipts = pgTable('sandbox_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  projectId: uuid('project_id').references(() => sandboxProjects.id, { onDelete: 'set null' }),
  actor: varchar('actor', { length: 64 }).notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  metaJson: jsonb('meta_json'),
  requestId: varchar('request_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insertSandboxReceiptSchema = createInsertSchema(sandboxReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertSandboxReceipt = z.infer<typeof insertSandboxReceiptSchema>;
export type SandboxReceipt = typeof sandboxReceipts.$inferSelect;

// Developer Instances Table - Linked dev Atlas instances
export const sandboxDevInstances = pgTable('sandbox_dev_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  baseUrl: text('base_url').notNull(),
  authTokenEnc: text('auth_token_enc'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertSandboxDevInstanceSchema = createInsertSchema(sandboxDevInstances).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSandboxDevInstance = z.infer<typeof insertSandboxDevInstanceSchema>;
export type SandboxDevInstance = typeof sandboxDevInstances.$inferSelect;

// Developer Bindings Table - Project-to-DevInstance links
export const sandboxDevBindings = pgTable('sandbox_dev_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  projectId: uuid('project_id').notNull().references(() => sandboxProjects.id, { onDelete: 'cascade' }),
  devInstanceId: uuid('dev_instance_id').notNull().references(() => sandboxDevInstances.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertSandboxDevBindingSchema = createInsertSchema(sandboxDevBindings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSandboxDevBinding = z.infer<typeof insertSandboxDevBindingSchema>;
export type SandboxDevBinding = typeof sandboxDevBindings.$inferSelect;

// ============================================
// File Hub - Wallet-scoped file management
// ============================================

// File Types for organization
export const fileHubTypes = ['document', 'image', 'video', 'audio', 'archive', 'data', 'other'] as const;
export type FileHubType = typeof fileHubTypes[number];

// File Hub Entries Table - Wallet-scoped file metadata
export const fileHubEntries = pgTable('file_hub_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  type: varchar('type', { length: 16, enum: fileHubTypes }).notNull().default('other'),
  mime: varchar('mime', { length: 128 }).notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  storageRef: text('storage_ref'), // IPFS CID, S3 key, or local path
  storageProvider: varchar('storage_provider', { length: 32 }).default('local'), // 'local', 'ipfs', 's3'
  parentId: uuid('parent_id'), // For folder hierarchy
  isFolder: boolean('is_folder').notNull().default(false),
  tags: text('tags').array(),
  metadata: jsonb('metadata'),
  sha256: varchar('sha256', { length: 66 }),
  receiptHash: varchar('receipt_hash', { length: 66 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertFileHubEntrySchema = createInsertSchema(fileHubEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFileHubEntry = z.infer<typeof insertFileHubEntrySchema>;
export type FileHubEntry = typeof fileHubEntries.$inferSelect;

// ============================================
// Web Browser - Headless browser sessions
// ============================================

export const webSessionStatuses = ['active', 'signedOut', 'error'] as const;
export type WebSessionStatus = typeof webSessionStatuses[number];

export const webSessionModes = ['preview', 'full', 'scrape'] as const;
export type WebSessionMode = typeof webSessionModes[number];

export const webSessions = pgTable('web_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  title: varchar('title', { length: 512 }),
  url: text('url').notNull(),
  status: varchar('status', { length: 16, enum: webSessionStatuses }).notNull().default('active'),
  tabIndex: integer('tab_index').notNull().default(0),
  cookiesJson: jsonb('cookies_json'),
  storageJson: jsonb('storage_json'),
  snapshotPath: text('snapshot_path'),
  metaJson: jsonb('meta_json').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertWebSessionSchema = createInsertSchema(webSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebSession = z.infer<typeof insertWebSessionSchema>;
export type WebSession = typeof webSessions.$inferSelect;

// Web Session Receipts - Audit trail for web actions
export const webSessionReceipts = pgTable('web_session_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  sessionId: uuid('session_id').notNull().references(() => webSessions.id, { onDelete: 'cascade' }),
  actor: varchar('actor', { length: 64 }).notNull(), // 'user' | 'agent:ATLAS' | 'system'
  action: varchar('action', { length: 64 }).notNull(), // 'web.open', 'web.navigate', etc.
  metaJson: jsonb('meta_json').notNull().default({}),
  requestId: uuid('request_id').defaultRandom(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

export const insertWebSessionReceiptSchema = createInsertSchema(webSessionReceipts).omit({
  id: true,
  timestamp: true,
  requestId: true,
});

export type InsertWebSessionReceipt = z.infer<typeof insertWebSessionReceiptSchema>;
export type WebSessionReceipt = typeof webSessionReceipts.$inferSelect;

// ============================================
// Site Profiles Registry - First-class site integrations
// ============================================

export const siteProfileActions = ['navigate', 'refresh', 'scrape', 'capture', 'signout'] as const;
export type SiteProfileAction = typeof siteProfileActions[number];

export const siteProfileCategoryEnum = [
  'messaging', 'social', 'email', 'streaming', 'banking', 'productivity',
  'shopping', 'news', 'travel', 'food', 'gaming', 'finance', 'health',
  'education', 'entertainment', 'utilities', 'developer', 'crypto', 'government', 'other'
] as const;

export const siteProfiles = pgTable('site_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: varchar('domain', { length: 256 }).notNull().unique(),
  name: varchar('name', { length: 256 }).notNull(),
  category: varchar('category', { length: 32 }).default('other'),
  iconUrl: text('icon_url'),
  description: text('description'),
  defaultActions: jsonb('default_actions').notNull().default(['navigate', 'refresh', 'capture', 'signout']),
  selectorsJson: jsonb('selectors_json'), // { inbox: "#inbox", unreadCount: ".badge" }
  loginMacros: jsonb('login_macros'), // Scripted login flows
  safe: boolean('safe').notNull().default(true),
  featured: boolean('featured').notNull().default(false), // Show in quick-access
  sortOrder: integer('sort_order').default(999), // For category ordering
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertSiteProfileSchema = createInsertSchema(siteProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSiteProfile = z.infer<typeof insertSiteProfileSchema>;
export type SiteProfile = typeof siteProfiles.$inferSelect;

// ============================================
// Browser Favorites - Wallet-scoped pinned items
// ============================================

export const favoriteTargetTypes = ['webSession', 'siteProfile', 'primitive', 'hubApp'] as const;
export type FavoriteTargetType = typeof favoriteTargetTypes[number];

export const favoriteSections = ['canvasTop', 'apps', 'browser'] as const;
export type FavoriteSection = typeof favoriteSections[number];

export const browserFavorites = pgTable('browser_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 42 }).notNull(),
  targetId: text('target_id').notNull(),
  targetType: varchar('target_type', { length: 32, enum: favoriteTargetTypes }).notNull(),
  section: varchar('section', { length: 32, enum: favoriteSections }).notNull().default('canvasTop'),
  position: integer('position').notNull().default(0),
  customName: varchar('custom_name', { length: 256 }),
  customIcon: text('custom_icon'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insertBrowserFavoriteSchema = createInsertSchema(browserFavorites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBrowserFavorite = z.infer<typeof insertBrowserFavoriteSchema>;
export type BrowserFavorite = typeof browserFavorites.$inferSelect;

// ============================================
// Site Profile Categories - Organization for 100+ sites
// ============================================

export const siteProfileCategories = [
  'messaging', 'social', 'email', 'streaming', 'banking', 'productivity',
  'shopping', 'news', 'travel', 'food', 'gaming', 'finance', 'health',
  'education', 'entertainment', 'utilities', 'developer', 'crypto', 'government', 'other'
] as const;
export type SiteProfileCategory = typeof siteProfileCategories[number];

// ============================================
// Atlas Suite Core Tables
// ============================================

// Wallet Scopes Table - Session and profile binding for wallet addresses
export const walletScopes = pgTable("wallet_scopes", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  sessionId: text("session_id").notNull(),
  profileId: text("profile_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWalletScopeSchema = createInsertSchema(walletScopes).omit({
  id: true,
  createdAt: true,
});

export type InsertWalletScope = z.infer<typeof insertWalletScopeSchema>;
export type WalletScope = typeof walletScopes.$inferSelect;

// Atlas Receipts - Audit trails with hash chaining
export const atlasReceiptOps = ["insertText", "deleteText", "applyStyle", "setCell", "createChart", "defineRange", "createDoc", "createSheet", "exportDoc", "exportSheet"] as const;

export const atlasReceipts = pgTable("atlas_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull(),
  op: text("op", { enum: atlasReceiptOps }).notNull(),
  prevHash: text("prev_hash"),
  nextHash: text("next_hash").notNull(),
  actorScopeId: uuid("actor_scope_id").notNull().references(() => walletScopes.id),
  meta: jsonb("meta"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAtlasReceiptSchema = createInsertSchema(atlasReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertAtlasReceipt = z.infer<typeof insertAtlasReceiptSchema>;
export type AtlasReceipt = typeof atlasReceipts.$inferSelect;

// Atlas Artifacts - All suite artifacts (docs, sheets, charts, etc.)
export const atlasArtifactTypes = ["writer.doc", "calc.sheet", "calc.chart", "calc.namedRange", "suite.template"] as const;
export const atlasArtifactVisibilities = ["private", "shared", "public"] as const;

export const atlasArtifacts = pgTable("atlas_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type", { enum: atlasArtifactTypes }).notNull(),
  ownerId: uuid("owner_id").notNull().references(() => walletScopes.id),
  title: text("title"),
  tags: text("tags").array(),
  visibility: text("visibility", { enum: atlasArtifactVisibilities }).notNull().default("private"),
  policyId: text("policy_id"),
  shareTokens: text("share_tokens").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAtlasArtifactSchema = createInsertSchema(atlasArtifacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAtlasArtifact = z.infer<typeof insertAtlasArtifactSchema>;
export type AtlasArtifact = typeof atlasArtifacts.$inferSelect;

// ============================================
// Writer Document Tables
// ============================================

// Writer Docs Table - Document metadata and settings
export const writerDocs = pgTable("writer_docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull().references(() => atlasArtifacts.id),
  version: integer("version").notNull().default(1),
  trackChangesEnabled: boolean("track_changes_enabled").notNull().default(false),
  outline: jsonb("outline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWriterDocSchema = createInsertSchema(writerDocs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWriterDoc = z.infer<typeof insertWriterDocSchema>;
export type WriterDoc = typeof writerDocs.$inferSelect;

// Writer Blocks Table - Document content blocks
export const blockTypes = ["paragraph", "heading1", "heading2", "heading3", "listOrdered", "listUnordered", "table", "image", "quote", "codeBlock", "embed"] as const;
export const inlineMarks = ["bold", "italic", "underline", "code", "link", "strikethrough"] as const;

export const writerBlocks = pgTable("writer_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  docId: uuid("doc_id").notNull().references(() => writerDocs.id),
  parentBlockId: uuid("parent_block_id"),
  position: integer("position").notNull().default(0),
  blockType: text("block_type", { enum: blockTypes }).notNull().default("paragraph"),
  text: text("text"),
  marks: text("marks").array(),
  attrs: jsonb("attrs"),
  contentHash: text("content_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWriterBlockSchema = createInsertSchema(writerBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWriterBlock = z.infer<typeof insertWriterBlockSchema>;
export type WriterBlock = typeof writerBlocks.$inferSelect;

// Writer Revisions Table - Track changes history
export const writerRevisions = pgTable("writer_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  docId: uuid("doc_id").notNull().references(() => writerDocs.id),
  actorScopeId: uuid("actor_scope_id").notNull().references(() => walletScopes.id),
  op: text("op").notNull(),
  rangeFrom: text("range_from").notNull(),
  rangeTo: text("range_to").notNull(),
  diffHash: text("diff_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWriterRevisionSchema = createInsertSchema(writerRevisions).omit({
  id: true,
  createdAt: true,
});

export type InsertWriterRevision = z.infer<typeof insertWriterRevisionSchema>;
export type WriterRevision = typeof writerRevisions.$inferSelect;

// ============================================
// Calc Spreadsheet Tables
// ============================================

// Calc Sheets Table - Spreadsheet metadata and settings
export const calcSheets = pgTable("calc_sheets", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull().references(() => atlasArtifacts.id),
  version: integer("version").notNull().default(1),
  depsHash: text("deps_hash"),
  config: jsonb("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCalcSheetSchema = createInsertSchema(calcSheets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalcSheet = z.infer<typeof insertCalcSheetSchema>;
export type CalcSheet = typeof calcSheets.$inferSelect;

// Calc Cells Table - Individual cell data
export const cellTypes = ["string", "number", "boolean", "date", "formula", "error"] as const;

export const calcCells = pgTable("calc_cells", {
  id: uuid("id").primaryKey().defaultRandom(),
  sheetId: uuid("sheet_id").notNull().references(() => calcSheets.id),
  addr: text("addr").notNull(),
  cellType: text("cell_type", { enum: cellTypes }).notNull().default("string"),
  value: jsonb("value"),
  formula: text("formula"),
  format: jsonb("format"),
  style: jsonb("style"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCalcCellSchema = createInsertSchema(calcCells).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalcCell = z.infer<typeof insertCalcCellSchema>;
export type CalcCell = typeof calcCells.$inferSelect;

// Calc Named Ranges Table - Named range definitions
export const calcNamedRanges = pgTable("calc_named_ranges", {
  id: uuid("id").primaryKey().defaultRandom(),
  sheetId: uuid("sheet_id").notNull().references(() => calcSheets.id),
  name: text("name").notNull(),
  rangeExpr: text("range_expr").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCalcNamedRangeSchema = createInsertSchema(calcNamedRanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalcNamedRange = z.infer<typeof insertCalcNamedRangeSchema>;
export type CalcNamedRange = typeof calcNamedRanges.$inferSelect;

// Calc Charts Table - Chart definitions
export const chartTypes = ["bar", "line", "pie", "scatter", "area", "column", "donut", "radar"] as const;

export const calcCharts = pgTable("calc_charts", {
  id: uuid("id").primaryKey().defaultRandom(),
  sheetId: uuid("sheet_id").notNull().references(() => calcSheets.id),
  chartType: text("chart_type", { enum: chartTypes }).notNull().default("bar"),
  title: text("title"),
  dataRange: text("data_range").notNull(),
  labelRange: text("label_range"),
  config: jsonb("config"),
  position: jsonb("position"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCalcChartSchema = createInsertSchema(calcCharts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCalcChart = z.infer<typeof insertCalcChartSchema>;
export type CalcChart = typeof calcCharts.$inferSelect;

// ============================================
// Orchestration Tables
// ============================================

// Flow statuses for orchestration workflows
export const flowStatuses = ["pending", "running", "completed", "failed", "cancelled"] as const;

// Orchestration Flows Table - Main workflow definitions
export const orchestrationFlows = pgTable("orchestration_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletScopeId: uuid("wallet_scope_id").notNull().references(() => walletScopes.id),
  name: text("name").notNull(),
  status: text("status", { enum: flowStatuses }).notNull().default("pending"),
  entryReceiptId: uuid("entry_receipt_id"),
  linkedArtifactIds: uuid("linked_artifact_ids").array(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrchestrationFlowSchema = createInsertSchema(orchestrationFlows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrchestrationFlow = z.infer<typeof insertOrchestrationFlowSchema>;
export type OrchestrationFlow = typeof orchestrationFlows.$inferSelect;

// Orchestration Steps Table - Individual steps within a flow
export const orchestrationSteps = pgTable("orchestration_steps", {
  id: uuid("id").primaryKey().defaultRandom(),
  flowId: uuid("flow_id").notNull().references(() => orchestrationFlows.id),
  stepOrder: integer("step_order").notNull(),
  sourceArtifactId: uuid("source_artifact_id"),
  targetArtifactId: uuid("target_artifact_id"),
  adapterId: text("adapter_id"),
  payload: jsonb("payload"),
  receiptId: uuid("receipt_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrchestrationStepSchema = createInsertSchema(orchestrationSteps).omit({
  id: true,
  createdAt: true,
});

export type InsertOrchestrationStep = z.infer<typeof insertOrchestrationStepSchema>;
export type OrchestrationStep = typeof orchestrationSteps.$inferSelect;

// Adapter statuses for orchestration adapters
export const adapterStatuses = ["active", "deprecated", "disabled"] as const;

// Orchestration Adapters Table - Adapter registry for data transformation
export const orchestrationAdapters = pgTable("orchestration_adapters", {
  id: uuid("id").primaryKey().defaultRandom(),
  adapterId: text("adapter_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),
  inputSchema: jsonb("input_schema"),
  outputSchema: jsonb("output_schema"),
  config: jsonb("config"),
  status: text("status", { enum: adapterStatuses }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOrchestrationAdapterSchema = createInsertSchema(orchestrationAdapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrchestrationAdapter = z.infer<typeof insertOrchestrationAdapterSchema>;
export type OrchestrationAdapter = typeof orchestrationAdapters.$inferSelect;

// ============================================
// Atlas Game Deck Tables
// ============================================

// Game sources for catalog entries
export const gameSources = ["developer", "freetogame", "gamerpower", "itch"] as const;

// Games Table - Catalog of games (developer submissions + API pulls)
export const games = pgTable("games", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  genre: text("genre"),
  platform: text("platform"),
  url: text("url"),
  thumbnail: text("thumbnail"),
  source: text("source", { enum: gameSources }).notNull().default("developer"),
  developer: text("developer"),
  description: text("description"),
  releaseDate: text("release_date"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  tags: text("tags").array(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGameSchema = createInsertSchema(games).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

// Game NFTs Table - Wallet-scoped NFT assets
export const gameNfts = pgTable("game_nfts", {
  id: text("id").primaryKey(),
  wallet: text("wallet").notNull(),
  chain: text("chain").notNull(),
  contract: text("contract").notNull(),
  tokenId: text("token_id").notNull(),
  name: text("name"),
  description: text("description"),
  image: text("image"),
  attributes: jsonb("attributes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGameNftSchema = createInsertSchema(gameNfts).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertGameNft = z.infer<typeof insertGameNftSchema>;
export type GameNft = typeof gameNfts.$inferSelect;

// Game event types
export const gameEventTypes = ["highscore", "achievement", "tournament.entry", "tournament.win", "session.start", "session.end", "purchase", "unlock"] as const;

// Game Events Table - Player events (highscores, achievements, etc.)
export const gameEvents = pgTable("game_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  developer: text("developer"),
  gameId: text("game_id").notNull(),
  eventType: text("event_type", { enum: gameEventTypes }).notNull(),
  payload: jsonb("payload").notNull(),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  anchorId: uuid("anchor_id"),
  feeWei: text("fee_wei"),
});

export const insertGameEventSchema = createInsertSchema(gameEvents).omit({
  id: true,
  occurredAt: true,
});

export type InsertGameEvent = z.infer<typeof insertGameEventSchema>;
export type GameEvent = typeof gameEvents.$inferSelect;

// Anchor modes
export const anchorModes = ["direct", "batch"] as const;
export const gameAnchorStatuses = ["pending", "confirmed", "failed"] as const;

// Anchor Records Table - On-chain anchor transactions
export const anchorRecords = pgTable("anchor_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  chain: text("chain").notNull(),
  mode: text("mode", { enum: anchorModes }).notNull().default("batch"),
  count: integer("count").notNull().default(1),
  txHash: text("tx_hash"),
  status: text("status", { enum: gameAnchorStatuses }).notNull().default("pending"),
  rootHash: text("root_hash"),
  totalFeeWei: text("total_fee_wei"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAnchorRecordSchema = createInsertSchema(anchorRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAnchorRecord = z.infer<typeof insertAnchorRecordSchema>;
export type AnchorRecord = typeof anchorRecords.$inferSelect;

// Anchor Proofs Table - Merkle proofs for individual events
export const anchorProofs = pgTable("anchor_proofs", {
  id: uuid("id").primaryKey().defaultRandom(),
  anchorId: uuid("anchor_id").notNull().references(() => anchorRecords.id),
  eventId: uuid("event_id").notNull().references(() => gameEvents.id),
  leafHash: text("leaf_hash").notNull(),
  merklePath: jsonb("merkle_path").notNull(),
  leafIndex: integer("leaf_index").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnchorProofSchema = createInsertSchema(anchorProofs).omit({
  id: true,
  createdAt: true,
});

export type InsertAnchorProof = z.infer<typeof insertAnchorProofSchema>;
export type AnchorProof = typeof anchorProofs.$inferSelect;

// Anchor Ledger Table - Fee accounting per event
export const anchorLedger = pgTable("anchor_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  gameId: text("game_id").notNull(),
  eventId: uuid("event_id").notNull().references(() => gameEvents.id),
  feeWei: text("fee_wei").notNull(),
  mode: text("mode", { enum: anchorModes }).notNull(),
  anchorId: uuid("anchor_id").references(() => anchorRecords.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAnchorLedgerSchema = createInsertSchema(anchorLedger).omit({
  id: true,
  createdAt: true,
});

export type InsertAnchorLedger = z.infer<typeof insertAnchorLedgerSchema>;
export type AnchorLedgerEntry = typeof anchorLedger.$inferSelect;

// Tournaments Table - Tournament definitions
export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  rulesJson: jsonb("rules_json"),
  prizePool: jsonb("prize_pool"),
  maxParticipants: integer("max_participants"),
  anchored: boolean("anchored").notNull().default(false),
  anchorId: uuid("anchor_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTournamentSchema = createInsertSchema(tournaments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournaments.$inferSelect;

// Leaderboard types
export const leaderboardTypes = ["highscore", "tournament", "weekly", "monthly", "alltime"] as const;

// Leaderboards Table - Score leaderboards
export const leaderboards = pgTable("leaderboards", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull(),
  leaderboardType: text("leaderboard_type", { enum: leaderboardTypes }).notNull().default("highscore"),
  key: text("key").notNull(),
  entries: jsonb("entries").notNull().default([]),
  maxEntries: integer("max_entries").notNull().default(1000),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLeaderboardSchema = createInsertSchema(leaderboards).omit({
  updatedAt: true,
});

export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type Leaderboard = typeof leaderboards.$inferSelect;

// Game Favorites Table - Wallet-scoped favorites
export const gameFavorites = pgTable("game_favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  gameId: text("game_id").notNull().references(() => games.id),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameFavoriteSchema = createInsertSchema(gameFavorites).omit({
  id: true,
  createdAt: true,
});

export type InsertGameFavorite = z.infer<typeof insertGameFavoriteSchema>;
export type GameFavorite = typeof gameFavorites.$inferSelect;

// Game Deck Receipts Table - Audit trail for all game deck actions
export const gameDeckReceipts = pgTable("game_deck_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  metaJson: jsonb("meta_json").notNull(),
  requestId: text("request_id").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertGameDeckReceiptSchema = createInsertSchema(gameDeckReceipts).omit({
  id: true,
  timestamp: true,
});

export type InsertGameDeckReceipt = z.infer<typeof insertGameDeckReceiptSchema>;
export type GameDeckReceipt = typeof gameDeckReceipts.$inferSelect;

// ============================================================================
// GAME DECK EXPANSION TABLES
// Mods, hooks, invites, discovery rollups, and governance accounts
// ============================================================================

// Mods Table - Game modifications/addons from various sources
export const mods = pgTable("mods", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull().references(() => games.id),
  wallet: text("wallet").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  version: text("version"),
  source: text("source").notNull(),
  sourceId: text("source_id"),
  url: text("url"),
  enabled: boolean("enabled").default(false).notNull(),
  downloadCount: integer("download_count").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertModSchema = createInsertSchema(mods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMod = z.infer<typeof insertModSchema>;
export type Mod = typeof mods.$inferSelect;

// Mod Hooks Table - API/webhook/event hooks for mods
export const modHooks = pgTable("mod_hooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  modId: uuid("mod_id").notNull().references(() => mods.id),
  hookType: text("hook_type").notNull(),
  apiUrl: text("api_url"),
  payloadSchema: jsonb("payload_schema"),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertModHookSchema = createInsertSchema(modHooks).omit({
  id: true,
  createdAt: true,
});

export type InsertModHook = z.infer<typeof insertModHookSchema>;
export type ModHook = typeof modHooks.$inferSelect;

// Game Invites Table - Session invitations between wallets
export const gameInvites = pgTable("game_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").references(() => games.id),
  sessionId: text("session_id"),
  fromWallet: text("from_wallet").notNull(),
  toWallet: text("to_wallet").notNull(),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGameInviteSchema = createInsertSchema(gameInvites).omit({
  id: true,
  createdAt: true,
});

export type InsertGameInvite = z.infer<typeof insertGameInviteSchema>;
export type GameInvite = typeof gameInvites.$inferSelect;

// Discovery Rollups Table - Aggregated metrics for game discovery
export const discoveryRollups = pgTable("discovery_rollups", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull().references(() => games.id),
  metricType: text("metric_type").notNull(),
  period: text("period").notNull(),
  value: integer("value").default(0).notNull(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
});

export const insertDiscoveryRollupSchema = createInsertSchema(discoveryRollups).omit({
  id: true,
  computedAt: true,
});

export type InsertDiscoveryRollup = z.infer<typeof insertDiscoveryRollupSchema>;
export type DiscoveryRollup = typeof discoveryRollups.$inferSelect;

// Governance Accounts Table - Rate limits and account status for governance
export const governanceAccounts = pgTable("governance_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull().unique(),
  rateLimit: integer("rate_limit").default(1000),
  totalFeesPaid: text("total_fees_paid").default("0"),
  violations: integer("violations").default(0),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGovernanceAccountSchema = createInsertSchema(governanceAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGovernanceAccount = z.infer<typeof insertGovernanceAccountSchema>;
export type GovernanceAccount = typeof governanceAccounts.$inferSelect;

// Purchases Table - Gate integration for game/mod/DLC purchases
export const purchaseStatuses = ["pending", "complete", "failed", "refunded"] as const;
export const purchaseItemTypes = ["game", "mod", "dlc", "subscription"] as const;

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").references(() => games.id),
  modId: uuid("mod_id").references(() => mods.id),
  wallet: text("wallet").notNull(),
  itemType: text("item_type", { enum: purchaseItemTypes }).notNull(),
  priceWei: text("price_wei").notNull(),
  currency: text("currency").default("ETH").notNull(),
  receiptId: uuid("receipt_id"),
  txHash: text("tx_hash"),
  anchorId: uuid("anchor_id"),
  status: text("status", { enum: purchaseStatuses }).default("pending").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

// ============================================================================
// SANDBOX DATA MODELS
// Build management, endpoints, and mod state tracking for game sandbox
// ============================================================================

// Builds Table - Game build artifacts and version management
export const builds = pgTable("builds", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull().references(() => games.id),
  version: text("version").notNull(),
  artifactUrl: text("artifact_url").notNull(),
  changelog: text("changelog"),
  createdByWallet: text("created_by_wallet").notNull(),
  published: boolean("published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBuildSchema = createInsertSchema(builds).omit({
  id: true,
  createdAt: true,
});

export type InsertBuild = z.infer<typeof insertBuildSchema>;
export type Build = typeof builds.$inferSelect;

// Endpoints Table - Game API endpoints and authentication
export const endpoints = pgTable("endpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull().references(() => games.id),
  ownerWallet: text("owner_wallet").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  authKind: text("auth_kind").notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEndpointSchema = createInsertSchema(endpoints).omit({
  id: true,
  createdAt: true,
});

export type InsertEndpoint = z.infer<typeof insertEndpointSchema>;
export type Endpoint = typeof endpoints.$inferSelect;

// Mod States Table - Per-wallet mod enable/disable state
export const modStates = pgTable("mod_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  modId: uuid("mod_id").notNull().references(() => mods.id),
  enabled: boolean("enabled").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertModStateSchema = createInsertSchema(modStates).omit({
  id: true,
  updatedAt: true,
});

export type InsertModState = z.infer<typeof insertModStateSchema>;
export type ModState = typeof modStates.$inferSelect;

// ============================================================================
// UNIFIED MARKETPLACE DATA MODELS
// Universal catalog for games, apps, ebooks, videos, audio, products
// ============================================================================

// Marketplace Item Types - expanded for all verticals
export const marketplaceItemTypes = ["game", "app", "ebook", "video", "audio", "product", "channel", "document", "governance", "gallery"] as const;
export const marketplaceItemStatuses = ["draft", "published", "archived", "suspended"] as const;

// Content sources for external API items
export const contentSources = ["developer", "freetogame", "gamerpower", "googlebooks", "openlibrary", "gutendex", "iptv", "tmdb", "omdb", "github-releases", "open-product-data", "merchant", "googledrive", "onedrive", "snapshot", "unsplash", "spotify", "apple-podcasts"] as const;

// ============================================================================
// ACCESS MANIFEST - SUBSTRATE-LEVEL PLAYABLE/READABLE/LAUNCHABLE CONTRACT
// ============================================================================

// Access modes for content delivery
export const accessModes = ["stream", "file", "embed", "openweb"] as const;
export type AccessMode = typeof accessModes[number];

// Content formats for different verticals (expanded)
export const accessFormats = [
  "hls", "dash", "mp4", "webm",           // Video/Stream formats
  "epub", "pdf", "html",                   // Document/Book formats
  "docx", "pptx", "xlsx",                  // Office formats
  "mp3", "aac", "ogg", "flac",             // Audio formats
  "rss", "json-feed",                      // Podcast/Feed formats
  "image", "gallery",                      // Image formats
  "ballot", "proposal",                    // Governance formats
  "none"                                   // Fallback
] as const;
export type AccessFormat = typeof accessFormats[number];

// Access receipt action types
export const accessActions = [
  "view", "read", "launch", "checkout", "stream", "download",  // Existing
  "listen", "vote", "browse", "play"                            // New
] as const;
export type AccessAction = typeof accessActions[number];

// Access manifest schema - every playable/readable/launchable item must have this
export interface AccessManifest {
  mode: AccessMode;
  format: AccessFormat;
  uri?: string;       // Direct playable URL (HLS/DASH/file) - preferred
  embed?: string;     // Embeddable iframe URL - second priority
  openWeb?: string;   // Fallback deep link to provider - last resort
}

// Zod schema for validation
export const accessManifestSchema = z.object({
  mode: z.enum(accessModes),
  format: z.enum(accessFormats),
  uri: z.string().url().optional(),
  embed: z.string().url().optional(),
  openWeb: z.string().url().optional(),
}).refine(
  (data) => data.uri || data.embed || data.openWeb,
  { message: "At least one of uri, embed, or openWeb must be provided" }
);

export type AccessManifestInput = z.infer<typeof accessManifestSchema>;

// Marketplace Items Table - Unified catalog for all item types
export const marketplaceItems = pgTable("marketplace_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemType: text("item_type", { enum: marketplaceItemTypes }).notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  creatorWallet: text("creator_wallet").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory"),
  tags: text("tags").array(),
  thumbnail: text("thumbnail"),
  coverImage: text("cover_image"),
  priceWei: text("price_wei").default("0"),
  currency: text("currency").default("ETH"),
  source: text("source", { enum: contentSources }).default("developer"),
  providerId: text("provider_id"),
  access: jsonb("access").$type<AccessManifest>(),
  manifest: jsonb("manifest"),
  metadata: jsonb("metadata"),
  status: text("status", { enum: marketplaceItemStatuses }).default("draft").notNull(),
  featured: boolean("featured").default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  downloads: integer("downloads").default(0),
  purchases: integer("purchases").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
});

export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;
export type MarketplaceItem = typeof marketplaceItems.$inferSelect;

// Item Builds Table - Version releases for apps/games/media
export const itemBuilds = pgTable("item_builds", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  version: text("version").notNull(),
  artifactUrl: text("artifact_url").notNull(),
  artifactHash: text("artifact_hash"),
  changelog: text("changelog"),
  fileSize: bigint("file_size", { mode: "number" }),
  format: text("format"),
  createdByWallet: text("created_by_wallet").notNull(),
  published: boolean("published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertItemBuildSchema = createInsertSchema(itemBuilds).omit({
  id: true,
  createdAt: true,
});

export type InsertItemBuild = z.infer<typeof insertItemBuildSchema>;
export type ItemBuild = typeof itemBuilds.$inferSelect;

// Media Assets Table - Extended metadata for ebooks/videos/audio
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  assetType: text("asset_type").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type"),
  duration: integer("duration"),
  pageCount: integer("page_count"),
  fileSize: bigint("file_size", { mode: "number" }),
  resolution: text("resolution"),
  bitrate: integer("bitrate"),
  language: text("language").default("en"),
  subtitles: text("subtitles").array(),
  chapters: jsonb("chapters"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({
  id: true,
  createdAt: true,
});

export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;

// Merchant Stores Table - Developer/merchant storefronts
export const merchantStores = pgTable("merchant_stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logo: text("logo"),
  banner: text("banner"),
  category: text("category"),
  verified: boolean("verified").default(false),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  totalSales: integer("total_sales").default(0),
  totalRevenue: text("total_revenue").default("0"),
  metadata: jsonb("metadata"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMerchantStoreSchema = createInsertSchema(merchantStores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMerchantStore = z.infer<typeof insertMerchantStoreSchema>;
export type MerchantStore = typeof merchantStores.$inferSelect;

// Category Registry Table - Governance-controlled categories
export const categoryRegistry = pgTable("category_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  parentSlug: text("parent_slug"),
  icon: text("icon"),
  itemTypes: text("item_types").array(),
  sortOrder: integer("sort_order").default(0),
  featured: boolean("featured").default(false),
  active: boolean("active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCategoryRegistrySchema = createInsertSchema(categoryRegistry).omit({
  id: true,
  createdAt: true,
});

export type InsertCategoryRegistry = z.infer<typeof insertCategoryRegistrySchema>;
export type CategoryRegistry = typeof categoryRegistry.$inferSelect;

// Marketplace Purchases Table - Extended purchases for all item types
export const marketplacePurchases = pgTable("marketplace_purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  buyerWallet: text("buyer_wallet").notNull(),
  sellerWallet: text("seller_wallet").notNull(),
  priceWei: text("price_wei").notNull(),
  currency: text("currency").default("ETH"),
  txHash: text("tx_hash"),
  anchorId: uuid("anchor_id"),
  receiptId: text("receipt_id"),
  status: text("status", { enum: purchaseStatuses }).default("pending").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertMarketplacePurchaseSchema = createInsertSchema(marketplacePurchases).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketplacePurchase = z.infer<typeof insertMarketplacePurchaseSchema>;
export type MarketplacePurchase = typeof marketplacePurchases.$inferSelect;

// Hub Apps Table - Imported external app manifests
export const hubApps = pgTable("hub_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").references(() => marketplaceItems.id),
  externalId: text("external_id"),
  platform: text("platform"),
  packageName: text("package_name"),
  manifestUrl: text("manifest_url"),
  manifest: jsonb("manifest"),
  importedByWallet: text("imported_by_wallet").notNull(),
  verified: boolean("verified").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHubAppSchema = createInsertSchema(hubApps).omit({
  id: true,
  createdAt: true,
});

export type InsertHubApp = z.infer<typeof insertHubAppSchema>;
export type HubApp = typeof hubApps.$inferSelect;

// Marketplace Receipts Table - Universal anchored receipts for all marketplace actions
export const marketplaceReceiptKinds = [
  "item.create", "item.publish", "item.update", "item.archive",
  "build.upload", "build.publish",
  "purchase.initiate", "purchase.complete", "purchase.refund",
  "store.create", "store.update",
  "media.upload", "media.stream",
  "hub.import", "hub.sync"
] as const;

export const marketplaceReceiptsTable = pgTable("marketplace_receipts_v2", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  kind: text("kind", { enum: marketplaceReceiptKinds }).notNull(),
  refId: uuid("ref_id"),
  refType: text("ref_type"),
  txHash: text("tx_hash"),
  anchorFeeWei: text("anchor_fee_wei").default("150000000000000"),
  metaJson: jsonb("meta_json"),
  requestId: text("request_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMarketplaceReceiptV2Schema = createInsertSchema(marketplaceReceiptsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMarketplaceReceiptV2 = z.infer<typeof insertMarketplaceReceiptV2Schema>;
export type MarketplaceReceiptV2 = typeof marketplaceReceiptsTable.$inferSelect;

// ============================================================================
// ATLAS MEDIA TABLES
// Video/TV rentals, purchases, and ratings for Atlas Media service
// ============================================================================

// Access types for media
export const mediaAccessTypes = ["rental", "purchase"] as const;

// Media access kind values
export const mediaAccessKinds = ["ebook", "video", "audio", "game", "app"] as const;

// Media Access Table - Tracks rentals/purchases with expiry
export const mediaAccess = pgTable("media_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  itemId: uuid("item_id"),
  kind: text("kind", { enum: mediaAccessKinds }).notNull(),
  accessType: text("access_type", { enum: mediaAccessTypes }).notNull(),
  priceWei: text("price_wei").default("0"),
  txHash: text("tx_hash"),
  anchorId: uuid("anchor_id"),
  receiptId: uuid("receipt_id"),
  expiresAt: timestamp("expires_at"),
  accessToken: text("access_token"),
  sessionNonce: text("session_nonce"),
  tokenExpiresAt: timestamp("token_expires_at"),
  playbackPosition: integer("playback_position").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMediaAccessSchema = createInsertSchema(mediaAccess).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMediaAccess = z.infer<typeof insertMediaAccessSchema>;
export type MediaAccess = typeof mediaAccess.$inferSelect;

// Ratings Table - External ratings from TMDB, IMDB, Rotten Tomatoes, etc.
export const ratings = pgTable("ratings", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  source: text("source").notNull(),
  score: decimal("score", { precision: 4, scale: 2 }),
  maxScore: decimal("max_score", { precision: 4, scale: 2 }).default("10"),
  consensus: text("consensus"),
  voteCount: integer("vote_count"),
  externalId: text("external_id"),
  metadata: jsonb("metadata"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
});

export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;

// User Reviews Table - Wallet-scoped reviews for all content types (books, movies, games, products)
export const userReviews = pgTable("user_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  wallet: text("wallet").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  verified: boolean("verified").default(false),
  helpful: integer("helpful").default(0),
  reported: integer("reported").default(0),
  status: text("status", { enum: ["published", "hidden", "flagged", "removed"] }).default("published"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_reviews_wallet_item_idx").on(table.wallet, table.itemId),
]);

export const insertUserReviewSchema = createInsertSchema(userReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  helpful: true,
  reported: true,
});

export type InsertUserReview = z.infer<typeof insertUserReviewSchema>;
export type UserReview = typeof userReviews.$inferSelect;

// Reading Progress Table - Ebook reader state per wallet
export const readingProgress = pgTable("reading_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  itemId: uuid("item_id").notNull().references(() => marketplaceItems.id),
  currentPage: integer("current_page").default(0),
  totalPages: integer("total_pages"),
  percentComplete: decimal("percent_complete", { precision: 5, scale: 2 }).default("0"),
  highlights: jsonb("highlights").default([]),
  notes: jsonb("notes").default([]),
  bookmarks: jsonb("bookmarks").default([]),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReadingProgressSchema = createInsertSchema(readingProgress).omit({
  id: true,
  createdAt: true,
});

export type InsertReadingProgress = z.infer<typeof insertReadingProgressSchema>;
export type ReadingProgress = typeof readingProgress.$inferSelect;

// Catalog Sync Jobs Table - Track external API imports
export const catalogSyncJobStatuses = ["pending", "running", "completed", "failed", "paused"] as const;
export const catalogSyncSources = ["freetogame", "gamerpower", "googlebooks", "openlibrary", "internetarchive", "tmdb", "gutendex", "iptv", "github-releases", "open-product-data"] as const;

// Cursor-based sync state tracking for incremental imports
export const catalogSyncCursors = pgTable("catalog_sync_cursors", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source").notNull(),
  cursorKey: text("cursor_key").notNull().default("default"),
  cursorValue: jsonb("cursor_value").$type<{
    page?: number;
    offset?: number;
    lastId?: string;
    lastModified?: string;
    etag?: string;
    position?: number;
  }>(),
  totalAvailable: integer("total_available"),
  totalImported: integer("total_imported").default(0),
  lastSuccessAt: timestamp("last_success_at"),
  lastErrorAt: timestamp("last_error_at"),
  lastError: text("last_error"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  isEnabled: boolean("is_enabled").default(true),
  batchSize: integer("batch_size").default(50),
  rateLimitDelayMs: integer("rate_limit_delay_ms").default(1000),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCatalogSyncCursorSchema = createInsertSchema(catalogSyncCursors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCatalogSyncCursor = z.infer<typeof insertCatalogSyncCursorSchema>;
export type CatalogSyncCursor = typeof catalogSyncCursors.$inferSelect;

export const catalogSyncJobs = pgTable("catalog_sync_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source", { enum: catalogSyncSources }).notNull(),
  jobType: text("job_type").notNull(),
  status: text("status", { enum: catalogSyncJobStatuses }).default("pending").notNull(),
  params: jsonb("params"),
  itemsSynced: integer("items_synced").default(0),
  errorMessage: text("error_message"),
  stats: jsonb("stats"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCatalogSyncJobSchema = createInsertSchema(catalogSyncJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertCatalogSyncJob = z.infer<typeof insertCatalogSyncJobSchema>;
export type CatalogSyncJob = typeof catalogSyncJobs.$inferSelect;

// Manifest Schema Type - Standard envelope for all marketplace items
export interface ItemManifestSchema {
  apiEndpoint?: string;
  accessModel?: 'free' | 'purchase' | 'rental' | 'subscription';
  providerConfig?: {
    provider: string;
    authType?: 'none' | 'api_key' | 'oauth' | 'signed_token';
    baseUrl?: string;
    headers?: Record<string, string>;
  };
  drm?: {
    type: 'none' | 'widevine' | 'fairplay' | 'custom';
    licenseUrl?: string;
  };
  assets?: Array<{
    type: string;
    url: string;
    quality?: string;
    format?: string;
  }>;
  externalIds?: {
    tmdbId?: string;
    imdbId?: string;
    tvdbId?: string;
    googleBooksId?: string;
    openLibraryId?: string;
    isbn?: string;
    gutenbergId?: string;
  };
  streamInfo?: {
    protocol?: 'hls' | 'dash' | 'progressive';
    resolutions?: string[];
    subtitles?: string[];
    audioTracks?: string[];
  };
  bookInfo?: {
    authors?: string[];
    publisher?: string;
    publishDate?: string;
    pageCount?: number;
    language?: string;
    subjects?: string[];
    format?: 'epub' | 'pdf' | 'mobi';
  };
}

// ============================================================================
// ACCESS RECEIPTS - AUDIT TRAIL FOR ALL CONTENT ACCESS
// ============================================================================

// Access Receipts Table - Wallet-scoped audit trail for all content access
export const accessReceipts = pgTable("access_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  wallet: text("wallet").notNull(),
  itemId: uuid("item_id").references(() => marketplaceItems.id),
  itemType: text("item_type", { enum: marketplaceItemTypes }).notNull(),
  source: text("source", { enum: contentSources }),
  providerId: text("provider_id"),
  action: text("action", { enum: accessActions }).notNull(),
  accessMode: text("access_mode", { enum: accessModes }),
  accessFormat: text("access_format", { enum: accessFormats }),
  accessUri: text("access_uri"),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata"),
  anchorId: uuid("anchor_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAccessReceiptSchema = createInsertSchema(accessReceipts).omit({
  id: true,
  createdAt: true,
});

export type InsertAccessReceipt = z.infer<typeof insertAccessReceiptSchema>;
export type AccessReceipt = typeof accessReceipts.$inferSelect;

// ============================================================================
// MANIFEST LENSES - OPTIMIZED CONTENT SLICES FOR VIEWPORT RENDERING
// Atlas API 2.0 Manifest Lenses System
// ============================================================================

export const lensTypes = ["card", "quickview", "playback"] as const;
export type LensType = typeof lensTypes[number];

export const lensVersions = pgTable("lens_versions", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id", { length: 255 }).notNull(),
  lensType: varchar("lens_type", { length: 50 }).notNull(),
  version: integer("version").notNull().default(1),
  payload: jsonb("payload").notNull(),
  checksum: varchar("checksum", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  itemLensUnique: uniqueIndex("lens_versions_item_lens_unique").on(table.itemId, table.lensType),
}));

export const insertLensVersionSchema = createInsertSchema(lensVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertLensVersion = z.infer<typeof insertLensVersionSchema>;
export type LensVersion = typeof lensVersions.$inferSelect;

export interface CardLens {
  id: string;
  title: string;
  type: string;
  art?: string;
  accessHint: 'free' | 'purchase' | 'rental' | 'subscription' | 'owned';
  version: number;
}

export interface QuickviewLens extends CardLens {
  description?: string;
  provider?: string;
  rating?: number;
  duration?: number;
  pages?: number;
  category?: string;
  tags?: string[];
}

export interface PlaybackLens extends QuickviewLens {
  access?: AccessManifest;
  metadata?: Record<string, unknown>;
  chapters?: Array<{
    title: string;
    startTime?: number;
    startPage?: number;
    duration?: number;
  }>;
  priceWei?: string;
  currency?: string;
  capabilities?: string[];
}

export const lensDeltas = pgTable("lens_deltas", {
  id: serial("id").primaryKey(),
  itemId: varchar("item_id", { length: 255 }).notNull(),
  lensType: varchar("lens_type", { length: 50 }).notNull(),
  fromVersion: integer("from_version").notNull(),
  toVersion: integer("to_version").notNull(),
  changedFields: text("changed_fields").array().notNull(),
  deltaPayload: jsonb("delta_payload").notNull(),
  checksum: varchar("checksum", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLensDeltaSchema = createInsertSchema(lensDeltas).omit({
  id: true,
  createdAt: true,
});

export type InsertLensDelta = z.infer<typeof insertLensDeltaSchema>;
export type LensDelta = typeof lensDeltas.$inferSelect;

// ============================================================================
// RECEIPT ESCROW - ASYNC BLOCKCHAIN ANCHORING FOR USER ACTIVITY
// ============================================================================

export const escrowActions = ["play", "read", "watch", "buy", "listen", "vote", "browse"] as const;
export type EscrowAction = typeof escrowActions[number];

export const escrowStatuses = ["pending", "anchoring", "anchored", "failed"] as const;
export type EscrowStatus = typeof escrowStatuses[number];

export const receiptEscrow = pgTable("receipt_escrow", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 64 }).notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }),
  itemId: varchar("item_id", { length: 128 }).notNull(),
  itemType: varchar("item_type", { length: 32 }),
  action: varchar("action", { length: 16 }).notNull(),
  clientSignature: text("client_signature"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  anchoredAt: timestamp("anchored_at"),
  txHash: varchar("tx_hash", { length: 66 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: uniqueIndex("receipt_escrow_session_idx").on(table.sessionId, table.id),
  walletIdx: uniqueIndex("receipt_escrow_wallet_idx").on(table.walletAddress, table.id),
  statusIdx: uniqueIndex("receipt_escrow_status_idx").on(table.status, table.createdAt),
}));

export const insertReceiptEscrowSchema = createInsertSchema(receiptEscrow).omit({
  id: true,
  createdAt: true,
  anchoredAt: true,
  txHash: true,
});

export type InsertReceiptEscrow = z.infer<typeof insertReceiptEscrowSchema>;
export type ReceiptEscrow = typeof receiptEscrow.$inferSelect;

// ============================================================================
// WALLET PIN AUTHENTICATION - FALLBACK FOR SIWE SIGNATURE ISSUES
// ============================================================================

export const walletPins = pgTable("wallet_pins", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWalletPinSchema = createInsertSchema(walletPins).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  failedAttempts: true,
  lockedUntil: true,
});

export type InsertWalletPin = z.infer<typeof insertWalletPinSchema>;
export type WalletPin = typeof walletPins.$inferSelect;


// ============================================================================
// PWA MARKETPLACE - Progressive Web App Catalog and Install Management
// ============================================================================

export const pwaInstallStatuses = ["installed", "pending", "failed", "rolled_back"] as const;
export const pwaDisplayModes = ["standalone", "fullscreen", "minimal-ui", "browser"] as const;
export const pwaNetworkProfiles = ["offline", "online", "hybrid"] as const;

export const pwaSources = pgTable("pwa_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPwaSourceSchema = createInsertSchema(pwaSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPwaSource = z.infer<typeof insertPwaSourceSchema>;
export type PwaSource = typeof pwaSources.$inferSelect;

export const pwaApps = pgTable("pwa_apps", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  categories: text("categories").array().notNull().default([]),
  homepage: text("homepage"),
  sourceId: uuid("source_id").references(() => pwaSources.id),
  latestVersionId: uuid("latest_version_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPwaAppSchema = createInsertSchema(pwaApps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPwaApp = z.infer<typeof insertPwaAppSchema>;
export type PwaApp = typeof pwaApps.$inferSelect;

export const pwaVersions = pgTable("pwa_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: uuid("app_id").notNull().references(() => pwaApps.id),
  manifestUrl: text("manifest_url").notNull(),
  manifestHash: text("manifest_hash").notNull(),
  bundleUrl: text("bundle_url"),
  bundleHash: text("bundle_hash"),
  display: text("display", { enum: pwaDisplayModes }).notNull().default("standalone"),
  scope: text("scope"),
  startUrl: text("start_url").notNull(),
  offlineReady: boolean("offline_ready").notNull().default(false),
  lighthouse: jsonb("lighthouse"),
  signed: boolean("signed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPwaVersionSchema = createInsertSchema(pwaVersions).omit({
  id: true,
  createdAt: true,
});

export type InsertPwaVersion = z.infer<typeof insertPwaVersionSchema>;
export type PwaVersion = typeof pwaVersions.$inferSelect;

export const pwaInstalls = pgTable("pwa_installs", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  appId: uuid("app_id").notNull().references(() => pwaApps.id),
  versionId: uuid("version_id").notNull().references(() => pwaVersions.id),
  status: text("status", { enum: pwaInstallStatuses }).notNull().default("pending"),
  container: text("container"),
  targetFolder: text("target_folder"),
  networkProfile: text("network_profile", { enum: pwaNetworkProfiles }).default("online"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPwaInstallSchema = createInsertSchema(pwaInstalls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPwaInstall = z.infer<typeof insertPwaInstallSchema>;
export type PwaInstall = typeof pwaInstalls.$inferSelect;

export const pwaSignatures = pgTable("pwa_signatures", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => pwaVersions.id),
  signer: text("signer").notNull(),
  signature: text("signature").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPwaSignatureSchema = createInsertSchema(pwaSignatures).omit({
  id: true,
  createdAt: true,
});

export type InsertPwaSignature = z.infer<typeof insertPwaSignatureSchema>;
export type PwaSignature = typeof pwaSignatures.$inferSelect;

export const pwaAuditTopics = ["install", "rollback", "update", "uninstall", "verify"] as const;

export const pwaAudits = pgTable("pwa_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  topic: text("topic", { enum: pwaAuditTopics }).notNull(),
  refId: text("ref_id").notNull(),
  walletAddress: text("wallet_address"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPwaAuditSchema = createInsertSchema(pwaAudits).omit({
  id: true,
  createdAt: true,
});

export type InsertPwaAudit = z.infer<typeof insertPwaAuditSchema>;
export type PwaAudit = typeof pwaAudits.$inferSelect;

// ============================================================================
// LAUNCHER LAYOUT - Drag-and-drop tile grid with folders and CRDT persistence
// ============================================================================

export const folderColorTags = ["default", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;

export const launcherFolders = pgTable("launcher_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  name: text("name").notNull(),
  colorTag: text("color_tag", { enum: folderColorTags }).notNull().default("default"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLauncherFolderSchema = createInsertSchema(launcherFolders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLauncherFolder = z.infer<typeof insertLauncherFolderSchema>;
export type LauncherFolder = typeof launcherFolders.$inferSelect;

export const launcherTiles = pgTable("launcher_tiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  tileId: text("tile_id").notNull(),
  folderId: uuid("folder_id").references(() => launcherFolders.id),
  orderIndex: integer("order_index").notNull().default(0),
  colorTag: text("color_tag", { enum: folderColorTags }).default("default"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLauncherTileSchema = createInsertSchema(launcherTiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLauncherTile = z.infer<typeof insertLauncherTileSchema>;
export type LauncherTile = typeof launcherTiles.$inferSelect;

// ============================================================================
// ENCRYPTED SESSION VAULT - Per-app cookie/storage isolation with AES-GCM
// ============================================================================

export const vaultKeyStatuses = ["active", "revoked", "rotated"] as const;

export const vaultKeys = pgTable("vault_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  keyVersion: integer("key_version").notNull().default(1),
  encryptedMasterKey: text("encrypted_master_key").notNull(),
  status: text("status", { enum: vaultKeyStatuses }).notNull().default("active"),
  rotatedAt: timestamp("rotated_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVaultKeySchema = createInsertSchema(vaultKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertVaultKey = z.infer<typeof insertVaultKeySchema>;
export type VaultKey = typeof vaultKeys.$inferSelect;

export const vaultAppKeys = pgTable("vault_app_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  appSlug: text("app_slug").notNull(),
  versionId: integer("version_id").notNull().default(1),
  keyDerivationSalt: text("key_derivation_salt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertVaultAppKeySchema = createInsertSchema(vaultAppKeys).omit({
  id: true,
  createdAt: true,
});

export type InsertVaultAppKey = z.infer<typeof insertVaultAppKeySchema>;
export type VaultAppKey = typeof vaultAppKeys.$inferSelect;

export const vaultBlobs = pgTable("vault_blobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  appSlug: text("app_slug").notNull(),
  encryptedBlob: text("encrypted_blob").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVaultBlobSchema = createInsertSchema(vaultBlobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVaultBlob = z.infer<typeof insertVaultBlobSchema>;
export type VaultBlob = typeof vaultBlobs.$inferSelect;

// ============================================================================
// LIVE NEWS - Multi-source RSS/Atom feed aggregation
// ============================================================================

export const newsFeedTypes = ["rss", "atom"] as const;
export const newsCategories = ["world", "tech", "finance", "science", "politics", "entertainment", "sports", "crypto", "gaming", "health"] as const;
export const newsRegions = ["global", "us", "eu", "asia", "middle_east", "africa", "latam"] as const;

export const newsSources = pgTable("news_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),
  feedType: text("feed_type", { enum: newsFeedTypes }).notNull().default("rss"),
  category: text("category", { enum: newsCategories }).notNull().default("world"),
  region: text("region", { enum: newsRegions }).notNull().default("global"),
  enabled: boolean("enabled").notNull().default(true),
  etag: text("etag"),
  lastModified: text("last_modified"),
  lastFetch: timestamp("last_fetch"),
  errorCount: integer("error_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNewsSourceSchema = createInsertSchema(newsSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNewsSource = z.infer<typeof insertNewsSourceSchema>;
export type NewsSource = typeof newsSources.$inferSelect;

export const newsArticles = pgTable("news_articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => newsSources.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  imageUrl: text("image_url"),
  publishedAt: timestamp("published_at"),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  contentHashIdx: uniqueIndex("news_articles_content_hash_idx").on(table.contentHash),
}));

export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({
  id: true,
  createdAt: true,
});

export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;
export type NewsArticle = typeof newsArticles.$inferSelect;

export const userNewsPrefs = pgTable("user_news_prefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  sourceId: uuid("source_id").notNull().references(() => newsSources.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserNewsPrefSchema = createInsertSchema(userNewsPrefs).omit({
  id: true,
  createdAt: true,
});

export type InsertUserNewsPref = z.infer<typeof insertUserNewsPrefSchema>;
export type UserNewsPref = typeof userNewsPrefs.$inferSelect;

// ============================================================================
// PUSH SUBSCRIPTIONS - Web Push notification subscriptions
// ============================================================================

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
  topics: text("topics").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

// ============================================================================
// NODE DAILY METRICS - Persistent mesh node statistics per wallet per day
// ============================================================================

export const nodeDailyMetrics = pgTable("node_daily_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: text("wallet_address").notNull(),
  statsDate: text("stats_date").notNull(),
  bytesServed: bigint("bytes_served", { mode: "number" }).notNull().default(0),
  uptimeMs: bigint("uptime_ms", { mode: "number" }).notNull().default(0),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  peersConnected: integer("peers_connected").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  walletDateIdx: uniqueIndex("node_daily_metrics_wallet_date_idx").on(table.walletAddress, table.statsDate),
}));

export const insertNodeDailyMetricsSchema = createInsertSchema(nodeDailyMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertNodeDailyMetrics = z.infer<typeof insertNodeDailyMetricsSchema>;
export type NodeDailyMetrics = typeof nodeDailyMetrics.$inferSelect;
