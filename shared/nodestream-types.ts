/**
 * Node Stream Types
 * 
 * Shared TypeScript interfaces for the decentralized video streaming protocol.
 * These types define the core data structures for identity, content, events, and telemetry.
 */

/**
 * Decentralized Identifier (DID) - A globally unique identifier for entities
 * Format: did:method:specific-id (e.g., did:key:z6Mk...)
 */
export type DID = string;

/**
 * Content Identifier (CID) - IPFS-style content-addressed hash
 * Used to reference immutable content chunks
 */
export type CID = string;

/**
 * Session - Authenticated user session
 */
export interface Session {
  /** The DID of the authenticated user */
  did: DID;
  /** JWT or opaque authentication token */
  token: string;
  /** Unix timestamp (ms) when the session expires */
  expiresAt: number;
}

/**
 * Profile - User profile information
 */
export interface Profile {
  /** The DID of the profile owner */
  did: DID;
  /** Display name shown in the UI */
  displayName: string;
  /** URL to the user's avatar image */
  avatarUrl: string;
  /** User bio/description */
  bio: string;
  /** Number of followers */
  followers: number;
  /** Number of accounts this user follows */
  following: number;
}

/**
 * VideoChunk - A single chunk of video content
 */
export interface VideoChunk {
  /** Content identifier for this chunk */
  cid: CID;
  /** DID of the content owner */
  owner: DID;
  /** Sequence number within the stream */
  seq: number;
  /** Duration of this chunk in milliseconds */
  durationMs: number;
  /** Video codec (e.g., "h264", "vp9", "av1") */
  codec: string;
  /** Video resolution (e.g., "1920x1080", "1280x720") */
  resolution: string;
  /** Integrity checksum for verification */
  checksum: string;
}

/**
 * StreamPolicy - Configuration for stream distribution and interactions
 */
export interface StreamPolicy {
  /** Maximum number of peers for distribution */
  maxPeers: number;
  /** Whether end-to-end encryption is allowed */
  allowEncryption: boolean;
  /** List of allowed geographic regions (ISO 3166-1 alpha-2 codes) */
  allowedRegions: string[];
  /** Whether comments are enabled on this stream */
  allowComments: boolean;
  /** Whether reactions are enabled on this stream */
  allowReactions: boolean;
}

/**
 * StreamManifest - Complete metadata for a video stream
 */
export interface StreamManifest {
  /** Unique identifier for this stream */
  streamId: string;
  /** DID of the stream owner */
  owner: DID;
  /** Unix timestamp (ms) when the stream was created */
  createdAt: number;
  /** Array of video chunks in playback order */
  chunks: VideoChunk[];
  /** Index mapping for seeking (time -> chunk) */
  index: Record<number, number>;
  /** Stream distribution and interaction policy */
  policy: StreamPolicy;
  /** Cryptographic signature of the manifest */
  signature: string;
  /** Whether this is a live stream */
  live: boolean;
  /** Stream title */
  title: string;
  /** Stream description */
  description: string;
  /** Tags for categorization and discovery */
  tags: string[];
}

/**
 * CommentEvent - A comment on a stream with CRDT support
 */
export interface CommentEvent {
  /** Unique identifier for this event */
  eventId: string;
  /** Stream ID this comment belongs to */
  parentStreamId: string;
  /** DID of the comment author */
  author: DID;
  /** Comment text content */
  content: string;
  /** Unix timestamp (ms) when the comment was created */
  createdAt: number;
  /** Vector clock for CRDT conflict resolution */
  vectorClock: Record<string, number>;
  /** Cryptographic signature of the event */
  signature: string;
}

/**
 * ReactionEvent - A reaction (like, emoji) on a stream
 */
export interface ReactionEvent {
  /** Unique identifier for this event */
  eventId: string;
  /** Stream ID this reaction targets */
  targetStreamId: string;
  /** DID of the user who reacted */
  author: DID;
  /** Reaction type (e.g., "like", "love", "fire") */
  kind: string;
  /** Unix timestamp (ms) when the reaction was created */
  createdAt: number;
  /** Cryptographic signature of the event */
  signature: string;
}

/**
 * BookmarkEvent - A user bookmark for a stream
 */
export interface BookmarkEvent {
  /** Unique identifier for this event */
  eventId: string;
  /** Stream ID being bookmarked */
  targetStreamId: string;
  /** DID of the user who bookmarked */
  author: DID;
  /** Unix timestamp (ms) when the bookmark was created */
  createdAt: number;
  /** Whether this bookmark is private */
  private: boolean;
  /** Cryptographic signature of the event */
  signature: string;
}

/**
 * Telemetry - Network health and performance metrics
 */
export interface Telemetry {
  /** Percentage of requests fulfilled by origin vs peers (0-100) */
  originFulfillmentPct: number;
  /** Average number of replicas per chunk across the network */
  avgReplicasPerChunk: number;
  /** Median number of hops for content delivery */
  medianHopCount: number;
  /** Current number of concurrent live stream viewers */
  liveConcurrentPeers: number;
  /** User's contribution score based on seeding behavior */
  contributionScore: number;
}
