import { Link } from "wouter";
import { GitBranch, Code2, Zap, ChevronRight } from "lucide-react";

const projects = [
  {
    id: 'bridge',
    name: 'P3 Protocol Bridge',
    description: 'Unified wallet connection layer for modular crypto apps. Connect once, cache securely.',
    icon: GitBranch,
    version: 'v1.0',
    tags: ['Wallet', 'WalletConnect', 'Crypto'],
    status: 'Stable',
    href: '/apache/bridge'
  },
  {
    id: 'forthcoming-1',
    name: 'Coming Soon: P3 Messaging SDK',
    description: 'End-to-end encrypted messaging with cryptographic proof anchoring.',
    icon: Code2,
    version: 'v0.1 (Preview)',
    tags: ['E2EE', 'Messaging', 'Crypto'],
    status: 'In Development',
    disabled: true
  },
  {
    id: 'forthcoming-2',
    name: 'Coming Soon: Trust Layer',
    description: 'Smart rules engine for consent-based access control and governance.',
    icon: Zap,
    version: 'v0.1 (Preview)',
    tags: ['Smart Contracts', 'Governance', 'Security'],
    status: 'In Development',
    disabled: true
  }
];

export default function ApacheHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold text-2xl">P3</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                Apache Projects
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Open source SDKs & modules for the P3 Protocol
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Available Projects
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            Choose an open source module to explore its documentation, source code, and integration guide.
          </p>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const Icon = project.icon;
            const isDisabled = project.disabled;

            return (
              <div
                key={project.id}
                className={`
                  rounded-lg border transition-all
                  ${isDisabled
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 opacity-60'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-lg'
                  }
                `}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`
                      w-12 h-12 rounded-lg flex items-center justify-center
                      ${isDisabled
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      }
                    `}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`
                        text-xs font-semibold px-2 py-1 rounded
                        ${isDisabled
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        }
                      `}>
                        {project.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                    {project.name}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {project.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {project.version}
                    </span>
                    {isDisabled ? (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Coming soon
                      </span>
                    ) : project.href ? (
                      <Link href={project.href}>
                        <a className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition">
                          <span className="text-sm font-medium">Explore</span>
                          <ChevronRight className="w-4 h-4" />
                        </a>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">🔑</div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Open Source</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All modules are released under Apache 2.0 license. Use freely in your projects.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">🔗</div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Developer Ready</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Every SDK includes real blockchain integration. Security audits in progress.
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">📦</div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Easy Integration</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              npm install and start building. Complete documentation and examples included.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
