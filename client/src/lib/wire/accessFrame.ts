/**
 * Access Frame Wire Protocol - Client-side binary parsing
 * 
 * Handles deserialization of binary access frames from SSE lanes.
 * Matches server wire format for efficient binary transport.
 * 
 * Frame Format:
 * - Header: [version:1][flags:1][itemId_len:2][readiness:1]
 * - ItemId: [itemId_bytes:itemId_len]
 * - Access payload (if has_access flag): [access_len:4][access_json:access_len]
 * - Fallback payload (if has_fallback flag): [fallback_len:4][fallback_json:fallback_len]
 * - Headers (if has_headers flag): [headers_len:4][headers_json:headers_len]
 * - Timestamp: [timestamp:8]
 * - Checksum: [crc32:4]
 */

export const FRAME_VERSION = 1;

export const FrameFlags = {
  HAS_ACCESS: 0x01,
  HAS_FALLBACK: 0x02,
  HAS_HEADERS: 0x04,
  IS_DELTA: 0x08,
  IS_COMPRESSED: 0x10,
  REQUIRES_AUTH: 0x20,
} as const;

export type ReadinessState = 'PENDING' | 'READY' | 'DEGRADED';

const ReadinessCode = {
  0: 'PENDING' as ReadinessState,
  1: 'READY' as ReadinessState,
  2: 'DEGRADED' as ReadinessState,
};

export interface AccessPayload {
  mode: string;
  format: string;
  uri?: string;
  embed?: string;
  openWeb?: string;
  headers?: Record<string, string>;
  expiresAt?: number;
  quality?: string;
  bitrate?: number;
}

export interface AccessFrame {
  version: number;
  flags: number;
  itemId: string;
  readiness: ReadinessState;
  access?: AccessPayload;
  fallback?: AccessPayload;
  headers?: Record<string, string>;
  timestamp: number;
  checksum: number;
  isValid: boolean;
}

