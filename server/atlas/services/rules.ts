import type { Intent, FlowStep, Session, NLIntent } from '../types';
import { getEndpointSync } from './registryAdapter';

interface FeatureRule {
  endpointKey: string;
  defaultArgs: Record<string, any>;
  requiredRole?: string;
}

interface IntentRule {
  intent: NLIntent;
  endpointKey: string;
  buildArgs: (params: Record<string, any>) => Record<string, any>;
}

const intentRules: IntentRule[] = [
  {
    intent: 'messages_inbox',
    endpointKey: 'messages.inbox.list',
    buildArgs: () => ({}),
  },
  {
    intent: 'messages_send',
    endpointKey: 'messages.send',
    buildArgs: (params) => ({ 
      recipient: params.recipient || '', 
      text: params.text || '' 
    }),
  },
  {
    intent: 'messages_voice_send',
    endpointKey: 'messages.voice.send',
    buildArgs: (params) => ({ 
      recipient: params.recipient || '', 
      audioRef: params.audioRef || '' 
    }),
  },
  {
    intent: 'notes_create',
    endpointKey: 'notes.create',
    buildArgs: (params) => ({ 
      title: params.title || '', 
      text: params.text || '' 
    }),
  },
  {
    intent: 'notes_list',
    endpointKey: 'notes.list',
    buildArgs: () => ({}),
  },
  {
    intent: 'wikipedia_lookup',
    endpointKey: 'atlas.wikipedia.search',
    buildArgs: (params) => ({ 
      term: params.topic || params.term || params.query || ''
    }),
  },
  {
    intent: 'gallery_count',
    endpointKey: 'gallery.count',
    buildArgs: () => ({}),
  },
  {
    intent: 'gallery_list',
    endpointKey: 'gallery.list',
    buildArgs: () => ({}),
  },
  {
    intent: 'marketplace_sales_today',
    endpointKey: 'marketplace.sales.list',
    buildArgs: (params) => ({ range: params.range || 'day' }),
  },
  {
    intent: 'payments_send',
    endpointKey: 'payments.send',
    buildArgs: (params) => ({ 
      recipient: params.recipient || params.address || '', 
      amount: params.amount || '' 
    }),
  },
  {
    intent: 'payments_history',
    endpointKey: 'payments.history',
    buildArgs: (params) => ({ range: params.timeRange || 'week' }),
  },
  {
    intent: 'dao_vote',
    endpointKey: 'dao.vote',
    buildArgs: (params) => ({ 
      proposalId: params.proposalId || '', 
      support: params.support ?? true 
    }),
  },
  {
    intent: 'dao_proposals',
    endpointKey: 'dao.proposals',
    buildArgs: () => ({}),
  },
  {
    intent: 'anchors_create',
    endpointKey: 'anchors.create',
    buildArgs: (params) => ({ data: params.data || '' }),
  },
  {
    intent: 'anchors_verify',
    endpointKey: 'anchors.verify',
    buildArgs: (params) => ({ hash: params.hash || '' }),
  },
  {
    intent: 'proxy_gmail_compose',
    endpointKey: 'proxy.gmail.compose',
    buildArgs: (params) => ({
      to: params.to || '',
      subject: params.subject || '',
      body: params.body || '',
    }),
  },
  {
    intent: 'proxy_gmail_unread',
    endpointKey: 'proxy.gmail.unread',
    buildArgs: () => ({}),
  },
  {
    intent: 'proxy_spotify_play',
    endpointKey: 'proxy.spotify.play',
    buildArgs: (params) => ({
      query: params.query || params.track || '',
    }),
  },
  {
    intent: 'proxy_spotify_pause',
    endpointKey: 'proxy.spotify.pause',
    buildArgs: () => ({}),
  },
  {
    intent: 'proxy_spotify_current',
    endpointKey: 'proxy.spotify.current',
    buildArgs: () => ({}),
  },
  {
    intent: 'proxy_slack_send',
    endpointKey: 'proxy.slack.send',
    buildArgs: (params) => ({
      channel: params.channel || '#general',
      message: params.message || params.text || '',
    }),
  },
  {
    intent: 'proxy_slack_unread',
    endpointKey: 'proxy.slack.unread',
    buildArgs: () => ({}),
  },
  {
    intent: 'proxy_discord_send',
    endpointKey: 'proxy.discord.send',
    buildArgs: (params) => ({
      channel: params.channel || '',
      message: params.message || params.text || '',
    }),
  },
  {
    intent: 'proxy_github_repos',
    endpointKey: 'proxy.github.repos',
    buildArgs: () => ({}),
  },
  {
    intent: 'proxy_github_notifications',
    endpointKey: 'proxy.github.notifications',
    buildArgs: () => ({}),
  },
  {
    intent: 'proxy_calendar_events',
    endpointKey: 'proxy.calendar.events',
    buildArgs: (params) => ({
      range: params.range || 'today',
    }),
  },
  {
    intent: 'proxy_twitter_post',
    endpointKey: 'proxy.twitter.post',
    buildArgs: (params) => ({
      content: params.content || params.text || '',
    }),
  },
];

