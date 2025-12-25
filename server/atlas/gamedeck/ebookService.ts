/**
 * EbookService - Atlas Gate model for eBook marketplace
 * 
 * Atlas as Gate: We don't host content, just manifests and receipts.
 * Books come from external APIs (Google Books, Open Library, Gutendex).
 * Atlas stores manifests, handles purchases, and issues access tokens.
 */

import { db } from '../../db';
import {
  marketplaceItems,
  mediaAccess,
  readingProgress,
  catalogSyncJobs,
  marketplaceReceiptsTable,
  type MarketplaceItem,
  type ReadingProgress,
  type CatalogSyncJob,
  type MarketplaceManifest,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

const FEE_WEI = "150000000000000"; // 0.00015 ETH

function generateRequestId(): string {
  return `ebook:${Date.now()}:${uuid().slice(0, 8)}`;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function generateAccessToken(wallet: string, itemId: string): string {
  const payload = { wallet, itemId, exp: Date.now() + 24 * 60 * 60 * 1000, nonce: uuid() };
  const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'atlas-ebook-gate')
    .update(token)
    .digest('base64url');
  return `${token}.${signature}`;
}

// ============================================================================
// BOOK IMPORT FROM FREE SOURCES (Manifest-only, no content hosting)
// ============================================================================

interface GoogleBooksVolume {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    language?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    previewLink?: string;
  };
  accessInfo?: {
    epub?: { isAvailable: boolean; acsTokenLink?: string };
    pdf?: { isAvailable: boolean; acsTokenLink?: string };
    webReaderLink?: string;
  };
}

interface OpenLibraryWork {
  key: string;
  title: string;
  authors?: Array<{ author: { key: string }; name?: string }>;
  description?: string | { value: string };
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
}

interface GutendexBook {
  id: number;
  title: string;
  authors: Array<{ name: string; birth_year?: number; death_year?: number }>;
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  formats: Record<string, string>;
  download_count: number;
}

