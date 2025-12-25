/**
 * Shopping API Adapters
 * 
 * Transform responses from public shopping APIs into Atlas ProductManifests.
 * Each adapter normalizes external data into the unified product format.
 */

import { ProductManifest } from './index';

/**
 * Generic product from external API
 */
export interface ExternalProduct {
  id: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  image?: string;
  images?: string[];
  url: string;
  merchant?: string;
  category?: string;
  inStock?: boolean;
  sku?: string;
  brand?: string;
  rating?: number;
  reviewCount?: number;
  [key: string]: unknown;
}

/**
 * Best Buy Open API adapter
 * https://bestbuyapis.github.io/api-documentation/
 */
export function adaptBestBuyProduct(product: any): ProductManifest {
  return {
    id: `bestbuy-${product.sku}`,
    externalId: product.sku,
    source: 'bestbuy',
    title: product.name,
    description: product.shortDescription || product.longDescription,
    thumbnail: product.thumbnailImage || product.image,
    images: [product.image, product.thumbnailImage, product.largeFrontImage].filter(Boolean),
    priceFiat: product.salePrice ? {
      amount: product.salePrice,
      currency: 'USD',
    } : undefined,
    merchantUrl: product.url || product.addToCartUrl,
    merchantName: 'Best Buy',
    category: product.categoryPath?.[0]?.name || 'Electronics',
    tags: [product.manufacturer, product.modelNumber].filter(Boolean),
    inStock: product.inStoreAvailability || product.onlineAvailability,
    metadata: {
      sku: product.sku,
      upc: product.upc,
      manufacturer: product.manufacturer,
      modelNumber: product.modelNumber,
      customerReviewAverage: product.customerReviewAverage,
      customerReviewCount: product.customerReviewCount,
      regularPrice: product.regularPrice,
      onSale: product.onSale,
    },
  };
}

/**
 * Etsy Open API adapter
 * https://developers.etsy.com/documentation/
 */
export function adaptEtsyProduct(listing: any): ProductManifest {
  return {
    id: `etsy-${listing.listing_id}`,
    externalId: String(listing.listing_id),
    source: 'etsy',
    title: listing.title,
    description: listing.description,
    thumbnail: listing.images?.[0]?.url_170x135,
    images: listing.images?.map((img: any) => img.url_fullxfull) || [],
    priceFiat: {
      amount: parseFloat(listing.price?.amount || 0) / 100,
      currency: listing.price?.currency_code || 'USD',
    },
    merchantUrl: listing.url,
    merchantName: listing.shop?.shop_name || 'Etsy Seller',
    category: listing.taxonomy_path?.join(' > ') || 'Handmade',
    tags: listing.tags || [],
    inStock: listing.quantity > 0,
    metadata: {
      listingId: listing.listing_id,
      shopId: listing.shop_id,
      views: listing.views,
      numFavorers: listing.num_favorers,
      quantity: listing.quantity,
      shippingProfile: listing.shipping_profile,
    },
  };
}

/**
 * Shopify Storefront API adapter
 * Works with any Shopify store's public API
 */
export function adaptShopifyProduct(product: any, storeDomain: string): ProductManifest {
  const variant = product.variants?.edges?.[0]?.node || product.variants?.[0] || {};
  const image = product.images?.edges?.[0]?.node || product.images?.[0] || {};
  
  return {
    id: `shopify-${product.id}`,
    externalId: product.id,
    source: 'shopify',
    title: product.title,
    description: product.description || product.descriptionHtml?.replace(/<[^>]*>/g, ''),
    thumbnail: image.url || image.src,
    images: product.images?.edges?.map((e: any) => e.node.url) || 
            product.images?.map((img: any) => img.src) || [],
    priceFiat: {
      amount: parseFloat(variant.price?.amount || variant.price || 0),
      currency: variant.price?.currencyCode || 'USD',
    },
    merchantUrl: `https://${storeDomain}/products/${product.handle}`,
    merchantName: storeDomain.replace('.myshopify.com', ''),
    category: product.productType || 'Products',
    tags: product.tags || [],
    inStock: variant.availableForSale !== false && variant.quantityAvailable !== 0,
    metadata: {
      handle: product.handle,
      vendor: product.vendor,
      productType: product.productType,
      variantId: variant.id,
      compareAtPrice: variant.compareAtPrice,
    },
  };
}

/**
 * Amazon Product Advertising API adapter
 * Note: Requires PA-API credentials
 */
