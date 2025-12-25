import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ComplianceExports() {
  const { toast } = useToast();
  const [exportType, setExportType] = useState<string>("receipts");
  const [dateRange, setDateRange] = useState<string>("7d");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`/api/admin/export?type=${exportType}&range=${dateRange}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error("Export failed");
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `p3-${exportType}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ title: "Export complete", description: `Downloaded ${exportType} report` });
    } catch (e) {
      toast({ title: "Export failed", variant: "destructive" });
    }
    setIsExporting(false);
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900 border-indigo-200 dark:border-indigo-800" data-testid="compliance-exports">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-slate-900 dark:text-white">
          <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Compliance Exports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-wrap">
          <Select value={exportType} onValueChange={setExportType}>
            <SelectTrigger data-testid="select-export-type" className="w-[180px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="receipts">Payment Receipts</SelectItem>
              <SelectItem value="messages">Message Headers</SelectItem>
              <SelectItem value="notes">Note Metadata</SelectItem>
              <SelectItem value="anchors">Blockchain Anchors</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger data-testid="select-date-range" className="w-[180px]">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          onClick={handleExport} 
          disabled={isExporting} 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
          data-testid="button-export"
        >
          <Download className="w-4 h-4 mr-2" />
          {isExporting ? "Exporting..." : "Download Export"}
        </Button>
      </CardContent>
    </Card>
  );
}