const featureRules: Record<string, FeatureRule> = {
  'metrics.visitors': {
    endpointKey: 'admin.metrics',
    defaultArgs: { metric: 'visitors', range: 'today' },
    requiredRole: 'admin',
  },
  'logs.recent': {
    endpointKey: 'admin.logs',
    defaultArgs: { level: 'error', limit: 50 },
    requiredRole: 'admin',
  },
  'admin.users': {
    endpointKey: 'admin.listUsers',
    defaultArgs: { limit: 100, status: 'active' },
    requiredRole: 'admin',
  },
  'moderation.flag': {
    endpointKey: 'moderation.flag',
    defaultArgs: { reason: 'review_required' },
    requiredRole: 'moderator',
  },
  'moderation.ban': {
    endpointKey: 'moderation.ban',
    defaultArgs: { duration: '24h' },
    requiredRole: 'moderator',
  },
  'moderation.approve': {
    endpointKey: 'moderation.approve',
    defaultArgs: {},
    requiredRole: 'moderator',
  },
  'messages.compose': {
    endpointKey: 'messages.compose',
    defaultArgs: { attachments: [] },
  },
  'messages.list': {
    endpointKey: 'messages.list',
    defaultArgs: { limit: 20, offset: 0 },
  },
  'payments.send': {
    endpointKey: 'payments.send',
    defaultArgs: { token: 'ETH', memo: '' },
  },
  'payments.history': {
    endpointKey: 'payments.history',
    defaultArgs: { limit: 50 },
  },
  'dao.vote': {
    endpointKey: 'dao.vote',
    defaultArgs: {},
  },
  'dao.propose': {
    endpointKey: 'dao.createProposal',
    defaultArgs: { votingPeriod: '7d' },
  },
  'dao.delegate': {
    endpointKey: 'dao.delegate',
    defaultArgs: {},
  },
  'anchors.create': {
    endpointKey: 'anchors.create',
    defaultArgs: { eventType: 'generic' },
  },
  'calls.start': {
    endpointKey: 'calls.start',
    defaultArgs: { type: 'video', anchor: false },
  },
  'notes.create': {
    endpointKey: 'notes.create',
    defaultArgs: { starred: false },
  },
  'identity.attest': {
    endpointKey: 'identity.attest',
    defaultArgs: {},
  },
  'settings.update': {
    endpointKey: 'settings.update',
    defaultArgs: {},
  },
  'help.general': {
    endpointKey: 'help.topics',
    defaultArgs: { category: 'general' },
  },
};

export function resolveIntent(intent: Intent): FlowStep | null {
  const rule = featureRules[intent.feature];
  
  if (!rule) {
    return null;
  }
  
  const args = { ...rule.defaultArgs };
  
  if (intent.constraints) {
    if (intent.constraints.amount !== undefined) {
      args.amount = intent.constraints.amount;
    }
    if (intent.constraints.address !== undefined) {
      args.to = intent.constraints.address;
    }
    if (intent.constraints.timeRange !== undefined) {
      args.range = intent.constraints.timeRange;
    }
    if (intent.constraints.limit !== undefined) {
      args.limit = intent.constraints.limit;
    }
  }
  
  return {
    key: rule.endpointKey,
    args,
  };
}

