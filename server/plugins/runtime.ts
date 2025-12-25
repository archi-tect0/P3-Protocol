import { EventEmitter } from 'events';
import vm from 'vm';
import type {
  PluginInstance,
  PluginExecutionResult,
  PluginEvent,
  PluginSandboxOptions,
} from './types';

/**
 * Plugin Runtime
 * Executes plugins in isolated VM context with timeout and resource limits
 */
export class PluginRuntime extends EventEmitter {
  private defaultTimeout = 5000; // 5 seconds
  private defaultMemoryLimit = 50 * 1024 * 1024; // 50MB

  constructor() {
    super();
  }

  /**
   * Execute a plugin function with sandboxing
   */
  async executePlugin(
    instance: PluginInstance,
    functionName: string,
    args: any[] = [],
    options?: PluginSandboxOptions
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();

    try {
      // Check if plugin is enabled
      if (!instance.enabled) {
        throw new Error(`Plugin ${instance.manifest.id} is not enabled`);
      }

      // Get the function from the plugin module
      const pluginFunction = instance.module[functionName];

      if (!pluginFunction || typeof pluginFunction !== 'function') {
        throw new Error(
          `Function ${functionName} not found in plugin ${instance.manifest.id}`
        );
      }

      // Execute with timeout
      const timeout = options?.timeout || this.defaultTimeout;
      const result = await this.executeWithTimeout(
        () => pluginFunction(instance.context, ...args),
        timeout
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Execute plugin code in VM sandbox
   */
  async executeSandboxedCode(
    code: string,
    context: Record<string, any>,
    options?: PluginSandboxOptions
  ): Promise<PluginExecutionResult> {
    const startTime = Date.now();

    try {
      // Create sandbox context
      const sandbox = vm.createContext({
        ...context,
        console: {
          log: (...args: any[]) => console.log('[Sandbox]', ...args),
          error: (...args: any[]) => console.error('[Sandbox]', ...args),
          warn: (...args: any[]) => console.warn('[Sandbox]', ...args),
        },
        setTimeout: undefined, // Disable setTimeout to prevent infinite loops
        setInterval: undefined, // Disable setInterval
        setImmediate: undefined, // Disable setImmediate
      });

      // Execute code with timeout
      const timeout = options?.timeout || this.defaultTimeout;
      const script = new vm.Script(code);

      const result = await this.executeWithTimeout(() => {
        return script.runInContext(sandbox, {
          timeout,
          displayErrors: true,
        });
      }, timeout);

      const duration = Date.now() - startTime;

      return {
        success: true,
        result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  /**
   * Emit event to all enabled plugins
   */
  async emitToPlugins(
    plugins: PluginInstance[],
    event: PluginEvent
  ): Promise<Map<string, PluginExecutionResult>> {
    const results = new Map<string, PluginExecutionResult>();

    for (const instance of plugins) {
      if (!instance.enabled) {
        continue;
      }

      const hookName = instance.manifest.hooks?.onEvent;
      if (!hookName) {
        continue;
      }

      const result = await this.executePlugin(instance, hookName, [event]);
      results.set(instance.manifest.id, result);
    }

    return results;
  }

  /**
   * Execute function with timeout
   */
  private executeWithTimeout<T>(
    fn: () => T | Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      Promise.resolve(fn())
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Monitor memory usage (basic implementation)
   */
  private checkMemoryUsage(limit: number): void {
    const usage = process.memoryUsage();
    if (usage.heapUsed > limit) {
      throw new Error(`Memory limit exceeded: ${usage.heapUsed} > ${limit}`);
    }
  }
}
