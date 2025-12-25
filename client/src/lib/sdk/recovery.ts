import { getAnchors } from "./anchors";

export interface RecoveryReason {
  code: 'NETWORK_MISMATCH' | 'CODEHASH_MISMATCH' | 'TREASURY_MISMATCH' | 'EXPIRED' | 'SIGNATURE_INVALID';
  message: string;
  expected?: string;
  actual?: string;
}

export interface CanonicalState {
  contract: string;
  chainId: number;
  treasury: string;
  codehash: string;
}

let recoveryCallback: ((reason: RecoveryReason, canonical: CanonicalState) => void) | null = null;

export function setRecoveryHandler(handler: (reason: RecoveryReason, canonical: CanonicalState) => void): void {
  recoveryCallback = handler;
}

export function triggerRecovery(reason: RecoveryReason): void {
  const anchors = getAnchors();
  const canonical: CanonicalState = {
    contract: anchors.contract,
    chainId: anchors.chainId,
    treasury: anchors.treasury,
    codehash: anchors.codehash
  };
  
  if (recoveryCallback) {
    recoveryCallback(reason, canonical);
  } else {
    console.error('[P3 SDK] Recovery triggered but no handler set:', reason);
    showDefaultRecoveryUI(reason, canonical);
  }
}

function showDefaultRecoveryUI(reason: RecoveryReason, _canonical: CanonicalState): void {
  const message = `P3 Protocol Recovery Required\n\n${reason.message}\n\nExpected: ${reason.expected || 'N/A'}\nActual: ${reason.actual || 'N/A'}\n\nPlease reconnect to continue.`;
  if (typeof window !== 'undefined') {
    alert(message);
  }
}

export function createRecoveryReason(
  code: RecoveryReason['code'],
  expected?: string,
  actual?: string
): RecoveryReason {
  const messages: Record<RecoveryReason['code'], string> = {
    NETWORK_MISMATCH: 'Connected to wrong network',
    CODEHASH_MISMATCH: 'Contract code has changed',
    TREASURY_MISMATCH: 'Treasury address mismatch',
    EXPIRED: 'Session has expired',
    SIGNATURE_INVALID: 'Invalid signature'
  };
  
  return { code, message: messages[code], expected, actual };
}

export async function attemptAutoRecovery(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const anchors = getAnchors();
      const chainIdHex = '0x' + anchors.chainId.toString(16);
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
