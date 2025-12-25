import type { FlowStep, Intent, NLIntent, Session } from '../types';
import { parseIntent } from './intent';
import { loadRegistry, getEndpointSync } from './registryAdapter';

interface ComposedFlow {
  steps: FlowStep[];
  intents: NLIntent[];
  explanation: string;
  requiresAI: boolean;
}

interface IntentChunk {
  text: string;
  intent: Intent | null;
}

const CONJUNCTION_PATTERNS = [
  /\s+and\s+(?:then\s+)?/i,
  /\s+then\s+/i,
  /\s*,\s*(?:and\s+)?(?:then\s+)?/i,
  /\s+after\s+that\s+/i,
  /\s+also\s+/i,
  /\s+plus\s+/i,
];

const COMPOUND_INTENT_PATTERNS = [
  {
    pattern: /send\s+(?:the\s+)?meeting\s+(?:link|invite)\s+to\s+(\w+)\s+and\s+play\s+(?:focus\s+)?music/i,
    intents: ['proxy_calendar_events', 'proxy_gmail_compose', 'proxy_spotify_play'] as NLIntent[],
    description: 'Get meeting → Email attendee → Play music',
  },
  {
    pattern: /check\s+(?:my\s+)?(?:calendar|schedule)\s+and\s+(?:send|email)\s+(?:it\s+)?to\s+(\w+)/i,
    intents: ['proxy_calendar_events', 'proxy_gmail_compose'] as NLIntent[],
    description: 'Get calendar → Email summary',
  },
  {
    pattern: /(?:get|check)\s+(?:my\s+)?(?:notifications|messages)\s+and\s+(?:summarize|tell\s+me)/i,
    intents: ['messages_inbox'] as NLIntent[],
    description: 'Get messages and summarize',
  },
  {
    pattern: /(?:play|start)\s+(?:some\s+)?music\s+and\s+(?:dim|set)\s+(?:the\s+)?lights/i,
    intents: ['proxy_spotify_play'] as NLIntent[],
    description: 'Play music and set ambiance',
  },
  {
    pattern: /email\s+(\w+)\s+(?:about\s+)?(?:the\s+)?meeting\s+(?:and\s+)?(?:then\s+)?play\s+(?:focus\s+)?music/i,
    intents: ['proxy_gmail_compose', 'proxy_spotify_play'] as NLIntent[],
    description: 'Compose email → Play focus music',
  },
];

export function splitByConjunctions(query: string): string[] {
  let segments: string[] = [query];
  
  for (const pattern of CONJUNCTION_PATTERNS) {
    const newSegments: string[] = [];
    for (const segment of segments) {
      const parts = segment.split(pattern).filter(p => p.trim().length > 0);
      newSegments.push(...parts);
    }
    segments = newSegments;
  }
  
  return segments.map(s => s.trim()).filter(s => s.length > 2);
}

export function detectCompoundIntent(query: string): { intents: NLIntent[]; description: string } | null {
  for (const compound of COMPOUND_INTENT_PATTERNS) {
    if (compound.pattern.test(query)) {
      return { intents: compound.intents, description: compound.description };
    }
  }
  return null;
}

function buildStepFromIntent(nlIntent: NLIntent, params: Record<string, any> = {}): FlowStep | null {
  const feature = intentToFeature(nlIntent);
  const endpoint = getEndpointSync(feature);
  if (!endpoint) return null;
  
  return {
    key: feature,
    args: params,
  };
}

export function composeFlow(query: string, role: string = 'user'): ComposedFlow {
  const compound = detectCompoundIntent(query);
  if (compound) {
    const steps: FlowStep[] = [];
    for (const nlIntent of compound.intents) {
      const step = buildStepFromIntent(nlIntent);
      if (step) steps.push(step);
    }
    
    return {
      steps,
      intents: compound.intents,
      explanation: compound.description,
      requiresAI: false,
    };
  }
  
  const segments = splitByConjunctions(query);
  
  if (segments.length <= 1) {
    const parsed = parseIntent(query, role);
    if (parsed && parsed.nlIntent && parsed.nlIntent !== 'generic') {
      const step = buildStepFromIntent(parsed.nlIntent, parsed.constraints || {});
      return {
        steps: step ? [step] : [],
        intents: [parsed.nlIntent],
        explanation: `Single action: ${parsed.feature}`,
        requiresAI: false,
      };
    }
    
    return {
      steps: [],
      intents: [],
      explanation: 'Could not parse intent - may need AI reasoning',
      requiresAI: true,
    };
  }
  
  const chunks: IntentChunk[] = segments.map(text => ({
    text,
    intent: parseIntent(text, role),
  }));
  
  const allSteps: FlowStep[] = [];
  const allIntents: NLIntent[] = [];
  
  for (const chunk of chunks) {
    if (chunk.intent && chunk.intent.nlIntent && chunk.intent.nlIntent !== 'generic') {
      const step = buildStepFromIntent(chunk.intent.nlIntent, chunk.intent.constraints || {});
      if (step) allSteps.push(step);
      allIntents.push(chunk.intent.nlIntent);
    }
  }
  
  if (allSteps.length === 0) {
    return {
      steps: [],
      intents: [],
      explanation: 'No matching intents found - may need AI reasoning',
      requiresAI: true,
    };
  }
  
  return {
    steps: allSteps,
    intents: allIntents,
    explanation: `Composed ${allSteps.length} step(s): ${allIntents.join(' → ')}`,
    requiresAI: false,
  };
}