export function getRequiredRole(feature: string): string | undefined {
  return featureRules[feature]?.requiredRole;
}

export function listAvailableFeatures(role?: string): string[] {
  return Object.entries(featureRules)
    .filter(([_, rule]) => {
      if (!rule.requiredRole) return true;
      if (!role) return false;
      if (role === 'admin') return true;
      if (role === 'moderator') return rule.requiredRole !== 'admin';
      return !rule.requiredRole;
    })
    .map(([feature]) => feature);
}

function canCallEndpoint(session: Session, endpointKey: string): boolean {
  return Object.values(session.capabilityMap).some(
    endpoints => endpoints.includes(endpointKey)
  );
}

export function mapIntentToSteps(
  intent: NLIntent,
  params: Record<string, any>,
  session: Session
): FlowStep[] {
  const steps: FlowStep[] = [];
  
  for (const rule of intentRules) {
    if (rule.intent !== intent) continue;
    
    const endpoint = getEndpointSync(rule.endpointKey);
    if (!endpoint) continue;
    
    if (!canCallEndpoint(session, rule.endpointKey)) continue;
    
    steps.push({
      key: rule.endpointKey,
      args: rule.buildArgs(params),
    });
    
    break;
  }
  
  return steps;
}

export function mapFeatureToSteps(
  feature: string,
  params: Record<string, any>,
  session: Session
): FlowStep[] {
  const endpoint = getEndpointSync(feature);
  
  if (!endpoint) {
    return [];
  }
  
  if (!canCallEndpoint(session, feature)) {
    return [];
  }
  
  return [{
    key: feature,
    args: params,
  }];
}

export function getAvailableIntents(session: Session): NLIntent[] {
  const available: NLIntent[] = [];
  
  for (const rule of intentRules) {
    if (canCallEndpoint(session, rule.endpointKey)) {
      available.push(rule.intent);
    }
  }
  
  return [...new Set(available)];
}

export function getSuggestedActions(session: Session): string[] {
  const intents = getAvailableIntents(session);
  const suggestions: string[] = [];
  
  const intentSuggestions: Partial<Record<NLIntent, string>> = {
    messages_inbox: 'Check your messages',
    messages_send: 'Send a message',
    messages_compose: 'Send a message',
    messages_voice_send: 'Send a voice message',
    messages_voice_compose: 'Send a voice message',
    notes_create: 'Create a new note',
    notes_compose: 'Create a new note',
    notes_list: 'View your notes',
    gallery_count: 'Count your photos',
    gallery_list: 'Browse your gallery',
    marketplace_sales_today: 'Check today\'s sales',
    payments_send: 'Send a payment',
    payments_history: 'View payment history',
    dao_vote: 'Vote on a proposal',
    dao_proposals: 'View active proposals',
    anchors_create: 'Create a blockchain anchor',
    anchors_verify: 'Verify an anchor',
    proxy_gmail_compose: 'Compose an email',
    proxy_gmail_unread: 'Check unread emails',
    proxy_spotify_play: 'Play music on Spotify',
    proxy_spotify_pause: 'Pause Spotify',
    proxy_spotify_current: 'What\'s playing?',
    proxy_slack_send: 'Send Slack message',
    proxy_slack_unread: 'Check Slack',
    proxy_discord_send: 'Send Discord message',
    proxy_github_repos: 'View GitHub repos',
    proxy_github_notifications: 'Check GitHub notifications',
    proxy_calendar_events: 'View calendar',
    proxy_twitter_post: 'Post to Twitter',
    wikipedia_lookup: 'Search Wikipedia',
    registry_list: 'List available endpoints',
    registry_apps: 'List connected apps',
    app_notifications: 'Check app notifications',
    app_messages: 'View app messages',
    apps_connected: 'Show connected apps',
    app_query: 'Query an app',
    external_launch: 'Open external app',
    generic: '',
  };
  
  for (const intent of intents) {
    const suggestion = intentSuggestions[intent];
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }
  
  return suggestions.slice(0, 5);
}