export async function importFromGoogleBooks(
  query: string,
  limit: number = 20
): Promise<{ items: MarketplaceItem[]; jobId: string; count: number }> {
  const jobId = await createSyncJob('googlebooks', 'search', { query, limit });
  
  try {
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${Math.min(limit, 40)}&filter=free-ebooks&printType=books`
    );
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }
    
    const data = await response.json();
    const volumes: GoogleBooksVolume[] = data.items || [];
    
    const items: MarketplaceItem[] = [];
    for (const vol of volumes) {
      const isbn = vol.volumeInfo.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier;
      
      const manifest: MarketplaceManifest = {
        apiEndpoint: vol.accessInfo?.webReaderLink || vol.volumeInfo.previewLink,
        accessModel: 'free',
        externalIds: {
          googleBooksId: vol.id,
          isbn: isbn,
        },
        bookInfo: {
          authors: vol.volumeInfo.authors,
          publisher: vol.volumeInfo.publisher,
          publishDate: vol.volumeInfo.publishedDate,
          pageCount: vol.volumeInfo.pageCount,
          language: vol.volumeInfo.language,
          subjects: vol.volumeInfo.categories,
          format: vol.accessInfo?.epub?.isAvailable ? 'epub' : 'pdf',
        },
        assets: [],
      };
      
      if (vol.accessInfo?.epub?.acsTokenLink) {
        manifest.assets!.push({ type: 'epub', url: vol.accessInfo.epub.acsTokenLink, format: 'epub' });
      }
      if (vol.accessInfo?.pdf?.acsTokenLink) {
        manifest.assets!.push({ type: 'pdf', url: vol.accessInfo.pdf.acsTokenLink, format: 'pdf' });
      }

      const [item] = await db.insert(marketplaceItems).values({
        itemType: 'ebook',
        title: vol.volumeInfo.title,
        slug: generateSlug(vol.volumeInfo.title),
        description: vol.volumeInfo.description,
        creatorWallet: 'system:googlebooks',
        category: 'books',
        subcategory: vol.volumeInfo.categories?.[0],
        tags: vol.volumeInfo.categories?.slice(0, 5),
        thumbnail: vol.volumeInfo.imageLinks?.thumbnail,
        coverImage: vol.volumeInfo.imageLinks?.smallThumbnail,
        priceWei: '0',
        manifest: manifest as any,
        status: 'published',
        metadata: { source: 'googlebooks', importedAt: new Date().toISOString() },
      }).onConflictDoNothing().returning();
      
      if (item) items.push(item);
    }
    
    await updateSyncJob(jobId, 'completed', items.length);
    return { items, jobId, count: items.length };
  } catch (error) {
    await updateSyncJob(jobId, 'failed', 0, String(error));
    return { items: [], jobId, count: 0 };
  }
}

export async function importFromOpenLibrary(params: {
  workId?: string;
  isbn?: string;
  subject?: string;
  limit?: number;
}): Promise<{ items: MarketplaceItem[]; jobId: string; count: number }> {
  const jobId = await createSyncJob('openlibrary', params.workId ? 'work' : params.isbn ? 'isbn' : 'subject', params);
  
  try {
    let works: OpenLibraryWork[] = [];
    
    if (params.workId) {
      const response = await fetch(`https://openlibrary.org/works/${params.workId}.json`);
      if (response.ok) {
        const work = await response.json();
        works = [work];
      }
    } else if (params.isbn) {
      const response = await fetch(`https://openlibrary.org/isbn/${params.isbn}.json`);
      if (response.ok) {
        const edition = await response.json();
        if (edition.works?.[0]?.key) {
          const workResponse = await fetch(`https://openlibrary.org${edition.works[0].key}.json`);
          if (workResponse.ok) {
            works = [await workResponse.json()];
          }
        }
      }
    } else if (params.subject) {
      const response = await fetch(
        `https://openlibrary.org/subjects/${encodeURIComponent(params.subject.toLowerCase())}.json?limit=${params.limit || 20}`
      );
      if (response.ok) {
        const data = await response.json();
        works = (data.works || []).map((w: any) => ({
          key: w.key,
          title: w.title,
          authors: w.authors?.map((a: any) => ({ author: { key: a.key }, name: a.name })),
          description: w.first_sentence,
          covers: w.cover_id ? [w.cover_id] : [],
          subjects: [params.subject],
          first_publish_date: w.first_publish_year?.toString(),
        }));
      }
    }
    
    const items: MarketplaceItem[] = [];
    
    for (const work of works) {
      const description = typeof work.description === 'string' 
        ? work.description 
        : work.description?.value;
      
      const manifest: MarketplaceManifest = {
        apiEndpoint: `https://openlibrary.org${work.key}`,
        accessModel: 'free',
        externalIds: {
          openLibraryId: work.key,
        },
        bookInfo: {
          authors: work.authors?.map(a => a.name || a.author.key),
          publishDate: work.first_publish_date,
          subjects: work.subjects?.slice(0, 10),
        },
        assets: work.covers?.map(coverId => ({
          type: 'cover',
          url: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
          format: 'image',
        })),
      };

      const [item] = await db.insert(marketplaceItems).values({
        itemType: 'ebook',
        title: work.title,
        slug: generateSlug(work.title),
        description,
        creatorWallet: 'system:openlibrary',
        category: 'books',
        subcategory: work.subjects?.[0],
        tags: work.subjects?.slice(0, 5),
        thumbnail: work.covers?.[0] ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-M.jpg` : undefined,
        priceWei: '0',
        manifest: manifest as any,
        status: 'published',
        metadata: { source: 'openlibrary', importedAt: new Date().toISOString() },
      }).onConflictDoNothing().returning();
      
      if (item) items.push(item);
    }
    
    await updateSyncJob(jobId, 'completed', items.length);
    return { items, jobId, count: items.length };
  } catch (error) {
    await updateSyncJob(jobId, 'failed', 0, String(error));
    return { items: [], jobId, count: 0 };
  }
}

export async function importFromGutendex(params: {
  search?: string;
  topic?: string;
  language?: string;
  limit?: number;
}): Promise<{ items: MarketplaceItem[]; jobId: string; count: number }> {
  const jobId = await createSyncJob('gutendex', 'search', params);
  
  try {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.set('search', params.search);
    if (params.topic) queryParams.set('topic', params.topic);
    if (params.language) queryParams.set('languages', params.language);
    
    const response = await fetch(`https://gutendex.com/books?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`Gutendex API error: ${response.status}`);
    }
    
    const data = await response.json();
    const books: GutendexBook[] = (data.results || []).slice(0, params.limit || 50);
    const items: MarketplaceItem[] = [];
    
    for (const book of books) {
      const epubUrl = book.formats['application/epub+zip'];
      const pdfUrl = book.formats['application/pdf'];
      const htmlUrl = book.formats['text/html'];
      
      const manifest: MarketplaceManifest = {
        apiEndpoint: htmlUrl || epubUrl || pdfUrl,
        accessModel: 'free',
        externalIds: {
          gutenbergId: String(book.id),
        },
        bookInfo: {
          authors: book.authors.map(a => a.name),
          language: book.languages[0],
          subjects: book.subjects.slice(0, 10),
          format: epubUrl ? 'epub' : 'pdf',
        },
        assets: [
          ...(epubUrl ? [{ type: 'epub', url: epubUrl, format: 'epub' }] : []),
          ...(pdfUrl ? [{ type: 'pdf', url: pdfUrl, format: 'pdf' }] : []),
          ...(htmlUrl ? [{ type: 'html', url: htmlUrl, format: 'html' }] : []),
        ],
      };

      const downloadUrl = epubUrl || htmlUrl || pdfUrl;
      
      // Get cover image from formats
      const coverUrl = book.formats['image/jpeg'] || 
                       `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`;
      
      const [item] = await db.insert(marketplaceItems).values({
        itemType: 'ebook',
        title: book.title,
        slug: generateSlug(book.title),
        description: `Classic literature from Project Gutenberg. ${book.bookshelves.join(', ')}`,
        creatorWallet: 'system:gutenberg',
        category: 'books',
        subcategory: book.bookshelves[0] || 'classics',
        tags: [...book.subjects.slice(0, 3), ...book.bookshelves.slice(0, 2)],
        thumbnail: coverUrl,
        coverImage: coverUrl,
        priceWei: '0',
        manifest: manifest as any,
        status: 'published',
        metadata: { 
          source: 'gutendex', 
          downloadCount: book.download_count,
          importedAt: new Date().toISOString(),
          downloadUrl,
          formats: {
            epub: epubUrl || null,
            html: htmlUrl || null,
            pdf: pdfUrl || null,
          },
          gutenberg_id: book.id,
        },
      }).onConflictDoNothing().returning();
      
      if (item) items.push(item);
    }
    
    await updateSyncJob(jobId, 'completed', items.length);
    return { items, jobId, count: items.length };
  } catch (error) {
    await updateSyncJob(jobId, 'failed', 0, String(error));
    return { items: [], jobId, count: 0 };
  }
}

/**
 * Backfill download URLs for existing Gutendex ebooks
 * Fetches fresh data from Gutendex API and updates metadata.downloadUrl
 */
export async function backfillEbookDownloadUrls(): Promise<{
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const result = { updated: 0, skipped: 0, errors: [] as string[] };
  
  try {
    const ebooks = await db
      .select()
      .from(marketplaceItems)
      .where(
        and(
          eq(marketplaceItems.itemType, 'ebook'),
          sql`metadata->>'source' = 'gutendex'`,
          sql`metadata->>'downloadUrl' IS NULL`
        )
      );
    
    console.log(`[Backfill] Found ${ebooks.length} Gutendex ebooks missing downloadUrl`);
    
    for (const ebook of ebooks) {
      try {
        const currentMetadata = ebook.metadata as Record<string, unknown> || {};
        const gutenbergId = currentMetadata.gutenberg_id || 
          (ebook.manifest as any)?.externalIds?.gutenbergId;
        
        if (!gutenbergId) {
          result.skipped++;
          continue;
        }
        
        const response = await fetch(`https://gutendex.com/books/${gutenbergId}`);
        if (!response.ok) {
          result.errors.push(`Failed to fetch book ${gutenbergId}: ${response.status}`);
          continue;
        }
        
        const book: GutendexBook = await response.json();
        
        const epubUrl = book.formats['application/epub+zip'];
        const htmlUrl = book.formats['text/html'];
        const pdfUrl = book.formats['application/pdf'];
        const txtUrl = book.formats['text/plain; charset=utf-8'] || book.formats['text/plain'];
        
        const downloadUrl = epubUrl || htmlUrl || pdfUrl || txtUrl;
        
        if (!downloadUrl) {
          result.skipped++;
          continue;
        }
        
        const updatedMetadata = {
          ...currentMetadata,
          downloadUrl,
          formats: {
            epub: epubUrl || null,
            html: htmlUrl || null,
            pdf: pdfUrl || null,
            txt: txtUrl || null,
          },
          gutenberg_id: book.id,
          backfilledAt: new Date().toISOString(),
        };
        
        await db
          .update(marketplaceItems)
          .set({
            metadata: updatedMetadata,
            updatedAt: new Date(),
          })
          .where(eq(marketplaceItems.id, ebook.id));
        
        result.updated++;
        
        await new Promise(r => setTimeout(r, 1500));
      } catch (err: any) {
        if (err.message?.includes('429')) {
          await new Promise(r => setTimeout(r, 10000));
        }
        result.errors.push(`Error updating ${ebook.id}: ${err.message}`);
      }
    }
    
    console.log(`[Backfill] Complete: ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);
    return result;
  } catch (err: any) {
    result.errors.push(`Backfill failed: ${err.message}`);
    return result;
  }
}

// ============================================================================
// EBOOK PURCHASE/ACCESS (Gate Model)
// ============================================================================

export interface EbookAccessResult {
  accessId: string;
  accessToken: string;
  receiptId: string;
  expiresAt?: Date;
}

export async function purchaseEbook(
  wallet: string,
  itemId: string
): Promise<EbookAccessResult | null> {
  try {
    console.log(`[EbookService] purchaseEbook called: wallet=${wallet.slice(0,10)}, itemId=${itemId}`);
    
    const [item] = await db
      .select()
      .from(marketplaceItems)
      .where(and(eq(marketplaceItems.id, itemId), eq(marketplaceItems.itemType, 'ebook')))
      .limit(1);
    
    console.log(`[EbookService] Query result: item=${item ? item.title : 'NOT FOUND'}`);
    
    if (!item) return null;

    // Check if already purchased
    const [existing] = await db
      .select()
      .from(mediaAccess)
      .where(and(
        eq(mediaAccess.wallet, wallet),
        eq(mediaAccess.itemId, itemId),
        eq(mediaAccess.accessType, 'purchase')
      ))
      .limit(1);
    
    if (existing) {
      return {
        accessId: existing.id,
        accessToken: generateAccessToken(wallet, itemId),
        receiptId: existing.receiptId || '',
      };
    }

    const accessToken = generateAccessToken(wallet, itemId);
    const requestId = generateRequestId();
    
    // Create receipt
    const [receipt] = await db.insert(marketplaceReceiptsTable).values({
      wallet,
      kind: 'purchase.complete',
      refId: itemId,
      refType: 'ebook',
      anchorFeeWei: FEE_WEI,
      metaJson: { title: item.title, priceWei: item.priceWei },
      requestId,
    }).returning();

    // Create access entry
    const [access] = await db.insert(mediaAccess).values({
      wallet,
      itemId,
      kind: 'ebook',
      accessType: 'purchase',
      priceWei: item.priceWei || '0',
      receiptId: receipt.id,
      metadata: { accessToken },
    }).returning();

    // Increment purchase count
    await db.execute(sql`
      UPDATE marketplace_items 
      SET purchases = COALESCE(purchases, 0) + 1 
      WHERE id = ${itemId}
    `);

    return {
      accessId: access.id,
      accessToken,
      receiptId: receipt.id,
    };
  } catch (error) {
    console.error('Error purchasing ebook:', error);
    return null;
  }
}

export async function checkEbookAccess(
  wallet: string,
  itemId: string
): Promise<{ hasAccess: boolean; accessToken?: string; accessType?: string }> {
  try {
    const [access] = await db
      .select()
      .from(mediaAccess)
      .where(and(
        eq(mediaAccess.wallet, wallet),
        eq(mediaAccess.itemId, itemId)
      ))
      .orderBy(desc(mediaAccess.createdAt))
      .limit(1);
    
    if (!access) {
      // Check if it's a free book
      const [item] = await db
        .select()
        .from(marketplaceItems)
        .where(eq(marketplaceItems.id, itemId))
        .limit(1);
      
      if (item && item.priceWei === '0') {
        return { hasAccess: true, accessToken: generateAccessToken(wallet, itemId), accessType: 'free' };
      }
      return { hasAccess: false };
    }

    // Check expiry for rentals
    if (access.accessType === 'rental' && access.expiresAt) {
      if (new Date(access.expiresAt) < new Date()) {
        return { hasAccess: false };
      }
    }

    return {
      hasAccess: true,
      accessToken: generateAccessToken(wallet, itemId),
      accessType: access.accessType,
    };
  } catch (error) {
    console.error('Error checking ebook access:', error);
    return { hasAccess: false };
  }
}

export interface LibraryEntry {
  item: MarketplaceItem;
  accessType: string;
  purchasedAt: Date;
  progress?: ReadingProgress;
}

export async function removeFromLibrary(
  wallet: string,
  itemId: string
): Promise<boolean> {
  try {
    const result = await db
      .delete(mediaAccess)
      .where(and(
        eq(mediaAccess.wallet, wallet),
        eq(mediaAccess.itemId, itemId)
      ))
      .returning();

    if (result.length > 0) {
      await db
        .delete(readingProgress)
        .where(and(
          eq(readingProgress.wallet, wallet),
          eq(readingProgress.itemId, itemId)
        ));
    }

    return result.length > 0;
  } catch (error) {
    console.error('Error removing from library:', error);
    return false;
  }
}

export async function getEbookLibrary(
  wallet: string
): Promise<{ items: LibraryEntry[]; count: number }> {
  try {
    const accesses = await db
      .select()
      .from(mediaAccess)
      .innerJoin(marketplaceItems, eq(mediaAccess.itemId, marketplaceItems.id))
      .where(and(
        eq(mediaAccess.wallet, wallet),
        eq(marketplaceItems.itemType, 'ebook')
      ))
      .orderBy(desc(mediaAccess.createdAt));

    const items: LibraryEntry[] = [];
    
    for (const row of accesses) {
      // Get reading progress
      const [progress] = await db
        .select()
        .from(readingProgress)
        .where(and(
          eq(readingProgress.wallet, wallet),
          eq(readingProgress.itemId, row.media_access.itemId)
        ))
        .limit(1);

      // Enrich with dynamic thumbnail if missing
      let item = row.marketplace_items;
      if (!item.thumbnail && item.metadata) {
        const meta = item.metadata as Record<string, any>;
        if (meta.gutenberg_id) {
          const coverId = meta.gutenberg_id;
          item = {
            ...item,
            thumbnail: `https://www.gutenberg.org/cache/epub/${coverId}/pg${coverId}.cover.medium.jpg`,
          };
        }
      }

      items.push({
        item,
        accessType: row.media_access.accessType,
        purchasedAt: row.media_access.createdAt,
        progress: progress || undefined,
      });
    }

    return { items, count: items.length };
  } catch (error) {
    console.error('Error getting ebook library:', error);
    return { items: [], count: 0 };
  }
}

