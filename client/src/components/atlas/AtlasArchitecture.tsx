import { useState } from 'react';
import { MotionDiv } from '@/lib/motion';
import { 
  Cpu, Layers, Eye, Receipt, 
  Fingerprint, Link2, Brain, Zap, Globe,
  ChevronDown, ChevronUp, Lock, Smartphone,
  Mic, Network, Database
} from 'lucide-react';

interface PillarProps {
  icon: typeof Cpu;
  title: string;
  subtitle: string;
  content: string[];
  color: string;
  defaultOpen?: boolean;
}

function Pillar({ icon: Icon, title, subtitle, content, color, defaultOpen = false }: PillarProps) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <MotionDiv
      className={`rounded-xl border transition-all ${open ? 'bg-white/8 border-white/20' : 'bg-white/5 border-white/10'}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 flex items-center gap-4 text-left"
        data-testid={`pillar-${title.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white/90 truncate">{title}</h3>
          <p className="text-sm text-white/50 truncate">{subtitle}</p>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" />
        )}
      </button>
      
      {open && (
        <MotionDiv
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="px-4 pb-4"
        >
          <div className="pt-2 border-t border-white/10 space-y-2">
            {content.map((line, i) => (
              <p key={i} className="text-sm text-white/60 leading-relaxed">{line}</p>
            ))}
          </div>
        </MotionDiv>
      )}
    </MotionDiv>
  );
}

