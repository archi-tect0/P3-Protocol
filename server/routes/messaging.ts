import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { encryptedMessages, insertEncryptedMessageSchema } from '@shared/schema';
import { eq, or, desc } from 'drizzle-orm';

const router = Router();

interface MessagingRequest extends Request {
  walletAddr?: string;
}

function requireWalletAuth(
  req: MessagingRequest,
  res: Response,
  next: () => void
): void {
  const addr = req.headers['x-p3-addr'] as string | undefined;

  if (!addr) {
    res.status(403).json({ error: 'Missing X-P3-Addr header' });
    return;
  }

  req.walletAddr = addr.toLowerCase();
  next();
}

const sendMessageSchema = z.object({
  toWalletId: z.string().min(1).max(128),
  ciphertext: z.record(z.unknown()),
  expiresAt: z.string().datetime().optional(),
});

router.post('/send', requireWalletAuth, async (req: MessagingRequest, res: Response) => {
  const result = sendMessageSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.errors });
  }

  const { toWalletId, ciphertext, expiresAt } = result.data;

  try {
    const [message] = await db
      .insert(encryptedMessages)
      .values({
        fromWalletId: req.walletAddr!,
        toWalletId: toWalletId.toLowerCase(),
        ciphertext,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    console.log(`[MESSAGING] Message sent from ${req.walletAddr} to ${toWalletId}`);

    res.status(201).json({
      ok: true,
      messageId: message.id,
      createdAt: message.createdAt,
      message: 'Encrypted message sent successfully',
    });
  } catch (error) {
    console.error('[MESSAGING] Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.get('/inbox', requireWalletAuth, async (req: MessagingRequest, res: Response) => {
  try {
    const messages = await db
      .select()
      .from(encryptedMessages)
      .where(eq(encryptedMessages.toWalletId, req.walletAddr!))
      .orderBy(desc(encryptedMessages.createdAt))
      .limit(100);

    const now = new Date();
    const validMessages = messages.filter(
      (msg) => !msg.expiresAt || new Date(msg.expiresAt) > now
    );

    res.json({
      ok: true,
      count: validMessages.length,
      messages: validMessages.map((msg) => ({
        id: msg.id,
        fromWalletId: msg.fromWalletId,
        ciphertext: msg.ciphertext,
        createdAt: msg.createdAt,
        expiresAt: msg.expiresAt,
      })),
    });
  } catch (error) {
    console.error('[MESSAGING] Error fetching inbox:', error);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

export default router;
