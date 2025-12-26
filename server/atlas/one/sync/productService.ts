/**
 * Product Ingestion Service
 * 
 * Imports real products from free public APIs:
 * - Open Food Facts: Food/grocery products
 * - GitHub Releases: Open-source software as digital products
 * - Open Product Data: General retail items
 */

import { db } from '../../../db';
import { marketplaceItems } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface ProductManifest {
  productId: string;
  name: string;
  description: string;
  price: number | null;
  currency: string;
  vendor: {
    name: string;
    url: string;
    source: string;
  };
  media: {
    thumbnail: string | null;
    gallery: string[];
  };
  fulfillment: {
    kind: 'anchored' | 'browser' | 'digital';
    checkoutUrl?: string;
    downloadUrl?: string;
  };
  attributes: Record<string, any>;
  externalId: string;
  externalSource: string;
}

// =============================================================================
// OPEN FOOD FACTS - Food & Grocery Products
// =============================================================================

interface OpenFoodFactsProduct {
  code: string;
  product_name: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  image_small_url?: string;
  ingredients_text?: string;
  nutriscore_grade?: string;
  ecoscore_grade?: string;
  quantity?: string;
  stores?: string;
  countries?: string;
  url?: string;
}

export async function syncOpenFoodFacts(options: {
  category?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { category = 'beverages', page = 1, pageSize = 50 } = options;
  const result = { imported: 0, skipped: 0, errors: [] as string[] };

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&tagtype_0=categories&tag_contains_0=contains&tag_0=${encodeURIComponent(category)}&page=${page}&page_size=${pageSize}&json=1`;
    
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AtlasOne/1.0 (contact@p3protocol.com)' }
    });

    if (!response.ok) {
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }

    const data = await response.json();
    const products: OpenFoodFactsProduct[] = data.products || [];

    console.log(`[Products] Open Food Facts: fetched ${products.length} products from "${category}"`);

    for (const product of products) {
      if (!product.product_name || !product.code) continue;

      try {
        const slug = `product-off-${product.code}`;
        
        const [existing] = await db
          .select()
          .from(marketplaceItems)
          .where(eq(marketplaceItems.slug, slug))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        const manifest: ProductManifest = {
          productId: `openfoodfacts:${product.code}`,
          name: product.product_name,
          description: product.ingredients_text || `${product.brands || 'Product'} - ${product.quantity || ''}`,
          price: null,
          currency: 'USD',
          vendor: {
            name: product.brands || 'Unknown Brand',
            url: product.url || `https://world.openfoodfacts.org/product/${product.code}`,
            source: 'openfoodfacts',
          },
          media: {
            thumbnail: product.image_small_url || product.image_url || null,
            gallery: product.image_url ? [product.image_url] : [],
          },
          fulfillment: {
            kind: 'browser',
            checkoutUrl: product.stores 
              ? `https://www.google.com/search?q=${encodeURIComponent(product.product_name + ' buy')}`
              : undefined,
          },
          attributes: {
            barcode: product.code,
            nutriscore: product.nutriscore_grade,
            ecoscore: product.ecoscore_grade,
            quantity: product.quantity,
            categories: product.categories,
            countries: product.countries,
          },
          externalId: product.code,
          externalSource: 'openfoodfacts',
        };

        await db.insert(marketplaceItems).values({
          itemType: 'product',
          title: product.product_name.slice(0, 200),
          slug,
          description: manifest.description?.slice(0, 500) || 'Food product',
          thumbnail: manifest.media.thumbnail,
          creatorWallet: 'system',
          category: 'food',
          subcategory: category,
          priceWei: '0',
          currency: 'USD',
          status: 'published',
          tags: ['food', category, product.brands?.toLowerCase() || 'grocery'].filter(Boolean),
          manifest: manifest as any,
          metadata: {
            externalSource: 'openfoodfacts',
            externalId: product.code,
            fulfillmentKind: 'browser',
            importedAt: new Date().toISOString(),
          },
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        result.imported++;
      } catch (err: any) {
        result.errors.push(`${product.code}: ${err.message}`);
      }
    }

    console.log(`[Products] Open Food Facts: ${result.imported} imported, ${result.skipped} skipped`);
    return result;
  } catch (err: any) {
    console.error(`[Products] Open Food Facts error: ${err.message}`);
    result.errors.push(err.message);
    return result;
  }
}

// =============================================================================
// GITHUB RELEASES - Open Source Software as Digital Products
// =============================================================================

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    download_count: number;
  }>;
}

