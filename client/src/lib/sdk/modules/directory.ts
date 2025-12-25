import { sdkReq } from './core';

export type DirectoryEntry = {
  wallet: string;
  name?: string;
  avatar?: string;
  bio?: string;
  verified: boolean;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type DirectoryMetadata = {
  name?: string;
  avatar?: string;
  bio?: string;
  [key: string]: unknown;
};

export type ListDirectoryResult = {
  entries: DirectoryEntry[];
};

export type AddEntryResult = {
  ok: boolean;
  entry: DirectoryEntry;
};

export type GetEntryResult = {
  entry: DirectoryEntry;
};

export type UpdateEntryResult = {
  ok: boolean;
  entry: DirectoryEntry;
};

export type RemoveEntryResult = {
  ok: boolean;
};

export async function list(): Promise<ListDirectoryResult> {
  return sdkReq<ListDirectoryResult>('/api/nexus/directory', {
    method: 'GET',
  });
}

export async function add(wallet: string, metadata: DirectoryMetadata): Promise<AddEntryResult> {
  return sdkReq<AddEntryResult>('/api/nexus/directory', {
    method: 'POST',
    body: JSON.stringify({ wallet, metadata }),
  });
}

export async function get(wallet: string): Promise<GetEntryResult> {
  return sdkReq<GetEntryResult>(`/api/nexus/directory/${encodeURIComponent(wallet)}`, {
    method: 'GET',
  });
}

export async function update(wallet: string, data: Partial<DirectoryMetadata>): Promise<UpdateEntryResult> {
  return sdkReq<UpdateEntryResult>(`/api/nexus/directory/${encodeURIComponent(wallet)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function remove(wallet: string): Promise<RemoveEntryResult> {
  return sdkReq<RemoveEntryResult>(`/api/nexus/directory/${encodeURIComponent(wallet)}`, {
    method: 'DELETE',
  });
}

export type DirectoryAPI = {
  list: typeof list;
  add: typeof add;
  get: typeof get;
  update: typeof update;
  remove: typeof remove;
};

export function createDirectoryAPI(): DirectoryAPI {
  return {
    list,
    add,
    get,
    update,
    remove,
  };
}
