export interface ProviderConfig {
  name: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  extraParams?: Record<string, string>;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    name: 'google',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  slack: {
    name: 'slack',
    tokenEndpoint: 'https://slack.com/api/oauth.v2.access',
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
  },
  spotify: {
    name: 'spotify',
    tokenEndpoint: 'https://accounts.spotify.com/api/token',
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
  },
  discord: {
    name: 'discord',
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  },
  github: {
    name: 'github',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  },
  notion: {
    name: 'notion',
    tokenEndpoint: 'https://api.notion.com/v1/oauth/token',
    clientId: process.env.NOTION_CLIENT_ID || '',
    clientSecret: process.env.NOTION_CLIENT_SECRET || '',
  },
  twitter: {
    name: 'twitter',
    tokenEndpoint: 'https://api.twitter.com/2/oauth2/token',
    clientId: process.env.TWITTER_CLIENT_ID || '',
    clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
  },
};

export function getProviderConfig(provider: string): ProviderConfig | null {
  return PROVIDERS[provider] || null;
}

export function isProviderConfigured(provider: string): boolean {
  const config = PROVIDERS[provider];
  return !!(config?.clientId && config?.clientSecret);
}

export function getConfiguredProviders(): string[] {
  return Object.keys(PROVIDERS).filter(isProviderConfigured);
}

export const PROVIDER_SCOPES: Record<string, Record<string, string>> = {
  google: {
    gmail: 'https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly',
    gcalendar: 'https://www.googleapis.com/auth/calendar.readonly',
    drive: 'https://www.googleapis.com/auth/drive.readonly',
  },
  slack: {
    notifications: 'channels:read groups:read im:read mpim:read',
    send: 'chat:write',
  },
  spotify: {
    player: 'user-read-playback-state user-modify-playback-state user-read-currently-playing',
  },
  discord: {
    send: 'messages.read',
  },
  github: {
    repos: 'repo',
    notifications: 'notifications',
  },
  notion: {
    pages: '',
  },
  twitter: {
    post: 'tweet.write tweet.read users.read',
  },
};
