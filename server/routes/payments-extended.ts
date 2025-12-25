import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from '../db';
import { microPayments, escrows } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { apiKeyAuth } from '../middleware/api-key-auth';
import { trackUsage } from '../services/usage-tracker';
import { protocolSettlement } from '../protocol/settlement';

const router = Router();

const GUARDIAN_WALLET = process.env.GUARDIAN_WALLET?.toLowerCase();
const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

interface PaymentRequest extends Request {
  walletAddr?: string;
  isGuardian?: boolean;
}

function extractWallet(req: PaymentRequest, res: Response, next: NextFunction): void {
  const addr = req.headers['x-p3-addr'] as string | undefined;
  if (addr) {
    req.walletAddr = addr.toLowerCase();
    req.isGuardian = GUARDIAN_WALLET ? req.walletAddr === GUARDIAN_WALLET : false;
  }
  next();
}

function requireGuardian(req: PaymentRequest, res: Response, next: NextFunction): void {
  if (!req.walletAddr) {
    res.status(403).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const isGuardian = GUARDIAN_WALLET ? req.walletAddr === GUARDIAN_WALLET : false;
  const isAdmin = ADMIN_WALLET ? req.walletAddr === ADMIN_WALLET : false;

  if (!isGuardian && !isAdmin) {
    res.status(403).json({ 
      error: 'Access denied: Requires guardian or admin privileges',
    });
    return;
  }

  req.isGuardian = isGuardian;
  next();
}

const microPaymentSchema = z.object({
  fromWalletId: z.string().min(1).max(128),
  toWalletId: z.string().min(1).max(128),
  amountWei: z.string().min(1).max(64),
  memo: z.string().max(256).optional(),
  settleMode: z.enum(['BASE_USDC', 'BASE_DIRECT', 'RELAY_LZ', 'RELAY_WH']).optional(),
  originChain: z.string().optional(),
});

router.post(
  '/micro',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: PaymentRequest, res: Response) => {
    const result = microPaymentSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { fromWalletId, toWalletId, amountWei, memo, settleMode, originChain } = result.data;

    try {
      const actionId = `micro:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
      
      const settlementResult = await protocolSettlement.settleAction({
        actionId,
        actionType: 'marketplace',
        walletAddress: fromWalletId,
        recipientWallet: toWalletId,
        settleMode: settleMode || 'BASE_USDC',
        originChain: originChain || 'base',
        metadata: { memo, amountWei },
      });

      if (!settlementResult.success) {
        return res.status(400).json({
          error: 'Settlement failed',
          details: settlementResult.error,
          settlementId: settlementResult.settlementId,
        });
      }

      const txHash = settlementResult.txHashBase || `sim:micro:${Date.now()}`;

      const [payment] = await db
        .insert(microPayments)
        .values({
          fromWalletId,
          toWalletId,
          amountWei,
          txHash,
          memo: memo || null,
        })
        .returning();

      console.log(`[PAYMENTS] Micro-payment processed: ${payment.id} - ${fromWalletId} -> ${toWalletId} (${amountWei} wei)`);

      res.status(201).json({
        ok: true,
        paymentId: payment.id,
        fromWalletId: payment.fromWalletId,
        toWalletId: payment.toWalletId,
        amountWei: payment.amountWei,
        txHash: payment.txHash,
        memo: payment.memo,
        createdAt: payment.createdAt,
        settlement: {
          settlementId: settlementResult.settlementId,
          relayStatus: settlementResult.relayStatus,
          anchorDigest: settlementResult.anchorDigest,
        },
      });
    } catch (error) {
      console.error('[PAYMENTS] Error processing micro-payment:', error);
      res.status(500).json({ error: 'Failed to process micro-payment' });
    }
  }
);

const escrowCreateSchema = z.object({
  buyer: z.string().min(1).max(128),
  seller: z.string().min(1).max(128),
  amountWei: z.string().min(1).max(64),
  terms: z.string().min(1).max(512),
});

router.post(
  '/escrow/create',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  async (req: PaymentRequest, res: Response) => {
    const result = escrowCreateSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { buyer, seller, amountWei, terms } = result.data;

    try {
      const [escrow] = await db
        .insert(escrows)
        .values({
          buyer,
          seller,
          amountWei,
          terms,
          state: 'locked',
          recipient: null,
        })
        .returning();

      console.log(`[ESCROW] Created escrow ${escrow.id}: ${buyer} <-> ${seller} (${amountWei} wei)`);

      res.status(201).json({
        ok: true,
        escrowId: escrow.id,
        buyer: escrow.buyer,
        seller: escrow.seller,
        amountWei: escrow.amountWei,
        terms: escrow.terms,
        state: escrow.state,
        createdAt: escrow.createdAt,
        message: 'Escrow created successfully. Funds are now locked.',
      });
    } catch (error) {
      console.error('[ESCROW] Error creating escrow:', error);
      res.status(500).json({ error: 'Failed to create escrow' });
    }
  }
);

const escrowReleaseSchema = z.object({
  escrowId: z.number().int().positive(),
  recipient: z.enum(['buyer', 'seller']),
  reason: z.string().max(256).optional(),
});

router.post(
  '/escrow/release',
  apiKeyAuth(true),
  trackUsage,
  extractWallet,
  requireGuardian,
  async (req: PaymentRequest, res: Response) => {
    const result = escrowReleaseSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { escrowId, recipient, reason } = result.data;

    try {
      const [existing] = await db
        .select()
        .from(escrows)
        .where(eq(escrows.id, escrowId))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: 'Escrow not found' });
      }

      if (existing.state !== 'locked') {
        return res.status(400).json({ 
          error: 'Escrow is not in locked state',
          currentState: existing.state,
        });
      }

      const recipientWallet = recipient === 'buyer' ? existing.buyer : existing.seller;

      const [updatedEscrow] = await db
        .update(escrows)
        .set({
          state: 'released',
          recipient,
        })
        .where(eq(escrows.id, escrowId))
        .returning();

      console.log(`[ESCROW] Guardian ${req.walletAddr} released escrow ${escrowId} to ${recipient} (${recipientWallet})`);

      res.json({
        ok: true,
        escrowId: updatedEscrow.id,
        state: updatedEscrow.state,
        recipient: updatedEscrow.recipient,
        recipientWallet,
        amountWei: updatedEscrow.amountWei,
        releasedBy: req.walletAddr,
        reason: reason || 'Guardian release',
        message: `Escrow funds released to ${recipient}`,
      });
    } catch (error) {
      console.error('[ESCROW] Error releasing escrow:', error);
      res.status(500).json({ error: 'Failed to release escrow' });
    }
  }
);

router.get(
  '/escrow/:id',
  apiKeyAuth(true),
  trackUsage,
  async (req: Request, res: Response) => {
    const escrowId = parseInt(req.params.id, 10);

    if (isNaN(escrowId)) {
      return res.status(400).json({ error: 'Invalid escrow ID' });
    }

    try {
      const [escrow] = await db
        .select()
        .from(escrows)
        .where(eq(escrows.id, escrowId))
        .limit(1);

      if (!escrow) {
        return res.status(404).json({ error: 'Escrow not found' });
      }

      res.json({
        escrowId: escrow.id,
        buyer: escrow.buyer,
        seller: escrow.seller,
        amountWei: escrow.amountWei,
        terms: escrow.terms,
        state: escrow.state,
        recipient: escrow.recipient,
        createdAt: escrow.createdAt,
      });
    } catch (error) {
      console.error('[ESCROW] Error fetching escrow:', error);
      res.status(500).json({ error: 'Failed to fetch escrow' });
    }
  }
);

router.get(
  '/micro/history/:walletId',
  apiKeyAuth(true),
  trackUsage,
  async (req: Request, res: Response) => {
    const { walletId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    try {
      const payments = await db
        .select()
        .from(microPayments)
        .where(eq(microPayments.fromWalletId, walletId))
        .orderBy(desc(microPayments.createdAt))
        .limit(limit)
        .offset(offset);

      const received = await db
        .select()
        .from(microPayments)
        .where(eq(microPayments.toWalletId, walletId))
        .orderBy(desc(microPayments.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        walletId,
        sent: payments,
        received,
        pagination: { limit, offset },
      });
    } catch (error) {
      console.error('[PAYMENTS] Error fetching payment history:', error);
      res.status(500).json({ error: 'Failed to fetch payment history' });
    }
  }
);

export default router;
