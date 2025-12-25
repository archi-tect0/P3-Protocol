import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Check, X } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QuarantineItem {
  id: string;
  type: string;
  sender: string;
  reason: string;
  payload: any;
  createdAt: string;
}

export default function QuarantineManager() {
  const { toast } = useToast();
  const { data: items, isLoading } = useQuery<QuarantineItem[]>({
    queryKey: ["/api/admin/quarantine"],
    refetchInterval: 30000
  });

  const releaseMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/quarantine/${id}/release`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quarantine"] });
      toast({ title: "Item released", description: "The quarantined item has been released for processing" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/admin/quarantine/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quarantine"] });
      toast({ title: "Item deleted", description: "The quarantined item has been permanently deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  return (
    <Card data-testid="quarantine-manager">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" /> Quarantine Queue
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
          </div>
        ) : !items || items.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-8">No quarantined items</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid={`quarantine-row-${item.id}`}>
                  <TableCell className="font-medium">{item.type}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.sender?.slice(0, 10)}...
                  </TableCell>
                  <TableCell>{item.reason}</TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => releaseMutation.mutate(item.id)}
                      disabled={releaseMutation.isPending}
                      data-testid={`button-release-${item.id}`}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
