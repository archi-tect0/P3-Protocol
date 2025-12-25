/**
 * Atlas One Products - Dual-Mode Shopping Integration
 * 
 * Supports two purchase flows:
 * 1. Anchored Mode: Purchase through Gate with wallet receipt
 * 2. Browser Mode: Open merchant checkout inline, optionally log receipt
 * 
 * Products can be ingested from any public shopping API:
 * - Best Buy, Etsy, Shopify, Amazon Product API, etc.
 */

import { db } from '../../../db';
import { marketplaceItems, mediaAccess, anchoredEvents } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export type PurchaseMode = 'anchored' | 'browser';

export interface ProductManifest {
  id: string;
  externalId?: string;
  source: string;
  title: string;
  description?: string;
  thumbnail?: string;
  images?: string[];
  priceWei?: string;
  priceFiat?: {
    amount: number;
    currency: string;
  };
  merchantUrl: string;
  merchantName?: string;
  category?: string;
  tags?: string[];
  inStock?: boolean;
  metadata?: Record<string, unknown>;
}

export interface BrowserPurchaseEvent {
  wallet: string;
  productId: string;
  merchantUrl: string;
  timestamp: Date;
  priceFiat?: {
    amount: number;
    currency: string;
  };
  metadata?: Record<string, unknown>;
}

export interface DualModeCard {
  product: ProductManifest;
  purchaseModes: PurchaseMode[];
  supportsAnchoring: boolean;
  merchantCheckoutUrl: string;
}

/**
 * Ingest a product from an external shopping API
 */
export async function ingestProduct(manifest: ProductManifest): Promise<{ id: string; slug: string }> {
  const slug = generateSlug(manifest.title, manifest.source);
  
  const [existing] = await db.select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.slug, slug))
    .limit(1);

  if (existing) {
    await db.update(marketplaceItems)
      .set({
        title: manifest.title,
        description: manifest.description,
        thumbnail: manifest.thumbnail,
        priceWei: manifest.priceWei || '0',
        metadata: {
          ...existing.metadata as Record<string, unknown>,
          ...manifest.metadata,
          externalId: manifest.externalId,
          source: manifest.source,
          merchantUrl: manifest.merchantUrl,
          merchantName: manifest.merchantName,
          priceFiat: manifest.priceFiat,
          images: manifest.images,
          inStock: manifest.inStock,
        },
        updatedAt: new Date(),
      })
      .where(eq(marketplaceItems.id, existing.id));
    
    return { id: existing.id, slug };
  }

  const id = uuidv4();
  await db.insert(marketplaceItems).values({
    id,
    slug,
    title: manifest.title,
    description: manifest.description || null,
    itemType: 'product',
    category: manifest.category || 'Shopping',
    subcategory: null,
    thumbnail: manifest.thumbnail || null,
    coverImage: manifest.images?.[0] || null,
    priceWei: manifest.priceWei || '0',
    currency: manifest.priceFiat?.currency || 'USD',
    tags: manifest.tags || [],
    status: 'published',
    featured: false,
    creatorWallet: 'atlas-one-system',
    metadata: {
      externalId: manifest.externalId,
      source: manifest.source,
      merchantUrl: manifest.merchantUrl,
      merchantName: manifest.merchantName,
      priceFiat: manifest.priceFiat,
      images: manifest.images,
      inStock: manifest.inStock,
      purchaseModes: ['browser', 'anchored'],
    },
  });

  return { id, slug };
}

/**
 * Get a dual-mode card for a product
 */
