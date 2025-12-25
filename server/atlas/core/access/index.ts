import { AccessManifest, AccessMode, AccessFormat, accessManifestSchema } from '@shared/schema';
import {
  ReadinessState,
  CachedResolverResult,
  CacheTier,
  getCachedAccess,
  setCachedAccess,
  invalidateCachedAccess,
  getInFlightKey,
  getInFlightResolution,
  setInFlightResolution,
  clearInFlightResolution,
  recordCacheHit,
  recordCacheMiss,
  recordCoalescedRequest,
  getCached,
  setCache,
  invalidate,
  generateCacheKey,
  getCacheStats,
  getCacheHitRatio,
  getEdgeCacheSize,
  clearEdgeCache,
} from './cache';
import {
  trackResolution,
  trackCacheHit,
  trackCacheMiss,
  trackCoalescing,
  recordTotalRequest,
  recordCoalescedRequest as recordCoalescedRequestMetric,
  getCoalescingEfficiency,
} from '../../../observability/resolverLatency';
import {
  coalesce,
  generateCoalesceKey,
  getCoalesceStats,
  hasInFlight,
  getInFlightCount,
  startCleanupInterval,
  stopCleanupInterval,
} from './coalesce';

export { ReadinessState, CacheTier } from './cache';
export type { CachedResolverResult } from './cache';
export { getCached, setCache, invalidate, generateCacheKey, getCacheStats, getCacheHitRatio } from './cache';
export { coalesce, generateCoalesceKey, getCoalesceStats } from './coalesce';
export { getCoalescingEfficiency } from '../../../observability/resolverLatency';

startCleanupInterval();

