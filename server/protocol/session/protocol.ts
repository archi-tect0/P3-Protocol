/**
 * Atlas API 2.0 - Protocol Contracts
 * 
 * Defines the 8-lane architecture with msgpack-default encoding
 * and HTTP/3 dual-stack transport support.
 */

export enum LaneId {
  ACCESS = 1,
  MANIFESTS = 2,
  RECEIPTS = 3,
  MEDIA = 4,
  COMMERCE = 5,
  GOVERNANCE = 6,
  NOTIFICATIONS = 7,
  CHAT = 8,
}

export type Encoding = 'protobuf' | 'msgpack' | 'json';
export type Transport = 'http3' | 'http1';

export interface LaneSpec {
  id: LaneId;
  name: string;
  defaultEncoding: Encoding;
  allowFallback: boolean;
  persistentState: boolean;
  priority: number;
}

export const LaneRegistry: Record<LaneId, LaneSpec> = {
  [LaneId.ACCESS]: {
    id: LaneId.ACCESS,
    name: 'access',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 100,
  },
  [LaneId.MANIFESTS]: {
    id: LaneId.MANIFESTS,
    name: 'manifests',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 90,
  },
  [LaneId.RECEIPTS]: {
    id: LaneId.RECEIPTS,
    name: 'receipts',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 80,
  },
  [LaneId.MEDIA]: {
    id: LaneId.MEDIA,
    name: 'media',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 95,
  },
  [LaneId.COMMERCE]: {
    id: LaneId.COMMERCE,
    name: 'commerce',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 85,
  },
  [LaneId.GOVERNANCE]: {
    id: LaneId.GOVERNANCE,
    name: 'governance',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 70,
  },
  [LaneId.NOTIFICATIONS]: {
    id: LaneId.NOTIFICATIONS,
    name: 'notifications',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 75,
  },
  [LaneId.CHAT]: {
    id: LaneId.CHAT,
    name: 'chat',
    defaultEncoding: 'msgpack',
    allowFallback: true,
    persistentState: true,
    priority: 85,
  },
};

export const ALL_LANE_IDS = Object.values(LaneId).filter(
  (v) => typeof v === 'number'
) as LaneId[];

export const LANE_NAMES = Object.fromEntries(
  ALL_LANE_IDS.map((id) => [id, LaneRegistry[id].name])
) as Record<LaneId, string>;

export function getLaneByName(name: string): LaneSpec | undefined {
  return Object.values(LaneRegistry).find((spec) => spec.name === name);
}

export function getLaneById(id: LaneId): LaneSpec {
  return LaneRegistry[id];
}

export interface ClientCapabilities {
  transports: Transport[];
  encodings: Encoding[];
  lanes?: LaneId[];
  dictionaryTokens?: string[];
}

export interface HandshakeRequestV2 {
  clientId: string;
  wallet?: string;
  capabilities: ClientCapabilities;
  deviceInfo?: {
    platform?: string;
    version?: string;
    screen?: { width: number; height: number; dpr?: number };
  };
}

export interface LaneConfig {
  id: LaneId;
  name: string;
  encoding: Encoding;
  url: string;
}

export interface HandshakeResponseV2 {
  sessionId: string;
  transport: Transport;
  lanes: LaneConfig[];
  dictionary: {
    version: string;
    tokens: string[];
    indexMap: Record<string, number>;
  };
  serverTime: number;
  ttlSeconds: number;
  protocol: {
    version: string;
    features: string[];
  };
}

export const PROTOCOL_VERSION = '2.0.0';
export const PROTOCOL_FEATURES = [
  '8-lane-architecture',
  'msgpack-default',
  'protobuf-optional',
  'http3-architecture',
  'dictionary-negotiation',
  'sse-multiplexing',
];

const HTTP3_AVAILABLE = false;

export function negotiateTransport(supported: Transport[]): Transport {
  if (HTTP3_AVAILABLE && supported.includes('http3')) {
    return 'http3';
  }
  return 'http1';
}

export function negotiateEncoding(
  supported: Encoding[],
  laneSpec: LaneSpec
): Encoding {
  if (supported.includes(laneSpec.defaultEncoding)) {
    return laneSpec.defaultEncoding;
  }
  if (laneSpec.allowFallback) {
    if (supported.includes('msgpack')) return 'msgpack';
    if (supported.includes('json')) return 'json';
  }
  return laneSpec.defaultEncoding;
}

export function getDefaultLanes(): LaneId[] {
  return [LaneId.ACCESS, LaneId.MANIFESTS, LaneId.RECEIPTS];
}
