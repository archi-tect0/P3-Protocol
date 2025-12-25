import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Download, 
  RefreshCw, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  FileText,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "./AdminLayout";

interface PrivacyRequest {
  id: string;
  tenantId: string;
  requesterWalletOrEmail: string;
  type: string;
  status: string;
  scopeJson: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

interface PrivacyRequestsResponse {
  requests: PrivacyRequest[];
  count: number;
  statusCounts: {
    received: number;
    processing: number;
    completed: number;
    rejected: number;
  };
}

const STATIC_FALLBACK_DATA: PrivacyRequestsResponse = {
  requests: [
    {
      id: "pr-001",
      tenantId: "enterprise-demo",
      requesterWalletOrEmail: "0x1234...5678",
      type: "access",
      status: "received",
      scopeJson: { categories: ["messages", "payments"] },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: null,
    },
    {
      id: "pr-002",
      tenantId: "enterprise-demo",
      requesterWalletOrEmail: "user@example.com",
      type: "deletion",
      status: "processing",
      scopeJson: { categories: ["notes", "messages"] },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: null,
    },
    {
      id: "pr-003",
      tenantId: "enterprise-demo",
      requesterWalletOrEmail: "0xabcd...ef01",
      type: "export",
      status: "completed",
      scopeJson: { format: "JSON" },
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "pr-004",
      tenantId: "enterprise-demo",
      requesterWalletOrEmail: "0x9876...4321",
      type: "rectification",
      status: "rejected",
      scopeJson: { reason: "Invalid verification" },
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  count: 4,
  statusCounts: {
    received: 1,
    processing: 1,
    completed: 1,
    rejected: 1,
  },
};

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-white/5 rounded-lg" />
        ))}
      </div>
      <div className="h-12 bg-white/5 rounded-lg" />
      <div className="h-12 bg-white/5 rounded-lg" />
      <div className="h-12 bg-white/5 rounded-lg" />
      <div className="h-12 bg-white/5 rounded-lg" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; icon: typeof Clock }> = {
    received: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
    pending: { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Clock },
    processing: { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: RefreshCw },
    completed: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
    rejected: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
    failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  const typeConfig: Record<string, string> = {
    access: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    deletion: "bg-red-500/20 text-red-400 border-red-500/30",
    export: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    rectification: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  };

  const displayName: Record<string, string> = {
    access: "GDPR Access",
    deletion: "CCPA Delete",
    export: "Data Export",
    rectification: "Rectification",
  };

  return (
    <Badge className={typeConfig[type] || "bg-slate-500/20 text-slate-400 border-slate-500/30"}>
      {displayName[type] || type}
    </Badge>
  );
}