export interface AccessContext {
  itemType: string;
  source: string;
  providerId?: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface AccessResolverResult {
  access: AccessManifest | null;
  error?: string;
}

export interface EnhancedAccessResult extends AccessResolverResult {
  readiness: ReadinessState;
  fromCache: boolean;
  latencyMs: number;
  ttlMs: number;
}

export interface ResolveOptions {
  budgetMs?: number;
  skipCache?: boolean;
  forceRefresh?: boolean;
}

type AccessResolver = (ctx: AccessContext) => AccessResolverResult;

const resolverRegistry: Map<string, AccessResolver> = new Map();
const DEFAULT_BUDGET_MS = 200;

export function registerResolver(vertical: string, resolver: AccessResolver) {
  resolverRegistry.set(vertical, resolver);
}

export function resolveAccess(ctx: AccessContext): AccessResolverResult {
  const resolver = resolverRegistry.get(ctx.itemType);
  if (!resolver) {
    return { access: null, error: `No resolver for item type: ${ctx.itemType}` };
  }
  
  if (!isExternalUrlContext(ctx)) {
    return { access: null, error: 'Access URLs must be external (non-Atlas domains)' };
  }
  
  try {
    const result = resolver(ctx);
    if (result.access) {
      const validation = accessManifestSchema.safeParse(result.access);
      if (!validation.success) {
        return { access: null, error: `Invalid access manifest: ${validation.error.message}` };
      }
      if (!isExternalUrl(result.access)) {
        return { access: null, error: 'Access URLs must be external (non-Atlas domains)' };
      }
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown resolver error';
    return { access: null, error: message };
  }
}

export async function resolveAccessWithCache(
  ctx: AccessContext,
  options: ResolveOptions = {}
): Promise<EnhancedAccessResult> {
  const { budgetMs = DEFAULT_BUDGET_MS, skipCache = false, forceRefresh = false } = options;
  const start = Date.now();
  
  recordTotalRequest();

  if (!isExternalUrlContext(ctx)) {
    return {
      access: null,
      error: 'Access URLs must be external (non-Atlas domains)',
      readiness: ReadinessState.DEGRADED,
      fromCache: false,
      latencyMs: Date.now() - start,
      ttlMs: 0,
    };
  }

  const key = getInFlightKey(ctx);
  const existingResolution = getInFlightResolution(key);
  if (existingResolution && !forceRefresh) {
    recordCoalescedRequest();
    recordCoalescedRequestMetric();
    trackCoalescing(ctx.itemType);
    return existingResolution;
  }

  if (!skipCache && !forceRefresh) {
    const cached = await getCachedAccess(ctx);
    if (cached) {
      const latencyMs = Date.now() - start;
      const tier = cached.state === ReadinessState.READY ? 'edge' : 'core';
      recordCacheHit(tier);
      trackCacheHit(tier);

      trackResolution({
        itemType: ctx.itemType,
        source: ctx.source,
        cacheStatus: tier === 'edge' ? 'edge_hit' : 'core_hit',
        readiness: cached.state,
        result: cached.access ? 'success' : 'error',
        latencyMs,
      });

      if (cached.state === ReadinessState.DEGRADED) {
        backgroundRefresh(ctx).catch(() => {});
      }

      return {
        access: cached.access,
        error: cached.error,
        readiness: cached.state,
        fromCache: true,
        latencyMs,
        ttlMs: cached.ttlMs || 0,
      };
    }
    
    recordCacheMiss();
    trackCacheMiss();
  }

  const resolutionPromise = executeResolution(ctx, budgetMs);
  setInFlightResolution(key, resolutionPromise);

  try {
    const result = await resolutionPromise;
    return result;
  } finally {
    clearInFlightResolution(key);
  }
}

async function executeResolution(ctx: AccessContext, budgetMs: number): Promise<EnhancedAccessResult> {
  const start = Date.now();

  const resolveSync = () => {
    const resolver = resolverRegistry.get(ctx.itemType);
    if (!resolver) {
      return { access: null, error: `No resolver for item type: ${ctx.itemType}` };
    }
    return resolver(ctx);
  };

  const budgetTimeout = new Promise<EnhancedAccessResult>((resolve) => {
    setTimeout(() => {
      const fallbackAccess = createOpenWebFallback(ctx);
      resolve({
        access: fallbackAccess,
        readiness: ReadinessState.PENDING,
        fromCache: false,
        latencyMs: budgetMs,
        ttlMs: 0,
      });
    }, budgetMs);
  });

  const fullResolution = (async (): Promise<EnhancedAccessResult> => {
    try {
      const result = resolveSync();
      const latencyMs = Date.now() - start;

      const DEFAULT_TTL_MS = 90 * 1000;

      if (result.access) {
        const validation = accessManifestSchema.safeParse(result.access);
        if (!validation.success) {
          return {
            access: null,
            error: `Invalid access manifest: ${validation.error.message}`,
            readiness: ReadinessState.DEGRADED,
            fromCache: false,
            latencyMs,
            ttlMs: 0,
          };
        }

        if (!isExternalUrl(result.access)) {
          return {
            access: null,
            error: 'Access URLs must be external (non-Atlas domains)',
            readiness: ReadinessState.DEGRADED,
            fromCache: false,
            latencyMs,
            ttlMs: 0,
          };
        }

        await setCachedAccess(ctx, result);

        trackResolution({
          itemType: ctx.itemType,
          source: ctx.source,
          cacheStatus: 'miss',
          readiness: ReadinessState.READY,
          result: 'success',
          latencyMs,
        });

        return {
          ...result,
          readiness: ReadinessState.READY,
          fromCache: false,
          latencyMs,
          ttlMs: DEFAULT_TTL_MS,
        };
      }

      trackResolution({
        itemType: ctx.itemType,
        source: ctx.source,
        cacheStatus: 'miss',
        readiness: ReadinessState.DEGRADED,
        result: 'error',
        latencyMs,
      });

      return {
        ...result,
        readiness: ReadinessState.DEGRADED,
        fromCache: false,
        latencyMs,
        ttlMs: 0,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown resolver error';

      trackResolution({
        itemType: ctx.itemType,
        source: ctx.source,
        cacheStatus: 'miss',
        readiness: ReadinessState.DEGRADED,
        result: 'error',
        latencyMs,
      });

      return {
        access: null,
        error: message,
        readiness: ReadinessState.DEGRADED,
        fromCache: false,
        latencyMs,
        ttlMs: 0,
      };
    }
  })();

  const raceResult = await Promise.race([fullResolution, budgetTimeout]);

  if (raceResult.readiness === ReadinessState.PENDING) {
    fullResolution.then(async (finalResult) => {
      if (finalResult.access) {
        await setCachedAccess(ctx, finalResult);
      }
    }).catch(() => {});

    trackResolution({
      itemType: ctx.itemType,
      source: ctx.source,
      cacheStatus: 'miss',
      readiness: ReadinessState.PENDING,
      result: 'timeout',
      latencyMs: budgetMs,
    });
  }

  return raceResult;
}

async function backgroundRefresh(ctx: AccessContext): Promise<void> {
  const key = getInFlightKey(ctx);
  
  if (getInFlightResolution(key)) {
    return;
  }

  const resolutionPromise = executeResolution(ctx, 5000);
  setInFlightResolution(key, resolutionPromise);

  try {
    await resolutionPromise;
  } finally {
    clearInFlightResolution(key);
  }
}

function createOpenWebFallback(ctx: AccessContext): AccessManifest | null {
  const { url, metadata } = ctx;
  
  const fallbackUrl = url || (metadata?.openWeb as string) || (metadata?.url as string);
  
  if (fallbackUrl && isExternalUrlString(fallbackUrl)) {
    return {
      mode: 'openweb',
      format: 'none',
      openWeb: fallbackUrl,
    };
  }

  return null;
}

function isExternalUrlContext(ctx: AccessContext): boolean {
  const { url } = ctx;
  if (!url) return true;
  return isExternalUrlString(url);
}

function isExternalUrlString(url: string): boolean {
  const atlasPatterns = [
    /^https?:\/\/localhost/,
    /^https?:\/\/127\.0\.0\.1/,
    /^https?:\/\/[^\/]*\.replit\.dev/,
    /^https?:\/\/[^\/]*atlas/i,
  ];
  return !atlasPatterns.some(pattern => pattern.test(url));
}

function isExternalUrl(access: AccessManifest): boolean {
  const atlasPatterns = [
    /^https?:\/\/localhost/,
    /^https?:\/\/127\.0\.0\.1/,
    /^https?:\/\/[^\/]*\.replit\.dev/,
    /^https?:\/\/[^\/]*atlas/i,
  ];
  
  const urls = [access.uri, access.embed, access.openWeb].filter(Boolean) as string[];
  return urls.every(url => !atlasPatterns.some(pattern => pattern.test(url)));
}

// ============================================================================
// RESOLVER REGISTRY - Universal access resolution across mesh OS
// These resolvers work universally across: Atlas App, Atlas One, Game Deck, Hub
// ============================================================================

registerResolver('channel', resolveLiveTv);
registerResolver('video', resolveVideo);
registerResolver('ebook', resolveEbook);
registerResolver('game', resolveGame);
registerResolver('product', resolveProduct);
registerResolver('audio', resolveAudio);
registerResolver('app', resolveApp);
registerResolver('document', resolveDocument);
registerResolver('governance', resolveGovernance);
registerResolver('gallery', resolveGallery);

function resolveLiveTv(ctx: AccessContext): AccessResolverResult {
  const { url, metadata } = ctx;
  
  if (url && (url.endsWith('.m3u8') || url.includes('m3u8'))) {
    return {
      access: {
        mode: 'stream',
        format: 'hls',
        uri: url,
      }
    };
  }
  
  if (url && (url.endsWith('.mpd') || url.includes('dash'))) {
    return {
      access: {
        mode: 'stream',
        format: 'dash',
        uri: url,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'stream',
        format: 'hls',
        uri: url,
      }
    };
  }
  
  if (metadata?.streamUrl) {
    return {
      access: {
        mode: 'stream',
        format: 'hls',
        uri: metadata.streamUrl,
      }
    };
  }
  
  return { access: null, error: 'No stream URL available for channel' };
}

function resolveVideo(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url } = ctx;
  
  if (metadata?.trailerUrl) {
    const trailerUrl = metadata.trailerUrl as string;
    if (trailerUrl.includes('youtube.com') || trailerUrl.includes('youtu.be')) {
      const videoId = extractYouTubeId(trailerUrl);
      if (videoId) {
        return {
          access: {
            mode: 'embed',
            format: 'html',
            embed: `https://www.youtube.com/embed/${videoId}`,
            openWeb: trailerUrl,
          }
        };
      }
    }
  }
  
  if (metadata?.streamUrl) {
    const streamUrl = metadata.streamUrl as string;
    if (streamUrl.includes('.m3u8')) {
      return {
        access: {
          mode: 'stream',
          format: 'hls',
          uri: streamUrl,
        }
      };
    }
  }
  
  const avodProviders: Record<string, string> = {
    tubi: 'https://tubitv.com/movies/',
    pluto: 'https://pluto.tv/on-demand/movies/',
    plex: 'https://watch.plex.tv/movie/',
    crackle: 'https://www.crackle.com/watch/',
  };
  
  if (metadata?.avod) {
    const avod = metadata.avod as { provider: string; id: string };
    const baseUrl = avodProviders[avod.provider];
    if (baseUrl) {
      return {
        access: {
          mode: 'openweb',
          format: 'none',
          openWeb: `${baseUrl}${avod.id}`,
        }
      };
    }
  }
  
  if (metadata?.imdbId) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: `https://www.imdb.com/title/${metadata.imdbId}/`,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No video access available' };
}

function resolveEbook(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url, providerId } = ctx;
  
  if (metadata?.formats) {
    const formats = metadata.formats as Record<string, string>;
    
    if (formats['application/epub+zip']) {
      return {
        access: {
          mode: 'file',
          format: 'epub',
          uri: formats['application/epub+zip'],
        }
      };
    }
    
    if (formats['application/pdf']) {
      return {
        access: {
          mode: 'file',
          format: 'pdf',
          uri: formats['application/pdf'],
        }
      };
    }
    
    if (formats['text/html']) {
      return {
        access: {
          mode: 'file',
          format: 'html',
          uri: formats['text/html'],
        }
      };
    }
  }
  
  if (source === 'gutendex' && providerId) {
    return {
      access: {
        mode: 'file',
        format: 'epub',
        uri: `https://www.gutenberg.org/ebooks/${providerId}.epub.images`,
        openWeb: `https://www.gutenberg.org/ebooks/${providerId}`,
      }
    };
  }
  
  if (source === 'openlibrary' && providerId) {
    const olId = providerId.replace('/works/', '').replace('/books/', '');
    return {
      access: {
        mode: 'embed',
        format: 'html',
        embed: `https://openlibrary.org/books/${olId}`,
        openWeb: `https://openlibrary.org/books/${olId}`,
      }
    };
  }
  
  if (metadata?.previewLink) {
    return {
      access: {
        mode: 'embed',
        format: 'html',
        embed: metadata.previewLink as string,
        openWeb: metadata.previewLink as string,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No ebook access available' };
}

function resolveGame(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url, providerId } = ctx;
  
  if (metadata?.platform === 'Web Browser' || metadata?.platform?.includes('Web')) {
    if (url) {
      return {
        access: {
          mode: 'embed',
          format: 'html',
          embed: url,
          openWeb: url,
        }
      };
    }
  }
  
  if (metadata?.freetogameUrl) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: metadata.freetogameUrl as string,
      }
    };
  }
  
