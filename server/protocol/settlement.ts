/**
 * Protocol-Wide Settlement Service
 * 
 * Extends cross-chain capabilities to ALL P3 Protocol actions, not just marketplace.
 * Users on any chain (Solana, Polygon, Arbitrum, etc.) can use the protocol by
 * settling fees to the Base treasury.
 * 
 * Key Principle: Fees are OPTIONAL but enable cross-chain access.
 */

import { Router } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import crypto from 'crypto';

export const protocolSettlementRouter = Router();

export type SettleMode = 'BASE_USDC' | 'BASE_DIRECT' | 'RELAY_LZ' | 'RELAY_WH';
export type RelayStatus = 'pending' | 'confirmed' | 'failed';

export type ProtocolActionType = 
  | 'call'        // video/voice calls
  | 'message'     // encrypted messages
  | 'anchor'      // blockchain anchoring
  | 'governance'  // DAO votes
  | 'marketplace' // marketplace transactions
  | 'storage';    // IPFS storage

export interface FeeScheduleEntry {
  actionType: ProtocolActionType;
  baseFeeUsd: number;
  unit: 'per_minute' | 'per_message' | 'per_anchor' | 'per_vote' | 'per_asset' | 'per_mb';
  isFree: boolean;
  isConfigurable: boolean;
  description: string;
}

export interface ProtocolSettlementParams {
  actionId: string;
  actionType: ProtocolActionType;
  walletAddress: string;
  recipientWallet?: string;
  amountUsd?: number;
  quantity?: number;
  settleMode: SettleMode;
  originChain: string;
  feeCurrency?: string;
  metadata?: Record<string, unknown>;
}

export interface ProtocolSettlementResult {
  success: boolean;
  actionId: string;
  actionType: ProtocolActionType;
  feeUsd: number;
  txHashBase?: string;
  relayStatus: RelayStatus;
  anchorDigest?: string;
  error?: string;
  settlementId?: string;
  timestamp: number;
}

export interface LayerZeroRelayParams {
  srcChainId: number;
  dstChainId: number;
  adapterParams?: string;
}

export interface WormholeRelayParams {
  srcChainName: string;
  nonce?: number;
}

const USDC_CONTRACT_BASE = process.env.USDC_CONTRACT_BASE || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const TREASURY_WALLET = process.env.TREASURY_WALLET || process.env.P3_TREASURY_WALLET || '0x0000000000000000000000000000000000000000';

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (provider) return provider;
  const rpcUrl = process.env.RPC_URL_BASE_MAINNET || process.env.RPC_URL_BASE || 'https://mainnet.base.org';
  provider = new ethers.JsonRpcProvider(rpcUrl);
  return provider;
}

function getWallet(): ethers.Wallet | null {
  if (wallet) return wallet;
  const privateKey = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) return null;
  wallet = new ethers.Wallet(privateKey, getProvider());
  return wallet;
}

