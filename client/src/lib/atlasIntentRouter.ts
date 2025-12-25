import { parseIntent, type ParsedIntent, type IntentType } from './intentParser';
import { 
  getDeepLinkForIntent, 
  getAppById, 
  getAllApps,
  type AppManifest,
  type DeepLink
} from './deepLinkManifest';
import { 
  executeDeepLink, 
  detectPlatform, 
  buildDeepLinkUrl,
  type Platform,
  type DeepLinkConfig,
  type ExecuteOptions
} from './deepLinkExecutor';

export interface IntentResult {
  success: boolean;
  intent: ParsedIntent;
  app: AppManifest | null;
  deepLink: DeepLink | null;
  executedUrl: string | null;
  platform: Platform;
  fallbackUsed: boolean;
  error?: string;
}

export interface RouterOptions extends ExecuteOptions {
  autoExecute?: boolean;
  defaultApps?: Partial<Record<IntentType, string>>;
  contactResolver?: (name: string) => Promise<{ number?: string; email?: string } | null>;
}

const DEFAULT_APP_MAPPING: Partial<Record<IntentType, string>> = {
  playMedia: 'spotify',
  navigateTo: 'google-maps',
  sendMessage: 'sms',
  callContact: 'phone',
  emailContact: 'gmail',
  bookRide: 'uber',
  orderFood: 'doordash',
  searchFile: 'google-drive',
  searchProfile: 'linkedin',
};

export async function routeIntent(
  utterance: string,
  options: RouterOptions = {}
): Promise<IntentResult> {
  const {
    autoExecute = true,
    defaultApps = {},
    contactResolver,
    ...executeOptions
  } = options;

  const platform = detectPlatform();
  const intent = parseIntent(utterance);
  
  const result: IntentResult = {
    success: false,
    intent,
    app: null,
    deepLink: null,
    executedUrl: null,
    platform,
    fallbackUsed: false,
  };

  let appName = intent.appName;
  if (!appName) {
    const mergedDefaults = { ...DEFAULT_APP_MAPPING, ...defaultApps };
    appName = mergedDefaults[intent.intentType] || null;
  }

  if (!appName) {
    result.error = `No app specified for intent type: ${intent.intentType}`;
    return result;
  }

  const normalizedAppName = normalizeAppName(appName);
  const app = getAppById(normalizedAppName);
  
  if (!app) {
    result.error = `Unknown app: ${appName}`;
    return result;
  }

  result.app = app;

  const matchedIntentResult = getDeepLinkForIntent(utterance, platform);
  
  if (!matchedIntentResult) {
    const openIntent = app.intents.find(i => i.intentType === 'openApp');
    if (openIntent) {
      result.deepLink = openIntent.deepLink;
    } else {
      result.error = `No matching intent found for: ${utterance}`;
      return result;
    }
  } else {
    result.deepLink = matchedIntentResult.intent.deepLink;
  }

  const params: Record<string, string> = {};
  
  if (matchedIntentResult?.parameters) {
    Object.assign(params, matchedIntentResult.parameters);
  }
  
  if (intent.query) {
    params.query = intent.query;
    params.place = intent.query;
    params.destination = intent.query;
    params.contact = intent.query;
    params.username = intent.query;
  }

  if (intent.messageContent) {
    params.message = intent.messageContent;
  }

  if (contactResolver && intent.query) {
    try {
      const contactInfo = await contactResolver(intent.query);
      if (contactInfo) {
        if (contactInfo.number) {
          params.number = contactInfo.number;
        }
        if (contactInfo.email) {
          params.email = contactInfo.email;
        }
      }
    } catch (e) {
    }
  }

  if (!result.deepLink) {
    result.error = 'No deep link available';
    return result;
  }

  const deepLinkTemplate = result.deepLink[platform] || result.deepLink.web;
  const executedUrl = buildDeepLinkUrl(deepLinkTemplate, params);
  
  const unresolvedPlaceholders = executedUrl.match(/\[[a-zA-Z]+\]/g);
  if (unresolvedPlaceholders && unresolvedPlaceholders.length > 0) {
    result.error = `Missing required parameters: ${unresolvedPlaceholders.join(', ')}`;
    return result;
  }
  
  result.executedUrl = executedUrl;

  if (autoExecute && executedUrl) {
    try {
      const config: DeepLinkConfig = {
        ios: result.deepLink.ios,
        android: result.deepLink.android,
        web: result.deepLink.web,
      };

      let fallbackUsed = false;
      
      executeDeepLink(config, params, {
        ...executeOptions,
        onFallback: (p, url) => {
          fallbackUsed = true;
          executeOptions.onFallback?.(p, url);
        },
        onSuccess: (p, url) => {
          executeOptions.onSuccess?.(p, url);
        },
        onError: (err) => {
          result.error = err.message;
          executeOptions.onError?.(err);
        },
      });

      result.success = true;
      result.fallbackUsed = fallbackUsed;
    } catch (e: any) {
      result.error = e.message;
    }
  } else {
    result.success = true;
  }

  return result;
}

