/**
 * Atlas One Commerce - Unified purchase, rental, and anchoring
 * 
 * Handles all commerce flows:
 * - Purchases (permanent access)
 * - Rentals (time-limited access, 48hr for media)
 * - Subscriptions (recurring access)
 * - Anchoring (blockchain receipts at 0.00015 ETH)
 */

export {
  rentMedia,
  purchaseMedia,
} from '../../gamedeck/mediaService';

export {
  initiatePurchase,
  completePurchase,
  verifyPurchase,
  getPurchases,
  checkOwnership,
  anchorPurchase,
  getPurchaseById,
  refundPurchase,
} from '../../gamedeck/purchasesService';

export {
  anchorEventDirect,
  anchorEventsBatch,
  getEventAnchorStatus,
  verifyMerkleProof,
  merkleRoot,
  sha256Hex,
  FEE_WEI,
} from '../../gamedeck/anchorService';

export {
  createReview,
  getReviewsForItem,
  getReviewsByWallet,
  markReviewHelpful,
  reportReview,
  deleteReview,
  getItemStats,
} from '../../gamedeck/reviewService';

import { FEE_WEI } from '../../gamedeck/anchorService';
import type { ExperienceKind } from '../types';

export const ANCHOR_FEE_ETH = '0.00015';
export const RENTAL_DURATION_HOURS = 48;

export interface PurchaseRequest {
  wallet: string;
  itemId: string;
  kind: ExperienceKind;
  priceWei: string;
  isRental?: boolean;
}

export interface PurchaseResult {
  success: boolean;
  accessId?: string;
  receiptId?: string;
  txHash?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Unified purchase flow for any content type
 */
export async function purchaseItem(request: PurchaseRequest): Promise<PurchaseResult> {
  const { wallet, itemId, kind, priceWei, isRental } = request;

  try {
    if (kind === 'video') {
      const { rentMedia, purchaseMedia } = await import('../../gamedeck/mediaService');
      const result = isRental 
        ? await rentMedia(wallet, itemId)
        : await purchaseMedia(wallet, itemId);
      
      return {
        success: true,
        accessId: result.access.id,
        receiptId: result.receipt.id,
        expiresAt: result.access.expiresAt || undefined,
      };
    }

    if (kind === 'game') {
      const { initiatePurchase, completePurchase } = await import('../../gamedeck/purchasesService');
      const initiated = await initiatePurchase(wallet, itemId, priceWei, 'game');
      const completed = await completePurchase(initiated.purchase.id, wallet);
      
      return {
        success: true,
        receiptId: completed.receipt?.id || undefined,
      };
    }

    return {
      success: false,
      error: `Purchase not implemented for kind: ${kind}`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if wallet has access to an item
 */
export async function checkItemAccess(
  wallet: string,
  itemId: string,
  kind: ExperienceKind
): Promise<{ hasAccess: boolean; accessType?: string; expiresAt?: Date }> {
  if (kind === 'video') {
    const { checkAccess } = await import('../../gamedeck/mediaService');
    const result = await checkAccess(wallet, itemId);
    return {
      hasAccess: result.hasAccess,
      accessType: result.accessType || undefined,
      expiresAt: result.expiresAt || undefined,
    };
  }

  if (kind === 'game') {
    const { checkOwnership } = await import('../../gamedeck/purchasesService');
    const result = await checkOwnership(wallet, itemId);
    return {
      hasAccess: result.owned,
      accessType: result.owned ? 'purchase' : undefined,
    };
  }

  return { hasAccess: false };
}
