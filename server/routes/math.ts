import { Router, Request, Response } from 'express';
import { db } from '../db';
import { mathComputations, MathComputation, MathEngine, MathProvider } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';
import { createHash } from 'crypto';

const router = Router();

const logger = {
  info: (msg: string) => console.log(`[MATH] ${msg}`),
  error: (msg: string) => console.error(`[MATH ERROR] ${msg}`),
};

const computeRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  engine: z.enum(['symbolic', 'numeric', 'hybrid']).optional().default('hybrid'),
  provider: z.enum(['openai', 'anthropic', 'gemini', 'local']).optional(),
  context: z.record(z.any()).optional(),
});

type ComputeRequest = z.infer<typeof computeRequestSchema>;

interface MathIntent {
  type: string;
  inputs: Record<string, any>;
  operation: string;
  units?: Record<string, string>;
}

interface MathResult {
  intent: MathIntent;
  equations: string[];
  steps: Array<{ step: number; description: string; result: string }>;
  outputs: Record<string, any>;
  explanation?: string;
}

function parseIntent(query: string): MathIntent {
  const normalized = query.toLowerCase().trim();
  
  const patterns: Array<{ regex: RegExp; type: string; operation: string }> = [
    { regex: /delta[- ]?v|orbital|transfer orbit|hohmann/i, type: 'orbital', operation: 'transfer_orbit' },
    { regex: /escape velocity|escape speed/i, type: 'orbital', operation: 'escape_velocity' },
    { regex: /derivative|differentiate|d\/dx/i, type: 'calculus', operation: 'derivative' },
    { regex: /integral|integrate|∫/i, type: 'calculus', operation: 'integral' },
    { regex: /solve.*equation|find.*x|solve for/i, type: 'algebra', operation: 'solve' },
    { regex: /factor|factorize/i, type: 'algebra', operation: 'factor' },
    { regex: /simplify/i, type: 'algebra', operation: 'simplify' },
    { regex: /sin|cos|tan|arcsin|arccos|arctan/i, type: 'trigonometry', operation: 'trig' },
    { regex: /matrix|determinant|inverse|eigenvalue/i, type: 'linear_algebra', operation: 'matrix' },
    { regex: /probability|permutation|combination|factorial/i, type: 'statistics', operation: 'probability' },
    { regex: /mean|median|mode|variance|standard deviation/i, type: 'statistics', operation: 'descriptive' },
    { regex: /convert|to\s+(km|m|miles|feet|celsius|fahrenheit|kg|lb)/i, type: 'conversion', operation: 'unit_convert' },
    { regex: /^\s*[\d\s+\-*/^()%.]+\s*$/i, type: 'arithmetic', operation: 'evaluate' },
  ];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(normalized)) {
      return {
        type: pattern.type,
        inputs: extractInputs(query, pattern.type),
        operation: pattern.operation,
      };
    }
  }
  
  return {
    type: 'general',
    inputs: {},
    operation: 'compute',
  };
}

function extractInputs(query: string, intentType: string): Record<string, any> {
  const inputs: Record<string, any> = {};
  
  const numberPattern = /(\d+(?:\.\d+)?)\s*(km|m|miles|mi|kg|lb|s|seconds?|hours?|days?|°?[CFK])?/gi;
  let match;
  let index = 0;
  while ((match = numberPattern.exec(query)) !== null) {
    const value = parseFloat(match[1]);
    const unit = match[2] || '';
    inputs[`value_${index}`] = { value, unit };
    index++;
  }
  
  if (intentType === 'orbital') {
    const earthRadius = query.match(/earth.*?(\d+(?:,?\d+)*(?:\.\d+)?)\s*(km|m)?/i);
    const marsRadius = query.match(/mars.*?(\d+(?:,?\d+)*(?:\.\d+)?)\s*(km|m)?/i);
    if (earthRadius) inputs.earthOrbitRadius = parseFloat(earthRadius[1].replace(/,/g, ''));
    if (marsRadius) inputs.marsOrbitRadius = parseFloat(marsRadius[1].replace(/,/g, ''));
  }
  
  return inputs;
}

function evaluateArithmetic(expression: string): { result: number; steps: string[] } {
  const steps: string[] = [];
  let sanitized = expression.replace(/[^0-9+\-*/().%^\s]/g, '');
  sanitized = sanitized.replace(/\^/g, '**');
  
  steps.push(`Expression: ${expression}`);
  steps.push(`Sanitized: ${sanitized}`);
  
  try {
    const result = Function(`"use strict"; return (${sanitized})`)();
    steps.push(`Result: ${result}`);
    return { result: typeof result === 'number' ? result : NaN, steps };
  } catch {
    return { result: NaN, steps: [...steps, 'Error: Invalid expression'] };
  }
}

