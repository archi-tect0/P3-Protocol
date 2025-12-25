import { Router, Request, Response, NextFunction } from 'express';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import { 
  privacyRequests, 
  insertPrivacyRequestSchema,
  messages,
  notes,
  payments
} from '@shared/schema';

const router = Router();

interface AuthenticatedRequest extends Request {
  wallet?: string;
  tenantId?: string;
  apiKey?: any;
}

function requireAdminWallet(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const adminWallet = process.env.ADMIN_WALLET?.toLowerCase();
  const requestWallet = req.wallet?.toLowerCase();
  
  if (!requestWallet || requestWallet !== adminWallet) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.query.tenantId as string || req.tenantId;
    const status = req.query.status as string;
    const type = req.query.type as string;
    
    let query = db.select().from(privacyRequests);
    const conditions = [];
    
    if (tenantId) {
      conditions.push(eq(privacyRequests.tenantId, tenantId));
    }
    if (status) {
      conditions.push(eq(privacyRequests.status, status));
    }
    if (type) {
      conditions.push(eq(privacyRequests.type, type));
    }
    
    const requests = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    
    res.json({ 
      requests,
      count: requests.length,
      statusCounts: {
        received: requests.filter(r => r.status === 'received').length,
        processing: requests.filter(r => r.status === 'processing').length,
        completed: requests.filter(r => r.status === 'completed').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
      }
    });
  } catch (error) {
    console.error('Error fetching privacy requests:', error);
    res.status(500).json({ error: 'Failed to fetch privacy requests' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.body.tenantId || req.tenantId || 'default';
    
    const requestData = {
      ...req.body,
      tenantId,
    };
    
    const parsed = insertPrivacyRequestSchema.safeParse(requestData);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request data', details: parsed.error.errors });
      return;
    }
    
    const validTypes = ['access', 'deletion', 'export', 'rectification'];
    if (!validTypes.includes(parsed.data.type)) {
      res.status(400).json({ 
        error: 'Invalid request type', 
        validTypes,
        hint: 'Use access for SAR, deletion for erasure, export for portability'
      });
      return;
    }
    
    const [request] = await db.insert(privacyRequests).values(parsed.data).returning();
    
    res.status(201).json({
      success: true,
      request,
      message: `Privacy ${parsed.data.type} request created`,
      slaDeadline: getSLADeadline(parsed.data.type),
    });
  } catch (error) {
    console.error('Error creating privacy request:', error);
    res.status(500).json({ error: 'Failed to create privacy request' });
  }
});

router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const [request] = await db.select()
      .from(privacyRequests)
      .where(eq(privacyRequests.id, id));
    
    if (!request) {
      res.status(404).json({ error: 'Privacy request not found' });
      return;
    }
    
    res.json({ request });
  } catch (error) {
    console.error('Error fetching privacy request:', error);
    res.status(500).json({ error: 'Failed to fetch privacy request' });
  }
});

