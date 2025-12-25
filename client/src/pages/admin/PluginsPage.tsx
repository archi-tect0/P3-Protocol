import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plug, Plus, Settings } from "lucide-react";
import AdminLayout from "./AdminLayout";

export default function PluginsPage() {
  const { toast } = useToast();
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<any>(null);

  const { data: plugins, isLoading } = useQuery<Array<{
    id: string;
    pluginId: string;
    name: string;
    version: string;
    description?: string;
    config?: any;
    status: string;
    installedBy: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/trust/plugins"],
  });

  const installPluginMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/trust/plugins", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trust/plugins"] });
      toast({ title: "Success", description: "Plugin installed successfully" });
      setIsInstallOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updatePluginMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/trust/plugins/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trust/plugins"] });
      toast({ title: "Success", description: "Plugin updated successfully" });
      setSelectedPlugin(null);
    },
  });

  const togglePlugin = (plugin: any) => {
    updatePluginMutation.mutate({
      id: plugin.id,
      data: { status: plugin.status === "enabled" ? "disabled" : "enabled" }
    });
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Plugin Registry
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Manage Trust Layer extensions and integrations
            </p>
          </div>
          <Button
            data-testid="button-install-plugin"
            onClick={() => setIsInstallOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Install Plugin
          </Button>
        </div>

        <Card data-testid="card-plugins-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Installed Plugins
            </CardTitle>
            <CardDescription>
              {plugins?.length || 0} plugins installed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Plugin ID</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plugins && plugins.length > 0 ? (
                    plugins.map((plugin) => (
                      <TableRow key={plugin.id} data-testid={`row-plugin-${plugin.id}`}>
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          {plugin.name}
                          {plugin.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {plugin.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {plugin.pluginId}
                          </code>
                        </TableCell>
                        <TableCell data-testid={`text-version-${plugin.id}`}>
                          v{plugin.version}
                        </TableCell>
                        <TableCell>
                          <Badge
                            data-testid={`badge-status-${plugin.id}`}
                            variant={plugin.status === "enabled" ? "default" : "secondary"}
                          >
                            {plugin.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-toggle-${plugin.id}`}
                              onClick={() => togglePlugin(plugin)}
                            >
                              {plugin.status === "enabled" ? "Disable" : "Enable"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-configure-${plugin.id}`}
                              onClick={() => setSelectedPlugin(plugin)}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 dark:text-slate-400">
                        No plugins installed yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <InstallPluginDialog
          open={isInstallOpen}
          onOpenChange={setIsInstallOpen}
          onSubmit={(data: any) => installPluginMutation.mutate(data)}
          isPending={installPluginMutation.isPending}
        />

        {selectedPlugin && (
          <ConfigurePluginDialog
            plugin={selectedPlugin}
            onClose={() => setSelectedPlugin(null)}
            onSubmit={(data: any) => updatePluginMutation.mutate({ id: selectedPlugin.id, data })}
            isPending={updatePluginMutation.isPending}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function InstallPluginDialog({ open, onOpenChange, onSubmit, isPending }: any) {
  const [pluginId, setPluginId] = useState("");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("");

  const handleSubmit = () => {
    onSubmit({
      pluginId,
      name,
      version,
      description,
      status: "enabled",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-install-plugin">
        <DialogHeader>
          <DialogTitle>Install Plugin</DialogTitle>
          <DialogDescription>
            Add a new plugin to the Trust Layer
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="plugin-id">Plugin ID</Label>
            <Input
              id="plugin-id"
              data-testid="input-plugin-id"
              value={pluginId}
              onChange={(e) => setPluginId(e.target.value)}
              placeholder="com.example.plugin"
            />
          </div>
          <div>
            <Label htmlFor="plugin-name">Name</Label>
            <Input
              id="plugin-name"
              data-testid="input-plugin-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Plugin"
            />
          </div>
          <div>
            <Label htmlFor="plugin-version">Version</Label>
            <Input
              id="plugin-version"
              data-testid="input-plugin-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
            />
          </div>
          <div>
            <Label htmlFor="plugin-description">Description</Label>
            <Textarea
              id="plugin-description"
              data-testid="textarea-plugin-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <Button
            data-testid="button-submit-plugin"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Installing..." : "Install Plugin"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfigurePluginDialog({ plugin, onClose, onSubmit, isPending }: any) {
  const [config, setConfig] = useState(
    plugin ? JSON.stringify(plugin.config || {}, null, 2) : "{}"
  );

  if (!plugin) return null;

  const handleSubmit = () => {
    try {
      onSubmit({ config: JSON.parse(config) });
    } catch (error) {
      alert("Invalid JSON configuration");
    }
  };

  return (
    <Dialog open={!!plugin} onOpenChange={() => onClose()}>
      <DialogContent data-testid="dialog-configure-plugin">
        <DialogHeader>
          <DialogTitle>Configure {plugin.name}</DialogTitle>
          <DialogDescription>
            Update plugin configuration (JSON format)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="plugin-config">Configuration (JSON)</Label>
            <Textarea
              id="plugin-config"
              data-testid="textarea-plugin-config"
              value={config}
              onChange={(e) => setConfig(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>
          <Button
            data-testid="button-save-config"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
