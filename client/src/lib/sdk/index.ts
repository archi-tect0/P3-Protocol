// P3 SDK - Privacy-Preserving Protocol
// Apache 2.0 Licensed Open-Core SDK

import { getAnchors, fetchAnchorsFromServer, isAnchorsLoaded, anchor, flush as flushAnchors } from "./anchors";
import { p3Fetch } from "./fetch";
import { attest, type AttestationResult } from "./attest";
import { initDefaultAllowlist } from "./allowlist";
import { pay, payNative, parseEther, formatEther, type PaymentResult, type PaymentMeta } from "./payments";
import { msgEncrypted, type EncryptedMessage } from "./messaging";
import { publish, verify, hashData, type ProofResult, type ProofPayload } from "./proofs";
import { type SDKConfig, type AnchorsDigest, type Policy, type SessionTicket } from "./types";
import { createDevTicket, getTicket, isTicketValid, signTicket } from "./bridge";
import { emit, flush, track } from "./telemetry";
import { prepareManifest, createManifest, submitManifest } from "./manifest";
import { getBadgeState } from "./badges";
import { Apps } from "./apps";
import { Reviews } from "./reviews";
import { Menu, registerDefaultMenuActions } from "./menu";
import { Roles } from "./roles";
import { modFetch } from "./modFetch";

// SDK Version
export const VERSION = "2.0.0";

// SDK v2 Server-Locked Modules
export { configureSDK, isSDKConfigured, SDK_VERSION } from './modules/core';
export * as v2 from './modules';
export { sdkReq } from './modules/core';

// Re-export v2 modules for namespaced access
import * as anchorV2 from './modules/anchor';
import * as anchorBatchV2 from './modules/anchorBatch';
import * as cryptoV2 from './modules/crypto';
import * as sessionV2 from './modules/session';
import * as daoV2 from './modules/dao';
import * as explorerV2 from './modules/explorer';
import * as auditV2 from './modules/audit';
import * as mediaV2 from './modules/media';
import * as identityV2 from './modules/identity';
import * as zkV2 from './modules/zk';
import * as diagnosticsV2 from './modules/diagnostics';
import * as messagingV2 from './modules/messaging';
import * as callsV2 from './modules/calls';
import * as notesV2 from './modules/notes';
import * as inboxV2 from './modules/inbox';
import * as directoryV2 from './modules/directory';
import * as receiptsV2 from './modules/receipts';

type SDKModules = {
  anchor: typeof anchorV2;
  anchorBatch: typeof anchorBatchV2;
  crypto: typeof cryptoV2;
  session: typeof sessionV2;
  dao: typeof daoV2;
  explorer: typeof explorerV2;
  audit: typeof auditV2;
  media: typeof mediaV2;
  identity: typeof identityV2;
  zk: typeof zkV2;
  diagnostics: typeof diagnosticsV2;
  messaging: typeof messagingV2;
  calls: typeof callsV2;
  notes: typeof notesV2;
  inbox: typeof inboxV2;
  directory: typeof directoryV2;
  receipts: typeof receiptsV2;
};

const _SDK: Partial<SDKModules> = {};

function attachModule<K extends keyof SDKModules>(key: K, mod: SDKModules[K]) {
  if (!(key in _SDK)) {
    _SDK[key] = mod;
  }
}

attachModule('anchor', anchorV2);
attachModule('anchorBatch', anchorBatchV2);
attachModule('crypto', cryptoV2);
attachModule('session', sessionV2);
attachModule('dao', daoV2);
attachModule('explorer', explorerV2);
attachModule('audit', auditV2);
attachModule('media', mediaV2);
attachModule('identity', identityV2);
attachModule('zk', zkV2);
attachModule('diagnostics', diagnosticsV2);
attachModule('messaging', messagingV2);
attachModule('calls', callsV2);
attachModule('notes', notesV2);
attachModule('inbox', inboxV2);
attachModule('directory', directoryV2);
attachModule('receipts', receiptsV2);

export const SDK = _SDK as SDKModules;

// Initialize SDK
let initialized = false;

