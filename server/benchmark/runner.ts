/**
 * Benchmark Runner
 * 
 * Periodically runs requests against both Atlas and REST baseline endpoints
 * to populate the metrics table with fair comparison data.
 */

import { db } from '../db';
import { apiRequestMetrics } from '@shared/schema';

const BENCHMARK_INTERVAL = 60000; // Run every minute
const BENCHMARK_ENDPOINTS = [
  { atlas: '/api/atlas/canvas/renderables', rest: '/api/rest-baseline/renderables', name: 'renderables' },
];

let isRunning = false;
let lastRunTime = 0;
const MIN_RUN_INTERVAL = 55000; // Minimum 55 seconds between runs

async function runBenchmark(baseUrl: string = 'http://localhost:5000') {
  const now = Date.now();
  
  // Prevent duplicate runs within 55 seconds (even if multiple intervals exist)
  if (now - lastRunTime < MIN_RUN_INTERVAL) {
    console.log('[Benchmark] Skipping - too soon since last run');
    return;
  }
  
  if (isRunning) {
    console.log('[Benchmark] Skipping - already running');
    return;
  }
  
  isRunning = true;
  lastRunTime = now;
  console.log(`[Benchmark] Run started at ${new Date().toISOString()}`);
  
  try {
    console.log('[Benchmark] Starting efficiency comparison run...');
    
    for (const endpoint of BENCHMARK_ENDPOINTS) {
      let atlasSuccess = false;
      let atlasBytes = 0;
      let atlasLatency = 0;
      
      // Run Atlas endpoint first - request MessagePack + gzip (optimized)
      try {
        const atlasStart = Date.now();
        const atlasResponse = await fetch(`${baseUrl}${endpoint.atlas}`, {
          headers: {
            'Accept': 'application/msgpack',
            'Accept-Encoding': 'gzip',
          },
        });
        atlasLatency = Date.now() - atlasStart;
        
        // Only record successful responses
        if (atlasResponse.ok) {
          const atlasBuffer = await atlasResponse.arrayBuffer();
          atlasBytes = atlasBuffer.byteLength;
          atlasSuccess = true;
          
          await db.insert(apiRequestMetrics).values({
            endpoint: endpoint.atlas.replace('/api', ''),
            method: 'GET',
            requestBytes: 0,
            responseBytes: atlasBytes,
            latencyMs: atlasLatency,
            statusCode: 200,
            isAtlasApi: true,
            sessionReused: true,
          });
          
          console.log(`[Benchmark] Atlas ${endpoint.name}: ${atlasBytes} bytes, ${atlasLatency}ms`);
        } else {
          console.warn(`[Benchmark] Atlas ${endpoint.name} returned ${atlasResponse.status}`);
        }
      } catch (err) {
        console.warn(`[Benchmark] Atlas ${endpoint.name} failed:`, err);
      }
      
      // Only run REST baseline if Atlas succeeded (ensures paired data)
      if (atlasSuccess) {
        try {
          const restStart = Date.now();
          const restResponse = await fetch(`${baseUrl}${endpoint.rest}`);
          const restLatency = Date.now() - restStart;
          
          if (restResponse.ok) {
            const restBody = await restResponse.text();
            const restBytes = Buffer.byteLength(restBody, 'utf8');
            
            await db.insert(apiRequestMetrics).values({
              endpoint: endpoint.rest.replace('/api', ''),
              method: 'GET',
              requestBytes: 0,
              responseBytes: restBytes,
              latencyMs: restLatency,
              statusCode: 200,
              isAtlasApi: false,
              sessionReused: false,
            });
            
            console.log(`[Benchmark] REST ${endpoint.name}: ${restBytes} bytes, ${restLatency}ms`);
            console.log(`[Benchmark] ${endpoint.name} savings: ${Math.round((1 - atlasBytes / restBytes) * 100)}%`);
          } else {
            console.warn(`[Benchmark] REST ${endpoint.name} returned ${restResponse.status}`);
          }
        } catch (err) {
          console.warn(`[Benchmark] REST ${endpoint.name} failed:`, err);
        }
      }
    }
    
    console.log('[Benchmark] Comparison run complete');
  } catch (error) {
    console.error('[Benchmark] Error:', error);
  } finally {
    isRunning = false;
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startBenchmarkRunner() {
  if (intervalId) return;
  
  console.log('[Benchmark] Starting periodic benchmark runner (first run in 60s)');
  
  // Only use setInterval - no initial setTimeout to avoid duplicate runs
  // First benchmark will run after BENCHMARK_INTERVAL (60 seconds)
  intervalId = setInterval(() => runBenchmark(), BENCHMARK_INTERVAL);
}

export function stopBenchmarkRunner() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Benchmark] Stopped periodic benchmark runner');
  }
}

export { runBenchmark };
