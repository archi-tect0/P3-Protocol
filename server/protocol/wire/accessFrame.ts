/**
 * Atlas API 2.0 - Binary Access Frame
 * 
 * Protobuf-style binary encoding for AccessFrame with SSE transport support.
 * Optimized for hot paths with minimal allocations.
 */

export enum AccessMode {
  UNKNOWN = 0,
  URI = 1,
  EMBED = 2,
  OPEN_WEB = 3,
}

export enum Readiness {
  UNKNOWN = 0,
  PENDING = 1,
  READY = 2,
  DEGRADED = 3,
}

export interface Capabilities {
  codec?: string;
  segmentMs?: number;
  cors?: boolean;
}

export interface AccessFrame {
  id: string;
  mode: AccessMode;
  uri?: string;
  embed?: string;
  openWeb?: string;
  readiness: Readiness;
  ttlMs?: number;
  capabilities?: Capabilities;
  signature?: Uint8Array;
}

export type AccessFrameInit = Partial<AccessFrame> & { id: string };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0;
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return new Uint8Array(bytes);
}

function decodeVarint(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  
  while (pos < bytes.length) {
    const byte = bytes[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) {
      return [result >>> 0, pos];
    }
    shift += 7;
    if (shift > 35) {
      throw new Error('Varint too long');
    }
  }
  throw new Error('Unexpected end of varint');
}

function encodeString(str: string): Uint8Array {
  const strBytes = textEncoder.encode(str);
  const lenBytes = encodeVarint(strBytes.length);
  const result = new Uint8Array(lenBytes.length + strBytes.length);
  result.set(lenBytes, 0);
  result.set(strBytes, lenBytes.length);
  return result;
}

function decodeString(bytes: Uint8Array, offset: number): [string, number] {
  const [len, pos1] = decodeVarint(bytes, offset);
  const strBytes = bytes.slice(pos1, pos1 + len);
  return [textDecoder.decode(strBytes), pos1 + len];
}

function encodeBytes(data: Uint8Array): Uint8Array {
  const lenBytes = encodeVarint(data.length);
  const result = new Uint8Array(lenBytes.length + data.length);
  result.set(lenBytes, 0);
  result.set(data, lenBytes.length);
  return result;
}

function decodeBytes(bytes: Uint8Array, offset: number): [Uint8Array, number] {
  const [len, pos1] = decodeVarint(bytes, offset);
  return [bytes.slice(pos1, pos1 + len), pos1 + len];
}

function encodeTag(fieldNumber: number, wireType: number): Uint8Array {
  return encodeVarint((fieldNumber << 3) | wireType);
}

function decodeTag(bytes: Uint8Array, offset: number): [number, number, number] {
  const [tagValue, pos] = decodeVarint(bytes, offset);
  const fieldNumber = tagValue >>> 3;
  const wireType = tagValue & 0x7;
  return [fieldNumber, wireType, pos];
}

function serializeCapabilities(cap: Capabilities): Uint8Array {
  const chunks: Uint8Array[] = [];

  if (cap.codec) {
    chunks.push(encodeTag(1, 2));
    chunks.push(encodeString(cap.codec));
  }

  if (cap.segmentMs !== undefined && cap.segmentMs > 0) {
    chunks.push(encodeTag(2, 0));
    chunks.push(encodeVarint(cap.segmentMs));
  }

  if (cap.cors !== undefined) {
    chunks.push(encodeTag(3, 0));
    chunks.push(encodeVarint(cap.cors ? 1 : 0));
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function parseCapabilities(bytes: Uint8Array): Capabilities {
  const cap: Capabilities = {};
  let offset = 0;

  while (offset < bytes.length) {
    const [fieldNumber, wireType, pos1] = decodeTag(bytes, offset);
    offset = pos1;

    switch (fieldNumber) {
      case 1:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          cap.codec = val;
          offset = pos2;
        }
        break;
      case 2:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint(bytes, offset);
          cap.segmentMs = val;
          offset = pos2;
        }
        break;
      case 3:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint(bytes, offset);
          cap.cors = val !== 0;
          offset = pos2;
        }
        break;
      default:
        if (wireType === 0) {
          const [, pos2] = decodeVarint(bytes, offset);
          offset = pos2;
        } else if (wireType === 2) {
          const [, pos2] = decodeBytes(bytes, offset);
          offset = pos2;
        }
    }
  }

  return cap;
}

export function buildAccessFrame(init: AccessFrameInit): AccessFrame {
  return {
    id: init.id,
    mode: init.mode ?? AccessMode.UNKNOWN,
    uri: init.uri,
    embed: init.embed,
    openWeb: init.openWeb,
    readiness: init.readiness ?? Readiness.UNKNOWN,
    ttlMs: init.ttlMs,
    capabilities: init.capabilities,
    signature: init.signature,
  };
}

