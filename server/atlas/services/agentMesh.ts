import type { Session } from '../types';
import { Materializer, CanvasCard, createMaterializer } from '../core/cards';

export type AgentProvider = 'openai' | 'anthropic' | 'gemini';

export interface AgentCapability {
  provider: AgentProvider;
  action: string;
  description: string;
  inputType: 'text' | 'image' | 'audio' | 'structured';
  outputType: 'text' | 'image' | 'structured';
}

export interface AgentStep {
  provider: AgentProvider;
  action: string;
  input: any;
  apiKey?: string;
  model?: string;
}

export interface AgentFlowResult {
  success: boolean;
  steps: Array<{
    provider: AgentProvider;
    action: string;
    output: any;
    duration: number;
  }>;
  finalOutput: any;
  errors: string[];
  cards: CanvasCard[];
}

export type AtlasReceiptEmitter = (receipt: {
  type: 'atlas_llm' | 'atlas_app' | 'atlas_materialize';
  wallet: string;
  ref: string;
  meta?: Record<string, any>;
}) => void;

const AGENT_CAPABILITIES: AgentCapability[] = [
  { provider: 'anthropic', action: 'summarize', description: 'Summarize long text into key points', inputType: 'text', outputType: 'text' },
  { provider: 'anthropic', action: 'analyze', description: 'Deep analysis and reasoning', inputType: 'text', outputType: 'structured' },
  { provider: 'anthropic', action: 'critique', description: 'Critical review and feedback', inputType: 'text', outputType: 'text' },
  { provider: 'openai', action: 'rewrite', description: 'Rewrite text in different style', inputType: 'text', outputType: 'text' },
  { provider: 'openai', action: 'generate', description: 'Generate creative content', inputType: 'text', outputType: 'text' },
  { provider: 'openai', action: 'code', description: 'Generate or explain code', inputType: 'text', outputType: 'text' },
  { provider: 'gemini', action: 'visualize', description: 'Create visual representations', inputType: 'text', outputType: 'structured' },
  { provider: 'gemini', action: 'multimodal', description: 'Process images and text together', inputType: 'image', outputType: 'text' },
];

const ACTION_SYSTEM_PROMPTS: Record<string, string> = {
  summarize: 'You are a summarization expert. Create clear, concise summaries that capture the key points. Use bullet points when helpful.',
  analyze: 'You are an analytical expert. Provide deep, structured analysis with clear reasoning and evidence.',
  critique: 'You are a thoughtful critic. Provide constructive feedback, highlighting both strengths and areas for improvement.',
  rewrite: 'You are a skilled editor. Rewrite the text to be clearer, more engaging, and better structured while preserving meaning.',
  generate: 'You are a creative writer. Generate engaging, original content based on the prompt.',
  code: 'You are an expert programmer. Write clean, well-documented code with clear explanations.',
  visualize: 'You are a data visualization expert. Describe or create structured representations of information.',
  multimodal: 'You are a multimodal AI. Analyze and describe images in detail, combining visual and textual understanding.',
};

export function getAgentCapabilities(): AgentCapability[] {
  return AGENT_CAPABILITIES;
}

export function findCapability(action: string): AgentCapability | null {
  return AGENT_CAPABILITIES.find(c => c.action === action) || null;
}

