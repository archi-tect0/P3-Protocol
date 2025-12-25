import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Settings, 
  FileCode, 
  Plug, 
  FileSearch, 
  Shield, 
  Network, 
  Vote,
  Phone,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  LayoutDashboard,
  HeartPulse,
  UserCog,
  Ticket,
  ShieldAlert,
  Key,
  CreditCard,
  Bell,
  BarChart3,
  UserX,
  Building2
} from "lucide-react";
import P3EnterpriseLogo from "@/components/P3EnterpriseLogo";
import { useAdmin } from "@/context/AdminContext";

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
  superuserOnly?: boolean;
}

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  testId: string;
}

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview', 'governance', 'operations', 'settings']));
  const { isSuperuser, walletAddress } = useAdmin();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [location]);

  const navSections: NavSection[] = [
    {
      id: 'overview',
      title: 'OVERVIEW',
      items: [
        { path: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-admin-dashboard" },
        { path: "/admin/health", label: "System Health", icon: HeartPulse, testId: "nav-admin-health" },
      ]
    },
    {
      id: 'governance',
      title: 'GOVERNANCE',
      items: [
        { path: "/admin/dao", label: "DAO", icon: Vote, testId: "nav-admin-dao" },
        { path: "/admin/rules", label: "Policies / Rules", icon: FileCode, testId: "nav-admin-rules" },
        { path: "/admin/zk", label: "RBAC / Roles", icon: Shield, testId: "nav-admin-zk" },
      ]
    },
    {
      id: 'operations',
      title: 'OPERATIONS',
      items: [
        { path: "/admin/audit", label: "Audit Logs", icon: FileSearch, testId: "nav-admin-audit" },
        { path: "/admin/crosschain", label: "Cross-Chain", icon: Network, testId: "nav-admin-crosschain" },
        { path: "/admin/plugins", label: "Integrations", icon: Plug, testId: "nav-admin-plugins" },
      ]
    },
    {
      id: 'settings',
      title: 'SETTINGS',
      items: [
        { path: "/admin/settings", label: "Settings", icon: Settings, testId: "nav-admin-settings" },
        { path: "/voice", label: "Voice & Video", icon: Phone, testId: "nav-admin-voice" },
      ]
    },
    {
      id: 'enterprise',
      title: 'ENTERPRISE',
      superuserOnly: true,
      items: [
        { path: "/admin/enterprise", label: "Overview", icon: Building2, testId: "nav-admin-enterprise" },
        { path: "/admin/api-keys", label: "API Keys", icon: Key, testId: "nav-admin-api-keys" },
        { path: "/admin/billing", label: "Billing", icon: CreditCard, testId: "nav-admin-billing" },
        { path: "/admin/alerts", label: "Alerts", icon: Bell, testId: "nav-admin-alerts" },
        { path: "/admin/sla", label: "SLA Metrics", icon: BarChart3, testId: "nav-admin-sla" },
        { path: "/admin/privacy", label: "Privacy Requests", icon: UserX, testId: "nav-admin-privacy" },
      ]
    },
    {
      id: 'superuser',
      title: 'SUPERUSER',
      superuserOnly: true,
      items: [
        { path: "/mod", label: "Moderation", icon: ShieldAlert, testId: "nav-admin-moderation" },
        { path: "/tickets", label: "Ticket Management", icon: Ticket, testId: "nav-admin-tickets" },
        { path: "/admin/rbac", label: "Role Assignment", icon: UserCog, testId: "nav-admin-rbac" },
      ]
    },
  ];

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const visibleSections = navSections.filter(section => 
    !section.superuserOnly || (section.superuserOnly && isSuperuser)
  );

  return (
    <div className="min-h-screen bg-[#0d1b2a]">
      <style>{`
        .glass-sidebar {
          background: rgba(13, 27, 42, 0.95);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(79, 225, 168, 0.1);
        }
        
        .glass-header {
          background: rgba(13, 27, 42, 0.9);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(79, 225, 168, 0.1);
        }
        
        .glass-card-admin {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        
        .nav-item-active {
          background: linear-gradient(90deg, rgba(79, 225, 168, 0.15) 0%, rgba(79, 225, 168, 0.05) 100%);
          border-left: 2px solid #4fe1a8;
        }
        
        .nav-item-hover:hover {
          background: rgba(79, 225, 168, 0.08);
        }
        
        .section-header:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        
        .sidebar-enter {
          animation: slideIn 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        .sidebar-exit {
          animation: slideOut 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        .fade-in {
          animation: fadeIn 200ms ease-out forwards;
        }
        
        .section-expand {
          animation: expandSection 200ms ease-out forwards;
        }
        
        .section-collapse {
          animation: collapseSection 180ms ease-out forwards;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(-100%);
            opacity: 0;
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes expandSection {
          from {
            opacity: 0;
            max-height: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            max-height: 500px;
            transform: translateY(0);
          }
        }
        
        @keyframes collapseSection {
          from {
            opacity: 1;
            max-height: 500px;
          }
          to {
            opacity: 0;
            max-height: 0;
          }
        }
        
        .glow-accent {
          box-shadow: 0 0 20px rgba(79, 225, 168, 0.15);
        }
      `}</style>

      <header className="fixed top-0 left-0 right-0 z-50 glass-header" data-testid="header-enterprise">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-[#eaf6ff] hover:bg-white/5 transition-all duration-200"
              data-testid="button-toggle-sidebar"
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4fe1a8] to-emerald-600 flex items-center justify-center glow-accent">
                <Shield className="w-5 h-5 text-[#0d1b2a]" />
              </div>
              <div className="hidden sm:block">
                <P3EnterpriseLogo className="w-24 text-[#eaf6ff]" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {walletAddress && (
              <div 
                className="px-3 py-1.5 rounded-full bg-[#4fe1a8]/10 border border-[#4fe1a8]/20"
                data-testid="wallet-address-display"
              >
                <span className="text-xs text-[#4fe1a8] font-medium font-mono">
                  {truncateAddress(walletAddress)}
                </span>
              </div>
            )}
            
            {isSuperuser && (
              <div className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                <span className="text-xs text-purple-400 font-medium">Superuser</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden fade-in"
          onClick={() => setIsSidebarOpen(false)}
          data-testid="sidebar-overlay"
        />
      )}

      <aside 
        className={`fixed top-0 left-0 h-full w-72 z-40 glass-sidebar pt-16 flex flex-col transform transition-transform duration-300 ease-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        data-testid="sidebar-enterprise"
      >
        <div className="px-4 py-4 border-b border-white/5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Trust Layer Management
          </p>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-2 px-2 scroll-container">
          {visibleSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const hasActiveItem = section.items.some(item => location === item.path);
            
            return (
              <div key={section.id} className="mb-1" data-testid={`section-${section.id}`}>
                <button
                  onClick={() => toggleSection(section.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 section-header ${
                    section.superuserOnly 
                      ? 'text-purple-400' 
                      : hasActiveItem 
                        ? 'text-[#4fe1a8]' 
                        : 'text-slate-500'
                  }`}
                  data-testid={`button-section-${section.id}`}
                >
                  <span>{section.title}</span>
                  <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>
                
                <div 
                  className={`overflow-hidden transition-all duration-200 ${
                    isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="py-1 space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.path;
                      
                      return (
                        <Link key={item.path} href={item.path}>
                          <a
                            data-testid={item.testId}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                              isActive
                                ? "nav-item-active text-[#eaf6ff]"
                                : "text-slate-400 nav-item-hover hover:text-[#eaf6ff]"
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-[#4fe1a8]' : ''}`} />
                            <span>{item.label}</span>
                            {isActive && (
                              <ChevronRight className="w-3 h-3 ml-auto text-[#4fe1a8]" />
                            )}
                          </a>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link href="/">
            <a 
              data-testid="button-back-to-app"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-[#eaf6ff] transition-all duration-200 rounded-lg nav-item-hover group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-200" />
              <span>Back to App</span>
            </a>
          </Link>
        </div>
      </aside>

      <main 
        className="min-h-screen pt-16 lg:pl-72 transition-all duration-300"
        data-testid="main-content"
      >
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
