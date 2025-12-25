import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Vote, CheckCircle2, XCircle, Circle, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import AdminLayout from "./AdminLayout";

const createProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  targetContract: z.string().min(1, "Target contract is required"),
  functionCalldata: z.string().min(1, "Function calldata is required"),
  value: z.string().min(1, "Value is required"),
});

type CreateProposalForm = z.infer<typeof createProposalSchema>;

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
};

export default function DAOPage() {
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  const { data: proposals = [], isLoading } = useQuery<Array<Proposal>>({
    queryKey: ['/api/dao/proposals'],
  });

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
      setShowCreateDialog(false);
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
      setSelectedProposal(null);
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
        title: "Failed to Queue Proposal",
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
        title: "Failed to Execute Proposal",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const governanceStats = {
    totalProposals: proposals.length,
    activeProposals: proposals.filter((p: Proposal) => p.status === 'active').length,
    passedProposals: proposals.filter((p: Proposal) => p.status === 'succeeded' || p.status === 'executed').length,
    totalVoters: 0,
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'succeeded':
      case 'executed':
        return 'default';
      case 'defeated':
      case 'canceled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Circle className="w-3 h-3 mr-1" />;
      case 'succeeded':
      case 'executed':
        return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case 'defeated':
      case 'canceled':
        return <XCircle className="w-3 h-3 mr-1" />;
      default:
        return null;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              DAO Governance
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Participate in decentralized decision-making
            </p>
          </div>
          <Button
            data-testid="button-create-proposal"
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Proposal
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-total-proposals">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Proposals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {governanceStats.totalProposals}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-active-proposals">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {governanceStats.activeProposals}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-passed-proposals">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Passed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {governanceStats.passedProposals}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-total-voters">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Voters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {governanceStats.totalVoters.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-proposals-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Proposals
            </CardTitle>
            <CardDescription>
              All governance proposals
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : proposals.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                No proposals yet. Create your first proposal to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Votes For</TableHead>
                    <TableHead>Votes Against</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proposals.map((proposal: Proposal) => (
                    <TableRow key={proposal.id} data-testid={`row-proposal-${proposal.id}`}>
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        {proposal.title}
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          By {proposal.proposer.slice(0, 10)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(proposal.status)}
                          data-testid={`badge-status-${proposal.id}`}
                        >
                          {getStatusIcon(proposal.status)}
                          {proposal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-green-600 dark:text-green-400" data-testid={`text-votes-for-${proposal.id}`}>
                        {Number(proposal.votesFor || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-red-600 dark:text-red-400" data-testid={`text-votes-against-${proposal.id}`}>
                        {Number(proposal.votesAgainst || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-view-${proposal.id}`}
                          onClick={() => setSelectedProposal(proposal)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <ProposalDialog
          proposal={selectedProposal}
          onClose={() => setSelectedProposal(null)}
          onVote={(support: 'for' | 'against' | 'abstain') => {
            if (selectedProposal) {
              voteMutation.mutate({
                proposalId: selectedProposal.proposalId,
                support,
              });
            }
          }}
          onQueue={() => {
            if (selectedProposal) {
              queueMutation.mutate(selectedProposal.proposalId);
            }
          }}
          onExecute={() => {
            if (selectedProposal) {
              executeMutation.mutate(selectedProposal.proposalId);
            }
          }}
          isVoting={voteMutation.isPending}
          isQueuing={queueMutation.isPending}
          isExecuting={executeMutation.isPending}
        />

        <CreateProposalDialog
          open={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
          onSubmit={(data) => createProposalMutation.mutate(data)}
          isSubmitting={createProposalMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}

function ProposalDialog({ 
  proposal, 
  onClose, 
  onVote, 
  onQueue, 
  onExecute,
  isVoting,
  isQueuing,
  isExecuting,
}: {
  proposal: Proposal | null;
  onClose: () => void;
  onVote: (support: 'for' | 'against' | 'abstain') => void;
  onQueue: () => void;
  onExecute: () => void;
  isVoting: boolean;
  isQueuing: boolean;
  isExecuting: boolean;
}) {
  if (!proposal) return null;

  const totalVotes = Number(proposal.votesFor || 0) + Number(proposal.votesAgainst || 0);
  const forPercentage = totalVotes > 0 ? (Number(proposal.votesFor || 0) / totalVotes) * 100 : 0;
  const againstPercentage = totalVotes > 0 ? (Number(proposal.votesAgainst || 0) / totalVotes) * 100 : 0;

  return (
    <Dialog open={!!proposal} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl" data-testid="dialog-proposal-details">
        <DialogHeader>
          <DialogTitle>{proposal.title}</DialogTitle>
          <DialogDescription>
            Proposed by {proposal.proposer}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Description</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {proposal.description}
            </p>
          </div>

          <div>
            <h4 className="font-medium text-slate-900 dark:text-white mb-2">Voting Status</h4>
            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600 dark:text-slate-400">For</span>
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {Number(proposal.votesFor || 0).toLocaleString()} ({forPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-600 dark:bg-green-400" 
                    style={{ width: `${forPercentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Against</span>
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {Number(proposal.votesAgainst || 0).toLocaleString()} ({againstPercentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-600 dark:bg-red-400" 
                    style={{ width: `${againstPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {proposal.status === "active" && (
            <div className="flex gap-2 pt-4">
              <Button
                data-testid="button-vote-for"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onVote('for')}
                disabled={isVoting}
              >
                {isVoting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Vote For
              </Button>
              <Button
                data-testid="button-vote-against"
                variant="destructive"
                className="flex-1"
                onClick={() => onVote('against')}
                disabled={isVoting}
              >
                {isVoting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Vote Against
              </Button>
            </div>
          )}

          {proposal.status === "succeeded" && (
            <div className="pt-4">
              <Button
                data-testid="button-queue-proposal"
                className="w-full"
                onClick={onQueue}
                disabled={isQueuing}
              >
                {isQueuing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Queue for Execution
              </Button>
            </div>
          )}

          {proposal.status === "queued" && (
            <div className="pt-4">
              <Button
                data-testid="button-execute-proposal"
                className="w-full"
                onClick={onExecute}
                disabled={isExecuting}
              >
                {isExecuting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Execute Proposal
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateProposalDialog({ open, onClose, onSubmit, isSubmitting }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProposalForm) => void;
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

  const handleSubmit = (data: CreateProposalForm) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-create-proposal">
        <DialogHeader>
          <DialogTitle>Create New Proposal</DialogTitle>
          <DialogDescription>
            Submit a new governance proposal for on-chain voting
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Proposal title"
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
                      placeholder="Detailed description of the proposal"
                      rows={4}
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
                  <FormLabel>Target Contract</FormLabel>
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

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
                data-testid="button-submit-proposal"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Proposal
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
