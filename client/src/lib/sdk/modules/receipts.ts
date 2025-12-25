import { sdkReq } from './core';

export type Receipt = {
  id: string;
  type: string;
  hash: string;
  owner: string;
  anchored: boolean;
  txHash?: string;
  blockNumber?: number;
  data?: Record<string, unknown>;
  createdAt: number;
  anchoredAt?: number;
};

export type ProofData = {
  receiptId: string;
  proof: string;
  publicSignals?: string[];
};

export type ReceiptData = {
  type: string;
  hash: string;
  data?: Record<string, unknown>;
};

export type ListReceiptsResult = {
  receipts: Receipt[];
};

export type GetReceiptResult = {
  receipt: Receipt;
};

export type VerifyResult = {
  valid: boolean;
  receipt?: Receipt;
  error?: string;
};

export type AnchorResult = {
  ok: boolean;
  receiptId: string;
  txHash?: string;
};

export async function list(): Promise<ListReceiptsResult> {
  return sdkReq<ListReceiptsResult>('/api/nexus/receipts', {
    method: 'GET',
  });
}

export async function get(id: string): Promise<GetReceiptResult> {
  return sdkReq<GetReceiptResult>(`/api/nexus/receipts/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export async function verify(proofData: ProofData): Promise<VerifyResult> {
  return sdkReq<VerifyResult>('/api/nexus/receipts/verify', {
    method: 'POST',
    body: JSON.stringify(proofData),
  });
}

export async function anchor(receiptData: ReceiptData): Promise<AnchorResult> {
  return sdkReq<AnchorResult>('/api/nexus/receipts/anchor', {
    method: 'POST',
    body: JSON.stringify(receiptData),
  });
}

export type ReceiptsAPI = {
  list: typeof list;
  get: typeof get;
  verify: typeof verify;
  anchor: typeof anchor;
};

export function createReceiptsAPI(): ReceiptsAPI {
  return {
    list,
    get,
    verify,
    anchor,
  };
}
