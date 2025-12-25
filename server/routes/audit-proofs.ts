import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { auditProofs, insertAuditProofSchema } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

interface EnterpriseRequest extends Request {
  walletAddr?: string;
  isSuperuser?: boolean;
}

function getWalletAddr(req: Request): string | undefined {
  return (req.headers['x-p3-addr'] as string)?.toLowerCase();
}

function computeProofHash(datasetId: string, selector: string, proof: any): string {
  const data = JSON.stringify({ datasetId, selector, proof });
  return crypto.createHash('sha256').update(data).digest('hex');
}

function generateMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return '';
  if (leaves.length === 1) return leaves[0];

  const hashedLeaves = leaves.map(leaf => 
    crypto.createHash('sha256').update(leaf).digest('hex')
  );

  let currentLevel = hashedLeaves;
  while (currentLevel.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left;
      const combined = crypto
        .createHash('sha256')
        .update(left + right)
        .digest('hex');
      nextLevel.push(combined);
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

const createProofSchema = z.object({
  datasetId: z.string().min(1).max(64),
  selector: z.string().min(1).max(128),
  data: z.record(z.any()),
  encryptionKey: z.string().optional(),
});

router.post('/proof/create', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const walletAddr = getWalletAddr(req);
  
  if (!walletAddr) {
    res.status(401).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const result = createProofSchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    return;
  }

  const { datasetId, selector, data, encryptionKey } = result.data;

  try {
    const dataLeaves = Object.entries(data).map(([key, value]) => 
      `${key}:${JSON.stringify(value)}`
    );
    const merkleRoot = generateMerkleRoot(dataLeaves);

    const proofData = {
      merkleRoot,
      dataHash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
      creator: walletAddr,
      createdAt: new Date().toISOString(),
      leafCount: dataLeaves.length,
    };

    let encryptedProof = proofData;
    if (encryptionKey) {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      
      let encrypted = cipher.update(JSON.stringify(proofData), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      encryptedProof = {
        encrypted: true,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        ciphertext: encrypted,
      } as any;
    }

    const [proof] = await db
      .insert(auditProofs)
      .values({
        datasetId,
        selector,
        proof: encryptedProof,
      })
      .returning();

    const proofHash = computeProofHash(datasetId, selector, encryptedProof);

    res.status(201).json({
      ok: true,
      proof: {
        id: proof.id,
        datasetId: proof.datasetId,
        selector: proof.selector,
        proofHash,
        merkleRoot: encryptionKey ? '[encrypted]' : merkleRoot,
        createdAt: proof.createdAt,
      },
    });
  } catch (error) {
    console.error('[AUDIT-PROOFS] Error creating proof:', error);
    res.status(500).json({ error: 'Failed to create proof' });
  }
});

const verifyProofSchema = z.object({
  proofId: z.number().int().positive().optional(),
  datasetId: z.string().min(1).max(64).optional(),
  selector: z.string().min(1).max(128).optional(),
  data: z.record(z.any()).optional(),
  encryptionKey: z.string().optional(),
});

router.post('/proof/verify', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const result = verifyProofSchema.safeParse(req.body);
  
  if (!result.success) {
    res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    return;
  }

  const { proofId, datasetId, selector, data, encryptionKey } = result.data;

  if (!proofId && (!datasetId || !selector)) {
    res.status(400).json({ 
      error: 'Either proofId or both datasetId and selector are required' 
    });
    return;
  }

  try {
    let proof;
    
    if (proofId) {
      [proof] = await db
        .select()
        .from(auditProofs)
        .where(eq(auditProofs.id, proofId))
        .limit(1);
    } else {
      [proof] = await db
        .select()
        .from(auditProofs)
        .where(and(
          eq(auditProofs.datasetId, datasetId!),
          eq(auditProofs.selector, selector!)
        ))
        .orderBy(desc(auditProofs.createdAt))
        .limit(1);
    }

    if (!proof) {
      res.status(404).json({ 
        error: 'Proof not found',
        verified: false,
      });
      return;
    }

    let proofData = proof.proof as any;
    let decrypted = false;

    if (proofData.encrypted && encryptionKey) {
      try {
        const key = crypto.scryptSync(encryptionKey, 'salt', 32);
        const decipher = crypto.createDecipheriv(
          'aes-256-gcm', 
          key, 
          Buffer.from(proofData.iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(proofData.authTag, 'hex'));
        
        let decryptedText = decipher.update(proofData.ciphertext, 'hex', 'utf8');
        decryptedText += decipher.final('utf8');
        proofData = JSON.parse(decryptedText);
        decrypted = true;
      } catch (err) {
        res.status(400).json({ 
          error: 'Failed to decrypt proof - invalid encryption key',
          verified: false,
        });
        return;
      }
    }

    let dataVerified = false;
    if (data && proofData.dataHash) {
      const providedDataHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex');
      dataVerified = providedDataHash === proofData.dataHash;
    }

    const proofHash = computeProofHash(
      proof.datasetId, 
      proof.selector, 
      proof.proof
    );

    res.json({
      ok: true,
      verified: true,
      proof: {
        id: proof.id,
        datasetId: proof.datasetId,
        selector: proof.selector,
        proofHash,
        merkleRoot: proofData.merkleRoot || '[encrypted]',
        creator: proofData.creator,
        createdAt: proof.createdAt,
        proofCreatedAt: proofData.createdAt,
      },
      dataVerified: data ? dataVerified : undefined,
      decrypted,
    });
  } catch (error) {
    console.error('[AUDIT-PROOFS] Error verifying proof:', error);
    res.status(500).json({ error: 'Failed to verify proof' });
  }
});

router.get('/proofs/:datasetId', async (req: EnterpriseRequest, res: Response): Promise<void> => {
  const { datasetId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;

  try {
    const proofs = await db
      .select({
        id: auditProofs.id,
        datasetId: auditProofs.datasetId,
        selector: auditProofs.selector,
        createdAt: auditProofs.createdAt,
      })
      .from(auditProofs)
      .where(eq(auditProofs.datasetId, datasetId))
      .orderBy(desc(auditProofs.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      ok: true,
      datasetId,
      proofs,
      pagination: {
        limit,
        offset,
        count: proofs.length,
      },
    });
  } catch (error) {
    console.error('[AUDIT-PROOFS] Error fetching proofs:', error);
    res.status(500).json({ error: 'Failed to fetch proofs' });
  }
});

export default router;
