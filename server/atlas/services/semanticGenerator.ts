/**
 * Semantic Phrase Generator
 * Automatically generates voice-friendly phrases from endpoint descriptions
 * Enables developer apps to be voice-accessible without manual phrase authoring
 */

import type { EndpointMeta, EndpointSemantics } from '../types';

interface GeneratedSemantics {
  intents: string[];
  tags: string[];
  phrases: string[];
}

const ACTION_VERBS: Record<string, string[]> = {
  get: ['get', 'show', 'display', 'fetch', 'retrieve', 'pull up', 'find'],
  list: ['list', 'show all', 'get all', 'display all', 'find all'],
  create: ['create', 'make', 'add', 'new', 'start'],
  update: ['update', 'change', 'modify', 'edit', 'set'],
  delete: ['delete', 'remove', 'cancel', 'clear'],
  send: ['send', 'deliver', 'transmit', 'post'],
  buy: ['buy', 'purchase', 'order', 'get me', 'i want', 'i need'],
  search: ['search', 'find', 'look for', 'search for', 'look up'],
  check: ['check', 'verify', 'confirm', 'see if'],
  play: ['play', 'start', 'launch', 'run'],
  stop: ['stop', 'pause', 'end', 'halt'],
  open: ['open', 'launch', 'go to', 'show'],
  close: ['close', 'exit', 'leave', 'quit'],
  subscribe: ['subscribe', 'follow', 'sign up for'],
  unsubscribe: ['unsubscribe', 'unfollow', 'opt out'],
  download: ['download', 'save', 'export'],
  upload: ['upload', 'import', 'attach'],
  share: ['share', 'send to', 'forward'],
  rate: ['rate', 'review', 'score'],
  comment: ['comment', 'reply', 'respond'],
  like: ['like', 'favorite', 'heart', 'love'],
  bookmark: ['bookmark', 'save', 'star'],
  notify: ['notify', 'alert', 'remind'],
  sync: ['sync', 'synchronize', 'refresh'],
  connect: ['connect', 'link', 'integrate'],
  disconnect: ['disconnect', 'unlink', 'remove'],
  pay: ['pay', 'transfer', 'send money'],
  refund: ['refund', 'return', 'get money back'],
  track: ['track', 'monitor', 'watch', 'follow'],
  analyze: ['analyze', 'review', 'examine'],
  report: ['report', 'flag', 'mark'],
  schedule: ['schedule', 'book', 'reserve', 'set up'],
  cancel: ['cancel', 'unbook', 'remove'],
  invite: ['invite', 'add', 'include'],
  join: ['join', 'enter', 'participate'],
  leave: ['leave', 'exit', 'quit'],
};

const NOUN_PATTERNS: Record<string, string[]> = {
  message: ['message', 'msg', 'text', 'dm'],
  email: ['email', 'mail', 'e-mail'],
  payment: ['payment', 'money', 'funds', 'transfer'],
  order: ['order', 'transaction'],
  product: ['product', 'item', 'thing'],
  user: ['user', 'person', 'account', 'creator'],
  file: ['file', 'document', 'attachment'],
  image: ['image', 'photo', 'picture', 'pic'],
  video: ['video', 'clip', 'recording', 'videos'],
  audio: ['audio', 'sound', 'music', 'song'],
  notification: ['notification', 'alert'],
  event: ['event', 'meeting', 'appointment', 'calendar'],
  task: ['task', 'todo', 'to-do'],
  note: ['note', 'memo', 'reminder'],
  contact: ['contact', 'friend'],
  group: ['group', 'team', 'channel'],
  post: ['post', 'status'],
  comment: ['comment', 'reply', 'response'],
  review: ['review', 'rating', 'feedback'],
  subscription: ['subscription', 'membership', 'plan'],
  settings: ['settings', 'preferences', 'config'],
  profile: ['profile', 'info'],
  history: ['history', 'log', 'record'],
  report: ['report', 'summary', 'analysis'],
  dashboard: ['dashboard', 'overview', 'home'],
  cart: ['cart', 'basket', 'bag'],
  wishlist: ['wishlist', 'favorites', 'saved'],
  shirt: ['shirt', 't-shirt', 'tshirt', 'tee'],
  clothing: ['clothing', 'clothes', 'apparel', 'wear'],
  book: ['book', 'ebook', 'publication'],
  course: ['course', 'class', 'lesson'],
  ticket: ['ticket', 'pass', 'entry'],
  news: ['news', 'stories', 'articles', 'headlines'],
  updates: ['updates', 'catch up', 'missed'],
};

