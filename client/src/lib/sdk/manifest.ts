import { P3Manifest, ManifestSchema } from "./types";
import { getAnchors, getAnchorsSignature } from "./anchors";

export interface PreparedManifest extends P3Manifest {
  protocolAnchors: {
    contract: string;
    chainId: number;
    treasury: string;
    codehash: string;
  };
  protocolProof: {
    signature: string;
    issuedAt: string;
  };
}

export function validateManifest(manifest: unknown): P3Manifest {
  return ManifestSchema.parse(manifest);
}

export function prepareManifest(manifest: P3Manifest, proofSignature?: string): PreparedManifest {
  const anchors = getAnchors();
  const sig = proofSignature || getAnchorsSignature();
  
  return {
    ...manifest,
    protocolAnchors: {
      contract: anchors.contract,
      chainId: anchors.chainId,
      treasury: anchors.treasury,
      codehash: anchors.codehash
    },
    protocolProof: {
      signature: sig,
      issuedAt: new Date().toISOString()
    }
  };
}

export function createManifest(options: {
  name: string;
  description: string;
  version?: string;
  permissions?: string[];
  bridge?: boolean;
  dao?: boolean;
  compliance?: 'standard' | 'enterprise' | 'regulated';
}): P3Manifest {
  return {
    name: options.name,
    description: options.description,
    version: options.version || '1.0.0',
    protocol: {
      bridge: options.bridge ?? true,
      permissions: (options.permissions || ['wallet']) as any,
      anchorsRequired: true
    },
    governance: {
      dao: options.dao ?? false,
      compliance: options.compliance
    }
  };
}

export async function submitManifest(manifest: PreparedManifest, bundleUrl: string): Promise<{ tileId: string; status: string }> {
  try {
    const response = await fetch('/api/registry/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manifest, bundleUrl })
    });
    if (response.ok) {
      return response.json();
    }
  } catch (e) {
    console.warn('[P3 SDK] Manifest submission failed:', e);
  }
  return { tileId: `local-${Date.now()}`, status: 'pending' };
}
