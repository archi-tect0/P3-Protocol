import { createHash } from "crypto";
import type { 
  CallSession,
  InsertCallSession,
  TelemetryVoice,
  InsertTelemetryVoice,
} from "@shared/schema";
import type { IStorage } from "../storage";

/**
 * Input type for starting a meeting
 */
export interface StartMeetingInput {
  roomId: string;
  participants: string[];
  mediaType: "audio" | "video" | "screen";
  startTime: Date;
}

/**
 * Input type for ending a meeting
 */
export interface EndMeetingInput {
  roomId: string;
  endTime: Date;
  participantSignatures?: string[];
  metricsSummary?: {
    averageRttMs?: number;
    averageJitterMs?: number;
    averagePacketsLostPct?: number;
    averageBitrateKbps?: number;
    peakParticipants?: number;
    totalDataTransferredMb?: number;
  };
}

/**
 * Input type for recording voice metrics
 */
export interface RecordVoiceStatsInput {
  roomHash: string;
  sessionId: string;
  metrics: {
    rttMs?: number;
    jitterMs?: number;
    packetsLostPct?: number;
    bitrateKbps?: number;
    codec?: string;
    audioLevel?: number;
    iceState?: string;
  };
}

/**
 * Aggregated voice metrics result
 */
export interface VoiceMetricsAggregation {
  roomId: string;
  totalSessions: number;
  totalDurationSec: number;
  averageRttMs: number;
  averageJitterMs: number;
  averagePacketsLostPct: number;
  averageBitrateKbps: number;
  codecsUsed: string[];
  recentMetrics: TelemetryVoice[];
}

/**
 * VoiceService - Core service for voice/video calling and telemetry
 * 
 * This service handles:
 * - SHA-256 participant hashing for privacy-preserving meeting records
 * - Meeting session lifecycle (start, checkpoint, end)
 * - Voice quality telemetry and metrics aggregation
 * - Blockchain anchoring via middleware integration
 */
export class VoiceService {
  constructor(private storage: IStorage) {}

