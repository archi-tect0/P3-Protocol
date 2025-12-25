import { keccak256 } from 'viem';

function keccak_256(data: Uint8Array): Uint8Array {
  const hex = keccak256(data);
  return new Uint8Array(hex.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface HashRequest {
  type: 'hash';
  data: Uint8Array;
}

export interface HashFileRequest {
  type: 'hashFile';
  file: ArrayBuffer;
  chunkSize?: number;
}

export interface VerifyHashRequest {
  type: 'verify';
  data: Uint8Array;
  expectedHash: string;
}

export type HashWorkerRequest = HashRequest | HashFileRequest | VerifyHashRequest;

function hashChunked(data: Uint8Array, chunkSize: number = 1024 * 1024): string {
  const chunks: Uint8Array[] = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    chunks.push(chunk);
  }
  
  let combinedHash = new Uint8Array(32);
  
  for (const chunk of chunks) {
    const chunkHash = keccak_256(chunk);
    const combined = new Uint8Array(combinedHash.length + chunkHash.length);
    combined.set(combinedHash);
    combined.set(chunkHash, combinedHash.length);
    combinedHash = keccak_256(combined);
  }
  
  return '0x' + bytesToHex(combinedHash);
}

self.onmessage = async (event: MessageEvent<HashWorkerRequest>) => {
  const { type } = event.data;

  try {
    switch (type) {
      case 'hash': {
        const { data } = event.data;
        const hash = keccak_256(data);
        const hexHash = '0x' + bytesToHex(hash);

        self.postMessage({
          success: true,
          result: {
            hash: hexHash,
          },
        });
        break;
      }

      case 'hashFile': {
        const { file, chunkSize = 1024 * 1024 } = event.data;
        const data = new Uint8Array(file);
        
        const hash = hashChunked(data, chunkSize);

        self.postMessage({
          success: true,
          result: {
            hash,
            size: data.length,
          },
        });
        break;
      }

      case 'verify': {
        const { data, expectedHash } = event.data;
        const hash = keccak_256(data);
        const hexHash = '0x' + bytesToHex(hash);
        
        const isValid = hexHash.toLowerCase() === expectedHash.toLowerCase();

        self.postMessage({
          success: true,
          result: {
            hash: hexHash,
            expectedHash,
            isValid,
          },
        });
        break;
      }

      default:
        throw new Error(`Unknown operation: ${type}`);
    }
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
