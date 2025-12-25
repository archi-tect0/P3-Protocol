import { sdkReq, getAppId } from './core';

export type TicketInfo = {
  hasAccess: boolean;
  wallet: string;
  appId: string;
  scopes: string[];
  expiresAt?: number;
  gateType?: string;
};

export type GrantResult = {
  ok: boolean;
  wallet: string;
  appId: string;
  scopes: string[];
  expiresAt?: number;
};

export type TicketListItem = {
  appId: string;
  scopes: string[];
  grantedAt: number;
  expiresAt: number;
  gateType?: string;
};

export async function check(
  wallet: string,
  scopes: string[] = []
): Promise<TicketInfo> {
  const appId = getAppId();
  return sdkReq<TicketInfo>('/api/sdk/ticket/check', {
    method: 'POST',
    body: JSON.stringify({ wallet, appId, scopes }),
  });
}

export async function grant(params: {
  wallet: string;
  scopes?: string[];
  gateType?: string;
  txHash?: string;
  feeAmount?: string;
  devWallet?: string;
}): Promise<GrantResult> {
  const appId = getAppId();
  return sdkReq<GrantResult>('/api/sdk/ticket/grant', {
    method: 'POST',
    body: JSON.stringify({ ...params, appId }),
  });
}

export async function revoke(wallet: string): Promise<{ ok: boolean }> {
  const appId = getAppId();
  return sdkReq<{ ok: boolean }>('/api/sdk/ticket/revoke', {
    method: 'POST',
    body: JSON.stringify({ wallet, appId }),
  });
}

export async function list(wallet: string): Promise<{
  wallet: string;
  tickets: TicketListItem[];
}> {
  return sdkReq<{ wallet: string; tickets: TicketListItem[] }>(
    `/api/sdk/ticket/list/${wallet}`,
    { method: 'GET' }
  );
}

export function buildGateUrl(params: {
  appId: string;
  scopes: string[];
  returnTo: string;
  reason?: string;
}): string {
  const query = new URLSearchParams({
    appId: params.appId,
    scopes: params.scopes.join(','),
    returnTo: params.returnTo,
    reason: params.reason || 'no_ticket',
  });
  return `/ticket?${query.toString()}`;
}
