import { PolicyConfig } from "./policy";

const enabled = process.env.ENABLE_PROGRAMMABLE_GOV !== "false";

export type Proposal = {
  id: string;
  actions: any[];
  createdBy: string;
  policyId: string;
  start: number;
  end: number;
  tally?: any;
};

export class PolicyRegistry {
  private policies = new Map<string, PolicyConfig>();
  
  register(cfg: PolicyConfig) { 
    if (!enabled) {
      console.log("Programmable governance disabled");
      return;
    }
    this.policies.set(cfg.id, cfg); 
  }
  
  get(id: string) { return this.policies.get(id); }
  
  list() { return Array.from(this.policies.values()); }
}

export function validateProposal(proposer: string, cfg: PolicyConfig): boolean {
  if (!enabled) return true;
  if (cfg.type === "multisig") return true;
  if (cfg.type === "timelock") return true;
  if (cfg.type === "roleweighted" && cfg.roles) {
    return cfg.roles.length > 0;
  }
  return true;
}

export function tallyVotes(votes: any[], cfg: PolicyConfig) {
  if (!enabled) return { passed: true, total: 1 };
  
  if (cfg.type === "quadratic") {
    const quadraticTotal = votes.reduce((sum, v) => sum + Math.sqrt(v.weight || 1), 0);
    return { passed: quadraticTotal >= (cfg.params?.threshold || 10), total: quadraticTotal };
  }
  
  const total = votes.reduce((sum, v) => sum + (v.weight || 1), 0);
  return { passed: total >= (cfg.params?.threshold || votes.length / 2), total };
}
