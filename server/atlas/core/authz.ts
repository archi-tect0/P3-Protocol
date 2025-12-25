import type { Visibility } from './registry';

export interface Session {
  wallet?: string;
  isAdmin?: boolean;
}

export function authorize(visibility: Visibility, session: Session): boolean {
  if (visibility === 'public') return true;
  if (visibility === 'wallet-gated') return Boolean(session.wallet);
  if (visibility === 'admin-only') return Boolean(session.isAdmin);
  return false;
}

export function isAdminWallet(wallet: string): boolean {
  const adminWallet = (process.env.ADMIN_WALLET || '').toLowerCase();
  return adminWallet !== '' && wallet.toLowerCase() === adminWallet;
}

export function getSessionFromWallet(wallet?: string): Session {
  if (!wallet) return {};
  return {
    wallet,
    isAdmin: isAdminWallet(wallet),
  };
}
