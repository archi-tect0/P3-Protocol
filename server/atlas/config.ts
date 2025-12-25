import type { Scope } from './types';

export const atlasConfig = {
  reviewScopes: ['anchors'] as Scope[],  // Only anchors require review in demo mode
  consentScopes: ['wallet', 'messages', 'payments', 'dao', 'storage', 'anchors', 'media', 'proxy'] as Scope[],
  autoConsentScopes: ['registry', 'wallet', 'proxy', 'messages', 'storage', 'media', 'payments', 'gallery', 'dao'] as Scope[],
  sessionTTL: 3600000,
  registryCacheTTL: 60000,
  maxFlowSteps: 20,
  maxRetries: 3,
  rateLimits: {
    max: 180,
    windowMs: 60000,
    messagesPerMinute: 60,
    paymentsPerMinute: 10,
    anchorsPerMinute: 30,
  },
  roleHierarchy: {
    admin: ['admin', 'moderator', 'user'],
    moderator: ['moderator', 'user'],
    user: ['user'],
  } as Record<string, string[]>,
};
