import type { ManifestSubmission } from './gateway';
import { getApprovedManifests } from './queue';
import { rootLogger } from '../../observability/logger';

const logger = rootLogger.child({ module: 'scanner-registry-builder' });

export interface BuiltRegistry {
  version: string;
  buildTime: number;
  apps: Record<string, AppEntry>;
  endpoints: Record<string, EndpointEntry>;
  routes: Record<string, RouteEntry>;
}

export interface AppEntry {
  id: string;
  name: string;
  version: string;
  entry: string;
  description?: string;
  icon?: string;
  category?: string;
  permissions: string[];
  publishedAt: number;
}

export interface EndpointEntry {
  app: string;
  version: string;
  fn: string;
  args: Record<string, string>;
  scopes: string[];
  description?: string;
}

export interface RouteEntry {
  app: string;
  href: string;
}

let currentRegistry: BuiltRegistry | null = null;
let registryVersion = 0;

export async function buildApprovedRegistry(): Promise<BuiltRegistry> {
  const manifests = getApprovedManifests();
  
  const registry: BuiltRegistry = {
    version: `1.0.${++registryVersion}`,
    buildTime: Date.now(),
    apps: {},
    endpoints: {},
    routes: {},
  };

  for (const manifest of manifests) {
    // Add app entry
    registry.apps[manifest.id] = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      entry: manifest.entry,
      description: manifest.description,
      icon: manifest.icon,
      category: manifest.category,
      permissions: manifest.permissions || [],
      publishedAt: Date.now(),
    };

    // Add endpoints
    if (manifest.endpoints) {
      for (const [key, ep] of Object.entries(manifest.endpoints)) {
        registry.endpoints[key] = {
          app: manifest.id,
          version: manifest.version,
          fn: ep.fn,
          args: ep.args || {},
          scopes: ep.scopes || [],
          description: ep.description,
        };
      }
    }

    // Add routes
    if (manifest.routes) {
      for (const [key, href] of Object.entries(manifest.routes)) {
        registry.routes[key] = {
          app: manifest.id,
          href: href as string,
        };
      }
    }
  }

  currentRegistry = registry;
  
  logger.info('Registry built', {
    version: registry.version,
    appCount: Object.keys(registry.apps).length,
    endpointCount: Object.keys(registry.endpoints).length,
    routeCount: Object.keys(registry.routes).length,
  });

  return registry;
}

export function getCurrentRegistry(): BuiltRegistry | null {
  return currentRegistry;
}

export async function rebuildRegistry(): Promise<BuiltRegistry> {
  return buildApprovedRegistry();
}

export function mergeWithCoreRegistry(
  coreRegistry: any,
  approvedRegistry: BuiltRegistry
): any {
  // Merge approved third-party apps with core P3 apps
  return {
    version: approvedRegistry.version,
    buildTime: approvedRegistry.buildTime,
    apps: {
      ...coreRegistry.apps,
      ...approvedRegistry.apps,
    },
    endpoints: {
      ...coreRegistry.endpoints,
      ...approvedRegistry.endpoints,
    },
    routes: {
      ...coreRegistry.routes,
      ...approvedRegistry.routes,
    },
  };
}
