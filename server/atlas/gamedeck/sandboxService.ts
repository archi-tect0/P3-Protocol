/**
 * SandboxService - Developer sandbox for game creation and build management
 * 
 * Provides functionality for:
 * - Creating sandbox sessions
 * - Creating and managing draft games
 * - Uploading and publishing builds
 * - Registering API endpoints
 */

import { db } from '../../db';
import {
  games,
  builds,
  endpoints,
  gameDeckReceipts,
  type Game,
  type Build,
  type Endpoint,
  type GameDeckReceipt,
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

interface SandboxSession {
  sessionId: string;
  wallet: string;
  createdAt: Date;
}

interface CreateGameResult {
  gameId: string;
  slug: string;
}

interface UploadBuildResult {
  buildId: string;
  version: string;
}

interface UpdateGameFields {
  title?: string;
  description?: string;
  priceWei?: string;
}

function generateRequestId(): string {
  return `sandbox:${Date.now()}:${uuid().slice(0, 8)}`;
}

async function createReceipt(
  wallet: string,
  action: string,
  meta: Record<string, unknown>
): Promise<GameDeckReceipt> {
  const requestId = generateRequestId();
  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet,
      actor: 'sandboxService',
      action,
      metaJson: meta,
      requestId,
    })
    .returning();
  return receipt;
}

/**
 * Create a new sandbox session for a wallet
 * 
 * @param wallet - Wallet address
 * @returns Session details with sessionId, wallet, and createdAt
 */
export async function createSession(wallet: string): Promise<SandboxSession> {
  const sessionId = uuid();
  const createdAt = new Date();

  await createReceipt(wallet, 'sandbox.session', {
    sessionId,
    startedAt: createdAt.toISOString(),
  });

  return {
    sessionId,
    wallet,
    createdAt,
  };
}

/**
 * Create a new game in draft status
 * 
 * @param wallet - Wallet address of the developer
 * @param title - Game title
 * @param slug - URL-friendly slug
 * @param description - Game description
 * @returns Object with gameId and slug
 */
export async function createGame(
  wallet: string,
  title: string,
  slug: string,
  description: string
): Promise<CreateGameResult> {
  const gameId = `sandbox:${wallet}:${slug}`;

  await db
    .insert(games)
    .values({
      id: gameId,
      title,
      description,
      source: 'developer',
      developer: wallet,
      metadata: {
        status: 'draft',
        createdByWallet: wallet,
        slug,
      },
    });

  await createReceipt(wallet, 'sandbox.create', {
    gameId,
    title,
    slug,
    description,
  });

  return {
    gameId,
    slug,
  };
}

/**
 * Upload a new build for a game
 * 
 * @param wallet - Wallet address of the developer
 * @param gameId - Game ID
 * @param version - Build version (e.g., "1.0.0")
 * @param artifactUrl - URL to the build artifact
 * @param changelog - Optional changelog for this version
 * @returns Object with buildId and version
 */
export async function uploadBuild(
  wallet: string,
  gameId: string,
  version: string,
  artifactUrl: string,
  changelog?: string
): Promise<UploadBuildResult> {
  const [existingGame] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (!existingGame) {
    throw new Error(`Game not found: ${gameId}`);
  }

  const metadata = existingGame.metadata as Record<string, unknown> | null;
  if (metadata?.createdByWallet !== wallet && existingGame.developer !== wallet) {
    throw new Error('Unauthorized: wallet does not own this game');
  }

  const [build] = await db
    .insert(builds)
    .values({
      gameId,
      version,
      artifactUrl,
      changelog: changelog || null,
      createdByWallet: wallet,
      published: false,
    })
    .returning();

  await createReceipt(wallet, 'build.upload', {
    buildId: build.id,
    gameId,
    version,
    artifactUrl,
    changelog,
  });

  return {
    buildId: build.id,
    version: build.version,
  };
}

/**
 * Publish a build and update the game status
 * 
 * @param wallet - Wallet address of the developer
 * @param buildId - Build ID to publish
 * @param priceWei - Optional price in Wei for the game
 */
