import type { DeepLink } from './deepLinkManifest';

export type Platform = 'ios' | 'android' | 'web';

export interface DeepLinkConfig {
  ios: string;
  android: string;
  web: string;
  iosAppStoreUrl?: string;
  androidPlayStoreUrl?: string;
  appPackage?: string;
}

export interface ExecuteOptions {
  fallbackDelay?: number;
  forceWeb?: boolean;
  onFallback?: (platform: Platform, fallbackUrl: string) => void;
  onSuccess?: (platform: Platform, url: string) => void;
  onError?: (error: Error) => void;
}

const PLACEHOLDER_PATTERNS = [
  '[query]',
  '[contact]',
  '[place]',
  '[number]',
  '[email]',
  '[destination]',
  '[message]',
  '[username]',
  '[userId]',
  '[url]',
  '[teamId]',
  '[channelId]',
  '[guildId]',
  '[inviteCode]',
  '[playlistId]',
  '[artistId]',
  '[titleId]',
  '[videoId]',
  '[contentId]',
  '[channelName]',
  '[asin]',
  '[domain]',
] as const;

type PlaceholderKey = typeof PLACEHOLDER_PATTERNS[number] extends `[${infer K}]` ? K : never;

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return 'web';
  }

  const ua = navigator.userAgent.toLowerCase();

  const isIOS = /iphone|ipad|ipod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS) {
    return 'ios';
  }

  const isAndroid = /android/.test(ua);

  if (isAndroid) {
    return 'android';
  }

  return 'web';
}

export function buildDeepLinkUrl(template: string, params: Record<string, string>): string {
  if (!template) {
    return '';
  }

  let result = template;

  for (const placeholder of PLACEHOLDER_PATTERNS) {
    const key = placeholder.slice(1, -1) as PlaceholderKey;
    
    if (params[key] !== undefined) {
      const encodedValue = encodeURIComponent(params[key]);
      result = result.split(placeholder).join(encodedValue);
    }
  }

  Object.entries(params).forEach(([key, value]) => {
    const customPlaceholder = `[${key}]`;
    if (result.includes(customPlaceholder)) {
      const encodedValue = encodeURIComponent(value);
      result = result.split(customPlaceholder).join(encodedValue);
    }
  });

  return result;
}

function createHiddenIframe(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'display:none;width:0;height:0;border:0;visibility:hidden;position:absolute;left:-9999px;';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  return iframe;
}

function tryDeepLinkWithIframe(url: string, fallbackUrl: string, options: ExecuteOptions = {}): void {
  const { fallbackDelay = 2500, onFallback, onSuccess, onError } = options;
  
  const iframe = createHiddenIframe();
  let fallbackTriggered = false;
  let timeoutId: number;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const triggerFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    cleanup();
    
    try {
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      onFallback?.('ios', fallbackUrl);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to open fallback URL'));
    }
  };

  try {
    document.body.appendChild(iframe);
    
    iframe.contentWindow?.location.replace(url);
    
    timeoutId = window.setTimeout(triggerFallback, fallbackDelay);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(timeoutId);
        cleanup();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        onSuccess?.('ios', url);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, fallbackDelay + 500);

  } catch (error) {
    cleanup();
    onError?.(error instanceof Error ? error : new Error('Failed to execute deep link'));
  }
}

