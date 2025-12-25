import type { MethodSelector, AllowlistEntry } from "./types";

const cache: Record<string, AllowlistEntry> = {};
let allowlistVersion = "";

// Default allowlist for dev
const DEFAULT_ALLOWLIST: AllowlistEntry[] = [
  { selector: "0xa9059cbb", name: "transfer", description: "ERC20 transfer" },
  { selector: "0x23b872dd", name: "transferFrom", description: "ERC20 transferFrom" },
  { selector: "0x095ea7b3", name: "approve", description: "ERC20 approve" },
  { selector: "0x70a08231", name: "balanceOf", description: "ERC20 balanceOf" },
  { selector: "0x313ce567", name: "decimals", description: "ERC20 decimals" },
  { selector: "0x18160ddd", name: "totalSupply", description: "ERC20 totalSupply" },
  { selector: "0x9b2cb5d8", name: "anchor", description: "P3 anchor proof" },
  { selector: "0x3ccfd60b", name: "withdraw", description: "Withdraw funds" }
];

// Load signed allowlist
export function loadSignedAllowlist(signed: { 
  version: string; 
  entries: AllowlistEntry[]; 
  signature: string 
}): void {
  // In production: verify signature with signed.signature
  allowlistVersion = signed.version;
  for (const e of signed.entries) {
    cache[e.name] = e;
  }
}

// Initialize with defaults
export function initDefaultAllowlist(): void {
  for (const e of DEFAULT_ALLOWLIST) {
    cache[e.name] = e;
  }
  allowlistVersion = "dev-1.0.0";
}

// Get selector for method
export function getSelector(method: string): MethodSelector {
  const e = cache[method];
  if (!e) {
    throw new Error(`Method not allowlisted: ${method}`);
  }
  return e.selector;
}

// Check if method is allowed
export function isMethodAllowed(method: string): boolean {
  return method in cache;
}

// Get allowlist version
export function getAllowlistVersion(): string {
  return allowlistVersion || "unloaded";
}

// Get all entries
export function getAllowlistEntries(): AllowlistEntry[] {
  return Object.values(cache);
}