// ============================================================================
// READING PROGRESS
// ============================================================================

export async function saveProgress(
  wallet: string,
  itemId: string,
  data: { page: number; totalPages?: number }
): Promise<ReadingProgress | null> {
  try {
    const percentComplete = data.totalPages 
      ? String(((data.page / data.totalPages) * 100).toFixed(2))
      : '0';

    const [existing] = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.wallet, wallet),
        eq(readingProgress.itemId, itemId)
      ))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(readingProgress)
        .set({
          currentPage: data.page,
          totalPages: data.totalPages || existing.totalPages,
          percentComplete,
          lastReadAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(readingProgress).values({
      wallet,
      itemId,
      currentPage: data.page,
      totalPages: data.totalPages,
      percentComplete,
      lastReadAt: new Date(),
    }).returning();

    return created;
  } catch (error) {
    console.error('Error saving reading progress:', error);
    return null;
  }
}

export async function getProgress(
  wallet: string,
  itemId: string
): Promise<ReadingProgress | null> {
  try {
    const [progress] = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.wallet, wallet),
        eq(readingProgress.itemId, itemId)
      ))
      .limit(1);
    
    return progress || null;
  } catch (error) {
    console.error('Error getting reading progress:', error);
    return null;
  }
}

interface Highlight {
  id: string;
  page: number;
  text: string;
  color?: string;
  createdAt: string;
}