const KEYWORD_MAPPINGS: Record<string, { action: string; provider: AgentProvider }> = {
  'brief': { action: 'summarize', provider: 'anthropic' },
  'overview': { action: 'summarize', provider: 'anthropic' },
  'recap': { action: 'summarize', provider: 'anthropic' },
  'digest': { action: 'summarize', provider: 'anthropic' },
  'highlights': { action: 'summarize', provider: 'anthropic' },
  'gist': { action: 'summarize', provider: 'anthropic' },
  'key': { action: 'summarize', provider: 'anthropic' },
  'main': { action: 'summarize', provider: 'anthropic' },
  'breakdown': { action: 'analyze', provider: 'anthropic' },
  'insight': { action: 'analyze', provider: 'anthropic' },
  'insights': { action: 'analyze', provider: 'anthropic' },
  'investigate': { action: 'analyze', provider: 'anthropic' },
  'study': { action: 'analyze', provider: 'anthropic' },
  'deep': { action: 'analyze', provider: 'anthropic' },
  'dive': { action: 'analyze', provider: 'anthropic' },
  'explore': { action: 'analyze', provider: 'anthropic' },
  'understand': { action: 'analyze', provider: 'anthropic' },
  'assess': { action: 'critique', provider: 'anthropic' },
  'judge': { action: 'critique', provider: 'anthropic' },
  'rate': { action: 'critique', provider: 'anthropic' },
  'grade': { action: 'critique', provider: 'anthropic' },
  'score': { action: 'critique', provider: 'anthropic' },
  'polish': { action: 'rewrite', provider: 'openai' },
  'refine': { action: 'rewrite', provider: 'openai' },
  'revise': { action: 'rewrite', provider: 'openai' },
  'simplify': { action: 'rewrite', provider: 'openai' },
  'clarify': { action: 'rewrite', provider: 'openai' },
  'draft': { action: 'generate', provider: 'openai' },
  'build': { action: 'generate', provider: 'openai' },
  'make': { action: 'generate', provider: 'openai' },
  'craft': { action: 'generate', provider: 'openai' },
  'develop': { action: 'code', provider: 'openai' },
  'implement': { action: 'code', provider: 'openai' },
  'fix': { action: 'code', provider: 'openai' },
  'debug': { action: 'code', provider: 'openai' },
  'refactor': { action: 'code', provider: 'openai' },
  'plot': { action: 'visualize', provider: 'gemini' },
  'draw': { action: 'visualize', provider: 'gemini' },
  'illustrate': { action: 'visualize', provider: 'gemini' },
  'render': { action: 'visualize', provider: 'gemini' },
  'sketch': { action: 'visualize', provider: 'gemini' },
  'map': { action: 'visualize', provider: 'gemini' },
};

const SEMANTIC_EMBEDDINGS: Record<string, { action: string; provider: AgentProvider; keywords: string[] }> = {
  summarize: {
    action: 'summarize',
    provider: 'anthropic',
    keywords: ['short', 'quick', 'main', 'important', 'essence', 'gist', 'highlight', 'condense', 'distill'],
  },
  analyze: {
    action: 'analyze',
    provider: 'anthropic',
    keywords: ['understand', 'explain', 'why', 'how', 'reason', 'cause', 'effect', 'meaning', 'interpret'],
  },
  critique: {
    action: 'critique',
    provider: 'anthropic',
    keywords: ['good', 'bad', 'better', 'worse', 'improve', 'strength', 'weakness', 'flaw', 'quality'],
  },
  rewrite: {
    action: 'rewrite',
    provider: 'openai',
    keywords: ['change', 'different', 'better', 'clearer', 'simpler', 'professional', 'casual', 'formal'],
  },
  generate: {
    action: 'generate',
    provider: 'openai',
    keywords: ['new', 'original', 'idea', 'creative', 'story', 'article', 'post', 'content', 'text'],
  },
  code: {
    action: 'code',
    provider: 'openai',
    keywords: ['function', 'class', 'api', 'endpoint', 'bug', 'error', 'typescript', 'javascript', 'python'],
  },
  visualize: {
    action: 'visualize',
    provider: 'gemini',
    keywords: ['show', 'display', 'represent', 'data', 'trend', 'comparison', 'visual', 'image', 'picture'],
  },
};

function computeSemanticScore(query: string, keywords: string[]): number {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  let score = 0;
  for (const keyword of keywords) {
    if (queryLower.includes(keyword)) {
      score += 2;
    }
    for (const word of queryWords) {
      if (word.startsWith(keyword.slice(0, 4)) || keyword.startsWith(word.slice(0, 4))) {
        score += 1;
      }
    }
  }
  return score;
}

