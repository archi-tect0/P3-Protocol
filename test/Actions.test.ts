import { expect } from 'chai';
import {
  executeAction,
  executeAnchorAction,
  executeWebhookAction,
  executeLedgerAllocateAction,
  type ActionContext,
} from '../server/rules/actions';
import { MemStorage } from '../server/storage';

describe('Rule Actions', () => {
  let storage: MemStorage;
  let context: ActionContext;

  beforeEach(() => {
    storage = new MemStorage();
    context = {
      storage,
      event: {},
      ruleId: 'test-rule',
      dryRun: true,
    };
  });

  describe('Anchor Action', () => {
    it('should execute anchor action in dry run mode', async () => {
      const action = {
        type: 'anchor',
        eventHash: 'test-hash-123',
        metadata: 'test metadata',
      };

      const result = await executeAnchorAction(action, context);

      expect(result.success).to.be.true;
      expect(result.result?.simulated).to.be.true;
      expect(result.result?.eventHash).to.equal('test-hash-123');
      expect(result.metadata?.dryRun).to.be.true;
    });

    it('should require eventHash', async () => {
      const action = {
        type: 'anchor',
        metadata: 'test metadata',
      };

      const result = await executeAnchorAction(action, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('eventHash is required');
    });

    it('should hash object eventHash', async () => {
      const action = {
        type: 'anchor',
        eventHash: { data: 'test' },
      };

      const result = await executeAnchorAction(action, context);

      expect(result.success).to.be.true;
      expect(result.result?.eventHash).to.be.a('string');
    });
  });

  describe('Webhook Action', () => {
    it('should execute webhook action in dry run mode', async () => {
      const action = {
        type: 'webhook',
        url: 'https://example.com/webhook',
        payload: { message: 'test' },
        headers: { 'X-Custom': 'header' },
      };

      const result = await executeWebhookAction(action, context);

      expect(result.success).to.be.true;
      expect(result.result?.simulated).to.be.true;
      expect(result.result?.url).to.equal('https://example.com/webhook');
      expect(result.metadata?.dryRun).to.be.true;
    });

    it('should require url', async () => {
      const action = {
        type: 'webhook',
        payload: { message: 'test' },
      };

      const result = await executeWebhookAction(action, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('url is required');
    });

    it('should use event as payload if not provided', async () => {
      const action = {
        type: 'webhook',
        url: 'https://example.com/webhook',
      };

      const eventContext = {
        ...context,
        event: { test: 'data' },
      };

      const result = await executeWebhookAction(action, eventContext);

      expect(result.success).to.be.true;
      expect(result.result?.payload).to.deep.equal({ test: 'data' });
    });
  });

  describe('Ledger Allocate Action', () => {
    it('should execute ledger allocate action in dry run mode', async () => {
      const action = {
        type: 'ledger_allocate',
        ledgerEventId: 'test-ledger-id',
        allocations: [
          { bucket: 'ops', percent: 50 },
          { bucket: 'r&d', percent: 30 },
          { bucket: 'reserve', percent: 20 },
        ],
        policyRef: 'test-policy',
      };

      const result = await executeLedgerAllocateAction(action, context);

      expect(result.success).to.be.true;
      expect(result.result?.simulated).to.be.true;
      expect(result.result?.allocations).to.have.lengthOf(3);
      expect(result.metadata?.dryRun).to.be.true;
    });

    it('should require ledgerEventId', async () => {
      const action = {
        type: 'ledger_allocate',
        allocations: [{ bucket: 'ops', percent: 100 }],
      };

      const result = await executeLedgerAllocateAction(action, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('ledgerEventId is required');
    });

    it('should require allocations array', async () => {
      const action = {
        type: 'ledger_allocate',
        ledgerEventId: 'test-id',
      };

      const result = await executeLedgerAllocateAction(action, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('allocations array is required');
    });

    it('should validate allocations sum to 100%', async () => {
      const action = {
        type: 'ledger_allocate',
        ledgerEventId: 'test-id',
        allocations: [
          { bucket: 'ops', percent: 50 },
          { bucket: 'r&d', percent: 30 },
        ],
      };

      const result = await executeLedgerAllocateAction(action, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('must sum to 100%');
    });

    it('should create allocations when not in dry run', async () => {
      const user = await storage.createUser({
        email: 'test@example.com',
        passwordHash: 'hash',
        role: 'admin',
      });

      const ledgerEvent = await storage.createLedgerEvent({
        txHash: '0xabc',
        chainId: 'ethereum',
        direction: 'inflow',
        amount: '1000',
        asset: 'ETH',
        counterparty: '0x123',
        immutableSeq: 1,
      });

      const action = {
        type: 'ledger_allocate',
        ledgerEventId: ledgerEvent.id,
        allocations: [
          { bucket: 'ops', percent: 50 },
          { bucket: 'r&d', percent: 30 },
          { bucket: 'reserve', percent: 20 },
        ],
      };

      const nonDryRunContext = {
        ...context,
        dryRun: false,
      };

      const result = await executeLedgerAllocateAction(
        action,
        nonDryRunContext
      );

      expect(result.success).to.be.true;
      expect(result.result?.allocations).to.have.lengthOf(3);
      expect(result.result?.totalAmount).to.equal('1000');

      const allocation = result.result?.allocations[0];
      expect(allocation?.bucket).to.equal('ops');
      expect(parseFloat(allocation?.amount)).to.equal(500);
    });
  });

  describe('Action Router', () => {
    it('should route to correct action executor', async () => {
      const anchorAction = {
        type: 'anchor',
        eventHash: 'test',
      };

      const result = await executeAction(anchorAction, context);

      expect(result.success).to.be.true;
      expect(result.metadata?.action).to.equal('anchor');
    });

    it('should handle unknown action types', async () => {
      const unknownAction = {
        type: 'unknown_action',
      };

      const result = await executeAction(unknownAction, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('Unknown action type');
    });
  });
});
