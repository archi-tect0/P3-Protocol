import { ticketService } from '../../services/ticket';

export interface TicketAnchorEvent {
  appId: string;
  event: string;
  data: {
    wallet: string;
    appId: string;
    scopes?: string[];
    gateType?: string;
    txHash?: string;
    feeAmount?: string;
    devWallet?: string;
  };
  ts: number;
  txHash?: string;
}

export async function onTicketAccessGranted(payload: TicketAnchorEvent): Promise<void> {
  const { wallet, appId, scopes = [], gateType, txHash, feeAmount, devWallet } = payload.data || {};

  if (!wallet || !appId) {
    console.warn('[TicketHandler] Missing wallet or appId in access_granted event');
    return;
  }

  await ticketService.grant({
    wallet,
    appId,
    scopes,
    gateType,
    txHash: txHash || payload.txHash,
    feeAmount,
    devWallet,
  });

  console.log(`[TicketHandler] Processed access_granted: ${wallet} -> ${appId}`);
}

export async function onTicketAccessRevoked(payload: TicketAnchorEvent): Promise<void> {
  const { wallet, appId } = payload.data || {};

  if (!wallet || !appId) {
    console.warn('[TicketHandler] Missing wallet or appId in access_revoked event');
    return;
  }

  await ticketService.revoke(wallet, appId);
  console.log(`[TicketHandler] Processed access_revoked: ${wallet} -> ${appId}`);
}

export function isTicketEvent(event: { appId: string; event: string }): boolean {
  return event.appId === 'ticketGate' && 
    (event.event === 'access_granted' || event.event === 'access_revoked');
}

export async function processTicketEvent(event: TicketAnchorEvent): Promise<void> {
  if (event.appId !== 'ticketGate') return;

  switch (event.event) {
    case 'access_granted':
      await onTicketAccessGranted(event);
      break;
    case 'access_revoked':
      await onTicketAccessRevoked(event);
      break;
    default:
      console.log(`[TicketHandler] Unknown ticket event: ${event.event}`);
  }
}

export default {
  onTicketAccessGranted,
  onTicketAccessRevoked,
  isTicketEvent,
  processTicketEvent,
};
