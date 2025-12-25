/**
 * ModsService - CurseForge/Modrinth API integration and local mod catalog management
 * 
 * Absorbs mods from external modding platforms:
 * - CurseForge: https://api.curseforge.com/v1 (requires API key)
 * - Modrinth: https://api.modrinth.com/v2 (public API)
 * 
 * Provides local search and mod enable/disable management with receipt tracking.
 */

import { db } from '../../db';
import {
  mods,
  gameDeckReceipts,
  type Mod,
  type InsertMod,
} from '@shared/schema';
import { eq, and, or, ilike } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

// CurseForge API Types

interface CurseForgeModAuthor {
  id: number;
  name: string;
  url: string;
}

interface CurseForgeModFile {
  id: number;
  gameId: number;
  modId: number;
  displayName: string;
  fileName: string;
  releaseType: number;
  fileStatus: number;
  downloadUrl: string;
  downloadCount: number;
}

interface CurseForgeMod {
  id: number;
  gameId: number;
  name: string;
  slug: string;
  links: {
    websiteUrl: string;
    wikiUrl?: string;
    issuesUrl?: string;
    sourceUrl?: string;
  };
  summary: string;
  status: number;
  downloadCount: number;
  isFeatured: boolean;
  primaryCategoryId: number;
  categories: Array<{ id: number; gameId: number; name: string; slug: string }>;
  classId?: number;
  authors: CurseForgeModAuthor[];
  logo?: {
    id: number;
    modId: number;
    title: string;
    description: string;
    thumbnailUrl: string;
    url: string;
  };
  screenshots?: Array<{ id: number; modId: number; title: string; url: string }>;
  mainFileId?: number;
  latestFiles?: CurseForgeModFile[];
  latestFilesIndexes?: Array<{ gameVersion: string; fileId: number; filename: string }>;
  dateCreated: string;
  dateModified: string;
  dateReleased: string;
  allowModDistribution?: boolean;
  gamePopularityRank?: number;
  isAvailable?: boolean;
  thumbsUpCount?: number;
}

