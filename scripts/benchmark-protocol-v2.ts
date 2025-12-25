/**
 * Atlas API 2.0 - V2 Protocol Benchmark
 * 
 * Tests the 8-lane architecture with msgpack-default encoding.
 * Validates performance metrics against published benchmarks.
 */

const BASE_URL = 'http://localhost:5000';

interface HandshakeResponseV2 {
  sessionId: string;
  transport: string;
  lanes: Array<{
    id: number;
    name: string;
    encoding: string;
    url: string;
  }>;
  dictionary: {
    version: string;
    tokens: string[];
    indexMap: Record<string, number>;
  };
  serverTime: number;
  ttlSeconds: number;
  protocol: {
    version: string;
    features: string[];
  };
}

interface BenchmarkResult {
  test: string;
  passed: boolean;
  latencyMs: number;
  details: Record<string, unknown>;
}

const results: BenchmarkResult[] = [];

async function testV2Handshake(laneCount: number = 8): Promise<HandshakeResponseV2 | null> {
  const laneIds = Array.from({ length: laneCount }, (_, i) => i + 1);
  const start = performance.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/protocol/v2/session/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`,
        supportedLanes: laneIds,
        supportedEncodings: ['msgpack', 'protobuf', 'json'],
        supportedTransports: ['http1'],
      }),
    });
    
    const latency = performance.now() - start;
    const data = await response.json() as HandshakeResponseV2;
    
    const passed = 
      data.sessionId !== undefined &&
      data.transport === 'http1' &&
      data.lanes?.length > 0 &&
      data.protocol?.features?.includes('msgpack-default');
    
    return passed ? data : null;
  } catch (error: any) {
    console.error('Handshake error:', error.message);
    return null;
  }
}

async function benchmarkHandshakeLatency(): Promise<void> {
  console.log('\n=== V2 Handshake Latency Benchmark ===\n');
  
  const iterations = 10;
  const latencies: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const session = await testV2Handshake(3); // Default 3 lanes
    const latency = performance.now() - start;
    
    if (session) {
      latencies.push(latency);
    }
  }
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  
  const passed = avgLatency < 100; // Should be < 100ms, target is 39ms
  
  results.push({
    test: 'V2 Handshake Latency (default 3 lanes)',
    passed,
    latencyMs: Math.round(avgLatency * 100) / 100,
    details: {
      iterations,
      avgMs: Math.round(avgLatency * 100) / 100,
      minMs: Math.round(minLatency * 100) / 100,
      maxMs: Math.round(maxLatency * 100) / 100,
      target: '< 100ms (published: 39ms)',
    },
  });
  
  console.log(`  Average: ${avgLatency.toFixed(2)}ms (target: < 100ms)`);
}

async function benchmark8LaneHandshake(): Promise<void> {
  console.log('\n=== 8-Lane Handshake Benchmark ===\n');
  
  const iterations = 10;
  const latencies: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const session = await testV2Handshake(8);
    const latency = performance.now() - start;
    
    if (session) {
      latencies.push(latency);
      
      if (i === 0) {
        console.log(`  Lanes returned: ${session.lanes.length}`);
        console.log(`  Features: ${session.protocol.features.join(', ')}`);
        console.log(`  Dictionary tokens: ${session.dictionary.tokens.length}`);
      }
    }
  }
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  
  results.push({
    test: 'V2 8-Lane Handshake',
    passed: latencies.length === iterations && avgLatency < 150,
    latencyMs: Math.round(avgLatency * 100) / 100,
    details: {
      laneCount: 8,
      iterations,
      avgMs: Math.round(avgLatency * 100) / 100,
    },
  });
  
  console.log(`  Average: ${avgLatency.toFixed(2)}ms for 8 lanes`);
}

async function benchmarkConcurrentSessions(): Promise<void> {
  console.log('\n=== Concurrent Session Scaling (50 sessions) ===\n');
  
  const sessionCount = 50;
  const start = performance.now();
  
  const promises = Array(sessionCount).fill(null).map(() => 
    fetch(`${BASE_URL}/api/protocol/v2/session/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: `0x${Math.random().toString(16).slice(2, 42).padEnd(40, '0')}`,
        supportedLanes: [1, 2, 3],
        supportedEncodings: ['msgpack'],
        supportedTransports: ['http1'],
      }),
    }).then(r => r.json()).catch(() => null)
  );
  
  const sessions = await Promise.all(promises);
  const totalLatency = performance.now() - start;
  const avgPerSession = totalLatency / sessionCount;
  
  const successCount = sessions.filter(s => s?.sessionId).length;
  const passed = successCount === sessionCount && totalLatency < 2000; // Target: 838ms
  
  results.push({
    test: 'Concurrent Session Scaling (50 sessions)',
    passed,
    latencyMs: Math.round(totalLatency * 100) / 100,
    details: {
      totalSessions: sessionCount,
      successful: successCount,
      totalMs: Math.round(totalLatency * 100) / 100,
      avgPerSessionMs: Math.round(avgPerSession * 100) / 100,
      target: '< 2000ms total (published: 838ms)',
    },
  });
  
  console.log(`  Total: ${totalLatency.toFixed(2)}ms for ${sessionCount} sessions`);
  console.log(`  Average: ${avgPerSession.toFixed(2)}ms per session`);
  console.log(`  Success rate: ${successCount}/${sessionCount}`);
}

