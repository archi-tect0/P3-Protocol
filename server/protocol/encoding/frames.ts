/**
 * Atlas Protocol - Binary Frame Envelope
 * 
 * Wraps encoded payloads with header metadata for SSE transport.
 * Supports protobuf, msgpack, and json encoding modes.
 */

import { encode as msgpackEncode } from '@msgpack/msgpack';
import { 
  encodeCatalogBatch, 
  toCompactItem, 
  encodeVarint, 
  encodeString,
  type CompactCatalogItem 
} from './protobuf';
import { 
  createBaseDictionary, 
  getDictionarySeed, 
  tokenize,
  type TokenDictionary 
} from './dictionary';

export type FrameType = 'manifest' | 'access' | 'catalog' | 'heartbeat' | 'error';
export type EncodingType = 'protobuf' | 'msgpack' | 'json';

export interface FrameEnvelope {
  frameType: FrameType;
  encoding: EncodingType;
  dictionaryVersion: number;
  timestamp: number;
  payloadBase64: string;
  payloadSize: number;
  itemCount?: number;
}

export interface FrameStats {
  originalSize: number;
  encodedSize: number;
  reduction: number;
  encoding: EncodingType;
}

/**
 * Encode catalog items to binary with dictionary tokenization
 */
export function encodeCatalogFrame(
  items: any[],
  dictionary: TokenDictionary,
  encoding: EncodingType = 'protobuf'
): { envelope: FrameEnvelope; stats: FrameStats } {
  const originalJson = JSON.stringify(items);
  const originalSize = Buffer.from(originalJson).length;
  
  let payloadBuffer: Uint8Array;
  
  if (encoding === 'protobuf') {
    // Convert to compact items with tokenization
    const compactItems: CompactCatalogItem[] = items.map(item => 
      toCompactItem(item, (s: string) => {
        const token = tokenize(dictionary, s);
        return typeof token === 'number' ? token : 0;
      })
    );
    payloadBuffer = encodeCatalogBatch(compactItems);
  } else if (encoding === 'msgpack') {
    // Tokenize then msgpack
    const tokenizedItems = items.map(item => ({
      id: item.id,
      t: item.title || item.name,
      c: tokenize(dictionary, item.category || 'unknown'),
      ct: tokenize(dictionary, item.contentType || 'free'),
      p: item.provider ? tokenize(dictionary, item.provider) : undefined,
      pr: item.price ? Math.round(item.price * 100) : undefined,
      th: item.thumbnail || item.posterUrl,
    }));
    payloadBuffer = msgpackEncode(tokenizedItems) as Uint8Array;
  } else {
    // JSON fallback
    payloadBuffer = Buffer.from(originalJson);
  }
  
  const payloadBase64 = Buffer.from(payloadBuffer).toString('base64');
  const encodedSize = payloadBuffer.length;
  
  const envelope: FrameEnvelope = {
    frameType: 'catalog',
    encoding,
    dictionaryVersion: dictionary.version,
    timestamp: Date.now(),
    payloadBase64,
    payloadSize: encodedSize,
    itemCount: items.length,
  };
  
  const stats: FrameStats = {
    originalSize,
    encodedSize,
    reduction: Math.round((1 - encodedSize / originalSize) * 100),
    encoding,
  };
  
  return { envelope, stats };
}

/**
 * Encode a single manifest to protobuf binary frame
 * Field IDs: 1=id, 2=kind, 3=url, 4=expiresAt
 */
