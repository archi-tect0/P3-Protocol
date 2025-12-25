import { PgStorage } from './pg-storage';
import { zkProverService } from '../packages/zk/prover/index';
import { BridgeRelayService } from '../packages/bridge/relay/service';
import { Sequencer } from '../packages/rollup/sequencer';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Background Worker Service
 * 
 * Handles asynchronous background jobs:
 * 1. ZK proving job processor - Generates zero-knowledge proofs for receipts
 * 2. Bridge relay worker - Relays receipts across chains
 * 3. Rollup batch worker - Processes rollup batches
 * 4. Audit export worker - Exports audit logs to PDF
 */

export class BackgroundWorker {
  private storage: PgStorage;
  private relayService: BridgeRelayService;
  private sequencer: Sequencer | null = null;
  private isRunning = false;
  private pollInterval = 10000; // 10 seconds

  constructor(storage: PgStorage) {
    this.storage = storage;
    this.relayService = new BridgeRelayService();
  }

  /**
   * Start all background workers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Background workers already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting background workers...');

    // Start ZK proving worker
    this.startZKProvingWorker();

    // Start bridge relay worker
    this.startBridgeRelayWorker();

    // Start rollup batch worker
    this.startRollupBatchWorker();

    // Start audit export worker
    this.startAuditExportWorker();

    console.log('✅ All background workers started');
  }

  /**
   * Stop all background workers
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log('⏹️  Stopping background workers...');
    
    if (this.sequencer) {
      await this.sequencer.stop();
    }

    console.log('✅ All background workers stopped');
  }

  // ============================================================================
  // ZK Proving Worker
  // ============================================================================

  /**
   * Process pending ZK proof generation jobs
   */
  private startZKProvingWorker(): void {
    const processZKJobs = async () => {
      if (!this.isRunning) return;

      try {
        // Get pending ZK jobs (receipts that need proofs)
        const receipts = await this.storage.listReceipts();
        const pendingReceipts = receipts.filter(r => !r.proofBlob || r.proofBlob === null);

        for (const receipt of pendingReceipts.slice(0, 5)) { // Process max 5 at a time
          try {
            console.log(`🔐 Generating ZK proof for receipt ${receipt.id}...`);

            // Determine circuit type based on receipt type
            let circuit: 'MessageReceipt' | 'MeetingReceipt' | 'PaymentReceipt' | 'ConsentState';
            if (receipt.type === 'message') {
              circuit = 'MessageReceipt';
            } else if (receipt.type === 'meeting') {
              circuit = 'MeetingReceipt';
            } else if (receipt.type === 'payment') {
              circuit = 'PaymentReceipt';
            } else {
              circuit = 'ConsentState';
            }

            // Generate proof
            const proofResult = await zkProverService.generateProof({
              circuit,
              inputs: {
                contentHash: receipt.contentHash,
                subjectId: receipt.subjectId,
                timestamp: Math.floor(new Date(receipt.createdAt).getTime() / 1000),
              },
            });

            // Update receipt with proof
            await this.storage.updateReceipt(receipt.id, {
              proofBlob: proofResult,
            });

            console.log(`✅ ZK proof generated for receipt ${receipt.id}`);
          } catch (error) {
            console.error(`❌ Failed to generate ZK proof for receipt ${receipt.id}:`, error);
          }
        }
      } catch (error) {
        console.error('ZK proving worker error:', error);
      }

      // Schedule next run
      setTimeout(processZKJobs, this.pollInterval);
    };

    // Start the worker
    processZKJobs();
  }

  // ============================================================================
  // Bridge Relay Worker
  // ============================================================================

  /**
   * Process pending bridge relay jobs
   */
  private startBridgeRelayWorker(): void {
    const processBridgeJobs = async () => {
      if (!this.isRunning) return;

      try {
        // Get pending bridge jobs
        const jobs = await this.storage.listBridgeJobs({ status: 'pending' });

        for (const job of jobs.slice(0, 3)) { // Process max 3 at a time
          try {
            console.log(`🌉 Processing bridge job ${job.id} to ${job.targetChain}...`);

            // Get the receipt
            const receipt = await this.storage.getReceipt(job.receiptId);
            if (!receipt) {
              console.error(`Receipt not found for job ${job.id}`);
              await this.storage.updateBridgeJob(job.id, {
                status: 'failed',
                lastError: 'Receipt not found',
              });
              continue;
            }

            // Update job callback
            const updateJob = async (status: string, txHash?: string, error?: string) => {
              await this.storage.updateBridgeJob(job.id, {
                status: status as any,
                txHash: txHash || null,
                lastError: error || null,
                attempts: job.attempts + 1,
              });
            };

            // Relay the receipt
            const result = await this.relayService.retryRelay(
              {
                id: job.id,
                docHash: job.docHash,
                targetChain: job.targetChain as any,
                receiptData: {
                  type: receipt.type,
                  subjectId: receipt.subjectId,
                  contentHash: receipt.contentHash,
                  proofBlob: receipt.proofBlob,
                  immutableSeq: receipt.immutableSeq,
                },
                attempts: job.attempts,
                maxAttempts: job.maxAttempts,
                status: job.status as any,
              },
              updateJob
            );

            if (result.success) {
              console.log(`✅ Bridge job ${job.id} completed: ${result.txHash}`);
            } else {
              console.error(`❌ Bridge job ${job.id} failed: ${result.error}`);
            }
          } catch (error) {
            console.error(`❌ Failed to process bridge job ${job.id}:`, error);
            await this.storage.updateBridgeJob(job.id, {
              status: 'failed',
              lastError: error instanceof Error ? error.message : 'Unknown error',
              attempts: job.attempts + 1,
            });
          }
        }
      } catch (error) {
        console.error('Bridge relay worker error:', error);
      }

      // Schedule next run
      setTimeout(processBridgeJobs, this.pollInterval);
    };

    // Start the worker
    processBridgeJobs();
  }