export async function init(_config?: Partial<SDKConfig>): Promise<void> {
  if (initialized) return;
  
  // Load default allowlist
  initDefaultAllowlist();
  
  // Try to fetch anchors from server
  await fetchAnchorsFromServer();
  
  // Register default developer menu actions
  registerDefaultMenuActions();
  
  initialized = true;
  console.log(`[P3 SDK] Initialized v${VERSION}`);
}

// P3 Namespace - Developer-facing API
export const P3 = {
  // Version
  version: VERSION,
  
  // Initialize
  init,
  
  // Wallet session
  wallet: async () => {
    if (!initialized) await init();
    
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return { connected: false, address: null, chainId: null };
    }
    
    try {
      const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      
      return {
        connected: accounts.length > 0,
        address: accounts[0] || null,
        chainId: parseInt(chainId, 16)
      };
    } catch {
      return { connected: false, address: null, chainId: null };
    }
  },
  
  // Payments
  payNative: async (recipient: string, amountEth: string, memo?: string): Promise<PaymentResult> => {
    if (!initialized) await init();
    const amountWei = parseEther(amountEth);
    return payNative(recipient, amountWei, memo ? { memo } : undefined);
  },
  
  payTreasury: async (amountEth: string, meta?: PaymentMeta): Promise<PaymentResult> => {
    if (!initialized) await init();
    const amountWei = parseEther(amountEth);
    return pay(amountWei, meta);
  },
  
  // Messaging
  msgEncrypted: async (recipientPubkey: string, message: string, anchor = true): Promise<EncryptedMessage> => {
    if (!initialized) await init();
    return msgEncrypted(recipientPubkey, message, { anchor });
  },
  
  // Proofs
  proofs: {
    publish: async (type: string, data: any): Promise<ProofResult> => {
      if (!initialized) await init();
      const hash = hashData(data);
      return publish({ type: type as any, hash, metadata: data });
    },
    
    verify: async (cid: string) => {
      if (!initialized) await init();
      return verify(cid);
    },
    
    hash: hashData
  },
  
  // Attestation
  attest: async (): Promise<AttestationResult> => {
    if (!initialized) await init();
    return attest();
  },
  
  // Anchors
  anchors: {
    get: getAnchors,
    isLoaded: isAnchorsLoaded,
    fetch: fetchAnchorsFromServer,
    anchor,
    flush: flushAnchors
  },
  
  // Cached fetch helper
  fetch: p3Fetch,
  
  // Utils
  utils: {
    parseEther,
    formatEther
  },
  
  // Bridge
  bridge: {
    createTicket: createDevTicket,
    getTicket,
    isValid: isTicketValid,
    sign: signTicket
  },
  
  // Telemetry
  telemetry: {
    emit,
    track,
    flush
  },
  
  // Manifest
  manifest: {
    create: createManifest,
    prepare: prepareManifest,
    submit: submitManifest
  },
  
  // Badges
  badges: {
    getState: getBadgeState
  },
  
  // Apps (install, favorites, manifests)
  Apps,
  
  // Reviews
  Reviews,
  
  // Menu (developer-extensible actions)
  Menu,
  
  // Roles (moderator management)
  Roles,
  
  // Mod fetch helper
  modFetch,
  
  // Session helper (legacy)
  session: {
    address: async (): Promise<string> => {
      const wallet = await P3.wallet();
      return wallet.address?.toLowerCase() || '';
    },
    connected: async (): Promise<boolean> => {
      const wallet = await P3.wallet();
      return wallet.connected;
    }
  },
  
  /**
   * P3 SSO - Wallet-Based Single Sign-On
   * 
   * Third-party apps can integrate P3 authentication:
   * 
   * ```typescript
   * // Check if user is already authenticated
   * const session = await P3.SSO.get();
   * if (session.authenticated) {
   *   console.log(`Welcome ${session.wallet}`);
   * }
   * 
   * // For new authentication:
   * // 1. Request challenge
   * const challenge = await P3.SSO.challenge(walletAddress);
   * // 2. User signs with wallet
   * const signature = await wallet.signMessage(challenge.message);
   * // 3. Verify and get token
   * const result = await P3.SSO.verify({ wallet, nonce, signature });
   * // result.token can be used for authenticated API calls
   * ```
   */
  SSO: {
    // Get current session (client-side)
    get: sessionV2.get,
    getLocal: sessionV2.getLocal,
    isConnected: sessionV2.isConnected,
    address: sessionV2.address,
    
    // Server-verified operations
    resume: sessionV2.resume,
    refresh: sessionV2.refresh,
    revoke: sessionV2.revoke,
    info: sessionV2.info,
    
    // Third-party SSO integration
    challenge: sessionV2.challenge,
    verify: sessionV2.verify,
    validate: sessionV2.validate,
    token: sessionV2.token,
  },
  
  // Ticket system for access gating
  ticket: {
    check: async (address: string, _scopes: string[]): Promise<{ hasAccess: boolean; ticket?: SessionTicket }> => {
      try {
        const existing = getTicket();
        if (existing && isTicketValid()) {
          return { hasAccess: true, ticket: existing };
        }
        // Check local storage fallback
        const localKey = `sdk_ticket_${address.toLowerCase()}`;
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.expiresAt > Date.now()) {
            return { hasAccess: true, ticket: parsed };
          }
        }
        return { hasAccess: false };
      } catch {
        return { hasAccess: false };
      }
    },
    buildGateUrl: (opts: { appId: string; scopes: string[]; returnTo: string; reason?: string }): string => {
      const params = new URLSearchParams({
        app: opts.appId,
        scopes: opts.scopes.join(','),
        returnTo: opts.returnTo,
        ...(opts.reason ? { reason: opts.reason } : {})
      });
      return `/launcher/ticket?${params.toString()}`;
    }
  }
};

