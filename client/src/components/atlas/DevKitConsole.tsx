import { useState, useCallback } from 'react';
import { useDevKitEndpoints, useDevKitApps, useDevKitFlows, useDevKitQuery } from '@/hooks/useDevKit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal, Search, Layers, Box, Workflow, Loader2, ChevronRight, AlertCircle } from 'lucide-react';

interface DevKitConsoleProps {
  className?: string;
}

export function DevKitConsole({ className }: DevKitConsoleProps) {
  const [queryInput, setQueryInput] = useState('');
  const [activeTab, setActiveTab] = useState('query');
  
  const { query, result, isLoading: isQuerying } = useDevKitQuery();
  const { data: endpointsData, isLoading: loadingEndpoints, error: endpointsError } = useDevKitEndpoints();
  const { data: appsData, isLoading: loadingApps, error: appsError } = useDevKitApps();
  const { data: flowsData, isLoading: loadingFlows, error: flowsError } = useDevKitFlows();
  
  const queryError = result && !result.ok ? result.data : null;

  const endpoints = endpointsData?.endpoints ?? [];
  const apps = appsData?.apps ?? [];
  const flows = flowsData?.flows ?? [];

  const handleQuery = useCallback(() => {
    if (queryInput.trim()) {
      query(queryInput.trim());
    }
  }, [query, queryInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  }, [handleQuery]);

  const renderError = (error: unknown) => {
    if (!error) return null;
    const message = error instanceof Error ? error.message : 'An error occurred';
    return (
      <div className="flex items-center gap-2 p-4 text-destructive bg-destructive/10 rounded-md" data-testid="error-message">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{message}</span>
      </div>
    );
  };

  return (
    <Card className={className} data-testid="devkit-console">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg" data-testid="devkit-console-title">
          <Terminal className="h-5 w-5" />
          Atlas DevKit Console
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="devkit-tabs">
          <TabsList className="grid w-full grid-cols-4" data-testid="devkit-tabs-list">
            <TabsTrigger value="query" data-testid="tab-trigger-query">
              <Search className="h-4 w-4 mr-1" />
              Query
            </TabsTrigger>
            <TabsTrigger value="endpoints" data-testid="tab-trigger-endpoints">
              <Layers className="h-4 w-4 mr-1" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="apps" data-testid="tab-trigger-apps">
              <Box className="h-4 w-4 mr-1" />
              Apps
            </TabsTrigger>
            <TabsTrigger value="flows" data-testid="tab-trigger-flows">
              <Workflow className="h-4 w-4 mr-1" />
              Flows
            </TabsTrigger>
          </TabsList>

          <TabsContent value="query" className="space-y-4" data-testid="tab-content-query">
            <div className="flex gap-2">
              <Input
                placeholder="Ask about endpoints, apps, or flows..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onKeyDown={handleKeyDown}
                data-testid="input-devkit-query"
              />
              <Button 
                onClick={handleQuery} 
                disabled={isQuerying || !queryInput.trim()}
                data-testid="button-devkit-query"
              >
                {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            
            {queryError && renderError(queryError)}
            
            {result && (
              <div className="h-64 rounded-md border p-4 bg-muted/50 overflow-auto" data-testid="devkit-query-result-container">
                <div className="font-mono text-sm" data-testid="devkit-query-result">
                  {typeof result === 'string' ? (
                    <pre className="whitespace-pre-wrap">{result}</pre>
                  ) : (
                    <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                  )}
                </div>
              </div>
            )}
            
            <div className="text-xs text-muted-foreground" data-testid="devkit-query-hints">
              Try: "show endpoints", "describe notes.create", "list apps"
            </div>
          </TabsContent>

          <TabsContent value="endpoints" data-testid="tab-content-endpoints">
            <div className="h-80 overflow-auto">
              {loadingEndpoints ? (
                <div className="flex items-center justify-center p-8" data-testid="endpoints-loading">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : endpointsError ? (
                renderError(endpointsError)
              ) : endpoints.length === 0 ? (
                <div className="text-center text-muted-foreground p-4" data-testid="endpoints-empty">
                  No endpoints available
                </div>
              ) : (
                <div className="space-y-2" data-testid="devkit-endpoints-list">
                  {endpoints.slice(0, 50).map((ep: any, i: number) => (
                    <div 
                      key={ep.key || i} 
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      data-testid={`endpoint-item-${ep.key || i}`}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <code className="text-sm font-mono" data-testid={`endpoint-key-${ep.key || i}`}>{ep.key}</code>
                      <Badge variant="outline" className="text-xs" data-testid={`endpoint-app-${ep.key || i}`}>{ep.app}</Badge>
                    </div>
                  ))}
                  {endpoints.length > 50 && (
                    <div className="text-sm text-muted-foreground p-2" data-testid="endpoints-more">
                      ...and {endpoints.length - 50} more endpoints
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="apps" data-testid="tab-content-apps">
            <div className="h-80 overflow-auto">
              {loadingApps ? (
                <div className="flex items-center justify-center p-8" data-testid="apps-loading">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : appsError ? (
                renderError(appsError)
              ) : apps.length === 0 ? (
                <div className="text-center text-muted-foreground p-4" data-testid="apps-empty">
                  No apps registered
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2" data-testid="devkit-apps-list">
                  {apps.map((app: any, i: number) => (
                    <Card key={app.id || i} className="p-3" data-testid={`app-card-${app.id || i}`}>
                      <div className="font-medium" data-testid={`app-name-${app.id || i}`}>{app.name || app.id}</div>
                      <div className="text-xs text-muted-foreground" data-testid={`app-version-${app.id || i}`}>v{app.version || '1.0'}</div>
                      {app.permissions && app.permissions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2" data-testid={`app-permissions-${app.id || i}`}>
                          {app.permissions.slice(0, 3).map((p: string, pi: number) => (
                            <Badge key={p} variant="secondary" className="text-xs" data-testid={`app-permission-${app.id || i}-${pi}`}>{p}</Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="flows" data-testid="tab-content-flows">
            <div className="h-80 overflow-auto">
              {loadingFlows ? (
                <div className="flex items-center justify-center p-8" data-testid="flows-loading">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : flowsError ? (
                renderError(flowsError)
              ) : flows.length === 0 ? (
                <div className="text-center text-muted-foreground p-4" data-testid="flows-empty">
                  No compound flows defined yet
                </div>
              ) : (
                <div className="space-y-2" data-testid="devkit-flows-list">
                  {flows.map((flow: any, i: number) => (
                    <Card key={flow.id || i} className="p-3" data-testid={`flow-card-${flow.id || i}`}>
                      <div className="font-medium" data-testid={`flow-name-${flow.id || i}`}>{flow.name || flow.id}</div>
                      <div className="text-sm text-muted-foreground" data-testid={`flow-desc-${flow.id || i}`}>{flow.description}</div>
                      {flow.steps && flow.steps.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1" data-testid={`flow-steps-${flow.id || i}`}>
                          {flow.steps.length} steps
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default DevKitConsole;
