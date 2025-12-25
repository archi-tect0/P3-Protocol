import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import P3HubLogo from '@/components/P3HubLogo';
import { 
  ArrowLeft, 
  Shield, 
  Wallet, 
  Zap, 
  MessageSquare, 
  Vote, 
  BarChart3, 
  Gamepad2,
  ChevronRight,
  Link2,
  CheckCircle2,
  Code2,
  Rocket
} from 'lucide-react';

const categories = [
  {
    name: 'Security & Identity',
    icon: Shield,
    tiles: 8,
    color: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-500/20',
    textColor: 'text-violet-400',
    description: 'Identity vaults, key rotation, presence verification, badges, sessions, policies, proofs, and wallet auth'
  },
  {
    name: 'Payments & Commerce',
    icon: Wallet,
    tiles: 6,
    color: 'from-amber-500 to-orange-600',
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    description: 'Invoices, marketplace listings, dual-mode shopping, anchored receipts, rentals, and quota management'
  },
  {
    name: 'Creative & Media',
    icon: Zap,
    tiles: 8,
    color: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-500/20',
    textColor: 'text-pink-400',
    description: 'Live TV, movies, ebooks, video streaming, audio loops, music jams, meme minting, and media feeds'
  },
  {
    name: 'Social & Collaboration',
    icon: MessageSquare,
    tiles: 6,
    color: 'from-blue-500 to-cyan-600',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    description: 'Encrypted messaging, voice/video calls, stories, link sharing, reminders, and directory'
  },
  {
    name: 'Governance & Voting',
    icon: Vote,
    tiles: 4,
    color: 'from-cyan-500 to-teal-600',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
    description: 'DAO proposals, micro-DAOs, community trivia, and governance receipts'
  },
  {
    name: 'Analytics & Data',
    icon: BarChart3,
    tiles: 3,
    color: 'from-indigo-500 to-blue-600',
    bgColor: 'bg-indigo-500/20',
    textColor: 'text-indigo-400',
    description: 'Analytics dashboards, receipt explorers, and session activity tracking'
  },
  {
    name: 'Games & Entertainment',
    icon: Gamepad2,
    tiles: 10,
    color: 'from-emerald-500 to-green-600',
    bgColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    description: 'Free-to-play catalog, leaderboards, tournaments, mods, achievements, and arcade classics'
  }
];

const howItWorks = [
  {
    step: 1,
    icon: Wallet,
    title: 'Connect Wallet Once',
    description: 'Link your Web3 wallet to establish your identity. One connection unlocks the entire ecosystem.'
  },
  {
    step: 2,
    icon: Link2,
    title: 'Access All Protocol Primitives',
    description: 'Browse and interact with 45+ protocol modules across 7 categories. No separate signups needed.'
  },
  {
    step: 3,
    icon: CheckCircle2,
    title: 'Every Action Creates Verifiable Proof',
    description: 'All interactions generate cryptographic receipts anchored on-chain for transparency and trust.'
  }
];

export default function HubAboutPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#141414] overflow-x-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-indigo-900/20 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[100vw] sm:w-[800px] h-[400px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      
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
          <P3HubLogo className="w-20 text-white" />
        </header>

        <section className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 border border-purple-500/30 mb-6">
            <Rocket className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-purple-300 font-medium">Protocol Ecosystem Marketplace</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            About P3 Hub
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            P3 Hub is the unified gateway to the Protocol 3 ecosystem — a curated marketplace 
            of decentralized primitives for identity, payments, creativity, governance, and more. 
            Connect once, access everything.
          </p>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">What's Inside</h2>
            <p className="text-slate-400">45+ protocol modules organized into 7 categories</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => {
              const IconComponent = category.icon;
              return (
                <Card 
                  key={category.name}
                  data-testid={`card-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group relative overflow-hidden bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 hover:border-purple-500/30 transition-all duration-300"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  <div className="relative p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl ${category.bgColor} flex items-center justify-center`}>
                        <IconComponent className={`w-5 h-5 ${category.textColor}`} />
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${category.bgColor} ${category.textColor}`}>
                        {category.tiles} tiles
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{category.name}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{category.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-slate-400">Three simple steps to unlock the full protocol ecosystem</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {howItWorks.map((item) => {
              const IconComponent = item.icon;
              return (
                <Card 
                  key={item.step}
                  data-testid={`card-how-step-${item.step}`}
                  className="relative overflow-hidden bg-[#1a1a1a]/60 backdrop-blur-xl border-white/5 p-6"
                >
                  <div className="absolute top-4 right-4 text-4xl font-bold text-white/5">
                    {item.step}
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
                    <IconComponent className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="mb-16">
          <Card className="relative overflow-hidden bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-indigo-600/10" />
            <div className="relative p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Code2 className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">For Developers</h2>
                  <p className="text-slate-400 leading-relaxed">
                    Build on P3's open protocol stack. Access our SDKs, smart contracts, and documentation 
                    to create your own modules or integrate existing primitives into your applications. 
                    Join a growing ecosystem of Web3 builders.
                  </p>
                </div>
                <Button 
                  data-testid="button-dev-docs"
                  variant="outline"
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 hover:border-purple-500/50 flex-shrink-0"
                  onClick={() => setLocation('/launcher/sdk')}
                >
                  View SDK
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="text-center pb-12">
          <Card className="relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-xl border-purple-500/20">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent" />
            <div className="relative p-8 sm:p-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                Ready to Explore?
              </h2>
              <p className="text-slate-300 mb-6 max-w-lg mx-auto">
                Connect your wallet and start using P3 Hub's protocol primitives today. 
                Every interaction is cryptographically verified.
              </p>
              <Button
                data-testid="button-explore-hub"
                onClick={() => setLocation('/launcher')}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border-0 px-8 py-6 text-lg"
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
