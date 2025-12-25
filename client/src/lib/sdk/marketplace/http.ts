/**
 * P3 Core HTTP Client
 * Base HTTP client for marketplace SDKs
 */

export interface HttpConfig {
  baseUrl: string;
  token?: string;
  appId?: string;
  walletAddress?: string;
}

export class Http {
  private baseUrl: string;
  private token?: string;
  private appId?: string;
  private walletAddress?: string;

  constructor(config: HttpConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.appId = config.appId;
    this.walletAddress = config.walletAddress;
  }

  setAuth(token: string, walletAddress?: string) {
    this.token = token;
    if (walletAddress) this.walletAddress = walletAddress;
  }

  setAppId(appId: string) {
    this.appId = appId;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      h['Authorization'] = `Bearer ${this.token}`;
    }
    if (this.appId) {
      h['X-App-Id'] = this.appId;
    }
    if (this.walletAddress) {
      h['X-Wallet-Address'] = this.walletAddress;
    }
    
    return h;
  }

  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      });
    }
    
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.headers(),
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'PATCH',
      headers: this.headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  }

  async delete<T = unknown>(path: string): Promise<T> {
    const res = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'DELETE',
      headers: this.headers(),
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  }

  async upload<T = unknown>(path: string, file: File, meta: Record<string, unknown>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('meta', JSON.stringify(meta));
    
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    if (this.appId) headers['X-App-Id'] = this.appId;
    if (this.walletAddress) headers['X-Wallet-Address'] = this.walletAddress;
    
    const res = await fetch(new URL(path, this.baseUrl).toString(), {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  }
}
