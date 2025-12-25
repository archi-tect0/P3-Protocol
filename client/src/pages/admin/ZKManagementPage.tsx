import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Key, FileCode, BarChart3 } from "lucide-react";
import AdminLayout from "./AdminLayout";

export default function ZKManagementPage() {
  const verifierKeys = [
    { id: "1", name: "Receipt Verifier", algorithm: "Groth16", keySize: "2048", status: "active", lastRotated: "2024-11-01" },
    { id: "2", name: "Identity Verifier", algorithm: "PLONK", keySize: "4096", status: "active", lastRotated: "2024-10-15" },
    { id: "3", name: "Transaction Verifier", algorithm: "Groth16", keySize: "2048", status: "active", lastRotated: "2024-11-10" },
  ];

  const circuits = [
    { id: "1", name: "Receipt Proof Circuit", version: "1.2.0", constraints: "1.2M", proofTime: "3.2s", status: "deployed" },
    { id: "2", name: "Identity Circuit", version: "2.0.1", constraints: "800K", proofTime: "2.1s", status: "deployed" },
    { id: "3", name: "Balance Circuit", version: "1.5.3", constraints: "1.5M", proofTime: "4.1s", status: "testing" },
  ];

  const proofStats = {
    total: 15234,
    verified: 15180,
    failed: 54,
    avgVerificationTime: "125ms",
    last24h: 423,
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Zero-Knowledge Management
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Manage verifier keys, circuits, and proof statistics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-stat-total">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Total Proofs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {proofStats.total.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-verified">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Verified
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {proofStats.verified.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-failed">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {proofStats.failed.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-stat-avg-time">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Avg Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {proofStats.avgVerificationTime}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card data-testid="card-verifier-keys">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Verifier Keys
              </CardTitle>
              <CardDescription>
                Cryptographic keys for proof verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Algorithm</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifierKeys.map((key) => (
                    <TableRow key={key.id} data-testid={`row-key-${key.id}`}>
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        {key.name}
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {key.keySize} bits
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {key.algorithm}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" data-testid={`badge-status-${key.id}`}>
                          {key.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card data-testid="card-circuits">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Circuit Catalog
              </CardTitle>
              <CardDescription>
                ZK circuit templates and configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Circuit</TableHead>
                    <TableHead>Constraints</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {circuits.map((circuit) => (
                    <TableRow key={circuit.id} data-testid={`row-circuit-${circuit.id}`}>
                      <TableCell className="font-medium text-slate-900 dark:text-white">
                        {circuit.name}
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          v{circuit.version} · {circuit.proofTime}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-400">
                        {circuit.constraints}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={circuit.status === "deployed" ? "default" : "secondary"}
                          data-testid={`badge-circuit-status-${circuit.id}`}
                        >
                          {circuit.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-proof-history">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Proof Statistics
            </CardTitle>
            <CardDescription>
              Recent verification activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Last 24 Hours
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-last-24h">
                  {proofStats.last24h}
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Success Rate
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-success-rate">
                  {((proofStats.verified / proofStats.total) * 100).toFixed(2)}%
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Failure Rate
                </div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-failure-rate">
                  {((proofStats.failed / proofStats.total) * 100).toFixed(2)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
