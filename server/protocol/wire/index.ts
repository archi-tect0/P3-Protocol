/**
 * Atlas API 2.0 - Binary Wire Protocol
 * 
 * Unified exports for binary frame encoding/decoding.
 * Provides protobuf-style serialization for AccessFrame and ReceiptEvent.
 */

export {
  AccessMode,
  Readiness,
  AccessFrame,
  AccessFrameInit,
  Capabilities,
  buildAccessFrame,
  encodeAccessFrame,
  decodeAccessFrame,
  toBase64 as accessFrameToBase64,
  fromBase64 as accessFrameFromBase64,
  accessModeToString,
  stringToAccessMode,
  readinessToString,
  stringToReadiness,
  estimateAccessFrameSize,
} from './accessFrame';

export {
  Action,
  ReceiptEvent,
  ReceiptEventInit,
  buildReceiptEvent,
  encodeReceiptEvent,
  decodeReceiptEvent,
  toBase64 as receiptEventToBase64,
  fromBase64 as receiptEventFromBase64,
  actionToString,
  stringToAction,
  estimateReceiptEventSize,
} from './receiptEvent';

export {
  AccessMode as AccessModeEnum,
  Readiness as ReadinessEnum,
} from './accessFrame';

export { Action as ActionEnum } from './receiptEvent';

import { AccessFrame, encodeAccessFrame, toBase64 as accessToBase64 } from './accessFrame';
import { ReceiptEvent, encodeReceiptEvent, toBase64 as receiptToBase64 } from './receiptEvent';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function encodeBase64(bytes: Uint8Array): string {
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

export function decodeBase64(str: string): Uint8Array {
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

  return result;
}

export function serializeAccessFrame(frame: AccessFrame): Uint8Array {
  return encodeAccessFrame(frame);
}

export function parseAccessFrame(bytes: Uint8Array): AccessFrame {
  const { decodeAccessFrame } = require('./accessFrame');
  return decodeAccessFrame(bytes);
}

export function deserializeAccessFrame(bytes: Uint8Array): AccessFrame {
  const { decodeAccessFrame } = require('./accessFrame');
  return decodeAccessFrame(bytes);
}

export function serializeReceiptEvent(event: ReceiptEvent): Uint8Array {
  return encodeReceiptEvent(event);
}

export function parseReceiptEvent(bytes: Uint8Array): ReceiptEvent {
  const { decodeReceiptEvent } = require('./receiptEvent');
  return decodeReceiptEvent(bytes);
}

export function deserializeReceiptEvent(bytes: Uint8Array): ReceiptEvent {
  const { decodeReceiptEvent } = require('./receiptEvent');
  return decodeReceiptEvent(bytes);
}

export function encodeAccessFrameForSSE(frame: AccessFrame): string {
  return accessToBase64(frame);
}

export function decodeAccessFrameFromSSE(data: string): AccessFrame {
  const { fromBase64 } = require('./accessFrame');
  return fromBase64(data);
}

export function encodeReceiptEventForSSE(event: ReceiptEvent): string {
  return receiptToBase64(event);
}

export function decodeReceiptEventFromSSE(data: string): ReceiptEvent {
  const { fromBase64 } = require('./receiptEvent');
  return fromBase64(data);
}

export interface WireStats {
  accessFrameBytes: number;
  receiptEventBytes: number;
  totalBytes: number;
}

export function calculateWireSize(frame?: AccessFrame, event?: ReceiptEvent): WireStats {
  const accessFrameBytes = frame ? encodeAccessFrame(frame).length : 0;
  const receiptEventBytes = event ? encodeReceiptEvent(event).length : 0;
  
  return {
    accessFrameBytes,
    receiptEventBytes,
    totalBytes: accessFrameBytes + receiptEventBytes,
  };
}

export function formatSSEEvent(eventType: string, itemId: string, base64Data: string): string {
  return `event: ${eventType}\nid: ${itemId}\ndata: ${base64Data}\n\n`;
}

export function createAccessSSEEvent(frame: AccessFrame): string {
  const base64 = accessToBase64(frame);
  return formatSSEEvent('access', frame.id, base64);
}

export function createReceiptSSEEvent(event: ReceiptEvent): string {
  const base64 = receiptToBase64(event);
  return formatSSEEvent('receipt', event.itemId, base64);
}
