import { loadRegistry } from './registryAdapter';

export interface SemanticMatch {
  key: string;
  score: number;
  reason: string;
}

export interface EndpointSemantics {
  intents?: string[];
  tags?: string[];
  phrases?: string[];
}

export function semanticMatch(message: string): SemanticMatch[] {
  const m = message.toLowerCase().trim();
  const registry = loadRegistry();
  const scores: SemanticMatch[] = [];

  for (const [key, meta] of Object.entries(registry.endpoints)) {
    const sem: EndpointSemantics = (meta as any).semantics || {};
    const intents: string[] = sem.intents || [];
    const tags: string[] = sem.tags || [];
    const phrases: string[] = sem.phrases || [];

    let score = 0;
    let reasons: string[] = [];

    for (const phrase of phrases) {
      if (softMatch(m, phrase)) {
        score += 3;
        reasons.push(`phrase: "${phrase}"`);
      }
    }

    for (const intent of intents) {
      if (m.includes(intent.toLowerCase().replace(/_/g, ' '))) {
        score += 2;
        reasons.push(`intent: ${intent}`);
      }
    }

    for (const tag of tags) {
      if (m.includes(tag.toLowerCase())) {
        score += 1;
        reasons.push(`tag: ${tag}`);
      }
    }

    if (score > 0) {
      scores.push({ key, score, reason: reasons.join(', ') });
    }
  }

  if (scores.length === 0) {
    for (const [key] of Object.entries(registry.endpoints)) {
      const domain = key.split('.')[0];
      if (m.includes(domain)) {
        scores.push({ key, score: 1, reason: `domain: ${domain}` });
      }
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}

function softMatch(message: string, template: string): boolean {
  const pattern = template
    .toLowerCase()
    .replace(/\{[^}]+\}/g, '(.+?)')
    .replace(/\s+/g, '\\s*');
  
  try {
    return new RegExp(pattern).test(message);
  } catch {
    return message.includes(template.toLowerCase().replace(/\{[^}]+\}/g, ''));
  }
}

export function extractVariables(message: string, template: string): Record<string, string> {
  const vars: Record<string, string> = {};
  
  const varNames: string[] = [];
  const patternParts = template.replace(/\{([^}]+)\}/g, (_, name) => {
    varNames.push(name);
    return '(.+?)';
  });
  
  const regex = new RegExp(patternParts, 'i');
  const match = message.match(regex);
  
  if (match) {
    varNames.forEach((name, i) => {
      vars[name] = match[i + 1]?.trim() || '';
    });
  }
  
  return vars;
}

export function getBestMatch(message: string): { key: string; score: number; vars: Record<string, string> } | null {
  const matches = semanticMatch(message);
  if (matches.length === 0) return null;
  
  const best = matches[0];
  const registry = loadRegistry();
  const meta = registry.endpoints[best.key];
  const sem: EndpointSemantics = (meta as any)?.semantics || {};
  
  let vars: Record<string, string> = {};
  for (const phrase of (sem.phrases || [])) {
    const extracted = extractVariables(message, phrase);
    if (Object.keys(extracted).length > 0) {
      vars = extracted;
      break;
    }
  }
  
  return { key: best.key, score: best.score, vars };
}
