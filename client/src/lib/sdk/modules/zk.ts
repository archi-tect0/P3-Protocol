import { sdkReq } from './core';

export type CircuitType = 'MessageReceipt' | 'MeetingReceipt' | 'PaymentReceipt' | 'ConsentState';

export interface ProofResult {
  ok: boolean;
  circuit: CircuitType;
  proof: unknown;
  publicSignals: string[];
  generatedAt: number;
}

export interface VerifyResult {
  ok: boolean;
  valid: boolean;
  circuit: string;
  verifiedAt: number;
}

export interface CircuitInfo {
  id: CircuitType;
  description: string;
  inputs: string[];
}

export interface ZKStatus {
  ok: boolean;
  ready: boolean;
  queueLength?: number;
  metrics?: {
    totalProofs: number;
    successfulProofs: number;
    failedProofs: number;
    avgProofTime: number;
  };
  error?: string;
}

export async function prove(circuit: CircuitType, inputs: Record<string, unknown>): Promise<ProofResult> {
  return sdkReq<ProofResult>('/api/sdk/zk/prove', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circuit, inputs }),
  });
}

export async function verify(circuit: string, proof: unknown, publicSignals: string[]): Promise<VerifyResult> {
  return sdkReq<VerifyResult>('/api/sdk/zk/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ circuit, proof, publicSignals }),
  });
}

export async function getCircuits(): Promise<{ circuits: CircuitInfo[]; version: string }> {
  return sdkReq<{ circuits: CircuitInfo[]; version: string }>('/api/sdk/zk/circuits');
}

export async function getStatus(): Promise<ZKStatus> {
  return sdkReq<ZKStatus>('/api/sdk/zk/status');
}
