/**
 * AnchorService - Merkle-based event anchoring with fee accounting
 * 
 * Provides two anchoring modes:
 * - Direct: Single event anchoring with per-event fee
 * - Batch: Multiple events anchored via Merkle root with shared fees
 * 
 * All operations create audit trails via GameDeckReceipts
 */

import { db } from '../../db';
import {
  anchorRecords,
  anchorProofs,
  anchorLedger,
  gameEvents,
  gameDeckReceipts,
  type GameEvent,
  type AnchorRecord,
  type AnchorProof,
  type AnchorLedgerEntry,
  type GameDeckReceipt,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { v4 as uuid } from 'uuid';

/**
 * Immutable fee constant: 0.00015 ETH in wei
 */
export const FEE_WEI = "150000000000000" as const;

/**
 * Compute SHA-256 hash and return hex string
 */
export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute Merkle root from array of leaf hashes
 * Uses SHA-256 for internal node computation
 * Pads odd levels with duplicate of last hash
 */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) {
    return sha256Hex('');
  }
  
  if (leaves.length === 1) {
    return leaves[0];
  }
  
  let level = [...leaves];
  
  while (level.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      nextLevel.push(sha256Hex(left + right));
    }
    
    level = nextLevel;
  }
  
  return level[0];
}

/**
 * Compute Merkle proof path for a leaf at given index
 * Returns array of { hash, position } where position is 'left' or 'right'
 */
export function merklePathFor(
  leaves: string[],
  leafIndex: number
): Array<{ hash: string; position: 'left' | 'right' }> {
  if (leaves.length === 0 || leafIndex < 0 || leafIndex >= leaves.length) {
    return [];
  }
  
  if (leaves.length === 1) {
    return [];
  }
  
  const path: Array<{ hash: string; position: 'left' | 'right' }> = [];
  let level = [...leaves];
  let index = leafIndex;
  
  while (level.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const sibling = siblingIndex < level.length ? level[siblingIndex] : level[index];
    
    path.push({
      hash: sibling,
      position: index % 2 === 0 ? 'right' : 'left',
    });
    
    const nextLevel: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      nextLevel.push(sha256Hex(left + right));
    }
    
    level = nextLevel;
    index = Math.floor(index / 2);
  }
  
  return path;
}

/**
 * Compute leaf hash for a game event
 */
