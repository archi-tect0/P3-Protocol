import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { publishReceipt } from '@/lib/canvasBus';
import { useReceipts } from '@/hooks/useReceipts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  BarChart3,
  LineChart,
  PieChart,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  Receipt as ReceiptIcon,
  Hash,
  X,
  Check,
  Bookmark,
  Grid3X3,
  FileSpreadsheet,
} from 'lucide-react';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-y-auto ${className || ''}`}>
      {children}
    </div>
  );
}

interface CalcSheet {
  id: string;
  artifactId: string;
  version: number;
  depsHash: string | null;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface CalcCell {
  id: string;
  sheetId: string;
  addr: string;
  cellType: 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'error';
  value: any;
  formula: string | null;
  format: Record<string, unknown> | null;
  style: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CalcNamedRange {
  id: string;
  sheetId: string;
  name: string;
  rangeExpr: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CalcChart {
  id: string;
  sheetId: string;
  chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'column' | 'donut' | 'radar';
  title: string | null;
  dataRange: string;
  labelRange: string | null;
  config: Record<string, unknown> | null;
  position: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface SheetData {
  ok: boolean;
  sheet: CalcSheet;
  cells: CalcCell[];
}

interface CalcSheetCardProps {
  sheetId: string;
  walletAddress: string;
  sessionId: string;
}

const CHART_TYPE_ICONS: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="w-4 h-4" />,
  line: <LineChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
  column: <BarChart3 className="w-4 h-4 rotate-90" />,
  area: <LineChart className="w-4 h-4" />,
  scatter: <Grid3X3 className="w-4 h-4" />,
  donut: <PieChart className="w-4 h-4" />,
  radar: <Grid3X3 className="w-4 h-4" />,
};

function indexToCol(index: number): string {
  let col = '';
  index++;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
}

export function CalcSheetCard({ sheetId, walletAddress, sessionId }: CalcSheetCardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('grid');
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [formulaInput, setFormulaInput] = useState('');
  const [showNamedRanges, setShowNamedRanges] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [newRangeName, setNewRangeName] = useState('');
  const [newRangeExpr, setNewRangeExpr] = useState('');
  const formulaInputRef = useRef<HTMLInputElement>(null);

  const gridCols = 10;
  const gridRows = 20;

  const { data, isLoading, refetch } = useQuery<SheetData>({
    queryKey: ['/api/calc/sheets', sheetId],
  });

  const { data: namedRangesData } = useQuery<{ ok: boolean; namedRanges: CalcNamedRange[] }>({
    queryKey: ['/api/calc/sheets', sheetId, 'named-ranges'],
    enabled: showNamedRanges || activeTab === 'ranges',
  });

  const { data: chartsData } = useQuery<{ ok: boolean; charts: CalcChart[] }>({
    queryKey: ['/api/calc/sheets', sheetId, 'charts'],
    enabled: showCharts || activeTab === 'charts',
  });

  const { receipts } = useReceipts({ artifactId: data?.sheet?.artifactId, limit: 20 });

  const scope = useMemo(() => ({ walletAddress, sessionId }), [walletAddress, sessionId]);

  const cellMap = useMemo(() => {
    const map = new Map<string, CalcCell>();
    if (data?.cells) {
      data.cells.forEach(cell => map.set(cell.addr, cell));
    }
    return map;
  }, [data?.cells]);

  const setCellMutation = useMutation({
    mutationFn: async ({ addr, value, formula }: { addr: string; value: any; formula?: string }) => {
      return apiRequest(`/api/calc/sheets/${sheetId}/set-cell`, {
        method: 'POST',
        body: JSON.stringify({
          scope,
          cell: { addr, value, formula },
        }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.sheet?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/calc/sheets', sheetId] });
      setEditingCell(null);
      toast({ title: 'Cell updated', description: `Updated ${result.cell?.addr || 'cell'}` });
    },
    onError: (err: any) => {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    },
  });

  const defineRangeMutation = useMutation({
    mutationFn: async ({ name, range, description }: { name: string; range: string; description?: string }) => {
      return apiRequest(`/api/calc/sheets/${sheetId}/define-range`, {
        method: 'POST',
        body: JSON.stringify({ scope, name, range, description }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.sheet?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/calc/sheets', sheetId, 'named-ranges'] });
      setNewRangeName('');
      setNewRangeExpr('');
      toast({ title: 'Named range created', description: `Defined ${result.namedRange?.name}` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to create named range', description: err.message, variant: 'destructive' });
    },
  });

  const createChartMutation = useMutation({
    mutationFn: async ({ chartType, title, dataRange, labelRange }: { chartType: string; title?: string; dataRange: string; labelRange?: string }) => {
      return apiRequest(`/api/calc/sheets/${sheetId}/charts`, {
        method: 'POST',
        body: JSON.stringify({
          scope,
          chart: { chartType, title, dataRange, labelRange },
        }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.sheet?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/calc/sheets', sheetId, 'charts'] });
      toast({ title: 'Chart created', description: `Created ${result.chart?.chartType} chart` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to create chart', description: err.message, variant: 'destructive' });
    },
  });

  const deleteChartMutation = useMutation({
    mutationFn: async (chartId: string) => {
      return apiRequest(`/api/calc/sheets/${sheetId}/charts/${chartId}/delete`, {
        method: 'POST',
        body: JSON.stringify({ scope }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calc/sheets', sheetId, 'charts'] });
      toast({ title: 'Chart deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to delete chart', description: err.message, variant: 'destructive' });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: 'csv' | 'xlsx' | 'pdf') => {
      return apiRequest(`/api/calc/sheets/${sheetId}/export`, {
        method: 'POST',
        body: JSON.stringify({ scope, format }),
      });
    },
    onSuccess: (result: any) => {
      if (result.content) {
        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Export complete', description: `Downloaded ${result.filename}` });
    },
    onError: (err: any) => {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleCellClick = useCallback((addr: string) => {
    setSelectedCell(addr);
    const cell = cellMap.get(addr);
    setFormulaInput(cell?.formula || String(cell?.value ?? ''));
  }, [cellMap]);

  const handleCellDoubleClick = useCallback((addr: string) => {
    setEditingCell(addr);
    const cell = cellMap.get(addr);
    setFormulaInput(cell?.formula || String(cell?.value ?? ''));
  }, [cellMap]);

  const handleCellSubmit = useCallback(() => {
    if (!editingCell) return;
    
    const isFormula = formulaInput.startsWith('=');
    setCellMutation.mutate({
      addr: editingCell,
      value: isFormula ? null : (isNaN(Number(formulaInput)) ? formulaInput : Number(formulaInput)),
      formula: isFormula ? formulaInput : undefined,
    });
  }, [editingCell, formulaInput, setCellMutation]);

  const handleFormulaBarSubmit = useCallback(() => {
    if (!selectedCell) return;
    
    const isFormula = formulaInput.startsWith('=');
    setCellMutation.mutate({
      addr: selectedCell,
      value: isFormula ? null : (isNaN(Number(formulaInput)) ? formulaInput : Number(formulaInput)),
      formula: isFormula ? formulaInput : undefined,
    });
  }, [selectedCell, formulaInput, setCellMutation]);

  const handleCreateNamedRange = useCallback(() => {
    if (!newRangeName || !newRangeExpr) return;
    defineRangeMutation.mutate({ name: newRangeName, range: newRangeExpr });
  }, [newRangeName, newRangeExpr, defineRangeMutation]);

  const getCellDisplay = useCallback((addr: string): string => {
    const cell = cellMap.get(addr);
    if (!cell) return '';
    if (cell.errorCode) return `#${cell.errorCode}`;
    if (cell.value === null || cell.value === undefined) return '';
    return String(cell.value);
  }, [cellMap]);

  const getCellType = useCallback((addr: string): string => {
    const cell = cellMap.get(addr);
    return cell?.cellType || 'empty';
  }, [cellMap]);

  if (isLoading) {
    return (
      <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="calc-sheet-card-loading">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="grid grid-cols-6 gap-1">
              {[...Array(30)].map((_, i) => (
                <div key={i} className="h-8 bg-white/5 rounded" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.ok || !data.sheet) {
    return (
      <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="calc-sheet-card-error">
        <CardContent className="p-6 text-center">
          <p className="text-white/60">Spreadsheet not found</p>
          <Button 
            variant="ghost" 
            onClick={() => refetch()} 
            className="mt-2"
            data-testid="calc-retry-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { sheet, cells } = data;
  const selectedCellData = selectedCell ? cellMap.get(selectedCell) : null;

  return (
    <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="calc-sheet-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-400" />
            <CardTitle className="text-lg font-semibold text-white">Calc Spreadsheet</CardTitle>
            <Badge variant="outline" className="text-xs">v{sheet.version}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNamedRanges(!showNamedRanges)}
              className={`text-white/60 hover:text-white ${showNamedRanges ? 'bg-white/10' : ''}`}
              data-testid="calc-toggle-ranges-btn"
            >
              <Bookmark className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCharts(!showCharts)}
              className={`text-white/60 hover:text-white ${showCharts ? 'bg-white/10' : ''}`}
              data-testid="calc-toggle-charts-btn"
            >
              <BarChart3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-white/60 hover:text-white"
              data-testid="calc-refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg" data-testid="calc-formula-bar">
          <div className="flex items-center gap-1 px-2 bg-white/10 rounded text-xs font-mono text-white/80 h-8 min-w-[60px]">
            <Hash className="w-3 h-3 text-white/40" />
            {selectedCell || '—'}
          </div>
          <div className="text-white/40 text-xs">
            {selectedCellData?.cellType === 'formula' ? 'fx' : '='}
          </div>
          <input
            ref={formulaInputRef}
            type="text"
            value={formulaInput}
            onChange={(e) => setFormulaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFormulaBarSubmit();
              if (e.key === 'Escape') {
                setFormulaInput('');
                formulaInputRef.current?.blur();
              }
            }}
            placeholder={selectedCell ? 'Enter value or formula (=SUM(A1:A5))' : 'Select a cell'}
            className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none font-mono"
            disabled={!selectedCell}
            data-testid="calc-formula-input"
          />
          {selectedCell && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFormulaBarSubmit}
              disabled={setCellMutation.isPending}
              className="h-6 w-6 p-0 text-green-400"
              data-testid="calc-formula-submit-btn"
            >
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          {showNamedRanges && (
            <div className="w-56 shrink-0 bg-white/5 rounded-lg p-2" data-testid="calc-ranges-sidebar">
              <h4 className="text-xs font-medium text-white/60 mb-2 px-2 flex items-center justify-between">
                Named Ranges
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNamedRanges(false)}
                  className="h-5 w-5 p-0"
                  data-testid="calc-close-ranges-btn"
                >
                  <X className="w-3 h-3" />
                </Button>
              </h4>
              
              <div className="space-y-2 mb-3">
                <input
                  type="text"
                  value={newRangeName}
                  onChange={(e) => setNewRangeName(e.target.value)}
                  placeholder="Name (e.g., Revenue)"
                  className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white"
                  data-testid="calc-new-range-name-input"
                />
                <input
                  type="text"
                  value={newRangeExpr}
                  onChange={(e) => setNewRangeExpr(e.target.value)}
                  placeholder="Range (e.g., A1:A10)"
                  className="w-full bg-black/30 border border-white/20 rounded px-2 py-1 text-xs text-white"
                  data-testid="calc-new-range-expr-input"
                />
                <Button
                  size="sm"
                  onClick={handleCreateNamedRange}
                  disabled={!newRangeName || !newRangeExpr || defineRangeMutation.isPending}
                  className="w-full h-7 text-xs"
                  data-testid="calc-create-range-btn"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Create Range
                </Button>
              </div>
              
              <ScrollArea className="h-[200px]">
                {namedRangesData?.namedRanges?.length === 0 ? (
                  <div className="text-center text-white/40 py-4 text-xs" data-testid="calc-no-ranges">
                    No named ranges
                  </div>
                ) : (
                  <div className="space-y-1">
                    {namedRangesData?.namedRanges?.map((range) => (
                      <div
                        key={range.id}
                        className="px-2 py-1.5 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition"
                        onClick={() => {
                          setFormulaInput(range.rangeExpr);
                          toast({ title: `Range: ${range.name}`, description: range.rangeExpr });
                        }}
                        data-testid={`calc-range-${range.id}`}
                      >
                        <div className="text-xs text-white font-medium">{range.name}</div>
                        <div className="text-[10px] text-white/40 font-mono">{range.rangeExpr}</div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full bg-white/5 border border-white/10">
                <TabsTrigger value="grid" className="flex-1 data-[state=active]:bg-white/10" data-testid="calc-tab-grid">
                  <Grid3X3 className="w-3 h-3 mr-1" />
                  Grid
                </TabsTrigger>
                <TabsTrigger value="charts" className="flex-1 data-[state=active]:bg-white/10" data-testid="calc-tab-charts">
                  <BarChart3 className="w-3 h-3 mr-1" />
                  Charts
                </TabsTrigger>
                <TabsTrigger value="receipts" className="flex-1 data-[state=active]:bg-white/10" data-testid="calc-tab-receipts">
                  <ReceiptIcon className="w-3 h-3 mr-1" />
                  Receipts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grid" className="mt-4">
                <div className="overflow-x-auto" data-testid="calc-grid-container">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="w-10 h-8 bg-white/10 border border-white/20 text-white/60 font-normal" />
                        {[...Array(gridCols)].map((_, i) => (
                          <th
                            key={i}
                            className="min-w-[80px] h-8 bg-white/10 border border-white/20 text-white/60 font-normal"
                            data-testid={`calc-col-header-${indexToCol(i)}`}
                          >
                            {indexToCol(i)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(gridRows)].map((_, rowIdx) => (
                        <tr key={rowIdx}>
                          <td
                            className="w-10 h-7 bg-white/10 border border-white/20 text-center text-white/60"
                            data-testid={`calc-row-header-${rowIdx + 1}`}
                          >
                            {rowIdx + 1}
                          </td>
                          {[...Array(gridCols)].map((_, colIdx) => {
                            const addr = `${indexToCol(colIdx)}${rowIdx + 1}`;
                            const isSelected = selectedCell === addr;
                            const isEditing = editingCell === addr;
                            const cellType = getCellType(addr);
                            const cellValue = getCellDisplay(addr);

                            return (
                              <td
                                key={colIdx}
                                className={`min-w-[80px] h-7 border border-white/20 px-1 transition-colors cursor-pointer ${
                                  isSelected 
                                    ? 'bg-blue-500/20 ring-2 ring-blue-500/50' 
                                    : 'bg-black/20 hover:bg-white/5'
                                } ${cellType === 'error' ? 'text-red-400' : 'text-white'} ${
                                  cellType === 'formula' ? 'bg-purple-500/10' : ''
                                }`}
                                onClick={() => handleCellClick(addr)}
                                onDoubleClick={() => handleCellDoubleClick(addr)}
                                data-testid={`calc-cell-${addr}`}
                              >
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={formulaInput}
                                    onChange={(e) => setFormulaInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCellSubmit();
                                      if (e.key === 'Escape') setEditingCell(null);
                                    }}
                                    onBlur={handleCellSubmit}
                                    autoFocus
                                    className="w-full h-full bg-transparent border-none text-white text-xs focus:outline-none font-mono"
                                    data-testid={`calc-cell-input-${addr}`}
                                  />
                                ) : (
                                  <span className="truncate block font-mono text-[11px]">{cellValue}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-white/40">
                    {cells.length} cells • v{sheet.version}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMutation.mutate('csv')}
                      disabled={exportMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="calc-export-csv-btn"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMutation.mutate('xlsx')}
                      disabled={exportMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="calc-export-xlsx-btn"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      XLSX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMutation.mutate('pdf')}
                      disabled={exportMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="calc-export-pdf-btn"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="charts" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap" data-testid="calc-chart-buttons">
                      {(['bar', 'line', 'pie', 'area', 'column', 'scatter'] as const).map((chartType) => (
                        <Button
                          key={chartType}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedCell) {
                              createChartMutation.mutate({
                                chartType,
                                title: `${chartType} Chart`,
                                dataRange: selectedCell.includes(':') ? selectedCell : `${selectedCell}:${selectedCell}`,
                              });
                            } else {
                              toast({ title: 'Select cells first', description: 'Select a range of cells to create a chart', variant: 'destructive' });
                            }
                          }}
                          disabled={createChartMutation.isPending}
                          className="h-8"
                          data-testid={`calc-create-${chartType}-chart-btn`}
                        >
                          {CHART_TYPE_ICONS[chartType]}
                          <span className="ml-1 capitalize">{chartType}</span>
                        </Button>
                      ))}
                    </div>

                    {!chartsData?.charts || chartsData.charts.length === 0 ? (
                      <div className="text-center text-white/40 py-8" data-testid="calc-no-charts">
                        No charts created yet. Select a range and click a chart type above.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        {chartsData.charts.map((chart) => (
                          <div
                            key={chart.id}
                            className="bg-white/5 rounded-lg p-4"
                            data-testid={`calc-chart-${chart.id}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {CHART_TYPE_ICONS[chart.chartType]}
                                <span className="text-sm text-white font-medium">
                                  {chart.title || `${chart.chartType} Chart`}
                                </span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteChartMutation.mutate(chart.id)}
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                                data-testid={`calc-delete-chart-btn-${chart.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                            <div className="text-xs text-white/40 space-y-1">
                              <div>Data: <span className="font-mono">{chart.dataRange}</span></div>
                              {chart.labelRange && (
                                <div>Labels: <span className="font-mono">{chart.labelRange}</span></div>
                              )}
                            </div>
                            <div className="mt-3 h-24 bg-black/30 rounded flex items-center justify-center text-white/20">
                              <div className="text-center">
                                {CHART_TYPE_ICONS[chart.chartType]}
                                <div className="text-[10px] mt-1">Preview</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="receipts" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {receipts.length === 0 ? (
                    <div className="text-center text-white/40 py-8" data-testid="calc-no-receipts">
                      No receipts recorded yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="bg-white/5 rounded-lg p-3"
                          data-testid={`calc-receipt-${receipt.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400">{receipt.op}</Badge>
                            <span className="text-xs text-white/40">
                              {new Date(receipt.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {receipt.meta && Object.keys(receipt.meta).length > 0 && (
                            <div className="mt-2 text-xs text-white/40 font-mono bg-black/20 rounded p-2 overflow-x-auto">
                              {JSON.stringify(receipt.meta, null, 2).slice(0, 150)}
                            </div>
                          )}
                          <div className="text-[10px] text-white/30 mt-1 truncate">
                            Hash: {receipt.nextHash}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {showCharts && chartsData?.charts && chartsData.charts.length > 0 && (
            <div className="w-56 shrink-0 bg-white/5 rounded-lg p-2" data-testid="calc-charts-sidebar">
              <h4 className="text-xs font-medium text-white/60 mb-2 px-2 flex items-center justify-between">
                Chart Preview
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCharts(false)}
                  className="h-5 w-5 p-0"
                  data-testid="calc-close-charts-btn"
                >
                  <X className="w-3 h-3" />
                </Button>
              </h4>
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {chartsData.charts.map((chart) => (
                    <div
                      key={chart.id}
                      className="bg-white/5 rounded p-2"
                      data-testid={`calc-chart-preview-${chart.id}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {CHART_TYPE_ICONS[chart.chartType]}
                        <span className="text-xs text-white truncate">{chart.title || chart.chartType}</span>
                      </div>
                      <div className="h-20 bg-black/30 rounded flex items-center justify-center">
                        <span className="text-[10px] text-white/30">Chart visualization</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CalcSheetCard;
