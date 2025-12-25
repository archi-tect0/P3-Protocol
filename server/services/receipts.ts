import { createHash } from "crypto";
import type { InsertReceipt, Receipt } from "@shared/schema";
import type { IStorage } from "../storage";
import { getBaseSepoliaService } from "./blockchain";
import { rootLogger } from "../observability/logger";

const logger = rootLogger.child({ module: 'receipts' });

/**
 * Input type for creating a receipt (database-backed)
 */
export interface CreateReceiptInput {
  type: "message" | "meeting" | "money";
  subjectId: string;
  content: string;
  actor: string;
  ipfsCid?: string;
  anchorTxHash?: string;
}

/**
 * Atlas-specific receipt for LLM calls, app calls, and materialization events
 */
export interface AtlasReceipt {
  type: 'atlas_llm' | 'atlas_app' | 'atlas_materialize';
  wallet: string;
  ref: string;
  timestamp: string;
  meta?: Record<string, any>;
}

const atlasReceipts: AtlasReceipt[] = [];

export function emitAtlasReceipt(receipt: Omit<AtlasReceipt, 'timestamp'>): AtlasReceipt {
  const r: AtlasReceipt = {
    ...receipt,
    timestamp: new Date().toISOString(),
  };
  atlasReceipts.push(r);
  return r;
}

export function listAtlasReceipts(wallet: string): AtlasReceipt[] {
  return atlasReceipts.filter(r => r.wallet === wallet);
}

export function clearAtlasReceipts(wallet?: string): void {
  if (wallet) {
    const filtered = atlasReceipts.filter(r => r.wallet !== wallet);
    atlasReceipts.length = 0;
    atlasReceipts.push(...filtered);
  } else {
    atlasReceipts.length = 0;
  }
}

/**
 * Receipt filters for querying
 */
export interface ReceiptFilters {
  type?: string;
  subjectId?: string;
}

/**
 * Timeline entry representing either a receipt or ledger event
 */
export interface TimelineEntry {
  id: string;
  type: 'receipt' | 'ledger';
  timestamp: Date;
  contentHash?: string;
  txHash?: string;
  amount?: string;
  direction?: string;
  metadata: any;
}

/**
 * Unified timeline filters with pagination support
 */
export interface UnifiedTimelineFilters {
  type?: 'message' | 'meeting' | 'money';
  startDate?: Date;
  endDate?: Date;
  walletAddress?: string;
  limit?: number;
  offset?: number;
}

/**
 * ReceiptService - Core service for privacy-preserving receipt generation
 * 
 * This service handles:
 * - SHA-256 content hashing for immutability
 * - Blockchain anchoring on Base network for verifiability
 * - Proof blob generation with on-chain verification data
 * - Receipt verification via storage layer and blockchain
 */
export class ReceiptService {
  constructor(private storage: IStorage) {}

  /**
   * Create a new receipt with privacy-preserving content hashing and blockchain anchoring
   * 
   * @param input - Receipt input containing type, subjectId, raw content, and actor
   * @returns Promise<Receipt> - The created receipt with contentHash, blockchain anchor, and proof
   * 
   * Process:
   * 1. Generate SHA-256 hash of content for immutability
   * 2. Anchor content hash to Base blockchain via AnchorRegistry contract
   * 3. Create proof blob with on-chain verification data (anchorId, txHash)
   * 4. Store receipt with immutable sequence number and blockchain proof
   */
  async createReceipt(input: CreateReceiptInput): Promise<Receipt> {
    // Generate SHA-256 hash of content for immutability
    const contentHash = createHash('sha256')
      .update(input.content)
      .digest('hex');

    // Format hash with 0x prefix for blockchain anchoring
    const blockchainHash = `0x${contentHash}`;

    // Prepare metadata for blockchain anchoring
    const anchorMetadata = JSON.stringify({
      type: input.type,
      subjectId: input.subjectId,
      actor: input.actor,
      timestamp: new Date().toISOString(),
      ...(input.ipfsCid && { ipfsCid: input.ipfsCid }),
    });

    // Anchor content hash to Base blockchain
    let anchorId: string | null = null;
    let anchorTxHash: string | null = null;
    let anchorTimestamp: string | null = null;

    try {
      const blockchainService = getBaseSepoliaService();
      const anchorResult = await blockchainService.anchorData(blockchainHash, anchorMetadata);
      
      anchorId = anchorResult.anchorId;
      anchorTxHash = anchorResult.txHash;
      anchorTimestamp = new Date().toISOString();

      logger.info('Receipt content anchored to blockchain', {
        contentHash,
        anchorId,
        txHash: anchorTxHash,
        type: input.type,
      });
    } catch (error) {
      logger.error('Failed to anchor receipt to blockchain', error as Error, {
        contentHash,
        type: input.type,
      });
      throw new Error(`Blockchain anchoring failed: ${(error as Error).message}`);
    }

    // Create proof blob with blockchain verification data
    const proofBlob = {
      version: "1.0",
      algorithm: "sha256",
      timestamp: new Date().toISOString(),
      actor: input.actor,
      contentLength: input.content.length,
      anchorId,
      anchorTxHash,
      anchorTimestamp,
      blockchainNetwork: "base-sepolia",
      ...(input.ipfsCid && { ipfsCid: input.ipfsCid }),
    };

    // Prepare insert data
    const insertData: InsertReceipt = {
      type: input.type,
      subjectId: input.subjectId,
      contentHash,
      proofBlob,
      createdBy: input.actor,
      immutableSeq: 0, // Will be set by storage layer
    };

    // Store receipt with immutable sequence and blockchain proof
    const receipt = await this.storage.createReceipt(insertData);

    return receipt;
  }

