const fs = require('fs');
const path = require('path');

const apps = [
  { id: 'identity-vault', name: 'Identity Vault', category: 'security' },
  { id: 'key-rotation', name: 'Key Rotation', category: 'security' },
  { id: 'presence', name: 'Presence', category: 'security' },
  { id: 'badges', name: 'Badges', category: 'security' },
  { id: 'session-resume', name: 'Session Resume', category: 'security' },
  { id: 'policy-ack', name: 'Policy Ack', category: 'security' },
  { id: 'proof-read', name: 'Proof Read', category: 'security' },
  { id: 'invoice', name: 'Invoice', category: 'payments' },
  { id: 'marketplace', name: 'Marketplace', category: 'payments' },
  { id: 'rewards', name: 'Rewards', category: 'payments' },
  { id: 'quota', name: 'Quota', category: 'payments' },
  { id: 'sketchpad', name: 'Sketchpad', category: 'creative' },
  { id: 'whiteboard', name: 'Whiteboard', category: 'creative' },
  { id: 'loop', name: 'Loop Audio', category: 'creative' },
  { id: 'music-jam', name: 'Music Jam', category: 'creative' },
  { id: 'meme-mint', name: 'Meme Mint', category: 'creative' },
  { id: 'video-feed', name: 'Video Feed', category: 'creative' },
  { id: 'story', name: 'Stories', category: 'social' },
  { id: 'link', name: 'Links', category: 'social' },
  { id: 'reminder', name: 'Reminders', category: 'social' },
  { id: 'reaction-race', name: 'React Race', category: 'social' },
  { id: 'treasure-hunt', name: 'Treasure Hunt', category: 'social' },
  { id: 'vote', name: 'Vote', category: 'governance' },
  { id: 'micro-dao', name: 'Micro DAO', category: 'governance' },
  { id: 'trivia', name: 'Trivia', category: 'governance' },
  { id: 'analytics', name: 'Analytics', category: 'analytics' },
  { id: 'receipts', name: 'Receipts', category: 'analytics' },
  { id: 'gated-access', name: 'Gated Access', category: 'developer' },
  { id: 'cross-device', name: 'Cross Device', category: 'developer' },
  { id: 'notary', name: 'Notary', category: 'developer' },
  { id: 'anon-send', name: 'Anon Send', category: 'developer' },
  { id: 'micro-feed', name: 'MicroFeed', category: 'developer' },
  { id: 'pro-card', name: 'ProCard', category: 'developer' },
];

const manifestsDir = path.join(__dirname, '../client/public/manifests');

if (!fs.existsSync(manifestsDir)) {
  fs.mkdirSync(manifestsDir, { recursive: true });
}

apps.forEach(app => {
  const manifest = {
    name: `${app.name} | P3`,
    short_name: app.name,
    description: `${app.name} - P3 Protocol mini-app`,
    start_url: `/standalone/${app.id}`,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/icons/p3-hub-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/p3-hub-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: '/icons/p3-hub-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable'
      }
    ],
    categories: [app.category, 'utilities']
  };

  const filePath = path.join(manifestsDir, `${app.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
  console.log(`Created: ${app.id}.json`);
});

console.log(`\nGenerated ${apps.length} manifests in client/public/manifests/`);
