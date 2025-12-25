/**
 * Atlas One Intent - Voice command and natural language processing
 * 
 * Handles Atlas One voice commands:
 * - "Atlas launch [game]"
 * - "Atlas watch [movie]"
 * - "Atlas rent [movie]"
 * - "Atlas is [movie] available?"
 * - "Atlas play [book]" / "Atlas read [book]"
 * - "Atlas show me [category]"
 * - "Atlas open One"
 */

import type { ExperienceKind, AtlasOneVoiceCommand } from '../types';

export interface IntentPattern {
  pattern: RegExp;
  action: AtlasOneVoiceCommand['action'];
  kind?: ExperienceKind;
  extractTarget?: (match: RegExpMatchArray) => string;
}

export const ATLAS_ONE_PATTERNS: IntentPattern[] = [
  {
    pattern: /^(?:atlas\s+)?launch\s+(?:the\s+)?(?:game\s+)?(.+)$/i,
    action: 'launch',
    kind: 'game',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?play\s+(?:the\s+)?(?:game\s+)?(.+)$/i,
    action: 'launch',
    kind: 'game',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?watch\s+(?:the\s+)?(?:movie\s+|show\s+|film\s+)?(.+)$/i,
    action: 'watch',
    kind: 'video',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?rent\s+(?:the\s+)?(?:movie\s+|show\s+|film\s+)?(.+)$/i,
    action: 'rent',
    kind: 'video',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?(?:is\s+)?(.+?)\s+(?:available|for rent|out now|released)\??$/i,
    action: 'search',
    kind: 'video',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?read\s+(?:the\s+)?(?:book\s+|ebook\s+)?(.+)$/i,
    action: 'read',
    kind: 'ebook',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?(?:show|find|get|list)\s+(?:me\s+)?(?:some\s+)?(.+?)(?:\s+(?:options|brands|products))?$/i,
    action: 'show',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?open\s+(?:the\s+)?one(?:\s+app)?$/i,
    action: 'open',
  },
  {
    pattern: /^(?:atlas\s+)?(?:open|go to|show)\s+(?:the\s+)?(?:atlas\s+)?(?:one|marketplace|store|library)$/i,
    action: 'open',
  },
  {
    // Exclude Wikipedia searches - they're handled by dedicated wikipedia_lookup patterns
    pattern: /^(?:atlas\s+)?search\s+(?:for\s+)?(?!wikipedia\b)(?!wiki\b)(?!.+?\s+on\s+wikipedia)(.+)$/i,
    action: 'search',
    extractTarget: (m) => m[1]?.trim() || '',
  },
  {
    pattern: /^(?:atlas\s+)?(?:buy|purchase)\s+(?:the\s+)?(.+)$/i,
    action: 'purchase',
    extractTarget: (m) => m[1]?.trim() || '',
  },
];

/**
 * Parse a voice/text command into an Atlas One command
 */
export function parseAtlasOneCommand(input: string): AtlasOneVoiceCommand | null {
  const normalized = input.trim();
  
  for (const { pattern, action, kind, extractTarget } of ATLAS_ONE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        action,
        kind,
        target: extractTarget ? extractTarget(match) : undefined,
        query: extractTarget ? extractTarget(match) : undefined,
      };
    }
  }
  
  return null;
}

/**
 * Check if input matches an Atlas One command
 */
export function isAtlasOneCommand(input: string): boolean {
  return parseAtlasOneCommand(input) !== null;
}

/**
 * Get NLIntent value for Atlas One commands
 */
export function getAtlasOneNLIntent(command: AtlasOneVoiceCommand): string {
  const { action, kind } = command;
  
  const intentMap: Record<string, string> = {
    'launch:game': 'atlas_one_launch_game',
    'watch:video': 'atlas_one_watch_media',
    'rent:video': 'atlas_one_rent_media',
    'read:ebook': 'atlas_one_read_book',
    'show': 'atlas_one_browse',
    'search': 'atlas_one_search',
    'open': 'atlas_one_open',
    'purchase': 'atlas_one_purchase',
  };
  
  const key = kind ? `${action}:${kind}` : action;
  return intentMap[key] || `atlas_one_${action}`;
}

/**
 * Get feature path for Atlas One commands
 */
export function getAtlasOneFeature(command: AtlasOneVoiceCommand): string {
  const { action, kind } = command;
  
  if (kind) {
    return `atlas.one.${kind}.${action}`;
  }
  
  return `atlas.one.${action}`;
}
