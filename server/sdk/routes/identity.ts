import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { directoryEntries } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const router = Router();

const updateProfileSchema = z.object({
  displayName: z.string().max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const lookupSchema = z.object({
  address: z.string().optional(),
  ensName: z.string().optional(),
  basename: z.string().optional(),
});

router.get('/me', async (req: Request, res: Response) => {
  try {
    const wallet = req.sdkUser?.wallet;
    if (!wallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const [entry] = await db
      .select()
      .from(directoryEntries)
      .where(eq(sql`lower(${directoryEntries.walletAddress})`, wallet.toLowerCase()))
      .limit(1);

    if (!entry) {
      return res.json({
        wallet,
        exists: false,
        profile: null,
      });
    }

    res.json({
      wallet,
      exists: true,
      profile: {
        walletAddress: entry.walletAddress,
        ensName: entry.ensName,
        basename: entry.basename,
        avatarUrl: entry.avatarUrl,
        bio: entry.bio,
        isVerified: entry.isVerified === 1,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
      },
    });
  } catch (error) {
    console.error('[SDK:identity] Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.patch('/me', async (req: Request, res: Response) => {
  try {
    const wallet = req.sdkUser?.wallet;
    if (!wallet) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = updateProfileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { displayName, bio, avatarUrl, metadata } = result.data;
    const normalizedAddr = wallet.toLowerCase();

    const [existing] = await db
      .select()
      .from(directoryEntries)
      .where(eq(sql`lower(${directoryEntries.walletAddress})`, normalizedAddr))
      .limit(1);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (bio !== undefined) updates.bio = bio;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (metadata !== undefined) {
      updates.metadata = existing?.metadata 
        ? { ...(existing.metadata as Record<string, unknown>), ...metadata, displayName }
        : { ...metadata, displayName };
    } else if (displayName) {
      updates.metadata = existing?.metadata 
        ? { ...(existing.metadata as Record<string, unknown>), displayName }
        : { displayName };
    }

    if (existing) {
      const [updated] = await db
        .update(directoryEntries)
        .set(updates)
        .where(eq(directoryEntries.id, existing.id))
        .returning();

      res.json({ profile: updated });
    } else {
      const [created] = await db
        .insert(directoryEntries)
        .values({
          walletAddress: wallet,
          bio,
          avatarUrl,
          metadata: metadata ? { ...metadata, displayName } : displayName ? { displayName } : null,
          lastResolvedAt: new Date(),
        })
        .returning();

      res.json({ profile: created });
    }
  } catch (error) {
    console.error('[SDK:identity] Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.post('/lookup', async (req: Request, res: Response) => {
  try {
    const result = lookupSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
    }

    const { address, ensName, basename } = result.data;

    if (!address && !ensName && !basename) {
      return res.status(400).json({ error: 'Provide address, ensName, or basename' });
    }

    let entry = null;

    if (address) {
      [entry] = await db
        .select()
        .from(directoryEntries)
        .where(eq(sql`lower(${directoryEntries.walletAddress})`, address.toLowerCase()))
        .limit(1);
    } else if (ensName) {
      [entry] = await db
        .select()
        .from(directoryEntries)
        .where(eq(sql`lower(${directoryEntries.ensName})`, ensName.toLowerCase()))
        .limit(1);
    } else if (basename) {
      [entry] = await db
        .select()
        .from(directoryEntries)
        .where(eq(sql`lower(${directoryEntries.basename})`, basename.toLowerCase()))
        .limit(1);
    }

    if (!entry) {
      return res.json({ found: false, profile: null });
    }

    res.json({
      found: true,
      profile: {
        walletAddress: entry.walletAddress,
        ensName: entry.ensName,
        basename: entry.basename,
        avatarUrl: entry.avatarUrl,
        bio: entry.bio,
        isVerified: entry.isVerified === 1,
      },
    });
  } catch (error) {
    console.error('[SDK:identity] Error looking up profile:', error);
    res.status(500).json({ error: 'Failed to lookup profile' });
  }
});

router.get('/resolve/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    const isAddress = identifier.startsWith('0x') && identifier.length === 42;
    const isENS = identifier.endsWith('.eth');
    const isBasename = identifier.endsWith('.base') || identifier.endsWith('.base.eth');

    let entry = null;

    if (isAddress) {
      [entry] = await db
        .select()
        .from(directoryEntries)
        .where(eq(sql`lower(${directoryEntries.walletAddress})`, identifier.toLowerCase()))
        .limit(1);
    } else if (isBasename) {
      [entry] = await db
        .select()
        .from(directoryEntries)
        .where(eq(sql`lower(${directoryEntries.basename})`, identifier.toLowerCase()))
        .limit(1);
    } else if (isENS) {
      [entry] = await db
        .select()
        .from(directoryEntries)
        .where(eq(sql`lower(${directoryEntries.ensName})`, identifier.toLowerCase()))
        .limit(1);
    }

    if (!entry) {
      return res.json({ resolved: false, address: null });
    }

    res.json({
      resolved: true,
      address: entry.walletAddress,
      ensName: entry.ensName,
      basename: entry.basename,
      avatarUrl: entry.avatarUrl,
    });
  } catch (error) {
    console.error('[SDK:identity] Error resolving identifier:', error);
    res.status(500).json({ error: 'Failed to resolve identifier' });
  }
});

export default router;
