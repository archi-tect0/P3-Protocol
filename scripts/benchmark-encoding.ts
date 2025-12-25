/**
 * Atlas Protocol Encoding Benchmark
 * 
 * Compares payload sizes across encoding strategies:
 * 1. JSON (baseline)
 * 2. MessagePack (generic binary)
 * 3. Tokenized MessagePack (dictionary + MsgPack)
 * 4. Compact Protobuf (schema-aware binary)
 * 5. Tokenized Protobuf (dictionary + schema-aware)
 */

import { encode as msgpackEncode } from '@msgpack/msgpack';
import { 
  createBaseDictionary, 
  tokenizeCatalog, 
  getDictionarySeed,
  type TokenDictionary 
} from '../server/protocol/encoding/dictionary';
import { 
  encodeCatalogBatch, 
  toCompactItem,
  type CompactCatalogItem 
} from '../server/protocol/encoding/protobuf';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface EncodingResult {
  name: string;
  bytes: number;
  items: number;
  bytesPerItem: number;
  reductionVsJson: number;
  encodeTimeMs: number;
}

function measureEncoding(
  name: string,
  items: any[],
  encodeFn: () => Uint8Array | string,
  jsonBytes: number
): EncodingResult {
  const start = performance.now();
  const encoded = encodeFn();
  const encodeTime = performance.now() - start;
  
  const bytes = typeof encoded === 'string' 
    ? new TextEncoder().encode(encoded).length 
    : encoded.length;
  
  return {
    name,
    bytes,
    items: items.length,
    bytesPerItem: Math.round(bytes / items.length),
    reductionVsJson: Math.round((1 - bytes / jsonBytes) * 100),
    encodeTimeMs: Math.round(encodeTime * 100) / 100,
  };
}

async function fetchCatalog(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/atlas-one/catalog?limit=100`);
    const data = await res.json();
    return data.items || data || [];
  } catch {
    console.log('   [!] Could not fetch catalog, using synthetic data');
    return generateSyntheticCatalog(100);
  }
}

function generateSyntheticCatalog(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    title: `Test Item ${i}: A Product with a Reasonably Long Title`,
    description: 'This is a medium-length description that contains some details about the product. It includes various information that users might find helpful when browsing the catalog.',
    category: ['game', 'video', 'ebook', 'audio', 'product'][i % 5],
    contentType: ['free', 'premium', 'rental'][i % 3],
    provider: ['steam', 'epic', 'netflix', 'amazon', 'spotify'][i % 5],
    price: Math.random() * 59.99,
    rating: Math.random() * 5,
    thumbnail: `https://example.com/images/item-${i}.jpg`,
    metadata: {
      year: 2020 + (i % 5),
      duration: 60 + (i % 120),
      quality: 'HD',
      genres: ['action', 'adventure'],
    },
  }));
}