interface CurseForgeSearchResponse {
  data: CurseForgeMod[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

// Modrinth API Types

interface ModrinthProject {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: string;
  server_side: string;
  body: string;
  status: string;
  requested_status?: string;
  additional_categories?: string[];
  issues_url?: string;
  source_url?: string;
  wiki_url?: string;
  discord_url?: string;
  donation_urls?: Array<{ id: string; platform: string; url: string }>;
  project_type: string;
  downloads: number;
  icon_url?: string;
  color?: number;
  thread_id?: string;
  monetization_status?: string;
  id: string;
  team: string;
  published: string;
  updated: string;
  approved?: string;
  queued?: string;
  followers: number;
  license?: { id: string; name: string; url?: string };
  versions: string[];
  game_versions: string[];
  loaders: string[];
  gallery?: Array<{ url: string; featured: boolean; title?: string; description?: string }>;
}

interface ModrinthSearchHit {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: string;
  server_side: string;
  project_type: string;
  downloads: number;
  icon_url?: string;
  color?: number;
  project_id: string;
  author: string;
  display_categories: string[];
  versions: string[];
  follows: number;
  date_created: string;
  date_modified: string;
  latest_version?: string;
  license?: string;
  gallery?: string[];
  featured_gallery?: string;
}

interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

// Filter Types

export interface CurseForgeFilters {
  searchFilter?: string;
  categoryId?: number;
  gameVersion?: string;
  modLoaderType?: number;
  sortField?: 'Featured' | 'Popularity' | 'LastUpdated' | 'Name' | 'Author' | 'TotalDownloads' | 'Category' | 'GameVersion';
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  index?: number;
}

export interface ModrinthFilters {
  query?: string;
  facets?: string[][];
  index?: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated';
  offset?: number;
  limit?: number;
}

export interface SearchFilters {
  title?: string;
  source?: 'curseforge' | 'modrinth';
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

export interface PullResult {
  fetched: number;
  upserted: number;
  errors: string[];
}

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `mods:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Normalize CurseForge mod to InsertMod format
 */
function normalizeCurseForgeMod(mod: CurseForgeMod, gameId: string, wallet: string): InsertMod {
  const latestFile = mod.latestFiles?.[0];
  
  return {
    gameId,
    wallet,
    title: mod.name,
    description: mod.summary,
    version: latestFile?.displayName || undefined,
    source: 'curseforge',
    sourceId: `cf:${mod.gameId}:${mod.id}`,
    url: mod.links.websiteUrl,
    enabled: false,
    downloadCount: mod.downloadCount,
    metadata: {
      curseforgeId: mod.id,
      curseforgeGameId: mod.gameId,
      slug: mod.slug,
      authors: mod.authors.map(a => ({ id: a.id, name: a.name })),
      categories: mod.categories.map(c => ({ id: c.id, name: c.name, slug: c.slug })),
      logoUrl: mod.logo?.url,
      thumbnailUrl: mod.logo?.thumbnailUrl,
      dateCreated: mod.dateCreated,
      dateModified: mod.dateModified,
      dateReleased: mod.dateReleased,
      isFeatured: mod.isFeatured,
      gamePopularityRank: mod.gamePopularityRank,
      thumbsUpCount: mod.thumbsUpCount,
      latestFileId: latestFile?.id,
      latestFileName: latestFile?.fileName,
    },
  };
}

/**
 * Normalize Modrinth project to InsertMod format
 */
function normalizeModrinthProject(project: ModrinthSearchHit, gameId: string, wallet: string): InsertMod {
  return {
    gameId,
    wallet,
    title: project.title,
    description: project.description,
    version: project.latest_version || undefined,
    source: 'modrinth',
    sourceId: `mr:${project.project_id}`,
    url: `https://modrinth.com/${project.project_type}/${project.slug}`,
    enabled: false,
    downloadCount: project.downloads,
    metadata: {
      modrinthId: project.project_id,
      slug: project.slug,
      author: project.author,
      categories: project.categories,
      displayCategories: project.display_categories,
      clientSide: project.client_side,
      serverSide: project.server_side,
      projectType: project.project_type,
      iconUrl: project.icon_url,
      color: project.color,
      license: project.license,
      follows: project.follows,
      versions: project.versions,
      dateCreated: project.date_created,
      dateModified: project.date_modified,
      gallery: project.gallery,
      featuredGallery: project.featured_gallery,
    },
  };
}

/**
 * Pull mods from CurseForge API
 * 
 * Fetches mods from CurseForge and upserts into local database.
 * Requires CURSEFORGE_API_KEY environment variable.
 * 
 * @param gameId - Game ID to associate mods with (local game reference)
 * @param curseforgeGameId - CurseForge game ID (e.g., 432 for Minecraft)
 * @param wallet - Wallet address to associate with pulled mods
 * @param filters - Optional filters for search, category, version, etc.
 * @returns Object with counts and any errors
 */
export async function pullCurseForge(
  gameId: string,
  curseforgeGameId: number,
  wallet: string,
  filters?: CurseForgeFilters
): Promise<PullResult> {
  const errors: string[] = [];
  
  const apiKey = process.env.CURSEFORGE_API_KEY;
  if (!apiKey) {
    return {
      fetched: 0,
      upserted: 0,
      errors: ['CURSEFORGE_API_KEY environment variable is not set. Please configure it to use CurseForge API.'],
    };
  }

  let fetchedMods: CurseForgeMod[] = [];

  try {
    const params = new URLSearchParams();
    params.append('gameId', curseforgeGameId.toString());
    
    if (filters?.searchFilter) {
      params.append('searchFilter', filters.searchFilter);
    }
    if (filters?.categoryId) {
      params.append('categoryId', filters.categoryId.toString());
    }
    if (filters?.gameVersion) {
      params.append('gameVersion', filters.gameVersion);
    }
    if (filters?.modLoaderType !== undefined) {
      params.append('modLoaderType', filters.modLoaderType.toString());
    }
    if (filters?.sortField) {
      const sortFieldMap: Record<string, number> = {
        'Featured': 1,
        'Popularity': 2,
        'LastUpdated': 3,
        'Name': 4,
        'Author': 5,
        'TotalDownloads': 6,
        'Category': 7,
        'GameVersion': 8,
      };
      params.append('sortField', sortFieldMap[filters.sortField]?.toString() || '2');
    }
    if (filters?.sortOrder) {
      params.append('sortOrder', filters.sortOrder);
    }
    
    params.append('pageSize', (filters?.pageSize || 50).toString());
    params.append('index', (filters?.index || 0).toString());

    const url = `https://api.curseforge.com/v1/mods/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
        'User-Agent': 'P3-GameDeck/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CurseForge API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as CurseForgeSearchResponse;
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('CurseForge API returned invalid data format');
    }

    fetchedMods = data.data;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching CurseForge';
    errors.push(errorMsg);
    return { fetched: 0, upserted: 0, errors };
  }

  let upsertedCount = 0;

  for (const mod of fetchedMods) {
    try {
      const normalized = normalizeCurseForgeMod(mod, gameId, wallet);
      
      const existingMod = await db
        .select()
        .from(mods)
        .where(eq(mods.sourceId, normalized.sourceId!))
        .limit(1);

      if (existingMod.length > 0) {
        await db
          .update(mods)
          .set({
            title: normalized.title,
            description: normalized.description,
            version: normalized.version,
            url: normalized.url,
            downloadCount: normalized.downloadCount,
            metadata: normalized.metadata,
            updatedAt: new Date(),
          })
          .where(eq(mods.sourceId, normalized.sourceId!));
      } else {
        await db.insert(mods).values(normalized);
      }

      upsertedCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error upserting mod';
      errors.push(`Failed to upsert cf:${mod.gameId}:${mod.id}: ${errorMsg}`);
    }
  }

  return {
    fetched: fetchedMods.length,
    upserted: upsertedCount,
    errors,
  };
}

/**
 * Pull mods from Modrinth API
 * 
 * Fetches mods from Modrinth (public API) and upserts into local database.
 * No API key required - Modrinth has a public API.
 * 
 * @param gameId - Game ID to associate mods with (local game reference)
 * @param wallet - Wallet address to associate with pulled mods
 * @param filters - Optional filters for query, facets, sorting, pagination
 * @returns Object with counts and any errors
 */
export async function pullModrinth(
  gameId: string,
  wallet: string,
  filters?: ModrinthFilters
): Promise<PullResult> {
  const errors: string[] = [];
  let fetchedProjects: ModrinthSearchHit[] = [];

  try {
    const params = new URLSearchParams();
    
    if (filters?.query) {
      params.append('query', filters.query);
    }
    if (filters?.facets && filters.facets.length > 0) {
      params.append('facets', JSON.stringify(filters.facets));
    }
    if (filters?.index) {
      params.append('index', filters.index);
    }
    
    params.append('limit', (filters?.limit || 100).toString());
    params.append('offset', (filters?.offset || 0).toString());

    const url = `https://api.modrinth.com/v2/search?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'P3-GameDeck/1.0 (contact@p3protocol.com)',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modrinth API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json() as ModrinthSearchResponse;
    
    if (!data.hits || !Array.isArray(data.hits)) {
      throw new Error('Modrinth API returned invalid data format');
    }

    fetchedProjects = data.hits;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching Modrinth';
    errors.push(errorMsg);
    return { fetched: 0, upserted: 0, errors };
  }

  let upsertedCount = 0;

  for (const project of fetchedProjects) {
    try {
      const normalized = normalizeModrinthProject(project, gameId, wallet);
      
      const existingMod = await db
        .select()
        .from(mods)
        .where(eq(mods.sourceId, normalized.sourceId!))
        .limit(1);

      if (existingMod.length > 0) {
        await db
          .update(mods)
          .set({
            title: normalized.title,
            description: normalized.description,
            version: normalized.version,
            url: normalized.url,
            downloadCount: normalized.downloadCount,
            metadata: normalized.metadata,
            updatedAt: new Date(),
          })
          .where(eq(mods.sourceId, normalized.sourceId!));
      } else {
        await db.insert(mods).values(normalized);
      }

      upsertedCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error upserting mod';
      errors.push(`Failed to upsert mr:${project.project_id}: ${errorMsg}`);
    }
  }

  return {
    fetched: fetchedProjects.length,
    upserted: upsertedCount,
    errors,
  };
}

/**
 * Search local mods catalog
 * 
 * Searches the local mods database with optional filters.
 * Supports filtering by title, source, and enabled status.
 * 
 * @param gameId - Game ID to search mods for
 * @param filters - Optional search filters
 * @returns Array of matching mods
 */
export async function searchMods(gameId: string, filters?: SearchFilters): Promise<Mod[]> {
  const conditions = [eq(mods.gameId, gameId)];

  if (filters?.title) {
    conditions.push(ilike(mods.title, `%${filters.title}%`));
  }

  if (filters?.source) {
    conditions.push(eq(mods.source, filters.source));
  }

  if (filters?.enabled !== undefined) {
    conditions.push(eq(mods.enabled, filters.enabled));
  }

  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;

  try {
    return await db
      .select()
      .from(mods)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(mods.title);
  } catch (err) {
    console.error('Error searching mods:', err);
    return [];
  }
}

/**
 * Enable a mod for a wallet
 * 
 * Sets mod.enabled = true and creates an audit receipt.
 * 
 * @param wallet - Wallet address enabling the mod
 * @param modId - Mod ID (UUID from local database)
 * @returns The updated mod or null on error
 */
export async function enableMod(wallet: string, modId: string): Promise<Mod | null> {
  try {
    const [existingMod] = await db
      .select()
      .from(mods)
      .where(eq(mods.id, modId))
      .limit(1);

    if (!existingMod) {
      throw new Error(`Mod not found: ${modId}`);
    }

    const [updatedMod] = await db
      .update(mods)
      .set({
        enabled: true,
        updatedAt: new Date(),
      })
      .where(eq(mods.id, modId))
      .returning();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'modsService',
      action: 'mod.enable',
      metaJson: {
        modId,
        modTitle: existingMod.title,
        source: existingMod.source,
        sourceId: existingMod.sourceId,
        gameId: existingMod.gameId,
      },
      requestId,
    });

