import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3HubLogo from '@/components/P3HubLogo';
import { 
  ArrowLeft, 
  Shield, 
  Vote, 
  Code,
  CheckCircle2,
  Building2,
  Heart,
  Briefcase,
  GraduationCap,
  Music,
  Video,
  BookOpen,
  Image,
  Globe,
  Zap,
  Lock,
  Layers,
  ArrowRight,
  Users,
  MessageSquare,
  Wallet,
  Receipt,
  Scale,
  Gavel,
  FileCheck,
  Fingerprint,
  Camera,
  Mic,
  Store,
  Coins,
  TrendingUp
} from 'lucide-react';

const primaryUseCases = [
  {
    name: 'Enterprise Communication',
    icon: Shield,
    gradient: 'from-violet-600 to-purple-700',
    description: 'Military-grade encrypted messaging with compliance-ready audit trails. Perfect for legal, healthcare, and financial institutions.',
    highlights: [
      { icon: Lock, text: 'Kyber-768 + X25519 hybrid encryption' },
      { icon: Receipt, text: 'Blockchain-anchored message receipts' },
      { icon: FileCheck, text: 'Policy acknowledgment tracking' },
      { icon: Users, text: 'Team consent management' }
    ],
    industries: ['Legal Firms', 'Healthcare', 'Finance', 'Government'],
    stats: { label: 'Encryption Standard', value: 'Post-Quantum' }
  },
  {
    name: 'Secure Video Meetings',
    icon: Video,
    gradient: 'from-cyan-600 to-blue-700',
    description: 'WebRTC video calls with cryptographic proof-of-attendance. Every meeting generates immutable evidence.',
    highlights: [
      { icon: Camera, text: 'E2E encrypted video streams' },
      { icon: Fingerprint, text: 'Participant attestation proofs' },
      { icon: Receipt, text: 'Meeting duration anchors' },
      { icon: Mic, text: 'Audio transcript hashing' }
    ],
    industries: ['Remote Teams', 'Legal Depositions', 'Medical Consults', 'Board Meetings'],
    stats: { label: 'Proof Type', value: 'On-Chain' }
  },
  {
    name: 'Cross-Chain Payments',
    icon: Coins,
    gradient: 'from-amber-500 to-orange-600',
    description: 'Send payments from any chain - Ethereum, Polygon, Arbitrum, Solana - all fees settle to Base treasury automatically.',
    highlights: [
      { icon: Globe, text: 'Multi-chain support via LayerZero' },
      { icon: Wallet, text: 'Native token transfers' },
      { icon: Receipt, text: 'Instant payment receipts' },
      { icon: TrendingUp, text: '2.5% settlement fee' }
    ],
    industries: ['DeFi', 'E-commerce', 'Freelancers', 'DAOs'],
    stats: { label: 'Settlement', value: 'Base L2' }
  },
  {
    name: 'DAO Governance',
    icon: Vote,
    gradient: 'from-emerald-600 to-teal-700',
    description: 'Transparent on-chain proposals with anchored vote tallies. Build trust through verifiable governance.',
    highlights: [
      { icon: Gavel, text: 'Proposal creation & voting' },
      { icon: Scale, text: 'Weighted vote calculations' },
      { icon: Receipt, text: 'Tally proofs on-chain' },
      { icon: Users, text: 'Delegation tracking' }
    ],
    industries: ['Protocol DAOs', 'Investment DAOs', 'Social DAOs', 'Guilds'],
    stats: { label: 'Vote Anchoring', value: 'Immutable' }
  }
];

const marketplaceVerticals = [
  {
    name: 'Digital Books',
    icon: BookOpen,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    description: 'E-books with DRM-free ownership and creator royalties',
    route: '/marketplace/ebook'
  },
  {
    name: 'Music Streaming',
    icon: Music,
    color: 'text-pink-400',
    bg: 'bg-pink-500/20',
    description: 'Stream and own music with transparent artist payments',
    route: '/marketplace/music'
  },
  {
    name: 'Video Content',
    icon: Video,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    description: 'Premium video with encrypted delivery and proof-of-view',
    route: '/marketplace/video'
  },
  {
    name: 'Digital Art',
    icon: Image,
    color: 'text-violet-400',
    bg: 'bg-violet-500/20',
    description: 'Art gallery with provenance tracking and creator attribution',
    route: '/marketplace/art'
  }
];

const industryUseCases = [
  {
    industry: 'Healthcare',
    icon: Heart,
    color: 'text-rose-400',
    cases: [
      'HIPAA-compliant patient messaging',
      'Telemedicine session proofs',
      'Prescription acknowledgments',
      'Medical record attestations'
    ]
  },
  {
    industry: 'Legal',
    icon: Scale,
    color: 'text-amber-400',
    cases: [
      'Privileged attorney-client comms',
      'Contract signature anchoring',
      'Deposition attendance proofs',
      'Evidence chain-of-custody'
    ]
  },
  {
    industry: 'Finance',
    icon: Briefcase,
    color: 'text-emerald-400',
    cases: [
      'Regulatory compliance trails',
      'Trade confirmation receipts',
      'Client consent management',
      'Audit-ready communications'
    ]
  },
  {
    industry: 'Education',
    icon: GraduationCap,
    color: 'text-blue-400',
    cases: [
      'Credential verification',
      'Assignment submission proofs',
      'Attendance attestations',
      'Certification anchoring'
    ]
  }
];