function intentToFeature(intent: NLIntent): string {
  const mapping: Partial<Record<NLIntent, string>> = {
    messages_inbox: 'messages.inbox.list',
    messages_send: 'messages.send',
    messages_compose: 'messages.compose',
    messages_voice_send: 'messages.voice.send',
    messages_voice_compose: 'messages.voice.compose',
    notes_create: 'notes.create',
    notes_compose: 'notes.compose',
    notes_list: 'notes.list',
    gallery_count: 'gallery.count',
    gallery_list: 'gallery.list',
    marketplace_sales_today: 'marketplace.sales.list',
    payments_send: 'payments.send',
    payments_history: 'payments.history',
    dao_vote: 'dao.vote',
    dao_proposals: 'dao.proposals',
    anchors_create: 'anchors.create',
    anchors_verify: 'anchors.verify',
    registry_list: 'registry.endpoints.list',
    registry_apps: 'registry.apps.list',
    external_launch: 'external.launch',
    app_notifications: 'apps.notifications',
    app_messages: 'apps.messages',
    apps_connected: 'apps.connected',
    app_query: 'apps.query',
    proxy_gmail_compose: 'proxy.gmail.compose',
    proxy_gmail_unread: 'proxy.gmail.unread',
    proxy_spotify_play: 'proxy.spotify.play',
    proxy_spotify_pause: 'proxy.spotify.pause',
    proxy_spotify_current: 'proxy.spotify.current',
    proxy_slack_send: 'proxy.slack.send',
    proxy_slack_unread: 'proxy.slack.unread',
    proxy_discord_send: 'proxy.discord.send',
    proxy_github_repos: 'proxy.github.repos',
    proxy_github_notifications: 'proxy.github.notifications',
    proxy_calendar_events: 'proxy.gcalendar.events',
    proxy_twitter_post: 'proxy.twitter.post',
    wikipedia_lookup: 'atlas.wikipedia.search',
    generic: 'generic',
  };
  return mapping[intent] || 'generic';
}

export async function composeFlowWithAI(
  query: string,
  role: string,
  aiProvider: { provider: 'openai' | 'anthropic' | 'gemini'; apiKey: string; model?: string }
): Promise<ComposedFlow> {
  const basicFlow = composeFlow(query, role);
  
  if (!basicFlow.requiresAI || basicFlow.steps.length > 0) {
    return basicFlow;
  }
  
  const registry = loadRegistry();
  const endpointList = Object.entries(registry.endpoints)
    .slice(0, 50)
    .map(([key, ep]) => `- ${key}: ${ep.description || ep.fn}`)
    .join('\n');
  
  const systemPrompt = `You are Atlas, a protocol-native intent router for a Web3 mesh OS.
Given a user query, identify which endpoints should be called and in what order.

Available endpoints:
${endpointList}

Respond with a JSON array of endpoint keys to call in order. Example:
["proxy.gmail.compose", "proxy.spotify.play"]

If no endpoints match, respond with an empty array: []
Only respond with the JSON array, nothing else.`;

  try {
    const apiUrl = aiProvider.provider === 'openai' 
      ? '/api/ai/openai/chat'
      : aiProvider.provider === 'anthropic'
      ? '/api/ai/anthropic/chat'
      : '/api/ai/gemini/chat';
    
    const response = await fetch(`http://localhost:5000${apiUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': aiProvider.apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        model: aiProvider.model,
      }),
    });
    
    const data = await response.json() as { reply?: string; error?: string };
    
    if (data.error || !data.reply) {
      return basicFlow;
    }
    
    const match = data.reply.match(/\[[\s\S]*?\]/);
    if (!match) {
      return basicFlow;
    }
    
    const endpoints: string[] = JSON.parse(match[0]);
    const steps: FlowStep[] = endpoints.map(key => ({ key, args: {} }));
    
    return {
      steps,
      intents: [],
      explanation: `AI-composed flow: ${endpoints.join(' → ')}`,
      requiresAI: true,
    };
  } catch (err) {
    console.warn('[flowComposer] AI composition failed:', err);
    return basicFlow;
  }
}

export function validateFlowAgainstSession(flow: ComposedFlow, session: Session): {
  valid: boolean;
  missingEndpoints: string[];
  availableEndpoints: string[];
} {
  const availableEndpoints = Object.values(session.capabilityMap).flat();
  const missingEndpoints = flow.steps
    .map(s => s.key)
    .filter(key => !availableEndpoints.includes(key));
  
  return {
    valid: missingEndpoints.length === 0,
    missingEndpoints,
    availableEndpoints,
  };
}
