import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Play, 
  Loader2, 
  BookOpen,
  Shield,
  Check,
  AlertCircle
} from 'lucide-react';

interface Session {
  wallet: string;
  grants: string[];
  roles: string[];
  expiresAt: number;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  steps: Array<{ key: string; args: Record<string, any> }>;
  requiredScopes: string[];
  roles: string[];
}

export default function RecipesTab({ session }: { session: Session }) {
  const { toast } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, 'success' | 'error'>>({});

  useEffect(() => {
    fetchRecipes();
  }, [session.roles]);

  async function fetchRecipes() {
    setLoading(true);
    try {
      const role = session.roles.includes('admin') ? 'admin' 
        : session.roles.includes('moderator') ? 'moderator' 
        : 'user';
      
      const response = await fetch(`/api/atlas/recipes?role=${role}`);
      const data = await response.json();
      
      if (data.ok) {
        setRecipes(data.recipes || []);
      }
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runRecipe(recipe: Recipe) {
    setRunningId(recipe.id);
    try {
      const response = await fetch('/api/atlas/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoints: recipe.steps,
          session,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        const allSuccess = data.receipts?.every((r: any) => r.status === 'ok');
        setResults(prev => ({ ...prev, [recipe.id]: allSuccess ? 'success' : 'error' }));
        toast({ 
          title: allSuccess ? 'Recipe completed' : 'Recipe partially completed',
          description: `${data.receipts?.length || 0} steps executed`,
        });
      } else {
        setResults(prev => ({ ...prev, [recipe.id]: 'error' }));
        toast({ title: 'Recipe failed', description: data.error, variant: 'destructive' });
      }
    } catch (err) {
      console.error('Recipe execution failed:', err);
      setResults(prev => ({ ...prev, [recipe.id]: 'error' }));
      toast({ title: 'Recipe failed', variant: 'destructive' });
    } finally {
      setRunningId(null);
    }
  }

  function canRunRecipe(recipe: Recipe): boolean {
    const hasRole = recipe.roles.some(r => session.roles.includes(r));
    const hasScopes = recipe.requiredScopes.every(s => session.grants.includes(s));
    return hasRole && hasScopes;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recipes</h2>
        <Badge variant="outline" className="border-purple-500/30 text-purple-300">
          {recipes.length} available
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
              <BookOpen className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">No recipes available</p>
            <p className="text-slate-500 text-xs">Recipes for your role will appear here</p>
          </div>
        ) : (
          recipes.map(recipe => {
            const canRun = canRunRecipe(recipe);
            const isRunning = runningId === recipe.id;
            const result = results[recipe.id];
            
            return (
              <div
                key={recipe.id}
                data-testid={`recipe-${recipe.id}`}
                className="glass-panel rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-white">{recipe.title}</h3>
                      {result === 'success' && <Check className="w-4 h-4 text-emerald-400" />}
                      {result === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                    </div>
                    <p className="text-sm text-slate-400">{recipe.description}</p>
                  </div>
                  <Button
                    data-testid={`run-recipe-${recipe.id}`}
                    size="sm"
                    onClick={() => runRecipe(recipe)}
                    disabled={!canRun || isRunning}
                    className={canRun 
                      ? 'bg-purple-600 hover:bg-purple-500' 
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {recipe.steps.map((step, i) => (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-xs border-white/10 text-slate-400"
                    >
                      {i + 1}. {step.key}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {recipe.roles.map(role => (
                    <Badge 
                      key={role}
                      className={`text-xs ${
                        role === 'admin' 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : role === 'moderator'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      {role}
                    </Badge>
                  ))}
                  {recipe.requiredScopes.map(scope => (
                    <Badge 
                      key={scope}
                      variant="outline"
                      className="text-xs border-purple-500/30 text-purple-300"
                    >
                      {scope}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{`
        .glass-panel {
          background: rgba(30, 30, 30, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </div>
  );
}
