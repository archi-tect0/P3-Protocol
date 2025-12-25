import { getCurrentSession } from './walletConnector';

export async function signMessageRaw(msg: Uint8Array): Promise<Uint8Array> {
  const session = getCurrentSession();
  if (!session.connected) throw new Error('Wallet not connected');
  return msg; // placeholder
}

export async function signTypedDataRaw(
  eip712: Record<string, unknown>
): Promise<Uint8Array> {
  const session = getCurrentSession();
  if (!session.connected) throw new Error('Wallet not connected');
  return new Uint8Array();
}

export async function sendTransactionRaw(tx: any): Promise<{
  txId: string;
  status: 'submitted' | 'failed';
}> {
  const session = getCurrentSession();
  if (!session.connected) throw new Error('Wallet not connected');
  return { txId: '0x123', status: 'submitted' };
}