  if (source === 'freetogame' && providerId) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: `https://www.freetogame.com/open/${providerId}`,
      }
    };
  }
  
  if (source === 'gamerpower' && metadata?.openGiveawayUrl) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: metadata.openGiveawayUrl as string,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No game access available' };
}

function resolveProduct(ctx: AccessContext): AccessResolverResult {
  const { metadata, url } = ctx;
  
  if (metadata?.checkoutUrl) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: metadata.checkoutUrl as string,
      }
    };
  }
  
  if (metadata?.merchantUrl) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: metadata.merchantUrl as string,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No product checkout URL available' };
}

function resolveAudio(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url } = ctx;
  
  // Spotify tracks/albums/playlists
  if (url?.includes('spotify.com') || source === 'spotify') {
    const spotifyMatch = url?.match(/spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
    if (spotifyMatch) {
      const [, type, id] = spotifyMatch;
      return {
        access: {
          mode: 'embed',
          format: 'html',
          embed: `https://open.spotify.com/embed/${type}/${id}`,
          openWeb: url,
        }
      };
    }
  }
  
  // Apple Podcasts
  if (url?.includes('podcasts.apple.com') || source === 'apple-podcasts') {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  // RSS podcast feeds
  if (metadata?.feedUrl || url?.endsWith('.rss') || url?.endsWith('.xml')) {
    const feedUrl = (metadata?.feedUrl as string) || url;
    return {
      access: {
        mode: 'file',
        format: 'rss',
        uri: feedUrl,
        openWeb: url,
      }
    };
  }
  
  // Direct audio file URLs
  if (url) {
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
    if (ext === 'mp3') {
      return {
        access: {
          mode: 'file',
          format: 'mp3',
          uri: url,
        }
      };
    }
    if (ext === 'aac' || ext === 'm4a') {
      return {
        access: {
          mode: 'file',
          format: 'aac',
          uri: url,
        }
      };
    }
    if (ext === 'ogg') {
      return {
        access: {
          mode: 'file',
          format: 'ogg',
          uri: url,
        }
      };
    }
    if (ext === 'flac') {
      return {
        access: {
          mode: 'file',
          format: 'flac',
          uri: url,
        }
      };
    }
  }
  
  // HLS audio streams
  if (metadata?.streamUrl) {
    const streamUrl = metadata.streamUrl as string;
    if (streamUrl.includes('.m3u8')) {
      return {
        access: {
          mode: 'stream',
          format: 'hls',
          uri: streamUrl,
        }
      };
    }
    if (streamUrl.includes('.mp3') || streamUrl.includes('audio')) {
      return {
        access: {
          mode: 'file',
          format: 'mp3',
          uri: streamUrl,
        }
      };
    }
  }
  
  // SoundCloud embeds
  if (url?.includes('soundcloud.com')) {
    return {
      access: {
        mode: 'embed',
        format: 'html',
        embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false`,
        openWeb: url,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No audio access available' };
}

function resolveApp(ctx: AccessContext): AccessResolverResult {
  const { metadata, url } = ctx;
  
  if (metadata?.launchUrl) {
    return {
      access: {
        mode: 'embed',
        format: 'html',
        embed: metadata.launchUrl as string,
        openWeb: metadata.launchUrl as string,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No app launch URL available' };
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /youtube\.com\/v\/([^&\?\/]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// ============================================================================
// DOCUMENT RESOLVER - PDF, Office, Google Drive, OneDrive, GitHub
// ============================================================================

function resolveDocument(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url, providerId } = ctx;
  
  // Google Drive documents
  if (url?.includes('drive.google.com') || source === 'googledrive') {
    const fileId = extractGoogleDriveId(url || providerId || '');
    if (fileId) {
      return {
        access: {
          mode: 'embed',
          format: 'html',
          embed: `https://drive.google.com/file/d/${fileId}/preview`,
          openWeb: `https://drive.google.com/file/d/${fileId}/view`,
        }
      };
    }
  }
  
  // Google Docs/Sheets/Slides
  if (url?.includes('docs.google.com')) {
    const embedUrl = url.replace('/edit', '/preview').replace('/view', '/preview');
    return {
      access: {
        mode: 'embed',
        format: 'html',
        embed: embedUrl,
        openWeb: url,
      }
    };
  }
  
  // OneDrive documents
  if (url?.includes('onedrive.live.com') || url?.includes('1drv.ms') || source === 'onedrive') {
    return {
      access: {
        mode: 'embed',
        format: 'html',
        embed: url?.replace('view.aspx', 'embed') || url!,
        openWeb: url,
      }
    };
  }
  
  // GitHub file URLs
  if (url?.includes('github.com') && url?.includes('/blob/')) {
    const rawUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    const ext = url.split('.').pop()?.toLowerCase();
    
    if (ext === 'pdf') {
      return {
        access: {
          mode: 'file',
          format: 'pdf',
          uri: rawUrl,
          openWeb: url,
        }
      };
    }
    
    return {
      access: {
        mode: 'openweb',
        format: 'html',
        openWeb: url,
      }
    };
  }
  
  // Direct PDF URLs
  if (url?.endsWith('.pdf') || metadata?.format === 'pdf') {
    return {
      access: {
        mode: 'file',
        format: 'pdf',
        uri: url,
      }
    };
  }
  
  // Direct Office document URLs
  if (url) {
    const ext = url.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc') {
      return {
        access: {
          mode: 'embed',
          format: 'docx',
          embed: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
          uri: url,
        }
      };
    }
    if (ext === 'pptx' || ext === 'ppt') {
      return {
        access: {
          mode: 'embed',
          format: 'pptx',
          embed: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
          uri: url,
        }
      };
    }
    if (ext === 'xlsx' || ext === 'xls') {
      return {
        access: {
          mode: 'embed',
          format: 'xlsx',
          embed: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
          uri: url,
        }
      };
    }
  }
  
  // Fallback to open web
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'none',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No document access available' };
}

