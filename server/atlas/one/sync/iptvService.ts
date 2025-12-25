/**
 * IPTV Service - Free Live TV Channel Sync
 * 
 * Syncs free-to-air TV channels from IPTV-org public database.
 * Provides 38,000+ channels across 200+ countries.
 * 
 * Data sources:
 * - https://iptv-org.github.io/api/channels.json (metadata)
 * - https://iptv-org.github.io/api/streams.json (stream URLs)
 */

import { db } from '../../../db';
import { marketplaceItems } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface IPTVChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

interface IPTVStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  quality: string | null;
  user_agent: string | null;
  referrer: string | null;
}

interface SyncOptions {
  countries?: string[];
  categories?: string[];
  limit?: number;
  excludeNSFW?: boolean;
}

interface SyncResult {
  fetched: number;
  imported: number;
  skipped: number;
  errors: string[];
}

const IPTV_API_BASE = 'https://iptv-org.github.io/api';

const CATEGORY_MAP: Record<string, string> = {
  'general': 'General',
  'entertainment': 'Entertainment',
  'news': 'News',
  'sports': 'Sports',
  'music': 'Music',
  'movies': 'Movies',
  'kids': 'Kids',
  'documentary': 'Documentary',
  'education': 'Education',
  'religious': 'Religious',
  'lifestyle': 'Lifestyle',
  'comedy': 'Comedy',
  'animation': 'Animation',
  'series': 'Series',
  'culture': 'Culture',
  'travel': 'Travel',
  'cooking': 'Cooking',
  'science': 'Science',
  'business': 'Business',
  'weather': 'Weather',
  'outdoor': 'Outdoor',
  'family': 'Family',
  'classic': 'Classic',
  'auto': 'Auto',
};

const COUNTRY_NAMES: Record<string, string> = {
  'US': 'United States',
  'UK': 'United Kingdom',
  'CA': 'Canada',
  'AU': 'Australia',
  'IN': 'India',
  'DE': 'Germany',
  'FR': 'France',
  'ES': 'Spain',
  'IT': 'Italy',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'JP': 'Japan',
  'KR': 'South Korea',
  'CN': 'China',
  'RU': 'Russia',
};

/**
 * Fetch all channels from IPTV-org
 */
