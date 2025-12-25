import type { ApiCatalogEntry, AutoFlow } from './types';
import { getApi, getAllApis, searchApis } from './catalogStore';
import { getAutoEndpoint, getAllAutoEndpoints } from './registrySynchronizer';
import { getAutoFlow, listAutoFlows } from './flowComposer';
import { getWeb3Endpoints, type Web3Endpoint } from './sourceConnectors';

const WEB3_BASE_URLS = {
  moralis: 'https://deep-index.moralis.io/api/v2.2',
  alchemy: `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY || ''}`,
  helius: 'https://api.helius.xyz/v0',
} as const;

function getWeb3ApiKey(provider: 'moralis' | 'alchemy' | 'helius'): string | null {
  switch (provider) {
    case 'moralis':
      return process.env.MORALIS_API_KEY || null;
    case 'alchemy':
      return process.env.ALCHEMY_API_KEY || null;
    case 'helius':
      return process.env.HELIUS_API_KEY || null;
    default:
      return null;
  }
}

function getWeb3Headers(provider: 'moralis' | 'alchemy' | 'helius'): Record<string, string> {
  const apiKey = getWeb3ApiKey(provider);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  
  if (provider === 'moralis' && apiKey) {
    headers['X-API-Key'] = apiKey;
  }
  
  return headers;
}

interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  apiName: string;
  endpoint: string;
}

interface FlowExecutionResult {
  success: boolean;
  flowId: string;
  flowName: string;
  steps: ExecutionResult[];
  totalDuration: number;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Atlas-MetaAdapter/1.0',
        'Accept': 'application/json',
        ...options.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function substituteParams(path: string, params: Record<string, any>): string {
  let result = path;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  return result;
}

export async function executeAutoEndpoint(
  endpointKey: string,
  params: Record<string, any> = {}
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const endpoint = getAutoEndpoint(endpointKey);
  
  if (!endpoint) {
    return {
      success: false,
      error: `Endpoint not found: ${endpointKey}`,
      duration: Date.now() - startTime,
      apiName: 'unknown',
      endpoint: endpointKey,
    };
  }

  try {
    const path = substituteParams(endpoint.path, params);
    const url = `${endpoint.baseUrl}${path}`;
    
    const response = await fetchWithTimeout(url, {
      method: endpoint.method,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('text/')) {
      data = await response.text();
    } else {
      data = { url, status: response.status, contentType };
    }

    return {
      success: true,
      data,
      duration: Date.now() - startTime,
      apiName: endpoint.apiName,
      endpoint: endpoint.fn,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      apiName: endpoint.apiName,
      endpoint: endpoint.fn,
    };
  }
}

export async function executeAutoFlow(
  flowId: string,
  params: Record<string, Record<string, any>> = {}
): Promise<FlowExecutionResult> {
  const flow = getAutoFlow(flowId);
  
  if (!flow) {
    return {
      success: false,
      flowId,
      flowName: 'Unknown',
      steps: [],
      totalDuration: 0,
    };
  }

  const stepResults: ExecutionResult[] = [];
  const startTime = Date.now();

  for (const step of flow.steps) {
    const stepParams = params[step.id] || params[step.endpointKey] || {};
    const result = await executeAutoEndpoint(step.endpointKey, stepParams);
    stepResults.push(result);
    
    if (!result.success && !step.optional) {
      break;
    }
  }

  return {
    success: stepResults.every(r => r.success),
    flowId: flow.id,
    flowName: flow.name,
    steps: stepResults,
    totalDuration: Date.now() - startTime,
  };
}

export async function executeParallelFlow(
  flowId: string,
  params: Record<string, Record<string, any>> = {}
): Promise<FlowExecutionResult> {
  const flow = getAutoFlow(flowId);
  
  if (!flow) {
    return {
      success: false,
      flowId,
      flowName: 'Unknown',
      steps: [],
      totalDuration: 0,
    };
  }

  const startTime = Date.now();

  const stepPromises = flow.steps.map(step => {
    const stepParams = params[step.id] || params[step.endpointKey] || {};
    return executeAutoEndpoint(step.endpointKey, stepParams);
  });

  const stepResults = await Promise.all(stepPromises);

  return {
    success: stepResults.every(r => r.success),
    flowId: flow.id,
    flowName: flow.name,
    steps: stepResults,
    totalDuration: Date.now() - startTime,
  };
}

export async function quickDemo(): Promise<{
  success: boolean;
  message: string;
  results: ExecutionResult[];
  duration: number;
}> {
  const startTime = Date.now();
  const endpoints = getAllAutoEndpoints().filter(e => e.auth === 'none').slice(0, 3);
  
  const results: ExecutionResult[] = [];

  for (const ep of endpoints) {
    try {
      const result = await executeAutoEndpoint(ep.key);
      results.push(result);
    } catch {
      results.push({
        success: false,
        error: 'Execution failed',
        duration: 0,
        apiName: ep.apiName,
        endpoint: ep.fn,
      });
    }
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: successCount > 0,
    message: `Executed ${successCount}/${results.length} API calls successfully`,
    results,
    duration: Date.now() - startTime,
  };
}

export function getExecutableEndpoints() {
  return getAllAutoEndpoints()
    .filter(e => e.auth === 'none')
    .map(e => ({
      key: e.key,
      name: e.apiName,
      endpoint: e.fn,
      description: e.description,
      category: e.category,
    }));
}

export function getExecutableFlows() {
  return listAutoFlows().map(f => ({
    id: f.id,
    name: f.name,
    description: f.description,
    steps: f.steps.length,
    categories: f.categories,
  }));
}

// Web3 Execution Functions
export interface Web3ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  provider: string;
  endpoint: string;
  chain?: string;
}

export async function executeWeb3Endpoint(
  endpointKey: string,
  params: Record<string, any> = {}
): Promise<Web3ExecutionResult> {
  const startTime = Date.now();
  const endpoints = getWeb3Endpoints();
  const endpoint = endpoints.find(e => e.key === endpointKey);
  
  if (!endpoint) {
    return {
      success: false,
      error: `Web3 endpoint not found: ${endpointKey}`,
      duration: Date.now() - startTime,
      provider: 'unknown',
      endpoint: endpointKey,
    };
  }

  const apiKey = getWeb3ApiKey(endpoint.provider);
  if (!apiKey) {
    return {
      success: false,
      error: `API key not configured for ${endpoint.provider}`,
      duration: Date.now() - startTime,
      provider: endpoint.provider,
      endpoint: endpoint.name,
    };
  }

  try {
    const baseUrl = WEB3_BASE_URLS[endpoint.provider];
    let path = endpoint.path;
    
    // Substitute path parameters
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
    
    // Default chain to eth if not specified
    if (path.includes('{chain}')) {
      path = path.replace('{chain}', params.chain || 'eth');
    }
    
    // Inject API key for Helius
    if (endpoint.provider === 'helius') {
      path = path.replace('{apiKey}', apiKey);
    }

    const url = `${baseUrl}${path}`;
    const headers = getWeb3Headers(endpoint.provider);
    
    let response: Response;
    
    if (endpoint.method === 'POST') {
      // Alchemy uses JSON-RPC format
      if (endpoint.provider === 'alchemy') {
        const rpcBody = endpoint.key.includes('gas_price') 
          ? { jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }
          : { jsonrpc: '2.0', method: 'alchemy_getTokenBalances', params: [params.address, 'erc20'], id: 1 };
        
        const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
        response = await fetchWithTimeout(alchemyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(rpcBody),
        });
      } else {
        response = await fetchWithTimeout(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(params),
        });
      }
    } else {
      response = await fetchWithTimeout(url, { method: 'GET', headers });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    return {
      success: true,
      data,
      duration: Date.now() - startTime,
      provider: endpoint.provider,
      endpoint: endpoint.name,
      chain: params.chain || 'eth',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
      provider: endpoint.provider,
      endpoint: endpoint.name,
    };
  }
}

