import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { calcEngine } from '../atlas/suite/calc';

const router = Router();

const walletScopeSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  sessionId: z.string().min(1, 'Session ID is required'),
  profileId: z.string().optional()
});

const createSheetSchema = z.object({
  scope: walletScopeSchema,
  init: z.object({
    title: z.string().optional(),
    config: z.record(z.unknown()).optional()
  }).optional()
});

const setCellSchema = z.object({
  scope: walletScopeSchema,
  cell: z.object({
    addr: z.string().regex(/^[A-Z]+\d+$/i, 'Invalid cell address (e.g., A1, B2)'),
    value: z.any(),
    formula: z.string().optional(),
    format: z.record(z.unknown()).optional(),
    style: z.record(z.unknown()).optional()
  })
});

const defineNamedRangeSchema = z.object({
  scope: walletScopeSchema,
  name: z.string().min(1, 'Name is required'),
  range: z.string().min(1, 'Range is required'),
  description: z.string().optional()
});

const createChartSchema = z.object({
  scope: walletScopeSchema,
  chart: z.object({
    chartType: z.enum(['bar', 'line', 'pie', 'scatter', 'area', 'column', 'donut', 'radar']).optional(),
    title: z.string().optional(),
    dataRange: z.string().min(1, 'Data range is required'),
    labelRange: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    position: z.record(z.unknown()).optional()
  })
});

const updateChartSchema = z.object({
  scope: walletScopeSchema,
  updates: z.object({
    chartType: z.enum(['bar', 'line', 'pie', 'scatter', 'area', 'column', 'donut', 'radar']).optional(),
    title: z.string().optional(),
    dataRange: z.string().optional(),
    labelRange: z.string().optional(),
    config: z.record(z.unknown()).optional(),
    position: z.record(z.unknown()).optional()
  })
});

const formatCellsSchema = z.object({
  scope: walletScopeSchema,
  range: z.string().min(1, 'Range is required'),
  format: z.record(z.unknown())
});

const styleCellsSchema = z.object({
  scope: walletScopeSchema,
  range: z.string().min(1, 'Range is required'),
  style: z.record(z.unknown())
});

const exportSheetSchema = z.object({
  scope: walletScopeSchema,
  format: z.enum(['csv', 'xlsx', 'pdf'])
});

const listSheetsSchema = z.object({
  scope: walletScopeSchema
});

const clearCellsSchema = z.object({
  scope: walletScopeSchema,
  range: z.string().min(1, 'Range is required')
});

const renderChartPreviewSchema = z.object({
  scope: walletScopeSchema
});

const deleteChartSchema = z.object({
  scope: walletScopeSchema
});

const deleteSheetSchema = z.object({
  scope: walletScopeSchema
});

