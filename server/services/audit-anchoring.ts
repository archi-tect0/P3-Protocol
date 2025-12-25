import { keccak256, toHex, toBytes } from 'viem';
import { ethers } from 'ethers';
import { db } from '../db';
import { auditLog, auditAnchorBatches } from '@shared/schema';
import { eq, and, gte, lt, isNull } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'audit-anchoring' });

interface MerkleTree {
  root: string;
  leaves: string[];
  layers: string[][];
}

interface MerkleProof {
  leaf: string;
  proof: string[];
  positions: ('left' | 'right')[];
  root: string;
}

interface AnchorBatchResult {
  batchId: string;
  rootHash: string;
  txHash: string | null;
  count: number;
  status: 'pending' | 'anchored' | 'failed';
}

const ANCHOR_REGISTRY_ABI = [
  "function anchorBundle(bytes32 merkleRoot, uint256 eventCount, string memory metadata) public returns (bytes32)",
  "event BundleAnchored(bytes32 indexed bundleId, bytes32 merkleRoot, uint256 eventCount, address indexed submitter, uint256 timestamp)"
];

function hashLogEntry(log: { id: string; entityType: string; entityId: string; action: string; actor: string; meta: unknown; createdAt: Date }): string {
  const data = JSON.stringify({
    id: log.id,
    entityType: log.entityType,
    entityId: log.entityId,
    action: log.action,
    actor: log.actor,
    meta: log.meta,
    createdAt: log.createdAt.toISOString()
  });
  return keccak256(toHex(toBytes(data)));
}

function hashPair(left: string, right: string): string {
  const leftBytes = toBytes(left as `0x${string}`);
  const rightBytes = toBytes(right as `0x${string}`);
  const combined = new Uint8Array(leftBytes.length + rightBytes.length);
  combined.set(leftBytes, 0);
  combined.set(rightBytes, leftBytes.length);
  return keccak256(toHex(combined));
}

function buildMerkleTree(leaves: string[]): MerkleTree {
  if (leaves.length === 0) {
    const emptyHash = keccak256(toHex(toBytes('')));
    return { root: emptyHash, leaves: [], layers: [[emptyHash]] };
  }

  const sortedLeaves = [...leaves].sort();
  const layers: string[][] = [sortedLeaves];
  let currentLayer = sortedLeaves;

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1];
        nextLayer.push(left < right ? hashPair(left, right) : hashPair(right, left));
      } else {
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves: sortedLeaves,
    layers
  };
}

function generateProof(tree: MerkleTree, leafHash: string): MerkleProof | null {
  const leafIndex = tree.leaves.indexOf(leafHash);
  if (leafIndex === -1) {
    return null;
  }

  const proof: string[] = [];
  const positions: ('left' | 'right')[] = [];
  let index = leafIndex;

  for (let i = 0; i < tree.layers.length - 1; i++) {
    const layer = tree.layers[i];
    const isRightNode = index % 2 === 1;
    const siblingIndex = isRightNode ? index - 1 : index + 1;

    if (siblingIndex < layer.length) {
      proof.push(layer[siblingIndex]);
      positions.push(isRightNode ? 'left' : 'right');
    }

    index = Math.floor(index / 2);
  }

  return {
    leaf: leafHash,
    proof,
    positions,
    root: tree.root
  };
}

function verifyProof(proof: MerkleProof): boolean {
  let hash = proof.leaf;

  for (let i = 0; i < proof.proof.length; i++) {
    const sibling = proof.proof[i];
    const position = proof.positions[i];

    if (position === 'left') {
      hash = sibling < hash ? hashPair(sibling, hash) : hashPair(hash, sibling);
    } else {
      hash = hash < sibling ? hashPair(hash, sibling) : hashPair(sibling, hash);
    }
  }

  return hash === proof.root;
}

const logHashCache = new Map<string, { hash: string; tree: MerkleTree; batchId: string }>();

