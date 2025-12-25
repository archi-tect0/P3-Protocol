import { sdkReq } from './core';

export type RolesResult = {
  roles: string[];
};

export type VoteResult = {
  ok: boolean;
  receiptId?: string;
};

export type Proposal = {
  id: string;
  title: string;
  description: string;
  choices: string[];
  startTime: number;
  endTime: number;
  status: 'pending' | 'active' | 'passed' | 'rejected' | 'executed';
};

export async function roles(): Promise<RolesResult> {
  return sdkReq<RolesResult>('/api/sdk/dao/roles', {
    method: 'GET',
  });
}

export async function vote(
  proposalId: string,
  choice: string,
  opts?: { anchor?: boolean }
): Promise<VoteResult> {
  return sdkReq<VoteResult>('/api/sdk/dao/vote', {
    method: 'POST',
    body: JSON.stringify({ proposalId, choice, anchor: !!opts?.anchor }),
  });
}

export async function proposals(opts?: { 
  status?: string; 
  limit?: number 
}): Promise<{ proposals: Proposal[] }> {
  return sdkReq<{ proposals: Proposal[] }>('/api/sdk/dao/proposals', {
    method: 'POST',
    body: JSON.stringify(opts || {}),
  });
}

export async function delegate(to: string): Promise<{ ok: boolean }> {
  return sdkReq<{ ok: boolean }>('/api/sdk/dao/delegate', {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
}