const developerFeatures = [
  {
    title: 'Protocol-Native SDK',
    description: 'Full TypeScript SDK with crypto, anchoring, messaging, and governance modules',
    icon: Code
  },
  {
    title: 'Manifest-Driven Apps',
    description: 'Auto-populated tiles via 3-file rule: index.html, sw.js, manifest.json',
    icon: Layers
  },
  {
    title: 'Session Bridge',
    description: 'Single WalletConnect session shared across all Atlas Canvas modes',
    icon: Zap
  },
  {
    title: 'Cross-Chain API',
    description: 'POST /api/protocol/settle - any chain, Base treasury',
    icon: Globe
  }
];

export default function UseCasesPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0f] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-cyan-900/10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/8 blur-[150px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
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
          <P3HubLogo className="w-20 text-white" />
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300">Protocol-Native OS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            Real-World Use Cases
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            From enterprise compliance to creative marketplaces, P3 Protocol powers 
            applications that demand <span className="text-white">privacy</span>, <span className="text-white">proof</span>, and <span className="text-white">permanence</span>.
          </p>
        </section>

        <section className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <Shield className="w-6 h-6 text-purple-400" />
            Core Protocol Capabilities
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {primaryUseCases.map((useCase) => {
              const IconComponent = useCase.icon;
              return (
                <Card 
                  key={useCase.name}
                  data-testid={`card-usecase-${useCase.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border-slate-800/50 hover:border-purple-500/30 transition-all duration-500"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${useCase.gradient}`} />
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-5">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${useCase.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                        <IconComponent className="w-7 h-7 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-bold text-white">{useCase.name}</h3>
                          <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/50">
                            <span className="text-xs text-slate-400">{useCase.stats.label}: </span>
                            <span className="text-xs text-white font-medium">{useCase.stats.value}</span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">{useCase.description}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {useCase.highlights.map((highlight, idx) => {
                        const HighlightIcon = highlight.icon;
                        return (
                          <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                            <HighlightIcon className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            <span>{highlight.text}</span>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="pt-4 border-t border-slate-800/50">
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Industries</p>
                      <div className="flex flex-wrap gap-2">
                        {useCase.industries.map((industry) => (
                          <span 
                            key={industry}
                            className="text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/50"
                          >
                            {industry}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <Store className="w-6 h-6 text-orange-400" />
            Marketplace Verticals
          </h2>
          <p className="text-slate-400 mb-8 max-w-2xl">
            Four specialized marketplaces for digital content, each with cross-chain settlement 
            and creator-first economics.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {marketplaceVerticals.map((vertical) => {
              const IconComponent = vertical.icon;
              return (
                <Card 
                  key={vertical.name}
                  data-testid={`card-marketplace-${vertical.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => setLocation(vertical.route)}
                  className="group cursor-pointer relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border-slate-800/50 hover:border-orange-500/30 transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="p-5">
                    <div className={`w-12 h-12 rounded-xl ${vertical.bg} flex items-center justify-center mb-4`}>
                      <IconComponent className={`w-6 h-6 ${vertical.color}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{vertical.name}</h3>
                    <p className="text-sm text-slate-400 mb-4">{vertical.description}</p>
                    <div className="flex items-center gap-2 text-orange-400 text-sm group-hover:gap-3 transition-all">
                      <span>Browse</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
            <Building2 className="w-6 h-6 text-cyan-400" />
            Industry Applications
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {industryUseCases.map((industry) => {
              const IconComponent = industry.icon;
              return (
                <Card 
                  key={industry.industry}
                  data-testid={`card-industry-${industry.industry.toLowerCase()}`}
                  className="relative overflow-hidden bg-slate-900/50 backdrop-blur-xl border-slate-800/50"
                >
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <IconComponent className={`w-6 h-6 ${industry.color}`} />
                      <h3 className="text-lg font-semibold text-white">{industry.industry}</h3>
                    </div>
                    <ul className="space-y-2">
                      {industry.cases.map((useCase, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-400">
                          <CheckCircle2 className={`w-4 h-4 ${industry.color} flex-shrink-0 mt-0.5`} />
                          <span>{useCase}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-20">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700/50">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full" />
            <div className="relative p-8 lg:p-12">
              <div className="flex items-center gap-3 mb-6">
                <Code className="w-6 h-6 text-indigo-400" />
                <h2 className="text-2xl font-bold text-white">Developer Platform</h2>
              </div>
              <p className="text-slate-400 mb-8 max-w-2xl">
                Build protocol-native applications with our comprehensive SDK. 
                Every feature is accessible via TypeScript modules and REST APIs.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {developerFeatures.map((feature, idx) => {
                  const IconComponent = feature.icon;
                  return (
                    <div key={idx} className="flex flex-col gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-indigo-400" />
                      </div>
                      <h4 className="text-white font-medium">{feature.title}</h4>
                      <p className="text-sm text-slate-400">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
              <Button
                data-testid="button-view-sdk-docs"
                onClick={() => setLocation('/launcher/sdk')}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
              >
                <Code className="w-4 h-4 mr-2" />
                View SDK Documentation
              </Button>
            </div>
          </div>
        </section>

        <section className="mb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-xl border-purple-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />
            <div className="relative p-8 sm:p-12 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm text-emerald-300">Cross-Chain Settlement Active</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to Build on P3?
              </h2>
              <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                Join the protocol-native ecosystem. Deploy apps that leverage encrypted 
                messaging, blockchain proofs, and cross-chain payments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  data-testid="button-explore-hub"
                  onClick={() => setLocation('/launcher')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 px-8 py-6 text-lg"
                >
                  Explore P3 Hub
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  data-testid="button-launch-nexus"
                  variant="outline"
                  onClick={() => setLocation('/app')}
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 hover:border-purple-500/50 px-8 py-6 text-lg"
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Launch Nexus
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
