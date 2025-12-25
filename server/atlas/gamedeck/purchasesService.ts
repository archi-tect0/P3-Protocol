/**
 * PurchasesService - Gate integration for game/mod/DLC purchases
 * 
 * Handles purchase lifecycle:
 * - Initiate pending purchases
 * - Complete purchases with transaction hash
 * - Verify purchase anchoring status
 * - Check ownership for gating
 * - Anchor purchases to blockchain
 */

import { db } from '../../db';
import {
  purchases,
  gameDeckReceipts,
  games,
  mods,
  type Purchase,
  type GameDeckReceipt,
} from '@shared/schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { anchorEventDirect, getEventAnchorStatus } from './anchorService';

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `purchase:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Initiate a pending purchase
 * 
 * Creates a purchase record in pending status for a game, mod, DLC, or subscription.
 * The purchase must be completed with a transaction hash to become valid.
 */
export async function initiatePurchase(
  wallet: string,
  priceWei: string,
  itemType: 'game' | 'mod' | 'dlc' | 'subscription',
  gameId?: string,
  modId?: string,
  metadata?: Record<string, unknown>
): Promise<{ purchase: Purchase; receipt: GameDeckReceipt }> {
  if (!gameId && !modId) {
    throw new Error('Either gameId or modId must be provided');
  }

  if (gameId) {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);
    
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }
  }

  if (modId) {
    const [mod] = await db
      .select()
      .from(mods)
      .where(eq(mods.id, modId))
      .limit(1);
    
    if (!mod) {
      throw new Error(`Mod not found: ${modId}`);
    }
  }

  const requestId = generateRequestId();

  const [purchase] = await db
    .insert(purchases)
    .values({
      wallet,
      gameId: gameId || null,
      modId: modId || null,
      itemType,
      priceWei,
      currency: 'ETH',
      status: 'pending',
      metadata: metadata || null,
    })
    .returning();

  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet,
      actor: 'purchasesService',
      action: 'purchase.initiate',
      metaJson: {
        purchaseId: purchase.id,
        gameId,
        modId,
        itemType,
        priceWei,
      },
      requestId,
    })
    .returning();

  return { purchase, receipt };
}

/**
 * Complete a purchase with transaction hash
 * 
 * Marks the purchase as complete and records the transaction hash.
 * Creates a GameDeckReceipt for audit trail.
 */
export async function completePurchase(
  purchaseId: string,
  txHash: string
): Promise<{ purchase: Purchase; receipt: GameDeckReceipt }> {
  const [existingPurchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!existingPurchase) {
    throw new Error(`Purchase not found: ${purchaseId}`);
  }

  if (existingPurchase.status !== 'pending') {
    throw new Error(`Purchase is not pending: ${purchaseId} (status: ${existingPurchase.status})`);
  }

  const requestId = generateRequestId();

  const [updatedPurchase] = await db
    .update(purchases)
    .set({
      status: 'complete',
      txHash,
      completedAt: new Date(),
    })
    .where(eq(purchases.id, purchaseId))
    .returning();

  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet: existingPurchase.wallet,
      actor: 'purchasesService',
      action: 'purchase.complete',
      metaJson: {
        purchaseId,
        txHash,
        gameId: existingPurchase.gameId,
        modId: existingPurchase.modId,
        itemType: existingPurchase.itemType,
        priceWei: existingPurchase.priceWei,
      },
      requestId,
    })
    .returning();

  return { purchase: updatedPurchase, receipt };
}

/**
 * Verify purchase anchoring status
 * 
 * Checks whether the purchase has been anchored and returns verification details.
 */
export async function verifyPurchase(purchaseId: string): Promise<{
  purchase: Purchase;
  anchored: boolean;
  verified?: boolean;
  anchorDetails?: {
    anchorId: string;
    status: string;
    rootHash?: string;
  };
}> {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!purchase) {
    throw new Error(`Purchase not found: ${purchaseId}`);
  }

  if (!purchase.anchorId) {
    return {
      purchase,
      anchored: false,
    };
  }

  const anchorStatus = await getEventAnchorStatus(purchaseId);

  if (!anchorStatus || !anchorStatus.anchored) {
    return {
      purchase,
      anchored: false,
    };
  }

  return {
    purchase,
    anchored: true,
    verified: anchorStatus.verified,
    anchorDetails: anchorStatus.anchorRecord ? {
      anchorId: anchorStatus.anchorRecord.id,
      status: anchorStatus.anchorRecord.status,
      rootHash: anchorStatus.anchorRecord.rootHash || undefined,
    } : undefined,
  };
}

/**
 * Get all purchases for a wallet
 * 
 * Returns purchases ordered by creation date (newest first).
 * Optionally filter by status.
 */
export async function getPurchases(
  wallet: string,
  status?: 'pending' | 'complete' | 'failed' | 'refunded'
): Promise<Purchase[]> {
  const conditions = [eq(purchases.wallet, wallet)];
  
  if (status) {
    conditions.push(eq(purchases.status, status));
  }

  const results = await db
    .select()
    .from(purchases)
    .where(and(...conditions))
    .orderBy(desc(purchases.createdAt));

  return results;
}

/**
 * Check ownership of a game or mod
 * 
 * Verifies whether a wallet has a completed purchase for the specified game or mod.
 */
export async function checkOwnership(
  wallet: string,
  gameId?: string,
  modId?: string
): Promise<{
  owned: boolean;
  purchase?: Purchase;
}> {
  if (!gameId && !modId) {
    throw new Error('Either gameId or modId must be provided');
  }

  const conditions = [
    eq(purchases.wallet, wallet),
    eq(purchases.status, 'complete'),
  ];

  if (gameId) {
    conditions.push(eq(purchases.gameId, gameId));
  }

  if (modId) {
    conditions.push(eq(purchases.modId, modId));
  }

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(and(...conditions))
    .limit(1);

  if (purchase) {
    return { owned: true, purchase };
  }

  return { owned: false };
}

/**
 * Anchor a purchase receipt to blockchain
 * 
 * Creates an anchor record for the purchase using AnchorService.
 * Updates the purchase with the anchor ID.
 */
export async function anchorPurchase(
  purchaseId: string,
  chain: string = 'base'
): Promise<{
  purchase: Purchase;
  anchorId: string;
  receipt: GameDeckReceipt;
}> {
  const [existingPurchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!existingPurchase) {
    throw new Error(`Purchase not found: ${purchaseId}`);
  }

  if (existingPurchase.status !== 'complete') {
    throw new Error(`Purchase must be complete before anchoring: ${purchaseId}`);
  }

  if (existingPurchase.anchorId) {
    throw new Error(`Purchase already anchored: ${purchaseId}`);
  }

  const requestId = generateRequestId();

  const anchorResult = await anchorEventDirect(purchaseId, chain);

  const [updatedPurchase] = await db
    .update(purchases)
    .set({
      anchorId: anchorResult.anchorRecord.id,
      receiptId: anchorResult.receipt.id,
    })
    .where(eq(purchases.id, purchaseId))
    .returning();

  const [auditReceipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet: existingPurchase.wallet,
      actor: 'purchasesService',
      action: 'purchase.anchor',
      metaJson: {
        purchaseId,
        anchorId: anchorResult.anchorRecord.id,
        chain,
        rootHash: anchorResult.anchorRecord.rootHash,
        feeWei: anchorResult.anchorRecord.totalFeeWei,
      },
      requestId,
    })
    .returning();

  return {
    purchase: updatedPurchase,
    anchorId: anchorResult.anchorRecord.id,
    receipt: auditReceipt,
  };
}

/**
 * Get purchase by ID
 */
export async function getPurchaseById(purchaseId: string): Promise<Purchase | null> {
  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  return purchase || null;
}

/**
 * Refund a purchase
 * 
 * Marks a completed purchase as refunded.
 */
export async function refundPurchase(
  purchaseId: string,
  refundTxHash?: string
): Promise<{ purchase: Purchase; receipt: GameDeckReceipt }> {
  const [existingPurchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, purchaseId))
    .limit(1);

  if (!existingPurchase) {
    throw new Error(`Purchase not found: ${purchaseId}`);
  }

  if (existingPurchase.status !== 'complete') {
    throw new Error(`Only completed purchases can be refunded: ${purchaseId}`);
  }

  const requestId = generateRequestId();

  const [updatedPurchase] = await db
    .update(purchases)
    .set({
      status: 'refunded',
      metadata: {
        ...(existingPurchase.metadata as Record<string, unknown> || {}),
        refundTxHash,
        refundedAt: new Date().toISOString(),
      },
    })
    .where(eq(purchases.id, purchaseId))
    .returning();

  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet: existingPurchase.wallet,
      actor: 'purchasesService',
      action: 'purchase.refund',
      metaJson: {
        purchaseId,
        originalTxHash: existingPurchase.txHash,
        refundTxHash,
        gameId: existingPurchase.gameId,
        modId: existingPurchase.modId,
        priceWei: existingPurchase.priceWei,
      },
      requestId,
    })
    .returning();

  return { purchase: updatedPurchase, receipt };
}
