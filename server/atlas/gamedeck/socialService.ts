/**
 * SocialService - Game invites and social discovery
 * 
 * Provides invite management for multiplayer sessions:
 * - Send invites between wallets
 * - Accept/decline invites with audit trail
 * - Query pending invites (sent and received)
 * - Get active sessions from accepted invites
 */

import { db } from '../../db';
import {
  gameInvites,
  gameDeckReceipts,
  type GameInvite,
  type GameDeckReceipt,
} from '@shared/schema';
import { eq, and, or, gt } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/**
 * Generate unique request ID for audit trail
 */
function generateRequestId(): string {
  return `social:${Date.now()}:${uuid().slice(0, 8)}`;
}

/**
 * Send a game invite from one wallet to another
 * 
 * Creates:
 * - GameInvite record with status="pending"
 * - GameDeckReceipt for audit trail with action="invite.send"
 * - Sets expiresAt to 24 hours from now
 */
export async function sendInvite(
  fromWallet: string,
  toWallet: string,
  gameId?: string,
  sessionId?: string
): Promise<{
  invite: GameInvite;
  receipt: GameDeckReceipt;
}> {
  if (!fromWallet || !toWallet) {
    throw new Error('Both fromWallet and toWallet are required');
  }

  if (fromWallet === toWallet) {
    throw new Error('Cannot send invite to yourself');
  }

  const requestId = generateRequestId();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [invite] = await db
    .insert(gameInvites)
    .values({
      fromWallet,
      toWallet,
      gameId: gameId || null,
      sessionId: sessionId || null,
      status: 'pending',
      expiresAt,
    })
    .returning();

  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet: fromWallet,
      actor: 'socialService',
      action: 'invite.send',
      metaJson: {
        inviteId: invite.id,
        fromWallet,
        toWallet,
        gameId: gameId || null,
        sessionId: sessionId || null,
        expiresAt: expiresAt.toISOString(),
      },
      requestId,
    })
    .returning();

  return { invite, receipt };
}

/**
 * Respond to a game invite (accept or decline)
 * 
 * Validates:
 * - Invite exists and is pending
 * - Caller wallet matches toWallet
 * - Invite has not expired
 * 
 * Creates:
 * - Updates invite status to "accepted" or "declined"
 * - GameDeckReceipt for audit trail with action="invite.accept" or "invite.decline"
 */
export async function respondInvite(
  inviteId: string,
  wallet: string,
  response: 'accept' | 'decline'
): Promise<{
  invite: GameInvite;
  receipt: GameDeckReceipt;
}> {
  if (!inviteId || !wallet) {
    throw new Error('inviteId and wallet are required');
  }

  if (response !== 'accept' && response !== 'decline') {
    throw new Error('Response must be "accept" or "decline"');
  }

  const [existingInvite] = await db
    .select()
    .from(gameInvites)
    .where(eq(gameInvites.id, inviteId))
    .limit(1);

  if (!existingInvite) {
    throw new Error(`Invite not found: ${inviteId}`);
  }

  if (existingInvite.toWallet !== wallet) {
    throw new Error('Only the recipient can respond to this invite');
  }

  if (existingInvite.status !== 'pending') {
    throw new Error(`Invite already ${existingInvite.status}`);
  }

  if (existingInvite.expiresAt && new Date() > existingInvite.expiresAt) {
    throw new Error('Invite has expired');
  }

  const newStatus = response === 'accept' ? 'accepted' : 'declined';
  const requestId = generateRequestId();

  const [updatedInvite] = await db
    .update(gameInvites)
    .set({ status: newStatus })
    .where(eq(gameInvites.id, inviteId))
    .returning();

  const [receipt] = await db
    .insert(gameDeckReceipts)
    .values({
      wallet,
      actor: 'socialService',
      action: `invite.${response}`,
      metaJson: {
        inviteId,
        fromWallet: existingInvite.fromWallet,
        toWallet: wallet,
        gameId: existingInvite.gameId,
        sessionId: existingInvite.sessionId,
        response,
        previousStatus: existingInvite.status,
        newStatus,
      },
      requestId,
    })
    .returning();

  return { invite: updatedInvite, receipt };
}

/**
 * Get all pending invites for a wallet
 * 
 * Returns both:
 * - Invites sent by this wallet (as sender)
 * - Invites received by this wallet (as recipient)
 * 
 * Filters:
 * - Only pending status
 * - Only non-expired invites
 */
export async function getInvites(wallet: string): Promise<{
  sent: GameInvite[];
  received: GameInvite[];
}> {
  if (!wallet) {
    throw new Error('Wallet address is required');
  }

  const now = new Date();

  const allInvites = await db
    .select()
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.status, 'pending'),
        or(
          eq(gameInvites.fromWallet, wallet),
          eq(gameInvites.toWallet, wallet)
        ),
        or(
          gt(gameInvites.expiresAt, now),
          eq(gameInvites.expiresAt, null as any)
        )
      )
    );

  const sent = allInvites.filter(inv => inv.fromWallet === wallet);
  const received = allInvites.filter(inv => inv.toWallet === wallet);

  return { sent, received };
}

/**
 * Get active session for a wallet in a specific game
 * 
 * Looks for accepted invites where:
 * - Wallet is either sender or recipient
 * - GameId matches (if provided)
 * - Invite has been accepted
 * 
 * Returns the most recently created accepted invite with session info
 */
export async function getActiveSession(
  wallet: string,
  gameId: string
): Promise<GameInvite | null> {
  if (!wallet || !gameId) {
    throw new Error('wallet and gameId are required');
  }

  const [activeInvite] = await db
    .select()
    .from(gameInvites)
    .where(
      and(
        eq(gameInvites.gameId, gameId),
        eq(gameInvites.status, 'accepted'),
        or(
          eq(gameInvites.fromWallet, wallet),
          eq(gameInvites.toWallet, wallet)
        )
      )
    )
    .orderBy(gameInvites.createdAt)
    .limit(1);

  return activeInvite || null;
}
