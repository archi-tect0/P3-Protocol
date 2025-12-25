import { manifestRegistry, type ManifestFlow, type ManifestEndpoint } from './registry';
import { EventPublisher, summarize } from './events';
import { authorize, getSessionFromWallet } from './authz';
import { sessionStore } from './sessions';

export interface ExecutionOptions {
  debug?: boolean;
}

export interface ExecutionResult {
  status: 'success' | 'error' | 'gated';
  flowId: string;
  result?: unknown;
  error?: string;
  durationMs?: number;
  debug?: {
    rawRequest?: unknown;
    rawResponse?: unknown;
    headers?: Record<string, string>;
    statusCode?: number;
    timings?: Record<string, number>;
  };
}

export async function runManifestFlow(
  flowKey: string,
  wallet?: string,
  params?: Record<string, unknown>,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const flow = manifestRegistry.getFlow(flowKey);
  if (!flow) {
    throw new Error(`Flow not found: ${flowKey}`);
  }

  const debug = options?.debug ?? sessionStore.isDebugMode(wallet);
  const session = getSessionFromWallet(wallet);
  const publisher = new EventPublisher(flowKey, wallet, flow['telemetry.tags']);
  const flowId = publisher.id;
  const startTime = Date.now();
  const debugInfo: ExecutionResult['debug'] = debug ? { timings: {} } : undefined;

  if (!authorize(flow['security.visibility'], session)) {
    publisher.gated('unauthorized');
    if (wallet) sessionStore.addFlowExecution(wallet, flowId, flowKey, 'gated');
    return { status: 'gated', flowId, durationMs: Date.now() - startTime, debug: debugInfo };
  }

  try {
    const results: unknown[] = [];
    const rawResponses: unknown[] = [];

    for (const step of flow.steps) {
      const stepInput = { endpoint: step.endpoint, params };
      publisher.stepStart(step.id, step.name, debug ? stepInput : { endpoint: step.endpoint });
      const stepStart = Date.now();

      try {
        const httpResult = await executeHttpCall(step.endpoint, params, debug);
        const durationMs = Date.now() - stepStart;
        const summary = summarize(httpResult.data);
        
        if (debug && debugInfo?.timings) {
          debugInfo.timings[step.id] = durationMs;
        }
        
        publisher.stepComplete(step.id, step.name, debug ? httpResult.data : summary, undefined, durationMs);
        results.push(httpResult.data);
        if (debug) rawResponses.push(httpResult);
      } catch (e) {
        const err = e as Error;
        const errorDetail = debug ? { step: step.id, error: err.message, stack: err.stack } : undefined;
        publisher.error('STEP_FAIL', err.message, step.id, isRetryable(err));
        publisher.complete('error', { step: step.id, error: err.message });
        if (wallet) sessionStore.addFlowExecution(wallet, flowId, flowKey, 'error');
        return { 
          status: 'error', 
          flowId, 
          error: err.message, 
          durationMs: Date.now() - startTime,
          debug: debug ? { ...debugInfo, rawRequest: params, rawResponse: errorDetail } : undefined,
        };
      }
    }

    publisher.complete('success', { stepCount: flow.steps.length, results: results.map(summarize) });
    if (wallet) sessionStore.addFlowExecution(wallet, flowId, flowKey, 'success');
    return { 
      status: 'success', 
      flowId, 
      result: results, 
      durationMs: Date.now() - startTime,
      debug: debug ? { ...debugInfo, rawRequest: params, rawResponse: rawResponses } : undefined,
    };
  } catch (e) {
    const err = e as Error;
    publisher.complete('error', { error: err.message });
    if (wallet) sessionStore.addFlowExecution(wallet, flowId, flowKey, 'error');
    return { 
      status: 'error', 
      flowId, 
      error: err.message, 
      durationMs: Date.now() - startTime,
      debug: debug ? { ...debugInfo, rawRequest: params } : undefined,
    };
  }
}

