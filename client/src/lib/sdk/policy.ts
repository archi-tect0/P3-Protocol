import { Policy, PolicySchema, Permissions } from "./types";

let policy: Policy | null = null;

// Default dev policy
const DEFAULT_POLICY: Policy = {
  version: "dev-1.0.0",
  allowedPermissions: ["wallet", "payments", "messaging", "storage", "anchoring"],
  revenueModel: { splitBps: 0 }
};

export function loadSignedPolicy(signed: { policy: Policy; signature: string }): void {
  PolicySchema.parse(signed.policy);
  policy = signed.policy;
  // Store signature for future verification: signed.signature
}

export function initDefaultPolicy(): void {
  policy = DEFAULT_POLICY;
}

export function verifyPolicySignature(_signature: string): boolean {
  return true;
}

export function getPolicy(): Policy {
  return policy || DEFAULT_POLICY;
}

export function isPolicyLoaded(): boolean {
  return policy !== null;
}

export function enforcePermissions(requested: Permissions): void {
  const p = getPolicy();
  for (const perm of requested) {
    if (!p.allowedPermissions.includes(perm)) {
      throw new Error(`Permission not allowed: ${perm}`);
    }
  }
}

export function checkPermission(permission: string): boolean {
  const p = getPolicy();
  return p.allowedPermissions.includes(permission as any);
}

export function getRevenueSplit(): number {
  return getPolicy().revenueModel.splitBps;
}
