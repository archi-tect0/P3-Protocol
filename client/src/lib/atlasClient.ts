import { decode } from '@msgpack/msgpack';

export interface AtlasClientOptions {
  preferBinary?: boolean;
  acceptGzip?: boolean;
}

const defaultOptions: AtlasClientOptions = {
  preferBinary: true,
  acceptGzip: true,
};

export async function atlasRequest<T>(
  url: string,
  options: AtlasClientOptions & RequestInit = {}
): Promise<T> {
  const { preferBinary, acceptGzip, ...fetchOptions } = { ...defaultOptions, ...options };
  
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> || {}),
  };
  
  if (preferBinary) {
    headers['Accept'] = 'application/msgpack, application/json';
  }
  
  if (acceptGzip) {
    headers['Accept-Encoding'] = 'gzip, deflate';
  }
  
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }
  
  const contentType = response.headers.get('Content-Type') || '';
  
  if (contentType.includes('application/msgpack')) {
    const buffer = await response.arrayBuffer();
    return decode(new Uint8Array(buffer)) as T;
  }
  
  return response.json();
}

export async function atlasRenderables<T = unknown>(): Promise<T> {
  return atlasRequest<T>('/api/atlas/canvas/renderables');
}

export async function atlasPulse<T = unknown>(): Promise<T> {
  return atlasRequest<T>('/api/atlas/pulse');
}

export function createAtlasQueryFn<T>(url: string, options?: AtlasClientOptions) {
  return async (): Promise<T> => {
    return atlasRequest<T>(url, options);
  };
}

export interface AtlasQueryMeta {
  atlasOptimized?: boolean;
  preferBinary?: boolean;
  acceptGzip?: boolean;
}

export async function optimizedFetch<T>(
  url: string,
  meta?: AtlasQueryMeta
): Promise<T> {
  const isAtlasEndpoint = url.includes('/atlas/') || url.startsWith('/atlas');
  
  if (!isAtlasEndpoint || meta?.atlasOptimized === false) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  }
  
  return atlasRequest<T>(url, {
    preferBinary: meta?.preferBinary ?? true,
    acceptGzip: meta?.acceptGzip ?? true,
  });
}
