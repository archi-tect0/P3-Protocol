import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Settings, 
  Shield,
  Users,
  Activity,
  Database,
  Key,
  FileText,
  Zap,
  ChevronRight,
  Lock,
  Globe,
  Server
} from 'lucide-react';
import { getWalletAddress } from './config';

interface AdminSection {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  route: string;
  badge?: string;
}

const adminSections: AdminSection[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'System overview and metrics',
    icon: Activity,
    route: '/admin/dashboard',
  },
  {
    id: 'rbac',
    name: 'Access Control',
    description: 'Role-based permissions management',
    icon: Shield,
    route: '/admin/rbac',
  },
  {
    id: 'audit',
    name: 'Audit Logs',
    description: 'View system activity and events',
    icon: FileText,
    route: '/admin/audit',
  },
  {
    id: 'health',
    name: 'System Health',
    description: 'Service status and monitoring',
    icon: Server,
    route: '/admin/health',
  },
  {
    id: 'rules',
    name: 'Rules Engine',
    description: 'Configure automation rules',
    icon: Zap,
    route: '/admin/rules',
  },
  {
    id: 'plugins',
    name: 'Plugins',
    description: 'Manage system extensions',
    icon: Database,
    route: '/admin/plugins',
  },
  {
    id: 'zk',
    name: 'ZK Management',
    description: 'Zero-knowledge proof settings',
    icon: Key,
    route: '/admin/zk',
  },
  {
    id: 'crosschain',
    name: 'Cross-Chain',
    description: 'Bridge and multi-chain settings',
    icon: Globe,
    route: '/admin/crosschain',
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'General configuration',
    icon: Settings,
    route: '/admin/settings',
  },
];

export default function AdminMiniApp() {
  const [, setLocation] = useLocation();
  const [walletAddress] = useState(getWalletAddress());

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Lock className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-slate-400 mb-6">
            You need to connect your wallet from the launcher to access admin features.
          </p>
          <Button
            onClick={() => setLocation('/launcher')}
            className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/20 via-transparent to-slate-800/20 pointer-events-none" />
      
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
            <h1 className="text-lg font-semibold text-white">Admin Panel</h1>
          </div>
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-0">
            <Shield className="w-3 h-3 mr-1" />
            Admin Access
          </Badge>
        </header>

        <div className="p-6 max-w-6xl mx-auto">
          <div className="mb-8">
            <Card className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 backdrop-blur-xl border-white/5">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center">
                    <Settings className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">System Administration</h2>
                    <p className="text-sm text-slate-400">
                      Manage P3 Protocol settings, security, and integrations
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <Card
                  key={section.id}
                  data-testid={`card-admin-${section.id}`}
                  onClick={() => setLocation(section.route)}
                  className="group bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-slate-500/30 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-slate-500/5"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 rounded-xl bg-slate-500/20 flex items-center justify-center mb-4 group-hover:bg-slate-500/30 transition-colors">
                        <IconComponent className="w-6 h-6 text-slate-300" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-1 group-hover:text-slate-200">
                      {section.name}
                    </h3>
                    <p className="text-sm text-slate-500">{section.description}</p>
                    {section.badge && (
                      <Badge className="mt-3 bg-blue-500/20 text-blue-300 border-0">
                        {section.badge}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-white font-medium">All Systems Operational</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-slate-400" />
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Connected Wallet</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white font-mono text-sm truncate">
                  {walletAddress}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
