import { sdkFlags } from '../sdk/config/flags';

const TTL_SECONDS = parseInt(process.env.TICKET_EXPIRY || '604800', 10);

type TicketData = {
  wallet: string;
  appId: string;
  scopes: string[];
  grantedAt: number;
  expiresAt: number;
  gateType?: string;
  txHash?: string;
  feeAmount?: string;
  devWallet?: string;
};

const ticketStore = new Map<string, TicketData>();

function makeKey(appId: string, wallet: string): string {
  return `ticket:${appId}:${wallet.toLowerCase()}`;
}

export async function grantTicket(params: {
  wallet: string;
  appId: string;
  scopes: string[];
  gateType?: string;
  txHash?: string;
  feeAmount?: string;
  devWallet?: string;
}): Promise<{ ok: boolean; expiresAt: number }> {
  const { wallet, appId, scopes, gateType, txHash, feeAmount, devWallet } = params;
  const key = makeKey(appId, wallet);
  const now = Date.now();
  const expiresAt = now + TTL_SECONDS * 1000;

  const data: TicketData = {
    wallet: wallet.toLowerCase(),
    appId,
    scopes,
    grantedAt: now,
    expiresAt,
    gateType,
    txHash,
    feeAmount,
    devWallet,
  };

  ticketStore.set(key, data);

  console.log(`[Ticket] Granted access: ${wallet} -> ${appId} (scopes: ${scopes.join(',')}, expires: ${new Date(expiresAt).toISOString()})`);

  return { ok: true, expiresAt };
}

export async function hasTicket(params: {
  wallet: string;
  appId: string;
  scopes: string[];
}): Promise<boolean> {
  if (!sdkFlags.ticketGate) {
    return true;
  }

  const { wallet, appId, scopes } = params;
  const key = makeKey(appId, wallet);
  const data = ticketStore.get(key);

  if (!data) {
    return false;
  }

  if (Date.now() > data.expiresAt) {
    ticketStore.delete(key);
    return false;
  }

  const grantedScopes = data.scopes || [];
  const hasAllScopes = scopes.every(s => grantedScopes.includes(s) || grantedScopes.includes('*'));

  return hasAllScopes;
}

export async function getTicket(wallet: string, appId: string): Promise<TicketData | null> {
  const key = makeKey(appId, wallet);
  const data = ticketStore.get(key);

  if (!data) return null;

  if (Date.now() > data.expiresAt) {
    ticketStore.delete(key);
    return null;
  }

  return data;
}

export async function revokeTicket(wallet: string, appId: string): Promise<boolean> {
  const key = makeKey(appId, wallet);
  return ticketStore.delete(key);
}

export async function listTickets(wallet: string): Promise<TicketData[]> {
  const result: TicketData[] = [];
  const walletLower = wallet.toLowerCase();
  const now = Date.now();

  for (const [key, data] of ticketStore.entries()) {
    if (data.wallet === walletLower && data.expiresAt > now) {
      result.push(data);
    }
  }

  return result;
}

export async function cleanupExpired(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, data] of ticketStore.entries()) {
    if (data.expiresAt < now) {
      ticketStore.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}

setInterval(() => {
  cleanupExpired().then(count => {
    if (count > 0) {
      console.log(`[Ticket] Cleaned up ${count} expired tickets`);
    }
  });
}, 60000);

export const ticketService = {
  grant: grantTicket,
  has: hasTicket,
  get: getTicket,
  revoke: revokeTicket,
  list: listTickets,
  cleanup: cleanupExpired,
};

export default ticketService;
