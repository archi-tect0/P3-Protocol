import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import NotionLayout from "@/components/NotionLayout";
import AnchoredBadge from "@/components/AnchoredBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Download,
  Grid3x3,
  List,
  Filter,
  Calendar,
  User,
  Link2,
  FileJson,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Copy,
  Check,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AnchoredItem {
  id: string;
  type: "message" | "note" | "call" | "payment" | "proposal" | "vote" | "meeting" | "money";
  timestamp: string;
  actor: string;
  contentHash?: string;
  txHash?: string;
  chainId?: string;
  status: string;
  metadata?: any;
  anchorStatus?: string;
  anchorTimestamp?: string;
  receiptId?: string;
  subjectId?: string;
  proofBlob?: any;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

interface FilterState {
  moduleType: string;
  startDate: string;
  endDate: string;
  actor: string;
  chain: string;
  status: string;
}

const MODULE_TYPES = [
  { value: "all", label: "All Types" },
  { value: "message", label: "Messages" },
  { value: "note", label: "Notes" },
  { value: "call", label: "Calls" },
  { value: "payment", label: "Payments" },
  { value: "proposal", label: "Proposals" },
  { value: "vote", label: "Votes" },
  { value: "meeting", label: "Meetings" },
  { value: "money", label: "Money" },
];

const CHAINS = [
  { value: "all", label: "All Chains" },
  { value: "8453", label: "Base" },
  { value: "84532", label: "Base Sepolia" },
  { value: "1", label: "Ethereum" },
  { value: "137", label: "Polygon" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "none", label: "Not Anchored" },
];

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-3" data-testid="skeleton-loader">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6"></div>
        </div>
      ))}
    </div>
  );
}

