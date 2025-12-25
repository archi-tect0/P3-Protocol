import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Building2, 
  Key, 
  CreditCard, 
  Bell, 
  BarChart3, 
  UserX,
  ArrowRight,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock
} from "lucide-react";
import AdminLayout from "./AdminLayout";

interface ApiKeysSummary {
  keys: Array<{
    id: string;
    status: string;
    tenantId: string;
  }>;
  pagination: {
    total: number;
  };
}

interface BillingTiers {
  tiers: Array<{
    id: string;
    name: string;
    monthlyPrice: string;
    quotaMonthly: number;
  }>;
}

interface PrivacyRequestsSummary {
  requests: Array<{
    id: string;
    status: string;
    type: string;
  }>;
  statusCounts: {
    received: number;
    processing: number;
    completed: number;
    rejected: number;
  };
}

function StatCard({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  trend, 
  trendUp 
}: { 
  icon: typeof Building2; 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <div className="glass-card-admin rounded-xl p-6" data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between">
        <div className="p-3 rounded-lg bg-[#4fe1a8]/10">
          <Icon className="w-6 h-6 text-[#4fe1a8]" />
        </div>
        {trend && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            trendUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-[#eaf6ff]">{value}</h3>
        <p className="text-sm text-slate-400 mt-1">{title}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function QuickLinkCard({ 
  href, 
  icon: Icon, 
  title, 
  description 
}: { 
  href: string; 
  icon: typeof Key; 
  title: string; 
  description: string; 
}) {
  return (
    <Link href={href}>
      <a 
        className="glass-card-admin rounded-xl p-5 flex items-center gap-4 hover:bg-white/[0.06] transition-all duration-200 group"
        data-testid={`quick-link-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className="p-3 rounded-lg bg-[#4fe1a8]/10 group-hover:bg-[#4fe1a8]/20 transition-colors">
          <Icon className="w-5 h-5 text-[#4fe1a8]" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-[#eaf6ff]">{title}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-[#4fe1a8] group-hover:translate-x-1 transition-all" />
      </a>
    </Link>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card-admin rounded-xl p-6 h-32 bg-white/5" />
        ))}
      </div>
      <div className="glass-card-admin rounded-xl p-6 h-48 bg-white/5" />
    </div>
  );
}

function SLAStatusBadge({ status }: { status: 'healthy' | 'degraded' | 'critical' }) {
  const config = {
    healthy: { icon: CheckCircle2, text: 'Healthy', color: 'text-green-400 bg-green-500/20' },
    degraded: { icon: AlertTriangle, text: 'Degraded', color: 'text-yellow-400 bg-yellow-500/20' },
    critical: { icon: AlertTriangle, text: 'Critical', color: 'text-red-400 bg-red-500/20' },
  };
  
  const { icon: StatusIcon, text, color } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <StatusIcon className="w-3.5 h-3.5" />
      {text}
    </span>
  );
}

export default function EnterprisePage() {
  const walletAddress = localStorage.getItem('walletAddress') || '';

  const { data: apiKeysData, isLoading: isLoadingKeys } = useQuery<ApiKeysSummary>({
    queryKey: ['/api/enterprise/api-keys/list'],
    enabled: !!walletAddress,
    retry: false,
  });

  const { data: tiersData, isLoading: isLoadingTiers } = useQuery<BillingTiers>({
    queryKey: ['/api/enterprise/billing/tiers'],
    retry: false,
  });

  const { data: privacyData, isLoading: isLoadingPrivacy } = useQuery<PrivacyRequestsSummary>({
    queryKey: ['/api/enterprise/privacy'],
    retry: false,
  });

  const isLoading = isLoadingKeys || isLoadingTiers || isLoadingPrivacy;

  const totalApiKeys = apiKeysData?.pagination?.total || apiKeysData?.keys?.length || 0;
  const activeApiKeys = apiKeysData?.keys?.filter(k => k.status === 'active').length || 0;
  
  const currentTier = tiersData?.tiers?.[0]?.name || 'Free';
  const tierQuota = tiersData?.tiers?.[0]?.quotaMonthly || 0;
  
  const pendingPrivacyRequests = (privacyData?.statusCounts?.received || 0) + 
    (privacyData?.statusCounts?.processing || 0);
  const completedPrivacyRequests = privacyData?.statusCounts?.completed || 0;

  const slaStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
  const uptimePercent = 99.95;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#eaf6ff]" data-testid="enterprise-title">
              Enterprise Overview
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage your enterprise features and monitor system health
            </p>
          </div>
          <SLAStatusBadge status={slaStatus} />
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Key}
                title="Total API Keys"
                value={totalApiKeys}
                subtitle={`${activeApiKeys} active`}
                trend="+2 this month"
                trendUp={true}
              />
              <StatCard
                icon={CreditCard}
                title="Current Tier"
                value={currentTier}
                subtitle={tierQuota > 0 ? `${tierQuota.toLocaleString()} requests/mo` : 'Unlimited'}
              />
              <StatCard
                icon={Activity}
                title="SLA Uptime"
                value={`${uptimePercent}%`}
                subtitle="Last 30 days"
                trend="99.9% target"
                trendUp={uptimePercent >= 99.9}
              />
              <StatCard
                icon={UserX}
                title="Privacy Requests"
                value={pendingPrivacyRequests}
                subtitle={`${completedPrivacyRequests} completed this month`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card-admin rounded-xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#eaf6ff]">Quick Actions</h3>
                    <p className="text-xs text-slate-400">Navigate to enterprise features</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <QuickLinkCard
                    href="/admin/api-keys"
                    icon={Key}
                    title="API Keys"
                    description="Create and manage API keys"
                  />
                  <QuickLinkCard
                    href="/admin/billing"
                    icon={CreditCard}
                    title="Billing"
                    description="Manage subscription and usage"
                  />
                  <QuickLinkCard
                    href="/admin/alerts"
                    icon={Bell}
                    title="Alerts"
                    description="Configure alert channels and rules"
                  />
                  <QuickLinkCard
                    href="/admin/sla"
                    icon={BarChart3}
                    title="SLA Metrics"
                    description="View uptime and performance"
                  />
                  <QuickLinkCard
                    href="/admin/privacy"
                    icon={UserX}
                    title="Privacy Requests"
                    description="Handle GDPR/CCPA requests"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <div className="glass-card-admin rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
                      <Bell className="w-5 h-5 text-[#4fe1a8]" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#eaf6ff]">Recent Alerts</h3>
                      <p className="text-xs text-slate-400">Last 24 hours</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                      <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-300">All systems operational</p>
                        <p className="text-xs text-slate-500 mt-0.5">No alerts in the last 24 hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card-admin rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Clock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-[#eaf6ff]">SLA Summary</h3>
                      <p className="text-xs text-slate-400">Current period metrics</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-400">Uptime</span>
                      <span className="text-sm font-medium text-[#eaf6ff]">{uptimePercent}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-[#4fe1a8] to-cyan-400 h-2 rounded-full" 
                        style={{ width: `${uptimePercent}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#eaf6ff]">45ms</p>
                        <p className="text-xs text-slate-500">Avg Response</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#eaf6ff]">0.02%</p>
                        <p className="text-xs text-slate-500">Error Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-400">Passing</p>
                        <p className="text-xs text-slate-500">SLA Status</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
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
