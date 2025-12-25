import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Code2, 
  Zap, 
  ArrowRight, 
  Package, 
  Terminal,
  BookOpen,
  Shield,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2
} from 'lucide-react';
import { loadRegistry, type Registry, type EndpointMeta } from '@/lib/sdk/registry';
import { Launcher, createSession, type CallResult } from '@/lib/sdk';
import { useToast } from '@/hooks/use-toast';

interface DiscoveryProps {
  walletAddress?: string;
  onNavigate?: (href: string) => void;
}

export default function Discovery({ walletAddress, onNavigate }: DiscoveryProps) {
  const { toast } = useToast();
  const [registry, setRegistry] = useState<Registry | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'endpoints' | 'routes' | 'apps'>('endpoints');
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [launcher, setLauncher] = useState<Launcher | null>(null);
  const [testResults, setTestResults] = useState<Record<string, CallResult>>({});
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);

  useEffect(() => {
    loadRegistry()
      .then(setRegistry)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (walletAddress) {
      const session = createSession(walletAddress, ['wallet']);
      const l = new Launcher(session, {
        onScopeRequest: async (missing) => {
          toast({
            title: 'Permission Request',
            description: `Granting scopes: ${missing.join(', ')}`,
          });
          return true;
        },
        onNavigate: (href) => {
          if (onNavigate) {
            onNavigate(href);
          } else {
            window.location.href = href;
          }
        },
      });
      setLauncher(l);
    }
  }, [walletAddress, onNavigate, toast]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestCall = useCallback(async (key: string, ep: EndpointMeta) => {
    if (!launcher) {
      toast({
        variant: 'destructive',
        title: 'Not Connected',
        description: 'Connect your wallet to test endpoints',
      });
      return;
    }

    setTestingEndpoint(key);
    
    try {
      const testArgs: Record<string, unknown> = {};
      Object.entries(ep.args).forEach(([argName, argType]) => {
        if (argType === 'string') testArgs[argName] = `test_${argName}`;
        else if (argType === 'number') testArgs[argName] = 10;
        else if (argType === 'boolean') testArgs[argName] = false;
        else if (argType === 'string[]') testArgs[argName] = [];
        else if (argType === 'object') testArgs[argName] = {};
      });

      const result = await launcher.call(key, testArgs);
      setTestResults(prev => ({ ...prev, [key]: result }));

      if (result.success) {
        toast({
          title: 'Call Successful',
          description: `${key} returned data from ${result.app}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Call Failed',
          description: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Call Error',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setTestingEndpoint(null);
    }
  }, [launcher, toast]);

  const handleOpenRoute = (href: string) => {
    if (onNavigate) {
      onNavigate(href);
    } else {
      window.location.href = href;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!registry) {
    return (
      <Card className="p-8 text-center bg-[#1a1a1a]/80 border-white/5">
        <Code2 className="w-12 h-12 mx-auto mb-4 text-slate-500" />
        <h3 className="text-lg font-medium text-white mb-2">Registry Unavailable</h3>
        <p className="text-sm text-slate-400">Could not load the API registry.</p>
      </Card>
    );
  }

  const filteredEndpoints = Object.entries(registry.endpoints).filter(([key]) =>
    key.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredRoutes = Object.entries(registry.routes).filter(([key]) =>
    key.toLowerCase().includes(filter.toLowerCase())
  );

  const filteredApps = Object.entries(registry.apps).filter(([, app]) =>
    app.name.toLowerCase().includes(filter.toLowerCase()) ||
    app.id.toLowerCase().includes(filter.toLowerCase())
  );

  const tabs = [
    { id: 'endpoints' as const, label: 'Endpoints', count: Object.keys(registry.endpoints).length, icon: Terminal },
    { id: 'routes' as const, label: 'Routes', count: Object.keys(registry.routes).length, icon: ArrowRight },
    { id: 'apps' as const, label: 'Apps', count: Object.keys(registry.apps).length, icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            API Registry
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Discover and test programmable endpoints
          </p>
        </div>
        <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-0">
          v{registry.version}
        </Badge>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          data-testid="input-filter-registry"
          placeholder="Filter endpoints, routes, or apps..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9 bg-[#252525] border-white/5 text-white placeholder:text-slate-500"
        />
      </div>

      <div className="flex gap-2 border-b border-white/5 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600/20 text-purple-300'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-white/10">{tab.count}</span>
          </button>
        ))}
      </div>

      {activeTab === 'endpoints' && (
        <div className="space-y-3">
          {filteredEndpoints.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No endpoints match your filter</p>
          ) : (
            filteredEndpoints.map(([key, ep]) => (
              <Card
                key={key}
                data-testid={`endpoint-${key}`}
                className="bg-[#1a1a1a]/80 border-white/5 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedEndpoint(expandedEndpoint === key ? null : key)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-white">{key}</span>
                        <Badge className="text-[10px] bg-slate-700/50 text-slate-300 border-0">
                          v{ep.version}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{ep.description || `Calls ${ep.fn}()`}</p>
                    </div>
                  </div>
                  {expandedEndpoint === key ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {expandedEndpoint === key && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/5">
                    <div className="grid gap-4 mt-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">App</p>
                        <p className="text-sm text-white font-mono">{ep.app}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Function</p>
                        <p className="text-sm text-white font-mono">{ep.fn}()</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Arguments</p>
                        <pre className="text-xs text-slate-300 bg-black/30 rounded p-2 overflow-x-auto">
                          {JSON.stringify(ep.args, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Required Scopes</p>
                        <div className="flex flex-wrap gap-1">
                          {ep.scopes.map((scope) => (
                            <Badge key={scope} className="bg-amber-500/20 text-amber-300 border-0 text-xs">
                              <Shield className="w-3 h-3 mr-1" />
                              {scope}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {testResults[key] && (
                        <div className="mt-3 p-2 rounded bg-black/30">
                          <p className="text-xs text-slate-500 mb-1">Last Result</p>
                          <pre className="text-xs text-slate-300 overflow-x-auto max-h-24">
                            {JSON.stringify(testResults[key], null, 2)}
                          </pre>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(`await L.call('${key}', {})`, key)}
                          className="border-white/10 text-slate-300 hover:bg-white/5"
                          data-testid={`copy-${key}`}
                        >
                          {copiedKey === key ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          Copy Call
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleTestCall(key, ep)}
                          disabled={testingEndpoint === key || !walletAddress}
                          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50"
                          data-testid={`test-${key}`}
                        >
                          {testingEndpoint === key ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Terminal className="w-3 h-3 mr-1" />
                          )}
                          {testingEndpoint === key ? 'Testing...' : 'Test'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'routes' && (
        <div className="space-y-3">
          {filteredRoutes.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No routes match your filter</p>
          ) : (
            filteredRoutes.map(([key, route]) => (
              <Card
                key={key}
                data-testid={`route-${key}`}
                className="bg-[#1a1a1a]/80 border-white/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                      <ArrowRight className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <span className="font-mono text-sm text-white">{key}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{route.title || route.href}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-slate-700/50 text-slate-300 border-0 text-xs">
                      {route.app}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenRoute(route.href)}
                      className="border-white/10 text-slate-300 hover:bg-white/5"
                      data-testid={`open-${key}`}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'apps' && (
        <div className="grid gap-3 sm:grid-cols-2">
          {filteredApps.length === 0 ? (
            <p className="text-center text-slate-500 py-8 col-span-2">No apps match your filter</p>
          ) : (
            filteredApps.map(([, app]) => (
              <Card
                key={app.id}
                data-testid={`app-${app.id}`}
                className="bg-[#1a1a1a]/80 border-white/5 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                    {app.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{app.name}</h3>
                      <Badge className="text-[10px] bg-slate-700/50 text-slate-300 border-0">
                        v{app.version}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{app.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {app.permissions.slice(0, 3).map((perm) => (
                        <Badge key={perm} className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px]">
                          {perm}
                        </Badge>
                      ))}
                      {app.permissions.length > 3 && (
                        <Badge className="bg-slate-600/50 text-slate-400 border-0 text-[10px]">
                          +{app.permissions.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenRoute(app.entry)}
                    className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
                    data-testid={`launch-${app.id}`}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Launch
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    data-testid={`docs-${app.id}`}
                  >
                    <BookOpen className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Card className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border-purple-500/20 p-4">
        <div className="flex items-start gap-3">
          <Code2 className="w-5 h-5 text-purple-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-white text-sm">Developer Quick Start</h4>
            <pre className="text-xs text-slate-300 bg-black/30 rounded p-3 mt-2 overflow-x-auto">
{`import { Launcher, createSession } from '@p3/sdk';

const session = createSession('${walletAddress || '0x...'}');
const L = new Launcher(session);

// Discover available endpoints
const endpoints = await L.discover('messages');

// Call an endpoint
const result = await L.call('messages.compose', {
  to: '0x...',
  body: 'Hello, encrypted world!'
});`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
