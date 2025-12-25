import { useState } from 'react';
import { useAtlasStore, type CanvasRenderable } from '@/state/useAtlasStore';
import { MotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cloud, 
  Zap, 
  Globe, 
  Lock, 
  Loader2, 
  RefreshCw,
  Table2,
  LayoutGrid
} from 'lucide-react';

interface ExecuteResult {
  ok: boolean;
  result?: any;
  error?: string;
}

function CanvasCard({ renderable, onExecute }: { renderable: CanvasRenderable; onExecute: (key: string) => void }) {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      const response = await fetch('/api/atlas/canvas/execute/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: renderable.key }),
      });
      const data = await response.json();
      setResult(data);
      onExecute(renderable.key);
    } catch (err) {
      setResult({ ok: false, error: 'Execution failed' });
    } finally {
      setExecuting(false);
    }
  };

  const visibilityIcon = renderable.visibility === 'public' ? Globe : Lock;
  const VisIcon = visibilityIcon;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
      data-testid={`canvas-card-${renderable.key}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
            {renderable.display.type === 'table' ? (
              <Table2 className="w-4 h-4 text-purple-400" />
            ) : (
              <LayoutGrid className="w-4 h-4 text-purple-400" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">{renderable.display.title}</h3>
            {renderable.display.subtitle && (
              <p className="text-xs text-slate-400">{renderable.display.subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px] border-white/20 text-slate-400">
            <VisIcon className="w-3 h-3 mr-1" />
            {renderable.visibility}
          </Badge>
        </div>
      </div>

      {renderable.display.fields && renderable.display.fields.length > 0 && (
        <div className="mb-3 space-y-1">
          {renderable.display.fields.slice(0, 4).map((field) => (
            <div key={field.key} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{field.label}</span>
              <span className="text-slate-400">{field.format || 'text'}</span>
            </div>
          ))}
        </div>
      )}

      {result && (
        <div className={`mb-3 p-2 rounded-lg text-xs ${result.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {result.ok ? (
            <pre className="overflow-x-auto max-h-24">
              {JSON.stringify(result.result, null, 2).slice(0, 200)}
              {JSON.stringify(result.result).length > 200 && '...'}
            </pre>
          ) : (
            <span>{result.error}</span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleExecute}
          disabled={executing}
          className="flex-1 text-xs border-white/20 hover:bg-white/10"
          data-testid={`execute-${renderable.key}`}
        >
          {executing ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Zap className="w-3 h-3 mr-1" />
          )}
          Execute
        </Button>
        {renderable.display.actions?.map((action, i) => (
          <Button
            key={i}
            size="sm"
            variant="ghost"
            className="text-xs text-slate-400 hover:text-white"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </MotionDiv>
  );
}

export default function RegistryMode() {
  const { renderables, pushReceipt } = useAtlasStore();
  const [filter, setFilter] = useState<'all' | 'public' | 'endpoint' | 'flow'>('all');
  const [loading, setLoading] = useState(false);

  const filteredRenderables = renderables.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'public') return r.visibility === 'public';
    if (filter === 'endpoint') return r.type === 'endpoint';
    if (filter === 'flow') return r.type === 'flow';
    return true;
  });

  const handleExecute = (key: string) => {
    pushReceipt({
      id: `exec-${Date.now()}`,
      hash: key.slice(0, 8),
      scope: 'canvas',
      endpoint: key,
      timestamp: Date.now(),
    });
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/atlas/canvas/renderables');
      const data = await response.json();
      if (data.ok && data.renderables) {
        useAtlasStore.getState().setRenderables(data.renderables);
      }
    } catch (err) {
      console.error('Failed to refresh renderables:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full" data-testid="registry-mode">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Canvas Registry</h2>
          <p className="text-sm text-slate-400">{renderables.length} endpoints available</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 rounded-lg p-1">
            {(['all', 'public', 'endpoint', 'flow'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  filter === f ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:text-white'
                }`}
                data-testid={`filter-${f}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="border-white/20"
            data-testid="refresh-registry"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {filteredRenderables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Cloud className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Endpoints Found</h3>
          <p className="text-sm text-slate-400 max-w-md">
            Register endpoints via manifests or connect apps to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRenderables.map((renderable) => (
            <CanvasCard
              key={renderable.key}
              renderable={renderable}
              onExecute={handleExecute}
            />
          ))}
        </div>
      )}
    </div>
  );
}
