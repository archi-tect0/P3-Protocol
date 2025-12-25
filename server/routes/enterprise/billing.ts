import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { db } from '../../db';
import { 
  subscriptionTiers, 
  billingAccounts,
  apiKeys,
  insertSubscriptionTierSchema,
  insertBillingAccountSchema
} from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

const router = Router();

const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();
const GUARDIAN_WALLET = process.env.GUARDIAN_WALLET?.toLowerCase();

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
    })
  : null;

interface BillingRequest extends Request {
  walletAddr?: string;
  isSuperuser?: boolean;
  isGuardian?: boolean;
}

async function requireAdminOrGuardian(
  req: BillingRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const addr = req.headers['x-p3-addr'] as string | undefined;

  if (!addr) {
    res.status(403).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  const normalizedAddr = addr.toLowerCase();
  const isSuperuser = ADMIN_WALLET ? normalizedAddr === ADMIN_WALLET : false;
  const isGuardian = GUARDIAN_WALLET ? normalizedAddr === GUARDIAN_WALLET : false;

  if (!isSuperuser && !isGuardian) {
    res.status(403).json({ 
      error: 'Access denied: Requires admin or guardian privileges',
    });
    return;
  }

  req.walletAddr = normalizedAddr;
  req.isSuperuser = isSuperuser;
  req.isGuardian = isGuardian;
  next();
}

const assignTierSchema = z.object({
  tenantId: z.string().min(1).max(64),
  tierId: z.string().uuid(),
});

router.post('/assign-tier', requireAdminOrGuardian, async (req: BillingRequest, res: Response) => {
  const result = assignTierSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { tenantId, tierId } = result.data;

  try {
    const [tier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.id, tierId))
      .limit(1);

    if (!tier) {
      return res.status(404).json({ error: 'Subscription tier not found' });
    }

    const [updatedCount] = await db
      .update(apiKeys)
      .set({ 
        tierId: parseInt(tierId, 10) || null,
        quotaMonthly: tier.quotaMonthly,
      })
      .where(eq(apiKeys.tenantId, tenantId))
      .returning({ id: apiKeys.id });

    if (!updatedCount) {
      return res.status(404).json({ error: 'No API keys found for tenant' });
    }

    const updatedKeys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId));

    res.json({
      ok: true,
      tenantId,
      tierId,
      tierName: tier.name,
      quotaMonthly: tier.quotaMonthly,
      keysUpdated: updatedKeys.length,
    });
  } catch (error) {
    console.error('[ENTERPRISE BILLING] Error assigning tier:', error);
    res.status(500).json({ error: 'Failed to assign tier' });
  }
});

router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const tiers = await db
      .select()
      .from(subscriptionTiers)
      .orderBy(subscriptionTiers.monthlyPrice);

    res.json({
      tiers,
      count: tiers.length,
    });
  } catch (error) {
    console.error('[ENTERPRISE BILLING] Error listing tiers:', error);
    res.status(500).json({ error: 'Failed to list subscription tiers' });
  }
});

const createTierSchema = z.object({
  name: z.string().min(1).max(64),
  monthlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/),
  featuresJson: z.record(z.unknown()).optional(),
  quotaMonthly: z.number().int().positive(),
  overagePricePerUnit: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
});

router.post('/tiers', requireAdminOrGuardian, async (req: BillingRequest, res: Response) => {
  const result = createTierSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { name, monthlyPrice, featuresJson, quotaMonthly, overagePricePerUnit } = result.data;

  try {
    const [existingTier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.name, name))
      .limit(1);

    if (existingTier) {
      return res.status(409).json({ error: 'Tier with this name already exists' });
    }

    const [newTier] = await db
      .insert(subscriptionTiers)
      .values({
        name,
        monthlyPrice,
        featuresJson: featuresJson || null,
        quotaMonthly,
        overagePricePerUnit: overagePricePerUnit || null,
      })
      .returning();

    res.status(201).json({
      ok: true,
      tier: newTier,
    });
  } catch (error) {
    console.error('[ENTERPRISE BILLING] Error creating tier:', error);
    res.status(500).json({ error: 'Failed to create subscription tier' });
  }
});

router.get('/accounts/:tenantId', requireAdminOrGuardian, async (req: BillingRequest, res: Response) => {
  const { tenantId } = req.params;

  if (!tenantId || tenantId.length > 64) {
    return res.status(400).json({ error: 'Invalid tenant ID' });
  }

  try {
    const [account] = await db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.tenantId, tenantId))
      .limit(1);

    if (!account) {
      return res.status(404).json({ error: 'Billing account not found for tenant' });
    }

    let stripeCustomer = null;
    if (account.stripeCustomerId && stripe) {
      try {
        stripeCustomer = await stripe.customers.retrieve(account.stripeCustomerId);
      } catch (stripeErr: any) {
        console.warn('[ENTERPRISE BILLING] Stripe customer fetch error:', stripeErr.message);
      }
    }

    res.json({
      account: {
        id: account.id,
        tenantId: account.tenantId,
        stripeCustomerId: account.stripeCustomerId,
        activePaymentMethod: account.activePaymentMethod,
        delinquent: account.delinquent,
        createdAt: account.createdAt,
      },
      stripeCustomer: stripeCustomer && !('deleted' in stripeCustomer) ? {
        id: stripeCustomer.id,
        email: stripeCustomer.email,
        name: stripeCustomer.name,
        balance: stripeCustomer.balance,
        delinquent: stripeCustomer.delinquent,
      } : null,
    });
  } catch (error) {
    console.error('[ENTERPRISE BILLING] Error fetching billing account:', error);
    res.status(500).json({ error: 'Failed to fetch billing account' });
  }
});

const createAccountSchema = z.object({
  tenantId: z.string().min(1).max(64),
  stripeCustomerId: z.string().min(1).max(64).optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

router.post('/accounts', requireAdminOrGuardian, async (req: BillingRequest, res: Response) => {
  const result = createAccountSchema.safeParse(req.body);
  
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { tenantId, stripeCustomerId, email, name } = result.data;

  try {
    const [existingAccount] = await db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.tenantId, tenantId))
      .limit(1);

    if (existingAccount) {
      return res.status(409).json({ 
        error: 'Billing account already exists for tenant',
        accountId: existingAccount.id,
      });
    }

    let customerId = stripeCustomerId;
    
    if (!customerId && (email || name) && stripe) {
      try {
        const customer = await stripe.customers.create({
          email,
          name,
          metadata: {
            tenantId,
            source: 'p3-enterprise',
          },
        });
        customerId = customer.id;
      } catch (stripeErr: any) {
        console.error('[ENTERPRISE BILLING] Stripe customer creation error:', stripeErr.message);
        return res.status(500).json({ error: 'Failed to create Stripe customer' });
      }
    }

    const [newAccount] = await db
      .insert(billingAccounts)
      .values({
        tenantId,
        stripeCustomerId: customerId || null,
        activePaymentMethod: null,
        delinquent: false,
      })
      .returning();

    res.status(201).json({
      ok: true,
      account: newAccount,
      stripeCustomerId: customerId,
    });
  } catch (error) {
    console.error('[ENTERPRISE BILLING] Error creating billing account:', error);
    res.status(500).json({ error: 'Failed to create billing account' });
  }
});

export default router;
