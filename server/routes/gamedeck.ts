import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import {
  games,
  gameEvents,
  gameDeckReceipts,
  gameEventTypes,
  gameSources,
  gameNfts,
  anchorLedger,
  anchorRecords,
  anchorProofs,
  leaderboards,
  tournaments,
  leaderboardTypes,
  gameFavorites,
} from '@shared/schema';
import { and, desc } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import {
  searchGames,
  favoriteGame,
  pullFreeToGame,
  pullGamerPower,
} from '../atlas/gamedeck/gamesService';
import {
  anchorEventDirect,
  anchorEventsBatch,
  getEventAnchorStatus,
  FEE_WEI,
} from '../atlas/gamedeck/anchorService';
import {
  searchMods,
  pullCurseForge,
  pullModrinth,
  enableMod,
  disableMod,
  getEnabledMods,
} from '../atlas/gamedeck/modsService';
import {
  sendInvite,
  respondInvite,
  getInvites,
} from '../atlas/gamedeck/socialService';
import {
  getTrending,
  getFeatured,
  computeGovernance,
} from '../atlas/gamedeck/discoveryService';
import {
  initiatePurchase,
  completePurchase,
  verifyPurchase,
  getPurchases,
  checkOwnership,
  anchorPurchase,
} from '../atlas/gamedeck/purchasesService';
import {
  createSession,
  createGame,
  uploadBuild,
  publishBuild,
  updateGame,
  registerEndpoint,
  getWalletGames,
  getBuilds,
  getEndpoints,
} from '../atlas/gamedeck/sandboxService';
import {
  startAutoSync,
  stopAutoSync,
  triggerSync,
  getAutoSyncStatus,
} from '../atlas/gamedeck/autoSyncService';
import {
  downloadAndStoreEpub,
  getEpubBuffer,
  isEpubDownloaded,
  getEpubServeUrl,
} from '../services/epubStorage';
import {
  searchItems,
  createItem,
  updateItem,
  getItem,
  getCategories,
  getCategory,
  getCategoryItems,
  getStore,
  getStoreItems,
  addMediaAsset,
  getMediaAssets,
  getMediaAsset,
  type SearchFilters,
  type CreateItemData,
  type MediaAssetData,
  type ItemType,
} from '../atlas/gamedeck/catalogService';
import { mods, governanceAccounts, purchases, itemBuilds, marketplaceItems, marketplaceReceiptsTable } from '@shared/schema';
import {
  rentMedia,
  purchaseMedia,
  checkAccess,
  getLibrary,
  savePlaybackPosition,
  getPlaybackPosition,
  getRatings,
  addRating,
  getVideoItems,
  getFeaturedMedia,
  getContinueWatching,
  getRecentlyAdded,
  getPopularMedia,
} from '../atlas/gamedeck/mediaService';

import {
  importFromGoogleBooks,
  importFromOpenLibrary,
  importFromGutendex,
  purchaseEbook,
  checkEbookAccess,
  getEbookLibrary,
  removeFromLibrary,
  saveProgress,
  getProgress,
  addHighlight,
  addNote,
  addBookmark,
  getEbookCatalog,
  getContinueReading,
  getRecentSyncJobs,
} from '../atlas/gamedeck/ebookService';

const router = Router();

const logger = {
  info: (msg: string, data?: any) => console.log(`[GAMEDECK] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[GAMEDECK ERROR] ${msg}`, data || ''),
};