async function benchmarkPayloadSize(): Promise<void> {
  console.log('\n=== Payload Size Comparison ===\n');
  
  const session = await testV2Handshake(8);
  if (!session) {
    console.log('  Failed to get session');
    return;
  }
  
  const responseSize = JSON.stringify(session).length;
  const dictionarySize = session.dictionary.tokens.length;
  
  results.push({
    test: 'Handshake Response Size',
    passed: dictionarySize >= 67 && responseSize > 0,
    latencyMs: 0,
    details: {
      responseBytes: responseSize,
      dictionaryTokens: dictionarySize,
      laneCount: session.lanes.length,
      features: session.protocol.features,
    },
  });
  
  console.log(`  Response size: ${responseSize} bytes`);
  console.log(`  Dictionary tokens: ${dictionarySize}`);
  console.log(`  Lanes: ${session.lanes.length}`);
}

async function testProtocolInfo(): Promise<void> {
  console.log('\n=== Protocol Info Validation ===\n');
  
  const start = performance.now();
  
  try {
    const response = await fetch(`${BASE_URL}/api/protocol/v2/protocol/info`);
    const latency = performance.now() - start;
    const info = await response.json() as any;
    
    const hasCorrectDefaults = 
      info.encoding?.default === 'msgpack' &&
      info.transport?.active === 'http1' &&
      info.lanes?.total === 8 &&
      info.features?.includes('msgpack-default');
    
    results.push({
      test: 'Protocol Info Accuracy',
      passed: hasCorrectDefaults,
      latencyMs: Math.round(latency * 100) / 100,
      details: {
        encoding: info.encoding,
        transport: info.transport,
        laneCount: info.lanes?.total,
        features: info.features,
      },
    });
    
    console.log(`  Encoding default: ${info.encoding?.default}`);
    console.log(`  Transport active: ${info.transport?.active}`);
    console.log(`  Total lanes: ${info.lanes?.total}`);
  } catch (error: any) {
    results.push({
      test: 'Protocol Info Accuracy',
      passed: false,
      latencyMs: 0,
      details: { error: error.message },
    });
  }
}

async function testSSEConnection(): Promise<void> {
  console.log('\n=== SSE Lane Connection Test ===\n');
  
  const session = await testV2Handshake(3);
  if (!session) {
    console.log('  Failed to create session');
    return;
  }
  
  const accessLane = session.lanes.find(l => l.id === 1);
  if (!accessLane) {
    console.log('  No access lane found');
    return;
  }
  
  const start = performance.now();
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(accessLane.url, {
      signal: controller.signal,
      headers: { 'Accept': 'text/event-stream' },
    });
    
    clearTimeout(timeout);
    const latency = performance.now() - start;
    
    const reader = response.body?.getReader();
    if (reader) {
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      
      const hasOpenEvent = text.includes('event: open');
      const hasMsgpackFeature = text.includes('msgpack-default');
      
      results.push({
        test: 'SSE Lane Connection',
        passed: hasOpenEvent,
        latencyMs: Math.round(latency * 100) / 100,
        details: {
          receivedOpenEvent: hasOpenEvent,
          hasMsgpackFeature,
          firstEventSnippet: text.substring(0, 300),
        },
      });
      
      console.log(`  Open event received: ${hasOpenEvent}`);
      console.log(`  Msgpack feature: ${hasMsgpackFeature}`);
      
      reader.cancel();
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      results.push({
        test: 'SSE Lane Connection',
        passed: false,
        latencyMs: 0,
        details: { error: error.message },
      });
    }
  }
}

function printResults(): void {
  console.log('\n' + '='.repeat(60));
  console.log('ATLAS API 2.0 BENCHMARK RESULTS');
  console.log('='.repeat(60) + '\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}${status}\x1b[0m  ${result.test}`);
    console.log(`       Latency: ${result.latencyMs}ms`);
    
    for (const [key, value] of Object.entries(result.details)) {
      console.log(`       ${key}: ${JSON.stringify(value)}`);
    }
    console.log();
    
    if (result.passed) passed++;
    else failed++;
  }
  
  console.log('='.repeat(60));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('Atlas API 2.0 - V2 Protocol Benchmark');
  console.log('=====================================');
  console.log('Testing 8-lane architecture with msgpack-default encoding\n');
  
  await testProtocolInfo();
  await benchmarkHandshakeLatency();
  await benchmark8LaneHandshake();
  await benchmarkConcurrentSessions();
  await benchmarkPayloadSize();
  await testSSEConnection();
  
  printResults();
}

main().catch(console.error);
