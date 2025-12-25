import { createHash } from "crypto";
import type { 
  InsertLedgerEvent, 
  InsertAllocation, 
  LedgerEvent,
  Allocation,
  AuditLog
} from "@shared/schema";
import type { IStorage } from "../storage";

/**
 * Input type for recording a ledger event
 */
export interface RecordLedgerEventInput {
  txHash: string;
  chainId: string;
  direction: "inflow" | "outflow";
  amount: string;
  asset: string;
  counterparty: string;
  memo?: string;
  actor: string;
}

/**
 * Allocation policy item
 */
export interface AllocationPolicyItem {
  bucket: "ops" | "r&d" | "grants" | "reserve";
  percent: number;
}

/**
 * Input type for allocating funds
 */
export interface AllocateFundsInput {
  ledgerEventId: string;
  policy: AllocationPolicyItem[];
  policyRef: string;
  actor: string;
}

/**
 * Ledger query filters
 */
export interface LedgerFilters {
  direction?: "inflow" | "outflow";
  asset?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Treasury aggregation result
 */
export interface TreasuryBalance {
  asset: string;
  totalInflow: string;
  totalOutflow: string;
  netBalance: string;
}

/**
 * AccountingService - Core service for ledger events and fund allocations
 * 
 * This service handles:
 * - SHA-256 memo hashing for privacy-preserving ledger entries
 * - Immutable ledger event recording with sequence numbers
 * - Fund allocation across buckets (ops, r&d, grants, reserve)
 * - Treasury balance aggregation by asset
 * - Comprehensive audit trail for all mutations
 */
export class AccountingService {
  constructor(private storage: IStorage) {}

