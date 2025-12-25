import type { Recipe, Scope } from './types';

export const recipes: Recipe[] = [
  {
    id: 'dailyHealthCheck',
    title: 'Daily Health Check',
    description: 'Review visitor metrics and recent error logs for system health monitoring',
    steps: [
      { key: 'metrics.visitors', args: { range: 'day' } },
      { key: 'logs.recent', args: { level: 'error', limit: 50 } },
    ],
    requiredScopes: ['admin'] as Scope[],
    roles: ['admin'],
  },
  {
    id: 'voteThenNotify',
    title: 'Vote & Notify',
    description: 'Cast a DAO vote and send a notification about the vote result',
    steps: [
      { key: 'dao.vote', args: { proposalId: '', choice: '' } },
      { key: 'messages.notify', args: { type: 'vote_cast', target: '' } },
    ],
    requiredScopes: ['dao', 'messages'] as Scope[],
    roles: ['user', 'moderator', 'admin'],
  },
  {
    id: 'moderatorReview',
    title: 'Moderator Review',
    description: 'List moderation flags and review recent activity logs',
    steps: [
      { key: 'moderation.flags.list', args: { status: 'pending', limit: 20 } },
      { key: 'logs.recent', args: { level: 'info', limit: 100 } },
    ],
    requiredScopes: ['moderator', 'admin'] as Scope[],
    roles: ['moderator', 'admin'],
  },
  {
    id: 'sendAndAnchor',
    title: 'Send & Anchor',
    description: 'Send a message and anchor the proof on-chain',
    steps: [
      { key: 'messages.compose', args: { to: '', content: '' } },
      { key: 'anchors.create', args: { eventType: 'message' } },
    ],
    requiredScopes: ['messages', 'anchors'] as Scope[],
    roles: ['user', 'moderator', 'admin'],
  },
  {
    id: 'paymentWithReceipt',
    title: 'Payment with Receipt',
    description: 'Send a payment and generate an anchored receipt',
    steps: [
      { key: 'payments.send', args: { to: '', amount: '', token: 'ETH' } },
      { key: 'anchors.create', args: { eventType: 'payment' } },
    ],
    requiredScopes: ['payments', 'anchors'] as Scope[],
    roles: ['user', 'moderator', 'admin'],
  },
];

export function getRecipeById(id: string): Recipe | undefined {
  return recipes.find(r => r.id === id);
}

export function getRecipesByRole(role: string): Recipe[] {
  return recipes.filter(r => r.roles.includes(role));
}

export function getRecipesByScope(scope: Scope): Recipe[] {
  return recipes.filter(r => r.requiredScopes.includes(scope));
}