export async function getDualModeCard(productId: string): Promise<DualModeCard | null> {
  const [item] = await db.select()
    .from(marketplaceItems)
    .where(and(
      eq(marketplaceItems.id, productId),
      eq(marketplaceItems.itemType, 'product')
    ))
    .limit(1);

  if (!item) return null;

  const metadata = item.metadata as Record<string, unknown> || {};
  
  return {
    product: {
      id: item.id,
      externalId: metadata.externalId as string | undefined,
      source: metadata.source as string || 'atlas',
      title: item.title,
      description: item.description || undefined,
      thumbnail: item.thumbnail || undefined,
      images: metadata.images as string[] | undefined,
      priceWei: item.priceWei || undefined,
      priceFiat: metadata.priceFiat as { amount: number; currency: string } | undefined,
      merchantUrl: metadata.merchantUrl as string || '',
      merchantName: metadata.merchantName as string | undefined,
      category: item.category,
      tags: item.tags || [],
      inStock: metadata.inStock as boolean | undefined,
      metadata,
    },
    purchaseModes: (metadata.purchaseModes as PurchaseMode[]) || ['browser'],
    supportsAnchoring: !!(item.priceWei && item.priceWei !== '0'),
    merchantCheckoutUrl: metadata.merchantUrl as string || '',
  };
}

/**
 * Log a browser-mode purchase event (optional anchoring)
 */
export async function logBrowserPurchase(event: BrowserPurchaseEvent): Promise<{ receiptId: string }> {
  const receiptId = uuidv4();
  
  await db.insert(anchoredEvents).values({
    id: receiptId,
    eventType: 'browser_purchase',
    entityType: 'product',
    entityId: event.productId,
    wallet: event.wallet,
    payload: {
      merchantUrl: event.merchantUrl,
      priceFiat: event.priceFiat,
      timestamp: event.timestamp.toISOString(),
      ...event.metadata,
    },
    status: 'pending',
  });

  return { receiptId };
}

/**
 * Get browser purchase history for a wallet
 */
export async function getBrowserPurchases(wallet: string, limit: number = 50): Promise<Array<{
  id: string;
  productId: string;
  merchantUrl: string;
  timestamp: Date;
  anchored: boolean;
}>> {
  const events = await db.select()
    .from(anchoredEvents)
    .where(and(
      eq(anchoredEvents.wallet, wallet),
      eq(anchoredEvents.eventType, 'browser_purchase')
    ))
    .orderBy(desc(anchoredEvents.createdAt))
    .limit(limit);

  return events.map(e => ({
    id: e.id,
    productId: e.entityId,
    merchantUrl: (e.payload as any)?.merchantUrl || '',
    timestamp: e.createdAt,
    anchored: e.status === 'anchored',
  }));
}

/**
 * Search products from catalog
 */
export async function searchProducts(params: {
  search?: string;
  category?: string;
  source?: string;
  inStock?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ products: ProductManifest[]; count: number }> {
  const items = await db.select()
    .from(marketplaceItems)
    .where(eq(marketplaceItems.itemType, 'product'))
    .orderBy(desc(marketplaceItems.createdAt))
    .limit(params.limit || 50)
    .offset(params.offset || 0);

  const products = items.map(item => {
    const metadata = item.metadata as Record<string, unknown> || {};
    return {
      id: item.id,
      externalId: metadata.externalId as string | undefined,
      source: metadata.source as string || 'atlas',
      title: item.title,
      description: item.description || undefined,
      thumbnail: item.thumbnail || undefined,
      images: metadata.images as string[] | undefined,
      priceWei: item.priceWei || undefined,
      priceFiat: metadata.priceFiat as { amount: number; currency: string } | undefined,
      merchantUrl: metadata.merchantUrl as string || '',
      merchantName: metadata.merchantName as string | undefined,
      category: item.category,
      tags: item.tags || [],
      inStock: metadata.inStock as boolean | undefined,
      metadata,
    };
  });

  return { products, count: products.length };
}

function generateSlug(title: string, source: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${source}-${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * Batch ingest products from a shopping API response
 */
export async function batchIngestProducts(manifests: ProductManifest[]): Promise<{
  imported: number;
  updated: number;
  failed: number;
}> {
  let imported = 0;
  let updated = 0;
  let failed = 0;

  for (const manifest of manifests) {
    try {
      const result = await ingestProduct(manifest);
      if (result.id) {
        imported++;
      }
    } catch (error) {
      console.error(`Failed to ingest product ${manifest.title}:`, error);
      failed++;
    }
  }

  return { imported, updated, failed };
}
