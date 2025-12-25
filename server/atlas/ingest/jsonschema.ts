import { manifestRegistry, type CanvasDisplay, type CanvasField, type CanvasAction, type Visibility } from '../core/registry';

interface JSONSchemaEndpointOptions {
  key: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  returns: JSONSchema;
  visibility?: Visibility;
  title?: string;
  subtitle?: string;
  tags?: string[];
  phrases?: string[];
  actions?: CanvasAction[];
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchema;
  required?: string[];
  format?: string;
  description?: string;
  title?: string;
  enum?: string[];
  $ref?: string;
}

interface JSONSchemaProperty {
  type?: string;
  format?: string;
  description?: string;
  title?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
}

export async function registerJSONSchemaEndpoint(opts: JSONSchemaEndpointOptions): Promise<{ key: string; valid: boolean; errors: string[] }> {
  const display = buildCanvasFromJsonSchema(opts.returns, opts.title ?? opts.key, opts.subtitle, opts.actions);

  const result = await manifestRegistry.registerEndpoint({
    'devkit.key': opts.key,
    name: opts.title ?? formatKey(opts.key),
    method: opts.method,
    url: opts.url,
    returns: opts.returns,
    'security.visibility': opts.visibility ?? 'public',
    'canvas.display': display,
    'telemetry.tags': opts.tags,
    'semantics.phrases': opts.phrases,
    source: 'jsonschema',
  });

  return { 
    key: opts.key, 
    valid: result.valid, 
    errors: result.errors.map(e => `${e.field}: ${e.message}`) 
  };
}

function formatKey(key: string): string {
  return key
    .replace(/[.:_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function buildCanvasFromJsonSchema(
  schema: JSONSchema,
  title: string,
  subtitle?: string,
  actions?: CanvasAction[]
): CanvasDisplay {
  const isArray = schema.type === 'array';
  const itemSchema = isArray ? schema.items : schema;
  const fields = extractFields(itemSchema?.properties, itemSchema?.required);

  return {
    type: isArray ? 'table' : 'card',
    title,
    subtitle: subtitle || schema.description || schema.title,
    fields,
    actions: actions || inferActions(itemSchema),
  };
}

function extractFields(props?: Record<string, JSONSchemaProperty>, required?: string[]): CanvasField[] {
  if (!props) {
    return [{ label: 'Result', key: 'data', format: 'text' }];
  }

  const priorityKeys = ['id', 'name', 'title', 'email', 'status', 'price', 'amount', 'total', 'count', 'date', 'created', 'updated'];
  const keys = Object.keys(props);
  
  const sortedKeys = [
    ...priorityKeys.filter(k => keys.includes(k)),
    ...keys.filter(k => !priorityKeys.includes(k)),
  ].slice(0, 8);

  return sortedKeys.map(key => ({
    label: formatLabel(key, props[key]),
    key,
    format: formatFromSchema(props[key]),
  }));
}

function formatLabel(key: string, prop: JSONSchemaProperty): string {
  if (prop.title) return prop.title;
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function formatFromSchema(prop: JSONSchemaProperty): CanvasField['format'] {
  if (prop.format === 'date' || prop.format === 'date-time') return 'date';
  if (prop.format === 'time') return 'time';
  
  const desc = (prop.description || '').toLowerCase();
  if (prop.format === 'currency' || desc.includes('price') || desc.includes('amount') || desc.includes('cost')) {
    return 'currency';
  }
  if (prop.format === 'percent' || prop.format === 'percentage' || desc.includes('percent') || desc.includes('rate')) {
    return 'percentage';
  }
  if (prop.type === 'number' || prop.type === 'integer') return 'number';
  return 'text';
}

function inferActions(schema?: JSONSchema): CanvasAction[] | undefined {
  if (!schema?.properties) return undefined;
  
  const actions: CanvasAction[] = [];
  
  if (schema.properties.id) {
    actions.push({
      label: 'View',
      invokeFlow: 'view:details',
      params: ['id'],
    });
  }
  
  return actions.length > 0 ? actions : undefined;
}

export async function registerJSONSchemaFlow(opts: {
  key: string;
  name: string;
  description?: string;
  steps: Array<{ id: string; name: string; endpoint: string; schema?: JSONSchema }>;
  visibility?: Visibility;
  tags?: string[];
}): Promise<{ key: string; valid: boolean; errors: string[] }> {
  const canvasSteps = opts.steps.map(s => ({
    id: s.id,
    name: s.name,
    kind: 'external' as const,
    expectedOutput: s.schema?.description,
  }));

  const result = await manifestRegistry.registerFlow({
    'devkit.key': opts.key,
    name: opts.name,
    description: opts.description,
    steps: opts.steps.map(s => ({ id: s.id, name: s.name, endpoint: s.endpoint })),
    'security.visibility': opts.visibility ?? 'wallet-gated',
    'canvas.display': {
      type: 'pipeline',
      title: opts.name,
      subtitle: opts.description,
      steps: canvasSteps,
    },
    'telemetry.tags': opts.tags,
    source: 'jsonschema',
  });

  return { 
    key: opts.key, 
    valid: result.valid, 
    errors: result.errors.map(e => `${e.field}: ${e.message}`) 
  };
}

export async function registerBulkJSONSchema(specs: JSONSchemaEndpointOptions[]): Promise<{
  registered: number;
  keys: string[];
  errors: Array<{ key: string; errors: string[] }>;
}> {
  const keys: string[] = [];
  const errors: Array<{ key: string; errors: string[] }> = [];

  for (const spec of specs) {
    const result = await registerJSONSchemaEndpoint(spec);
    if (result.valid) {
      keys.push(result.key);
    } else {
      errors.push({ key: result.key, errors: result.errors });
    }
  }

  return { registered: keys.length, keys, errors };
}
