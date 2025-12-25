import { db } from '../../../db';
import { 
  calcSheets, 
  calcCells, 
  calcNamedRanges, 
  calcCharts, 
  atlasArtifacts, 
  atlasReceipts, 
  walletScopes,
  type CalcSheet,
  type CalcCell,
  type CalcNamedRange,
  type CalcChart,
  type AtlasArtifact,
  type AtlasReceipt,
  type WalletScope as WalletScopeRecord
} from '@shared/schema';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { createHash } from 'crypto';

export interface WalletScope {
  walletAddress: string;
  sessionId: string;
  profileId?: string;
}

export interface CellInput {
  addr: string;
  value: any;
  formula?: string;
  format?: Record<string, unknown>;
  style?: Record<string, unknown>;
}

export interface ChartInput {
  chartType?: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'column' | 'donut' | 'radar';
  title?: string;
  dataRange: string;
  labelRange?: string;
  config?: Record<string, unknown>;
  position?: Record<string, unknown>;
}

export interface CreateSheetInit {
  title?: string;
  config?: Record<string, unknown>;
}

export interface SheetExport {
  format: 'csv' | 'xlsx' | 'pdf';
  content: string;
  filename: string;
  mimeType: string;
}

export interface FormulaParseResult {
  dependencies: string[];
  evaluate: (getCellValue: (addr: string) => any) => any;
}

function computeHash(content: string, prevHash?: string): string {
  return createHash('sha256').update((prevHash || '') + content).digest('hex');
}

