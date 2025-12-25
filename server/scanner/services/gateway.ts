import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { enqueueManifestScan } from './queue';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-gateway' });

const router = Router();

const manifestSchema = z.object({
  name: z.string().min(1).max(128),
  id: z.string().regex(/^app\.[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  entry: z.string().url().or(z.string().startsWith('/')),
  permissions: z.array(z.string()).default([]),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  category: z.string().optional(),
  signer: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  signature: z.string().optional(),
  routes: z.record(z.string()).optional(),
  endpoints: z.record(z.object({
    fn: z.string(),
    args: z.record(z.string()).optional(),
    scopes: z.array(z.string()).optional(),
    description: z.string().optional(),
  })).optional(),
});

export type ManifestSubmission = z.infer<typeof manifestSchema>;

interface ScanTicket {
  id: string;
  status: 'pending' | 'scanning' | 'complete' | 'failed';
  submittedAt: number;
  submittedBy: string;
  manifestId: string;
  manifestVersion: string;
}

const scanTickets = new Map<string, ScanTicket>();

router.post('/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const wallet = req.headers['x-wallet-address'] as string;
    if (!wallet) {
      res.status(401).json({ ok: false, error: 'Wallet authentication required' });
      return;
    }

    const { manifest } = req.body;
    if (!manifest) {
      res.status(400).json({ ok: false, error: 'manifest is required' });
      return;
    }

    const parsed = manifestSchema.safeParse(manifest);
    if (!parsed.success) {
      res.status(400).json({ 
        ok: false, 
        error: 'Invalid manifest schema', 
        details: parsed.error.errors 
      });
      return;
    }

    const ticketId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ticket: ScanTicket = {
      id: ticketId,
      status: 'pending',
      submittedAt: Date.now(),
      submittedBy: wallet.toLowerCase(),
      manifestId: parsed.data.id,
      manifestVersion: parsed.data.version,
    };

    scanTickets.set(ticketId, ticket);

    await enqueueManifestScan(ticketId, parsed.data, wallet);

    logger.info('Manifest submitted for scan', {
      ticketId,
      manifestId: parsed.data.id,
      version: parsed.data.version,
      wallet,
    });

    res.json({ 
      ok: true, 
      ticket: ticketId,
      status: 'pending',
      message: 'Manifest queued for scanning'
    });
  } catch (error) {
    logger.error('Manifest submission error', error as Error);
    next(error);
  }
});

router.get('/status/:ticketId', async (req: Request, res: Response) => {
  const { ticketId } = req.params;
  const ticket = scanTickets.get(ticketId);

  if (!ticket) {
    res.status(404).json({ ok: false, error: 'Scan ticket not found' });
    return;
  }

  res.json({
    ok: true,
    ticket: {
      id: ticket.id,
      status: ticket.status,
      manifestId: ticket.manifestId,
      manifestVersion: ticket.manifestVersion,
      submittedAt: ticket.submittedAt,
    }
  });
});

router.get('/pending', async (req: Request, res: Response) => {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet) {
    res.status(401).json({ ok: false, error: 'Wallet authentication required' });
    return;
  }

  const pending = Array.from(scanTickets.values())
    .filter(t => t.submittedBy === wallet.toLowerCase() && t.status !== 'complete')
    .map(t => ({
      id: t.id,
      status: t.status,
      manifestId: t.manifestId,
      manifestVersion: t.manifestVersion,
      submittedAt: t.submittedAt,
    }));

  res.json({ ok: true, pending });
});

export function updateTicketStatus(ticketId: string, status: ScanTicket['status']): void {
  const ticket = scanTickets.get(ticketId);
  if (ticket) {
    ticket.status = status;
    scanTickets.set(ticketId, ticket);
  }
}

export default router;