function tryDeepLinkWithLocation(url: string, fallbackUrl: string, options: ExecuteOptions = {}): void {
  const { fallbackDelay = 2500, onFallback, onSuccess, onError } = options;
  
  let fallbackTriggered = false;
  const startTime = Date.now();

  const triggerFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    
    try {
      window.location.href = fallbackUrl;
      onFallback?.('android', fallbackUrl);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to open fallback URL'));
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      fallbackTriggered = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      onSuccess?.('android', url);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  try {
    window.location.href = url;
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error('Failed to execute deep link'));
    return;
  }

  const timeoutId = setTimeout(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    
    if (Date.now() - startTime < fallbackDelay + 200) {
      triggerFallback();
    }
  }, fallbackDelay);

  setTimeout(() => {
    clearTimeout(timeoutId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, fallbackDelay + 1000);
}

function buildAndroidIntentUrl(deepLinkUrl: string, config: DeepLinkConfig): string {
  if (deepLinkUrl.startsWith('intent://')) {
    return deepLinkUrl;
  }

  if (!config.appPackage) {
    return deepLinkUrl;
  }

  try {
    const url = new URL(deepLinkUrl);
    const scheme = url.protocol.replace(':', '');
    const host = url.host || '';
    const path = url.pathname || '';
    const search = url.search || '';

    let intentUrl = `intent://${host}${path}${search}#Intent;scheme=${scheme};package=${config.appPackage};`;
    
    if (config.androidPlayStoreUrl) {
      intentUrl += `S.browser_fallback_url=${encodeURIComponent(config.androidPlayStoreUrl)};`;
    } else if (config.web) {
      intentUrl += `S.browser_fallback_url=${encodeURIComponent(config.web)};`;
    }
    
    intentUrl += 'end';
    
    return intentUrl;
  } catch {
    return deepLinkUrl;
  }
}

export function executeDeepLink(
  deepLink: DeepLinkConfig | DeepLink,
  params: Record<string, string> = {},
  options: ExecuteOptions = {}
): void {
  const { forceWeb = false, onSuccess, onError } = options;
  const platform = detectPlatform();

  if (forceWeb || platform === 'web') {
    const webUrl = buildDeepLinkUrl(deepLink.web, params);
    
    if (!webUrl) {
      onError?.(new Error('No web URL provided'));
      return;
    }

    try {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
      onSuccess?.('web', webUrl);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to open web URL'));
    }
    return;
  }

  const config = deepLink as DeepLinkConfig;
  const webFallbackUrl = buildDeepLinkUrl(config.web, params);

  if (platform === 'ios') {
    const iosUrl = buildDeepLinkUrl(config.ios, params);
    
    if (!iosUrl) {
      if (webFallbackUrl) {
        window.open(webFallbackUrl, '_blank', 'noopener,noreferrer');
        options.onFallback?.('ios', webFallbackUrl);
      } else {
        onError?.(new Error('No iOS or web URL provided'));
      }
      return;
    }

    const fallbackUrl = config.iosAppStoreUrl || webFallbackUrl;
    
    if (!fallbackUrl) {
      try {
        window.location.href = iosUrl;
        onSuccess?.('ios', iosUrl);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to open iOS deep link'));
      }
      return;
    }

    tryDeepLinkWithIframe(iosUrl, fallbackUrl, options);
    return;
  }

  if (platform === 'android') {
    let androidUrl = buildDeepLinkUrl(config.android, params);
    
    if (!androidUrl) {
      if (webFallbackUrl) {
        window.open(webFallbackUrl, '_blank', 'noopener,noreferrer');
        options.onFallback?.('android', webFallbackUrl);
      } else {
        onError?.(new Error('No Android or web URL provided'));
      }
      return;
    }

    if (config.appPackage && !androidUrl.startsWith('intent://')) {
      androidUrl = buildAndroidIntentUrl(androidUrl, config);
    }

    const fallbackUrl = config.androidPlayStoreUrl || webFallbackUrl;
    
    if (!fallbackUrl) {
      try {
        window.location.href = androidUrl;
        onSuccess?.('android', androidUrl);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to open Android deep link'));
      }
      return;
    }

    tryDeepLinkWithLocation(androidUrl, fallbackUrl, options);
    return;
  }
}

export function executeDeepLinkSimple(
  deepLink: DeepLinkConfig | DeepLink,
  params: Record<string, string> = {}
): string | null {
  const platform = detectPlatform();
  
  let url: string;
  
  switch (platform) {
    case 'ios':
      url = buildDeepLinkUrl(deepLink.ios, params);
      break;
    case 'android':
      url = buildDeepLinkUrl(deepLink.android, params);
      break;
    default:
      url = buildDeepLinkUrl(deepLink.web, params);
  }

  if (!url) {
    url = buildDeepLinkUrl(deepLink.web, params);
  }

  if (url) {
    if (platform === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
    return url;
  }

  return null;
}

export function canHandleDeepLink(template: string): boolean {
  if (!template) return false;
  
  const nativeSchemePatterns = [
    /^[a-z][a-z0-9+.-]*:\/\//i,
    /^intent:\/\//i,
    /^sms:/i,
    /^tel:/i,
    /^mailto:/i,
    /^geo:/i,
  ];
  
  return nativeSchemePatterns.some(pattern => pattern.test(template));
}

export function getRequiredParams(template: string): string[] {
  const params: string[] = [];
  const placeholderRegex = /\[([^\]]+)\]/g;
  let match;
  
  while ((match = placeholderRegex.exec(template)) !== null) {
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }
  
  return params;
}

export function validateParams(template: string, params: Record<string, string>): { 
  valid: boolean; 
  missing: string[];
} {
  const required = getRequiredParams(template);
  const missing = required.filter(key => !params[key]);
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

export function getDeepLinkForPlatform(
  deepLink: DeepLinkConfig | DeepLink,
  params: Record<string, string> = {}
): { platform: Platform; url: string; isNative: boolean } {
  const platform = detectPlatform();
  
  let template: string;
  
  switch (platform) {
    case 'ios':
      template = deepLink.ios;
      break;
    case 'android':
      template = deepLink.android;
      break;
    default:
      template = deepLink.web;
  }

  if (!template && deepLink.web) {
    template = deepLink.web;
  }

  const url = buildDeepLinkUrl(template || '', params);
  const isNative = platform !== 'web' && canHandleDeepLink(template);

  return { platform, url, isNative };
}
