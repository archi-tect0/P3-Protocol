import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ConnectorManifest {
  id: string;
  title: string;
  icon: string;
  oauth: {
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    redirectUri: string;
  };
  verbs: Array<{
    intent: string;
    endpoint: string;
    visual: string;
  }>;
  consent: {
    anchorWrites: boolean;
    anchorReads: boolean;
  };
  renderHints?: Record<string, any>;
}

export interface ConnectorReceipt {
  id: string;
  hash: string;
  scope: string;
  connectorId: string;
  timestamp: number;
  anchored: boolean;
}

const connectorManifests: ConnectorManifest[] = (() => {
  try {
    const filePath = path.join(__dirname, '../data/connectors.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
})();

const connectorReceipts: ConnectorReceipt[] = [];

export function getAllConnectorManifests(): ConnectorManifest[] {
  return connectorManifests;
}

export function getConnectorManifest(id: string): ConnectorManifest | undefined {
  return connectorManifests.find(m => m.id === id);
}

export function buildOAuthUrl(connectorId: string, state: string): string | null {
  const manifest = getConnectorManifest(connectorId);
  if (!manifest) return null;
  
  const params = new URLSearchParams({
    response_type: 'code',
    scope: manifest.oauth.scopes.join(' '),
    redirect_uri: manifest.oauth.redirectUri,
    state,
  });
  
  return `${manifest.oauth.authUrl}?${params.toString()}`;
}

export function emitConnectorReceipt(
  connectorId: string, 
  scope: string, 
  payload: any
): ConnectorReceipt {
  const id = crypto.randomUUID();
  const hash = '0x' + crypto.createHash('sha256')
    .update(JSON.stringify({ connectorId, scope, payload, timestamp: Date.now() }))
    .digest('hex');
  
  const receipt: ConnectorReceipt = {
    id,
    hash,
    scope,
    connectorId,
    timestamp: Date.now(),
    anchored: false
  };
  
  connectorReceipts.unshift(receipt);
  if (connectorReceipts.length > 100) {
    connectorReceipts.pop();
  }
  
  return receipt;
}

export function getRecentConnectorReceipts(limit = 20): ConnectorReceipt[] {
  return connectorReceipts.slice(0, limit);
}

export function getConnectorReceipts(connectorId: string, limit = 20): ConnectorReceipt[] {
  return connectorReceipts
    .filter(r => r.connectorId === connectorId)
    .slice(0, limit);
}