export default function AtlasArchitecture() {
  const pillars: PillarProps[] = [
    {
      icon: Cpu,
      title: 'Substrate, Not Chatbot',
      subtitle: 'Execution layer with semantic orchestration',
      color: 'bg-cyan-400/20 text-cyan-400',
      defaultOpen: true,
      content: [
        "Atlas is not a chatbot. It's an execution layer.",
        "LLMs parse intent and narrate outcomes. Atlas runs the flows, enforces governance, and anchors identity.",
        "The separation is clean: semantic interpretation vs deterministic execution. No hallucination risk because Atlas only runs real endpoints."
      ]
    },
    {
      icon: Layers,
      title: 'Canvas Auto-Materialization',
      subtitle: 'UI from manifests, not code',
      color: 'bg-purple-400/20 text-purple-400',
      content: [
        "No frontend code per integration. Register an endpoint with metadata and Canvas renders the UI.",
        "Manifests define canvas.display properties. Cards materialize automatically based on type (data, reasoning, pipeline, error).",
        "This inverts the typical pattern: developers describe what something is, Canvas figures out how to show it."
      ]
    },
    {
      icon: Fingerprint,
      title: 'Wallet-Anchored Identity',
      subtitle: 'atlas.User as the identity primitive',
      color: 'bg-amber-400/20 text-amber-400',
      content: [
        "No email, no PII. Just atlas.User bound to a wallet address.",
        "Every session, receipt, and card ties to a cryptographic identity. One anchor, infinite contexts.",
        "The security model is simpler because the identity model is simpler. Governance enforcement is native, not bolted on."
      ]
    },
    {
      icon: Zap,
      title: 'Intent → Execute → Narrate',
      subtitle: 'The orchestration loop',
      color: 'bg-green-400/20 text-green-400',
      content: [
        "User Intent → LLM Parse → Atlas Execute → LLM Narrate",
        "LLMs interpret what you mean. Atlas actually runs the flows. Canvas shows both the raw data and the reasoned interpretation.",
        "This is production-sensible: LLMs are good at understanding, bad at reliable execution. Atlas handles what LLMs can't do."
      ]
    },
    {
      icon: Receipt,
      title: 'Receipts as First-Class',
      subtitle: 'Auditability by default',
      color: 'bg-blue-400/20 text-blue-400',
      content: [
        "Every action emits a receipt: LLM calls (atlas_llm), card materializations (atlas_materialize).",
        "Receipts are wallet-anchored and blockchain-anchorable. Creates an auditable trail of what happened and why.",
        "Observability isn't optional—it's the foundation. Every flow execution produces verifiable proof."
      ]
    },
    {
      icon: Eye,
      title: 'Dual Auto-Materialization',
      subtitle: 'Identity and flows both visualize',
      color: 'bg-rose-400/20 text-rose-400',
      content: [
        "Atlas materializes two things: Identity → face visualization, Flows → cards and pipelines.",
        "13 face themes (Line, Globe, Constellation, Liquid Tile, etc.) react to voice and listening state.",
        "Users tell Atlas what to look like. Developers register endpoints. Canvas renders both."
      ]
    },
    {
      icon: Link2,
      title: 'Session Bridge + Hub Apps',
      subtitle: 'Installed apps, queryable endpoints',
      color: 'bg-indigo-400/20 text-indigo-400',
      content: [
        "Users install apps from the Hub. Atlas knows what's installed via the session bridge.",
        "It can query endpoints directly—even headless apps. Single WalletConnect session shared across all Canvas modes.",
        "LLMs interpret the data. Canvas shows both raw and reasoned views."
      ]
    },
    {
      icon: Brain,
      title: 'LLMs as Reasoning Modules',
      subtitle: 'Orchestrated, not autonomous',
      color: 'bg-violet-400/20 text-violet-400',
      content: [
        "Atlas isn't replaced by LLMs—it orchestrates them. OpenAI, Anthropic, Gemini are plug-in reasoning engines.",
        "Atlas routes queries, enforces policy, and materializes outputs. Canvas shows provenance: source, model, tokens, receipts.",
        "Server-side execution with vault-stored API keys. Session validation before all provider invocations."
      ]
    },
    {
      icon: Lock,
      title: 'Encryption Stack',
      subtitle: 'E2E encrypted, post-quantum roadmap',
      color: 'bg-emerald-400/20 text-emerald-400',
      content: [
        "TweetNaCl for symmetric/asymmetric encryption (X25519 + XSalsa20-Poly1305).",
        "AES-256-GCM for vault credential storage with PBKDF2 key derivation (120k iterations).",
        "Kyber post-quantum hybrid on roadmap (schema ready, endpoints stubbed). Zero-PII by design."
      ]
    },
    {
      icon: Smartphone,
      title: 'Runs Anywhere',
      subtitle: 'PWA, offline-first, multi-surface',
      color: 'bg-orange-400/20 text-orange-400',
      content: [
        "Unified Canvas with 7 Nexus-powered modes. Single WalletConnect session shared across all modes.",
        "Service Worker v2 for offline-first. Install on any device with a browser.",
        "Same manifest → card on phone, widget on desktop, voice response on Alexa. Multi-surface materialization from manifests."
      ]
    }
  ];

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="atlas-architecture"
    >
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400/20 to-purple-400/20">
            <Network className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-light text-white/80">Atlas Architecture</h2>
        </div>
        <p className="text-sm text-white/40">
          Substrate operating system for the P3 Protocol mesh
        </p>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-400/10 to-purple-400/10 border border-cyan-400/20 mb-6">
        <div className="flex items-start gap-3">
          <Mic className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-white/70 leading-relaxed">
              Atlas is infrastructure that treats identity, execution, and visibility as the same problem.
              Wallet anchors identity. Flows anchor execution. Canvas anchors visibility. Receipts anchor proof.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-white/50 text-sm">
        <Database className="w-4 h-4" />
        <span>10 Core Pillars</span>
      </div>

      <div className="space-y-3">
        {pillars.map((pillar, index) => (
          <MotionDiv
            key={pillar.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Pillar {...pillar} />
          </MotionDiv>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="w-4 h-4 text-white/40" />
          <span className="text-xs text-white/60 font-medium">Current Status</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-medium text-cyan-400">70+</div>
            <div className="text-xs text-white/40">Endpoints</div>
          </div>
          <div>
            <div className="text-lg font-medium text-purple-400">10</div>
            <div className="text-xs text-white/40">Flows</div>
          </div>
          <div>
            <div className="text-lg font-medium text-amber-400">13</div>
            <div className="text-xs text-white/40">Face Themes</div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-white/30 text-center">
        Version 2.0 · November 2025
      </div>
    </MotionDiv>
  );
}
