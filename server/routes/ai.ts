import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { aiThreads, aiMessages, aiReceipts } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';
import { getDeveloperKey } from '../atlas/services/vault';

const logger = rootLogger.child({ module: 'ai-routes' });
const router = Router();

function getWallet(req: Request): string | null {
  return (req.headers['x-wallet-address'] as string || '').toLowerCase() || null;
}

const MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
  gemini: 'gemini-1.5-flash',
};

const ENV_KEY_NAMES: Record<string, string[]> = {
  openai: ['AI_INTEGRATIONS_OPENAI_API_KEY', 'OPENAI_API_KEY'],
  anthropic: ['ANTHROPIC_API_KEY'],
  gemini: ['GEMINI_API_KEY'],
};

const createThreadSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini']),
  title: z.string().min(1).max(256).optional(),
  systemPrompt: z.string().optional(),
});

const sendMessageSchema = z.object({
  threadId: z.string().uuid(),
  content: z.string().min(1),
  stream: z.boolean().default(true),
});

const relaySchema = z.object({
  fromThreadId: z.string().uuid(),
  toThreadId: z.string().uuid(),
  promptPrefix: z.string().optional(),
});

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function getEnvKey(provider: string): string | null {
  const envNames = ENV_KEY_NAMES[provider] || [];
  for (const name of envNames) {
    const key = process.env[name];
    if (key) return key;
  }
  return null;
}

interface KeyResolution {
  apiKey: string;
  keySource: 'wallet' | 'server';
}

async function resolveProviderKey(wallet: string, provider: string): Promise<KeyResolution | null> {
  const walletKey = await getDeveloperKey(wallet, provider);
  if (walletKey) {
    logger.debug(`Using wallet-scoped key for provider ${provider}`);
    return { apiKey: walletKey, keySource: 'wallet' };
  }

  const envKey = getEnvKey(provider);
  if (envKey) {
    logger.debug(`Using server environment key for provider ${provider}`);
    return { apiKey: envKey, keySource: 'server' };
  }

  return null;
}

function getProviderKeyHint(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'Configure your OpenAI API key in Developer Settings or contact admin to enable server-side key.';
    case 'anthropic':
      return 'Configure your Anthropic API key in Developer Settings or contact admin to enable server-side key.';
    case 'gemini':
      return 'Configure your Gemini API key in Developer Settings or contact admin to enable server-side key.';
    default:
      return `Configure your ${provider} API key in Developer Settings.`;
  }
}

async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  apiKey: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const allMessages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    ...messages.map(m => ({ role: m.role.toLowerCase(), content: m.content })),
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELS.openai,
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const json = await res.json() as any;
  const text = json.choices?.[0]?.message?.content || '';
  return {
    text,
    inputTokens: json.usage?.prompt_tokens || estimateTokens(allMessages.map(m => m.content).join('')),
    outputTokens: json.usage?.completion_tokens || estimateTokens(text),
  };
}

async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  apiKey: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const formattedMessages = messages.map(m => ({
    role: m.role.toLowerCase() as 'user' | 'assistant',
    content: m.content,
  }));

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODELS.anthropic,
      system: systemPrompt,
      messages: formattedMessages,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const json = await res.json() as any;
  const text = json.content?.[0]?.text || '';
  return {
    text,
    inputTokens: json.usage?.input_tokens || estimateTokens(messages.map(m => m.content).join('')),
    outputTokens: json.usage?.output_tokens || estimateTokens(text),
  };
}

