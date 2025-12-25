import { Request, Response, NextFunction } from 'express';
import { ticketService } from '../../services/ticket';
import { sdkFlags } from '../config/flags';

export type TicketScopes = 
  | 'encrypt' 
  | 'session' 
  | 'dao' 
  | 'media' 
  | 'audit' 
  | 'anchor'
  | 'explorer'
  | 'purchase'
  | '*';

interface AccessRequest extends Request {
  user?: {
    wallet: string;
    appId: string;
    scopes: string[];
  };
}

function buildRedirectUrl(
  reason: string, 
  appId: string, 
  scopes: string[], 
  returnTo: string
): string {
  const params = new URLSearchParams({
    reason,
    appId,
    scopes: scopes.join(','),
    returnTo,
  });
  return `/ticket?${params.toString()}`;
}

export function requireTicket(scopes: TicketScopes[] = []) {
  return async (req: AccessRequest, res: Response, next: NextFunction) => {
    if (!sdkFlags.ticketGate) {
      return next();
    }

    const appId = req.headers['x-app-id'] as string || 'unknown';
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return res.status(302).json({
        redirect: buildRedirectUrl('no_session', appId, scopes, req.originalUrl),
        error: 'no_session',
        message: 'Wallet session required',
      });
    }

    let wallet: string | null = null;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token) as { wallet?: string; address?: string } | null;
      wallet = decoded?.wallet || decoded?.address || null;
    } catch {
      wallet = null;
    }

    if (!wallet) {
      return res.status(302).json({
        redirect: buildRedirectUrl('invalid_session', appId, scopes, req.originalUrl),
        error: 'invalid_session',
        message: 'Invalid wallet session',
      });
    }

    const hasAccess = await ticketService.has({
      wallet,
      appId,
      scopes,
    });

    if (!hasAccess) {
      return res.status(302).json({
        redirect: buildRedirectUrl('no_ticket', appId, scopes, req.originalUrl),
        error: 'no_ticket',
        message: 'Access ticket required',
        wallet,
        appId,
        requiredScopes: scopes,
      });
    }

    req.user = { wallet, appId, scopes };
    next();
  };
}

export function optionalTicket(scopes: TicketScopes[] = []) {
  return async (req: AccessRequest, res: Response, next: NextFunction) => {
    if (!sdkFlags.ticketGate) {
      return next();
    }

    const appId = req.headers['x-app-id'] as string || 'unknown';
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return next();
    }

    let wallet: string | null = null;
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token) as { wallet?: string; address?: string } | null;
      wallet = decoded?.wallet || decoded?.address || null;
    } catch {
      wallet = null;
    }

    if (wallet) {
      const hasAccess = await ticketService.has({ wallet, appId, scopes });
      if (hasAccess) {
        req.user = { wallet, appId, scopes };
      }
    }

    next();
  };
}

export default { requireTicket, optionalTicket };
