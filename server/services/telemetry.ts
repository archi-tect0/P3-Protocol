import { createHash, createHmac } from "crypto";
import type { InsertTelemetryEvent, TelemetryEvent } from "@shared/schema";
import type { IStorage } from "../storage";
import Bowser from "bowser";
import { resolveCountry, getCachedCountry } from "./geoIp";

/**
 * Admin governance telemetry event types
 */
export type AdminEventType = 
  | 'connect_attempt'
  | 'connect_approved'
  | 'connect_rejected'
  | 'session_revoked'
  | 'session_expired'
  | 'role_changed'
  | 'admin_login'
  | 'admin_logout'
  | 'config_updated'
  | 'user_created'
  | 'user_deleted';

/**
 * Admin governance telemetry event
 */
export interface AdminTelemetryEvent {
  id: string;
  event: AdminEventType | string;
  timestamp: Date;
  meta?: Record<string, any>;
}

/**
 * Input type for recording a telemetry event
 */
export interface RecordEventInput {
  eventType: "page_view" | "click" | "form_submit" | "api_call" | "error";
  sessionId: string;
  ip: string;
  userAgent: string;
  timestamp?: Date;
}

/**
 * Device breakdown result
 */
export interface DeviceBreakdown {
  device: string;
  count: number;
}

/**
 * Geo breakdown result
 */
export interface GeoBreakdown {
  region: string;
  count: number;
}

/**
 * Auth funnel result
 */
export interface AuthFunnelStep {
  step: string;
  count: number;
  conversionRate: number;
}

/**
 * Fraud signal result
 */
export interface FraudSignal {
  sessionId: string;
  fraudScore: number;
  eventCount: number;
  hashedIp: string;
}

/**
 * Cached metrics with expiry
 */
interface CachedMetrics {
  data: Awaited<ReturnType<IStorage['getMetrics']>>;
  timestamp: number;
}

/**
 * TelemetryService - Privacy-safe telemetry with hashed IPs and device detection
 * 
 * This service handles:
 * - HMAC-SHA256 IP hashing with salt for privacy protection
 * - SHA-256 user agent hashing for device fingerprinting
 * - Geo region derivation (privacy-preserving implementation)
 * - Fraud score calculation (returns 0 by default)
 * - Device type detection from user agent parsing
 * - Live user metrics and analytics
 * - Caching with 5-second TTL to avoid database hammering
 * - Admin governance telemetry logging (in-memory, last 1000 events)
 */
export class TelemetryService {
  private salt: string;
  private metricsCache: CachedMetrics | null = null;
  private readonly CACHE_TTL_MS = 5 * 1000; // 5 seconds
  
  private static adminEvents: AdminTelemetryEvent[] = [];
  private static readonly MAX_ADMIN_EVENTS = 1000;
  private static eventCounter = 0;

  constructor(private storage: IStorage) {
    // Use environment variable TELEMETRY_SALT with fallback
    this.salt = process.env.TELEMETRY_SALT || "default-salt-change-in-production";
  }

  /**
   * Log an admin governance telemetry event
   * Keeps last 1000 events in memory (ring buffer behavior)
   * 
   * @param event - Event type (connect_attempt, connect_approved, session_revoked, role_changed, etc.)
   * @param meta - Optional metadata associated with the event
   * @returns The logged event
   */
  static log(event: AdminEventType | string, meta?: Record<string, any>): AdminTelemetryEvent {
    const telemetryEvent: AdminTelemetryEvent = {
      id: `evt_${Date.now()}_${++TelemetryService.eventCounter}`,
      event,
      timestamp: new Date(),
      meta,
    };

    TelemetryService.adminEvents.push(telemetryEvent);

    if (TelemetryService.adminEvents.length > TelemetryService.MAX_ADMIN_EVENTS) {
      TelemetryService.adminEvents.shift();
    }

    return telemetryEvent;
  }

  /**
   * Get recent admin telemetry events
   * 
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of recent admin telemetry events (newest first)
   */
  static getAdminEvents(limit: number = 100): AdminTelemetryEvent[] {
    const events = [...TelemetryService.adminEvents];
    events.reverse();
    return events.slice(0, limit);
  }

