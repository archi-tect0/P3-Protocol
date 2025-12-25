export type Scope = 'wallet' | 'messages' | 'payments' | 'dao' | 'storage' | 'anchors' | 'media' | 'admin' | 'moderator' | 'registry' | 'marketplace' | 'proxy';

export interface EndpointSemantics {
  intents?: string[];
  tags?: string[];
  phrases?: string[];
}

export type Role = 'admin' | 'moderator' | 'user' | 'developer';

export type Visibility = 'discoverable' | 'restricted';

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface EndpointGating {
  roles?: Role[];
  consentRequired?: boolean;
  rateLimit?: RateLimitConfig;
  visibility?: Visibility;
  reviewRequired?: boolean;
}

export interface EndpointMeta {
  app: string;
  version: string;
  fn: string;
  args: Record<string, string>;
  scopes: Scope[];
  description?: string;
  gating?: EndpointGating;
  semantics?: EndpointSemantics;
}

export interface AppInfo {
  name: string;
  id: string;
  version: string;
  adapter: string;
  permissions: Scope[];
}

export interface Registry {
  apps: Record<string, AppInfo>;
  endpoints: Record<string, EndpointMeta>;
  routes: Record<string, { app: string; href: string }>;
}

export interface Session {
  wallet: string;
  token: string;
  grants: Scope[];
  roles: ('admin' | 'moderator' | 'user' | 'developer')[];
  connectedApps: string[];
  capabilityMap: Record<string, string[]>;
  expiresAt: number;
}

export interface FlowStep {
  key: string;
  args: Record<string, any>;
}

export type NLIntent =
  | 'show_launcher'
  | 'devkit_query'
  | 'devkit_endpoints'
  | 'devkit_help'
  | 'devkit_flows'
  | 'devkit_apps'
  | 'devkit_describe'
  | 'messages_inbox'
  | 'messages_send'
  | 'messages_compose'
  | 'messages_voice_send'
  | 'messages_voice_compose'
  | 'notes_create'
  | 'notes_compose'
  | 'notes_list'
  | 'gallery_count'
  | 'gallery_list'
  | 'marketplace_sales_today'
  | 'payments_send'
  | 'payments_history'
  | 'dao_vote'
  | 'dao_proposals'
  | 'anchors_create'
  | 'anchors_verify'
  | 'registry_list'
  | 'registry_apps'
  | 'external_launch'
  | 'app_notifications'
  | 'app_messages'
  | 'apps_connected'
  | 'app_query'
  | 'proxy_gmail_compose'
  | 'proxy_gmail_unread'
  | 'proxy_spotify_play'
  | 'proxy_spotify_pause'
  | 'proxy_spotify_current'
  | 'proxy_slack_send'
  | 'proxy_slack_unread'
  | 'proxy_discord_send'
  | 'proxy_github_repos'
  | 'proxy_github_notifications'
  | 'proxy_calendar_events'
  | 'proxy_twitter_post'
  | 'analytics_overview'
  | 'analytics_traffic'
  | 'analytics_referrers'
  | 'analytics_pages'
  | 'analytics_devices'
  | 'memory_pinned'
  | 'memory_pin'
  | 'memory_unpin'
  | 'memory_flows'
  | 'memory_queries'
  | 'memory_clear'
  // Meta-Adapter Public API intents
  | 'meta_list_apis'
  | 'meta_search_apis'
  | 'meta_weather'
  | 'meta_joke'
  | 'meta_crypto'
  | 'meta_holiday'
  | 'meta_dog'
  | 'meta_cat'
  | 'meta_quote'
  | 'meta_flow_weather_joke'
  | 'meta_flow_morning_brief'
  | 'meta_list_flows'
  | 'meta_demo'
  // Web3 intents
  | 'web3_wallet_balance'
  | 'web3_token_balances'
  | 'web3_nfts'
  | 'web3_gas_price'
  | 'web3_transactions'
  | 'web3_portfolio'
  | 'web3_flow_wallet_check'
  | 'web3_flow_portfolio'
  | 'web3_demo'
  // Admin analytics intents
  | 'admin_analytics_visitors'
  | 'admin_analytics_metrics'
  | 'admin_analytics_calls'
  | 'admin_analytics_errors'
  | 'admin_dashboard'
  // Atlas One intents
  | 'atlas_one_open'
  | 'atlas_one_catalog'
  | 'atlas_one_launch_game'
  | 'atlas_one_watch_media'
  | 'atlas_one_rent_media'
  | 'atlas_one_read_book'
  | 'atlas_one_search'
  | 'atlas_one_purchase'
  | 'atlas_one_browse'
  // Game Deck intents
  | 'gamedeck_open'
  | 'gamedeck_features'
  // Hub intents
  | 'atlas_hub_open'
  // Pulse intents
  | 'atlas_pulse_open'
  | 'atlas_my_pulse_open'
  | 'atlas_efficiency_open'
  // Library intents
  | 'atlas_library_open'
  | 'atlas_gamedeck_open'
  | 'atlas_media_open'
  | 'atlas_reader_open'
  // Roku/TV pairing
  | 'roku_pair'
  // Atlas capability/help
  | 'atlas_capability_open'
  // News intents
  | 'news_search'
  | 'news_top_stories'
  // Node mode intents
  | 'atlas_node_open'
  // Chat mode intents
  | 'atlas_chat_open'
  // Wikipedia intents
  | 'wikipedia_lookup'
  | 'wikipedia_help'
  // Knowledge base intents
  | 'knowledge_query'
  | 'generic';

export interface Intent {
  feature: string;
  nlIntent?: NLIntent;
  constraints?: Record<string, any>;
  role?: string;
}

export interface Receipt {
  step: string;
  status: 'ok' | 'error' | 'held_for_review';
  digest?: string;
  ts: number;
  result?: any;
  error?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  steps: FlowStep[];
  requiredScopes: Scope[];
  roles: string[];
}