router.post('/sheets', async (req: Request, res: Response) => {
  try {
    const parsed = createSheetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, init } = parsed.data;
    const result = await calcEngine.createSheet(scope, init);

    res.status(201).json({
      ok: true,
      sheet: result.sheet,
      artifact: result.artifact,
      receipt: result.receipt,
      'data-testid': 'calc-create-sheet-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.get('/sheets/:sheetId', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const result = await calcEngine.getSheet(sheetId);

    if (!result) {
      res.status(404).json({
        ok: false,
        error: 'Sheet not found',
        'data-testid': 'calc-not-found'
      });
      return;
    }

    res.json({
      ok: true,
      sheet: result.sheet,
      cells: result.cells,
      'data-testid': 'calc-get-sheet-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/list', async (req: Request, res: Response) => {
  try {
    const parsed = listSheetsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    const sheets = await calcEngine.listSheets(scope);

    res.json({
      ok: true,
      sheets,
      count: sheets.length,
      'data-testid': 'calc-list-sheets-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/set-cell', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = setCellSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, cell } = parsed.data;
    const result = await calcEngine.setCell(sheetId, scope, cell);

    res.json({
      ok: true,
      cell: result.cell,
      receipt: result.receipt,
      recalculated: result.recalculated,
      'data-testid': 'calc-set-cell-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/define-range', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = defineNamedRangeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, name, range, description } = parsed.data;
    const result = await calcEngine.defineNamedRange(sheetId, scope, name, range, description);

    res.json({
      ok: true,
      namedRange: result.namedRange,
      receipt: result.receipt,
      'data-testid': 'calc-define-range-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.get('/sheets/:sheetId/named-ranges', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const namedRanges = await calcEngine.getNamedRanges(sheetId);

    res.json({
      ok: true,
      namedRanges,
      count: namedRanges.length,
      'data-testid': 'calc-named-ranges-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/charts', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = createChartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, chart } = parsed.data;
    const result = await calcEngine.createChart(sheetId, scope, chart);

    res.status(201).json({
      ok: true,
      chart: result.chart,
      receipt: result.receipt,
      'data-testid': 'calc-create-chart-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.get('/sheets/:sheetId/charts', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const charts = await calcEngine.getCharts(sheetId);

    res.json({
      ok: true,
      charts,
      count: charts.length,
      'data-testid': 'calc-list-charts-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.get('/sheets/:sheetId/charts/:chartId', async (req: Request, res: Response) => {
  try {
    const { sheetId, chartId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }
    
    if (!chartId || !/^[0-9a-f-]{36}$/i.test(chartId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid chart ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const chart = await calcEngine.getChart(chartId);

    if (!chart || chart.sheetId !== sheetId) {
      res.status(404).json({
        ok: false,
        error: 'Chart not found',
        'data-testid': 'calc-not-found'
      });
      return;
    }

    res.json({
      ok: true,
      chart,
      'data-testid': 'calc-get-chart-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.patch('/sheets/:sheetId/charts/:chartId', async (req: Request, res: Response) => {
  try {
    const { sheetId, chartId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }
    
    if (!chartId || !/^[0-9a-f-]{36}$/i.test(chartId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid chart ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = updateChartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, updates } = parsed.data;
    const result = await calcEngine.updateChart(chartId, scope, updates);

    res.json({
      ok: true,
      chart: result.chart,
      'data-testid': 'calc-update-chart-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/charts/:chartId/delete', async (req: Request, res: Response) => {
  try {
    const { sheetId, chartId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }
    
    if (!chartId || !/^[0-9a-f-]{36}$/i.test(chartId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid chart ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = deleteChartSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    await calcEngine.deleteChart(chartId, scope);

    res.json({
      ok: true,
      deleted: true,
      'data-testid': 'calc-delete-chart-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/charts/:chartId/preview', async (req: Request, res: Response) => {
  try {
    const { sheetId, chartId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }
    
    if (!chartId || !/^[0-9a-f-]{36}$/i.test(chartId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid chart ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = renderChartPreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    const result = await calcEngine.renderChartPreview(sheetId, scope, chartId);

    res.json({
      ok: true,
      chartData: result.chartData,
      labels: result.labels,
      values: result.values,
      'data-testid': 'calc-chart-preview-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/format-cells', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = formatCellsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, range, format } = parsed.data;
    const result = await calcEngine.formatCells(sheetId, scope, range, format);

    res.json({
      ok: true,
      updatedCells: result.updatedCells,
      receipt: result.receipt,
      'data-testid': 'calc-format-cells-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/style-cells', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = styleCellsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, range, style } = parsed.data;
    const result = await calcEngine.styleCells(sheetId, scope, range, style);

    res.json({
      ok: true,
      updatedCells: result.updatedCells,
      'data-testid': 'calc-style-cells-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/export', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = exportSheetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, format } = parsed.data;
    const result = await calcEngine.exportSheet(sheetId, scope, format);

    res.json({
      ok: true,
      format: result.format,
      content: result.content,
      filename: result.filename,
      mimeType: result.mimeType,
      'data-testid': 'calc-export-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/clear-cells', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = clearCellsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope, range } = parsed.data;
    const result = await calcEngine.clearCells(sheetId, scope, range);

    res.json({
      ok: true,
      clearedCount: result.clearedCount,
      'data-testid': 'calc-clear-cells-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.post('/sheets/:sheetId/delete', async (req: Request, res: Response) => {
  try {
    const { sheetId } = req.params;
    
    if (!sheetId || !/^[0-9a-f-]{36}$/i.test(sheetId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid sheet ID',
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const parsed = deleteSheetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'calc-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    await calcEngine.deleteSheet(sheetId, scope);

    res.json({
      ok: true,
      deleted: true,
      'data-testid': 'calc-delete-sheet-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'calc-error'
    });
  }
});

router.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'calc',
    timestamp: Date.now(),
    'data-testid': 'calc-health-response'
  });
});

export default router;