export interface IntentMatch {
  provider: AgentProvider;
  action: string;
  tier: 'regex' | 'keyword' | 'semantic';
  confidence: number;
}

export function parseAgentIntent(query: string): { provider: AgentProvider; action: string } | null {
  const match = parseAgentIntentWithTier(query);
  return match ? { provider: match.provider, action: match.action } : null;
}

function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAgentIntentWithTier(query: string): IntentMatch | null {
  const regexPatterns = [
    { pattern: /summarize|summary|tldr|key points/i, action: 'summarize', provider: 'anthropic' as AgentProvider },
    { pattern: /analyze|analysis|deep dive|examine/i, action: 'analyze', provider: 'anthropic' as AgentProvider },
    { pattern: /critique|review|feedback|evaluate/i, action: 'critique', provider: 'anthropic' as AgentProvider },
    { pattern: /rewrite|rephrase|improve|edit/i, action: 'rewrite', provider: 'openai' as AgentProvider },
    { pattern: /generate|create|write|compose/i, action: 'generate', provider: 'openai' as AgentProvider },
    { pattern: /code|program|function|script/i, action: 'code', provider: 'openai' as AgentProvider },
    { pattern: /visualize|chart|diagram|graph/i, action: 'visualize', provider: 'gemini' as AgentProvider },
  ];
  
  for (const { pattern, action, provider } of regexPatterns) {
    if (pattern.test(query)) {
      return { provider, action, tier: 'regex', confidence: 1.0 };
    }
  }
  
  const normalized = normalizeQuery(query);
  const words = normalized.split(' ');
  for (const word of words) {
    const mapping = KEYWORD_MAPPINGS[word];
    if (mapping) {
      return { provider: mapping.provider, action: mapping.action, tier: 'keyword', confidence: 0.85 };
    }
  }
  
  let bestMatch: IntentMatch | null = null;
  let bestScore = 0;
  
  for (const [, config] of Object.entries(SEMANTIC_EMBEDDINGS)) {
    const score = computeSemanticScore(normalized, config.keywords);
    if (score > bestScore && score >= 1) {
      bestScore = score;
      bestMatch = {
        provider: config.provider,
        action: config.action,
        tier: 'semantic',
        confidence: Math.min(0.7, 0.2 + score * 0.15),
      };
    }
  }
  
  return bestMatch;
}

export function parseMultiAgentFlow(query: string): AgentStep[] | null {
  const chainPatterns = [
    {
      pattern: /summarize.*then.*rewrite/i,
      steps: [
        { provider: 'anthropic' as AgentProvider, action: 'summarize' },
        { provider: 'openai' as AgentProvider, action: 'rewrite' },
      ],
    },
    {
      pattern: /analyze.*then.*critique/i,
      steps: [
        { provider: 'anthropic' as AgentProvider, action: 'analyze' },
        { provider: 'anthropic' as AgentProvider, action: 'critique' },
      ],
    },
    {
      pattern: /summarize.*critique.*visualize/i,
      steps: [
        { provider: 'anthropic' as AgentProvider, action: 'summarize' },
        { provider: 'openai' as AgentProvider, action: 'critique' },
        { provider: 'gemini' as AgentProvider, action: 'visualize' },
      ],
    },
    {
      pattern: /generate.*then.*improve|write.*then.*edit/i,
      steps: [
        { provider: 'openai' as AgentProvider, action: 'generate' },
        { provider: 'openai' as AgentProvider, action: 'rewrite' },
      ],
    },
  ];
  
  for (const { pattern, steps } of chainPatterns) {
    if (pattern.test(query)) {
      return steps.map(s => ({ ...s, input: null }));
    }
  }
  
  return null;
}

