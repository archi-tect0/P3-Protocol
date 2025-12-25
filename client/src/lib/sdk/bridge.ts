// Session Bridge for P3 Protocol

export interface SessionTicket {
  id: string;
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  anchorsDigestHash: string;
  issuedAt: number;
  expiresAt: number;
  clientSig?: string;
}

let currentTicket: SessionTicket | null = null;

export function createDevTicket(anchorsDigestHash: string, chainId: number, verifyingContract: string): SessionTicket {
  const now = Date.now();
  const ticket: SessionTicket = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    domain: { name: "P3 Protocol", version: "1", chainId, verifyingContract },
    anchorsDigestHash,
    issuedAt: now,
    expiresAt: now + 5 * 60 * 1000
  };
  currentTicket = ticket;
  return ticket;
}

export function getTicket(): SessionTicket | null {
  if (currentTicket && currentTicket.expiresAt < Date.now()) {
    currentTicket = null;
  }
  return currentTicket;
}

export function clearTicket(): void {
  currentTicket = null;
}

export function isTicketValid(): boolean {
  const t = getTicket();
  return t !== null && t.expiresAt > Date.now();
}

export const EIP712_DOMAIN = (chainId: number, verifyingContract: string) => ({
  name: "P3 Protocol",
  version: "1",
  chainId,
  verifyingContract
});

export async function signTicket(ticket: SessionTicket): Promise<string> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No wallet available');
  }
  const domain = EIP712_DOMAIN(ticket.domain.chainId, ticket.domain.verifyingContract);
  const types = {
    Ticket: [
      { name: 'id', type: 'string' },
      { name: 'anchorsDigestHash', type: 'string' },
      { name: 'issuedAt', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' }
    ]
  };
  const value = {
    id: ticket.id,
    anchorsDigestHash: ticket.anchorsDigestHash,
    issuedAt: ticket.issuedAt,
    expiresAt: ticket.expiresAt
  };
  const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
  if (!accounts.length) throw new Error('No account connected');
  return (window as any).ethereum.request({
    method: 'eth_signTypedData_v4',
    params: [accounts[0], JSON.stringify({ domain, types, primaryType: 'Ticket', message: value })]
  });
}