function extractActionFromDescription(description: string): string[] {
  const lowerDesc = description.toLowerCase();
  const actions: string[] = [];
  
  for (const [action, verbs] of Object.entries(ACTION_VERBS)) {
    for (const verb of verbs) {
      if (lowerDesc.includes(verb)) {
        actions.push(action);
        break;
      }
    }
  }
  
  if (actions.length === 0) {
    if (lowerDesc.includes('list') || lowerDesc.includes('all')) actions.push('list');
    else if (lowerDesc.includes('get') || lowerDesc.includes('fetch')) actions.push('get');
    else actions.push('get');
  }
  
  return [...new Set(actions)];
}

function extractNounsFromDescription(description: string, endpointKey?: string): string[] {
  const lowerDesc = description.toLowerCase();
  const nouns: string[] = [];
  
  const keyParts = endpointKey?.toLowerCase().split('.') || [];
  const searchText = `${lowerDesc} ${keyParts.join(' ')}`;
  
  for (const [noun, variants] of Object.entries(NOUN_PATTERNS)) {
    for (const variant of variants) {
      if (searchText.includes(variant) || searchText.includes(noun)) {
        nouns.push(noun);
        break;
      }
    }
  }
  
  return [...new Set(nouns)];
}

function extractKeywordsFromDescription(description: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  ]);
  
  const words = description.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  
  return [...new Set(words)];
}

function generatePhrasesFromEndpoint(
  endpointKey: string,
  description: string,
  args: Record<string, string>
): string[] {
  const phrases: string[] = [];
  const actions = extractActionFromDescription(description);
  const nouns = extractNounsFromDescription(description, endpointKey);
  const keywords = extractKeywordsFromDescription(description);
  
  const parts = endpointKey.split('.');
  const appName = parts[0];
  const actionName = parts[parts.length - 1];
  
  const primaryAction = actions[0] || 'get';
  const actionVerbs = ACTION_VERBS[primaryAction] || [primaryAction];
  
  if (nouns.length > 0) {
    const primaryNoun = nouns[0];
    const nounVariants = NOUN_PATTERNS[primaryNoun] || [primaryNoun];
    
    for (const verb of actionVerbs.slice(0, 3)) {
      phrases.push(`${verb} ${nounVariants[0]}`);
      phrases.push(`${verb} a ${nounVariants[0]}`);
      phrases.push(`${verb} my ${nounVariants[0]}`);
    }
    
    if (appName && appName !== 'proxy') {
      phrases.push(`${actionVerbs[0]} ${nounVariants[0]} from ${appName}`);
      phrases.push(`${appName} ${actionVerbs[0]} ${nounVariants[0]}`);
      phrases.push(`on ${appName} ${actionVerbs[0]} ${nounVariants[0]}`);
    }
  }
  
  if (keywords.length > 0) {
    const keywordPhrase = keywords.slice(0, 3).join(' ');
    phrases.push(keywordPhrase);
    for (const verb of actionVerbs.slice(0, 2)) {
      phrases.push(`${verb} ${keywordPhrase}`);
    }
  }
  
  if (actionName && actionName.length > 2) {
    const humanAction = actionName.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
    phrases.push(humanAction);
    if (appName && appName !== 'proxy') {
      phrases.push(`${humanAction} on ${appName}`);
      phrases.push(`${appName} ${humanAction}`);
    }
  }
  
  const argNames = Object.keys(args);
  if (argNames.length > 0 && nouns.length > 0) {
    const primaryNoun = nouns[0];
    const nounVariants = NOUN_PATTERNS[primaryNoun] || [primaryNoun];
    
    for (const argName of argNames.slice(0, 2)) {
      phrases.push(`${actionVerbs[0]} ${nounVariants[0]} {${argName}}`);
      phrases.push(`${actionVerbs[0]} {${argName}} ${nounVariants[0]}`);
      
      if (argName === 'model' || argName === 'id') {
        phrases.push(`${actionVerbs[0]} ${nounVariants[0]} model {${argName}}`);
        phrases.push(`get me ${nounVariants[0]} {${argName}}`);
      }
      if (argName === 'size') {
        phrases.push(`${actionVerbs[0]} size {${argName}} ${nounVariants[0]}`);
        phrases.push(`i need a {${argName}} ${nounVariants[0]}`);
      }
      if (argName === 'username' || argName === 'user') {
        phrases.push(`show {${argName}} ${nounVariants[0]}`);
        phrases.push(`{${argName}}'s ${nounVariants[0]}`);
      }
    }
  }
  
  if (description.toLowerCase().includes('news') || description.toLowerCase().includes('update')) {
    phrases.push('catch me up');
    phrases.push('what did i miss');
    phrases.push('any updates');
  }
  
  if (description.toLowerCase().includes('video') || description.toLowerCase().includes('watch')) {
    phrases.push('show me videos from');
    phrases.push('latest videos');
    phrases.push('recent uploads');
  }
  
  if (description.toLowerCase().includes('profile')) {
    phrases.push('show profile');
    phrases.push('look up profile');
    phrases.push('find user');
  }
  
  return [...new Set(phrases)].filter(p => p.length > 3).slice(0, 15);
}