    return updatedMod;
  } catch (err) {
    console.error('Error enabling mod:', err);
    return null;
  }
}

/**
 * Disable a mod for a wallet
 * 
 * Sets mod.enabled = false and creates an audit receipt.
 * 
 * @param wallet - Wallet address disabling the mod
 * @param modId - Mod ID (UUID from local database)
 * @returns The updated mod or null on error
 */
export async function disableMod(wallet: string, modId: string): Promise<Mod | null> {
  try {
    const [existingMod] = await db
      .select()
      .from(mods)
      .where(eq(mods.id, modId))
      .limit(1);

    if (!existingMod) {
      throw new Error(`Mod not found: ${modId}`);
    }

    const [updatedMod] = await db
      .update(mods)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(eq(mods.id, modId))
      .returning();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'modsService',
      action: 'mod.disable',
      metaJson: {
        modId,
        modTitle: existingMod.title,
        source: existingMod.source,
        sourceId: existingMod.sourceId,
        gameId: existingMod.gameId,
      },
      requestId,
    });

    return updatedMod;
  } catch (err) {
    console.error('Error disabling mod:', err);
    return null;
  }
}

/**
 * Get enabled mods for a wallet and game
 * 
 * Returns all mods that are enabled for a specific wallet and game combination.
 * 
 * @param wallet - Wallet address
 * @param gameId - Game ID
 * @returns Array of enabled mods
 */
