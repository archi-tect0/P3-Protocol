import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  CheckCircle2, 
  ArrowUpRight,
  Package,
  BarChart2,
  Clock,
  Zap,
  Star,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "./AdminLayout";

interface SubscriptionTier {
  id: string;
  name: string;
  monthlyPrice: string;
  quotaMonthly: number;
  featuresJson: Record<string, unknown> | null;
  overagePricePerUnit: string | null;
}

interface TiersResponse {
  tiers: SubscriptionTier[];
  count: number;
}


function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-card-admin rounded-xl p-6 h-48 bg-white/5" />
        ))}
      </div>
    </div>
  );
}

function TierCard({ 
  tier, 
  isCurrentTier, 
  onSelect 
}: { 
  tier: SubscriptionTier; 
  isCurrentTier: boolean;
  onSelect: () => void;
}) {
  const features = tier.featuresJson as Record<string, boolean> || {};
  const featureList = Object.entries(features).filter(([, v]) => v).map(([k]) => k);

  return (
    <div 
      className={`glass-card-admin rounded-xl p-6 relative ${
        isCurrentTier ? 'ring-2 ring-[#4fe1a8]' : ''
      }`}
      data-testid={`tier-card-${tier.name.toLowerCase()}`}
    >
      {isCurrentTier && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-[#4fe1a8] text-[#0d1b2a]">Current Plan</Badge>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[#eaf6ff]">{tier.name}</h3>
          <p className="text-sm text-slate-400">
            {tier.quotaMonthly.toLocaleString()} requests/mo
          </p>
        </div>
        <div className="p-2 rounded-lg bg-purple-500/20">
          <Package className="w-5 h-5 text-purple-400" />
        </div>
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-[#eaf6ff]">
          ${parseFloat(tier.monthlyPrice).toFixed(0)}
        </span>
        <span className="text-slate-400 text-sm">/month</span>
      </div>

      <ul className="space-y-2 mb-6">
        {featureList.length > 0 ? (
          featureList.slice(0, 5).map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#4fe1a8]" />
              <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
            </li>
          ))
        ) : (
          <>
            <li className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#4fe1a8]" />
              API Access
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#4fe1a8]" />
              {tier.quotaMonthly.toLocaleString()} Monthly Requests
            </li>
            <li className="flex items-center gap-2 text-sm text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-[#4fe1a8]" />
              Email Support
            </li>
          </>
        )}
      </ul>

      {tier.overagePricePerUnit && (
        <p className="text-xs text-slate-500 mb-4">
          Overage: ${tier.overagePricePerUnit}/request
        </p>
      )}

      <Button
        onClick={onSelect}
        variant={isCurrentTier ? "outline" : "default"}
        className={`w-full ${
          isCurrentTier 
            ? 'border-white/10 text-slate-300' 
            : 'bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90'
        }`}
        disabled={isCurrentTier}
        data-testid={`button-select-tier-${tier.name.toLowerCase()}`}
      >
        {isCurrentTier ? 'Current Plan' : 'Upgrade'}
      </Button>
    </div>
  );
}

function UsageMetrics() {
  const currentUsage = 45678;
  const totalQuota = 100000;
  const percentUsed = ((currentUsage / totalQuota) * 100).toFixed(1);

  return (
    <div className="glass-card-admin rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-cyan-500/20">
          <BarChart2 className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#eaf6ff]">Usage This Month</h3>
          <p className="text-xs text-slate-400">Current billing period</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-slate-400">API Requests</span>
            <span className="text-sm font-medium text-[#eaf6ff]">
              {currentUsage.toLocaleString()} / {totalQuota.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-[#4fe1a8] to-cyan-400 h-3 rounded-full transition-all"
              style={{ width: `${percentUsed}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">{percentUsed}% of monthly quota used</p>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
          <div className="text-center">
            <p className="text-lg font-bold text-[#eaf6ff]">{currentUsage.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Used</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#eaf6ff]">{(totalQuota - currentUsage).toLocaleString()}</p>
            <p className="text-xs text-slate-500">Remaining</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#eaf6ff]">12</p>
            <p className="text-xs text-slate-500">Days Left</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentHistory() {
  const payments = [
    { id: '1', date: '2024-11-01', amount: 99.00, status: 'paid', description: 'Pro Plan - Monthly' },
    { id: '2', date: '2024-10-01', amount: 99.00, status: 'paid', description: 'Pro Plan - Monthly' },
    { id: '3', date: '2024-09-01', amount: 99.00, status: 'paid', description: 'Pro Plan - Monthly' },
  ];

  return (
    <div className="glass-card-admin rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#eaf6ff]">Payment History</h3>
            <p className="text-xs text-slate-400">Recent transactions</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {payments.map((payment) => (
          <div 
            key={payment.id} 
            className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
            data-testid={`payment-row-${payment.id}`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-[#eaf6ff]">{payment.description}</p>
                <p className="text-xs text-slate-500">{new Date(payment.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#eaf6ff]">${payment.amount.toFixed(2)}</p>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                {payment.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <Button 
        variant="ghost" 
        className="w-full mt-4 text-slate-400 hover:text-[#eaf6ff]"
        data-testid="button-view-all-payments"
      >
        View All Transactions
        <ArrowUpRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

export default function BillingPage() {
  const { toast } = useToast();
  const [, setSelectedTierId] = useState<string | null>(null);

  const { data: tiersData, isLoading, error } = useQuery<TiersResponse>({
    queryKey: ['/api/enterprise/billing/tiers'],
  });

  const currentTierId = tiersData?.tiers?.[0]?.id || null;

  const upgradeMutation = useMutation({
    mutationFn: async (tierId: string) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      return await apiRequest('/api/enterprise/billing/assign-tier', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify({ 
          tenantId: 'default',
          tierId 
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/billing/tiers'] });
      toast({
        title: 'Plan Updated',
        description: 'Your subscription has been updated successfully.',
      });
      setSelectedTierId(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSelectTier = (tierId: string) => {
    if (tierId !== currentTierId) {
      if (confirm('Are you sure you want to change your subscription plan?')) {
        upgradeMutation.mutate(tierId);
      }
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#eaf6ff]" data-testid="billing-title">
            Billing & Subscription
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your subscription plan and view usage
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UsageMetrics />
          
          <div className="glass-card-admin rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
                <Zap className="w-5 h-5 text-[#4fe1a8]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#eaf6ff]">Current Plan</h3>
                <p className="text-xs text-slate-400">Your active subscription</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02]">
              <div>
                <p className="text-xl font-bold text-[#eaf6ff]">
                  {tiersData?.tiers?.[0]?.name || 'Free'}
                </p>
                <p className="text-sm text-slate-400">
                  {tiersData?.tiers?.[0] 
                    ? `$${parseFloat(tiersData.tiers[0].monthlyPrice).toFixed(0)}/month`
                    : 'No active subscription'
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  Active
                </Badge>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Next billing date</span>
                <span className="text-[#eaf6ff]">December 1, 2024</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-400">Payment method</span>
                <span className="text-[#eaf6ff]">•••• 4242</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[#eaf6ff] mb-4">Available Plans</h2>
          
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="glass-card-admin rounded-xl p-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <p className="text-slate-400">Failed to load subscription tiers</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tiersData?.tiers?.length === 0 ? (
                <>
                  <TierCard
                    tier={{
                      id: 'free',
                      name: 'Free',
                      monthlyPrice: '0',
                      quotaMonthly: 1000,
                      featuresJson: { api_access: true, basic_support: true },
                      overagePricePerUnit: null,
                    }}
                    isCurrentTier={true}
                    onSelect={() => {}}
                  />
                  <TierCard
                    tier={{
                      id: 'pro',
                      name: 'Pro',
                      monthlyPrice: '99',
                      quotaMonthly: 100000,
                      featuresJson: { api_access: true, priority_support: true, custom_webhooks: true },
                      overagePricePerUnit: '0.001',
                    }}
                    isCurrentTier={false}
                    onSelect={() => toast({ title: 'Contact Sales', description: 'Please contact sales to upgrade.' })}
                  />
                  <TierCard
                    tier={{
                      id: 'enterprise',
                      name: 'Enterprise',
                      monthlyPrice: '499',
                      quotaMonthly: 1000000,
                      featuresJson: { api_access: true, dedicated_support: true, sla_guarantee: true, custom_integrations: true },
                      overagePricePerUnit: '0.0005',
                    }}
                    isCurrentTier={false}
                    onSelect={() => toast({ title: 'Contact Sales', description: 'Please contact sales to upgrade.' })}
                  />
                </>
              ) : (
                tiersData?.tiers?.map((tier) => (
                  <TierCard
                    key={tier.id}
                    tier={tier}
                    isCurrentTier={tier.id === currentTierId}
                    onSelect={() => handleSelectTier(tier.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <PaymentHistory />
      </div>

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
