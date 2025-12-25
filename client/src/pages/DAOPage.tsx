import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import NotionLayout from "@/components/NotionLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AnchorToggle from "@/components/AnchorToggle";
import AnchoredBadge from "@/components/AnchoredBadge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Search, 
  Filter,
  ArrowUpDown,
  Vote,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  PieChart,
  Download,
  Settings,
  Loader2,
  MessageSquare,
  Circle,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Proposal = {
  id: string;
  proposalId: string;
  title: string;
  description: string;
  proposer: string;
  status: string;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
  startBlock: string | null;
  endBlock: string | null;
  eta: string | null;
  txHash: string;
  createdAt: string;
  updatedAt: string;
};

const createProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  targetContract: z.string().min(1, "Target contract is required"),
  functionCalldata: z.string().min(1, "Function calldata is required"),
  value: z.string().min(1, "Value is required"),
});

type CreateProposalForm = z.infer<typeof createProposalSchema>;

const statusFilters = ["all", "active", "pending", "succeeded", "queued", "executed", "defeated"] as const;
type StatusFilter = typeof statusFilters[number];

export default function DAOPage() {
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "votes">("date");
  const [anchorEnabled, setAnchorEnabled] = useState(false);
  const { toast } = useToast();

  const { data: proposals = [], isLoading } = useQuery<Array<Proposal>>({
    queryKey: ['/api/dao/proposals'],
  });

  const selectedProposal = useMemo(() => {
    return proposals.find(p => p.id === selectedProposalId) || null;
  }, [proposals, selectedProposalId]);

  const filteredAndSortedProposals = useMemo(() => {
    let filtered = proposals;

    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        const aVotes = Number(a.votesFor) + Number(a.votesAgainst);
        const bVotes = Number(b.votesFor) + Number(b.votesAgainst);
        return bVotes - aVotes;
      }
    });
  }, [proposals, statusFilter, searchQuery, sortBy]);

  const createProposalMutation = useMutation({
    mutationFn: async (data: CreateProposalForm) => {
      return await apiRequest('/api/dao/proposals', {
        method: 'POST',
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          targets: [data.targetContract],
          values: [data.value],
          calldatas: [data.functionCalldata],
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dao/proposals'] });
      setShowCreateForm(false);
      toast({
        title: "Proposal Created",
        description: "Your governance proposal has been submitted on-chain.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Proposal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ proposalId, support }: { proposalId: string; support: 'for' | 'against' | 'abstain' }) => {
      return await apiRequest(`/api/dao/proposals/${proposalId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ support, votingPower: "1" }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dao/proposals'] });
      toast({
        title: "Vote Recorded",
        description: "Your vote has been recorded on-chain.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Vote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const queueMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return await apiRequest(`/api/dao/proposals/${proposalId}/queue`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dao/proposals'] });
      toast({
        title: "Proposal Queued",
        description: "The proposal has been queued for execution.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Queue",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      return await apiRequest(`/api/dao/proposals/${proposalId}/execute`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dao/proposals'] });
      toast({
        title: "Proposal Executed",
        description: "The proposal has been executed on-chain.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Execute",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive", icon: any, color: string }> = {
      active: { variant: "default", icon: Circle, color: "text-blue-600 dark:text-blue-400" },
      pending: { variant: "secondary", icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
      succeeded: { variant: "default", icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
      executed: { variant: "default", icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
      queued: { variant: "secondary", icon: Clock, color: "text-purple-600 dark:text-purple-400" },
      defeated: { variant: "destructive", icon: XCircle, color: "text-red-600 dark:text-red-400" },
      canceled: { variant: "destructive", icon: XCircle, color: "text-red-600 dark:text-red-400" },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const toolbar = (
    <div className="px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Vote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">DAO Governance</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-32 h-9" data-testid="filter-status">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map(status => (
              <SelectItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as "date" | "votes")}>
          <SelectTrigger className="w-32 h-9" data-testid="sort-by">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Recent</SelectItem>
            <SelectItem value="votes">Most Voted</SelectItem>
          </SelectContent>
        </Select>

        <AnchorToggle 
          checked={anchorEnabled} 
          onChange={setAnchorEnabled}
          label="Anchor"
          className="px-3"
        />

        <Button 
          onClick={() => {
            setShowCreateForm(true);
            setSelectedProposalId(null);
          }}
          className="h-9"
          data-testid="button-create-proposal"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Proposal
        </Button>
      </div>
    </div>
  );

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filteredAndSortedProposals.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {searchQuery ? "No proposals match your search" : "No proposals yet"}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredAndSortedProposals.map((proposal) => (
              <ProposalListItem
                key={proposal.id}
                proposal={proposal}
                isSelected={selectedProposalId === proposal.id}
                onClick={() => {
                  setSelectedProposalId(proposal.id);
                  setShowCreateForm(false);
                }}
                getStatusBadge={getStatusBadge}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const editor = showCreateForm ? (
    <CreateProposalForm
      onSubmit={(data) => createProposalMutation.mutate(data)}
      onCancel={() => setShowCreateForm(false)}
      isSubmitting={createProposalMutation.isPending}
    />
  ) : selectedProposal ? (
    <ProposalDetail
      proposal={selectedProposal}
      onVote={(support) => voteMutation.mutate({ proposalId: selectedProposal.proposalId, support })}
      onQueue={() => queueMutation.mutate(selectedProposal.proposalId)}
      onExecute={() => executeMutation.mutate(selectedProposal.proposalId)}
      isVoting={voteMutation.isPending}
      isQueuing={queueMutation.isPending}
      isExecuting={executeMutation.isPending}
      getStatusBadge={getStatusBadge}
    />
  ) : (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <Vote className="w-16 h-16 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
          Select a Proposal
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a proposal from the sidebar or create a new one
        </p>
      </div>
    </div>
  );

  const properties = selectedProposal ? (
    <ProposalProperties proposal={selectedProposal} anchorEnabled={anchorEnabled} />
  ) : null;

  return (
    <NotionLayout
      toolbar={toolbar}
      sidebar={sidebar}
      editor={editor}
      properties={properties}
    />
  );
}

function ProposalListItem({ 
  proposal, 
  isSelected, 
  onClick,
  getStatusBadge,
}: {
  proposal: Proposal;
  isSelected: boolean;
  onClick: () => void;
  getStatusBadge: (status: string) => React.ReactElement;
}) {
  const totalVotes = Number(proposal.votesFor) + Number(proposal.votesAgainst) + Number(proposal.votesAbstain);
  const timeLeft = proposal.endBlock ? getTimeLeft(proposal.endBlock) : null;

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50",
        isSelected && "bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-600"
      )}
      data-testid={`proposal-item-${proposal.id}`}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-sm text-slate-900 dark:text-white line-clamp-2">
            {proposal.title}
          </h3>
          {getStatusBadge(proposal.status)}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
          by {proposal.proposer.slice(0, 10)}...
        </p>

        {totalVotes > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              {Number(proposal.votesFor).toLocaleString()}
            </div>
            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <XCircle className="w-3 h-3" />
              {Number(proposal.votesAgainst).toLocaleString()}
            </div>
          </div>
        )}

        {timeLeft && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            {timeLeft}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateProposalForm({ 
  onSubmit, 
  onCancel, 
  isSubmitting 
}: {
  onSubmit: (data: CreateProposalForm) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const form = useForm<CreateProposalForm>({
    resolver: zodResolver(createProposalSchema),
    defaultValues: {
      title: "",
      description: "",
      targetContract: "",
      functionCalldata: "",
      value: "0",
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Create New Proposal
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Submit a new governance proposal for on-chain voting
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proposal Title</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g., Allocate 100 ETH for Marketing Budget"
                      data-testid="input-proposal-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Provide detailed information about your proposal..."
                      rows={8}
                      data-testid="input-proposal-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetContract"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Contract Address</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="0x..."
                      data-testid="input-target-contract"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="functionCalldata"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Function Calldata</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="0x..."
                      rows={3}
                      data-testid="input-function-calldata"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value (in wei)</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="0"
                      data-testid="input-value"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="flex-1"
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
                data-testid="button-submit-proposal"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Proposal
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

function ProposalDetail({ 
  proposal, 
  onVote, 
  onQueue, 
  onExecute,
  isVoting,
  isQueuing,
  isExecuting,
  getStatusBadge,
}: {
  proposal: Proposal;
  onVote: (support: 'for' | 'against' | 'abstain') => void;
  onQueue: () => void;
  onExecute: () => void;
  isVoting: boolean;
  isQueuing: boolean;
  isExecuting: boolean;
  getStatusBadge: (status: string) => React.ReactElement;
}) {
  const totalVotes = Number(proposal.votesFor) + Number(proposal.votesAgainst) + Number(proposal.votesAbstain);
  const forPercentage = totalVotes > 0 ? (Number(proposal.votesFor) / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (Number(proposal.votesAgainst) / totalVotes) * 100 : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        <div className="mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                {proposal.title}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span>Proposed by {proposal.proposer.slice(0, 10)}...</span>
                <span>•</span>
                <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {getStatusBadge(proposal.status)}
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {proposal.description}
            </p>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Voting Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">For</span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {Number(proposal.votesFor).toLocaleString()} ({forPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all" 
                  style={{ width: `${forPercentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Against</span>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {Number(proposal.votesAgainst).toLocaleString()} ({againstPercentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all" 
                  style={{ width: `${againstPercentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Abstain</span>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {Number(proposal.votesAbstain).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {(proposal.status === "active" || proposal.status === "pending") && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Cast Your Vote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => onVote('for')}
                  disabled={isVoting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-vote-for"
                >
                  {isVoting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Vote For
                </Button>
                <Button
                  onClick={() => onVote('against')}
                  disabled={isVoting}
                  variant="destructive"
                  data-testid="button-vote-against"
                >
                  {isVoting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Vote Against
                </Button>
                <Button
                  onClick={() => onVote('abstain')}
                  disabled={isVoting}
                  variant="outline"
                  data-testid="button-vote-abstain"
                >
                  {isVoting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Abstain
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {proposal.status === "succeeded" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Button
                onClick={onQueue}
                disabled={isQueuing}
                className="w-full"
                data-testid="button-queue-proposal"
              >
                {isQueuing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Queue for Execution
              </Button>
            </CardContent>
          </Card>
        )}

        {proposal.status === "queued" && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Button
                onClick={onExecute}
                disabled={isExecuting}
                className="w-full"
                data-testid="button-execute-proposal"
              >
                {isExecuting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Execute Proposal
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Discussion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              <p className="text-sm">Discussion coming soon</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProposalProperties({ proposal, anchorEnabled: _anchorEnabled }: { proposal: Proposal; anchorEnabled: boolean }) {
  const totalVotes = Number(proposal.votesFor) + Number(proposal.votesAgainst) + Number(proposal.votesAbstain);
  const forPercentage = totalVotes > 0 ? (Number(proposal.votesFor) / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (Number(proposal.votesAgainst) / totalVotes) * 100 : 0;
  const abstainPercentage = totalVotes > 0 ? (Number(proposal.votesAbstain) / totalVotes) * 100 : 0;

  const exportProof = () => {
    const proof = {
      proposalId: proposal.proposalId,
      title: proposal.title,
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
      votesAbstain: proposal.votesAbstain,
      status: proposal.status,
      txHash: proposal.txHash,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(proof, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proposal-${proposal.proposalId}-proof.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <PieChart className="w-4 h-4" />
          Voting Stats
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">For</span>
            <span className="font-medium text-green-600 dark:text-green-400">
              {forPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Against</span>
            <span className="font-medium text-red-600 dark:text-red-400">
              {againstPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 dark:text-slate-400">Abstain</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">
              {abstainPercentage.toFixed(1)}%
            </span>
          </div>
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Total Votes</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {totalVotes.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Voters
        </h3>
        <div className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
          Voter list coming soon
        </div>
      </div>

      {proposal.txHash && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <History className="w-4 h-4" />
            Blockchain
          </h3>
          <div className="space-y-2">
            <AnchoredBadge 
              txHash={proposal.txHash}
              size="sm"
              showLink={true}
            />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              <div className="mb-1">Created: {new Date(proposal.createdAt).toLocaleString()}</div>
              {proposal.updatedAt !== proposal.createdAt && (
                <div>Updated: {new Date(proposal.updatedAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Actions
        </h3>
        <Button
          onClick={exportProof}
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          data-testid="button-export-proof"
        >
          <Download className="w-3 h-3 mr-2" />
          Export Proof
        </Button>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          Proposal ID
        </h3>
        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all bg-slate-100 dark:bg-slate-800 p-2 rounded">
          {proposal.proposalId}
        </div>
      </div>
    </div>
  );
}

function getTimeLeft(endBlock: string): string {
  const blocksRemaining = Number(endBlock) - Date.now();
  if (blocksRemaining <= 0) return "Ended";
  
  const days = Math.floor(blocksRemaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor((blocksRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return "< 1h left";
}
