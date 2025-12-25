import { 
  ConnectedApp, 
  AppCapability, 
  AppQueryResult,
  getApp,
  isAppConnected,
  canQuery,
  updateAppAccess,
  getSupportedApps,
  findAppByName,
  getConnectedApps
} from './appSessionRegistry';

export interface AppQuery {
  wallet: string;
  appId: string;
  capability: AppCapability;
  params?: Record<string, any>;
}

export interface AppAdapterResponse {
  ok: boolean;
  data?: any;
  error?: string;
  app?: string;
  capability?: AppCapability;
  simulated?: boolean;
}

const queryCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(wallet: string, appId: string, capability: string): string {
  return `${wallet}:${appId}:${capability}`;
}

function getCached(key: string): any | null {
  const cached = queryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }
  return cached.data;
}

function setCache(key: string, data: any): void {
  queryCache.set(key, { data, timestamp: Date.now() });
}

function simulateAppData(appId: string, capability: AppCapability): any {
  const simulations: Record<string, Record<string, any>> = {
    facebook: {
      notifications: {
        count: 5,
        items: [
          { id: '1', type: 'like', message: 'John liked your post', time: '2m ago' },
          { id: '2', type: 'comment', message: 'Sarah commented on your photo', time: '15m ago' },
          { id: '3', type: 'friend_request', message: 'New friend request from Alex', time: '1h ago' },
          { id: '4', type: 'mention', message: 'You were mentioned in a post', time: '2h ago' },
          { id: '5', type: 'event', message: 'Reminder: Team meetup tomorrow', time: '3h ago' },
        ],
        unread: 3,
      },
      messages: {
        count: 12,
        unread: 4,
        recent: [
          { from: 'John Doe', preview: 'Hey, are you coming to...', time: '5m ago' },
          { from: 'Jane Smith', preview: 'Thanks for the help!', time: '1h ago' },
        ],
      },
      posts: {
        recent: [
          { id: '1', content: 'Great day at the office!', likes: 24, comments: 5 },
        ],
      },
    },
    slack: {
      notifications: {
        count: 8,
        mentions: 3,
        channels: ['#general', '#engineering', '#random'],
        items: [
          { channel: '#engineering', from: 'bot', message: 'Build completed', time: '1m ago' },
          { channel: '#general', from: 'manager', message: '@here Team meeting at 3pm', time: '30m ago' },
        ],
      },
      messages: {
        unread: 15,
        channels: 4,
        dms: 2,
      },
    },
    discord: {
      notifications: {
        count: 12,
        mentions: 5,
        servers: ['Crypto DAO', 'Dev Community', 'Gaming'],
        items: [
          { server: 'Crypto DAO', channel: '#announcements', message: 'New proposal!', time: '10m ago' },
          { server: 'Dev Community', channel: '#help', message: 'Someone replied to your question', time: '1h ago' },
        ],
      },
      messages: {
        unread: 8,
        dms: 3,
      },
    },
    gmail: {
      notifications: {
        count: 23,
        unread: 23,
        important: 5,
        items: [
          { from: 'GitHub', subject: 'New pull request in your repo', time: '5m ago' },
          { from: 'Coinbase', subject: 'Your transaction is confirmed', time: '1h ago' },
          { from: 'Team', subject: 'Weekly sync notes', time: '2h ago' },
        ],
      },
      messages: {
        total: 1542,
        unread: 23,
        starred: 12,
      },
    },
    twitter: {
      notifications: {
        count: 18,
        mentions: 6,
        likes: 12,
        retweets: 3,
        items: [
          { type: 'mention', from: '@web3dev', message: 'Great thread on...', time: '15m ago' },
          { type: 'like', message: '5 people liked your tweet', time: '1h ago' },
        ],
      },
      messages: {
        unread: 2,
        requests: 1,
      },
    },
    github: {
      notifications: {
        count: 7,
        items: [
          { repo: 'myproject', type: 'pr_review', message: 'Review requested', time: '30m ago' },
          { repo: 'myproject', type: 'issue', message: 'New issue opened', time: '2h ago' },
          { repo: 'contrib', type: 'ci', message: 'Build passed', time: '3h ago' },
        ],
        unread: 4,
      },
    },
    coinbase: {
      notifications: {
        count: 3,
        items: [
          { type: 'price_alert', message: 'ETH is up 5% today', time: '1h ago' },
          { type: 'transaction', message: 'You received 0.1 ETH', time: '2h ago' },
        ],
      },
      payments: {
        balance: '$1,234.56',
        pending: 0,
        recent: [
          { type: 'receive', amount: '0.1 ETH', from: '0x1234...', time: '2h ago' },
        ],
      },
    },
    opensea: {
      notifications: {
        count: 4,
        items: [
          { type: 'offer', message: 'New offer on your NFT', amount: '0.5 ETH', time: '1h ago' },
          { type: 'sale', message: 'Your NFT sold!', amount: '1.2 ETH', time: '1d ago' },
        ],
      },
      media: {
        collections: 3,
        items: 12,
      },
    },
    spotify: {
      media: {
        nowPlaying: {
          track: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'After Hours',
          progress: '2:15 / 3:20',
        },
        recentlyPlayed: 15,
      },
    },
    youtube: {
      notifications: {
        count: 6,
        items: [
          { channel: 'TechChannel', message: 'New video uploaded', time: '2h ago' },
          { channel: 'MusicChannel', message: 'Live stream starting', time: '4h ago' },
        ],
      },
      media: {
        subscriptions: 45,
        watchLater: 12,
      },
    },
  };

  return simulations[appId]?.[capability] || { message: 'No data available' };
}

