import postgres from "postgres";
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
  Message,
  InsertMessage,
  Note,
  InsertNote,
  InstallToken,
  InsertInstallToken,
  Payment,
  InsertPayment,
  AddressIndex,
  WalletProfile,
  InsertWalletProfile,
  VaultCredential,
  InsertVaultCredential,
  AtlasEndpoint,
  InsertAtlasEndpoint,
  ApiRequestMetrics,
  InsertApiRequestMetrics,
  QuarantineItem,
  InsertQuarantineItem,
  PaymentTransaction,
  InsertPaymentTransaction,
  WalletPin,
  InsertWalletPin,
} from "@shared/schema";
import type {
  IStorage,
  LiveUserMetrics,
  GeoMetrics,
  FunnelMetrics,
  DeviceMetrics,
  FraudMetrics,
} from "./storage";

/**
 * PgStorage - PostgreSQL implementation of IStorage
 * 
 * Uses real database queries with:
 * - Parameterized queries for SQL injection prevention
 * - Transactions for atomic operations (ledger + allocations, receipt + audit)
 * - Database sequences for immutableSeq generation
 * - Proper error handling and type safety
 */
export class PgStorage implements IStorage {
  private sql: ReturnType<typeof postgres>;

  constructor(databaseUrl?: string) {
    const connectionString = databaseUrl || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isNeonDb = connectionString.includes('neon') || connectionString.includes('ep-');
    
    this.sql = postgres(connectionString, {
      max: isProduction ? 20 : 10,
      idle_timeout: 30,
      connect_timeout: 30,
      max_lifetime: 60 * 30,
      ssl: isNeonDb || isProduction ? { rejectUnauthorized: false } : false,
      connection: {
        application_name: 'p3-protocol'
      }
    });
  }

