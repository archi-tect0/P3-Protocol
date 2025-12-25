import { expect } from 'chai';
import { PluginRegistry } from '../server/plugins/registry';
import { PluginRuntime } from '../server/plugins/runtime';
import { MemStorage } from '../server/storage';
import type { PluginManifest, PluginEvent } from '../server/plugins/types';

describe('Plugin System', () => {
  let storage: MemStorage;
  let registry: PluginRegistry;
  let runtime: PluginRuntime;

  beforeEach(() => {
    storage = new MemStorage();
    registry = new PluginRegistry(storage);
    runtime = new PluginRuntime();
  });

  describe('PluginRegistry', () => {
    it('should validate plugin manifest', async () => {
      const invalidManifest: any = {
        name: 'Test Plugin',
        // Missing required fields
      };

      try {
        await registry['validateManifest'](invalidManifest);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).to.include('must have a valid');
      }
    });

    it('should list all plugins', () => {
      const plugins = registry.listPlugins();
      expect(plugins).to.be.an('array');
    });

    it('should emit events on plugin lifecycle', (done) => {
      registry.once('plugin:enabled', (pluginId) => {
        expect(pluginId).to.be.a('string');
        done();
      });

      // Simulate plugin enable (would need a real plugin for full test)
    });
  });

  describe('PluginRuntime', () => {
    it('should execute code with timeout', async () => {
      const code = 'result = 2 + 2';
      const context = { result: 0 };

      const result = await runtime.executeSandboxedCode(code, context);

      expect(result.success).to.be.true;
      expect(result.duration).to.be.a('number');
    });

    it('should timeout long-running code', async () => {
      const code = 'while(true) {}';
      const context = {};

      const result = await runtime.executeSandboxedCode(code, context, {
        timeout: 100,
      });

      expect(result.success).to.be.false;
      expect(result.error).to.include('timeout');
    });

    it('should handle errors in code execution', async () => {
      const code = 'throw new Error("Test error")';
      const context = {};

      const result = await runtime.executeSandboxedCode(code, context);

      expect(result.success).to.be.false;
      expect(result.error).to.include('Test error');
    });

    it('should isolate sandbox from global context', async () => {
      const code = 'typeof setTimeout';
      const context = {};

      const result = await runtime.executeSandboxedCode(code, context);

      expect(result.success).to.be.true;
      expect(result.result).to.equal('undefined');
    });
  });

  describe('Plugin Context', () => {
    it('should provide storage API to plugins', async () => {
      const pluginId = 'test-plugin';
      const context = registry['createPluginContext'](pluginId, {});

      await context.storage.set('test-key', { value: 'test' });
      const retrieved = await context.storage.get('test-key');

      expect(retrieved).to.deep.equal({ value: 'test' });
    });

    it('should provide logger API to plugins', () => {
      const pluginId = 'test-plugin';
      const context = registry['createPluginContext'](pluginId, {});

      expect(context.logger.info).to.be.a('function');
      expect(context.logger.error).to.be.a('function');
      expect(context.logger.warn).to.be.a('function');
      expect(context.logger.debug).to.be.a('function');

      context.logger.info('Test message');
    });

    it('should provide event emitter to plugins', () => {
      const pluginId = 'test-plugin';
      const context = registry['createPluginContext'](pluginId, {});

      let eventReceived = false;

      context.events.on('test-event', () => {
        eventReceived = true;
      });

      context.events.emit('test-event');

      expect(eventReceived).to.be.true;
    });
  });
});