  /**
   * Record a ledger event with privacy-preserving memo hashing
   * 
   * @param input - Ledger event data with optional memo
   * @returns Promise<LedgerEvent> - The recorded ledger event
   * 
   * Process:
   * 1. Hash memo with SHA-256 if provided (for privacy)
   * 2. Store ledger event with immutable sequence
   * 3. Create audit log entry for the mutation
   * 
   * The memo is hashed using SHA-256 to protect sensitive transaction details
   * while maintaining a verifiable record of the transaction memo's existence.
   */
  async recordLedgerEvent(input: RecordLedgerEventInput): Promise<LedgerEvent> {
    try {
      // Hash memo with SHA-256 for privacy if provided
      const memoHash = input.memo 
        ? createHash('sha256').update(input.memo).digest('hex')
        : undefined;

      // Prepare insert data
      const insertData: InsertLedgerEvent = {
        txHash: input.txHash,
        chainId: input.chainId,
        direction: input.direction,
        amount: input.amount,
        asset: input.asset,
        counterparty: input.counterparty,
        memoHash,
        immutableSeq: 0, // Will be set by storage layer
      };

      // Store ledger event with immutable sequence
      const ledgerEvent = await this.storage.createLedgerEvent(insertData);

      // Create audit log entry
      await this.storage.appendAuditLog({
        entityType: "ledger_event",
        entityId: ledgerEvent.id,
        action: "create",
        actor: input.actor,
        meta: {
          txHash: input.txHash,
          chainId: input.chainId,
          direction: input.direction,
          amount: input.amount,
          asset: input.asset,
          immutableSeq: ledgerEvent.immutableSeq,
        },
      });

      return ledgerEvent;
    } catch (error) {
      console.error("Error recording ledger event:", error);
      throw new Error(`Failed to record ledger event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Allocate funds from a ledger event across buckets
   * 
   * @param input - Allocation input with ledger event ID and policy
   * @returns Promise<Allocation[]> - The created allocations
   * 
   * Process:
   * 1. Validate allocation percentages sum to 100
   * 2. Retrieve the ledger event to get total amount
   * 3. Calculate allocation amounts based on percentages
   * 4. Create allocation records for each bucket
   * 5. Create audit log entry for the allocation
   * 
   * Throws error if:
   * - Percentages don't sum to exactly 100
   * - Ledger event not found
   * - Ledger event is an outflow (only inflows can be allocated)
   */
  async allocateFunds(input: AllocateFundsInput): Promise<Allocation[]> {
    try {
      // Validate percentages sum to 100
      const totalPercent = input.policy.reduce((sum, item) => sum + item.percent, 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        throw new Error(`Allocation percentages must sum to 100, got ${totalPercent}`);
      }

      // Retrieve ledger event
      const ledgerEvents = await this.storage.getLedgerEvents();
      const ledgerEvent = ledgerEvents.find(e => e.id === input.ledgerEventId);
      
      if (!ledgerEvent) {
        throw new Error(`Ledger event not found: ${input.ledgerEventId}`);
      }

      // Only allocate inflows
      if (ledgerEvent.direction !== "inflow") {
        throw new Error(`Cannot allocate funds from outflow event: ${input.ledgerEventId}`);
      }

      // Calculate allocation amounts
      const totalAmount = parseFloat(ledgerEvent.amount);
      const allocations: Allocation[] = [];

      for (const policyItem of input.policy) {
        const allocationAmount = (totalAmount * policyItem.percent / 100).toFixed(8);

        const insertData: InsertAllocation = {
          ledgerEventId: input.ledgerEventId,
          bucket: policyItem.bucket,
          percent: policyItem.percent.toString(),
          amount: allocationAmount,
          policyRef: input.policyRef,
        };

        const allocation = await this.storage.createAllocation(insertData);
        allocations.push(allocation);
      }

      // Create audit log entry
      await this.storage.appendAuditLog({
        entityType: "allocation",
        entityId: input.ledgerEventId,
        action: "allocate",
        actor: input.actor,
        meta: {
          ledgerEventId: input.ledgerEventId,
          policyRef: input.policyRef,
          totalAmount: ledgerEvent.amount,
          allocations: allocations.map(a => ({
            bucket: a.bucket,
            percent: a.percent,
            amount: a.amount,
          })),
        },
      });

      return allocations;
    } catch (error) {
      console.error("Error allocating funds:", error);
      throw new Error(`Failed to allocate funds: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Query ledger events with optional filters
   * 
   * @param filters - Optional filters for direction, asset, and date range
   * @returns Promise<LedgerEvent[]> - Array of ledger events matching filters
   * 
   * Filters:
   * - direction: Filter by "inflow" or "outflow"
   * - asset: Filter by asset symbol (e.g., "ETH", "USDC")
   * - dateRange: Filter by creation date range
   */
  async getLedger(filters?: LedgerFilters): Promise<LedgerEvent[]> {
    try {
      // Get ledger events from storage with direction filter
      const storageFilters = {
        direction: filters?.direction,
      };

      let ledgerEvents = await this.storage.getLedgerEvents(storageFilters);

      // Apply asset filter
      if (filters?.asset) {
        ledgerEvents = ledgerEvents.filter(e => e.asset === filters.asset);
      }

      // Apply date range filter
      if (filters?.dateRange) {
        ledgerEvents = ledgerEvents.filter(e => {
          const eventDate = new Date(e.createdAt);
          return eventDate >= filters.dateRange!.start && eventDate <= filters.dateRange!.end;
        });
      }

      return ledgerEvents;
    } catch (error) {
      console.error("Error fetching ledger events:", error);
      throw new Error(`Failed to fetch ledger events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get allocations for a specific ledger event
   * 
   * @param ledgerEventId - Optional ledger event ID (if not provided, returns all allocations)
   * @returns Promise<Allocation[]> - Array of allocations
   */
  async getAllocations(ledgerEventId?: string): Promise<Allocation[]> {
    try {
      return await this.storage.getAllocations(ledgerEventId);
    } catch (error) {
      console.error("Error fetching allocations:", error);
      throw new Error(`Failed to fetch allocations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get treasury balance aggregation by asset
   * 
   * @returns Promise<TreasuryBalance[]> - Array of treasury balances by asset
   * 
   * Aggregates all ledger events to calculate:
   * - Total inflows per asset
   * - Total outflows per asset
   * - Net balance per asset
   */
  async getTreasury(): Promise<TreasuryBalance[]> {
    try {
      const ledgerEvents = await this.storage.getLedgerEvents();

      // Group by asset
      const assetMap = new Map<string, { inflow: number; outflow: number }>();

      for (const event of ledgerEvents) {
        const current = assetMap.get(event.asset) || { inflow: 0, outflow: 0 };
        const amount = parseFloat(event.amount);

        if (event.direction === "inflow") {
          current.inflow += amount;
        } else {
          current.outflow += amount;
        }

        assetMap.set(event.asset, current);
      }

      // Convert to treasury balance array
      const treasuryBalances: TreasuryBalance[] = [];

      for (const [asset, totals] of assetMap.entries()) {
        const netBalance = totals.inflow - totals.outflow;
        
        treasuryBalances.push({
          asset,
          totalInflow: totals.inflow.toFixed(8),
          totalOutflow: totals.outflow.toFixed(8),
          netBalance: netBalance.toFixed(8),
        });
      }

      // Sort by asset name
      return treasuryBalances.sort((a, b) => a.asset.localeCompare(b.asset));
    } catch (error) {
      console.error("Error calculating treasury:", error);
      throw new Error(`Failed to calculate treasury: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get audit trail for an entity
   * 
   * @param entityType - Entity type (e.g., "ledger_event", "allocation")
   * @param entityId - Optional entity ID (if not provided, returns all logs for the entity type)
   * @returns Promise<AuditLog[]> - Array of audit log entries
   */
  async getAuditTrail(entityType: string, entityId?: string): Promise<AuditLog[]> {
    try {
      return await this.storage.getAuditLog({
        entityType,
        entityId,
      });
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      throw new Error(`Failed to fetch audit trail: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify memo hash matches the original memo
   * Utility method for external verification of memo against stored hash
   * 
   * @param ledgerEventId - Ledger event ID
   * @param memo - Original memo to verify
   * @returns Promise<boolean> - True if memo hash matches ledger event's memoHash
   */
  async verifyMemo(ledgerEventId: string, memo: string): Promise<boolean> {
    try {
      const ledgerEvents = await this.storage.getLedgerEvents();
      const ledgerEvent = ledgerEvents.find(e => e.id === ledgerEventId);
      
      if (!ledgerEvent) {
        return false;
      }

      // If no memo hash stored, check if memo is also not provided
      if (!ledgerEvent.memoHash) {
        return !memo;
      }

      // Compute hash of provided memo
      const computedHash = createHash('sha256').update(memo).digest('hex');
      return computedHash === ledgerEvent.memoHash;
    } catch (error) {
      console.error("Error verifying memo:", error);
      return false;
    }
  }
}