  /**
   * Get admin telemetry events filtered by event type
   * 
   * @param eventType - Event type to filter by
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of filtered admin telemetry events (newest first)
   */
  static getAdminEventsByType(eventType: AdminEventType | string, limit: number = 100): AdminTelemetryEvent[] {
    const events = TelemetryService.adminEvents.filter(e => e.event === eventType);
    events.reverse();
    return events.slice(0, limit);
  }

  /**
   * Clear all admin telemetry events (for testing purposes)
   */
  static clearAdminEvents(): void {
    TelemetryService.adminEvents = [];
    TelemetryService.eventCounter = 0;
  }

  /**
   * Get metrics with caching to avoid database hammering
   * Cache is valid for 5 seconds (CACHE_TTL_MS)
   * 
   * @returns Promise<Metrics> - Cached or fresh metrics data
   */
  private async getMetricsWithCache(): Promise<Awaited<ReturnType<IStorage['getMetrics']>>> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (this.metricsCache && (now - this.metricsCache.timestamp) < this.CACHE_TTL_MS) {
      return this.metricsCache.data;
    }
    
    // Fetch fresh data from storage
    const data = await this.storage.getMetrics();
    
    // Update cache
    this.metricsCache = {
      data,
      timestamp: now,
    };
    
    return data;
  }

  /**
   * Record a telemetry event with privacy-safe hashing
   * 
   * @param event - Event data with raw IP and user agent
   * @returns Promise<TelemetryEvent> - The recorded event with hashed data
   * 
   * Process:
   * 1. Resolve geo region from RAW IP FIRST (before hashing)
   * 2. Hash IP with HMAC-SHA256 using salt for privacy
   * 3. Hash user agent with SHA-256 for device fingerprinting
   * 4. Calculate fraud score based on event patterns
   * 5. Parse user agent to detect device type
   * 6. Store event in storage layer
   */
  async recordEvent(event: RecordEventInput): Promise<TelemetryEvent> {
    // IMPORTANT: Resolve geo region from RAW IP BEFORE hashing
    // Once IP is hashed, geolocation is impossible
    const geoRegion = await this.resolveGeoRegion(event.ip);

    // Hash IP with HMAC-SHA256 for privacy protection (AFTER geolocation)
    const hashedIp = createHmac('sha256', this.salt)
      .update(event.ip)
      .digest('hex');

    // Hash user agent with SHA-256 for device fingerprinting
    const uaHash = createHash('sha256')
      .update(event.userAgent)
      .digest('hex');

    // Parse user agent to detect device type
    const device = this.parseDeviceType(event.userAgent);

    // Calculate fraud score
    const fraudScore = await this.calculateFraudScore({
      sessionId: event.sessionId,
      hashedIp,
      device,
      eventType: event.eventType,
    });

    // Prepare insert data
    const insertData: InsertTelemetryEvent = {
      eventType: event.eventType,
      sessionId: event.sessionId,
      hashedIp,
      geoRegion,
      device,
      uaHash,
      fraudScore: fraudScore.toString(),
    };

    // Store event
    return this.storage.recordTelemetryEvent(insertData);
  }

  /**
   * Get all metrics at once (unified endpoint)
   * Uses caching to avoid DB hammering
   * 
   * @returns Promise<Metrics> - All telemetry metrics
   */
  async getAllMetrics() {
    return this.getMetricsWithCache();
  }

  /**
   * Get live users count (unique sessions in last 5 minutes)
   * Uses caching to avoid DB hammering
   * 
   * @returns Promise<number> - Count of unique active sessions
   */
  async getLiveUsers(): Promise<number> {
    const metrics = await this.getMetricsWithCache();
    return metrics.liveUsers.activeUsers;
  }

  /**
   * Get geo breakdown of events by region
   * Uses caching to avoid DB hammering
   * 
   * @returns Promise<GeoBreakdown[]> - Array of regions with event counts
   */
  async getGeoBreakdown(): Promise<GeoBreakdown[]> {
    const metrics = await this.getMetricsWithCache();
    return metrics.geo.map(g => ({
      region: g.region,
      count: g.count,
    }));
  }

  /**
   * Get auth funnel metrics (auth_start, auth_success, etc.)
   * Uses caching to avoid DB hammering
   * 
   * @returns Promise<AuthFunnelStep[]> - Funnel steps with counts and conversion rates
   */
  async getAuthFunnel(): Promise<AuthFunnelStep[]> {
    const metrics = await this.getMetricsWithCache();
    return metrics.funnel.map(f => ({
      step: f.step,
      count: f.count,
      conversionRate: f.conversionRate,
    }));
  }

  /**
   * Get device breakdown by parsing user agents
   * Uses caching to avoid DB hammering
   * 
   * @returns Promise<DeviceBreakdown[]> - Array of device types with counts
   */
  async getDeviceBreakdown(): Promise<DeviceBreakdown[]> {
    const metrics = await this.getMetricsWithCache();
    return metrics.devices.map(d => ({
      device: d.device,
      count: d.count,
    }));
  }

  /**
   * Get fraud signals (events with high fraud scores)
   * Uses caching to avoid DB hammering
   * 
   * @returns Promise<FraudSignal[]> - Array of suspicious sessions with fraud indicators
   */
  async getFraudSignals(): Promise<FraudSignal[]> {
    const metrics = await this.getMetricsWithCache();
    
    // Return aggregated fraud metrics
    // High-risk sessions are those with fraud scores > 0.7
    return [
      {
        sessionId: "aggregated",
        fraudScore: metrics.fraud.averageFraudScore,
        eventCount: metrics.fraud.highRiskSessions,
        hashedIp: "aggregated",
      },
    ];
  }

  /**
   * Resolve geo region from RAW IP address
   * 
   * @param rawIp - Raw (unhashed) IP address
   * @returns Promise<string> - Country name or "unknown"
   * 
   * IMPORTANT: This method must be called BEFORE hashing the IP.
   * Once the IP is hashed, geolocation lookup is impossible.
   * 
   * Uses the geoIp service which:
   * - Checks cache first for fast lookups
   * - Falls back to ipapi.co API for resolution
   * - Caches results for 24 hours
   */
  private async resolveGeoRegion(rawIp: string): Promise<string> {
    try {
      // First check cache for fast lookup
      const cachedCountry = getCachedCountry(rawIp);
      if (cachedCountry) {
        return cachedCountry;
      }

      // Resolve from external API using RAW IP
      const country = await resolveCountry(rawIp);
      return country || "unknown";
    } catch (error) {
      console.error('[Telemetry] Failed to resolve geo region:', error);
      return "unknown";
    }
  }

  /**
   * Calculate fraud score based on event patterns
   * 
   * @param data - Event data for fraud analysis
   * @returns Promise<number> - Fraud score between 0 and 1
   * 
   * Returns 0 (no fraud detected) by default.
   * Advanced fraud detection would require ML models analyzing:
   * - Event velocity, device patterns, IP behavior, auth failures, etc.
   */
  private async calculateFraudScore(data: {
    sessionId: string;
    hashedIp: string;
    device: string;
    eventType: string;
  }): Promise<number> {
    // Basic implementation returns zero fraud score
    // Advanced heuristics can be added as needed
    return 0;
  }

  /**
   * Parse user agent string to detect device type
   * 
   * @param userAgent - Raw user agent string
   * @returns string - Device type (desktop, mobile, tablet, bot)
   */
  private parseDeviceType(userAgent: string): string {
    try {
      const browser = Bowser.parse(userAgent);
      const platformType = browser.platform.type;
      
      if (platformType === "mobile") {
        return "mobile";
      } else if (platformType === "tablet") {
        return "tablet";
      } else if (platformType === "desktop") {
        return "desktop";
      } else {
        return "unknown";
      }
    } catch (error) {
      // If parsing fails, check for common bot patterns
      if (/bot|crawler|spider|scraper/i.test(userAgent)) {
        return "bot";
      }
      return "unknown";
    }
  }
}
