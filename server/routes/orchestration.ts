import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { orchestrationService } from '../atlas/suite/orchestration/service';

const router = Router();

const walletScopeSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  sessionId: z.string().min(1, 'Session ID is required'),
  profileId: z.string().optional()
});

const createFlowSchema = z.object({
  scope: walletScopeSchema,
  name: z.string().min(1, 'Flow name is required'),
  linkedArtifactIds: z.array(z.string().uuid()).optional()
});

const addStepSchema = z.object({
  step: z.object({
    sourceArtifactId: z.string().uuid().optional(),
    targetArtifactId: z.string().uuid().optional(),
    adapterId: z.string().optional(),
    payload: z.record(z.unknown()).optional()
  })
});

const executeFlowSchema = z.object({
  scope: walletScopeSchema
});

const cancelFlowSchema = z.object({
  scope: walletScopeSchema
});

const listFlowsSchema = z.object({
  scope: walletScopeSchema
});

const registerAdapterSchema = z.object({
  adapterId: z.string().min(1, 'Adapter ID is required'),
  name: z.string().min(1, 'Adapter name is required'),
  version: z.string().min(1, 'Version is required'),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional()
});

router.post('/flows', async (req: Request, res: Response) => {
  try {
    const parsed = createFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const { scope, name, linkedArtifactIds } = parsed.data;
    const result = await orchestrationService.createFlow(scope, name, linkedArtifactIds);

    res.status(201).json({
      ok: true,
      flow: result.flow,
      'data-testid': 'orchestration-create-flow-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.get('/flows/:flowId', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    
    if (!flowId || !/^[0-9a-f-]{36}$/i.test(flowId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid flow ID',
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const result = await orchestrationService.getFlow(flowId);

    if (!result) {
      res.status(404).json({
        ok: false,
        error: 'Flow not found',
        'data-testid': 'orchestration-not-found'
      });
      return;
    }

    res.json({
      ok: true,
      flow: result.flow,
      steps: result.steps,
      'data-testid': 'orchestration-get-flow-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.post('/flows/list', async (req: Request, res: Response) => {
  try {
    const parsed = listFlowsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    const flows = await orchestrationService.listFlows(scope);

    res.json({
      ok: true,
      flows,
      count: flows.length,
      'data-testid': 'orchestration-list-flows-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.post('/flows/:flowId/steps', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    
    if (!flowId || !/^[0-9a-f-]{36}$/i.test(flowId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid flow ID',
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const parsed = addStepSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const { step } = parsed.data;
    const result = await orchestrationService.addStep(flowId, step);

    res.status(201).json({
      ok: true,
      step: result.step,
      'data-testid': 'orchestration-add-step-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.post('/flows/:flowId/execute', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    
    if (!flowId || !/^[0-9a-f-]{36}$/i.test(flowId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid flow ID',
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const parsed = executeFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    const result = await orchestrationService.executeFlow(flowId, scope);

    res.json({
      ok: true,
      flow: result.flow,
      steps: result.steps,
      receipts: result.receipts,
      completedAt: result.completedAt,
      'data-testid': 'orchestration-execute-flow-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.post('/flows/:flowId/cancel', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    
    if (!flowId || !/^[0-9a-f-]{36}$/i.test(flowId)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid flow ID',
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const parsed = cancelFlowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const { scope } = parsed.data;
    const result = await orchestrationService.cancelFlow(flowId, scope);

    res.json({
      ok: true,
      flow: result.flow,
      'data-testid': 'orchestration-cancel-flow-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.get('/adapters', async (req: Request, res: Response) => {
  try {
    const adapters = await orchestrationService.listAdapters();

    res.json({
      ok: true,
      adapters,
      count: adapters.length,
      'data-testid': 'orchestration-list-adapters-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

router.post('/adapters', async (req: Request, res: Response) => {
  try {
    const parsed = registerAdapterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Validation error',
        details: parsed.error.errors,
        'data-testid': 'orchestration-validation-error'
      });
      return;
    }

    const result = await orchestrationService.registerAdapter(parsed.data);

    res.status(201).json({
      ok: true,
      adapter: result.adapter,
      'data-testid': 'orchestration-register-adapter-response'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      ok: false,
      error: message,
      'data-testid': 'orchestration-error'
    });
  }
});

export default router;
