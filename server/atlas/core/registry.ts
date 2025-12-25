export type Visibility = 'public' | 'wallet-gated' | 'admin-only';

export interface CanvasField {
  label: string;
  key: string;
  format: 'text' | 'number' | 'currency' | 'percentage' | 'time' | 'date';
}

export interface CanvasStep {
  id: string;
  name: string;
  kind?: 'fetch' | 'transform' | 'aggregate' | 'external';
  expectedOutput?: string;
}

export interface CanvasAction {
  label: string;
  invokeFlow?: string;
  params?: string[];
}

export interface CanvasDisplay {
  type: 'card' | 'pipeline' | 'table';
  title: string;
  subtitle?: string;
  fields?: CanvasField[];
  steps?: CanvasStep[];
  actions?: CanvasAction[];
}

export interface ManifestEndpoint {
  'devkit.key': string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  params?: Record<string, { type: string; required?: boolean; description?: string }>;
  returns?: unknown;
  'security.visibility': Visibility;
  'security.ownerWallet'?: string;
  'security.collaborators'?: string[];
  'canvas.display': CanvasDisplay;
  'telemetry.tags'?: string[];
  'semantics.phrases'?: string[];
  'chat.enabled'?: boolean;
  'chat.authMode'?: 'owner' | 'collaborators' | 'public';
  source?: 'atlas' | 'openapi' | 'graphql' | 'jsonschema';
  handler?: { wrapsEventPublisher?: boolean };
}

export interface ManifestFlow {
  'devkit.key': string;
  name: string;
  description?: string;
  steps: Array<{ id: string; name: string; endpoint: string }>;
  'security.visibility': Visibility;
  'canvas.display': CanvasDisplay;
  'telemetry.tags'?: string[];
  source?: 'atlas' | 'openapi' | 'graphql' | 'jsonschema';
}

export interface ValidationError {
  field: string;
  message: string;
}

class ManifestRegistry {
  private endpoints = new Map<string, ManifestEndpoint>();
  private flows = new Map<string, ManifestFlow>();

  async registerEndpoint(ep: ManifestEndpoint): Promise<{ valid: boolean; errors: ValidationError[] }> {
    const errors = this.validateEndpointFull(ep);
    if (errors.length > 0) {
      console.warn(`[Registry] Endpoint ${ep['devkit.key']} has validation errors:`, errors);
    }
    
    ep.handler = { wrapsEventPublisher: true };
    this.endpoints.set(ep['devkit.key'], ep);
    return { valid: errors.length === 0, errors };
  }

  async registerFlow(flow: ManifestFlow): Promise<{ valid: boolean; errors: ValidationError[] }> {
    const errors = this.validateFlowFull(flow);
    if (errors.length > 0) {
      console.warn(`[Registry] Flow ${flow['devkit.key']} has validation errors:`, errors);
    }
    
    this.flows.set(flow['devkit.key'], flow);
    return { valid: errors.length === 0, errors };
  }

