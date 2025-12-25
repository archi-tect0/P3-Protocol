import type { CryptoWorkerRequest } from '@/workers/crypto-worker';
import type { PDFWorkerRequest } from '@/workers/pdf-worker';
import type { HashWorkerRequest } from '@/workers/hash-worker';

class WorkerPool<T> {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private queue: Array<{ message: T; resolve: (value: any) => void; reject: (error: Error) => void }> = [];

  constructor(
    private workerUrl: string,
    private poolSize: number = 4
  ) {
    this.initializePool();
  }

  private initializePool() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(new URL(this.workerUrl, import.meta.url), { type: 'module' });
      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  async execute(message: T): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.pop()!;
        this.executeOnWorker(worker, message, resolve, reject);
      } else {
        this.queue.push({ message, resolve, reject });
      }
    });
  }

  private executeOnWorker(
    worker: Worker,
    message: T,
    resolve: (value: any) => void,
    reject: (error: Error) => void
  ) {
    const handleMessage = (event: MessageEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      if (event.data.success) {
        resolve(event.data.result);
      } else {
        reject(new Error(event.data.error));
      }

      this.availableWorkers.push(worker);
      this.processQueue();
    };

    const handleError = (error: ErrorEvent) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      reject(new Error(error.message));

      this.availableWorkers.push(worker);
      this.processQueue();
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
    worker.postMessage(message);
  }

  private processQueue() {
    if (this.queue.length > 0 && this.availableWorkers.length > 0) {
      const { message, resolve, reject } = this.queue.shift()!;
      const worker = this.availableWorkers.pop()!;
      this.executeOnWorker(worker, message, resolve, reject);
    }
  }

  terminate() {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.queue = [];
  }
}

const cryptoWorkerPool = new WorkerPool<CryptoWorkerRequest>('../workers/crypto-worker.ts', 2);
const pdfWorkerPool = new WorkerPool<PDFWorkerRequest>('../workers/pdf-worker.ts', 2);
const hashWorkerPool = new WorkerPool<HashWorkerRequest>('../workers/hash-worker.ts', 2);

export async function encryptData(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderPrivateKey: Uint8Array
): Promise<{ ciphertext: number[]; nonce: number[] }> {
  return cryptoWorkerPool.execute({
    type: 'encrypt',
    plaintext,
    recipientPublicKey,
    senderPrivateKey,
  });
}

export async function decryptData(
  ciphertext: Uint8Array,
  senderPublicKey: Uint8Array,
  recipientPrivateKey: Uint8Array,
  nonce: Uint8Array
): Promise<{ plaintext: number[] }> {
  return cryptoWorkerPool.execute({
    type: 'decrypt',
    ciphertext,
    senderPublicKey,
    recipientPrivateKey,
    nonce,
  });
}

export async function generateKeyPair(): Promise<{ 
  privateKey: number[]; 
  publicKey: number[] 
}> {
  return cryptoWorkerPool.execute({
    type: 'generateKeyPair',
  });
}

export async function generateReceiptPDF(
  receipts: Array<{
    id: string;
    type: string;
    timestamp: string;
    sender: string;
    recipient: string;
    amount?: string;
    description?: string;
  }>,
  options?: {
    title?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ pdf: ArrayBuffer; filename: string }> {
  return pdfWorkerPool.execute({
    type: 'generateReceiptPDF',
    data: {
      receipts,
      title: options?.title,
      metadata: options?.metadata,
    },
  });
}

export async function generateLedgerPDF(
  transactions: Array<{
    hash: string;
    timestamp: string;
    type: string;
    amount: string;
    status: string;
  }>,
  options?: {
    title?: string;
  }
): Promise<{ pdf: ArrayBuffer; filename: string }> {
  return pdfWorkerPool.execute({
    type: 'generateLedgerPDF',
    data: {
      transactions,
      title: options?.title,
    },
  });
}

export async function hashData(data: Uint8Array): Promise<{ hash: string }> {
  return hashWorkerPool.execute({
    type: 'hash',
    data,
  });
}

export async function hashFile(
  file: ArrayBuffer,
  chunkSize?: number
): Promise<{ hash: string; size: number }> {
  return hashWorkerPool.execute({
    type: 'hashFile',
    file,
    chunkSize,
  });
}

export async function verifyHash(
  data: Uint8Array,
  expectedHash: string
): Promise<{ hash: string; expectedHash: string; isValid: boolean }> {
  return hashWorkerPool.execute({
    type: 'verify',
    data,
    expectedHash,
  });
}

export function terminateAllWorkers() {
  cryptoWorkerPool.terminate();
  pdfWorkerPool.terminate();
  hashWorkerPool.terminate();
}
