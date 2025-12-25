import { SettlementAdapter } from "../index";
import { ethers } from "ethers";

export class EthereumSettlement implements SettlementAdapter {
  chain = "Ethereum";
  private provider: ethers.Provider;
  private signer: ethers.Signer | null = null;

  constructor(rpcUrl?: string, privateKey?: string) {
    this.provider = rpcUrl 
      ? new ethers.JsonRpcProvider(rpcUrl)
      : ethers.getDefaultProvider("mainnet");
    
    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }
  }

  async submitBatch(daHandle: string, merkleRoot: string): Promise<string> {
    if (!this.signer) {
      return `eth:simulated:${Date.now()}`;
    }

    const tx = await this.signer.sendTransaction({
      to: "0x0000000000000000000000000000000000000000",
      data: ethers.concat([
        ethers.toUtf8Bytes(daHandle),
        ethers.getBytes(merkleRoot)
      ]),
      value: 0
    });

    return tx.hash;
  }

  async finalize(txHash: string): Promise<boolean> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt !== null && receipt.status === 1;
    } catch {
      return false;
    }
  }
}

export const EthereumAdapter: SettlementAdapter = new EthereumSettlement();