function computeOrbitalMechanics(intent: MathIntent): MathResult {
  const G = 6.674e-11;
  const M_sun = 1.989e30;
  const AU = 1.496e8;
  
  const r1 = intent.inputs.earthOrbitRadius || intent.inputs.value_0?.value || 149.6e6;
  const r2 = intent.inputs.marsOrbitRadius || intent.inputs.value_1?.value || 227.9e6;
  
  const r1_m = r1 * 1000;
  const r2_m = r2 * 1000;
  
  const mu = G * M_sun;
  const a = (r1_m + r2_m) / 2;
  
  const v_circular_1 = Math.sqrt(mu / r1_m);
  const v_transfer_perihelion = Math.sqrt(mu * (2 / r1_m - 1 / a));
  const delta_v1 = Math.abs(v_transfer_perihelion - v_circular_1);
  
  const v_circular_2 = Math.sqrt(mu / r2_m);
  const v_transfer_aphelion = Math.sqrt(mu * (2 / r2_m - 1 / a));
  const delta_v2 = Math.abs(v_circular_2 - v_transfer_aphelion);
  
  const total_delta_v = delta_v1 + delta_v2;
  
  return {
    intent,
    equations: [
      'v_circular = √(μ/r)',
      'v_transfer = √(μ(2/r - 1/a))',
      'Δv₁ = |v_transfer_perihelion - v_circular_1|',
      'Δv₂ = |v_circular_2 - v_transfer_aphelion|',
      'Total Δv = Δv₁ + Δv₂',
    ],
    steps: [
      { step: 1, description: 'Calculate circular orbital velocity at departure', result: `v₁ = ${(v_circular_1 / 1000).toFixed(3)} km/s` },
      { step: 2, description: 'Calculate transfer orbit velocity at perihelion', result: `v_trans_1 = ${(v_transfer_perihelion / 1000).toFixed(3)} km/s` },
      { step: 3, description: 'Calculate first burn Δv', result: `Δv₁ = ${(delta_v1 / 1000).toFixed(3)} km/s` },
      { step: 4, description: 'Calculate circular orbital velocity at arrival', result: `v₂ = ${(v_circular_2 / 1000).toFixed(3)} km/s` },
      { step: 5, description: 'Calculate transfer orbit velocity at aphelion', result: `v_trans_2 = ${(v_transfer_aphelion / 1000).toFixed(3)} km/s` },
      { step: 6, description: 'Calculate second burn Δv', result: `Δv₂ = ${(delta_v2 / 1000).toFixed(3)} km/s` },
    ],
    outputs: {
      deltaV1: { value: (delta_v1 / 1000).toFixed(3), unit: 'km/s' },
      deltaV2: { value: (delta_v2 / 1000).toFixed(3), unit: 'km/s' },
      totalDeltaV: { value: (total_delta_v / 1000).toFixed(3), unit: 'km/s' },
      semiMajorAxis: { value: (a / 1e9).toFixed(3), unit: '× 10⁹ m' },
    },
    explanation: `For a Hohmann transfer from ${(r1 / 1e6).toFixed(1)} million km to ${(r2 / 1e6).toFixed(1)} million km orbit around the Sun, the total delta-v required is ${(total_delta_v / 1000).toFixed(3)} km/s.`,
  };
}

async function computeWithAI(
  query: string,
  intent: MathIntent,
  provider: MathProvider,
  walletAddress: string
): Promise<{ result: MathResult; tokenUsage: { input: number; output: number; total: number }; latencyMs: number }> {
  const startTime = Date.now();
  
  const systemPrompt = `You are a precise mathematical computation assistant. Given a math problem, provide:
1. The parsed intent and inputs
2. Relevant equations used
3. Step-by-step solution
4. Final outputs with proper units

Respond in JSON format:
{
  "equations": ["equation1", "equation2"],
  "steps": [{"step": 1, "description": "...", "result": "..."}],
  "outputs": {"resultName": {"value": "...", "unit": "..."}},
  "explanation": "..."
}`;

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-wallet-address': walletAddress,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Solve this math problem: ${query}` },
      ],
      provider,
      stream: false,
    }),
  });

  const latencyMs = Date.now() - startTime;
  
  if (!response.ok) {
    throw new Error(`AI provider error: ${response.statusText}`);
  }

  const data = await response.json() as { 
    message?: { content?: string }; 
    content?: string; 
    usage?: { input: number; output: number; total: number };
    model?: string;
  };
  
  let parsed: any = {};
  try {
    const content = data.message?.content || data.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch {
    parsed = { explanation: data.message?.content || data.content || 'Unable to parse result' };
  }

  return {
    result: {
      intent,
      equations: parsed.equations || [],
      steps: parsed.steps || [],
      outputs: parsed.outputs || {},
      explanation: parsed.explanation,
    },
    tokenUsage: data.usage || { input: 0, output: 0, total: 0 },
    latencyMs,
  };
}

function computeLocally(query: string, intent: MathIntent): MathResult {
  if (intent.type === 'arithmetic') {
    const { result, steps } = evaluateArithmetic(query);
    return {
      intent,
      equations: [query.trim()],
      steps: steps.map((s, i) => ({ step: i + 1, description: s, result: '' })),
      outputs: {
        result: { value: result.toString(), unit: '' },
      },
    };
  }
  
  if (intent.type === 'orbital') {
    return computeOrbitalMechanics(intent);
  }
  
  return {
    intent,
    equations: [],
    steps: [],
    outputs: {},
    explanation: 'Local computation not available for this type. Use AI provider.',
  };
}

