import {
  connect,
  disconnect,
  getCurrentSession,
  walletEvents,
} from './walletConnector';
import { showConsentModal } from './ui';
import { grant, hasCap, revokeAll } from './capabilities';
import {
  signMessageRaw,
  signTypedDataRaw,
  sendTransactionRaw,
} from './signer';

export type Session = {
  connected: boolean;
  address?: string;
  chainId?: number;
  provider: 'walletconnect' | 'injected';
};

export async function connectWallet(opts?: {
  provider?: 'walletconnect' | 'injected';
}): Promise<Session> {
  const p = opts?.provider ?? 'walletconnect';
  return await connect(p);
}

export async function getSession(): Promise<Session> {
  return getCurrentSession();
}

export async function disconnectWallet(): Promise<void> {
  revokeAll();
  await disconnect();
}

export async function requestCapability(
  moduleId: string,
  cap: string,
  reason?: string
): Promise<boolean> {
  const ok = await showConsentModal({ moduleId, capability: cap, reason });
  if (ok) await grant(moduleId, cap);
  return ok;
}

export async function signMessage(
  moduleId: string,
  msg: Uint8Array
): Promise<Uint8Array> {
  if (!hasCap(moduleId, 'sign_message'))
    throw new Error('Capability not granted');
  return await signMessageRaw(msg);
}

export async function signTypedData(
  moduleId: string,
  eip712: Record<string, unknown>
): Promise<Uint8Array> {
  if (!hasCap(moduleId, 'sign_eip712'))
    throw new Error('Capability not granted');
  return await signTypedDataRaw(eip712);
}

export async function sendTransaction(
  moduleId: string,
  tx: unknown
): Promise<{ txId: string; status: 'submitted' | 'failed' }> {
  if (!hasCap(moduleId, 'send_transaction'))
    throw new Error('Capability not granted');
  return await sendTransactionRaw(tx);
}

export function onWalletEvent(
  event: 'connected' | 'disconnected' | 'accountChanged' | 'chainChanged',
  handler: (session: Session) => void
): () => void {
  return walletEvents.on(event, handler);
}
