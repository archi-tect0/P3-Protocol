import type { IStorage } from '../storage';
import type { TrustRule } from '@shared/schema';
import type { PluginRegistry } from '../plugins/registry';
import type { PluginRuntime } from '../plugins/runtime';
import { executeAction, type ActionContext, type ActionResult } from './actions';

/**
 * Condition operator types
 */
export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'not_contains'
  | 'matches'
  | 'not_matches'
  | 'exists'
  | 'not_exists';

/**
 * Condition structure
 */
export interface Condition {
  field?: string;
  operator: ConditionOperator;
  value?: any;
  conditions?: Condition[];
  logic?: 'and' | 'or';
}

/**
 * Rule evaluation context
 */
export interface RuleContext {
  storage: IStorage;
  pluginRegistry?: PluginRegistry;
  pluginRuntime?: PluginRuntime;
  dryRun?: boolean;
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  matched: boolean;
  ruleId: string;
  ruleName: string;
  executed: boolean;
  actionResults?: ActionResult[];
  error?: string;
  duration: number;
}

/**
 * Rule Engine
 * Evaluates JSON conditions against events and executes actions
 */
export class RuleEngine {
  private storage: IStorage;
  private pluginRegistry?: PluginRegistry;
  private pluginRuntime?: PluginRuntime;

  constructor(context: RuleContext) {
    this.storage = context.storage;
    this.pluginRegistry = context.pluginRegistry;
    this.pluginRuntime = context.pluginRuntime;
  }

