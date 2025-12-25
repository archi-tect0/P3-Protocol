import { sdkReq } from './core';

export type AnchorEvent = {
  appId: string;
  event: string;
  data?: Record<string, unknown>;
  ts?: number;
};

export type SendOptions = {
  anchor?: boolean;
  batchId?: string;
};

export type SendResult = {
  ok: boolean;
  receiptId?: string;
};

export type BatchResult = {
  ok: boolean;
  count: number;
  batchId: string;
};

export async function send(event: AnchorEvent, opts?: SendOptions): Promise<SendResult> {
  const payload = {
    ...event,
    ts: event.ts ?? Date.now(),
    anchor: !!opts?.anchor,
    batchId: opts?.batchId,
  };
  return sdkReq<SendResult>('/api/sdk/anchor', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function batch(events: AnchorEvent[], anchor = true): Promise<BatchResult> {
  return sdkReq<BatchResult>('/api/sdk/anchor/batch', {
    method: 'POST',
    body: JSON.stringify({ events, anchor }),
  });
}

export async function status(receiptId: string): Promise<{ confirmed: boolean; txHash?: string }> {
  return sdkReq<{ confirmed: boolean; txHash?: string }>(`/api/sdk/anchor/status/${receiptId}`, {
    method: 'GET',
  });
}
