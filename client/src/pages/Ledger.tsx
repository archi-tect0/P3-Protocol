import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Allocation } from "@shared/schema";
import { insertLedgerEventSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownLeft, ArrowUpRight, DollarSign, Loader2 } from "lucide-react";

interface TreasurySummary {
  asset: string;
  totalInflow: string;
  totalOutflow: string;
  balance: string;
}

export default function Ledger() {
  const { toast } = useToast();
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedLedgerEventId, setSelectedLedgerEventId] = useState<string | null>(null);

  const userRole = localStorage.getItem("userRole") || "viewer";
  const isAdmin = userRole === "admin";

  const { data: ledgerEvents = [], isLoading: ledgerLoading } = useQuery<any[]>({
    queryKey: ["/api/ledger", directionFilter, assetFilter, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      return apiRequest(`/api/ledger?${params.toString()}`);
    },
  });

  const { data: treasury = [], isLoading: treasuryLoading } = useQuery<TreasurySummary[]>({
    queryKey: ["/api/treasury"],
  });

  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<Allocation[]>({
    queryKey: ["/api/allocations", selectedLedgerEventId],
    enabled: !!selectedLedgerEventId,
  });

  const createEventForm = useForm<z.infer<typeof insertLedgerEventSchema>>({
    resolver: zodResolver(insertLedgerEventSchema),
    defaultValues: {
      txHash: "",
      chainId: "",
      direction: "inflow",
      amount: "0",
      asset: "",
      counterparty: "",
      memoHash: "",
      immutableSeq: 0,
    },
  });

  const allocateForm = useForm({
    resolver: zodResolver(
      z.object({
        ledgerEventId: z.string().uuid(),
        ops: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
          message: "Must be between 0 and 100",
        }),
        rnd: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
          message: "Must be between 0 and 100",
        }),
        grants: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
          message: "Must be between 0 and 100",
        }),
        reserve: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0 && Number(val) <= 100, {
          message: "Must be between 0 and 100",
        }),
      }).refine((data) => {
        const total = Number(data.ops) + Number(data.rnd) + Number(data.grants) + Number(data.reserve);
        return Math.abs(total - 100) < 0.01;
      }, {
        message: "Percentages must sum to 100",
        path: ["ops"],
      })
    ),
    defaultValues: {
      ledgerEventId: "",
      ops: "25",
      rnd: "25",
      grants: "25",
      reserve: "25",
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertLedgerEventSchema>) => {
      return apiRequest("/api/ledger/event", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/treasury"] });
      createEventForm.reset();
      toast({
        title: "Success",
        description: "Ledger event created successfully",
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

  const allocateMutation = useMutation({
    mutationFn: async (data: any) => {
      const ledgerEvent = ledgerEvents.find((e) => e.id === data.ledgerEventId);
      if (!ledgerEvent) throw new Error("Ledger event not found");

      const allocationsData = [
        { bucket: "ops", percent: data.ops },
        { bucket: "r&d", percent: data.rnd },
        { bucket: "grants", percent: data.grants },
        { bucket: "reserve", percent: data.reserve },
      ].map((item) => ({
        ledgerEventId: data.ledgerEventId,
        bucket: item.bucket,
        percent: item.percent,
        amount: (Number(ledgerEvent.amount) * Number(item.percent) / 100).toFixed(8),
        policyRef: "default-policy",
      }));

      return apiRequest("/api/allocations", {
        method: "POST",
        body: JSON.stringify(allocationsData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      allocateForm.reset();
      toast({
        title: "Success",
        description: "Funds allocated successfully",
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

  const filteredLedgerEvents = ledgerEvents.filter((event) => {
    if (directionFilter !== "all" && event.direction !== directionFilter) return false;
    if (assetFilter !== "all" && event.asset !== assetFilter) return false;
    if (startDate && new Date(event.createdAt) < new Date(startDate)) return false;
    if (endDate && new Date(event.createdAt) > new Date(endDate)) return false;
    return true;
  });

  const uniqueAssets = Array.from(new Set(ledgerEvents.map((e) => e.asset)));

  return (
    <div className="container mx-auto p-6 space-y-8 bg-white dark:bg-slate-950 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Ledger & Accounting</h1>
      </div>

      <div data-testid="cards-treasury" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {treasuryLoading ? (
          <div className="col-span-full flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
          </div>
        ) : (
          treasury.map((summary) => (
            <Card key={summary.asset} className="bg-white dark:bg-slate-900">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-900 dark:text-slate-50">
                  {summary.asset}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{summary.balance}</div>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex items-center text-green-600 dark:text-green-400">
                    <ArrowDownLeft className="mr-1 h-3 w-3" />
                    Inflow: {summary.totalInflow}
                  </div>
                  <div className="flex items-center text-red-600 dark:text-red-400">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    Outflow: {summary.totalOutflow}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="bg-white dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-slate-900 dark:text-slate-50">Ledger Events</CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Track all treasury transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-900 dark:text-slate-50">Direction</label>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger data-testid="filter-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inflow">Inflow</SelectItem>
                  <SelectItem value="outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-900 dark:text-slate-50">Asset</label>
              <Select value={assetFilter} onValueChange={setAssetFilter}>
                <SelectTrigger data-testid="filter-asset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {uniqueAssets.map((asset) => (
                    <SelectItem key={asset} value={asset}>
                      {asset}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-900 dark:text-slate-50">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="filter-start-date"
                className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-slate-900 dark:text-slate-50">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="filter-end-date"
                className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
              />
            </div>
          </div>

          <div data-testid="table-ledger" className="rounded-md border border-slate-200 dark:border-slate-800">
            {ledgerLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-900 dark:text-slate-50">Tx Hash</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-50">Direction</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-50">Amount</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-50">Asset</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-50">Counterparty</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-50">Date</TableHead>
                    <TableHead className="text-slate-900 dark:text-slate-50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLedgerEvents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500 dark:text-slate-400">
                        No ledger events found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLedgerEvents.map((event) => (
                      <TableRow key={event.id} data-testid={`row-ledger-${event.id}`}>
                        <TableCell className="font-mono text-xs text-slate-900 dark:text-slate-50">
                          {event.txHash.substring(0, 10)}...
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              event.direction === "inflow"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}
                          >
                            {event.direction === "inflow" ? (
                              <ArrowDownLeft className="mr-1 h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="mr-1 h-3 w-3" />
                            )}
                            {event.direction}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-900 dark:text-slate-50">{event.amount}</TableCell>
                        <TableCell className="text-slate-900 dark:text-slate-50">{event.asset}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-900 dark:text-slate-50">
                          {event.counterparty.substring(0, 10)}...
                        </TableCell>
                        <TableCell className="text-slate-900 dark:text-slate-50">
                          {new Date(event.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLedgerEventId(event.id)}
                            data-testid={`button-view-allocations-${event.id}`}
                          >
                            View Allocations
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedLedgerEventId && (
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-50">Allocations</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Fund distribution for selected transaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div data-testid="table-allocations" className="rounded-md border border-slate-200 dark:border-slate-800">
              {allocationsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500 dark:text-slate-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-900 dark:text-slate-50">Bucket</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-50">Percent</TableHead>
                      <TableHead className="text-slate-900 dark:text-slate-50">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-slate-500 dark:text-slate-400">
                          No allocations found
                        </TableCell>
                      </TableRow>
                    ) : (
                      allocations.map((allocation) => (
                        <TableRow key={allocation.id} data-testid={`row-allocation-${allocation.id}`}>
                          <TableCell className="font-medium text-slate-900 dark:text-slate-50">
                            {allocation.bucket}
                          </TableCell>
                          <TableCell className="text-slate-900 dark:text-slate-50">{allocation.percent}%</TableCell>
                          <TableCell className="text-slate-900 dark:text-slate-50">{allocation.amount}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <>
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-50">Create Ledger Event</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Add a new transaction to the ledger
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...createEventForm}>
                <form
                  onSubmit={createEventForm.handleSubmit((data) => createEventMutation.mutate(data))}
                  className="space-y-4"
                  data-testid="form-create-event"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={createEventForm.control}
                      name="txHash"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Transaction Hash</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="0x..."
                              data-testid="input-txHash"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEventForm.control}
                      name="chainId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Chain ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="1"
                              data-testid="input-chainId"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEventForm.control}
                      name="direction"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Direction</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-direction">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="inflow">Inflow</SelectItem>
                              <SelectItem value="outflow">Outflow</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEventForm.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Amount</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.00000001"
                              placeholder="0.00"
                              data-testid="input-amount"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEventForm.control}
                      name="asset"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Asset</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="ETH"
                              data-testid="input-asset"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createEventForm.control}
                      name="counterparty"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Counterparty</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="0x..."
                              data-testid="input-counterparty"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={createEventMutation.isPending}
                    data-testid="button-create-event"
                  >
                    {createEventMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create Event
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-slate-50">Allocate Funds</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Distribute funds across buckets (must sum to 100%)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...allocateForm}>
                <form
                  onSubmit={allocateForm.handleSubmit((data) => allocateMutation.mutate(data))}
                  className="space-y-4"
                  data-testid="form-allocate"
                >
                  <FormField
                    control={allocateForm.control}
                    name="ledgerEventId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-900 dark:text-slate-50">Select Ledger Event</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-ledger-event">
                              <SelectValue placeholder="Select a transaction" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ledgerEvents.map((event) => (
                              <SelectItem key={event.id} value={event.id}>
                                {event.txHash.substring(0, 10)}... - {event.amount} {event.asset}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField
                      control={allocateForm.control}
                      name="ops"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Operations %</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              data-testid="input-ops"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={allocateForm.control}
                      name="rnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">R&D %</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              data-testid="input-rnd"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={allocateForm.control}
                      name="grants"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Grants %</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              data-testid="input-grants"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={allocateForm.control}
                      name="reserve"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-900 dark:text-slate-50">Reserve %</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              data-testid="input-reserve"
                              className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={allocateMutation.isPending}
                    data-testid="button-allocate"
                  >
                    {allocateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Allocate Funds
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
