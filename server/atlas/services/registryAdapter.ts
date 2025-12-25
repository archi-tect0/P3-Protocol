import type { EndpointMeta, Scope, AppInfo, Registry } from '../types';
import { atlasConfig } from '../config';
import { enrichRegistryEndpoints, matchPhraseToEndpoint, extractArgsFromQuery } from './semanticGenerator';
import { manifestRegistry, type ManifestEndpoint } from '../core/registry';
import * as fs from 'fs';
import * as path from 'path';

interface ExternalAppSemantics {
  id: string;
  name: string;
  url: string;
  icon?: string;
  category: string;
  scopes?: string[];
  phrases: string[];
  intents: string[];
  tags: string[];
}

interface SemanticsData {
  externalApps: Record<string, ExternalAppSemantics>;
  categories: Record<string, { name: string; apps: string[] }>;
}

function loadExternalSemantics(): SemanticsData | null {
  try {
    const semanticsPath = path.join(__dirname, '../data/semantics.json');
    const data = fs.readFileSync(semanticsPath, 'utf-8');
    return JSON.parse(data) as SemanticsData;
  } catch {
    return null;
  }
}

function buildExternalAppEndpoints(): Record<string, EndpointMeta> {
  const semantics = loadExternalSemantics();
  if (!semantics) return {};

  const endpoints: Record<string, EndpointMeta> = {};

  for (const [appId, app] of Object.entries(semantics.externalApps)) {
    endpoints[`external.launch.${appId}`] = {
      app: 'external.app',
      version: '1.0.0',
      fn: 'launch',
      args: { appId: 'string', url: 'string' },
      scopes: ['registry'],
      description: `Launch ${app.name} (${app.url})`,
      semantics: {
        intents: app.intents,
        tags: app.tags,
        phrases: app.phrases,
      },
    };
  }

  return endpoints;
}

interface RegistryCache {
  apps: Record<string, AppInfo>;
  endpoints: Record<string, EndpointMeta>;
  routes: Record<string, { app: string; href: string }>;
  fetchedAt: number;
  manifestCount?: number;
}

let cache: RegistryCache | null = null;

const defaultApps: Record<string, AppInfo> = {
  'messages.app': { name: 'Messages', id: 'messages.app', version: '1.0.0', adapter: '/api/messages', permissions: ['messages'] },
  'notes.app': { name: 'Notes', id: 'notes.app', version: '1.0.0', adapter: '/api/notes', permissions: ['storage'] },
  'gallery.app': { name: 'Gallery', id: 'gallery.app', version: '1.0.0', adapter: '/api/gallery', permissions: ['storage'] },
  'market.app': { name: 'Marketplace', id: 'market.app', version: '1.0.0', adapter: '/api/marketplace', permissions: ['marketplace'] },
  'payments.app': { name: 'Payments', id: 'payments.app', version: '1.0.0', adapter: '/api/payments', permissions: ['payments'] },
  'dao.app': { name: 'DAO', id: 'dao.app', version: '1.0.0', adapter: '/api/dao', permissions: ['dao'] },
  'anchors.app': { name: 'Anchors', id: 'anchors.app', version: '1.0.0', adapter: '/api/anchor', permissions: ['anchors'] },
  'metrics.app': { name: 'Metrics', id: 'metrics.app', version: '1.0.0', adapter: '/api/metrics', permissions: ['admin'] },
  'logs.app': { name: 'Logs', id: 'logs.app', version: '1.0.0', adapter: '/api/logs', permissions: ['admin'] },
  'external.app': { name: 'External Apps', id: 'external.app', version: '1.0.0', adapter: '/api/external', permissions: ['registry'] },
  'proxy.app': { name: 'Proxy Orchestration', id: 'proxy.app', version: '1.0.0', adapter: '/api/proxy', permissions: ['proxy'] },
};