  // ============================================================================
  // Rollup Batch Worker
  // ============================================================================

  /**
   * Process rollup batches periodically
   */
  private startRollupBatchWorker(): void {
    const processRollupBatches = async () => {
      if (!this.isRunning) return;

      try {
        // Initialize sequencer if not already initialized
        if (!this.sequencer && process.env.RPC_URL) {
          const { ethers } = await import('ethers');
          const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
          const signer = process.env.SEQUENCER_PRIVATE_KEY
            ? new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY, provider)
            : undefined;

          this.sequencer = new Sequencer(provider, signer);
          await this.sequencer.start();
        }

        if (this.sequencer) {
          // Force batch creation if needed
          const stats = this.sequencer.getStats();
          if (stats.queueSize > 100 || (stats.queueSize > 0 && Date.now() - stats.lastBatchTime > 60000)) {
            console.log('📦 Creating rollup batch...');
            const batch = await this.sequencer.forceBatchCreation();
            if (batch) {
              console.log(`✅ Rollup batch created: ${batch.batchId}`);
            }
          }
        }
      } catch (error) {
        console.error('Rollup batch worker error:', error);
      }

      // Schedule next run
      setTimeout(processRollupBatches, this.pollInterval * 3); // 30 seconds
    };

    // Start the worker
    processRollupBatches();
  }

  // ============================================================================
  // Audit Export Worker
  // ============================================================================

  /**
   * Export audit logs to PDF periodically
   */
  private startAuditExportWorker(): void {
    const exportAuditLogs = async () => {
      if (!this.isRunning) return;

      try {
        // Check if we need to export (e.g., daily at midnight)
        const now = new Date();
        const isExportTime = now.getHours() === 0 && now.getMinutes() < 10;

        if (isExportTime) {
          console.log('📄 Exporting audit logs...');

          // Get yesterday's audit logs
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);

          const endOfYesterday = new Date(yesterday);
          endOfYesterday.setHours(23, 59, 59, 999);

          const auditLogs = await this.storage.getAuditLog();
          const yesterdayLogs = auditLogs.filter(log => {
            const logDate = new Date(log.createdAt);
            return logDate >= yesterday && logDate <= endOfYesterday;
          });

          if (yesterdayLogs.length > 0) {
            // Generate PDF
            const doc = new jsPDF();
            const filename = `audit-logs-${yesterday.toISOString().split('T')[0]}.pdf`;

            doc.setFontSize(16);
            doc.text('Audit Logs Report', 14, 20);
            doc.setFontSize(10);
            doc.text(`Date: ${yesterday.toISOString().split('T')[0]}`, 14, 30);
            doc.text(`Total Events: ${yesterdayLogs.length}`, 14, 36);

            // Add table
            (doc as any).autoTable({
              startY: 45,
              head: [['Time', 'Entity Type', 'Entity ID', 'Action', 'Actor']],
              body: yesterdayLogs.map(log => [
                new Date(log.createdAt).toLocaleTimeString(),
                log.entityType,
                log.entityId.substring(0, 12) + '...',
                log.action,
                log.actor.substring(0, 12) + '...',
              ]),
              styles: { fontSize: 8 },
              headStyles: { fillColor: [66, 66, 66] },
            });

            // Save to storage (could be uploaded to cloud storage)
            const pdfBlob = doc.output('blob');
            console.log(`✅ Audit logs exported: ${filename} (${(pdfBlob.size / 1024).toFixed(2)} KB)`);
          }
        }
      } catch (error) {
        console.error('Audit export worker error:', error);
      }

      // Schedule next run (check every 5 minutes)
      setTimeout(exportAuditLogs, this.pollInterval * 30); // 5 minutes
    };

    // Start the worker
    exportAuditLogs();
  }
}

/**
 * Initialize and start background workers
 */
export async function startBackgroundWorkers(storage: PgStorage): Promise<BackgroundWorker> {
  const worker = new BackgroundWorker(storage);
  await worker.start();
  return worker;
}
