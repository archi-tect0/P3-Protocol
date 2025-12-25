import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';

interface ChainStatus {
  chain: string;
  txHash: string | null;
  confirmations: number;
  requiredConfirmations: number;
  status: 'pending' | 'relaying' | 'confirmed' | 'failed';
  lastError?: string;
  updatedAt: string;
}

interface CrossChainStatus {
  docHash: string;
  chains: ChainStatus[];
  overallStatus: 'pending' | 'partial' | 'complete' | 'failed';
}

interface UnifiedReceiptExplorerProps {
  receiptHash: string;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'confirmed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'relaying':
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function getStatusBadge(status: string) {
  const variants: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800 border-green-200',
    relaying: 'bg-blue-100 text-blue-800 border-blue-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <Badge variant="outline" className={variants[status] || variants.pending}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function getOverallStatusBadge(status: string) {
  const variants: Record<string, string> = {
    complete: 'bg-green-100 text-green-800 border-green-200',
    partial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <Badge variant="outline" className={variants[status] || variants.pending}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function getExplorerUrl(chain: string, txHash: string): string {
  const explorers: Record<string, string> = {
    polygon: `https://polygonscan.com/tx/${txHash}`,
    arbitrum: `https://arbiscan.io/tx/${txHash}`,
    optimism: `https://optimistic.etherscan.io/tx/${txHash}`,
  };
  return explorers[chain] || '#';
}

export function UnifiedReceiptExplorer({ receiptHash }: UnifiedReceiptExplorerProps) {
  const { data: receiptData, isLoading, error } = useQuery<{
    receipt: any;
    crossChainStatus: CrossChainStatus | null;
  }>({
    queryKey: ['/api/receipts', receiptHash],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.crossChainStatus) return false;
      const hasRelaying = data.crossChainStatus.chains.some(
        (c: { status: string }) => c.status === 'relaying' || c.status === 'pending'
      );
      return hasRelaying ? 10000 : false;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading receipt status...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !receiptData) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center text-red-600">
            <XCircle className="h-5 w-5 mr-2" />
            <span>Failed to load receipt status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { receipt, crossChainStatus } = receiptData;

  return (
    <div className="space-y-6" data-testid="unified-receipt-explorer">
      <Card>
        <CardHeader>
          <CardTitle>Receipt Details</CardTitle>
          <CardDescription>Document Hash: {receipt.contentHash}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-500">Type</div>
              <div className="mt-1">{receipt.type}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Subject ID</div>
              <div className="mt-1">{receipt.subjectId}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Immutable Sequence</div>
              <div className="mt-1">#{receipt.immutableSeq}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500">Created</div>
              <div className="mt-1">
                {new Date(receipt.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {crossChainStatus && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cross-Chain Status</CardTitle>
                <CardDescription>
                  Receipt relay status across multiple chains
                </CardDescription>
              </div>
              <div>{getOverallStatusBadge(crossChainStatus.overallStatus)}</div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confirmations</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crossChainStatus.chains.map((chainStatus) => (
                  <TableRow
                    key={chainStatus.chain}
                    data-testid={`chain-status-${chainStatus.chain}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(chainStatus.status)}
                        <span className="capitalize">{chainStatus.chain}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(chainStatus.status)}
                      {chainStatus.lastError && (
                        <div className="mt-1 text-xs text-red-600">
                          {chainStatus.lastError}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {chainStatus.txHash ? (
                        <div className="text-sm">
                          {chainStatus.confirmations} / {chainStatus.requiredConfirmations}
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                chainStatus.status === 'confirmed'
                                  ? 'bg-green-600'
                                  : 'bg-blue-600'
                              }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (chainStatus.confirmations /
                                    chainStatus.requiredConfirmations) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {chainStatus.txHash ? (
                        <a
                          href={getExplorerUrl(chainStatus.chain, chainStatus.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          data-testid={`tx-link-${chainStatus.chain}`}
                        >
                          <span className="font-mono text-xs">
                            {chainStatus.txHash.slice(0, 6)}...
                            {chainStatus.txHash.slice(-4)}
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(chainStatus.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!crossChainStatus && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No cross-chain relay jobs for this receipt</p>
            <p className="text-sm mt-2">
              This receipt has not been relayed to other chains yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