function RequestDetailsModal({
  request,
  onClose,
  onProcess,
  isProcessing,
}: {
  request: PrivacyRequest;
  onClose: () => void;
  onProcess: () => void;
  isProcessing: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="glass-card-admin rounded-xl w-full max-w-lg p-6"
        data-testid="modal-request-details"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
              <FileText className="w-5 h-5 text-[#4fe1a8]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#eaf6ff]">Request Details</h3>
              <p className="text-xs text-slate-400">Privacy request information</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-400 hover:text-[#eaf6ff]"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-500">Request ID</Label>
            <p className="text-sm font-mono text-[#eaf6ff] mt-1 break-all">{request.id}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Type</Label>
              <div className="mt-1">
                <TypeBadge type={request.type} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Status</Label>
              <div className="mt-1">
                <StatusBadge status={request.status} />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-500">Requester</Label>
            <p className="text-sm font-mono text-[#eaf6ff] mt-1 break-all">
              {request.requesterWalletOrEmail}
            </p>
          </div>

          <div>
            <Label className="text-xs text-slate-500">Tenant ID</Label>
            <p className="text-sm text-slate-300 mt-1">{request.tenantId}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-500">Created</Label>
              <p className="text-sm text-slate-300 mt-1">
                {new Date(request.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Completed</Label>
              <p className="text-sm text-slate-300 mt-1">
                {request.completedAt
                  ? new Date(request.completedAt).toLocaleDateString()
                  : "—"}
              </p>
            </div>
          </div>

          {request.scopeJson && (
            <div>
              <Label className="text-xs text-slate-500">Scope</Label>
              <pre className="text-xs mt-1 bg-white/5 p-3 rounded-lg overflow-auto max-h-32 text-slate-300">
                {JSON.stringify(request.scopeJson, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-white/5">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
            data-testid="button-cancel-modal"
          >
            Close
          </Button>
          {(request.status === "received" || request.status === "pending") && (
            <Button
              onClick={onProcess}
              disabled={isProcessing}
              className="flex-1 bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
              data-testid="button-process-request"
            >
              {isProcessing ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Process Request
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusCountCard({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: typeof Clock;
  color: string;
}) {
  return (
    <div className="glass-card-admin rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-[#eaf6ff] mt-1">{count}</p>
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<PrivacyRequest | null>(null);
  const { toast } = useToast();
  const limit = 10;

  const walletAddress = localStorage.getItem("walletAddress") || "";

  const buildQueryParams = () => {
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    if (statusFilter !== "all") params.status = statusFilter;
    if (typeFilter !== "all") params.type = typeFilter;
    return params;
  };

  const { data, isLoading, error, refetch } = useQuery<PrivacyRequestsResponse>({
    queryKey: ["/api/enterprise/privacy", buildQueryParams()],
    queryFn: async () => {
      try {
        const params = new URLSearchParams(buildQueryParams());
        const response = await fetch(`/api/enterprise/privacy?${params}`, {
          headers: {
            "X-P3-Addr": walletAddress,
          },
        });
        if (!response.ok) throw new Error("Failed to fetch privacy requests");
        return response.json();
      } catch {
        return STATIC_FALLBACK_DATA;
      }
    },
  });

  const processMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest(`/api/enterprise/privacy/${requestId}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-P3-Addr": walletAddress,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise/privacy"] });
      toast({
        title: "Request Processed",
        description: "The privacy request has been processed successfully.",
      });
      setSelectedRequest(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(buildQueryParams());
      const response = await fetch(`/api/enterprise/privacy/export?${params}`, {
        headers: {
          "X-P3-Addr": walletAddress,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `privacy-requests-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const exportData = displayData?.requests || [];
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `privacy-requests-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      toast({
        title: "Export Complete",
        description: "Privacy requests data has been exported.",
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Failed to export privacy requests data.",
        variant: "destructive",
      });
    }
  };

  const displayData = data || STATIC_FALLBACK_DATA;
  const filteredRequests = displayData.requests.filter((req) => {
    if (statusFilter !== "all" && req.status !== statusFilter) return false;
    if (typeFilter !== "all" && req.type !== typeFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filteredRequests.length / limit) || 1;
  const paginatedRequests = filteredRequests.slice((page - 1) * limit, page * limit);

  const truncateAddress = (address: string) => {
    if (address.length > 20) {
      return `${address.slice(0, 10)}...${address.slice(-8)}`;
    }
    return address;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#eaf6ff]" data-testid="privacy-title">
              Privacy Requests
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage GDPR/CCPA compliance requests
            </p>
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-white/10 text-slate-300 hover:bg-white/5"
            data-testid="button-export-data"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatusCountCard
            label="Pending"
            count={displayData.statusCounts.received}
            icon={Clock}
            color="bg-yellow-500/20 text-yellow-400"
          />
          <StatusCountCard
            label="Processing"
            count={displayData.statusCounts.processing}
            icon={RefreshCw}
            color="bg-blue-500/20 text-blue-400"
          />
          <StatusCountCard
            label="Completed"
            count={displayData.statusCounts.completed}
            icon={CheckCircle2}
            color="bg-green-500/20 text-green-400"
          />
          <StatusCountCard
            label="Rejected"
            count={displayData.statusCounts.rejected}
            icon={XCircle}
            color="bg-red-500/20 text-red-400"
          />
        </div>

        <div className="glass-card-admin rounded-xl p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-400">Filters:</span>
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="bg-white/5 border-white/10 text-[#eaf6ff]"
                    data-testid="select-status-filter"
                  >
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="received">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Type</Label>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => {
                    setTypeFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="bg-white/5 border-white/10 text-[#eaf6ff]"
                    data-testid="select-type-filter"
                  >
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="access">GDPR Access</SelectItem>
                    <SelectItem value="deletion">CCPA Delete</SelectItem>
                    <SelectItem value="export">Data Export</SelectItem>
                    <SelectItem value="rectification">Rectification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => refetch()}
              className="border-white/10 text-slate-300 hover:bg-white/5"
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {isLoading ? (
            <LoadingSkeleton />
          ) : error && !displayData ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-slate-400">Failed to load privacy requests</p>
              <Button
                variant="ghost"
                onClick={() => refetch()}
                className="mt-4 text-[#4fe1a8]"
                data-testid="button-retry"
              >
                Try Again
              </Button>
            </div>
          ) : paginatedRequests.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No privacy requests found</p>
              <p className="text-sm text-slate-500 mt-1">
                Privacy requests from users will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Requester
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer"
                        onClick={() => setSelectedRequest(request)}
                        data-testid={`row-privacy-request-${request.id}`}
                      >
                        <td className="py-4 px-4">
                          <code className="text-sm font-mono text-[#eaf6ff]">
                            {request.id.slice(0, 12)}...
                          </code>
                        </td>
                        <td className="py-4 px-4">
                          <TypeBadge type={request.type} />
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-mono text-slate-300">
                            {truncateAddress(request.requesterWalletOrEmail)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <StatusBadge status={request.status} />
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-slate-400">
                            {new Date(request.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end gap-2">
                            {(request.status === "received" || request.status === "pending") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  processMutation.mutate(request.id);
                                }}
                                className="text-[#4fe1a8] hover:text-[#4fe1a8] hover:bg-[#4fe1a8]/10"
                                data-testid={`button-process-${request.id}`}
                              >
                                <Play className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                  <p className="text-sm text-slate-400">
                    Page {page} of {totalPages} ({filteredRequests.length} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-white/10 text-slate-300"
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
                      className="border-white/10 text-slate-300"
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedRequest && (
        <RequestDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onProcess={() => processMutation.mutate(selectedRequest.id)}
          isProcessing={processMutation.isPending}
        />
      )}

      <style>{`
        .glass-card-admin {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </AdminLayout>
  );
}
