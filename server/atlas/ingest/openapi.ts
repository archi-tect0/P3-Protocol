import { manifestRegistry, type CanvasDisplay, type CanvasField, type CanvasAction, type Visibility } from '../core/registry';

interface OpenAPISpec {
  openapi?: string;
  info?: { title?: string; version?: string };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, OpenAPIOperation>>;
  components?: { schemas?: Record<string, JSONSchema> };
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  'x-visibility'?: Visibility;
  'x-canvas-actions'?: Array<{ label: string; invokeFlow?: string; params?: string[] }>;
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type: string } }>;
  requestBody?: { content?: Record<string, { schema?: JSONSchema }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: JSONSchema }> }>;
}

interface JSONSchema {
  type?: string;
  format?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  $ref?: string;
  enum?: string[];
}

export type CanvasOverrides = Record<string, Partial<CanvasDisplay>>;

export async function registerOpenAPI(specText: string, overrides?: CanvasOverrides): Promise<{ registered: number; keys: string[]; errors: string[] }> {
  const spec = typeof specText === 'string' ? JSON.parse(specText) as OpenAPISpec : specText as OpenAPISpec;
  const baseUrl = spec.servers?.[0]?.url || '';
  const keys: string[] = [];
  const errors: string[] = [];

  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== 'object' || method.startsWith('x-')) continue;
      
      const key = `openapi:${op.operationId ?? `${method}:${path}`}`;
      const responseSchema = resolveSchema(op.responses?.['200']?.content?.['application/json']?.schema, spec.components?.schemas);
      const visibility = (op['x-visibility'] ?? 'public') as Visibility;

      try {
        const canvasDisplay = buildCanvasDisplay(key, responseSchema, op, overrides?.[key]);
        
        await manifestRegistry.registerEndpoint({
          'devkit.key': key,
          name: op.summary ?? formatOperationName(op.operationId, method, path),
          method: method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          url: joinUrl(baseUrl, path),
          params: extractParams(op.parameters, op.requestBody, spec.components?.schemas),
          returns: responseSchema,
          'security.visibility': visibility,
          'canvas.display': canvasDisplay,
          'telemetry.tags': op.tags,
          source: 'openapi',
        });

        keys.push(key);
      } catch (e) {
        errors.push(`${key}: ${(e as Error).message}`);
      }
    }
  }

  return { registered: keys.length, keys, errors };
}

function resolveSchema(schema: JSONSchema | undefined, schemas?: Record<string, JSONSchema>): JSONSchema | undefined {
  if (!schema) return undefined;
  if (schema.$ref && schemas) {
    const refName = schema.$ref.replace('#/components/schemas/', '');
    return schemas[refName];
  }
  return schema;
}

function joinUrl(base: string, path: string): string {
  if (!base) return path;
  return base.replace(/\/$/, '') + path;
}

function formatOperationName(operationId?: string, method?: string, path?: string): string {
  if (operationId) {
    return operationId
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .trim()
      .replace(/^\w/, c => c.toUpperCase());
  }
  return `${method?.toUpperCase()} ${path}`;
}

function extractParams(
  params?: OpenAPIOperation['parameters'],
  requestBody?: OpenAPIOperation['requestBody'],
  schemas?: Record<string, JSONSchema>
): Record<string, { type: string; required?: boolean; description?: string }> | undefined {
  const result: Record<string, { type: string; required?: boolean; description?: string }> = {};
  
  if (params) {
    for (const p of params) {
      result[p.name] = { 
        type: p.schema?.type || 'string', 
        required: p.required,
      };
    }
  }
  
  const bodySchema = requestBody?.content?.['application/json']?.schema;
  if (bodySchema) {
    const resolved = resolveSchema(bodySchema, schemas);
    if (resolved?.properties) {
      for (const [name, prop] of Object.entries(resolved.properties)) {
        result[name] = {
          type: prop.type || 'string',
          required: resolved.required?.includes(name),
          description: prop.description,
        };
      }
    }
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

function buildCanvasDisplay(
  key: string,
  schema: JSONSchema | undefined,
  op: OpenAPIOperation,
  override?: Partial<CanvasDisplay>
): CanvasDisplay {
  if (override?.type && override?.title) {
    return {
      type: override.type,
      title: override.title,
      subtitle: override.subtitle,
      fields: override.fields || extractFieldsFromSchema(schema),
      actions: override.actions,
    };
  }
  
  const isArray = schema?.type === 'array';
  const itemSchema = isArray ? schema?.items : schema;
  const fields = extractFieldsFromSchema(itemSchema);
  const actions = op['x-canvas-actions'] || inferActionsFromSchema(key, itemSchema);
  
  return {
    type: isArray ? 'table' : 'card',
    title: op.summary || formatOperationName(op.operationId),
    subtitle: op.tags?.join(', ') || 'OpenAPI',
    fields,
    actions,
    ...override,
  };
}

function extractFieldsFromSchema(schema: JSONSchema | undefined): CanvasField[] {
  if (!schema?.properties) {
    return [{ label: 'Result', key: 'data', format: 'text' }];
  }
  
  const fields: CanvasField[] = [];
  const priorityKeys = ['id', 'name', 'title', 'email', 'status', 'price', 'amount', 'count', 'date', 'created'];
  const props = schema.properties;
  const keys = Object.keys(props);
  
  const sortedKeys = [
    ...priorityKeys.filter(k => keys.includes(k)),
    ...keys.filter(k => !priorityKeys.includes(k)),
  ].slice(0, 8);
  
  for (const key of sortedKeys) {
    const prop = props[key];
    fields.push({
      label: formatLabel(key),
      key,
      format: inferFormat(prop),
    });
  }
  
  return fields;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function inferFormat(prop: JSONSchema): CanvasField['format'] {
  if (prop.format === 'date' || prop.format === 'date-time') return 'date';
  if (prop.format === 'time') return 'time';
  if (prop.format === 'currency' || prop.description?.toLowerCase().includes('price')) return 'currency';
  if (prop.format === 'percent' || prop.description?.toLowerCase().includes('percent')) return 'percentage';
  if (prop.type === 'number' || prop.type === 'integer') return 'number';
  return 'text';
}

function inferActionsFromSchema(key: string, schema: JSONSchema | undefined): CanvasAction[] {
  const actions: CanvasAction[] = [];
  
  if (schema?.properties?.id) {
    const baseName = key.replace(/^openapi:/, '').replace(/:.*$/, '');
    
    if (key.includes('list') || key.includes('get')) {
      actions.push({
        label: 'View Details',
        invokeFlow: `${baseName}:getById`,
        params: ['id'],
      });
    }
  }
  
  return actions;
}
