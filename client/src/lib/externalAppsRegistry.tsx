import { ExternalLink } from 'lucide-react';
import { ComponentType } from 'react';

export interface ExternalAppDefinition {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
  scopes: string[];
  gradient: string;
}

const EXTERNAL_APPS: ExternalAppDefinition[] = [
  { id: 'dehub', name: 'DeHub', url: 'https://dehub.io', icon: '🌐', category: 'web3', scopes: ['dapps'], gradient: 'from-violet-500 to-purple-600' },
  { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com', icon: '📧', category: 'communication', scopes: ['mail'], gradient: 'from-red-500 to-red-600' },
  { id: 'google-messages', name: 'Google Messages', url: 'https://messages.google.com/web', icon: '💬', category: 'communication', scopes: ['messages'], gradient: 'from-blue-500 to-blue-600' },
  { id: 'google-voice', name: 'Google Voice', url: 'https://voice.google.com', icon: '📞', category: 'communication', scopes: ['calls'], gradient: 'from-green-500 to-green-600' },
  { id: 'slack', name: 'Slack', url: 'https://slack.com', icon: '💼', category: 'communication', scopes: ['messages'], gradient: 'from-purple-500 to-purple-600' },
  { id: 'teams', name: 'Microsoft Teams', url: 'https://teams.microsoft.com', icon: '👥', category: 'communication', scopes: ['messages', 'video'], gradient: 'from-indigo-500 to-indigo-600' },
  { id: 'zoom', name: 'Zoom', url: 'https://zoom.us', icon: '🎥', category: 'communication', scopes: ['video'], gradient: 'from-blue-400 to-blue-500' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com', icon: '🎮', category: 'communication', scopes: ['messages', 'voice'], gradient: 'from-indigo-600 to-purple-600' },
  { id: 'whatsapp-web', name: 'WhatsApp', url: 'https://web.whatsapp.com', icon: '📱', category: 'communication', scopes: ['messages'], gradient: 'from-green-500 to-green-600' },
  { id: 'telegram-web', name: 'Telegram', url: 'https://web.telegram.org', icon: '✈️', category: 'communication', scopes: ['messages'], gradient: 'from-sky-500 to-sky-600' },
  { id: 'signal', name: 'Signal', url: 'https://signal.org', icon: '🔒', category: 'communication', scopes: ['messages'], gradient: 'from-blue-600 to-blue-700' },

  { id: 'google-docs', name: 'Google Docs', url: 'https://docs.google.com', icon: '📝', category: 'productivity', scopes: ['docs'], gradient: 'from-blue-500 to-blue-600' },
  { id: 'google-sheets', name: 'Google Sheets', url: 'https://sheets.google.com', icon: '📊', category: 'productivity', scopes: ['docs'], gradient: 'from-green-500 to-green-600' },
  { id: 'google-drive', name: 'Google Drive', url: 'https://drive.google.com', icon: '📁', category: 'productivity', scopes: ['storage'], gradient: 'from-yellow-500 to-yellow-600' },
  { id: 'notion', name: 'Notion', url: 'https://notion.so', icon: '📓', category: 'productivity', scopes: ['notes'], gradient: 'from-slate-600 to-slate-700' },
  { id: 'trello', name: 'Trello', url: 'https://trello.com', icon: '📋', category: 'productivity', scopes: ['tasks'], gradient: 'from-blue-500 to-blue-600' },
  { id: 'asana', name: 'Asana', url: 'https://asana.com', icon: '✅', category: 'productivity', scopes: ['tasks'], gradient: 'from-rose-500 to-rose-600' },
  { id: 'clickup', name: 'ClickUp', url: 'https://clickup.com', icon: '🎯', category: 'productivity', scopes: ['tasks'], gradient: 'from-purple-500 to-pink-500' },
  { id: 'monday', name: 'Monday.com', url: 'https://monday.com', icon: '📅', category: 'productivity', scopes: ['tasks'], gradient: 'from-red-500 to-red-600' },
  { id: 'evernote', name: 'Evernote', url: 'https://evernote.com', icon: '🐘', category: 'productivity', scopes: ['notes'], gradient: 'from-green-600 to-green-700' },
  { id: 'dropbox', name: 'Dropbox', url: 'https://dropbox.com', icon: '📦', category: 'productivity', scopes: ['storage'], gradient: 'from-blue-500 to-blue-600' },
  { id: 'box', name: 'Box', url: 'https://box.com', icon: '🗃️', category: 'productivity', scopes: ['storage'], gradient: 'from-blue-600 to-blue-700' },
  { id: 'airtable', name: 'Airtable', url: 'https://airtable.com', icon: '🗄️', category: 'productivity', scopes: ['db'], gradient: 'from-yellow-500 to-orange-500' },
  { id: 'basecamp', name: 'Basecamp', url: 'https://basecamp.com', icon: '⛺', category: 'productivity', scopes: ['projects'], gradient: 'from-green-500 to-green-600' },

  { id: 'figma', name: 'Figma', url: 'https://figma.com', icon: '🎨', category: 'design', scopes: ['design'], gradient: 'from-purple-500 to-pink-500' },
  { id: 'canva', name: 'Canva', url: 'https://canva.com', icon: '🖼️', category: 'design', scopes: ['design'], gradient: 'from-cyan-500 to-blue-500' },
  { id: 'adobe-express', name: 'Adobe Express', url: 'https://adobe.com/express', icon: '🎭', category: 'design', scopes: ['design'], gradient: 'from-red-500 to-red-600' },
  { id: 'miro', name: 'Miro', url: 'https://miro.com', icon: '📐', category: 'design', scopes: ['whiteboard'], gradient: 'from-yellow-400 to-yellow-500' },
  { id: 'photopea', name: 'Photopea', url: 'https://photopea.com', icon: '🖌️', category: 'design', scopes: ['design'], gradient: 'from-teal-500 to-teal-600' },
  { id: 'lucidchart', name: 'Lucidchart', url: 'https://lucidchart.com', icon: '📊', category: 'design', scopes: ['diagram'], gradient: 'from-orange-500 to-orange-600' },

  { id: 'spotify', name: 'Spotify', url: 'https://open.spotify.com', icon: '🎵', category: 'media', scopes: ['media'], gradient: 'from-green-500 to-green-600' },
  { id: 'soundcloud', name: 'SoundCloud', url: 'https://soundcloud.com', icon: '🎧', category: 'media', scopes: ['media'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'youtube', name: 'YouTube', url: 'https://youtube.com', icon: '▶️', category: 'media', scopes: ['media'], gradient: 'from-red-500 to-red-600' },
  { id: 'netflix', name: 'Netflix', url: 'https://netflix.com', icon: '🎬', category: 'media', scopes: ['media'], gradient: 'from-red-600 to-red-700' },
  { id: 'hulu', name: 'Hulu', url: 'https://hulu.com', icon: '📺', category: 'media', scopes: ['media'], gradient: 'from-green-400 to-green-500' },
  { id: 'disneyplus', name: 'Disney+', url: 'https://disneyplus.com', icon: '🏰', category: 'media', scopes: ['media'], gradient: 'from-blue-700 to-blue-800' },
  { id: 'twitch', name: 'Twitch', url: 'https://twitch.tv', icon: '🎮', category: 'media', scopes: ['media', 'live'], gradient: 'from-purple-600 to-purple-700' },
  { id: 'xbox', name: 'Xbox Cloud Gaming', url: 'https://xbox.com/play', icon: '🎮', category: 'media', scopes: ['gaming'], gradient: 'from-green-600 to-green-700' },
  { id: 'apple-music', name: 'Apple Music', url: 'https://music.apple.com', icon: '🍎', category: 'media', scopes: ['media'], gradient: 'from-pink-500 to-pink-600' },
  { id: 'crunchyroll', name: 'Crunchyroll', url: 'https://crunchyroll.com', icon: '🎌', category: 'media', scopes: ['media'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'vimeo', name: 'Vimeo', url: 'https://vimeo.com', icon: '🎞️', category: 'media', scopes: ['media'], gradient: 'from-cyan-500 to-cyan-600' },

  { id: 'paypal', name: 'PayPal', url: 'https://paypal.com', icon: '💳', category: 'commerce', scopes: ['payments'], gradient: 'from-blue-600 to-blue-700' },
  { id: 'stripe-dashboard', name: 'Stripe', url: 'https://dashboard.stripe.com', icon: '💎', category: 'commerce', scopes: ['payments'], gradient: 'from-purple-600 to-purple-700' },
  { id: 'amazon', name: 'Amazon', url: 'https://amazon.com', icon: '🛒', category: 'commerce', scopes: ['commerce'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'ebay', name: 'eBay', url: 'https://ebay.com', icon: '🏷️', category: 'commerce', scopes: ['commerce'], gradient: 'from-yellow-500 to-red-500' },
  { id: 'shopify', name: 'Shopify', url: 'https://shopify.com', icon: '🏪', category: 'commerce', scopes: ['commerce'], gradient: 'from-green-500 to-green-600' },
  { id: 'etsy', name: 'Etsy', url: 'https://etsy.com', icon: '🎁', category: 'commerce', scopes: ['commerce'], gradient: 'from-orange-600 to-orange-700' },
  { id: 'coinbase', name: 'Coinbase', url: 'https://coinbase.com', icon: '🪙', category: 'commerce', scopes: ['crypto'], gradient: 'from-blue-500 to-blue-600' },
  { id: 'binance', name: 'Binance', url: 'https://binance.com', icon: '💰', category: 'commerce', scopes: ['crypto'], gradient: 'from-yellow-500 to-yellow-600' },
  { id: 'robinhood', name: 'Robinhood', url: 'https://robinhood.com', icon: '📈', category: 'commerce', scopes: ['trading'], gradient: 'from-green-500 to-green-600' },
  { id: 'venmo', name: 'Venmo', url: 'https://venmo.com', icon: '💸', category: 'commerce', scopes: ['payments'], gradient: 'from-blue-400 to-blue-500' },
  { id: 'wise', name: 'Wise', url: 'https://wise.com', icon: '🌍', category: 'commerce', scopes: ['payments'], gradient: 'from-green-500 to-green-600' },

  { id: 'facebook', name: 'Facebook', url: 'https://facebook.com', icon: '👤', category: 'social', scopes: ['social'], gradient: 'from-blue-600 to-blue-700' },
  { id: 'instagram', name: 'Instagram', url: 'https://instagram.com', icon: '📸', category: 'social', scopes: ['social'], gradient: 'from-pink-500 to-purple-500' },
  { id: 'x', name: 'X (Twitter)', url: 'https://x.com', icon: '🐦', category: 'social', scopes: ['social'], gradient: 'from-slate-700 to-slate-800' },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://linkedin.com', icon: '💼', category: 'social', scopes: ['professional'], gradient: 'from-blue-600 to-blue-700' },
  { id: 'reddit', name: 'Reddit', url: 'https://reddit.com', icon: '🔴', category: 'social', scopes: ['community'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'pinterest', name: 'Pinterest', url: 'https://pinterest.com', icon: '📌', category: 'social', scopes: ['social'], gradient: 'from-red-500 to-red-600' },
  { id: 'medium', name: 'Medium', url: 'https://medium.com', icon: '✍️', category: 'social', scopes: ['publishing'], gradient: 'from-slate-600 to-slate-700' },
  { id: 'mastodon', name: 'Mastodon', url: 'https://mastodon.social', icon: '🦣', category: 'social', scopes: ['social'], gradient: 'from-purple-500 to-purple-600' },
  { id: 'bluesky', name: 'Bluesky', url: 'https://bsky.app', icon: '🦋', category: 'social', scopes: ['social'], gradient: 'from-sky-500 to-sky-600' },
  { id: 'threads', name: 'Threads', url: 'https://threads.net', icon: '@', category: 'social', scopes: ['social'], gradient: 'from-slate-700 to-slate-800' },
  { id: 'meetup', name: 'Meetup', url: 'https://meetup.com', icon: '🤝', category: 'social', scopes: ['events'], gradient: 'from-red-500 to-red-600' },

  { id: 'coursera', name: 'Coursera', url: 'https://coursera.org', icon: '🎓', category: 'learning', scopes: ['learning'], gradient: 'from-blue-500 to-blue-600' },
  { id: 'udemy', name: 'Udemy', url: 'https://udemy.com', icon: '📚', category: 'learning', scopes: ['learning'], gradient: 'from-purple-600 to-purple-700' },
  { id: 'khan-academy', name: 'Khan Academy', url: 'https://khanacademy.org', icon: '🏫', category: 'learning', scopes: ['learning'], gradient: 'from-green-500 to-green-600' },
  { id: 'duolingo', name: 'Duolingo', url: 'https://duolingo.com', icon: '🦉', category: 'learning', scopes: ['language'], gradient: 'from-green-500 to-green-600' },
  { id: 'wikipedia', name: 'Wikipedia', url: 'https://wikipedia.org', icon: '📖', category: 'learning', scopes: ['knowledge'], gradient: 'from-slate-500 to-slate-600' },
  { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: '📚', category: 'learning', scopes: ['dev'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'github', name: 'GitHub', url: 'https://github.com', icon: '🐙', category: 'learning', scopes: ['dev'], gradient: 'from-slate-700 to-slate-800' },
  { id: 'gitlab', name: 'GitLab', url: 'https://gitlab.com', icon: '🦊', category: 'learning', scopes: ['dev'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'codecademy', name: 'Codecademy', url: 'https://codecademy.com', icon: '💻', category: 'learning', scopes: ['coding'], gradient: 'from-blue-600 to-blue-700' },
  { id: 'mdn', name: 'MDN Web Docs', url: 'https://developer.mozilla.org', icon: '📜', category: 'learning', scopes: ['web'], gradient: 'from-slate-600 to-slate-700' },
  { id: 'leetcode', name: 'LeetCode', url: 'https://leetcode.com', icon: '🧩', category: 'learning', scopes: ['coding'], gradient: 'from-orange-500 to-yellow-500' },
  { id: 'hackerrank', name: 'HackerRank', url: 'https://hackerrank.com', icon: '👨‍💻', category: 'learning', scopes: ['coding'], gradient: 'from-green-500 to-green-600' },
  { id: 'replit', name: 'Replit', url: 'https://replit.com', icon: '⚡', category: 'learning', scopes: ['coding'], gradient: 'from-orange-500 to-orange-600' },
  { id: 'brilliant', name: 'Brilliant', url: 'https://brilliant.org', icon: '🧮', category: 'learning', scopes: ['math'], gradient: 'from-green-600 to-green-700' },
  { id: 'skillshare', name: 'Skillshare', url: 'https://skillshare.com', icon: '🎨', category: 'learning', scopes: ['creative'], gradient: 'from-green-500 to-green-600' },
];

function createExternalAppTile(app: ExternalAppDefinition): ComponentType {
  return function ExternalTile() {
    return (
      <div className="p-4 text-center" data-testid={`tile-external-${app.id}`}>
        <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br ${app.gradient} flex items-center justify-center shadow-lg`}>
          <span className="text-3xl">{app.icon}</span>
        </div>
        <h3 className="font-medium text-white mb-1">{app.name}</h3>
        <p className="text-xs text-slate-400 mb-3">Session persists after login</p>
        <a 
          href={app.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${app.gradient} hover:opacity-90 text-white text-sm font-medium transition-opacity`}
          data-testid={`link-open-${app.id}`}
        >
          <ExternalLink className="w-4 h-4" />
          Open
        </a>
      </div>
    );
  };
}

export function getExternalApps() {
  return EXTERNAL_APPS;
}

export function getExternalAppById(id: string) {
  return EXTERNAL_APPS.find(app => app.id === id);
}

export function getExternalAppsByCategory(category: string) {
  return EXTERNAL_APPS.filter(app => app.category === category);
}

export function createExternalAppDefinitions() {
  return EXTERNAL_APPS.map(app => ({
    id: `ext-${app.id}`,
    name: app.name,
    icon: <span className="text-2xl">{app.icon}</span>,
    gradient: app.gradient,
    category: 'external' as const,
    component: createExternalAppTile(app),
    isExternal: true,
    externalUrl: app.url,
  }));
}

export const externalCategoryInfo = {
  web3: { name: 'Web3', icon: '🌐', count: 1 },
  communication: { name: 'Communication', icon: '💬', count: 10 },
  productivity: { name: 'Productivity', icon: '📋', count: 13 },
  design: { name: 'Design', icon: '🎨', count: 6 },
  media: { name: 'Media', icon: '🎬', count: 10 },
  commerce: { name: 'Commerce', icon: '💳', count: 11 },
  social: { name: 'Social', icon: '👥', count: 11 },
  learning: { name: 'Learning', icon: '📚', count: 14 },
};

export { EXTERNAL_APPS, createExternalAppTile };