function extractGoogleDriveId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{25,})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ============================================================================
// GOVERNANCE RESOLVER - Snapshot, Tally, Voting Portals
// ============================================================================

function resolveGovernance(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url, providerId } = ctx;
  
  // Snapshot.org proposals
  if (url?.includes('snapshot.org') || source === 'snapshot') {
    const proposalMatch = url?.match(/snapshot\.org\/#\/([^\/]+)\/proposal\/([^\/\?]+)/);
    if (proposalMatch) {
      const [, space, proposalId] = proposalMatch;
      return {
        access: {
          mode: 'embed',
          format: 'ballot',
          embed: `https://snapshot.org/#/${space}/proposal/${proposalId}`,
          openWeb: url,
        }
      };
    }
    
    // Space overview
    const spaceMatch = url?.match(/snapshot\.org\/#\/([^\/\?]+)/);
    if (spaceMatch) {
      return {
        access: {
          mode: 'openweb',
          format: 'proposal',
          openWeb: url,
        }
      };
    }
  }
  
  // Tally.xyz proposals
  if (url?.includes('tally.xyz') || source === 'tally') {
    return {
      access: {
        mode: 'openweb',
        format: 'ballot',
        openWeb: url,
      }
    };
  }
  
  // Boardroom governance
  if (url?.includes('boardroom.io')) {
    return {
      access: {
        mode: 'openweb',
        format: 'proposal',
        openWeb: url,
      }
    };
  }
  
  // Generic voting portal with metadata
  if (metadata?.ballotUrl) {
    return {
      access: {
        mode: 'embed',
        format: 'ballot',
        embed: metadata.ballotUrl as string,
        openWeb: metadata.ballotUrl as string,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'proposal',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No governance access available' };
}

// ============================================================================
// GALLERY RESOLVER - Images, Photo Collections, Unsplash, Flickr
// ============================================================================

function resolveGallery(ctx: AccessContext): AccessResolverResult {
  const { source, metadata, url } = ctx;
  
  // Unsplash photos
  if (url?.includes('unsplash.com') || source === 'unsplash') {
    const photoMatch = url?.match(/unsplash\.com\/photos\/([a-zA-Z0-9_-]+)/);
    if (photoMatch) {
      return {
        access: {
          mode: 'embed',
          format: 'image',
          embed: `https://unsplash.com/photos/${photoMatch[1]}/download`,
          uri: `https://images.unsplash.com/photo-${photoMatch[1]}?w=1200`,
          openWeb: url,
        }
      };
    }
  }
  
  // Flickr photos
  if (url?.includes('flickr.com')) {
    return {
      access: {
        mode: 'openweb',
        format: 'image',
        openWeb: url,
      }
    };
  }
  
  // Direct image URLs
  if (url) {
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext || '')) {
      return {
        access: {
          mode: 'file',
          format: 'image',
          uri: url,
        }
      };
    }
  }
  
  // Gallery with multiple images in metadata
  if (metadata?.images && Array.isArray(metadata.images)) {
    return {
      access: {
        mode: 'embed',
        format: 'gallery',
        uri: (metadata.images as string[])[0],
        openWeb: url,
      }
    };
  }
  
  if (url) {
    return {
      access: {
        mode: 'openweb',
        format: 'image',
        openWeb: url,
      }
    };
  }
  
  return { access: null, error: 'No gallery access available' };
}

export { AccessManifest, AccessMode, AccessFormat };