  /**
   * Verify receipt integrity by checking proof, storage consistency, and blockchain anchoring
   * 
   * @param id - Receipt ID to verify
   * @returns Promise<boolean> - True if receipt is valid, proof is intact, and blockchain anchor is verified
   * 
   * Verification steps:
   * 1. Retrieve receipt from storage
   * 2. Validate proof blob structure
   * 3. Verify immutable sequence exists
   * 4. Verify blockchain anchoring via on-chain data
   */
  async verifyReceipt(id: string): Promise<boolean> {
    try {
      // Retrieve receipt
      const receipt = await this.storage.getReceipt(id);
      if (!receipt) {
        logger.warn('Receipt not found', { id });
        return false;
      }

      // Verify basic structure
      if (!receipt.contentHash || !receipt.proofBlob || !receipt.immutableSeq) {
        logger.warn('Receipt missing required fields', { id });
        return false;
      }

      // Verify proof blob structure
      const proof = receipt.proofBlob as any;
      if (!proof.version || !proof.algorithm || !proof.timestamp) {
        logger.warn('Invalid proof blob structure', { id });
        return false;
      }

      // Verify hash algorithm
      if (proof.algorithm !== "sha256") {
        logger.warn('Invalid hash algorithm', { id, algorithm: proof.algorithm });
        return false;
      }

      // Verify blockchain anchor exists
      if (!proof.anchorId || !proof.anchorTxHash) {
        logger.warn('Receipt missing blockchain anchor', { id });
        return false;
      }

      // Use storage's verification (checks immutableSeq and structure)
      const storageVerified = await this.storage.verifyReceipt(id);
      if (!storageVerified) {
        logger.warn('Storage verification failed', { id });
        return false;
      }

      // Verify on-chain anchor
      try {
        const blockchainService = getBaseSepoliaService();
        const blockchainHash = `0x${receipt.contentHash}`;
        const onChainVerified = await blockchainService.verifyAnchor(proof.anchorId, blockchainHash);
        
        if (!onChainVerified) {
          logger.warn('Blockchain anchor verification failed', {
            id,
            anchorId: proof.anchorId,
            contentHash: receipt.contentHash,
          });
          return false;
        }

        logger.info('Receipt verification successful', {
          id,
          anchorId: proof.anchorId,
          txHash: proof.anchorTxHash,
        });

        return true;
      } catch (error) {
        logger.error('Blockchain verification error', error as Error, {
          id,
          anchorId: proof.anchorId,
        });
        return false;
      }
    } catch (error) {
      logger.error('Receipt verification error', error as Error, { id });
      return false;
    }
  }

  /**
   * Fetch a receipt by ID
   * 
   * @param id - Receipt ID
   * @returns Promise<Receipt | null> - Receipt if found, null otherwise
   */
  async getReceipt(id: string): Promise<Receipt | null> {
    return this.storage.getReceipt(id);
  }

  /**
   * List receipts with optional filters
   * 
   * @param filters - Optional filters for type and subjectId
   * @returns Promise<Receipt[]> - Array of receipts matching filters
   */
  async listReceipts(filters?: ReceiptFilters): Promise<Receipt[]> {
    return this.storage.listReceipts(filters);
  }