function getWallet(req: Request): string | null {
  return (req as any).wallet || (req.headers['x-wallet-address'] as string) || null;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function generateRequestId(): string {
  return `gamedeck:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

const GameSubmitSchema = z.object({
  title: z.string().min(1).max(200),
  genre: z.string().optional(),
  platform: z.string().optional(),
  url: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
  developer: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

const GameEventSchema = z.object({
  gameId: z.string().min(1),
  type: z.enum(gameEventTypes),
  payload: z.record(z.any()),
});

const PullGamesSchema = z.object({
  source: z.enum(['freetogame', 'gamerpower']),
  filters: z.object({
    genre: z.string().optional(),
    platform: z.string().optional(),
    search: z.string().optional(),
    type: z.string().optional(),
  }).optional(),
});

const FavoriteGameSchema = z.object({
  gameId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const AnchorDirectSchema = z.object({
  chain: z.string().default('base'),
  gameId: z.string().min(1),
  eventId: z.string().uuid(),
});

const AnchorBatchSchema = z.object({
  chain: z.string().default('base'),
  gameId: z.string().min(1),
  eventIds: z.array(z.string().uuid()).min(1).max(100),
});

const NftInjectSchema = z.object({
  chain: z.string().min(1),
  contract: z.string().min(1),
  tokenId: z.string().min(1),
  metadata: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    attributes: z.array(z.any()).optional(),
  }).optional(),
});

const LeaderboardSubmitSchema = z.object({
  gameId: z.string().min(1),
  score: z.number(),
  eventId: z.string().uuid(),
  key: z.string().min(1).default('global'),
});

const TournamentCreateSchema = z.object({
  gameId: z.string().min(1),
  name: z.string().min(1).max(200),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  rulesJson: z.record(z.any()).optional(),
  prizePool: z.record(z.any()).optional(),
  maxParticipants: z.number().int().positive().optional(),
});

const TournamentAnchorSchema = z.object({
  chain: z.string().default('base'),
});

const ModsPullSchema = z.object({
  gameId: z.string().min(1),
  source: z.enum(['curseforge', 'modrinth']),
  curseforgeGameId: z.number().int().positive().optional(),
  filters: z.object({
    query: z.string().optional(),
    searchFilter: z.string().optional(),
    categoryId: z.number().int().optional(),
    gameVersion: z.string().optional(),
  }).optional(),
});

const ModSubmitSchema = z.object({
  gameId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  version: z.string().max(50).optional(),
  url: z.string().url().optional(),
});

const InviteSendSchema = z.object({
  toWallet: z.string().min(1),
  gameId: z.string().optional(),
  sessionId: z.string().optional(),
});

const InviteRespondSchema = z.object({
  response: z.enum(['accept', 'decline']),
});

const TrendingQuerySchema = z.object({
  period: z.enum(['daily', 'weekly']).default('daily'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const FeaturedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const InitiatePurchaseSchema = z.object({
  gameId: z.string().min(1).optional(),
  modId: z.string().min(1).optional(),
  priceWei: z.string().min(1),
  currency: z.string().default('ETH'),
  itemType: z.enum(['game', 'mod', 'dlc', 'subscription']).default('game'),
  metadata: z.record(z.any()).optional(),
}).refine((data) => data.gameId || data.modId, {
  message: 'Either gameId or modId must be provided',
});

const CompletePurchaseSchema = z.object({
  txHash: z.string().min(1),
});

const AnchorPurchaseSchema = z.object({
  chain: z.string().default('base'),
});

const PurchasesQuerySchema = z.object({
  status: z.enum(['pending', 'complete', 'failed', 'refunded']).optional(),
  itemType: z.enum(['game', 'mod', 'dlc', 'subscription']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const OwnershipQuerySchema = z.object({
  gameId: z.string().min(1).optional(),
  modId: z.string().min(1).optional(),
}).refine((data) => data.gameId || data.modId, {
  message: 'Either gameId or modId must be provided',
});

const SandboxCreateGameSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  description: z.string().max(2000).optional(),
});

const SandboxBuildUploadSchema = z.object({
  gameId: z.string().min(1),
  version: z.string().min(1).max(50),
  artifactUrl: z.string().url(),
  changelog: z.string().max(5000).optional(),
});

const SandboxBuildPublishSchema = z.object({
  buildId: z.string().min(1),
  priceWei: z.string().optional(),
});

const SandboxGameUpdateSchema = z.object({
  gameId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  priceWei: z.string().optional(),
});

const SandboxEndpointRegisterSchema = z.object({
  gameId: z.string().min(1),
  label: z.string().min(1).max(100),
  url: z.string().url(),
  authKind: z.enum(['api-key', 'oauth', 'none']),
});

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = GameSubmitSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { title, genre, platform, url, thumbnail, developer, description, tags } = parse.data;

    const slug = generateSlug(title);
    const gameId = `dev:${developer}:${slug}`;

    const [existingGame] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    let game;
    if (existingGame) {
      [game] = await db
        .update(games)
        .set({
          title,
          genre: genre || null,
          platform: platform || null,
          url: url || null,
          thumbnail: thumbnail || null,
          developer,
          description: description || null,
          tags: tags || [],
          updatedAt: new Date(),
        })
        .where(eq(games.id, gameId))
        .returning();
    } else {
      [game] = await db
        .insert(games)
        .values({
          id: gameId,
          title,
          genre: genre || null,
          platform: platform || null,
          url: url || null,
          thumbnail: thumbnail || null,
          source: 'developer',
          developer,
          description: description || null,
          tags: tags || [],
        })
        .returning();
    }

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: existingGame ? 'game.update' : 'game.submit',
      metaJson: {
        gameId,
        title,
        developer,
      },
      requestId,
    });

    logger.info(`Game ${existingGame ? 'updated' : 'submitted'}: ${gameId}`, { wallet, developer });
    res.status(existingGame ? 200 : 201).json({ game });
  } catch (err: any) {
    logger.error(`Submit game failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/event', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = GameEventSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, type, payload } = parse.data;

    const [existingGame] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const [event] = await db
      .insert(gameEvents)
      .values({
        wallet,
        gameId,
        eventType: type,
        payload,
        developer: existingGame.developer,
      })
      .returning();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: `event.${type}`,
      metaJson: {
        eventId: event.id,
        gameId,
        gameTitle: existingGame.title,
        eventType: type,
        payload,
      },
      requestId,
    });

    logger.info(`Game event logged: ${type}`, { wallet, gameId, eventId: event.id });
    res.status(201).json({ event });
  } catch (err: any) {
    logger.error(`Log event failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/games', async (req: Request, res: Response) => {
  try {
    const { q, genre, platform, source, limit, offset } = req.query;

    const validSources = ['developer', 'freetogame', 'gamerpower', 'itch'] as const;
    const sourceFilter = source && validSources.includes(source as any)
      ? (source as typeof validSources[number])
      : undefined;

    const filters = {
      search: q as string | undefined,
      genre: genre as string | undefined,
      platform: platform as string | undefined,
      source: sourceFilter,
      limit: limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset: offset ? parseInt(offset as string, 10) || 0 : 0,
    };

    const gamesList = await searchGames(filters);

    res.json({
      games: gamesList,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        count: gamesList.length,
      },
    });
  } catch (err: any) {
    logger.error(`List games failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/games/pull', async (req: Request, res: Response) => {
  try {
    const parse = PullGamesSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { source, filters } = parse.data;
    let result;

    if (source === 'freetogame') {
      result = await pullFreeToGame(filters);
    } else if (source === 'gamerpower') {
      result = await pullGamerPower(filters);
    } else {
      return res.status(400).json({ error: 'Invalid source' });
    }

    logger.info(`Pulled games from ${source}`, { fetched: result.fetched, upserted: result.upserted });
    res.json({
      source,
      fetched: result.fetched,
      upserted: result.upserted,
      errors: result.errors,
    });
  } catch (err: any) {
    logger.error(`Pull games failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/games/favorite', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = FavoriteGameSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, position } = parse.data;

    const favorite = await favoriteGame(wallet, gameId, position);

    if (!favorite) {
      return res.status(404).json({ error: 'Game not found or failed to add favorite' });
    }

    logger.info(`Game favorited: ${gameId}`, { wallet });
    res.status(201).json({ favorite });
  } catch (err: any) {
    logger.error(`Favorite game failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 2 - Anchoring Routes
// ============================================================

router.post('/anchor/direct', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = AnchorDirectSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { chain, gameId, eventId } = parse.data;

    const [event] = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.gameId !== gameId) {
      return res.status(400).json({ error: 'Event does not belong to specified game' });
    }

    const result = await anchorEventDirect(eventId, chain);

    logger.info(`Direct anchor created: ${result.anchorRecord.id}`, { wallet, eventId, chain });
    res.status(201).json({
      anchorId: result.anchorRecord.id,
      txHash: result.anchorRecord.txHash,
      feeWei: FEE_WEI,
    });
  } catch (err: any) {
    logger.error(`Direct anchor failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/anchor/batch', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = AnchorBatchSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { chain, gameId, eventIds } = parse.data;

    for (const eventId of eventIds) {
      const [event] = await db
        .select()
        .from(gameEvents)
        .where(eq(gameEvents.id, eventId))
        .limit(1);

      if (!event) {
        return res.status(404).json({ error: `Event not found: ${eventId}` });
      }

      if (event.gameId !== gameId) {
        return res.status(400).json({ error: `Event ${eventId} does not belong to specified game` });
      }
    }

    const result = await anchorEventsBatch(eventIds, chain);

    logger.info(`Batch anchor created: ${result.anchorRecord.id}`, { wallet, eventCount: eventIds.length, chain });
    res.status(201).json({
      anchorId: result.anchorRecord.id,
      txHash: result.anchorRecord.txHash,
      rootHash: result.anchorRecord.rootHash,
      perEventFeeWei: FEE_WEI,
      totalFeeWei: result.anchorRecord.totalFeeWei,
    });
  } catch (err: any) {
    logger.error(`Batch anchor failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/anchor/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const [event] = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const status = await getEventAnchorStatus(eventId);

    if (!status || !status.anchored) {
      return res.json({
        event,
        anchored: false,
        proof: null,
        anchorRecord: null,
      });
    }

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet: event.wallet,
      actor: 'system',
      action: 'anchor.query',
      metaJson: {
        eventId,
        anchorId: status.anchorRecord?.id,
        verified: status.verified,
      },
      requestId,
    });

    res.json({
      event,
      anchored: true,
      proof: status.proof ? {
        leafHash: status.proof.leafHash,
        merklePath: status.proof.merklePath,
        leafIndex: status.proof.leafIndex,
      } : null,
      anchorRecord: status.anchorRecord ? {
        id: status.anchorRecord.id,
        chain: status.anchorRecord.chain,
        mode: status.anchorRecord.mode,
        txHash: status.anchorRecord.txHash,
        rootHash: status.anchorRecord.rootHash,
        status: status.anchorRecord.status,
      } : null,
      verified: status.verified,
    });
  } catch (err: any) {
    logger.error(`Get anchor proof failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/fees', async (_req: Request, res: Response) => {
  try {
    res.json({
      perEventFeeWei: FEE_WEI,
      note: 'Immutable per-event fee',
    });
  } catch (err: any) {
    logger.error(`Get fees failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ledger/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    const entries = await db
      .select()
      .from(anchorLedger)
      .where(eq(anchorLedger.wallet, wallet));

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'system',
      action: 'ledger.query',
      metaJson: {
        queriedWallet: wallet,
        entryCount: entries.length,
      },
      requestId,
    });

    res.json({
      wallet,
      entries,
      count: entries.length,
    });
  } catch (err: any) {
    logger.error(`Get ledger failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 3 - NFT Routes
// ============================================================

router.post('/nfts/inject', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = NftInjectSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { chain, contract, tokenId, metadata } = parse.data;
    const nftId = `${chain}:${contract}:${tokenId}`;

    const [existingNft] = await db
      .select()
      .from(gameNfts)
      .where(eq(gameNfts.id, nftId))
      .limit(1);

    let nft;
    if (existingNft) {
      [nft] = await db
        .update(gameNfts)
        .set({
          name: metadata?.name || existingNft.name,
          description: metadata?.description || existingNft.description,
          image: metadata?.image || existingNft.image,
          attributes: metadata?.attributes || existingNft.attributes,
          metadata: metadata || existingNft.metadata,
          updatedAt: new Date(),
        })
        .where(eq(gameNfts.id, nftId))
        .returning();
    } else {
      [nft] = await db
        .insert(gameNfts)
        .values({
          id: nftId,
          wallet,
          chain,
          contract,
          tokenId,
          name: metadata?.name || null,
          description: metadata?.description || null,
          image: metadata?.image || null,
          attributes: metadata?.attributes || null,
          metadata: metadata || null,
        })
        .returning();
    }

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: existingNft ? 'nft.update' : 'nft.inject',
      metaJson: {
        nftId,
        chain,
        contract,
        tokenId,
        name: metadata?.name,
      },
      requestId,
    });

    logger.info(`NFT ${existingNft ? 'updated' : 'injected'}: ${nftId}`, { wallet });
    res.status(existingNft ? 200 : 201).json({ nft });
  } catch (err: any) {
    logger.error(`NFT inject failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/nfts', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const nfts = await db
      .select()
      .from(gameNfts)
      .where(eq(gameNfts.wallet, wallet));

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: 'nfts.query',
      metaJson: {
        nftCount: nfts.length,
      },
      requestId,
    });

    res.json({
      wallet,
      nfts,
      count: nfts.length,
    });
  } catch (err: any) {
    logger.error(`Get NFTs failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/nfts/by-wallet/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet: targetWallet } = req.params;
    const callerWallet = getWallet(req);

    const nfts = await db
      .select()
      .from(gameNfts)
      .where(eq(gameNfts.wallet, targetWallet));

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet: callerWallet || 'anonymous',
      actor: 'developer',
      action: 'nfts.query.by-wallet',
      metaJson: {
        queriedWallet: targetWallet,
        nftCount: nfts.length,
      },
      requestId,
    });

    res.json({
      wallet: targetWallet,
      nfts,
      count: nfts.length,
    });
  } catch (err: any) {
    logger.error(`Get NFTs by wallet failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 4 - Leaderboard and Tournament Routes
// ============================================================

interface LeaderboardEntry {
  wallet: string;
  score: number;
  eventId: string;
  anchorId: string | null;
  submittedAt: string;
}

router.post('/leaderboard/submit', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = LeaderboardSubmitSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, score, eventId, key } = parse.data;

    const [event] = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.gameId !== gameId) {
      return res.status(400).json({ error: 'Event does not belong to specified game' });
    }

    const leaderboardId = `${gameId}:${key}`;

    let [leaderboard] = await db
      .select()
      .from(leaderboards)
      .where(eq(leaderboards.id, leaderboardId))
      .limit(1);

    const newEntry: LeaderboardEntry = {
      wallet,
      score,
      eventId,
      anchorId: null,
      submittedAt: new Date().toISOString(),
    };

    if (!leaderboard) {
      [leaderboard] = await db
        .insert(leaderboards)
        .values({
          id: leaderboardId,
          gameId,
          leaderboardType: 'highscore',
          key,
          entries: [newEntry],
          maxEntries: 1000,
        })
        .returning();
    } else {
      const entries = (leaderboard.entries as LeaderboardEntry[]) || [];
      
      const existingIndex = entries.findIndex((e) => e.wallet === wallet);
      if (existingIndex >= 0) {
        if (entries[existingIndex].score < score) {
          entries[existingIndex] = newEntry;
        }
      } else {
        entries.push(newEntry);
      }

      entries.sort((a, b) => b.score - a.score);

      const cappedEntries = entries.slice(0, leaderboard.maxEntries);

      [leaderboard] = await db
        .update(leaderboards)
        .set({
          entries: cappedEntries,
          updatedAt: new Date(),
        })
        .where(eq(leaderboards.id, leaderboardId))
        .returning();
    }

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: 'leaderboard.submit',
      metaJson: {
        leaderboardId,
        gameId,
        key,
        score,
        eventId,
      },
      requestId,
    });

    const rank = ((leaderboard.entries as LeaderboardEntry[]) || []).findIndex((e) => e.wallet === wallet) + 1;

    logger.info(`Leaderboard score submitted: ${leaderboardId}`, { wallet, score, rank });
    res.status(201).json({
      leaderboardId,
      score,
      rank,
      totalEntries: ((leaderboard.entries as LeaderboardEntry[]) || []).length,
    });
  } catch (err: any) {
    logger.error(`Leaderboard submit failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard/:gameId/:key', async (req: Request, res: Response) => {
  try {
    const { gameId, key } = req.params;
    const { limit, offset } = req.query;

    const leaderboardId = `${gameId}:${key}`;

    const [leaderboard] = await db
      .select()
      .from(leaderboards)
      .where(eq(leaderboards.id, leaderboardId))
      .limit(1);

    if (!leaderboard) {
      return res.json({
        leaderboardId,
        gameId,
        key,
        entries: [],
        totalEntries: 0,
      });
    }

    const allEntries = (leaderboard.entries as LeaderboardEntry[]) || [];
    const limitNum = limit ? Math.min(parseInt(limit as string, 10) || 100, 1000) : 100;
    const offsetNum = offset ? parseInt(offset as string, 10) || 0 : 0;

    const paginatedEntries = allEntries.slice(offsetNum, offsetNum + limitNum).map((entry, index) => ({
      rank: offsetNum + index + 1,
      wallet: entry.wallet,
      score: entry.score,
      eventId: entry.eventId,
      anchorId: entry.anchorId,
    }));

    res.json({
      leaderboardId,
      gameId,
      key,
      entries: paginatedEntries,
      totalEntries: allEntries.length,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (err: any) {
    logger.error(`Get leaderboard failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tournament', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = TournamentCreateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, name, startsAt, endsAt, rulesJson, prizePool, maxParticipants } = parse.data;

    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const [tournament] = await db
      .insert(tournaments)
      .values({
        gameId,
        name,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        rulesJson: rulesJson || null,
        prizePool: prizePool || null,
        maxParticipants: maxParticipants || null,
        anchored: false,
      })
      .returning();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'tournament.create',
      metaJson: {
        tournamentId: tournament.id,
        gameId,
        name,
        startsAt,
        endsAt,
      },
      requestId,
    });

    logger.info(`Tournament created: ${tournament.id}`, { wallet, gameId, name });
    res.status(201).json({ tournament });
  } catch (err: any) {
    logger.error(`Tournament create failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/tournaments/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { limit, offset, includeEnded } = req.query;

    const limitNum = limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50;
    const offsetNum = offset ? parseInt(offset as string, 10) || 0 : 0;

    let tournamentsList = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.gameId, gameId))
      .orderBy(desc(tournaments.startsAt));

    if (includeEnded !== 'true') {
      const now = new Date();
      tournamentsList = tournamentsList.filter((t) => t.endsAt >= now);
    }

    const paginatedTournaments = tournamentsList.slice(offsetNum, offsetNum + limitNum);

    res.json({
      gameId,
      tournaments: paginatedTournaments,
      totalCount: tournamentsList.length,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (err: any) {
    logger.error(`List tournaments failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tournament/:id/anchor', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const parse = TournamentAnchorSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { chain } = parse.data;

    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .limit(1);

    if (!tournament) {
      return res.status(404).json({ error: 'Tournament not found' });
    }

    if (tournament.anchored) {
      return res.status(400).json({ error: 'Tournament already anchored' });
    }

    const tournamentEvents = await db
      .select()
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.gameId, tournament.gameId),
          eq(gameEvents.eventType, 'tournament.entry')
        )
      );

    if (tournamentEvents.length === 0) {
      return res.status(400).json({ error: 'No tournament events to anchor' });
    }

    const eventIds = tournamentEvents.map((e) => e.id);

    const result = await anchorEventsBatch(eventIds, chain);

    await db
      .update(tournaments)
      .set({
        anchored: true,
        anchorId: result.anchorRecord.id,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, id));

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'tournament.anchor',
      metaJson: {
        tournamentId: id,
        gameId: tournament.gameId,
        anchorId: result.anchorRecord.id,
        txHash: result.anchorRecord.txHash,
        eventCount: eventIds.length,
        chain,
      },
      requestId,
    });

    logger.info(`Tournament anchored: ${id}`, { wallet, anchorId: result.anchorRecord.id, eventCount: eventIds.length });
    res.status(201).json({
      tournamentId: id,
      anchorId: result.anchorRecord.id,
      txHash: result.anchorRecord.txHash,
      rootHash: result.anchorRecord.rootHash,
      eventCount: eventIds.length,
      totalFeeWei: result.anchorRecord.totalFeeWei,
    });
  } catch (err: any) {
    logger.error(`Tournament anchor failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 5 - Mods Routes
// ============================================================

router.get('/mods/enabled', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { gameId } = req.query;

    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ error: 'gameId query parameter required' });
    }

    const enabledMods = await getEnabledMods(wallet, gameId);

    res.json({
      mods: enabledMods,
      count: enabledMods.length,
    });
  } catch (err: any) {
    logger.error(`Get enabled mods failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/mods/:gameId', async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { source, enabled, search, limit, offset } = req.query;

    const validSources = ['curseforge', 'modrinth', 'developer'] as const;
    const sourceFilter = source && validSources.includes(source as any)
      ? (source as 'curseforge' | 'modrinth')
      : undefined;

    const filters = {
      title: search as string | undefined,
      source: sourceFilter,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      limit: limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset: offset ? parseInt(offset as string, 10) || 0 : 0,
    };

    const modsList = await searchMods(gameId, filters);

    res.json({
      mods: modsList,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        count: modsList.length,
      },
    });
  } catch (err: any) {
    logger.error(`List mods failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/mods/pull', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = ModsPullSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, source, curseforgeGameId, filters } = parse.data;
    let result;

    if (source === 'curseforge') {
      if (!curseforgeGameId) {
        return res.status(400).json({ error: 'curseforgeGameId required for CurseForge source' });
      }
      result = await pullCurseForge(gameId, curseforgeGameId, wallet, {
        searchFilter: filters?.searchFilter,
        categoryId: filters?.categoryId,
        gameVersion: filters?.gameVersion,
      });
    } else if (source === 'modrinth') {
      result = await pullModrinth(gameId, wallet, {
        query: filters?.query,
      });
    } else {
      return res.status(400).json({ error: 'Invalid source' });
    }

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'system',
      action: 'mods.pull',
      metaJson: {
        gameId,
        source,
        fetched: result.fetched,
        upserted: result.upserted,
      },
      requestId,
    });

    logger.info(`Pulled mods from ${source}`, { gameId, fetched: result.fetched, upserted: result.upserted });
    res.json({
      source,
      gameId,
      fetched: result.fetched,
      upserted: result.upserted,
      errors: result.errors,
    });
  } catch (err: any) {
    logger.error(`Pull mods failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/mods/enable/:modId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { modId } = req.params;

    const mod = await enableMod(wallet, modId);

    if (!mod) {
      return res.status(404).json({ error: 'Mod not found or failed to enable' });
    }

    logger.info(`Mod enabled: ${modId}`, { wallet });
    res.json({ mod });
  } catch (err: any) {
    logger.error(`Enable mod failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/mods/disable/:modId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { modId } = req.params;

    const mod = await disableMod(wallet, modId);

    if (!mod) {
      return res.status(404).json({ error: 'Mod not found or failed to disable' });
    }

    logger.info(`Mod disabled: ${modId}`, { wallet });
    res.json({ mod });
  } catch (err: any) {
    logger.error(`Disable mod failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/mods/submit', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = ModSubmitSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, title, description, version, url } = parse.data;

    const slug = generateSlug(title);
    const modId = `dev:${wallet}:${slug}`;

    const [existingMod] = await db
      .select()
      .from(mods)
      .where(eq(mods.sourceId, modId))
      .limit(1);

    let mod;
    if (existingMod) {
      [mod] = await db
        .update(mods)
        .set({
          title,
          description: description || null,
          version: version || null,
          url: url || null,
          updatedAt: new Date(),
        })
        .where(eq(mods.sourceId, modId))
        .returning();
    } else {
      [mod] = await db
        .insert(mods)
        .values({
          gameId,
          wallet,
          title,
          description: description || null,
          version: version || null,
          source: 'developer',
          sourceId: modId,
          url: url || null,
          enabled: false,
        })
        .returning();
    }

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: existingMod ? 'mod.update' : 'mod.submit',
      metaJson: {
        modId: mod.id,
        sourceId: modId,
        gameId,
        title,
      },
      requestId,
    });

    logger.info(`Mod ${existingMod ? 'updated' : 'submitted'}: ${modId}`, { wallet, gameId });
    res.status(existingMod ? 200 : 201).json({ mod });
  } catch (err: any) {
    logger.error(`Submit mod failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 6 - Social Routes
// ============================================================

router.post('/invite', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = InviteSendSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { toWallet, gameId, sessionId } = parse.data;

    const result = await sendInvite(wallet, toWallet, gameId, sessionId);

    logger.info(`Invite sent: ${result.invite.id}`, { fromWallet: wallet, toWallet, gameId });
    res.status(201).json({
      invite: result.invite,
      receipt: result.receipt,
    });
  } catch (err: any) {
    logger.error(`Send invite failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/invites', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { type } = req.query;
    const filterType = type as 'sent' | 'received' | 'all' | undefined;

    const { sent, received } = await getInvites(wallet);

    let result;
    if (filterType === 'sent') {
      result = { sent, received: [] };
    } else if (filterType === 'received') {
      result = { sent: [], received };
    } else {
      result = { sent, received };
    }

    res.json({
      wallet,
      ...result,
      counts: {
        sent: result.sent.length,
        received: result.received.length,
        total: result.sent.length + result.received.length,
      },
    });
  } catch (err: any) {
    logger.error(`Get invites failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/invite/:id/respond', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const parse = InviteRespondSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { response } = parse.data;

    const result = await respondInvite(id, wallet, response);

    logger.info(`Invite ${response}ed: ${id}`, { wallet });
    res.json({
      invite: result.invite,
      receipt: result.receipt,
    });
  } catch (err: any) {
    logger.error(`Respond to invite failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Only the recipient') || err.message.includes('already') || err.message.includes('expired')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 7 - Discovery Routes
// ============================================================

router.get('/discovery/trending', async (req: Request, res: Response) => {
  try {
    const parse = TrendingQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { period, limit } = parse.data;

    const trendingGames = await getTrending(period, limit);

    res.json({
      period,
      games: trendingGames,
      count: trendingGames.length,
    });
  } catch (err: any) {
    logger.error(`Get trending games failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/discovery/featured', async (req: Request, res: Response) => {
  try {
    const parse = FeaturedQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { limit } = parse.data;

    const featuredGames = await getFeatured(limit);

    res.json({
      games: featuredGames,
      count: featuredGames.length,
    });
  } catch (err: any) {
    logger.error(`Get featured games failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 8 - Governance Routes
// ============================================================

router.get('/governance/summary', async (req: Request, res: Response) => {
  try {
    const allAccounts = await db
      .select()
      .from(governanceAccounts);

    const totalWallets = allAccounts.length;
    const activeUsers = allAccounts.filter(a => a.status === 'active').length;
    const totalFees = allAccounts.reduce((sum, a) => {
      const feeNum = parseFloat(a.totalFeesPaid || '0');
      return sum + (isNaN(feeNum) ? 0 : feeNum);
    }, 0);

    res.json({
      totalWallets,
      totalFees: totalFees.toString(),
      activeUsers,
      suspendedUsers: totalWallets - activeUsers,
    });
  } catch (err: any) {
    logger.error(`Get governance summary failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/governance/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const account = await computeGovernance(wallet);

    res.json({
      wallet: account.wallet,
      rateLimit: account.rateLimit,
      totalFeesPaid: account.totalFeesPaid,
      violations: account.violations,
      status: account.status,
    });
  } catch (err: any) {
    logger.error(`Get governance status failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 9 - Purchase Routes
// ============================================================

router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = InitiatePurchaseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, modId, priceWei, currency, itemType, metadata } = parse.data;

    const result = await initiatePurchase(
      wallet,
      priceWei,
      itemType,
      gameId,
      modId,
      metadata
    );

    logger.info(`Purchase initiated: ${result.purchase.id}`, { wallet, gameId, modId, itemType });
    res.status(201).json({
      purchaseId: result.purchase.id,
      status: result.purchase.status,
      priceWei: result.purchase.priceWei,
      currency: result.purchase.currency,
      gameId: result.purchase.gameId,
      modId: result.purchase.modId,
      itemType: result.purchase.itemType,
    });
  } catch (err: any) {
    logger.error(`Initiate purchase failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchase/:id/complete', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const parse = CompletePurchaseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { txHash } = parse.data;

    const result = await completePurchase(id, txHash);

    logger.info(`Purchase completed: ${id}`, { wallet, txHash });
    res.json({
      purchaseId: result.purchase.id,
      status: result.purchase.status,
      txHash: result.purchase.txHash,
      completedAt: result.purchase.completedAt,
      receipt: {
        id: result.receipt.id,
        action: result.receipt.action,
        requestId: result.receipt.requestId,
      },
    });
  } catch (err: any) {
    logger.error(`Complete purchase failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('not pending')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchase/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await verifyPurchase(id);

    logger.info(`Purchase verified: ${id}`, { anchored: result.anchored, verified: result.verified });
    res.json({
      purchaseId: result.purchase.id,
      status: result.purchase.status,
      txHash: result.purchase.txHash,
      anchored: result.anchored,
      verified: result.verified,
      anchorId: result.anchorDetails?.anchorId || null,
      anchorStatus: result.anchorDetails?.status || null,
      rootHash: result.anchorDetails?.rootHash || null,
    });
  } catch (err: any) {
    logger.error(`Verify purchase failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/purchases', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = PurchasesQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { status, itemType, limit, offset } = parse.data;

    let purchasesList = await getPurchases(wallet, status);

    if (itemType) {
      purchasesList = purchasesList.filter((p) => p.itemType === itemType);
    }

    const total = purchasesList.length;
    const paginatedPurchases = purchasesList.slice(offset, offset + limit);

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: 'purchases.query',
      metaJson: {
        status,
        itemType,
        total,
        returned: paginatedPurchases.length,
      },
      requestId,
    });

    res.json({
      purchases: paginatedPurchases,
      count: paginatedPurchases.length,
      pagination: {
        limit,
        offset,
        total,
      },
    });
  } catch (err: any) {
    logger.error(`Get purchases failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ownership', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = OwnershipQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, modId } = parse.data;

    const result = await checkOwnership(wallet, gameId, modId);

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: 'ownership.check',
      metaJson: {
        gameId,
        modId,
        owned: result.owned,
        purchaseId: result.purchase?.id || null,
      },
      requestId,
    });

    res.json({
      owned: result.owned,
      gameId: gameId || null,
      modId: modId || null,
      purchase: result.purchase ? {
        id: result.purchase.id,
        status: result.purchase.status,
        txHash: result.purchase.txHash,
        completedAt: result.purchase.completedAt,
        anchorId: result.purchase.anchorId,
      } : null,
    });
  } catch (err: any) {
    logger.error(`Check ownership failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/purchase/:id/anchor', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const parse = AnchorPurchaseSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { chain } = parse.data;

    const result = await anchorPurchase(id, chain);

    logger.info(`Purchase anchored: ${id}`, { wallet, anchorId: result.anchorId, chain });
    res.status(201).json({
      purchaseId: result.purchase.id,
      anchorId: result.anchorId,
      status: result.purchase.status,
      receipt: {
        id: result.receipt.id,
        action: result.receipt.action,
        requestId: result.receipt.requestId,
      },
    });
  } catch (err: any) {
    logger.error(`Anchor purchase failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('must be complete') || err.message.includes('already anchored')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 10 - Sandbox Routes
// ============================================================

router.post('/sandbox/session', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const session = await createSession(wallet);

    logger.info(`Sandbox session created: ${session.sessionId}`, { wallet });
    res.status(201).json({
      sessionId: session.sessionId,
    });
  } catch (err: any) {
    logger.error(`Create sandbox session failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sandbox/create', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = SandboxCreateGameSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { title, slug, description } = parse.data;

    const result = await createGame(wallet, title, slug, description || '');

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sandbox.create',
      metaJson: {
        gameId: result.gameId,
        title,
        slug,
      },
      requestId,
    });

    logger.info(`Sandbox game created: ${result.gameId}`, { wallet, slug });
    res.status(201).json({
      gameId: result.gameId,
      slug: result.slug,
      receiptId: requestId,
    });
  } catch (err: any) {
    logger.error(`Create sandbox game failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sandbox/build/upload', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = SandboxBuildUploadSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, version, artifactUrl, changelog } = parse.data;

    const result = await uploadBuild(wallet, gameId, version, artifactUrl, changelog);

    logger.info(`Build uploaded: ${result.buildId}`, { wallet, gameId, version });
    res.status(201).json({
      buildId: result.buildId,
      version: result.version,
    });
  } catch (err: any) {
    logger.error(`Upload build failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/sandbox/build/publish', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = SandboxBuildPublishSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { buildId, priceWei } = parse.data;

    await publishBuild(wallet, buildId, priceWei);

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sandbox.publish',
      metaJson: {
        buildId,
        priceWei,
      },
      requestId,
    });

    logger.info(`Build published: ${buildId}`, { wallet, priceWei });
    res.status(200).json({
      success: true,
      receiptId: requestId,
    });
  } catch (err: any) {
    logger.error(`Publish build failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/sandbox/game/update', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = SandboxGameUpdateSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, title, description, priceWei } = parse.data;

    await updateGame(wallet, gameId, { title, description, priceWei });

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sandbox.game.update',
      metaJson: {
        gameId,
        updatedFields: { title, description, priceWei },
      },
      requestId,
    });

    logger.info(`Game updated: ${gameId}`, { wallet });
    res.status(200).json({
      success: true,
      receiptId: requestId,
    });
  } catch (err: any) {
    logger.error(`Update game failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/sandbox/endpoint/register', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = SandboxEndpointRegisterSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { gameId, label, url, authKind } = parse.data;

    const endpoint = await registerEndpoint(wallet, gameId, label, url, authKind);

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sandbox.endpoint.register',
      metaJson: {
        endpointId: endpoint.id,
        gameId,
        label,
        url,
        authKind,
      },
      requestId,
    });

    logger.info(`Endpoint registered: ${endpoint.id}`, { wallet, gameId, label });
    res.status(201).json({
      endpointId: endpoint.id,
      receiptId: requestId,
    });
  } catch (err: any) {
    logger.error(`Register endpoint failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Unauthorized')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/sandbox/games', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const gamesList = await getWalletGames(wallet);

    logger.info(`Sandbox games retrieved`, { wallet, count: gamesList.length });
    res.json({
      games: gamesList,
      count: gamesList.length,
    });
  } catch (err: any) {
    logger.error(`Get sandbox games failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/sandbox/builds/:gameId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { gameId } = req.params;

    const buildsList = await getBuilds(gameId);

    logger.info(`Builds retrieved for game: ${gameId}`, { wallet, count: buildsList.length });
    res.json({
      builds: buildsList,
    });
  } catch (err: any) {
    logger.error(`Get builds failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/sandbox/endpoints/:gameId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { gameId } = req.params;

    const endpointsList = await getEndpoints(wallet, gameId);

    logger.info(`Endpoints retrieved for game: ${gameId}`, { wallet, count: endpointsList.length });
    res.json({
      endpoints: endpointsList,
    });
  } catch (err: any) {
    logger.error(`Get endpoints failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 10 - Favorites Routes
// ============================================================

router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const favorites = await db
      .select({
        id: gameFavorites.id,
        wallet: gameFavorites.wallet,
        gameId: gameFavorites.gameId,
        position: gameFavorites.position,
        createdAt: gameFavorites.createdAt,
        game: {
          id: games.id,
          title: games.title,
          genre: games.genre,
          platform: games.platform,
          thumbnail: games.thumbnail,
          developer: games.developer,
          source: games.source,
        },
      })
      .from(gameFavorites)
      .leftJoin(games, eq(gameFavorites.gameId, games.id))
      .where(eq(gameFavorites.wallet, wallet))
      .orderBy(gameFavorites.position);

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: 'favorites.list',
      metaJson: {
        count: favorites.length,
      },
      requestId,
    });

    logger.info(`Favorites retrieved`, { wallet, count: favorites.length });
    res.json({
      favorites,
      count: favorites.length,
    });
  } catch (err: any) {
    logger.error(`Get favorites failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/games/favorite/:gameId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { gameId } = req.params;

    const [existingFavorite] = await db
      .select()
      .from(gameFavorites)
      .where(
        and(
          eq(gameFavorites.wallet, wallet),
          eq(gameFavorites.gameId, gameId)
        )
      )
      .limit(1);

    if (!existingFavorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    await db
      .delete(gameFavorites)
      .where(
        and(
          eq(gameFavorites.wallet, wallet),
          eq(gameFavorites.gameId, gameId)
        )
      );

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'player',
      action: 'favorite.remove',
      metaJson: {
        gameId,
        favoriteId: existingFavorite.id,
      },
      requestId,
    });

    logger.info(`Favorite removed: ${gameId}`, { wallet });
    res.json({
      success: true,
      message: 'Favorite removed successfully',
      gameId,
    });
  } catch (err: any) {
    logger.error(`Remove favorite failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PART 11 - Auto-Sync Routes
// ============================================================

router.get('/sync/status', async (_req: Request, res: Response) => {
  try {
    const status = getAutoSyncStatus();
    res.json(status);
  } catch (err: any) {
    logger.error(`Get sync status failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/trigger', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const results = await triggerSync();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sync.trigger',
      metaJson: {
        results,
      },
      requestId,
    });

    logger.info(`Manual sync triggered`, { wallet, results });
    res.json({
      success: true,
      results,
      receiptId: requestId,
    });
  } catch (err: any) {
    logger.error(`Trigger sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/start', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    startAutoSync();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sync.start',
      metaJson: {},
      requestId,
    });

    logger.info(`Auto-sync started`, { wallet });
    res.json({
      success: true,
      message: 'Auto-sync scheduler started',
      status: getAutoSyncStatus(),
    });
  } catch (err: any) {
    logger.error(`Start sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync/stop', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    stopAutoSync();

    const requestId = generateRequestId();
    await db.insert(gameDeckReceipts).values({
      wallet,
      actor: 'developer',
      action: 'sync.stop',
      metaJson: {},
      requestId,
    });

    logger.info(`Auto-sync stopped`, { wallet });
    res.json({
      success: true,
      message: 'Auto-sync scheduler stopped',
      status: getAutoSyncStatus(),
    });
  } catch (err: any) {
    logger.error(`Stop sync failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Auto-sync is now started lazily after server is fully initialized
// Do not call startAutoSync() at module load time - it blocks the event loop

// ============================================================
// PART 12 - Marketplace Routes
// ============================================================

const MarketplaceItemsQuerySchema = z.object({
  type: z.enum(['game', 'app', 'ebook', 'video', 'audio', 'product']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const MarketplaceCreateItemSchema = z.object({
  itemType: z.enum(['game', 'app', 'ebook', 'video', 'audio', 'product']),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().url().optional(),
  coverImage: z.string().url().optional(),
  priceWei: z.string().optional(),
  currency: z.string().default('ETH'),
  manifest: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
});

const MarketplaceUpdateItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(100).optional(),
  subcategory: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().url().optional(),
  coverImage: z.string().url().optional(),
  priceWei: z.string().optional(),
  currency: z.string().optional(),
  manifest: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const MarketplaceMediaAssetSchema = z.object({
  assetType: z.string().min(1).max(50),
  url: z.string().url(),
  mimeType: z.string().max(100).optional(),
  duration: z.number().int().positive().optional(),
  pageCount: z.number().int().positive().optional(),
  fileSize: z.number().int().positive().optional(),
  resolution: z.string().max(50).optional(),
  bitrate: z.number().int().positive().optional(),
  language: z.string().max(10).optional(),
  subtitles: z.array(z.string()).optional(),
  chapters: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

const MarketplaceBuildSchema = z.object({
  version: z.string().min(1).max(50),
  artifactUrl: z.string().url(),
  artifactHash: z.string().optional(),
  changelog: z.string().max(5000).optional(),
  fileSize: z.number().int().positive().optional(),
  format: z.string().max(50).optional(),
});

router.get('/marketplace/items', async (req: Request, res: Response) => {
  try {
    const parse = MarketplaceItemsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { type, category, search, limit, offset } = parse.data;

    const filters: SearchFilters = {
      type: type as ItemType | undefined,
      category,
      search,
      limit,
      offset,
      status: 'published',
    };

    const result = await searchItems(filters);

    res.json({
      items: result.items,
      count: result.count,
      pagination: { limit, offset },
    });
  } catch (err: any) {
    logger.error(`List marketplace items failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/marketplace/items', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const parse = MarketplaceCreateItemSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { itemType, ...data } = parse.data;

    const item = await createItem(wallet, itemType as ItemType, data as CreateItemData);

    if (!item) {
      return res.status(500).json({ error: 'Failed to create item' });
    }

    logger.info(`Marketplace item created: ${item.id}`, { wallet, itemType, title: data.title });
    res.status(201).json({ item });
  } catch (err: any) {
    logger.error(`Create marketplace item failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await getItem(id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item });
  } catch (err: any) {
    logger.error(`Get marketplace item failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/marketplace/items/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const parse = MarketplaceUpdateItemSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const item = await updateItem(id, wallet, parse.data as Partial<CreateItemData>);

    if (!item) {
      return res.status(404).json({ error: 'Item not found or not authorized' });
    }

    logger.info(`Marketplace item updated: ${id}`, { wallet });
    res.json({ item });
  } catch (err: any) {
    logger.error(`Update marketplace item failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/categories', async (_req: Request, res: Response) => {
  try {
    const result = await getCategories(true);

    res.json({
      categories: result.categories,
      count: result.count,
    });
  } catch (err: any) {
    logger.error(`List marketplace categories failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/categories/:slug/items', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { type, limit, offset } = req.query;

    const category = await getCategory(slug);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const result = await getCategoryItems(
      slug,
      type as ItemType | undefined,
      limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset ? parseInt(offset as string, 10) || 0 : 0
    );

    res.json({
      category,
      items: result.items,
      count: result.count,
    });
  } catch (err: any) {
    logger.error(`Get category items failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/stores/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;

    const store = await getStore(wallet);

    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({ store });
  } catch (err: any) {
    logger.error(`Get merchant store failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/stores/:wallet/items', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const { status, limit, offset } = req.query;

    const result = await getStoreItems(
      wallet,
      status as 'draft' | 'published' | 'archived' | 'suspended' | undefined,
      limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset ? parseInt(offset as string, 10) || 0 : 0
    );

    res.json({
      store: result.store,
      items: result.items,
      count: result.count,
    });
  } catch (err: any) {
    logger.error(`Get store items failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/marketplace/items/:id/media', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const item = await getItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.creatorWallet !== wallet) {
      return res.status(403).json({ error: 'Not authorized to add media to this item' });
    }

    const parse = MarketplaceMediaAssetSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const asset = await addMediaAsset(id, parse.data as MediaAssetData);

    if (!asset) {
      return res.status(500).json({ error: 'Failed to add media asset' });
    }

    logger.info(`Media asset added: ${asset.id}`, { wallet, itemId: id, assetType: parse.data.assetType });
    res.status(201).json({ asset });
  } catch (err: any) {
    logger.error(`Add media asset failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/items/:id/media', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await getItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const assets = await getMediaAssets(id);

    res.json({
      assets,
      count: assets.length,
    });
  } catch (err: any) {
    logger.error(`Get media assets failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/items/:id/stream/:assetId', async (req: Request, res: Response) => {
  try {
    const { id, assetId } = req.params;

    const item = await getItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const asset = await getMediaAsset(assetId);

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.itemId !== id) {
      return res.status(400).json({ error: 'Asset does not belong to this item' });
    }

    const requestId = generateRequestId();
    await db.insert(marketplaceReceiptsTable).values({
      wallet: 'anonymous',
      kind: 'media.stream',
      refId: assetId,
      refType: 'media_asset',
      metaJson: { itemId: id, assetType: asset.assetType },
      requestId,
    });

    res.redirect(302, asset.url);
  } catch (err: any) {
    logger.error(`Stream redirect failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/marketplace/items/:id/builds', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const item = await getItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.creatorWallet !== wallet) {
      return res.status(403).json({ error: 'Not authorized to add builds to this item' });
    }

    const parse = MarketplaceBuildSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: parse.error.flatten() });
    }

    const { version, artifactUrl, artifactHash, changelog, fileSize, format } = parse.data;

    const [build] = await db
      .insert(itemBuilds)
      .values({
        itemId: id,
        version,
        artifactUrl,
        artifactHash: artifactHash || null,
        changelog: changelog || null,
        fileSize: fileSize || null,
        format: format || null,
        createdByWallet: wallet,
        published: false,
      })
      .returning();

    const requestId = generateRequestId();
    await db.insert(marketplaceReceiptsTable).values({
      wallet,
      kind: 'build.upload',
      refId: build.id,
      refType: 'item_build',
      metaJson: { itemId: id, version },
      requestId,
    });

    logger.info(`Build added: ${build.id}`, { wallet, itemId: id, version });
    res.status(201).json({ build });
  } catch (err: any) {
    logger.error(`Add build failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/marketplace/items/:id/builds', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await getItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const builds = await db
      .select()
      .from(itemBuilds)
      .where(eq(itemBuilds.itemId, id))
      .orderBy(desc(itemBuilds.createdAt));

    res.json({
      builds,
      count: builds.length,
    });
  } catch (err: any) {
    logger.error(`List builds failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PART 13: ATLAS MEDIA ROUTES - Video/TV rental and purchase
// ============================================================================

router.get('/media/catalog', async (req: Request, res: Response) => {
  try {
    const { genre, limit, offset } = req.query;

    const filters = {
      genre: genre as string | undefined,
      limit: limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset: offset ? parseInt(offset as string, 10) || 0 : 0,
    };

    const result = await getVideoItems(filters);

    res.json({
      items: result.items,
      count: result.count,
    });
  } catch (err: any) {
    logger.error(`Get media catalog failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/featured', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? Math.min(parseInt(limit as string, 10) || 10, 50) : 10;

    const [featuredItems, trendingItems] = await Promise.all([
      getFeaturedMedia(limitNum).then(items => 
        items.length > 0 ? items : getRecentlyAdded(limitNum)
      ),
      getPopularMedia(limitNum),
    ]);

    res.json({
      featured: featuredItems,
      trending: trendingItems,
    });
  } catch (err: any) {
    logger.error(`Get featured media failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/rent/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const result = await rentMedia(wallet, id);

    logger.info(`Media rented: ${id}`, { wallet });
    res.status(201).json({
      access: result.access,
      receipt: result.receipt,
    });
  } catch (err: any) {
    logger.error(`Rent media failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/purchase/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const result = await purchaseMedia(wallet, id);

    logger.info(`Media purchased: ${id}`, { wallet });
    res.status(201).json({
      access: result.access,
      receipt: result.receipt,
    });
  } catch (err: any) {
    logger.error(`Purchase media failed: ${err.message}`);
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/access/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const result = await checkAccess(wallet, id);

    res.json(result);
  } catch (err: any) {
    logger.error(`Check media access failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/library', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const items = await getLibrary(wallet);

    res.json({
      items,
      count: items.length,
    });
  } catch (err: any) {
    logger.error(`Get media library failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/playback/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    const { position } = req.body;

    if (typeof position !== 'number' || position < 0) {
      return res.status(400).json({ error: 'Invalid position value' });
    }

    const result = await savePlaybackPosition(wallet, id, position);

    if (!result) {
      return res.status(404).json({ error: 'No access to this media' });
    }

    res.json({ success: true, access: result });
  } catch (err: any) {
    logger.error(`Save playback position failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/playback/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const position = await getPlaybackPosition(wallet, id);

    if (position === null) {
      return res.status(404).json({ error: 'No access to this media' });
    }

    res.json({ position });
  } catch (err: any) {
    logger.error(`Get playback position failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/continue', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { limit } = req.query;
    const limitNum = limit ? Math.min(parseInt(limit as string, 10) || 10, 50) : 10;

    const items = await getContinueWatching(wallet, limitNum);

    res.json({
      items,
      count: items.length,
    });
  } catch (err: any) {
    logger.error(`Get continue watching failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/media/ratings/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const ratings = await getRatings(id);

    res.json({
      items: ratings,
      count: ratings.length,
    });
  } catch (err: any) {
    logger.error(`Get ratings failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PART 14: EBOOK ROUTES - Marketplace + Reader
// ============================================================================

router.get('/ebooks/catalog', async (req: Request, res: Response) => {
  try {
    const { free, category, limit, offset, q } = req.query;

    const filters = {
      free: free === 'true',
      category: category as string | undefined,
      search: q as string | undefined,
      limit: limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset: offset ? parseInt(offset as string, 10) || 0 : 0,
    };

    const result = await getEbookCatalog(filters);

    res.json({
      items: result.items,
      count: result.count,
    });
  } catch (err: any) {
    logger.error(`Get ebook catalog failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/import/googlebooks', async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string required' });
    }

    const result = await importFromGoogleBooks(query, limit || 20);

    logger.info(`Imported from Google Books`, { query, count: result.count });
    res.json({
      items: result.items,
      count: result.count,
      jobId: result.jobId,
    });
  } catch (err: any) {
    logger.error(`Import from Google Books failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/import/openlibrary', async (req: Request, res: Response) => {
  try {
    const { workId, isbn, subject, limit } = req.body;

    if (!workId && !isbn && !subject) {
      return res.status(400).json({ error: 'At least one of workId, isbn, or subject required' });
    }

    const result = await importFromOpenLibrary({ workId, isbn, subject, limit });

    logger.info(`Imported from Open Library`, { workId, isbn, subject, count: result.count });
    res.json({
      items: result.items,
      count: result.count,
      jobId: result.jobId,
    });
  } catch (err: any) {
    logger.error(`Import from Open Library failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/import/gutendex', async (req: Request, res: Response) => {
  try {
    const { search, topic, language, limit } = req.body;

    const result = await importFromGutendex({ search, topic, language, limit });

    logger.info(`Imported from Gutendex`, { search, topic, language, count: result.count });
    res.json({
      items: result.items,
      count: result.count,
      jobId: result.jobId,
    });
  } catch (err: any) {
    logger.error(`Import from Gutendex failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/purchase/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    
    // Import directly to avoid any module resolution issues
    const { db } = await import('../db');
    const { marketplaceItems, mediaAccess, marketplaceReceiptsTable } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const { v4: uuidv4 } = await import('uuid');
    const crypto = await import('crypto');
    
    // Find the ebook
    const [item] = await db.select().from(marketplaceItems).where(and(eq(marketplaceItems.id, id), eq(marketplaceItems.itemType, 'ebook'))).limit(1);
    
    if (!item) {
      return res.status(404).json({ error: 'Ebook not found' });
    }
    
    // Check if already purchased
    const [existing] = await db.select().from(mediaAccess).where(and(
      eq(mediaAccess.wallet, wallet),
      eq(mediaAccess.itemId, id),
      eq(mediaAccess.accessType, 'purchase')
    )).limit(1);
    
    const generateToken = (w: string, iid: string) => {
      const payload = { wallet: w, itemId: iid, exp: Date.now() + 24 * 60 * 60 * 1000, nonce: uuidv4() };
      const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'atlas-ebook-gate')
        .update(token)
        .digest('base64url');
      return `${token}.${signature}`;
    };
    
    if (existing) {
      return res.status(201).json({
        accessId: existing.id,
        accessToken: generateToken(wallet, id),
        receiptId: existing.receiptId || '',
      });
    }
    
    const accessToken = generateToken(wallet, id);
    const requestId = `ebook:${Date.now()}:${uuidv4().slice(0, 8)}`;
    const feeWei = "150000000000000";
    
    // Create receipt
    const [receipt] = await db.insert(marketplaceReceiptsTable).values({
      wallet,
      kind: 'purchase.complete',
      refId: id,
      refType: 'ebook',
      anchorFeeWei: feeWei,
      metaJson: { title: item.title, priceWei: item.priceWei },
      requestId,
    }).returning();
    
    // Create access entry
    const [access] = await db.insert(mediaAccess).values({
      wallet,
      itemId: id,
      kind: 'ebook',
      accessType: 'purchase',
      priceWei: item.priceWei || '0',
      accessToken,
      receiptId: receipt.id,
    }).returning();
    
    // Download EPUB file in background for offline reading
    const metadata = item.metadata as Record<string, any> || {};
    const manifest = item.manifest as Record<string, any> || {};
    const epubUrl = metadata?.formats?.epub || 
      manifest?.assets?.find((a: any) => a.type === 'epub')?.url ||
      (metadata?.gutenberg_id ? `https://www.gutenberg.org/cache/epub/${metadata.gutenberg_id}/pg${metadata.gutenberg_id}-images.epub` : null);
    
    if (epubUrl) {
      downloadAndStoreEpub(id, epubUrl).then(result => {
        if (result.success) {
          logger.info(`EPUB downloaded for ${id}`);
        } else {
          logger.warn(`EPUB download failed for ${id}: ${result.error}`);
        }
      }).catch(err => {
        logger.warn(`EPUB download error for ${id}: ${err.message}`);
      });
    }
    
    logger.info(`Ebook purchased: ${id}`, { wallet });
    res.status(201).json({
      accessId: access.id,
      accessToken,
      receiptId: receipt.id,
      epubUrl: getEpubServeUrl(id),
    });
  } catch (err: any) {
    logger.error(`Purchase ebook failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ebooks/access/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const result = await checkEbookAccess(wallet, id);

    res.json(result);
  } catch (err: any) {
    logger.error(`Check ebook access failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ebooks/file/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    
    // Verify user has access to this book
    const { db } = await import('../db');
    const { mediaAccess } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const [access] = await db.select().from(mediaAccess).where(and(
      eq(mediaAccess.wallet, wallet),
      eq(mediaAccess.itemId, id)
    )).limit(1);
    
    if (!access) {
      return res.status(403).json({ error: 'Access denied. Add book to library first.' });
    }
    
    // Check if EPUB is downloaded
    const downloaded = await isEpubDownloaded(id);
    if (!downloaded) {
      // Try to download now
      const { marketplaceItems } = await import('@shared/schema');
      const [item] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id)).limit(1);
      
      if (item) {
        const metadata = item.metadata as Record<string, any> || {};
        const manifest = item.manifest as Record<string, any> || {};
        const epubUrl = metadata?.formats?.epub || 
          manifest?.assets?.find((a: any) => a.type === 'epub')?.url ||
          (metadata?.gutenberg_id ? `https://www.gutenberg.org/cache/epub/${metadata.gutenberg_id}/pg${metadata.gutenberg_id}-images.epub` : null);
        
        if (epubUrl) {
          const result = await downloadAndStoreEpub(id, epubUrl);
          if (!result.success) {
            return res.status(503).json({ error: 'EPUB download in progress. Please try again.' });
          }
        } else {
          return res.status(404).json({ error: 'No EPUB available for this book' });
        }
      } else {
        return res.status(404).json({ error: 'Book not found' });
      }
    }
    
    const epubBuffer = await getEpubBuffer(id);
    if (!epubBuffer) {
      return res.status(404).json({ error: 'EPUB file not found' });
    }
    
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `inline; filename="${id}.epub"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(epubBuffer);
  } catch (err: any) {
    logger.error(`Serve EPUB failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ebooks/library', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const result = await getEbookLibrary(wallet);

    res.json(result);
  } catch (err: any) {
    logger.error(`Get ebook library failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/ebooks/library/:bookId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { bookId } = req.params;

    const removed = await removeFromLibrary(wallet, bookId);

    if (!removed) {
      return res.status(404).json({ error: 'Book not found in library' });
    }

    logger.info(`Book removed from library: ${bookId}`, { wallet });
    res.json({ success: true, bookId });
  } catch (err: any) {
    logger.error(`Remove from library failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ebooks/continue', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { limit } = req.query;
    const limitNum = limit ? Math.min(parseInt(limit as string, 10) || 10, 50) : 10;

    const result = await getContinueReading(wallet, limitNum);

    res.json({
      items: result.items,
      count: result.count,
    });
  } catch (err: any) {
    logger.error(`Get continue reading failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/progress/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    const { page, totalPages } = req.body;

    if (typeof page !== 'number' || page < 0) {
      return res.status(400).json({ error: 'Invalid page value' });
    }

    const result = await saveProgress(wallet, id, { page, totalPages });

    if (!result) {
      return res.status(404).json({ error: 'Ebook not found or no access' });
    }

    res.json({ success: true, progress: result });
  } catch (err: any) {
    logger.error(`Save reading progress failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ebooks/progress/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;

    const result = await getProgress(wallet, id);

    if (!result) {
      return res.status(404).json({ error: 'No progress found' });
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`Get reading progress failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/highlight/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    const { page, text, color } = req.body;

    if (typeof page !== 'number' || !text) {
      return res.status(400).json({ error: 'Page number and text required' });
    }

    const result = await addHighlight(wallet, id, { page, text, color });

    if (!result) {
      return res.status(404).json({ error: 'Ebook not found or no access' });
    }

    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Add highlight failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/note/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    const { page, content } = req.body;

    if (typeof page !== 'number' || !content) {
      return res.status(400).json({ error: 'Page number and content required' });
    }

    const result = await addNote(wallet, id, { page, content });

    if (!result) {
      return res.status(404).json({ error: 'Ebook not found or no access' });
    }

    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Add note failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/ebooks/bookmark/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { id } = req.params;
    const { page, label } = req.body;

    if (typeof page !== 'number') {
      return res.status(400).json({ error: 'Page number required' });
    }

    const result = await addBookmark(wallet, id, { page, label });

    if (!result) {
      return res.status(404).json({ error: 'Ebook not found or no access' });
    }

    res.status(201).json(result);
  } catch (err: any) {
    logger.error(`Add bookmark failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ebooks/sync-jobs', async (req: Request, res: Response) => {
  try {
    const { source, limit } = req.query;

    const limitNum = limit ? Math.min(parseInt(limit as string, 10) || 20, 100) : 20;

    const jobs = await getRecentSyncJobs(source as string | undefined, limitNum);

    res.json({
      items: jobs,
      count: jobs.length,
    });
  } catch (err: any) {
    logger.error(`Get sync jobs failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PART 15: USER REVIEWS - Unified reviews for all content types
// ============================================================================

import {
  createReview,
  getReviewsForItem,
  getReviewsByWallet,
  markReviewHelpful,
  reportReview,
  deleteReview,
  getItemStats,
} from '../atlas/gamedeck/reviewService';

router.post('/reviews/:itemId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { itemId } = req.params;
    const { rating, title, content } = req.body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (!content || typeof content !== 'string' || content.length < 10) {
      return res.status(400).json({ error: 'Review content must be at least 10 characters' });
    }

    const review = await createReview(wallet, itemId, { rating, title, content });

    if (!review) {
      return res.status(404).json({ error: 'Item not found' });
    }

    logger.info(`Review created for item ${itemId}`, { wallet, rating });
    res.status(201).json(review);
  } catch (err: any) {
    logger.error(`Create review failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/reviews/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { limit, offset, sort } = req.query;

    const result = await getReviewsForItem(itemId, {
      limit: limit ? Math.min(parseInt(limit as string, 10) || 20, 100) : 20,
      offset: offset ? parseInt(offset as string, 10) || 0 : 0,
      sortBy: (sort as 'recent' | 'helpful' | 'rating') || 'recent',
    });

    res.json(result);
  } catch (err: any) {
    logger.error(`Get reviews failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/reviews/:itemId/stats', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const stats = await getItemStats(itemId);
    res.json(stats);
  } catch (err: any) {
    logger.error(`Get review stats failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-reviews', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { itemType, limit, offset } = req.query;

    const result = await getReviewsByWallet(wallet, {
      itemType: itemType as string | undefined,
      limit: limit ? Math.min(parseInt(limit as string, 10) || 50, 100) : 50,
      offset: offset ? parseInt(offset as string, 10) || 0 : 0,
    });

    res.json(result);
  } catch (err: any) {
    logger.error(`Get wallet reviews failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews/:reviewId/helpful', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { reviewId } = req.params;
    const success = await markReviewHelpful(reviewId, wallet);

    if (!success) {
      return res.status(400).json({ error: 'Cannot mark your own review as helpful' });
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error(`Mark helpful failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/reviews/:reviewId/report', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { reviewId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== 'string') {
      return res.status(400).json({ error: 'Report reason required' });
    }

    const success = await reportReview(reviewId, wallet, reason);

    if (!success) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error(`Report review failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/reviews/:reviewId', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required' });
    }

    const { reviewId } = req.params;
    const success = await deleteReview(reviewId, wallet);

    if (!success) {
      return res.status(404).json({ error: 'Review not found or not yours' });
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error(`Delete review failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PART 16: OMDB MEDIA IMPORT - Import movies/TV from OMDB API
// ============================================================================

import {
  searchOMDB,
  importFromOMDB,
  batchImportFromOMDB,
} from '../atlas/gamedeck/mediaService';

router.get('/media/search', async (req: Request, res: Response) => {
  try {
    const { title, type, year } = req.query;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await searchOMDB(
      title,
      type as 'movie' | 'series' | 'episode' | undefined,
      year as string | undefined
    );

    if (!result) {
      return res.status(404).json({ error: 'No results found' });
    }

    res.json(result);
  } catch (err: any) {
    logger.error(`OMDB search failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/import', async (req: Request, res: Response) => {
  try {
    const { imdbId, priceWei, rentalPriceWei } = req.body;

    if (!imdbId || typeof imdbId !== 'string') {
      return res.status(400).json({ error: 'IMDB ID is required (e.g., tt0111161)' });
    }

    const item = await importFromOMDB(imdbId, priceWei || '0', rentalPriceWei);

    if (!item) {
      return res.status(404).json({ error: 'Could not import from OMDB' });
    }

    res.status(201).json(item);
  } catch (err: any) {
    logger.error(`OMDB import failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/media/import/batch', async (req: Request, res: Response) => {
  try {
    const { imdbIds, delayMs } = req.body;

    if (!Array.isArray(imdbIds) || imdbIds.length === 0) {
      return res.status(400).json({ error: 'imdbIds array is required' });
    }

    if (imdbIds.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 movies per batch' });
    }

    const result = await batchImportFromOMDB(imdbIds, delayMs || 500);

    res.json(result);
  } catch (err: any) {
    logger.error(`OMDB batch import failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
