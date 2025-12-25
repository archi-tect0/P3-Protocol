import type { Intent, NLIntent } from '../types';
import { findEndpointByQuery } from './registryAdapter';

function extractTimeRange(text: string): 'day' | 'week' | 'month' | 'hour' {
  const lower = text.toLowerCase();
  if (/yesterday|24\s*h|last\s*day/i.test(lower)) return 'day';
  if (/this\s*week|7\s*d|last\s*week|weekly/i.test(lower)) return 'week';
  if (/this\s*month|30\s*d|last\s*month|monthly/i.test(lower)) return 'month';
  if (/last\s*hour|hour|recently|just\s*now/i.test(lower)) return 'hour';
  return 'day';
}

interface PhrasePattern {
  pattern: RegExp;
  nlIntent: NLIntent;
  feature: string;
  extractParams?: (match: RegExpMatchArray) => Record<string, any>;
}

const phrasePatterns: PhrasePattern[] = [
  // Knowledge Base Queries - HIGHEST PRIORITY (with optional trailing punctuation)
  {
    pattern: /^(?:what\s+is\s+(?:the\s+)?p3\s*(?:protocol)?|tell\s+me\s+about\s+p3|explain\s+p3)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'p3-protocol' }),
  },
  {
    pattern: /^(?:what\s+is\s+nexus(?:\s+encryption)?|explain\s+nexus(?:\s+encryption)?|nexus\s+encryption|how\s+does\s+(?:nexus\s+)?encryption\s+work|tell\s+me\s+about\s+(?:nexus\s+)?encryption)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'nexus-encryption' }),
  },
  {
    pattern: /^(?:how\s+does\s+gating\s+work|what\s+is\s+(?:wallet\s+)?gating|explain\s+(?:wallet\s+)?gating|tell\s+me\s+about\s+gating|token\s+gating)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'gating' }),
  },
  {
    pattern: /^(?:what\s+is\s+node\s*mode|explain\s+node\s*mode|tell\s+me\s+about\s+node\s*mode|how\s+does\s+node\s*mode\s+work)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'node-mode' }),
  },
  {
    pattern: /^(?:what\s+(?:are\s+)?(?:the\s+)?canvas\s+modes?|explain\s+canvas\s+modes?|list\s+(?:all\s+)?modes?|show\s+(?:all\s+)?modes?)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'canvas-modes' }),
  },
  {
    pattern: /^(?:what\s+is\s+blockchain\s+anchoring|explain\s+(?:blockchain\s+)?anchoring|how\s+(?:does\s+)?anchoring\s+work|tell\s+me\s+about\s+anchoring)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'blockchain-anchoring' }),
  },
  {
    pattern: /^(?:how\s+do\s+payments?\s+work|explain\s+payments?|tell\s+me\s+about\s+payments?|how\s+(?:can\s+i|do\s+i)\s+(?:send|receive)\s+(?:payments?|crypto|money))\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'payments' }),
  },
  // Wikipedia Help - when user asks about Wikipedia without a search term
  {
    pattern: /^(?:wikipedia|wiki|search\s+wikipedia|wikipedia\s+search|wikipedia\s+help|how\s+(?:do\s+i\s+|to\s+)?(?:use|search)\s+wikipedia|help\s+(?:with\s+)?wikipedia)$/i,
    nlIntent: 'wikipedia_help',
    feature: 'atlas.wikipedia.help',
  },
  // Wikipedia - HIGH PRIORITY (must be before general search patterns)
  {
    pattern: /^(?:(?:search\s+)?wikipedia\s+(?:for\s+)?(.+)|open\s+wikipedia\s+(.+)|look\s+up\s+(.+)\s+(?:on\s+)?wikipedia|wiki\s+(.+))$/i,
    nlIntent: 'wikipedia_lookup',
    feature: 'atlas.wikipedia.search',
    extractParams: (match) => ({ term: match[1] || match[2] || match[3] || match[4] || '' }),
  },
  {
    pattern: /^(?:search\s+(.+)\s+on\s+wikipedia|search\s+wikipedia\s+for\s+(.+))$/i,
    nlIntent: 'wikipedia_lookup',
    feature: 'atlas.wikipedia.search',
    extractParams: (match) => ({ term: match[1] || match[2] || '' }),
  },
  {
    pattern: /^(?:tell\s+me\s+about\s+(.+)\s+(?:from\s+)?wikipedia|what\s+does\s+wikipedia\s+say\s+about\s+(.+))$/i,
    nlIntent: 'wikipedia_lookup',
    feature: 'atlas.wikipedia.search',
    extractParams: (match) => ({ term: match[1] || match[2] || '' }),
  },
  // Atlas Commands & Capabilities - MUST BE BEFORE Wikipedia "what is X" pattern
  {
    pattern: /^(?:what\s+is\s+atlas|tell\s+me\s+about\s+atlas)\??$/i,
    nlIntent: 'knowledge_query',
    feature: 'knowledge.topic',
    extractParams: () => ({ topicId: 'atlas-overview' }),
  },
  // General Wikipedia "what is X" pattern - AFTER knowledge patterns
  {
    pattern: /^(?:who\s+(?:is|was)\s+(.+)|what\s+(?:is|are|was|were)\s+(?:the\s+)?(.+))$/i,
    nlIntent: 'wikipedia_lookup',
    feature: 'atlas.wikipedia.search',
    extractParams: (match) => ({ term: match[1] || match[2] || '' }),
  },
  {
    pattern: /^(?:what\s+can\s+(?:atlas|you)\s+do|show\s+(?:atlas\s+)?commands|atlas\s+commands|capabilities|show\s+capabilities)$/i,
    nlIntent: 'atlas_capability_open',
    feature: 'atlas.capability.open',
  },
  {
    pattern: /^(?:show|list)\s+(?:all\s+)?(?:available\s+)?(?:commands|atlas\s+commands)/i,
    nlIntent: 'atlas_capability_open',
    feature: 'atlas.capability.open',
  },
  {
    pattern: /^(?:what\s+(?:commands?|things?)\s+(?:can\s+i|do\s+you)\s+(?:do|say|use)|how\s+do\s+i\s+use\s+atlas)/i,
    nlIntent: 'atlas_capability_open',
    feature: 'atlas.capability.open',
  },
  {
    pattern: /^(?:atlas\s+)?(?:help\s+me|show\s+help|command\s+help|voice\s+commands)/i,
    nlIntent: 'atlas_capability_open',
    feature: 'atlas.capability.open',
  },
  {
    pattern: /^(?:help|how (?:do i use|can i use) atlas)$/i,
    nlIntent: 'atlas_capability_open',
    feature: 'atlas.capability.open',
  },
  {
    pattern: /^what (?:can you do|are you(?:r)? (?:capabilities|features)|do you do|are your (?:capabilities|features))/i,
    nlIntent: 'atlas_capability_open',
    feature: 'atlas.capability.open',
  },
  // DevKit Q&A - developer queries
  {
    pattern: /^atlas devkit (.+)$/i,
    nlIntent: 'devkit_query',
    feature: 'devkit.query',
    extractParams: (match) => ({ query: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:show|list|what are)\s+(?:the\s+)?(?:available\s+)?(?:devkit\s+)?endpoints$/i,
    nlIntent: 'devkit_endpoints',
    feature: 'devkit.endpoints',
  },
  {
    pattern: /^(?:show|list|what are)\s+(?:the\s+)?(?:available\s+)?(?:devkit\s+)?flows$/i,
    nlIntent: 'devkit_flows',
    feature: 'devkit.flows',
  },
  {
    pattern: /^(?:show|list|what are)\s+(?:the\s+)?(?:available\s+)?(?:devkit\s+)?apps$/i,
    nlIntent: 'devkit_apps',
    feature: 'devkit.apps',
  },
  {
    pattern: /^(?:describe|explain|what is)\s+(?:the\s+)?(?:endpoint\s+)?([a-z0-9._-]+)$/i,
    nlIntent: 'devkit_describe',
    feature: 'devkit.describe',
    extractParams: (match) => ({ endpoint: match[1]?.trim() || '' }),
  },
  // DevKit-specific help - for developer-focused queries
  {
    pattern: /^how many (?:endpoints?|apis?|features?) (?:do you have|are there|are available)/i,
    nlIntent: 'devkit_help',
    feature: 'devkit.help',
  },
  {
    pattern: /^how (?:do i|to)\s+(?:build|develop|create)\s+(?:on|with)\s+p3/i,
    nlIntent: 'devkit_help',
    feature: 'devkit.help',
  },
  {
    pattern: /^(?:what|tell me about|explain)\s+(?:the\s+)?(?:developer|dev)\s+(?:kit|sdk|tools)/i,
    nlIntent: 'devkit_help',
    feature: 'devkit.help',
  },
  // Admin Analytics - requires admin role
  {
    pattern: /how many (?:users|visitors|people|wallets)(?:\s+(?:do i have|did i have|have i had|today|this week|this month|yesterday))?/i,
    nlIntent: 'admin_analytics_visitors',
    feature: 'admin.analytics.visitors',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:show|get|display|what are|give me)\s+(?:my\s+)?(?:analytics|metrics|stats|statistics|numbers)/i,
    nlIntent: 'admin_analytics_metrics',
    feature: 'admin.analytics.metrics',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:who|which users|which wallets)\s+(?:visited|used|connected|signed in)(?:\s+(?:today|this week|this month|yesterday|recently))?/i,
    nlIntent: 'admin_analytics_visitors',
    feature: 'admin.analytics.visitors',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:list|show)\s+(?:my\s+)?(?:visitors|users|wallets|active users)(?:\s+(?:today|this week|this month|yesterday))?/i,
    nlIntent: 'admin_analytics_visitors',
    feature: 'admin.analytics.visitors',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:total|number of|how many)\s+(?:api\s+)?(?:calls|requests|transactions|queries)(?:\s+(?:today|this week|this month|yesterday))?/i,
    nlIntent: 'admin_analytics_calls',
    feature: 'admin.analytics.calls',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:error|failure|problem)\s+(?:rate|count|summary|report)(?:\s+(?:today|this week|this month|yesterday))?/i,
    nlIntent: 'admin_analytics_errors',
    feature: 'admin.analytics.errors',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:any|show|list|recent)\s+(?:errors|failures|problems|issues)(?:\s+(?:today|this week|recently|in the last hour))?/i,
    nlIntent: 'admin_analytics_errors',
    feature: 'admin.analytics.errors',
    extractParams: (match) => ({ range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:endpoint|api)\s+(?:breakdown|usage|performance|stats)/i,
    nlIntent: 'admin_analytics_metrics',
    feature: 'admin.analytics.endpoints',
    extractParams: (match) => ({ range: extractTimeRange(match[0]), breakdown: 'endpoints' }),
  },
  {
    pattern: /(?:which|what)\s+(?:endpoints?|apis?)\s+(?:are|is)\s+(?:slowest|fastest|busiest|most used)/i,
    nlIntent: 'admin_analytics_metrics',
    feature: 'admin.analytics.endpoints',
    extractParams: (match) => ({ range: extractTimeRange(match[0]), breakdown: 'endpoints' }),
  },
  {
    pattern: /(?:latency|response time|slow|performance)\s+(?:hotspots?|issues?|problems?)/i,
    nlIntent: 'admin_analytics_metrics',
    feature: 'admin.analytics.latency',
    extractParams: () => ({ breakdown: 'latency' }),
  },
  {
    pattern: /(?:compare|vs|versus)\s+(?:today|yesterday|this week|last week)/i,
    nlIntent: 'admin_analytics_metrics',
    feature: 'admin.analytics.compare',
    extractParams: (match) => ({ compare: true, range: extractTimeRange(match[0]) }),
  },
  {
    pattern: /(?:open|show|go to|take me to)\s+(?:my\s+)?(?:dashboard|admin|metrics|analytics)/i,
    nlIntent: 'admin_dashboard',
    feature: 'admin.dashboard',
  },
  {
    pattern: /^(?:dashboard|admin|metrics)$/i,
    nlIntent: 'admin_dashboard',
    feature: 'admin.dashboard',
  },
  // Launcher fast-path - top priority
  {
    pattern: /^show me my launcher$/i,
    nlIntent: 'show_launcher',
    feature: 'launcher.show',
  },
  {
    pattern: /^(?:open|show|display)\s+(?:my\s+)?launcher$/i,
    nlIntent: 'show_launcher',
    feature: 'launcher.show',
  },
  {
    pattern: /^(?:go to|take me to)\s+(?:my\s+)?launcher$/i,
    nlIntent: 'show_launcher',
    feature: 'launcher.show',
  },
  {
    pattern: /^launcher$/i,
    nlIntent: 'show_launcher',
    feature: 'launcher.show',
  },
  // News - Top stories / Open news canvas (must be before external_launch pattern)
  {
    pattern: /^(?:show\s+(?:me\s+)?(?:the\s+)?(?:news|top\s+stories|today'?s?\s+(?:top\s+)?(?:news|stories|headlines))|open\s+(?:the\s+)?news(?:\s+canvas)?|what'?s?\s+(?:the\s+)?news|news\s+today|latest\s+news|headlines)$/i,
    nlIntent: 'news_top_stories',
    feature: 'atlas.news.top',
  },
  // Node Mode - Start Pulse Node (must be before external_launch pattern)
  {
    pattern: /^(?:start\s+(?:the\s+)?(?:pulse\s+)?node|open\s+(?:the\s+)?node(?:\s+mode)?|become\s+(?:a\s+)?node|join\s+(?:the\s+)?mesh|enable\s+node(?:\s+mode)?)$/i,
    nlIntent: 'atlas_node_open',
    feature: 'atlas.node.start',
  },
  // Chat Mode - Open Atlas Chat canvas
  {
    pattern: /^(?:open|show|launch)\s+(?:the\s+)?(?:atlas\s+)?chat$/i,
    nlIntent: 'atlas_chat_open',
    feature: 'atlas.chat.open',
  },
  {
    pattern: /^(?:atlas\s+)?chat$/i,
    nlIntent: 'atlas_chat_open',
    feature: 'atlas.chat.open',
  },
  {
    pattern: /^(?:go\s+(?:back\s+)?to\s+chat|return\s+to\s+chat|back\s+to\s+chat)$/i,
    nlIntent: 'atlas_chat_open',
    feature: 'atlas.chat.open',
  },
  {
    pattern: /^(?:atlas\s+)?(?:open|show|go to)\s+(?:atlas\s+)?one(?:\s+app)?$/i,
    nlIntent: 'atlas_one_open',
    feature: 'atlas.one.open',
  },
  {
    pattern: /^(?:atlas\s+)?(?:open|show|go to)\s+(?:the\s+)?(?:marketplace|store|library)$/i,
    nlIntent: 'atlas_one_open',
    feature: 'atlas.one.open',
  },
  {
    pattern: /^(?:show|open|display)\s+(?:the\s+)?(?:atlas\s+)?one\s+catalog$/i,
    nlIntent: 'atlas_one_catalog',
    feature: 'atlas.one.catalog',
  },
  {
    pattern: /^(?:show|list|what are)\s+(?:the\s+)?(?:atlas\s+)?one\s+(?:features|capabilities)$/i,
    nlIntent: 'atlas_one_catalog',
    feature: 'atlas.one.catalog',
  },
  {
    pattern: /^(?:show|open|display|launch)\s+(?:the\s+)?game\s*deck(?:\s+catalog)?$/i,
    nlIntent: 'gamedeck_open',
    feature: 'gamedeck.open',
  },
  {
    pattern: /^(?:show|list|what are)\s+(?:the\s+)?game\s*deck\s+(?:features|capabilities|games)$/i,
    nlIntent: 'gamedeck_features',
    feature: 'gamedeck.features',
  },
  // Roku Pairing - Connect TV to Atlas session
  {
    pattern: /^(?:pair|connect)\s+(?:my\s+)?(?:roku|tv|television)$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:connect|link)\s+(?:to\s+)?(?:my\s+)?(?:tv|roku|television)$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:show|get|display)\s+(?:roku|tv)\s+(?:pairing\s+)?code$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:open|show)\s+(?:roku|tv)\s+pairing$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:atlas\s+)?(?:on\s+)?(?:my\s+)?(?:tv|roku|television)$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:put|show|display)\s+(?:this\s+)?(?:on\s+)?(?:the\s+)?(?:tv|roku|television|big\s+screen)$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:i\s+want\s+to\s+)?(?:use|watch|play)\s+(?:atlas\s+)?(?:on\s+)?(?:my\s+)?(?:tv|roku|television)$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^(?:how\s+do\s+i\s+)?(?:connect|pair|link)\s+(?:atlas\s+)?(?:to\s+)?(?:my\s+)?(?:tv|roku)$/i,
    nlIntent: 'roku_pair',
    feature: 'roku.pair',
  },
  {
    pattern: /^show my endpoints$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^my endpoints$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^pulse for my app$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^my pulse$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^personal pulse$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^endpoint pulse$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^show my pulse$/i,
    nlIntent: 'atlas_my_pulse_open',
    feature: 'atlas.pulse.personal',
  },
  {
    pattern: /^(?:open|show|launch)\s+(?:the\s+)?(?:p3\s+)?hub$/i,
    nlIntent: 'atlas_hub_open',
    feature: 'atlas.hub.open',
  },
  {
    pattern: /^(?:p3\s+)?hub$/i,
    nlIntent: 'atlas_hub_open',
    feature: 'atlas.hub.open',
  },
  {
    pattern: /^(?:show|open|launch)\s+(?:app\s+)?launcher$/i,
    nlIntent: 'atlas_hub_open',
    feature: 'atlas.hub.open',
  },
  {
    pattern: /^(?:show|open)\s+(?:all\s+)?apps$/i,
    nlIntent: 'atlas_hub_open',
    feature: 'atlas.hub.open',
  },
  {
    pattern: /^(?:what\s+(?:can\s+you\s+do|apps?\s+(?:do\s+you\s+have|are\s+available)))$/i,
    nlIntent: 'atlas_hub_open',
    feature: 'atlas.hub.open',
  },
  {
    pattern: /^(?:open|show|display)\s+(?:atlas\s+)?pulse$/i,
    nlIntent: 'atlas_pulse_open',
    feature: 'atlas.pulse.open',
  },
  {
    pattern: /^(?:atlas\s+)?pulse$/i,
    nlIntent: 'atlas_pulse_open',
    feature: 'atlas.pulse.open',
  },
  {
    pattern: /^(?:show|check|view)\s+(?:atlas\s+)?(?:health|metrics|analytics|stats|pulse)$/i,
    nlIntent: 'atlas_pulse_open',
    feature: 'atlas.pulse.open',
  },
  {
    pattern: /^(?:how is|how's)\s+(?:atlas|the substrate)\s+(?:doing|performing)$/i,
    nlIntent: 'atlas_pulse_open',
    feature: 'atlas.pulse.open',
  },
  {
    pattern: /^(?:show|open|display)\s+(?:atlas\s+)?efficiency$/i,
    nlIntent: 'atlas_efficiency_open',
    feature: 'atlas.efficiency.open',
  },
  {
    pattern: /^(?:atlas\s+)?efficiency(?:\s+cards)?$/i,
    nlIntent: 'atlas_efficiency_open',
    feature: 'atlas.efficiency.open',
  },
  {
    pattern: /^(?:show|compare)\s+(?:atlas\s+)?(?:api\s+)?(?:performance|efficiency|metrics|comparison)$/i,
    nlIntent: 'atlas_efficiency_open',
    feature: 'atlas.efficiency.open',
  },
  {
    pattern: /^(?:how efficient is|how fast is)\s+(?:atlas|the substrate)$/i,
    nlIntent: 'atlas_efficiency_open',
    feature: 'atlas.efficiency.open',
  },
  {
    pattern: /^(?:open|show)\s+(?:my\s+)?library$/i,
    nlIntent: 'atlas_library_open',
    feature: 'atlas.library.open',
  },
  {
    pattern: /^(?:my\s+)?library$/i,
    nlIntent: 'atlas_library_open',
    feature: 'atlas.library.open',
  },
  {
    pattern: /^(?:show|open)\s+(?:my\s+)?(?:videos|games|ebooks|content)$/i,
    nlIntent: 'atlas_library_open',
    feature: 'atlas.library.open',
  },
  {
    pattern: /^(?:what's in|show)\s+my\s+library$/i,
    nlIntent: 'atlas_library_open',
    feature: 'atlas.library.open',
  },
  {
    pattern: /^(?:open|launch|start)\s+(?:the\s+)?e-?reader$/i,
    nlIntent: 'atlas_library_open',
    feature: 'atlas.library.open',
  },
  {
    pattern: /^open\s+pulse\s+mode$/i,
    nlIntent: 'atlas_pulse_open',
    feature: 'atlas.pulse.open',
  },
  {
    pattern: /^(?:atlas\s+)?launch\s+(?:the\s+)?(?:game\s+)?(.+)$/i,
    nlIntent: 'atlas_one_launch_game',
    feature: 'atlas.one.game.launch',
    extractParams: (match) => ({ title: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?play\s+(?:the\s+)?(?:game\s+)?(.+)$/i,
    nlIntent: 'atlas_one_launch_game',
    feature: 'atlas.one.game.launch',
    extractParams: (match) => ({ title: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?watch\s+(?:the\s+)?(?:movie\s+|show\s+|film\s+)?(.+)$/i,
    nlIntent: 'atlas_one_watch_media',
    feature: 'atlas.one.video.watch',
    extractParams: (match) => ({ title: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?rent\s+(?:the\s+)?(?:movie\s+|show\s+|film\s+)?(.+)$/i,
    nlIntent: 'atlas_one_rent_media',
    feature: 'atlas.one.video.rent',
    extractParams: (match) => ({ title: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?read\s+(?:the\s+)?(?:book\s+|ebook\s+)?(.+)$/i,
    nlIntent: 'atlas_one_read_book',
    feature: 'atlas.one.ebook.read',
    extractParams: (match) => ({ title: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?(?:is\s+)?(.+?)\s+(?:available|for rent|out now|released)\??$/i,
    nlIntent: 'atlas_one_search',
    feature: 'atlas.one.search',
    extractParams: (match) => ({ query: match[1]?.trim() || '' }),
  },
  {
    // Exclude Wikipedia searches - they're handled by dedicated wikipedia_lookup patterns
    pattern: /^(?:atlas\s+)?search\s+(?:for\s+)?(?!wikipedia\b)(?!wiki\b)(?!.+?\s+on\s+wikipedia)(.+)$/i,
    nlIntent: 'atlas_one_search',
    feature: 'atlas.one.search',
    extractParams: (match) => ({ query: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?(?:buy|purchase)\s+(?:the\s+)?(.+)$/i,
    nlIntent: 'atlas_one_purchase',
    feature: 'atlas.one.purchase',
    extractParams: (match) => ({ title: match[1]?.trim() || '' }),
  },
  {
    pattern: /^(?:atlas\s+)?(?:show|find|get|list)\s+(?:me\s+)?(?:some\s+)?(?:games|movies|books|ebooks|apps|products|audio)$/i,
    nlIntent: 'atlas_one_browse',
    feature: 'atlas.one.browse',
    extractParams: (match) => ({ kind: match[0].match(/games|movies|books|ebooks|apps|products|audio/i)?.[0] || '' }),
  },
  {
    pattern: /what (?:sdk )?endpoints|available (?:apis?|endpoints)|list (?:apis?|endpoints)|show (?:apis?|endpoints)|what are the apis/i,
    nlIntent: 'registry_list',
    feature: 'registry.endpoints.list',
  },
  {
    pattern: /what apps|available apps|list apps|show apps|connected apps/i,
    nlIntent: 'registry_apps',
    feature: 'registry.apps.list',
  },
  {
    pattern: /open (.+)|launch (.+)|go to (.+)|start (.+)/i,
    nlIntent: 'external_launch',
    feature: 'external.launch',
    extractParams: (match) => ({ appName: match[1] || match[2] || match[3] || match[4] || '' }),
  },
  { 
    pattern: /do i have any messages|check my inbox|new messages|any messages|check your messages/i,
    nlIntent: 'messages_inbox',
    feature: 'messages.inbox.list',
  },
  {
    pattern: /^send a message$/i,
    nlIntent: 'messages_inbox',
    feature: 'messages.inbox.list',
  },
  {
    pattern: /send (.+?) a message|message (.+)/i,
    nlIntent: 'messages_send',
    feature: 'messages.send',
    extractParams: (match) => ({ recipient: match[1] || match[2] || '' }),
  },
  {
    pattern: /^send a voice message$/i,
    nlIntent: 'messages_inbox',
    feature: 'messages.inbox.list',
  },
  {
    pattern: /send (.+?) a voice message|voice message (.+)/i,
    nlIntent: 'messages_voice_send',
    feature: 'messages.voice.send',
    extractParams: (match) => ({ recipient: match[1] || match[2] || '' }),
  },
  {
    pattern: /^create a new note$/i,
    nlIntent: 'notes_create',
    feature: 'notes.create',
  },
  {
    pattern: /write a note|new note|create note|take a note/i,
    nlIntent: 'notes_create',
    feature: 'notes.create',
  },
  {
    pattern: /^view (?:your|my) notes$/i,
    nlIntent: 'notes_list',
    feature: 'notes.list',
  },
  {
    pattern: /my notes|list notes|show notes/i,
    nlIntent: 'notes_list',
    feature: 'notes.list',
  },
  {
    pattern: /how many pictures|pictures in my gallery|photos count|gallery count/i,
    nlIntent: 'gallery_count',
    feature: 'gallery.count',
  },
  {
    pattern: /show my gallery|list pictures|my photos/i,
    nlIntent: 'gallery_list',
    feature: 'gallery.list',
  },
  {
    pattern: /sell.*books.*today|marketplace.*sales.*today|sales today/i,
    nlIntent: 'marketplace_sales_today',
    feature: 'marketplace.sales.list',
    extractParams: () => ({ range: 'day' }),
  },
  {
    pattern: /send (?:payment|money) to (.+)|pay (.+)/i,
    nlIntent: 'payments_send',
    feature: 'payments.send',
    extractParams: (match) => ({ recipient: match[1] || match[2] || '' }),
  },
  {
    pattern: /payment history|my transactions|recent payments/i,
    nlIntent: 'payments_history',
    feature: 'payments.history',
  },
  {
    pattern: /vote (?:on|for) (.+)|cast vote/i,
    nlIntent: 'dao_vote',
    feature: 'dao.vote',
    extractParams: (match) => ({ proposalId: match[1] || '' }),
  },
  {
    pattern: /proposals|dao proposals|active proposals/i,
    nlIntent: 'dao_proposals',
    feature: 'dao.proposals',
  },
  {
    pattern: /create anchor|anchor this|notarize/i,
    nlIntent: 'anchors_create',
    feature: 'anchors.create',
  },
  {
    pattern: /verify anchor|check anchor|validate proof/i,
    nlIntent: 'anchors_verify',
    feature: 'anchors.verify',
  },
  // Admin Analytics - wallet-gated to ADMIN_WALLET
  {
    pattern: /(?:show|give me|what(?:'s| is))\s+(?:my\s+)?(?:site\s+)?analytics(?:\s+(?:for\s+)?(?:the\s+)?(?:last\s+)?(24h|7d|30d|today|week|month))?/i,
    nlIntent: 'analytics_overview',
    feature: 'analytics.overview',
    extractParams: (match) => {
      const rangeMap: Record<string, string> = { 'today': '24h', 'week': '7d', 'month': '30d' };
      const raw = match[1]?.toLowerCase() || '24h';
      return { range: rangeMap[raw] || raw };
    },
  },
  {
    pattern: /how many (?:visitors?|users?|views?|people)(?:\s+(?:did\s+)?(?:i\s+)?(?:get|have|had))?(?:\s+(?:in\s+)?(?:the\s+)?(?:last\s+)?(24h|7d|30d|today|week|month))?/i,
    nlIntent: 'analytics_traffic',
    feature: 'analytics.traffic',
    extractParams: (match) => {
      const rangeMap: Record<string, string> = { 'today': '24h', 'week': '7d', 'month': '30d' };
      const raw = match[1]?.toLowerCase() || '24h';
      return { range: rangeMap[raw] || raw };
    },
  },
  {
    pattern: /(?:where|which)\s+(?:did\s+)?(?:my\s+)?(?:traffic|visitors?|users?)\s+(?:come|coming)\s+from|top\s+referrers?|referrer\s+(?:data|stats)/i,
    nlIntent: 'analytics_referrers',
    feature: 'analytics.referrers',
    extractParams: () => ({ range: '24h' }),
  },
  {
    pattern: /(?:how many|any)\s+(?:visitors?|users?|people)\s+(?:from|came from)\s+(.+)/i,
    nlIntent: 'analytics_referrers',
    feature: 'analytics.referrers',
    extractParams: (match) => ({ referrerFilter: match[1]?.trim().toLowerCase() || '', range: '24h' }),
  },
  {
    pattern: /(?:top|most\s+(?:viewed|popular))\s+pages?|which\s+pages?\s+(?:are|get)\s+(?:the\s+)?most\s+(?:views?|traffic)/i,
    nlIntent: 'analytics_pages',
    feature: 'analytics.pages',
    extractParams: () => ({ range: '24h' }),
  },
  {
    pattern: /(?:what|which)\s+(?:devices?|browsers?)\s+(?:are\s+)?(?:my\s+)?(?:visitors?|users?)\s+(?:using|on)/i,
    nlIntent: 'analytics_devices',
    feature: 'analytics.devices',
    extractParams: () => ({ range: '24h' }),
  },
  // External App Proxy Actions - Gmail
  {
    pattern: /(?:send|write|compose)\s+(?:an?\s+)?email\s+to\s+(.+)/i,
    nlIntent: 'proxy_gmail_compose',
    feature: 'proxy.gmail.compose',
    extractParams: (match) => ({ to: match[1]?.trim() || '', app: 'gmail' }),
  },
  {
    pattern: /(?:check|how many|any)\s+(?:unread\s+)?emails?/i,
    nlIntent: 'proxy_gmail_unread',
    feature: 'proxy.gmail.unread',
    extractParams: () => ({ app: 'gmail' }),
  },
  // External App Proxy Actions - Spotify
  {
    pattern: /play\s+(?:music|song|track|artist)?\s*(.+)?/i,
    nlIntent: 'proxy_spotify_play',
    feature: 'proxy.spotify.play',
    extractParams: (match) => ({ query: match[1]?.trim() || '', app: 'spotify' }),
  },
  {
    pattern: /(?:pause|stop)\s+(?:music|playback|spotify)/i,
    nlIntent: 'proxy_spotify_pause',
    feature: 'proxy.spotify.pause',
    extractParams: () => ({ app: 'spotify' }),
  },
  {
    pattern: /what(?:'s| is)\s+playing|now playing|current (?:song|track)/i,
    nlIntent: 'proxy_spotify_current',
    feature: 'proxy.spotify.current',
    extractParams: () => ({ app: 'spotify' }),
  },
  // External App Proxy Actions - Slack
  {
    pattern: /(?:send|post)\s+(?:a\s+)?slack\s+(?:message)?\s*(?:to\s+)?(.+)?/i,
    nlIntent: 'proxy_slack_send',
    feature: 'proxy.slack.send',
    extractParams: (match) => ({ channel: match[1]?.trim() || '#general', app: 'slack' }),
  },
  {
    pattern: /(?:check|any)\s+slack\s+(?:messages?|notifications?)/i,
    nlIntent: 'proxy_slack_unread',
    feature: 'proxy.slack.unread',
    extractParams: () => ({ app: 'slack' }),
  },
  // External App Proxy Actions - Discord
  {
    pattern: /(?:send|post)\s+(?:a\s+)?discord\s+(?:message)?\s*(?:to\s+)?(.+)?/i,
    nlIntent: 'proxy_discord_send',
    feature: 'proxy.discord.send',
    extractParams: (match) => ({ channel: match[1]?.trim() || 'general', app: 'discord' }),
  },
  // External App Proxy Actions - GitHub
  {
    pattern: /(?:my|check)\s+(?:github\s+)?repos?(?:itories)?/i,
    nlIntent: 'proxy_github_repos',
    feature: 'proxy.github.repos',
    extractParams: () => ({ app: 'github' }),
  },
  {
    pattern: /github\s+notifications?/i,
    nlIntent: 'proxy_github_notifications',
    feature: 'proxy.github.notifications',
    extractParams: () => ({ app: 'github' }),
  },
  // External App Proxy Actions - Calendar
  {
    pattern: /(?:my|today(?:'s)?|this week(?:'s)?)\s+(?:calendar\s+)?(?:events?|meetings?|schedule)/i,
    nlIntent: 'proxy_calendar_events',
    feature: 'proxy.gcalendar.events',
    extractParams: () => ({ app: 'gcalendar' }),
  },
  // External App Proxy Actions - Twitter/X
  {
    pattern: /(?:post|tweet|send)\s+(?:on\s+)?(?:twitter|x)\s*[:\s]*(.+)?/i,
    nlIntent: 'proxy_twitter_post',
    feature: 'proxy.twitter.post',
    extractParams: (match) => ({ text: match[1]?.trim() || '', app: 'twitter' }),
  },
  // App-specific queries - notifications
  {
    pattern: /(?:what(?:'s| is| are)?|check|show|any|do i have(?: any)?)\s*(?:my\s+)?notifications?\s+(?:on|from|in)\s+(.+)/i,
    nlIntent: 'app_notifications',
    feature: 'apps.notifications',
    extractParams: (match) => ({ appName: match[1]?.trim() || '' }),
  },
  {
    pattern: /(.+?)\s+notifications?(?:\s+count)?/i,
    nlIntent: 'app_notifications',
    feature: 'apps.notifications',
    extractParams: (match) => ({ appName: match[1]?.trim() || '' }),
  },
  // App-specific queries - messages
  {
    pattern: /(?:what(?:'s| is| are)?|check|show|any|do i have(?: any)?)\s*(?:my\s+)?(?:messages?|dms?|inbox)\s+(?:on|from|in)\s+(.+)/i,
    nlIntent: 'app_messages',
    feature: 'apps.messages',
    extractParams: (match) => ({ appName: match[1]?.trim() || '' }),
  },
  {
    pattern: /(.+?)\s+(?:messages?|dms?|inbox)/i,
    nlIntent: 'app_messages',
    feature: 'apps.messages',
    extractParams: (match) => ({ appName: match[1]?.trim() || '' }),
  },
  // Connected apps query
  {
    pattern: /what apps (?:are |do i have )?connected|my connected apps|which apps|what(?:'s| is) connected/i,
    nlIntent: 'apps_connected',
    feature: 'apps.connected',
  },
  // App data query - generic
  {
    pattern: /(?:what(?:'s| is)?|show|check)\s+(?:my\s+)?(.+?)\s+(?:on|from|in)\s+(.+)/i,
    nlIntent: 'app_query',
    feature: 'apps.query',
    extractParams: (match) => ({ 
      dataType: match[1]?.trim() || '',
      appName: match[2]?.trim() || '' 
    }),
  },
  // Session Memory - Pinned Apps
  {
    pattern: /(?:show|list|what are)\s+(?:my\s+)?pinned\s+apps?/i,
    nlIntent: 'memory_pinned',
    feature: 'memory.pinned',
  },
  {
    pattern: /(?:my\s+)?pinned\s+apps?/i,
    nlIntent: 'memory_pinned',
    feature: 'memory.pinned',
  },
  {
    pattern: /pin\s+(?:the\s+)?(?:app\s+)?(.+)/i,
    nlIntent: 'memory_pin',
    feature: 'memory.pin',
    extractParams: (match) => ({ appId: match[1]?.trim() || '' }),
  },
  {
    pattern: /(?:add\s+)?(.+?)\s+to\s+(?:my\s+)?pinned/i,
    nlIntent: 'memory_pin',
    feature: 'memory.pin',
    extractParams: (match) => ({ appId: match[1]?.trim() || '' }),
  },
  {
    pattern: /unpin\s+(?:the\s+)?(?:app\s+)?(.+)/i,
    nlIntent: 'memory_unpin',
    feature: 'memory.unpin',
    extractParams: (match) => ({ appId: match[1]?.trim() || '' }),
  },
  {
    pattern: /remove\s+(.+?)\s+from\s+(?:my\s+)?pinned/i,
    nlIntent: 'memory_unpin',
    feature: 'memory.unpin',
    extractParams: (match) => ({ appId: match[1]?.trim() || '' }),
  },
  // Session Memory - Recent Flows
  {
    pattern: /(?:what did i|show me what i)\s+(?:run|ran|do|did)\s+(?:last|recently)/i,
    nlIntent: 'memory_flows',
    feature: 'memory.flows',
  },
  {
    pattern: /(?:my\s+)?(?:recent|last)\s+(?:flows?|actions?|commands?)/i,
    nlIntent: 'memory_flows',
    feature: 'memory.flows',
  },
  // Session Memory - Recent Queries
  {
    pattern: /(?:what did i|show me what i)\s+(?:ask|asked|search|searched)\s+(?:for\s+)?(?:last|recently)?/i,
    nlIntent: 'memory_queries',
    feature: 'memory.queries',
  },
  {
    pattern: /(?:my\s+)?(?:recent|last)\s+(?:queries|questions|searches)/i,
    nlIntent: 'memory_queries',
    feature: 'memory.queries',
  },
  {
    pattern: /(?:my\s+)?(?:search|query)\s+history/i,
    nlIntent: 'memory_queries',
    feature: 'memory.queries',
  },
  // Session Memory - Clear History
  {
    pattern: /clear\s+(?:my\s+)?(?:all\s+)?history/i,
    nlIntent: 'memory_clear',
    feature: 'memory.clear',
    extractParams: () => ({ type: 'all' }),
  },
  {
    pattern: /clear\s+(?:my\s+)?(?:flow|recent)\s+history/i,
    nlIntent: 'memory_clear',
    feature: 'memory.clear',
    extractParams: () => ({ type: 'flows' }),
  },
  {
    pattern: /clear\s+(?:my\s+)?(?:query|search)\s+history/i,
    nlIntent: 'memory_clear',
    feature: 'memory.clear',
    extractParams: () => ({ type: 'queries' }),
  },
  {
    pattern: /forget\s+(?:my\s+)?(?:history|past)/i,
    nlIntent: 'memory_clear',
    feature: 'memory.clear',
    extractParams: () => ({ type: 'all' }),
  },
  // Meta-Adapter - Public APIs
  {
    pattern: /(?:list|show|what are)\s+(?:the\s+)?(?:public|auto[- ]?integrated|available)\s+apis?/i,
    nlIntent: 'meta_list_apis',
    feature: 'meta.apis.list',
  },
  {
    pattern: /(?:search|find)\s+(?:public\s+)?apis?\s+(?:for\s+)?(.+)/i,
    nlIntent: 'meta_search_apis',
    feature: 'meta.apis.search',
    extractParams: (match) => ({ query: match[1]?.trim() || '' }),
  },
  {
    pattern: /(?:what|which)\s+(.+?)\s+apis?\s+(?:are\s+)?(?:available|integrated)/i,
    nlIntent: 'meta_search_apis',
    feature: 'meta.apis.search',
    extractParams: (match) => ({ query: match[1]?.trim() || '' }),
  },
  // Meta-Adapter - Weather
  {
    pattern: /(?:what(?:'s| is)?\s+(?:the\s+)?)?weather(?:\s+(?:in|for|at)\s+(.+))?/i,
    nlIntent: 'meta_weather',
    feature: 'public.open_meteo.forecast',
    extractParams: (match) => ({ location: match[1]?.trim() || '' }),
  },
  {
    pattern: /(?:check|get)\s+(?:the\s+)?(?:current\s+)?weather/i,
    nlIntent: 'meta_weather',
    feature: 'public.open_meteo.forecast',
  },
  // Meta-Adapter - Jokes
  {
    pattern: /(?:tell\s+(?:me\s+)?a?\s*|random\s+|get\s+(?:a\s+)?)?joke/i,
    nlIntent: 'meta_joke',
    feature: 'public.jokeapi.random',
  },
  {
    pattern: /(?:make|tell)\s+me\s+laugh/i,
    nlIntent: 'meta_joke',
    feature: 'public.jokeapi.random',
  },
  // Meta-Adapter - Crypto
  {
    pattern: /(?:what(?:'s| is)?\s+(?:the\s+)?)?(?:bitcoin|btc|crypto)\s*(?:price)?/i,
    nlIntent: 'meta_crypto',
    feature: 'public.coingecko.prices',
  },
  {
    pattern: /(?:check|get)\s+(?:crypto(?:currency)?|bitcoin|ethereum)\s+prices?/i,
    nlIntent: 'meta_crypto',
    feature: 'public.coingecko.prices',
  },
  // Meta-Adapter - Holidays
  {
    pattern: /(?:what(?:'s| is)?\s+(?:the\s+)?)?(?:next\s+)?(?:public\s+)?holiday/i,
    nlIntent: 'meta_holiday',
    feature: 'public.nager_date.nextHoliday',
  },
  {
    pattern: /(?:when\s+is\s+(?:the\s+)?)?next\s+(?:public\s+)?holiday/i,
    nlIntent: 'meta_holiday',
    feature: 'public.nager_date.nextHoliday',
  },
  // Meta-Adapter - Animals
  {
    pattern: /(?:show\s+(?:me\s+)?(?:a\s+)?)?(?:random\s+)?(?:dog|puppy)\s*(?:pic(?:ture)?|image|photo)?/i,
    nlIntent: 'meta_dog',
    feature: 'public.dog_ceo.random',
  },
  {
    pattern: /(?:random\s+)?cat\s+fact/i,
    nlIntent: 'meta_cat',
    feature: 'public.cat_facts.fact',
  },
  // Meta-Adapter - Quotes
  {
    pattern: /(?:give\s+(?:me\s+)?(?:a\s+)?|random\s+|inspirational\s+)?quote/i,
    nlIntent: 'meta_quote',
    feature: 'public.quotable.random',
  },
  // Meta-Adapter - Flows
  {
    pattern: /(?:run|execute)\s+(?:the\s+)?weather[- ]?(?:and|&)?[- ]?joke\s+(?:flow|combo)/i,
    nlIntent: 'meta_flow_weather_joke',
    feature: 'meta.flow.weather-and-joke',
  },
  {
    pattern: /weather\s+(?:and|&)\s+(?:a\s+)?joke/i,
    nlIntent: 'meta_flow_weather_joke',
    feature: 'meta.flow.weather-and-joke',
  },
  {
    pattern: /(?:run|execute)\s+(?:the\s+)?morning\s+(?:brief|briefing)/i,
    nlIntent: 'meta_flow_morning_brief',
    feature: 'meta.flow.morning-brief',
  },
  {
    pattern: /(?:list|show|what are)\s+(?:the\s+)?(?:auto[- ]?generated|available)\s+flows?/i,
    nlIntent: 'meta_list_flows',
    feature: 'meta.flows.list',
  },
  // Meta-Adapter - Demo
  {
    pattern: /(?:run|show)\s+(?:the\s+)?(?:api\s+)?demo/i,
    nlIntent: 'meta_demo',
    feature: 'meta.demo',
  },
  {
    pattern: /demo\s+(?:the\s+)?(?:public\s+)?apis?/i,
    nlIntent: 'meta_demo',
    feature: 'meta.demo',
  },
  // Web3 - Wallet Balance
  {
    pattern: /(?:check|what(?:'s| is)?|get|show)\s+(?:my\s+)?(?:wallet\s+)?(?:eth\s+)?balance(?:\s+(?:for|of)\s+(0x[a-fA-F0-9]{40}))?/i,
    nlIntent: 'web3_wallet_balance',
    feature: 'web3.moralis.wallet_balance',
    extractParams: (match) => ({ address: match[1] || '' }),
  },
  {
    pattern: /(?:how much|what)\s+(?:eth|ether|ethereum)\s+(?:do i have|in my wallet)/i,
    nlIntent: 'web3_wallet_balance',
    feature: 'web3.moralis.wallet_balance',
  },
  // Web3 - Token Balances
  {
    pattern: /(?:check|what(?:'s| is)?|get|show)\s+(?:my\s+)?(?:token\s+)?(?:balances?|holdings?)(?:\s+(?:for|of)\s+(0x[a-fA-F0-9]{40}))?/i,
    nlIntent: 'web3_token_balances',
    feature: 'web3.moralis.token_balances',
    extractParams: (match) => ({ address: match[1] || '' }),
  },
  {
    pattern: /(?:what|which)\s+(?:tokens?|erc20s?)\s+(?:do i (?:have|own)|are in my wallet)/i,
    nlIntent: 'web3_token_balances',
    feature: 'web3.moralis.token_balances',
  },
  // Web3 - NFTs
  {
    pattern: /(?:check|what(?:'s| is)?|get|show|list)\s+(?:my\s+)?nfts?(?:\s+(?:for|of)\s+(0x[a-fA-F0-9]{40}))?/i,
    nlIntent: 'web3_nfts',
    feature: 'web3.moralis.nfts',
    extractParams: (match) => ({ address: match[1] || '' }),
  },
  {
    pattern: /(?:what|which)\s+nfts?\s+(?:do i (?:have|own)|are in my wallet)/i,
    nlIntent: 'web3_nfts',
    feature: 'web3.moralis.nfts',
  },
  // Web3 - Gas Prices
  {
    pattern: /(?:check|what(?:'s| is)?|get|current)\s+(?:eth\s+)?(?:gas\s+)?(?:price|fee)s?/i,
    nlIntent: 'web3_gas_price',
    feature: 'web3.alchemy.gas_price',
  },
  {
    pattern: /(?:how much|what)\s+(?:is\s+)?gas(?:\s+right now)?/i,
    nlIntent: 'web3_gas_price',
    feature: 'web3.alchemy.gas_price',
  },
  // Web3 - Transaction History
  {
    pattern: /(?:check|what(?:'s| is)?|get|show)\s+(?:my\s+)?(?:tx|transaction)\s*(?:history|list)?(?:\s+(?:for|of)\s+(0x[a-fA-F0-9]{40}))?/i,
    nlIntent: 'web3_transactions',
    feature: 'web3.moralis.transactions',
    extractParams: (match) => ({ address: match[1] || '' }),
  },
  {
    pattern: /(?:my\s+)?(?:recent\s+)?transactions?/i,
    nlIntent: 'web3_transactions',
    feature: 'web3.moralis.transactions',
  },
  // Web3 - Portfolio Overview
  {
    pattern: /(?:check|show|get)\s+(?:my\s+)?(?:full\s+)?portfolio(?:\s+(?:for|of)\s+(0x[a-fA-F0-9]{40}))?/i,
    nlIntent: 'web3_portfolio',
    feature: 'web3.flow.portfolio-brief',
    extractParams: (match) => ({ address: match[1] || '' }),
  },
  {
    pattern: /(?:portfolio\s+)?(?:overview|summary|brief)/i,
    nlIntent: 'web3_portfolio',
    feature: 'web3.flow.portfolio-brief',
  },
  // Web3 - Flows
  {
    pattern: /(?:run|execute)\s+(?:the\s+)?wallet[- ]?check(?:\s+flow)?/i,
    nlIntent: 'web3_flow_wallet_check',
    feature: 'web3.flow.wallet-check',
  },
  {
    pattern: /(?:run|execute)\s+(?:the\s+)?portfolio[- ]?brief(?:\s+flow)?/i,
    nlIntent: 'web3_flow_portfolio',
    feature: 'web3.flow.portfolio-brief',
  },
  // Web3 - Demo
  {
    pattern: /(?:run|show)\s+(?:the\s+)?web3\s+demo/i,
    nlIntent: 'web3_demo',
    feature: 'web3.demo',
  },
  {
    pattern: /demo\s+(?:the\s+)?web3\s+(?:apis?|endpoints?)/i,
    nlIntent: 'web3_demo',
    feature: 'web3.demo',
  },
  // News - Search for news on a topic
  {
    pattern: /^(?:search\s+(?:for\s+)?(.+?)\s+news|find\s+(.+?)\s+news|look\s+up\s+(.+?)\s+news)$/i,
    nlIntent: 'news_search',
    feature: 'atlas.news.search',
    extractParams: (match) => ({ topic: match[1] || match[2] || match[3] || '' }),
  },
];

interface KeywordMapping {
  keywords: string[];
  feature: string;
  roles?: string[];
}

const keywordMappings: KeywordMapping[] = [
  { keywords: ['visitors', 'traffic', 'analytics', 'stats'], feature: 'metrics.visitors', roles: ['admin'] },
  { keywords: ['error', 'errors', 'logs', 'debug'], feature: 'logs.recent', roles: ['admin'] },
  { keywords: ['users', 'accounts', 'members'], feature: 'admin.users', roles: ['admin'] },
  { keywords: ['flag', 'report', 'moderate', 'review'], feature: 'moderation.flag', roles: ['moderator', 'admin'] },
  { keywords: ['ban', 'suspend', 'block'], feature: 'moderation.ban', roles: ['moderator', 'admin'] },
  { keywords: ['approve', 'accept'], feature: 'moderation.approve', roles: ['moderator', 'admin'] },
  { keywords: ['message', 'send', 'compose', 'write', 'notify'], feature: 'messages.compose' },
  { keywords: ['inbox', 'messages', 'mail'], feature: 'messages.list' },
  { keywords: ['pay', 'payment', 'transfer', 'send money'], feature: 'payments.send' },
  { keywords: ['history', 'transactions', 'ledger'], feature: 'payments.history' },
  { keywords: ['vote', 'ballot', 'poll', 'election'], feature: 'dao.vote' },
  { keywords: ['proposal', 'propose', 'suggest'], feature: 'dao.propose' },
  { keywords: ['delegate', 'delegating'], feature: 'dao.delegate' },
  { keywords: ['anchor', 'notarize', 'verify', 'proof'], feature: 'anchors.create' },
  { keywords: ['call', 'video', 'voice'], feature: 'calls.start' },
  { keywords: ['note', 'notes', 'write', 'document'], feature: 'notes.create' },
  { keywords: ['identity', 'attest', 'attestation', 'credential'], feature: 'identity.attest' },
  { keywords: ['settings', 'preferences', 'config'], feature: 'settings.update' },
  { keywords: ['help', 'support', 'assist'], feature: 'help.general' },
];

function extractConstraints(message: string): Record<string, any> {
  const constraints: Record<string, any> = {};
  
  const amountMatch = message.match(/\$?(\d+(?:\.\d{1,2})?)/);
  if (amountMatch) {
    constraints.amount = amountMatch[1];
  }
  
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (addressMatch) {
    constraints.address = addressMatch[0];
  }
  
  const timeMatch = message.match(/\b(today|yesterday|this week|this month|last week|last month)\b/i);
  if (timeMatch) {
    constraints.timeRange = timeMatch[1].toLowerCase();
  }
  
  const limitMatch = message.match(/\b(last|top|first)\s+(\d+)\b/i);
  if (limitMatch) {
    constraints.limit = parseInt(limitMatch[2], 10);
  }
  
  return constraints;
}

export function parseEndUserIntent(message: string): { intent: NLIntent; params: Record<string, any>; feature: string } {
  for (const pattern of phrasePatterns) {
    const match = message.match(pattern.pattern);
    if (match) {
      const params = pattern.extractParams ? pattern.extractParams(match) : {};
      return {
        intent: pattern.nlIntent,
        params,
        feature: pattern.feature,
      };
    }
  }
  
  return { intent: 'generic', params: {}, feature: '' };
}

export function parseIntent(message: string, role?: string): Intent | null {
  const endUserResult = parseEndUserIntent(message);
  
  if (endUserResult.intent !== 'generic') {
    const constraints = { ...endUserResult.params, ...extractConstraints(message) };
    return {
      feature: endUserResult.feature,
      nlIntent: endUserResult.intent,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      role,
    };
  }
  
  const lowerMessage = message.toLowerCase();
  
  for (const mapping of keywordMappings) {
    const hasMatch = mapping.keywords.some(keyword => lowerMessage.includes(keyword));
    
    if (hasMatch) {
      if (mapping.roles && role && !mapping.roles.includes(role)) {
        continue;
      }
      
      const constraints = extractConstraints(message);
      
      return {
        feature: mapping.feature,
        constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
        role,
      };
    }
  }
  
  const semanticMatch = findEndpointByQuery(message);
  if (semanticMatch && semanticMatch.score > 0.5) {
    const constraints = { 
      ...semanticMatch.extractedArgs, 
      ...extractConstraints(message),
      _semanticScore: semanticMatch.score,
      _matchedEndpoint: semanticMatch.endpointKey,
    };
    
    const intentName = semanticMatch.endpoint.semantics?.intents?.[0] || 
      semanticMatch.endpointKey.replace(/[.-]/g, '_');
    
    return {
      feature: semanticMatch.endpointKey,
      nlIntent: intentName as NLIntent,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
      role,
    };
  }
  
  return null;
}

export function parseIntentWithSemantics(message: string, role?: string): {
  intent: Intent | null;
  semanticMatch?: {
    endpointKey: string;
    score: number;
    extractedArgs: Record<string, string>;
  };
} {
  const intent = parseIntent(message, role);
  
  if (intent && intent.constraints?._semanticScore) {
    return {
      intent,
      semanticMatch: {
        endpointKey: intent.constraints._matchedEndpoint as string,
        score: intent.constraints._semanticScore as number,
        extractedArgs: Object.fromEntries(
          Object.entries(intent.constraints || {})
            .filter(([k]) => !k.startsWith('_'))
        ) as Record<string, string>,
      },
    };
  }
  
  return { intent };
}

export function suggestFeatures(partialMessage: string): string[] {
  const lowerMessage = partialMessage.toLowerCase();
  const suggestions: string[] = [];
  
  for (const mapping of keywordMappings) {
    const hasPartialMatch = mapping.keywords.some(keyword => 
      keyword.startsWith(lowerMessage) || lowerMessage.includes(keyword.slice(0, 3))
    );
    
    if (hasPartialMatch && !suggestions.includes(mapping.feature)) {
      suggestions.push(mapping.feature);
    }
  }
  
  return suggestions.slice(0, 5);
}