export async function runManifestEndpoint(
  key: string,
  wallet?: string,
  params?: Record<string, unknown>,
  options?: ExecutionOptions
): Promise<ExecutionResult> {
  const endpoint = manifestRegistry.getEndpoint(key);
  if (!endpoint) {
    throw new Error(`Endpoint not found: ${key}`);
  }

  const debug = options?.debug ?? sessionStore.isDebugMode(wallet);
  const session = getSessionFromWallet(wallet);
  const publisher = new EventPublisher(key, wallet, endpoint['telemetry.tags']);
  const flowId = publisher.id;
  const startTime = Date.now();
  const debugInfo: ExecutionResult['debug'] = debug ? { timings: {} } : undefined;

  if (!authorize(endpoint['security.visibility'], session)) {
    publisher.gated('unauthorized');
    if (wallet) sessionStore.addFlowExecution(wallet, flowId, key, 'gated');
    return { status: 'gated', flowId, durationMs: Date.now() - startTime, debug: debugInfo };
  }

  const stepInput = { method: endpoint.method, url: endpoint.url, params };
  publisher.stepStart('call', endpoint.name, debug ? stepInput : { method: endpoint.method, url: endpoint.url });
  const callStart = Date.now();

  try {
    const httpResult = await executeHttpCall(`${endpoint.method} ${endpoint.url}`, params, debug);
    const durationMs = Date.now() - callStart;
    
    if (debug && debugInfo?.timings) {
      debugInfo.timings['call'] = durationMs;
    }
    
    publisher.stepComplete('call', endpoint.name, debug ? httpResult.data : summarize(httpResult.data), undefined, durationMs);
    publisher.complete('success', summarize(httpResult.data));
    if (wallet) sessionStore.addFlowExecution(wallet, flowId, key, 'success');
    
    return { 
      status: 'success', 
      flowId, 
      result: httpResult.data, 
      durationMs: Date.now() - startTime,
      debug: debug ? { 
        ...debugInfo, 
        rawRequest: params, 
        rawResponse: httpResult.data,
        headers: httpResult.debug?.headers,
        statusCode: httpResult.debug?.statusCode,
      } : undefined,
    };
  } catch (e) {
    const err = e as Error;
    const errorDetail = debug ? { error: err.message, stack: err.stack } : undefined;
    publisher.error('CALL_FAIL', err.message, 'call', isRetryable(err));
    publisher.complete('error', { error: err.message });
    if (wallet) sessionStore.addFlowExecution(wallet, flowId, key, 'error');
    return { 
      status: 'error', 
      flowId, 
      error: err.message, 
      durationMs: Date.now() - startTime,
      debug: debug ? { ...debugInfo, rawRequest: params, rawResponse: errorDetail } : undefined,
    };
  }
}

export interface HttpCallResult {
  data: unknown;
  debug?: {
    statusCode: number;
    headers: Record<string, string>;
    url: string;
    method: string;
  };
}

async function executeHttpCall(
  endpoint: string,
  params?: Record<string, unknown>,
  debug?: boolean
): Promise<HttpCallResult> {
  const parts = endpoint.split(' ');
  const method = parts[0] || 'GET';
  const url = parts.slice(1).join(' ') || parts[0];

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'accept': 'application/json',
  };

  const init: RequestInit = {
    method,
    headers,
  };

  if (method !== 'GET' && method !== 'HEAD' && params) {
    init.body = JSON.stringify(params);
  }

  let finalUrl = url;
  if ((method === 'GET' || method === 'HEAD') && params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        searchParams.set(k, String(v));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      finalUrl += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const response = await fetch(finalUrl, init);

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new HttpError(response.status, errorText);
  }

  const contentType = response.headers.get('content-type') || '';
  let data: unknown;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (debug) {
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    return {
      data,
      debug: {
        statusCode: response.status,
        headers: responseHeaders,
        url: finalUrl,
        method,
      },
    };
  }
  
  return { data };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(`HTTP ${status}: ${message}`);
    this.name = 'HttpError';
  }
}

function isRetryable(err: Error): boolean {
  if (err instanceof HttpError) {
    return err.status >= 500 || err.status === 429;
  }
  return err.message.includes('ECONNREFUSED') || 
         err.message.includes('ETIMEDOUT') ||
         err.message.includes('network');
}

export async function executeInternalFlow(
  flowKey: string,
  handler: (publisher: EventPublisher, params?: Record<string, unknown>) => Promise<unknown>,
  wallet?: string,
  params?: Record<string, unknown>
): Promise<ExecutionResult> {
  const publisher = new EventPublisher(flowKey, wallet);
  const flowId = publisher.id;
  const startTime = Date.now();

  try {
    const result = await handler(publisher, params);
    publisher.complete('success', summarize(result));
    return {
      status: 'success',
      flowId,
      result,
      durationMs: Date.now() - startTime,
    };
  } catch (e) {
    const err = e as Error;
    publisher.error('HANDLER_FAIL', err.message, undefined, false);
    publisher.complete('error', { error: err.message });
    return {
      status: 'error',
      flowId,
      error: err.message,
      durationMs: Date.now() - startTime,
    };
  }
}
