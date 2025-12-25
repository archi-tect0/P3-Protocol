import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  Check, 
  AlertCircle,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "./AdminLayout";

interface ApiKey {
  id: string;
  walletOwner: string;
  tenantId: string;
  tierId: number | null;
  quotaMonthly: number;
  status: 'active' | 'revoked';
  createdAt: string;
  expiresAt: string | null;
}

interface ApiKeysResponse {
  keys: ApiKey[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateKeyResponse {
  ok: boolean;
  keyId: string;
  apiKey: string;
  tenantId: string;
  quotaMonthly: number;
  warning: string;
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-white/5 rounded-lg" />
      <div className="h-12 bg-white/5 rounded-lg" />
      <div className="h-12 bg-white/5 rounded-lg" />
    </div>
  );
}

function CreateKeyModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: (key: string) => void;
}) {
  const [tenantId, setTenantId] = useState('');
  const [quotaMonthly, setQuotaMonthly] = useState('100000');
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: { tenantId: string; quotaMonthly: number }) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      return await apiRequest('/api/enterprise/api-keys/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data: CreateKeyResponse) => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/api-keys/list'] });
      onSuccess(data.apiKey);
      setTenantId('');
      setQuotaMonthly('100000');
      toast({
        title: 'API Key Created',
        description: 'Your new API key has been generated. Make sure to copy it now!',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Tenant ID is required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ 
      tenantId: tenantId.trim(), 
      quotaMonthly: parseInt(quotaMonthly, 10) || 100000 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="glass-card-admin rounded-xl w-full max-w-md p-6"
        data-testid="modal-create-api-key"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
            <Key className="w-5 h-5 text-[#4fe1a8]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#eaf6ff]">Create API Key</h3>
            <p className="text-xs text-slate-400">Generate a new API key for your application</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tenant-id" className="text-sm text-slate-300">
              Tenant ID *
            </Label>
            <Input
              id="tenant-id"
              data-testid="input-tenant-id"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="e.g., my-app-production"
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="quota" className="text-sm text-slate-300">
              Monthly Quota
            </Label>
            <Input
              id="quota"
              data-testid="input-quota"
              type="number"
              value={quotaMonthly}
              onChange={(e) => setQuotaMonthly(e.target.value)}
              placeholder="100000"
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">Maximum API requests per month</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                'Create Key'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewKeyDisplay({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card-admin rounded-xl w-full max-w-lg p-6" data-testid="modal-new-key-display">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-green-500/20">
            <Check className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-[#eaf6ff]">API Key Created!</h3>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
            <p className="text-sm text-yellow-300">
              Make sure to copy your API key now. You won't be able to see it again!
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            <code className="flex-1 text-sm font-mono text-[#4fe1a8] break-all">
              {showKey ? apiKey : '•'.repeat(64)}
            </code>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowKey(!showKey)}
                className="text-slate-400 hover:text-[#eaf6ff]"
                data-testid="button-toggle-key-visibility"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                className="text-slate-400 hover:text-[#eaf6ff]"
                data-testid="button-copy-key"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        <Button
          onClick={onClose}
          className="w-full bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
          data-testid="button-close-new-key"
        >
          I've Copied My Key
        </Button>
      </div>
    </div>
  );
}

export default function ApiKeysPage() {
  const [page, setPage] = useState(1);
  const [searchTenant, setSearchTenant] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const { toast } = useToast();

  const walletAddress = localStorage.getItem('walletAddress') || '';

  const { data, isLoading, error, refetch } = useQuery<ApiKeysResponse>({
    queryKey: ['/api/enterprise/api-keys/list', { page, tenantId: searchTenant }],
    enabled: !!walletAddress,
  });

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      return await apiRequest('/api/enterprise/api-keys/revoke', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify({ keyId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/api-keys/list'] });
      toast({
        title: 'Key Revoked',
        description: 'The API key has been revoked successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRevoke = (keyId: string) => {
    if (confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      revokeMutation.mutate(keyId);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Key ID copied to clipboard',
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#eaf6ff]" data-testid="api-keys-title">
              API Keys
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage API keys for your enterprise applications
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
            data-testid="button-create-key"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create API Key
          </Button>
        </div>

        <div className="glass-card-admin rounded-xl p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by tenant ID..."
                value={searchTenant}
                onChange={(e) => {
                  setSearchTenant(e.target.value);
                  setPage(1);
                }}
                className="pl-10 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
                data-testid="input-search-tenant"
              />
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
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-slate-400">Failed to load API keys</p>
              <Button 
                variant="ghost" 
                onClick={() => refetch()} 
                className="mt-4 text-[#4fe1a8]"
              >
                Try Again
              </Button>
            </div>
          ) : data?.keys?.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No API keys found</p>
              <p className="text-sm text-slate-500 mt-1">Create your first API key to get started</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Key ID</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Tenant</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Quota</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                      <th className="text-right py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.keys?.map((key) => (
                      <tr 
                        key={key.id} 
                        className="border-b border-white/5 hover:bg-white/[0.02]"
                        data-testid={`row-api-key-${key.id}`}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-[#eaf6ff]">
                              {key.id.slice(0, 8)}...
                            </code>
                            <button
                              onClick={() => copyToClipboard(key.id)}
                              className="text-slate-500 hover:text-[#4fe1a8]"
                              data-testid={`button-copy-id-${key.id}`}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-slate-300">{key.tenantId}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-slate-300">
                            {key.quotaMonthly.toLocaleString()}/mo
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Badge 
                            className={key.status === 'active' 
                              ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                            }
                          >
                            {key.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-slate-400">
                            {new Date(key.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end gap-2">
                            {key.status === 'active' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRevoke(key.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                data-testid={`button-revoke-${key.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {data?.pagination && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                  <p className="text-sm text-slate-400">
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="border-white/10 text-slate-300"
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page >= data.pagination.totalPages}
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

      <CreateKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={(key) => {
          setShowCreateModal(false);
          setNewApiKey(key);
        }}
      />

      {newApiKey && (
        <NewKeyDisplay
          apiKey={newApiKey}
          onClose={() => setNewApiKey(null)}
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