function createReceiptHash(data: any): string {
  return '0x' + createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function requireWallet(req: Request, res: Response): string | null {
  const wallet = req.headers['x-wallet-address'] as string;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    res.status(401).json({ error: 'Valid wallet address required in x-wallet-address header' });
    return null;
  }
  return wallet.toLowerCase();
}

router.post('/intents', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const { query } = z.object({ query: z.string().min(1) }).parse(req.body);
    const intent = parseIntent(query);

    logger.info(`Parsed intent for wallet ${wallet}: ${intent.type}/${intent.operation}`);

    res.json({
      intent,
      suggestedEngine: intent.type === 'arithmetic' ? 'local' : 'hybrid',
      suggestedProvider: intent.type === 'orbital' ? 'local' : 'anthropic',
    });
  } catch (err: any) {
    logger.error(`Intent parsing failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.post('/compute', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const parsed = computeRequestSchema.parse(req.body);
    const startTime = Date.now();
    
    const intent = parseIntent(parsed.query);
    logger.info(`Computing ${intent.type}/${intent.operation} for wallet ${wallet}`);

    let result: MathResult;
    let tokenUsage = { input: 0, output: 0, total: 0 };
    let latencyMs = 0;
    let usedProvider: MathProvider | null = null;

    if (parsed.engine === 'symbolic' || (parsed.engine === 'hybrid' && intent.type !== 'arithmetic')) {
      const provider = parsed.provider || 'anthropic';
      try {
        const aiResult = await computeWithAI(parsed.query, intent, provider as MathProvider, wallet);
        result = aiResult.result;
        tokenUsage = aiResult.tokenUsage;
        latencyMs = aiResult.latencyMs;
        usedProvider = provider as MathProvider;
      } catch (aiError) {
        logger.info('AI provider failed, falling back to local computation');
        result = computeLocally(parsed.query, intent);
        latencyMs = Date.now() - startTime;
        usedProvider = 'local';
      }
    } else {
      result = computeLocally(parsed.query, intent);
      latencyMs = Date.now() - startTime;
      usedProvider = 'local';
    }

    const receiptHash = createReceiptHash({
      wallet,
      query: parsed.query,
      intent: intent.type,
      outputs: result.outputs,
      timestamp: Date.now(),
    });

    const [computation] = await db.insert(mathComputations).values({
      walletAddress: wallet,
      intentType: intent.type,
      query: parsed.query,
      inputPayload: intent.inputs,
      engine: parsed.engine as MathEngine,
      provider: usedProvider,
      equations: result.equations,
      steps: result.steps,
      outputs: result.outputs,
      latencyMs,
      tokenUsage,
      receiptHash,
    }).returning();

    logger.info(`Math computation ${computation.id} completed in ${latencyMs}ms`);

    res.json({
      computation: {
        id: computation.id,
        intent: result.intent,
        equations: result.equations,
        steps: result.steps,
        outputs: result.outputs,
        explanation: result.explanation,
      },
      meta: {
        engine: parsed.engine,
        provider: usedProvider,
        latencyMs,
        tokenUsage,
      },
      receipt: {
        hash: receiptHash,
        wallet,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error(`Computation failed: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

router.get('/history', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const computations = await db.select().from(mathComputations)
      .where(eq(mathComputations.walletAddress, wallet))
      .orderBy(desc(mathComputations.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({
      computations: computations.map(c => ({
        id: c.id,
        intentType: c.intentType,
        query: c.query,
        outputs: c.outputs,
        engine: c.engine,
        provider: c.provider,
        latencyMs: c.latencyMs,
        createdAt: c.createdAt,
      })),
      count: computations.length,
    });
  } catch (err: any) {
    logger.error(`Failed to fetch history: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [computation] = await db.select().from(mathComputations)
      .where(and(
        eq(mathComputations.id, req.params.id),
        eq(mathComputations.walletAddress, wallet)
      ));

    if (!computation) {
      return res.status(404).json({ error: 'Computation not found' });
    }

    res.json({ computation });
  } catch (err: any) {
    logger.error(`Failed to fetch computation: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/receipt', async (req: Request, res: Response) => {
  try {
    const wallet = requireWallet(req, res);
    if (!wallet) return;

    const [computation] = await db.select().from(mathComputations)
      .where(and(
        eq(mathComputations.id, req.params.id),
        eq(mathComputations.walletAddress, wallet)
      ));

    if (!computation) {
      return res.status(404).json({ error: 'Computation not found' });
    }

    res.json({
      receipt: {
        id: computation.id,
        hash: computation.receiptHash,
        wallet: computation.walletAddress,
        intentType: computation.intentType,
        query: computation.query,
        inputs: computation.inputPayload,
        outputs: computation.outputs,
        provider: computation.provider,
        tokenUsage: computation.tokenUsage,
        latencyMs: computation.latencyMs,
        timestamp: computation.createdAt,
      },
    });
  } catch (err: any) {
    logger.error(`Failed to fetch receipt: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
