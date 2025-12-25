import { sdkReq } from './core';

export interface Profile {
  walletAddress: string;
  ensName?: string | null;
  basename?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  isVerified: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

export interface ProfileResponse {
  wallet: string;
  exists: boolean;
  profile: Profile | null;
}

export interface LookupResponse {
  found: boolean;
  profile: Profile | null;
}

export interface ResolveResponse {
  resolved: boolean;
  address: string | null;
  ensName?: string | null;
  basename?: string | null;
  avatarUrl?: string | null;
}

export async function getMyProfile(): Promise<ProfileResponse> {
  return sdkReq<ProfileResponse>('/api/sdk/identity/me');
}

export async function updateProfile(updates: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ profile: Profile }> {
  return sdkReq<{ profile: Profile }>('/api/sdk/identity/me', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function lookupProfile(params: {
  address?: string;
  ensName?: string;
  basename?: string;
}): Promise<LookupResponse> {
  return sdkReq<LookupResponse>('/api/sdk/identity/lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function resolveIdentifier(identifier: string): Promise<ResolveResponse> {
  return sdkReq<ResolveResponse>(`/api/sdk/identity/resolve/${encodeURIComponent(identifier)}`);
}
