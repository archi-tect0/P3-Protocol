import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Vote, 
  Plus,
  CheckCircle2,
  XCircle,
  Circle,
  Clock,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Minus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getWalletAddress } from '../config';

interface Proposal {
  id: string;
  proposalId: string;
  title: string;
  description: string;
  proposer: string;
  status: string;
  votesFor: string;
  votesAgainst: string;
  votesAbstain: string;
}

export default function DaoMiniApp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [walletAddress] = useState(getWalletAddress());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    targetContract: '',
    functionCalldata: '0x',
    value: '0',
  });

  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ['/api/dao/proposals'],
    enabled: !!walletAddress,
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: typeof newProposal) => {
      return apiRequest('/api/dao/proposals', {
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
      setNewProposal({ title: '', description: '', targetContract: '', functionCalldata: '0x', value: '0' });
      toast({
        title: 'Proposal created',
        description: 'Your governance proposal has been submitted.',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Failed to create proposal',
        description: 'Could not submit your proposal. Please try again.',
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ proposalId, support }: { proposalId: string; support: 'for' | 'against' | 'abstain' }) => {
      return apiRequest(`/api/dao/proposals/${proposalId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ support, votingPower: '1' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dao/proposals'] });
      setSelectedProposal(null);
      toast({
        title: 'Vote recorded',
        description: 'Your vote has been submitted on-chain.',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Failed to vote',
        description: 'Could not submit your vote. Please try again.',
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-500/20 text-blue-300 border-0"><Circle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'succeeded':
      case 'executed':
        return <Badge className="bg-green-500/20 text-green-300 border-0"><CheckCircle2 className="w-3 h-3 mr-1" />Passed</Badge>;
      case 'defeated':
      case 'canceled':
        return <Badge className="bg-red-500/20 text-red-300 border-0"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-300 border-0"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const stats = {
    total: proposals.length,
    active: proposals.filter((p) => p.status === 'active').length,
    passed: proposals.filter((p) => p.status === 'succeeded' || p.status === 'executed').length,
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Vote className="w-12 h-12 text-violet-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">
            You need to connect your wallet from the launcher to participate in governance.
          </p>
          <Button
            onClick={() => setLocation('/launcher')}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900/10 via-transparent to-purple-900/10 pointer-events-none" />
      
      <div className="relative z-10">
        <header className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Button
              data-testid="button-back-launcher"
              variant="ghost"
              size="sm"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold text-white">Governance</h1>
          </div>
          <Button
            data-testid="button-create-proposal"
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Proposal
          </Button>
        </header>

        <div className="p-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Vote className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Total Proposals</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Circle className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Active</p>
                    <p className="text-2xl font-bold text-white">{stats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Passed</p>
                    <p className="text-2xl font-bold text-white">{stats.passed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
            </div>
          ) : proposals.length === 0 ? (
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardContent className="p-12 text-center">
                <Vote className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No proposals yet</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Be the first to create a governance proposal.
                </p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="bg-violet-600 hover:bg-violet-500"
                >
                  Create Proposal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <Card
                  key={proposal.id}
                  data-testid={`card-proposal-${proposal.id}`}
                  className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-violet-500/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedProposal(proposal)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{proposal.title}</h3>
                          {getStatusBadge(proposal.status)}
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2 mb-4">{proposal.description}</p>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2 text-green-400">
                            <ThumbsUp className="w-4 h-4" />
                            <span>{proposal.votesFor || '0'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-red-400">
                            <ThumbsDown className="w-4 h-4" />
                            <span>{proposal.votesAgainst || '0'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            <Minus className="w-4 h-4" />
                            <span>{proposal.votesAbstain || '0'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Proposer</p>
                        <p className="text-sm text-slate-300 font-mono">
                          {proposal.proposer?.slice(0, 6)}...{proposal.proposer?.slice(-4)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Proposal</DialogTitle>
            <DialogDescription className="text-slate-400">
              Submit a new governance proposal for community voting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Title</label>
              <Input
                data-testid="input-proposal-title"
                placeholder="Proposal title..."
                value={newProposal.title}
                onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                className="bg-[#252525] border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Description</label>
              <Textarea
                data-testid="input-proposal-description"
                placeholder="Describe your proposal..."
                value={newProposal.description}
                onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                className="bg-[#252525] border-white/10 text-white min-h-[100px]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1 block">Target Contract</label>
              <Input
                data-testid="input-proposal-target"
                placeholder="0x..."
                value={newProposal.targetContract}
                onChange={(e) => setNewProposal({ ...newProposal, targetContract: e.target.value })}
                className="bg-[#252525] border-white/10 text-white font-mono"
              />
            </div>
            <div className="flex gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                data-testid="button-submit-proposal"
                onClick={() => createProposalMutation.mutate(newProposal)}
                disabled={!newProposal.title || !newProposal.description || createProposalMutation.isPending}
                className="flex-1 bg-violet-600 hover:bg-violet-500"
              >
                {createProposalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
        <DialogContent className="bg-[#1a1a1a] border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedProposal?.title}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedProposal?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedProposal && (
            <div className="space-y-6 mt-4">
              <div className="flex items-center justify-between p-4 bg-[#252525] rounded-xl">
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-green-400">{selectedProposal.votesFor || '0'}</p>
                  <p className="text-xs text-slate-500">For</p>
                </div>
                <div className="text-center flex-1 border-x border-white/10">
                  <p className="text-2xl font-bold text-red-400">{selectedProposal.votesAgainst || '0'}</p>
                  <p className="text-xs text-slate-500">Against</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold text-slate-400">{selectedProposal.votesAbstain || '0'}</p>
                  <p className="text-xs text-slate-500">Abstain</p>
                </div>
              </div>

              {selectedProposal.status === 'active' && (
                <div className="flex gap-3">
                  <Button
                    data-testid="button-vote-for"
                    onClick={() => voteMutation.mutate({ proposalId: selectedProposal.id, support: 'for' })}
                    disabled={voteMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-500"
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    For
                  </Button>
                  <Button
                    data-testid="button-vote-against"
                    onClick={() => voteMutation.mutate({ proposalId: selectedProposal.id, support: 'against' })}
                    disabled={voteMutation.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-500"
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Against
                  </Button>
                  <Button
                    data-testid="button-vote-abstain"
                    onClick={() => voteMutation.mutate({ proposalId: selectedProposal.id, support: 'abstain' })}
                    disabled={voteMutation.isPending}
                    variant="secondary"
                    className="flex-1 bg-slate-600 hover:bg-slate-500"
                  >
                    <Minus className="w-4 h-4 mr-2" />
                    Abstain
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