  /**
   * Start a new meeting session
   * 
   * @param input - Meeting start data with participants and media type
   * @returns Promise<CallSession> - The created meeting session
   * 
   * Process:
   * 1. Hash each participant identifier with SHA-256 for privacy
   * 2. Create document hash from session data
   * 3. Store session with immutable sequence
   * 
   * The participant hashes protect privacy while allowing verification
   * that specific participants were in the meeting without revealing
   * their identities in the stored record.
   */
  async startMeeting(input: StartMeetingInput): Promise<CallSession> {
    try {
      // Hash each participant with SHA-256 for privacy
      const participantsHashes = input.participants.map(participant =>
        createHash('sha256').update(participant).digest('hex')
      );

      // Create document hash from session start data
      const docHash = createHash('sha256')
        .update(JSON.stringify({
          roomId: input.roomId,
          participantsHashes,
          mediaType: input.mediaType,
          startTime: input.startTime.toISOString(),
        }))
        .digest('hex');

      // Prepare insert data
      const insertData: InsertCallSession = {
        roomId: input.roomId,
        participantsHashes,
        mediaType: input.mediaType,
        startTx: docHash,
        endTx: null,
        startedAt: input.startTime,
        endedAt: null,
        durationSec: null,
        metricsSummary: null,
        immutableSeq: 0, // Will be set by storage layer
      };

      // Store session with immutable sequence
      const session = await this.storage.createCallSession(insertData);

      return session;
    } catch (error) {
      console.error("Error starting meeting:", error);
      throw new Error(`Failed to start meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * End a meeting session
   * 
   * @param input - Meeting end data with signatures and metrics summary
   * @returns Promise<CallSession> - The updated meeting session
   * 
   * Process:
   * 1. Retrieve active session for the room
   * 2. Calculate meeting duration
   * 3. Create end document hash with signatures and metrics
   * 4. Update session with end data
   * 
   * Participant signatures provide cryptographic proof that participants
   * agreed to the meeting record and metrics summary.
   */
  async endMeeting(input: EndMeetingInput): Promise<CallSession> {
    try {
      // Retrieve active session for the room
      const session = await this.storage.getCallSessionByRoomId(input.roomId);
      
      if (!session) {
        throw new Error(`No active meeting found for room: ${input.roomId}`);
      }

      // Calculate duration in seconds
      const durationMs = input.endTime.getTime() - session.startedAt.getTime();
      const durationSec = Math.floor(durationMs / 1000);

      // Create end document hash with signatures and metrics
      const endDocHash = createHash('sha256')
        .update(JSON.stringify({
          roomId: input.roomId,
          sessionId: session.id,
          endTime: input.endTime.toISOString(),
          durationSec,
          participantSignatures: input.participantSignatures || [],
          metricsSummary: input.metricsSummary || {},
        }))
        .digest('hex');

      // Update session with end data
      const updatedSession = await this.storage.updateCallSession(session.id, {
        endTx: endDocHash,
        endedAt: input.endTime,
        durationSec,
        metricsSummary: input.metricsSummary || null,
      });

      return updatedSession;
    } catch (error) {
      console.error("Error ending meeting:", error);
      throw new Error(`Failed to end meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a checkpoint anchor during an ongoing meeting
   * 
   * @param roomId - Room ID of the ongoing meeting
   * @param checkpointTime - Time of the checkpoint
   * @returns Promise<string> - Checkpoint document hash
   * 
   * Process:
   * 1. Retrieve active session
   * 2. Create checkpoint document hash with current state
   * 
   * Checkpoints provide mid-call attestation that the meeting was
   * ongoing at a specific time, useful for long meetings or to
   * prove participation during a specific time window.
   */
  async checkpointMeeting(roomId: string, checkpointTime: Date): Promise<string> {
    try {
      // Retrieve active session
      const session = await this.storage.getCallSessionByRoomId(roomId);
      
      if (!session) {
        throw new Error(`No active meeting found for room: ${roomId}`);
      }

      // Calculate elapsed duration
      const elapsedMs = checkpointTime.getTime() - session.startedAt.getTime();
      const elapsedSec = Math.floor(elapsedMs / 1000);

      // Create checkpoint document hash
      const checkpointHash = createHash('sha256')
        .update(JSON.stringify({
          roomId,
          sessionId: session.id,
          checkpointTime: checkpointTime.toISOString(),
          elapsedSec,
          participantsHashes: session.participantsHashes,
        }))
        .digest('hex');

      return checkpointHash;
    } catch (error) {
      console.error("Error creating meeting checkpoint:", error);
      throw new Error(`Failed to create checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Record voice quality statistics
   * 
   * @param input - Voice metrics data for a session
   * @returns Promise<TelemetryVoice> - The recorded telemetry event
   * 
   * Process:
   * 1. Hash room ID with SHA-256 for privacy
   * 2. Store telemetry metrics
   * 3. Metrics include RTT, jitter, packet loss, bitrate, codec, etc.
   * 
   * Voice telemetry is crucial for:
   * - Quality monitoring and troubleshooting
   * - Network performance analysis
   * - Codec effectiveness evaluation
   * - Historical quality trends
   */
  async recordVoiceStats(input: RecordVoiceStatsInput): Promise<TelemetryVoice> {
    try {
      // Room hash is already expected to be hashed by the caller
      // but we verify it's in the expected format
      if (!/^[a-f0-9]{64}$/i.test(input.roomHash)) {
        // If not a valid SHA-256 hash, hash it
        const roomHash = createHash('sha256')
          .update(input.roomHash)
          .digest('hex');
        
        input = { ...input, roomHash };
      }

      // Prepare insert data
      const insertData: InsertTelemetryVoice = {
        roomHash: input.roomHash,
        sessionId: input.sessionId,
        rttMs: input.metrics.rttMs || null,
        jitterMs: input.metrics.jitterMs || null,
        packetsLostPct: input.metrics.packetsLostPct?.toString() || null,
        bitrateKbps: input.metrics.bitrateKbps || null,
        codec: input.metrics.codec || null,
        audioLevel: input.metrics.audioLevel || null,
        iceState: input.metrics.iceState || null,
      };

      // Store telemetry
      const telemetry = await this.storage.recordVoiceTelemetry(insertData);

      return telemetry;
    } catch (error) {
      console.error("Error recording voice stats:", error);
      throw new Error(`Failed to record voice stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get aggregated voice metrics for a room
   * 
   * @param roomId - Room ID to get metrics for
   * @returns Promise<VoiceMetricsAggregation> - Aggregated metrics
   * 
   * Process:
   * 1. Hash room ID to match stored telemetry
   * 2. Retrieve all sessions for the room
   * 3. Retrieve all telemetry for the room hash
   * 4. Aggregate metrics across sessions
   */
  async getVoiceMetrics(roomId: string): Promise<VoiceMetricsAggregation> {
    try {
      // Hash room ID for telemetry lookup
      const roomHash = createHash('sha256')
        .update(roomId)
        .digest('hex');

      // Retrieve sessions
      const sessions = await this.storage.listCallSessions(roomId);

      // Retrieve telemetry
      const telemetry = await this.storage.getVoiceTelemetry({ roomHash });

      // Calculate aggregations
      const totalSessions = sessions.length;
      const totalDurationSec = sessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);

      // Aggregate telemetry metrics
      const validRtt = telemetry.filter(t => t.rttMs !== null);
      const validJitter = telemetry.filter(t => t.jitterMs !== null);
      const validPacketsLost = telemetry.filter(t => t.packetsLostPct !== null);
      const validBitrate = telemetry.filter(t => t.bitrateKbps !== null);

      const averageRttMs = validRtt.length > 0
        ? validRtt.reduce((sum, t) => sum + t.rttMs!, 0) / validRtt.length
        : 0;

      const averageJitterMs = validJitter.length > 0
        ? validJitter.reduce((sum, t) => sum + t.jitterMs!, 0) / validJitter.length
        : 0;

      const averagePacketsLostPct = validPacketsLost.length > 0
        ? validPacketsLost.reduce((sum, t) => sum + parseFloat(t.packetsLostPct as string), 0) / validPacketsLost.length
        : 0;

      const averageBitrateKbps = validBitrate.length > 0
        ? validBitrate.reduce((sum, t) => sum + t.bitrateKbps!, 0) / validBitrate.length
        : 0;

      // Collect unique codecs
      const codecsUsed = Array.from(
        new Set(telemetry.filter(t => t.codec).map(t => t.codec!))
      );

      // Get recent metrics (last 100)
      const recentMetrics = telemetry.slice(0, 100);

      return {
        roomId,
        totalSessions,
        totalDurationSec,
        averageRttMs,
        averageJitterMs,
        averagePacketsLostPct,
        averageBitrateKbps,
        codecsUsed,
        recentMetrics,
      };
    } catch (error) {
      console.error("Error fetching voice metrics:", error);
      throw new Error(`Failed to fetch voice metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get meeting details by session ID
   * 
   * @param id - Call session ID
   * @returns Promise<CallSession | null> - Meeting session if found
   */
  async getMeeting(id: string): Promise<CallSession | null> {
    try {
      return await this.storage.getCallSession(id);
    } catch (error) {
      console.error("Error fetching meeting:", error);
      throw new Error(`Failed to fetch meeting: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify participant was in a meeting
   * 
   * @param sessionId - Call session ID
   * @param participantId - Participant identifier to verify
   * @returns Promise<boolean> - True if participant was in the meeting
   * 
   * Process:
   * 1. Retrieve session
   * 2. Hash provided participant ID
   * 3. Check if hash exists in participantsHashes array
   */
  async verifyParticipant(sessionId: string, participantId: string): Promise<boolean> {
    try {
      const session = await this.storage.getCallSession(sessionId);
      
      if (!session) {
        return false;
      }

      // Hash participant ID
      const participantHash = createHash('sha256')
        .update(participantId)
        .digest('hex');

      // Check if hash exists in participants
      return session.participantsHashes.includes(participantHash);
    } catch (error) {
      console.error("Error verifying participant:", error);
      return false;
    }
  }

  /**
   * Get all meetings for a specific room
   * 
   * @param roomId - Room ID
   * @returns Promise<CallSession[]> - Array of meeting sessions
   */
  async getRoomMeetings(roomId: string): Promise<CallSession[]> {
    try {
      return await this.storage.listCallSessions(roomId);
    } catch (error) {
      console.error("Error fetching room meetings:", error);
      throw new Error(`Failed to fetch room meetings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
