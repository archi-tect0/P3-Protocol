/**
 * Atlas API 2.0 - Binary Receipt Event
 * 
 * Protobuf-style binary encoding for ReceiptEvent with SSE transport support.
 * Optimized for hot paths with minimal allocations.
 */

export enum Action {
  UNKNOWN = 0,
  PLAY = 1,
  READ = 2,
  WATCH = 3,
  BUY = 4,
  LISTEN = 5,
  VOTE = 6,
  BROWSE = 7,
}

export interface ReceiptEvent {
  sessionId: string;
  itemId: string;
  action: Action;
  ts: number;
  clientSig?: Uint8Array;
  meta?: Record<string, string>;
}

export type ReceiptEventInit = Partial<ReceiptEvent> & { sessionId: string; itemId: string };

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

function encodeVarint64(value: bigint | number): Uint8Array {
  const bytes: number[] = [];
  let v = BigInt(value);
  const MASK = BigInt(0x7f);
  const SEVEN = BigInt(7);
  while (v > MASK) {
    bytes.push(Number(v & MASK) | 0x80);
    v >>= SEVEN;
  }
  bytes.push(Number(v));
  return new Uint8Array(bytes);
}

function decodeVarint64(bytes: Uint8Array, offset: number): [bigint, number] {
  let result = BigInt(0);
  let shift = BigInt(0);
  let pos = offset;
  const SEVEN = BigInt(7);
  const MAX_SHIFT = BigInt(63);
  
  while (pos < bytes.length) {
    const byte = bytes[pos];
    result |= BigInt(byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) {
      return [result, pos];
    }
    shift += SEVEN;
    if (shift > MAX_SHIFT) {
      throw new Error('Varint64 too long');
    }
  }
  throw new Error('Unexpected end of varint64');
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

function serializeMapEntry(key: string, value: string): Uint8Array {
  const chunks: Uint8Array[] = [];
  
  chunks.push(encodeTag(1, 2));
  chunks.push(encodeString(key));
  
  chunks.push(encodeTag(2, 2));
  chunks.push(encodeString(value));

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

function parseMapEntry(bytes: Uint8Array): [string, string] {
  let key = '';
  let value = '';
  let offset = 0;

  while (offset < bytes.length) {
    const [fieldNumber, wireType, pos1] = decodeTag(bytes, offset);
    offset = pos1;

    if (fieldNumber === 1 && wireType === 2) {
      const [val, pos2] = decodeString(bytes, offset);
      key = val;
      offset = pos2;
    } else if (fieldNumber === 2 && wireType === 2) {
      const [val, pos2] = decodeString(bytes, offset);
      value = val;
      offset = pos2;
    } else {
      if (wireType === 0) {
        const [, pos2] = decodeVarint(bytes, offset);
        offset = pos2;
      } else if (wireType === 2) {
        const [, pos2] = decodeBytes(bytes, offset);
        offset = pos2;
      }
    }
  }

  return [key, value];
}

export function buildReceiptEvent(init: ReceiptEventInit): ReceiptEvent {
  return {
    sessionId: init.sessionId,
    itemId: init.itemId,
    action: init.action ?? Action.UNKNOWN,
    ts: init.ts ?? Date.now(),
    clientSig: init.clientSig,
    meta: init.meta,
  };
}

export function encodeReceiptEvent(event: ReceiptEvent): Uint8Array {
  const chunks: Uint8Array[] = [];

  if (event.sessionId) {
    chunks.push(encodeTag(1, 2));
    chunks.push(encodeString(event.sessionId));
  }

  if (event.itemId) {
    chunks.push(encodeTag(2, 2));
    chunks.push(encodeString(event.itemId));
  }

  if (event.action !== Action.UNKNOWN) {
    chunks.push(encodeTag(3, 0));
    chunks.push(encodeVarint(event.action));
  }

  if (event.ts > 0) {
    chunks.push(encodeTag(4, 0));
    chunks.push(encodeVarint64(event.ts));
  }

  if (event.clientSig && event.clientSig.length > 0) {
    chunks.push(encodeTag(5, 2));
    chunks.push(encodeBytes(event.clientSig));
  }

  if (event.meta) {
    for (const [key, value] of Object.entries(event.meta)) {
      const mapEntryBytes = serializeMapEntry(key, value);
      chunks.push(encodeTag(6, 2));
      chunks.push(encodeBytes(mapEntryBytes));
    }
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

export function decodeReceiptEvent(bytes: Uint8Array): ReceiptEvent {
  const event: ReceiptEvent = {
    sessionId: '',
    itemId: '',
    action: Action.UNKNOWN,
    ts: 0,
  };

  let offset = 0;
  while (offset < bytes.length) {
    const [fieldNumber, wireType, pos1] = decodeTag(bytes, offset);
    offset = pos1;

    switch (fieldNumber) {
      case 1:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          event.sessionId = val;
          offset = pos2;
        }
        break;
      case 2:
        if (wireType === 2) {
          const [val, pos2] = decodeString(bytes, offset);
          event.itemId = val;
          offset = pos2;
        }
        break;
      case 3:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint(bytes, offset);
          event.action = val as Action;
          offset = pos2;
        }
        break;
      case 4:
        if (wireType === 0) {
          const [val, pos2] = decodeVarint64(bytes, offset);
          event.ts = Number(val);
          offset = pos2;
        }
        break;
      case 5:
        if (wireType === 2) {
          const [val, pos2] = decodeBytes(bytes, offset);
          event.clientSig = val;
          offset = pos2;
        }
        break;
      case 6:
        if (wireType === 2) {
          const [entryBytes, pos2] = decodeBytes(bytes, offset);
          const [key, value] = parseMapEntry(entryBytes);
          if (!event.meta) {
            event.meta = {};
          }
          event.meta[key] = value;
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

  return event;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(event: ReceiptEvent): string {
  const bytes = encodeReceiptEvent(event);
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

export function fromBase64(str: string): ReceiptEvent {
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

  return decodeReceiptEvent(result);
}

export function actionToString(action: Action): string {
  switch (action) {
    case Action.PLAY: return 'play';
    case Action.READ: return 'read';
    case Action.WATCH: return 'watch';
    case Action.BUY: return 'buy';
    case Action.LISTEN: return 'listen';
    case Action.VOTE: return 'vote';
    case Action.BROWSE: return 'browse';
    default: return 'unknown';
  }
}

export function stringToAction(str: string): Action {
  switch (str.toLowerCase()) {
    case 'play': return Action.PLAY;
    case 'read': return Action.READ;
    case 'watch': return Action.WATCH;
    case 'buy': return Action.BUY;
    case 'listen': return Action.LISTEN;
    case 'vote': return Action.VOTE;
    case 'browse': return Action.BROWSE;
    default: return Action.UNKNOWN;
  }
}

export function estimateReceiptEventSize(event: ReceiptEvent): number {
  return encodeReceiptEvent(event).length;
}