  /**
   * Health check ping - verifies database connectivity
   */
  async ping(): Promise<boolean> {
    try {
      await this.sql`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // User Operations
  // ============================================================================

  async createUser(data: InsertUser): Promise<User> {
    try {
      const [user] = await this.sql<User[]>`
        INSERT INTO users (email, password_hash, role)
        VALUES (${data.email}, ${data.passwordHash}, ${data.role || 'viewer'})
        RETURNING *
      `;
      return user;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error(`User with email ${data.email} already exists`);
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const [user] = await this.sql<User[]>`
        SELECT 
          id,
          email,
          password_hash as "passwordHash",
          role,
          created_at as "createdAt"
        FROM users WHERE email = ${email} LIMIT 1
      `;
      return user || null;
    } catch (error: any) {
      throw new Error(`Failed to get user by email: ${error.message}`);
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const [user] = await this.sql<User[]>`
        SELECT 
          id,
          email,
          password_hash as "passwordHash",
          role,
          created_at as "createdAt"
        FROM users WHERE id = ${id} LIMIT 1
      `;
      return user || null;
    } catch (error: any) {
      throw new Error(`Failed to get user by id: ${error.message}`);
    }
  }

  // ============================================================================
  // Receipt Operations
  // ============================================================================

  async createReceipt(data: InsertReceipt): Promise<Receipt> {
    try {
      const [receipt] = await this.sql<Receipt[]>`
        INSERT INTO receipts (
          type,
          subject_id,
          content_hash,
          proof_blob,
          created_by,
          immutable_seq
        )
        VALUES (
          ${data.type},
          ${data.subjectId},
          ${data.contentHash},
          ${JSON.stringify(data.proofBlob)},
          ${data.createdBy},
          (SELECT COALESCE(MAX(immutable_seq), 0) + 1 FROM receipts)
        )
        RETURNING *
      `;
      return receipt;
    } catch (error: any) {
      throw new Error(`Failed to create receipt: ${error.message}`);
    }
  }

  async getReceipt(id: string): Promise<Receipt | null> {
    try {
      const [receipt] = await this.sql<Receipt[]>`
        SELECT * FROM receipts WHERE id = ${id} LIMIT 1
      `;
      return receipt || null;
    } catch (error: any) {
      throw new Error(`Failed to get receipt: ${error.message}`);
    }
  }

  async listReceipts(filters?: { type?: string; subjectId?: string }): Promise<Receipt[]> {
    try {
      if (!filters?.type && !filters?.subjectId) {
        return await this.sql<Receipt[]>`
          SELECT * FROM receipts
          ORDER BY immutable_seq DESC
        `;
      }

      const { type, subjectId } = filters;

      if (type && !subjectId) {
        return await this.sql<Receipt[]>`
          SELECT * FROM receipts
          WHERE type = ${type}
          ORDER BY immutable_seq DESC
        `;
      }

      if (!type && subjectId) {
        return await this.sql<Receipt[]>`
          SELECT * FROM receipts
          WHERE subject_id = ${subjectId}
          ORDER BY immutable_seq DESC
        `;
      }

      if (type && subjectId) {
        return await this.sql<Receipt[]>`
          SELECT * FROM receipts
          WHERE type = ${type} AND subject_id = ${subjectId}
          ORDER BY immutable_seq DESC
        `;
      }

      return await this.sql<Receipt[]>`
        SELECT * FROM receipts
        ORDER BY immutable_seq DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list receipts: ${error.message}`);
    }
  }

  async verifyReceipt(id: string): Promise<boolean> {
    try {
      const [result] = await this.sql<Array<{ valid: boolean }>>`
        SELECT 
          CASE 
            WHEN content_hash IS NOT NULL 
            AND proof_blob IS NOT NULL 
            AND immutable_seq IS NOT NULL 
            THEN true 
            ELSE false 
          END as valid
        FROM receipts
        WHERE id = ${id}
        LIMIT 1
      `;
      return result?.valid || false;
    } catch (error: any) {
      throw new Error(`Failed to verify receipt: ${error.message}`);
    }
  }

  // ============================================================================
  // Ledger Operations
  // ============================================================================

  async createLedgerEvent(data: InsertLedgerEvent): Promise<LedgerEvent> {
    try {
      const [ledgerEvent] = await this.sql<LedgerEvent[]>`
        INSERT INTO ledger_events (
          tx_hash,
          chain_id,
          direction,
          amount,
          asset,
          counterparty,
          memo_hash,
          immutable_seq
        )
        VALUES (
          ${data.txHash},
          ${data.chainId},
          ${data.direction},
          ${data.amount},
          ${data.asset},
          ${data.counterparty},
          ${data.memoHash || null},
          (SELECT COALESCE(MAX(immutable_seq), 0) + 1 FROM ledger_events)
        )
        RETURNING *
      `;
      return ledgerEvent;
    } catch (error: any) {
      throw new Error(`Failed to create ledger event: ${error.message}`);
    }
  }

  async getLedgerEvents(filters?: { chainId?: string; direction?: string }): Promise<LedgerEvent[]> {
    try {
      if (!filters?.chainId && !filters?.direction) {
        return await this.sql<LedgerEvent[]>`
          SELECT * FROM ledger_events
          ORDER BY immutable_seq DESC
        `;
      }

      const { chainId, direction } = filters;

      if (chainId && !direction) {
        return await this.sql<LedgerEvent[]>`
          SELECT * FROM ledger_events
          WHERE chain_id = ${chainId}
          ORDER BY immutable_seq DESC
        `;
      }

      if (!chainId && direction) {
        return await this.sql<LedgerEvent[]>`
          SELECT * FROM ledger_events
          WHERE direction = ${direction}
          ORDER BY immutable_seq DESC
        `;
      }

      if (chainId && direction) {
        return await this.sql<LedgerEvent[]>`
          SELECT * FROM ledger_events
          WHERE chain_id = ${chainId} AND direction = ${direction}
          ORDER BY immutable_seq DESC
        `;
      }

      return await this.sql<LedgerEvent[]>`
        SELECT * FROM ledger_events
        ORDER BY immutable_seq DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get ledger events: ${error.message}`);
    }
  }

  async createAllocation(data: InsertAllocation): Promise<Allocation> {
    try {
      const [allocation] = await this.sql<Allocation[]>`
        INSERT INTO allocations (
          ledger_event_id,
          bucket,
          percent,
          amount,
          policy_ref
        )
        VALUES (
          ${data.ledgerEventId},
          ${data.bucket},
          ${data.percent},
          ${data.amount},
          ${data.policyRef}
        )
        RETURNING *
      `;
      return allocation;
    } catch (error: any) {
      throw new Error(`Failed to create allocation: ${error.message}`);
    }
  }

  async getAllocations(ledgerEventId?: string): Promise<Allocation[]> {
    try {
      if (ledgerEventId) {
        return await this.sql<Allocation[]>`
          SELECT * FROM allocations
          WHERE ledger_event_id = ${ledgerEventId}
          ORDER BY created_at DESC
        `;
      } else {
        return await this.sql<Allocation[]>`
          SELECT * FROM allocations
          ORDER BY created_at DESC
        `;
      }
    } catch (error: any) {
      throw new Error(`Failed to get allocations: ${error.message}`);
    }
  }

  // ============================================================================
  // Telemetry Operations
  // ============================================================================

  async recordTelemetryEvent(data: InsertTelemetryEvent): Promise<TelemetryEvent> {
    try {
      const [event] = await this.sql<TelemetryEvent[]>`
        INSERT INTO telemetry_events (
          event_type,
          session_id,
          hashed_ip,
          geo_region,
          device,
          ua_hash,
          fraud_score
        )
        VALUES (
          ${data.eventType},
          ${data.sessionId},
          ${data.hashedIp},
          ${data.geoRegion || null},
          ${data.device || null},
          ${data.uaHash || null},
          ${data.fraudScore || null}
        )
        RETURNING *
      `;
      return event;
    } catch (error: any) {
      throw new Error(`Failed to record telemetry event: ${error.message}`);
    }
  }

  async getMetrics(): Promise<{
    liveUsers: LiveUserMetrics;
    geo: GeoMetrics[];
    funnel: FunnelMetrics[];
    devices: DeviceMetrics[];
    fraud: FraudMetrics;
  }> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const [liveUsersResult] = await this.sql<Array<{ active_users: number; sessions: number }>>`
        SELECT 
          COUNT(DISTINCT session_id) as active_users,
          COUNT(DISTINCT session_id) as sessions
        FROM telemetry_events
        WHERE ts >= ${fiveMinutesAgo}
      `;

      const liveUsers: LiveUserMetrics = {
        activeUsers: Number(liveUsersResult?.active_users || 0),
        sessions: Number(liveUsersResult?.sessions || 0),
      };

      const geoResults = await this.sql<Array<{ region: string; count: number }>>`
        SELECT 
          geo_region as region,
          COUNT(*) as count
        FROM telemetry_events
        WHERE geo_region IS NOT NULL
        GROUP BY geo_region
        ORDER BY count DESC
      `;

      const geo: GeoMetrics[] = geoResults.map(r => ({
        region: r.region,
        count: Number(r.count),
      }));

      const funnelResults = await this.sql<Array<{ step: string; count: number }>>`
        SELECT 
          event_type as step,
          COUNT(*) as count
        FROM telemetry_events
        GROUP BY event_type
        ORDER BY count DESC
      `;

      const [totalEventsResult] = await this.sql<Array<{ total: number }>>`
        SELECT COUNT(*) as total FROM telemetry_events
      `;

      const totalEvents = Number(totalEventsResult?.total || 1);

      const funnel: FunnelMetrics[] = funnelResults.map(r => ({
        step: r.step,
        count: Number(r.count),
        conversionRate: (Number(r.count) / totalEvents) * 100,
      }));

      const deviceResults = await this.sql<Array<{ device: string; count: number }>>`
        SELECT 
          device,
          COUNT(*) as count
        FROM telemetry_events
        WHERE device IS NOT NULL
        GROUP BY device
        ORDER BY count DESC
      `;

      const devices: DeviceMetrics[] = deviceResults.map(r => ({
        device: r.device,
        count: Number(r.count),
      }));

      const [fraudResult] = await this.sql<Array<{ 
        avg_fraud_score: number; 
        high_risk_sessions: number 
      }>>`
        SELECT 
          COALESCE(AVG(CAST(fraud_score AS NUMERIC)), 0) as avg_fraud_score,
          COUNT(DISTINCT CASE WHEN CAST(fraud_score AS NUMERIC) > 0.7 THEN session_id END) as high_risk_sessions
        FROM telemetry_events
        WHERE fraud_score IS NOT NULL
      `;

      const fraud: FraudMetrics = {
        averageFraudScore: Number(fraudResult?.avg_fraud_score || 0),
        highRiskSessions: Number(fraudResult?.high_risk_sessions || 0),
      };

      return {
        liveUsers,
        geo,
        funnel,
        devices,
        fraud,
      };
    } catch (error: any) {
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  // ============================================================================
  // Page Analytics Operations
  // ============================================================================

  async recordPageView(data: {
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
    try {
      await this.sql`
        INSERT INTO page_analytics (
          route,
          referrer,
          user_agent,
          device_type,
          browser,
          country,
          hashed_ip,
          session_id,
          wallet_address
        )
        VALUES (
          ${data.route},
          ${data.referrer || null},
          ${data.userAgent || null},
          ${data.deviceType || null},
          ${data.browser || null},
          ${data.country || null},
          ${data.hashedIp},
          ${data.sessionId || null},
          ${data.walletAddress || null}
        )
      `;
    } catch (error: any) {
      console.error('Failed to record page view:', error.message);
    }
  }

  async updatePageViewCountry(hashedIp: string, country: string): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      await this.sql`
        UPDATE page_analytics
        SET country = ${country}
        WHERE hashed_ip = ${hashedIp}
          AND country IS NULL
          AND ts >= ${fiveMinutesAgo}
      `;
    } catch (error: any) {
      console.error('Failed to update page view country:', error.message);
    }
  }

  async getPageAnalytics(range: '24h' | '7d' | '30d' = '24h'): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    topPages: { route: string; views: number }[];
    topReferrers: { referrer: string; views: number }[];
    topDevices: { device: string; views: number }[];
    topBrowsers: { browser: string; views: number }[];
  }> {
    try {
      const rangeHours = range === '24h' ? 24 : range === '7d' ? 168 : 720;
      const since = new Date(Date.now() - rangeHours * 60 * 60 * 1000);
      
      // Bot/probe route patterns to exclude from analytics
      const botRoutePatterns = [
        '/phpinfo', '/_profiler', '/wp-', '/wordpress', '/.env', 
        '/admin', '/config', '/Dockerfile', '/@vite', '/error_log',
        '/cgi-bin', '/phpmyadmin', '/mysql', '/backup', '/.git',
        '/actuator', '/debug', '/server-status', '/xmlrpc', '/api-docs',
        '/swagger', '/graphql', '/graphiql', '/telescope', '/horizon'
      ];
      
      // Build SQL condition to exclude bot routes
      const botExclusions = botRoutePatterns.map(p => `route NOT LIKE '${p}%'`).join(' AND ');

      const [totals] = await this.sql<Array<{ total_views: number; unique_visitors: number }>>`
        SELECT 
          COUNT(*) as total_views,
          COUNT(DISTINCT hashed_ip) as unique_visitors
        FROM page_analytics
        WHERE ts >= ${since}
      `;

      const topPages = await this.sql<Array<{ route: string; views: number }>>`
        SELECT route, COUNT(*) as views
        FROM page_analytics
        WHERE ts >= ${since}
          AND route NOT LIKE '/phpinfo%'
          AND route NOT LIKE '/_profiler%'
          AND route NOT LIKE '/wp-%'
          AND route NOT LIKE '/wordpress%'
          AND route NOT LIKE '/.env%'
          AND route NOT LIKE '/Dockerfile%'
          AND route NOT LIKE '/@vite%'
          AND route NOT LIKE '/error_log%'
          AND route NOT LIKE '/var/www%'
          AND route NOT LIKE '/cgi-bin%'
          AND route NOT LIKE '/phpmyadmin%'
          AND route NOT LIKE '/.git%'
          AND route NOT LIKE '/actuator%'
          AND route NOT LIKE '/debug%'
          AND route NOT LIKE '/server-status%'
          AND route NOT LIKE '/xmlrpc%'
          AND route NOT LIKE '/telescope%'
          AND route NOT LIKE '/horizon%'
          AND route NOT LIKE '/admin/%'
          AND route NOT LIKE '/backup%'
        GROUP BY route
        ORDER BY views DESC
        LIMIT 10
      `;

      const topReferrers = await this.sql<Array<{ referrer: string; views: number }>>`
        SELECT 
          CASE 
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
            ELSE referrer 
          END as referrer, 
          COUNT(*) as views
        FROM page_analytics
        WHERE ts >= ${since}
        GROUP BY 
          CASE 
            WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
            ELSE referrer 
          END
        ORDER BY views DESC
        LIMIT 10
      `;

      const topDevices = await this.sql<Array<{ device: string; views: number }>>`
        SELECT COALESCE(device_type, 'Unknown') as device, COUNT(*) as views
        FROM page_analytics
        WHERE ts >= ${since}
        GROUP BY device_type
        ORDER BY views DESC
        LIMIT 10
      `;

      const topBrowsers = await this.sql<Array<{ browser: string; views: number }>>`
        SELECT COALESCE(browser, 'Unknown') as browser, COUNT(*) as views
        FROM page_analytics
        WHERE ts >= ${since}
        GROUP BY browser
        ORDER BY views DESC
        LIMIT 10
      `;

      return {
        totalViews: Number(totals?.total_views || 0),
        uniqueVisitors: Number(totals?.unique_visitors || 0),
        topPages: topPages.map(r => ({ route: r.route, views: Number(r.views) })),
        topReferrers: topReferrers.map(r => ({ referrer: r.referrer, views: Number(r.views) })),
        topDevices: topDevices.map(r => ({ device: r.device, views: Number(r.views) })),
        topBrowsers: topBrowsers.map(r => ({ browser: r.browser, views: Number(r.views) })),
      };
    } catch (error: any) {
      console.error('Failed to get page analytics:', error.message);
      return {
        totalViews: 0,
        uniqueVisitors: 0,
        topPages: [],
        topReferrers: [],
        topDevices: [],
        topBrowsers: [],
      };
    }
  }

  // ============================================================================
  // Audit Operations
  // ============================================================================

  async appendAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    try {
      const [auditLog] = await this.sql<AuditLog[]>`
        INSERT INTO audit_log (
          entity_type,
          entity_id,
          action,
          actor,
          meta
        )
        VALUES (
          ${data.entityType},
          ${data.entityId},
          ${data.action},
          ${data.actor},
          ${data.meta ? JSON.stringify(data.meta) : null}
        )
        RETURNING *
      `;
      return auditLog;
    } catch (error: any) {
      throw new Error(`Failed to append audit log: ${error.message}`);
    }
  }

  async getAuditLog(filters?: { entityType?: string; entityId?: string }): Promise<AuditLog[]> {
    try {
      if (!filters?.entityType && !filters?.entityId) {
        return await this.sql<AuditLog[]>`
          SELECT * FROM audit_log
          ORDER BY created_at DESC
        `;
      }

      const { entityType, entityId } = filters;

      if (entityType && !entityId) {
        return await this.sql<AuditLog[]>`
          SELECT * FROM audit_log
          WHERE entity_type = ${entityType}
          ORDER BY created_at DESC
        `;
      }

      if (!entityType && entityId) {
        return await this.sql<AuditLog[]>`
          SELECT * FROM audit_log
          WHERE entity_id = ${entityId}
          ORDER BY created_at DESC
        `;
      }

      if (entityType && entityId) {
        return await this.sql<AuditLog[]>`
          SELECT * FROM audit_log
          WHERE entity_type = ${entityType} AND entity_id = ${entityId}
          ORDER BY created_at DESC
        `;
      }

      return await this.sql<AuditLog[]>`
        SELECT * FROM audit_log
        ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get audit log: ${error.message}`);
    }
  }

  // ============================================================================
  // Wallet Registry Operations
  // ============================================================================

  async getWalletRegistry(): Promise<WalletRegistry[]> {
    try {
      return await this.sql<WalletRegistry[]>`
        SELECT * FROM wallet_registry
        ORDER BY name ASC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get wallet registry: ${error.message}`);
    }
  }

  async setPreferredWallet(userId: string, walletId: string): Promise<void> {
    try {
      await this.sql`
        INSERT INTO user_wallet_preferences (user_id, wallet_id)
        VALUES (${userId}, ${walletId})
        ON CONFLICT (user_id)
        DO UPDATE SET wallet_id = ${walletId}
      `;
    } catch (error: any) {
      throw new Error(`Failed to set preferred wallet: ${error.message}`);
    }
  }

  async getPreferredWallet(userId: string): Promise<string | null> {
    try {
      const [result] = await this.sql<Array<{ wallet_id: string }>>`
        SELECT wallet_id FROM user_wallet_preferences
        WHERE user_id = ${userId}
        LIMIT 1
      `;
      return result?.wallet_id || null;
    } catch (error: any) {
      if (error.message.includes('does not exist')) {
        return null;
      }
      throw new Error(`Failed to get preferred wallet: ${error.message}`);
    }
  }

  // ============================================================================
  // Voice Call Operations
  // ============================================================================

  async createCallSession(data: InsertCallSession): Promise<CallSession> {
    try {
      const [callSession] = await this.sql<CallSession[]>`
        INSERT INTO call_sessions (
          room_id,
          participants_hashes,
          media_type,
          start_tx,
          end_tx,
          started_at,
          ended_at,
          duration_sec,
          metrics_summary,
          immutable_seq
        )
        VALUES (
          ${data.roomId},
          ${data.participantsHashes},
          ${data.mediaType},
          ${data.startTx || null},
          ${data.endTx || null},
          ${data.startedAt},
          ${data.endedAt || null},
          ${data.durationSec || null},
          ${data.metricsSummary ? JSON.stringify(data.metricsSummary) : null},
          (SELECT COALESCE(MAX(immutable_seq), 0) + 1 FROM call_sessions)
        )
        RETURNING *
      `;
      return callSession;
    } catch (error: any) {
      throw new Error(`Failed to create call session: ${error.message}`);
    }
  }

  async updateCallSession(id: string, data: Partial<InsertCallSession>): Promise<CallSession> {
    try {
      const existing = await this.getCallSession(id);
      if (!existing) {
        throw new Error(`Call session not found: ${id}`);
      }

      if (Object.keys(data).length === 0) {
        return existing;
      }

      const updates: Record<string, any> = {};
      
      if (data.roomId !== undefined) updates.room_id = data.roomId;
      if (data.participantsHashes !== undefined) updates.participants_hashes = data.participantsHashes;
      if (data.mediaType !== undefined) updates.media_type = data.mediaType;
      if (data.startTx !== undefined) updates.start_tx = data.startTx;
      if (data.endTx !== undefined) updates.end_tx = data.endTx;
      if (data.startedAt !== undefined) updates.started_at = data.startedAt;
      if (data.endedAt !== undefined) updates.ended_at = data.endedAt;
      if (data.durationSec !== undefined) updates.duration_sec = data.durationSec;
      if (data.metricsSummary !== undefined) {
        updates.metrics_summary = data.metricsSummary ? JSON.stringify(data.metricsSummary) : null;
      }

      if (Object.keys(updates).length === 0) {
        return existing;
      }

      const [callSession] = await this.sql<CallSession[]>`
        UPDATE call_sessions
        SET ${this.sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!callSession) {
        throw new Error(`Call session not found: ${id}`);
      }

      return callSession;
    } catch (error: any) {
      throw new Error(`Failed to update call session: ${error.message}`);
    }
  }

  async getCallSession(id: string): Promise<CallSession | null> {
    try {
      const [callSession] = await this.sql<CallSession[]>`
        SELECT * FROM call_sessions WHERE id = ${id} LIMIT 1
      `;
      return callSession || null;
    } catch (error: any) {
      throw new Error(`Failed to get call session: ${error.message}`);
    }
  }

  async getCallSessionByRoomId(roomId: string): Promise<CallSession | null> {
    try {
      const [callSession] = await this.sql<CallSession[]>`
        SELECT * FROM call_sessions
        WHERE room_id = ${roomId} AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
      `;
      return callSession || null;
    } catch (error: any) {
      throw new Error(`Failed to get call session by room id: ${error.message}`);
    }
  }

  async listCallSessions(roomId?: string): Promise<CallSession[]> {
    try {
      if (roomId) {
        return await this.sql<CallSession[]>`
          SELECT * FROM call_sessions
          WHERE room_id = ${roomId}
          ORDER BY immutable_seq DESC
        `;
      } else {
        return await this.sql<CallSession[]>`
          SELECT * FROM call_sessions
          ORDER BY immutable_seq DESC
        `;
      }
    } catch (error: any) {
      throw new Error(`Failed to list call sessions: ${error.message}`);
    }
  }

