import { useState, useEffect, useCallback, useMemo } from 'react';
import { canvasBus, Receipt, BusEvent } from '@/lib/canvasBus';

export interface UseReceiptsOptions {
  artifactId?: string;
  limit?: number;
  includeErrors?: boolean;
  ops?: string[];
}

export function useReceipts(options: UseReceiptsOptions = {}) {
  const { artifactId, limit = 50, includeErrors = true, ops } = options;
  const [receipts, setReceipts] = useState<Receipt[]>(() => {
    if (artifactId) {
      return canvasBus.getByArtifact(artifactId, limit);
    }
    return canvasBus.getRecent(limit);
  });

  useEffect(() => {
    const handler = ({ receipt }: BusEvent) => {
      if (artifactId && receipt.artifactId !== artifactId) {
        return;
      }
      
      if (!includeErrors && receipt.error) {
        return;
      }
      
      if (ops && ops.length > 0 && !ops.includes(receipt.op)) {
        return;
      }

      setReceipts(prev => [receipt, ...prev].slice(0, limit));
    };

    return canvasBus.subscribe(handler);
  }, [artifactId, limit, includeErrors, ops]);

  const clearReceipts = useCallback(() => {
    setReceipts([]);
  }, []);

  const errorReceipts = useMemo(
    () => receipts.filter(r => r.error),
    [receipts]
  );

  const successReceipts = useMemo(
    () => receipts.filter(r => !r.error),
    [receipts]
  );

  const latestReceipt = receipts[0] || null;

  return {
    receipts,
    latestReceipt,
    errorReceipts,
    successReceipts,
    clearReceipts,
    count: receipts.length,
  };
}

export function useReceiptStream(artifactId?: string) {
  return useReceipts({ artifactId });
}

export type { Receipt } from '@/lib/canvasBus';