export async function executeAgentStep(
  step: AgentStep,
  input: string
): Promise<{ success: boolean; output: any; error?: string }> {
  if (!step.apiKey) {
    return { success: false, output: null, error: `No API key for ${step.provider}` };
  }
  
  const systemPrompt = ACTION_SYSTEM_PROMPTS[step.action] || 'You are a helpful AI assistant.';
  
  try {
    const apiUrl = step.provider === 'openai' 
      ? '/api/ai/openai/chat'
      : step.provider === 'anthropic'
      ? '/api/ai/anthropic/chat'
      : '/api/ai/gemini/chat';
    
    const response = await fetch(`http://localhost:5000${apiUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': step.apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input },
        ],
        model: step.model,
      }),
    });
    
    const data = await response.json() as { reply?: string; error?: string };
    
    if (data.error) {
      return { success: false, output: null, error: data.error };
    }
    
    return { success: true, output: data.reply || '' };
  } catch (err: any) {
    return { success: false, output: null, error: err.message };
  }
}

export interface AgentFlowOptions {
  wallet?: string;
  sessionId?: string;
  receiptEmitter?: AtlasReceiptEmitter;
  emitCards?: boolean;
}

export class AgentAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentAuthError';
  }
}

export async function executeAgentFlow(
  steps: AgentStep[],
  initialInput: string,
  apiKeys: Partial<Record<AgentProvider, { key: string; model?: string }>>,
  options: AgentFlowOptions = {}
): Promise<AgentFlowResult> {
  const { wallet, sessionId, receiptEmitter, emitCards = true } = options;
  
  if (!wallet) {
    throw new AgentAuthError('Wallet address required for LLM flow execution');
  }
  
  if (!sessionId) {
    throw new AgentAuthError('Session ID required for LLM flow execution');
  }
  
  const materializer = createMaterializer({
    wallet,
    sessionId,
    receiptEmitter,
  });
  
  const results: AgentFlowResult['steps'] = [];
  const errors: string[] = [];
  let currentInput = initialInput;
  
  for (const step of steps) {
    const providerConfig = apiKeys[step.provider];
    if (!providerConfig?.key) {
      errors.push(`Missing API key for ${step.provider}`);
      continue;
    }
    
    const startTime = Date.now();
    const result = await executeAgentStep(
      { ...step, apiKey: providerConfig.key, model: providerConfig.model, input: currentInput },
      currentInput
    );
    
    const duration = Date.now() - startTime;
    
    results.push({
      provider: step.provider,
      action: step.action,
      output: result.output,
      duration,
    });
    
    if (receiptEmitter && wallet) {
      receiptEmitter({
        type: 'atlas_llm',
        wallet,
        ref: `${step.provider}:${step.action}`,
        meta: {
          model: providerConfig.model,
          duration,
          success: result.success,
        },
      });
    }
    
    if (!result.success) {
      errors.push(`${step.provider}.${step.action}: ${result.error}`);
      
      if (emitCards) {
        materializer.emitError(
          `${step.provider}.${step.action} failed`,
          result.error || 'Unknown error',
          { type: 'llm', ref: step.provider, model: providerConfig.model }
        );
      }
      break;
    }
    
    if (emitCards) {
      materializer.emitReasoning(
        `${findCapability(step.action)?.description || step.action}`,
        { type: 'llm', ref: step.provider, model: providerConfig.model },
        result.output,
        { model: providerConfig.model }
      );
    }
    
    currentInput = result.output;
  }
  
  if (emitCards && results.length > 1) {
    materializer.emitPipeline(
      `Agent flow: ${steps.map(s => s.action).join(' → ')}`,
      results.map(r => ({ provider: r.provider, action: r.action, duration: r.duration }))
    );
  }
  
  return {
    success: errors.length === 0,
    steps: results,
    finalOutput: currentInput,
    errors,
    cards: materializer.getCards(),
  };
}

export function describeAgentFlow(steps: AgentStep[]): string {
  if (steps.length === 0) return 'No agent steps';
  
  const descriptions = steps.map(s => {
    const cap = findCapability(s.action);
    return `${s.provider}.${s.action}${cap ? ` (${cap.description})` : ''}`;
  });
  
  return descriptions.join(' → ');
}
