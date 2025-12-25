import { QueryClient } from "@tanstack/react-query";
import { decode } from '@msgpack/msgpack';

const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

const ATLAS_OPTIMIZED_ENDPOINTS = [
  '/api/atlas/canvas/renderables',
];

function calculateRetryDelay(attemptIndex: number): number {
  return Math.min(RETRY_DELAY_BASE * Math.pow(2, attemptIndex), 30000);
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504')
  );
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return res;
  } catch (error) {
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      const delay = calculateRetryDelay(retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retryCount + 1);
    }
    throw error;
  }
}

// SECURITY: Use separate tokens for admin vs wallet authentication
// Check if current page is admin context, not just URL pattern
function isAdminContext(): boolean {
  // Check if we're on an admin page OR if we have adminToken but no wallet token
  const currentPath = window.location.pathname;
  const hasAdminToken = localStorage.getItem("adminToken") !== null;
  const hasWalletToken = localStorage.getItem("token") !== null;
  
  // Admin context: on /admin routes OR on pages that only admins access
  if (currentPath.startsWith('/admin') || currentPath.startsWith('/login')) {
    return true;
  }
  
  // If only admin token exists (no wallet), we're in admin mode
  if (hasAdminToken && !hasWalletToken) {
    return true;
  }
  
  return false;
}

function getAuthToken(_url?: string): string | null {
  // If we're in admin context, always use adminToken
  if (isAdminContext()) {
    return localStorage.getItem("adminToken");
  }
  // Try JWT token first, then fall back to session token for session-based auth
  const jwtToken = localStorage.getItem("token");
  if (jwtToken) return jwtToken;
  
  // Fall back to Atlas session token for session-based authentication
  return localStorage.getItem("atlas_session_token");
}

function getWalletAddress(): string | null {
  return localStorage.getItem("walletAddress");
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey, meta }) => {
        const url = queryKey[0] as string;
        
        if (!navigator.onLine) {
          throw new Error('No internet connection. Please check your network.');
        }
        
        const token = getAuthToken(url);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        
        // Inject wallet address for wallet-scoped endpoints
        const walletScopedPaths = [
          '/api/nexus', '/api/payments', '/api/tv', '/api/tokens', 
          '/api/weather', '/api/ai', '/api/atlas/math', '/api/system/camera',
          '/api/clipboard', '/api/notifications', '/api/identity', '/api/system',
          '/api/sandbox', '/api/file-hub', '/api/web-browser', '/api/gamedeck',
          '/api/atlas/voice', '/api/atlas/memory', '/api/atlas/devkit', '/api/atlas-one'
        ];
        if (walletScopedPaths.some(path => url.includes(path))) {
          const wallet = getWalletAddress();
          if (wallet) {
            headers["x-wallet-address"] = wallet;
          }
        }
        
        // Support custom headers from meta
        if (meta?.headers) {
          Object.assign(headers, meta.headers as Record<string, string>);
        }
        
        const isOptimizedEndpoint = ATLAS_OPTIMIZED_ENDPOINTS.some(ep => url.includes(ep));
        if (isOptimizedEndpoint) {
          headers['Accept'] = 'application/msgpack, application/json';
          headers['Accept-Encoding'] = 'gzip, deflate';
        }
        
        const res = await fetchWithRetry(url, {
          credentials: "include",
          headers,
        });
        
        if (!res.ok) {
          if (res.status === 401) {
            if (isAdminContext()) {
              localStorage.removeItem("adminToken");
              localStorage.removeItem("adminUser");
              window.location.href = "/login";
            } else {
              localStorage.removeItem("token");
              localStorage.removeItem("user");
            }
          }
          const error = await res.text();
          throw new Error(error || `Request failed: ${res.status}`);
        }
        
        const contentType = res.headers.get('Content-Type') || '';
        if (contentType.includes('application/msgpack')) {
          const buffer = await res.arrayBuffer();
          return decode(new Uint8Array(buffer));
        }
        
        return res.json();
      },
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (failureCount >= MAX_RETRIES) return false;
        return isRetryableError(error);
      },
      retryDelay: calculateRetryDelay,
    },
    mutations: {
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        return isRetryableError(error);
      },
      retryDelay: calculateRetryDelay,
    },
  },
});

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  if (!navigator.onLine) {
    throw new Error('No internet connection. Please check your network.');
  }
  
  // SECURITY: Use separate tokens for admin vs wallet authentication
  const token = getAuthToken(url);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  // Inject wallet address for wallet-scoped endpoints
  const walletScopedPaths = [
    '/api/nexus', '/api/payments', '/api/tv', '/api/tokens', 
    '/api/weather', '/api/ai', '/api/atlas/math', '/api/system/camera',
    '/api/clipboard', '/api/notifications', '/api/identity', '/api/system',
    '/api/sandbox', '/api/file-hub', '/api/web-browser', '/api/gamedeck',
    '/api/atlas/voice', '/api/atlas/memory', '/api/atlas/devkit', '/api/atlas-one'
  ];
  if (walletScopedPaths.some(path => url.includes(path))) {
    const wallet = getWalletAddress();
    if (wallet) {
      headers["x-wallet-address"] = wallet;
    }
  }
  
  // Merge with any custom headers from options
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  
  const res = await fetchWithRetry(url, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Clear appropriate token based on context
      if (isAdminContext()) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        window.location.href = "/login";
      } else {
        // CRITICAL: Do NOT clear walletAddress on 401 - it causes disconnect loop
        // Just clear the token - wallet may need to re-authenticate
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // Don't redirect - let the app handle re-authentication
        // window.location.href = "/app";
      }
    }
    const error = await res.text();
    throw new Error(error || `Request failed: ${res.status}`);
  }

  return res.json();
}

window.addEventListener('online', () => {
  queryClient.refetchQueries({ type: 'active' });
});

window.addEventListener('offline', () => {
  console.warn('Application is offline. Some features may be unavailable.');
});