async function callGemini(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  apiKey: string
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const contents = [
    ...(systemPrompt ? [{ role: 'user', parts: [{ text: `System: ${systemPrompt}` }] }] : []),
    ...messages.map(m => ({
      role: m.role.toLowerCase() === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ];

  const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODELS.gemini}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const json = await res.json() as any;
  const text = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
  return {
    text,
    inputTokens: estimateTokens(messages.map(m => m.content).join('')),
    outputTokens: estimateTokens(text),
  };
}

async function callProvider(
  provider: string,
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string | undefined,
  apiKey: string
) {
  switch (provider) {
    case 'openai': return callOpenAI(messages, systemPrompt, apiKey);
    case 'anthropic': return callAnthropic(messages, systemPrompt, apiKey);
    case 'gemini': return callGemini(messages, systemPrompt, apiKey);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

router.post('/threads', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const parsed = createThreadSchema.parse(req.body);
    const [thread] = await db.insert(aiThreads).values({
      walletAddress: wallet,
      provider: parsed.provider,
      title: parsed.title || `${parsed.provider.charAt(0).toUpperCase() + parsed.provider.slice(1)} Chat`,
      model: MODELS[parsed.provider],
      systemPrompt: parsed.systemPrompt,
    }).returning();

    logger.info(`Created AI thread ${thread.id} for wallet ${wallet} with provider ${parsed.provider}`);
    res.json({ thread, receipt: { status: 'success' } });
  } catch (err: any) {
    logger.error(`Failed to create thread: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

router.get('/threads', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const threads = await db.select().from(aiThreads)
      .where(eq(aiThreads.walletAddress, wallet))
      .orderBy(desc(aiThreads.updatedAt));

    res.json({ threads, count: threads.length, receipt: { status: threads.length ? 'success' : 'empty' } });
  } catch (err: any) {
    logger.error(`Failed to list threads: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

router.get('/threads/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const [thread] = await db.select().from(aiThreads)
      .where(and(eq(aiThreads.id, req.params.id), eq(aiThreads.walletAddress, wallet)));

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found', receipt: { status: 'error' } });
    }

    const messages = await db.select().from(aiMessages)
      .where(eq(aiMessages.threadId, thread.id))
      .orderBy(aiMessages.createdAt);

    res.json({ thread, messages, receipt: { status: 'success' } });
  } catch (err: any) {
    logger.error(`Failed to get thread: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

router.delete('/threads/:id', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const [deleted] = await db.delete(aiThreads)
      .where(and(eq(aiThreads.id, req.params.id), eq(aiThreads.walletAddress, wallet)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Thread not found', receipt: { status: 'error' } });
    }

    logger.info(`Deleted AI thread ${req.params.id} for wallet ${wallet}`);
    res.json({ success: true, receipt: { status: 'success' } });
  } catch (err: any) {
    logger.error(`Failed to delete thread: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

router.post('/messages', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const parsed = sendMessageSchema.parse(req.body);
    const [thread] = await db.select().from(aiThreads)
      .where(and(eq(aiThreads.id, parsed.threadId), eq(aiThreads.walletAddress, wallet)));

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found', receipt: { status: 'error' } });
    }

    const keyResolution = await resolveProviderKey(wallet, thread.provider);
    if (!keyResolution) {
      const hint = getProviderKeyHint(thread.provider);
      logger.warn(`No API key available for provider ${thread.provider} and wallet ${wallet}`);
      return res.status(403).json({
        error: `No API key configured for ${thread.provider}. ${hint}`,
        code: 'NO_API_KEY',
        receipt: { status: 'error' },
      });
    }

    const { apiKey, keySource } = keyResolution;

    await db.insert(aiMessages).values({
      threadId: thread.id,
      role: 'user',
      content: parsed.content,
      tokenCount: estimateTokens(parsed.content),
    });

    const history = await db.select().from(aiMessages)
      .where(eq(aiMessages.threadId, thread.id))
      .orderBy(aiMessages.createdAt);

    const messages = history.map(m => ({ role: m.role, content: m.content }));

    if (parsed.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const result = await callProvider(thread.provider, messages, thread.systemPrompt || undefined, apiKey);
        
        const chunkSize = 20;
        for (let i = 0; i < result.text.length; i += chunkSize) {
          const chunk = result.text.slice(i, i + chunkSize);
          res.write(`data: ${JSON.stringify({ type: 'token', token: chunk })}\n\n`);
          await new Promise(r => setTimeout(r, 10));
        }

        const [assistantMsg] = await db.insert(aiMessages).values({
          threadId: thread.id,
          role: 'assistant',
          content: result.text,
          tokenCount: result.outputTokens,
        }).returning();

        await db.update(aiThreads).set({ updatedAt: new Date() }).where(eq(aiThreads.id, thread.id));

        const latencyMs = Date.now() - start;
        await db.insert(aiReceipts).values({
          threadId: thread.id,
          provider: thread.provider,
          model: thread.model,
          latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          status: 'success',
        });

        res.write(`data: ${JSON.stringify({ 
          type: 'done', 
          messageId: assistantMsg.id, 
          latencyMs, 
          inputTokens: result.inputTokens, 
          outputTokens: result.outputTokens,
          keySource,
        })}\n\n`);
        res.end();
      } catch (err: any) {
        await db.insert(aiReceipts).values({
          threadId: thread.id,
          provider: thread.provider,
          model: thread.model,
          latencyMs: Date.now() - start,
          status: 'error',
          error: err.message,
        });
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message, keySource })}\n\n`);
        res.end();
      }
    } else {
      try {
        const result = await callProvider(thread.provider, messages, thread.systemPrompt || undefined, apiKey);

        const [assistantMsg] = await db.insert(aiMessages).values({
          threadId: thread.id,
          role: 'assistant',
          content: result.text,
          tokenCount: result.outputTokens,
        }).returning();

        await db.update(aiThreads).set({ updatedAt: new Date() }).where(eq(aiThreads.id, thread.id));

        const latencyMs = Date.now() - start;
        await db.insert(aiReceipts).values({
          threadId: thread.id,
          provider: thread.provider,
          model: thread.model,
          latencyMs,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          status: 'success',
        });

        res.json({
          message: assistantMsg,
          receipt: { 
            status: 'success', 
            latencyMs, 
            inputTokens: result.inputTokens, 
            outputTokens: result.outputTokens,
            keySource,
          },
        });
      } catch (err: any) {
        await db.insert(aiReceipts).values({
          threadId: thread.id,
          provider: thread.provider,
          model: thread.model,
          latencyMs: Date.now() - start,
          status: 'error',
          error: err.message,
        });
        throw err;
      }
    }
  } catch (err: any) {
    logger.error(`Failed to send message: ${err.message}`);
    if (!res.headersSent) {
      res.status(400).json({ error: err.message, receipt: { status: 'error' } });
    }
  }
});

router.get('/messages', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const threadId = req.query.threadId as string;
    if (!threadId) {
      return res.status(400).json({ error: 'threadId required', receipt: { status: 'error' } });
    }

    const [thread] = await db.select().from(aiThreads)
      .where(and(eq(aiThreads.id, threadId), eq(aiThreads.walletAddress, wallet)));

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found', receipt: { status: 'error' } });
    }

    const messages = await db.select().from(aiMessages)
      .where(eq(aiMessages.threadId, threadId))
      .orderBy(aiMessages.createdAt);

    res.json({ messages, count: messages.length, receipt: { status: messages.length ? 'success' : 'empty' } });
  } catch (err: any) {
    logger.error(`Failed to list messages: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

router.post('/relay', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const parsed = relaySchema.parse(req.body);
    
    const [[fromThread], [toThread]] = await Promise.all([
      db.select().from(aiThreads).where(and(eq(aiThreads.id, parsed.fromThreadId), eq(aiThreads.walletAddress, wallet))),
      db.select().from(aiThreads).where(and(eq(aiThreads.id, parsed.toThreadId), eq(aiThreads.walletAddress, wallet))),
    ]);

    if (!fromThread || !toThread) {
      return res.status(404).json({ error: 'Thread(s) not found', receipt: { status: 'error' } });
    }

    const keyResolution = await resolveProviderKey(wallet, toThread.provider);
    if (!keyResolution) {
      const hint = getProviderKeyHint(toThread.provider);
      logger.warn(`No API key available for provider ${toThread.provider} and wallet ${wallet}`);
      return res.status(403).json({
        error: `No API key configured for ${toThread.provider}. ${hint}`,
        code: 'NO_API_KEY',
        receipt: { status: 'error' },
      });
    }

    const { apiKey, keySource } = keyResolution;

    const [lastAssistant] = await db.select().from(aiMessages)
      .where(and(eq(aiMessages.threadId, parsed.fromThreadId), eq(aiMessages.role, 'assistant')))
      .orderBy(desc(aiMessages.createdAt))
      .limit(1);

    if (!lastAssistant) {
      return res.status(400).json({ error: 'No assistant message to relay', receipt: { status: 'error' } });
    }

    const relayContent = parsed.promptPrefix 
      ? `${parsed.promptPrefix}\n\n${lastAssistant.content}`
      : lastAssistant.content;

    await db.insert(aiMessages).values({
      threadId: toThread.id,
      role: 'user',
      content: relayContent,
      tokenCount: estimateTokens(relayContent),
    });

    const history = await db.select().from(aiMessages)
      .where(eq(aiMessages.threadId, toThread.id))
      .orderBy(aiMessages.createdAt);

    const messages = history.map(m => ({ role: m.role, content: m.content }));
    const result = await callProvider(toThread.provider, messages, toThread.systemPrompt || undefined, apiKey);

    const [assistantMsg] = await db.insert(aiMessages).values({
      threadId: toThread.id,
      role: 'assistant',
      content: result.text,
      tokenCount: result.outputTokens,
    }).returning();

    await db.update(aiThreads).set({ updatedAt: new Date() }).where(eq(aiThreads.id, toThread.id));

    const latencyMs = Date.now() - start;
    await db.insert(aiReceipts).values({
      threadId: toThread.id,
      provider: toThread.provider,
      model: toThread.model,
      latencyMs,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      status: 'success',
    });

    logger.info(`Relayed message from thread ${fromThread.id} to thread ${toThread.id} for wallet ${wallet}`);
    res.json({
      message: assistantMsg,
      relay: { from: fromThread.provider, to: toThread.provider },
      receipt: { 
        status: 'success', 
        latencyMs, 
        inputTokens: result.inputTokens, 
        outputTokens: result.outputTokens,
        keySource,
      },
    });
  } catch (err: any) {
    logger.error(`Failed to relay message: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

router.get('/receipts', async (req: Request, res: Response) => {
  try {
    const wallet = getWallet(req);
    if (!wallet) {
      return res.status(401).json({ error: 'Wallet address required', receipt: { status: 'error' } });
    }

    const threads = await db.select().from(aiThreads)
      .where(eq(aiThreads.walletAddress, wallet));

    const threadIds = threads.map(t => t.id);
    if (threadIds.length === 0) {
      return res.json({ receipts: [], count: 0, receipt: { status: 'empty' } });
    }

    const receipts = await db.select().from(aiReceipts)
      .orderBy(desc(aiReceipts.createdAt))
      .limit(200);

    const walletReceipts = receipts.filter(r => threadIds.includes(r.threadId));

    res.json({ receipts: walletReceipts, count: walletReceipts.length, receipt: { status: walletReceipts.length ? 'success' : 'empty' } });
  } catch (err: any) {
    logger.error(`Failed to list receipts: ${err.message}`);
    res.status(400).json({ error: err.message, receipt: { status: 'error' } });
  }
});

export default router;
