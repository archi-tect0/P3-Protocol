/**
 * Receipt Escrow Module
 * 
 * Atlas API 2.0 - Client-signed receipts with async anchoring.
 * 
 * Exports:
 * - escrowService: For API handlers to escrow and query receipts
 * - clientSigning: For signature verification
 * - getEscrowQueue: For queue management and metrics
 * - startEscrowWorker: For server initialization
 */

export {
  escrowService,
  escrowReceipt,
  queueReceipt,
  queueReceiptBatch,
  anchorReceipt,
  processEscrowBatch,
  getEscrowStatus,
  getEscrowedReceipts,
  getReceiptsBySession,
  getReceiptsByWallet,
  getPendingReceipts,
  markAnchoring,
  markAnchored,
  markFailed,
  retryFailedReceipts,
  type ReceiptInput,
  type QueueResult,
  type EscrowStatusResult,
} from './escrowService';

export {
  clientSigning,
  verifyClientSignature,
  verifyBinaryReceiptSignature,
  computeReceiptHash,
  buildSigningMessage,
  isValidSignatureFormat,
  type ReceiptData,
  type SignatureVerificationResult,
} from './clientSigning';

export {
  getEscrowQueue,
  closeEscrowQueue,
  type EscrowJobData,
  type EscrowBatchJobData,
} from './escrowQueue';

export {
  startEscrowWorker,
  stopEscrowWorker,
  getEscrowWorkerStatus,
} from './escrowWorker';

export { default as escrowRoutes } from './escrowRoutes';
