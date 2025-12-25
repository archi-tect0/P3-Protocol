import { EventEmitter } from 'events';
import type { IStorage } from '../storage';
import type {
  PluginManifest,
  PluginInstance,
  PluginSource,
  PluginAPIContext,
  PluginStorageAPI,
  PluginLogger,
} from './types';

/**
 * Plugin Registry
 * Manages plugin installation, configuration, and lifecycle
 */
export class PluginRegistry extends EventEmitter {
  private plugins: Map<string, PluginInstance> = new Map();
  private storage: IStorage;

  constructor(storage: IStorage) {
    super();
    this.storage = storage;
  }

  /**
   * Install a plugin from various sources
   */
  async installPlugin(
    source: PluginSource,
    config?: Record<string, any>
  ): Promise<string> {
    let manifest: PluginManifest;
    let module: any;

    try {
      // Load plugin based on source type
      switch (source.type) {
        case 'npm':
          ({ manifest, module } = await this.loadNpmPlugin(
            source.package,
            source.version
          ));
          break;
        case 'local':
          ({ manifest, module } = await this.loadLocalPlugin(source.path));
          break;
        case 'url':
          ({ manifest, module } = await this.loadUrlPlugin(source.url));
          break;
        default:
          throw new Error(`Unsupported plugin source type`);
      }

      // Validate manifest
      this.validateManifest(manifest);

      // Check if plugin already installed
      const existing = await this.storage.getTrustPlugin(manifest.id);
      if (existing) {
        throw new Error(`Plugin ${manifest.id} is already installed`);
      }

      // Create plugin context
      const context = this.createPluginContext(manifest.id, config || {});

      // Store plugin instance
      const instance: PluginInstance = {
        manifest,
        module,
        context,
        enabled: false,
      };

      this.plugins.set(manifest.id, instance);

      // Save to database
      // installedBy defaults to 'system' for programmatic installations
      // In API context, this would be set to the authenticated user ID
      await this.storage.createTrustPlugin({
        pluginId: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        config: config || {},
        status: 'disabled',
        installedBy: 'system',
      });

      // Run onInstall hook if present
      if (manifest.hooks?.onInstall && module[manifest.hooks.onInstall]) {
        await this.executeHook(instance, manifest.hooks.onInstall);
      }

      this.emit('plugin:installed', manifest.id);

      return manifest.id;
    } catch (error) {
      throw new Error(
        `Failed to install plugin: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (instance.enabled) {
      return;
    }

    // Check permissions
    this.validatePermissions(instance.manifest.permissions);

    // Run onEnable hook
    if (
      instance.manifest.hooks?.onEnable &&
      instance.module[instance.manifest.hooks.onEnable]
    ) {
      await this.executeHook(instance, instance.manifest.hooks.onEnable);
    }

    instance.enabled = true;

    // Update database
    await this.storage.updateTrustPlugin(pluginId, { status: 'enabled' });

    this.emit('plugin:enabled', pluginId);
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!instance.enabled) {
      return;
    }

    // Run onDisable hook
    if (
      instance.manifest.hooks?.onDisable &&
      instance.module[instance.manifest.hooks.onDisable]
    ) {
      await this.executeHook(instance, instance.manifest.hooks.onDisable);
    }

    instance.enabled = false;

    // Update database
    await this.storage.updateTrustPlugin(pluginId, { status: 'disabled' });

    this.emit('plugin:disabled', pluginId);
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Disable first if enabled
    if (instance.enabled) {
      await this.disablePlugin(pluginId);
    }

    // Run onUninstall hook
    if (
      instance.manifest.hooks?.onUninstall &&
      instance.module[instance.manifest.hooks.onUninstall]
    ) {
      await this.executeHook(instance, instance.manifest.hooks.onUninstall);
    }

    // Remove from memory
    this.plugins.delete(pluginId);

    // Note: We don't delete from database to maintain audit trail
    // Just mark as disabled

    this.emit('plugin:uninstalled', pluginId);
  }

  /**
   * Get plugin instance
   */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * List all plugins
   */
  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Update plugin configuration
   */
  async updatePluginConfig(
    pluginId: string,
    config: Record<string, any>
  ): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    instance.context.config = { ...instance.context.config, ...config };

    await this.storage.updateTrustPlugin(pluginId, { config });

    this.emit('plugin:config:updated', pluginId);
  }

  /**
   * Load plugin from NPM package
   */
  private async loadNpmPlugin(
    packageName: string,
    version?: string
  ): Promise<{ manifest: PluginManifest; module: any }> {
    // In production, this would use npm/yarn to install the package
    // For now, we'll throw an error as this requires external package management
    throw new Error(
      'NPM plugin installation not yet implemented. Use local plugins instead.'
    );
  }

  /**
   * Load plugin from local path
   */
  private async loadLocalPlugin(
    path: string
  ): Promise<{ manifest: PluginManifest; module: any }> {
    try {
      // Dynamic import of the plugin
      const module = await import(path);
      
      if (!module.manifest) {
        throw new Error('Plugin must export a manifest');
      }

      return {
        manifest: module.manifest as PluginManifest,
        module,
      };
    } catch (error) {
      throw new Error(
        `Failed to load local plugin: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Load plugin from URL
   */
  private async loadUrlPlugin(
    url: string
  ): Promise<{ manifest: PluginManifest; module: any }> {
    throw new Error('URL plugin installation not yet implemented');
  }

  /**
   * Validate plugin manifest
   */
  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.id || typeof manifest.id !== 'string') {
      throw new Error('Plugin manifest must have a valid id');
    }

    if (!manifest.name || typeof manifest.name !== 'string') {
      throw new Error('Plugin manifest must have a valid name');
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      throw new Error('Plugin manifest must have a valid version');
    }

    if (!manifest.permissions || typeof manifest.permissions !== 'object') {
      throw new Error('Plugin manifest must have permissions object');
    }
  }

  /**
   * Validate plugin permissions
   */
  private validatePermissions(permissions: Record<string, boolean>): void {
    // In production, this would check against system policies
    // For now, we allow all permissions
  }

  /**
   * Create plugin API context
   */
  private createPluginContext(
    pluginId: string,
    config: Record<string, any>
  ): PluginAPIContext {
    const storage: PluginStorageAPI = {
      get: async (key: string) => {
        const configs = await this.storage.getTrustConfig(
          `plugin:${pluginId}:${key}`
        );
        return configs.length > 0 ? configs[0].value : null;
      },
      set: async (key: string, value: any) => {
        await this.storage.createTrustConfig({
          key: `plugin:${pluginId}:${key}`,
          value,
          version: 1,
          createdBy: 'system',
        });
      },
      delete: async (key: string) => {
        await this.storage.updateTrustConfig(
          `plugin:${pluginId}:${key}`,
          null,
          'system'
        );
      },
      list: async (prefix?: string) => {
        const allConfigs = await this.storage.getTrustConfig();
        const pluginPrefix = `plugin:${pluginId}:${prefix || ''}`;
        return allConfigs
          .filter((c) => c.key.startsWith(pluginPrefix))
          .map((c) => c.key.replace(`plugin:${pluginId}:`, ''));
      },
    };

    const logger: PluginLogger = {
      info: (message: string, meta?: Record<string, any>) => {
        console.log(`[Plugin:${pluginId}] INFO:`, message, meta || '');
      },
      warn: (message: string, meta?: Record<string, any>) => {
        console.warn(`[Plugin:${pluginId}] WARN:`, message, meta || '');
      },
      error: (message: string, meta?: Record<string, any>) => {
        console.error(`[Plugin:${pluginId}] ERROR:`, message, meta || '');
      },
      debug: (message: string, meta?: Record<string, any>) => {
        console.debug(`[Plugin:${pluginId}] DEBUG:`, message, meta || '');
      },
    };

    return {
      storage,
      events: new EventEmitter(),
      logger,
      config,
    };
  }

  /**
   * Execute plugin hook
   */
  private async executeHook(
    instance: PluginInstance,
    hookName: string
  ): Promise<void> {
    try {
      const hookFn = instance.module[hookName];
      if (typeof hookFn === 'function') {
        await hookFn(instance.context);
      }
    } catch (error) {
      console.error(
        `Error executing hook ${hookName} for plugin ${instance.manifest.id}:`,
        error
      );
      throw error;
    }
  }
}
