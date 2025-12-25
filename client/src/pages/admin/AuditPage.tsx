import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import NotionLayout from "@/components/NotionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileSearch, Download, Filter, RefreshCw, X } from "lucide-react";

export default function AuditPage() {
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [limit, setLimit] = useState("100");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: auditLogs, isLoading, refetch } = useQuery<Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    actor: string;
    meta?: any;
    createdAt: string;
  }>>({
    queryKey: ["/api/trust/audit", { entityType, entityId, limit }],
  });

  const handleExportPDF = async () => {
    const params = new URLSearchParams();
    if (entityType) params.append("entityType", entityType);
    if (entityId) params.append("entityId", entityId);

    const response = await fetch(`/api/trust/audit/export/pdf?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("adminToken")}`, // Admin-only token
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-trail-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const sidebar = (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Filters
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Narrow down audit logs
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="entity-type" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Entity Type
          </Label>
          <Input
            id="entity-type"
            data-testid="input-entity-type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="e.g., trust_config"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="entity-id" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Entity ID
          </Label>
          <Input
            id="entity-id"
            data-testid="input-entity-id"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Optional ID filter"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="limit" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Limit
          </Label>
          <Input
            id="limit"
            data-testid="input-limit"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="100"
            className="mt-1.5"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            setEntityType("");
            setEntityId("");
            setLimit("100");
          }}
        >
          Clear Filters
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <div className="flex justify-between">
            <span>Total Entries:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {auditLogs?.length || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const editor = (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          Audit Log Explorer
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Track all system changes and user actions
        </p>
      </div>

      <Card data-testid="card-audit-table">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSearch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                {auditLogs?.length || 0} entries found
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        data-testid={`row-audit-${log.id}`}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                        onClick={() => setSelectedLog(log)}
                      >
                        <TableCell className="text-slate-600 dark:text-slate-400 text-xs">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid={`badge-type-${log.id}`}>
                            {log.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {log.entityId ? log.entityId.substring(0, 12) + '...' : 'N/A'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge data-testid={`badge-action-${log.id}`}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 text-xs">
                          {log.actor ? log.actor.substring(0, 12) + '...' : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 dark:text-slate-400 py-12">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const properties = selectedLog ? (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Log Details
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedLog(null)}
          data-testid="button-close-details"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">ID</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 break-all">
            {selectedLog.id}
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Timestamp</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
            {new Date(selectedLog.createdAt).toLocaleString()}
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Entity Type</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">
            {selectedLog.entityType}
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Entity ID</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 break-all">
            {selectedLog.entityId || 'N/A'}
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Action</Label>
          <Badge className="mt-1">{selectedLog.action}</Badge>
        </div>

        <div>
          <Label className="text-xs text-slate-500 dark:text-slate-400">Actor</Label>
          <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 break-all">
            {selectedLog.actor || 'N/A'}
          </p>
        </div>

        {selectedLog.meta && (
          <div>
            <Label className="text-xs text-slate-500 dark:text-slate-400">Metadata</Label>
            <pre className="text-xs mt-1 bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(selectedLog.meta, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="p-4 flex items-center justify-center h-full">
      <div className="text-center text-slate-400 dark:text-slate-600">
        <FileSearch className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Select a log to view details</p>
      </div>
    </div>
  );

  const toolbar = (
    <div className="flex items-center justify-between px-6 py-3">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Audit Logs
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh"
        >
          <RefreshCw className="w-3 h-3 mr-2" />
          Refresh
        </Button>
        <Button
          size="sm"
          onClick={handleExportPDF}
          data-testid="button-export-pdf"
        >
          <Download className="w-3 h-3 mr-2" />
          Export PDF
        </Button>
      </div>
    </div>
  );

  return (
    <NotionLayout
      sidebar={sidebar}
      editor={editor}
      properties={properties}
      toolbar={toolbar}
      sidebarWidth="280px"
      propertiesWidth="320px"
    />
  );
}