const defaultEndpoints: Record<string, EndpointMeta> = {
  'messages.inbox.list': { 
    app: 'messages.app', version: '1.0.0', fn: 'inboxList', args: {}, scopes: ['messages'], 
    description: 'List inbox messages',
    semantics: { 
      intents: ['messages_inbox', 'check_messages'], 
      tags: ['communication', 'inbound'], 
      phrases: ['do i have any messages', 'show inbox', 'list new messages', 'any messages', 'check my inbox'] 
    }
  },
  'messages.send': { 
    app: 'messages.app', version: '1.0.0', fn: 'send', args: { recipient: 'string', text: 'string' }, scopes: ['messages'], 
    description: 'Send a message',
    semantics: { 
      intents: ['messages_send', 'dm'], 
      tags: ['communication', 'outbound', 'user_action'], 
      phrases: ['send {recipient} a message', 'dm {recipient}', 'message {recipient}', 'text {recipient}'] 
    }
  },
  'messages.voice.send': { 
    app: 'messages.app', version: '1.0.0', fn: 'voiceSend', args: { recipient: 'string', audioRef: 'string' }, scopes: ['messages'], 
    description: 'Send a voice message',
    semantics: { 
      intents: ['messages_voice_send'], 
      tags: ['communication', 'voice', 'outbound'], 
      phrases: ['send {recipient} a voice message', 'voice message {recipient}'] 
    }
  },
  'notes.create': { 
    app: 'notes.app', version: '1.0.0', fn: 'create', args: { title: 'string', text: 'string' }, scopes: ['storage'], 
    description: 'Create a new note',
    semantics: { 
      intents: ['notes_create'], 
      tags: ['note', 'storage', 'create'], 
      phrases: ['write a note', 'new note', 'create note', 'take a note', 'jot this down'] 
    }
  },
  'notes.list': { 
    app: 'notes.app', version: '1.0.0', fn: 'list', args: {}, scopes: ['storage'], 
    description: 'List all notes',
    semantics: { 
      intents: ['notes_list'], 
      tags: ['note', 'storage', 'list'], 
      phrases: ['show my notes', 'list notes', 'my notes', 'recent notes'] 
    }
  },
  'gallery.count': { 
    app: 'gallery.app', version: '1.0.0', fn: 'count', args: {}, scopes: ['storage'], 
    description: 'Count gallery items',
    semantics: { 
      intents: ['gallery_count'], 
      tags: ['photos', 'gallery', 'count'], 
      phrases: ['how many pictures are in my gallery', 'photos count', 'gallery size', 'how many photos'] 
    }
  },
  'gallery.list': { 
    app: 'gallery.app', version: '1.0.0', fn: 'list', args: {}, scopes: ['storage'], 
    description: 'List gallery items',
    semantics: { 
      intents: ['gallery_list'], 
      tags: ['photos', 'gallery', 'list'], 
      phrases: ['show my gallery', 'list pictures', 'my photos', 'show photos'] 
    }
  },
  'marketplace.sales.list': { 
    app: 'market.app', version: '1.0.0', fn: 'salesList', args: { range: 'string' }, scopes: ['marketplace'], 
    description: 'List marketplace sales',
    semantics: { 
      intents: ['marketplace_sales_today'], 
      tags: ['sales', 'marketplace', 'revenue'], 
      phrases: ['did i sell any of my books on marketplace today', 'sales today', 'marketplace sales', 'what did i sell'] 
    }
  },
  'payments.send': { 
    app: 'payments.app', version: '1.0.0', fn: 'send', args: { recipient: 'string', amount: 'string' }, scopes: ['payments'], 
    description: 'Send a payment',
    semantics: { 
      intents: ['payments_send'], 
      tags: ['payment', 'transfer', 'money'], 
      phrases: ['send payment to {recipient}', 'pay {recipient}', 'transfer to {recipient}', 'send {amount} to {recipient}'] 
    }
  },
  'payments.history': { 
    app: 'payments.app', version: '1.0.0', fn: 'history', args: { range: 'string' }, scopes: ['payments'], 
    description: 'Get payment history',
    semantics: { 
      intents: ['payments_history'], 
      tags: ['payment', 'history', 'transactions'], 
      phrases: ['show my payment history', 'recent payments', 'my transactions', 'payment log'] 
    }
  },
  'dao.vote': { 
    app: 'dao.app', version: '1.0.0', fn: 'vote', args: { proposalId: 'string', support: 'boolean' }, scopes: ['dao'], 
    description: 'Vote on a proposal',
    semantics: { 
      intents: ['dao_vote'], 
      tags: ['governance', 'vote', 'dao'], 
      phrases: ['vote on {proposalId}', 'cast my vote', 'vote for proposal', 'submit vote'] 
    }
  },
  'dao.proposals': { 
    app: 'dao.app', version: '1.0.0', fn: 'proposals', args: {}, scopes: ['dao'], 
    description: 'List DAO proposals',
    semantics: { 
      intents: ['dao_proposals'], 
      tags: ['governance', 'proposals', 'dao'], 
      phrases: ['active proposals', 'dao proposals', 'governance proposals', 'any active proposals', 'open votes'] 
    }
  },
  'anchors.create': { 
    app: 'anchors.app', version: '1.0.0', fn: 'create', args: { data: 'string' }, scopes: ['anchors'], 
    description: 'Create a blockchain anchor',
    semantics: { 
      intents: ['anchors_create'], 
      tags: ['anchor', 'blockchain', 'proof'], 
      phrases: ['create anchor', 'anchor this', 'notarize', 'create proof'] 
    }
  },
  'anchors.verify': { 
    app: 'anchors.app', version: '1.0.0', fn: 'verify', args: { hash: 'string' }, scopes: ['anchors'], 
    description: 'Verify an anchor',
    semantics: { 
      intents: ['anchors_verify'], 
      tags: ['anchor', 'verify', 'proof'], 
      phrases: ['verify anchor', 'check anchor', 'validate proof', 'verify hash'] 
    }
  },
  'metrics.visitors': { 
    app: 'metrics.app', version: '1.0.0', fn: 'visitors', args: { range: 'string' }, scopes: ['admin'], 
    description: 'Get visitor metrics',
    semantics: { 
      intents: ['visitors_today', 'metrics_visitors'], 
      tags: ['metrics', 'admin', 'analytics'], 
      phrases: ['how many visitors did i have today', 'visitor count', 'traffic today', 'analytics'] 
    }
  },
  'logs.recent': { 
    app: 'logs.app', version: '1.0.0', fn: 'recent', args: { severity: 'string', range: 'string' }, scopes: ['admin'], 
    description: 'Get recent logs',
    semantics: { 
      intents: ['errors_recent', 'logs_check'], 
      tags: ['errors', 'logs', 'admin', 'debug'], 
      phrases: ['were there any error logs i should be aware of', 'errors this week', 'recent errors', 'check logs'] 
    }
  },
  'proxy.gmail.compose': {
    app: 'proxy.app', version: '1.0.0', fn: 'gmailCompose', args: { to: 'string', subject: 'string', body: 'string' }, scopes: ['proxy'],
    description: 'Compose an email via Gmail',
    semantics: {
      intents: ['proxy_gmail_compose'],
      tags: ['email', 'gmail', 'compose', 'proxy'],
      phrases: ['send an email to {to}', 'compose email', 'write an email', 'email {to}']
    }
  },
  'proxy.gmail.unread': {
    app: 'proxy.app', version: '1.0.0', fn: 'gmailUnread', args: {}, scopes: ['proxy'],
    description: 'Get unread Gmail count',
    semantics: {
      intents: ['proxy_gmail_unread'],
      tags: ['email', 'gmail', 'unread', 'proxy'],
      phrases: ['how many unread emails', 'check my email', 'any new emails']
    }
  },
  'proxy.spotify.play': {
    app: 'proxy.app', version: '1.0.0', fn: 'spotifyPlay', args: { query: 'string' }, scopes: ['proxy'],
    description: 'Play music on Spotify',
    semantics: {
      intents: ['proxy_spotify_play'],
      tags: ['music', 'spotify', 'play', 'proxy'],
      phrases: ['play {query} on spotify', 'play some music', 'play {query}']
    }
  },
  'proxy.spotify.pause': {
    app: 'proxy.app', version: '1.0.0', fn: 'spotifyPause', args: {}, scopes: ['proxy'],
    description: 'Pause Spotify playback',
    semantics: {
      intents: ['proxy_spotify_pause'],
      tags: ['music', 'spotify', 'pause', 'proxy'],
      phrases: ['pause spotify', 'stop the music', 'pause music']
    }
  },
  'proxy.spotify.current': {
    app: 'proxy.app', version: '1.0.0', fn: 'spotifyCurrent', args: {}, scopes: ['proxy'],
    description: 'Get currently playing track',
    semantics: {
      intents: ['proxy_spotify_current'],
      tags: ['music', 'spotify', 'current', 'proxy'],
      phrases: ['what song is playing', 'currently playing', 'what is this song']
    }
  },
  'proxy.slack.send': {
    app: 'proxy.app', version: '1.0.0', fn: 'slackSend', args: { channel: 'string', message: 'string' }, scopes: ['proxy'],
    description: 'Send a Slack message',
    semantics: {
      intents: ['proxy_slack_send'],
      tags: ['slack', 'message', 'send', 'proxy'],
      phrases: ['send message to {channel} on slack', 'slack {channel}', 'message slack']
    }
  },
  'proxy.slack.unread': {
    app: 'proxy.app', version: '1.0.0', fn: 'slackUnread', args: {}, scopes: ['proxy'],
    description: 'Get unread Slack messages',
    semantics: {
      intents: ['proxy_slack_unread'],
      tags: ['slack', 'unread', 'messages', 'proxy'],
      phrases: ['any new slack messages', 'check slack', 'slack notifications']
    }
  },
  'proxy.discord.send': {
    app: 'proxy.app', version: '1.0.0', fn: 'discordSend', args: { channel: 'string', message: 'string' }, scopes: ['proxy'],
    description: 'Send a Discord message',
    semantics: {
      intents: ['proxy_discord_send'],
      tags: ['discord', 'message', 'send', 'proxy'],
      phrases: ['send message on discord', 'discord {channel}', 'message discord']
    }
  },
  'proxy.github.repos': {
    app: 'proxy.app', version: '1.0.0', fn: 'githubRepos', args: {}, scopes: ['proxy'],
    description: 'List GitHub repositories',
    semantics: {
      intents: ['proxy_github_repos'],
      tags: ['github', 'repos', 'list', 'proxy'],
      phrases: ['show my github repos', 'list repositories', 'github repos']
    }
  },
  'proxy.github.notifications': {
    app: 'proxy.app', version: '1.0.0', fn: 'githubNotifications', args: {}, scopes: ['proxy'],
    description: 'Get GitHub notifications',
    semantics: {
      intents: ['proxy_github_notifications'],
      tags: ['github', 'notifications', 'proxy'],
      phrases: ['github notifications', 'any github alerts', 'check github']
    }
  },
  'proxy.calendar.events': {
    app: 'proxy.app', version: '1.0.0', fn: 'calendarEvents', args: { range: 'string' }, scopes: ['proxy'],
    description: 'Get calendar events',
    semantics: {
      intents: ['proxy_calendar_events'],
      tags: ['calendar', 'events', 'schedule', 'proxy'],
      phrases: ['what do i have scheduled', 'my calendar', 'upcoming events', 'todays schedule']
    }
  },
  'proxy.twitter.post': {
    app: 'proxy.app', version: '1.0.0', fn: 'twitterPost', args: { content: 'string' }, scopes: ['proxy'],
    description: 'Post to Twitter/X',
    semantics: {
      intents: ['proxy_twitter_post'],
      tags: ['twitter', 'post', 'tweet', 'proxy'],
      phrases: ['post on twitter', 'tweet this', 'post to x']
    }
  },
};