// Re-export types
export type { 
  SDKConfig, 
  AnchorsDigest, 
  Policy, 
  SessionTicket, 
  PaymentResult, 
  PaymentMeta,
  EncryptedMessage,
  ProofResult,
  ProofPayload,
  AttestationResult
};

// SSO types
export type {
  SSOSession,
  SSOValidation,
  SSOToken,
  SSOChallenge,
  SessionInfo,
} from './modules/session';

// Additional exports
export { createDevTicket, getTicket, clearTicket, isTicketValid, signTicket, EIP712_DOMAIN } from "./bridge";
export { loadSignedPolicy, initDefaultPolicy, getPolicy, enforcePermissions, checkPermission } from "./policy";
export { emit, flush, startAutoFlush, stopAutoFlush, track } from "./telemetry";
export { validateManifest, prepareManifest, createManifest, submitManifest, type PreparedManifest } from "./manifest";
export { setRecoveryHandler, triggerRecovery, attemptAutoRecovery, type RecoveryReason, type CanonicalState } from "./recovery";
export { getBadgeState, getBadgeColor, getBadgeIcon, type BadgeInfo } from "./badges";
export { Apps, type AppManifest, appManifests } from "./apps";
export { Reviews, type Review, type ReviewStats } from "./reviews";
export { Menu, registerDefaultMenuActions, type MenuAction } from "./menu";
export { Roles, type RoleType, type WhoamiResponse, type RoleEntry, type AssignRoleResponse, type RevokeRoleResponse } from "./roles";
export { modFetch } from "./modFetch";
export { getManifest, getAllManifests, getManifestsByCategory } from "./manifests";
export { p3Fetch } from "./fetch";
export { anchor, flush as flushAnchors } from "./anchors";
export * from "./utils";
export { useP3 } from "./useP3";

// Programmable Launcher API
export { 
  loadRegistry, 
  clearRegistryCache, 
  getLocalRegistry,
  filterEndpoints,
  getEndpointsByApp,
  getRoutesByApp,
} from './registry';
export type { Registry, EndpointMeta, RouteMeta, AppMeta } from './registry';

export {
  Launcher,
  initLauncher,
  getLauncher,
} from './launcher';
export type { CallArgs, CallResult, LauncherOptions } from './launcher';

export {
  ensureScopes,
  hasScope,
  hasAllScopes,
  getMissingScopes,
  grantScopes,
  revokeScopes,
  createSession,
  persistSession,
  loadPersistedSession,
  clearPersistedSession,
  PermissionError,
  AVAILABLE_SCOPES,
} from './permissions';
export type { Session as LauncherSession, Scope } from './permissions';

// Default export
export default P3;
