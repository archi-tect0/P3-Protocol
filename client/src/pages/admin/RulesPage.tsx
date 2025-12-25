import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Play, Plus, FileCode } from "lucide-react";
import AdminLayout from "./AdminLayout";

export default function RulesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDryRunOpen, setIsDryRunOpen] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);

  const { data: rules, isLoading } = useQuery<Array<{
    id: string;
    name: string;
    description?: string;
    condition: any;
    action: any;
    priority: number;
    status: string;
    createdBy: string;
    createdAt: string;
  }>>({
    queryKey: ["/api/trust/rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/trust/rules", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trust/rules"] });
      toast({ title: "Success", description: "Rule created successfully" });
      setIsCreateOpen(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const dryRunMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/trust/rules/dry-run", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setDryRunResult(data);
      toast({ title: "Success", description: "Dry run completed" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest(`/api/trust/rules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trust/rules"] });
      toast({ title: "Success", description: "Rule status updated" });
    },
  });

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Smart Rules Engine
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Define and test conditional logic for Trust Layer
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="button-dry-run"
              variant="outline"
              onClick={() => setIsDryRunOpen(true)}
            >
              <Play className="w-4 h-4 mr-2" />
              Dry Run
            </Button>
            <Button
              data-testid="button-create-rule"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </div>

        <Card data-testid="card-rules-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Active Rules
            </CardTitle>
            <CardDescription>
              {rules?.length || 0} rules configured
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
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules && rules.length > 0 ? (
                    rules.map((rule) => (
                      <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          {rule.name}
                          {rule.description && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {rule.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-priority-${rule.id}`}>
                          {rule.priority}
                        </TableCell>
                        <TableCell>
                          <Badge
                            data-testid={`badge-status-${rule.id}`}
                            variant={
                              rule.status === "active" ? "default" : 
                              rule.status === "testing" ? "secondary" : 
                              "outline"
                            }
                          >
                            {rule.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {JSON.stringify(rule.condition).substring(0, 30)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {JSON.stringify(rule.action).substring(0, 30)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-toggle-${rule.id}`}
                              onClick={() => updateStatusMutation.mutate({
                                id: rule.id,
                                status: rule.status === "active" ? "inactive" : "active"
                              })}
                            >
                              {rule.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 dark:text-slate-400">
                        No rules configured yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <CreateRuleDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onSubmit={(data: any) => createRuleMutation.mutate(data)}
          isPending={createRuleMutation.isPending}
        />

        <DryRunDialog
          open={isDryRunOpen}
          onOpenChange={setIsDryRunOpen}
          onSubmit={(data: any) => dryRunMutation.mutate(data)}
          result={dryRunResult}
          isPending={dryRunMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}

function CreateRuleDialog({ open, onOpenChange, onSubmit, isPending }: any) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState('{"field": "example", "operator": "equals", "value": "test"}');
  const [action, setAction] = useState('{"type": "log", "message": "Rule triggered"}');
  const [priority, setPriority] = useState("100");

  const handleSubmit = () => {
    try {
      onSubmit({
        name,
        description,
        condition: JSON.parse(condition),
        action: JSON.parse(action),
        priority: parseInt(priority),
        status: "active",
      });
    } catch (error) {
      alert("Invalid JSON in condition or action");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-create-rule">
        <DialogHeader>
          <DialogTitle>Create New Rule</DialogTitle>
          <DialogDescription>
            Define a new smart rule with JSON condition and action
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              data-testid="input-rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Rule"
            />
          </div>
          <div>
            <Label htmlFor="rule-description">Description</Label>
            <Input
              id="rule-description"
              data-testid="input-rule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <Label htmlFor="rule-condition">Condition (JSON)</Label>
            <Textarea
              id="rule-condition"
              data-testid="textarea-rule-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="rule-action">Action (JSON)</Label>
            <Textarea
              id="rule-action"
              data-testid="textarea-rule-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="rule-priority">Priority</Label>
            <Input
              id="rule-priority"
              data-testid="input-rule-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="100"
            />
          </div>
          <Button
            data-testid="button-submit-rule"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Creating..." : "Create Rule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DryRunDialog({ open, onOpenChange, onSubmit, result, isPending }: any) {
  const [condition, setCondition] = useState('{"field": "test", "operator": "equals", "value": "true"}');
  const [action, setAction] = useState('{"type": "log", "message": "Test action"}');
  const [testData, setTestData] = useState('{"test": "true"}');

  const handleSubmit = () => {
    try {
      onSubmit({
        condition: JSON.parse(condition),
        action: JSON.parse(action),
        testData: JSON.parse(testData),
      });
    } catch (error) {
      alert("Invalid JSON");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-dry-run" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Rule Execution</DialogTitle>
          <DialogDescription>
            Run a dry-run test without saving the rule
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="dry-condition">Condition (JSON)</Label>
            <Textarea
              id="dry-condition"
              data-testid="textarea-dry-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="dry-action">Action (JSON)</Label>
            <Textarea
              id="dry-action"
              data-testid="textarea-dry-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <div>
            <Label htmlFor="dry-test-data">Test Data (JSON)</Label>
            <Textarea
              id="dry-test-data"
              data-testid="textarea-dry-test-data"
              value={testData}
              onChange={(e) => setTestData(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
          </div>
          <Button
            data-testid="button-run-dry-run"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? "Running..." : "Run Test"}
          </Button>

          {result && (
            <Card data-testid="card-dry-run-result">
              <CardHeader>
                <CardTitle className="text-sm">Test Results</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
