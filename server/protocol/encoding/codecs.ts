/**
 * Atlas API 2.0 - Codec System
 * 
 * Protobuf-first encoding with MessagePack fallback.
 * Supports dictionary tokenization for payload compression.
 */

import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';
import { TokenDictionary, tokenize, detokenize } from './dictionary';

export type EncodingType = 'protobuf' | 'msgpack' | 'json';

export interface Codec<T = unknown> {
  name: EncodingType;
  encode(data: T, dictionary?: TokenDictionary): Uint8Array;
  decode(buf: Uint8Array, dictionary?: TokenDictionary): T;
}

export class MsgPackCodec<T = unknown> implements Codec<T> {
  name: EncodingType = 'msgpack';
  
  encode(data: T, dictionary?: TokenDictionary): Uint8Array {
    if (dictionary) {
      const tokenized = this.tokenizeObject(data, dictionary);
      return msgpackEncode(tokenized) as Uint8Array;
    }
    return msgpackEncode(data) as Uint8Array;
  }
  
  decode(buf: Uint8Array, dictionary?: TokenDictionary): T {
    const decoded = msgpackDecode(buf);
    if (dictionary) {
      return this.detokenizeObject(decoded, dictionary) as T;
    }
    return decoded as T;
  }

  private tokenizeObject(obj: unknown, dictionary: TokenDictionary): unknown {
    if (typeof obj === 'string') {
      const token = tokenize(dictionary, obj);
      return typeof token === 'number' ? token : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.tokenizeObject(item, dictionary));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const tokenizedKey = tokenize(dictionary, key);
        const newKey = typeof tokenizedKey === 'number' ? `$${tokenizedKey}` : key;
        result[newKey] = this.tokenizeObject(value, dictionary);
      }
      return result;
    }
    return obj;
  }

  private detokenizeObject(obj: unknown, dictionary: TokenDictionary): unknown {
    if (typeof obj === 'number' && obj < 256) {
      const detokenized = detokenize(dictionary, obj);
      return detokenized || obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.detokenizeObject(item, dictionary));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        let newKey = key;
        if (key.startsWith('$')) {
          const tokenId = parseInt(key.slice(1), 10);
          const detokenized = detokenize(dictionary, tokenId);
          if (detokenized) newKey = detokenized;
        }
        result[newKey] = this.detokenizeObject(value, dictionary);
      }
      return result;
    }
    return obj;
  }
}

export class JsonCodec<T = unknown> implements Codec<T> {
  name: EncodingType = 'json';
  
  encode(data: T): Uint8Array {
    return Buffer.from(JSON.stringify(data));
  }
  
  decode(buf: Uint8Array): T {
    return JSON.parse(Buffer.from(buf).toString('utf-8')) as T;
  }
}

export class ProtobufCodec<T = unknown> implements Codec<T> {
  name: EncodingType = 'protobuf';
  
  encode(data: T, dictionary?: TokenDictionary): Uint8Array {
    const fields = this.objectToFields(data, dictionary);
    return this.encodeFields(fields);
  }
  
  decode(buf: Uint8Array, dictionary?: TokenDictionary): T {
    const fields = this.decodeFields(buf);
    return this.fieldsToObject(fields, dictionary) as T;
  }

  private objectToFields(obj: unknown, dictionary?: TokenDictionary): Map<number, { type: number; value: unknown }> {
    const fields = new Map<number, { type: number; value: unknown }>();
    if (!obj || typeof obj !== 'object') return fields;

    let fieldId = 1;
    for (const [key, value] of Object.entries(obj)) {
      let processedValue = value;
      
      if (dictionary && typeof value === 'string') {
        const token = tokenize(dictionary, value);
        if (typeof token === 'number') {
          fields.set(fieldId, { type: 0, value: token });
          fieldId++;
          continue;
        }
      }

      if (typeof value === 'number') {
        fields.set(fieldId, { type: 0, value });
      } else if (typeof value === 'string') {
        fields.set(fieldId, { type: 2, value });
      } else if (typeof value === 'boolean') {
        fields.set(fieldId, { type: 0, value: value ? 1 : 0 });
      } else if (value instanceof Uint8Array) {
        fields.set(fieldId, { type: 2, value });
      }
      fieldId++;
    }
    return fields;
  }

  private encodeFields(fields: Map<number, { type: number; value: unknown }>): Uint8Array {
    const chunks: Uint8Array[] = [];
    
    for (const [fieldId, field] of fields) {
      const wireType = field.type;
      const tag = (fieldId << 3) | wireType;
      chunks.push(this.encodeVarint(tag));
      
      if (wireType === 0) {
        chunks.push(this.encodeVarint(field.value as number));
      } else if (wireType === 2) {
        const data = typeof field.value === 'string' 
          ? Buffer.from(field.value) 
          : field.value as Uint8Array;
        chunks.push(this.encodeVarint(data.length));
        chunks.push(data);
      }
    }
    
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  private decodeFields(buf: Uint8Array): Map<number, unknown> {
    const fields = new Map<number, unknown>();
    let offset = 0;
    
    while (offset < buf.length) {
      const { value: tag, bytesRead: tagBytes } = this.decodeVarint(buf, offset);
      offset += tagBytes;
      
      const fieldId = tag >> 3;
      const wireType = tag & 0x7;
      
      if (wireType === 0) {
        const { value, bytesRead } = this.decodeVarint(buf, offset);
        offset += bytesRead;
        fields.set(fieldId, value);
      } else if (wireType === 2) {
        const { value: length, bytesRead: lenBytes } = this.decodeVarint(buf, offset);
        offset += lenBytes;
        fields.set(fieldId, buf.slice(offset, offset + length));
        offset += length;
      }
    }
    return fields;
  }

  private fieldsToObject(fields: Map<number, unknown>, dictionary?: TokenDictionary): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [fieldId, value] of fields) {
      if (value instanceof Uint8Array) {
        result[`field${fieldId}`] = Buffer.from(value).toString('utf-8');
      } else if (typeof value === 'number' && dictionary) {
        const detokenized = detokenize(dictionary, value);
        result[`field${fieldId}`] = detokenized || value;
      } else {
        result[`field${fieldId}`] = value;
      }
    }
    return result;
  }

  private encodeVarint(value: number): Uint8Array {
    const bytes: number[] = [];
    let v = value >>> 0;
    while (v > 127) {
      bytes.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    bytes.push(v);
    return new Uint8Array(bytes);
  }

  private decodeVarint(buf: Uint8Array, offset: number): { value: number; bytesRead: number } {
    let value = 0;
    let shift = 0;
    let bytesRead = 0;
    
    while (offset + bytesRead < buf.length) {
      const byte = buf[offset + bytesRead];
      value |= (byte & 0x7f) << shift;
      bytesRead++;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    
    return { value: value >>> 0, bytesRead };
  }
}

const msgpackCodec = new MsgPackCodec();
const jsonCodec = new JsonCodec();
const protobufCodec = new ProtobufCodec();

export function getCodec<T = unknown>(encoding: EncodingType): Codec<T> {
  switch (encoding) {
    case 'protobuf':
      return protobufCodec as Codec<T>;
    case 'msgpack':
      return msgpackCodec as Codec<T>;
    case 'json':
    default:
      return jsonCodec as Codec<T>;
  }
}

export function negotiateCodec(clientSupported: EncodingType[]): EncodingType {
  if (clientSupported.includes('msgpack')) return 'msgpack';
  if (clientSupported.includes('protobuf')) return 'protobuf';
  return 'json';
}