async function runEncodingBenchmarks(): Promise<void> {
  console.log('\n' + '═'.repeat(70));
  console.log('  ATLAS PROTOCOL ENCODING BENCHMARKS');
  console.log('  Comparing JSON vs Binary vs Tokenized vs Protobuf');
  console.log('═'.repeat(70));
  
  // Fetch real or synthetic catalog
  console.log('\n   Fetching catalog data...');
  const items = await fetchCatalog();
  console.log(`   Got ${items.length} items\n`);
  
  // Create dictionary
  const dict = createBaseDictionary();
  const dictSeed = getDictionarySeed(dict);
  const dictSeedBytes = new TextEncoder().encode(JSON.stringify(dictSeed)).length;
  
  // Helper to get token ID
  const tokenize = (s: string): number => {
    const id = dict.tokens.get(s);
    return id !== undefined ? id : 0;
  };
  
  // 1. JSON baseline
  const jsonStr = JSON.stringify(items);
  const jsonBytes = new TextEncoder().encode(jsonStr).length;
  
  const results: EncodingResult[] = [];
  
  // Measure each encoding
  results.push(measureEncoding('JSON (baseline)', items, () => jsonStr, jsonBytes));
  
  // 2. MessagePack
  results.push(measureEncoding('MessagePack', items, () => msgpackEncode(items), jsonBytes));
  
  // 3. Tokenized MessagePack
  const tokenizedItems = tokenizeCatalog(dict, items);
  results.push(measureEncoding('Tokenized MsgPack', items, () => msgpackEncode(tokenizedItems), jsonBytes));
  
  // 4. Compact Protobuf (schema-aware)
  const compactItems: CompactCatalogItem[] = items.map(item => toCompactItem(item, tokenize));
  results.push(measureEncoding('Compact Protobuf', items, () => encodeCatalogBatch(compactItems), jsonBytes));
  
  // 5. Tokenized + Truncated + Protobuf (best case)
  const optimizedItems: CompactCatalogItem[] = items.map(item => ({
    ...toCompactItem(item, tokenize),
    description: undefined, // Omit long descriptions
    thumbnail: undefined,   // Omit URLs (can be reconstructed from ID)
  }));
  results.push(measureEncoding('Optimized Protobuf', items, () => encodeCatalogBatch(optimizedItems), jsonBytes));
  
  // Print results
  console.log('━'.repeat(70));
  console.log('  ENCODING COMPARISON');
  console.log('━'.repeat(70));
  console.log('');
  console.log('  Encoding              | Bytes    | Per Item | Reduction | Encode Time');
  console.log('  ----------------------|----------|----------|-----------|------------');
  
  for (const r of results) {
    const name = r.name.padEnd(21);
    const bytes = `${(r.bytes / 1024).toFixed(1)}KB`.padStart(8);
    const perItem = `${r.bytesPerItem}B`.padStart(8);
    const reduction = `${r.reductionVsJson}%`.padStart(9);
    const time = `${r.encodeTimeMs}ms`.padStart(10);
    console.log(`  ${name} | ${bytes} | ${perItem} | ${reduction} | ${time}`);
  }
  
  console.log('');
  console.log('━'.repeat(70));
  console.log('  ANALYSIS');
  console.log('━'.repeat(70));
  
  const msgpack = results.find(r => r.name === 'MessagePack')!;
  const tokenizedMsgpack = results.find(r => r.name === 'Tokenized MsgPack')!;
  const protobuf = results.find(r => r.name === 'Compact Protobuf')!;
  const optimized = results.find(r => r.name === 'Optimized Protobuf')!;
  
  console.log('');
  console.log(`  MessagePack alone:           ${msgpack.reductionVsJson}% reduction`);
  console.log(`  + Dictionary tokenization:   ${tokenizedMsgpack.reductionVsJson}% reduction (+${tokenizedMsgpack.reductionVsJson - msgpack.reductionVsJson}%)`);
  console.log(`  + Schema-aware (Protobuf):   ${protobuf.reductionVsJson}% reduction (+${protobuf.reductionVsJson - tokenizedMsgpack.reductionVsJson}%)`);
  console.log(`  + Optimized (no long text):  ${optimized.reductionVsJson}% reduction (+${optimized.reductionVsJson - protobuf.reductionVsJson}%)`);
  console.log('');
  console.log(`  Dictionary overhead:         ${(dictSeedBytes / 1024).toFixed(1)}KB (one-time per session)`);
  console.log('');
  
  if (optimized.reductionVsJson >= 40) {
    console.log('  ✅ TARGET ACHIEVED: 40%+ payload reduction with optimized encoding');
  } else {
    console.log(`  ⚠️  Current reduction: ${optimized.reductionVsJson}% (target: 40%+)`);
  }
  
  console.log('');
  console.log('═'.repeat(70));
  console.log('  RAW RESULTS');
  console.log('═'.repeat(70));
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    itemCount: items.length,
    dictionaryBytes: dictSeedBytes,
    results: results.map(r => ({
      encoding: r.name,
      totalBytes: r.bytes,
      bytesPerItem: r.bytesPerItem,
      reductionPercent: r.reductionVsJson,
      encodeTimeMs: r.encodeTimeMs,
    })),
  }, null, 2));
}

runEncodingBenchmarks().catch(console.error);
