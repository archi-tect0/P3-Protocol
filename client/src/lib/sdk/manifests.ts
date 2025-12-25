import type { AppManifest } from './apps';

export const appManifests: Record<string, AppManifest> = {
  'identity-vault': {
    id: 'identity-vault',
    title: 'Identity Vault',
    version: '1.0.0',
    category: 'security',
    description: 'Secure, wallet-scoped identity management with zero-PII design. Create, verify, and manage decentralized identities anchored to the blockchain.',
    developer: {
      name: 'Dciphrs',
      contact: 'https://t.me/P3Atlas',
      website: 'https://dciphrs.io/apps/identity-vault'
    },
    permissions: ['wallet', 'anchoring'],
    widgets: [
      { id: 'identity-status', title: 'ID Status', size: '1x1', entry: '/standalone/identity-vault/widget.html' }
    ],
    links: { pwa: '/standalone/identity-vault/' }
  },
  'key-rotation': {
    id: 'key-rotation',
    title: 'Key Rotation',
    version: '1.0.0',
    category: 'security',
    description: 'Automated key rotation and management. Generate, rotate, and revoke cryptographic keys with full audit trails.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/key-rotation' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/key-rotation/' }
  },
  'presence': {
    id: 'presence',
    title: 'Presence',
    version: '1.0.0',
    category: 'security',
    description: 'Proof-of-presence verification. Check in/out with cryptographic timestamps anchored on-chain.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/presence' },
    permissions: ['wallet', 'anchoring', 'notifications'],
    widgets: [
      { id: 'presence-checkin', title: 'Quick Check-in', size: '1x1', entry: '/standalone/presence/widget.html' }
    ],
    links: { pwa: '/standalone/presence/' }
  },
  'badges': {
    id: 'badges',
    title: 'Badges',
    version: '1.0.0',
    category: 'security',
    description: 'Collect and showcase protocol-verified badges. Each badge represents an on-chain achievement.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/badges' },
    permissions: ['wallet', 'anchoring'],
    widgets: [
      { id: 'badge-showcase', title: 'Badge Count', size: '1x1', entry: '/standalone/badges/widget.html' }
    ],
    links: { pwa: '/standalone/badges/' }
  },
  'session-resume': {
    id: 'session-resume',
    title: 'Session',
    version: '1.0.0',
    category: 'security',
    description: 'Cross-device session management with cryptographic verification. Resume sessions seamlessly across devices.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/session-resume' },
    permissions: ['wallet', 'storage'],
    links: { pwa: '/standalone/session-resume/' }
  },
  'policy-ack': {
    id: 'policy-ack',
    title: 'Policy',
    version: '1.0.0',
    category: 'security',
    description: 'Consent and policy acknowledgment with immutable records. Sign and anchor terms acceptance on-chain.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/policy-ack' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/policy-ack/' }
  },
  'proof-read': {
    id: 'proof-read',
    title: 'Proof Read',
    version: '1.0.0',
    category: 'security',
    description: 'Document verification and attestation. Create cryptographic proofs that documents were read and acknowledged.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/proof-read' },
    permissions: ['wallet', 'anchoring', 'storage'],
    links: { pwa: '/standalone/proof-read/' }
  },
  'invoice': {
    id: 'invoice',
    title: 'Invoice',
    version: '1.0.0',
    category: 'payments',
    description: 'Create and manage invoices with on-chain payment tracking. Full audit trail for every transaction.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/invoice' },
    permissions: ['wallet', 'payments', 'anchoring'],
    widgets: [
      { id: 'invoice-pending', title: 'Pending', size: '1x1', entry: '/standalone/invoice/widget.html' }
    ],
    contextMenu: [
      { id: 'create-invoice', label: 'Create invoice', action: 'create' }
    ],
    links: { pwa: '/standalone/invoice/' }
  },
  'marketplace': {
    id: 'marketplace',
    title: 'Market',
    version: '1.0.0',
    category: 'payments',
    description: 'Decentralized marketplace with escrow and proof-of-purchase. Buy and sell with full transaction transparency.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/marketplace' },
    permissions: ['wallet', 'payments', 'anchoring'],
    widgets: [
      { id: 'market-listings', title: 'Listings', size: '2x1', entry: '/standalone/marketplace/widget.html' }
    ],
    links: { pwa: '/standalone/marketplace/' }
  },
  'rewards': {
    id: 'rewards',
    title: 'Rewards',
    version: '1.0.0',
    category: 'payments',
    description: 'Earn and redeem protocol rewards. Track points, claim rewards, with all actions anchored on-chain.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/rewards' },
    permissions: ['wallet', 'payments', 'anchoring'],
    widgets: [
      { id: 'rewards-balance', title: 'Points', size: '1x1', entry: '/standalone/rewards/widget.html' }
    ],
    links: { pwa: '/standalone/rewards/' }
  },
  'quota': {
    id: 'quota',
    title: 'Quota',
    version: '1.0.0',
    category: 'payments',
    description: 'Usage quota tracking and management. Monitor limits with transparent, verifiable records.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/quota' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/quota/' }
  },
  'sketchpad': {
    id: 'sketchpad',
    title: 'Sketchpad',
    version: '1.2.3',
    category: 'creative',
    description: 'A protocol-native sketch app with anchored submissions. Save drawings with cryptographic timestamps.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/sketchpad' },
    permissions: ['wallet', 'storage', 'anchoring'],
    widgets: [
      { id: 'sketchpad-widget', title: 'Quick Draw', size: '1x1', entry: '/standalone/sketchpad/widget.html' }
    ],
    contextMenu: [
      { id: 'open-settings', label: 'Open settings', action: 'settings' },
      { id: 'export-data', label: 'Export data', action: 'export' }
    ],
    links: { 
      pwa: '/standalone/sketchpad/',
      deeplinks: {
        metamask: 'metamask://dapp/dciphrs.io/standalone/sketchpad',
        coinbase: 'coinbase://dapp/dciphrs.io/standalone/sketchpad'
      }
    }
  },
  'whiteboard': {
    id: 'whiteboard',
    title: 'Whiteboard',
    version: '1.0.0',
    category: 'creative',
    description: 'Collaborative whiteboard with proof-of-collaboration. Real-time drawing with anchored session proofs.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/whiteboard' },
    permissions: ['wallet', 'storage', 'anchoring'],
    widgets: [
      { id: 'whiteboard-mini', title: 'Mini Board', size: '2x2', entry: '/standalone/whiteboard/widget.html' }
    ],
    contextMenu: [
      { id: 'clear-board', label: 'Clear board', action: 'clear' }
    ],
    links: { pwa: '/standalone/whiteboard/' }
  },
  'loop': {
    id: 'loop',
    title: 'Loop Audio',
    version: '1.0.0',
    category: 'creative',
    description: 'Record and loop audio with proof-of-creation. Create music loops with verifiable timestamps.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/loop' },
    permissions: ['wallet', 'storage', 'anchoring'],
    contextMenu: [
      { id: 'audio-settings', label: 'Audio settings', action: 'settings' }
    ],
    links: { pwa: '/standalone/loop/' }
  },
  'music-jam': {
    id: 'music-jam',
    title: 'Music Jam',
    version: '1.0.0',
    category: 'creative',
    description: 'Collaborative music creation with anchored sessions. Jam together with cryptographic proof.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/music-jam' },
    permissions: ['wallet', 'storage', 'anchoring'],
    links: { pwa: '/standalone/music-jam/' }
  },
  'meme-mint': {
    id: 'meme-mint',
    title: 'Meme Mint',
    version: '1.0.0',
    category: 'creative',
    description: 'Create and mint memes as NFTs. Anchor your creations on-chain with proof of authorship.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/meme-mint' },
    permissions: ['wallet', 'payments', 'anchoring', 'storage'],
    links: { pwa: '/standalone/meme-mint/' }
  },
  'video-feed': {
    id: 'video-feed',
    title: 'Video',
    version: '1.0.0',
    category: 'creative',
    description: 'Video sharing with anchored engagement. Upload and share videos with verifiable view counts.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/video-feed' },
    permissions: ['wallet', 'storage', 'anchoring'],
    links: { pwa: '/standalone/video-feed/' }
  },
  'story': {
    id: 'story',
    title: 'Stories',
    version: '1.0.0',
    category: 'social',
    description: 'Share ephemeral stories with proof-of-engagement. Time-limited content with verifiable views.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/story' },
    permissions: ['wallet', 'storage', 'anchoring'],
    links: { pwa: '/standalone/story/' }
  },
  'link': {
    id: 'link',
    title: 'Links',
    version: '1.0.0',
    category: 'social',
    description: 'Share and bookmark links with proof-of-click. Track engagement with anchored analytics.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/link' },
    permissions: ['wallet', 'anchoring'],
    widgets: [
      { id: 'link-quick', title: 'Quick Links', size: '2x1', entry: '/standalone/link/widget.html' }
    ],
    links: { pwa: '/standalone/link/' }
  },
  'reminder': {
    id: 'reminder',
    title: 'Reminders',
    version: '1.0.0',
    category: 'social',
    description: 'Set reminders with proof-of-completion. Track tasks with anchored status updates.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/reminder' },
    permissions: ['wallet', 'notifications', 'anchoring'],
    widgets: [
      { id: 'reminder-today', title: 'Today', size: '1x1', entry: '/standalone/reminder/widget.html' }
    ],
    links: { pwa: '/standalone/reminder/' }
  },
  'reaction-race': {
    id: 'reaction-race',
    title: 'React Race',
    version: '1.0.0',
    category: 'social',
    description: 'Competitive reaction time game with anchored scores. Race against others with verifiable results.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/reaction-race' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/reaction-race/' }
  },
  'treasure-hunt': {
    id: 'treasure-hunt',
    title: 'Treasure',
    version: '1.0.0',
    category: 'social',
    description: 'Location-based treasure hunts with proof-of-discovery. Find clues with anchored claims.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/treasure-hunt' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/treasure-hunt/' }
  },
  'vote': {
    id: 'vote',
    title: 'Vote',
    version: '1.0.0',
    category: 'governance',
    description: 'Decentralized voting with proof-of-participation. Cast votes with full transparency and auditability.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/vote' },
    permissions: ['wallet', 'anchoring'],
    widgets: [
      { id: 'vote-active', title: 'Active Polls', size: '2x1', entry: '/standalone/vote/widget.html' }
    ],
    links: { pwa: '/standalone/vote/' }
  },
  'micro-dao': {
    id: 'micro-dao',
    title: 'Micro DAO',
    version: '1.0.0',
    category: 'governance',
    description: 'Create and manage micro DAOs. Lightweight governance with anchored proposals and votes.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/micro-dao' },
    permissions: ['wallet', 'payments', 'anchoring'],
    links: { pwa: '/standalone/micro-dao/' }
  },
  'trivia': {
    id: 'trivia',
    title: 'Trivia',
    version: '1.0.0',
    category: 'governance',
    description: 'Knowledge trivia with anchored scores. Compete with verifiable answer submissions.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/trivia' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/trivia/' }
  },
  'analytics': {
    id: 'analytics',
    title: 'Analytics',
    version: '1.0.0',
    category: 'analytics',
    description: 'Protocol analytics dashboard. View metrics with verifiable data trails.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/analytics' },
    permissions: ['wallet', 'anchoring'],
    widgets: [
      { id: 'analytics-summary', title: 'Summary', size: '2x1', entry: '/standalone/analytics/widget.html' }
    ],
    links: { pwa: '/standalone/analytics/' }
  },
  'receipts': {
    id: 'receipts',
    title: 'Receipts',
    version: '1.0.0',
    category: 'analytics',
    description: 'Anchor and verify receipts. Create immutable proof-of-purchase records.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/receipts' },
    permissions: ['wallet', 'anchoring', 'storage'],
    links: { pwa: '/standalone/receipts/' }
  },
  'gated-access': {
    id: 'gated-access',
    title: 'Gated',
    version: '1.0.0',
    category: 'developer',
    description: 'Token-gated access control. Restrict access based on wallet holdings with anchored verifications.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/gated-access' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/gated-access/' }
  },
  'cross-device': {
    id: 'cross-device',
    title: 'Cross-Dev',
    version: '1.0.0',
    category: 'developer',
    description: 'Cross-device session sync. Seamlessly continue sessions across devices with cryptographic handoff.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/cross-device' },
    permissions: ['wallet', 'storage'],
    links: { pwa: '/standalone/cross-device/' }
  },
  'notary': {
    id: 'notary',
    title: 'Notary',
    version: '1.0.0',
    category: 'developer',
    description: 'Digital notarization service. Timestamp and anchor documents with cryptographic proof.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/notary' },
    permissions: ['wallet', 'anchoring', 'storage'],
    links: { pwa: '/standalone/notary/' }
  },
  'anon-send': {
    id: 'anon-send',
    title: 'Anon Send',
    version: '1.0.0',
    category: 'developer',
    description: 'Anonymous messaging with privacy proofs. Send messages with zero-knowledge verification.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/anon-send' },
    permissions: ['wallet', 'messaging', 'anchoring'],
    links: { pwa: '/standalone/anon-send/' }
  },
  'micro-feed': {
    id: 'micro-feed',
    title: 'MicroFeed',
    version: '1.0.0',
    category: 'developer',
    description: 'Micro-blogging with anchored posts. Share updates with verifiable timestamps.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/micro-feed' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/micro-feed/' }
  },
  'pro-card': {
    id: 'pro-card',
    title: 'ProCard',
    version: '1.0.0',
    category: 'developer',
    description: 'Professional credential cards. Create and verify professional profiles with anchored attestations.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/pro-card' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/pro-card/' }
  },
  'crypto-tracker': {
    id: 'crypto-tracker',
    title: 'Crypto',
    version: '1.0.0',
    category: 'developer',
    description: 'Real-time cryptocurrency price tracker. Monitor tokens with price alerts.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/apps/crypto-tracker' },
    permissions: ['wallet'],
    widgets: [
      { id: 'crypto-mini', title: 'Mini Tracker', size: '1x1', entry: '/standalone/crypto-tracker/widget.html' }
    ],
    links: { pwa: '/standalone/crypto-tracker/' }
  },
  'game-asteroid': {
    id: 'game-asteroid',
    title: 'Asteroids',
    version: '1.0.0',
    category: 'games',
    description: 'Classic asteroid shooter with anchored high scores. Compete on the verifiable leaderboard.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/asteroid' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/asteroid/' }
  },
  'game-breakout': {
    id: 'game-breakout',
    title: 'Breakout',
    version: '1.0.0',
    category: 'games',
    description: 'Brick-breaking action with proof-of-score. Every level completion anchored on-chain.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/breakout' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/breakout/' }
  },
  'game-maze': {
    id: 'game-maze',
    title: 'Maze',
    version: '1.0.0',
    category: 'games',
    description: 'Procedural maze puzzles with timed challenges. Best times anchored for verification.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/maze' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/maze/' }
  },
  'game-coin': {
    id: 'game-coin',
    title: 'Coin Drop',
    version: '1.0.0',
    category: 'games',
    description: 'Coin collection game with verifiable scores. Every collection run anchored on-chain.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/coin' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/coin/' }
  },
  'game-reaction': {
    id: 'game-reaction',
    title: 'Reaction',
    version: '1.0.0',
    category: 'games',
    description: 'Reaction time challenges with proof-of-performance. Millisecond-precise records.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/reaction' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/reaction/' }
  },
  'game-racer': {
    id: 'game-racer',
    title: 'Racer',
    version: '1.0.0',
    category: 'games',
    description: 'Endless racing with anchored lap times. Compete on the verifiable leaderboard.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/racer' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/racer/' }
  },
  'game-tower': {
    id: 'game-tower',
    title: 'Tower',
    version: '1.0.0',
    category: 'games',
    description: 'Tower stacking with height verification. Every tower height anchored as proof.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/tower' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/tower/' }
  },
  'game-blockdrop': {
    id: 'game-blockdrop',
    title: 'BlockDrop',
    version: '1.0.0',
    category: 'games',
    description: 'Classic block puzzle with anchored scores. Lines cleared verified on-chain.',
    developer: { name: 'Dciphrs', contact: 'https://t.me/P3Atlas', website: 'https://dciphrs.io/games/blockdrop' },
    permissions: ['wallet', 'anchoring'],
    links: { pwa: '/standalone/games/blockdrop/' }
  },
  'mod-panel': {
    id: 'mod-panel',
    version: '1.0.0',
    title: 'Moderator Panel',
    category: 'governance',
    description: 'Wallet-gated moderation dashboard for the Hub.',
    developer: { name: 'P3 Protocol', contact: 'https://t.me/P3Atlas', website: 'https://p3protocol.io' },
    permissions: ['wallet', 'notifications'],
    widgets: [],
    contextMenu: [],
    links: { pwa: '/mod/' }
  }
};

export function getManifest(appId: string): AppManifest | null {
  return appManifests[appId] || null;
}

export function getAllManifests(): AppManifest[] {
  return Object.values(appManifests);
}

export function getManifestsByCategory(category: string): AppManifest[] {
  return Object.values(appManifests).filter(m => m.category === category);
}
