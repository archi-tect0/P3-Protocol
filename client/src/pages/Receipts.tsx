import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Receipt, insertReceiptSchema, AuditLog } from "@shared/schema";
import { FileCheck, Plus, Shield, History, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const createReceiptSchema = insertReceiptSchema.extend({
  content: z.string().min(1, "Content is required"),
});

type CreateReceiptForm = z.infer<typeof createReceiptSchema>;

function Receipts() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const { data: receipts, isLoading: receiptsLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/receipts/audit", selectedReceiptId],
    enabled: showAuditModal && !!selectedReceiptId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateReceiptForm) => {
      const { content, ...receiptData } = data;
      return apiRequest("/api/receipts", {
        method: "POST",
        body: JSON.stringify({ ...receiptData, content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({
        title: "Success",
        description: "Receipt created successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (receiptId: string) => {
      return apiRequest("/api/receipts/verify", {
        method: "POST",
        body: JSON.stringify({ receiptId }),
      });
    },
    onSuccess: (data) => {
      setVerificationResult(data);
      toast({
        title: "Verification Complete",
        description: data.valid ? "Receipt is valid" : "Receipt validation failed",
        variant: data.valid ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<CreateReceiptForm>({
    resolver: zodResolver(createReceiptSchema),
    defaultValues: {
      type: "message",
      subjectId: "",
      contentHash: "",
      proofBlob: {},
      createdBy: "",
      immutableSeq: 0,
      content: "",
    },
  });

  const filteredReceipts = receipts?.filter((receipt) => 
    typeFilter === "all" ? true : receipt.type === typeFilter
  );

  const handleVerify = (receiptId: string) => {
    verifyMutation.mutate(receiptId);
  };

  const showAuditTrail = (receiptId: string) => {
    setSelectedReceiptId(receiptId);
    setShowAuditModal(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          Receipts
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Manage and verify receipts for messages, meetings, and money transactions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Receipt Form */}
        <Card className="lg:col-span-1" data-testid="card-create-receipt">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Create Receipt
            </CardTitle>
            <CardDescription>Generate a new verifiable receipt</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="message">Message</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="money">Money</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subjectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject ID</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter subject ID"
                          data-testid="input-subject"
                          className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content</FormLabel>
                      <FormControl>
                        <textarea
                          {...field}
                          placeholder="Enter content"
                          rows={4}
                          className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMutation.isPending}
                  data-testid="button-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create Receipt"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Receipts Table */}
        <Card className="lg:col-span-2" data-testid="card-receipts-list">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Receipts List
                </CardTitle>
                <CardDescription>View and manage all receipts</CardDescription>
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="money">Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {receiptsLoading ? (
              <div className="animate-pulse">
                <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            ) : (
              <Table data-testid="table-receipts">
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject ID</TableHead>
                    <TableHead>Content Hash</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts && filteredReceipts.length > 0 ? (
                    filteredReceipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              receipt.type === "message"
                                ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                                : receipt.type === "meeting"
                                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                : "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                            }`}
                          >
                            {receipt.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-900 dark:text-white">
                          {receipt.subjectId}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                          {receipt.contentHash.substring(0, 16)}...
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {new Date(receipt.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerify(receipt.id)}
                              disabled={verifyMutation.isPending}
                              data-testid="button-verify"
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => showAuditTrail(receipt.id)}
                            >
                              <History className="w-4 h-4 mr-1" />
                              Audit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500 dark:text-slate-400">
                        No receipts found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Verification Result */}
      {verificationResult && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Verification Result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 dark:text-white">Status:</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    verificationResult.valid
                      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                      : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                  }`}
                >
                  {verificationResult.valid ? "Valid" : "Invalid"}
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                <pre className="bg-slate-100 dark:bg-slate-800 p-4 rounded-md overflow-auto">
                  {JSON.stringify(verificationResult, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Audit Trail
                </CardTitle>
                <CardDescription>Receipt audit log entries</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAuditModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-slate-900 dark:text-white">
                          {log.action}
                        </TableCell>
                        <TableCell className="text-slate-900 dark:text-white">
                          {log.actor}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {log.entityType}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 dark:text-slate-400">
                        No audit logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Receipts;