export function getWeb3EndpointsList() {
  return getWeb3Endpoints().map(e => ({
    key: e.key,
    name: e.name,
    description: e.description,
    provider: e.provider,
    params: e.params,
    samplePhrases: e.samplePhrases,
    hasApiKey: !!getWeb3ApiKey(e.provider),
  }));
}

export function getWeb3Stats() {
  const endpoints = getWeb3Endpoints();
  const byProvider = endpoints.reduce((acc, e) => {
    acc[e.provider] = (acc[e.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalEndpoints: endpoints.length,
    byProvider,
    configured: {
      moralis: !!process.env.MORALIS_API_KEY,
      alchemy: !!process.env.ALCHEMY_API_KEY,
      helius: !!process.env.HELIUS_API_KEY,
    },
  };
}

export async function web3Demo(walletAddress: string): Promise<{
  success: boolean;
  message: string;
  results: Web3ExecutionResult[];
  duration: number;
}> {
  const startTime = Date.now();
  const results: Web3ExecutionResult[] = [];

  // Try Moralis wallet balance
  if (process.env.MORALIS_API_KEY) {
    const balanceResult = await executeWeb3Endpoint('web3.moralis.wallet_balance', {
      address: walletAddress,
      chain: 'eth',
    });
    results.push(balanceResult);
  }

  // Try Alchemy gas price
  if (process.env.ALCHEMY_API_KEY) {
    const gasResult = await executeWeb3Endpoint('web3.alchemy.gas_price', {});
    results.push(gasResult);
  }

  const successCount = results.filter(r => r.success).length;

  return {
    success: successCount > 0,
    message: `Executed ${successCount}/${results.length} Web3 API calls`,
    results,
    duration: Date.now() - startTime,
  };
}
