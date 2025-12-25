import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { Sequencer } from '../packages/rollup/sequencer';
import { StateManager } from '../packages/rollup/state/manager';
import { DataAvailabilityAdapter } from '../packages/rollup/da/adapter';
import { CheckpointService } from '../packages/rollup/checkpoint/service';
import { BridgeClient } from '../packages/rollup/bridge/client';

let sequencer: Sequencer | null = null;
let stateManager: StateManager | null = null;
let daAdapter: DataAvailabilityAdapter | null = null;
let checkpointService: CheckpointService | null = null;
let bridgeClient: BridgeClient | null = null;

export function createRollupRoutes(): Router {
  const router = Router();

  router.get('/api/rollup/status', async (req: Request, res: Response) => {
    try {
      const status: any = {
        timestamp: Date.now(),
        services: {},
      };

      if (sequencer) {
        status.services.sequencer = {
          running: true,
          stats: sequencer.getStats(),
        };
      } else {
        status.services.sequencer = {
          running: false,
        };
      }

      if (stateManager) {
        const stateStats = await stateManager.getStats();
        status.services.stateManager = {
          running: true,
          stats: stateStats,
        };
      } else {
        status.services.stateManager = {
          running: false,
        };
      }

      if (daAdapter) {
        status.services.dataAvailability = {
          running: true,
          stats: daAdapter.getStats(),
        };
      } else {
        status.services.dataAvailability = {
          running: false,
        };
      }

      if (checkpointService) {
        status.services.checkpoint = {
          running: true,
          stats: checkpointService.getStats(),
        };
      } else {
        status.services.checkpoint = {
          running: false,
        };
      }

      if (bridgeClient) {
        status.services.bridge = {
          running: true,
          stats: bridgeClient.getStats(),
        };
      } else {
        status.services.bridge = {
          running: false,
        };
      }

      res.json(status);
    } catch (error) {
      console.error('[Rollup Routes] Error getting status:', error);
      res.status(500).json({
        error: 'Failed to get rollup status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.post('/api/rollup/event', async (req: Request, res: Response) => {
    try {
      if (!sequencer) {
        return res.status(503).json({
          error: 'Sequencer not initialized',
        });
      }

      const event = req.body;
      
      if (!event.id || !event.type || !event.userId) {
        return res.status(400).json({
          error: 'Invalid event data',
          required: ['id', 'type', 'userId'],
        });
      }

      await sequencer.addEvent({
        ...event,
        timestamp: event.timestamp || Date.now(),
      });

      res.json({
        success: true,
        eventId: event.id,
        queued: true,
      });
    } catch (error) {
      console.error('[Rollup Routes] Error adding event:', error);
      res.status(500).json({
        error: 'Failed to add event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.post('/api/rollup/batch/force', async (req: Request, res: Response) => {
    try {
      if (!sequencer) {
        return res.status(503).json({
          error: 'Sequencer not initialized',
        });
      }

      const batch = await sequencer.forceBatchCreation();

      if (!batch) {
        return res.json({
          success: true,
          message: 'No events to batch',
        });
      }

      res.json({
        success: true,
        batch: {
          id: batch.id,
          eventCount: batch.eventCount,
          merkleRoot: batch.merkleRoot,
          startTime: batch.startTime,
          endTime: batch.endTime,
        },
      });
    } catch (error) {
      console.error('[Rollup Routes] Error forcing batch:', error);
      res.status(500).json({
        error: 'Failed to force batch creation',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/api/rollup/state/event/:eventId', async (req: Request, res: Response) => {
    try {
      if (!stateManager) {
        return res.status(503).json({
          error: 'State manager not initialized',
        });
      }

      const eventIndex = await stateManager.getEventIndex(req.params.eventId);

      if (!eventIndex) {
        return res.status(404).json({
          error: 'Event not found',
        });
      }

      res.json({
        success: true,
        event: eventIndex,
      });
    } catch (error) {
      console.error('[Rollup Routes] Error getting event:', error);
      res.status(500).json({
        error: 'Failed to get event',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/api/rollup/state/consent/:userId', async (req: Request, res: Response) => {
    try {
      if (!stateManager) {
        return res.status(503).json({
          error: 'State manager not initialized',
        });
      }

      const version = req.query.version ? parseInt(req.query.version as string) : undefined;
      const consentRoot = await stateManager.getConsentRoot(req.params.userId, version);

      if (!consentRoot) {
        return res.status(404).json({
          error: 'Consent root not found',
        });
      }

      res.json({
        success: true,
        consentRoot,
      });
    } catch (error) {
      console.error('[Rollup Routes] Error getting consent root:', error);
      res.status(500).json({
        error: 'Failed to get consent root',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.post('/api/rollup/bridge/relay', async (req: Request, res: Response) => {
    try {
      if (!bridgeClient) {
        return res.status(503).json({
          error: 'Bridge client not initialized',
        });
      }

      const { receiptId, sourceChain, targetChain, data } = req.body;

      if (!receiptId || !sourceChain || !targetChain || !data) {
        return res.status(400).json({
          error: 'Invalid relay data',
          required: ['receiptId', 'sourceChain', 'targetChain', 'data'],
        });
      }

      const txHash = await bridgeClient.relayReceipt({
        receiptId,
        sourceChain,
        targetChain,
        data,
      });

      res.json({
        success: true,
        receiptId,
        txHash,
        status: 'pending',
      });
    } catch (error) {
      console.error('[Rollup Routes] Error relaying receipt:', error);
      res.status(500).json({
        error: 'Failed to relay receipt',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/api/rollup/bridge/receipt/:receiptId', async (req: Request, res: Response) => {
    try {
      if (!bridgeClient) {
        return res.status(503).json({
          error: 'Bridge client not initialized',
        });
      }

      const receipt = await bridgeClient.getReceiptStatus(req.params.receiptId);

      if (!receipt) {
        return res.status(404).json({
          error: 'Receipt not found',
        });
      }

      res.json({
        success: true,
        receipt,
      });
    } catch (error) {
      console.error('[Rollup Routes] Error getting receipt:', error);
      res.status(500).json({
        error: 'Failed to get receipt',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

export async function initializeRollupServices(config?: any): Promise<void> {
  try {
    console.log('[Rollup] Initializing rollup services...');

    const provider = new ethers.JsonRpcProvider(
      process.env.L2_RPC_URL || 'http://localhost:8545'
    );
    
    const privateKey = process.env.ROLLUP_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.warn('[Rollup] No private key configured, skipping sequencer initialization');
      return;
    }

    const signer = new ethers.Wallet(privateKey, provider);

    stateManager = new StateManager({
      dbPath: process.env.ROLLUP_STATE_DB_PATH || './data/rollup-state',
    });
    await stateManager.open();
    console.log('[Rollup] State manager initialized');

    if (process.env.ENABLE_SEQUENCER === 'true') {
      sequencer = new Sequencer({
        batchInterval: parseInt(process.env.BATCH_INTERVAL || '30000'),
        maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '1000'),
        anchorRegistryAddress: process.env.ANCHOR_REGISTRY_ADDRESS || ethers.ZeroAddress,
        anchorRegistryABI: config?.anchorRegistryABI || [],
        provider,
        signer,
      });
      sequencer.start();
      console.log('[Rollup] Sequencer started');
    }

    if (process.env.ENABLE_DA_ADAPTER === 'true') {
      daAdapter = new DataAvailabilityAdapter({
        l2Provider: provider,
        l2Signer: signer,
        enableBlobStorage: process.env.ENABLE_BLOB_STORAGE === 'true',
        maxCalldataSize: parseInt(process.env.MAX_CALLDATA_SIZE || '131072'),
      });
      console.log('[Rollup] DA adapter initialized');
    }

    if (process.env.ENABLE_CHECKPOINT === 'true') {
      const l1Provider = new ethers.JsonRpcProvider(
        process.env.L1_RPC_URL || 'http://localhost:8545'
      );
      const l1Signer = new ethers.Wallet(privateKey, l1Provider);

      checkpointService = new CheckpointService({
        l1Provider,
        l1Signer,
        checkpointRegistryAddress: process.env.CHECKPOINT_REGISTRY_ADDRESS || ethers.ZeroAddress,
        checkpointRegistryABI: config?.checkpointRegistryABI || [],
        checkpointInterval: parseInt(process.env.CHECKPOINT_INTERVAL || '3600000'),
      });
      checkpointService.start();
      console.log('[Rollup] Checkpoint service started');
    }

    console.log('[Rollup] All enabled services initialized successfully');
  } catch (error) {
    console.error('[Rollup] Error initializing services:', error);
    throw error;
  }
}

export async function shutdownRollupServices(): Promise<void> {
  try {
    console.log('[Rollup] Shutting down rollup services...');

    if (sequencer) {
      sequencer.stop();
      sequencer = null;
    }

    if (stateManager) {
      await stateManager.close();
      stateManager = null;
    }

    if (checkpointService) {
      checkpointService.stop();
      checkpointService = null;
    }

    if (bridgeClient) {
      bridgeClient.cleanup();
      bridgeClient = null;
    }

    console.log('[Rollup] All services shut down');
  } catch (error) {
    console.error('[Rollup] Error shutting down services:', error);
  }
}
