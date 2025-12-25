import { manifestRegistry, type CanvasDisplay, type CanvasField, type Visibility } from '../core/registry';

interface IntrospectionResponse {
  data?: {
    __schema?: {
      queryType?: { name: string };
      mutationType?: { name: string };
      types?: IntrospectionType[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface IntrospectionType {
  kind: string;
  name: string;
  fields?: IntrospectionField[];
}

interface IntrospectionField {
  name: string;
  description?: string;
  args?: Array<{ name: string; type: IntrospectionTypeRef; description?: string }>;
  type: IntrospectionTypeRef;
}

interface IntrospectionTypeRef {
  name?: string;
  kind: string;
  ofType?: IntrospectionTypeRef;
}

export async function registerGraphQL(
  endpoint: string,
  headers?: Record<string, string>
): Promise<{ registered: number; queries: string[]; mutations: string[]; errors: string[] }> {
  const introspectionQuery = `
    query IntrospectionQuery {
      __schema {
        queryType { name }
        mutationType { name }
        types {
          kind
          name
          fields {
            name
            description
            args { name description type { name kind ofType { name kind ofType { name kind } } } }
            type { name kind ofType { name kind ofType { name kind } } }
          }
        }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ query: introspectionQuery }),
  });

  const introspection = (await response.json()) as IntrospectionResponse;
  
  if (introspection.errors?.length) {
    return { 
      registered: 0, 
      queries: [], 
      mutations: [], 
      errors: introspection.errors.map(e => e.message) 
    };
  }

  const schema = introspection.data?.__schema;
  if (!schema) {
    return { registered: 0, queries: [], mutations: [], errors: ['Failed to introspect schema'] };
  }

  const queryTypeName = schema.queryType?.name || 'Query';
  const mutationTypeName = schema.mutationType?.name || 'Mutation';
  const types = schema.types || [];
  const typeMap = new Map(types.map(t => [t.name, t]));

  const queries: string[] = [];
  const mutations: string[] = [];
  const errors: string[] = [];

  const queryType = typeMap.get(queryTypeName);
  const mutationType = typeMap.get(mutationTypeName);

  if (queryType?.fields) {
    for (const field of queryType.fields) {
      if (field.name.startsWith('__')) continue;
      
      const key = `graphql:query:${field.name}`;
      
      try {
        const display = buildGraphQLDisplay(field, typeMap, 'query');

        await manifestRegistry.registerEndpoint({
          'devkit.key': key,
          name: formatGraphQLName(field.name),
          method: 'POST',
          url: endpoint,
          params: buildGraphQLParams(field.args),
          returns: { graphqlField: field.name, type: describeType(field.type) },
          'security.visibility': 'public' as Visibility,
          'canvas.display': display,
          'telemetry.tags': ['graphql', 'query'],
          source: 'graphql',
        });

        queries.push(key);
      } catch (e) {
        errors.push(`${key}: ${(e as Error).message}`);
      }
    }
  }

  if (mutationType?.fields) {
    for (const field of mutationType.fields) {
      if (field.name.startsWith('__')) continue;
      
      const flowKey = `graphql:mutation:${field.name}`;

      try {
        await manifestRegistry.registerFlow({
          'devkit.key': flowKey,
          name: formatGraphQLName(field.name),
          description: field.description,
          steps: [{ id: 'mutation', name: field.name, endpoint: `POST ${endpoint}` }],
          'security.visibility': 'wallet-gated' as Visibility,
          'canvas.display': {
            type: 'pipeline',
            title: `Mutation: ${formatGraphQLName(field.name)}`,
            subtitle: field.description || 'GraphQL mutation',
            steps: [{ id: 'mutation', name: field.name, kind: 'external' }],
          },
          'telemetry.tags': ['graphql', 'mutation'],
          source: 'graphql',
        });

        mutations.push(flowKey);
      } catch (e) {
        errors.push(`${flowKey}: ${(e as Error).message}`);
      }
    }
  }

  return { registered: queries.length + mutations.length, queries, mutations, errors };
}

function formatGraphQLName(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

function describeType(type: IntrospectionTypeRef): string {
  if (type.kind === 'NON_NULL') return `${describeType(type.ofType!)}!`;
  if (type.kind === 'LIST') return `[${describeType(type.ofType!)}]`;
  return type.name || 'Unknown';
}

function buildGraphQLParams(args?: IntrospectionField['args']): Record<string, { type: string; required?: boolean; description?: string }> | undefined {
  if (!args?.length) return undefined;
  
  const params: Record<string, { type: string; required?: boolean; description?: string }> = {};
  
  for (const arg of args) {
    const isRequired = arg.type.kind === 'NON_NULL';
    params[arg.name] = {
      type: describeType(arg.type),
      required: isRequired,
      description: arg.description,
    };
  }
  
  return params;
}

function buildGraphQLDisplay(
  field: IntrospectionField,
  typeMap: Map<string, IntrospectionType>,
  queryType: 'query' | 'mutation'
): CanvasDisplay {
  const returnType = unwrapType(field.type);
  const isList = isListType(field.type);
  const objectType = typeMap.get(returnType);
  
  const fields = extractFieldsFromType(objectType);
  
  return {
    type: isList ? 'table' : 'card',
    title: formatGraphQLName(field.name),
    subtitle: field.description || `GraphQL ${queryType}`,
    fields,
    actions: field.args?.length ? [{
      label: 'Execute',
      invokeFlow: `graphql:${queryType}:${field.name}`,
      params: field.args.map(a => a.name),
    }] : undefined,
  };
}

function unwrapType(type: IntrospectionTypeRef): string {
  if (type.ofType) return unwrapType(type.ofType);
  return type.name || 'Unknown';
}

function isListType(type: IntrospectionTypeRef): boolean {
  if (type.kind === 'LIST') return true;
  if (type.ofType) return isListType(type.ofType);
  return false;
}

function extractFieldsFromType(type?: IntrospectionType): CanvasField[] {
  if (!type?.fields) {
    return [{ label: 'Result', key: 'data', format: 'text' }];
  }
  
  const priorityKeys = ['id', 'name', 'title', 'email', 'status', 'createdAt', 'updatedAt'];
  const fields = type.fields.filter(f => !f.name.startsWith('__'));
  
  const sorted = [
    ...priorityKeys.filter(k => fields.some(f => f.name === k)),
    ...fields.map(f => f.name).filter(n => !priorityKeys.includes(n)),
  ].slice(0, 8);
  
  return sorted.map(name => {
    const field = fields.find(f => f.name === name)!;
    return {
      label: formatGraphQLName(name),
      key: name,
      format: inferGraphQLFormat(field.type),
    };
  });
}

function inferGraphQLFormat(type: IntrospectionTypeRef): CanvasField['format'] {
  const typeName = unwrapType(type).toLowerCase();
  if (typeName.includes('date') || typeName.includes('time')) return 'date';
  if (typeName === 'int' || typeName === 'float' || typeName.includes('number')) return 'number';
  if (typeName.includes('money') || typeName.includes('price') || typeName.includes('amount')) return 'currency';
  return 'text';
}
