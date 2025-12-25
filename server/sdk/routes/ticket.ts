import { Router, Request, Response, NextFunction } from 'express';
import { ticketService } from '../../services/ticket';
import { processTicketEvent } from '../../anchor/handlers/ticket';
import { optionalAuth } from '../middleware/auth';

const router = Router();

const requireAuthenticatedWallet = (req: Request, res: Response, next: NextFunction) => {
  if (!req.sdkUser?.wallet) {
    return res.status(401).json({ 
      error: 'unauthorized', 
      message: 'Valid wallet session required for this operation' 
    });
  }
  next();
};

const verifyWalletOwnership = (req: Request, res: Response, next: NextFunction) => {
  const { wallet } = req.body;
  const authenticatedWallet = req.sdkUser?.wallet;
  
  if (wallet && authenticatedWallet && wallet.toLowerCase() !== authenticatedWallet.toLowerCase()) {
    return res.status(403).json({ 
      error: 'forbidden', 
      message: 'Cannot perform operations on behalf of another wallet' 
    });
  }
  next();
};

router.post('/grant', optionalAuth, requireAuthenticatedWallet, verifyWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { appId, scopes = [], gateType, txHash, feeAmount, devWallet } = req.body;
    const wallet = req.sdkUser!.wallet;

    if (!appId) {
      return res.status(400).json({ 
        error: 'missing_params', 
        message: 'appId is required' 
      });
    }

    if (!gateType) {
      return res.status(400).json({ 
        error: 'missing_gate_type', 
        message: 'gateType is required (nft, payment, role, free)' 
      });
    }

    if (gateType === 'payment' && !txHash) {
      return res.status(400).json({ 
        error: 'missing_tx_proof', 
        message: 'Payment gate requires txHash proof' 
      });
    }

    await processTicketEvent({
      appId: 'ticketGate',
      event: 'access_granted',
      data: { wallet, appId, scopes, gateType, txHash, feeAmount, devWallet },
      ts: Date.now(),
    });

    const ticket = await ticketService.get(wallet, appId);

    res.json({
      ok: true,
      wallet,
      appId,
      scopes,
      expiresAt: ticket?.expiresAt,
    });
  } catch (error: any) {
    console.error('[Ticket] Grant error:', error);
    res.status(500).json({ error: 'grant_failed', message: error.message });
  }
});

router.post('/check', async (req: Request, res: Response) => {
  try {
    const { wallet, appId, scopes = [] } = req.body;

    if (!wallet || !appId) {
      return res.status(400).json({ 
        error: 'missing_params', 
        message: 'wallet and appId are required' 
      });
    }

    const hasAccess = await ticketService.has({ wallet, appId, scopes });
    const ticket = hasAccess ? await ticketService.get(wallet, appId) : null;

    res.json({
      hasAccess,
      wallet,
      appId,
      scopes: ticket?.scopes || [],
      expiresAt: ticket?.expiresAt,
      gateType: ticket?.gateType,
    });
  } catch (error: any) {
    console.error('[Ticket] Check error:', error);
    res.status(500).json({ error: 'check_failed', message: error.message });
  }
});

router.post('/revoke', optionalAuth, requireAuthenticatedWallet, verifyWalletOwnership, async (req: Request, res: Response) => {
  try {
    const { appId } = req.body;
    const wallet = req.sdkUser!.wallet;

    if (!appId) {
      return res.status(400).json({ 
        error: 'missing_params', 
        message: 'appId is required' 
      });
    }

    const revoked = await ticketService.revoke(wallet, appId);

    res.json({
      ok: revoked,
      wallet,
      appId,
    });
  } catch (error: any) {
    console.error('[Ticket] Revoke error:', error);
    res.status(500).json({ error: 'revoke_failed', message: error.message });
  }
});

const verifyWalletParam = (req: Request, res: Response, next: NextFunction) => {
  const { wallet } = req.params;
  const authenticatedWallet = req.sdkUser?.wallet;
  
  if (wallet && authenticatedWallet && wallet.toLowerCase() !== authenticatedWallet.toLowerCase()) {
    return res.status(403).json({ 
      error: 'forbidden', 
      message: 'Cannot list tickets for another wallet' 
    });
  }
  next();
};

router.get('/list/:wallet', optionalAuth, requireAuthenticatedWallet, verifyWalletParam, async (req: Request, res: Response) => {
  try {
    const wallet = req.sdkUser!.wallet;

    const tickets = await ticketService.list(wallet);

    res.json({
      wallet,
      tickets: tickets.map(t => ({
        appId: t.appId,
        scopes: t.scopes,
        grantedAt: t.grantedAt,
        expiresAt: t.expiresAt,
        gateType: t.gateType,
      })),
    });
  } catch (error: any) {
    console.error('[Ticket] List error:', error);
    res.status(500).json({ error: 'list_failed', message: error.message });
  }
});

export default router;
