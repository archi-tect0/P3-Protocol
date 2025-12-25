export * from './types';
export * from './catalogStore';
export * from './sourceConnectors';
export * from './normalizer';
export * from './ingestor';
export * from './registrySynchronizer';
export * from './flowComposer';
export * from './executor';

import { quickIngest, ingestFromGitHub, getIngestStats } from './ingestor';
import { generateAutoFlows, listAutoFlows, getFlowStats, getWeb3FlowTemplates, getWeb3Flow } from './flowComposer';
import { getAllAutoEndpoints, getAutoEndpointStats, syncAllToCanvasRegistry, getSyncStatus } from './registrySynchronizer';
import { getAllApis, getStats } from './catalogStore';
import { executeWeb3Endpoint, getWeb3EndpointsList, getWeb3Stats, web3Demo } from './executor';

export { syncAllToCanvasRegistry, getSyncStatus };

export { executeWeb3Endpoint, getWeb3EndpointsList, getWeb3Stats, web3Demo, getWeb3FlowTemplates, getWeb3Flow };

let isInitialized = false;

export async function initializeMetaAdapter(): Promise<{
  success: boolean;
  apis: number;
  endpoints: number;
  flows: number;
  canvasSynced: number;
  message: string;
}> {
  if (isInitialized) {
    const stats = getStats();
    const syncStatus = getSyncStatus();
    return {
      success: true,
      apis: stats.totalApis,
      endpoints: stats.totalEndpoints,
      flows: stats.autoFlowsGenerated,
      canvasSynced: syncStatus.registered,
      message: 'Meta-adapter already initialized',
    };
  }

  try {
    const ingestResult = await quickIngest();
    
    const flows = generateAutoFlows();
    
    const syncResult = await syncAllToCanvasRegistry();
    
    isInitialized = true;

    const stats = getStats();
    
    console.log(`[MetaAdapter] Initialized: ${stats.totalApis} APIs, ${stats.totalEndpoints} endpoints, ${flows.length} flows, ${syncResult.synced} canvas endpoints`);

    return {
      success: true,
      apis: stats.totalApis,
      endpoints: stats.totalEndpoints,
      flows: flows.length,
      canvasSynced: syncResult.synced,
      message: `Ingested ${ingestResult.count} APIs, generated ${flows.length} flows, synced ${syncResult.synced} to Canvas`,
    };
  } catch (error) {
    console.error('[MetaAdapter] Initialization failed:', error);
    return {
      success: false,
      apis: 0,
      endpoints: 0,
      flows: 0,
      canvasSynced: 0,
      message: error instanceof Error ? error.message : 'Initialization failed',
    };
  }
}

export async function refreshMetaAdapter(): Promise<{
  success: boolean;
  newApis: number;
  message: string;
}> {
  try {
    const beforeCount = getAllApis().length;
    
    const result = await ingestFromGitHub();
    
    generateAutoFlows();
    
    const afterCount = getAllApis().length;
    const newApis = afterCount - beforeCount;

    return {
      success: result.success,
      newApis,
      message: result.success 
        ? `Added ${newApis} new APIs from GitHub`
        : `Refresh failed: ${result.errors.join(', ')}`,
    };
  } catch (error) {
    return {
      success: false,
      newApis: 0,
      message: error instanceof Error ? error.message : 'Refresh failed',
    };
  }
}

export function getMetaAdapterStatus() {
  const catalogStats = getStats();
  const endpointStats = getAutoEndpointStats();
  const flowStats = getFlowStats();
  const ingestStats = getIngestStats();

  return {
    initialized: isInitialized,
    catalog: catalogStats,
    endpoints: endpointStats,
    flows: flowStats,
    ingest: ingestStats,
    ts: Date.now(),
  };
}

export function isMetaAdapterReady(): boolean {
  return isInitialized && getAllApis().length > 0;
}
