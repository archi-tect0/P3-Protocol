import { useState, useEffect, useCallback } from 'react';
import { P3, init } from './index';
import type { AttestationResult, PaymentResult, EncryptedMessage, ProofResult } from './index';

interface P3State {
  initialized: boolean;
  wallet: { connected: boolean; address: string | null; chainId: number | null };
  attestation: AttestationResult | null;
}

export function useP3() {
  const [state, setState] = useState<P3State>({
    initialized: false,
    wallet: { connected: false, address: null, chainId: null },
    attestation: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    init().then(() => {
      setState(s => ({ ...s, initialized: true }));
      refreshWallet();
    }).catch(e => setError(e.message));
  }, []);

  const refreshWallet = useCallback(async () => {
    const wallet = await P3.wallet();
    setState(s => ({ ...s, wallet }));
    return wallet;
  }, []);

  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        return refreshWallet();
      }
      throw new Error('No wallet found');
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [refreshWallet]);

  const attest = useCallback(async (): Promise<AttestationResult> => {
    setLoading(true);
    try {
      const result = await P3.attest();
      setState(s => ({ ...s, attestation: result }));
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const payNative = useCallback(async (recipient: string, amount: string, memo?: string): Promise<PaymentResult> => {
    setLoading(true);
    setError(null);
    try {
      return await P3.payNative(recipient, amount, memo);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const msgEncrypted = useCallback(async (pubkey: string, message: string): Promise<EncryptedMessage> => {
    setLoading(true);
    try {
      return await P3.msgEncrypted(pubkey, message);
    } finally {
      setLoading(false);
    }
  }, []);

  const publishProof = useCallback(async (type: string, data: any): Promise<ProofResult> => {
    setLoading(true);
    try {
      return await P3.proofs.publish(type, data);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    ...state,
    loading,
    error,
    connect,
    refreshWallet,
    attest,
    payNative,
    msgEncrypted,
    publishProof,
    P3
  };
}

export default useP3;