function encodeManifestProtobuf(manifest: any, dictionary: TokenDictionary): Uint8Array {
  const chunks: Uint8Array[] = [];
  
  // Field 1: id (string)
  const id = manifest.itemId || manifest.id || '';
  chunks.push(new Uint8Array([0x0a])); // field 1, wire type 2
  chunks.push(encodeString(id));
  
  // Field 2: kind (tokenized varint)
  const kindToken = tokenize(dictionary, manifest.kind || 'unknown');
  const kindValue = typeof kindToken === 'number' ? kindToken : 0;
  chunks.push(new Uint8Array([0x10])); // field 2, wire type 0
  chunks.push(encodeVarint(kindValue));
  
  // Field 3: url (string)
  if (manifest.url) {
    chunks.push(new Uint8Array([0x1a])); // field 3, wire type 2
    chunks.push(encodeString(manifest.url));
  }
  
  // Field 4: expiresAt (varint timestamp)
  if (manifest.expiresAt) {
    chunks.push(new Uint8Array([0x20])); // field 4, wire type 0
    chunks.push(encodeVarint(Math.floor(manifest.expiresAt / 1000))); // seconds
  }
  
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function encodeManifestFrame(
  manifest: any,
  dictionary: TokenDictionary,
  encoding: EncodingType = 'protobuf'
): FrameEnvelope {
  let payloadBuffer: Uint8Array;
  
  if (encoding === 'protobuf') {
    payloadBuffer = encodeManifestProtobuf(manifest, dictionary);
  } else if (encoding === 'msgpack') {
    const tokenizedManifest = {
      id: manifest.itemId || manifest.id,
      k: tokenize(dictionary, manifest.kind || 'unknown'),
      u: manifest.url,
      exp: manifest.expiresAt,
    };
    payloadBuffer = msgpackEncode(tokenizedManifest) as Uint8Array;
  } else {
    payloadBuffer = Buffer.from(JSON.stringify(manifest));
  }
  
  return {
    frameType: 'manifest',
    encoding,
    dictionaryVersion: dictionary.version,
    timestamp: Date.now(),
    payloadBase64: Buffer.from(payloadBuffer).toString('base64'),
    payloadSize: payloadBuffer.length,
  };
}

/**
 * Encode access frame to protobuf binary
 * Field IDs: 1=id, 2=keyId, 3=encryptedKey, 4=algorithm, 5=expiresAt, 6=permissions
 */
function encodeAccessProtobuf(access: any, dictionary: TokenDictionary): Uint8Array {
  const chunks: Uint8Array[] = [];
  
  // Field 1: id (string)
  const id = access.itemId || access.id || '';
  chunks.push(new Uint8Array([0x0a])); // field 1, wire type 2
  chunks.push(encodeString(id));
  
  // Field 2: keyId (string)
  if (access.keyId) {
    chunks.push(new Uint8Array([0x12])); // field 2, wire type 2
    chunks.push(encodeString(access.keyId));
  }
  
  // Field 3: encryptedKey (string/bytes)
  if (access.encryptedKey) {
    chunks.push(new Uint8Array([0x1a])); // field 3, wire type 2
    chunks.push(encodeString(access.encryptedKey));
  }
  
  // Field 4: algorithm (tokenized varint)
  if (access.algorithm) {
    const algToken = tokenize(dictionary, access.algorithm);
    const algValue = typeof algToken === 'number' ? algToken : 0;
    chunks.push(new Uint8Array([0x20])); // field 4, wire type 0
    chunks.push(encodeVarint(algValue));
  }
  
  // Field 5: expiresAt (varint timestamp)
  if (access.expiresAt) {
    chunks.push(new Uint8Array([0x28])); // field 5, wire type 0
    chunks.push(encodeVarint(Math.floor(access.expiresAt / 1000)));
  }
  
  // Field 6: permissions (repeated string, each as length-delimited)
  if (access.permissions && Array.isArray(access.permissions)) {
    for (const perm of access.permissions) {
      chunks.push(new Uint8Array([0x32])); // field 6, wire type 2 (length-delimited)
      chunks.push(encodeString(String(perm)));
    }
  }
  
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export function encodeAccessFrame(
  access: any,
  dictionary: TokenDictionary,
  encoding: EncodingType = 'protobuf'
): FrameEnvelope {
  let payloadBuffer: Uint8Array;
  
  if (encoding === 'protobuf') {
    payloadBuffer = encodeAccessProtobuf(access, dictionary);
  } else if (encoding === 'msgpack') {
    const tokenizedAccess = {
      id: access.itemId || access.id,
      k: access.keyId,
      ek: access.encryptedKey,
      alg: access.algorithm,
      exp: access.expiresAt,
      perm: access.permissions,
    };
    payloadBuffer = msgpackEncode(tokenizedAccess) as Uint8Array;
  } else {
    payloadBuffer = Buffer.from(JSON.stringify(access));
  }
  
  return {
    frameType: 'access',
    encoding,
    dictionaryVersion: dictionary.version,
    timestamp: Date.now(),
    payloadBase64: Buffer.from(payloadBuffer).toString('base64'),
    payloadSize: payloadBuffer.length,
  };
}

/**
 * Create SSE event string from frame envelope
 */
export function frameToSSE(envelope: FrameEnvelope, eventId: string | number): string {
  return [
    `event: ${envelope.frameType}`,
    `id: ${eventId}`,
    `data: ${JSON.stringify(envelope)}`,
    '',
    ''
  ].join('\n');
}

/**
 * Decode frame envelope payload (for client-side or testing)
 */
export function decodeFramePayload(envelope: FrameEnvelope): Uint8Array {
  return Buffer.from(envelope.payloadBase64, 'base64');
}