  // ============================================================================
  // Voice Telemetry Operations
  // ============================================================================

  async recordVoiceTelemetry(data: InsertTelemetryVoice): Promise<TelemetryVoice> {
    try {
      const [voiceTelemetry] = await this.sql<TelemetryVoice[]>`
        INSERT INTO telemetry_voice (
          room_hash,
          session_id,
          rtt_ms,
          jitter_ms,
          packets_lost_pct,
          bitrate_kbps,
          codec,
          audio_level,
          ice_state
        )
        VALUES (
          ${data.roomHash},
          ${data.sessionId},
          ${data.rttMs || null},
          ${data.jitterMs || null},
          ${data.packetsLostPct || null},
          ${data.bitrateKbps || null},
          ${data.codec || null},
          ${data.audioLevel || null},
          ${data.iceState || null}
        )
        RETURNING *
      `;
      return voiceTelemetry;
    } catch (error: any) {
      throw new Error(`Failed to record voice telemetry: ${error.message}`);
    }
  }

  async getVoiceTelemetry(filters?: { roomHash?: string; sessionId?: string }): Promise<TelemetryVoice[]> {
    try {
      if (!filters?.roomHash && !filters?.sessionId) {
        return await this.sql<TelemetryVoice[]>`
          SELECT * FROM telemetry_voice
          ORDER BY ts DESC
        `;
      }

      const { roomHash, sessionId } = filters;

      if (roomHash && !sessionId) {
        return await this.sql<TelemetryVoice[]>`
          SELECT * FROM telemetry_voice
          WHERE room_hash = ${roomHash}
          ORDER BY ts DESC
        `;
      }

      if (!roomHash && sessionId) {
        return await this.sql<TelemetryVoice[]>`
          SELECT * FROM telemetry_voice
          WHERE session_id = ${sessionId}
          ORDER BY ts DESC
        `;
      }

      if (roomHash && sessionId) {
        return await this.sql<TelemetryVoice[]>`
          SELECT * FROM telemetry_voice
          WHERE room_hash = ${roomHash} AND session_id = ${sessionId}
          ORDER BY ts DESC
        `;
      }

      return await this.sql<TelemetryVoice[]>`
        SELECT * FROM telemetry_voice
        ORDER BY ts DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get voice telemetry: ${error.message}`);
    }
  }

  // ============================================================================
  // Trust Config Operations
  // ============================================================================

  async getTrustConfig(key?: string): Promise<TrustConfig[]> {
    try {
      if (key) {
        return await this.sql<TrustConfig[]>`
          SELECT * FROM trust_config
          WHERE key = ${key}
          ORDER BY version DESC
        `;
      } else {
        return await this.sql<TrustConfig[]>`
          SELECT DISTINCT ON (key) *
          FROM trust_config
          ORDER BY key, version DESC
        `;
      }
    } catch (error: any) {
      throw new Error(`Failed to get trust config: ${error.message}`);
    }
  }

  async createTrustConfig(data: InsertTrustConfig): Promise<TrustConfig> {
    try {
      const [config] = await this.sql<TrustConfig[]>`
        INSERT INTO trust_config (key, value, version, created_by)
        VALUES (
          ${data.key},
          ${JSON.stringify(data.value)},
          ${data.version || 1},
          ${data.createdBy}
        )
        RETURNING *
      `;
      return config;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error(`Config with key ${data.key} already exists`);
      }
      throw new Error(`Failed to create trust config: ${error.message}`);
    }
  }

  async updateTrustConfig(key: string, value: any, userId: string): Promise<TrustConfig> {
    try {
      const existing = await this.sql<TrustConfig[]>`
        SELECT * FROM trust_config
        WHERE key = ${key}
        ORDER BY version DESC
        LIMIT 1
      `;

      const newVersion = existing.length > 0 ? existing[0].version + 1 : 1;

      const [config] = await this.sql<TrustConfig[]>`
        INSERT INTO trust_config (key, value, version, created_by)
        VALUES (
          ${key},
          ${JSON.stringify(value)},
          ${newVersion},
          ${userId}
        )
        RETURNING *
      `;

      return config;
    } catch (error: any) {
      throw new Error(`Failed to update trust config: ${error.message}`);
    }
  }

  // ============================================================================
  // Trust Rules Operations
  // ============================================================================

  async getTrustRules(filters?: { status?: string }): Promise<TrustRule[]> {
    try {
      if (filters?.status) {
        return await this.sql<TrustRule[]>`
          SELECT * FROM trust_rules
          WHERE status = ${filters.status}
          ORDER BY priority ASC, created_at DESC
        `;
      } else {
        return await this.sql<TrustRule[]>`
          SELECT * FROM trust_rules
          ORDER BY priority ASC, created_at DESC
        `;
      }
    } catch (error: any) {
      throw new Error(`Failed to get trust rules: ${error.message}`);
    }
  }

  async getTrustRule(id: string): Promise<TrustRule | null> {
    try {
      const [rule] = await this.sql<TrustRule[]>`
        SELECT * FROM trust_rules WHERE id = ${id} LIMIT 1
      `;
      return rule || null;
    } catch (error: any) {
      throw new Error(`Failed to get trust rule: ${error.message}`);
    }
  }

  async createTrustRule(data: InsertTrustRule): Promise<TrustRule> {
    try {
      const [rule] = await this.sql<TrustRule[]>`
        INSERT INTO trust_rules (
          name,
          description,
          condition,
          action,
          priority,
          status,
          created_by
        )
        VALUES (
          ${data.name},
          ${data.description || null},
          ${JSON.stringify(data.condition)},
          ${JSON.stringify(data.action)},
          ${data.priority || 100},
          ${data.status || 'active'},
          ${data.createdBy}
        )
        RETURNING *
      `;
      return rule;
    } catch (error: any) {
      throw new Error(`Failed to create trust rule: ${error.message}`);
    }
  }

  async updateTrustRule(id: string, data: Partial<InsertTrustRule>): Promise<TrustRule> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = $' + (values.length + 1));
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = $' + (values.length + 1));
        values.push(data.description);
      }
      if (data.condition !== undefined) {
        updates.push('condition = $' + (values.length + 1));
        values.push(JSON.stringify(data.condition));
      }
      if (data.action !== undefined) {
        updates.push('action = $' + (values.length + 1));
        values.push(JSON.stringify(data.action));
      }
      if (data.priority !== undefined) {
        updates.push('priority = $' + (values.length + 1));
        values.push(data.priority);
      }
      if (data.status !== undefined) {
        updates.push('status = $' + (values.length + 1));
        values.push(data.status);
      }

      updates.push('updated_at = NOW()');

      const [rule] = await this.sql<TrustRule[]>`
        UPDATE trust_rules
        SET ${this.sql(updates.join(', '))}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!rule) {
        throw new Error(`Trust rule not found: ${id}`);
      }

      return rule;
    } catch (error: any) {
      throw new Error(`Failed to update trust rule: ${error.message}`);
    }
  }

  async incrementRuleExecution(id: string): Promise<void> {
    try {
      await this.sql`
        UPDATE trust_rules
        SET 
          execution_count = execution_count + 1,
          last_executed_at = NOW()
        WHERE id = ${id}
      `;
    } catch (error: any) {
      throw new Error(`Failed to increment rule execution: ${error.message}`);
    }
  }

  // ============================================================================
  // Trust Plugin Operations
  // ============================================================================

  async getTrustPlugins(filters?: { status?: string }): Promise<TrustPlugin[]> {
    try {
      if (filters?.status) {
        return await this.sql<TrustPlugin[]>`
          SELECT * FROM trust_plugins
          WHERE status = ${filters.status}
          ORDER BY installed_at DESC
        `;
      } else {
        return await this.sql<TrustPlugin[]>`
          SELECT * FROM trust_plugins
          ORDER BY installed_at DESC
        `;
      }
    } catch (error: any) {
      throw new Error(`Failed to get trust plugins: ${error.message}`);
    }
  }

  async getTrustPlugin(id: string): Promise<TrustPlugin | null> {
    try {
      const [plugin] = await this.sql<TrustPlugin[]>`
        SELECT * FROM trust_plugins WHERE id = ${id} LIMIT 1
      `;
      return plugin || null;
    } catch (error: any) {
      throw new Error(`Failed to get trust plugin: ${error.message}`);
    }
  }

  async createTrustPlugin(data: InsertTrustPlugin): Promise<TrustPlugin> {
    try {
      const [plugin] = await this.sql<TrustPlugin[]>`
        INSERT INTO trust_plugins (
          plugin_id,
          name,
          version,
          description,
          config,
          status,
          installed_by
        )
        VALUES (
          ${data.pluginId},
          ${data.name},
          ${data.version},
          ${data.description || null},
          ${data.config ? JSON.stringify(data.config) : null},
          ${data.status || 'enabled'},
          ${data.installedBy}
        )
        RETURNING *
      `;
      return plugin;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error(`Plugin with ID ${data.pluginId} already exists`);
      }
      throw new Error(`Failed to create trust plugin: ${error.message}`);
    }
  }

  async updateTrustPlugin(id: string, data: Partial<InsertTrustPlugin>): Promise<TrustPlugin> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.name !== undefined) {
        updates.push('name = $' + (values.length + 1));
        values.push(data.name);
      }
      if (data.version !== undefined) {
        updates.push('version = $' + (values.length + 1));
        values.push(data.version);
      }
      if (data.description !== undefined) {
        updates.push('description = $' + (values.length + 1));
        values.push(data.description);
      }
      if (data.config !== undefined) {
        updates.push('config = $' + (values.length + 1));
        values.push(JSON.stringify(data.config));
      }
      if (data.status !== undefined) {
        updates.push('status = $' + (values.length + 1));
        values.push(data.status);
      }

      updates.push('updated_at = NOW()');

      const [plugin] = await this.sql<TrustPlugin[]>`
        UPDATE trust_plugins
        SET ${this.sql(updates.join(', '))}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!plugin) {
        throw new Error(`Trust plugin not found: ${id}`);
      }

      return plugin;
    } catch (error: any) {
      throw new Error(`Failed to update trust plugin: ${error.message}`);
    }
  }

  // ============================================================================
  // User Management Operations
  // ============================================================================

  async listUsers(): Promise<User[]> {
    try {
      return await this.sql<User[]>`
        SELECT * FROM users
        ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list users: ${error.message}`);
    }
  }

  async updateUserRole(id: string, role: 'admin' | 'viewer'): Promise<User> {
    try {
      const [user] = await this.sql<User[]>`
        UPDATE users
        SET role = ${role}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!user) {
        throw new Error(`User not found: ${id}`);
      }

      return user;
    } catch (error: any) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const result = await this.sql`
        DELETE FROM users WHERE id = ${id}
      `;

      if (result.count === 0) {
        throw new Error(`User not found: ${id}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // ============================================================================
  // App Layer Operations - Messages
  // ============================================================================

  async createMessage(data: InsertMessage): Promise<Message> {
    try {
      const [row] = await this.sql`
        INSERT INTO messages (
          from_wallet,
          to_wallet,
          message_type,
          encrypted_content,
          content_hash,
          ipfs_cid,
          receipt_id,
          anchor_tx_hash,
          anchor_status,
          anchor_timestamp,
          status,
          metadata,
          delivered_at,
          read_at
        )
        VALUES (
          ${data.fromWallet},
          ${data.toWallet},
          ${data.messageType || 'text'},
          ${data.encryptedContent},
          ${data.contentHash},
          ${data.ipfsCid || null},
          ${data.receiptId || null},
          ${data.anchorTxHash || null},
          ${data.anchorStatus || 'none'},
          ${data.anchorTimestamp || null},
          ${data.status || 'sent'},
          ${data.metadata ? JSON.stringify(data.metadata) : null},
          ${data.deliveredAt || null},
          ${data.readAt || null}
        )
        RETURNING id, from_wallet as "fromWallet", to_wallet as "toWallet", message_type as "messageType",
                  encrypted_content as "encryptedContent", content_hash as "contentHash",
                  ipfs_cid as "ipfsCid", receipt_id as "receiptId", anchor_tx_hash as "anchorTxHash",
                  anchor_status as "anchorStatus", anchor_timestamp as "anchorTimestamp",
                  status, metadata, created_at as "createdAt", delivered_at as "deliveredAt", read_at as "readAt"
      `;
      return {
        id: String(row.id),
        fromWallet: row.fromWallet,
        toWallet: row.toWallet,
        messageType: row.messageType,
        encryptedContent: row.encryptedContent,
        contentHash: row.contentHash,
        ipfsCid: row.ipfsCid,
        receiptId: row.receiptId,
        anchorTxHash: row.anchorTxHash,
        anchorStatus: row.anchorStatus,
        anchorTimestamp: row.anchorTimestamp,
        status: row.status,
        metadata: row.metadata,
        createdAt: row.createdAt,
        deliveredAt: row.deliveredAt,
        readAt: row.readAt,
      } as Message;
    } catch (error: any) {
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  async getMessage(id: string): Promise<Message | null> {
    try {
      const [message] = await this.sql<Message[]>`
        SELECT * FROM messages WHERE id = ${id} LIMIT 1
      `;
      return message || null;
    } catch (error: any) {
      throw new Error(`Failed to get message: ${error.message}`);
    }
  }

  async listMessages(filters?: { fromWallet?: string; toWallet?: string; walletAddress?: string }): Promise<Message[]> {
    try {
      if (filters?.walletAddress) {
        return await this.sql<Message[]>`
          SELECT * FROM messages
          WHERE from_wallet = ${filters.walletAddress} OR to_wallet = ${filters.walletAddress}
          ORDER BY created_at DESC
        `;
      }

      if (filters?.fromWallet && !filters?.toWallet) {
        return await this.sql<Message[]>`
          SELECT * FROM messages
          WHERE from_wallet = ${filters.fromWallet}
          ORDER BY created_at DESC
        `;
      }

      if (!filters?.fromWallet && filters?.toWallet) {
        return await this.sql<Message[]>`
          SELECT * FROM messages
          WHERE to_wallet = ${filters.toWallet}
          ORDER BY created_at DESC
        `;
      }

      if (filters?.fromWallet && filters?.toWallet) {
        return await this.sql<Message[]>`
          SELECT * FROM messages
          WHERE from_wallet = ${filters.fromWallet} AND to_wallet = ${filters.toWallet}
          ORDER BY created_at DESC
        `;
      }

      return await this.sql<Message[]>`
        SELECT * FROM messages
        ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list messages: ${error.message}`);
    }
  }

  async updateMessageStatus(id: string, status: string, timestamp?: Date): Promise<Message> {
    try {
      const updates: Record<string, any> = { status };
      
      if (status === 'delivered' && timestamp) {
        updates.delivered_at = timestamp;
      } else if (status === 'read' && timestamp) {
        updates.read_at = timestamp;
      }

      const [message] = await this.sql<Message[]>`
        UPDATE messages
        SET ${this.sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!message) {
        throw new Error(`Message not found: ${id}`);
      }

      return message;
    } catch (error: any) {
      throw new Error(`Failed to update message status: ${error.message}`);
    }
  }

  async updateMessageAnchor(id: string, anchorTxHash: string, anchorStatus: string, anchorTimestamp: Date): Promise<Message> {
    try {
      const [message] = await this.sql<Message[]>`
        UPDATE messages
        SET 
          anchor_tx_hash = ${anchorTxHash},
          anchor_status = ${anchorStatus},
          anchor_timestamp = ${anchorTimestamp}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!message) {
        throw new Error(`Message not found: ${id}`);
      }

      return message;
    } catch (error: any) {
      throw new Error(`Failed to update message anchor: ${error.message}`);
    }
  }

  // ============================================================================
  // App Layer Operations - Notes
  // ============================================================================

  async createNote(data: InsertNote): Promise<Note> {
    try {
      const encryptedValue = data.encryptedBody || '';
      const [note] = await this.sql<Note[]>`
        INSERT INTO notes (
          wallet_address,
          title,
          encrypted_body,
          encrypted_content,
          searchable_content,
          tags,
          is_pinned,
          receipt_id,
          anchor_tx_hash,
          anchor_status,
          anchor_timestamp
        )
        VALUES (
          ${data.walletAddress},
          ${data.title},
          ${encryptedValue},
          ${encryptedValue},
          ${data.searchableContent || null},
          ${data.tags || []},
          ${data.isPinned || 0},
          ${data.receiptId || null},
          ${data.anchorTxHash || null},
          ${data.anchorStatus || 'none'},
          ${data.anchorTimestamp || null}
        )
        RETURNING *
      `;
      return note;
    } catch (error: any) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  }

  async getNote(id: string): Promise<Note | null> {
    try {
      const [note] = await this.sql<Note[]>`
        SELECT * FROM notes WHERE id = ${id} LIMIT 1
      `;
      return note || null;
    } catch (error: any) {
      throw new Error(`Failed to get note: ${error.message}`);
    }
  }

  async listNotes(filters?: { walletAddress?: string; searchQuery?: string }): Promise<Note[]> {
    try {
      if (!filters?.walletAddress && !filters?.searchQuery) {
        return await this.sql<Note[]>`
          SELECT * FROM notes
          ORDER BY is_pinned DESC, updated_at DESC
        `;
      }

      if (filters?.walletAddress && !filters?.searchQuery) {
        return await this.sql<Note[]>`
          SELECT * FROM notes
          WHERE wallet_address = ${filters.walletAddress}
          ORDER BY is_pinned DESC, updated_at DESC
        `;
      }

      if (filters?.walletAddress && filters?.searchQuery) {
        const searchPattern = `%${filters.searchQuery}%`;
        return await this.sql<Note[]>`
          SELECT * FROM notes
          WHERE wallet_address = ${filters.walletAddress}
            AND (
              title ILIKE ${searchPattern}
              OR searchable_content ILIKE ${searchPattern}
            )
          ORDER BY is_pinned DESC, updated_at DESC
        `;
      }

      if (!filters?.walletAddress && filters?.searchQuery) {
        const searchPattern = `%${filters.searchQuery}%`;
        return await this.sql<Note[]>`
          SELECT * FROM notes
          WHERE title ILIKE ${searchPattern}
            OR searchable_content ILIKE ${searchPattern}
          ORDER BY is_pinned DESC, updated_at DESC
        `;
      }

      return await this.sql<Note[]>`
        SELECT * FROM notes
        ORDER BY is_pinned DESC, updated_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list notes: ${error.message}`);
    }
  }

  async updateNote(id: string, data: Partial<InsertNote>): Promise<Note> {
    try {
      const existing = await this.getNote(id);
      if (!existing) {
        throw new Error(`Note not found: ${id}`);
      }

      if (Object.keys(data).length === 0) {
        return existing;
      }

      const updates: Record<string, any> = { updated_at: new Date() };
      
      if (data.title !== undefined) updates.title = data.title;
      if (data.encryptedBody !== undefined) updates.encrypted_body = data.encryptedBody;
      if (data.searchableContent !== undefined) updates.searchable_content = data.searchableContent;
      if (data.tags !== undefined) updates.tags = data.tags;
      if (data.isPinned !== undefined) updates.is_pinned = data.isPinned;
      if (data.receiptId !== undefined) updates.receipt_id = data.receiptId;
      if (data.anchorTxHash !== undefined) updates.anchor_tx_hash = data.anchorTxHash;
      if (data.anchorStatus !== undefined) updates.anchor_status = data.anchorStatus;
      if (data.anchorTimestamp !== undefined) updates.anchor_timestamp = data.anchorTimestamp;

      const [note] = await this.sql<Note[]>`
        UPDATE notes
        SET ${this.sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!note) {
        throw new Error(`Note not found: ${id}`);
      }

      return note;
    } catch (error: any) {
      throw new Error(`Failed to update note: ${error.message}`);
    }
  }

  async deleteNote(id: string): Promise<void> {
    try {
      const result = await this.sql`
        DELETE FROM notes WHERE id = ${id}
      `;

      if (result.count === 0) {
        throw new Error(`Note not found: ${id}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to delete note: ${error.message}`);
    }
  }

  async updateNoteAnchor(id: string, anchorTxHash: string, anchorStatus: string, anchorTimestamp: Date): Promise<Note> {
    try {
      const [note] = await this.sql<Note[]>`
        UPDATE notes
        SET 
          anchor_tx_hash = ${anchorTxHash},
          anchor_status = ${anchorStatus},
          anchor_timestamp = ${anchorTimestamp},
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      if (!note) {
        throw new Error(`Note not found: ${id}`);
      }

      return note;
    } catch (error: any) {
      throw new Error(`Failed to update note anchor: ${error.message}`);
    }
  }

  // ============================================================================
  // App Layer Operations - Directory
  // ============================================================================

  async createOrUpdateDirectoryEntry(data: any): Promise<any> {
    try {
      const [entry] = await this.sql`
        INSERT INTO directory_entries (
          wallet_address,
          ens_name,
          basename,
          avatar_url,
          bio,
          metadata
        )
        VALUES (
          ${data.walletAddress},
          ${data.ensName || null},
          ${data.basename || null},
          ${data.avatarUrl || null},
          ${data.bio || null},
          ${data.metadata ? JSON.stringify(data.metadata) : null}
        )
        ON CONFLICT (wallet_address)
        DO UPDATE SET
          ens_name = COALESCE(EXCLUDED.ens_name, directory_entries.ens_name),
          basename = COALESCE(EXCLUDED.basename, directory_entries.basename),
          avatar_url = COALESCE(EXCLUDED.avatar_url, directory_entries.avatar_url),
          bio = COALESCE(EXCLUDED.bio, directory_entries.bio),
          metadata = COALESCE(EXCLUDED.metadata, directory_entries.metadata),
          last_resolved_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;
      return entry;
    } catch (error: any) {
      throw new Error(`Failed to create/update directory entry: ${error.message}`);
    }
  }

  async getDirectoryEntry(walletAddress: string): Promise<any | null> {
    try {
      const [entry] = await this.sql`
        SELECT * FROM directory_entries WHERE wallet_address = ${walletAddress} LIMIT 1
      `;
      return entry || null;
    } catch (error: any) {
      throw new Error(`Failed to get directory entry: ${error.message}`);
    }
  }

  async listDirectoryEntries(filters?: { searchQuery?: string; isVerified?: boolean }): Promise<any[]> {
    try {
      if (!filters?.searchQuery && filters?.isVerified === undefined) {
        return await this.sql`
          SELECT * FROM directory_entries
          ORDER BY is_verified DESC, last_resolved_at DESC
        `;
      }

      if (filters?.searchQuery && filters?.isVerified === undefined) {
        const searchPattern = `%${filters.searchQuery}%`;
        return await this.sql`
          SELECT * FROM directory_entries
          WHERE wallet_address ILIKE ${searchPattern}
            OR ens_name ILIKE ${searchPattern}
            OR basename ILIKE ${searchPattern}
          ORDER BY is_verified DESC, last_resolved_at DESC
        `;
      }

      if (!filters?.searchQuery && filters?.isVerified !== undefined) {
        const isVerified = filters.isVerified ? 1 : 0;
        return await this.sql`
          SELECT * FROM directory_entries
          WHERE is_verified = ${isVerified}
          ORDER BY last_resolved_at DESC
        `;
      }

      if (filters?.searchQuery && filters?.isVerified !== undefined) {
        const searchPattern = `%${filters.searchQuery}%`;
        const isVerified = filters.isVerified ? 1 : 0;
        return await this.sql`
          SELECT * FROM directory_entries
          WHERE is_verified = ${isVerified}
            AND (
              wallet_address ILIKE ${searchPattern}
              OR ens_name ILIKE ${searchPattern}
              OR basename ILIKE ${searchPattern}
            )
          ORDER BY last_resolved_at DESC
        `;
      }

      return await this.sql`
        SELECT * FROM directory_entries
        ORDER BY is_verified DESC, last_resolved_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list directory entries: ${error.message}`);
    }
  }

  // ============================================================================
  // App Layer Operations - Inbox
  // ============================================================================

  async createInboxItem(data: any): Promise<any> {
    try {
      const [item] = await this.sql`
        INSERT INTO inbox_items (
          wallet_address,
          message_id,
          status,
          is_starred,
          labels
        )
        VALUES (
          ${data.walletAddress},
          ${data.messageId},
          ${data.status || 'unread'},
          ${data.isStarred || 0},
          ${data.labels || []}
        )
        RETURNING *
      `;
      return item;
    } catch (error: any) {
      throw new Error(`Failed to create inbox item: ${error.message}`);
    }
  }

  async getInboxItem(id: string): Promise<any | null> {
    try {
      const [item] = await this.sql`
        SELECT 
          i.*,
          row_to_json(m.*) as message
        FROM inbox_items i
        LEFT JOIN messages m ON i.message_id = m.id
        WHERE i.id = ${id}
        LIMIT 1
      `;
      return item || null;
    } catch (error: any) {
      throw new Error(`Failed to get inbox item: ${error.message}`);
    }
  }

  async listInboxItems(filters?: { walletAddress?: string; status?: string }): Promise<any[]> {
    try {
      if (!filters?.walletAddress && !filters?.status) {
        return await this.sql`
          SELECT 
            i.*,
            row_to_json(m.*) as message
          FROM inbox_items i
          LEFT JOIN messages m ON i.message_id = m.id
          ORDER BY i.created_at DESC
        `;
      }

      if (filters?.walletAddress && !filters?.status) {
        return await this.sql`
          SELECT 
            i.*,
            row_to_json(m.*) as message
          FROM inbox_items i
          LEFT JOIN messages m ON i.message_id = m.id
          WHERE i.wallet_address = ${filters.walletAddress}
          ORDER BY i.created_at DESC
        `;
      }

      if (!filters?.walletAddress && filters?.status) {
        return await this.sql`
          SELECT 
            i.*,
            row_to_json(m.*) as message
          FROM inbox_items i
          LEFT JOIN messages m ON i.message_id = m.id
          WHERE i.status = ${filters.status}
          ORDER BY i.created_at DESC
        `;
      }

      if (filters?.walletAddress && filters?.status) {
        return await this.sql`
          SELECT 
            i.*,
            row_to_json(m.*) as message
          FROM inbox_items i
          LEFT JOIN messages m ON i.message_id = m.id
          WHERE i.wallet_address = ${filters.walletAddress}
            AND i.status = ${filters.status}
          ORDER BY i.created_at DESC
        `;
      }

      return await this.sql`
        SELECT 
          i.*,
          row_to_json(m.*) as message
        FROM inbox_items i
        LEFT JOIN messages m ON i.message_id = m.id
        ORDER BY i.created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list inbox items: ${error.message}`);
    }
  }

  async updateInboxItem(id: string, data: Partial<any>): Promise<any> {
    try {
      const existing = await this.getInboxItem(id);
      if (!existing) {
        throw new Error(`Inbox item not found: ${id}`);
      }

      if (Object.keys(data).length === 0) {
        return existing;
      }

      const updates: Record<string, any> = { updated_at: new Date() };
      
      if (data.status !== undefined) updates.status = data.status;
      if (data.isStarred !== undefined) updates.is_starred = data.isStarred;
      if (data.labels !== undefined) updates.labels = data.labels;

      const [item] = await this.sql`
        UPDATE inbox_items
        SET ${this.sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!item) {
        throw new Error(`Inbox item not found: ${id}`);
      }

      return item;
    } catch (error: any) {
      throw new Error(`Failed to update inbox item: ${error.message}`);
    }
  }

  async bulkUpdateInboxItems(ids: string[], data: Partial<any>): Promise<void> {
    try {
      if (ids.length === 0) {
        return;
      }

      const updates: Record<string, any> = { updated_at: new Date() };
      
      if (data.status !== undefined) updates.status = data.status;
      if (data.isStarred !== undefined) updates.is_starred = data.isStarred;
      if (data.labels !== undefined) updates.labels = data.labels;

      await this.sql`
        UPDATE inbox_items
        SET ${this.sql(updates)}
        WHERE id = ANY(${ids})
      `;
    } catch (error: any) {
      throw new Error(`Failed to bulk update inbox items: ${error.message}`);
    }
  }

  async bulkDeleteInboxItems(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        return;
      }

      await this.sql`
        DELETE FROM inbox_items
        WHERE id = ANY(${ids})
      `;
    } catch (error: any) {
      throw new Error(`Failed to bulk delete inbox items: ${error.message}`);
    }
  }

  // ============================================================================
  // DAO Proposal Operations
  // ============================================================================

  async createDaoProposal(data: any): Promise<any> {
    try {
      const [proposal] = await this.sql`
        INSERT INTO dao_proposals (
          proposal_id,
          proposer,
          title,
          description,
          targets,
          values,
          calldatas,
          status,
          votes_for,
          votes_against,
          votes_abstain,
          start_block,
          end_block,
          eta,
          tx_hash,
          metadata
        )
        VALUES (
          ${data.proposalId},
          ${data.proposer},
          ${data.title},
          ${data.description},
          ${data.targets || []},
          ${data.values || []},
          ${data.calldatas || []},
          ${data.status || 'pending'},
          ${data.votesFor || '0'},
          ${data.votesAgainst || '0'},
          ${data.votesAbstain || '0'},
          ${data.startBlock || null},
          ${data.endBlock || null},
          ${data.eta || null},
          ${data.txHash || null},
          ${data.metadata ? JSON.stringify(data.metadata) : null}
        )
        RETURNING *
      `;
      return proposal;
    } catch (error: any) {
      throw new Error(`Failed to create DAO proposal: ${error.message}`);
    }
  }

  async getDaoProposal(id: string): Promise<any | null> {
    try {
      const [proposal] = await this.sql`
        SELECT * FROM dao_proposals WHERE id = ${id} LIMIT 1
      `;
      return proposal || null;
    } catch (error: any) {
      throw new Error(`Failed to get DAO proposal: ${error.message}`);
    }
  }

  async getDaoProposalByProposalId(proposalId: string): Promise<any | null> {
    try {
      const [proposal] = await this.sql`
        SELECT * FROM dao_proposals WHERE proposal_id = ${proposalId} LIMIT 1
      `;
      return proposal || null;
    } catch (error: any) {
      throw new Error(`Failed to get DAO proposal by proposal ID: ${error.message}`);
    }
  }

  async listDaoProposals(filters?: { status?: string; proposer?: string }): Promise<any[]> {
    try {
      if (!filters?.status && !filters?.proposer) {
        return await this.sql`
          SELECT * FROM dao_proposals
          ORDER BY created_at DESC
        `;
      }

      const { status, proposer } = filters;

      if (status && !proposer) {
        return await this.sql`
          SELECT * FROM dao_proposals
          WHERE status = ${status}
          ORDER BY created_at DESC
        `;
      }

      if (!status && proposer) {
        return await this.sql`
          SELECT * FROM dao_proposals
          WHERE proposer = ${proposer}
          ORDER BY created_at DESC
        `;
      }

      if (status && proposer) {
        return await this.sql`
          SELECT * FROM dao_proposals
          WHERE status = ${status} AND proposer = ${proposer}
          ORDER BY created_at DESC
        `;
      }

      return await this.sql`
        SELECT * FROM dao_proposals
        ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list DAO proposals: ${error.message}`);
    }
  }

  async updateDaoProposal(id: string, data: Partial<any>): Promise<any> {
    try {
      const existing = await this.getDaoProposal(id);
      if (!existing) {
        throw new Error(`DAO proposal not found: ${id}`);
      }

      if (Object.keys(data).length === 0) {
        return existing;
      }

      const updates: Record<string, any> = { updated_at: new Date() };
      
      if (data.status !== undefined) updates.status = data.status;
      if (data.votesFor !== undefined) updates.votes_for = data.votesFor;
      if (data.votesAgainst !== undefined) updates.votes_against = data.votesAgainst;
      if (data.votesAbstain !== undefined) updates.votes_abstain = data.votesAbstain;
      if (data.startBlock !== undefined) updates.start_block = data.startBlock;
      if (data.endBlock !== undefined) updates.end_block = data.endBlock;
      if (data.eta !== undefined) updates.eta = data.eta;
      if (data.txHash !== undefined) updates.tx_hash = data.txHash;
      if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

      const [proposal] = await this.sql`
        UPDATE dao_proposals
        SET ${this.sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!proposal) {
        throw new Error(`DAO proposal not found: ${id}`);
      }

      return proposal;
    } catch (error: any) {
      throw new Error(`Failed to update DAO proposal: ${error.message}`);
    }
  }

  // ============================================================================
  // Bridge Job Operations
  // ============================================================================

  async createBridgeJob(data: any): Promise<any> {
    try {
      const [job] = await this.sql`
        INSERT INTO bridge_jobs (
          receipt_id,
          doc_hash,
          source_chain,
          target_chain,
          status,
          tx_hash,
          confirmations,
          required_confirmations,
          attempts,
          max_attempts,
          last_error,
          metadata,
          confirmed_at
        )
        VALUES (
          ${data.receiptId},
          ${data.docHash},
          ${data.sourceChain || 'base'},
          ${data.targetChain},
          ${data.status || 'pending'},
          ${data.txHash || null},
          ${data.confirmations || 0},
          ${data.requiredConfirmations || 12},
          ${data.attempts || 0},
          ${data.maxAttempts || 3},
          ${data.lastError || null},
          ${data.metadata ? JSON.stringify(data.metadata) : null},
          ${data.confirmedAt || null}
        )
        RETURNING *
      `;
      return job;
    } catch (error: any) {
      throw new Error(`Failed to create bridge job: ${error.message}`);
    }
  }

  async getBridgeJob(id: string): Promise<any | null> {
    try {
      const [job] = await this.sql`
        SELECT * FROM bridge_jobs WHERE id = ${id} LIMIT 1
      `;
      return job || null;
    } catch (error: any) {
      throw new Error(`Failed to get bridge job: ${error.message}`);
    }
  }

  async getBridgeJobsByDocHash(docHash: string): Promise<any[]> {
    try {
      return await this.sql`
        SELECT * FROM bridge_jobs 
        WHERE doc_hash = ${docHash}
        ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get bridge jobs by doc hash: ${error.message}`);
    }
  }

  async getBridgeJobsByReceipt(receiptId: string): Promise<any[]> {
    try {
      return await this.sql`
        SELECT * FROM bridge_jobs 
        WHERE receipt_id = ${receiptId}
        ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get bridge jobs by receipt: ${error.message}`);
    }
  }

  async updateBridgeJob(id: string, data: any): Promise<any> {
    try {
      const existing = await this.getBridgeJob(id);
      if (!existing) {
        throw new Error(`Bridge job not found: ${id}`);
      }

      if (Object.keys(data).length === 0) {
        return existing;
      }

      const updates: Record<string, any> = { updated_at: new Date() };
      
      if (data.status !== undefined) updates.status = data.status;
      if (data.txHash !== undefined) updates.tx_hash = data.txHash;
      if (data.confirmations !== undefined) updates.confirmations = data.confirmations;
      if (data.attempts !== undefined) updates.attempts = data.attempts;
      if (data.lastError !== undefined) updates.last_error = data.lastError;
      if (data.confirmedAt !== undefined) updates.confirmed_at = data.confirmedAt;
      if (data.metadata !== undefined) updates.metadata = JSON.stringify(data.metadata);

      const [job] = await this.sql`
        UPDATE bridge_jobs
        SET ${this.sql(updates)}
        WHERE id = ${id}
        RETURNING *
      `;

      if (!job) {
        throw new Error(`Bridge job not found: ${id}`);
      }

      return job;
    } catch (error: any) {
      throw new Error(`Failed to update bridge job: ${error.message}`);
    }
  }

  async listBridgeJobs(filters?: any): Promise<any[]> {
    try {
      if (!filters) {
        return await this.sql`
          SELECT * FROM bridge_jobs ORDER BY created_at DESC
        `;
      }

      if (filters.status && filters.targetChain) {
        return await this.sql`
          SELECT * FROM bridge_jobs 
          WHERE status = ${filters.status} AND target_chain = ${filters.targetChain}
          ORDER BY created_at DESC
        `;
      }

      if (filters.status) {
        return await this.sql`
          SELECT * FROM bridge_jobs 
          WHERE status = ${filters.status}
          ORDER BY created_at DESC
        `;
      }

      if (filters.targetChain) {
        return await this.sql`
          SELECT * FROM bridge_jobs 
          WHERE target_chain = ${filters.targetChain}
          ORDER BY created_at DESC
        `;
      }

      return await this.sql`
        SELECT * FROM bridge_jobs ORDER BY created_at DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to list bridge jobs: ${error.message}`);
    }
  }

  async getReceiptByHash(hash: string): Promise<any | null> {
    try {
      const [receipt] = await this.sql`
        SELECT * FROM receipts 
        WHERE content_hash = ${hash} OR id = ${hash}
        LIMIT 1
      `;
      return receipt || null;
    } catch (error: any) {
      throw new Error(`Failed to get receipt by hash: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    await this.sql.end();
  }

  // Install Token operations (Session Bridge)
  async createInstallToken(data: InsertInstallToken): Promise<InstallToken> {
    try {
      const appModeInt = data.appMode ? 1 : 0;
      const [token] = await this.sql`
        INSERT INTO install_tokens (token, wallet_address, app_mode, expires_at, session_data)
        VALUES (${data.token}, ${data.walletAddress}, ${appModeInt}, ${data.expiresAt}, ${data.sessionData || null})
        RETURNING *
      `;
      return {
        token: token.token,
        walletAddress: token.wallet_address,
        appMode: token.app_mode,
        expiresAt: token.expires_at,
        isConsumed: token.is_consumed,
        consumedAt: token.consumed_at,
        sessionData: token.session_data,
        createdAt: token.created_at,
      };
    } catch (error: any) {
      throw new Error(`Failed to create install token: ${error.message}`);
    }
  }

  async getInstallToken(token: string): Promise<InstallToken | null> {
    try {
      const [result] = await this.sql`
        SELECT * FROM install_tokens WHERE token = ${token} LIMIT 1
      `;
      if (!result) return null;
      return {
        token: result.token,
        walletAddress: result.wallet_address,
        appMode: result.app_mode,
        expiresAt: result.expires_at,
        isConsumed: result.is_consumed,
        consumedAt: result.consumed_at,
        sessionData: result.session_data,
        createdAt: result.created_at,
      };
    } catch (error: any) {
      throw new Error(`Failed to get install token: ${error.message}`);
    }
  }

  async consumeInstallToken(token: string): Promise<void> {
    try {
      await this.sql`
        UPDATE install_tokens 
        SET is_consumed = 1, consumed_at = NOW()
        WHERE token = ${token}
      `;
    } catch (error: any) {
      throw new Error(`Failed to consume install token: ${error.message}`);
    }
  }

  async cleanupExpiredInstallTokens(): Promise<void> {
    try {
      await this.sql`
        DELETE FROM install_tokens WHERE expires_at < NOW()
      `;
    } catch (error: any) {
      console.error(`Failed to cleanup expired tokens: ${error.message}`);
    }
  }

  async updateInstallTokenWallet(token: string, walletAddress: string): Promise<void> {
    try {
      await this.sql`
        UPDATE install_tokens 
        SET wallet_address = ${walletAddress}
        WHERE token = ${token}
      `;
    } catch (error: any) {
      throw new Error(`Failed to update install token wallet: ${error.message}`);
    }
  }

  // ============================================================================
  // Quarantine Operations
  // ============================================================================

  async getQuarantinedItems(): Promise<QuarantineItem[]> {
    try {
      const results = await this.sql<QuarantineItem[]>`
        SELECT
          id,
          type,
          sender,
          reason,
          payload,
          status,
          created_at as "createdAt",
          released_at as "releasedAt",
          released_by as "releasedBy"
        FROM quarantine_items
        ORDER BY created_at DESC
      `;
      return results;
    } catch (error: any) {
      console.error('[PgStorage] getQuarantinedItems error:', error);
      return [];
    }
  }

  async createQuarantineItem(data: InsertQuarantineItem): Promise<QuarantineItem> {
    try {
      const [item] = await this.sql<QuarantineItem[]>`
        INSERT INTO quarantine_items (
          type,
          sender,
          reason,
          payload,
          status
        )
        VALUES (
          ${data.type},
          ${data.sender},
          ${data.reason},
          ${data.payload ? JSON.stringify(data.payload) : null},
          ${data.status || 'pending'}
        )
        RETURNING
          id,
          type,
          sender,
          reason,
          payload,
          status,
          created_at as "createdAt",
          released_at as "releasedAt",
          released_by as "releasedBy"
      `;
      return item;
    } catch (error: any) {
      console.error('[PgStorage] createQuarantineItem error:', error);
      throw new Error(`Failed to create quarantine item: ${error.message}`);
    }
  }

  async releaseQuarantinedItem(id: string, releasedBy: string): Promise<QuarantineItem | null> {
    try {
      const [item] = await this.sql<QuarantineItem[]>`
        UPDATE quarantine_items
        SET 
          released_at = NOW(),
          released_by = ${releasedBy},
          status = 'released'
        WHERE id = ${id}
        RETURNING
          id,
          type,
          sender,
          reason,
          payload,
          status,
          created_at as "createdAt",
          released_at as "releasedAt",
          released_by as "releasedBy"
      `;
      return item || null;
    } catch (error: any) {
      console.error('[PgStorage] releaseQuarantinedItem error:', error);
      return null;
    }
  }

  async deleteQuarantinedItem(id: string): Promise<void> {
    try {
      await this.sql`
        DELETE FROM quarantine_items WHERE id = ${id}
      `;
    } catch (error: any) {
      console.error('[PgStorage] deleteQuarantinedItem error:', error);
    }
  }

  // ============================================================================
  // Payment Operations (Phase 1 Stream A)
  // ============================================================================

  async createPayment(payment: InsertPayment): Promise<Payment> {
    try {
      const [created] = await this.sql<Payment[]>`
        INSERT INTO payments (
          tx_hash,
          chain_id,
          from_address,
          to_address,
          amount,
          token,
          token_symbol,
          status,
          memo,
          proof_cid,
          gas_used,
          block_number
        )
        VALUES (
          ${payment.txHash},
          ${payment.chainId},
          ${payment.fromAddress},
          ${payment.toAddress},
          ${payment.amount},
          ${payment.token || null},
          ${payment.tokenSymbol || null},
          ${payment.status || 'pending'},
          ${payment.memo || null},
          ${payment.proofCid || null},
          ${payment.gasUsed || null},
          ${payment.blockNumber || null}
        )
        RETURNING 
          id,
          tx_hash as "txHash",
          chain_id as "chainId",
          from_address as "fromAddress",
          to_address as "toAddress",
          amount,
          token,
          token_symbol as "tokenSymbol",
          timestamp,
          status,
          memo,
          proof_cid as "proofCid",
          gas_used as "gasUsed",
          block_number as "blockNumber"
      `;
      return created;
    } catch (error: any) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }
  }

  async getPaymentByTxHash(txHash: string): Promise<Payment | undefined> {
    try {
      const [payment] = await this.sql<Payment[]>`
        SELECT 
          id,
          tx_hash as "txHash",
          chain_id as "chainId",
          from_address as "fromAddress",
          to_address as "toAddress",
          amount,
          token,
          token_symbol as "tokenSymbol",
          timestamp,
          status,
          memo,
          proof_cid as "proofCid",
          gas_used as "gasUsed",
          block_number as "blockNumber"
        FROM payments
        WHERE tx_hash = ${txHash}
        LIMIT 1
      `;
      return payment;
    } catch (error: any) {
      throw new Error(`Failed to get payment by tx hash: ${error.message}`);
    }
  }

  async getPaymentsByAddress(address: string): Promise<Payment[]> {
    try {
      const addr = address.toLowerCase();
      return await this.sql<Payment[]>`
        SELECT 
          id,
          tx_hash as "txHash",
          chain_id as "chainId",
          from_address as "fromAddress",
          to_address as "toAddress",
          amount,
          token,
          token_symbol as "tokenSymbol",
          timestamp,
          status,
          memo,
          proof_cid as "proofCid",
          gas_used as "gasUsed",
          block_number as "blockNumber"
        FROM payments
        WHERE lower(from_address) = ${addr} OR lower(to_address) = ${addr}
        ORDER BY timestamp DESC
      `;
    } catch (error: any) {
      throw new Error(`Failed to get payments by address: ${error.message}`);
    }
  }

  async updatePaymentStatus(txHash: string, status: string, blockNumber?: number, gasUsed?: string): Promise<Payment | undefined> {
    try {
      const updates: Record<string, any> = { status };
      if (blockNumber !== undefined) updates.block_number = blockNumber;
      if (gasUsed !== undefined) updates.gas_used = gasUsed;

      const [updated] = await this.sql<Payment[]>`
        UPDATE payments
        SET 
          status = ${status},
          block_number = COALESCE(${blockNumber || null}, block_number),
          gas_used = COALESCE(${gasUsed || null}, gas_used)
        WHERE tx_hash = ${txHash}
        RETURNING 
          id,
          tx_hash as "txHash",
          chain_id as "chainId",
          from_address as "fromAddress",
          to_address as "toAddress",
          amount,
          token,
          token_symbol as "tokenSymbol",
          timestamp,
          status,
          memo,
          proof_cid as "proofCid",
          gas_used as "gasUsed",
          block_number as "blockNumber"
      `;
      return updated;
    } catch (error: any) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  async upsertAddressIndex(address: string, chainId: number): Promise<void> {
    try {
      const addr = address.toLowerCase();
      
      const existing = await this.sql<Array<{ address: string; chains: number[]; payment_count: number }>>`
        SELECT address, chains, payment_count FROM address_index
        WHERE address = ${addr}
        LIMIT 1
      `;

      if (existing.length > 0) {
        const chains = (existing[0].chains as number[]) || [];
        if (!chains.includes(chainId)) {
          chains.push(chainId);
        }
        await this.sql`
          UPDATE address_index
          SET 
            last_seen_at = NOW(),
            chains = ${JSON.stringify(chains)}::jsonb,
            payment_count = COALESCE(payment_count, 0) + 1
          WHERE address = ${addr}
        `;
      } else {
        await this.sql`
          INSERT INTO address_index (address, chains, payment_count, last_seen_at)
          VALUES (${addr}, ${JSON.stringify([chainId])}::jsonb, 1, NOW())
        `;
      }
    } catch (error: any) {
      throw new Error(`Failed to upsert address index: ${error.message}`);
    }
  }

  // ============================================================================
  // Wallet Profile Operations (Unified wallet-scoped personalization)
  // ============================================================================

  async getWalletProfile(wallet: string): Promise<WalletProfile | null> {
    try {
      const walletKey = wallet.toLowerCase();
      const [profile] = await this.sql<WalletProfile[]>`
        SELECT 
          id,
          wallet,
          display_name as "displayName",
          avatar_cid as "avatarCid",
          face_preset as "facePreset",
          interface_preference as "interfacePreference",
          voice_style as "voiceStyle",
          voice_gender as "voiceGender",
          voice_speed as "voiceSpeed",
          theme_mode as "themeMode",
          primary_color as "primaryColor",
          pinned_manifests as "pinnedManifests",
          session_memory_enabled as "sessionMemoryEnabled",
          remember_pinned_apps as "rememberPinnedApps",
          remember_queries as "rememberQueries",
          remember_flow_history as "rememberFlowHistory",
          onboarding_completed_at as "onboardingCompletedAt",
          onboarding_path as "onboardingPath",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM wallet_profiles
        WHERE wallet = ${walletKey}
        LIMIT 1
      `;
      if (!profile) return null;
      
      return {
        ...profile,
        pinnedManifests: typeof profile.pinnedManifests === 'string' 
          ? JSON.parse(profile.pinnedManifests) 
          : profile.pinnedManifests || [],
      };
    } catch (error: any) {
      console.error('[PgStorage] getWalletProfile error:', error);
      return null;
    }
  }

  async upsertWalletProfile(data: Partial<InsertWalletProfile> & { wallet: string }): Promise<WalletProfile> {
    try {
      const walletKey = data.wallet.toLowerCase();
      const existing = await this.getWalletProfile(walletKey);
      
      const profileData = {
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
      };

      const [profile] = await this.sql<WalletProfile[]>`
        INSERT INTO wallet_profiles (
          wallet,
          display_name,
          avatar_cid,
          face_preset,
          interface_preference,
          voice_style,
          voice_gender,
          voice_speed,
          theme_mode,
          primary_color,
          pinned_manifests,
          session_memory_enabled,
          remember_pinned_apps,
          remember_queries,
          remember_flow_history,
          onboarding_completed_at,
          onboarding_path,
          created_at,
          updated_at
        ) VALUES (
          ${profileData.wallet},
          ${profileData.displayName},
          ${profileData.avatarCid},
          ${profileData.facePreset},
          ${profileData.interfacePreference},
          ${profileData.voiceStyle},
          ${profileData.voiceGender},
          ${profileData.voiceSpeed},
          ${profileData.themeMode},
          ${profileData.primaryColor},
          ${JSON.stringify(profileData.pinnedManifests)}::jsonb,
          ${profileData.sessionMemoryEnabled},
          ${profileData.rememberPinnedApps},
          ${profileData.rememberQueries},
          ${profileData.rememberFlowHistory},
          ${profileData.onboardingCompletedAt},
          ${profileData.onboardingPath},
          NOW(),
          NOW()
        )
        ON CONFLICT (wallet) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          avatar_cid = EXCLUDED.avatar_cid,
          face_preset = EXCLUDED.face_preset,
          interface_preference = EXCLUDED.interface_preference,
          voice_style = EXCLUDED.voice_style,
          voice_gender = EXCLUDED.voice_gender,
          voice_speed = EXCLUDED.voice_speed,
          theme_mode = EXCLUDED.theme_mode,
          primary_color = EXCLUDED.primary_color,
          pinned_manifests = EXCLUDED.pinned_manifests,
          session_memory_enabled = EXCLUDED.session_memory_enabled,
          remember_pinned_apps = EXCLUDED.remember_pinned_apps,
          remember_queries = EXCLUDED.remember_queries,
          remember_flow_history = EXCLUDED.remember_flow_history,
          onboarding_completed_at = COALESCE(EXCLUDED.onboarding_completed_at, wallet_profiles.onboarding_completed_at),
          onboarding_path = COALESCE(EXCLUDED.onboarding_path, wallet_profiles.onboarding_path),
          updated_at = NOW()
        RETURNING
          id,
          wallet,
          display_name as "displayName",
          avatar_cid as "avatarCid",
          face_preset as "facePreset",
          interface_preference as "interfacePreference",
          voice_style as "voiceStyle",
          voice_gender as "voiceGender",
          voice_speed as "voiceSpeed",
          theme_mode as "themeMode",
          primary_color as "primaryColor",
          pinned_manifests as "pinnedManifests",
          session_memory_enabled as "sessionMemoryEnabled",
          remember_pinned_apps as "rememberPinnedApps",
          remember_queries as "rememberQueries",
          remember_flow_history as "rememberFlowHistory",
          onboarding_completed_at as "onboardingCompletedAt",
          onboarding_path as "onboardingPath",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      
      return {
        ...profile,
        pinnedManifests: typeof profile.pinnedManifests === 'string' 
          ? JSON.parse(profile.pinnedManifests) 
          : profile.pinnedManifests || [],
      };
    } catch (error: any) {
      throw new Error(`Failed to upsert wallet profile: ${error.message}`);
    }
  }

  // ============================================================================
  // Vault Credential Operations (wallet-scoped encrypted secrets)
  // ============================================================================

  async getVaultCredential(walletAddr: string, provider: string, scope: string): Promise<VaultCredential | null> {
    try {
      const wallet = walletAddr.toLowerCase();
      const [credential] = await this.sql<VaultCredential[]>`
        SELECT 
          id,
          wallet_addr as "walletAddr",
          provider,
          scope,
          encrypted_blob as "encryptedBlob",
          nonce,
          salt,
          key_type as "keyType",
          expires_at as "expiresAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM vault_credentials
        WHERE wallet_addr = ${wallet} AND provider = ${provider} AND scope = ${scope}
        LIMIT 1
      `;
      return credential || null;
    } catch (error: any) {
      console.error('[PgStorage] getVaultCredential error:', error);
      return null;
    }
  }

  async saveVaultCredential(data: InsertVaultCredential): Promise<VaultCredential> {
    try {
      const wallet = data.walletAddr.toLowerCase();
      const [credential] = await this.sql<VaultCredential[]>`
        INSERT INTO vault_credentials (
          wallet_addr, provider, scope, encrypted_blob, nonce, salt, key_type, expires_at, created_at, updated_at
        )
        VALUES (
          ${wallet}, ${data.provider}, ${data.scope}, ${data.encryptedBlob}, 
          ${data.nonce}, ${data.salt}, ${data.keyType || 'api'}, ${data.expiresAt || null}, NOW(), NOW()
        )
        ON CONFLICT (wallet_addr, provider, scope) DO UPDATE SET
          encrypted_blob = EXCLUDED.encrypted_blob,
          nonce = EXCLUDED.nonce,
          salt = EXCLUDED.salt,
          key_type = EXCLUDED.key_type,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING
          id,
          wallet_addr as "walletAddr",
          provider,
          scope,
          encrypted_blob as "encryptedBlob",
          nonce,
          salt,
          key_type as "keyType",
          expires_at as "expiresAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      return credential;
    } catch (error: any) {
      throw new Error(`Failed to upsert vault credential: ${error.message}`);
    }
  }

  async deleteVaultCredential(walletAddr: string, provider: string, scope: string): Promise<boolean> {
    try {
      const wallet = walletAddr.toLowerCase();
      const result = await this.sql`
        DELETE FROM vault_credentials
        WHERE wallet_addr = ${wallet} AND provider = ${provider} AND scope = ${scope}
      `;
      return result.count > 0;
    } catch (error: any) {
      console.error('[PgStorage] deleteVaultCredential error:', error);
      return false;
    }
  }

  async listVaultCredentials(walletAddr: string): Promise<VaultCredential[]> {
    try {
      const wallet = walletAddr.toLowerCase();
      const credentials = await this.sql<VaultCredential[]>`
        SELECT 
          id,
          wallet_addr as "walletAddr",
          provider,
          scope,
          encrypted_blob as "encryptedBlob",
          nonce,
          salt,
          key_type as "keyType",
          expires_at as "expiresAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM vault_credentials
        WHERE wallet_addr = ${wallet}
        ORDER BY updated_at DESC
      `;
      return credentials;
    } catch (error: any) {
      console.error('[PgStorage] listVaultCredentials error:', error);
      return [];
    }
  }

  // ============================================================================
  // Atlas Endpoints - Personal Pulse
  // ============================================================================

  async createAtlasEndpoint(data: InsertAtlasEndpoint): Promise<AtlasEndpoint> {
    try {
      const wallet = data.walletAddress.toLowerCase();
      const [endpoint] = await this.sql<AtlasEndpoint[]>`
        INSERT INTO atlas_endpoints (
          wallet_address, endpoint_url, display_name, status, 
          protocol_version, telemetry_caps, last_validation_at, 
          last_metrics_fetch_at, metrics_cache, created_at
        )
        VALUES (
          ${wallet}, ${data.endpointUrl}, ${data.displayName}, ${data.status || 'pending'},
          ${data.protocolVersion || null}, ${JSON.stringify(data.telemetryCaps) || null}, 
          ${data.lastValidationAt || null}, ${data.lastMetricsFetchAt || null},
          ${JSON.stringify(data.metricsCache) || null}, NOW()
        )
        RETURNING
          id,
          wallet_address as "walletAddress",
          endpoint_url as "endpointUrl",
          display_name as "displayName",
          status,
          protocol_version as "protocolVersion",
          telemetry_caps as "telemetryCaps",
          last_validation_at as "lastValidationAt",
          last_metrics_fetch_at as "lastMetricsFetchAt",
          metrics_cache as "metricsCache",
          created_at as "createdAt"
      `;
      return endpoint;
    } catch (error: any) {
      throw new Error(`Failed to create atlas endpoint: ${error.message}`);
    }
  }

  async getAtlasEndpointsByWallet(walletAddress: string): Promise<AtlasEndpoint[]> {
    try {
      const wallet = walletAddress.toLowerCase();
      const endpoints = await this.sql<AtlasEndpoint[]>`
        SELECT 
          id,
          wallet_address as "walletAddress",
          endpoint_url as "endpointUrl",
          display_name as "displayName",
          status,
          protocol_version as "protocolVersion",
          telemetry_caps as "telemetryCaps",
          last_validation_at as "lastValidationAt",
          last_metrics_fetch_at as "lastMetricsFetchAt",
          metrics_cache as "metricsCache",
          created_at as "createdAt"
        FROM atlas_endpoints
        WHERE wallet_address = ${wallet}
        ORDER BY created_at DESC
      `;
      return endpoints;
    } catch (error: any) {
      console.error('[PgStorage] getAtlasEndpointsByWallet error:', error);
      return [];
    }
  }

  async getAtlasEndpoint(id: string): Promise<AtlasEndpoint | null> {
    try {
      const [endpoint] = await this.sql<AtlasEndpoint[]>`
        SELECT 
          id,
          wallet_address as "walletAddress",
          endpoint_url as "endpointUrl",
          display_name as "displayName",
          status,
          protocol_version as "protocolVersion",
          telemetry_caps as "telemetryCaps",
          last_validation_at as "lastValidationAt",
          last_metrics_fetch_at as "lastMetricsFetchAt",
          metrics_cache as "metricsCache",
          created_at as "createdAt"
        FROM atlas_endpoints
        WHERE id = ${id}
        LIMIT 1
      `;
      return endpoint || null;
    } catch (error: any) {
      console.error('[PgStorage] getAtlasEndpoint error:', error);
      return null;
    }
  }

  async updateAtlasEndpoint(id: string, data: Partial<InsertAtlasEndpoint>): Promise<AtlasEndpoint | null> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      
      if (data.walletAddress !== undefined) {
        updates.push('wallet_address');
        values.push(data.walletAddress.toLowerCase());
      }
      if (data.endpointUrl !== undefined) {
        updates.push('endpoint_url');
        values.push(data.endpointUrl);
      }
      if (data.displayName !== undefined) {
        updates.push('display_name');
        values.push(data.displayName);
      }
      if (data.status !== undefined) {
        updates.push('status');
        values.push(data.status);
      }
      if (data.protocolVersion !== undefined) {
        updates.push('protocol_version');
        values.push(data.protocolVersion);
      }
      if (data.telemetryCaps !== undefined) {
        updates.push('telemetry_caps');
        values.push(JSON.stringify(data.telemetryCaps));
      }
      if (data.lastValidationAt !== undefined) {
        updates.push('last_validation_at');
        values.push(data.lastValidationAt);
      }
      if (data.lastMetricsFetchAt !== undefined) {
        updates.push('last_metrics_fetch_at');
        values.push(data.lastMetricsFetchAt);
      }
      if (data.metricsCache !== undefined) {
        updates.push('metrics_cache');
        values.push(JSON.stringify(data.metricsCache));
      }

      if (updates.length === 0) {
        return this.getAtlasEndpoint(id);
      }

      // Build dynamic update query
      const [endpoint] = await this.sql<AtlasEndpoint[]>`
        UPDATE atlas_endpoints
        SET 
          wallet_address = COALESCE(${data.walletAddress?.toLowerCase() || null}, wallet_address),
          endpoint_url = COALESCE(${data.endpointUrl || null}, endpoint_url),
          display_name = COALESCE(${data.displayName || null}, display_name),
          status = COALESCE(${data.status || null}, status),
          protocol_version = ${data.protocolVersion !== undefined ? data.protocolVersion : null},
          telemetry_caps = ${data.telemetryCaps !== undefined ? JSON.stringify(data.telemetryCaps) : null},
          last_validation_at = ${data.lastValidationAt !== undefined ? data.lastValidationAt : null},
          last_metrics_fetch_at = ${data.lastMetricsFetchAt !== undefined ? data.lastMetricsFetchAt : null},
          metrics_cache = ${data.metricsCache !== undefined ? JSON.stringify(data.metricsCache) : null}
        WHERE id = ${id}
        RETURNING
          id,
          wallet_address as "walletAddress",
          endpoint_url as "endpointUrl",
          display_name as "displayName",
          status,
          protocol_version as "protocolVersion",
          telemetry_caps as "telemetryCaps",
          last_validation_at as "lastValidationAt",
          last_metrics_fetch_at as "lastMetricsFetchAt",
          metrics_cache as "metricsCache",
          created_at as "createdAt"
      `;
      return endpoint || null;
    } catch (error: any) {
      console.error('[PgStorage] updateAtlasEndpoint error:', error);
      return null;
    }
  }

  async deleteAtlasEndpoint(id: string): Promise<boolean> {
    try {
      const result = await this.sql`
        DELETE FROM atlas_endpoints
        WHERE id = ${id}
      `;
      return result.count > 0;
    } catch (error: any) {
      console.error('[PgStorage] deleteAtlasEndpoint error:', error);
      return false;
    }
  }

  async recordApiRequestMetrics(data: InsertApiRequestMetrics): Promise<ApiRequestMetrics> {
    try {
      const [metric] = await this.sql<ApiRequestMetrics[]>`
        INSERT INTO api_request_metrics (
          endpoint,
          method,
          request_bytes,
          response_bytes,
          latency_ms,
          status_code,
          is_atlas_api,
          session_reused
        )
        VALUES (
          ${data.endpoint},
          ${data.method},
          ${data.requestBytes ?? null},
          ${data.responseBytes ?? null},
          ${data.latencyMs},
          ${data.statusCode},
          ${data.isAtlasApi ?? true},
          ${data.sessionReused ?? false}
        )
        RETURNING
          id,
          endpoint,
          method,
          request_bytes as "requestBytes",
          response_bytes as "responseBytes",
          latency_ms as "latencyMs",
          status_code as "statusCode",
          is_atlas_api as "isAtlasApi",
          session_reused as "sessionReused",
          ts
      `;
      return metric;
    } catch (error: any) {
      console.error('[PgStorage] recordApiRequestMetrics error:', error);
      throw new Error(`Failed to record API request metrics: ${error.message}`);
    }
  }

  // ============================================================================
  // Payment Transaction Operations
  // ============================================================================

  async createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction> {
    try {
      const id = randomUUID();
      const metadataValue = data.metadata ? this.sql.json(data.metadata) : null;
      const [payment] = await this.sql<PaymentTransaction[]>`
        INSERT INTO payment_transactions (
          id,
          from_address,
          to_address,
          asset,
          amount,
          gas_estimate,
          gas_fee,
          total_amount,
          status,
          tx_hash,
          chain_id,
          anchor_tx_hash,
          anchor_status,
          anchor_timestamp,
          receipt_id,
          to_ens_name,
          to_basename,
          metadata
        )
        VALUES (
          ${id},
          ${data.fromAddress},
          ${data.toAddress},
          ${data.asset},
          ${data.amount},
          ${data.gasEstimate || null},
          ${data.gasFee || null},
          ${data.totalAmount},
          ${data.status || 'pending'},
          ${data.txHash || null},
          ${data.chainId || '8453'},
          ${data.anchorTxHash || null},
          ${data.anchorStatus || 'none'},
          ${data.anchorTimestamp || null},
          ${data.receiptId || null},
          ${data.toEnsName || null},
          ${data.toBasename || null},
          ${metadataValue}
        )
        RETURNING
          id,
          from_address as "fromAddress",
          to_address as "toAddress",
          asset,
          amount,
          gas_estimate as "gasEstimate",
          gas_fee as "gasFee",
          total_amount as "totalAmount",
          status,
          tx_hash as "txHash",
          chain_id as "chainId",
          anchor_tx_hash as "anchorTxHash",
          anchor_status as "anchorStatus",
          anchor_timestamp as "anchorTimestamp",
          receipt_id as "receiptId",
          to_ens_name as "toEnsName",
          to_basename as "toBasename",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      return payment;
    } catch (error: any) {
      console.error('[PgStorage] createPaymentTransaction error:', error);
      throw new Error(`Failed to create payment transaction: ${error.message}`);
    }
  }

  async getPaymentTransaction(id: string): Promise<PaymentTransaction | null> {
    try {
      const [payment] = await this.sql<PaymentTransaction[]>`
        SELECT
          id,
          from_address as "fromAddress",
          to_address as "toAddress",
          asset,
          amount,
          gas_estimate as "gasEstimate",
          gas_fee as "gasFee",
          total_amount as "totalAmount",
          status,
          tx_hash as "txHash",
          chain_id as "chainId",
          anchor_tx_hash as "anchorTxHash",
          anchor_status as "anchorStatus",
          anchor_timestamp as "anchorTimestamp",
          receipt_id as "receiptId",
          to_ens_name as "toEnsName",
          to_basename as "toBasename",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM payment_transactions
        WHERE id = ${id}
      `;
      return payment || null;
    } catch (error: any) {
      console.error('[PgStorage] getPaymentTransaction error:', error);
      return null;
    }
  }

  async listPaymentTransactions(filters?: { fromAddress?: string; toAddress?: string; status?: string; asset?: string }): Promise<PaymentTransaction[]> {
    try {
      const results = await this.sql<PaymentTransaction[]>`
        SELECT
          id,
          from_address as "fromAddress",
          to_address as "toAddress",
          asset,
          amount,
          gas_estimate as "gasEstimate",
          gas_fee as "gasFee",
          total_amount as "totalAmount",
          status,
          tx_hash as "txHash",
          chain_id as "chainId",
          anchor_tx_hash as "anchorTxHash",
          anchor_status as "anchorStatus",
          anchor_timestamp as "anchorTimestamp",
          receipt_id as "receiptId",
          to_ens_name as "toEnsName",
          to_basename as "toBasename",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM payment_transactions
        WHERE 
          (${filters?.fromAddress || null}::text IS NULL OR LOWER(from_address) = LOWER(${filters?.fromAddress || ''}))
          AND (${filters?.toAddress || null}::text IS NULL OR LOWER(to_address) = LOWER(${filters?.toAddress || ''}))
          AND (${filters?.status || null}::text IS NULL OR status = ${filters?.status || ''})
          AND (${filters?.asset || null}::text IS NULL OR asset = ${filters?.asset || ''})
        ORDER BY created_at DESC
      `;
      return results;
    } catch (error: any) {
      console.error('[PgStorage] listPaymentTransactions error:', error);
      return [];
    }
  }

  async updatePaymentTransaction(id: string, data: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction> {
    try {
      const metadataJson = data.metadata ? JSON.stringify(data.metadata) : null;
      const [payment] = await this.sql<PaymentTransaction[]>`
        UPDATE payment_transactions
        SET
          from_address = COALESCE(${data.fromAddress || null}, from_address),
          to_address = COALESCE(${data.toAddress || null}, to_address),
          asset = COALESCE(${data.asset || null}, asset),
          amount = COALESCE(${data.amount || null}, amount),
          gas_estimate = COALESCE(${data.gasEstimate || null}, gas_estimate),
          gas_fee = COALESCE(${data.gasFee || null}, gas_fee),
          total_amount = COALESCE(${data.totalAmount || null}, total_amount),
          status = COALESCE(${data.status || null}, status),
          tx_hash = COALESCE(${data.txHash || null}, tx_hash),
          chain_id = COALESCE(${data.chainId || null}, chain_id),
          anchor_tx_hash = COALESCE(${data.anchorTxHash || null}, anchor_tx_hash),
          anchor_status = COALESCE(${data.anchorStatus || null}, anchor_status),
          anchor_timestamp = COALESCE(${data.anchorTimestamp || null}, anchor_timestamp),
          receipt_id = COALESCE(${data.receiptId || null}, receipt_id),
          to_ens_name = COALESCE(${data.toEnsName || null}, to_ens_name),
          to_basename = COALESCE(${data.toBasename || null}, to_basename),
          metadata = COALESCE(${metadataJson}::jsonb, metadata),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING
          id,
          from_address as "fromAddress",
          to_address as "toAddress",
          asset,
          amount,
          gas_estimate as "gasEstimate",
          gas_fee as "gasFee",
          total_amount as "totalAmount",
          status,
          tx_hash as "txHash",
          chain_id as "chainId",
          anchor_tx_hash as "anchorTxHash",
          anchor_status as "anchorStatus",
          anchor_timestamp as "anchorTimestamp",
          receipt_id as "receiptId",
          to_ens_name as "toEnsName",
          to_basename as "toBasename",
          metadata,
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      if (!payment) {
        throw new Error(`Payment transaction not found: ${id}`);
      }
      return payment;
    } catch (error: any) {
      console.error('[PgStorage] updatePaymentTransaction error:', error);
      throw new Error(`Failed to update payment transaction: ${error.message}`);
    }
  }

  async estimateGas(asset: string, _amount: string): Promise<{ gasEstimate: string; gasFee: string }> {
    // Simplified gas estimation - real implementation would query chain
    const gasEstimate = "0.00042";
    const gasFee = "0.000315";
    return { gasEstimate, gasFee };
  }

  // ============================================================================
  // Wallet PIN Operations (SIWE Fallback Authentication)
  // ============================================================================

  private readonly MAX_PIN_ATTEMPTS = 5;
  private readonly PIN_LOCKOUT_MINUTES = 15;

  async getWalletPin(walletAddress: string): Promise<WalletPin | null> {
    try {
      const [pin] = await this.sql<WalletPin[]>`
        SELECT 
          id,
          wallet_address as "walletAddress",
          pin_hash as "pinHash",
          failed_attempts as "failedAttempts",
          locked_until as "lockedUntil",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM wallet_pins
        WHERE LOWER(wallet_address) = LOWER(${walletAddress})
      `;
      return pin || null;
    } catch (error: any) {
      console.error('[PgStorage] getWalletPin error:', error);
      return null;
    }
  }

  async createWalletPin(data: InsertWalletPin): Promise<WalletPin> {
    try {
      const id = randomUUID();
      const walletLower = data.walletAddress.toLowerCase();
      
      const [pin] = await this.sql<WalletPin[]>`
        INSERT INTO wallet_pins (id, wallet_address, pin_hash, failed_attempts, locked_until, created_at, updated_at)
        VALUES (${id}, ${walletLower}, ${data.pinHash}, 0, NULL, NOW(), NOW())
        RETURNING
          id,
          wallet_address as "walletAddress",
          pin_hash as "pinHash",
          failed_attempts as "failedAttempts",
          locked_until as "lockedUntil",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      return pin;
    } catch (error: any) {
      console.error('[PgStorage] createWalletPin error:', error);
      throw new Error(`Failed to create wallet PIN: ${error.message}`);
    }
  }

  async updateWalletPin(walletAddress: string, data: Partial<WalletPin>): Promise<WalletPin | null> {
    try {
      const [pin] = await this.sql<WalletPin[]>`
        UPDATE wallet_pins
        SET
          pin_hash = COALESCE(${data.pinHash || null}, pin_hash),
          failed_attempts = COALESCE(${data.failedAttempts ?? null}, failed_attempts),
          locked_until = ${data.lockedUntil !== undefined ? data.lockedUntil : null},
          updated_at = NOW()
        WHERE LOWER(wallet_address) = LOWER(${walletAddress})
        RETURNING
          id,
          wallet_address as "walletAddress",
          pin_hash as "pinHash",
          failed_attempts as "failedAttempts",
          locked_until as "lockedUntil",
          created_at as "createdAt",
          updated_at as "updatedAt"
      `;
      return pin || null;
    } catch (error: any) {
      console.error('[PgStorage] updateWalletPin error:', error);
      return null;
    }
  }

  async incrementPinFailedAttempts(walletAddress: string): Promise<{ failedAttempts: number; lockedUntil: Date | null } | null> {
    try {
      // First get current attempts
      const current = await this.getWalletPin(walletAddress);
      if (!current) return null;

      const newAttempts = current.failedAttempts + 1;
      let lockedUntil: Date | null = null;

      if (newAttempts >= this.MAX_PIN_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + this.PIN_LOCKOUT_MINUTES * 60 * 1000);
      }

      await this.sql`
        UPDATE wallet_pins
        SET 
          failed_attempts = ${newAttempts},
          locked_until = ${lockedUntil},
          updated_at = NOW()
        WHERE LOWER(wallet_address) = LOWER(${walletAddress})
      `;

      return { failedAttempts: newAttempts, lockedUntil };
    } catch (error: any) {
      console.error('[PgStorage] incrementPinFailedAttempts error:', error);
      return null;
    }
  }

  async resetPinFailedAttempts(walletAddress: string): Promise<void> {
    try {
      await this.sql`
        UPDATE wallet_pins
        SET 
          failed_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
        WHERE LOWER(wallet_address) = LOWER(${walletAddress})
      `;
    } catch (error: any) {
      console.error('[PgStorage] resetPinFailedAttempts error:', error);
    }
  }
}