export function encodeAccessFrame(frame: AccessFrame): Uint8Array {
  const chunks: Uint8Array[] = [];

  if (frame.id) {
    chunks.push(encodeTag(1, 2));
    chunks.push(encodeString(frame.id));
  }

  if (frame.mode !== AccessMode.UNKNOWN) {
    chunks.push(encodeTag(2, 0));
    chunks.push(encodeVarint(frame.mode));
  }

  if (frame.uri) {
    chunks.push(encodeTag(3, 2));
    chunks.push(encodeString(frame.uri));
  }

  if (frame.embed) {
    chunks.push(encodeTag(4, 2));
    chunks.push(encodeString(frame.embed));
  }

  if (frame.openWeb) {
    chunks.push(encodeTag(5, 2));
    chunks.push(encodeString(frame.openWeb));
  }

  if (frame.readiness !== Readiness.UNKNOWN) {
    chunks.push(encodeTag(6, 0));
    chunks.push(encodeVarint(frame.readiness));
  }

  if (frame.ttlMs !== undefined && frame.ttlMs > 0) {
    chunks.push(encodeTag(7, 0));
    chunks.push(encodeVarint(frame.ttlMs));
  }

  if (frame.capabilities) {
    const capBytes = serializeCapabilities(frame.capabilities);
    if (capBytes.length > 0) {
      chunks.push(encodeTag(8, 2));
      chunks.push(encodeBytes(capBytes));
    }
  }

  if (frame.signature && frame.signature.length > 0) {
    chunks.push(encodeTag(9, 2));
    chunks.push(encodeBytes(frame.signature));
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

export function decodeAccessFrame(bytes: Uint8Array): AccessFrame {
  const frame: AccessFrame = {
    id: '',
    mode: AccessMode.UNKNOWN,
    readiness: Readiness.UNKNOWN,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const [fieldNumber, wireType, pos1] = decodeTag(bytes, offset);
    offset = pos1;

    switch (fieldNumber) {
      case 1:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          frame.id = val;
          offset = pos2;
        }
        break;
      case 2:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint(bytes, offset);
          frame.mode = val as AccessMode;
          offset = pos2;
        }
        break;
      case 3:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          frame.uri = val;
          offset = pos2;
        }
        break;
      case 4:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          frame.embed = val;
          offset = pos2;
        }
        break;
      case 5:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          frame.openWeb = val;
          offset = pos2;
        }
        break;
      case 6:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint(bytes, offset);
          frame.readiness = val as Readiness;
          offset = pos2;
        }
        break;
      case 7:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint(bytes, offset);
          frame.ttlMs = val;
          offset = pos2;
        }
        break;
      case 8:
        if (wireType === 2) {
          const [capBytes, pos2] = decodeBytes(bytes, offset);
          frame.capabilities = parseCapabilities(capBytes);
          offset = pos2;
        }
        break;
      case 9:
        if (wireType === 2) {
          const [val, pos2] = decodeBytes(bytes, offset);
          frame.signature = val;
          offset = pos2;
        }
        break;
      default:
        if (wireType === 0) {
          const [, pos2] = decodeVarint(bytes, offset);
          offset = pos2;
        } else if (wireType === 2) {
          const [, pos2] = decodeBytes(bytes, offset);
          offset = pos2;
        } else {
          throw new Error(`Unknown wire type: ${wireType}`);
        }
    }
  }

  return frame;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(frame: AccessFrame): string {
  const bytes = encodeAccessFrame(frame);
  let result = '';
  const len = bytes.length;
  
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;

    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 0x03) << 4) | (b2 >> 4)];
    result += i + 1 < len ? BASE64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? BASE64_CHARS[b3 & 0x3f] : '=';
  }

  return result;
}

export function fromBase64(str: string): AccessFrame {
  const cleanStr = str.replace(/[^A-Za-z0-9+/]/g, '');
  const len = cleanStr.length;
  const resultLen = Math.floor(len * 3 / 4) - (str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0);
  const result = new Uint8Array(resultLen);

  let pos = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = BASE64_CHARS.indexOf(cleanStr[i]);
    const c2 = BASE64_CHARS.indexOf(cleanStr[i + 1]);
    const c3 = i + 2 < len ? BASE64_CHARS.indexOf(cleanStr[i + 2]) : 0;
    const c4 = i + 3 < len ? BASE64_CHARS.indexOf(cleanStr[i + 3]) : 0;

    if (pos < resultLen) result[pos++] = (c1 << 2) | (c2 >> 4);
    if (pos < resultLen) result[pos++] = ((c2 & 0x0f) << 4) | (c3 >> 2);
    if (pos < resultLen) result[pos++] = ((c3 & 0x03) << 6) | c4;
  }

  return decodeAccessFrame(result);
}

export function accessModeToString(mode: AccessMode): string {
  switch (mode) {
    case AccessMode.URI: return 'uri';
    case AccessMode.EMBED: return 'embed';
    case AccessMode.OPEN_WEB: return 'openweb';
    default: return 'unknown';
  }
}

export function stringToAccessMode(str: string): AccessMode {
  switch (str.toLowerCase()) {
    case 'uri': return AccessMode.URI;
    case 'embed': return AccessMode.EMBED;
    case 'openweb':
    case 'open_web': return AccessMode.OPEN_WEB;
    default: return AccessMode.UNKNOWN;
  }
}

export function readinessToString(readiness: Readiness): string {
  switch (readiness) {
    case Readiness.PENDING: return 'pending';
    case Readiness.READY: return 'ready';
    case Readiness.DEGRADED: return 'degraded';
    default: return 'unknown';
  }
}

export function stringToReadiness(str: string): Readiness {
  switch (str.toLowerCase()) {
    case 'pending': return Readiness.PENDING;
    case 'ready': return Readiness.READY;
    case 'degraded': return Readiness.DEGRADED;
    default: return Readiness.UNKNOWN;
  }
}

export function estimateAccessFrameSize(frame: AccessFrame): number {
  return encodeAccessFrame(frame).length;
}
