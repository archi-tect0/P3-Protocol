import { useEffect, useState } from 'react';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { CheckCircle, XCircle, Clock, Users } from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  description: string;
  aye: number;
  nay: number;
  status: 'active' | 'passed' | 'rejected';
  endsAt?: string;
}

export default function GovernanceMode() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const { pushReceipt } = useAtlasStore();

  useEffect(() => {
    setLoading(true);
    
    setTimeout(() => {
      setProposals([
        { 
          id: 'p1', 
          title: 'Upgrade Anchor Registry to v2', 
          description: 'Implement batch anchoring with reduced gas costs',
          aye: 1247, 
          nay: 89, 
          status: 'active',
          endsAt: '2 days'
        },
        { 
          id: 'p2', 
          title: 'Add Polygon Support', 
          description: 'Cross-chain settlement via Polygon bridge',
          aye: 892, 
          nay: 234, 
          status: 'active',
          endsAt: '5 days'
        },
        { 
          id: 'p3', 
          title: 'Treasury Allocation Q1', 
          description: 'Allocate 50K USDC for developer grants',
          aye: 2341, 
          nay: 156, 
          status: 'passed'
        },
        { 
          id: 'p4', 
          title: 'Reduce Staking Minimum', 
          description: 'Lower minimum stake from 100 to 50 tokens',
          aye: 567, 
          nay: 1234, 
          status: 'rejected'
        },
      ]);
      setLoading(false);
      
      pushReceipt({
        id: `receipt-governance-${Date.now()}`,
        hash: `0x${Math.random().toString(16).slice(2, 18)}`,
        scope: 'atlas.render.governance',
        endpoint: '/atlas/render?mode=governance',
        timestamp: Date.now()
      });
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="governance-mode"
    >
      <h2 className="text-xl font-light text-white/80 mb-6">Governance</h2>
      
      <div className="space-y-4">
        {proposals.map((proposal, index) => {
          const total = proposal.aye + proposal.nay;
          const ayePercent = Math.round((proposal.aye / total) * 100);
          
          return (
            <MotionDiv
              key={proposal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              data-testid={`proposal-${proposal.id}`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-medium text-white/90">{proposal.title}</h3>
                    {proposal.status === 'active' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-400/20 text-cyan-400">
                        Active
                      </span>
                    )}
                    {proposal.status === 'passed' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-400/20 text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Passed
                      </span>
                    )}
                    {proposal.status === 'rejected' && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-400/20 text-red-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Rejected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/50">{proposal.description}</p>
                </div>
                
                {proposal.status === 'active' && proposal.endsAt && (
                  <div className="flex items-center gap-1 text-xs text-white/40">
                    <Clock className="w-3 h-3" />
                    {proposal.endsAt}
                  </div>
                )}
              </div>
              
              <div className="relative h-2 rounded-full bg-white/10 overflow-hidden mb-2">
                <MotionDiv
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-400 to-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${ayePercent}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                />
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-green-400">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    {proposal.aye.toLocaleString()} ({ayePercent}%)
                  </span>
                  <span className="text-red-400">
                    <XCircle className="w-3 h-3 inline mr-1" />
                    {proposal.nay.toLocaleString()} ({100 - ayePercent}%)
                  </span>
                </div>
                <span className="text-white/40 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {total.toLocaleString()} votes
                </span>
              </div>
            </MotionDiv>
          );
        })}
      </div>
    </MotionDiv>
  );
}
