import { ensureFreshToken } from './refresh';

interface SpotifyPlayResult {
  ok: boolean;
  device?: string;
}

interface SpotifyCurrentTrack {
  isPlaying: boolean;
  track?: string;
  artist?: string;
  album?: string;
  progress?: number;
  duration?: number;
  deviceName?: string;
}

interface ProxyOptions {
  correlationId?: string;
}

export async function playUris(
  wallet: string,
  uris?: string[],
  options?: ProxyOptions
): Promise<SpotifyPlayResult> {
  const token = await ensureFreshToken(wallet, 'spotify', 'player');

  const body: Record<string, unknown> = {};
  if (uris && uris.length > 0) {
    body.uris = uris;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const res = await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers,
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return { ok: true };
  }

  const json = (await res.json()) as { error?: { message?: string } };

  if (!res.ok) {
    throw new Error(json.error?.message || 'spotify_play_failed');
  }

  return { ok: true };
}

export async function pause(wallet: string): Promise<{ ok: boolean }> {
  const token = await ensureFreshToken(wallet, 'spotify', 'player');
  
  const res = await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (res.status === 204 || res.ok) {
    return { ok: true };
  }
  
  const json = await res.json() as { error?: { message?: string } };
  throw new Error(json.error?.message || 'spotify_pause_failed');
}

export async function getCurrentTrack(wallet: string): Promise<SpotifyCurrentTrack> {
  const token = await ensureFreshToken(wallet, 'spotify', 'player');
  
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (res.status === 204) {
    return { isPlaying: false };
  }
  
  const json = await res.json() as {
    is_playing?: boolean;
    item?: {
      name?: string;
      artists?: Array<{ name?: string }>;
      album?: { name?: string };
      duration_ms?: number;
    };
    progress_ms?: number;
    device?: { name?: string };
  };
  
  return {
    isPlaying: json.is_playing ?? false,
    track: json.item?.name,
    artist: json.item?.artists?.[0]?.name,
    album: json.item?.album?.name,
    progress: json.progress_ms,
    duration: json.item?.duration_ms,
    deviceName: json.device?.name,
  };
}

export async function search(
  wallet: string,
  query: string,
  type: 'track' | 'artist' | 'album' = 'track',
  limit: number = 10
): Promise<{ items: Array<{ uri: string; name: string; artist?: string }> }> {
  const token = await ensureFreshToken(wallet, 'spotify', 'player');
  
  const params = new URLSearchParams({
    q: query,
    type,
    limit: String(limit),
  });
  
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  const json = await res.json() as {
    tracks?: {
      items?: Array<{
        uri: string;
        name: string;
        artists?: Array<{ name?: string }>;
      }>;
    };
  };
  
  const items = (json.tracks?.items || []).map((t) => ({
    uri: t.uri,
    name: t.name,
    artist: t.artists?.[0]?.name,
  }));
  
  return { items };
}