interface GitHubRepo {
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  topics: string[];
  license?: { spdx_id: string };
  owner: { login: string; avatar_url: string };
}

const POPULAR_REPOS = [
  'microsoft/vscode',
  'obsidianmd/obsidian-releases',
  'jgraph/drawio-desktop',
  'notable/notable',
  'marktext/marktext',
  'Zettlr/Zettlr',
  'laurent22/joplin',
  'logseq/logseq',
  'AppFlowy-IO/AppFlowy',
  'toeverything/AFFiNE',
  'brave/brave-browser',
  'nicotine-plus/nicotine-plus',
  'qbittorrent/qBittorrent',
  'transmission/transmission',
  'HandBrake/HandBrake',
  'audacity/audacity',
  'LMMS/lmms',
  'mifi/lossless-cut',
  'Kodi/kodi',
  'vlc-mirror/vlc',
  'blender/blender',
  'godotengine/godot',
  'FreeCAD/FreeCAD',
  'openscad/openscad',
  'KiCad/kicad-source-mirror',
  'inkscape/inkscape',
  'GIMP/gimp',
  'darktable-org/darktable',
  'KDE/kdenlive',
  'OpenShot/openshot-qt',
];

export async function syncGitHubReleases(options: {
  repos?: string[];
  limit?: number;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { repos = POPULAR_REPOS, limit = 10 } = options;
  const result = { imported: 0, skipped: 0, errors: [] as string[] };

  const reposToSync = repos.slice(0, limit);

  for (const repoName of reposToSync) {
    try {
      const repoResponse = await fetch(`https://api.github.com/repos/${repoName}`, {
        headers: { 'User-Agent': 'AtlasOne/1.0' }
      });

      if (!repoResponse.ok) {
        if (repoResponse.status === 403) {
          console.log('[Products] GitHub rate limit hit, stopping');
          break;
        }
        result.errors.push(`${repoName}: ${repoResponse.status}`);
        continue;
      }

      const repo: GitHubRepo = await repoResponse.json();

      const releaseResponse = await fetch(`https://api.github.com/repos/${repoName}/releases/latest`, {
        headers: { 'User-Agent': 'AtlasOne/1.0' }
      });

      if (!releaseResponse.ok) {
        result.skipped++;
        continue;
      }

      const release: GitHubRelease = await releaseResponse.json();
      
      if (!release.assets || release.assets.length === 0) {
        result.skipped++;
        continue;
      }

      const slug = `product-gh-${repoName.replace('/', '-').toLowerCase()}`;

      const [existing] = await db
        .select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.slug, slug))
        .limit(1);

      if (existing) {
        result.skipped++;
        continue;
      }

      const primaryAsset = release.assets.find(a => 
        a.name.endsWith('.exe') || 
        a.name.endsWith('.dmg') || 
        a.name.endsWith('.AppImage') ||
        a.name.endsWith('.deb') ||
        a.name.includes('linux') ||
        a.name.includes('win')
      ) || release.assets[0];

      const manifest: ProductManifest = {
        productId: `github:${repoName}`,
        name: repo.full_name.split('/')[1],
        description: repo.description || release.name,
        price: 0,
        currency: 'USD',
        vendor: {
          name: repo.owner.login,
          url: repo.html_url,
          source: 'github',
        },
        media: {
          thumbnail: repo.owner.avatar_url,
          gallery: [],
        },
        fulfillment: {
          kind: 'digital',
          downloadUrl: primaryAsset.browser_download_url,
        },
        attributes: {
          version: release.tag_name,
          stars: repo.stargazers_count,
          license: repo.license?.spdx_id,
          topics: repo.topics,
          downloadCount: primaryAsset.download_count,
          fileSize: primaryAsset.size,
          assets: release.assets.map(a => ({
            name: a.name,
            url: a.browser_download_url,
            size: a.size,
          })),
        },
        externalId: repoName,
        externalSource: 'github',
      };

      await db.insert(marketplaceItems).values({
        itemType: 'product',
        title: repo.full_name.split('/')[1],
        slug,
        description: (repo.description || release.body || 'Open source software').slice(0, 500),
        thumbnail: repo.owner.avatar_url,
        creatorWallet: 'system',
        category: 'software',
        subcategory: 'open-source',
        priceWei: '0',
        currency: 'USD',
        status: 'published',
        tags: ['software', 'open-source', 'free', ...(repo.topics?.slice(0, 3) || [])],
        manifest: manifest as any,
        metadata: {
          externalSource: 'github',
          externalId: repoName,
          fulfillmentKind: 'digital',
          version: release.tag_name,
          stars: repo.stargazers_count,
          downloadUrl: primaryAsset.browser_download_url,
          importedAt: new Date().toISOString(),
        },
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      result.imported++;
      
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      result.errors.push(`${repoName}: ${err.message}`);
    }
  }

  console.log(`[Products] GitHub: ${result.imported} imported, ${result.skipped} skipped`);
  return result;
}

// =============================================================================
// ITCH.IO - Indie Games & Digital Products
// =============================================================================

export async function syncItchioProducts(options: {
  page?: number;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { page = 1 } = options;
  const result = { imported: 0, skipped: 0, errors: [] as string[] };

  try {
    const response = await fetch(`https://itch.io/games/free/top-rated.json?page=${page}`, {
      headers: { 'User-Agent': 'AtlasOne/1.0' }
    });

    if (!response.ok) {
      throw new Error(`Itch.io API error: ${response.status}`);
    }

    const data = await response.json();
    const games = data.games || [];

    console.log(`[Products] Itch.io: fetched ${games.length} free games`);

    for (const game of games) {
      try {
        const slug = `product-itch-${game.id}`;

        const [existing] = await db
          .select()
          .from(marketplaceItems)
          .where(eq(marketplaceItems.slug, slug))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        const manifest: ProductManifest = {
          productId: `itchio:${game.id}`,
          name: game.title,
          description: game.short_text || game.title,
          price: 0,
          currency: 'USD',
          vendor: {
            name: game.user?.display_name || 'Indie Developer',
            url: game.user?.url || game.url,
            source: 'itchio',
          },
          media: {
            thumbnail: game.cover_url,
            gallery: game.cover_url ? [game.cover_url] : [],
          },
          fulfillment: {
            kind: 'browser',
            checkoutUrl: game.url,
          },
          attributes: {
            platforms: game.platforms,
            classification: game.classification,
            canBeBought: game.can_be_bought,
          },
          externalId: String(game.id),
          externalSource: 'itchio',
        };

        await db.insert(marketplaceItems).values({
          itemType: 'product',
          title: game.title.slice(0, 200),
          slug,
          description: (game.short_text || game.title).slice(0, 500),
          thumbnail: game.cover_url,
          creatorWallet: 'system',
          category: 'games',
          subcategory: 'indie',
          priceWei: '0',
          currency: 'USD',
          status: 'published',
          tags: ['game', 'indie', 'free', game.classification || 'game'],
          manifest: manifest as any,
          metadata: {
            externalSource: 'itchio',
            externalId: String(game.id),
            fulfillmentKind: 'browser',
            checkoutUrl: game.url,
            importedAt: new Date().toISOString(),
          },
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        result.imported++;
      } catch (err: any) {
        result.errors.push(`${game.id}: ${err.message}`);
      }
    }

    console.log(`[Products] Itch.io: ${result.imported} imported, ${result.skipped} skipped`);
    return result;
  } catch (err: any) {
    console.error(`[Products] Itch.io error: ${err.message}`);
    result.errors.push(err.message);
    return result;
  }
}

// =============================================================================
// COMBINED PRODUCT SYNC
// =============================================================================

export async function syncAllProducts(): Promise<{
  openFoodFacts: { imported: number; skipped: number };
  github: { imported: number; skipped: number };
  itchio: { imported: number; skipped: number };
  total: number;
}> {
  console.log('[Products] Starting full product sync...');

  const offResult = await syncOpenFoodFacts({ category: 'beverages', pageSize: 30 });
  await new Promise(r => setTimeout(r, 2000));

  const ghResult = await syncGitHubReleases({ limit: 10 });
  await new Promise(r => setTimeout(r, 2000));

  const itchResult = await syncItchioProducts({ page: 1 });

  const total = offResult.imported + ghResult.imported + itchResult.imported;
  console.log(`[Products] Sync complete: ${total} total products imported`);

  return {
    openFoodFacts: { imported: offResult.imported, skipped: offResult.skipped },
    github: { imported: ghResult.imported, skipped: ghResult.skipped },
    itchio: { imported: itchResult.imported, skipped: itchResult.skipped },
    total,
  };
}

// Delete demo products
export async function removeDemoProducts(): Promise<number> {
  const result = await db
    .delete(marketplaceItems)
    .where(sql`item_type = 'product' AND (metadata->>'externalSource' IS NULL OR metadata->>'externalSource' = 'demo')`)
    .returning();
  
  console.log(`[Products] Removed ${result.length} demo products`);
  return result.length;
}
