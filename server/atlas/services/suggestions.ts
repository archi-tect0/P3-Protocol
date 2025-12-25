import type { Session } from '../types';
import { loadRegistry } from './registryAdapter';

export interface Suggestion {
  text: string;
  category: 'action' | 'query' | 'admin' | 'workflow';
  priority: number;
  endpointHint?: string;
}

const ROLE_SUGGESTIONS: Record<string, Suggestion[]> = {
  admin: [
    { text: 'How many visitors did I have today?', category: 'admin', priority: 10, endpointHint: 'metrics.visitors' },
    { text: 'Were there any error logs this week?', category: 'admin', priority: 9, endpointHint: 'logs.recent' },
    { text: 'Run daily health check', category: 'workflow', priority: 8 },
    { text: 'Show adoption metrics for this month', category: 'admin', priority: 7, endpointHint: 'metrics.adoption' },
  ],
  moderator: [
    { text: 'Review pending content reports', category: 'admin', priority: 10, endpointHint: 'moderation.queue' },
    { text: 'Check flagged messages', category: 'admin', priority: 9, endpointHint: 'moderation.flagged' },
    { text: 'View recent error logs', category: 'admin', priority: 8, endpointHint: 'logs.recent' },
  ],
  user: [],
};

const APP_SUGGESTIONS: Record<string, Suggestion[]> = {
  'messages.app': [
    { text: 'Do I have any new messages?', category: 'query', priority: 8, endpointHint: 'messages.inbox.list' },
    { text: 'Send a message to...', category: 'action', priority: 7, endpointHint: 'messages.send' },
  ],
  'notes.app': [
    { text: 'Write a new note', category: 'action', priority: 7, endpointHint: 'notes.create' },
    { text: 'Show my recent notes', category: 'query', priority: 6, endpointHint: 'notes.list' },
  ],
  'gallery.app': [
    { text: 'How many pictures are in my gallery?', category: 'query', priority: 6, endpointHint: 'gallery.count' },
    { text: 'Show my photos', category: 'query', priority: 5, endpointHint: 'gallery.list' },
  ],
  'market.app': [
    { text: 'Did I sell anything on marketplace today?', category: 'query', priority: 7, endpointHint: 'marketplace.sales.list' },
    { text: 'Check my marketplace listings', category: 'query', priority: 6, endpointHint: 'marketplace.listings' },
  ],
  'payments.app': [
    { text: 'Show my payment history', category: 'query', priority: 7, endpointHint: 'payments.history' },
    { text: 'Send payment to...', category: 'action', priority: 6, endpointHint: 'payments.send' },
  ],
  'dao.app': [
    { text: 'Any active governance proposals?', category: 'query', priority: 7, endpointHint: 'dao.proposals' },
    { text: 'Cast my vote on...', category: 'action', priority: 6, endpointHint: 'dao.vote' },
  ],
};

export function suggestNext(session: Session): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  for (const role of session.roles) {
    const roleSuggestions = ROLE_SUGGESTIONS[role] || [];
    for (const s of roleSuggestions) {
      if (!seen.has(s.text)) {
        suggestions.push(s);
        seen.add(s.text);
      }
    }
  }

  for (const appId of session.connectedApps) {
    const appSuggestions = APP_SUGGESTIONS[appId] || [];
    for (const s of appSuggestions) {
      if (!seen.has(s.text)) {
        suggestions.push(s);
        seen.add(s.text);
      }
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      { text: 'Connect apps from the Hub to get started', category: 'action', priority: 10 },
      { text: 'What can Atlas do?', category: 'query', priority: 9 },
      { text: 'Search Wikipedia for a topic', category: 'query', priority: 8, endpointHint: 'atlas.wikipedia.search' },
    );
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

export function getSuggestionsForContext(session: Session, recentCalls: string[]): Suggestion[] {
  const base = suggestNext(session);
  const contextual: Suggestion[] = [];

  if (recentCalls.includes('messages.send')) {
    contextual.push({ text: 'Send another message?', category: 'action', priority: 5 });
  }

  if (recentCalls.includes('payments.send')) {
    contextual.push({ text: 'View payment confirmation', category: 'query', priority: 5 });
  }

  if (recentCalls.includes('notes.create')) {
    contextual.push({ text: 'Add another note', category: 'action', priority: 5 });
  }

  return [...contextual, ...base].slice(0, 5);
}

export function formatSuggestionsForChat(suggestions: Suggestion[]): string[] {
  return suggestions.map(s => s.text);
}
