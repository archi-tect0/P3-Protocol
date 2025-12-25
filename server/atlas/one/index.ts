/**
 * Atlas One - Unified Substrate Surface
 * 
 * The convergence point for all digital experiences:
 * - Games (synced from FreeToGame, GamerPower)
 * - Media (TV/Video with OMDB ratings, 48hr rentals)
 * - Ebooks (Google Books, Open Library, Gutendex imports)
 * - Apps (Marketplace applications)
 * - Products (Physical/digital goods)
 * 
 * One substrate, one marketplace, one identity.
 */

export * from './catalog/index';
export * from './content/index';
export * from './commerce/index';
export * from './sessions/index';
export * from './intent/index';
export * from './types';

export const ATLAS_ONE_VERSION = '1.0.0';
export const EXPERIENCE_KINDS = ['game', 'video', 'ebook', 'app', 'product', 'audio'] as const;
export type ExperienceKind = typeof EXPERIENCE_KINDS[number];