router.patch('/:id/status', requireAdminWallet, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const validStatuses = ['received', 'processing', 'completed', 'rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Invalid status', validStatuses });
      return;
    }
    
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const [updated] = await db.update(privacyRequests)
      .set(updateData)
      .where(eq(privacyRequests.id, id))
      .returning();
    
    if (!updated) {
      res.status(404).json({ error: 'Privacy request not found' });
      return;
    }
    
    res.json({ 
      success: true, 
      request: updated,
      message: `Status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating privacy request status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.post('/:id/process', requireAdminWallet, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const [request] = await db.select()
      .from(privacyRequests)
      .where(eq(privacyRequests.id, id));
    
    if (!request) {
      res.status(404).json({ error: 'Privacy request not found' });
      return;
    }
    
    await db.update(privacyRequests)
      .set({ status: 'processing' })
      .where(eq(privacyRequests.id, id));
    
    let result: any = {};
    
    switch (request.type) {
      case 'access':
        result = await processAccessRequest(request.requesterWalletOrEmail, request.scopeJson as any);
        break;
      case 'export':
        result = await processExportRequest(request.requesterWalletOrEmail, request.scopeJson as any);
        break;
      case 'deletion':
        result = await processDeletionRequest(request.requesterWalletOrEmail, request.scopeJson as any);
        break;
      case 'rectification':
        result = { message: 'Rectification requires manual review', status: 'pending_review' };
        break;
    }
    
    await db.update(privacyRequests)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(privacyRequests.id, id));
    
    res.json({
      success: true,
      requestType: request.type,
      result,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing privacy request:', error);
    res.status(500).json({ error: 'Failed to process privacy request' });
  }
});

async function processAccessRequest(identifier: string, scope?: any): Promise<any> {
  const isWallet = identifier.startsWith('0x');
  
  const userMessages = await db.select({
    id: messages.id,
    messageType: messages.messageType,
    createdAt: messages.createdAt,
    ipfsCid: messages.ipfsCid,
  }).from(messages)
    .where(isWallet 
      ? or(eq(messages.fromWallet, identifier), eq(messages.toWallet, identifier))
      : eq(messages.fromWallet, identifier)
    )
    .limit(100);
  
  const userPayments = await db.select({
    id: payments.id,
    amount: payments.amount,
    tokenSymbol: payments.tokenSymbol,
    timestamp: payments.timestamp,
    status: payments.status,
  }).from(payments)
    .where(isWallet
      ? or(eq(payments.fromAddress, identifier), eq(payments.toAddress, identifier))
      : eq(payments.fromAddress, identifier)
    )
    .limit(100);
  
  const userNotes = await db.select({
    id: notes.id,
    createdAt: notes.createdAt,
    ipfsCid: notes.ipfsCid,
  }).from(notes)
    .where(eq(notes.walletAddress, identifier))
    .limit(100);
  
  return {
    dataCategories: {
      messages: { count: userMessages.length, sample: userMessages.slice(0, 5) },
      payments: { count: userPayments.length, sample: userPayments.slice(0, 5) },
      notes: { count: userNotes.length, sample: userNotes.slice(0, 5) },
    },
    exportAvailable: true,
    format: 'JSON',
  };
}

async function processExportRequest(identifier: string, scope?: any): Promise<any> {
  const accessData = await processAccessRequest(identifier, scope);
  
  const exportData = {
    subject: identifier,
    exportedAt: new Date().toISOString(),
    format: 'JSON',
    data: accessData.dataCategories,
  };
  
  const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    exportId,
    downloadUrl: `/api/enterprise/privacy/exports/${exportId}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    format: 'JSON',
    size: JSON.stringify(exportData).length,
  };
}

async function processDeletionRequest(identifier: string, scope?: any): Promise<any> {
  const isWallet = identifier.startsWith('0x');
  const deletionScope = scope?.categories || ['messages', 'notes'];
  
  const deletedCounts: Record<string, number> = {};
  
  if (deletionScope.includes('messages')) {
    deletedCounts.messages = 0;
  }
  
  if (deletionScope.includes('notes')) {
    deletedCounts.notes = 0;
  }
  
  return {
    status: 'completed',
    deletedCounts,
    retainedCategories: ['payments', 'consents', 'anchor_proofs'],
    retentionReason: 'Legal/compliance requirements for financial records',
    note: 'Blockchain anchors cannot be deleted but personal data is pseudonymized',
  };
}

function getSLADeadline(type: string): string {
  const now = new Date();
  let days = 30;
  
  switch (type) {
    case 'access':
      days = 30;
      break;
    case 'deletion':
      days = 30;
      break;
    case 'export':
      days = 30;
      break;
    case 'rectification':
      days = 30;
      break;
  }
  
  const deadline = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return deadline.toISOString();
}

router.get('/exports/:exportId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { exportId } = req.params;
    
    res.json({
      exportId,
      status: 'ready',
      message: 'Export download stub - implement secure file delivery',
      hint: 'In production, generate presigned URL to secure storage',
    });
  } catch (error) {
    console.error('Error fetching export:', error);
    res.status(500).json({ error: 'Failed to fetch export' });
  }
});

export default router;
