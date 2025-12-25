import { keccak256 } from "@noble/hashes/sha3";

const enabled = process.env.ENABLE_MODULAR_DA !== "false";

export interface DAAdapter {
  name: string;
  publishBlob(data: Uint8Array): Promise<string>;
  verifyAvailability(handle: string): Promise<boolean>;
  costEstimate(bytes: number): Promise<number>;
}

export interface SettlementAdapter {
  chain: string;
  submitBatch(daHandle: string, merkleRoot: string): Promise<string>;
  finalize(txHash: string): Promise<boolean>;
}

export async function routeBatch(
  data: Uint8Array,
  daAdapters: DAAdapter[],
  settlement: SettlementAdapter
) {
  if (!enabled) {
    return { handle: "demo-handle", tx: "0xdemo", adapter: "none" };
  }

  const ranked = await Promise.all(
    daAdapters.map(async a => ({ a, cost: await a.costEstimate(data.length) }))
  );
  ranked.sort((x, y) => x.cost - y.cost);
  
  const chosen = ranked[0].a;
  const handle = await chosen.publishBlob(data);
  const root = "0x" + Buffer.from(keccak256(data)).toString("hex");
  const tx = await settlement.submitBatch(handle, root);
  
  return { handle, tx, adapter: chosen.name };
}

export function calculateMerkleRoot(blobs: Uint8Array[]): string {
  const leaves = blobs.map(b => keccak256(b));
  let layer = leaves;
  
  while (layer.length > 1) {
    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : left;
      nextLayer.push(keccak256(Buffer.concat([left, right])));
    }
    layer = nextLayer;
  }
  
  return "0x" + Buffer.from(layer[0]).toString("hex");
}
