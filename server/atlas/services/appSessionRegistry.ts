export interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  url: string;
  connectedAt: number;
  lastAccessed: number;
  sessionActive: boolean;
  capabilities: AppCapability[];
  authType: 'oauth' | 'session' | 'apikey' | 'wallet';
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
}

export type AppCapability = 
  | 'notifications'
  | 'messages'
  | 'posts'
  | 'files'
  | 'calendar'
  | 'contacts'
  | 'media'
  | 'analytics'
  | 'payments'
  | 'social';

export interface AppQueryResult {
  app: string;
  capability: AppCapability;
  data: any;
  timestamp: number;
  cached: boolean;
}

const walletSessions: Map<string, Map<string, ConnectedApp>> = new Map();

const SUPPORTED_APPS: Record<string, { 
  name: string; 
  icon: string; 
  capabilities: AppCapability[];
  queryEndpoints: Record<string, string>;
}> = {
  'facebook': {
    name: 'Facebook',
    icon: '📘',
    capabilities: ['notifications', 'messages', 'posts', 'social'],
    queryEndpoints: {
      notifications: '/me/notifications',
      messages: '/me/inbox',
      posts: '/me/feed',
    }
  },
  'slack': {
    name: 'Slack',
    icon: '💬',
    capabilities: ['notifications', 'messages'],
    queryEndpoints: {
      notifications: '/api/users.notifications',
      messages: '/api/conversations.history',
    }
  },
  'discord': {
    name: 'Discord',
    icon: '🎮',
    capabilities: ['notifications', 'messages', 'social'],
    queryEndpoints: {
      notifications: '/users/@me/mentions',
      messages: '/users/@me/channels',
    }
  },
  'gmail': {
    name: 'Gmail',
    icon: '✉️',
    capabilities: ['notifications', 'messages'],
    queryEndpoints: {
      notifications: '/gmail/v1/users/me/messages?q=is:unread',
      messages: '/gmail/v1/users/me/messages',
    }
  },
  'twitter': {
    name: 'X (Twitter)',
    icon: '🐦',
    capabilities: ['notifications', 'posts', 'messages', 'social'],
    queryEndpoints: {
      notifications: '/2/users/me/mentions',
      messages: '/2/dm_events',
      posts: '/2/users/me/tweets',
    }
  },
  'linkedin': {
    name: 'LinkedIn',
    icon: '💼',
    capabilities: ['notifications', 'messages', 'social'],
    queryEndpoints: {
      notifications: '/v2/notifications',
      messages: '/v2/conversations',
    }
  },
  'github': {
    name: 'GitHub',
    icon: '🐙',
    capabilities: ['notifications'],
    queryEndpoints: {
      notifications: '/notifications',
    }
  },
  'notion': {
    name: 'Notion',
    icon: '📝',
    capabilities: ['notifications', 'files'],
    queryEndpoints: {
      notifications: '/v1/users/me',
      files: '/v1/search',
    }
  },
  'spotify': {
    name: 'Spotify',
    icon: '🎵',
    capabilities: ['media'],
    queryEndpoints: {
      media: '/v1/me/player/currently-playing',
    }
  },
  'youtube': {
    name: 'YouTube',
    icon: '▶️',
    capabilities: ['notifications', 'media'],
    queryEndpoints: {
      notifications: '/youtube/v3/activities',
      media: '/youtube/v3/subscriptions',
    }
  },
  'coinbase': {
    name: 'Coinbase',
    icon: '💰',
    capabilities: ['notifications', 'payments'],
    queryEndpoints: {
      notifications: '/v2/notifications',
      payments: '/v2/accounts',
    }
  },
  'opensea': {
    name: 'OpenSea',
    icon: '🌊',
    capabilities: ['notifications', 'media'],
    queryEndpoints: {
      notifications: '/api/v2/events',
      media: '/api/v2/collections',
    }
  },
};

export function registerApp(wallet: string, appId: string, url: string, authType: ConnectedApp['authType'] = 'session'): ConnectedApp | null {
  const appMeta = SUPPORTED_APPS[appId.toLowerCase()];
  if (!appMeta) {
    console.warn(`[AppSessionRegistry] Unknown app: ${appId}`);
    return null;
  }

  if (!walletSessions.has(wallet)) {
    walletSessions.set(wallet, new Map());
  }

  const userApps = walletSessions.get(wallet)!;
  const now = Date.now();

  const app: ConnectedApp = {
    id: appId.toLowerCase(),
    name: appMeta.name,
    icon: appMeta.icon,
    url,
    connectedAt: now,
    lastAccessed: now,
    sessionActive: true,
    capabilities: appMeta.capabilities,
    authType,
  };

  userApps.set(appId.toLowerCase(), app);
  console.log(`[AppSessionRegistry] Registered ${appMeta.name} for wallet ${wallet.slice(0, 8)}...`);
  
  return app;
}

export function getConnectedApps(wallet: string): ConnectedApp[] {
  const userApps = walletSessions.get(wallet);
  if (!userApps) return [];
  return Array.from(userApps.values()).filter(app => app.sessionActive);
}

export function getApp(wallet: string, appId: string): ConnectedApp | null {
  const userApps = walletSessions.get(wallet);
  if (!userApps) return null;
  return userApps.get(appId.toLowerCase()) || null;
}

export function isAppConnected(wallet: string, appId: string): boolean {
  const app = getApp(wallet, appId);
  return app !== null && app.sessionActive;
}

export function getAppCapabilities(wallet: string, appId: string): AppCapability[] {
  const app = getApp(wallet, appId);
  return app?.capabilities || [];
}

export function canQuery(wallet: string, appId: string, capability: AppCapability): boolean {
  const caps = getAppCapabilities(wallet, appId);
  return caps.includes(capability);
}

export function disconnectApp(wallet: string, appId: string): boolean {
  const userApps = walletSessions.get(wallet);
  if (!userApps) return false;
  
  const app = userApps.get(appId.toLowerCase());
  if (!app) return false;

  app.sessionActive = false;
  console.log(`[AppSessionRegistry] Disconnected ${app.name} for wallet ${wallet.slice(0, 8)}...`);
  return true;
}

export function updateAppAccess(wallet: string, appId: string): void {
  const app = getApp(wallet, appId);
  if (app) {
    app.lastAccessed = Date.now();
  }
}

export function getSupportedApps(): typeof SUPPORTED_APPS {
  return SUPPORTED_APPS;
}

export function findAppByName(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  
  for (const [id, meta] of Object.entries(SUPPORTED_APPS)) {
    if (id === normalized || meta.name.toLowerCase() === normalized) {
      return id;
    }
  }
  
  const aliases: Record<string, string> = {
    'x': 'twitter',
    'insta': 'instagram',
    'ig': 'instagram',
    'yt': 'youtube',
    'fb': 'facebook',
    'gh': 'github',
    'li': 'linkedin',
  };
  
  return aliases[normalized] || null;
}

export function getQueryableApps(wallet: string): { id: string; name: string; icon: string; capabilities: AppCapability[] }[] {
  return getConnectedApps(wallet).map(app => ({
    id: app.id,
    name: app.name,
    icon: app.icon,
    capabilities: app.capabilities,
  }));
}