function GridViewItem({ item, onSelect }: { item: AnchoredItem; onSelect: () => void }) {
  const getModuleColor = (type: string) => {
    const colors: Record<string, string> = {
      message: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      note: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
      call: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
      payment: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
      proposal: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300",
      vote: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
      meeting: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300",
      money: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
    };
    return colors[type] || "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300";
  };

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02]"
      onClick={onSelect}
      data-testid={`card-item-${item.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge className={getModuleColor(item.type)}>{item.type}</Badge>
          {item.anchorStatus && item.anchorStatus !== "none" && (
            <AnchoredBadge
              txHash={item.txHash}
              chainId={parseInt(item.chainId || "8453")}
              size="sm"
              showLink={false}
            />
          )}
        </div>
        <CardTitle className="text-sm mt-2 text-slate-900 dark:text-white">
          {new Date(item.timestamp).toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <User className="w-4 h-4" />
            <span className="font-mono text-xs">{item.actor?.substring(0, 10)}...</span>
          </div>
          {item.contentHash && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Shield className="w-4 h-4" />
              <span className="font-mono text-xs">{item.contentHash.substring(0, 16)}...</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs">
              Chain: {item.chainId || "N/A"}
            </span>
            <Badge variant="outline" className="text-xs">
              {item.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExplorerPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<AnchoredItem | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    moduleType: "all",
    startDate: "",
    endDate: "",
    actor: "",
    chain: "all",
    status: "all",
  });

  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>([
    {
      id: "preset-1",
      name: "Recent Anchored",
      filters: {
        moduleType: "all",
        startDate: "",
        endDate: "",
        actor: "",
        chain: "all",
        status: "confirmed",
      },
    },
    {
      id: "preset-2",
      name: "Base Messages",
      filters: {
        moduleType: "message",
        startDate: "",
        endDate: "",
        actor: "",
        chain: "8453",
        status: "all",
      },
    },
  ]);

  const { data: items = [], isLoading } = useQuery<AnchoredItem[]>({
    queryKey: [
      "/api/ledger",
      filters.moduleType,
      filters.startDate,
      filters.endDate,
      filters.actor,
      filters.chain,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.moduleType !== "all") params.append("type", filters.moduleType);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.actor) params.append("walletAddress", filters.actor);
      params.append("limit", "100");

      return apiRequest(`/api/ledger?${params.toString()}`);
    },
    refetchInterval: 5000, // Real-time updates every 5 seconds
  });

  const filteredItems = items
    .filter((item) => {
      if (filters.status !== "all" && item.anchorStatus !== filters.status) return false;
      if (filters.chain !== "all" && item.chainId !== filters.chain) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.type.toLowerCase().includes(query) ||
          item.actor?.toLowerCase().includes(query) ||
          item.contentHash?.toLowerCase().includes(query) ||
          item.txHash?.toLowerCase().includes(query)
        );
      }
      return true;
    });

  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: "Copied",
      description: `${field} copied to clipboard`,
    });
  };

  const exportProofBundle = (item: AnchoredItem) => {
    const bundle = {
      id: item.id,
      type: item.type,
      timestamp: item.timestamp,
      contentHash: item.contentHash,
      txHash: item.txHash,
      chainId: item.chainId,
      receiptId: item.receiptId,
      proofBlob: item.proofBlob,
      metadata: item.metadata,
      signature: item.proofBlob?.signature || null,
    };

    const dataStr = JSON.stringify(bundle, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = `proof-bundle-${item.id}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    toast({
      title: "Export Successful",
      description: "Proof bundle downloaded",
    });
  };

  const exportAllItems = () => {
    const dataStr = JSON.stringify(filteredItems, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileDefaultName = `explorer-export-${new Date().toISOString()}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();

    toast({
      title: "Export Successful",
      description: `Exported ${filteredItems.length} items`,
    });
  };

  const applyPreset = (preset: FilterPreset) => {
    setFilters(preset.filters);
    toast({
      title: "Preset Applied",
      description: `Applied "${preset.name}" filter preset`,
    });
  };

  const saveCurrentAsPreset = () => {
    const name = prompt("Enter preset name:");
    if (name) {
      const newPreset: FilterPreset = {
        id: `preset-${Date.now()}`,
        name,
        filters: { ...filters },
      };
      setSavedPresets([...savedPresets, newPreset]);
      toast({
        title: "Preset Saved",
        description: `"${name}" saved to presets`,
      });
    }
  };

  const getModuleColor = (type: string) => {
    const colors: Record<string, string> = {
      message: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
      note: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
      call: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
      payment: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300",
      proposal: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300",
      vote: "bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300",
      meeting: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300",
      money: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
    };
    return colors[type] || "bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300";
  };

  const getBlockExplorerUrl = (txHash: string, chainId: string) => {
    const explorers: Record<string, string> = {
      "8453": "https://basescan.org/tx/",
      "84532": "https://sepolia.basescan.org/tx/",
      "1": "https://etherscan.io/tx/",
      "137": "https://polygonscan.com/tx/",
    };
    return `${explorers[chainId] || explorers["8453"]}${txHash}`;
  };

  // Sidebar: Filters and Presets
  const sidebar = (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Filters
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              Module Type
            </label>
            <Select
              value={filters.moduleType}
              onValueChange={(value) => setFilters({ ...filters, moduleType: value })}
            >
              <SelectTrigger data-testid="filter-module-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODULE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Date Range
            </label>
            <div className="space-y-2">
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="bg-white dark:bg-slate-900"
                data-testid="filter-start-date"
              />
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="bg-white dark:bg-slate-900"
                data-testid="filter-end-date"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
              <User className="w-4 h-4" />
              Actor Filter
            </label>
            <Input
              placeholder="0x... or wallet address"
              value={filters.actor}
              onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
              className="bg-white dark:bg-slate-900"
              data-testid="filter-actor"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Chain
            </label>
            <Select
              value={filters.chain}
              onValueChange={(value) => setFilters({ ...filters, chain: value })}
            >
              <SelectTrigger data-testid="filter-chain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAINS.map((chain) => (
                  <SelectItem key={chain.value} value={chain.value}>
                    {chain.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              Status
            </label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger data-testid="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Saved Presets</h3>
          <Button size="sm" variant="ghost" onClick={saveCurrentAsPreset} data-testid="button-save-preset">
            Save
          </Button>
        </div>
        <div className="space-y-2">
          {savedPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="w-full text-left px-3 py-2 rounded-md text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-900 dark:text-white"
              data-testid={`preset-${preset.id}`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Toolbar: Search, View Toggle, Export
  const toolbar = (
    <div className="px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
      <div className="flex-1 min-w-[180px] max-w-md relative order-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white dark:bg-slate-900 text-sm"
          data-testid="input-search"
        />
      </div>

      <div className="flex items-center gap-2 order-2">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1">
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            onClick={() => setViewMode("table")}
            data-testid="button-view-table"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "grid" ? "default" : "ghost"}
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <Grid3x3 className="w-4 h-4" />
          </Button>
        </div>

        <Button onClick={exportAllItems} variant="outline" size="sm" data-testid="button-export-all" className="hidden sm:flex">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
        <Button onClick={exportAllItems} variant="outline" size="sm" data-testid="button-export-mobile" className="sm:hidden">
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  // Editor: Table or Grid View
  const editor = (
    <div className="p-4 sm:p-6 pb-24 md:pb-6">
      {isLoading ? (
        <SkeletonLoader />
      ) : viewMode === "table" ? (
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Hash</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Anchor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500 dark:text-slate-400 py-8">
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <>
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => setSelectedItem(item)}
                      data-testid={`row-item-${item.id}`}
                    >
                      <TableCell>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(item.id);
                          }}
                          className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          data-testid={`button-expand-${item.id}`}
                        >
                          {expandedRows.has(item.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-white">
                        {new Date(item.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getModuleColor(item.type)}>{item.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {item.actor?.substring(0, 10)}...
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                        {item.contentHash?.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="text-slate-900 dark:text-white">
                        {item.chainId || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.anchorStatus && item.anchorStatus !== "none" ? (
                          <AnchoredBadge
                            txHash={item.txHash}
                            chainId={parseInt(item.chainId || "8453")}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">Not anchored</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(item.id) && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-slate-50 dark:bg-slate-900">
                          <div
                            className="p-4 space-y-2 animate-in slide-in-from-top duration-300"
                            data-testid={`expanded-row-${item.id}`}
                          >
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Full Hash:</span>
                                <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-1">
                                  {item.contentHash || "N/A"}
                                </p>
                              </div>
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Receipt ID:</span>
                                <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-1">
                                  {item.receiptId || "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center text-slate-500 dark:text-slate-400 py-12">
              No items found
            </div>
          ) : (
            filteredItems.map((item) => (
              <GridViewItem key={item.id} item={item} onSelect={() => setSelectedItem(item)} />
            ))
          )}
        </div>
      )}
    </div>
  );

  // Properties: Selected Item Details
  const properties = selectedItem ? (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Item Details</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setSelectedItem(null)}
          data-testid="button-close-properties"
        >
          ✕
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Module Type
          </label>
          <Badge className={`${getModuleColor(selectedItem.type)} mt-2`}>{selectedItem.type}</Badge>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Timestamp
          </label>
          <p className="text-sm text-slate-900 dark:text-white mt-1">
            {new Date(selectedItem.timestamp).toLocaleString()}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Content Hash
            </label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(selectedItem.contentHash || "", "Content Hash")}
              data-testid="button-copy-hash"
            >
              {copiedField === "Content Hash" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded break-all text-slate-900 dark:text-white">
            {selectedItem.contentHash || "N/A"}
          </p>
        </div>

        {selectedItem.txHash && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Transaction Hash
              </label>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(selectedItem.txHash || "", "Transaction Hash")}
                >
                  {copiedField === "Transaction Hash" ? (
                    <Check className="w-3 h-3 text-green-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
                <a
                  href={getBlockExplorerUrl(selectedItem.txHash, selectedItem.chainId || "8453")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                  data-testid="link-block-explorer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded break-all text-slate-900 dark:text-white">
              {selectedItem.txHash}
            </p>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Chain ID
          </label>
          <p className="text-sm text-slate-900 dark:text-white mt-1">{selectedItem.chainId || "N/A"}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Actor
          </label>
          <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 p-2 rounded break-all text-slate-900 dark:text-white mt-1">
            {selectedItem.actor || "N/A"}
          </p>
        </div>

        {selectedItem.anchorStatus && (
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Anchor Status
            </label>
            <Badge variant="outline" className="mt-2">
              {selectedItem.anchorStatus}
            </Badge>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <Button
            className="w-full"
            onClick={() => exportProofBundle(selectedItem)}
            data-testid="button-export-proof"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Proof Bundle
          </Button>
        </div>

        {selectedItem.metadata && (
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              Metadata
            </label>
            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-auto max-h-48 text-slate-900 dark:text-white">
              {JSON.stringify(selectedItem.metadata, null, 2)}
            </pre>
          </div>
        )}

        {selectedItem.proofBlob && (
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Raw Proof Data
            </label>
            <pre className="text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded overflow-auto max-h-48 text-slate-900 dark:text-white">
              {JSON.stringify(selectedItem.proofBlob, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="p-6 flex items-center justify-center h-full">
      <div className="text-center text-slate-400 dark:text-slate-500">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">Select an item to view details</p>
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
      propertiesWidth="360px"
    />
  );
}