export function adaptAmazonProduct(item: any): ProductManifest {
  const offer = item.Offers?.Listings?.[0] || {};
  const images = item.Images?.Primary || {};
  
  return {
    id: `amazon-${item.ASIN}`,
    externalId: item.ASIN,
    source: 'amazon',
    title: item.ItemInfo?.Title?.DisplayValue,
    description: item.ItemInfo?.Features?.DisplayValues?.join('\n'),
    thumbnail: images.Small?.URL,
    images: [images.Large?.URL, images.Medium?.URL, images.Small?.URL].filter(Boolean),
    priceFiat: offer.Price ? {
      amount: offer.Price.Amount,
      currency: offer.Price.Currency || 'USD',
    } : undefined,
    merchantUrl: item.DetailPageURL,
    merchantName: 'Amazon',
    category: item.ItemInfo?.Classifications?.ProductGroup?.DisplayValue || 'Products',
    tags: item.ItemInfo?.Classifications?.Binding?.DisplayValue ? 
          [item.ItemInfo.Classifications.Binding.DisplayValue] : [],
    inStock: offer.Availability?.Type === 'Now',
    metadata: {
      asin: item.ASIN,
      brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
      manufacturer: item.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue,
      customerReviews: item.CustomerReviews,
      salesRank: item.BrowseNodeInfo?.WebsiteSalesRank,
    },
  };
}

/**
 * Walmart Open API adapter
 */
export function adaptWalmartProduct(item: any): ProductManifest {
  return {
    id: `walmart-${item.itemId}`,
    externalId: String(item.itemId),
    source: 'walmart',
    title: item.name,
    description: item.shortDescription || item.longDescription,
    thumbnail: item.thumbnailImage,
    images: [item.largeImage, item.mediumImage, item.thumbnailImage].filter(Boolean),
    priceFiat: {
      amount: item.salePrice || item.msrp,
      currency: 'USD',
    },
    merchantUrl: item.productUrl,
    merchantName: 'Walmart',
    category: item.categoryPath || 'Products',
    tags: [item.brandName, item.modelNumber].filter(Boolean),
    inStock: item.stock === 'Available',
    metadata: {
      itemId: item.itemId,
      upc: item.upc,
      brandName: item.brandName,
      modelNumber: item.modelNumber,
      customerRating: item.customerRating,
      numReviews: item.numReviews,
      freeShippingOver35: item.freeShippingOver35Dollars,
    },
  };
}

/**
 * Generic adapter for custom/unknown APIs
 * Maps common field names to ProductManifest
 */
export function adaptGenericProduct(product: ExternalProduct, source: string): ProductManifest {
  return {
    id: `${source}-${product.id}`,
    externalId: product.id,
    source,
    title: product.name,
    description: product.description,
    thumbnail: product.image,
    images: product.images || (product.image ? [product.image] : []),
    priceFiat: product.price ? {
      amount: product.price,
      currency: product.currency || 'USD',
    } : undefined,
    merchantUrl: product.url,
    merchantName: product.merchant,
    category: product.category,
    tags: product.brand ? [product.brand] : [],
    inStock: product.inStock,
    metadata: {
      sku: product.sku,
      brand: product.brand,
      rating: product.rating,
      reviewCount: product.reviewCount,
    },
  };
}

/**
 * Adapter registry for dynamic source handling
 */
export const adapters: Record<string, (product: any, ...args: any[]) => ProductManifest> = {
  bestbuy: adaptBestBuyProduct,
  etsy: adaptEtsyProduct,
  shopify: adaptShopifyProduct,
  amazon: adaptAmazonProduct,
  walmart: adaptWalmartProduct,
  generic: adaptGenericProduct,
};

/**
 * Auto-detect and adapt product from response
 */
export function autoAdaptProduct(product: any, source?: string): ProductManifest | null {
  // Try to detect source from product structure
  if (source && adapters[source]) {
    return adapters[source](product);
  }
  
  // Auto-detect based on fields
  if (product.sku && product.addToCartUrl) {
    return adaptBestBuyProduct(product);
  }
  if (product.listing_id && product.shop_id) {
    return adaptEtsyProduct(product);
  }
  if (product.ASIN && product.DetailPageURL) {
    return adaptAmazonProduct(product);
  }
  if (product.itemId && product.productUrl) {
    return adaptWalmartProduct(product);
  }
  if (product.handle && product.variants) {
    return adaptShopifyProduct(product, product._storeDomain || 'unknown.myshopify.com');
  }
  
  // Fallback to generic
  if (product.id && (product.name || product.title) && product.url) {
    return adaptGenericProduct({
      id: product.id,
      name: product.name || product.title,
      description: product.description,
      price: product.price,
      currency: product.currency,
      image: product.image || product.thumbnail,
      images: product.images,
      url: product.url,
      merchant: product.merchant || product.seller,
      category: product.category,
      inStock: product.inStock ?? product.available,
    }, source || 'custom');
  }
  
  return null;
}
