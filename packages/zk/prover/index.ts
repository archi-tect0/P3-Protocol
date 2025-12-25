import * as fs from 'fs';
import * as path from 'path';

// Dynamic import for snarkjs - GPL licensed, may not be available in Apache 2.0 builds
let groth16: any = null;
let snarkjsAvailable = false;

try {
  const snarkjs = require('snarkjs');
  groth16 = snarkjs.groth16;
  snarkjsAvailable = true;
  console.log('[ZK] snarkjs loaded successfully - ZK proving enabled');
} catch (err) {
  console.warn('[ZK] snarkjs not available (GPL license excluded from Apache 2.0 build) - ZK proving disabled');
  snarkjsAvailable = false;
}

export interface ProofInput {
  circuit: 'MessageReceipt' | 'MeetingReceipt' | 'PaymentReceipt' | 'ConsentState';
  inputs: Record<string, any>;
}

export interface ProofOutput {
  proof: any;
  publicSignals: string[];
}

export interface ProverMetrics {
  totalProofs: number;
  successfulProofs: number;
  failedProofs: number;
  avgProofTime: number;
  lastProofTime: number;
}

interface JobQueueItem {
  id: string;
  input: ProofInput;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  resolve: (result: ProofOutput) => void;
  reject: (error: Error) => void;
}

export class ZKProverService {
  private queue: JobQueueItem[] = [];
  private processing: boolean = false;
  private metrics: ProverMetrics = {
    totalProofs: 0,
    successfulProofs: 0,
    failedProofs: 0,
    avgProofTime: 0,
    lastProofTime: 0,
  };
  
  private circuitPaths: Record<string, { wasm: string; zkey: string }> = {
    MessageReceipt: {
      wasm: path.join(__dirname, '../build/MessageReceipt_js/MessageReceipt.wasm'),
      zkey: path.join(__dirname, '../build/MessageReceipt_final.zkey'),
    },
    MeetingReceipt: {
      wasm: path.join(__dirname, '../build/MeetingReceipt_js/MeetingReceipt.wasm'),
      zkey: path.join(__dirname, '../build/MeetingReceipt_final.zkey'),
    },
    PaymentReceipt: {
      wasm: path.join(__dirname, '../build/PaymentReceipt_js/PaymentReceipt.wasm'),
      zkey: path.join(__dirname, '../build/PaymentReceipt_final.zkey'),
    },
    ConsentState: {
      wasm: path.join(__dirname, '../build/ConsentState_js/ConsentState.wasm'),
      zkey: path.join(__dirname, '../build/ConsentState_final.zkey'),
    },
  };

  constructor() {
    if (snarkjsAvailable) {
      this.startQueueProcessor();
    }
  }

  public isAvailable(): boolean {
    return snarkjsAvailable;
  }

  public async generateProof(input: ProofInput): Promise<ProofOutput> {
    if (!snarkjsAvailable) {
      throw new Error('ZK proving unavailable: snarkjs (GPL) excluded from Apache 2.0 build. Consider arkworks-rs or gnark alternatives.');
    }

    return new Promise((resolve, reject) => {
      const jobId = this.generateJobId();
      const job: JobQueueItem = {
        id: jobId,
        input,
        attempts: 0,
        maxAttempts: 3,
        createdAt: Date.now(),
        resolve,
        reject,
      };

      this.queue.push(job);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      try {
        const result = await this.executeProof(job);
        job.resolve(result);
        this.metrics.successfulProofs++;
      } catch (error) {
        job.attempts++;

        if (job.attempts < job.maxAttempts) {
          const backoffDelay = this.calculateBackoff(job.attempts);
          console.log(`Retrying job ${job.id} in ${backoffDelay}ms (attempt ${job.attempts}/${job.maxAttempts})`);
          
          await this.sleep(backoffDelay);
          this.queue.unshift(job);
        } else {
          console.error(`Job ${job.id} failed after ${job.maxAttempts} attempts:`, error);
          job.reject(error instanceof Error ? error : new Error(String(error)));
          this.metrics.failedProofs++;
        }
      }

      this.metrics.totalProofs++;
    }

    this.processing = false;
  }

  private async executeProof(job: JobQueueItem): Promise<ProofOutput> {
    if (!groth16) {
      throw new Error('groth16 prover not available');
    }

    const startTime = Date.now();
    const { circuit, inputs } = job.input;

    const circuitFiles = this.circuitPaths[circuit];
    if (!circuitFiles) {
      throw new Error(`Unknown circuit: ${circuit}`);
    }

    if (!fs.existsSync(circuitFiles.wasm)) {
      throw new Error(`Circuit WASM not found: ${circuitFiles.wasm}`);
    }

    if (!fs.existsSync(circuitFiles.zkey)) {
      throw new Error(`Circuit zkey not found: ${circuitFiles.zkey}`);
    }

    console.log(`Generating proof for ${circuit} with job ${job.id}...`);

    const { proof, publicSignals } = await groth16.fullProve(
      inputs,
      circuitFiles.wasm,
      circuitFiles.zkey
    );

    const proofTime = Date.now() - startTime;
    this.metrics.lastProofTime = proofTime;
    this.updateAverageProofTime(proofTime);

    console.log(`Proof generated for ${circuit} in ${proofTime}ms`);

    return { proof, publicSignals };
  }

  public async verifyProof(
    circuit: string,
    proof: any,
    publicSignals: string[]
  ): Promise<boolean> {
    if (!snarkjsAvailable || !groth16) {
      throw new Error('ZK verification unavailable: snarkjs (GPL) excluded from Apache 2.0 build.');
    }

    const vkeyPath = path.join(__dirname, `../build/${circuit}_verification_key.json`);
    
    if (!fs.existsSync(vkeyPath)) {
      throw new Error(`Verification key not found: ${vkeyPath}`);
    }

    const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
    return await groth16.verify(vkey, publicSignals, proof);
  }

  public getMetrics(): ProverMetrics {
    return { ...this.metrics };
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  private generateJobId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000;
    return baseDelay * Math.pow(2, attempt - 1);
  }

  private updateAverageProofTime(newTime: number): void {
    const total = this.metrics.successfulProofs + this.metrics.failedProofs;
    if (total === 0) {
      this.metrics.avgProofTime = newTime;
    } else {
      this.metrics.avgProofTime =
        (this.metrics.avgProofTime * (total - 1) + newTime) / total;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.processing && this.queue.length > 0) {
        this.processQueue();
      }
    }, 100);
  }
}

export const zkProverService = new ZKProverService();
export const zkProverAvailable = snarkjsAvailable;