function buildManifestEndpoints(): Record<string, EndpointMeta> {
  const manifests = manifestRegistry.listEndpoints();
  const endpoints: Record<string, EndpointMeta> = {};
  
  for (const manifest of manifests) {
    const key = manifest['devkit.key'];
    const tags = manifest['telemetry.tags'] || [];
    const phrases = manifest['semantics.phrases'] || [];
    
    endpoints[key] = {
      app: 'canvas.app',
      version: '1.0.0',
      fn: key.split('.').pop() || 'execute',
      args: manifest.params 
        ? Object.fromEntries(Object.entries(manifest.params).map(([k, v]) => [k, v.type]))
        : {},
      scopes: ['registry'] as Scope[],
      description: manifest['canvas.display']?.subtitle || manifest.name,
      semantics: {
        intents: [`canvas_${key.replace(/\./g, '_')}`],
        tags: tags,
        phrases: phrases,
      },
    };
  }
  
  return endpoints;
}

let manifestCacheVersion = 0;

export function invalidateManifestCache(): void {
  manifestCacheVersion++;
  cache = null;
}

export function loadRegistry(): Registry {
  const manifestEndpoints = buildManifestEndpoints();
  const manifestCount = Object.keys(manifestEndpoints).length;
  
  if (cache && cache.manifestCount === manifestCount) {
    return {
      apps: cache.apps,
      endpoints: cache.endpoints,
      routes: cache.routes,
    };
  }
  
  const externalEndpoints = buildExternalAppEndpoints();
  const mergedEndpoints = { ...defaultEndpoints, ...externalEndpoints, ...manifestEndpoints };
  const enrichedEndpoints = enrichRegistryEndpoints(mergedEndpoints);
  
  const newCache: RegistryCache = {
    apps: defaultApps,
    endpoints: enrichedEndpoints,
    routes: {},
    fetchedAt: Date.now(),
    manifestCount,
  };
  
  cache = newCache;
  
  return {
    apps: newCache.apps,
    endpoints: newCache.endpoints,
    routes: newCache.routes,
  };
}