async function fetchChannels(): Promise<IPTVChannel[]> {
  const response = await fetch(`${IPTV_API_BASE}/channels.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch channels: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch all streams from IPTV-org
 */
async function fetchStreams(): Promise<IPTVStream[]> {
  const response = await fetch(`${IPTV_API_BASE}/streams.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch streams: ${response.status}`);
  }
  return response.json();
}

/**
 * Generate a logo URL for a channel (using country flag as fallback)
 */
function getChannelLogo(channel: IPTVChannel): string | null {
  return `https://flagcdn.com/w80/${channel.country.toLowerCase()}.png`;
}

/**
 * Sync IPTV channels to marketplace_items
 * 
 * @param options - Sync options (countries, categories, limit)
 * @returns Sync results
 */
export async function syncIPTVChannels(options: SyncOptions = {}): Promise<SyncResult> {
  const {
    countries = [], // Empty = all countries (no filter)
    categories,
    limit = 10000, // Increased default to capture most channels
    excludeNSFW = true,
  } = options;

  const result: SyncResult = {
    fetched: 0,
    imported: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log('Fetching IPTV channels and streams...');
    const [allChannels, allStreams] = await Promise.all([
      fetchChannels(),
      fetchStreams(),
    ]);

    console.log(`Fetched ${allChannels.length} channels, ${allStreams.length} streams`);

    const streamsByChannel = new Map<string, IPTVStream>();
    for (const stream of allStreams) {
      if (stream.channel && stream.url) {
        if (!streamsByChannel.has(stream.channel)) {
          streamsByChannel.set(stream.channel, stream);
        }
      }
    }

    console.log(`${streamsByChannel.size} channels have streams`);

    let filteredChannels = allChannels.filter(ch => {
      if (excludeNSFW && ch.is_nsfw) return false;
      if (ch.closed) return false;
      if (!streamsByChannel.has(ch.id)) return false;
      if (countries.length > 0 && !countries.includes(ch.country)) return false;
      if (categories && categories.length > 0) {
        if (!ch.categories.some(cat => categories.includes(cat))) return false;
      }
      return true;
    });

    console.log(`${filteredChannels.length} channels match filters`);

    filteredChannels.sort((a, b) => {
      const aScore = (a.categories.includes('news') ? 3 : 0) +
                     (a.categories.includes('sports') ? 2 : 0) +
                     (a.categories.includes('entertainment') ? 1 : 0);
      const bScore = (b.categories.includes('news') ? 3 : 0) +
                     (b.categories.includes('sports') ? 2 : 0) +
                     (b.categories.includes('entertainment') ? 1 : 0);
      return bScore - aScore;
    });

    const channelsToSync = filteredChannels.slice(0, limit);
    result.fetched = channelsToSync.length;

    console.log(`Syncing ${channelsToSync.length} channels...`);

    for (const channel of channelsToSync) {
      try {
        const stream = streamsByChannel.get(channel.id);
        if (!stream) continue;

        const slug = `live-tv-${channel.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

        const [existing] = await db
          .select()
          .from(marketplaceItems)
          .where(eq(marketplaceItems.slug, slug))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        const categoryName = channel.categories[0] 
          ? CATEGORY_MAP[channel.categories[0]] || channel.categories[0]
          : 'General';

        const countryName = COUNTRY_NAMES[channel.country] || channel.country;
        const now = new Date();

        await db.insert(marketplaceItems).values({
          itemType: 'video',
          title: channel.name,
          slug,
          description: `Live TV channel from ${countryName}. ${channel.network ? `Network: ${channel.network}` : ''}`,
          thumbnail: getChannelLogo(channel),
          creatorWallet: 'system',
          category: 'live-tv',
          priceWei: '0',
          currency: 'ETH',
          status: 'published',
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
          tags: [
            'live-tv',
            channel.country.toLowerCase(),
            ...channel.categories.map(c => CATEGORY_MAP[c] || c).slice(0, 3),
          ],
          metadata: {
            externalSource: 'iptv-org',
            externalId: channel.id,
            streamUrl: stream.url,
            streamQuality: stream.quality,
            streamUserAgent: stream.user_agent,
            streamReferrer: stream.referrer,
            country: channel.country,
            countryName,
            network: channel.network,
            categories: channel.categories,
            categoryName,
            website: channel.website,
            altNames: channel.alt_names,
            isLive: true,
            mediaType: 'live-tv',
          },
        });

        result.imported++;

      } catch (err: any) {
        result.errors.push(`${channel.name}: ${err.message}`);
      }
    }

    console.log(`IPTV sync complete: ${result.imported} imported, ${result.skipped} skipped`);
    return result;

  } catch (err: any) {
    console.error('IPTV sync error:', err);
    result.errors.push(err.message);
    return result;
  }
}

/**
 * Sync popular channels from major English-speaking countries
 */
export async function syncPopularChannels(): Promise<SyncResult> {
  return syncIPTVChannels({
    countries: ['US', 'UK', 'CA', 'AU'],
    limit: 300,
    excludeNSFW: true,
  });
}

/**
 * Sync news channels globally
 */
export async function syncNewsChannels(): Promise<SyncResult> {
  return syncIPTVChannels({
    countries: ['US', 'UK', 'CA', 'AU', 'IN', 'FR', 'DE'],
    categories: ['news'],
    limit: 200,
    excludeNSFW: true,
  });
}

/**
 * Sync sports channels
 */
export async function syncSportsChannels(): Promise<SyncResult> {
  return syncIPTVChannels({
    countries: ['US', 'UK', 'CA', 'AU', 'ES', 'IT', 'DE', 'FR'],
    categories: ['sports'],
    limit: 150,
    excludeNSFW: true,
  });
}

/**
 * Sync kids/family channels
 */
export async function syncKidsChannels(): Promise<SyncResult> {
  return syncIPTVChannels({
    countries: ['US', 'UK', 'CA', 'AU'],
    categories: ['kids', 'animation', 'family'],
    limit: 100,
    excludeNSFW: true,
  });
}

/**
 * Get channel categories with counts
 */
export function getIPTVCategories(): { category: string; label: string }[] {
  return Object.entries(CATEGORY_MAP).map(([key, label]) => ({
    category: key,
    label,
  }));
}

/**
 * Get available countries with names
 */
export function getIPTVCountries(): { code: string; name: string }[] {
  return Object.entries(COUNTRY_NAMES).map(([code, name]) => ({
    code,
    name,
  }));
}