export async function getEnabledMods(wallet: string, gameId: string): Promise<Mod[]> {
  try {
    return await db
      .select()
      .from(mods)
      .where(
        and(
          eq(mods.wallet, wallet),
          eq(mods.gameId, gameId),
          eq(mods.enabled, true)
        )
      )
      .orderBy(mods.title);
  } catch (err) {
    console.error('Error getting enabled mods:', err);
    return [];
  }
}

/**
 * Get a single mod by ID
 * 
 * @param modId - Mod ID (UUID)
 * @returns Mod or null if not found
 */
export async function getMod(modId: string): Promise<Mod | null> {
  try {
    const [mod] = await db
      .select()
      .from(mods)
      .where(eq(mods.id, modId))
      .limit(1);

    return mod || null;
  } catch (err) {
    console.error('Error getting mod:', err);
    return null;
  }
}

/**
 * Get mods by source
 * 
 * @param source - Source to filter by ('curseforge' or 'modrinth')
 * @param gameId - Optional game ID filter
 * @param limit - Max results (default: 100)
 * @returns Array of mods from the specified source
 */
export async function getModsBySource(
  source: 'curseforge' | 'modrinth',
  gameId?: string,
  limit: number = 100
): Promise<Mod[]> {
  try {
    const conditions = [eq(mods.source, source)];
    
    if (gameId) {
      conditions.push(eq(mods.gameId, gameId));
    }

    return await db
      .select()
      .from(mods)
      .where(and(...conditions))
      .limit(limit)
      .orderBy(mods.updatedAt);
  } catch (err) {
    console.error('Error getting mods by source:', err);
    return [];
  }
}

/**
 * Get mod by source ID
 * 
 * @param sourceId - Source ID (e.g., "cf:432:12345" or "mr:abc123")
 * @returns Mod or null if not found
 */
export async function getModBySourceId(sourceId: string): Promise<Mod | null> {
  try {
    const [mod] = await db
      .select()
      .from(mods)
      .where(eq(mods.sourceId, sourceId))
      .limit(1);

    return mod || null;
  } catch (err) {
    console.error('Error getting mod by source ID:', err);
    return null;
  }
}