export async function publishBuild(
  wallet: string,
  buildId: string,
  priceWei?: string
): Promise<void> {
  const [build] = await db
    .select()
    .from(builds)
    .where(eq(builds.id, buildId))
    .limit(1);

  if (!build) {
    throw new Error(`Build not found: ${buildId}`);
  }

  if (build.createdByWallet !== wallet) {
    throw new Error('Unauthorized: wallet does not own this build');
  }

  await db
    .update(builds)
    .set({ published: true })
    .where(eq(builds.id, buildId));

  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, build.gameId))
    .limit(1);

  if (game) {
    const existingMetadata = (game.metadata as Record<string, unknown>) || {};
    const updatedMetadata: Record<string, unknown> = {
      ...existingMetadata,
      status: 'published',
    };

    if (priceWei) {
      updatedMetadata.priceWei = priceWei;
    }

    await db
      .update(games)
      .set({
        metadata: updatedMetadata,
        updatedAt: new Date(),
      })
      .where(eq(games.id, build.gameId));
  }

  await createReceipt(wallet, 'sandbox.publish', {
    buildId,
    gameId: build.gameId,
    version: build.version,
    priceWei,
  });
}

/**
 * Update game fields
 * 
 * @param wallet - Wallet address of the developer
 * @param gameId - Game ID to update
 * @param fields - Fields to update (title, description, priceWei)
 */
export async function updateGame(
  wallet: string,
  gameId: string,
  fields: UpdateGameFields
): Promise<void> {
  const [existingGame] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (!existingGame) {
    throw new Error(`Game not found: ${gameId}`);
  }

  const metadata = existingGame.metadata as Record<string, unknown> | null;
  if (metadata?.createdByWallet !== wallet && existingGame.developer !== wallet) {
    throw new Error('Unauthorized: wallet does not own this game');
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (fields.title) {
    updates.title = fields.title;
  }

  if (fields.description) {
    updates.description = fields.description;
  }

  const existingMetadata = (existingGame.metadata as Record<string, unknown>) || {};
  if (fields.priceWei !== undefined) {
    updates.metadata = {
      ...existingMetadata,
      priceWei: fields.priceWei,
    };
  }

  await db
    .update(games)
    .set(updates)
    .where(eq(games.id, gameId));

  await createReceipt(wallet, 'game.update', {
    gameId,
    updatedFields: Object.keys(fields),
    ...fields,
  });
}

/**
 * Register an API endpoint for a game
 * 
 * @param wallet - Wallet address of the developer
 * @param gameId - Game ID
 * @param label - Endpoint label
 * @param url - Endpoint URL
 * @param authKind - Authentication type (e.g., "api-key", "oauth", "none")
 * @returns The created endpoint
 */
export async function registerEndpoint(
  wallet: string,
  gameId: string,
  label: string,
  url: string,
  authKind: string
): Promise<Endpoint> {
  const [existingGame] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (!existingGame) {
    throw new Error(`Game not found: ${gameId}`);
  }

  const metadata = existingGame.metadata as Record<string, unknown> | null;
  if (metadata?.createdByWallet !== wallet && existingGame.developer !== wallet) {
    throw new Error('Unauthorized: wallet does not own this game');
  }

  const [endpoint] = await db
    .insert(endpoints)
    .values({
      gameId,
      ownerWallet: wallet,
      label,
      url,
      authKind,
      status: 'active',
    })
    .returning();

  await createReceipt(wallet, 'endpoint.register', {
    endpointId: endpoint.id,
    gameId,
    label,
    url,
    authKind,
  });

  return endpoint;
}

/**
 * Get all games created by a wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of games created by the wallet
 */
export async function getWalletGames(wallet: string): Promise<Game[]> {
  return await db
    .select()
    .from(games)
    .where(eq(games.developer, wallet))
    .orderBy(desc(games.createdAt));
}

/**
 * Get all builds for a game
 * 
 * @param gameId - Game ID
 * @returns Array of builds for the game
 */
export async function getBuilds(gameId: string): Promise<Build[]> {
  return await db
    .select()
    .from(builds)
    .where(eq(builds.gameId, gameId))
    .orderBy(desc(builds.createdAt));
}

/**
 * Get all endpoints registered by a wallet for a game
 * 
 * @param wallet - Wallet address
 * @param gameId - Game ID
 * @returns Array of endpoints
 */
export async function getEndpoints(wallet: string, gameId: string): Promise<Endpoint[]> {
  return await db
    .select()
    .from(endpoints)
    .where(
      and(
        eq(endpoints.ownerWallet, wallet),
        eq(endpoints.gameId, gameId)
      )
    )
    .orderBy(desc(endpoints.createdAt));
}
