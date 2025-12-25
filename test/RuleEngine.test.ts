import { expect } from 'chai';
import { RuleEngine, evaluateCondition, type Condition } from '../server/rules/engine';
import { MemStorage } from '../server/storage';
import type { InsertTrustRule } from '@shared/schema';

describe('RuleEngine', () => {
  let storage: MemStorage;
  let engine: RuleEngine;

  beforeEach(() => {
    storage = new MemStorage();
    engine = new RuleEngine({ storage });
  });

  describe('Condition Evaluation', () => {
    describe('Equality Operators', () => {
      it('should evaluate eq operator correctly', () => {
        const condition: Condition = {
          field: 'status',
          operator: 'eq',
          value: 'active',
        };

        const event1 = { status: 'active' };
        const event2 = { status: 'inactive' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate ne operator correctly', () => {
        const condition: Condition = {
          field: 'status',
          operator: 'ne',
          value: 'inactive',
        };

        const event1 = { status: 'active' };
        const event2 = { status: 'inactive' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });
    });

    describe('Comparison Operators', () => {
      it('should evaluate gt operator correctly', () => {
        const condition: Condition = {
          field: 'amount',
          operator: 'gt',
          value: 100,
        };

        const event1 = { amount: 150 };
        const event2 = { amount: 50 };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate lt operator correctly', () => {
        const condition: Condition = {
          field: 'amount',
          operator: 'lt',
          value: 100,
        };

        const event1 = { amount: 50 };
        const event2 = { amount: 150 };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate gte operator correctly', () => {
        const condition: Condition = {
          field: 'amount',
          operator: 'gte',
          value: 100,
        };

        const event1 = { amount: 100 };
        const event2 = { amount: 150 };
        const event3 = { amount: 50 };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.true;
        expect(engine.evaluateCondition(condition, event3)).to.be.false;
      });

      it('should evaluate lte operator correctly', () => {
        const condition: Condition = {
          field: 'amount',
          operator: 'lte',
          value: 100,
        };

        const event1 = { amount: 100 };
        const event2 = { amount: 50 };
        const event3 = { amount: 150 };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.true;
        expect(engine.evaluateCondition(condition, event3)).to.be.false;
      });
    });

    describe('Array Operators', () => {
      it('should evaluate in operator correctly', () => {
        const condition: Condition = {
          field: 'status',
          operator: 'in',
          value: ['active', 'pending', 'processing'],
        };

        const event1 = { status: 'active' };
        const event2 = { status: 'inactive' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate nin operator correctly', () => {
        const condition: Condition = {
          field: 'status',
          operator: 'nin',
          value: ['inactive', 'cancelled'],
        };

        const event1 = { status: 'active' };
        const event2 = { status: 'inactive' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });
    });

    describe('String Operators', () => {
      it('should evaluate contains operator for strings', () => {
        const condition: Condition = {
          field: 'message',
          operator: 'contains',
          value: 'error',
        };

        const event1 = { message: 'An error occurred' };
        const event2 = { message: 'Everything is fine' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate contains operator for arrays', () => {
        const condition: Condition = {
          field: 'tags',
          operator: 'contains',
          value: 'urgent',
        };

        const event1 = { tags: ['urgent', 'bug'] };
        const event2 = { tags: ['feature', 'enhancement'] };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate not_contains operator correctly', () => {
        const condition: Condition = {
          field: 'message',
          operator: 'not_contains',
          value: 'error',
        };

        const event1 = { message: 'Everything is fine' };
        const event2 = { message: 'An error occurred' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate matches operator with regex', () => {
        const condition: Condition = {
          field: 'email',
          operator: 'matches',
          value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        };

        const event1 = { email: 'user@example.com' };
        const event2 = { email: 'invalid-email' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });

      it('should evaluate not_matches operator correctly', () => {
        const condition: Condition = {
          field: 'username',
          operator: 'not_matches',
          value: '^admin',
        };

        const event1 = { username: 'user123' };
        const event2 = { username: 'admin-user' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });
    });

    describe('Existence Operators', () => {
      it('should evaluate exists operator correctly', () => {
        const condition: Condition = {
          field: 'optionalField',
          operator: 'exists',
        };

        const event1 = { optionalField: 'value' };
        const event2 = { otherField: 'value' };
        const event3 = { optionalField: null };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
        expect(engine.evaluateCondition(condition, event3)).to.be.false;
      });

      it('should evaluate not_exists operator correctly', () => {
        const condition: Condition = {
          field: 'optionalField',
          operator: 'not_exists',
        };

        const event1 = { otherField: 'value' };
        const event2 = { optionalField: 'value' };
        const event3 = { optionalField: null };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
        expect(engine.evaluateCondition(condition, event3)).to.be.true;
      });
    });

    describe('Nested Field Access', () => {
      it('should access nested fields with dot notation', () => {
        const condition: Condition = {
          field: 'user.profile.role',
          operator: 'eq',
          value: 'admin',
        };

        const event1 = {
          user: {
            profile: {
              role: 'admin',
            },
          },
        };

        const event2 = {
          user: {
            profile: {
              role: 'viewer',
            },
          },
        };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
      });
    });

    describe('Composite Conditions', () => {
      it('should evaluate AND logic correctly', () => {
        const condition: Condition = {
          logic: 'and',
          conditions: [
            { field: 'amount', operator: 'gt', value: 100 },
            { field: 'status', operator: 'eq', value: 'active' },
          ],
        };

        const event1 = { amount: 150, status: 'active' };
        const event2 = { amount: 150, status: 'inactive' };
        const event3 = { amount: 50, status: 'active' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.false;
        expect(engine.evaluateCondition(condition, event3)).to.be.false;
      });

      it('should evaluate OR logic correctly', () => {
        const condition: Condition = {
          logic: 'or',
          conditions: [
            { field: 'amount', operator: 'gt', value: 1000 },
            { field: 'priority', operator: 'eq', value: 'high' },
          ],
        };

        const event1 = { amount: 1500, priority: 'low' };
        const event2 = { amount: 100, priority: 'high' };
        const event3 = { amount: 100, priority: 'low' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.true;
        expect(engine.evaluateCondition(condition, event3)).to.be.false;
      });

      it('should handle nested composite conditions', () => {
        const condition: Condition = {
          logic: 'and',
          conditions: [
            { field: 'status', operator: 'eq', value: 'active' },
            {
              logic: 'or',
              conditions: [
                { field: 'amount', operator: 'gt', value: 1000 },
                { field: 'priority', operator: 'eq', value: 'urgent' },
              ],
            },
          ],
        };

        const event1 = { status: 'active', amount: 1500, priority: 'low' };
        const event2 = { status: 'active', amount: 100, priority: 'urgent' };
        const event3 = { status: 'inactive', amount: 1500, priority: 'urgent' };

        expect(engine.evaluateCondition(condition, event1)).to.be.true;
        expect(engine.evaluateCondition(condition, event2)).to.be.true;
        expect(engine.evaluateCondition(condition, event3)).to.be.false;
      });
    });
  });

  describe('Rule Evaluation', () => {
    it('should evaluate rule and execute actions when condition matches', async () => {
      const user = await storage.createUser({
        email: 'admin@test.com',
        passwordHash: 'hash',
        role: 'admin',
      });

      const rule = await storage.createTrustRule({
        name: 'High value transaction alert',
        description: 'Alert on transactions over 1000',
        condition: {
          field: 'amount',
          operator: 'gt',
          value: 1000,
        },
        action: {
          type: 'webhook',
          url: 'https://example.com/webhook',
          payload: {
            alert: 'High value transaction detected',
          },
        },
        priority: 100,
        status: 'active',
        createdBy: user.id,
      });

      const event = {
        amount: 1500,
        asset: 'ETH',
        timestamp: new Date().toISOString(),
      };

      const result = await engine.evaluateRule(rule, event, true);

      expect(result.matched).to.be.true;
      expect(result.executed).to.be.true;
      expect(result.actionResults).to.have.lengthOf(1);
      expect(result.actionResults![0].success).to.be.true;
      expect(result.actionResults![0].metadata?.dryRun).to.be.true;
    });

    it('should not execute actions when condition does not match', async () => {
      const user = await storage.createUser({
        email: 'admin@test.com',
        passwordHash: 'hash',
        role: 'admin',
      });

      const rule = await storage.createTrustRule({
        name: 'High value transaction alert',
        condition: {
          field: 'amount',
          operator: 'gt',
          value: 1000,
        },
        action: {
          type: 'webhook',
          url: 'https://example.com/webhook',
        },
        priority: 100,
        status: 'active',
        createdBy: user.id,
      });

      const event = {
        amount: 500,
        asset: 'ETH',
      };

      const result = await engine.evaluateRule(rule, event, true);

      expect(result.matched).to.be.false;
      expect(result.executed).to.be.false;
      expect(result.actionResults).to.be.undefined;
    });

    it('should not evaluate inactive rules unless in dry run mode', async () => {
      const user = await storage.createUser({
        email: 'admin@test.com',
        passwordHash: 'hash',
        role: 'admin',
      });

      const rule = await storage.createTrustRule({
        name: 'Inactive rule',
        condition: {
          field: 'status',
          operator: 'eq',
          value: 'active',
        },
        action: {
          type: 'webhook',
          url: 'https://example.com/webhook',
        },
        priority: 100,
        status: 'inactive',
        createdBy: user.id,
      });

      const event = { status: 'active' };

      const result = await engine.evaluateRule(rule, event, false);

      expect(result.matched).to.be.false;
      expect(result.executed).to.be.false;
    });

    it('should evaluate multiple actions', async () => {
      const user = await storage.createUser({
        email: 'admin@test.com',
        passwordHash: 'hash',
        role: 'admin',
      });

      const rule = await storage.createTrustRule({
        name: 'Multi-action rule',
        condition: {
          field: 'critical',
          operator: 'eq',
          value: true,
        },
        action: [
          {
            type: 'webhook',
            url: 'https://example.com/alert',
          },
          {
            type: 'anchor',
            eventHash: 'test-hash',
          },
        ],
        priority: 100,
        status: 'active',
        createdBy: user.id,
      });

      const event = { critical: true };

      const result = await engine.evaluateRule(rule, event, true);

      expect(result.matched).to.be.true;
      expect(result.executed).to.be.true;
      expect(result.actionResults).to.have.lengthOf(2);
      expect(result.actionResults![0].success).to.be.true;
      expect(result.actionResults![1].success).to.be.true;
    });
  });

  describe('Condition Validation', () => {
    it('should validate simple conditions correctly', () => {
      const validCondition: Condition = {
        field: 'status',
        operator: 'eq',
        value: 'active',
      };

      const result = engine.validateCondition(validCondition);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should detect missing field', () => {
      const invalidCondition: any = {
        operator: 'eq',
        value: 'active',
      };

      const result = engine.validateCondition(invalidCondition);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Simple condition must have a field');
    });

    it('should detect missing operator', () => {
      const invalidCondition: any = {
        field: 'status',
        value: 'active',
      };

      const result = engine.validateCondition(invalidCondition);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Condition must have an operator');
    });

    it('should detect invalid operator', () => {
      const invalidCondition: any = {
        field: 'status',
        operator: 'invalid_op',
        value: 'active',
      };

      const result = engine.validateCondition(invalidCondition);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include('Invalid operator: invalid_op');
    });

    it('should validate composite conditions', () => {
      const validCondition: Condition = {
        logic: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
          { field: 'amount', operator: 'gt', value: 100 },
        ],
      };

      const result = engine.validateCondition(validCondition);

      expect(result.valid).to.be.true;
      expect(result.errors).to.have.lengthOf(0);
    });

    it('should detect invalid logic in composite conditions', () => {
      const invalidCondition: any = {
        logic: 'invalid',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
        ],
      };

      const result = engine.validateCondition(invalidCondition);

      expect(result.valid).to.be.false;
      expect(result.errors).to.include(
        'Composite condition must have logic set to "and" or "or"'
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('evaluateCondition helper function should work', () => {
      const condition: Condition = {
        field: 'status',
        operator: 'eq',
        value: 'active',
      };

      const event = { status: 'active' };

      const result = evaluateCondition(condition, event);

      expect(result).to.be.true;
    });
  });
});