function generateTagsFromEndpoint(
  endpointKey: string,
  description: string,
  category?: string
): string[] {
  const tags: string[] = [];
  
  const parts = endpointKey.split('.');
  tags.push(...parts);
  
  const nouns = extractNounsFromDescription(description, endpointKey);
  tags.push(...nouns);
  
  const actions = extractActionFromDescription(description);
  tags.push(...actions);
  
  if (category) {
    tags.push(category);
  }
  
  return [...new Set(tags)].slice(0, 8);
}

function generateIntentFromEndpoint(endpointKey: string): string[] {
  const normalized = endpointKey.replace(/[.-]/g, '_').toLowerCase();
  
  return [
    normalized,
    `developer_${normalized}`,
  ];
}

export function generateSemantics(
  endpointKey: string,
  endpoint: EndpointMeta,
  appCategory?: string
): GeneratedSemantics {
  const description = endpoint.description || endpointKey;
  const args = endpoint.args || {};
  
  if (endpoint.semantics) {
    return {
      intents: endpoint.semantics.intents || generateIntentFromEndpoint(endpointKey),
      tags: endpoint.semantics.tags || generateTagsFromEndpoint(endpointKey, description, appCategory),
      phrases: endpoint.semantics.phrases || generatePhrasesFromEndpoint(endpointKey, description, args),
    };
  }
  
  return {
    intents: generateIntentFromEndpoint(endpointKey),
    tags: generateTagsFromEndpoint(endpointKey, description, appCategory),
    phrases: generatePhrasesFromEndpoint(endpointKey, description, args),
  };
}

export function enrichEndpointWithSemantics(
  endpointKey: string,
  endpoint: EndpointMeta,
  appCategory?: string
): EndpointMeta {
  const generated = generateSemantics(endpointKey, endpoint, appCategory);
  
  return {
    ...endpoint,
    semantics: {
      intents: generated.intents,
      tags: generated.tags,
      phrases: generated.phrases,
    },
  };
}