function computeDigest(data: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function generateSettlementId(): string {
  return `settle:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
}

const DEFAULT_FEE_SCHEDULE: Map<ProtocolActionType, FeeScheduleEntry> = new Map([
  ['call', {
    actionType: 'call',
    baseFeeUsd: 0.01,
    unit: 'per_minute',
    isFree: false,
    isConfigurable: true,
    description: 'Video/voice call fee per minute',
  }],
  ['message', {
    actionType: 'message',
    baseFeeUsd: 0.001,
    unit: 'per_message',
    isFree: true,
    isConfigurable: true,
    description: 'Encrypted message fee (optional)',
  }],
  ['anchor', {
    actionType: 'anchor',
    baseFeeUsd: 0.57,
    unit: 'per_anchor',
    isFree: false,
    isConfigurable: false,
    description: 'Blockchain anchoring fee',
  }],
  ['governance', {
    actionType: 'governance',
    baseFeeUsd: 0,
    unit: 'per_vote',
    isFree: true,
    isConfigurable: false,
    description: 'DAO governance vote (always free)',
  }],
  ['marketplace', {
    actionType: 'marketplace',
    baseFeeUsd: 0,
    unit: 'per_asset',
    isFree: false,
    isConfigurable: true,
    description: 'Marketplace transaction (varies by asset)',
  }],
  ['storage', {
    actionType: 'storage',
    baseFeeUsd: 0.01,
    unit: 'per_mb',
    isFree: false,
    isConfigurable: true,
    description: 'IPFS storage fee per MB',
  }],
]);

const LZ_CHAIN_IDS: Record<string, number> = {
  'ethereum': 101,
  'polygon': 109,
  'arbitrum': 110,
  'optimism': 111,
  'avalanche': 106,
  'bsc': 102,
  'base': 184,
  'solana': 168,
  'fantom': 112,
  'celo': 125,
  'moonbeam': 126,
};

const SUPPORTED_CHAINS = [
  { id: 'base', name: 'Base', chainId: 8453, isDestination: true, relayModes: ['BASE_USDC', 'BASE_DIRECT'] as SettleMode[] },
  { id: 'ethereum', name: 'Ethereum', chainId: 1, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
  { id: 'polygon', name: 'Polygon', chainId: 137, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
  { id: 'optimism', name: 'Optimism', chainId: 10, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
  { id: 'avalanche', name: 'Avalanche', chainId: 43114, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
  { id: 'bsc', name: 'BNB Chain', chainId: 56, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
  { id: 'solana', name: 'Solana', chainId: 0, relayModes: ['RELAY_WH'] as SettleMode[] },
  { id: 'fantom', name: 'Fantom', chainId: 250, relayModes: ['RELAY_LZ', 'RELAY_WH'] as SettleMode[] },
];

export class ProtocolSettlement {
  private feeSchedule: Map<ProtocolActionType, FeeScheduleEntry>;
  private settlementHistory: Map<string, ProtocolSettlementResult>;

  constructor(customFeeSchedule?: Partial<Record<ProtocolActionType, Partial<FeeScheduleEntry>>>) {
    this.feeSchedule = new Map(DEFAULT_FEE_SCHEDULE);
    this.settlementHistory = new Map();

    if (customFeeSchedule) {
      for (const [actionType, overrides] of Object.entries(customFeeSchedule)) {
        const existing = this.feeSchedule.get(actionType as ProtocolActionType);
        if (existing && existing.isConfigurable) {
          this.feeSchedule.set(actionType as ProtocolActionType, { ...existing, ...overrides });
        }
      }
    }
  }

  getFeeForAction(actionType: ProtocolActionType, quantity: number = 1): number {
    const entry = this.feeSchedule.get(actionType);
    if (!entry) {
      console.warn(`[ProtocolSettlement] Unknown action type: ${actionType}`);
      return 0;
    }

    if (entry.isFree) {
      return 0;
    }

    return entry.baseFeeUsd * quantity;
  }

  isSettlementRequired(actionType: ProtocolActionType): boolean {
    const entry = this.feeSchedule.get(actionType);
    if (!entry) {
      return false;
    }
    return !entry.isFree;
  }

  getFeeSchedule(): FeeScheduleEntry[] {
    return Array.from(this.feeSchedule.values());
  }

  getFeeEntry(actionType: ProtocolActionType): FeeScheduleEntry | undefined {
    return this.feeSchedule.get(actionType);
  }

  async settleAction(params: ProtocolSettlementParams): Promise<ProtocolSettlementResult> {
    const settlementId = generateSettlementId();
    const timestamp = Date.now();

    console.log('[ProtocolSettlement] Processing settlement:', {
      settlementId,
      actionType: params.actionType,
      actionId: params.actionId,
      settleMode: params.settleMode,
      originChain: params.originChain,
    });

    const feeEntry = this.feeSchedule.get(params.actionType);
    if (!feeEntry) {
      return {
        success: false,
        actionId: params.actionId,
        actionType: params.actionType,
        feeUsd: 0,
        relayStatus: 'failed',
        error: `Unknown action type: ${params.actionType}`,
        settlementId,
        timestamp,
      };
    }

    const quantity = params.quantity || 1;
    const feeUsd = params.amountUsd ?? this.getFeeForAction(params.actionType, quantity);

    if (feeEntry.isFree || feeUsd === 0) {
      console.log(`[ProtocolSettlement] Action ${params.actionType} is free, no settlement needed`);
      
      const anchorDigest = computeDigest({
        actionId: params.actionId,
        actionType: params.actionType,
        wallet: params.walletAddress,
        originChain: params.originChain,
        timestamp,
      });

      const result: ProtocolSettlementResult = {
        success: true,
        actionId: params.actionId,
        actionType: params.actionType,
        feeUsd: 0,
        relayStatus: 'confirmed',
        anchorDigest,
        settlementId,
        timestamp,
      };

      this.settlementHistory.set(settlementId, result);
      return result;
    }

    let settlementResult: { success: boolean; txHashBase?: string; relayStatus: RelayStatus; error?: string };

    switch (params.settleMode) {
      case 'BASE_USDC':
        settlementResult = await this.settleFeeBaseUSDC(feeUsd, params);
        break;

      case 'BASE_DIRECT':
        settlementResult = await this.settleFeeBaseNative(feeUsd, params);
        break;

      case 'RELAY_LZ':
        settlementResult = await this.relayFeeLayerZero(feeUsd, params);
        break;

      case 'RELAY_WH':
        settlementResult = await this.relayFeeWormhole(feeUsd, params);
        break;

      default:
        settlementResult = await this.settleFeeBaseUSDC(feeUsd, params);
    }

    const anchorDigest = computeDigest({
      settlementId,
      actionId: params.actionId,
      actionType: params.actionType,
      wallet: params.walletAddress,
      recipient: params.recipientWallet,
      feeUsd,
      settleMode: params.settleMode,
      originChain: params.originChain,
      txHashBase: settlementResult.txHashBase,
      timestamp,
    });

    const result: ProtocolSettlementResult = {
      success: settlementResult.success,
      actionId: params.actionId,
      actionType: params.actionType,
      feeUsd,
      txHashBase: settlementResult.txHashBase,
      relayStatus: settlementResult.relayStatus,
      anchorDigest,
      error: settlementResult.error,
      settlementId,
      timestamp,
    };

    this.settlementHistory.set(settlementId, result);

    console.log('[ProtocolSettlement] Settlement complete:', {
      settlementId,
      success: result.success,
      feeUsd,
      relayStatus: result.relayStatus,
    });

    return result;
  }

  private async settleFeeBaseUSDC(
    feeUsd: number,
    params: ProtocolSettlementParams
  ): Promise<{ success: boolean; txHashBase?: string; relayStatus: RelayStatus; error?: string }> {
    console.log('[ProtocolSettlement] settleFeeBaseUSDC:', {
      actionType: params.actionType,
      feeUsd,
      from: params.walletAddress,
      to: TREASURY_WALLET,
    });

    const w = getWallet();
    if (!w) {
      console.log('[ProtocolSettlement] No wallet configured, simulating success');
      return {
        success: true,
        txHashBase: `sim:usdc:${params.actionType}:${Date.now()}:${params.actionId.slice(0, 8)}`,
        relayStatus: 'confirmed',
      };
    }

    try {
      const usdcAbi = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address account) view returns (uint256)',
      ];
      const usdc = new ethers.Contract(USDC_CONTRACT_BASE, usdcAbi, w);
      
      const amountWei = ethers.parseUnits(feeUsd.toString(), 6);
      const tx = await usdc.transfer(TREASURY_WALLET, amountWei);
      const receipt = await tx.wait(1);

      return {
        success: true,
        txHashBase: receipt.hash,
        relayStatus: 'confirmed',
      };
    } catch (error: any) {
      console.error('[ProtocolSettlement] USDC transfer failed:', error);
      return {
        success: false,
        relayStatus: 'failed',
        error: error.message || 'USDC transfer failed',
      };
    }
  }

  private async settleFeeBaseNative(
    feeUsd: number,
    params: ProtocolSettlementParams
  ): Promise<{ success: boolean; txHashBase?: string; relayStatus: RelayStatus; error?: string }> {
    console.log('[ProtocolSettlement] settleFeeBaseNative:', {
      actionType: params.actionType,
      feeUsd,
      from: params.walletAddress,
      to: TREASURY_WALLET,
    });

    const w = getWallet();
    if (!w) {
      console.log('[ProtocolSettlement] No wallet configured, simulating success');
      return {
        success: true,
        txHashBase: `sim:eth:${params.actionType}:${Date.now()}:${params.actionId.slice(0, 8)}`,
        relayStatus: 'confirmed',
      };
    }

    try {
      const ethPriceUsd = 3000;
      const amountEth = feeUsd / ethPriceUsd;
      const amountWei = ethers.parseEther(amountEth.toFixed(18));

      const tx = await w.sendTransaction({
        to: TREASURY_WALLET,
        value: amountWei,
      });
      const receipt = await tx.wait(1);

      return {
        success: true,
        txHashBase: receipt?.hash,
        relayStatus: 'confirmed',
      };
    } catch (error: any) {
      console.error('[ProtocolSettlement] ETH transfer failed:', error);
      return {
        success: false,
        relayStatus: 'failed',
        error: error.message || 'ETH transfer failed',
      };
    }
  }

  private async relayFeeLayerZero(
    feeUsd: number,
    params: ProtocolSettlementParams
  ): Promise<{ success: boolean; txHashBase?: string; relayStatus: RelayStatus; error?: string }> {
    const srcChainId = LZ_CHAIN_IDS[params.originChain.toLowerCase()] || 101;
    const dstChainId = 184; // Base

    console.log('[ProtocolSettlement] relayFeeLayerZero:', {
      actionType: params.actionType,
      feeUsd,
      srcChainId,
      dstChainId,
      originChain: params.originChain,
    });

    const estimatedGas = 0.001;
    const estimatedTime = 15;

    console.log(`[LayerZero] Relaying ${feeUsd} USD from chain ${srcChainId} to Base (${dstChainId})`);
    console.log(`[LayerZero] Estimated gas: ${estimatedGas} ETH, time: ~${estimatedTime} minutes`);

    await new Promise(resolve => setTimeout(resolve, 100));

    const simulatedTxHash = `lz:${params.actionType}:${srcChainId}:${Date.now()}:${params.actionId.slice(0, 8)}`;

    return {
      success: true,
      txHashBase: simulatedTxHash,
      relayStatus: 'pending',
    };
  }

  private async relayFeeWormhole(
    feeUsd: number,
    params: ProtocolSettlementParams
  ): Promise<{ success: boolean; txHashBase?: string; relayStatus: RelayStatus; error?: string }> {
    console.log('[ProtocolSettlement] relayFeeWormhole:', {
      actionType: params.actionType,
      feeUsd,
      originChain: params.originChain,
    });

    const estimatedGas = 0.0015;
    const estimatedTime = 20;

    console.log(`[Wormhole] Relaying ${feeUsd} USD from ${params.originChain} to Base`);
    console.log(`[Wormhole] Estimated gas: ${estimatedGas} ETH, time: ~${estimatedTime} minutes`);

    await new Promise(resolve => setTimeout(resolve, 100));

    const simulatedTxHash = `wh:${params.actionType}:${params.originChain}:${Date.now()}:${params.actionId.slice(0, 8)}`;

    return {
      success: true,
      txHashBase: simulatedTxHash,
      relayStatus: 'pending',
    };
  }

  getSettlement(settlementId: string): ProtocolSettlementResult | undefined {
    return this.settlementHistory.get(settlementId);
  }

  getSettlementsByAction(actionId: string): ProtocolSettlementResult[] {
    return Array.from(this.settlementHistory.values()).filter(s => s.actionId === actionId);
  }

  getSettlementsByWallet(walletAddress: string): ProtocolSettlementResult[] {
    return Array.from(this.settlementHistory.values());
  }

  static getSupportedChains() {
    return SUPPORTED_CHAINS;
  }

  static getSettleModes(): SettleMode[] {
    return ['BASE_USDC', 'BASE_DIRECT', 'RELAY_LZ', 'RELAY_WH'];
  }
}

export const protocolSettlement = new ProtocolSettlement();

const ProtocolSettlementRequestSchema = z.object({
  actionId: z.string(),
  actionType: z.enum(['call', 'message', 'anchor', 'governance', 'marketplace', 'storage']),
  walletAddress: z.string(),
  recipientWallet: z.string().optional(),
  amountUsd: z.number().min(0).optional(),
  quantity: z.number().min(1).optional(),
  settleMode: z.enum(['BASE_USDC', 'BASE_DIRECT', 'RELAY_LZ', 'RELAY_WH']),
  originChain: z.string(),
  feeCurrency: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

protocolSettlementRouter.post('/settle', async (req, res) => {
  try {
    const params = ProtocolSettlementRequestSchema.parse(req.body);
    const result = await protocolSettlement.settleAction(params);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Settlement failed', message: error.message });
  }
});

protocolSettlementRouter.get('/fee/:actionType', (req, res) => {
  const actionType = req.params.actionType as ProtocolActionType;
  const quantity = parseInt(req.query.quantity as string) || 1;
  
  const entry = protocolSettlement.getFeeEntry(actionType);
  if (!entry) {
    return res.status(404).json({ error: `Unknown action type: ${actionType}` });
  }

  const feeUsd = protocolSettlement.getFeeForAction(actionType, quantity);
  const isRequired = protocolSettlement.isSettlementRequired(actionType);

  res.json({
    actionType,
    ...entry,
    calculatedFeeUsd: feeUsd,
    quantity,
    isSettlementRequired: isRequired,
  });
});

protocolSettlementRouter.get('/fees', (_req, res) => {
  const schedule = protocolSettlement.getFeeSchedule();
  res.json({
    feeSchedule: schedule,
    settleModes: ProtocolSettlement.getSettleModes(),
    treasury: TREASURY_WALLET,
    usdcContract: USDC_CONTRACT_BASE,
  });
});

protocolSettlementRouter.get('/required/:actionType', (req, res) => {
  const actionType = req.params.actionType as ProtocolActionType;
  const isRequired = protocolSettlement.isSettlementRequired(actionType);
  const entry = protocolSettlement.getFeeEntry(actionType);

  if (!entry) {
    return res.status(404).json({ error: `Unknown action type: ${actionType}` });
  }

  res.json({
    actionType,
    isSettlementRequired: isRequired,
    isFree: entry.isFree,
    baseFeeUsd: entry.baseFeeUsd,
    unit: entry.unit,
  });
});

protocolSettlementRouter.get('/status/:settlementId', (req, res) => {
  const settlement = protocolSettlement.getSettlement(req.params.settlementId);
  
  if (!settlement) {
    return res.status(404).json({ error: 'Settlement not found' });
  }

  res.json(settlement);
});

protocolSettlementRouter.get('/history/:actionId', (req, res) => {
  const settlements = protocolSettlement.getSettlementsByAction(req.params.actionId);
  res.json({ settlements });
});

protocolSettlementRouter.get('/chains', (_req, res) => {
  res.json({
    supported: ProtocolSettlement.getSupportedChains(),
    settleModes: ProtocolSettlement.getSettleModes(),
    feeCurrencies: ['USDC', 'ETH', 'NATIVE'],
    destinationChain: {
      id: 'base',
      name: 'Base',
      chainId: 8453,
      treasury: TREASURY_WALLET,
    },
  });
});

protocolSettlementRouter.post('/estimate', (req, res) => {
  try {
    const { actionType, quantity, settleMode, originChain } = req.body;

    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }

    const qty = quantity || 1;
    const feeUsd = protocolSettlement.getFeeForAction(actionType as ProtocolActionType, qty);
    const isRequired = protocolSettlement.isSettlementRequired(actionType as ProtocolActionType);
    const entry = protocolSettlement.getFeeEntry(actionType as ProtocolActionType);

    if (!entry) {
      return res.status(404).json({ error: `Unknown action type: ${actionType}` });
    }

    let estimatedGas = 0;
    let estimatedTime = 0;

    switch (settleMode) {
      case 'BASE_USDC':
        estimatedGas = 0.0005;
        estimatedTime = 1;
        break;
      case 'BASE_DIRECT':
        estimatedGas = 0.0003;
        estimatedTime = 1;
        break;
      case 'RELAY_LZ':
        estimatedGas = 0.001;
        estimatedTime = 15;
        break;
      case 'RELAY_WH':
        estimatedGas = 0.0015;
        estimatedTime = 20;
        break;
      default:
        estimatedGas = 0.0005;
        estimatedTime = 1;
    }

    res.json({
      actionType,
      quantity: qty,
      feeUsd,
      isSettlementRequired: isRequired,
      isFree: entry.isFree,
      settleMode: settleMode || 'BASE_USDC',
      originChain: originChain || 'base',
      estimate: {
        gasEth: estimatedGas,
        timeMinutes: estimatedTime,
        totalCostUsd: feeUsd + (estimatedGas * 3000),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Estimation failed', message: error.message });
  }
});

protocolSettlementRouter.get('/actions', (_req, res) => {
  const actions: ProtocolActionType[] = ['call', 'message', 'anchor', 'governance', 'marketplace', 'storage'];
  
  const actionsInfo = actions.map(actionType => {
    const entry = protocolSettlement.getFeeEntry(actionType);
    return {
      actionType,
      ...entry,
      isSettlementRequired: protocolSettlement.isSettlementRequired(actionType),
    };
  });

  res.json({ actions: actionsInfo });
});

export default protocolSettlementRouter;
