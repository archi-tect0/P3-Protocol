import * as vm from 'vm';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-sandbox' });

export interface SandboxResult {
  ok: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
  memoryUsedBytes?: number;
}

export interface SandboxConfig {
  timeoutMs: number;
  maxMemoryMB: number;
  allowedGlobals: string[];
}

const DEFAULT_CONFIG: SandboxConfig = {
  timeoutMs: 3000,
  maxMemoryMB: 64,
  allowedGlobals: ['Date', 'Math', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite'],
};

const SAFE_GLOBALS: Record<string, any> = {
  Date,
  Math,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Promise,
  Symbol,
  Error,
  TypeError,
  RangeError,
  SyntaxError,
  console: {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {},
  },
};

export async function sandboxInvoke(
  code: string,
  fnName: string,
  args: any,
  config: Partial<SandboxConfig> = {}
): Promise<SandboxResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  try {
    const context = vm.createContext({
      ...SAFE_GLOBALS,
      exports: {},
      module: { exports: {} },
    });

    const script = new vm.Script(code, { 
      filename: 'sandbox.js',
    });

    script.runInContext(context, { timeout: cfg.timeoutMs });

    const fn = context.exports[fnName] || context.module.exports[fnName] || context[fnName];

    if (typeof fn !== 'function') {
      return {
        ok: false,
        error: `Function "${fnName}" not found in sandbox context`,
        executionTimeMs: Date.now() - startTime,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const safeArgs = JSON.parse(JSON.stringify(args));
      const result = await Promise.resolve(fn(safeArgs));

      clearTimeout(timer);

      return {
        ok: true,
        result: JSON.parse(JSON.stringify(result)),
        executionTimeMs: Date.now() - startTime,
      };
    } catch (fnError: any) {
      clearTimeout(timer);
      return {
        ok: false,
        error: fnError.message?.slice(0, 256) || 'Function execution error',
        executionTimeMs: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    const isTimeout = error.message?.includes('Script execution timed out');
    
    logger.warn('Sandbox execution failed', {
      fnName,
      error: error.message,
      isTimeout,
    });

    return {
      ok: false,
      error: isTimeout 
        ? `Execution timed out after ${cfg.timeoutMs}ms` 
        : error.message?.slice(0, 256) || 'Sandbox execution error',
      executionTimeMs: Date.now() - startTime,
    };
  }
}

export interface EndpointTestCase {
  endpoint: string;
  fn: string;
  args: Record<string, any>;
  expectedType?: string;
}

export async function runEndpointTests(
  adapterCode: string,
  testCases: EndpointTestCase[]
): Promise<{ passes: number; fails: number; results: SandboxResult[] }> {
  const results: SandboxResult[] = [];
  let passes = 0;
  let fails = 0;

  for (const test of testCases) {
    const result = await sandboxInvoke(adapterCode, test.fn, test.args);
    results.push(result);

    if (result.ok) {
      if (test.expectedType) {
        const actualType = typeof result.result;
        if (actualType === test.expectedType) {
          passes++;
        } else {
          fails++;
          result.error = `Expected ${test.expectedType}, got ${actualType}`;
          result.ok = false;
        }
      } else {
        passes++;
      }
    } else {
      fails++;
    }
  }

  logger.info('Endpoint tests complete', {
    total: testCases.length,
    passes,
    fails,
  });

  return { passes, fails, results };
}

export function generateTestArgs(argSchema: Record<string, string>): Record<string, any> {
  const testArgs: Record<string, any> = {};

  for (const [key, type] of Object.entries(argSchema)) {
    switch (type.toLowerCase()) {
      case 'string':
        testArgs[key] = 'test_string';
        break;
      case 'number':
        testArgs[key] = 42;
        break;
      case 'boolean':
        testArgs[key] = true;
        break;
      case 'address':
        testArgs[key] = '0x0000000000000000000000000000000000000000';
        break;
      case 'array':
        testArgs[key] = [];
        break;
      case 'object':
        testArgs[key] = {};
        break;
      default:
        testArgs[key] = null;
    }
  }

  return testArgs;
}
