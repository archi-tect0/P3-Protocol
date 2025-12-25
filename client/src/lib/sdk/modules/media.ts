import { sdkReq } from './core';

export type CallStartResult = {
  ok: boolean;
  sdpOffer: string;
  turn?: {
    urls: string[];
    username: string;
    credential: string;
  };
  roomToken?: string;
};

export type PresignResult = {
  url: string;
  key: string;
  expiresAt: number;
};

export async function startCall(
  roomId: string,
  opts?: { anchor?: boolean; video?: boolean }
): Promise<CallStartResult> {
  return sdkReq<CallStartResult>('/api/sdk/media/call/start', {
    method: 'POST',
    body: JSON.stringify({ 
      roomId, 
      anchor: !!opts?.anchor,
      video: opts?.video ?? true,
    }),
  });
}

export async function endCall(
  roomId: string,
  opts?: { anchor?: boolean }
): Promise<{ ok: boolean }> {
  return sdkReq<{ ok: boolean }>('/api/sdk/media/call/end', {
    method: 'POST',
    body: JSON.stringify({ roomId, anchor: !!opts?.anchor }),
  });
}

export async function presignUpload(
  filename: string,
  contentType: string,
  opts?: { anchor?: boolean; maxSize?: number }
): Promise<PresignResult> {
  return sdkReq<PresignResult>('/api/sdk/media/upload/presign', {
    method: 'POST',
    body: JSON.stringify({ 
      filename, 
      contentType, 
      anchor: !!opts?.anchor,
      maxSize: opts?.maxSize,
    }),
  });
}

export async function getTurnCredentials(): Promise<{
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}> {
  return sdkReq<{ urls: string[]; username: string; credential: string; ttl: number }>(
    '/api/sdk/media/turn',
    { method: 'GET' }
  );
}

export async function getRecording(roomId: string): Promise<{
  url?: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
}> {
  return sdkReq<{ url?: string; status: 'pending' | 'processing' | 'ready' | 'failed' }>(
    `/api/sdk/media/recording/${roomId}`,
    { method: 'GET' }
  );
}