export async function addHighlight(
  wallet: string,
  itemId: string,
  highlight: { page: number; text: string; color?: string }
): Promise<ReadingProgress | null> {
  try {
    const [existing] = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.wallet, wallet),
        eq(readingProgress.itemId, itemId)
      ))
      .limit(1);

    const newHighlight: Highlight = {
      id: uuid(),
      ...highlight,
      createdAt: new Date().toISOString(),
    };

    if (existing) {
      const highlights = Array.isArray(existing.highlights) ? existing.highlights : [];
      const [updated] = await db
        .update(readingProgress)
        .set({
          highlights: [...highlights, newHighlight],
          lastReadAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(readingProgress).values({
      wallet,
      itemId,
      highlights: [newHighlight],
      lastReadAt: new Date(),
    }).returning();

    return created;
  } catch (error) {
    console.error('Error adding highlight:', error);
    return null;
  }
}

interface Note {
  id: string;
  page: number;
  content: string;
  createdAt: string;
}

export async function addNote(
  wallet: string,
  itemId: string,
  note: { page: number; content: string }
): Promise<ReadingProgress | null> {
  try {
    const [existing] = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.wallet, wallet),
        eq(readingProgress.itemId, itemId)
      ))
      .limit(1);

    const newNote: Note = {
      id: uuid(),
      ...note,
      createdAt: new Date().toISOString(),
    };

    if (existing) {
      const notes = Array.isArray(existing.notes) ? existing.notes : [];
      const [updated] = await db
        .update(readingProgress)
        .set({
          notes: [...notes, newNote],
          lastReadAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(readingProgress).values({
      wallet,
      itemId,
      notes: [newNote],
      lastReadAt: new Date(),
    }).returning();

    return created;
  } catch (error) {
    console.error('Error adding note:', error);
    return null;
  }
}

interface Bookmark {
  id: string;
  page: number;
  label?: string;
  createdAt: string;
}

export async function addBookmark(
  wallet: string,
  itemId: string,
  bookmark: { page: number; label?: string }
): Promise<ReadingProgress | null> {
  try {
    const [existing] = await db
      .select()
      .from(readingProgress)
      .where(and(
        eq(readingProgress.wallet, wallet),
        eq(readingProgress.itemId, itemId)
      ))
      .limit(1);

    const newBookmark: Bookmark = {
      id: uuid(),
      ...bookmark,
      createdAt: new Date().toISOString(),
    };

    if (existing) {
      const bookmarks = Array.isArray(existing.bookmarks) ? existing.bookmarks : [];
      const [updated] = await db
        .update(readingProgress)
        .set({
          bookmarks: [...bookmarks, newBookmark],
          lastReadAt: new Date(),
        })
        .where(eq(readingProgress.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(readingProgress).values({
      wallet,
      itemId,
      bookmarks: [newBookmark],
      lastReadAt: new Date(),
    }).returning();

    return created;
  } catch (error) {
    console.error('Error adding bookmark:', error);
    return null;
  }
}

// ============================================================================
// SYNC JOB MANAGEMENT
// ============================================================================

export async function createSyncJob(
  source: string,
  jobType: string,
  params?: object
): Promise<string> {
  try {
    const [job] = await db.insert(catalogSyncJobs).values({
      source: source as any,
      jobType,
      status: 'running',
      params: params as any,
      startedAt: new Date(),
    }).returning();
    
    return job.id;
  } catch (error) {
    console.error('Error creating sync job:', error);
    return uuid();
  }
}

export async function updateSyncJob(
  jobId: string,
  status: string,
  itemsSynced?: number,
  error?: string
): Promise<void> {
  try {
    await db
      .update(catalogSyncJobs)
      .set({
        status: status as any,
        itemsSynced: itemsSynced || 0,
        errorMessage: error,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      })
      .where(eq(catalogSyncJobs.id, jobId));
  } catch (err) {
    console.error('Error updating sync job:', err);
  }
}

export async function getRecentSyncJobs(
  source?: string,
  limit: number = 10
): Promise<CatalogSyncJob[]> {
  try {
    let query = db.select().from(catalogSyncJobs);
    
    if (source) {
      query = query.where(eq(catalogSyncJobs.source, source as any)) as any;
    }
    
    const jobs = await query
      .orderBy(desc(catalogSyncJobs.createdAt))
      .limit(limit);
    
    return jobs;
  } catch (error) {
    console.error('Error getting sync jobs:', error);
    return [];
  }
}

// ============================================================================
// EBOOK CATALOG HELPERS
// ============================================================================

export async function getEbookCatalog(filters: {
  search?: string;
  category?: string;
  free?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: MarketplaceItem[]; count: number }> {
  try {
    let conditions = [eq(marketplaceItems.itemType, 'ebook'), eq(marketplaceItems.status, 'published')];
    
    if (filters.free) {
      conditions.push(eq(marketplaceItems.priceWei, '0'));
    }
    
    if (filters.category) {
      // Filter by subcategory (genre) since all ebooks have category='books'
      // Use ILIKE for case-insensitive partial matching
      conditions.push(sql`LOWER(${marketplaceItems.subcategory}) LIKE ${'%' + filters.category.toLowerCase() + '%'}`);
    }
    
    if (filters.search) {
      // Search in title, description, tags, subcategory, and author (in manifest)
      const searchTerm = '%' + filters.search.toLowerCase() + '%';
      conditions.push(sql`(
        LOWER(${marketplaceItems.title}) LIKE ${searchTerm} OR
        LOWER(${marketplaceItems.description}) LIKE ${searchTerm} OR
        LOWER(${marketplaceItems.subcategory}) LIKE ${searchTerm} OR
        LOWER(${marketplaceItems.manifest}::text) LIKE ${searchTerm} OR
        EXISTS (SELECT 1 FROM unnest(${marketplaceItems.tags}) tag WHERE LOWER(tag) LIKE ${searchTerm})
      )`);
    }

    const items = await db
      .select()
      .from(marketplaceItems)
      .where(and(...conditions))
      .orderBy(desc(marketplaceItems.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    // Add dynamic thumbnails for books without them
    const enrichedItems = items.map(item => {
      if (!item.thumbnail && item.metadata) {
        const meta = item.metadata as Record<string, any>;
        if (meta.gutenberg_id) {
          const coverId = meta.gutenberg_id;
          return {
            ...item,
            thumbnail: `https://www.gutenberg.org/cache/epub/${coverId}/pg${coverId}.cover.medium.jpg`,
          };
        }
      }
      return item;
    });

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceItems)
      .where(and(...conditions));

    return { items: enrichedItems, count: Number(countResult?.count || 0) };
  } catch (error) {
    console.error('Error getting ebook catalog:', error);
    return { items: [], count: 0 };
  }
}

export async function getContinueReading(
  wallet: string,
  limit: number = 5
): Promise<{ items: LibraryEntry[]; count: number }> {
  try {
    const progressList = await db
      .select()
      .from(readingProgress)
      .innerJoin(marketplaceItems, eq(readingProgress.itemId, marketplaceItems.id))
      .where(and(
        eq(readingProgress.wallet, wallet),
        sql`${readingProgress.currentPage} > 0`
      ))
      .orderBy(desc(readingProgress.lastReadAt))
      .limit(limit);

    const items: LibraryEntry[] = progressList.map(row => ({
      item: row.marketplace_items,
      accessType: 'reading',
      purchasedAt: row.reading_progress.createdAt,
      progress: row.reading_progress,
    }));

    return { items, count: items.length };
  } catch (error) {
    console.error('Error getting continue reading:', error);
    return { items: [], count: 0 };
  }
}