export function enrichRegistryEndpoints(
  endpoints: Record<string, EndpointMeta>,
  appCategories?: Record<string, string>
): Record<string, EndpointMeta> {
  const enriched: Record<string, EndpointMeta> = {};
  
  for (const [key, endpoint] of Object.entries(endpoints)) {
    const appId = endpoint.app;
    const category = appCategories?.[appId];
    
    if (!endpoint.semantics || 
        !endpoint.semantics.phrases || 
        endpoint.semantics.phrases.length === 0) {
      enriched[key] = enrichEndpointWithSemantics(key, endpoint, category);
    } else {
      enriched[key] = endpoint;
    }
  }
  
  return enriched;
}

export function matchPhraseToEndpoint(
  query: string,
  endpoints: Record<string, EndpointMeta>
): { endpointKey: string; score: number; matchedPhrase?: string } | null {
  const normalizedQuery = query.toLowerCase().trim();
  const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 1);
  let bestMatch: { endpointKey: string; score: number; matchedPhrase?: string } | null = null;
  
  for (const [key, endpoint] of Object.entries(endpoints)) {
    if (!endpoint.semantics?.phrases) continue;
    
    for (const phrase of endpoint.semantics.phrases) {
      const phraseClean = phrase.toLowerCase().replace(/\{[^}]+\}/g, '').trim();
      const phraseWords = phraseClean.split(/\s+/).filter(w => w.length > 1);
      
      if (phraseWords.length === 0) continue;
      
      if (normalizedQuery.includes(phraseClean)) {
        const score = 2.0 + (phraseClean.length / normalizedQuery.length);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { endpointKey: key, score, matchedPhrase: phrase };
        }
        continue;
      }
      
      let exactMatches = 0;
      let partialMatches = 0;
      
      for (const phraseWord of phraseWords) {
        if (queryWords.includes(phraseWord)) {
          exactMatches++;
        } else if (queryWords.some(qw => qw.includes(phraseWord) || phraseWord.includes(qw))) {
          partialMatches++;
        }
      }
      
      const totalMatches = exactMatches + (partialMatches * 0.5);
      const matchRatio = totalMatches / phraseWords.length;
      
      if (matchRatio >= 0.8 && exactMatches >= 1) {
        const score = matchRatio * 1.5 + (exactMatches * 0.2);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { endpointKey: key, score, matchedPhrase: phrase };
        }
      }
    }
    
    if (endpoint.semantics?.tags && endpoint.semantics.tags.length > 0) {
      const tagMatches = endpoint.semantics.tags.filter(tag => 
        queryWords.some(w => w === tag || (w.length > 3 && tag.length > 3 && (w.includes(tag) || tag.includes(w))))
      );
      
      if (tagMatches.length >= 2) {
        const keyParts = key.split('.');
        const keyMatchBonus = keyParts.some(p => queryWords.includes(p)) ? 0.3 : 0;
        const score = (tagMatches.length * 0.25) + keyMatchBonus;
        
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { endpointKey: key, score };
        }
      }
    }
  }
  
  return bestMatch && bestMatch.score > 0.5 ? bestMatch : null;
}

export function extractArgsFromQuery(
  query: string,
  phrase: string,
  argSpec: Record<string, string>
): Record<string, string> {
  const args: Record<string, string> = {};
  
  const argNames = Object.keys(argSpec);
  const phraseRegex = phrase.replace(/\{([^}]+)\}/g, '(?<$1>\\S+)');
  const match = new RegExp(phraseRegex, 'i').exec(query);
  
  if (match?.groups) {
    for (const [name, value] of Object.entries(match.groups)) {
      if (value) args[name] = value;
    }
  }
  
  for (const argName of argNames) {
    if (args[argName]) continue;
    
    const patterns = [
      new RegExp(`${argName}[:\\s]+([\\w@.-]+)`, 'i'),
      new RegExp(`([\\w@.-]+)\\s+${argName}`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const argMatch = pattern.exec(query);
      if (argMatch?.[1]) {
        args[argName] = argMatch[1];
        break;
      }
    }
  }
  
  return args;
}