export interface CompactAccessFrame {
  id: string;
  r: 0 | 1 | 2;
  a?: string;
  f?: string;
  t: number;
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function deserializeAccessFrame(base64Data: string): AccessFrame | null {
  try {
    const bytes = decodeBase64ToBytes(base64Data);
    return parseAccessFrame(bytes);
  } catch (err) {
    console.error('[AccessFrame] Failed to deserialize frame:', err);
    return null;
  }
}

export function parseAccessFrame(bytes: Uint8Array): AccessFrame | null {
  if (bytes.length < 13) {
    console.warn('[AccessFrame] Frame too short');
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  const version = bytes[offset++];
  if (version !== FRAME_VERSION) {
    console.warn(`[AccessFrame] Unknown version: ${version}`);
    return null;
  }

  const flags = bytes[offset++];
  const itemIdLen = view.getUint16(offset, true);
  offset += 2;
  const readinessCode = bytes[offset++];

  const decoder = new TextDecoder();
  const itemIdBytes = bytes.slice(offset, offset + itemIdLen);
  const itemId = decoder.decode(itemIdBytes);
  offset += itemIdLen;

  const readiness = ReadinessCode[readinessCode as keyof typeof ReadinessCode] || 'PENDING';

  let access: AccessPayload | undefined;
  if (flags & FrameFlags.HAS_ACCESS) {
    const accessLen = view.getUint32(offset, true);
    offset += 4;
    const accessBytes = bytes.slice(offset, offset + accessLen);
    const accessJson = decoder.decode(accessBytes);
    access = JSON.parse(accessJson);
    offset += accessLen;
  }

  let fallback: AccessPayload | undefined;
  if (flags & FrameFlags.HAS_FALLBACK) {
    const fallbackLen = view.getUint32(offset, true);
    offset += 4;
    const fallbackBytes = bytes.slice(offset, offset + fallbackLen);
    const fallbackJson = decoder.decode(fallbackBytes);
    fallback = JSON.parse(fallbackJson);
    offset += fallbackLen;
  }

  let headers: Record<string, string> | undefined;
  if (flags & FrameFlags.HAS_HEADERS) {
    const headersLen = view.getUint32(offset, true);
    offset += 4;
    const headersBytes = bytes.slice(offset, offset + headersLen);
    const headersJson = decoder.decode(headersBytes);
    headers = JSON.parse(headersJson);
    offset += headersLen;
  }

  let timestamp = Date.now();
  if (offset + 8 <= bytes.length) {
    const low = view.getUint32(offset, true);
    const high = view.getUint32(offset + 4, true);
    timestamp = low + high * 0x100000000;
    offset += 8;
  }

  let checksum = 0;
  let isValid = true;
  if (offset + 4 <= bytes.length) {
    checksum = view.getUint32(offset, true);
    const computed = computeCRC32(bytes.slice(0, offset));
    isValid = checksum === computed;
  }

  return {
    version,
    flags,
    itemId,
    readiness,
    access,
    fallback,
    headers,
    timestamp,
    checksum,
    isValid,
  };
}

export function parseCompactFrame(json: string): AccessFrame | null {
  try {
    const compact: CompactAccessFrame = JSON.parse(json);
    
    const readinessMap = {
      0: 'PENDING' as ReadinessState,
      1: 'READY' as ReadinessState,
      2: 'DEGRADED' as ReadinessState,
    };

    let access: AccessPayload | undefined;
    if (compact.a) {
      access = JSON.parse(atob(compact.a));
    }

    let fallback: AccessPayload | undefined;
    if (compact.f) {
      fallback = JSON.parse(atob(compact.f));
    }

    return {
      version: FRAME_VERSION,
      flags: (access ? FrameFlags.HAS_ACCESS : 0) | (fallback ? FrameFlags.HAS_FALLBACK : 0),
      itemId: compact.id,
      readiness: readinessMap[compact.r] || 'PENDING',
      access,
      fallback,
      timestamp: compact.t,
      checksum: 0,
      isValid: true,
    };
  } catch (err) {
    console.error('[AccessFrame] Failed to parse compact frame:', err);
    return null;
  }
}

export function serializeAccessFrame(frame: Omit<AccessFrame, 'checksum' | 'isValid'>): Uint8Array {
  const encoder = new TextEncoder();
  const itemIdBytes = encoder.encode(frame.itemId);
  
  let accessBytes: Uint8Array | null = null;
  if (frame.access) {
    accessBytes = encoder.encode(JSON.stringify(frame.access));
  }

  let fallbackBytes: Uint8Array | null = null;
  if (frame.fallback) {
    fallbackBytes = encoder.encode(JSON.stringify(frame.fallback));
  }

  let headersBytes: Uint8Array | null = null;
  if (frame.headers) {
    headersBytes = encoder.encode(JSON.stringify(frame.headers));
  }

  const totalLen = 
    5 + 
    itemIdBytes.length +
    (accessBytes ? 4 + accessBytes.length : 0) +
    (fallbackBytes ? 4 + fallbackBytes.length : 0) +
    (headersBytes ? 4 + headersBytes.length : 0) +
    8 +
    4;

  const buffer = new Uint8Array(totalLen);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  buffer[offset++] = frame.version;
  buffer[offset++] = frame.flags;
  view.setUint16(offset, itemIdBytes.length, true);
  offset += 2;
  
  const readinessMap: Record<ReadinessState, number> = {
    PENDING: 0,
    READY: 1,
    DEGRADED: 2,
  };
  buffer[offset++] = readinessMap[frame.readiness];

  buffer.set(itemIdBytes, offset);
  offset += itemIdBytes.length;

  if (accessBytes) {
    view.setUint32(offset, accessBytes.length, true);
    offset += 4;
    buffer.set(accessBytes, offset);
    offset += accessBytes.length;
  }

  if (fallbackBytes) {
    view.setUint32(offset, fallbackBytes.length, true);
    offset += 4;
    buffer.set(fallbackBytes, offset);
    offset += fallbackBytes.length;
  }

  if (headersBytes) {
    view.setUint32(offset, headersBytes.length, true);
    offset += 4;
    buffer.set(headersBytes, offset);
    offset += headersBytes.length;
  }

  view.setUint32(offset, frame.timestamp & 0xFFFFFFFF, true);
  view.setUint32(offset + 4, Math.floor(frame.timestamp / 0x100000000), true);
  offset += 8;

  const checksum = computeCRC32(buffer.slice(0, offset));
  view.setUint32(offset, checksum, true);

  return buffer;
}

export function encodeToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const CRC32_TABLE = new Uint32Array(256);
let crcTableInitialized = false;

function initCRC32Table(): void {
  if (crcTableInitialized) return;
  
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC32_TABLE[i] = c;
  }
  crcTableInitialized = true;
}

export function computeCRC32(bytes: Uint8Array): number {
  initCRC32Table();
  
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function isFrameExpired(frame: AccessFrame, maxAgeMs: number = 300000): boolean {
  return Date.now() - frame.timestamp > maxAgeMs;
}

export function hasFlag(frame: AccessFrame, flag: number): boolean {
  return (frame.flags & flag) !== 0;
}

export function isCompressed(frame: AccessFrame): boolean {
  return hasFlag(frame, FrameFlags.IS_COMPRESSED);
}

export function isDelta(frame: AccessFrame): boolean {
  return hasFlag(frame, FrameFlags.IS_DELTA);
}

export function requiresAuth(frame: AccessFrame): boolean {
  return hasFlag(frame, FrameFlags.REQUIRES_AUTH);
}

export type AccessFrameHandler = (frame: AccessFrame) => void;

export class AccessFrameParser {
  private handlers: Set<AccessFrameHandler> = new Set();
  private buffer: string = '';

  subscribe(handler: AccessFrameHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  parseSSEData(data: string): void {
    if (data.startsWith('data:')) {
      data = data.slice(5).trim();
    }

    if (data.startsWith('{')) {
      const frame = parseCompactFrame(data);
      if (frame) {
        this.emit(frame);
      }
    } else {
      const frame = deserializeAccessFrame(data);
      if (frame) {
        this.emit(frame);
      }
    }
  }

  parseChunk(chunk: string): void {
    this.buffer += chunk;
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        this.parseSSEData(line);
      }
    }
  }

  private emit(frame: AccessFrame): void {
    for (const handler of this.handlers) {
      try {
        handler(frame);
      } catch (err) {
        console.error('[AccessFrameParser] Handler error:', err);
      }
    }
  }

  reset(): void {
    this.buffer = '';
  }
}

export const accessFrameParser = new AccessFrameParser();

export function createAccessFrameFromUpdate(update: {
  itemId: string;
  readiness: string;
  access?: Record<string, unknown>;
  fallback?: Record<string, unknown>;
}): AccessFrame {
  return {
    version: FRAME_VERSION,
    flags: (update.access ? FrameFlags.HAS_ACCESS : 0) | 
           (update.fallback ? FrameFlags.HAS_FALLBACK : 0),
    itemId: update.itemId,
    readiness: update.readiness as ReadinessState,
    access: update.access as AccessPayload | undefined,
    fallback: update.fallback as AccessPayload | undefined,
    timestamp: Date.now(),
    checksum: 0,
    isValid: true,
  };
}
