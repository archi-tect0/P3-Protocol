import { useState } from 'react';
import { MotionDiv } from '@/lib/motion';
import { 
  Command, Terminal, Navigation, Activity, 
  Settings, Gauge, ArrowLeft, Zap, Shield, Radio,
  Database, Brain, Mic, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';

type DrilldownType = 'navigation' | 'pulse' | 'system' | 'llm' | 'capabilities' | null;

const commandCategories = {
  navigation: {
    title: 'Navigation Commands',
    icon: Navigation,
    color: 'from-blue-500 to-cyan-500',
    commands: [
      { cmd: '"Open Atlas One"', desc: 'Launch the unified marketplace', status: 'live' },
      { cmd: '"Open Game Deck"', desc: 'Launch the gaming substrate', status: 'live' },
      { cmd: '"Show launcher"', desc: 'Return to the launcher', status: 'live' },
      { cmd: '"Open dashboard"', desc: 'Go to admin dashboard', status: 'live' },
      { cmd: '"Check my inbox"', desc: 'View your messages', status: 'live' },
    ],
  },
  pulse: {
    title: 'Pulse Access',
    icon: Activity,
    color: 'from-emerald-500 to-teal-500',
    commands: [
      { cmd: '"Open Atlas Pulse"', desc: 'View live substrate metrics', status: 'live' },
      { cmd: '"Show efficiency"', desc: 'Compare Atlas vs REST performance', status: 'live' },
      { cmd: '"Check atlas health"', desc: 'View substrate status', status: 'live' },
      { cmd: '"How fast is Atlas"', desc: 'See latency comparisons', status: 'live' },
      { cmd: '"Atlas pulse"', desc: 'Quick access to metrics', status: 'live' },
    ],
  },
  system: {
    title: 'System Actions',
    icon: Settings,
    color: 'from-violet-500 to-purple-500',
    commands: [
      { cmd: '"Show commands"', desc: 'Display this help card', status: 'live' },
      { cmd: '"What can Atlas do"', desc: 'Show capabilities overview', status: 'live' },
      { cmd: '"Capabilities"', desc: 'List what Atlas can do', status: 'live' },
      { cmd: '"Voice commands"', desc: 'Show available voice commands', status: 'live' },
      { cmd: '"Help"', desc: 'Get assistance with Atlas', status: 'live' },
    ],
  },
  llm: {
    title: 'LLM Integration Required',
    icon: Radio,
    color: 'from-amber-500 to-orange-500',
    commands: [
      { cmd: '"Weather in [city]"', desc: 'Weather via Meta-Adapter', status: 'beta' },
      { cmd: '"Check my balance"', desc: 'Wallet balance via Web3', status: 'beta' },
      { cmd: '"Send message to..."', desc: 'Messaging via connected apps', status: 'beta' },
      { cmd: '"Show receipts"', desc: 'Transaction receipts', status: 'beta' },
    ],
  },
};

const nativeCapabilities = [
  { id: 'session', name: 'Session-native transport', icon: Zap, desc: 'Persistent connections, no re-auth per request' },
  { id: 'voice', name: 'Voice/text command routing', icon: Mic, desc: 'Unified intent parsing for both input modes' },
  { id: 'pulse', name: 'Real-time metric display', icon: Gauge, desc: 'Live Pulse dashboard with animated cards' },
  { id: 'catalog', name: 'Catalog ingestion', icon: Database, desc: 'Auto-sync from IPTV, Gutenberg, GitHub, etc.' },
  { id: 'persona', name: 'Persona persistence', icon: Shield, desc: 'Wallet-anchored preferences and history' },
  { id: 'state', name: 'UI state memory', icon: Brain, desc: 'Remembers nav position, selected tiles, settings' },
  { id: 'vertical', name: 'Vertical switching', icon: Navigation, desc: 'Game Deck, Atlas One, seamless transitions' },
  { id: 'dismiss', name: 'Auto-dismiss logic', icon: MessageSquare, desc: 'Smart notifications and receipt handling' },
];

export default function CapabilityMode() {
  const [drilldown, setDrilldown] = useState<DrilldownType>(null);

  const renderDrilldown = () => {
    if (!drilldown) return null;

    if (drilldown === 'capabilities') {
      return (
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute inset-0 bg-slate-900/98 backdrop-blur-xl z-20 p-4 overflow-auto"
          data-testid="drilldown-capabilities"
        >
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrilldown(null)}
              className="text-white/60 hover:text-white hover:bg-white/10"
              data-testid="button-back-capabilities"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Shield className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white" data-testid="text-capabilities-title">Native Capabilities</h2>
          </div>

          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20" data-testid="card-capabilities-info">
            <p className="text-sm text-slate-300">
              These capabilities run natively on Atlas API 2.0 — no LLM required.
              Every action is deterministic, session-native, and reproducible.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {nativeCapabilities.map((cap, i) => (
              <MotionDiv
                key={cap.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                data-testid={`card-capability-${cap.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <cap.icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm" data-testid={`text-capability-name-${cap.id}`}>{cap.name}</div>
                    <div className="text-slate-400 text-xs mt-1" data-testid={`text-capability-desc-${cap.id}`}>{cap.desc}</div>
                  </div>
                </div>
              </MotionDiv>
            ))}
          </div>
        </MotionDiv>
      );
    }

    const category = commandCategories[drilldown];
    if (!category) return null;

    return (
      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="absolute inset-0 bg-slate-900/98 backdrop-blur-xl z-20 p-4 overflow-auto"
        data-testid={`drilldown-${drilldown}`}
      >
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDrilldown(null)}
            className="text-white/60 hover:text-white hover:bg-white/10"
            data-testid={`button-back-${drilldown}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <category.icon className={`w-6 h-6 text-cyan-400`} />
          <h2 className="text-xl font-bold text-white" data-testid={`text-${drilldown}-title`}>{category.title}</h2>
        </div>

        {drilldown === 'llm' && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30" data-testid="card-open-beta-notice">
            <div className="flex items-start gap-2">
              <Radio className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-amber-400 font-medium text-sm">Open Beta</span>
                <p className="text-slate-400 text-xs mt-1">
                  These features require LLM integration and external services. Not all features may work as expected during the beta period.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {category.commands.map((cmd, i) => (
            <MotionDiv
              key={cmd.cmd}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              data-testid={`card-command-${drilldown}-${i}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-cyan-400 font-mono text-sm" data-testid={`text-command-${drilldown}-${i}`}>{cmd.cmd}</div>
                  <div className="text-slate-400 text-xs mt-1" data-testid={`text-command-desc-${drilldown}-${i}`}>{cmd.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  {cmd.status === 'live' && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full font-medium" data-testid={`badge-live-${drilldown}-${i}`}>LIVE</span>
                  )}
                  {cmd.status === 'beta' && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full font-medium" data-testid={`badge-beta-${drilldown}-${i}`}>BETA</span>
                  )}
                  <Terminal className="w-4 h-4 text-white/20" />
                </div>
              </div>
            </MotionDiv>
          ))}
        </div>
      </MotionDiv>
    );
  };

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-auto relative"
      data-testid="capability-mode"
    >
      {renderDrilldown()}

      <div className="p-4 space-y-6">
        {/* Header */}
        <MotionDiv
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
          data-testid="section-header"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 mb-4" data-testid="badge-atlas-commands">
            <Command className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-medium">Atlas Commands</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" data-testid="text-capability-title">
            What Atlas Can Do
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto" data-testid="text-capability-subtitle">
            Atlas is not an AI chatbot. It's a protocol-native agent built on deterministic commands and session transport.
          </p>
        </MotionDiv>

        {/* Clarification Block */}
        <MotionDiv
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-white/10"
          data-testid="card-clarification"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 flex-shrink-0">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm mb-1" data-testid="text-no-llm-title">No LLM Required</h3>
              <p className="text-slate-400 text-xs" data-testid="text-no-llm-desc">
                These commands operate natively on Atlas API 2.0. Every action is reproducible, 
                auditable, and executes without external AI dependencies.
              </p>
              <p className="text-slate-500 text-xs mt-2 italic" data-testid="text-cisco-reference">
                Built by a protocol architect with a Cisco Academy background.
              </p>
            </div>
          </div>
        </MotionDiv>

        {/* Command Categories Grid */}
        <div className="grid grid-cols-2 gap-3" data-testid="grid-command-categories">
          {Object.entries(commandCategories).map(([key, cat], i) => (
            <MotionDiv
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              onClick={() => setDrilldown(key as DrilldownType)}
              className={`p-4 rounded-xl bg-gradient-to-br ${cat.color}/10 border border-white/10 
                cursor-pointer hover:border-cyan-500/50 hover:scale-[1.02] transition-all active:scale-[0.98]`}
              data-testid={`card-${key}-commands`}
            >
              <cat.icon className="w-8 h-8 text-white/80 mb-3" />
              <h3 className="text-white font-semibold text-sm" data-testid={`text-${key}-title`}>{cat.title}</h3>
              <p className="text-slate-400 text-xs mt-1" data-testid={`text-${key}-count`}>{cat.commands.length} commands</p>
            </MotionDiv>
          ))}
        </div>

        {/* Capabilities Card */}
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          onClick={() => setDrilldown('capabilities')}
          className="p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 
            cursor-pointer hover:border-cyan-500/50 hover:scale-[1.01] transition-all active:scale-[0.99]"
          data-testid="card-native-capabilities"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/20">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold" data-testid="text-native-caps-title">Native Capabilities</h3>
              <p className="text-slate-400 text-xs mt-0.5" data-testid="text-native-caps-count">
                {nativeCapabilities.length} protocol-native features — no AI integration required
              </p>
            </div>
            <div className="text-cyan-400 text-xs font-medium" data-testid="text-tap-explore">Tap to explore</div>
          </div>
        </MotionDiv>

        {/* Quick Reference */}
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10"
          data-testid="card-quick-reference"
        >
          <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2" data-testid="text-quick-ref-title">
            <Terminal className="w-4 h-4 text-slate-400" />
            Quick Reference
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-white/5" data-testid="quickref-commands">
              <span className="text-cyan-400 font-mono">"Commands"</span>
              <span className="text-slate-500 ml-2">→ This card</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5" data-testid="quickref-pulse">
              <span className="text-cyan-400 font-mono">"Pulse"</span>
              <span className="text-slate-500 ml-2">→ Metrics</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5" data-testid="quickref-atlas-one">
              <span className="text-cyan-400 font-mono">"Atlas One"</span>
              <span className="text-slate-500 ml-2">→ Store</span>
            </div>
            <div className="p-2 rounded-lg bg-white/5" data-testid="quickref-game-deck">
              <span className="text-cyan-400 font-mono">"Game Deck"</span>
              <span className="text-slate-500 ml-2">→ Games</span>
            </div>
          </div>
        </MotionDiv>
      </div>
    </MotionDiv>
  );
}