  /**
   * Evaluate a single rule against an event
   */
  async evaluateRule(
    rule: TrustRule,
    event: any,
    dryRun: boolean = false
  ): Promise<RuleEvaluationResult> {
    const startTime = Date.now();

    try {
      // Check if rule is active
      if (rule.status !== 'active' && !dryRun) {
        return {
          matched: false,
          ruleId: rule.id,
          ruleName: rule.name,
          executed: false,
          duration: Date.now() - startTime,
        };
      }

      // Evaluate condition
      const condition = rule.condition as Condition;
      const matched = this.evaluateCondition(condition, event);

      if (!matched) {
        return {
          matched: false,
          ruleId: rule.id,
          ruleName: rule.name,
          executed: false,
          duration: Date.now() - startTime,
        };
      }

      // Execute action if condition matched
      const action = rule.action as any;
      const actionContext: ActionContext = {
        storage: this.storage,
        pluginRegistry: this.pluginRegistry,
        pluginRuntime: this.pluginRuntime,
        event,
        ruleId: rule.id,
        dryRun,
      };

      let actionResults: ActionResult[] = [];

      // Handle single action or array of actions
      if (Array.isArray(action)) {
        for (const act of action) {
          const result = await executeAction(act, actionContext);
          actionResults.push(result);
        }
      } else {
        const result = await executeAction(action, actionContext);
        actionResults.push(result);
      }

      // Update execution count if not dry run
      if (!dryRun) {
        await this.storage.incrementRuleExecution(rule.id);
      }

      return {
        matched: true,
        ruleId: rule.id,
        ruleName: rule.name,
        executed: true,
        actionResults,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        matched: false,
        ruleId: rule.id,
        ruleName: rule.name,
        executed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Evaluate all active rules against an event
   */
  async evaluateAllRules(
    event: any,
    dryRun: boolean = false
  ): Promise<RuleEvaluationResult[]> {
    // Get all active rules
    const rules = await this.storage.getTrustRules({
      status: dryRun ? undefined : 'active',
    });

    // Sort by priority (higher priority first)
    rules.sort((a, b) => b.priority - a.priority);

    // Evaluate each rule
    const results: RuleEvaluationResult[] = [];
    for (const rule of rules) {
      const result = await this.evaluateRule(rule, event, dryRun);
      results.push(result);
    }

    return results;
  }

  /**
   * Evaluate a condition against an event
   */
  evaluateCondition(condition: Condition, event: any): boolean {
    // Handle composite conditions (and/or)
    if (condition.conditions && Array.isArray(condition.conditions)) {
      const logic = condition.logic || 'and';

      if (logic === 'and') {
        return condition.conditions.every((c) =>
          this.evaluateCondition(c, event)
        );
      } else {
        return condition.conditions.some((c) =>
          this.evaluateCondition(c, event)
        );
      }
    }

    // Handle single condition
    const { field, operator, value } = condition;

    if (!field) {
      throw new Error('Condition must have a field');
    }

    const fieldValue = this.getFieldValue(event, field);

    return this.evaluateOperator(operator, fieldValue, value);
  }

  /**
   * Get nested field value from object using dot notation
   */
  private getFieldValue(obj: any, field: string): any {
    const parts = field.split('.');
    let value = obj;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Evaluate an operator
   */
  private evaluateOperator(
    operator: ConditionOperator,
    fieldValue: any,
    expectedValue: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === expectedValue;

      case 'ne':
        return fieldValue !== expectedValue;

      case 'gt':
        return fieldValue > expectedValue;

      case 'lt':
        return fieldValue < expectedValue;

      case 'gte':
        return fieldValue >= expectedValue;

      case 'lte':
        return fieldValue <= expectedValue;

      case 'in':
        if (!Array.isArray(expectedValue)) {
          throw new Error('Value for "in" operator must be an array');
        }
        return expectedValue.includes(fieldValue);

      case 'nin':
        if (!Array.isArray(expectedValue)) {
          throw new Error('Value for "nin" operator must be an array');
        }
        return !expectedValue.includes(fieldValue);

      case 'contains':
        if (typeof fieldValue === 'string') {
          return fieldValue.includes(expectedValue);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(expectedValue);
        }
        return false;

      case 'not_contains':
        if (typeof fieldValue === 'string') {
          return !fieldValue.includes(expectedValue);
        }
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(expectedValue);
        }
        return true;

      case 'matches':
        if (typeof fieldValue !== 'string') {
          return false;
        }
        try {
          const regex = new RegExp(expectedValue);
          return regex.test(fieldValue);
        } catch (error) {
          console.error('Invalid regex pattern:', expectedValue);
          return false;
        }

      case 'not_matches':
        if (typeof fieldValue !== 'string') {
          return true;
        }
        try {
          const regex = new RegExp(expectedValue);
          return !regex.test(fieldValue);
        } catch (error) {
          console.error('Invalid regex pattern:', expectedValue);
          return true;
        }

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Test a condition without executing actions (dry run)
   */
  async testCondition(condition: Condition, event: any): Promise<boolean> {
    try {
      return this.evaluateCondition(condition, event);
    } catch (error) {
      console.error('Error testing condition:', error);
      return false;
    }
  }

  /**
   * Validate a condition structure
   */
  validateCondition(condition: Condition): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (condition.conditions && Array.isArray(condition.conditions)) {
      // Composite condition
      if (!condition.logic || !['and', 'or'].includes(condition.logic)) {
        errors.push('Composite condition must have logic set to "and" or "or"');
      }

      if (condition.conditions.length === 0) {
        errors.push('Composite condition must have at least one sub-condition');
      }

      // Recursively validate sub-conditions
      for (let i = 0; i < condition.conditions.length; i++) {
        const subResult = this.validateCondition(condition.conditions[i]);
        if (!subResult.valid) {
          errors.push(
            ...subResult.errors.map((e) => `Sub-condition ${i}: ${e}`)
          );
        }
      }
    } else {
      // Simple condition
      if (!condition.field) {
        errors.push('Simple condition must have a field');
      }

      if (!condition.operator) {
        errors.push('Condition must have an operator');
      }

      const validOperators: ConditionOperator[] = [
        'eq',
        'ne',
        'gt',
        'lt',
        'gte',
        'lte',
        'in',
        'nin',
        'contains',
        'not_contains',
        'matches',
        'not_matches',
        'exists',
        'not_exists',
      ];

      if (condition.operator && !validOperators.includes(condition.operator)) {
        errors.push(`Invalid operator: ${condition.operator}`);
      }

      // Some operators don't require a value
      const noValueOperators: ConditionOperator[] = ['exists', 'not_exists'];
      if (
        condition.operator &&
        !noValueOperators.includes(condition.operator) &&
        condition.value === undefined
      ) {
        errors.push(`Operator ${condition.operator} requires a value`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Helper function to create a rule engine instance
 */
export function createRuleEngine(context: RuleContext): RuleEngine {
  return new RuleEngine(context);
}

/**
 * Helper function to evaluate a condition (for backward compatibility)
 */
export function evaluateCondition(condition: Condition, event: any): boolean {
  const engine = new RuleEngine({ storage: {} as IStorage });
  return engine.evaluateCondition(condition, event);
}
