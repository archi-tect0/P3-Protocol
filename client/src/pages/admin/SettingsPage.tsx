import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, Anchor, Lock, Puzzle, BookOpen, Shield } from "lucide-react";
import AdminLayout from "./AdminLayout";
import QuarantineManager from "@/components/admin/QuarantineManager";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
      <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  const { data: configs, isLoading } = useQuery<Array<{
    id: string;
    key: string;
    value: any;
    version: number;
    createdBy: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/trust/config"],
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: { key: string; value: any }) => {
      return await apiRequest("/api/trust/config", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trust/config"] });
      toast({ title: "Success", description: "Configuration updated successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleSaveConfig = (key: string, value: string) => {
    try {
      const parsedValue = JSON.parse(value);
      updateConfigMutation.mutate({ key, value: parsedValue });
    } catch {
      updateConfigMutation.mutate({ key, value });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            System Settings
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Configure Trust Layer system parameters
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-settings">
            <TabsTrigger value="general" data-testid="tab-general">
              <Settings className="w-4 h-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="anchoring" data-testid="tab-anchoring">
              <Anchor className="w-4 h-4 mr-2" />
              Anchoring
            </TabsTrigger>
            <TabsTrigger value="privacy" data-testid="tab-privacy">
              <Lock className="w-4 h-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger value="integrations" data-testid="tab-integrations">
              <Puzzle className="w-4 h-4 mr-2" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="ledger" data-testid="tab-ledger">
              <BookOpen className="w-4 h-4 mr-2" />
              Ledger
            </TabsTrigger>
            <TabsTrigger value="security" data-testid="tab-security">
              <Shield className="w-4 h-4 mr-2" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" data-testid="content-general">
            <Card>
              <CardHeader>
                <CardTitle>General Configuration</CardTitle>
                <CardDescription>
                  Basic system settings and parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <GeneralSettings 
                    configs={configs} 
                    onSave={handleSaveConfig}
                    isPending={updateConfigMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anchoring" data-testid="content-anchoring">
            <Card>
              <CardHeader>
                <CardTitle>Blockchain Anchoring</CardTitle>
                <CardDescription>
                  Configure on-chain anchoring settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <AnchoringSettings 
                    configs={configs}
                    onSave={handleSaveConfig}
                    isPending={updateConfigMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" data-testid="content-privacy">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>
                  Manage data protection and privacy controls
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <PrivacySettings 
                    configs={configs}
                    onSave={handleSaveConfig}
                    isPending={updateConfigMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" data-testid="content-integrations">
            <Card>
              <CardHeader>
                <CardTitle>External Integrations</CardTitle>
                <CardDescription>
                  Configure third-party service connections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <IntegrationSettings 
                    configs={configs}
                    onSave={handleSaveConfig}
                    isPending={updateConfigMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger" data-testid="content-ledger">
            <Card>
              <CardHeader>
                <CardTitle>Ledger Configuration</CardTitle>
                <CardDescription>
                  Transaction and accounting settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <LoadingSkeleton />
                ) : (
                  <LedgerSettings 
                    configs={configs}
                    onSave={handleSaveConfig}
                    isPending={updateConfigMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" data-testid="content-security">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Management</CardTitle>
                  <CardDescription>
                    Manage quarantined events and security settings
                  </CardDescription>
                </CardHeader>
              </Card>
              <QuarantineManager />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function GeneralSettings({ onSave, isPending }: { configs?: unknown; onSave: (key: string, value: string) => void; isPending: boolean }) {
  const [systemName, setSystemName] = useState("Trust Layer");
  const [maxConcurrent, setMaxConcurrent] = useState("100");

  return (
    <>
      <div>
        <Label htmlFor="system-name">System Name</Label>
        <Input
          id="system-name"
          data-testid="input-system-name"
          value={systemName}
          onChange={(e) => setSystemName(e.target.value)}
          placeholder="Enter system name"
        />
      </div>
      <div>
        <Label htmlFor="max-concurrent">Max Concurrent Connections</Label>
        <Input
          id="max-concurrent"
          data-testid="input-max-concurrent"
          type="number"
          value={maxConcurrent}
          onChange={(e) => setMaxConcurrent(e.target.value)}
          placeholder="100"
        />
      </div>
      <Button
        data-testid="button-save-general"
        onClick={() => {
          onSave("system.name", systemName);
          onSave("system.maxConcurrent", maxConcurrent);
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );
}

function AnchoringSettings({ onSave, isPending }: { configs?: unknown; onSave: (key: string, value: string) => void; isPending: boolean }) {
  const [chainId, setChainId] = useState("1");
  const [anchorInterval, setAnchorInterval] = useState("3600");

  return (
    <>
      <div>
        <Label htmlFor="chain-id">Chain ID</Label>
        <Input
          id="chain-id"
          data-testid="input-chain-id"
          value={chainId}
          onChange={(e) => setChainId(e.target.value)}
          placeholder="1"
        />
      </div>
      <div>
        <Label htmlFor="anchor-interval">Anchor Interval (seconds)</Label>
        <Input
          id="anchor-interval"
          data-testid="input-anchor-interval"
          type="number"
          value={anchorInterval}
          onChange={(e) => setAnchorInterval(e.target.value)}
          placeholder="3600"
        />
      </div>
      <Button
        data-testid="button-save-anchoring"
        onClick={() => {
          onSave("anchoring.chainId", chainId);
          onSave("anchoring.interval", anchorInterval);
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );
}

function PrivacySettings({ onSave, isPending }: { configs?: unknown; onSave: (key: string, value: string) => void; isPending: boolean }) {
  const [hashSalt, setHashSalt] = useState("");
  const [dataRetention, setDataRetention] = useState("90");

  return (
    <>
      <div>
        <Label htmlFor="hash-salt">Hash Salt (leave empty to auto-generate)</Label>
        <Input
          id="hash-salt"
          data-testid="input-hash-salt"
          type="password"
          value={hashSalt}
          onChange={(e) => setHashSalt(e.target.value)}
          placeholder="Auto-generated"
        />
      </div>
      <div>
        <Label htmlFor="data-retention">Data Retention (days)</Label>
        <Input
          id="data-retention"
          data-testid="input-data-retention"
          type="number"
          value={dataRetention}
          onChange={(e) => setDataRetention(e.target.value)}
          placeholder="90"
        />
      </div>
      <Button
        data-testid="button-save-privacy"
        onClick={() => {
          if (hashSalt) onSave("privacy.hashSalt", hashSalt);
          onSave("privacy.dataRetention", dataRetention);
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );
}

function IntegrationSettings({ onSave, isPending }: { configs?: unknown; onSave: (key: string, value: string) => void; isPending: boolean }) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  return (
    <>
      <div>
        <Label htmlFor="webhook-url">Webhook URL</Label>
        <Input
          id="webhook-url"
          data-testid="input-webhook-url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://api.example.com/webhook"
        />
      </div>
      <div>
        <Label htmlFor="api-key">External API Key</Label>
        <Input
          id="api-key"
          data-testid="input-api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API key"
        />
      </div>
      <Button
        data-testid="button-save-integrations"
        onClick={() => {
          onSave("integration.webhookUrl", webhookUrl);
          if (apiKey) onSave("integration.apiKey", apiKey);
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );
}

function LedgerSettings({ onSave, isPending }: { configs?: unknown; onSave: (key: string, value: string) => void; isPending: boolean }) {
  const [defaultAsset, setDefaultAsset] = useState("ETH");
  const [confirmations, setConfirmations] = useState("12");

  return (
    <>
      <div>
        <Label htmlFor="default-asset">Default Asset</Label>
        <Input
          id="default-asset"
          data-testid="input-default-asset"
          value={defaultAsset}
          onChange={(e) => setDefaultAsset(e.target.value)}
          placeholder="ETH"
        />
      </div>
      <div>
        <Label htmlFor="confirmations">Required Confirmations</Label>
        <Input
          id="confirmations"
          data-testid="input-confirmations"
          type="number"
          value={confirmations}
          onChange={(e) => setConfirmations(e.target.value)}
          placeholder="12"
        />
      </div>
      <Button
        data-testid="button-save-ledger"
        onClick={() => {
          onSave("ledger.defaultAsset", defaultAsset);
          onSave("ledger.confirmations", confirmations);
        }}
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </>
  );
}
