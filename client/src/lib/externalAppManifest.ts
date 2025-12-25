export type LaunchMode = 'embed' | 'tab' | 'popup' | 'redirect';
export type ProxyStatus = 'available' | 'oauth_required' | 'unavailable';

export interface AppAction {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  params: string[];
  requiresAuth: boolean;
}

export interface ExternalAppManifest {
  id: string;
  name: string;
  icon: string;
  url: string;
  gradient: string;
  launchMode: LaunchMode;
  embeddable: boolean;
  oauthConnector?: string;
  proxyStatus: ProxyStatus;
  actions: AppAction[];
  atlasIntents: string[];
  scopes: string[];
}

export const externalAppManifests: ExternalAppManifest[] = [
  {
    id: 'dehub',
    name: 'DeHub',
    icon: '🌐',
    url: 'https://dehub.io',
    gradient: 'from-violet-500 to-purple-600',
    launchMode: 'embed',
    embeddable: true,
    proxyStatus: 'available',
    actions: [
      { id: 'explore', name: 'Explore', description: 'Browse DeHub apps', endpoint: '/api/proxy/dehub/explore', params: [], requiresAuth: false },
    ],
    atlasIntents: ['open dehub', 'launch dehub', 'dehub apps'],
    scopes: [],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    url: 'https://mail.google.com',
    gradient: 'from-red-500 to-red-600',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'gmail',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'compose', name: 'Compose Email', description: 'Create a new email', endpoint: '/api/proxy/gmail/compose', params: ['to', 'subject', 'body'], requiresAuth: true },
      { id: 'search', name: 'Search Inbox', description: 'Search emails', endpoint: '/api/proxy/gmail/search', params: ['query'], requiresAuth: true },
      { id: 'unread', name: 'Unread Count', description: 'Get unread email count', endpoint: '/api/proxy/gmail/unread', params: [], requiresAuth: true },
      { id: 'send', name: 'Send Email', description: 'Send an email', endpoint: '/api/proxy/gmail/send', params: ['to', 'subject', 'body'], requiresAuth: true },
    ],
    atlasIntents: ['send email to', 'compose email', 'check my inbox', 'search emails for', 'how many unread emails'],
    scopes: ['email.read', 'email.compose', 'email.send'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    icon: '🎵',
    url: 'https://open.spotify.com',
    gradient: 'from-green-500 to-green-600',
    launchMode: 'tab',
    embeddable: true,
    oauthConnector: 'spotify',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'play', name: 'Play Track', description: 'Play a song or playlist', endpoint: '/api/proxy/spotify/play', params: ['query'], requiresAuth: true },
      { id: 'pause', name: 'Pause', description: 'Pause playback', endpoint: '/api/proxy/spotify/pause', params: [], requiresAuth: true },
      { id: 'search', name: 'Search Music', description: 'Search for tracks', endpoint: '/api/proxy/spotify/search', params: ['query'], requiresAuth: true },
      { id: 'current', name: 'Now Playing', description: 'Get current track', endpoint: '/api/proxy/spotify/current', params: [], requiresAuth: true },
    ],
    atlasIntents: ['play music', 'play song', 'search for', 'what is playing', 'pause music', 'skip track'],
    scopes: ['playback.read', 'playback.control', 'library.read'],
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💼',
    url: 'https://slack.com',
    gradient: 'from-purple-500 to-purple-600',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'slack',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'send', name: 'Send Message', description: 'Send a Slack message', endpoint: '/api/proxy/slack/send', params: ['channel', 'message'], requiresAuth: true },
      { id: 'channels', name: 'List Channels', description: 'Get channel list', endpoint: '/api/proxy/slack/channels', params: [], requiresAuth: true },
      { id: 'unread', name: 'Unread Messages', description: 'Get unread count', endpoint: '/api/proxy/slack/unread', params: [], requiresAuth: true },
    ],
    atlasIntents: ['send slack message', 'message on slack', 'check slack notifications', 'slack channels'],
    scopes: ['messages.read', 'messages.write', 'channels.read'],
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    url: 'https://discord.com/app',
    gradient: 'from-indigo-600 to-purple-600',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'discord',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'send', name: 'Send Message', description: 'Send a Discord message', endpoint: '/api/proxy/discord/send', params: ['channel', 'message'], requiresAuth: true },
      { id: 'servers', name: 'List Servers', description: 'Get server list', endpoint: '/api/proxy/discord/servers', params: [], requiresAuth: true },
    ],
    atlasIntents: ['send discord message', 'discord servers', 'check discord'],
    scopes: ['messages.read', 'messages.write', 'guilds.read'],
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: '📓',
    url: 'https://notion.so',
    gradient: 'from-slate-600 to-slate-700',
    launchMode: 'embed',
    embeddable: true,
    oauthConnector: 'notion',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'search', name: 'Search Pages', description: 'Search Notion pages', endpoint: '/api/proxy/notion/search', params: ['query'], requiresAuth: true },
      { id: 'create', name: 'Create Page', description: 'Create a new page', endpoint: '/api/proxy/notion/create', params: ['title', 'content'], requiresAuth: true },
    ],
    atlasIntents: ['search notion for', 'create notion page', 'my notion pages'],
    scopes: ['pages.read', 'pages.write'],
  },
  {
    id: 'figma',
    name: 'Figma',
    icon: '🎨',
    url: 'https://figma.com',
    gradient: 'from-purple-500 to-pink-500',
    launchMode: 'embed',
    embeddable: true,
    proxyStatus: 'unavailable',
    actions: [],
    atlasIntents: ['open figma'],
    scopes: [],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    url: 'https://youtube.com',
    gradient: 'from-red-500 to-red-600',
    launchMode: 'embed',
    embeddable: true,
    proxyStatus: 'unavailable',
    actions: [
      { id: 'search', name: 'Search Videos', description: 'Search YouTube', endpoint: '/api/proxy/youtube/search', params: ['query'], requiresAuth: false },
    ],
    atlasIntents: ['search youtube for', 'play video', 'watch'],
    scopes: [],
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: '🐦',
    url: 'https://x.com',
    gradient: 'from-slate-700 to-slate-800',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'twitter',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'post', name: 'Post Tweet', description: 'Create a tweet', endpoint: '/api/proxy/twitter/post', params: ['text'], requiresAuth: true },
      { id: 'timeline', name: 'Get Timeline', description: 'Get your timeline', endpoint: '/api/proxy/twitter/timeline', params: [], requiresAuth: true },
    ],
    atlasIntents: ['post tweet', 'check twitter', 'my timeline'],
    scopes: ['tweet.read', 'tweet.write'],
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    url: 'https://github.com',
    gradient: 'from-slate-700 to-slate-800',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'github',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'repos', name: 'List Repos', description: 'Get your repositories', endpoint: '/api/proxy/github/repos', params: [], requiresAuth: true },
      { id: 'notifications', name: 'Notifications', description: 'Get notifications', endpoint: '/api/proxy/github/notifications', params: [], requiresAuth: true },
    ],
    atlasIntents: ['my github repos', 'github notifications', 'check github'],
    scopes: ['repo.read', 'notifications.read'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '📁',
    url: 'https://drive.google.com',
    gradient: 'from-yellow-500 to-yellow-600',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'gdrive',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'search', name: 'Search Files', description: 'Search Drive files', endpoint: '/api/proxy/gdrive/search', params: ['query'], requiresAuth: true },
      { id: 'recent', name: 'Recent Files', description: 'Get recent files', endpoint: '/api/proxy/gdrive/recent', params: [], requiresAuth: true },
    ],
    atlasIntents: ['search drive for', 'my recent files', 'google drive files'],
    scopes: ['files.read'],
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: '📅',
    url: 'https://calendar.google.com',
    gradient: 'from-blue-500 to-blue-600',
    launchMode: 'tab',
    embeddable: false,
    oauthConnector: 'gcalendar',
    proxyStatus: 'oauth_required',
    actions: [
      { id: 'events', name: 'Get Events', description: 'Get calendar events', endpoint: '/api/proxy/gcalendar/events', params: ['date'], requiresAuth: true },
      { id: 'create', name: 'Create Event', description: 'Create a new event', endpoint: '/api/proxy/gcalendar/create', params: ['title', 'date', 'time'], requiresAuth: true },
    ],
    atlasIntents: ['my calendar', 'what events do I have', 'schedule meeting', 'create event'],
    scopes: ['calendar.read', 'calendar.write'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: '💼',
    url: 'https://linkedin.com',
    gradient: 'from-blue-600 to-blue-700',
    launchMode: 'tab',
    embeddable: false,
    proxyStatus: 'unavailable',
    actions: [],
    atlasIntents: ['open linkedin'],
    scopes: [],
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    icon: '🪙',
    url: 'https://coinbase.com',
    gradient: 'from-blue-500 to-blue-600',
    launchMode: 'tab',
    embeddable: false,
    proxyStatus: 'unavailable',
    actions: [],
    atlasIntents: ['open coinbase', 'check crypto prices'],
    scopes: [],
  },
  {
    id: 'opensea',
    name: 'OpenSea',
    icon: '🌊',
    url: 'https://opensea.io',
    gradient: 'from-blue-500 to-blue-600',
    launchMode: 'tab',
    embeddable: false,
    proxyStatus: 'unavailable',
    actions: [],
    atlasIntents: ['open opensea', 'my nfts'],
    scopes: [],
  },
];

export function getManifestById(id: string): ExternalAppManifest | undefined {
  return externalAppManifests.find(m => m.id === id);
}

export function getManifestByIntent(intent: string): { manifest: ExternalAppManifest; action?: AppAction } | undefined {
  const lowerIntent = intent.toLowerCase();
  
  for (const manifest of externalAppManifests) {
    for (const intentPattern of manifest.atlasIntents) {
      if (lowerIntent.includes(intentPattern.toLowerCase())) {
        const matchedAction = manifest.actions.find(action => 
          lowerIntent.includes(action.name.toLowerCase()) ||
          action.description.toLowerCase().split(' ').some(word => lowerIntent.includes(word))
        );
        return { manifest, action: matchedAction };
      }
    }
  }
  
  return undefined;
}

export function getAvailableActions(manifestId: string): AppAction[] {
  const manifest = getManifestById(manifestId);
  return manifest?.actions || [];
}

export function isProxyAvailable(manifestId: string): boolean {
  const manifest = getManifestById(manifestId);
  return manifest?.proxyStatus === 'available' || manifest?.proxyStatus === 'oauth_required';
}