export function findEndpointByQuery(query: string): { 
  endpointKey: string; 
  endpoint: EndpointMeta; 
  extractedArgs: Record<string, string>;
  score: number;
} | null {
  const registry = loadRegistry();
  const match = matchPhraseToEndpoint(query, registry.endpoints);
  
  if (!match) return null;
  
  const endpoint = registry.endpoints[match.endpointKey];
  if (!endpoint) return null;
  
  const extractedArgs = match.matchedPhrase 
    ? extractArgsFromQuery(query, match.matchedPhrase, endpoint.args)
    : {};
  
  return {
    endpointKey: match.endpointKey,
    endpoint,
    extractedArgs,
    score: match.score,
  };
}

export function getExternalApps(): Record<string, ExternalAppSemantics> {
  const semantics = loadExternalSemantics();
  return semantics?.externalApps || {};
}

export function getExternalAppById(appId: string): ExternalAppSemantics | null {
  const apps = getExternalApps();
  return apps[appId] || null;
}

export function getExternalAppsByCategory(category: string): ExternalAppSemantics[] {
  const semantics = loadExternalSemantics();
  if (!semantics) return [];
  
  const categoryData = semantics.categories[category];
  if (!categoryData) return [];
  
  return categoryData.apps
    .map(appId => semantics.externalApps[appId])
    .filter(Boolean);
}

