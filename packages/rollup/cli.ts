#!/usr/bin/env node

import { Command } from 'commander';
import { ethers } from 'ethers';
import { Sequencer } from './sequencer';
import { StateManager } from './state/manager';
import { DataAvailabilityAdapter } from './da/adapter';
import { CheckpointService } from './checkpoint/service';
import { BridgeClient } from './bridge/client';
import dotenv from 'dotenv';

dotenv.config();

const program = new Command();

program
  .name('rollup')
  .description('L3 Rollup Infrastructure CLI')
  .version('1.0.0');

program
  .command('start')
  .description('Start rollup services')
  .option('--sequencer', 'Start sequencer service')
  .option('--checkpoint', 'Start checkpoint service')
  .option('--all', 'Start all services')
  .action(async (options) => {
    console.log('[Rollup CLI] Starting services...');

    try {
      const provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL || 'http://localhost:8545');
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);

      if (options.sequencer || options.all) {
        console.log('[Rollup CLI] Starting sequencer...');
        const sequencer = new Sequencer({
          batchInterval: 30000,
          maxBatchSize: 1000,
          anchorRegistryAddress: process.env.ANCHOR_REGISTRY_ADDRESS || ethers.ZeroAddress,
          anchorRegistryABI: [],
          provider,
          signer,
        });

        sequencer.start();
        console.log('[Rollup CLI] Sequencer started');
      }

      if (options.checkpoint || options.all) {
        console.log('[Rollup CLI] Starting checkpoint service...');
        const l1Provider = new ethers.JsonRpcProvider(process.env.L1_RPC_URL || 'http://localhost:8545');
        const l1Signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, l1Provider);

        const checkpointService = new CheckpointService({
          l1Provider,
          l1Signer,
          checkpointRegistryAddress: process.env.CHECKPOINT_REGISTRY_ADDRESS || ethers.ZeroAddress,
          checkpointRegistryABI: [],
          checkpointInterval: 60 * 60 * 1000,
        });

        checkpointService.start();
        console.log('[Rollup CLI] Checkpoint service started');
      }

      if (options.all) {
        console.log('[Rollup CLI] All services started successfully');
      }

      process.on('SIGINT', () => {
        console.log('[Rollup CLI] Shutting down...');
        process.exit(0);
      });
    } catch (error) {
      console.error('[Rollup CLI] Error starting services:', error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Force batch creation')
  .option('--force', 'Force immediate batch creation')
  .action(async (options) => {
    console.log('[Rollup CLI] Creating batch...');

    try {
      const provider = new ethers.JsonRpcProvider(process.env.L2_RPC_URL || 'http://localhost:8545');
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, provider);

      const sequencer = new Sequencer({
        batchInterval: 30000,
        maxBatchSize: 1000,
        anchorRegistryAddress: process.env.ANCHOR_REGISTRY_ADDRESS || ethers.ZeroAddress,
        anchorRegistryABI: [],
        provider,
        signer,
      });

      if (options.force) {
        const batch = await sequencer.forceBatchCreation();
        if (batch) {
          console.log(`[Rollup CLI] Batch created: ${batch.id}`);
          console.log(`  Events: ${batch.eventCount}`);
          console.log(`  Merkle Root: ${batch.merkleRoot}`);
        } else {
          console.log('[Rollup CLI] No events to batch');
        }
      }

      process.exit(0);
    } catch (error) {
      console.error('[Rollup CLI] Error creating batch:', error);
      process.exit(1);
    }
  });

program
  .command('checkpoint')
  .description('Force checkpoint creation')
  .option('--l2-root <root>', 'L2 state root')
  .option('--dao-root <root>', 'DAO state root')
  .action(async (options) => {
    console.log('[Rollup CLI] Creating checkpoint...');

    try {
      const l1Provider = new ethers.JsonRpcProvider(process.env.L1_RPC_URL || 'http://localhost:8545');
      const l1Signer = new ethers.Wallet(process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey, l1Provider);

      const checkpointService = new CheckpointService({
        l1Provider,
        l1Signer,
        checkpointRegistryAddress: process.env.CHECKPOINT_REGISTRY_ADDRESS || ethers.ZeroAddress,
        checkpointRegistryABI: [],
        checkpointInterval: 60 * 60 * 1000,
      });

      const checkpointData = {
        l2Root: options.l2Root || ethers.ZeroHash,
        daoStateRoot: options.daoRoot || ethers.ZeroHash,
        timestamp: Date.now(),
        batchCount: 0,
        eventCount: 0,
      };

      const txHash = await checkpointService.forceCheckpoint(checkpointData);
      console.log(`[Rollup CLI] Checkpoint created: ${txHash}`);

      process.exit(0);
    } catch (error) {
      console.error('[Rollup CLI] Error creating checkpoint:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Get rollup status')
  .action(async () => {
    console.log('[Rollup CLI] Fetching status...');

    try {
      const stateManager = new StateManager({
        dbPath: process.env.STATE_DB_PATH || './data/rollup-state',
      });

      await stateManager.open();
      const stats = await stateManager.getStats();
      await stateManager.close();

      console.log('\n[Rollup Status]');
      console.log(`  State DB Path: ${stats.dbPath}`);
      console.log(`  DB Open: ${stats.isOpen}`);
      if (stats.approximateSize) {
        console.log(`  DB Size: ${stats.approximateSize}`);
      }

      process.exit(0);
    } catch (error) {
      console.error('[Rollup CLI] Error fetching status:', error);
      process.exit(1);
    }
  });

program.parse();
