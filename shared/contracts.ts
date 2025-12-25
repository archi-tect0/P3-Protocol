import contractsConfig from '../config/contracts.json';

export type NetworkName = 'mainnet' | 'sepolia';

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
  anchoringFee: string;
  treasuryWallet: string;
  contracts: {
    anchorRegistry: string;
    consentRegistry: string;
    receiptBoundToken: string;
    governanceToken: string;
    governor: string;
    treasury: string;
    trustPolicyRouter: string;
    zkReceiptsVerifier: string;
  };
}

export const networks: Record<NetworkName, NetworkConfig> = contractsConfig as any;

export function getNetwork(name: NetworkName = 'mainnet'): NetworkConfig {
  const networkName = process.env.NETWORK || name;
  return networks[networkName as NetworkName] || networks.mainnet;
}

export function getContractAddress(
  contract: keyof NetworkConfig['contracts'],
  network: NetworkName = 'mainnet'
): string {
  return getNetwork(network).contracts[contract];
}

export const DEFAULT_NETWORK: NetworkName = (process.env.NETWORK as NetworkName) || 'mainnet';

export function getAnchoringFee(network: NetworkName = 'mainnet'): string {
  return getNetwork(network).anchoringFee;
}

export function getTreasuryWallet(network: NetworkName = 'mainnet'): string {
  return getNetwork(network).treasuryWallet;
}

export default {
  networks,
  getNetwork,
  getContractAddress,
  getAnchoringFee,
  getTreasuryWallet,
  DEFAULT_NETWORK,
};