export async function loadRegistryAsync(): Promise<Record<string, EndpointMeta>> {
  const now = Date.now();
  const externalEndpoints = buildExternalAppEndpoints();
  
  if (cache && (now - cache.fetchedAt) < atlasConfig.registryCacheTTL) {
    return cache.endpoints;
  }
  
  try {
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
    const response = await fetch(`${baseUrl}/api/sdk/registry`);
    
    if (!response.ok) {
      throw new Error(`Registry fetch failed: ${response.status}`);
    }
    
    const data = await response.json() as any;
    const endpoints: Record<string, EndpointMeta> = {};
    const apps: Record<string, AppInfo> = {};
    
    for (const [key, meta] of Object.entries(data.endpoints || {})) {
      const m = meta as any;
      endpoints[key] = {
        app: m.app,
        version: m.version,
        fn: m.fn,
        args: m.args || {},
        scopes: (m.scopes || []) as Scope[],
        description: m.description,
      };
    }
    
    for (const [id, app] of Object.entries(data.apps || {})) {
      const a = app as any;
      apps[id] = {
        name: a.name,
        id: a.id,
        version: a.version,
        adapter: a.adapter || '',
        permissions: (a.permissions || []) as Scope[],
      };
    }
    
    const appCategories: Record<string, string> = {};
    for (const [id, app] of Object.entries(apps)) {
      if ((app as any).category) {
        appCategories[id] = (app as any).category;
      }
    }
    
    const mergedEndpoints = Object.keys(endpoints).length > 0 
      ? { ...endpoints, ...externalEndpoints }
      : { ...defaultEndpoints, ...externalEndpoints };
    
    const enrichedEndpoints = enrichRegistryEndpoints(mergedEndpoints, appCategories);
    
    cache = { 
      apps: Object.keys(apps).length > 0 ? apps : defaultApps,
      endpoints: enrichedEndpoints,
      routes: data.routes || {},
      fetchedAt: now,
    };
    
    return cache.endpoints;
  } catch (error) {
    if (cache) {
      return cache.endpoints;
    }
    
    cache = {
      apps: defaultApps,
      endpoints: { ...defaultEndpoints, ...externalEndpoints },
      routes: {},
      fetchedAt: now,
    };
    
    return cache.endpoints;
  }
}

