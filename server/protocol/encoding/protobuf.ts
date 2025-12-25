/**
 * Atlas Protocol - Schema-Aware Binary Encoding
 * 
 * Lightweight Protobuf-style encoding without external dependencies.
 * Uses varint encoding for integers, length-prefixed strings.
 * 
 * Typical savings: 40-60% reduction vs JSON
 */

// Varint encoding (like Protobuf)
export function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let v = value >>> 0; // Ensure unsigned
  while (v > 0x7f) {
    bytes.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  bytes.push(v);
  return new Uint8Array(bytes);
}

export function decodeVarint(buffer: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let shift = 0;
  let bytesRead = 0;
  
  while (offset + bytesRead < buffer.length) {
    const byte = buffer[offset + bytesRead];
    value |= (byte & 0x7f) << shift;
    bytesRead++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  
  return { value, bytesRead };
}

// Length-prefixed string encoding
export function encodeString(str: string): Uint8Array {
  const textEncoder = new TextEncoder();
  const strBytes = textEncoder.encode(str);
  const lenBytes = encodeVarint(strBytes.length);
  const result = new Uint8Array(lenBytes.length + strBytes.length);
  result.set(lenBytes);
  result.set(strBytes, lenBytes.length);
  return result;
}

// Compact catalog item schema
// Field IDs: 1=id, 2=title, 3=category, 4=contentType, 5=provider, 
//            6=price, 7=rating, 8=thumbnail, 9=description, 10=metadata
export interface CompactCatalogItem {
  id: string;
  title: string;
  category: number;      // Tokenized
  contentType: number;   // Tokenized
  provider?: number;     // Tokenized
  price?: number;        // Cents as varint
  rating?: number;       // 0-100 as byte
  thumbnail?: string;
  description?: string;
  metadata?: Uint8Array; // Pre-encoded metadata
}

export function encodeCompactCatalogItem(item: CompactCatalogItem): Uint8Array {
  const chunks: Uint8Array[] = [];
  
  // Field 1: id (required)
  chunks.push(new Uint8Array([0x0a])); // field 1, wire type 2 (length-delimited)
  chunks.push(encodeString(item.id));
  
  // Field 2: title (required)
  chunks.push(new Uint8Array([0x12])); // field 2, wire type 2
  chunks.push(encodeString(item.title));
  
  // Field 3: category (varint)
  chunks.push(new Uint8Array([0x18])); // field 3, wire type 0
  chunks.push(encodeVarint(item.category));
  
  // Field 4: contentType (varint)
  chunks.push(new Uint8Array([0x20])); // field 4, wire type 0
  chunks.push(encodeVarint(item.contentType));
  
  // Field 5: provider (optional varint)
  if (item.provider !== undefined) {
    chunks.push(new Uint8Array([0x28])); // field 5, wire type 0
    chunks.push(encodeVarint(item.provider));
  }
  
  // Field 6: price (optional varint, cents)
  if (item.price !== undefined) {
    chunks.push(new Uint8Array([0x30])); // field 6, wire type 0
    chunks.push(encodeVarint(item.price));
  }
  
  // Field 7: rating (optional varint, 0-100)
  if (item.rating !== undefined) {
    chunks.push(new Uint8Array([0x38])); // field 7, wire type 0
    chunks.push(encodeVarint(item.rating));
  }
  
  // Field 8: thumbnail (optional string)
  if (item.thumbnail) {
    chunks.push(new Uint8Array([0x42])); // field 8, wire type 2
    chunks.push(encodeString(item.thumbnail));
  }
  
  // Field 9: description (optional, truncated)
  if (item.description) {
    chunks.push(new Uint8Array([0x4a])); // field 9, wire type 2
    chunks.push(encodeString(item.description.slice(0, 200)));
  }
  
  // Calculate total length and concatenate
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

export function encodeCatalogBatch(items: CompactCatalogItem[]): Uint8Array {
  const encodedItems = items.map(item => encodeCompactCatalogItem(item));
  
  // Batch header: item count as varint
  const countBytes = encodeVarint(items.length);
  
  // Calculate total size
  let totalSize = countBytes.length;
  for (const encoded of encodedItems) {
    totalSize += encodeVarint(encoded.length).length + encoded.length;
  }
  
  // Build result
  const result = new Uint8Array(totalSize);
  let offset = 0;
  
  // Write count
  result.set(countBytes, offset);
  offset += countBytes.length;
  
  // Write each item with length prefix
  for (const encoded of encodedItems) {
    const lenBytes = encodeVarint(encoded.length);
    result.set(lenBytes, offset);
    offset += lenBytes.length;
    result.set(encoded, offset);
    offset += encoded.length;
  }
  
  return result;
}

// Convert raw catalog item to compact format
export function toCompactItem(item: any, tokenize: (s: string) => number): CompactCatalogItem {
  return {
    id: item.id || '',
    title: item.title || item.name || '',
    category: tokenize(item.category || item.kind || 'unknown'),
    contentType: tokenize(item.contentType || item.accessMode || 'free'),
    provider: item.provider ? tokenize(item.provider) : undefined,
    price: item.price ? Math.round(item.price * 100) : undefined,
    rating: item.rating ? Math.round(item.rating * 20) : undefined,
    thumbnail: item.thumbnail || item.posterUrl,
    description: item.description,
  };
}
