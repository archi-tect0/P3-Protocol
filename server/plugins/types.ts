import { EventEmitter } from 'events';

/**
 * Plugin API Context - Limited API surface exposed to plugins
 */
export interface PluginAPIContext {
  storage: PluginStorageAPI;
  events: EventEmitter;
  logger: PluginLogger;
  config: Record<string, any>;
}

/**
 * Limited storage API for plugins
 */
export interface PluginStorageAPI {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

/**
 * Plugin logger interface
 */
export interface PluginLogger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

/**
 * Plugin metadata and manifest
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  permissions: PluginPermissions;
  dependencies?: Record<string, string>;
  hooks?: PluginHooks;
}

/**
 * Plugin permissions
 */
export interface PluginPermissions {
  storage?: boolean;
  network?: boolean;
  events?: boolean;
  webhooks?: boolean;
  ledger?: boolean;
}

/**
 * Plugin hooks - lifecycle and event hooks
 */
export interface PluginHooks {
  onInstall?: string;
  onEnable?: string;
  onDisable?: string;
  onUninstall?: string;
  onEvent?: string;
  onRuleMatch?: string;
}

/**
 * Plugin instance - represents a loaded plugin
 */
export interface PluginInstance {
  manifest: PluginManifest;
  module: any;
  context: PluginAPIContext;
  enabled: boolean;
}

/**
 * Plugin execution result
 */
export interface PluginExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
}

/**
 * Plugin installation source
 */
export type PluginSource =
  | { type: 'npm'; package: string; version?: string }
  | { type: 'local'; path: string }
  | { type: 'url'; url: string };

/**
 * Plugin event data
 */
export interface PluginEvent {
  type: string;
  payload: any;
  timestamp: Date;
  source?: string;
}

/**
 * Plugin sandbox options
 */
export interface PluginSandboxOptions {
  timeout?: number;
  memoryLimit?: number;
  cpuLimit?: number;
}