export async function queryApp(query: AppQuery): Promise<AppAdapterResponse> {
  const { wallet, appId, capability, params } = query;
  
  const normalizedAppId = findAppByName(appId) || appId.toLowerCase();
  
  if (!isAppConnected(wallet, normalizedAppId)) {
    return {
      ok: false,
      error: `${appId} is not connected. Open it in the launcher first to connect.`,
      app: normalizedAppId,
    };
  }

  if (!canQuery(wallet, normalizedAppId, capability)) {
    return {
      ok: false,
      error: `${appId} doesn't support ${capability} queries.`,
      app: normalizedAppId,
      capability,
    };
  }

  const cacheKey = getCacheKey(wallet, normalizedAppId, capability);
  const cached = getCached(cacheKey);
  if (cached) {
    return {
      ok: true,
      data: cached,
      app: normalizedAppId,
      capability,
      simulated: true,
    };
  }

  updateAppAccess(wallet, normalizedAppId);

  const data = simulateAppData(normalizedAppId, capability);
  setCache(cacheKey, data);

  return {
    ok: true,
    data,
    app: normalizedAppId,
    capability,
    simulated: true,
  };
}

export async function queryNotifications(wallet: string, appId: string): Promise<AppAdapterResponse> {
  return queryApp({ wallet, appId, capability: 'notifications' });
}

export async function queryMessages(wallet: string, appId: string): Promise<AppAdapterResponse> {
  return queryApp({ wallet, appId, capability: 'messages' });
}

export function summarizeNotifications(data: any, appName: string): string {
  if (!data || typeof data !== 'object') {
    return `No notifications from ${appName}.`;
  }

  const count = data.count || data.items?.length || 0;
  const unread = data.unread || count;
  
  if (count === 0) {
    return `You have no new notifications on ${appName}.`;
  }

  let summary = `You have ${unread} notification${unread !== 1 ? 's' : ''} on ${appName}.`;
  
  if (data.items && data.items.length > 0) {
    const topItem = data.items[0];
    summary += ` Most recent: "${topItem.message || topItem.preview || 'New activity'}" (${topItem.time || 'just now'}).`;
  }

  return summary;
}

export function summarizeMessages(data: any, appName: string): string {
  if (!data || typeof data !== 'object') {
    return `No messages from ${appName}.`;
  }

  const unread = data.unread || data.count || 0;
  
  if (unread === 0) {
    return `No unread messages on ${appName}.`;
  }

  let summary = `You have ${unread} unread message${unread !== 1 ? 's' : ''} on ${appName}.`;
  
  if (data.recent && data.recent.length > 0) {
    const topMessage = data.recent[0];
    summary += ` Latest from ${topMessage.from}: "${topMessage.preview}" (${topMessage.time}).`;
  }

  return summary;
}

export function getConnectedAppsSummary(wallet: string): string {
  const apps = getConnectedApps(wallet);
  
  if (apps.length === 0) {
    return "You don't have any apps connected yet. Open apps in the launcher to connect them.";
  }

  const appList = apps.map(a => `${a.icon} ${a.name}`).join(', ');
  return `You have ${apps.length} app${apps.length !== 1 ? 's' : ''} connected: ${appList}. Ask me about notifications, messages, or anything else from these apps.`;
}

export { findAppByName } from './appSessionRegistry';
