import type { Session } from './sdk';
import { EventBus } from './eventBus';
import { SessionStore } from './store';

export const walletEvents = new EventBus<
  'connected' | 'disconnected' | 'accountChanged' | 'chainChanged'
>();

type SessionData = Session & { wcTopic?: string };

let currentSession: SessionData = {
  connected: false,
  provider: 'walletconnect',
};

export async function connect(
  providerType: 'walletconnect' | 'injected'
): Promise<Session> {
  if (providerType === 'injected') {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error('Injected provider not found');
    const [address] = await eth.request({ method: 'eth_requestAccounts' });
    const chainIdHex = await eth.request({ method: 'eth_chainId' });
    currentSession = {
      connected: true,
      address,
      chainId: parseInt(chainIdHex, 16),
      provider: 'injected',
    };
    await SessionStore.save(currentSession);
    walletEvents.emit('connected', currentSession);
    return currentSession;
  }

  // WalletConnect placeholder
  currentSession = {
    connected: true,
    address: '0x0',
    chainId: 1,
    provider: 'walletconnect',
    wcTopic: 'topic',
  };
  await SessionStore.save(currentSession);
  walletEvents.emit('connected', currentSession);
  return currentSession;
}

export async function disconnect() {
  currentSession = { connected: false, provider: 'walletconnect' };
  await SessionStore.clear();
  walletEvents.emit('disconnected', currentSession);
}

export function getCurrentSession(): Session {
  return currentSession;
}
