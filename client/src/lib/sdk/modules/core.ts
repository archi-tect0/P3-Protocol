export type TicketConfig = {
  mode: 'redirect' | 'popup';
  url: string;
};

export type SDKConfig = {
  baseUrl: string;
  appId: string;
  getToken: () => Promise<string>;
  timeoutMs: number;
  ticket?: TicketConfig;
};

let config: SDKConfig | null = null;

export function configureSDK(options: Omit<SDKConfig, 'timeoutMs' | 'ticket'> & { 
  timeoutMs?: number;
  ticket?: Partial<TicketConfig>;
}) {
  config = {
    ...options,
    timeoutMs: options.timeoutMs ?? 12000,
    ticket: {
      mode: options.ticket?.mode ?? 'redirect',
      url: options.ticket?.url ?? '/ticket',
    },
  };
}

export function isSDKConfigured(): boolean {
  return config !== null;
}

export function getSDKConfig(): SDKConfig | null {
  return config;
}

export function getAppId(): string {
  return config?.appId || 'unknown';
}

async function handleTicketRedirect(redirectUrl: string): Promise<void> {
  if (!config?.ticket) {
    window.location.href = redirectUrl;
    throw new Error('redirecting_to_ticket');
  }

  if (config.ticket.mode === 'popup') {
    await openTicketPopup(redirectUrl);
  } else {
    window.location.href = redirectUrl;
    throw new Error('redirecting_to_ticket');
  }
}

async function openTicketPopup(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = 520, h = 680;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    const popup = window.open(url, 'ticket', `width=${w},height=${h},left=${left},top=${top}`);
    
    if (!popup) {
      reject(new Error('popup_blocked'));
      return;
    }

    const interval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(interval);
          resolve();
        }
      } catch {
        // cross-origin during flow; ignore
      }
    }, 500);
  });
}

export async function sdkReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!config) {
    throw new Error('SDK v2 not configured. Call configureSDK() first.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const token = await config.getToken();
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-SDK-Version': '2.0.0',
        'X-App-Id': config.appId,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.status === 302) {
      const payload = await res.json().catch(() => ({}));
      if (payload.redirect) {
        await handleTicketRedirect(payload.redirect);
        return sdkReq<T>(path, init);
      }
    }

    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      const error = new Error(`HTTP ${res.status}: ${msg}`);
      (error as any).status = res.status;
      throw error;
    }

    return res.json() as Promise<T>;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw err;
  }
}

export const SDK_VERSION = '2.0.0';