function parseAddr(addr: string): { col: string; row: number } {
  const match = addr.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Invalid cell address: ${addr}`);
  return { col: match[1].toUpperCase(), row: parseInt(match[2], 10) };
}

function colToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + (col.charCodeAt(i) - 64);
  }
  return index - 1;
}

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

function expandRange(rangeExpr: string): string[] {
  const parts = rangeExpr.split(':');
  if (parts.length !== 2) return [rangeExpr];
  
  const start = parseAddr(parts[0]);
  const end = parseAddr(parts[1]);
  
  const startColIdx = colToIndex(start.col);
  const endColIdx = colToIndex(end.col);
  const startRow = start.row;
  const endRow = end.row;
  
  const cells: string[] = [];
  for (let col = startColIdx; col <= endColIdx; col++) {
    for (let row = startRow; row <= endRow; row++) {
      cells.push(`${indexToCol(col)}${row}`);
    }
  }
  return cells;
}

function parseFormula(formula: string): FormulaParseResult {
  const cellRefRegex = /([A-Z]+\d+(?::[A-Z]+\d+)?)/gi;
  const matches = formula.match(cellRefRegex) || [];
  
  const dependencies: string[] = [];
  for (const match of matches) {
    if (match.includes(':')) {
      dependencies.push(...expandRange(match));
    } else {
      dependencies.push(match.toUpperCase());
    }
  }
  
  const evaluate = (getCellValue: (addr: string) => any): any => {
    try {
      let expr = formula.startsWith('=') ? formula.slice(1) : formula;
      
      const sumMatch = expr.match(/^SUM\(([^)]+)\)$/i);
      if (sumMatch) {
        const rangeOrList = sumMatch[1];
        let cells: string[] = [];
        
        if (rangeOrList.includes(':')) {
          cells = expandRange(rangeOrList);
        } else {
          cells = rangeOrList.split(',').map(c => c.trim().toUpperCase());
        }
        
        return cells.reduce((acc, addr) => {
          const val = getCellValue(addr);
          return acc + (typeof val === 'number' ? val : parseFloat(val) || 0);
        }, 0);
      }
      
      const avgMatch = expr.match(/^(AVERAGE|AVG)\(([^)]+)\)$/i);
      if (avgMatch) {
        const rangeOrList = avgMatch[2];
        let cells: string[] = [];
        
        if (rangeOrList.includes(':')) {
          cells = expandRange(rangeOrList);
        } else {
          cells = rangeOrList.split(',').map(c => c.trim().toUpperCase());
        }
        
        const sum = cells.reduce((acc, addr) => {
          const val = getCellValue(addr);
          return acc + (typeof val === 'number' ? val : parseFloat(val) || 0);
        }, 0);
        
        return cells.length > 0 ? sum / cells.length : 0;
      }
      
      const countMatch = expr.match(/^COUNT\(([^)]+)\)$/i);
      if (countMatch) {
        const rangeOrList = countMatch[1];
        let cells: string[] = [];
        
        if (rangeOrList.includes(':')) {
          cells = expandRange(rangeOrList);
        } else {
          cells = rangeOrList.split(',').map(c => c.trim().toUpperCase());
        }
        
        return cells.filter(addr => {
          const val = getCellValue(addr);
          return val !== null && val !== undefined && val !== '';
        }).length;
      }
      
      const maxMatch = expr.match(/^MAX\(([^)]+)\)$/i);
      if (maxMatch) {
        const rangeOrList = maxMatch[1];
        let cells: string[] = [];
        
        if (rangeOrList.includes(':')) {
          cells = expandRange(rangeOrList);
        } else {
          cells = rangeOrList.split(',').map(c => c.trim().toUpperCase());
        }
        
        const values = cells.map(addr => {
          const val = getCellValue(addr);
          return typeof val === 'number' ? val : parseFloat(val) || -Infinity;
        });
        
        return Math.max(...values);
      }
      
      const minMatch = expr.match(/^MIN\(([^)]+)\)$/i);
      if (minMatch) {
        const rangeOrList = minMatch[1];
        let cells: string[] = [];
        
        if (rangeOrList.includes(':')) {
          cells = expandRange(rangeOrList);
        } else {
          cells = rangeOrList.split(',').map(c => c.trim().toUpperCase());
        }
        
        const values = cells.map(addr => {
          const val = getCellValue(addr);
          return typeof val === 'number' ? val : parseFloat(val) || Infinity;
        });
        
        return Math.min(...values);
      }
      
      let resolved = expr.replace(cellRefRegex, (match) => {
        const val = getCellValue(match.toUpperCase());
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string' && !isNaN(parseFloat(val))) return val;
        return '0';
      });
      
      resolved = resolved.replace(/[^0-9+\-*/().]/g, '');
      
      const safeEval = new Function(`return ${resolved}`);
      return safeEval();
    } catch (error) {
      return { error: 'FORMULA_ERROR', message: error instanceof Error ? error.message : 'Unknown error' };
    }
  };
  
  return { dependencies, evaluate };
}

function detectCellType(value: any, formula?: string): 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'error' {
  if (formula) return 'formula';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'date';
  if (typeof value === 'string') {
    if (!isNaN(parseFloat(value)) && isFinite(Number(value))) return 'number';
    if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') return 'boolean';
    const dateTest = Date.parse(value);
    if (!isNaN(dateTest) && value.includes('/') || value.includes('-')) return 'date';
  }
  return 'string';
}

function cellToCSV(cell: CalcCell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const val = typeof cell.value === 'object' ? JSON.stringify(cell.value) : String(cell.value);
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export class CalcEngine {
  private async getOrCreateWalletScope(scope: WalletScope): Promise<WalletScopeRecord> {
    const existing = await db.select()
      .from(walletScopes)
      .where(and(
        eq(walletScopes.walletAddress, scope.walletAddress.toLowerCase()),
        eq(walletScopes.sessionId, scope.sessionId)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [created] = await db.insert(walletScopes).values({
      walletAddress: scope.walletAddress.toLowerCase(),
      sessionId: scope.sessionId,
      profileId: scope.profileId || null
    }).returning();
    
    return created;
  }

  private async getLatestReceiptHash(artifactId: string): Promise<string | undefined> {
    const latest = await db.select()
      .from(atlasReceipts)
      .where(eq(atlasReceipts.artifactId, artifactId))
      .orderBy(desc(atlasReceipts.createdAt))
      .limit(1);
    
    return latest.length > 0 ? latest[0].nextHash : undefined;
  }

  private async createReceipt(
    artifactId: string, 
    scopeId: string, 
    op: 'setCell' | 'createChart' | 'defineRange' | 'createSheet' | 'exportSheet',
    meta?: Record<string, unknown>
  ): Promise<AtlasReceipt> {
    const prevHash = await this.getLatestReceiptHash(artifactId);
    const nextHash = computeHash(JSON.stringify({ op, meta, artifactId, timestamp: Date.now() }), prevHash);
    
    const [receipt] = await db.insert(atlasReceipts).values({
      artifactId,
      op,
      prevHash: prevHash || null,
      nextHash,
      actorScopeId: scopeId,
      meta: meta || null
    }).returning();
    
    return receipt;
  }

  async createSheet(scope: WalletScope, init?: CreateSheetInit): Promise<{ sheet: CalcSheet; artifact: AtlasArtifact; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const [artifact] = await db.insert(atlasArtifacts).values({
      type: 'calc.sheet',
      ownerId: walletScopeRecord.id,
      title: init?.title || 'Untitled Spreadsheet',
      visibility: 'private'
    }).returning();
    
    const [sheet] = await db.insert(calcSheets).values({
      artifactId: artifact.id,
      version: 1,
      depsHash: null,
      config: init?.config || null
    }).returning();
    
    const receipt = await this.createReceipt(artifact.id, walletScopeRecord.id, 'createSheet', {
      title: init?.title
    });
    
    return { sheet, artifact, receipt };
  }

  async getSheet(sheetId: string): Promise<{ sheet: CalcSheet; cells: CalcCell[] } | null> {
    const sheets = await db.select()
      .from(calcSheets)
      .where(eq(calcSheets.id, sheetId))
      .limit(1);
    
    if (sheets.length === 0) return null;
    
    const cells = await db.select()
      .from(calcCells)
      .where(eq(calcCells.sheetId, sheetId))
      .orderBy(asc(calcCells.addr));
    
    return { sheet: sheets[0], cells };
  }

  async setCell(
    sheetId: string, 
    scope: WalletScope, 
    cell: CellInput
  ): Promise<{ cell: CalcCell; receipt: AtlasReceipt; recalculated: CalcCell[] }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const sheets = await db.select()
      .from(calcSheets)
      .where(eq(calcSheets.id, sheetId))
      .limit(1);
    
    if (sheets.length === 0) {
      throw new Error(`Sheet ${sheetId} not found`);
    }
    
    const sheet = sheets[0];
    const normalizedAddr = cell.addr.toUpperCase();
    const cellType = detectCellType(cell.value, cell.formula);
    
    const existing = await db.select()
      .from(calcCells)
      .where(and(
        eq(calcCells.sheetId, sheetId),
        eq(calcCells.addr, normalizedAddr)
      ))
      .limit(1);
    
    let updatedCell: CalcCell;
    
    if (existing.length > 0) {
      const [updated] = await db.update(calcCells)
        .set({
          cellType,
          value: cell.value,
          formula: cell.formula || null,
          format: cell.format || null,
          style: cell.style || null,
          errorCode: null,
          errorMessage: null,
          updatedAt: new Date()
        })
        .where(eq(calcCells.id, existing[0].id))
        .returning();
      updatedCell = updated;
    } else {
      const [created] = await db.insert(calcCells).values({
        sheetId,
        addr: normalizedAddr,
        cellType,
        value: cell.value,
        formula: cell.formula || null,
        format: cell.format || null,
        style: cell.style || null
      }).returning();
      updatedCell = created;
    }
    
    const recalculated = await this.recalc(sheetId, [normalizedAddr]);
    
    const receipt = await this.createReceipt(sheet.artifactId, walletScopeRecord.id, 'setCell', {
      addr: normalizedAddr,
      cellType,
      hasFormula: !!cell.formula
    });
    
    await this.updateDepsHash(sheetId);
    
    return { cell: updatedCell, receipt, recalculated };
  }

  async recalc(sheetId: string, touchedCells: string[]): Promise<CalcCell[]> {
    const allCells = await db.select()
      .from(calcCells)
      .where(eq(calcCells.sheetId, sheetId));
    
    const cellMap = new Map<string, CalcCell>();
    const formulaCells: CalcCell[] = [];
    
    for (const cell of allCells) {
      cellMap.set(cell.addr, cell);
      if (cell.formula) {
        formulaCells.push(cell);
      }
    }
    
    const dependents = new Map<string, Set<string>>();
    
    for (const cell of formulaCells) {
      if (!cell.formula) continue;
      const parsed = parseFormula(cell.formula);
      for (const dep of parsed.dependencies) {
        if (!dependents.has(dep)) {
          dependents.set(dep, new Set());
        }
        dependents.get(dep)!.add(cell.addr);
      }
    }
    
    const toRecalc = new Set<string>();
    const queue = [...touchedCells.map(c => c.toUpperCase())];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const deps = dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!toRecalc.has(dep)) {
            toRecalc.add(dep);
            queue.push(dep);
          }
        }
      }
    }
    
    const getCellValue = (addr: string): any => {
      const cell = cellMap.get(addr.toUpperCase());
      if (!cell) return null;
      return cell.value;
    };
    
    const updated: CalcCell[] = [];
    
    for (const addr of toRecalc) {
      const cell = cellMap.get(addr);
      if (!cell || !cell.formula) continue;
      
      const parsed = parseFormula(cell.formula);
      const result = parsed.evaluate(getCellValue);
      
      let errorCode: string | null = null;
      let errorMessage: string | null = null;
      let newValue: any = result;
      let newType: 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'error' = 'formula';
      
      if (result && typeof result === 'object' && result.error) {
        errorCode = result.error;
        errorMessage = result.message;
        newValue = null;
        newType = 'error';
      }
      
      const [updatedCell] = await db.update(calcCells)
        .set({
          value: newValue,
          cellType: newType,
          errorCode,
          errorMessage,
          updatedAt: new Date()
        })
        .where(eq(calcCells.id, cell.id))
        .returning();
      
      cellMap.set(addr, updatedCell);
      updated.push(updatedCell);
    }
    
    return updated;
  }

  private async updateDepsHash(sheetId: string): Promise<void> {
    const cells = await db.select()
      .from(calcCells)
      .where(eq(calcCells.sheetId, sheetId))
      .orderBy(asc(calcCells.addr));
    
    const deps: string[] = [];
    for (const cell of cells) {
      if (cell.formula) {
        const parsed = parseFormula(cell.formula);
        deps.push(`${cell.addr}:${parsed.dependencies.join(',')}`);
      }
    }
    
    const depsHash = computeHash(deps.join('|'));
    
    await db.update(calcSheets)
      .set({ depsHash, updatedAt: new Date() })
      .where(eq(calcSheets.id, sheetId));
  }

  async defineNamedRange(
    sheetId: string, 
    scope: WalletScope, 
    name: string, 
    range: string,
    description?: string
  ): Promise<{ namedRange: CalcNamedRange; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const sheets = await db.select()
      .from(calcSheets)
      .where(eq(calcSheets.id, sheetId))
      .limit(1);
    
    if (sheets.length === 0) {
      throw new Error(`Sheet ${sheetId} not found`);
    }
    
    const existing = await db.select()
      .from(calcNamedRanges)
      .where(and(
        eq(calcNamedRanges.sheetId, sheetId),
        eq(calcNamedRanges.name, name)
      ))
      .limit(1);
    
    let namedRange: CalcNamedRange;
    
    if (existing.length > 0) {
      const [updated] = await db.update(calcNamedRanges)
        .set({
          rangeExpr: range,
          description: description || null,
          updatedAt: new Date()
        })
        .where(eq(calcNamedRanges.id, existing[0].id))
        .returning();
      namedRange = updated;
    } else {
      const [created] = await db.insert(calcNamedRanges).values({
        sheetId,
        name,
        rangeExpr: range,
        description: description || null
      }).returning();
      namedRange = created;
    }
    
    const receipt = await this.createReceipt(sheets[0].artifactId, walletScopeRecord.id, 'defineRange', {
      name,
      range
    });
    
    return { namedRange, receipt };
  }

  async getNamedRanges(sheetId: string): Promise<CalcNamedRange[]> {
    return db.select()
      .from(calcNamedRanges)
      .where(eq(calcNamedRanges.sheetId, sheetId))
      .orderBy(asc(calcNamedRanges.name));
  }

  async createChart(
    sheetId: string, 
    scope: WalletScope, 
    chart: ChartInput
  ): Promise<{ chart: CalcChart; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const sheets = await db.select()
      .from(calcSheets)
      .where(eq(calcSheets.id, sheetId))
      .limit(1);
    
    if (sheets.length === 0) {
      throw new Error(`Sheet ${sheetId} not found`);
    }
    
    const [createdChart] = await db.insert(calcCharts).values({
      sheetId,
      chartType: chart.chartType || 'bar',
      title: chart.title || null,
      dataRange: chart.dataRange,
      labelRange: chart.labelRange || null,
      config: chart.config || null,
      position: chart.position || null
    }).returning();
    
    const receipt = await this.createReceipt(sheets[0].artifactId, walletScopeRecord.id, 'createChart', {
      chartType: chart.chartType || 'bar',
      dataRange: chart.dataRange
    });
    
    return { chart: createdChart, receipt };
  }

  async getChart(chartId: string): Promise<CalcChart | null> {
    const charts = await db.select()
      .from(calcCharts)
      .where(eq(calcCharts.id, chartId))
      .limit(1);
    
    return charts.length > 0 ? charts[0] : null;
  }

  async getCharts(sheetId: string): Promise<CalcChart[]> {
    return db.select()
      .from(calcCharts)
      .where(eq(calcCharts.sheetId, sheetId))
      .orderBy(asc(calcCharts.createdAt));
  }

  async updateChart(
    chartId: string,
    scope: WalletScope,
    updates: Partial<ChartInput>
  ): Promise<{ chart: CalcChart }> {
    await this.getOrCreateWalletScope(scope);
    
    const charts = await db.select()
      .from(calcCharts)
      .where(eq(calcCharts.id, chartId))
      .limit(1);
    
    if (charts.length === 0) {
      throw new Error(`Chart ${chartId} not found`);
    }
    
    const [updated] = await db.update(calcCharts)
      .set({
        chartType: updates.chartType || charts[0].chartType,
        title: updates.title !== undefined ? updates.title : charts[0].title,
        dataRange: updates.dataRange || charts[0].dataRange,
        labelRange: updates.labelRange !== undefined ? updates.labelRange : charts[0].labelRange,
        config: updates.config !== undefined ? updates.config : charts[0].config,
        position: updates.position !== undefined ? updates.position : charts[0].position,
        updatedAt: new Date()
      })
      .where(eq(calcCharts.id, chartId))
      .returning();
    
    return { chart: updated };
  }

  async deleteChart(chartId: string, scope: WalletScope): Promise<void> {
    await this.getOrCreateWalletScope(scope);
    
    await db.delete(calcCharts)
      .where(eq(calcCharts.id, chartId));
  }

  async renderChartPreview(
    sheetId: string, 
    scope: WalletScope, 
    chartId: string
  ): Promise<{ chartData: any; labels: any[]; values: any[][] }> {
    await this.getOrCreateWalletScope(scope);
    
    const charts = await db.select()
      .from(calcCharts)
      .where(and(
        eq(calcCharts.id, chartId),
        eq(calcCharts.sheetId, sheetId)
      ))
      .limit(1);
    
    if (charts.length === 0) {
      throw new Error(`Chart ${chartId} not found in sheet ${sheetId}`);
    }
    
    const chart = charts[0];
    
    const allCells = await db.select()
      .from(calcCells)
      .where(eq(calcCells.sheetId, sheetId));
    
    const cellMap = new Map<string, any>();
    for (const cell of allCells) {
      cellMap.set(cell.addr, cell.value);
    }
    
    const dataCells = expandRange(chart.dataRange);
    const values: any[][] = [];
    
    let currentRow = -1;
    let currentRowData: any[] = [];
    
    for (const addr of dataCells) {
      const { row } = parseAddr(addr);
      if (currentRow !== row) {
        if (currentRowData.length > 0) {
          values.push(currentRowData);
        }
        currentRowData = [];
        currentRow = row;
      }
      currentRowData.push(cellMap.get(addr) ?? null);
    }
    if (currentRowData.length > 0) {
      values.push(currentRowData);
    }
    
    let labels: any[] = [];
    if (chart.labelRange) {
      const labelCells = expandRange(chart.labelRange);
      labels = labelCells.map(addr => cellMap.get(addr) ?? '');
    }
    
    return {
      chartData: chart,
      labels,
      values
    };
  }

  async formatCells(
    sheetId: string, 
    scope: WalletScope, 
    range: string, 
    format: Record<string, unknown>
  ): Promise<{ updatedCells: CalcCell[]; receipt: AtlasReceipt }> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const sheets = await db.select()
      .from(calcSheets)
      .where(eq(calcSheets.id, sheetId))
      .limit(1);
    
    if (sheets.length === 0) {
      throw new Error(`Sheet ${sheetId} not found`);
    }
    
    const cellAddrs = expandRange(range);
    const updatedCells: CalcCell[] = [];
    
    for (const addr of cellAddrs) {
      const existing = await db.select()
        .from(calcCells)
        .where(and(
          eq(calcCells.sheetId, sheetId),
          eq(calcCells.addr, addr)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        const currentFormat = (existing[0].format as Record<string, unknown>) || {};
        const mergedFormat = { ...currentFormat, ...format };
        
        const [updated] = await db.update(calcCells)
          .set({
            format: mergedFormat,
            updatedAt: new Date()
          })
          .where(eq(calcCells.id, existing[0].id))
          .returning();
        updatedCells.push(updated);
      } else {
        const [created] = await db.insert(calcCells).values({
          sheetId,
          addr,
          cellType: 'string',
          value: null,
          format
        }).returning();
        updatedCells.push(created);
      }
    }
    
    const receipt = await this.createReceipt(sheets[0].artifactId, walletScopeRecord.id, 'setCell', {
      range,
      formatApplied: true,
      cellCount: cellAddrs.length
    });
    
    return { updatedCells, receipt };
  }

  async styleCells(
    sheetId: string,
    scope: WalletScope,
    range: string,
    style: Record<string, unknown>
  ): Promise<{ updatedCells: CalcCell[] }> {
    await this.getOrCreateWalletScope(scope);
    
    const cellAddrs = expandRange(range);
    const updatedCells: CalcCell[] = [];
    
    for (const addr of cellAddrs) {
      const existing = await db.select()
        .from(calcCells)
        .where(and(
          eq(calcCells.sheetId, sheetId),
          eq(calcCells.addr, addr)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        const currentStyle = (existing[0].style as Record<string, unknown>) || {};
        const mergedStyle = { ...currentStyle, ...style };
        
        const [updated] = await db.update(calcCells)
          .set({
            style: mergedStyle,
            updatedAt: new Date()
          })
          .where(eq(calcCells.id, existing[0].id))
          .returning();
        updatedCells.push(updated);
      } else {
        const [created] = await db.insert(calcCells).values({
          sheetId,
          addr,
          cellType: 'string',
          value: null,
          style
        }).returning();
        updatedCells.push(created);
      }
    }
    
    return { updatedCells };
  }

  async exportSheet(
    sheetId: string, 
    scope: WalletScope, 
    format: 'csv' | 'xlsx' | 'pdf'
  ): Promise<SheetExport> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const sheetResult = await this.getSheet(sheetId);
    if (!sheetResult) {
      throw new Error(`Sheet ${sheetId} not found`);
    }
    
    const { sheet, cells } = sheetResult;
    
    const artifactResult = await db.select()
      .from(atlasArtifacts)
      .where(eq(atlasArtifacts.id, sheet.artifactId))
      .limit(1);
    
    const title = artifactResult[0]?.title || 'Untitled Spreadsheet';
    
    const cellMap = new Map<string, CalcCell>();
    let maxCol = 0;
    let maxRow = 0;
    
    for (const cell of cells) {
      cellMap.set(cell.addr, cell);
      const { col, row } = parseAddr(cell.addr);
      const colIdx = colToIndex(col);
      if (colIdx > maxCol) maxCol = colIdx;
      if (row > maxRow) maxRow = row;
    }
    
    let content: string;
    let mimeType: string;
    let filename: string;
    
    switch (format) {
      case 'csv': {
        const rows: string[] = [];
        for (let r = 1; r <= maxRow; r++) {
          const rowCells: string[] = [];
          for (let c = 0; c <= maxCol; c++) {
            const addr = `${indexToCol(c)}${r}`;
            rowCells.push(cellToCSV(cellMap.get(addr)));
          }
          rows.push(rowCells.join(','));
        }
        content = rows.join('\n');
        mimeType = 'text/csv';
        filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
        break;
      }
        
      case 'xlsx': {
        const rows: string[] = [];
        for (let r = 1; r <= maxRow; r++) {
          const rowCells: string[] = [];
          for (let c = 0; c <= maxCol; c++) {
            const addr = `${indexToCol(c)}${r}`;
            const cell = cellMap.get(addr);
            rowCells.push(cell?.value != null ? String(cell.value) : '');
          }
          rows.push(rowCells.join('\t'));
        }
        content = rows.join('\n');
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
        break;
      }
        
      case 'pdf': {
        const rows: string[] = [];
        for (let r = 1; r <= maxRow; r++) {
          const rowCells: string[] = [];
          for (let c = 0; c <= maxCol; c++) {
            const addr = `${indexToCol(c)}${r}`;
            const cell = cellMap.get(addr);
            rowCells.push(cell?.value != null ? String(cell.value) : '');
          }
          rows.push(rowCells.join(' | '));
        }
        content = rows.join('\n');
        mimeType = 'application/pdf';
        filename = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        break;
      }
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    await this.createReceipt(sheet.artifactId, walletScopeRecord.id, 'exportSheet', {
      format,
      cellCount: cells.length,
      filename
    });
    
    return { format, content, filename, mimeType };
  }

  async listSheets(scope: WalletScope): Promise<Array<{ sheet: CalcSheet; artifact: AtlasArtifact }>> {
    const walletScopeRecord = await this.getOrCreateWalletScope(scope);
    
    const artifacts = await db.select()
      .from(atlasArtifacts)
      .where(and(
        eq(atlasArtifacts.ownerId, walletScopeRecord.id),
        eq(atlasArtifacts.type, 'calc.sheet')
      ))
      .orderBy(desc(atlasArtifacts.updatedAt));
    
    const results: Array<{ sheet: CalcSheet; artifact: AtlasArtifact }> = [];
    
    for (const artifact of artifacts) {
      const sheets = await db.select()
        .from(calcSheets)
        .where(eq(calcSheets.artifactId, artifact.id))
        .limit(1);
      
      if (sheets.length > 0) {
        results.push({ sheet: sheets[0], artifact });
      }
    }
    
    return results;
  }

  async deleteSheet(sheetId: string, scope: WalletScope): Promise<void> {
    await this.getOrCreateWalletScope(scope);
    
    const sheets = await db.select()
      .from(calcSheets)
      .where(eq(calcSheets.id, sheetId))
      .limit(1);
    
    if (sheets.length === 0) {
      throw new Error(`Sheet ${sheetId} not found`);
    }
    
    await db.delete(calcCharts).where(eq(calcCharts.sheetId, sheetId));
    await db.delete(calcNamedRanges).where(eq(calcNamedRanges.sheetId, sheetId));
    await db.delete(calcCells).where(eq(calcCells.sheetId, sheetId));
    await db.delete(calcSheets).where(eq(calcSheets.id, sheetId));
    await db.delete(atlasArtifacts).where(eq(atlasArtifacts.id, sheets[0].artifactId));
  }

  async getCellsByRange(sheetId: string, range: string): Promise<CalcCell[]> {
    const cellAddrs = expandRange(range);
    
    return db.select()
      .from(calcCells)
      .where(and(
        eq(calcCells.sheetId, sheetId),
        inArray(calcCells.addr, cellAddrs)
      ))
      .orderBy(asc(calcCells.addr));
  }

  async clearCells(sheetId: string, scope: WalletScope, range: string): Promise<{ clearedCount: number }> {
    await this.getOrCreateWalletScope(scope);
    
    const cellAddrs = expandRange(range);
    
    const result = await db.delete(calcCells)
      .where(and(
        eq(calcCells.sheetId, sheetId),
        inArray(calcCells.addr, cellAddrs)
      ));
    
    return { clearedCount: cellAddrs.length };
  }
}

export const calcEngine = new CalcEngine();