export async function buildAndAnchorAuditBatch(options: {
  periodStart: Date;
  periodEnd: Date;
}): Promise<AnchorBatchResult> {
  const { periodStart, periodEnd } = options;

  logger.info('Building audit batch', {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString()
  });

  const logs = await db
    .select()
    .from(auditLog)
    .where(
      and(
        gte(auditLog.createdAt, periodStart),
        lt(auditLog.createdAt, periodEnd)
      )
    )
    .orderBy(auditLog.createdAt);

  if (logs.length === 0) {
    logger.info('No audit logs found for period');
    const emptyHash = keccak256(toHex(toBytes('')));
    
    const [batch] = await db
      .insert(auditAnchorBatches)
      .values({
        batchRootHash: emptyHash,
        count: 0,
        periodStart,
        periodEnd,
        status: 'anchored'
      })
      .returning();

    return {
      batchId: batch.id,
      rootHash: emptyHash,
      txHash: null,
      count: 0,
      status: 'anchored'
    };
  }

  const leaves = logs.map(log => hashLogEntry(log));
  const tree = buildMerkleTree(leaves);

  logger.info('Merkle tree built', {
    leafCount: leaves.length,
    root: tree.root
  });

  const [batch] = await db
    .insert(auditAnchorBatches)
    .values({
      batchRootHash: tree.root,
      count: logs.length,
      periodStart,
      periodEnd,
      status: 'pending'
    })
    .returning();

  logs.forEach((log, index) => {
    logHashCache.set(log.id, {
      hash: leaves[index],
      tree,
      batchId: batch.id
    });
  });

  let txHash: string | null = null;
  let status: 'pending' | 'anchored' | 'failed' = 'pending';

  const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const registryAddress = process.env.ANCHOR_REGISTRY_ADDRESS || '0xD0b8f9f6c9055574D835355B466C418b7558aCE0';

  if (rpcUrl && privateKey) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const registry = new ethers.Contract(registryAddress, ANCHOR_REGISTRY_ABI, wallet);

      const metadata = JSON.stringify({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        batchId: batch.id
      });

      const tx = await registry.anchorBundle(tree.root, logs.length, metadata);
      const receipt = await tx.wait();
      txHash = receipt.hash;
      status = 'anchored';

      logger.info('Audit batch anchored on-chain', {
        batchId: batch.id,
        txHash,
        root: tree.root
      });
    } catch (error) {
      logger.error('Failed to anchor audit batch on-chain', error as Error);
      status = 'failed';
    }
  } else {
    logger.warn('Blockchain not configured, skipping on-chain anchoring');
    status = 'pending';
  }

  await db
    .update(auditAnchorBatches)
    .set({
      anchoredTxHash: txHash,
      status
    })
    .where(eq(auditAnchorBatches.id, batch.id));

  return {
    batchId: batch.id,
    rootHash: tree.root,
    txHash,
    count: logs.length,
    status
  };
}

export async function proofForLog(logId: string): Promise<MerkleProof | null> {
  const cached = logHashCache.get(logId);
  if (cached) {
    return generateProof(cached.tree, cached.hash);
  }

  const [log] = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.id, logId));

  if (!log) {
    logger.warn('Audit log not found', { logId });
    return null;
  }

  const batches = await db
    .select()
    .from(auditAnchorBatches)
    .where(
      and(
        gte(auditAnchorBatches.periodEnd, log.createdAt),
        lt(auditAnchorBatches.periodStart, log.createdAt)
      )
    )
    .orderBy(auditAnchorBatches.createdAt);

  if (batches.length === 0) {
    const allBatches = await db
      .select()
      .from(auditAnchorBatches)
      .orderBy(auditAnchorBatches.createdAt);

    for (const batch of allBatches) {
      if (log.createdAt >= batch.periodStart && log.createdAt < batch.periodEnd) {
        const logs = await db
          .select()
          .from(auditLog)
          .where(
            and(
              gte(auditLog.createdAt, batch.periodStart),
              lt(auditLog.createdAt, batch.periodEnd)
            )
          )
          .orderBy(auditLog.createdAt);

        const leaves = logs.map(l => hashLogEntry(l));
        const tree = buildMerkleTree(leaves);
        const leafHash = hashLogEntry(log);

        logs.forEach((l, index) => {
          logHashCache.set(l.id, {
            hash: leaves[index],
            tree,
            batchId: batch.id
          });
        });

        return generateProof(tree, leafHash);
      }
    }
  }

  logger.warn('No matching batch found for audit log', { logId });
  return null;
}

export { MerkleTree, MerkleProof, verifyProof, buildMerkleTree, generateProof, hashLogEntry };