  /**
   * Generate SHA-256 hash for content verification
   * Utility method for external verification of content against stored hash
   * 
   * @param content - Raw content to hash
   * @returns string - SHA-256 hex hash
   */
  generateContentHash(content: string): string {
    return createHash('sha256')
      .update(content)
      .digest('hex');
  }

  /**
   * Verify content matches stored receipt hash
   * 
   * @param id - Receipt ID
   * @param content - Raw content to verify
   * @returns Promise<boolean> - True if content hash matches receipt's contentHash
   */
  async verifyContent(id: string, content: string): Promise<boolean> {
    const receipt = await this.storage.getReceipt(id);
    if (!receipt) {
      return false;
    }

    const computedHash = this.generateContentHash(content);
    return computedHash === receipt.contentHash;
  }

  /**
   * Get unified timeline of receipts and ledger events
   * 
   * Merges receipts and ledger events into a chronological timeline,
   * allowing correlation between privacy-preserving receipts and on-chain transactions.
   * 
   * @param filters - Optional filters for type, date range, wallet address, and pagination
   * @returns Promise<TimelineEntry[]> - Unified timeline sorted by timestamp DESC
   * 
   * Process:
   * 1. Query receipts from storage (filtered by type if specified)
   * 2. Query ledger events from storage
   * 3. Convert both to TimelineEntry format
   * 4. Merge results in-memory
   * 5. Apply date range and wallet address filters
   * 6. Sort by timestamp DESC
   * 7. Apply pagination (limit, offset)
   * 
   * Timeline entries include:
   * - Receipts: contentHash, anchor information from proofBlob
   * - Ledger events: txHash, amount, direction, chain info
   */
  async getUnifiedTimeline(filters?: UnifiedTimelineFilters): Promise<TimelineEntry[]> {
    const timeline: TimelineEntry[] = [];

    // Fetch receipts with type filter if specified
    const receiptFilters = filters?.type ? { type: filters.type } : undefined;
    const receipts = await this.storage.listReceipts(receiptFilters);

    // Convert receipts to timeline entries
    for (const receipt of receipts) {
      const proofBlob = receipt.proofBlob as any;
      
      const entry: TimelineEntry = {
        id: receipt.id,
        type: 'receipt',
        timestamp: receipt.createdAt,
        contentHash: receipt.contentHash,
        metadata: {
          receiptType: receipt.type,
          subjectId: receipt.subjectId,
          immutableSeq: receipt.immutableSeq,
          createdBy: receipt.createdBy,
          // Extract anchor information from proofBlob if available
          anchorTxHash: proofBlob?.baseChainTx || proofBlob?.anchorTxHash || null,
          anchorTimestamp: proofBlob?.anchorTimestamp || null,
          ipfsCid: proofBlob?.ipfsCid || null,
          proofVersion: proofBlob?.version || null,
          algorithm: proofBlob?.algorithm || null,
        },
      };

      timeline.push(entry);
    }

    // Fetch ledger events
    const ledgerEvents = await this.storage.getLedgerEvents();

    // Convert ledger events to timeline entries
    for (const event of ledgerEvents) {
      const entry: TimelineEntry = {
        id: event.id,
        type: 'ledger',
        timestamp: event.createdAt,
        txHash: event.txHash,
        amount: event.amount,
        direction: event.direction,
        metadata: {
          chainId: event.chainId,
          asset: event.asset,
          counterparty: event.counterparty,
          memoHash: event.memoHash,
          immutableSeq: event.immutableSeq,
        },
      };

      timeline.push(entry);
    }

    // Apply date range filters
    let filtered = timeline;
    
    if (filters?.startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= filters.startDate!);
    }

    if (filters?.endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= filters.endDate!);
    }

    // Apply wallet address filter
    // For ledger events, match against counterparty
    // For receipts, match against subjectId (wallet addresses may be stored there)
    if (filters?.walletAddress) {
      filtered = filtered.filter(entry => {
        if (entry.type === 'ledger') {
          return entry.metadata.counterparty === filters.walletAddress;
        } else {
          return entry.metadata.subjectId === filters.walletAddress;
        }
      });
    }

    // Sort by timestamp DESC (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = filters?.offset || 0;
    const limit = filters?.limit;

    if (limit !== undefined) {
      return filtered.slice(offset, offset + limit);
    }

    return filtered.slice(offset);
  }
}