export function getEndpointsForApp(appId: string): Array<{ key: string; meta: EndpointMeta }> {
  const registry = loadRegistry();
  return Object.entries(registry.endpoints)
    .filter(([, meta]) => meta.app === appId)
    .map(([key, meta]) => ({ key, meta }));
}

export function getEndpointsByScope(scope: Scope): Array<{ key: string; meta: EndpointMeta }> {
  const registry = loadRegistry();
  return Object.entries(registry.endpoints)
    .filter(([, meta]) => meta.scopes.includes(scope))
    .map(([key, meta]) => ({ key, meta }));
}

export async function searchEndpoints(keyword: string): Promise<Array<{ key: string } & EndpointMeta>> {
  const registry = loadRegistry();
  const lowerKeyword = keyword.toLowerCase();
  
  return Object.entries(registry.endpoints)
    .filter(([key, meta]) => 
      key.toLowerCase().includes(lowerKeyword) ||
      (meta.description?.toLowerCase().includes(lowerKeyword)) ||
      meta.fn.toLowerCase().includes(lowerKeyword)
    )
    .map(([key, meta]) => ({ key, ...meta }));
}

export async function filterByScope(scope: Scope): Promise<Array<{ key: string } & EndpointMeta>> {
  const registry = loadRegistry();
  
  return Object.entries(registry.endpoints)
    .filter(([_, meta]) => meta.scopes.includes(scope))
    .map(([key, meta]) => ({ key, ...meta }));
}

export async function getEndpoint(key: string): Promise<EndpointMeta | null> {
  const registry = loadRegistry();
  return registry.endpoints[key] || null;
}

export function getEndpointSync(key: string): EndpointMeta | null {
  const registry = loadRegistry();
  return registry.endpoints[key] || null;
}

export function invalidateCache(): void {
  cache = null;
}

export interface DeveloperEndpointMatch {
  key: string;
  name: string;
  url: string;
  phrase: string;
  score: number;
  ownerWallet?: string;
  authMode: 'owner' | 'collaborators' | 'public';
  visibility: 'public' | 'wallet-gated' | 'admin-only';
}

export function findDeveloperChatEndpoint(
  query: string, 
  callerWallet: string | undefined
): DeveloperEndpointMatch | null {
  if (!callerWallet) return null;
  
  const manifests = manifestRegistry.listEndpoints();
  const lowerQuery = query.toLowerCase().trim();
  const lowerCallerWallet = callerWallet.toLowerCase();
  
  let bestMatch: DeveloperEndpointMatch | null = null;
  let bestScore = 0;
  
  for (const manifest of manifests) {
    if (manifest['chat.enabled'] !== true) continue;
    
    const phrases = manifest['semantics.phrases'] || [];
    if (phrases.length === 0) continue;
    
    const visibility = manifest['security.visibility'];
    if (visibility === 'admin-only') continue;
    
    const authMode = manifest['chat.authMode'] || 'public';
    const ownerWallet = manifest['security.ownerWallet'];
    const collaborators = manifest['security.collaborators'] || [];
    
    const isAuthorized = 
      authMode === 'public' ||
      (authMode === 'owner' && ownerWallet?.toLowerCase() === lowerCallerWallet) ||
      (authMode === 'collaborators' && (
        ownerWallet?.toLowerCase() === lowerCallerWallet ||
        collaborators.some(c => c.toLowerCase() === lowerCallerWallet)
      ));
    
    if (!isAuthorized) continue;
    
    for (const phrase of phrases) {
      const lowerPhrase = phrase.toLowerCase();
      let score = 0;
      
      if (lowerQuery === lowerPhrase) {
        score = 100;
      } else if (lowerQuery.includes(lowerPhrase) || lowerPhrase.includes(lowerQuery)) {
        score = 80;
      } else {
        const queryWords = lowerQuery.split(/\s+/);
        const phraseWords = lowerPhrase.split(/\s+/);
        const matchingWords = queryWords.filter(w => phraseWords.includes(w));
        if (matchingWords.length >= 2) {
          score = 50 + (matchingWords.length / phraseWords.length) * 30;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          key: manifest['devkit.key'],
          name: manifest.name,
          url: manifest.url,
          phrase,
          score,
          ownerWallet,
          authMode,
          visibility: manifest['security.visibility'],
        };
      }
    }
  }
  
  return bestScore >= 50 ? bestMatch : null;
}
