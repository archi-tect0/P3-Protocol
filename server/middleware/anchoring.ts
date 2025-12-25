import { ethers } from 'ethers';
import { getBaseMainnetService, getBaseSepoliaService } from '../services/blockchain';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'anchoring' });

/**
 * Result returned from the anchoring operation
 */
export interface AnchorResult {
  anchorStatus: 'none' | 'pending' | 'failed';
  anchorTxHash: string | null;
  anchorTimestamp: Date | null;
  anchorId?: string | null;
}

/**
 * Anchors content to the blockchain via the AnchorRegistry contract using BlockchainService
 * 
 * This production-ready implementation:
 * - Uses the centralized BlockchainService for consistent blockchain interaction
 * - Supports both Base Mainnet and Base Sepolia networks based on NODE_ENV
 * - Handles private key configuration errors gracefully
 * - Provides detailed logging for monitoring and debugging
 * - Converts content hashes to proper bytes32 format
 * - Returns transaction hash and anchor ID for verification
 * 
 * @param contentHash - The hash of the content to anchor (will be converted to bytes32)
 * @param entityType - The type of entity being anchored (e.g., 'receipt', 'message', 'note')
 * @param shouldAnchor - Whether to perform the anchoring operation
 * @returns AnchorResult containing the status, transaction hash, timestamp, and anchor ID
 * 
 * @throws Never throws - all errors are caught and returned as failed status
 * 
 * @example
 * ```typescript
 * const result = await anchorToBlockchain(
 *   '0x1234...', 
 *   'receipt', 
 *   true
 * );
 * console.log(result.anchorStatus); // 'pending'
 * console.log(result.anchorTxHash); // '0xabcd...'
 * console.log(result.anchorId); // '123'
 * ```
 */
export async function anchorToBlockchain(
  contentHash: string,
  entityType: string,
  shouldAnchor: boolean
): Promise<AnchorResult> {
  if (!shouldAnchor) {
    logger.debug('Anchoring skipped', { entityType, reason: 'shouldAnchor=false' });
    return {
      anchorStatus: 'none',
      anchorTxHash: null,
      anchorTimestamp: null,
      anchorId: null
    };
  }

  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      logger.error('Anchoring failed: PRIVATE_KEY environment variable not set');
      return {
        anchorStatus: 'failed',
        anchorTxHash: null,
        anchorTimestamp: new Date(),
        anchorId: null
      };
    }

    const nodeEnv = process.env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    
    logger.info('Initiating blockchain anchoring', {
      entityType,
      network: isProduction ? 'base-mainnet' : 'base-sepolia',
      contentHashLength: contentHash.length
    });

    let blockchainService;
    try {
      blockchainService = isProduction 
        ? getBaseMainnetService() 
        : getBaseSepoliaService();
    } catch (error) {
      logger.error('Failed to initialize blockchain service', error as Error, {
        network: isProduction ? 'base-mainnet' : 'base-sepolia'
      });
      return {
        anchorStatus: 'failed',
        anchorTxHash: null,
        anchorTimestamp: new Date(),
        anchorId: null
      };
    }

    let formattedHash: string;
    if (contentHash.startsWith('0x') && contentHash.length === 66) {
      formattedHash = contentHash;
    } else if (contentHash.startsWith('0x')) {
      formattedHash = ethers.zeroPadValue(contentHash, 32);
      logger.debug('Padded content hash to bytes32', { 
        original: contentHash, 
        padded: formattedHash 
      });
    } else {
      formattedHash = ethers.id(contentHash);
      logger.debug('Hashed content to bytes32', { 
        original: contentHash, 
        hashed: formattedHash 
      });
    }

    const result = await blockchainService.anchorData(formattedHash, entityType);

    logger.info('Content successfully anchored to blockchain', {
      anchorId: result.anchorId,
      txHash: result.txHash,
      entityType,
      network: isProduction ? 'base-mainnet' : 'base-sepolia'
    });

    return {
      anchorStatus: 'pending',
      anchorTxHash: result.txHash,
      anchorTimestamp: new Date(),
      anchorId: result.anchorId
    };

  } catch (error) {
    logger.error('Blockchain anchoring failed', error as Error, {
      entityType,
      contentHashPrefix: contentHash.substring(0, 10)
    });

    return {
      anchorStatus: 'failed',
      anchorTxHash: null,
      anchorTimestamp: new Date(),
      anchorId: null
    };
  }
}