export function getAvailableIntents(): { intentType: IntentType; description: string; examples: string[] }[] {
  return [
    {
      intentType: 'openApp',
      description: 'Open an app',
      examples: ['Open Netflix', 'Launch Spotify', 'Start Instagram'],
    },
    {
      intentType: 'playMedia',
      description: 'Play music or video',
      examples: ['Play Drake on Spotify', 'Play Stranger Things on Netflix', 'Listen to jazz'],
    },
    {
      intentType: 'searchApp',
      description: 'Search within an app',
      examples: ['Search Breaking Bad on Netflix', 'Find coffee shops on Yelp'],
    },
    {
      intentType: 'sendMessage',
      description: 'Send a text or message',
      examples: ['Text Mom', 'Message John on WhatsApp', 'Send Alex a message saying I\'ll be late'],
    },
    {
      intentType: 'callContact',
      description: 'Make a phone call',
      examples: ['Call Dad', 'Phone the office', 'FaceTime Sarah'],
    },
    {
      intentType: 'emailContact',
      description: 'Compose an email',
      examples: ['Email my boss', 'Send email to support@company.com'],
    },
    {
      intentType: 'navigateTo',
      description: 'Get directions or navigate',
      examples: ['Navigate to Starbucks', 'Directions to the airport', 'Take me to Central Park'],
    },
    {
      intentType: 'bookRide',
      description: 'Book a ride',
      examples: ['Book Uber to downtown', 'Get a Lyft to the airport'],
    },
    {
      intentType: 'orderFood',
      description: 'Order food delivery',
      examples: ['Order pizza on DoorDash', 'Get sushi from Grubhub'],
    },
    {
      intentType: 'searchFile',
      description: 'Search for files',
      examples: ['Find my budget spreadsheet in Drive', 'Search documents for contract'],
    },
    {
      intentType: 'searchProfile',
      description: 'Look up a profile',
      examples: ['Find Elon Musk on Twitter', 'Search LinkedIn for John Smith'],
    },
  ];
}

export function getSupportedApps(): { id: string; name: string; icon: string; category: string }[] {
  return getAllApps().map(app => ({
    id: app.id,
    name: app.name,
    icon: app.icon,
    category: app.category,
  }));
}

export function getAppIntents(appId: string): { utterancePattern: string; intentType: IntentType }[] {
  const app = getAppById(appId);
  if (!app) return [];
  
  return app.intents.map(i => ({
    utterancePattern: i.utterancePattern,
    intentType: i.intentType,
  }));
}

function normalizeAppName(name: string): string {
  const mappings: Record<string, string> = {
    'google maps': 'google-maps',
    'apple maps': 'apple-maps',
    'apple music': 'apple-music',
    'prime video': 'prime-video',
    'disney+': 'disney-plus',
    'disney plus': 'disney-plus',
    'uber eats': 'uber-eats',
    'cash app': 'cashapp',
    'google drive': 'google-drive',
    'youtube music': 'youtube-music',
    'x': 'twitter',
    'twitter': 'twitter',
    'messages': 'sms',
    'text': 'sms',
    'imessage': 'sms',
    'phone': 'phone',
    'call': 'phone',
    'email': 'gmail',
    'mail': 'gmail',
    'maps': 'google-maps',
    'navigation': 'google-maps',
    'directions': 'google-maps',
    'ride': 'uber',
    'food': 'doordash',
    'delivery': 'doordash',
    'music': 'spotify',
    'video': 'youtube',
    'stream': 'netflix',
    'files': 'google-drive',
    'drive': 'google-drive',
    'docs': 'google-drive',
    'fb': 'facebook',
    'ig': 'instagram',
    'insta': 'instagram',
    'wa': 'whatsapp',
    'yt': 'youtube',
  };

  const normalized = name.toLowerCase().trim();
  return mappings[normalized] || normalized.replace(/\s+/g, '-');
}

export function previewIntent(utterance: string): {
  intent: ParsedIntent;
  matchedApp: string | null;
  deepLinkPreview: Record<Platform, string>;
  wouldExecute: boolean;
} {
  const intent = parseIntent(utterance);
  const platform = detectPlatform();
  
  let appName = intent.appName;
  if (!appName) {
    appName = DEFAULT_APP_MAPPING[intent.intentType] || null;
  }

  const deepLinkPreview: Record<Platform, string> = {
    ios: '',
    android: '',
    web: '',
  };

  let wouldExecute = false;

  if (appName) {
    const normalizedAppName = normalizeAppName(appName);
    const app = getAppById(normalizedAppName);
    
    if (app) {
      const matched = getDeepLinkForIntent(utterance, platform);
      if (matched) {
        const params: Record<string, string> = {};
        if (intent.query) {
          params.query = intent.query;
          params.place = intent.query;
        }
        
        deepLinkPreview.ios = buildDeepLinkUrl(matched.intent.deepLink.ios, params);
        deepLinkPreview.android = buildDeepLinkUrl(matched.intent.deepLink.android, params);
        deepLinkPreview.web = buildDeepLinkUrl(matched.intent.deepLink.web, params);
        wouldExecute = true;
      }
    }
  }

  return {
    intent,
    matchedApp: appName,
    deepLinkPreview,
    wouldExecute,
  };
}

export { parseIntent, detectPlatform, buildDeepLinkUrl };
export type { ParsedIntent, IntentType, Platform, DeepLink, AppManifest };
