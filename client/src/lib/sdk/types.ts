import { z } from "zod";

// Anchors Digest Schema - signed by Anchors Authority
export const AnchorsDigestSchema = z.object({
  contract: z.string(),
  chainId: z.number(),
  treasury: z.string(),
  codehash: z.string(),
  validUntil: z.number()
});
export type AnchorsDigest = z.infer<typeof AnchorsDigestSchema>;

// Permissions Schema
export const PermissionsSchema = z.array(z.enum(["wallet", "payments", "messaging", "storage", "anchoring"]));
export type Permissions = z.infer<typeof PermissionsSchema>;

// Policy Schema
export const PolicySchema = z.object({
  version: z.string(),
  allowedPermissions: PermissionsSchema,
  revenueModel: z.object({ 
    splitBps: z.number().min(0).max(10000),
    treasuryAddress: z.string().optional()
  })
});
export type Policy = z.infer<typeof PolicySchema>;

// Method Selector
export type MethodSelector = `0x${string}`;

// Allowlist Entry
export interface AllowlistEntry {
  selector: MethodSelector;
  name: string;
  description?: string;
}

// Session Ticket
export interface SessionTicket {
  id: string;
  domain: { name: string; version: string; chainId: number; verifyingContract: string };
  anchorsDigestHash: string;
  issuedAt: number;
  expiresAt: number;
  clientSig?: string;
}

// Transaction Result
export interface TxResult {
  hash: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  timestamp?: number;
}

// Telemetry Event
export interface TelemetryEvent {
  type: string;
  data: Record<string, unknown>;
  anchorsHash: string;
  ticketId?: string;
  timestamp: number;
}

// Manifest Schema
export const ManifestSchema = z.object({
  name: z.string(),
  short_name: z.string().optional(),
  description: z.string(),
  version: z.string(),
  protocol: z.object({
    bridge: z.boolean(),
    permissions: PermissionsSchema,
    anchorsRequired: z.boolean().optional()
  }),
  governance: z.object({
    dao: z.boolean(),
    compliance: z.enum(["standard", "enterprise", "regulated"]).optional()
  }).optional()
});
export type P3Manifest = z.infer<typeof ManifestSchema>;

// Badge states
export type BadgeState = 'verified' | 'sandboxed' | 'pending' | 'rejected';

// SDK Configuration
export interface SDKConfig {
  chainId: number;
  contract: string;
  treasury: string;
  rpcUrl?: string;
  isDev?: boolean;
}

// Default Base mainnet config
export const DEFAULT_CONFIG: SDKConfig = {
  chainId: 8453,
  contract: "0x2539823790424051Eb03eBea1EA9bc40A475A34D",
  treasury: "0x2539823790424051Eb03eBea1EA9bc40A475A34D"
};
