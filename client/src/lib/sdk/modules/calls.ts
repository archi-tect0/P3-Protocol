import { sdkReq } from './core';

export type CallType = 'voice' | 'video';

export type Call = {
  id: string;
  type: CallType;
  initiator: string;
  target: string;
  status: 'pending' | 'active' | 'ended';
  startedAt?: number;
  endedAt?: number;
};

export type StartCallResult = {
  ok: boolean;
  callId: string;
  offer?: string;
};

export type SignalResult = {
  ok: boolean;
};

export type EndCallResult = {
  ok: boolean;
  duration?: number;
};

export type ActiveCallsResult = {
  calls: Call[];
};

export async function start(type: CallType, targetWallet: string): Promise<StartCallResult> {
  return sdkReq<StartCallResult>('/api/nexus/calls/start', {
    method: 'POST',
    body: JSON.stringify({ type, targetWallet }),
  });
}

export async function signal(callId: string, signalData: unknown): Promise<SignalResult> {
  return sdkReq<SignalResult>('/api/nexus/calls/signal', {
    method: 'POST',
    body: JSON.stringify({ callId, signal: signalData }),
  });
}

export async function end(callId: string): Promise<EndCallResult> {
  return sdkReq<EndCallResult>('/api/nexus/calls/end', {
    method: 'POST',
    body: JSON.stringify({ callId }),
  });
}

export async function getActive(): Promise<ActiveCallsResult> {
  return sdkReq<ActiveCallsResult>('/api/nexus/calls/active', {
    method: 'GET',
  });
}

export type CallsAPI = {
  start: typeof start;
  signal: typeof signal;
  end: typeof end;
  getActive: typeof getActive;
};

export function createCallsAPI(): CallsAPI {
  return {
    start,
    signal,
    end,
    getActive,
  };
}
