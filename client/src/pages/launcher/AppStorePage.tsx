import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3Logo from '@/components/P3Logo';
import { 
  ArrowLeft, 
  Store,
  Shield,
  Layers,
  GitBranch,
  Coins,
  Users,
  Box,
  Wrench,
  Link2,
  LayoutDashboard,
  FileInput,
  CheckSquare,
  Grid3X3,
  Wallet,
  ChevronRight,
  Code2,
  Rocket,
  Clock
} from 'lucide-react';

const whyDifferent = [
  {
    icon: Shield,
    title: 'Distributed Governance',
    description: 'Protocol rules govern app inclusion — not centralized control. Transparent, verifiable, community-driven.',
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400'
  },
  {
    icon: Box,
    title: 'PWA-First Architecture',
    description: 'Apps auto-populate via config + protocol anchors. No APK overhead, instant updates, cross-platform by default.',
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400'
  },
  {
    icon: GitBranch,
    title: 'Branch-Safe Grid',
    description: 'Launcher grid is additive and branch-safe. No gatekeeping — apps mount without restructuring.',
    color: 'from-emerald-500 to-green-600',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400'
  },
  {
    icon: Coins,
    title: 'Protocol-Layer Monetization',
    description: 'Flexible revenue splits baked into the protocol. Transparent, programmable, no middleman fees.',
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400'
  },
  {
    icon: Users,
    title: 'DAO-Style Governance',
    description: 'Manifest-driven compliance with community oversight. Apps adhere to protocol standards through transparent governance.',
    color: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400'
  }
];

const howItScales = [
  {
    icon: Layers,
    title: 'PWAs as Primitives',
    description: 'Lightweight, installable, manifest-governed. Each app is a composable building block in the ecosystem.'
  },
  {
    icon: Wrench,
    title: 'Autopopulation SDK',
    description: 'Developers scaffold tiles with simple config. No complex deployment pipelines — just define and deploy.'
  },
  {
    icon: Link2,
    title: 'Protocol Bridge',
    description: 'Session continuity and wallet flows are native. Cross-app state persists seamlessly.'
  },
  {
    icon: LayoutDashboard,
    title: 'Governance Dashboard',
    description: 'Compliance scales horizontally. Monitor, audit, and govern at scale with built-in tooling.'
  }
];

const registryBlueprint = [
  {
    step: 1,
    icon: FileInput,
    title: 'Manifest Intake',
    description: 'Apps submit PWA manifest with protocol anchors — identity, permissions, and capability declarations.'
  },
  {
    step: 2,
    icon: CheckSquare,
    title: 'Validation Layer',
    description: 'Schema check, anchor compliance, and governance optics. Automated verification before mounting.'
  },
  {
    step: 3,
    icon: Grid3X3,
    title: 'Mounting into Grid',
    description: 'Tiles auto-populate into the launcher. No restructuring needed — just plug and play.'
  },
  {
    step: 4,
    icon: Wallet,
    title: 'Monetization Hooks',
    description: 'Revenue splits at the protocol layer. Transparent, programmable, instant settlement.'
  }
];

export default function AppStorePage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-purple-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <Button
            data-testid="button-back-launcher"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/launcher')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <P3Logo className="w-16 text-white" />
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 mb-6">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300 font-medium">Coming Soon</span>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Store className="w-10 h-10 text-indigo-400" />
            <h1 className="text-4xl sm:text-5xl font-bold text-white">
              P3 App Store
            </h1>
          </div>
          <p className="text-xl text-indigo-300 font-medium mb-4">
            Protocol-Native App Marketplace
          </p>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            A decentralized marketplace where apps are governed by protocol rules, 
            not centralized gatekeepers. PWAs mount directly into the launcher grid 
            with transparent governance and built-in monetization.
          </p>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Why It's Different</h2>
            <p className="text-slate-400">A fundamentally new approach to app distribution</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whyDifferent.map((item) => {
              const IconComponent = item.icon;
              return (
                <Card 
                  key={item.title}
                  data-testid={`card-why-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-indigo-500/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative p-5">
                    <div className={`w-10 h-10 rounded-xl ${item.bgColor} flex items-center justify-center mb-3`}>
                      <IconComponent className={`w-5 h-5 ${item.textColor}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How It Scales</h2>
            <p className="text-slate-400">Built for ecosystem-wide growth</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {howItScales.map((item) => {
              const IconComponent = item.icon;
              return (
                <Card 
                  key={item.title}
                  data-testid={`card-scale-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5 hover:border-indigo-500/20 transition-all duration-300 p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Registry Blueprint</h2>
            <p className="text-slate-400">From manifest to marketplace in four steps</p>
          </div>
          
          <div className="relative">
            <div className="absolute left-6 top-8 bottom-8 w-px bg-gradient-to-b from-indigo-500/50 via-purple-500/50 to-transparent hidden md:block" />
            
            <div className="space-y-4">
              {registryBlueprint.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Card 
                    key={item.step}
                    data-testid={`card-registry-step-${item.step}`}
                    className="relative overflow-hidden bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5 hover:border-indigo-500/20 transition-all duration-300"
                  >
                    <div className="relative p-6 flex items-start gap-5">
                      <div className="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300">
                            Step {item.step}
                          </span>
                          <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mb-16">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/10 via-transparent to-purple-600/10" />
            <div className="relative p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Code2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">For Developers</h2>
                  <p className="text-slate-400 leading-relaxed">
                    Start building on P3 today. Access our SDK documentation, scaffold your first tile, 
                    and deploy to the protocol-native marketplace. Join a growing ecosystem of 
                    decentralized app builders.
                  </p>
                </div>
                <Button 
                  data-testid="button-start-building"
                  variant="outline"
                  className="border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 hover:border-indigo-500/50 flex-shrink-0"
                  onClick={() => setLocation('/launcher/sdk')}
                >
                  Start building on P3
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="text-center pb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-xl border-indigo-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-600/10 via-transparent to-transparent" />
            <div className="relative p-8 sm:p-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 mb-4">
                <Rocket className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-indigo-300 font-medium">Protocol-Native</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                The Future of App Distribution
              </h2>
              <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                No gatekeepers. No APK overhead. Just manifest-driven PWAs mounting 
                directly into a decentralized launcher grid with transparent governance.
              </p>
              <Button
                data-testid="button-back-to-hub"
                onClick={() => setLocation('/launcher')}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-0 px-8 py-6 text-lg"
              >
                Explore the Hub
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
