import { P3 } from './index';

const CACHE_KEY = 'p3:roles:whoami';
const CACHE_TTL_MS = 5 * 60 * 1000;

type RoleType = 'superuser' | 'admin' | 'moderator' | 'reviewer' | null;

interface WhoamiResponse {
  authenticated: boolean;
  walletAddress?: string;
  role: RoleType;
  isSuperuser: boolean;
  isStaff: boolean;
  status?: string;
  permissions?: Record<string, boolean>;
  hierarchy?: number;
  message?: string;
}

interface CachedRole {
  data: WhoamiResponse;
  ts: number;
}

interface RoleEntry {
  id: string;
  walletAddress: string;
  role: RoleType;
  status: string;
  permissions: Record<string, boolean> | null;
  assignedBy: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isSuperuser?: boolean;
}

interface ListRolesResponse {
  roles: RoleEntry[];
  count: number;
}

interface AssignRoleResponse {
  ok: boolean;
  action: 'created' | 'updated';
  role: RoleEntry;
}

interface RevokeRoleResponse {
  ok: boolean;
  revoked: string;
  previousRole: RoleType;
}

const ROLE_HIERARCHY: Record<string, number> = {
  superuser: 100,
  admin: 75,
  moderator: 50,
  reviewer: 25,
};

async function getWalletAddress(): Promise<string> {
  try {
    const addr = await P3.session.address();
    if (addr) return addr.toLowerCase();
  } catch {}
  
  try {
    const wallet = await P3.wallet();
    if (wallet.address) return wallet.address.toLowerCase();
  } catch {}
  
  throw new Error('Wallet not connected');
}

function getCachedRole(): WhoamiResponse | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    
    const cached: CachedRole = JSON.parse(raw);
    const now = Date.now();
    
    if (now - cached.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return cached.data;
  } catch {
    return null;
  }
}

function setCachedRole(data: WhoamiResponse): void {
  try {
    const cached: CachedRole = {
      data,
      ts: Date.now(),
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {}
}

function clearCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
}

async function fetchWhoami(forceRefresh = false): Promise<WhoamiResponse> {
  if (!forceRefresh) {
    const cached = getCachedRole();
    if (cached) return cached;
  }
  
  let addr: string;
  try {
    addr = await getWalletAddress();
  } catch {
    return {
      authenticated: false,
      role: null,
      isSuperuser: false,
      isStaff: false,
    };
  }
  
  try {
    const res = await fetch('/api/mod/whoami', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-P3-Addr': addr,
      },
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data: WhoamiResponse = await res.json();
    setCachedRole(data);
    return data;
  } catch {
    return {
      authenticated: false,
      role: null,
      isSuperuser: false,
      isStaff: false,
    };
  }
}

function hasMinRole(currentRole: RoleType, minRole: RoleType): boolean {
  if (!currentRole || !minRole) return false;
  const currentLevel = ROLE_HIERARCHY[currentRole] || 0;
  const minLevel = ROLE_HIERARCHY[minRole] || 0;
  return currentLevel >= minLevel;
}

export const Roles = {
  async isSuperuser(): Promise<boolean> {
    try {
      const info = await fetchWhoami();
      return info.isSuperuser === true;
    } catch {
      return false;
    }
  },

  async isAdmin(): Promise<boolean> {
    try {
      const info = await fetchWhoami();
      if (info.isSuperuser) return true;
      return hasMinRole(info.role, 'admin');
    } catch {
      return false;
    }
  },

  async isModerator(addr?: string): Promise<boolean> {
    try {
      if (addr) {
        const res = await fetch('/api/mod/whoami', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-P3-Addr': addr.toLowerCase(),
          },
        });
        
        if (!res.ok) return false;
        
        const data: WhoamiResponse = await res.json();
        if (data.isSuperuser) return true;
        return hasMinRole(data.role, 'moderator');
      }
      
      const info = await fetchWhoami();
      if (info.isSuperuser) return true;
      return hasMinRole(info.role, 'moderator');
    } catch {
      return false;
    }
  },

  async getRole(): Promise<RoleType> {
    try {
      const info = await fetchWhoami();
      if (info.isSuperuser) return 'superuser';
      return info.role;
    } catch {
      return null;
    }
  },

  async getRoleInfo(): Promise<WhoamiResponse> {
    return fetchWhoami();
  },

  async refresh(): Promise<WhoamiResponse> {
    clearCache();
    return fetchWhoami(true);
  },

  async assignRole(
    walletAddress: string,
    role: 'admin' | 'moderator' | 'reviewer',
    options?: { notes?: string; permissions?: Record<string, boolean> }
  ): Promise<AssignRoleResponse> {
    const addr = await getWalletAddress();
    
    const res = await fetch('/api/mod/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-P3-Addr': addr,
      },
      body: JSON.stringify({
        walletAddress: walletAddress.toLowerCase(),
        role,
        notes: options?.notes,
        permissions: options?.permissions,
      }),
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  },

  async revokeRole(walletAddress: string): Promise<RevokeRoleResponse> {
    const addr = await getWalletAddress();
    
    const res = await fetch(`/api/mod/roles/${encodeURIComponent(walletAddress.toLowerCase())}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-P3-Addr': addr,
      },
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.json();
  },

  async listRoles(): Promise<RoleEntry[]> {
    const addr = await getWalletAddress();
    
    const res = await fetch('/api/mod/roles', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-P3-Addr': addr,
      },
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    const data: ListRolesResponse = await res.json();
    return data.roles;
  },

  async assignModerator(addr: string): Promise<void> {
    await this.assignRole(addr, 'moderator');
  },

  async revokeModerator(addr: string): Promise<void> {
    await this.revokeRole(addr);
  },

  async listModerators(): Promise<string[]> {
    try {
      const roles = await this.listRoles();
      return roles
        .filter(r => r.status === 'active' && hasMinRole(r.role, 'moderator'))
        .map(r => r.walletAddress.toLowerCase());
    } catch {
      return [];
    }
  },

  clearCache,
};

export type { RoleType, WhoamiResponse, RoleEntry, AssignRoleResponse, RevokeRoleResponse };
