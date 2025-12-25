/**
 * ReviewService - Unified user reviews for all marketplace content
 * 
 * Works across all content types: books, movies, games, products
 * Reviews are wallet-scoped and anchored for immutability
 */

import { db } from '../../db';
import {
  userReviews,
  marketplaceItems,
  type UserReview,
  type InsertUserReview,
} from '@shared/schema';
import { eq, and, desc, sql, avg, count } from 'drizzle-orm';

export interface ReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
}

export interface ReviewWithItem extends UserReview {
  item?: {
    id: string;
    title: string;
    itemType: string;
    thumbnail: string | null;
  };
}

export async function createReview(
  wallet: string,
  itemId: string,
  data: {
    rating: number;
    title?: string;
    content: string;
  }
): Promise<UserReview | null> {
  try {
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.id, itemId))
      .limit(1);

    if (!item) {
      throw new Error('Item not found');
    }

    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const [review] = await db
      .insert(userReviews)
      .values({
        itemId,
        wallet,
        rating: data.rating,
        title: data.title || null,
        content: data.content,
        verified: false,
        status: 'published',
        metadata: {
          itemType: item.itemType,
          createdVia: 'atlas',
        },
      })
      .onConflictDoUpdate({
        target: [userReviews.wallet, userReviews.itemId],
        set: {
          rating: data.rating,
          title: data.title || null,
          content: data.content,
          updatedAt: new Date(),
        },
      })
      .returning();

    return review || null;
  } catch (err) {
    console.error('Error creating review:', err);
    throw err;
  }
}

export async function getReviewsForItem(
  itemId: string,
  options: {
    limit?: number;
    offset?: number;
    sortBy?: 'recent' | 'helpful' | 'rating';
  } = {}
): Promise<{ reviews: UserReview[]; count: number; stats: ReviewStats }> {
  try {
    const { limit = 20, offset = 0, sortBy = 'recent' } = options;

    const orderBy = sortBy === 'helpful'
      ? desc(userReviews.helpful)
      : sortBy === 'rating'
      ? desc(userReviews.rating)
      : desc(userReviews.createdAt);

    const reviews = await db
      .select()
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      )
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      );

    const [avgResult] = await db
      .select({ avg: avg(userReviews.rating) })
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      );

    const distribution = await db
      .select({
        rating: userReviews.rating,
        count: count(),
      })
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      )
      .groupBy(userReviews.rating);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribution) {
      ratingDistribution[d.rating] = Number(d.count);
    }

    return {
      reviews,
      count: Number(countResult?.count || 0),
      stats: {
        averageRating: Number(avgResult?.avg || 0),
        totalReviews: Number(countResult?.count || 0),
        ratingDistribution,
      },
    };
  } catch (err) {
    console.error('Error getting reviews:', err);
    return { reviews: [], count: 0, stats: { averageRating: 0, totalReviews: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } };
  }
}

export async function getReviewsByWallet(
  wallet: string,
  options: {
    itemType?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ reviews: ReviewWithItem[]; count: number }> {
  try {
    const { itemType, limit = 50, offset = 0 } = options;

    let query = db
      .select({
        review: userReviews,
        item: {
          id: marketplaceItems.id,
          title: marketplaceItems.title,
          itemType: marketplaceItems.itemType,
          thumbnail: marketplaceItems.thumbnail,
        },
      })
      .from(userReviews)
      .leftJoin(marketplaceItems, eq(userReviews.itemId, marketplaceItems.id))
      .where(eq(userReviews.wallet, wallet))
      .orderBy(desc(userReviews.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await query;

    const reviews: ReviewWithItem[] = results.map((r) => ({
      ...r.review,
      item: r.item || undefined,
    }));

    const filteredReviews = itemType
      ? reviews.filter((r) => r.item?.itemType === itemType)
      : reviews;

    const [countResult] = await db
      .select({ count: count() })
      .from(userReviews)
      .where(eq(userReviews.wallet, wallet));

    return {
      reviews: filteredReviews,
      count: Number(countResult?.count || 0),
    };
  } catch (err) {
    console.error('Error getting wallet reviews:', err);
    return { reviews: [], count: 0 };
  }
}

export async function markReviewHelpful(
  reviewId: string,
  wallet: string
): Promise<boolean> {
  try {
    const [review] = await db
      .select()
      .from(userReviews)
      .where(eq(userReviews.id, reviewId))
      .limit(1);

    if (!review) return false;

    if (review.wallet === wallet) {
      return false;
    }

    await db
      .update(userReviews)
      .set({
        helpful: sql`${userReviews.helpful} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userReviews.id, reviewId));

    return true;
  } catch (err) {
    console.error('Error marking review helpful:', err);
    return false;
  }
}

export async function reportReview(
  reviewId: string,
  wallet: string,
  reason: string
): Promise<boolean> {
  try {
    const [review] = await db
      .select()
      .from(userReviews)
      .where(eq(userReviews.id, reviewId))
      .limit(1);

    if (!review) return false;

    await db
      .update(userReviews)
      .set({
        reported: sql`${userReviews.reported} + 1`,
        status: sql`CASE WHEN ${userReviews.reported} >= 4 THEN 'flagged' ELSE ${userReviews.status} END`,
        metadata: sql`jsonb_set(COALESCE(${userReviews.metadata}, '{}'), '{reports}', COALESCE(${userReviews.metadata}->>'reports', '[]')::jsonb || ${JSON.stringify({ wallet, reason, at: new Date().toISOString() })}::jsonb)`,
        updatedAt: new Date(),
      })
      .where(eq(userReviews.id, reviewId));

    return true;
  } catch (err) {
    console.error('Error reporting review:', err);
    return false;
  }
}

export async function deleteReview(
  reviewId: string,
  wallet: string
): Promise<boolean> {
  try {
    const [review] = await db
      .select()
      .from(userReviews)
      .where(
        and(
          eq(userReviews.id, reviewId),
          eq(userReviews.wallet, wallet)
        )
      )
      .limit(1);

    if (!review) return false;

    await db
      .update(userReviews)
      .set({
        status: 'removed',
        updatedAt: new Date(),
      })
      .where(eq(userReviews.id, reviewId));

    return true;
  } catch (err) {
    console.error('Error deleting review:', err);
    return false;
  }
}

export async function getItemStats(itemId: string): Promise<ReviewStats> {
  try {
    const [countResult] = await db
      .select({ count: count() })
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      );

    const [avgResult] = await db
      .select({ avg: avg(userReviews.rating) })
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      );

    const distribution = await db
      .select({
        rating: userReviews.rating,
        count: count(),
      })
      .from(userReviews)
      .where(
        and(
          eq(userReviews.itemId, itemId),
          eq(userReviews.status, 'published')
        )
      )
      .groupBy(userReviews.rating);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of distribution) {
      ratingDistribution[d.rating] = Number(d.count);
    }

    return {
      averageRating: Number(avgResult?.avg || 0),
      totalReviews: Number(countResult?.count || 0),
      ratingDistribution,
    };
  } catch (err) {
    console.error('Error getting item stats:', err);
    return { averageRating: 0, totalReviews: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  }
}