  private validateEndpointFull(ep: ManifestEndpoint): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!ep['devkit.key']) {
      errors.push({ field: 'devkit.key', message: 'Required' });
    }
    
    if (!ep.name) {
      errors.push({ field: 'name', message: 'Required' });
    }
    
    if (!ep.method) {
      errors.push({ field: 'method', message: 'Required' });
    }
    
    if (!ep.url) {
      errors.push({ field: 'url', message: 'Required' });
    }
    
    if (!ep['security.visibility']) {
      errors.push({ field: 'security.visibility', message: 'Required (public|wallet-gated|admin-only)' });
    }
    
    if (!ep['canvas.display']) {
      errors.push({ field: 'canvas.display', message: 'Required for Canvas visualization' });
    } else {
      if (!ep['canvas.display'].type) {
        errors.push({ field: 'canvas.display.type', message: 'Required (card|pipeline|table)' });
      }
      if (!ep['canvas.display'].title) {
        errors.push({ field: 'canvas.display.title', message: 'Required for Canvas rendering' });
      }
      if (ep['canvas.display'].type === 'card' && (!ep['canvas.display'].fields || ep['canvas.display'].fields.length === 0)) {
        errors.push({ field: 'canvas.display.fields', message: 'Card type requires at least one field' });
      }
      if (ep['canvas.display'].type === 'table' && (!ep['canvas.display'].fields || ep['canvas.display'].fields.length === 0)) {
        errors.push({ field: 'canvas.display.fields', message: 'Table type requires at least one field' });
      }
    }
    
    return errors;
  }

  private validateFlowFull(flow: ManifestFlow): ValidationError[] {
    const errors: ValidationError[] = [];
    
    if (!flow['devkit.key']) {
      errors.push({ field: 'devkit.key', message: 'Required' });
    }
    
    if (!flow.name) {
      errors.push({ field: 'name', message: 'Required' });
    }
    
    if (!flow.steps || flow.steps.length === 0) {
      errors.push({ field: 'steps', message: 'Flow requires at least one step' });
    } else {
      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        if (!step.id) errors.push({ field: `steps[${i}].id`, message: 'Required' });
        if (!step.name) errors.push({ field: `steps[${i}].name`, message: 'Required' });
        if (!step.endpoint) errors.push({ field: `steps[${i}].endpoint`, message: 'Required' });
      }
    }
    
    if (!flow['security.visibility']) {
      errors.push({ field: 'security.visibility', message: 'Required' });
    }
    
    if (!flow['canvas.display']) {
      errors.push({ field: 'canvas.display', message: 'Required for Canvas visualization' });
    } else {
      if (!flow['canvas.display'].type) {
        errors.push({ field: 'canvas.display.type', message: 'Required' });
      }
      if (!flow['canvas.display'].title) {
        errors.push({ field: 'canvas.display.title', message: 'Required' });
      }
      if (flow['canvas.display'].type === 'pipeline' && (!flow['canvas.display'].steps || flow['canvas.display'].steps.length === 0)) {
        errors.push({ field: 'canvas.display.steps', message: 'Pipeline requires canvas steps to render' });
      }
    }
    
    return errors;
  }

  getEndpoint(key: string): ManifestEndpoint | undefined {
    return this.endpoints.get(key);
  }

  getFlow(key: string): ManifestFlow | undefined {
    return this.flows.get(key);
  }

  listEndpoints(): ManifestEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  listFlows(): ManifestFlow[] {
    return Array.from(this.flows.values());
  }

  listAll(): Array<ManifestEndpoint | ManifestFlow> {
    return [...this.listEndpoints(), ...this.listFlows()];
  }

  getCanvasRenderables(): Array<{ key: string; display: CanvasDisplay; visibility: Visibility; type: 'endpoint' | 'flow'; source?: string }> {
    const result: Array<{ key: string; display: CanvasDisplay; visibility: Visibility; type: 'endpoint' | 'flow'; source?: string }> = [];
    
    for (const ep of this.endpoints.values()) {
      result.push({
        key: ep['devkit.key'],
        display: ep['canvas.display'],
        visibility: ep['security.visibility'],
        type: 'endpoint',
        source: ep.source,
      });
    }
    
    for (const flow of this.flows.values()) {
      result.push({
        key: flow['devkit.key'],
        display: flow['canvas.display'],
        visibility: flow['security.visibility'],
        type: 'flow',
        source: flow.source,
      });
    }
    
    return result;
  }

  hasEventPublisher(key: string): boolean {
    const ep = this.endpoints.get(key);
    if (ep) return Boolean(ep.handler?.wrapsEventPublisher);
    
    const flow = this.flows.get(key);
    return Boolean(flow && flow.steps.length > 0);
  }

  clear(): void {
    this.endpoints.clear();
    this.flows.clear();
  }
}

export const manifestRegistry = new ManifestRegistry();