function computeEventLeafHash(event: GameEvent): string {
  const canonical = JSON.stringify({
    id: event.id,
    wallet: event.wallet,
    gameId: event.gameId,
    eventType: event.eventType,
    payload: event.payload,
    occurredAt: event.occurredAt?.toISOString(),
  });
  return sha256Hex(canonical);
}

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `anchor:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Anchor a single event directly (mode: "direct")
 * 
 * Creates:
 * - AnchorRecord with mode="direct", count=1
 * - AnchorLedger entry with FEE_WEI
 * - AnchorProof with empty merkle path (single leaf)
 * - Updates GameEvent with anchorId and feeWei
 * - GameDeckReceipt for audit trail
 */
export async function anchorEventDirect(
  eventId: string,
  chain: string = 'base'
): Promise<{
  anchorRecord: AnchorRecord;
  ledgerEntry: AnchorLedgerEntry;
  proof: AnchorProof;
  receipt: GameDeckReceipt;
}> {
  const [event] = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.id, eventId))
    .limit(1);
  
  if (!event) {
    throw new Error(`GameEvent not found: ${eventId}`);
  }
  
  if (event.anchorId) {
    throw new Error(`GameEvent already anchored: ${eventId}`);
  }
  
  const leafHash = computeEventLeafHash(event);
  const requestId = generateRequestId();
  
  const [anchorRecord] = await db
    .insert(anchorRecords)
    .values({
      wallet: event.wallet,
      chain,
      mode: 'direct',
      count: 1,
      status: 'pending',
      rootHash: leafHash,
      totalFeeWei: FEE_WEI,
    })
    .returning();
  
  const [ledgerEntry] = await db
    .insert(anchorLedger)
    .values({
      wallet: event.wallet,
      gameId: event.gameId,
      eventId: event.id,
      feeWei: FEE_WEI,
      mode: 'direct',
      anchorId: anchorRecord.id,
    })
    .returning();
  
  const [proof] = await db
    .insert(anchorProofs)
    .values({
      anchorId: anchorRecord.id,
      eventId: event.id,
      leafHash,
      merklePath: [],
      leafIndex: 0,
      verified: false,
    })
    .returning();
  
  await db
    .update(gameEvents)
    .set({
      anchorId: anchorRecord.id,
      feeWei: FEE_WEI,
    })
    .where(eq(gameEvents.id, eventId));
  
  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet: event.wallet,
      actor: 'anchorService',
      action: 'anchor.direct',
      metaJson: {
        eventId: event.id,
        anchorId: anchorRecord.id,
        chain,
        rootHash: leafHash,
        feeWei: FEE_WEI,
      },
      requestId,
    })
    .returning();
  
  return {
    anchorRecord,
    ledgerEntry,
    proof,
    receipt,
  };
}

/**
 * Anchor multiple events as a batch via Merkle root (mode: "batch")
 * 
 * Creates:
 * - AnchorRecord with mode="batch", count=N, rootHash=merkleRoot
 * - AnchorLedger entry per event with FEE_WEI
 * - AnchorProof per event with merkle path
 * - Updates each GameEvent with anchorId and feeWei
 * - GameDeckReceipt for audit trail
 */
export async function anchorEventsBatch(
  eventIds: string[],
  chain: string = 'base'
): Promise<{
  anchorRecord: AnchorRecord;
  ledgerEntries: AnchorLedgerEntry[];
  proofs: AnchorProof[];
  receipt: GameDeckReceipt;
}> {
  if (eventIds.length === 0) {
    throw new Error('No events provided for batch anchoring');
  }
  
  const events = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.id, eventIds[0]));
  
  const eventMap = new Map<string, GameEvent>();
  for (const id of eventIds) {
    const [event] = await db
      .select()
      .from(gameEvents)
      .where(eq(gameEvents.id, id))
      .limit(1);
    
    if (!event) {
      throw new Error(`GameEvent not found: ${id}`);
    }
    
    if (event.anchorId) {
      throw new Error(`GameEvent already anchored: ${id}`);
    }
    
    eventMap.set(id, event);
  }
  
  const orderedEvents = eventIds.map(id => eventMap.get(id)!);
  const leafHashes = orderedEvents.map(computeEventLeafHash);
  const root = merkleRoot(leafHashes);
  const totalFee = (BigInt(FEE_WEI) * BigInt(eventIds.length)).toString();
  
  const wallet = orderedEvents[0].wallet;
  const requestId = generateRequestId();
  
  const [anchorRecord] = await db
    .insert(anchorRecords)
    .values({
      wallet,
      chain,
      mode: 'batch',
      count: eventIds.length,
      status: 'pending',
      rootHash: root,
      totalFeeWei: totalFee,
    })
    .returning();
  
  const ledgerEntries: AnchorLedgerEntry[] = [];
  const proofs: AnchorProof[] = [];
  
  for (let i = 0; i < orderedEvents.length; i++) {
    const event = orderedEvents[i];
    const leafHash = leafHashes[i];
    const path = merklePathFor(leafHashes, i);
    
    const [ledgerEntry] = await db
      .insert(anchorLedger)
      .values({
        wallet: event.wallet,
        gameId: event.gameId,
        eventId: event.id,
        feeWei: FEE_WEI,
        mode: 'batch',
        anchorId: anchorRecord.id,
      })
      .returning();
    
    ledgerEntries.push(ledgerEntry);
    
    const [proof] = await db
      .insert(anchorProofs)
      .values({
        anchorId: anchorRecord.id,
        eventId: event.id,
        leafHash,
        merklePath: path,
        leafIndex: i,
        verified: false,
      })
      .returning();
    
    proofs.push(proof);
    
    await db
      .update(gameEvents)
      .set({
        anchorId: anchorRecord.id,
        feeWei: FEE_WEI,
      })
      .where(eq(gameEvents.id, event.id));
  }
  
  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet,
      actor: 'anchorService',
      action: 'anchor.batch',
      metaJson: {
        eventIds,
        anchorId: anchorRecord.id,
        chain,
        rootHash: root,
        eventCount: eventIds.length,
        totalFeeWei: totalFee,
        feePerEvent: FEE_WEI,
      },
      requestId,
    })
    .returning();
  
  return {
    anchorRecord,
    ledgerEntries,
    proofs,
    receipt,
  };
}

/**
 * Verify a Merkle proof against the anchor's root hash
 */
export function verifyMerkleProof(
  leafHash: string,
  path: Array<{ hash: string; position: 'left' | 'right' }>,
  rootHash: string
): boolean {
  let current = leafHash;
  
  for (const node of path) {
    if (node.position === 'left') {
      current = sha256Hex(node.hash + current);
    } else {
      current = sha256Hex(current + node.hash);
    }
  }
  
  return current === rootHash;
}

/**
 * Get anchor status and proof for an event
 */
export async function getEventAnchorStatus(eventId: string): Promise<{
  anchored: boolean;
  anchorRecord?: AnchorRecord;
  proof?: AnchorProof;
  verified?: boolean;
} | null> {
  const [event] = await db
    .select()
    .from(gameEvents)
    .where(eq(gameEvents.id, eventId))
    .limit(1);
  
  if (!event) {
    return null;
  }
  
  if (!event.anchorId) {
    return { anchored: false };
  }
  
  const [anchorRecord] = await db
    .select()
    .from(anchorRecords)
    .where(eq(anchorRecords.id, event.anchorId))
    .limit(1);
  
  const [proof] = await db
    .select()
    .from(anchorProofs)
    .where(eq(anchorProofs.eventId, eventId))
    .limit(1);
  
  if (!anchorRecord || !proof) {
    return { anchored: false };
  }
  
  const verified = anchorRecord.rootHash
    ? verifyMerkleProof(
        proof.leafHash,
        proof.merklePath as Array<{ hash: string; position: 'left' | 'right' }>,
        anchorRecord.rootHash
      )
    : false;
  
  return {
    anchored: true,
    anchorRecord,
    proof,
    verified,
  };
}
